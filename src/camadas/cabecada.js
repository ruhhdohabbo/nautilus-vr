// A cabeçada: a lula bate no vídeo central, o vidro racha de verdade e a sala reage.
// Tudo é função pura do tempo do vídeo, então loop, seek e pausa não dessincronizam nada. Só os eventos e o pulso
// nos controles, que acontecem uma vez, olham a passagem pelo instante.
import * as THREE from 'three';
import { SALA, PALETA, param } from '../config.js';
import { CANAIS } from '../janelas.js';
import { sorteador } from '../geo.js';
import { zParede } from '../curva.js';

const ANTES = 0.8; // Antecipação: as luzes baixam e sai o 'pre-impacto'.
const FIM = 14; // A rachadura some no vale escuro do vídeo; luz e poeira terminam antes disso. Depois de FIM nada do efeito custa mais nada.
const FIM_LUZ = 9;
const HIATO = 0.5; // Mais que isso entre dois quadros não é passagem: os eventos sairiam atrasados e juntos.

const seg = (t, a, b) => Math.min(Math.max((t - a) / (b - a), 0), 1);
const suave = (t, a, b) => { const k = seg(t, a, b); return k * k * (3 - 2 * k); };

// Interpolação linear numa tabela plana [t0, v0, t1, v1, ...].
function tabela(t, tb) {
  if (t <= tb[0]) return tb[1];
  for (let i = 2; i < tb.length; i += 2) {
    if (t <= tb[i]) return tb[i - 1] + (tb[i + 1] - tb[i - 1]) * ((t - tb[i - 2]) / (tb[i] - tb[i - 2]));
  }
  return tb[tb.length - 1];
}

// Frente da rachadura no mapa de chegada. Maior parte em 6 quadros de vídeo; as pontas seguem andando devagar até 2,5 s.
const q = 1 / 24;
const FRENTE = [0, 0.012, q, 0.16, 3 * q, 0.34, 6 * q, 0.5, 30 * q, 0.55, 60 * q, 0.61];
const frente = (tau) => (tau < 0 ? 0 : tabela(tau, FRENTE));
// O brilho do golpe na linha. Acima disso, a estrela vista do gradil soma mais uma ida e volta de luz às que o vídeo já tem ali.
const BRILHO_GOLPE = 2;
// O vidro não se cura na frente de quem olha: some entre 39 e 44 s do vídeo, o trecho mais escuro depois do impacto, com a fusão de 40 s no meio.
const opacidade = (tau) => (tau < 0 ? 0 : 1 - suave(tau, FIM_LUZ, FIM));

// Luz das lâmpadas. Golpe: 0 quadro de ataque e duas piscadas, a primeira junto do escurecimento do vídeo, sem nunca passar de 1.
// ?piscada=0 tira as piscadas: a luz cai uma vez e só volta devagar.
const PISCADAS = param('piscada') === '0' ? [0.10, 0.08] : [0.10, 0.08, 0.20, 0.62, 0.34, 0.22];
const [FIM_PISCADAS, BASE_VOLTA] = PISCADAS.slice(-2);
function luz(tau) {
  if (tau < -ANTES) return 1;
  if (tau < 0) return 1 - 0.34 * suave(tau, -ANTES, -0.12);
  for (let i = 0; i < PISCADAS.length; i += 2) if (tau < PISCADAS[i]) return PISCADAS[i + 1];
  // A volta nasce no valor da última piscada: sem degrau, com ou sem piscadas.
  return 1 - (1 - BASE_VOLTA) * Math.exp(-(tau - FIM_PISCADAS) * 1.6);
}

// Tremor da sala: só translação (rotação em VR dá enjoo), até 2 cm, some em menos de 0,5 s.
const TREMOR = param('tremor') !== '0';
function tremor(tau, alvo) {
  if (!TREMOR || tau < 0 || tau > 0.5) return alvo.set(0, 0, 0);
  const a = Math.exp(-tau * 10);
  alvo.set(
    0.008 * a * Math.sin(tau * 72 + 1.1),
    0.009 * a * Math.sin(tau * 91 + 0.4),
    0.012 * Math.exp(-tau * 16) + 0.006 * a * Math.sin(tau * 64),
  );
  return alvo.clampLength(0, 0.02);
}

// Poeira que cai das costelas e do teto. Só existe e só custa durante o efeito.
const VERT_POEIRA = /* glsl */`
uniform float uTau, uAltPx, uK;
attribute vec4 aD;
varying float vA;
void main(){
  float s=uTau-aD.x, vt=aD.y, tf=vt/9.8, ss=max(s,0.);
  vec3 p=position;
  // Queda com arrasto: acelera e chega à velocidade limite de cada grão.
  p.y-=vt*(ss-tf*(1.-exp(-ss/tf)));
  p.x+=sin(ss*.8+aD.w*6.28)*.05*ss;
  p.z+=cos(ss*.7+aD.w*12.)*.05*ss;
  vec4 mv=viewMatrix*vec4(p,1.);
  float d=max(-mv.z,.05);
  float px=aD.z*projectionMatrix[1][1]*uAltPx*.5/d;
  gl_PointSize=clamp(px,1.3,44.);
  // Os grãos grandes são véus de pó, quase transparentes.
  float veu=smoothstep(.03,.07,aD.z);
  vA=step(0.,s)*smoothstep(0.,.1+veu*.5,ss)*(1.-smoothstep(3.,6.5,ss))*smoothstep(.0,.15,p.y)*min(px/1.3,1.)*uK*mix(1.,.2,veu);
  gl_Position=projectionMatrix*mv;
}`;
const FRAG_POEIRA = /* glsl */`
uniform vec3 uCor;
varying float vA;
void main(){
  vec2 q=gl_PointCoord*2.-1.;
  float a=1.-dot(q,q);
  if(a<=0.) discard;
  gl_FragColor=vec4(uCor,a*vA);
}`;

function criaPoeira(cena, comuns, qualidade) {
  const { A, B, YC, Z_PROA, Z_POPA, BAIAS } = SALA;
  const r = sorteador(20);
  const arco = (t, recuo) => {
    const nx = -Math.cos(t) / A, ny = -Math.sin(t) / B, l = Math.hypot(nx, ny);
    return [A * Math.cos(t) + (nx / l) * recuo, YC + B * Math.sin(t) + (ny / l) * recuo];
  };
  // Pontos de onde a poeira solta: várias frestas em cada costela e na viga. Sai em véus, não em chuva uniforme.
  const frestas = [];
  for (let b = 0; b <= BAIAS; b++) {
    const z = Z_PROA + ((Z_POPA - Z_PROA) * b) / BAIAS;
    for (let k = 0; k < 7; k++) {
      const [x, y] = arco(0.3 + r() * (Math.PI - 0.6), 0.17);
      // A primeira costela anda colada na parede curva.
      frestas.push([x, y, (b ? z : zParede(x) + 0.11) + (r() - 0.5) * 0.2, 0.14]);
    }
  }
  for (let k = 0; k < 12; k++) frestas.push([(r() - 0.5) * 0.45, YC + B - 0.27, Z_PROA + r() * (Z_POPA - Z_PROA), 0.12]);

  const n = Math.round(1500 * qualidade.poeira);
  const pos = new Float32Array(n * 3), dados = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const f = frestas[Math.floor(r() * frestas.length)];
    const tipo = r(), pesado = tipo < 0.1, veu = tipo > 0.82; // Lascas de ferrugem caem rápido e acabam no chão; o pó fica no ar.
    pos[i * 3] = f[0] + (r() - 0.5) * f[3] * 1.6;
    pos[i * 3 + 1] = f[1] - r() * 0.05;
    pos[i * 3 + 2] = f[2] + (r() - 0.5) * f[3];
    // O choque vem da proa e anda pelo casco; cada grão solta com um atraso próprio.
    dados[i * 4] = ((f[2] - Z_PROA) / (Z_POPA - Z_PROA)) * 0.12 + r() * r() * (pesado ? 0.35 : 1.1);
    dados[i * 4 + 1] = pesado ? 2.6 + r() * 2 : veu ? 0.2 + r() * 0.3 : 0.35 + r() * 0.7;
    dados[i * 4 + 2] = pesado ? 0.02 + r() * 0.016 : veu ? 0.1 + r() * 0.13 : 0.014 + r() * 0.016;
    dados[i * 4 + 3] = r();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aD', new THREE.BufferAttribute(dados, 4));
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT_POEIRA, fragmentShader: FRAG_POEIRA, transparent: true, depthWrite: false,
    uniforms: {
      uTau: { value: 0 }, uAltPx: comuns.uAltPx, uK: { value: 1 },
      uCor: { value: new THREE.Color(PALETA.caqui).multiplyScalar(0.8) },
    },
  });
  const p = new THREE.Points(g, mat);
  p.name = 'poeira-cabecada';
  p.frustumCulled = false;
  p.visible = false;
  p.renderOrder = 12;
  cena.add(p);
  return p;
}

export async function cria(mundo) {
  const { cena, comuns, sala, vidros, canais, jogador, eventos, renderer } = mundo;
  const video = canais.central.video;
  const impactos = param('impacto') !== null ? [Number(param('impacto'))] : CANAIS.central.impactos;
  if (!impactos?.length) return null;

  const carregador = new THREE.TextureLoader();
  const [mapaA, mapaB] = await Promise.all(['assets/racha_a.png', 'assets/racha_b.png'].map((u) => carregador.loadAsync(u)));
  mapaA.anisotropy = 4;
  const un = vidros[0].material.uniforms;
  un.uRachaA.value = mapaA;
  un.uRachaB.value = mapaB;

  const poeira = criaPoeira(cena, comuns, mundo.q);
  // Compila já: a primeira aparição é no contato, o pior instante para travar um quadro.
  renderer.compile(poeira, mundo.camera, cena);
  const unPoeira = poeira.material.uniforms;

  // Repouso da luz e das lâmpadas, para devolver tudo igual quando o efeito termina.
  const corLamp = comuns.uLampCor.value.clone();
  const fonte = comuns.uFonte.value.clone();
  const { globos, halo } = sala.luminarias;
  const corHalo = halo.material.uniforms.uCor.value.clone();
  const repouso = sala.lampadas.map((c) => c.clone());
  const PIVO = 0.32;
  // Fator de cada lâmpada: as da popa levam o choque depois e mais fraco; o giro lateral dá uma elipse, não um risco.
  const balanco = repouso.map((c, i) => {
    const longe = c.z > 0;
    return {
      atraso: longe ? 0.07 : 0.02, amp: longe ? 0.21 : 0.3,
      lat: (i % 2 ? 1 : -1) * (longe ? 0.08 : 0.12),
      periodo: 1.27 + i * 0.035,
    };
  });

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3();
  const _um = new THREE.Vector3(1, 1, 1), _d = new THREE.Vector3(0, -PIVO, 0);
  const _tremor = new THREE.Vector3(), _ultimoTremor = jogador.desvio;

  function balanca(tau) {
    for (let i = 0; i < repouso.length; i++) {
      const b = balanco[i], td = tau - b.atraso;
      // Pêndulo amortecido: o golpe dá velocidade, não posição, então a lâmpada começa do repouso e assenta aos poucos.
      const k = td > 0 ? Math.exp(-td * 0.55) : 0;
      const w = (Math.PI * 2) / b.periodo;
      _e.set(-b.amp * k * Math.sin(w * td), 0, b.lat * k * Math.sin(w * 0.93 * td));
      _q.setFromEuler(_e);
      const c = repouso[i];
      _p.copy(_d).applyQuaternion(_q);
      _p.set(c.x + _p.x, c.y + PIVO + _p.y, c.z + _p.z);
      sala.lampadas[i].copy(_p);
      globos.setMatrixAt(i, _m.compose(_p, _q, _um));
      halo.setMatrixAt(i, _m.makeTranslation(_p.x, _p.y, _p.z));
    }
    globos.instanceMatrix.needsUpdate = true;
    halo.instanceMatrix.needsUpdate = true;
  }

  function poeLuz(L) {
    comuns.uLampCor.value.copy(corLamp).multiplyScalar(L);
    globos.material.color.setScalar(L);
    halo.material.uniforms.uCor.value.copy(corHalo).multiplyScalar(L);
    un.uLampK.value = L;
  }

  // A poça de luz vem de uma fonte acima da vitrine: mexer nela sacode a poça no piso.
  function sacodePoca(tau) {
    if (tau < 0) { comuns.uFonte.value.copy(fonte); return; }
    const a = Math.exp(-tau * 2.6), b = Math.exp(-tau * 0.7);
    comuns.uFonte.value.set(
      fonte.x + 1.1 * a * Math.sin(tau * 41) + 0.45 * b * Math.sin(tau * 7.3),
      fonte.y + 0.8 * a * Math.sin(tau * 53 + 1),
      fonte.z,
    );
  }

  function pulsa(forca, ms) {
    const sessao = renderer.xr.getSession?.();
    if (!sessao) return;
    for (const f of sessao.inputSources) f.gamepad?.hapticActuators?.[0]?.pulse?.(forca, ms);
  }

  let ativo = false;
  let ultimo = video.currentTime;
  let pulou = false;
  video.addEventListener('seeking', () => { pulou = true; });
  let tauAgora = -Infinity;
  let luzEmRepouso = false;
  let recolhidas = 0;

  // Luz, lâmpadas, poça, poeira e tremor de volta ao repouso. A rachadura é de quem chama.
  function repousa() {
    poeira.visible = false;
    poeLuz(1);
    comuns.uFonte.value.copy(fonte);
    balanca(-1);
    jogador.rig.position.sub(_ultimoTremor);
    _ultimoTremor.set(0, 0, 0);
  }

  function recolhe() {
    ativo = false;
    recolhidas++;
    un.uRacha.value.set(0, 0, 0);
    repousa();
  }

  return {
    atualiza() {
      const ct = video.currentTime;

      // Eventos: só numa passagem normal pelo instante. Pulo de seek, volta do loop e hiato de quadros não disparam nada.
      if (ct > ultimo && ct - ultimo < HIATO && !pulou) {
        for (let i = 0; i < impactos.length; i++) {
          const T = impactos[i];
          if (ultimo < T - ANTES && ct >= T - ANTES) {
            eventos.dispatchEvent(new CustomEvent('pre-impacto', { detail: { forca: 1 } }));
            pulsa(0.12, 500);
          }
          if (ultimo < T && ct >= T) {
            eventos.dispatchEvent(new CustomEvent('impacto', { detail: { forca: 1 } }));
            pulsa(1, 260);
          }
        }
      }
      ultimo = ct;
      pulou = false;

      let tau = -Infinity;
      for (let i = 0; i < impactos.length; i++) if (ct >= impactos[i] - ANTES) tau = ct - impactos[i];
      tauAgora = tau;
      if (tau > FIM || tau === -Infinity) {
        if (ativo) recolhe();
        return;
      }
      ativo = true;

      un.uRacha.value.set(frente(tau), opacidade(tau), tau >= 0 ? BRILHO_GOLPE * Math.exp(-tau * 7) : 0);
      // De FIM_LUZ a FIM só a rachadura ainda muda: o resto fica em repouso e não sobe nada para a GPU.
      if (tau >= FIM_LUZ) {
        if (!luzEmRepouso) repousa();
        luzEmRepouso = true;
        return;
      }
      luzEmRepouso = false;

      const L = luz(tau);
      poeLuz(L);
      sacodePoca(tau);
      balanca(tau);

      poeira.visible = tau >= 0;
      unPoeira.uTau.value = tau;
      unPoeira.uK.value = (0.35 + 0.65 * Math.min(L, 1)) * (1 - suave(tau, FIM_LUZ - 1.5, FIM_LUZ));

      // Soma o tremor ao rig descontando o do quadro anterior: não interfere com quem anda.
      tremor(tau, _tremor);
      jogador.rig.position.add(_tremor).sub(_ultimoTremor);
      _ultimoTremor.copy(_tremor);
    },

    // Para testar: volta o vídeo para pouco antes do contato e deixa tudo acontecer de verdade.
    dispara(antes = 2) {
      video.currentTime = Math.max(impactos[0] - antes, 0);
      return video.play();
    },

    medidas: () => ({ ct: video.currentTime, tau: tauAgora, ativo, racha: un.uRacha.value.toArray(), luz: un.uLampK.value, tremor: _ultimoTremor.toArray(), recolhidas }),
  };
}
