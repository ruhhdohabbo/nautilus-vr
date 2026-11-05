// Como o visitante se move. Conforto em VR: andar devagar, girar em saltos, a câmera nunca se mexe sozinha.
import * as THREE from 'three';
import { SALA, PALETA, param } from './config.js';

const VEL = 1.1;
const SALTO = THREE.MathUtils.degToRad(30);
const LIM = { x: 5.3, zMin: SALA.Z_GRADIL + 0.4, zMax: SALA.Z_POPA - 0.5 };
const { smoothstep } = THREE.MathUtils;

export class Jogador {
  constructor(renderer, camera, cena, canvas) {
    this.renderer = renderer;
    this.camera = camera;
    this.rig = new THREE.Group();
    this.rig.add(camera);
    cena.add(this.rig);
    this.rig.position.set(0, 0, 1.4);
    camera.position.set(0, 1.62, 0);
    camera.rotation.order = 'YXZ';
    this.yaw = 0;
    this.pitch = 0.04;
    this.vel = new THREE.Vector3();
    this.teclas = new Set();
    this.podeGirar = true;
    this.botoes = {};
    this.aoAlternarHud = () => {};
    // Caixas que o visitante não atravessa: { x0, x1, z0, z1 } em metros, em coordenadas do mundo.
    this.obstaculos = [];
    // O que um efeito (o tremor da cabeçada) está somando ao rig agora.
    this.desvio = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._lado = new THREE.Vector3();
    this._cabeca = new THREE.Vector3();

    // Quem anda no espaço real leva a cabeça para fora da sala: a visão escurece antes de sair do casco.
    this.escuro = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 12, 8),
      new THREE.MeshBasicMaterial({ color: PALETA.abismo, side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false }),
    );
    this.escuro.renderOrder = 998;
    this.escuro.frustumCulled = false;
    this.escuro.visible = false;
    camera.add(this.escuro);
    renderer.compile(this.escuro, camera, cena);

    // ?cam=x,y,z,yaw,pitch posiciona a câmera (para comparar pontos de vista).
    const c = param('cam');
    if (c) {
      const [x, y, z, yaw = 0, pitch = 0] = c.split(',').map(Number);
      if ([x, y, z, yaw, pitch].every(Number.isFinite)) {
        this.rig.position.set(x, 0, z);
        camera.position.y = y;
        this.yaw = THREE.MathUtils.degToRad(yaw);
        this.pitch = THREE.MathUtils.degToRad(pitch);
      } else console.warn(`?cam inválido: ${c}`);
    }
    this.inicio = { pos: this.rig.position.clone(), y: camera.position.y, yaw: this.yaw, pitch: this.pitch };
    this.aplicaOlhar();

    addEventListener('keydown', (e) => this.teclas.add(e.code));
    addEventListener('keyup', (e) => this.teclas.delete(e.code));
    let arrasto = null;
    canvas.addEventListener('pointerdown', (e) => { arrasto = [e.clientX, e.clientY]; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointerup', () => { arrasto = null; });
    canvas.addEventListener('pointermove', (e) => {
      if (!arrasto) return;
      this.yaw -= (e.clientX - arrasto[0]) * 0.003;
      this.pitch = THREE.MathUtils.clamp(this.pitch - (e.clientY - arrasto[1]) * 0.003, -1.4, 1.4);
      arrasto = [e.clientX, e.clientY];
      this.aplicaOlhar();
    });
  }

  aplicaOlhar() {
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  // Volta ao ponto inicial: o próximo visitante começa de frente para a vitrine, não onde o outro parou.
  reinicia() {
    const { pos, y, yaw, pitch } = this.inicio;
    this.rig.position.copy(pos).add(this.desvio);
    this.rig.rotation.y = 0;
    this.camera.position.set(0, y, 0);
    this.vel.set(0, 0, 0);
    this.podeGirar = true;
    this.botoes = {};
    this.yaw = yaw;
    this.pitch = pitch;
    this.aplicaOlhar();
  }

  atualiza(dt) {
    const xr = this.renderer.xr;
    let frente = 0, lado = 0;

    if (xr.isPresenting) {
      for (const fonte of xr.getSession().inputSources) {
        const gp = fonte.gamepad;
        if (!gp) continue;
        const ax = gp.axes.length >= 4 ? gp.axes[2] : gp.axes[0] ?? 0;
        const ay = gp.axes.length >= 4 ? gp.axes[3] : gp.axes[1] ?? 0;
        if (fonte.handedness === 'left') {
          lado = Math.abs(ax) > 0.15 ? ax : 0;
          frente = Math.abs(ay) > 0.15 ? -ay : 0;
        } else if (fonte.handedness === 'right') {
          if (this.podeGirar && Math.abs(ax) > 0.6) {
            this.gira(-Math.sign(ax) * SALTO);
            this.podeGirar = false;
          } else if (Math.abs(ax) < 0.3) this.podeGirar = true;
        }
        const botao = gp.buttons[4]?.pressed ?? false;
        if (botao && !this.botoes[fonte.handedness]) this.aoAlternarHud();
        this.botoes[fonte.handedness] = botao;
      }
    } else {
      const t = this.teclas;
      frente = (t.has('KeyW') || t.has('ArrowUp') ? 1 : 0) - (t.has('KeyS') || t.has('ArrowDown') ? 1 : 0);
      lado = (t.has('KeyD') || t.has('ArrowRight') ? 1 : 0) - (t.has('KeyA') || t.has('ArrowLeft') ? 1 : 0);
    }

    const dir = this.camera.getWorldDirection(this._dir);
    dir.y = 0;
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
    dir.normalize();
    const dirLado = this._lado.set(-dir.z, 0, dir.x);
    const alvo = dir.multiplyScalar(frente).addScaledVector(dirLado, lado);
    if (alvo.lengthSq() > 1) alvo.normalize();
    alvo.multiplyScalar(VEL);
    this.vel.lerp(alvo, 1 - Math.exp(-dt * 6));

    // Movimento só até o limite da sala, medido na cabeça do visitante. No óculos a cabeça também anda com o corpo:
    // quem já passou de um limite ou entrou na folga de um obstáculo pode sair, só não vai mais para dentro.
    const cabeca = this.camera.getWorldPosition(this._cabeca);
    const dx = this.vel.x * dt, dz = this.vel.z * dt;
    const agora = this.invasao(cabeca.x, cabeca.z);
    if (this.invasao(cabeca.x + dx, cabeca.z) <= agora) this.rig.position.x += dx; else this.vel.x = 0;
    if (this.invasao(cabeca.x, cabeca.z + dz) <= agora) this.rig.position.z += dz; else this.vel.z = 0;

    // Só escurece. Empurrar o rig de volta daria enjoo.
    const k = xr.isPresenting ? this.escuroFora(cabeca.x, cabeca.z) : 0;
    this.escuro.visible = k > 0;
    this.escuro.material.opacity = k;
  }

  // De 0 a 1 entre o limite da sala e a parede. As folgas seguem o que há em cada lado: casco, antepara da popa, gradil.
  escuroFora(x, z) {
    return Math.max(smoothstep(Math.abs(x), LIM.x + 0.25, LIM.x + 0.65), smoothstep(z, LIM.zMax + 0.1, LIM.zMax + 0.45), smoothstep(-z, -LIM.zMin + 0.25, -LIM.zMin + 0.6));
  }

  // Quanto a cabeça passou dos limites da sala ou entrou na folga de um obstáculo (m). Zero é livre.
  invasao(x, z) {
    const folga = 0.28;
    let d = Math.max(Math.abs(x) - LIM.x, LIM.zMin - z, z - LIM.zMax, 0);
    for (const o of this.obstaculos) d = Math.max(d, Math.min(x - o.x0, o.x1 - x, z - o.z0, o.z1 - z) + folga);
    return d;
  }

  // Giro em torno da cabeça, não do centro da sala real do visitante.
  gira(ang) {
    const antes = this.camera.getWorldPosition(new THREE.Vector3());
    this.rig.rotation.y += ang;
    this.rig.updateMatrixWorld(true);
    const depois = this.camera.getWorldPosition(new THREE.Vector3());
    this.rig.position.add(antes.sub(depois));
  }
}
