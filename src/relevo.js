// Trilha e mapa de relevo da vitrine. O vídeo fica em duas esferas concêntricas com o vidro, que mudam a cada quadro:
// uMarR.x é o ponto mais próximo da lula, uMarR.y é a água. Cada fragmento lê o uv nas duas e mistura pelo valor do mapa.
// Quem olha de c0 vê quase a mesma imagem em qualquer profundidade: mexe só a disparidade e a paralaxe.
// Como as duas esferas ficam sempre além do vidro (zL >= Z_MIN), nada do vídeo passa para a frente dele.
import * as THREE from 'three';
import { param } from './config.js';
import { VITRINE } from './janelas.js';

const IPD = 0.063, THETA_MAX = 0.009, DESLOCA_MAX = 0.045, Z_MIN = 0.03, N_AGUA = 1.33, ETA = 1 / N_AGUA;
const { R: Rv, C: CV, meiaX: MEIA_X } = VITRINE.vidro;
const { b: B_VITRINE } = VITRINE;
const apice = new THREE.Vector3(0, CV[1], CV[2] - Rv);
const Cv = new THREE.Vector3(...CV);

// Amplitude do relevo: é o ajuste a fazer no óculos. Valor que não é número fica no padrão.
const lida = Number(param('relevok', '0.7'));
const AMP = THREE.MathUtils.clamp(Number.isFinite(lida) ? lida : 0.7, 0, 1.5);

// ?relevo=1 (mapa), domo, trilha ou 0. ?q=baixa usa o domo, se ?relevo não mandar outra coisa.
export function modoRelevo() {
  const pedido = param('relevo');
  if (pedido === null) return param('q') === 'baixa' ? 'domo' : '1';
  return ['1', 'domo', 'trilha', '0'].includes(pedido) ? pedido : '1';
}

// Lidos ao criar o material da vitrine, antes de o relevo carregar: o shader nasce do jeito certo e não recompila no caminho normal.
export function definesDoRelevo() {
  const modo = modoRelevo();
  if (modo === '0') return {};
  if (modo === 'domo') return { RELEVO: 1, RELEVO_DOMO: 1 };
  if (modo === 'trilha') return { RELEVO: 1 };
  return { RELEVO: 1, RELEVO_MAPA: 1, RELEVO_PASSOS: param('q') === 'alta' ? 3 : 2 };
}

// A trilha sai do repouso de uma vez em f952, e o vidro andava 0,34 m por quadro no meio da fusão.
// Mesma rampa do dissolve de f839 a f863 (tools/relevo/exporta.py), aplicada aqui ao carregar. Refeita sobre si mesma, não muda nada.
function rampaDaFusao(d) {
  const a = d.zL[949], b = d.zL[973];
  for (let f = 950; f <= 972; f++) {
    let k = (f - 949) / 24;
    k = k * k * (3 - 2 * k);
    d.zL[f] = a + (b - a) * k;
    d.zA[f] = Math.max(d.zL[f] + 2.5, 7);
  }
}

export async function criaRelevo(canal, malha, neve) {
  const modo = modoRelevo();
  const teste = param('relevoTeste');
  const parado = () => {};
  const est = {
    modo, comMapa: false, f: 0, zL: 0, zA: 0, thetaMrad: 0, desl: 0, limitado: false,
    dist: 0, dados: null, atualiza: parado, reinicia: parado, medeDesloca: null,
  };
  if (modo === '0') return est;

  const mat = malha.material, un = mat.uniforms;

  // Sem trilha não há o que seguir: plano fixo a 6 m, como em ?relevo=0, e o shader volta ao simples.
  let dados;
  try {
    if (teste === 'semtrilha') throw new Error('falha simulada por ?relevoTeste');
    const r = await fetch('assets/relevo_central.json');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    dados = await r.json();
  } catch (e) {
    console.warn('Relevo: sem trilha, o vídeo fica num plano fixo a 6 m.', e.message);
    for (const nome of ['RELEVO', 'RELEVO_MAPA', 'RELEVO_DOMO', 'RELEVO_PASSOS']) delete mat.defines[nome];
    mat.needsUpdate = true;
    est.modo = '0';
    return est;
  }
  rampaDaFusao(dados);
  est.dados = dados;

  // Sem mapa, lula e água ficam na mesma esfera (trilha). uMapa nulo dá h = 0, sem erro.
  if (modo === '1') {
    try {
      if (teste === 'semmapa') throw new Error('falha simulada por ?relevoTeste');
      const r = await fetch('assets/relevo_central.bin.gz');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const bruto = new Uint8Array(await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
      if (bruto.length !== dados.w * dados.h * dados.n) throw new Error(`tamanho ${bruto.length}`);
      const tx = new THREE.Data3DTexture(bruto, dados.w, dados.h, dados.n);
      tx.format = THREE.RedFormat;
      tx.type = THREE.UnsignedByteType;
      tx.minFilter = tx.magFilter = THREE.LinearFilter;
      tx.wrapS = tx.wrapT = tx.wrapR = THREE.ClampToEdgeWrapping;
      tx.unpackAlignment = 1;
      tx.needsUpdate = true;
      un.uMapa.value = tx;
      est.comMapa = true;
    } catch (e) {
      console.warn('Relevo: sem mapa, lula e água na mesma profundidade.', e.message);
    }
  }
  const mesmaEsfera = modo === 'trilha' || (modo === '1' && !est.comMapa);

  // Quadro para camada do atlas: as chaves não são regulares.
  const N = dados.zL.length;
  const camada = new Float32Array(N);
  for (let f = 0, j = 0; f < N; f++) {
    while (j + 1 < dados.n && dados.chaves[j + 1] <= f) j++;
    const a = dados.chaves[j], b = dados.chaves[Math.min(j + 1, dados.n - 1)];
    camada[f] = j + (b > a ? (f - a) / (b - a) : 0);
  }

  // O relevo anda junto com o quadro que está na textura, não com o relógio. Sem o aviso do navegador, vale currentTime.
  const v = canal.video;
  let tQ = 0, marca = -1e9;
  if (v.requestVideoFrameCallback) {
    const volta = (agora, m) => { tQ = m.mediaTime; marca = performance.now(); v.requestVideoFrameCallback(volta); };
    v.requestVideoFrameCallback(volta);
  }

  // A mesma conta de uvDoMar do shader, para medir o esticão de cada quadro na CPU. Sem alocar nada.
  const E = un.uEx.value, U = un.uEy.value, W = un.uEw.value, C0 = un.uCen.value, esc = un.uEsc.value;
  const g = new THREE.Vector3(), Vv = new THREE.Vector3(), Nn = new THREE.Vector3(), D = new THREE.Vector3(), hit = new THREE.Vector3();
  const uvDe = (cab, R, out) => {
    Vv.subVectors(g, cab).normalize();
    Nn.subVectors(g, Cv).normalize();
    const d = Vv.dot(Nn), k = 1 - ETA * ETA * (1 - d * d);
    D.copy(Vv).multiplyScalar(ETA).addScaledVector(Nn, -ETA * d + Math.sqrt(k)); // Nn aponta para o mar: é o refract(V,-N) do shader
    const ox = g.x - Cv.x, oy = g.y - Cv.y, oz = g.z - Cv.z, b = ox * D.x + oy * D.y + oz * D.z;
    const t = Math.sqrt(b * b - (ox * ox + oy * oy + oz * oz) + R * R) - b;
    hit.copy(g).addScaledVector(D, t).sub(C0);
    const l = hit.length() + hit.dot(W);
    const qx = (hit.dot(E) / l) * esc.x, qy = (hit.dot(U) / l) * esc.y, r2 = qx * qx + qy * qy, s = 0.5 / Math.sqrt(Math.sqrt(1 + r2 * r2));
    out[0] = qx * s + 0.5;
    out[1] = qy * s + 0.5;
  };
  const a1 = [0, 0], a2 = [0, 0], PONTOS = [[0, 0], [0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7]];
  // O quanto a imagem escorrega entre as duas esferas, na escala da largura do vídeo.
  const medeDesloca = (cab, R1, R2) => {
    let m = 0;
    for (let i = 0; i < PONTOS.length; i++) {
      const x = MEIA_X * PONTOS[i][0], y = CV[1] + B_VITRINE * PONTOS[i][1];
      g.set(x, y, CV[2] - Math.sqrt(Rv * Rv - x * x - (y - CV[1]) ** 2));
      uvDe(cab, R1, a1);
      uvDe(cab, R2, a2);
      m = Math.max(m, Math.hypot(a1[0] - a2[0], (a1[1] - a2[1]) * 9 / 16));
    }
    return m;
  };
  est.medeDesloca = medeDesloca;

  const raio = (F, dist) => Rv + N_AGUA * (F / (1 - F)) * dist;
  const unNeve = neve?.material.uniforms;
  let dist = 0, pronto = false;

  est.reinicia = () => { pronto = false; };
  est.atualiza = (cab, dt) => {
    const usaQuadro = !v.paused && performance.now() - marca < 250;
    const t = usaQuadro ? tQ : v.currentTime;
    const f = THREE.MathUtils.clamp(Math.floor(t * dados.fps + 0.01), 0, N - 1); // o contêiner dura 3,7 ms a mais que o último quadro

    // Distância suavizada: o limite de disparidade não pode pulsar com o balanço da cabeça.
    const alvo = Math.max(cab.distanceTo(apice), 0.4);
    if (!pronto) { dist = alvo; pronto = true; }
    dist += (alvo - dist) * (1 - Math.exp(-dt / 0.35));

    const zL = Math.max(dados.zL[f], Z_MIN);
    const zA = mesmaEsfera ? zL : dados.zA[f];
    const FL = zL / (dist + zL);
    const RL = Rv + N_AGUA * zL;

    // A amplitude mexe na fração da disparidade, não em metros: assim vale de perto e de longe.
    let dF = (zA / (dist + zA) - FL) * AMP;
    let limitado = false;
    // Limite de conforto: a água não pode separar da lula mais que THETA_MAX.
    const dMax = (THETA_MAX * dist) / IPD;
    if (dF > dMax) { dF = dMax; limitado = true; }
    // Limite de esticão, em oblíqua extrema. A conta não é linear: mais passadas acertam o que a primeira deixou.
    let desl = 0;
    if (dF > 0) {
      desl = medeDesloca(cab, RL, raio(FL + dF, dist));
      for (let i = 0; i < 3 && desl > DESLOCA_MAX * 1.005; i++) {
        dF *= DESLOCA_MAX / desl;
        limitado = true;
        desl = medeDesloca(cab, RL, raio(FL + dF, dist));
      }
    }
    const RA = raio(FL + dF, dist);

    un.uMarR.value.set(RL, RA);
    un.uAgua0.value = RA - Rv;
    if (un.uCamada) un.uCamada.value = (camada[f] + 0.5) / dados.n;
    if (un.uDomo) un.uDomo.value.fromArray(dados.domo, f * 4);

    // A neve fica entre o vidro e a lula, inclusive na investida. O raio de fora nunca passa do raio da lula.
    if (unNeve) {
      unNeve.uCasca.value.y = Math.max(Math.min(N_AGUA * Math.min(zL * 0.9, 6), RL - unNeve.uCasca.value.x), 0);
      unNeve.uNeveK.value = THREE.MathUtils.smoothstep(zL, 0.1, 0.5);
    }

    est.f = f;
    est.zL = zL;
    est.zA = (RA - Rv) / N_AGUA;
    est.thetaMrad = (dF * IPD * 1000) / dist;
    est.desl = desl;
    est.limitado = limitado;
    est.dist = dist;
  };
  return est;
}
