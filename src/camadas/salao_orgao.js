// O órgão de Nemo, a peça principal da popa: torres e campos de tubos que ecoam o arco da abóbada,
// caixa de palissandro incrustada de latão, console com três teclados, pedaleira e banco.
import * as THREE from 'three';
import { PALETA } from '../config.js';
import { uvMundo, cilindroEntre } from '../geo.js';
import { caixa, grade, pinta, sorteador, vieira } from './salao_comum.js';

const Y_IMPOSTA = 2.02;
const Z_FACE = 6.35;
const Z_CAMPO = 6.6;
const GRAU = Math.PI / 180;

// Curva dos topos: o arco da abóbada, mais fechado, para o desenho se ler de longe.
const topo = (x) => 2 + 3.85 * Math.sqrt(Math.max(0, 1 - (x / 4.15) ** 2));
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const lerp = (a, b, f) => a + (b - a) * f;

function listaTubos() {
  const tubos = [];
  const torre = (xc, zc, Rp, n, r, amax, altura, tom = 1) => {
    for (let i = 0; i < n; i++) {
      const f = (2 * i) / (n - 1) - 1, a = amax * f;
      tubos.push({ x: xc + Rp * Math.sin(a), z: zc - Rp * Math.cos(a), r, yaw: a, topo: altura - 0.34 * f * f, boca: true, tom });
    }
  };
  const campo = (x0, x1, n, r0, r1, sag, tom) => {
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1), x = lerp(x0, x1, f);
      tubos.push({ x, z: Z_CAMPO, r: lerp(r0, r1, f), yaw: 0, topo: topo(x) - sag * Math.sin(Math.PI * f) - 0.08, boca: true, tom });
    }
  };

  torre(0, 6.8, 0.62, 7, 0.118, 70 * GRAU, 5.86);
  for (const s of [-1, 1]) {
    campo(s * 0.76, s * 1.41, 7, 0.056, 0.044, 1.0, 0.82);
    torre(s * 1.78, 6.6, 0.3, 5, 0.082, 65 * GRAU, topo(1.78) + 0.1);
    campo(s * 2.16, s * 2.64, 6, 0.042, 0.036, 0.72, 0.82);
    torre(s * 2.94, 6.56, 0.24, 5, 0.066, 65 * GRAU, topo(2.94) + 0.12);
  }

  // Fileiras de trás, mais escuras: dão profundidade no estéreo e fecham os vãos entre as torres.
  const fileira = (x0, x1, passo, z, r, altura, tom) => {
    const n = Math.round(Math.abs(x1 - x0) / passo);
    for (let i = 0; i <= n; i++) {
      const x = lerp(x0, x1, i / n);
      tubos.push({ x, z, r, yaw: 0, topo: Math.min(altura(x, i), 5.98), boca: false, tom });
    }
  };
  for (const s of [-1, 1]) {
    fileira(s * 0.72, s * 1.44, 0.112, 6.76, 0.05, (x, i) => topo(x) - 0.52 + (i % 2) * 0.12, 0.56);
    fileira(s * 2.14, s * 2.66, 0.1, 6.76, 0.044, (x, i) => topo(x) - 0.4 + (i % 2) * 0.1, 0.56);
  }
  fileira(-3.18, 3.18, 0.088, 6.87, 0.036, (x, i) => topo(x) - 0.12 + (i % 2) * 0.13, 0.36);

  for (const t of tubos) t.yBoca = t.boca ? Y_IMPOSTA + 0.16 + t.r * 5.2 : Y_IMPOSTA;
  return tubos;
}

// Pé cônico, fenda escura e lábio em mitra: é a boca que faz o tubo se ler como órgão.
function bocaDoTubo({ x, z, r, yaw, yBoca }, latao) {
  const L = yBoca - Y_IMPOSTA;
  const pe = new THREE.CylinderGeometry(r, r * 0.24, L, 12, 2, true);
  pe.translate(0, Y_IMPOSTA + L / 2, 0);
  pinta(pe);

  const placa = (perfil, segs, k) => grade(perfil.length - 1, segs, (i, j, s) => {
    const [y, w, rr] = perfil[i];
    const b = w * ((2 * j) / segs - 1);
    s.x = r * rr * Math.sin(b); s.y = y; s.z = -r * rr * Math.cos(b);
    s.u = s.x / 0.6; s.v = y / 0.6;
    s.r = s.g = s.b = k;
  }, true);
  const fenda = placa([[yBoca - r * 0.02, 0.85, 1.03], [yBoca + r * 0.38, 0.85, 1.03]], 6, 0.09);
  const labioInf = placa([[yBoca - r * 0.8, 0.55, 0.97], [yBoca, 0.87, 1.04]], 6, 1.2);
  const labioSup = placa([[yBoca + r * 0.38, 0.88, 1.05], [yBoca + r * 1.25, 0.8, 1.05], [yBoca + r * 1.95, 0.5, 1.045], [yBoca + r * 2.5, 0.0, 1.025]], 6, 1.25);

  for (const g of [pe, fenda, labioInf, labioSup]) {
    g.rotateY(-yaw);
    g.translate(x, 0, z);
    if (g === pe) uvMundo(g, 0.6);
    latao.push(g);
  }
}

// Meia-coroa sob uma torre: a borda em latão e a mísula em madeira.
function coroaDaTorre(L, xc, zc, R, amax = 100 * GRAU) {
  const inicio = Math.PI - amax, arco = amax * 2;
  const tambor = new THREE.CylinderGeometry(R, R, 0.1, 18, 1, false, inicio, arco);
  tambor.translate(xc, Y_IMPOSTA - 0.05, zc);
  L.madeira.push(uvMundo(tambor, 4));
  const misula = new THREE.CylinderGeometry(R, R * 0.62, 0.26, 18, 1, true, inicio, arco);
  misula.translate(xc, Y_IMPOSTA - 0.23, zc);
  L.madeira.push(uvMundo(misula, 4));
  const aro = new THREE.CylinderGeometry(R + 0.012, R + 0.012, 0.028, 18, 1, true, inicio, arco);
  aro.translate(xc, Y_IMPOSTA - 0.012, zc);
  L.latao.push(uvMundo(aro, 0.6));
  const aro2 = new THREE.CylinderGeometry(R + 0.008, R + 0.008, 0.016, 18, 1, true, inicio, arco);
  aro2.translate(xc, Y_IMPOSTA - 0.1, zc);
  L.latao.push(uvMundo(aro2, 0.6));
}

// Cinta de latão que amarra os tubos de uma torre.
function cinta(L, xc, zc, R, amax, y) {
  const g = new THREE.CylinderGeometry(R, R, 0.03, 10, 1, true, Math.PI - amax, amax * 2);
  g.translate(xc, y, zc);
  L.latao.push(uvMundo(g, 0.6));
}

// Sombreira de latão sobre os tubos de um campo, como nos órgãos antigos. As curvas chicote e a vieira vêm das molduras da arte.
function sombreira(L, x0, x1, yBaixo, altura, z) {
  const cx = (x0 + x1) / 2, m = Math.abs(x1 - x0) / 2;
  const CURVAS = [
    [[-1, 0.85], [-0.72, 0.55], [-0.38, 0.42], [-0.16, 0.6], [-0.22, 0.78], [-0.36, 0.72]],
    [[-1, 0.18], [-0.6, 0.02], [-0.2, 0.05], [0, 0.2]],
    [[-1, 0.55], [-0.78, 0.92], [-0.5, 1], [-0.3, 0.92], [-0.38, 0.82]],
    [[-0.72, 0.55], [-0.62, 0.32], [-0.42, 0.2], [-0.3, 0.28]],
  ];
  for (const c of CURVAS) {
    for (const s of [-1, 1]) {
      const pontos = c.map(([u, v]) => v3(cx + s * u * m, yBaixo + v * altura, z));
      L.latao.push(uvMundo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pontos), 12, 0.011, 5, false), 0.6));
    }
  }
  const concha = vieira({ raio: Math.min(m * 0.46, altura * 0.42), costelas: 7, nu: 3, nv: 18, bojo: 0.2, ampl: 0.05, vale: 0.45 });
  concha.translate(cx, yBaixo + altura * 0.16, z);
  L.latao.push(concha);
}

function caixaDoOrgao(L) {
  const { madeira, latao } = L;
  const X = 3.28; // a cornija não pode entrar no aro da porta, que começa em x = -3,41.
  madeira.push(caixa(-X, X, 0, 1.84, Z_FACE, 7, 'fed', 4));
  madeira.push(caixa(-X - 0.04, X + 0.04, 0, 0.16, Z_FACE - 0.06, 7, 'cfed', 4));
  madeira.push(caixa(-X - 0.02, X + 0.02, 1.2, 1.25, Z_FACE - 0.03, 7, 'cbfed', 4));
  madeira.push(caixa(-X - 0.05, X + 0.05, 1.78, 1.84, Z_FACE - 0.05, 7, 'bfed', 4));
  madeira.push(caixa(-X - 0.12, X + 0.12, 1.84, Y_IMPOSTA, Z_FACE - 0.13, 7, 'bfed', 4));
  latao.push(caixa(-X - 0.122, X + 0.122, 1.836, 1.85, Z_FACE - 0.134, 6.98, 'bfed', 0.6));
  latao.push(caixa(-X - 0.122, X + 0.122, Y_IMPOSTA - 0.016, Y_IMPOSTA, Z_FACE - 0.134, 6.98, 'cfed', 0.6));

  // Painéis de palissandro com filete de latão, como no livro.
  const painel = (x0, x1, y0, y1) => {
    const z = Z_FACE;
    madeira.push(pinta(caixa(x0 + 0.05, x1 - 0.05, y0 + 0.05, y1 - 0.05, z - 0.018, z, 'cbfed', 4), 0xffffff, 1.18));
    const f = 0.007, zl = z - 0.003;
    latao.push(caixa(x0, x1, y0 - f, y0 + f, zl, z, 'f', 0.6));
    latao.push(caixa(x0, x1, y1 - f, y1 + f, zl, z, 'f', 0.6));
    latao.push(caixa(x0 - f, x0 + f, y0, y1, zl, z, 'f', 0.6));
    latao.push(caixa(x1 - f, x1 + f, y0, y1, zl, z, 'f', 0.6));
  };
  for (const s of [-1, 1]) {
    const faixa = (a, b, y0, y1) => (s > 0 ? painel(a, b, y0, y1) : painel(-b, -a, y0, y1));
    for (const [a, b] of [[1.3, 1.62], [1.94, 2.78], [3.1, 3.24]]) {
      faixa(a, b, 0.24, 1.14);
      faixa(a, b, 1.31, 1.72);
    }
    // Pilastras sob as torres.
    for (const x of [1.78, 2.94]) {
      const c = s * x;
      madeira.push(caixa(c - 0.13, c + 0.13, 0.16, 1.78, Z_FACE - 0.05, Z_FACE, 'fed', 4));
      latao.push(caixa(c - 0.012, c + 0.012, 0.3, 1.66, Z_FACE - 0.053, Z_FACE - 0.05, 'f', 0.6));
    }
  }

  // Fundo em arco: recorta a silhueta dos tubos contra a chapa da popa.
  const yArco = (x) => 2 + 4 * Math.sqrt(Math.max(0, 1 - (x / 4.25) ** 2));
  const XF = 3.36;
  const forma = new THREE.Shape();
  forma.moveTo(-XF, Y_IMPOSTA);
  forma.lineTo(XF, Y_IMPOSTA);
  const pontosArco = [];
  for (let i = 0; i <= 36; i++) {
    const x = XF - (2 * XF * i) / 36;
    forma.lineTo(x, yArco(x));
    pontosArco.push(v3(x, yArco(x), 6.9));
  }
  forma.closePath();
  const fundo = new THREE.ShapeGeometry(forma);
  fundo.rotateY(Math.PI);
  fundo.translate(0, 0, 6.93);
  madeira.push(pinta(uvMundo(fundo, 4), 0xffffff, 0.62));
  const filete = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pontosArco), 40, 0.022, 5, false);
  latao.push(uvMundo(filete, 0.6));
  for (const s of [-1, 1]) latao.push(cilindroEntre(v3(s * XF, Y_IMPOSTA, 6.9), v3(s * XF, yArco(XF), 6.9), 0.022, 5));
}

function consoleDoOrgao(L) {
  const { madeira, latao, pecas } = L;
  const cor = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);
  const r = sorteador(77);

  // Bochechas, com o perfil curvo de um móvel de 1860.
  const perfil = new THREE.Shape();
  perfil.moveTo(5.68, 0);
  perfil.lineTo(6.4, 0);
  perfil.lineTo(6.4, 1.66);
  perfil.lineTo(6.08, 1.66);
  perfil.lineTo(6.07, 0.98);
  perfil.quadraticCurveTo(6.05, 0.84, 5.94, 0.82);
  perfil.lineTo(5.76, 0.78);
  perfil.quadraticCurveTo(5.68, 0.76, 5.68, 0.68);
  perfil.closePath();
  for (const s of [-1, 1]) {
    const g = new THREE.ExtrudeGeometry(perfil, { depth: 0.32, bevelEnabled: false, curveSegments: 4 });
    g.rotateY(-Math.PI / 2);
    g.translate(s > 0 ? 1.2 : -0.88, 0, 0);
    madeira.push(uvMundo(g, 4));
    // Filete na testa da bochecha.
    const x0 = s > 0 ? 0.88 : -1.2;
    latao.push(caixa(x0, x0 + 0.32, 0.975, 0.985, 6.066, 6.07, 'f', 0.6));
    latao.push(caixa(x0, x0 + 0.32, 1.6, 1.61, 6.07, 6.08, 'f', 0.6));
  }

  // Tampo do console.
  madeira.push(caixa(-1.24, 1.24, 1.66, 1.72, 6.02, 6.42, 'cbfed', 4));
  latao.push(caixa(-1.242, 1.242, 1.655, 1.668, 6.018, 6.42, 'bfed', 0.6));

  // Leito das teclas em degraus.
  const Yt = [0.74, 0.81, 0.88], Zt = [5.76, 5.88, 6.0];
  madeira.push(caixa(-0.88, 0.88, 0.62, 0.72, 5.72, 6.2, 'cbf', 4));
  madeira.push(caixa(-0.88, 0.88, 0.72, 0.79, 5.9, 6.2, 'f', 4));
  madeira.push(caixa(-0.88, 0.88, 0.79, 0.86, 6.02, 6.2, 'f', 4));
  madeira.push(caixa(-0.88, 0.88, 0.86, 0.93, 6.14, 6.2, 'cf', 4));
  madeira.push(caixa(-0.88, 0.88, 0.93, 1.66, 6.16, 6.2, 'f', 4));
  madeira.push(caixa(-0.88, 0.88, 0.12, 0.62, 6.16, 6.2, 'f', 4));

  // Teclados: marfim gasto e ébano.
  const N = 73, XT = 0.86, w = (2 * XT) / N;
  const marfim = cor(PALETA.nevoa), ebano = cor(PALETA.olivaEscuro, 0.22);
  for (let m = 0; m < 3; m++) {
    const y = Yt[m], z = Zt[m];
    for (let i = 0; i < N; i++) {
      const x = -XT + i * w;
      pecas.push(pinta(caixa(x + 0.0008, x + w - 0.0008, y - 0.022, y, z, z + 0.15, 'cf', 0.3), marfim, r.entre(0.78, 0.96)));
      const nota = i % 7;
      if (i < N - 1 && nota !== 2 && nota !== 6) {
        const xb = x + w - w * 0.3;
        pecas.push(pinta(caixa(xb, xb + w * 0.6, y, y + 0.012, z + 0.055, z + 0.15, 'cfed', 0.3), ebano));
      }
    }
  }

  // Registros: puxadores em duas colunas de cada lado.
  for (const s of [-1, 1]) {
    for (let c = 0; c < 2; c++) {
      for (let l = 0; l < 6; l++) {
        const x = s * (0.97 + c * 0.13), y = 1.06 + l * 0.095, z = 6.07;
        latao.push(cilindroEntre(v3(x, y, z), v3(x, y, z - 0.05), 0.008, 6));
        const f = new THREE.CircleGeometry(0.019, 10);
        f.rotateY(Math.PI);
        f.translate(x, y, z - 0.05);
        const tom = (c + l) % 3 === 0 ? cor(PALETA.tijolo, 0.8) : cor(PALETA.nevoa, 0.85);
        pecas.push(pinta(uvMundo(f, 0.3), tom));
      }
    }
  }

  // Estante de partituras.
  latao.push(caixa(-0.72, 0.72, 1.03, 1.046, 6.05, 6.16, 'cfed', 0.6));
  for (const x of [-0.72, 0.72]) latao.push(cilindroEntre(v3(x, 1.04, 6.15), v3(x, 1.44, 6.15), 0.007, 6));
  latao.push(cilindroEntre(v3(-0.72, 1.44, 6.15), v3(0.72, 1.44, 6.15), 0.007, 6));

  // Pedaleira.
  madeira.push(caixa(-0.88, 0.88, 0, 0.05, 5.66, 6.16, 'cf', 4));
  for (let i = 0; i < 13; i++) {
    const x = -0.66 + i * 0.104;
    const tom = i % 7 === 1 || i % 7 === 3 ? ebano : cor(PALETA.caqui, 0.55);
    pecas.push(pinta(caixa(x, x + 0.05, 0.05, 0.085, 5.72, 6.14, 'cfed', 0.3), tom));
  }

  // Banco: estofado em tijolo, sobre pernas de palissandro com ponteira de latão.
  const assento = new THREE.BoxGeometry(1.36, 0.08, 0.32, 8, 2, 4);
  const p = assento.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / 0.68, y = p.getY(i) / 0.04, z = p.getZ(i) / 0.16;
    if (y > 0) p.setY(i, 0.04 * (0.55 + 0.45 * (1 - x ** 4) * (1 - z ** 4)) + 0.022 * (1 - x * x) * (1 - z * z));
  }
  assento.computeVertexNormals();
  assento.translate(0, 0.5, 5.45);
  pecas.push(pinta(uvMundo(assento, 0.4), cor(PALETA.tijolo, 0.62)));
  madeira.push(caixa(-0.71, 0.71, 0.4, 0.46, 5.28, 5.62, 'bfedt', 4));
  latao.push(caixa(-0.712, 0.712, 0.455, 0.465, 5.278, 5.622, 'fedt', 0.6));
  for (const sx of [-1, 1]) {
    for (const z of [5.33, 5.57]) {
      const x = sx * 0.62;
      const perna = new THREE.CylinderGeometry(0.034, 0.018, 0.34, 8, 1, true);
      perna.translate(x, 0.23, z);
      madeira.push(uvMundo(perna, 4));
      const ponta = new THREE.CylinderGeometry(0.018, 0.015, 0.06, 8, 1, true);
      ponta.translate(x, 0.03, z);
      latao.push(uvMundo(ponta, 0.6));
    }
  }
  madeira.push(caixa(-0.62, 0.62, 0.14, 0.17, 5.44, 5.46, 'cbft', 4));
}

export function montaOrgao(L, materialTubo, obstaculos) {
  const tubos = listaTubos();
  for (const t of tubos) if (t.boca) bocaDoTubo(t, L.latao);

  const corpo = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true);
  corpo.translate(0, 0.5, 0);
  const malha = new THREE.InstancedMesh(corpo, materialTubo, tubos.length);
  malha.name = 'salao:tubos';
  // A esfera automática sai muito folgada com tubos esticados; esta deixa o órgão sair do quadro quando se olha a vitrine.
  malha.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 4, 6.45), 3.95);
  const r = sorteador(11);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), e = new THREE.Vector3(), c = new THREE.Color();
  const eixoY = new THREE.Vector3(0, 1, 0);
  tubos.forEach((t, i) => {
    q.setFromAxisAngle(eixoY, -t.yaw);
    m.compose(p.set(t.x, t.yBoca, t.z), q, e.set(t.r, t.topo - t.yBoca, t.r));
    malha.setMatrixAt(i, m);
    const j = r.entre(0.88, 1.1), h = r.entre(-0.05, 0.05);
    c.setRGB(t.tom * j * (1 + h), t.tom * j, t.tom * j * (1 - h * 1.6));
    malha.setColorAt(i, c);
  });

  coroaDaTorre(L, 0, 6.8, 0.8);
  for (const s of [-1, 1]) {
    coroaDaTorre(L, s * 1.78, 6.6, 0.44);
    coroaDaTorre(L, s * 2.94, 6.56, 0.37);
    cinta(L, s * 1.78, 6.6, 0.3 + 0.082 + 0.006, 75 * GRAU, 3.45);
    cinta(L, s * 2.94, 6.56, 0.24 + 0.066 + 0.006, 75 * GRAU, 3.3);
    cinta(L, s * 1.78, 6.6, 0.3 + 0.082 + 0.006, 75 * GRAU, topo(1.78) - 0.62);
    cinta(L, s * 2.94, 6.56, 0.24 + 0.066 + 0.006, 75 * GRAU, topo(2.94) - 0.58);
    // Trilhos que seguram os campos.
    for (const y of [3.05, 3.1]) {
      L.latao.push(cilindroEntre(v3(s * 0.72, y, Z_CAMPO - 0.065), v3(s * 1.44, y, Z_CAMPO - 0.065), 0.006, 5));
      L.latao.push(cilindroEntre(v3(s * 2.13, y, Z_CAMPO - 0.05), v3(s * 2.67, y, Z_CAMPO - 0.05), 0.006, 5));
    }
  }
  cinta(L, 0, 6.8, 0.62 + 0.118 + 0.006, 80 * GRAU, 3.85);
  cinta(L, 0, 6.8, 0.62 + 0.118 + 0.006, 80 * GRAU, 3.92);
  cinta(L, 0, 6.8, 0.62 + 0.118 + 0.006, 80 * GRAU, 5.12);
  for (const s of [-1, 1]) {
    const meio1 = s * 1.085, meio2 = s * 2.4;
    sombreira(L, s * 0.76, s * 1.41, topo(meio1) - 1.2, 1.0, Z_CAMPO - 0.075);
    sombreira(L, s * 2.16, s * 2.64, topo(meio2) - 0.92, 0.74, Z_CAMPO - 0.06);
  }

  caixaDoOrgao(L);
  consoleDoOrgao(L);

  // Vieira de latão coroando o console: o motivo das molduras da arte, em escala de arquitetura.
  const crista = vieira({ raio: 0.8, costelas: 11, nu: 18, nv: 88, bojo: 0.17, ampl: 0.04, vale: 0.42, luzOrelha: 0.2 });
  crista.translate(0, 1.76, 5.99);
  L.latao.push(crista);

  obstaculos.push(
    { x0: -3.42, x1: 3.42, z0: 6.2, z1: 7 },
    { x0: -1.24, x1: 1.24, z0: 5.68, z1: 6.2 },
    { x0: -0.72, x1: 0.72, z0: 5.28, z1: 5.62 },
  );
  return malha;
}

// Partituras sobre a estante, no atlas de papel do quadro.
export function folhasDePartitura(L, recortes) {
  const folhas = [
    { x: -0.31, y: 1.05, h: 0.36, w: 0.27, gira: 0.035, r: 0 },
    { x: -0.02, y: 1.05, h: 0.36, w: 0.27, gira: -0.02, r: 1 },
    { x: 0.42, y: 1.05, h: 0.33, w: 0.25, gira: -0.09, r: 0 },
  ];
  for (const f of folhas) {
    const g = new THREE.PlaneGeometry(f.w, f.h);
    const [u0, v0, du, dv] = recortes[f.r];
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * du, v0 + uv.getY(i) * dv);
    g.rotateY(Math.PI);
    g.rotateZ(f.gira);
    g.rotateX(0.12);
    g.translate(f.x + f.w / 2, f.y + f.h / 2, 6.1);
    L.papel.push(g);
  }
}
