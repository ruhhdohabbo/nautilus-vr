// Ajudantes das peças do salão: caixas com faces escolhidas, grades paramétricas, conchas e a junção em malhas.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { uvMundo, sorteador } from '../geo.js';

export { sorteador };

// Caixa só com as faces que aparecem: c(ima), b(aixo), e(squerda -x), d(ireita +x), f(rente -z), t(rás +z).
export function caixa(x0, x1, y0, y1, z0, z1, faces = 'cbedft', tile = 3) {
  const pos = [], nor = [], idx = [];
  const q = (n, ...v) => {
    const i = pos.length / 3;
    for (const p of v) { pos.push(...p); nor.push(...n); }
    idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  };
  if (faces.includes('c')) q([0, 1, 0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]);
  if (faces.includes('b')) q([0, -1, 0], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
  if (faces.includes('f')) q([0, 0, -1], [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
  if (faces.includes('t')) q([0, 0, 1], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
  if (faces.includes('e')) q([-1, 0, 0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
  if (faces.includes('d')) q([1, 0, 0], [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.setIndex(idx);
  return uvMundo(g, tile);
}

// Grade paramétrica: f(i, j, s) preenche s.x, s.y, s.z e, se quiser, s.r, s.g, s.b, s.u, s.v.
export function grade(linhas, colunas, f, inverte = false) {
  const pos = [], cor = [], uv = [], idx = [];
  const s = { x: 0, y: 0, z: 0, r: 1, g: 1, b: 1, u: 0, v: 0 };
  for (let i = 0; i <= linhas; i++) {
    for (let j = 0; j <= colunas; j++) {
      s.r = s.g = s.b = 1;
      f(i, j, s);
      pos.push(s.x, s.y, s.z);
      cor.push(s.r, s.g, s.b);
      uv.push(s.u, s.v);
    }
  }
  const L = colunas + 1;
  for (let i = 0; i < linhas; i++) {
    for (let j = 0; j < colunas; j++) {
      const a = i * L + j, b = a + 1, c = a + L + 1, d = a + L;
      if (inverte) idx.push(a, c, b, a, d, c);
      else idx.push(a, b, c, a, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function pinta(g, cor = 0xffffff, k = 1) {
  const c = cor.isColor ? cor : new THREE.Color(cor);
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r * k, c.g * k, c.b * k], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

// Tronco de cone entre dois pontos.
const _cima = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _s = new THREE.Vector3(1, 1, 1);
export function coneEntre(a, b, r0, r1, lados = 6, tile = 0.5) {
  const comp = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r1, r0, comp, lados, 1, true);
  _q.setFromUnitVectors(_cima, b.clone().sub(a).normalize());
  _m.compose(a.clone().add(b).multiplyScalar(0.5), _q, _s);
  return uvMundo(g.applyMatrix4(_m), tile);
}

// Vieira, o motivo das molduras da arte: leque com a dobradiça na origem, abrindo para +Y e bojuda para -Z.
export function vieira({ raio = 1, costelas = 9, nu = 6, nv = 36, bojo = 0.2, ampl = 0.035, abre = 1.3, tom = new THREE.Color(0xffffff), vale = 0.5, orelhas = true, luzOrelha = 0.55 }) {
  const g = grade(nu, nv, (i, j, s) => {
    const u = 0.04 + (0.96 * i) / nu, v = (2 * j) / nv - 1, phi = v * abre;
    const k = Math.cos(Math.PI * costelas * v);
    const R = raio * (0.93 + 0.07 * Math.cos(phi * 1.1)) * (1 + 0.016 * k * u * u);
    s.x = Math.sin(phi) * R * u;
    s.y = Math.cos(phi) * R * u;
    s.z = -raio * (bojo * Math.sin(Math.PI * (0.1 + 0.8 * u)) + ampl * u * (k * 0.5 + 0.5));
    const luz = vale + (1 - vale) * (k * 0.5 + 0.5) * Math.min(1, u * 3) + (1 - Math.min(1, u * 3)) * (1 - vale) * 0.5;
    const anel = 0.94 + 0.06 * Math.cos(u * 34);
    s.r = tom.r * luz * anel; s.g = tom.g * luz * anel; s.b = tom.b * luz * anel;
    s.u = s.x / 0.5; s.v = s.y / 0.5;
  }, true);
  if (!orelhas) return g;
  const w = raio * 0.2, h = raio * 0.1;
  const orelha = caixa(-w, w, -h * 0.3, h, -raio * 0.05, -raio * 0.015, 'cfed', 0.5);
  pinta(orelha, tom, luzOrelha);
  return mergeGeometries([paraIndexado(g), orelha]);
}

function paraIndexado(g) {
  if (g.index) return g;
  const n = g.attributes.position.count;
  g.setIndex(Array.from({ length: n }, (_, i) => i));
  return g;
}

// Normais de face, para peças facetadas.
export function facetado(g, tile = 3) {
  const f = g.toNonIndexed();
  f.computeVertexNormals();
  return uvMundo(f, tile);
}

// Junta a lista numa malha só: um desenho a menos para cada material.
const ATRIBUTOS = ['position', 'normal', 'uv', 'color'];
export function malha(lista, material, nome) {
  for (const g of lista) {
    paraIndexado(g);
    if (!g.attributes.color) pinta(g);
    for (const a of Object.keys(g.attributes)) if (!ATRIBUTOS.includes(a)) g.deleteAttribute(a);
  }
  const m = new THREE.Mesh(mergeGeometries(lista), material);
  m.name = nome;
  return m;
}

// Texturas neutras para as peças pintadas por vértice: manchas suaves de pintura aerografada, com repetição perfeita.
export function texturaNeutra(semente = 5, tam = 128) {
  const r = sorteador(semente);
  const ondas = Array.from({ length: 14 }, () => ({
    kx: Math.floor(r.entre(-5, 6)), ky: Math.floor(r.entre(-5, 6)), f: r() * Math.PI * 2, a: r.entre(0.3, 1),
  }));
  const soma = ondas.reduce((t, o) => t + o.a, 0);
  const dados = new Uint8Array(tam * tam * 4);
  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      let v = 0;
      for (const o of ondas) v += o.a * Math.cos((2 * Math.PI * (o.kx * x + o.ky * y)) / tam + o.f);
      const c = 222 + (v / soma) * 62 + r.entre(-5, 5);
      const i = (y * tam + x) * 4;
      dados[i] = dados[i + 1] = dados[i + 2] = Math.max(0, Math.min(255, c));
      dados[i + 3] = 255;
    }
  }
  const a = new THREE.DataTexture(dados, tam, tam, THREE.RGBAFormat);
  a.wrapS = a.wrapT = THREE.RepeatWrapping;
  a.minFilter = THREE.LinearMipmapLinearFilter;
  a.magFilter = THREE.LinearFilter;
  a.generateMipmaps = true;
  a.needsUpdate = true;
  return { a, b: texturaPlana() };
}

export function texturaPlana() {
  const b = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1, THREE.RGBAFormat);
  b.needsUpdate = true;
  return b;
}
