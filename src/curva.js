// Panorâmica: a antepara da proa é uma chapa enrolada num cilindro vertical em volta do visitante.
// Tudo o que mora nela (vitrine, vigias, aros, relevo) é desenhado no plano z = Z_PROA, como numa chapa ainda reta,
// e depois enrolado: x vira comprimento de arco, então círculo continua círculo e nada estica.
import * as THREE from 'three';
import { SALA } from './config.js';
import { PANORAMICA } from './janelas.js';

const { A, B, YC, Z_PROA } = SALA;
const { R, ZC } = PANORAMICA;

// Parede em cada x do mundo, e a normal dela virada para a sala.
export const zParede = (x) => ZC - Math.sqrt(R * R - x * x);
export const normalParede = (x) => { const s = x / R; return [-s, 0, Math.sqrt(1 - s * s)]; };
// Até onde o casco e o piso precisam ir: um pouco atrás do meio da parede.
export const Z_FUNDO = ZC - R - 0.3;
// x no mundo de um ponto que está a u metros do meio da chapa.
export const xDaChapa = (u) => R * Math.sin(u / R);

// Da chapa para o mundo. z menor que Z_PROA é fundo: anda na direção do raio, para fora do cilindro.
export function dobraPonto(x, y, z, alvo = new THREE.Vector3()) {
  const th = x / R, r = R + (Z_PROA - z);
  return alvo.set(r * Math.sin(th), y, ZC - r * Math.cos(th));
}

export function dobraNormal(x, n, alvo = new THREE.Vector3()) {
  const c = Math.cos(x / R), s = Math.sin(x / R);
  return alvo.set(n.x * c - n.z * s, n.y, n.x * s + n.z * c);
}

// Enrola uma geometria pronta. Com desenhoNoUv, o uv passa a guardar x e y da chapa, para quem precisa medir nela.
export function dobraGeo(g, desenhoNoUv = false) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const c = Math.cos(x / R), s = Math.sin(x / R), r = R + (Z_PROA - z);
    if (desenhoNoUv && uv) uv.setXY(i, x, y);
    if (n) n.setXYZ(i, n.getX(i) * c - n.getZ(i) * s, n.getY(i), n.getX(i) * s + n.getZ(i) * c);
    p.setXYZ(i, r * s, y, ZC - r * c);
  }
  g.boundingSphere = null;
  g.boundingBox = null;
  return g;
}

// Eixos locais da parede num ponto da chapa: X à direita de quem olha para fora, W para fora.
export function eixosDaParede(x, y) {
  const c = Math.cos(x / R), s = Math.sin(x / R);
  return { C: new THREE.Vector3(R * s, y, ZC - R * c), X: new THREE.Vector3(c, 0, s), Y: new THREE.Vector3(0, 1, 0), W: new THREE.Vector3(s, 0, -c) };
}

// A parede em colunas verticais, com furos elípticos { x, y, a, b } medidos na chapa. Ela só curva em x: colunas bastam,
// e a triangulação de uma Shape não serviria, porque não põe vértices no meio da chapa.
export function malhaParede({ furos = [], desvio = 0, tile = 1 } = {}) {
  const uDe = (x) => R * Math.asin(x / R);
  const uMax = uDe(A);
  const xs = [];
  const nBase = Math.ceil((2 * uMax) / 0.24);
  for (let i = 0; i <= nBase; i++) xs.push(-uMax + (2 * uMax * i) / nBase);
  // Mais colunas onde o contorno do casco vira e onde o piso corta o casco.
  const xPiso = A * Math.sqrt(1 - (YC / B) ** 2);
  for (const s of [-1, 1]) {
    xs.push(s * uDe(xPiso));
    for (let k = 0; k <= 10; k++) xs.push(s * uDe(A * Math.cos((k / 10) * 0.7)));
  }
  for (const h of furos) {
    const n = h.a > 1 ? 72 : 20;
    for (let k = 0; k <= n; k++) xs.push(h.x + h.a * Math.cos((k / n) * Math.PI));
  }
  xs.sort((a, b) => a - b);
  const col = xs.filter((x, i) => !i || x - xs[i - 1] > 1e-3);

  const meiaAltura = (x) => B * Math.sqrt(Math.max(1 - (xDaChapa(x) / A) ** 2, 0));
  const meiaFuro = (h, x) => h.b * Math.sqrt(Math.max(1 - ((x - h.x) / h.a) ** 2, 0));

  const pos = [], nor = [], uv = [], idx = [];
  const r = R - desvio;
  const poe = (x, y) => {
    const c = Math.cos(x / R), s = Math.sin(x / R);
    pos.push(r * s, y, ZC - r * c);
    nor.push(-s, 0, c);
    uv.push(x / tile, y / tile);
  };
  for (let i = 0; i < col.length - 1; i++) {
    const x0 = col[i], x1 = col[i + 1], xm = (x0 + x1) / 2;
    const ativos = furos.filter((h) => Math.abs(xm - h.x) < h.a).sort((a, b) => a.y - b.y);
    const niveis = (x) => {
      const m = meiaAltura(x), l = [Math.max(0, YC - m)];
      for (const h of ativos) l.push(h.y - meiaFuro(h, x), h.y + meiaFuro(h, x));
      l.push(YC + m);
      return l;
    };
    const n0 = niveis(x0), n1 = niveis(x1);
    for (let k = 0; k < n0.length; k += 2) {
      const a = pos.length / 3;
      poe(x0, n0[k]); poe(x1, n1[k]); poe(x1, n1[k + 1]); poe(x0, n0[k + 1]);
      idx.push(a, a + 1, a + 2, a, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
