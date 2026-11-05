// A biblioteca: "móveis de palissandro negro, incrustados de cobre", estantes baixas nas baias sob as vigias.
import * as THREE from 'three';
import { PALETA } from '../config.js';
import { caixa, pinta, sorteador, texturaPlana } from './salao_comum.js';

const BAIAS = [[-4.3, -2.46], [-2.2, -0.13], [0.13, 2.2], [2.46, 4.54], [4.8, 6.76]];
const X_FRENTE = 5.72, X_FUNDO = 6.1, X_TAMPO = 6.33;
const Y_CHAO = 0.125, Y_MEIO = 0.54, Y_MEIO_TOPO = 0.565, Y_TAMPO = 0.94, Y_TOPO = 0.98;
const COLUNAS = 8;

const lin = (hex, k = 1) => {
  const c = new THREE.Color(hex).multiplyScalar(k);
  return `vec3(${c.r.toFixed(4)},${c.g.toFixed(4)},${c.b.toFixed(4)})`;
};

// Em cada canal, uma coisa: R grão da capa, G dourado, B etiqueta, A rugosidade. Colunas de lombada, cobertas lisas em cima.
function atlasDeLombadas() {
  const L = 64, A = 256, W = L * COLUNAS;
  const d = new Uint8Array(W * A * 4);
  const r = sorteador(321);
  for (let i = 0; i < W * A; i++) {
    d[i * 4] = 214 + r() * 34;
    d[i * 4 + 3] = 235;
  }
  const faixa = (col, x0, x1, y0, y1, canal, valor) => {
    for (let y = Math.round(y0 * A * 0.8); y <= Math.round(y1 * A * 0.8); y++) {
      for (let x = Math.round(x0 * L); x < Math.round(x1 * L); x++) {
        const i = (y * W + col * L + x) * 4;
        d[i + canal] = valor;
        if (canal === 1) d[i + 3] = 130;
      }
    }
  };
  const linha = (col, y, duplo = false) => {
    faixa(col, 0, 1, y, y + 0.006, 1, 255);
    if (duplo) faixa(col, 0, 1, y + 0.016, y + 0.021, 1, 255);
  };
  const titulo = (col, y, h) => {
    faixa(col, 0.04, 0.96, y, y + h, 2, 255);
    const n = 2 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const yy = y + (h * (i + 0.5)) / n;
      faixa(col, 0.2 + r() * 0.1, 0.72 + r() * 0.1, yy - 0.003, yy + 0.003, 1, 220);
    }
    linha(col, y - 0.01); linha(col, y + h + 0.004);
  };
  for (let c = 0; c < COLUNAS; c++) {
    if (c % 2 === 0) { linha(c, 0.04); linha(c, 0.94); }
    if (c === 0) for (const y of [0.3, 0.58]) linha(c, y, true);
    if (c === 3) for (const y of [0.22, 0.42, 0.62]) linha(c, y);
    if (c === 0 || c === 1 || c === 4) titulo(c, 0.74, 0.08);
    if (c === 2) titulo(c, 0.55, 0.14);
    if (c === 3) titulo(c, 0.78, 0.06);
    if (c === 5) { linha(c, 0.08); linha(c, 0.9); titulo(c, 0.8, 0.05); }
    if (c === 6) titulo(c, 0.42, 0.1);
  }
  const t = new THREE.DataTexture(d, W, A, THREE.RGBAFormat);
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

// Livro de 12 triângulos. X: do lombo (0) ao fundo (1). Y: altura. Z: espessura (-0,5 a 0,5).
function geometriaLivro() {
  const pos = [], nor = [], uv = [], cor = [], idx = [];
  const v = (p, n, t, c) => { pos.push(...p); nor.push(...n); uv.push(...t); cor.push(c, c, c); };
  const ARC = 3;
  for (let i = 0; i <= ARC; i++) {
    const a = (Math.PI / 3) * ((2 * i) / ARC - 1);
    const z = (0.5 * Math.sin(a)) / Math.sin(Math.PI / 3), x = -0.06 * Math.cos(a);
    const n = [-Math.cos(a), 0, Math.sin(a)];
    v([x, 0, z], n, [i / ARC, 0.01], 1);
    v([x, 1, z], n, [i / ARC, 0.8], 0.86);
  }
  for (let i = 0; i < ARC; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 3, a, a + 3, a + 1);
  }
  const quad = (a, b, c, d, n, k) => {
    const i = pos.length / 3;
    for (const p of [a, b, c, d]) v(p, n, [0.5, 0.95], k);
    idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  };
  quad([0, 0, 0.5], [1, 0, 0.5], [1, 1, 0.5], [0, 1, 0.5], [0, 0, 1], 0.78);
  quad([1, 0, -0.5], [0, 0, -0.5], [0, 1, -0.5], [1, 1, -0.5], [0, 0, -1], 0.78);
  quad([0, 1, 0.5], [1, 1, 0.5], [1, 1, -0.5], [0, 1, -0.5], [0, 1, 0], 0.62);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  g.setIndex(idx);
  return g;
}

function corpoDaEstante(L, s, z0, z1) {
  const { madeira, latao } = L;
  const faceFrente = s > 0 ? 'e' : 'd';
  const cx = (a, b, y0, y1, za, zb, faces, tile) => (s > 0 ? caixa(a, b, y0, y1, za, zb, faces, tile) : caixa(-b, -a, y0, y1, za, zb, faces, tile));

  madeira.push(cx(X_FRENTE + 0.03, X_FUNDO, 0, 0.1, z0, z1, faceFrente, 4));
  madeira.push(cx(X_FRENTE, X_FUNDO, 0.1, Y_CHAO, z0, z1, faceFrente + 'c', 4));
  madeira.push(pinta(cx(X_FRENTE, X_FUNDO, Y_MEIO, Y_MEIO_TOPO, z0, z1, faceFrente + 'cb', 4), 0xffffff, 0.9));
  madeira.push(cx(X_FRENTE - 0.03, X_TAMPO, Y_TAMPO, Y_TOPO, z0 - 0.02, z1 + 0.02, faceFrente + 'cbft', 4));
  madeira.push(pinta(cx(X_FUNDO - 0.04, X_FUNDO, Y_CHAO, Y_TAMPO, z0, z1, faceFrente, 4), 0xffffff, 0.22));

  // Montantes, com o filete de latão incrustado.
  const n = 3;
  for (let i = 0; i <= n; i++) {
    const z = z0 + ((z1 - z0) * i) / n;
    const a = Math.max(z0, z - 0.028), b = Math.min(z1, z + 0.028);
    madeira.push(cx(X_FRENTE, X_FUNDO, 0.1, Y_TAMPO, a, b, faceFrente + 'ft', 4));
    latao.push(cx(X_FRENTE - 0.002, X_FRENTE + 0.001, 0.13, Y_TAMPO - 0.03, (a + b) / 2 - 0.005, (a + b) / 2 + 0.005, faceFrente, 0.6));
  }
  latao.push(cx(X_FRENTE - 0.032, X_FRENTE - 0.028, Y_TOPO - 0.022, Y_TOPO - 0.012, z0 - 0.02, z1 + 0.02, faceFrente, 0.6));
  latao.push(cx(X_FRENTE - 0.002, X_FRENTE + 0.001, Y_MEIO + 0.008, Y_MEIO + 0.016, z0, z1, faceFrente, 0.6));
}

export function montaBiblioteca(L, comuns, criaMaterial) {
  const TONS = [
    [PALETA.ferrugem, 1.1, 5], [PALETA.malva, 1, 4], [PALETA.tijolo, 0.72, 4], [PALETA.terracota, 0.72, 2],
    [PALETA.olivaEscuro, 1.3, 4], [PALETA.oliva, 0.62, 3], [PALETA.musgo, 0.55, 2], [PALETA.olivaCinza, 0.62, 2],
    [PALETA.marinho, 1.1, 5], [PALETA.verdeMar, 0.85, 3], [PALETA.teal, 0.62, 1], [PALETA.caqui, 0.62, 2],
  ];
  const sacola = [];
  const cinza = new THREE.Color(PALETA.ferrugem);
  for (const [hex, k, peso] of TONS) for (let i = 0; i < peso; i++) sacola.push(new THREE.Color(hex).lerp(cinza, 0.22).multiplyScalar(k * 0.9));

  const livros = [];
  const r = sorteador(2026);
  const novo = (l) => { livros.push(l); return l; };

  // Enche um vão de prateleira com séries de volumes iguais, falhas, livros caídos e pilhas deitadas.
  const enche = (s, zIni, zFim, yBase, hMin, hMax) => {
    let z = zIni + 0.008;
    let ultimo = null;
    const xLombo = () => s * (X_FRENTE + 0.035 + r() * 0.018);
    while (z < zFim - 0.03) {
      const sorteio = r();
      const resta = zFim - z;
      if (sorteio < 0.08 && resta > 0.2) {
        // Falha: o último volume cai encostado no vazio.
        const vao = r.entre(0.07, Math.min(0.24, resta - 0.05));
        if (ultimo && r() < 0.8) {
          const lim = Math.atan2(vao * 0.85, ultimo.h);
          ultimo.inclina = Math.min(lim, r.entre(0.1, 0.34));
          ultimo.y += (ultimo.t / 2) * Math.sin(ultimo.inclina);
        }
        z += vao;
        ultimo = null;
        continue;
      }
      if (sorteio < 0.14 && resta > 0.34) {
        // Pilha deitada.
        const comprimento = r.entre(0.23, 0.31);
        let y = yBase;
        const n = 2 + Math.floor(r() * 3);
        for (let i = 0; i < n; i++) {
          const t = r.entre(0.028, 0.05);
          novo({
            x: xLombo(), y: y + t / 2, z: z + r.entre(0, 0.012), s, t, h: comprimento - r() * 0.03, d: r.entre(0.16, 0.22),
            inclina: Math.PI / 2, gira: r.entre(-0.05, 0.05), cor: r.de(sacola), col: r.de([1, 5, 7, 7]),
          });
          y += t;
        }
        z += comprimento + 0.02;
        ultimo = null;
        continue;
      }
      // Série de volumes da mesma coleção.
      const n = 2 + Math.floor(r() * r() * 9);
      const t0 = r.entre(0.024, 0.054), h0 = r.entre(hMin, hMax), d0 = r.entre(0.17, 0.27);
      const cor = r.de(sacola), col = Math.floor(r() * COLUNAS);
      for (let i = 0; i < n && z < zFim - t0; i++) {
        const t = t0 * r.entre(0.92, 1.08);
        const c = cor.clone().multiplyScalar(r.entre(0.86, 1.12));
        ultimo = novo({ x: xLombo(), y: yBase, z: z + t / 2, s, t, h: h0 * r.entre(0.985, 1.01), d: d0, inclina: 0, gira: 0, cor: c, col });
        z += t + 0.0012;
      }
    }
  };

  for (const s of [-1, 1]) {
    BAIAS.forEach(([z0, z1], b) => {
      corpoDaEstante(L, s, z0, z1);
      const passo = (z1 - z0) / 3;
      for (let c = 0; c < 3; c++) {
        const a = z0 + c * passo + 0.03, f = z0 + (c + 1) * passo - 0.03;
        enche(s, a, f, Y_CHAO, 0.28, 0.385);
        enche(s, a, f, Y_MEIO_TOPO, 0.205, 0.33);
      }
      // Um volume ou outro esquecido em cima do tampo.
      if (b % 2 === 0) {
        const zp = r.entre(z0 + 0.4, z1 - 0.7);
        let y = Y_TOPO;
        const n = 2 + Math.floor(r() * 3);
        for (let i = 0; i < n; i++) {
          const t = r.entre(0.03, 0.055);
          novo({ x: s * (X_FRENTE + 0.03), y: y + t / 2, z: zp, s, t, h: r.entre(0.26, 0.34), d: r.entre(0.18, 0.24), inclina: Math.PI / 2, gira: r.entre(-0.14, 0.14), cor: r.de(sacola), col: 7 });
          y += t;
        }
      }
    });
  }

  const geo = geometriaLivro();
  const colunaAttr = new THREE.InstancedBufferAttribute(new Float32Array(livros.length), 1);
  geo.setAttribute('aCol', colunaAttr);

  const atlas = atlasDeLombadas();
  const mat = criaMaterial(comuns, { tex: { a: atlas, b: texturaPlana() }, rough: 0.82, normalK: 0, cores: true });
  mat.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('varying vec3 vW;', 'attribute float aCol;\nvarying vec3 vW;')
      .replace('vUv=uv*uUvEsc;', `vUv=vec2((uv.x+aCol)/${COLUNAS}.,uv.y);`);
    s.fragmentShader = s.fragmentShader.replace(
      'vec3 alb=A.rgb*uCor*vCor;',
      `vec3 alb=A.r*uCor*vCor;
       alb=mix(alb,vCor*.3+${lin(PALETA.ferrugem, 0.28)},A.b);
       alb=mix(alb,${lin(PALETA.ouro, 0.5)},A.g*.85);`,
    );
  };

  const malha = new THREE.InstancedMesh(geo, mat, livros.length);
  malha.name = 'salao:livros';
  const m = new THREE.Matrix4(), pos = new THREE.Vector3(), e = new THREE.Vector3();
  const qx = new THREE.Quaternion(), qy = new THREE.Quaternion(), q = new THREE.Quaternion();
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
  livros.forEach((l, i) => {
    qx.setFromAxisAngle(X, l.inclina);
    qy.setFromAxisAngle(Y, (l.s > 0 ? 0 : Math.PI) + l.gira);
    q.multiplyQuaternions(qx, qy);
    m.compose(pos.set(l.x, l.y, l.z), q, e.set(l.d, l.h, l.t));
    malha.setMatrixAt(i, m);
    malha.setColorAt(i, l.cor);
    colunaAttr.setX(i, l.col);
  });
  return malha;
}
