// Conchas, corais e a tridacna: formas paramétricas pintadas por vértice.
import * as THREE from 'three';
import { PALETA } from '../config.js';
import { coneEntre, grade, pinta } from './salao_comum.js';

const cor = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);
const mistura = (s, a, b, f, k = 1) => {
  s.r = (a.r + (b.r - a.r) * f) * k;
  s.g = (a.g + (b.g - a.g) * f) * k;
  s.b = (a.b + (b.b - a.b) * f) * k;
};
const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Uma valva da tridacna, com a dobradiça no eixo X, a margem para +Z. As dobras das duas valvas se encaixam.
// Cada valva é uma folha só: de fora, do umbo à margem, e de dentro, de volta ao umbo.
export function valvaTridacna(superior, { largura = 1.12, comp = 0.58, fundo = 0.19, dobras = 5, esp = 0.028, nu = 13, nv = 36 } = {}) {
  const b = superior ? 1 : -1;
  const linhas = 2 * nu + 1;
  const fora = cor(PALETA.caqui, 0.5), ferrugem = cor(PALETA.ferrugem, 0.7), nacar = cor(PALETA.nevoa, 1.02), lilas = cor(PALETA.lilas, 0.98);
  const manto = superior ? cor(PALETA.malva, 1.0) : cor(PALETA.terracota, 0.85);
  return grade(linhas, nv, (i, j, s) => {
    const deFora = i <= nu;
    const u = deFora ? i / nu : (linhas - i) / nu;
    const v = (2 * j) / nv - 1;
    const sv = Math.sin((v * Math.PI) / 2), cv = Math.cos((v * Math.PI) / 2);
    const k0 = Math.cos(Math.PI * dobras * v);
    const k = Math.sign(k0) * Math.abs(k0) ** 0.72;
    const mz = comp * cv ** 0.55 * (1 + 0.03 * k);
    let y = b * fundo * Math.sin(Math.PI * u ** 0.8) * (1 - 0.55 * v * v);
    y += 0.05 * u ** 1.4 * k * (0.35 + 0.65 * cv);
    if (!deFora) y -= b * esp * (1 - 0.35 * u);
    s.x = (largura / 2) * sv * u;
    s.y = y;
    s.z = mz * u;
    s.u = s.x / 0.35; s.v = s.z / 0.35;
    const dobra = 0.7 + 0.3 * (k * 0.5 + 0.5);
    if (deFora) {
      // Frequência baixa o bastante para a grade: anel fino demais vira ruído e a casca parece pano.
      const anel = 0.86 + 0.14 * Math.cos(u * 16 + k * 1.6);
      const dobraFora = 0.55 + 0.45 * (k * 0.5 + 0.5);
      mistura(s, fora, ferrugem, suave(0.3, 0.9, u) * 0.55, dobraFora * anel);
    } else {
      mistura(s, nacar, lilas, suave(0.72, 0.95, u) * 0.6 + 0.2, 1);
      const r = s.r, g = s.g, bb = s.b;
      const m = suave(0.74, 0.3, u) * 0.8;
      s.r = (r + (manto.r - r) * m) * dobra;
      s.g = (g + (manto.g - g) * m) * dobra;
      s.b = (bb + (manto.b - bb) * m) * dobra;
    }
  }, superior);
}

// Nautilus em pé no plano XY, abertura para a direita. A espiral cresce no fator certo da concha real.
export function nautiloide(raio) {
  const nu = 30, nv = 8, voltas = 2.3, cresce = Math.log(3) / (2 * Math.PI);
  const base = cor(PALETA.nevoa, 0.9), listra = cor(PALETA.ferrugem, 0.95), fundo = cor(PALETA.ferrugem, 0.28);
  return grade(nu + 2, nv, (i, j, s) => {
    const k = Math.min(i, nu) / nu;
    const th = -voltas * 2 * Math.PI * (1 - k);
    const rho = raio * 0.6 * Math.exp(cresce * th);
    let a = rho * 0.66;
    const phi = (j / nv) * Math.PI * 2;
    const e = [Math.cos(th), Math.sin(th)], t = [-Math.sin(th), Math.cos(th)];
    let cx = rho * e[0], cy = rho * e[1];
    if (i > nu) {
      a *= i === nu + 1 ? 0.84 : 0.02;
      cx -= t[0] * rho * -0.18; cy -= t[1] * rho * -0.18;
    }
    s.x = cx + a * Math.cos(phi) * e[0];
    s.y = cy + a * Math.cos(phi) * e[1];
    s.z = a * 0.82 * Math.sin(phi);
    s.u = k * 3; s.v = phi;
    if (i > nu) { s.r = fundo.r; s.g = fundo.g; s.b = fundo.b; return; }
    const faixa = Math.sin(th * 7 + Math.cos(phi) * 1.6);
    const manchas = suave(0.1, 0.5, faixa) * suave(-0.2, 0.7, Math.cos(phi)) * suave(1.0, 0.72, k);
    mistura(s, base, listra, manchas, 0.92);
  }, true);
}

// Torre em espiral (turritela): cone com a saliência correndo em hélice.
export function turritela(h, r0) {
  const nu = 22, nv = 8, voltas = 7;
  const claro = cor(PALETA.caqui, 0.95), escuro = cor(PALETA.ferrugem, 0.85);
  return grade(nu + 1, nv, (i, j, s) => {
    const f = Math.min(i, nu) / nu;
    const th = (j / nv) * Math.PI * 2;
    const hel = Math.cos(2 * Math.PI * voltas * f - th);
    const R = i > nu ? 0 : r0 * (1 - f) ** 0.9 * (1 + 0.15 * hel) + 0.0005;
    s.x = R * Math.sin(th); s.y = h * f; s.z = R * Math.cos(th);
    s.u = th; s.v = f * 3;
    mistura(s, escuro, claro, hel * 0.5 + 0.5, 0.95);
  });
}

// Cauri: ovoide liso e manchado.
export function cauri(c, l, a) {
  const g = new THREE.SphereGeometry(1, 12, 8);
  const p = g.attributes.position;
  const dorso = cor(PALETA.ferrugem, 1.05), ventre = cor(PALETA.caqui, 1);
  const cores = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const m = suave(-0.2, 0.75, p.getY(i));
    cores[i * 3] = ventre.r + (dorso.r - ventre.r) * m;
    cores[i * 3 + 1] = ventre.g + (dorso.g - ventre.g) * m;
    cores[i * 3 + 2] = ventre.b + (dorso.b - ventre.b) * m;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cores, 3));
  g.scale(l, a, c);
  return g;
}

// Coral ramificado, quase plano para a silhueta se ler de frente, como peça de museu.
export function coral(r, base, altura, grossura, tom, lista, nivelMax = 5, abertura = 0.62) {
  const dir = new THREE.Vector3();
  const ramo = (p, d, comp, raio, nivel) => {
    const fim = p.clone().addScaledVector(d, comp);
    const luz = 0.8 + 0.08 * nivel + r() * 0.1;
    lista.push(pinta(coneEntre(p, fim, raio, raio * 0.8, 5, 0.3), tom, luz));
    if (nivel >= nivelMax) return;
    const n = nivel < 2 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const lado = (i - (n - 1) / 2) * 2 + r.entre(-0.3, 0.3);
      dir.copy(d);
      dir.x += lado * abertura * r.entre(0.6, 1.1);
      dir.z += r.entre(-0.24, 0.24);
      dir.y += 0.28;
      ramo(fim, dir.normalize().clone(), comp * r.entre(0.68, 0.84), raio * 0.78, nivel + 1);
    }
  };
  ramo(base, new THREE.Vector3(0, 1, 0), altura * 0.3, grossura, 0);
}

// Coral-cérebro: uma calota com sulcos pintados e levemente escavados.
export function coralCerebro(raio) {
  const nu = 9, nv = 18;
  const claro = cor(PALETA.caqui, 1), escuro = cor(PALETA.ferrugem, 0.55);
  return grade(nu, nv, (i, j, s) => {
    const lat = (i / nu) * Math.PI * 0.52, lon = (j / nv) * Math.PI * 2;
    const sulco = Math.sin(lat * 13 + 2.4 * Math.sin(lon * 5)) * Math.sin(lon * 7 + 1.8 * Math.cos(lat * 9));
    const R = raio * (1 + 0.035 * sulco);
    s.x = R * Math.sin(lat) * Math.cos(lon);
    s.y = R * Math.cos(lat) * 0.82;
    s.z = R * Math.sin(lat) * Math.sin(lon);
    s.u = lon; s.v = lat;
    mistura(s, escuro, claro, suave(-0.5, 0.5, sulco), 1);
  });
}
