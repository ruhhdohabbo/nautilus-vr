// Medidor: quadros por segundo, carga da cena e estado dos vídeos.
// Na tela aparece com ?debug. No óculos, A ou X liga e desliga: é ele que diz se o desempenho aguenta.
import * as THREE from 'three';
import { param } from './config.js';

export class Hud {
  constructor(renderer, camera, canais) {
    this.renderer = renderer;
    this.canais = canais;
    this.el = document.getElementById('hud');
    this.el.hidden = param('debug') === null;
    this.quadros = 0;
    this.desde = performance.now();
    this.dados = {};
    this.relogios = new Map();

    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 256;
    this.ctx = canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.painel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.15),
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }),
    );
    this.painel.position.set(-0.16, -0.13, -0.6);
    this.painel.renderOrder = 999;
    this.painel.visible = false;
    camera.add(this.painel);
  }

  alterna() {
    this.painel.visible = !this.painel.visible;
  }

  fimDoQuadro() {
    this.quadros++;
    const agora = performance.now();
    if (agora - this.desde < 500) return;
    const fps = (this.quadros * 1000) / (agora - this.desde);
    this.quadros = 0;
    this.desde = agora;
    const { calls, triangles } = this.renderer.info.render;
    // Tocando é quem andou desde a última leitura: paused não acusa um vídeo preso no relógio do áudio.
    const tocando = Object.values(this.canais).filter((c) => {
      const antes = this.relogios.get(c), ct = c.video.currentTime;
      this.relogios.set(c, ct);
      return !c.video.paused && c.video.readyState >= 2 && ct !== antes;
    }).length;
    this.dados = { fps, calls, triangles, tocando, total: Object.keys(this.canais).length };
    const linhas = [
      `${fps.toFixed(0)} fps  ${(1000 / fps).toFixed(1)} ms`,
      `${calls} desenhos  ${(triangles / 1000).toFixed(0)}k triângulos`,
      `${tocando}/${this.dados.total} vídeos tocando`,
    ];
    if (!this.el.hidden) this.el.textContent = linhas.join('\n');
    if (this.painel.visible) {
      const c = this.ctx;
      c.clearRect(0, 0, 512, 256);
      c.fillStyle = 'rgba(13,23,38,.82)';
      c.fillRect(0, 0, 512, 256);
      c.fillStyle = fps < 30 ? '#e8a080' : '#D2DBC0';
      c.font = '44px Menlo, monospace';
      linhas.forEach((l, i) => { c.font = i === 0 ? '52px Menlo, monospace' : '30px Menlo, monospace'; c.fillText(l, 22, 66 + i * 70); });
      this.tex.needsUpdate = true;
    }
  }
}
