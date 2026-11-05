// A coleção de Nemo: vitrines de latão e vidro dos dois lados do tapete. A peça de destaque é a tridacna com a pérola.
import * as THREE from 'three';
import { PALETA } from '../config.js';
import { uvMundo, cilindroEntre } from '../geo.js';
import { caixa, coneEntre, facetado, pinta, sorteador, vieira } from './salao_comum.js';
import { valvaTridacna, nautiloide, turritela, cauri, coral, coralCerebro } from './salao_conchas.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const cor = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);
const veludo = () => cor(PALETA.marinho).lerp(cor(PALETA.malva), 0.35).multiplyScalar(0.42);

// Um pano de vidro virado para fora, conforme o centro da vitrine.
function pano(L, pontos, centro) {
  const [a, b, c] = pontos;
  const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
  const lista = n.dot(a.clone().sub(centro)) < 0 ? [...pontos].reverse() : pontos;
  if (lista !== pontos) n.negate();
  const pos = lista.flatMap((p) => [p.x, p.y, p.z]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(lista.flatMap(() => [n.x, n.y, n.z]), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(lista.length * 2), 2));
  g.setIndex(lista.length === 4 ? [0, 1, 2, 0, 2, 3] : [0, 1, 2]);
  L.vidro.push(g);
}
const haste = (L, a, b, r = 0.012) => L.latao.push(cilindroEntre(a, b, r, 6));

// Pérola lisa: UV parado, para a mancha da textura não riscar facetas na esfera.
function perola(L, x, y, z, raio, tom) {
  const g = new THREE.IcosahedronGeometry(raio, 2);
  g.attributes.uv.array.fill(0);
  g.translate(x, y, z);
  L.nacar.push(pinta(g, tom));
}

function pousa(L, g, x, y, z, ang = 0) {
  g.rotateY(ang);
  g.translate(x, y, z);
  L.pecas.push(g);
}

// Vitrine de mesa: tampo de duas águas sobre um tabuleiro com pernas finas.
function vitrineDeMesa(L, cx, cz, enche) {
  const w = 0.4, d = 0.85, yT = 0.72, yFundo = 0.84, yP = 0.99, yC = 1.15;
  const x0 = cx - w, x1 = cx + w, z0 = cz - d, z1 = cz + d;
  L.madeira.push(caixa(x0, x1, yT, yFundo, z0, z1, 'bedft', 4));
  L.latao.push(caixa(x0 - 0.004, x1 + 0.004, yFundo - 0.016, yFundo, z0 - 0.004, z1 + 0.004, 'edft', 0.6));
  for (const [x, z] of [[x0 + 0.05, z0 + 0.05], [x1 - 0.05, z0 + 0.05], [x0 + 0.05, z1 - 0.05], [x1 - 0.05, z1 - 0.05]]) {
    L.madeira.push(coneEntre(v3(x, yT, z), v3(x, 0.05, z), 0.034, 0.018, 8, 4));
    L.latao.push(coneEntre(v3(x, 0.05, z), v3(x, 0, z), 0.018, 0.015, 8, 0.6));
  }
  // Travessão em H: cada ponta encosta numa perna.
  L.madeira.push(caixa(x0 + 0.05, x1 - 0.05, 0.26, 0.285, z0 + 0.035, z0 + 0.065, 'cbft', 4));
  L.madeira.push(caixa(x0 + 0.05, x1 - 0.05, 0.26, 0.285, z1 - 0.065, z1 - 0.035, 'cbft', 4));
  L.madeira.push(caixa(cx - 0.015, cx + 0.015, 0.26, 0.285, z0 + 0.065, z1 - 0.065, 'cbed', 4));
  L.pecas.push(pinta(caixa(x0 + 0.01, x1 - 0.01, yFundo - 0.005, yFundo, z0 + 0.01, z1 - 0.01, 'c', 0.5), veludo()));

  const c = v3(cx, 0.95, cz);
  const a0 = v3(x0, yFundo, z0), a1 = v3(x1, yFundo, z0), a2 = v3(x1, yFundo, z1), a3 = v3(x0, yFundo, z1);
  const b0 = v3(x0, yP, z0), b1 = v3(x1, yP, z0), b2 = v3(x1, yP, z1), b3 = v3(x0, yP, z1);
  const r0 = v3(cx, yC, z0), r1 = v3(cx, yC, z1);
  pano(L, [a0, a1, b1, b0], c); pano(L, [a1, a2, b2, b1], c); pano(L, [a2, a3, b3, b2], c); pano(L, [a3, a0, b0, b3], c);
  pano(L, [b0, b1, r0], c); pano(L, [b2, b3, r1], c);
  pano(L, [b1, b2, r1, r0], c); pano(L, [b3, b0, r0, r1], c);
  for (const [a, b] of [[a0, b0], [a1, b1], [a2, b2], [a3, b3], [b0, b1], [b1, b2], [b2, b3], [b3, b0], [b0, r0], [b1, r0], [b2, r1], [b3, r1], [r0, r1]]) haste(L, a, b, 0.009);

  enche({ cx, cz, y: yFundo });
}

// Vitrine alta, de corais.
function vitrineAlta(L, cx, cz, r) {
  const m = 0.45, y0 = 0.6, y1 = 1.56;
  const x0 = cx - m, x1 = cx + m, z0 = cz - m, z1 = cz + m;
  L.madeira.push(caixa(x0 - 0.03, x1 + 0.03, 0, 0.1, z0 - 0.03, z1 + 0.03, 'cedft', 4));
  L.madeira.push(caixa(x0, x1, 0.1, y0, z0, z1, 'edft', 4));
  L.madeira.push(caixa(x0 - 0.02, x1 + 0.02, y0, y0 + 0.03, z0 - 0.02, z1 + 0.02, 'cedft', 4));
  L.latao.push(caixa(x0 - 0.022, x1 + 0.022, y0 + 0.02, y0 + 0.032, z0 - 0.022, z1 + 0.022, 'edft', 0.6));
  L.madeira.push(caixa(x0 - 0.025, x1 + 0.025, y1, y1 + 0.05, z0 - 0.025, z1 + 0.025, 'cbedft', 4));
  L.pecas.push(pinta(caixa(x0, x1, y0 + 0.03, y0 + 0.032, z0, z1, 'c', 0.5), veludo()));
  const c = v3(cx, 1, cz);
  const y = y0 + 0.03;
  const A = (x, z) => v3(x, y, z), B = (x, z) => v3(x, y1, z);
  const cantos = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  for (let i = 0; i < 4; i++) {
    const [xa, za] = cantos[i], [xb, zb] = cantos[(i + 1) % 4];
    pano(L, [A(xa, za), A(xb, zb), B(xb, zb), B(xa, za)], c);
    haste(L, A(xa, za), B(xa, za), 0.013);
    haste(L, B(xa, za), B(xb, zb), 0.009);
  }
  // Almofada de pé para a coleção de corais.
  const yBase = y + 0.002;
  L.madeira.push(caixa(cx - 0.17, cx + 0.17, yBase, yBase + 0.05, cz - 0.17, cz + 0.17, 'cedft', 4));
  L.latao.push(cilindroEntre(v3(cx, yBase + 0.05, cz), v3(cx, yBase + 0.1, cz), 0.012, 6));
  coral(r, v3(cx, yBase + 0.08, cz), 0.86, 0.034, cor(PALETA.tijolo).lerp(cor(PALETA.ferrugem), 0.3).multiplyScalar(0.72), L.pecas, 5, 0.6);
  coral(r, v3(cx + 0.27, yBase, cz - 0.2), 0.36, 0.02, cor(PALETA.terracota, 0.72), L.pecas, 3, 0.8);
  const cerebro = coralCerebro(0.12);
  cerebro.translate(cx - 0.24, yBase + 0.08, cz + 0.22);
  L.pecas.push(cerebro);
  const cerebro2 = coralCerebro(0.07);
  cerebro2.translate(cx + 0.28, yBase + 0.05, cz + 0.26);
  L.pecas.push(cerebro2);
  return { x0: x0 - 0.03, x1: x1 + 0.03, z0: z0 - 0.03, z1: z1 + 0.03 };
}

// Vitrine oitavada da tridacna. Devolve a dobradiça, para a valva de cima respirar.
function vitrineTridacna(L, cx, cz, frente) {
  const R = 0.85, y0 = 0.6, y1 = 1.46, yTopo = 1.66;
  const a0 = Math.PI / 8;

  const corpo = new THREE.CylinderGeometry(R, R * 1.04, y0 - 0.1, 8, 1, true, a0);
  corpo.translate(cx, 0.1 + (y0 - 0.1) / 2, cz);
  L.madeira.push(facetado(corpo, 4));
  const pe = new THREE.CylinderGeometry(R * 1.07, R * 1.07, 0.1, 8, 1, false, a0);
  pe.translate(cx, 0.05, cz);
  L.madeira.push(facetado(pe, 4));
  const borda = new THREE.CylinderGeometry(R + 0.02, R + 0.02, 0.05, 8, 1, false, a0);
  borda.translate(cx, y0 + 0.025, cz);
  L.madeira.push(facetado(borda, 4));
  const fita = new THREE.CylinderGeometry(R + 0.024, R + 0.024, 0.014, 8, 1, true, a0);
  fita.translate(cx, y0 + 0.04, cz);
  L.latao.push(facetado(fita, 0.6));

  const piso = new THREE.CircleGeometry(R * 0.98, 8, a0);
  piso.rotateX(-Math.PI / 2);
  piso.translate(cx, y0 + 0.052, cz);
  L.pecas.push(pinta(uvMundo(piso, 0.5), veludo()));

  const yV = y0 + 0.05;

  // Base da concha: um toco de madeira com a borda de latão, para ela não flutuar no veludo.
  const toco = new THREE.CylinderGeometry(0.25, 0.33, 0.13, 14, 1, false);
  toco.translate(cx, yV + 0.065, cz);
  L.madeira.push(uvMundo(toco, 4));
  const aroToco = new THREE.CylinderGeometry(0.254, 0.262, 0.016, 14, 1, true);
  aroToco.translate(cx, yV + 0.125, cz);
  L.latao.push(uvMundo(aroToco, 0.6));
  const c = v3(cx, 1.1, cz);
  const canto = (i, y, k = R) => {
    const a = a0 + (i * Math.PI) / 4;
    return v3(cx + k * Math.sin(a), y, cz + k * Math.cos(a));
  };
  const apice = v3(cx, yTopo, cz);
  for (let i = 0; i < 8; i++) {
    pano(L, [canto(i, yV), canto(i + 1, yV), canto(i + 1, y1), canto(i, y1)], c);
    pano(L, [canto(i, y1), canto(i + 1, y1), apice], c);
    haste(L, canto(i, yV), canto(i, y1), 0.012);
    haste(L, canto(i, y1), canto(i + 1, y1), 0.009);
    haste(L, canto(i, yV), canto(i + 1, yV), 0.009);
    haste(L, canto(i, y1), apice, 0.007);
  }
  const remate = new THREE.SphereGeometry(0.034, 10, 6);
  remate.translate(cx, yTopo + 0.016, cz);
  L.latao.push(uvMundo(remate, 0.6));

  // Vieiras de latão nas duas faces voltadas para o salão.
  for (const i of [-1, 0]) {
    const a = a0 + ((i + 2.5) * Math.PI) / 4 + Math.PI;
    const crista = vieira({ raio: 0.22, costelas: 7, nu: 3, nv: 18, bojo: 0.17, ampl: 0.05, vale: 0.45 });
    crista.translate(0, 0.14, 0);
    const n = v3(Math.sin(a), 0, Math.cos(a));
    crista.rotateY(Math.atan2(-n.x, -n.z));
    crista.translate(cx + n.x * (R * 0.94 + 0.008), 0, cz + n.z * (R * 0.94 + 0.008));
    L.latao.push(crista);
  }

  // A concha, voltada para quem vem do centro do salão.
  const Z = frente.clone().normalize(), Y = v3(0, 1, 0), X = Y.clone().cross(Z).normalize();
  const dobradica = v3(cx, 1.03, cz).addScaledVector(Z, -0.36);
  const base = new THREE.Matrix4().makeBasis(X, Y, Z);
  const inferior = valvaTridacna(false);
  const tombo = new THREE.Matrix4().makeRotationX(0.3);
  inferior.applyMatrix4(new THREE.Matrix4().makeTranslation(dobradica.x, dobradica.y, dobradica.z).multiply(base).multiply(tombo));
  L.nacar.push(inferior);

  // A pérola do livro, do tamanho de um coco.
  const pLocal = v3(0, -0.062, 0.3).applyMatrix4(tombo).applyMatrix4(base).add(dobradica);
  const grande = new THREE.SphereGeometry(0.088, 28, 18);
  grande.attributes.uv.array.fill(0);
  grande.translate(pLocal.x, pLocal.y, pLocal.z);
  L.nacar.push(pinta(grande, cor(PALETA.nevoa, 1.12)));

  return { dobradica, base: new THREE.Quaternion().setFromRotationMatrix(base), superior: valvaTridacna(true), obstaculo: { x0: cx - R * 1.07, x1: cx + R * 1.07, z0: cz - R * 1.07, z1: cz + R * 1.07 } };
}

// Bandeja de conchas.
function arrumaConchas(L, { cx, cz, y }, r) {
  const lado = Math.sign(cx);
  // O nautilus deitado, com a espiral para quem olha de cima do vidro.
  const naut = nautiloide(0.165);
  naut.rotateX(-Math.PI / 2 + 0.55);
  naut.rotateY(lado > 0 ? -1.9 : 1.2);
  naut.translate(cx + 0.02, y + 0.095, cz - 0.02);
  L.pecas.push(naut);

  const posicoes = [[-0.2, -0.64], [0.22, -0.34], [-0.22, 0.32], [0.2, 0.68], [-0.02, -0.7], [0.02, 0.36]];
  posicoes.forEach(([dx, dz], i) => {
    const tom = i % 2 ? cor(PALETA.terracota, 0.95) : cor(PALETA.caqui, 1);
    const concha = vieira({ raio: 0.1 + r() * 0.035, costelas: 7, nu: 4, nv: 18, bojo: 0.2, ampl: 0.06, tom, vale: 0.55, orelhas: false });
    concha.rotateX(Math.PI / 2 - 0.1);
    concha.rotateY(r() * Math.PI * 2);
    concha.translate(cx + dx, y + 0.012, cz + dz);
    L.pecas.push(concha);
  });
  for (const [dx, dz, h, ang] of [[-0.24, -0.32, 0.24, 1.3], [0.18, 0.5, 0.2, -1.9]]) {
    const t = turritela(h, h * 0.2);
    t.rotateZ(Math.PI / 2 - 0.04);
    t.rotateY(ang);
    t.translate(cx + dx, y + h * 0.19, cz + dz);
    L.pecas.push(t);
  }
  for (const [dx, dz, ang] of [[-0.26, 0.04, 0.4], [0.27, -0.06, -0.6], [0.16, -0.68, 1.2], [-0.2, 0.66, 2.2]]) {
    pousa(L, cauri(0.05, 0.032, 0.026), cx + dx, y + 0.024, cz + dz, ang);
  }
}

// Bandeja de pérolas sobre almofadas.
function arrumaPerolas(L, { cx, cz, y }, r) {
  const tons = [cor(PALETA.nevoa, 1.05), cor(PALETA.lilas, 1.1), cor(PALETA.nevoa, 0.95), cor(PALETA.caqui, 1.15)];
  for (const [dz, largura, profundidade] of [[-0.4, 0.5, 0.46], [0.4, 0.5, 0.46]]) {
    L.pecas.push(pinta(caixa(cx - largura / 2, cx + largura / 2, y, y + 0.026, cz + dz - profundidade / 2, cz + dz + profundidade / 2, 'cedft', 0.5), cor(PALETA.tijolo, 0.48)));
    for (let f = 0; f < 3; f++) {
      for (let c = 0; c < 3; c++) {
        const raio = 0.017 + (2 - f) * 0.006 + r() * 0.003;
        perola(L, cx + (c - 1) * 0.125, y + 0.026 + raio * 0.9, cz + dz + (f - 1) * 0.125, raio, r.de(tons));
      }
    }
  }
  // Uma vieira aberta com a maior das pérolas soltas, no centro.
  const concha = vieira({ raio: 0.16, costelas: 7, nu: 3, nv: 18, bojo: 0.2, ampl: 0.06, tom: cor(PALETA.caqui, 1), vale: 0.55, orelhas: false });
  concha.rotateX(Math.PI / 2 - 0.1);
  concha.rotateY(2.5);
  concha.translate(cx, y + 0.015, cz + 0.02);
  L.pecas.push(concha);
  perola(L, cx - 0.03, y + 0.05, cz - 0.02, 0.036, tons[0]);
}

export function montaColecao(L, obstaculos) {
  const r = sorteador(1869);

  // Da pérola para quem chega do centro do salão.
  const trid = vitrineTridacna(L, 3.5, -2.4, v3(-0.67, 0, 0.74));
  obstaculos.push(trid.obstaculo);

  obstaculos.push(vitrineAlta(L, -3.6, -2.4, r));

  const mesas = [[4.05, 0.6, arrumaConchas], [-4.05, 0.6, arrumaPerolas]];
  for (const [cx, cz, enche] of mesas) {
    vitrineDeMesa(L, cx, cz, (b) => enche(L, b, r));
    obstaculos.push({ x0: cx - 0.42, x1: cx + 0.42, z0: cz - 0.87, z1: cz + 0.87 });
  }
  return trid;
}
