// Moldura Art Nouveau da vitrine: linhas em chicote e vieiras em relevo na antepara da proa, e a placa do lema no gradil.
// Só existe a metade direita (x > 0); a esquerda é o espelho, como na arte.
import * as THREE from 'three';
import { SALA } from '../config.js';
import { VITRINE, VIGIAS_ANTEPARA } from '../janelas.js';
import { criaMaterial } from '../material.js';
import { dobraPonto, dobraNormal, malhaParede } from '../curva.js';

const Z_PAREDE = SALA.Z_PROA;
const RELEVO_MAX = 0.078; // nada sai mais que 8 cm da parede.
const SEC = 0.62;
const LADO_MAPA = 6.4; // o mapa de sombra cobre x de 0 a 6,4 m e y de 0 a 6,4 m.

// Cada linha: pontos [x, y, largura em cm]. A largura é traçada junto com a curva, como a pressão de um pincel.
// 'nivel' decide quem passa por cima num cruzamento. 'metal: 1' sai no latão escurecido.
const LINHAS = [
  // Linha mestra: nasce em ponta junto ao piso e sobe colada no aro até sumir atrás da vigia grande.
  { nome: 'arco', nivel: 2, pts: [[1.56, .075, 0], [2.25, .262, 3.2], [2.9, .487, 7], [3.49, .769, 11], [3.99, 1.11, 14], [4.3, 1.42, 8.5], [4.46, 1.68, 0]] },
  // Reaparece do outro lado da vigia e some do mesmo jeito atrás da vigia pequena.
  { nome: 'crescente', nivel: 2, pts: [[4.88, 2.5, 0], [4.97, 2.8, 3.5], [4.99, 3.05, 6.5], [4.955, 3.46, 10], [4.79, 3.91, 11], [4.61, 4.17, 7.5], [4.47, 4.33, 3.5], [4.385, 4.42, 0]] },
  // O abraço: sai do arco, passa sob a vigia grande, sobe por fora e fecha o ninho da vieira de cima.
  { nome: 'abraco', nivel: 3, pts: [[3.62, .86, 0], [4.08, .985, 3], [4.6, 1.07, 5.5], [5.02, .98, 6.5], [5.45, .89, 7.5], [5.93, 1.12, 8.5], [6.1, 1.75, 5], [6.03, 2.3, 4.5], [5.91, 2.7, 4], [5.775, 3.1, 5], [5.595, 3.41, 7], [5.31, 3.51, 6.5], [5.1, 3.38, 4], [5.03, 3.12, 2.2], [5.035, 2.9, 0]] },
  // Corre pelo chão ondulando e abre o leque de baixo para a esquerda.
  { nome: 'chao', nivel: 1, pts: [[5.9, 1.12, 0], [5.73, .62, 4.5], [5.5, .28, 7.5], [5.08, .105, 6], [4.5, .085, 5.5], [3.9, .14, 10.5], [3.3, .21, 8.5], [2.7, .16, 4], [2.1, .085, 0]] },
  // Pescoço em S à esquerda da vieira de baixo.
  { nome: 'ninho', nivel: 1, pts: [[3.35, .2, 0], [3.8, .27, 4], [4.15, .47, 6.5], [4.24, .76, 5.5], [4.38, 1.0, 3.5], [4.72, 1.1, 0]] },
  // Laços em gota que cruzam a si mesmos, como na lateral da arte.
  { nome: 'lacoBaixo', nivel: 0, pts: [[2.78, .175, 0], [3.1, .3, 2.5], [3.35, .42, 3.8], [3.62, .62, 4.8], [3.82, .8, 5.5], [3.97, .9, 5.2], [4.08, .85, 4.8], [4.07, .71, 4.4], [3.88, .55, 4], [3.6, .43, 3.6], [3.35, .42, 3], [3.18, .46, 2], [2.96, .5, 0]] },
  { nome: 'lacoCima', nivel: 0, pts: [[4.985, 3.3, 0], [5.02, 3.52, 2], [5.09, 3.74, 3.2], [5.14, 3.92, 3.8], [5.12, 4.07, 4.6], [4.98, 4.22, 5.2], [4.82, 4.28, 5], [4.71, 4.21, 4.6], [4.74, 4.06, 4.2], [4.93, 3.95, 3.8], [5.14, 3.89, 3.2], [5.35, 3.77, 2.6], [5.52, 3.57, 1.6], [5.6, 3.4, 0]] },
  // A faixa sobre a vitrine é estreita e fica longe das lâmpadas: um tom acima das outras para não sumir.
  { nome: 'topo', nivel: 1, tom: 1.45, pts: [[3.62, 5.165, 0], [3.2, 5.39, 3], [2.6, 5.665, 7], [1.8, 5.905, 9], [1, 6.04, 6], [.36, 6.09, 0]] },
  // Fios de latão que dobram as linhas, a "linha dupla" da arte.
  { nome: 'fioCanto', metal: 1, tom: 1.9, pts: [[5.1, .05, 0], [5.55, .13, 1.8], [5.8, .42, 2.8], [5.92, .85, 2.2], [5.99, 1.14, 0]] },
  { nome: 'fioVigia', metal: 1, tom: 1.9, pts: [[4.95, 2.56, 0], [5.25, 2.56, 1.8], [5.6, 2.52, 2.4], [5.86, 2.34, 2], [5.98, 2.1, 0]] },
  { nome: 'fioTopo', metal: 1, tom: 2.2, pts: [[3.15, 5.53, 0], [2.6, 5.745, 1.6], [1.8, 5.975, 2], [1, 6.105, 1.6], [.55, 6.15, 0]] },
  { nome: 'fioVigiaPequena', metal: 1, tom: 1.9, pts: [[4.46, 4.42, 0], [4.53, 4.53, 1.8], [4.58, 4.67, 0]] },
];

// Vieiras: dobradiça [x, y], R (comprimento da costela do meio) e giro em graus (0 = leque para cima, 180 = para baixo).
const VIEIRAS = [
  { x: 4.8, y: .92, R: .76, giro: 180 },
  { x: 5.39, y: 2.7, R: .54, giro: 3 },
];

const N_COSTELAS = 9;
const ABERTURA = THREE.MathUtils.degToRad(62);

// Comprimento da vieira em cada direção u (-1 a 1), com os lóbulos na borda.
function bordaVieira(v, u) {
  const envelope = 0.68 + 0.32 * Math.cos(u * Math.PI / 2) ** 0.7;
  const f = (u * 0.5 + 0.5) * N_COSTELAS;
  const fase = f - Math.floor(f) - 0.5;
  return v.R * envelope * (1 - 0.1 * (2 * fase) ** 2);
}

function pontoVieira(v, u, rho) {
  const a = u * ABERTURA, L = bordaVieira(v, u) * rho;
  const g = THREE.MathUtils.degToRad(v.giro), lx = L * Math.sin(a), ly = L * Math.cos(a);
  return [v.x + lx * Math.cos(g) + ly * Math.sin(g), v.y - lx * Math.sin(g) + ly * Math.cos(g)];
}

function contornoVieira(v) {
  const p = [[v.x, v.y]];
  for (let i = 0; i <= 72; i++) p.push(pontoVieira(v, (i / 72) * 2 - 1, 1));
  return p;
}

// Malha crescente: posição, normal, uv, cor e índices, tudo direto em arrays para não criar milhares de objetos.
class Lote {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.cor = []; this.idx = []; }
  get n() { return this.pos.length / 3; }
  v(x, y, z, nx, ny, nz, c, tile = 1.3) {
    this.pos.push(x, y, z); this.nor.push(nx, ny, nz); this.uv.push(x / tile, y / tile); this.cor.push(c, c, c);
  }
  espelhaX() {
    const n = this.n, m = this.idx.length;
    for (let i = 0; i < n; i++) {
      this.pos.push(-this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
      this.nor.push(-this.nor[i * 3], this.nor[i * 3 + 1], this.nor[i * 3 + 2]);
      this.uv.push(-this.uv[i * 2], this.uv[i * 2 + 1]);
      this.cor.push(this.cor[i * 3], this.cor[i * 3 + 1], this.cor[i * 3 + 2]);
    }
    for (let i = 0; i < m; i += 3) this.idx.push(this.idx[i] + n, this.idx[i + 2] + n, this.idx[i + 1] + n);
  }
  geometria() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.cor, 3));
    g.setIndex(this.idx);
    return g;
  }
}

// Amostra densa da curva, a cada centímetro: x, y, largura, tangente e comprimento acumulado.
function amostra(pts, fechado = false, passo = 0.01) {
  const curva = new THREE.CatmullRomCurve3(pts.map(([x, y, w]) => new THREE.Vector3(x, y, w / 100)), fechado, 'centripetal');
  curva.arcLengthDivisions = 400;
  const n = Math.max(8, Math.ceil(curva.getLength() / passo));
  const pp = curva.getSpacedPoints(n);
  const d = [];
  let s = 0;
  for (let i = 0; i <= n; i++) {
    const p = pp[i], a = pp[Math.max(i - 1, 0)], b = pp[Math.min(i + 1, n)];
    const tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1;
    if (i) s += Math.hypot(p.x - a.x, p.y - a.y);
    d.push({ x: p.x, y: p.y, w: Math.max(p.z, 0), tx: tx / l, ty: ty / l, s, g: 0, b: 0 });
  }
  return d;
}

// Fica só com as amostras que importam: mais onde a curva vira ou a largura muda, menos nas retas.
function reduz(d, angulo = 0.13, compMax = 0.2) {
  const f = [d[0]];
  let ult = d[0];
  for (let i = 1; i < d.length - 1; i++) {
    const p = d[i];
    const giro = Math.acos(THREE.MathUtils.clamp(p.tx * ult.tx + p.ty * ult.ty, -1, 1));
    const dw = Math.abs(p.w - ult.w) / Math.max(ult.w, 0.01);
    if (giro > angulo || dw > 0.28 || p.s - ult.s > compMax) { f.push(p); ult = p; }
  }
  f.push(d[d.length - 1]);
  return f;
}

// Marca os cruzamentos: quem está por baixo afunda e escurece, quem está por cima sobe um pouco.
function marcaCruzamentos(lista) {
  const cruza = (A, B) => {
    const achados = [];
    for (let i = 0; i < A.length - 4; i += 4) {
      const p = A[i], q = A[i + 4];
      for (let j = 0; j < B.length - 4; j += 4) {
        const r = B[j], t = B[j + 4];
        const dx = q.x - p.x, dy = q.y - p.y, ex = t.x - r.x, ey = t.y - r.y;
        const den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-9) continue;
        const a = ((r.x - p.x) * ey - (r.y - p.y) * ex) / den, b = ((r.x - p.x) * dy - (r.y - p.y) * dx) / den;
        if (a >= 0 && a < 1 && b >= 0 && b < 1) achados.push([p.s + (q.s - p.s) * a, r.s + (t.s - r.s) * b]);
      }
    }
    return achados;
  };
  const aplica = (d, sc, campo) => { for (const p of d) p[campo] = Math.max(p[campo], Math.exp(-(((p.s - sc) / 0.09) ** 2))); };
  for (let i = 0; i < lista.length; i++) {
    for (let j = i + 1; j < lista.length; j++) {
      const a = lista[i], b = lista[j];
      for (const [sa, sb] of cruza(a.d, b.d)) {
        const aSobre = (a.nivel ?? 0) >= (b.nivel ?? 0);
        aplica(a.d, sa, aSobre ? 'b' : 'g');
        aplica(b.d, sb, aSobre ? 'g' : 'b');
      }
    }
  }
}

// O shader escurece tudo perto do piso, onde fica a maior vieira: devolve parte dessa luz na cor do vértice.
const ganhoPiso = (y) => Math.sqrt(1 / (0.45 + 0.55 * THREE.MathUtils.smoothstep(y, 0, 1.2)));

// Tubo varrido com meia seção elíptica: a parte de trás ficaria dentro da parede, então não existe.
function tubo(lote, d, { z0 = Z_PAREDE - 0.001, ladoSec, kAlt = 1, cor = 1, semente = 0, ang = 0.13, compensaPiso = true } = {}) {
  const wMax = d.reduce((m, p) => Math.max(m, p.w), 0);
  const S = ladoSec ?? (wMax >= 0.07 ? 6 : wMax >= 0.03 ? 4 : 3);
  const r = reduz(d, ang);
  const base = lote.n;
  for (const p of r) {
    const nx = -p.ty, ny = p.tx;
    const h = Math.min((Math.min(p.w * 0.4 + 0.003, 0.05)) * kAlt * (1 + 0.55 * p.b) * (1 - 0.55 * p.g), RELEVO_MAX);
    const w = p.w * 0.5 * (1 - 0.15 * p.g);
    for (let k = 0; k <= S; k++) {
      const f = (k / S) * Math.PI, c = Math.cos(f), s = Math.sin(f);
      // Seção de barra forjada: topo levemente abaulado e canto arredondado, que pega o brilho das lâmpadas em duas linhas.
      const ce = Math.sign(c) * Math.abs(c) ** SEC, se = s ** SEC;
      const lat = w * ce, cima = h * se;
      const kl = h * Math.max(s, 0.02) ** (SEC - 1) * c, kz = w * Math.max(Math.abs(c), 0.02) ** (SEC - 1) * s;
      const l = Math.hypot(kl, kz) || 1;
      const tom = cor * (compensaPiso ? ganhoPiso(p.y) : 1) * (0.42 + 0.58 * s ** 0.7) * (1 - 0.5 * p.g) * (1 + 0.05 * Math.sin(p.s * 2.3 + semente));
      lote.v(p.x + nx * lat, p.y + ny * lat, z0 + cima, nx * kl / l, ny * kl / l, kz / l, tom);
    }
  }
  const L = S + 1;
  for (let j = 0; j < r.length - 1; j++) {
    for (let k = 0; k < S; k++) {
      const a = base + j * L + k, b = a + 1, c = a + L, e = c + 1;
      lote.idx.push(a, b, c, b, e, c);
    }
  }
}

// Vieira: leque de costelas com lóbulos na borda. As costelas são relevo de verdade e os vales são escurecidos, como as linhas finas da arte.
function vieira(lote, v) {
  const cols = N_COSTELAS * 6, aneis = [0.06, 0.26, 0.5, 0.72, 0.9, 0.97, 1];
  const H = v.R * 0.075;
  const base = lote.n;
  const iniIdx = lote.idx.length;
  const posicoes = [];
  for (let i = 0; i <= cols; i++) {
    const u = (i / cols) * 2 - 1;
    const f = (u * 0.5 + 0.5) * N_COSTELAS, fase = f - Math.floor(f) - 0.5;
    const crista = Math.cos(Math.PI * fase) ** 0.7;
    for (const rho of aneis) {
      const [x, y] = pontoVieira(v, u, rho);
      const domo = Math.sqrt(Math.max(1 - rho ** 6, 0));
      const h = H * domo * (0.5 + 0.5 * (1 - Math.abs(u) ** 2.5)) * (0.55 + 0.45 * crista * Math.min(rho * 1.6, 1));
      const tom = ganhoPiso(y) * (0.42 + 0.68 * crista) * (0.72 + 0.32 * rho);
      posicoes.push(x, y, Z_PAREDE - 0.001 + h, tom);
    }
  }
  const A = aneis.length;
  for (let i = 0; i <= cols; i++) for (let j = 0; j < A; j++) {
    const q = (i * A + j) * 4;
    lote.v(posicoes[q], posicoes[q + 1], posicoes[q + 2], 0, 0, 1, posicoes[q + 3]);
  }
  for (let i = 0; i < cols; i++) for (let j = 0; j < A - 1; j++) {
    const a = base + i * A + j, b = a + A, c = a + 1, e = b + 1;
    lote.idx.push(a, b, c, b, e, c);
  }
  // A orelha retangular atrás da dobradiça, como na arte.
  const lc = v.R * 0.3, a0 = v.R * 0.24, g = THREE.MathUtils.degToRad(v.giro);
  const local = (x, y) => [v.x + x * Math.cos(g) + y * Math.sin(g), v.y - x * Math.sin(g) + y * Math.cos(g)];
  const baseO = lote.n, zb = Z_PAREDE - 0.001, zo = Z_PAREDE + v.R * 0.04, rec = 0.012;
  const nnx = Math.sin(g), nny = Math.cos(g);
  [[-lc, 0, -1, -1], [lc, 0, 1, -1], [lc, a0, 1, 1], [-lc, a0, -1, 1]].forEach(([x, y, sx, sy]) => {
    const [xb, yb] = local(x, y), [xt, yt] = local(x - sx * rec, y - sy * rec);
    const l = 0.7;
    const ox = (sx * Math.cos(g) + sy * nnx) * l, oy = (-sx * Math.sin(g) + sy * nny) * l;
    lote.v(xb, yb, zb, ox, oy, 0.5, 0.42);
    lote.v(xt, yt, zo, ox * 0.5, oy * 0.5, 0.86, 0.8);
  });
  for (let i = 0; i < 4; i++) {
    const a = baseO + i * 2, b = a + 1, c = baseO + ((i + 1) % 4) * 2, e = c + 1;
    lote.idx.push(a, c, b, c, e, b);
  }
  lote.idx.push(baseO + 1, baseO + 3, baseO + 5, baseO + 1, baseO + 5, baseO + 7);
  // Normais suaves a partir da superfície.
  const ini = base * 3, nor = lote.nor, pos = lote.pos;
  const acumula = new Float32Array((cols + 1) * A * 3);
  for (let t = iniIdx; t < iniIdx + cols * (A - 1) * 6; t += 3) {
    const [ia, ib, ic] = [lote.idx[t], lote.idx[t + 1], lote.idx[t + 2]];
    const ax = pos[ia * 3], ay = pos[ia * 3 + 1], az = pos[ia * 3 + 2];
    const ux = pos[ib * 3] - ax, uy = pos[ib * 3 + 1] - ay, uz = pos[ib * 3 + 2] - az;
    const wx = pos[ic * 3] - ax, wy = pos[ic * 3 + 1] - ay, wz = pos[ic * 3 + 2] - az;
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    for (const i of [ia, ib, ic]) {
      const o = (i - base) * 3;
      acumula[o] += nx; acumula[o + 1] += ny; acumula[o + 2] += nz;
    }
  }
  for (let i = 0; i < (cols + 1) * A; i++) {
    const o = i * 3, l = Math.hypot(acumula[o], acumula[o + 1], acumula[o + 2]) || 1;
    nor[ini + o] = acumula[o] / l; nor[ini + o + 1] = acumula[o + 1] / l; nor[ini + o + 2] = acumula[o + 2] / l;
  }
}

// Sombra de contato assada num mapa só: sem luz extra no shader, é ela que descola o relevo da parede.
function assaSombra(linhas) {
  const tam = 1024, px = tam / LADO_MAPA;
  const c = document.createElement('canvas');
  c.width = c.height = tam;
  const x = c.getContext('2d');
  x.fillStyle = '#000';
  x.fillRect(0, 0, tam, tam);
  x.setTransform(px, 0, 0, -px, 0, tam);
  x.fillStyle = x.strokeStyle = '#fff';
  x.lineJoin = 'round';

  const pinta = () => {
    for (const { d } of linhas) {
      x.beginPath();
      for (let i = 0; i < d.length; i += 3) { const p = d[i]; x.lineTo(p.x - p.ty * p.w * 0.5, p.y + p.tx * p.w * 0.5); }
      for (let i = d.length - 1; i >= 0; i -= 3) { const p = d[i]; x.lineTo(p.x + p.ty * p.w * 0.5, p.y - p.tx * p.w * 0.5); }
      x.closePath();
      x.fill(); x.stroke();
    }
    for (const v of VIEIRAS) {
      x.beginPath();
      for (const [a, b] of contornoVieira(v)) x.lineTo(a, b);
      x.closePath();
      x.fill(); x.stroke();
    }
  };
  const camada = (borra, dil, dy, alfa) => {
    x.save();
    x.filter = `blur(${borra}px)`;
    x.globalAlpha = alfa;
    x.lineWidth = dil * 2;
    x.translate(0, -dy);
    pinta();
    x.restore();
  };
  camada(13, 0.05, 0.02, 0.5);  // oclusão larga
  camada(4, 0.012, 0.03, 0.75); // sombra projetada para baixo: as lâmpadas estão acima
  camada(1.5, 0.006, 0.004, 0.8); // linha fina de contato

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.format = THREE.RedFormat;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 2;
  return t;
}

// Enrola o relevo na parede curva. Só o que está na chapa: a placa do gradil entra depois, reta.
function dobraLote(lote) {
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < lote.n; i++) {
    const x = lote.pos[i * 3];
    dobraNormal(x, n.set(lote.nor[i * 3], lote.nor[i * 3 + 1], lote.nor[i * 3 + 2]), p);
    lote.nor[i * 3] = p.x; lote.nor[i * 3 + 1] = p.y; lote.nor[i * 3 + 2] = p.z;
    dobraPonto(x, lote.pos[i * 3 + 1], lote.pos[i * 3 + 2], p);
    lote.pos[i * 3] = p.x; lote.pos[i * 3 + 2] = p.z;
  }
}

function criaPlanoSombra(cena, mapa) {
  // Fura também as vigias: sem isso a sombra do relevo que passa atrás do aro escurecia o vidro.
  const g = malhaParede({
    desvio: 0.003,
    furos: [
      { x: 0, y: VITRINE.y, a: VITRINE.a + 0.45, b: VITRINE.b + 0.45 },
      ...VIGIAS_ANTEPARA.map((v) => ({ x: v.x, y: v.y, a: v.r + 0.1, b: v.r + 0.1 })),
    ],
  });
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: { uMapa: { value: mapa }, uK: { value: 0.82 } },
    vertexShader: `varying vec2 vP; void main(){ vP=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D uMapa; uniform float uK; varying vec2 vP;
      void main(){ gl_FragColor=vec4(.012,.01,.009,texture2D(uMapa,vec2(abs(vP.x),vP.y)/${LADO_MAPA.toFixed(1)}).r*uK); }`,
  }));
  m.name = 'moldura:sombra';
  m.renderOrder = -1;
  cena.add(m);
  return m;
}

// Letras traçadas com a mesma linha da moldura, sem depender das fontes do aparelho.
// Traços em [x, y, peso], com altura da maiúscula = 1. Hastes abrem um pouco nas pontas, como no lettering da época.
const GROSSO = 0.17, FINO = 0.085;
const reta = (x0, y0, x1, y1, p) => {
  const lerp = (u) => [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u];
  return [[...lerp(0), p * 1.35], [...lerp(0.1), p * 1.02], [...lerp(0.5), p * 0.92], [...lerp(0.9), p * 1.02], [...lerp(1), p * 1.35]];
};
const LETRAS = {
  M: { l: 1.02, t: [reta(0.05, 0, 0.1, 1, FINO), reta(0.1, 1, 0.5, 0.1, GROSSO), reta(0.5, 0.1, 0.92, 1, FINO), reta(0.92, 1, 0.97, 0, GROSSO)] },
  O: { l: 0.84, fechado: true, t: [[[0.42, 1, FINO], [0.7, 0.86, GROSSO * 0.8], [0.79, 0.5, GROSSO * 1.05], [0.7, 0.14, GROSSO * 0.8], [0.42, 0, FINO], [0.14, 0.14, GROSSO * 0.8], [0.05, 0.5, GROSSO * 1.05], [0.14, 0.86, GROSSO * 0.8]]] },
  B: { l: 0.74, t: [reta(0.08, 0, 0.08, 1, GROSSO), [[0.08, 0.99, FINO], [0.38, 0.99, FINO], [0.56, 0.78, GROSSO * 0.9], [0.38, 0.54, FINO], [0.1, 0.53, FINO * 0.7]], [[0.1, 0.53, FINO * 0.7], [0.42, 0.52, FINO], [0.66, 0.27, GROSSO], [0.42, 0.01, FINO], [0.08, 0.01, FINO]]] },
  I: { l: 0.26, t: [reta(0.13, 0, 0.13, 1, GROSSO)] },
  L: { l: 0.64, t: [reta(0.08, 0, 0.08, 1, GROSSO), [[0.06, 0.015, FINO * 1.3], [0.34, 0.02, FINO], [0.58, 0.05, FINO * 1.1], [0.62, 0.17, FINO * 1.5]]] },
  S: { l: 0.64, t: [[[0.57, 0.84, FINO * 1.2], [0.42, 0.98, FINO], [0.2, 0.97, FINO * 1.2], [0.08, 0.76, GROSSO * 0.85], [0.26, 0.56, GROSSO], [0.46, 0.42, GROSSO], [0.57, 0.23, GROSSO * 0.85], [0.42, 0.03, FINO * 1.2], [0.2, 0.02, FINO], [0.05, 0.16, FINO * 1.2]]] },
  N: { l: 0.88, t: [reta(0.07, 0, 0.07, 1, FINO), reta(0.12, 0.93, 0.75, 0.07, GROSSO), reta(0.8, 0, 0.8, 1, FINO)] },
  ' ': { l: 0.42, t: [] },
};

function escreve(lote, texto, xc, yBase, cap, z0, espaco = 0.13) {
  const largura = [...texto].reduce((s, c) => s + LETRAS[c].l + espaco, -espaco) * cap;
  let x = xc - largura / 2;
  for (const c of texto) {
    const L = LETRAS[c];
    for (const traco of L.t) {
      const d = amostra(traco.map(([a, b, p]) => [x + a * cap, yBase + b * cap, p * cap * 100]), !!L.fechado, 0.004);
      tubo(lote, d, { z0, ladoSec: 3, ang: 0.42, kAlt: 0.9, cor: 2.3, compensaPiso: false });
    }
    x += (L.l + espaco) * cap;
  }
  return largura;
}

// Placa do lema no meio do gradil: Z_PLACA fica entre os dois corrimãos, e o miolo é baixo para não tapar a vitrine.
const Z_PLACA = SALA.Z_GRADIL;
function placa(malva, latao) {
  const f = new THREE.Shape();
  f.moveTo(0, 0.606);
  f.bezierCurveTo(0.1, 0.606, 0.14, 0.628, 0.3, 0.632);
  f.bezierCurveTo(0.55, 0.636, 0.7, 0.63, 0.8, 0.645);
  f.bezierCurveTo(0.88, 0.658, 0.9, 0.695, 0.965, 0.722);
  f.bezierCurveTo(0.9, 0.75, 0.88, 0.785, 0.8, 0.798);
  f.bezierCurveTo(0.65, 0.812, 0.45, 0.806, 0.3, 0.808);
  f.bezierCurveTo(0.23, 0.81, 0.215, 0.85, 0.19, 0.91);
  f.bezierCurveTo(0.165, 0.975, 0.07, 0.99, 0, 1.03);
  f.bezierCurveTo(-0.07, 0.99, -0.165, 0.975, -0.19, 0.91);
  f.bezierCurveTo(-0.215, 0.85, -0.23, 0.81, -0.3, 0.808);
  f.bezierCurveTo(-0.45, 0.806, -0.65, 0.812, -0.8, 0.798);
  f.bezierCurveTo(-0.88, 0.785, -0.9, 0.75, -0.965, 0.722);
  f.bezierCurveTo(-0.9, 0.695, -0.88, 0.658, -0.8, 0.645);
  f.bezierCurveTo(-0.7, 0.63, -0.55, 0.636, -0.3, 0.632);
  f.bezierCurveTo(-0.14, 0.628, -0.1, 0.606, 0, 0.606);
  const borda = f.getPoints(5);
  borda.pop();
  const n = borda.length, zFrente = Z_PLACA + 0.016, zTras = Z_PLACA - 0.012, chanfro = 0.012;
  const miolo = [], normais = [];
  for (let i = 0; i < n; i++) {
    const a = borda[(i + n - 1) % n], b = borda[i], c = borda[(i + 1) % n];
    const ex = c.x - a.x, ey = c.y - a.y, l = Math.hypot(ex, ey) || 1;
    const nx = ey / l, ny = -ex / l; // o contorno corre no sentido anti-horário: esta é a normal para fora.
    normais.push([nx, ny]);
    miolo.push(new THREE.Vector2(b.x - nx * chanfro, b.y - ny * chanfro));
  }
  const tomP = 0.4;
  const base = malva.n;
  for (let i = 0; i < n; i++) {
    const [nx, ny] = normais[i];
    malva.v(borda[i].x, borda[i].y, zTras, nx, ny, 0, tomP * 0.7);
    malva.v(borda[i].x, borda[i].y, zFrente - chanfro * 0.6, nx * 0.7, ny * 0.7, 0.7, tomP * 1.2);
    malva.v(miolo[i].x, miolo[i].y, zFrente, nx * 0.25, ny * 0.25, 0.97, tomP);
    malva.v(miolo[i].x, miolo[i].y, zFrente, 0, 0, 1, tomP);
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, a = base + i * 4, b = base + j * 4;
    malva.idx.push(a, b, a + 1, b, b + 1, a + 1);
    malva.idx.push(a + 1, b + 1, a + 2, b + 1, b + 2, a + 2);
  }
  for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(miolo, [])) malva.idx.push(base + a * 4 + 3, base + b * 4 + 3, base + c * 4 + 3);

  // Fio de latão seguindo o contorno, e o lema em latão sobre o fundo escuro.
  const fio = [];
  for (let i = 0; i < n; i += 3) fio.push([miolo[i].x - normais[i][0] * 0.016, miolo[i].y - normais[i][1] * 0.016, 1.1]);
  tubo(latao, amostra(fio, true, 0.01), { z0: zFrente - 0.001, ladoSec: 3, ang: 0.17, cor: 1.6, compensaPiso: false });
  escreve(latao, 'MOBILIS IN MOBILI', 0, 0.664, 0.112, zFrente - 0.001);
  escreve(latao, 'N', 0, 0.822, 0.135, zFrente - 0.001, 0);

  // Braços em chicote que ligam a placa aos balaústres.
  const bracos = new Lote();
  for (const pts of [
    [[0.2, 0.86, 0], [0.42, 0.875, 1.4], [0.72, 0.93, 2], [0.93, 0.995, 1.6], [1.0, 1.02, 0]],
    [[0.86, 0.72, 0], [0.92, 0.79, 1.3], [0.96, 0.86, 1.5], [1.0, 0.93, 0]],
    [[0.9, 0.7, 0], [0.95, 0.66, 1.2], [1.0, 0.63, 0]],
  ]) tubo(bracos, amostra(pts), { z0: Z_PLACA - 0.004, ladoSec: 4, ang: 0.3, cor: 1.5, compensaPiso: false });
  bracos.espelhaX();
  anexa(latao, bracos);
}

function anexa(destino, origem) {
  const b = destino.n;
  destino.pos.push(...origem.pos); destino.nor.push(...origem.nor); destino.uv.push(...origem.uv); destino.cor.push(...origem.cor);
  for (const i of origem.idx) destino.idx.push(i + b);
}

export function cria(mundo) {
  const { cena, comuns, tex } = mundo;

  const linhas = LINHAS.map((l) => ({ ...l, d: amostra(l.pts) }));
  marcaCruzamentos(linhas);

  const malva = new Lote(), latao = new Lote();
  linhas.forEach((l, i) => tubo(l.metal ? latao : malva, l.d, { semente: i * 1.7, cor: l.tom ?? 1, ...(l.metal ? { z0: Z_PAREDE + 0.003 } : {}) }));
  for (const v of VIEIRAS) vieira(malva, v);
  malva.espelhaX();
  latao.espelhaX();
  dobraLote(malva);
  dobraLote(latao);
  placa(malva, latao);

  // O ferro da sala é oliva e escuro: esta cor compensa para o resultado na tela ficar perto do malva #695252.
  const matMalva = criaMaterial(comuns, { tex: tex.ferro, cor: 0xffffff, rough: 0.68, metal: 0.36, normalK: 0.35, cores: true });
  matMalva.uniforms.uCor.value.setRGB(1.5, 0.86, 1.75);
  const matLatao = criaMaterial(comuns, { tex: tex.ferro, cor: 0xffffff, rough: 0.5, metal: 0.55, normalK: 0.25, cores: true });
  matLatao.uniforms.uCor.value.setRGB(1.1, 0.9, 0.55);

  const adiciona = (lote, mat, nome) => {
    if (!lote.idx.length) return null;
    const m = new THREE.Mesh(lote.geometria(), mat);
    m.name = nome;
    cena.add(m);
    return m;
  };
  const mMalva = adiciona(malva, matMalva, 'moldura:malva');
  const mLatao = adiciona(latao, matLatao, 'moldura:latao');
  const sombra = criaPlanoSombra(cena, assaSombra(linhas));

  return { atualiza() {}, malhas: [mMalva, mLatao, sombra] };
}
