// Ajudantes de geometria.
import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _cima = new THREE.Vector3(0, 1, 0);

// Sorteio com semente: a arrumação da sala e os sons são os mesmos a cada abertura.
export function sorteador(semente) {
  let s = semente >>> 0;
  const r = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.entre = (a, b) => a + (b - a) * r();
  r.de = (lista) => lista[Math.floor(r() * lista.length)];
  return r;
}

// UV em metros pelo eixo dominante da normal: textura com a mesma escala em qualquer peça.
export function uvMundo(g, tile = 3) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ax >= ay && ax >= az) uv.setXY(i, p.getZ(i) / tile, p.getY(i) / tile);
    else if (ay >= az) uv.setXY(i, p.getX(i) / tile, p.getZ(i) / tile);
    else uv.setXY(i, p.getX(i) / tile, p.getY(i) / tile);
  }
  return g;
}

// Caixa entre dois pontos.
// seg: divisões no comprimento, para a caixa poder ser enrolada na antepara sem virar uma corda reta.
export function caixaEntre(a, b, largura, altura, cima = _cima, seg = 1) {
  const comp = a.distanceTo(b);
  const g = new THREE.BoxGeometry(largura, altura, comp, 1, 1, seg);
  _m.lookAt(b, a, cima);
  _m.setPosition(a.clone().add(b).multiplyScalar(0.5));
  return uvMundo(g.applyMatrix4(_m));
}

export function cilindroEntre(a, b, raio, lados = 10) {
  const comp = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(raio, raio, comp, lados, 1, true);
  _q.setFromUnitVectors(_cima, b.clone().sub(a).normalize());
  _m.compose(a.clone().add(b).multiplyScalar(0.5), _q, new THREE.Vector3(1, 1, 1));
  return uvMundo(g.applyMatrix4(_m));
}

// Varre um perfil ao redor de uma elipse no plano da janela. Perfil: lista de [fora, fundo] em metros.
// Linhas repetidas no perfil viram quina viva (o quad degenerado não contribui para a normal).
export function varreElipse(C, X, Y, W, a, b, perfil, passos = 96) {
  const pos = [], idx = [], uv = [];
  for (let j = 0; j <= passos; j++) {
    const t = (j / passos) * Math.PI * 2;
    const c = Math.cos(t), s = Math.sin(t);
    const nl = Math.hypot(c / a, s / b);
    const nx = c / a / nl, ny = s / b / nl;
    for (const [fora, fundo] of perfil) {
      const x = a * c + fora * nx, y = b * s + fora * ny;
      pos.push(
        C.x + X.x * x + Y.x * y + W.x * fundo,
        C.y + X.y * x + Y.y * y + W.y * fundo,
        C.z + X.z * x + Y.z * y + W.z * fundo,
      );
      uv.push(0, 0);
    }
  }
  const L = perfil.length;
  for (let j = 0; j < passos; j++) {
    for (let r = 0; r < L - 1; r++) {
      // Linha repetida no perfil: o quad teria área zero, não vira triângulo.
      if (perfil[r][0] === perfil[r + 1][0] && perfil[r][1] === perfil[r + 1][1]) continue;
      const A = j * L + r, B = A + 1, Cc = (j + 1) * L + r, D = Cc + 1;
      idx.push(A, B, Cc, B, D, Cc);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // A costura em t = 0 tem vértices duplicados: copia a normal para não marcar uma linha.
  const n = g.attributes.normal;
  for (let r = 0; r < L; r++) {
    const fim = passos * L + r;
    const x = n.getX(r) + n.getX(fim), y = n.getY(r) + n.getY(fim), z = n.getZ(r) + n.getZ(fim);
    const l = Math.hypot(x, y, z) || 1;
    n.setXYZ(r, x / l, y / l, z / l);
    n.setXYZ(fim, x / l, y / l, z / l);
  }
  return uvMundo(g);
}

// Faixa a partir de seções prontas: secoes[j][r] é um Vector3. Pontos repetidos na seção marcam quina viva, sem triângulo a mais.
// fechada: a última seção coincide com a primeira, e a normal da costura é copiada para não marcar uma linha.
export function faixaDeSecoes(secoes, fechada = false) {
  const L = secoes[0].length, pos = [], uv = [], idx = [];
  for (const s of secoes) for (const p of s) { pos.push(p.x, p.y, p.z); uv.push(0, 0); }
  for (let j = 0; j < secoes.length - 1; j++) {
    for (let r = 0; r < L - 1; r++) {
      if (secoes[j][r].equals(secoes[j][r + 1]) && secoes[j + 1][r].equals(secoes[j + 1][r + 1])) continue;
      const A = j * L + r, B = A + 1, Cc = (j + 1) * L + r, D = Cc + 1;
      idx.push(A, B, Cc, B, D, Cc);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (fechada) {
    const n = g.attributes.normal, fim = (secoes.length - 1) * L;
    for (let r = 0; r < L; r++) {
      const x = n.getX(r) + n.getX(fim + r), y = n.getY(r) + n.getY(fim + r), z = n.getZ(r) + n.getZ(fim + r);
      const l = Math.hypot(x, y, z) || 1;
      n.setXYZ(r, x / l, y / l, z / l);
      n.setXYZ(fim + r, x / l, y / l, z / l);
    }
  }
  return uvMundo(g);
}

// Lista de rebites e parafusos -> uma malha instanciada só.
export function criaRebites(lista, material) {
  const domo = new THREE.SphereGeometry(1, 6, 2, 0, Math.PI * 2, 0, Math.PI / 2);
  const malha = new THREE.InstancedMesh(domo, material, lista.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Vector3();
  lista.forEach(({ p, n, r }, i) => {
    q.setFromUnitVectors(_cima, n);
    m.compose(p, q, e.set(r, r * 0.75, r));
    malha.setMatrixAt(i, m);
  });
  malha.frustumCulled = false;
  return malha;
}
