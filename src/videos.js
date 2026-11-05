// Canais de vídeo: um <video> e uma textura por canal, mais a faixa de luz pré-calculada.
import * as THREE from 'three';
import { CANAIS } from './janelas.js';

const srgb2lin = (x) => Math.pow(x, 2.2);
const paraLinear = (origem, destino, k) => destino.set(srgb2lin(origem.x) * k, srgb2lin(origem.y) * k, srgb2lin(origem.z) * k);

class Canal {
  constructor(id, def) {
    this.id = id;
    this.som = !!def.som;
    const v = document.createElement('video');
    v.src = def.src;
    v.loop = true;
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    this.video = v;

    this.tex = new THREE.VideoTexture(v);
    this.tex.generateMipmaps = false;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.magFilter = THREE.LinearFilter;

    // Cor da imagem agora, em valores de tela (0 a 1). Também vira a cor das bordas da janela.
    this.corE = new THREE.Vector3(0.03, 0.09, 0.1);
    this.corC = new THREE.Vector3(0.03, 0.09, 0.1);
    this.corD = new THREE.Vector3(0.03, 0.09, 0.1);
    this.faixa = null;
    this.fpsVideo = 24;
    this._ver = this.tex.version;
    this._ultimo = 0;
    this._semRvfc = false;
    this._quadro = -1;
    fetch(def.luz).then((r) => r.json()).then((j) => {
      this.faixa = j;
      this.fpsVideo = j.videoFps || 24;
    }).catch((e) => console.warn(`Faixa de luz de ${id}:`, e));
  }

  toca() {
    return this.video.play().catch((e) => console.warn(`Vídeo ${this.id} não tocou:`, e.message));
  }

  atualiza(agora, dt) {
    // A VideoTexture atualiza por requestVideoFrameCallback. Se ele parar de disparar durante a sessão de VR,
    // o quadro passa a ser enviado daqui, um por quadro novo do vídeo. Se voltar, a versão muda sozinha e a marca sai.
    // O limite é de 2,5 quadros do vídeo, para um render a 30 fps com rVFC vivo não acionar isto à toa.
    const v = this.video;
    const quadro = Math.floor(v.currentTime * this.fpsVideo);
    if (this.tex.version !== this._ver) {
      this._ver = this.tex.version;
      this._ultimo = agora;
      this._semRvfc = false;
      this._quadro = quadro;
    } else if (v.readyState >= 2 && !v.paused) {
      if (agora - this._ultimo > 2500 / this.fpsVideo) this._semRvfc = true;
      if (this._semRvfc && quadro !== this._quadro) {
        this._quadro = quadro;
        this.tex.needsUpdate = true;
        this._ver = this.tex.version;
        this._ultimo = agora;
      }
    }

    if (!this.faixa) return;
    const { cores, fps } = this.faixa;
    const n = cores.length / 9;
    const f = (v.currentTime * fps) % n;
    const i0 = Math.floor(f), i1 = (i0 + 1) % n, s = f - i0;
    const suave = 1 - Math.exp(-dt / 0.2);
    this._le(0, this.corE, i0, i1, s, suave);
    this._le(1, this.corC, i0, i1, s, suave);
    this._le(2, this.corD, i0, i1, s, suave);
  }

  _le(bloco, destino, i0, i1, s, suave) {
    const { cores } = this.faixa;
    for (let c = 0; c < 3; c++) {
      const a = cores[i0 * 9 + bloco * 3 + c], b = cores[i1 * 9 + bloco * 3 + c];
      const alvo = (a + (b - a) * s) / 255;
      destino.setComponent(c, destino.getComponent(c) + (alvo - destino.getComponent(c)) * suave);
    }
  }
}

export function criaCanais() {
  const canais = {};
  for (const [id, def] of Object.entries(CANAIS)) canais[id] = new Canal(id, def);
  return canais;
}

export const tocaTodos = (canais) => Promise.all(Object.values(canais).map((c) => c.toca()));

// A vitrine e as vigias iluminam a sala com a cor que estão mostrando.
export function luzDosCanais(canais, comuns, vitrine, vigiasPorLado) {
  const central = canais[vitrine];
  paraLinear(central.corE, comuns.uLuzE.value, 1);
  paraLinear(central.corC, comuns.uLuzC.value, 1);
  paraLinear(central.corD, comuns.uLuzD.value, 1);
  for (let i = 0; i < vigiasPorLado.length; i++) {
    const lista = vigiasPorLado[i];
    const alvo = comuns.uVigCor.value[i].set(0, 0, 0);
    for (let k = 0; k < lista.length; k++) alvo.add(canais[lista[k]].corC);
    alvo.multiplyScalar(1 / lista.length);
    paraLinear(alvo, alvo, 1);
  }
}

// Som da vitrine vindo da direção da vitrine.
export function ligaSom(canal, posicao, ctx) {
  const fonte = ctx.createMediaElementSource(canal.video);
  const panner = new PannerNode(ctx, {
    panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 6, rolloffFactor: 0.6,
    positionX: posicao.x, positionY: posicao.y, positionZ: posicao.z,
  });
  fonte.connect(panner).connect(ctx.destination);
  canal.video.muted = false;
  // Se o navegador recusar vídeo com som, volta ao mudo em vez de parar a imagem.
  canal.video.play().catch(() => { canal.video.muted = true; canal.video.play().catch(() => {}); });
  ctx.resume();
  const f = new THREE.Vector3(), c = new THREE.Vector3();
  return {
    panner,
    ouvinte(camera) {
      const l = ctx.listener;
      camera.getWorldPosition(c);
      camera.getWorldDirection(f);
      if (l.positionX) {
        l.positionX.value = c.x; l.positionY.value = c.y; l.positionZ.value = c.z;
        l.forwardX.value = f.x; l.forwardY.value = f.y; l.forwardZ.value = f.z;
        l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
      } else {
        l.setPosition(c.x, c.y, c.z);
        l.setOrientation(f.x, f.y, f.z, 0, 1, 0);
      }
    },
  };
}
