// Salão do Nautilus em VR. Tudo o que se soma ao mundo entra como uma "camada" com atualiza(t, dt).
import * as THREE from 'three';
import { SALA, PALETA, param, qualidade } from './config.js';
import { VITRINE, MARES_LATERAIS } from './janelas.js';
import { criaTexturas } from './texturas.js';
import { criaComuns, criaMaterial } from './material.js';
import { criaSala } from './sala.js';
import { criaJanelas } from './vidro.js';
import { criaCanais, tocaTodos, luzDosCanais, ligaSom } from './videos.js';
import { criaParticulas } from './particulas.js';
import { criaRelevo } from './relevo.js';
import { Jogador } from './jogador.js';
import { Hud } from './hud.js';

const q = qualidade();

// ?emu=1 simula um Quest 3 no navegador, para testar a sessão de VR sem o óculos.
if (param('emu') !== null) {
  const { XRDevice, metaQuest3 } = await import('../vendor/iwer/iwer.module.min.js');
  const dispositivo = new XRDevice(metaQuest3);
  dispositivo.installRuntime({ forceInstall: true });
  window.__xrd = dispositivo;
}

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', stencil: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, q.pixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(PALETA.abismo);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFramebufferScaleFactor(q.xrEscala);
renderer.xr.setFoveation(q.foveacao);
document.body.prepend(renderer.domElement);

const cena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.05, 60);

const tex = criaTexturas(renderer);
const comuns = criaComuns([], tex.caustica, VITRINE);
comuns.uAltPx = { value: 1000 };
comuns.uPelicula = { value: tex.pelicula };

const M = {
  ferro: criaMaterial(comuns, { tex: tex.ferro, cor: 0xa8a89a, rough: 1, normalK: 0.7, lado: THREE.DoubleSide }),
  costela: criaMaterial(comuns, { tex: tex.ferro, cor: 0x8c8c78, rough: 0.7, normalK: 0.6 }),
  lambri: criaMaterial(comuns, { tex: tex.madeira, cor: 0xffffff, rough: 1, normalK: 0.8, lado: THREE.DoubleSide }),
  piso: criaMaterial(comuns, { tex: tex.madeira, cor: 0xe6dcd2, rough: 0.8, normalK: 0.6, piso: 1 }),
  tapete: criaMaterial(comuns, { tex: tex.tapete, cor: 0xc3c3c3, rough: 1, normalK: 1, piso: 1 }),
  latao: criaMaterial(comuns, { tex: tex.ferro, cor: 0xf0d48a, rough: 0.5, metal: 1, normalK: 0.25 }),
  rebite: criaMaterial(comuns, { tex: tex.ferro, cor: 0x8a8a72, rough: 0.6, metal: 0.4, normalK: 0 }),
};

const canais = criaCanais();
const sala = criaSala(cena, M, comuns, q);
const vidros = criaJanelas(cena, canais, sala, comuns);
sala.finaliza();

// O aro das janelas e os metais entram na lista de latão durante a montagem das janelas.
{
  const { mergeGeometries } = await import('three/addons/BufferGeometryUtils.js');
  const m = new THREE.Mesh(mergeGeometries(sala.latao), M.latao);
  m.name = 'latao';
  m.frustumCulled = false;
  cena.add(m);
}

const particulas = criaParticulas(cena, comuns, q, canais);
const jogador = new Jogador(renderer, camera, cena, renderer.domElement);
const hud = new Hud(renderer, camera, canais);
jogador.aoAlternarHud = () => hud.alterna();

const vigiasPorLado = [[MARES_LATERAIS.E.canal], [MARES_LATERAIS.D.canal]];

// Camadas do mundo: cada arquivo de src/camadas exporta cria(mundo) e devolve
// { atualiza(t, dt), aoComecar(audioCtx) }, os dois opcionais. ?camadas=salao,som carrega só essas; ?camadas= nenhuma.
// Uma camada com erro não derruba o resto do salão.
const eventos = new EventTarget();
const camadas = [];
const camadasPorNome = {};
let som = null;
let audio = null;
const mundo = { renderer, cena, camera, jogador, comuns, tex, M, sala, vidros, canais, hud, q, eventos, particulas };
const NOMES_CAMADAS = ['salao', 'moldura', 'cabecada', 'som'];
const pedidas = param('camadas') === null ? NOMES_CAMADAS : param('camadas').split(',').filter(Boolean);

const entregaAudio = (camada) => {
  try { camada.aoComecar?.(audio); } catch (e) { console.error(`Camada ${camada.nome}, aoComecar:`, e); }
};

const cargas = pedidas.map((nome) => import(`./camadas/${nome}.js`)
  .then((modulo) => modulo.cria(mundo))
  .then((camada) => {
    if (!camada) return;
    camada.nome = nome;
    camada.erros = 0;
    camadas.push(camada);
    camadasPorNome[nome] = camada;
    if (audio) entregaAudio(camada);
  })
  .catch((e) => console.error(`Camada ${nome} não carregou:`, e)));

// Desenha a cena inteira uma vez antes da entrada, sem recorte: shaders, texturas e geometrias sobem aqui,
// e não na primeira virada dentro do óculos.
function esquenta() {
  if (renderer.xr.isPresenting) return;
  const recortados = [];
  cena.traverse((o) => {
    if (!o.frustumCulled) return;
    o.frustumCulled = false;
    recortados.push(o);
  });
  renderer.render(cena, camera);
  for (const o of recortados) o.frustumCulled = true;
}

// A sala assada num cubo, para o reflexo do vidro. Roda uma vez, depois de esquenta. Se terminar com a sessão já aberta também serve:
// CubeCamera.update guarda e repõe o alvo e o XR. Se falhar, o vidro segue sem o reflexo da sala: o three liga um cubo vazio, que dá preto.
function assaReflexo() {
  const fora = [...vidros, particulas.fora, particulas.dentro, sala.luminarias.halo];
  const antes = fora.map((o) => o.visible);
  try {
    const alvo = new THREE.WebGLCubeRenderTarget(256, {
      colorSpace: THREE.SRGBColorSpace, generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
    });
    const cubo = new THREE.CubeCamera(0.2, 40, alvo);
    cubo.position.set(0, 2, 0);
    fora.forEach((o) => { o.visible = false; });
    comuns.uExp.value = 1.6; // O órgão e os metais precisam de luz própria no cubo: sem a janela, ficariam pretos.
    cubo.update(renderer, cena);
    comuns.uSalaRefl.value = alvo.texture;
    comuns.uCuboK.value = 1;
  } catch (e) {
    console.warn('Reflexo da sala não assou:', e);
  } finally {
    comuns.uExp.value = 1;
    fora.forEach((o, i) => { o.visible = antes[i]; });
  }
}

// Relevo da vitrine: a trilha e o mapa sobem antes de esquenta, para o atlas entrar na primeira passada. Se falhar, o vídeo fica num plano só.
let relevo = null;
const relevoPronto = criaRelevo(canais[VITRINE.canal], vidros[0], particulas.fora)
  .then((r) => { relevo = r; })
  .catch((e) => console.error('Relevo:', e));
const prontas = Promise.allSettled([...cargas, relevoPronto]).then(esquenta).then(assaReflexo);

// Erro em camada não congela a imagem: renderer.render fica fora do try. Com 3 quadros seguidos de erro, ela sai da lista.
const ERROS_MAX = 3;
function rodaCamadas(t, dt) {
  for (let i = 0; i < camadas.length; i++) {
    const camada = camadas[i];
    try {
      camada.atualiza?.(t, dt);
      camada.erros = 0;
    } catch (e) {
      console.error(`Camada ${camada.nome}:`, e);
      if (++camada.erros < ERROS_MAX) continue;
      console.error(`Camada ${camada.nome} retirada depois de ${ERROS_MAX} erros seguidos.`);
      camadas.splice(i--, 1);
    }
  }
}

let errosOuvinte = 0;
function rodaOuvinte() {
  if (!som) return;
  try {
    som.ouvinte(camera);
    errosOuvinte = 0;
  } catch (e) {
    console.error('Som, ouvinte:', e);
    if (++errosOuvinte >= ERROS_MAX) som = null;
  }
}

const listaCanais = Object.values(canais);
const altura = new THREE.Vector2();
const cabeca = new THREE.Vector3();
let anterior = performance.now();

renderer.setAnimationLoop((agora) => {
  const dt = Math.min((agora - anterior) / 1000, 0.1);
  anterior = agora;
  const t = agora / 1000;

  jogador.atualiza(dt);
  for (let i = 0; i < listaCanais.length; i++) listaCanais[i].atualiza(agora, dt);
  luzDosCanais(canais, comuns, VITRINE.canal, vigiasPorLado);
  comuns.uT.value = t;

  if (renderer.xr.isPresenting) {
    const vista = renderer.xr.getCamera().cameras[0]?.viewport;
    if (vista) comuns.uAltPx.value = vista.height;
  } else comuns.uAltPx.value = renderer.getDrawingBufferSize(altura).y;

  camera.getWorldPosition(cabeca);
  relevo?.atualiza(cabeca, dt);
  rodaCamadas(t, dt);
  rodaOuvinte();

  renderer.render(cena, camera);
  hud.fimDoQuadro();
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Entrada.
const entrada = document.getElementById('entrada');
const estado = document.getElementById('estado');
const btVR = document.getElementById('btVR');
const btTela = document.getElementById('btTela');

tocaTodos(canais);

// Som mudo por enquanto: ?som=1 liga. O áudio segue processando, só não sai para o alto-falante.
const MUDO = param('som') !== '1';
let semAudio = false;

function criaAudio() {
  try {
    const ctx = MUDO ? new AudioContext({ sinkId: { type: 'none' } }) : new AudioContext();
    // Navegador sem saída muda: o mudo só se garante sem áudio nenhum. O central fica sem MediaElementSource e segue andando sozinho.
    if (MUDO && ctx.sinkId?.type !== 'none') {
      semAudio = true;
      ctx.close().catch(() => {});
      return;
    }
    audio = ctx;
    // Com o som ligado, o relógio do vídeo central é o do contexto: suspenso, o central e a cabeçada param junto.
    audio.addEventListener('statechange', () => { if (audio.state === 'suspended') audio.resume().catch(() => {}); });
    try { som = ligaSom(canais[VITRINE.canal], comuns.uJanC.value, audio); } catch (e) { console.warn('Som:', e.message); }
    for (const camada of camadas) entregaAudio(camada);
  } catch (e) {
    semAudio = true;
    console.warn('Áudio indisponível:', e.message);
  }
}

// Roda dentro do clique: som só é liberado pelo navegador durante o gesto do usuário.
// Nunca lança: áudio com problema não impede a entrada.
const comeca = () => {
  if (!audio && !semAudio) criaAudio();
  audio?.resume().catch(() => {});
  return tocaTodos(canais);
};

btTela.disabled = false;
btTela.addEventListener('click', () => {
  comeca();
  entrada.hidden = true;
});

async function preparaVR() {
  if (!navigator.xr) {
    estado.textContent = isSecureContext
      ? 'Este navegador não tem VR. Abra no navegador do óculos.'
      : 'VR precisa de HTTPS: abra o endereço https:// que o servidor mostra.';
    return;
  }
  const ok = await navigator.xr.isSessionSupported('immersive-vr').catch(() => false);
  if (!ok) {
    estado.textContent = 'Nenhum óculos encontrado. Dá para ver na tela.';
    return;
  }
  // Só libera a entrada com as camadas prontas: quem entra cedo veria as peças surgindo e pegaria quadros longos
  // já no óculos. O teto é para uma rede travada não prender a entrada.
  await Promise.race([prontas, new Promise((r) => setTimeout(r, 8000))]);
  estado.textContent = 'Óculos encontrado.';
  btVR.disabled = false;
  btVR.addEventListener('click', async () => {
    btVR.disabled = true;
    comeca();
    let sessao;
    try {
      sessao = await navigator.xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor', 'layers'],
      });
      await renderer.xr.setSession(sessao);
    } catch (e) {
      estado.textContent = `Não abriu a sessão de VR: ${e.message}`;
      btVR.disabled = false;
      sessao?.end().catch(() => {});
      return;
    }
    estado.textContent = 'Óculos encontrado.';
    entrada.hidden = true;
    sessao.addEventListener('visibilitychange', () => {
      if (sessao.visibilityState !== 'visible') return;
      audio?.resume().catch(() => {});
      tocaTodos(canais);
    });
    sessao.addEventListener('end', () => {
      entrada.hidden = false;
      btVR.disabled = false;
      jogador.reinicia();
    });
  });
}
preparaVR();

window.__nautilus = { ...mundo, camadas, camadasPorNome, SALA, get audio() { return audio; }, get relevo() { return relevo; } };
