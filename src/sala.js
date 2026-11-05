// O salão: abóbada de chapas, costelas, piso, tapete, gradil, porta e lâmpadas.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/BufferGeometryUtils.js';
import { SALA } from './config.js';
import { VITRINE, VIGIAS_PAREDE, VIGIAS_ANTEPARA } from './janelas.js';
import { caixaEntre, cilindroEntre, uvMundo, criaRebites } from './geo.js';
import { malhaParede, zParede, normalParede, Z_FUNDO } from './curva.js';

const { A, B, YC, FACETAS, Z_PROA, Z_POPA, BAIAS, Z_GRADIL } = SALA;
const T0 = Math.asin((0 - YC) / B);
const T1 = Math.PI - T0;
const TILE_FERRO = 3;
const TILE_MADEIRA = 2.4;

const thetaFaceta = (i) => T0 + ((T1 - T0) * i) / FACETAS;
const arco = (t) => new THREE.Vector2(A * Math.cos(t), YC + B * Math.sin(t));
const normalArco = (t) => new THREE.Vector2(-Math.cos(t) / A, -Math.sin(t) / B).normalize();
const FACETA_VIGIA = { D: 1, E: FACETAS - 2 };

// Comprimento de arco acumulado em cada emenda, para a textura não esticar.
const arcoAcum = [0];
for (let i = 0; i < FACETAS; i++) arcoAcum.push(arcoAcum[i] + arco(thetaFaceta(i)).distanceTo(arco(thetaFaceta(i + 1))));

// Onde cada vigia da parede fica: centro na chapa e eixos (X à direita de quem olha para fora, W para fora).
export function posicaoVigiaParede({ lado, z }) {
  const i = FACETA_VIGIA[lado];
  const a = arco(thetaFaceta(i)), b = arco(thetaFaceta(i + 1));
  const meio = a.clone().add(b).multiplyScalar(0.5);
  const cordaCima = b.clone().sub(a).normalize();
  if (cordaCima.y < 0) cordaCima.negate();
  const nDentro = normalArco(thetaFaceta(i)).add(normalArco(thetaFaceta(i + 1))).normalize();
  const W = new THREE.Vector3(-nDentro.x, -nDentro.y, 0);
  const Y = new THREE.Vector3(cordaCima.x, cordaCima.y, 0);
  return { C: new THREE.Vector3(meio.x, meio.y, z), X: new THREE.Vector3().crossVectors(W, Y).normalize(), Y, W };
}

// Uma chapa plana entre duas emendas, com furos redondos opcionais.
function chapa(i, z0, z1, furos, uvEmZ) {
  const ta = thetaFaceta(i), tb = thetaFaceta(i + 1);
  const pa = arco(ta), pb = arco(tb);
  const L = pa.distanceTo(pb);
  const na = normalArco(ta), nb = normalArco(tb);

  const forma = new THREE.Shape();
  forma.moveTo(0, 0); forma.lineTo(z1 - z0, 0); forma.lineTo(z1 - z0, L); forma.lineTo(0, L); forma.closePath();
  for (const f of furos) {
    const h = new THREE.Path();
    h.absarc(f.z - z0, L / 2, f.r, 0, Math.PI * 2, true);
    forma.holes.push(h);
  }
  const g = new THREE.ShapeGeometry(forma, 32);
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  const tile = uvEmZ ? TILE_FERRO : TILE_MADEIRA;
  for (let k = 0; k < pos.count; k++) {
    const u = pos.getX(k), v = pos.getY(k), s = v / L;
    pos.setXYZ(k, pa.x + (pb.x - pa.x) * s, pa.y + (pb.y - pa.y) * s, z0 + u);
    const nx = na.x + (nb.x - na.x) * s, ny = na.y + (nb.y - na.y) * s, l = Math.hypot(nx, ny);
    nor.setXYZ(k, nx / l, ny / l, 0);
    if (uvEmZ) uv.setXY(k, (z0 + u) / tile, (arcoAcum[i] + v) / tile);
    else uv.setXY(k, (arcoAcum[i] + v) / tile, (z0 + u) / (tile * 3));
  }
  return g;
}

// Faixa curva entre dois ângulos: costelas da abóbada. z pode ser uma função de x, e a costela anda colada na parede curva.
// nFrente: normal da face virada para a sala, também em função de x.
function costela(z, largura, altura, ti, tf, n = 40, nFrente = () => [0, 0, 1]) {
  const zDe = typeof z === 'function' ? z : () => z;
  const dentro = (p, t) => [p.x + normalArco(t).x * altura, p.y + normalArco(t).y * altura];
  const borda = (x, y, lado) => [x, y, zDe(x) + (lado * largura) / 2];
  const faces = [
    [(p, t) => borda(p.x, p.y, -1), (p, t) => borda(...dentro(p, t), -1), (t, p) => nFrente(p.x).map((v) => -v)],
    [(p, t) => borda(...dentro(p, t), -1), (p, t) => borda(...dentro(p, t), 1), (t) => [normalArco(t).x, normalArco(t).y, 0]],
    [(p, t) => borda(...dentro(p, t), 1), (p, t) => borda(p.x, p.y, 1), (t, p) => nFrente(p.x)],
  ];
  const pedacos = faces.map(([f0, f1, fn]) => {
    const pos = [], nor = [], uv = [], idx = [];
    for (let j = 0; j <= n; j++) {
      const t = ti + ((tf - ti) * j) / n;
      const p = arco(t);
      pos.push(...f0(p, t), ...f1(p, t));
      nor.push(...fn(t, p), ...fn(t, p));
      const zu = zDe(0);
      uv.push((zu + j * 0.13) / TILE_FERRO, (j * 0.45) / TILE_FERRO, (zu + altura + j * 0.13) / TILE_FERRO, (j * 0.45) / TILE_FERRO);
      if (j < n) { const a = j * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  });
  return mergeGeometries(pedacos);
}

export function criaSala(cena, M, comuns, q) {
  const ferro = [], madeira = [], escuro = [], latao = [];
  const rebites = [];
  const raioRebite = 0.017;

  // Paredes e teto: chapas ao longo do casco, como na arte do Nautilus. Vão até atrás da parede curva: quem corta é ela.
  for (let i = 0; i < FACETAS; i++) {
    const naMadeira = i === 0 || i === FACETAS - 1;
    const lado = i === FACETA_VIGIA.D ? 'D' : i === FACETA_VIGIA.E ? 'E' : null;
    if (lado) {
      for (let b = 0; b < BAIAS; b++) {
        const z0 = b ? Z_PROA + ((Z_POPA - Z_PROA) * b) / BAIAS : Z_FUNDO, z1 = Z_PROA + ((Z_POPA - Z_PROA) * (b + 1)) / BAIAS;
        const furos = VIGIAS_PAREDE.filter((v) => v.lado === lado && v.z > z0 && v.z < z1);
        ferro.push(chapa(i, z0, z1, furos, true));
      }
    } else if (naMadeira) madeira.push(chapa(i, Z_FUNDO, Z_POPA, [], false));
    else ferro.push(chapa(i, Z_FUNDO, Z_POPA, [], true));
  }

  // Emendas das chapas e rebites ao longo delas.
  for (let i = 1; i < FACETAS; i++) {
    const t = thetaFaceta(i), p = arco(t), n = normalArco(t);
    const fora = new THREE.Vector3(p.x + n.x * 0.012, p.y + n.y * 0.012, 0);
    const a = fora.clone().setZ(Z_FUNDO), b = fora.clone().setZ(Z_POPA);
    const cima = new THREE.Vector3(n.x, n.y, 0);
    (i === 1 || i === FACETAS - 1 ? latao : escuro).push(caixaEntre(a, b, i === 1 || i === FACETAS - 1 ? 0.07 : 0.05, 0.024, cima));
    if (i > 1 && i < FACETAS - 1) {
      const passo = 0.42 / q.rebites;
      for (let z = Z_PROA + 0.2 - Math.ceil((Z_PROA - Z_FUNDO) / passo) * passo; z < Z_POPA; z += passo) {
        if (z < zParede(p.x) + 0.02) continue; // atrás da parede ninguém vê.
        rebites.push({ p: new THREE.Vector3(p.x + n.x * 0.024, p.y + n.y * 0.024, z), n: new THREE.Vector3(n.x, n.y, 0), r: raioRebite });
      }
    }
  }

  // Costelas: a repetição em perspectiva leva o olho até a vitrine.
  // A primeira costela anda colada na parede curva e desenha a panorâmica no teto e nas paredes.
  for (let b = 0; b <= BAIAS; b++) {
    const z = Z_PROA + ((Z_POPA - Z_PROA) * b) / BAIAS;
    const zz = b === BAIAS ? z - 0.1 : z;
    const zDe = b === 0 ? (x) => zParede(x) + 0.11 : () => zz;
    escuro.push(b === 0 ? costela(zDe, 0.24, 0.17, T0, T1, 72, normalParede) : costela(zz, 0.24, 0.17, T0, T1));
    const passoT = (0.34 / q.rebites) / 5.6;
    for (let t = T0 + 0.33; t < T1 - 0.33; t += passoT) {
      const p = arco(t), n = normalArco(t), nv = new THREE.Vector3(n.x, n.y, 0);
      const pr = new THREE.Vector3(p.x + n.x * 0.17, p.y + n.y * 0.17, 0);
      rebites.push({ p: pr.clone().setZ(zDe(pr.x) - 0.085), n: nv, r: raioRebite });
      rebites.push({ p: pr.clone().setZ(zDe(pr.x) + 0.085), n: nv, r: raioRebite });
    }
  }

  // Viga central do teto.
  const topo = new THREE.Vector3(0, YC + B - 0.13, 0);
  escuro.push(caixaEntre(topo.clone().setZ(Z_FUNDO), topo.clone().setZ(Z_POPA), 0.5, 0.26));

  // Anteparas: proa curva, com os furos da vitrine e das vigias; popa reta e fechada.
  // O furo fica 3 cm maior que a janela (na escala do aro): a borda da chapa some atrás da face do aro.
  const contorno = new THREE.Shape();
  for (let j = 0; j <= 72; j++) {
    const p = arco(T0 + ((T1 - T0) * j) / 72);
    if (j === 0) contorno.moveTo(p.x, p.y); else contorno.lineTo(p.x, p.y);
  }
  contorno.closePath();
  ferro.push(malhaParede({
    tile: TILE_FERRO,
    furos: [
      { x: 0, y: VITRINE.y, a: VITRINE.a + 0.03, b: VITRINE.b + 0.03 },
      ...VIGIAS_ANTEPARA.map((v) => {
        const r = v.r + 0.03 * (v.r < 0.4 ? 0.3 : 0.42);
        return { x: v.x, y: v.y, a: r, b: r };
      }),
    ],
  }));

  const anteparaPopa = new THREE.ShapeGeometry(contorno, 8);
  anteparaPopa.rotateY(Math.PI);
  anteparaPopa.translate(0, 0, Z_POPA);
  ferro.push(uvMundo(anteparaPopa, TILE_FERRO));

  // Porta da popa: escotilha simples com volante, de lado para deixar o centro livre.
  const X_PORTA = -4.4;
  const placa = new THREE.BoxGeometry(1.7, 2.5, 0.08);
  placa.translate(X_PORTA, 1.25, Z_POPA - 0.04);
  escuro.push(uvMundo(placa));
  const aro = caixaEntre(new THREE.Vector3(X_PORTA - 0.92, 2.56, Z_POPA - 0.06), new THREE.Vector3(X_PORTA + 0.92, 2.56, Z_POPA - 0.06), 0.14, 0.12);
  escuro.push(aro);
  for (const x of [X_PORTA - 0.92, X_PORTA + 0.92]) escuro.push(caixaEntre(new THREE.Vector3(x, 0, Z_POPA - 0.06), new THREE.Vector3(x, 2.56, Z_POPA - 0.06), 0.14, 0.12, new THREE.Vector3(0, 0, 1)));
  const volante = new THREE.TorusGeometry(0.26, 0.022, 8, 28);
  volante.translate(X_PORTA, 1.3, Z_POPA - 0.2);
  latao.push(uvMundo(volante));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI;
    const d = new THREE.Vector3(Math.cos(a) * 0.26, Math.sin(a) * 0.26, 0);
    const c = new THREE.Vector3(X_PORTA, 1.3, Z_POPA - 0.2);
    latao.push(cilindroEntre(c.clone().add(d), c.clone().sub(d), 0.013, 6));
  }

  // Corrimão nas paredes.
  const yCorrimao = 1.06;
  const xParede = A * Math.sqrt(1 - ((yCorrimao - YC) / B) ** 2) - 0.09;
  for (const s of [-1, 1]) {
    latao.push(cilindroEntre(new THREE.Vector3(s * xParede, yCorrimao, Z_PROA), new THREE.Vector3(s * xParede, yCorrimao, Z_POPA), 0.024, 10));
    for (let b = 0; b < BAIAS; b++) {
      const z = Z_PROA + 1.17 + (b * (Z_POPA - Z_PROA)) / BAIAS;
      latao.push(cilindroEntre(new THREE.Vector3(s * xParede, yCorrimao, z), new THREE.Vector3(s * (xParede + 0.1), yCorrimao, z), 0.012, 6));
    }
  }

  // Gradil diante da vitrine: dá escala humana e segura o visitante longe da borda do vídeo.
  const meioGradil = A * Math.sqrt(1 - ((1.05 - YC) / B) ** 2);
  const a0 = new THREE.Vector3(-meioGradil, 1.05, Z_GRADIL), a1 = new THREE.Vector3(meioGradil, 1.05, Z_GRADIL);
  latao.push(cilindroEntre(a0, a1, 0.03, 12));
  latao.push(cilindroEntre(a0.clone().setY(0.6), a1.clone().setY(0.6), 0.014, 8));
  for (const x of [-5.1, -3.06, -1.02, 1.02, 3.06, 5.1]) {
    latao.push(cilindroEntre(new THREE.Vector3(x, 0, Z_GRADIL), new THREE.Vector3(x, 1.05, Z_GRADIL), 0.03, 10));
    const base = new THREE.CylinderGeometry(0.06, 0.085, 0.05, 12);
    base.translate(x, 0.025, Z_GRADIL);
    latao.push(uvMundo(base));
    const topoP = new THREE.SphereGeometry(0.042, 10, 6);
    topoP.translate(x, 1.05, Z_GRADIL);
    latao.push(uvMundo(topoP));
  }

  // Piso de tábuas correndo em direção à vitrine.
  const xPiso = A * Math.sqrt(1 - (YC / B) ** 2);
  const piso = new THREE.PlaneGeometry(xPiso * 2 + 0.2, Z_POPA - Z_FUNDO, 1, 1);
  piso.rotateX(-Math.PI / 2);
  piso.translate(0, 0, (Z_POPA + Z_FUNDO) / 2);
  const uvP = piso.attributes.uv, posP = piso.attributes.position;
  for (let i = 0; i < posP.count; i++) uvP.setXY(i, posP.getX(i) / TILE_MADEIRA, posP.getZ(i) / TILE_MADEIRA);

  // Tapete.
  const tapete = new THREE.PlaneGeometry(7, 3.6);
  tapete.rotateX(-Math.PI / 2);
  tapete.translate(0, 0.012, 0.6);

  // Lâmpadas nas costelas. O braço é fixo; globo e copa vão numa malha instanciada para poderem balançar.
  const lampadas = [];
  const tLamp = 0.62;
  for (const z of [-2.333, 4.667]) {
    for (const s of [-1, 1]) {
      const p = arco(tLamp), n = normalArco(tLamp);
      const parede = new THREE.Vector3(s * p.x, p.y, z);
      const c = new THREE.Vector3(s * (p.x + n.x * 0.5), p.y + n.y * 0.5, z);
      latao.push(cilindroEntre(parede, c, 0.018, 8));
      lampadas.push(c);
    }
  }
  comuns.uLampPos.value = lampadas;

  const adiciona = (geos, mat, nome) => {
    const m = new THREE.Mesh(geos.length > 1 ? mergeGeometries(geos) : geos[0], mat);
    m.name = nome;
    m.frustumCulled = false;
    cena.add(m);
    return m;
  };

  adiciona(ferro, M.ferro, 'chapas');
  adiciona(madeira, M.lambri, 'lambri');
  adiciona(escuro, M.costela, 'costelas');
  adiciona([piso], M.piso, 'piso');
  adiciona([tapete], M.tapete, 'tapete');

  // A copa é pintada por vértice, sem luz própria, para caber no mesmo desenho do globo: clara perto dele, escura em cima.
  const pinta = (g, corDe) => {
    const p = g.attributes.position, c = new Float32Array(p.count * 3), cor = new THREE.Color();
    for (let i = 0; i < p.count; i++) corDe(p.getY(i), cor).toArray(c, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return g;
  };
  const claro = new THREE.Color(0x8a7648), escura = new THREE.Color(0x2b2414), corGlobo = new THREE.Color(0xf1edbb);
  const copa = new THREE.CylinderGeometry(0.11, 0.05, 0.1, 12);
  copa.translate(0, 0.16, 0);
  const cabeca = mergeGeometries([
    pinta(new THREE.SphereGeometry(0.125, 16, 12), (y, c) => c.copy(corGlobo)),
    pinta(copa, (y, c) => c.copy(claro).lerp(escura, (y - 0.11) / 0.1)),
  ]);
  const globos = new THREE.InstancedMesh(cabeca, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), lampadas.length);
  globos.name = 'globos';
  globos.frustumCulled = false;
  globos.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const mGlobo = new THREE.Matrix4();
  lampadas.forEach((c, i) => globos.setMatrixAt(i, mGlobo.makeTranslation(c.x, c.y, c.z)));
  cena.add(globos);

  // Halo de cada globo, sempre de frente para o olho.
  const halo = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uCor: { value: new THREE.Color(0xD2DBC0) } },
    vertexShader: `varying vec2 vP; void main(){ vP=position.xy*2.; vec4 c=viewMatrix*modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.); c.xy+=position.xy*1.5; gl_Position=projectionMatrix*c; }`,
    fragmentShader: `uniform vec3 uCor; varying vec2 vP; void main(){ float d=length(vP); float a=pow(max(1.-d,0.),3.); gl_FragColor=vec4(uCor,a*.34); }`,
  }), lampadas.length);
  const mHalo = new THREE.Matrix4();
  lampadas.forEach((c, i) => halo.setMatrixAt(i, mHalo.makeTranslation(c.x, c.y, c.z)));
  halo.frustumCulled = false;
  halo.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cena.add(halo);

  return { latao, rebites, lampadas, luminarias: { globos, halo }, finaliza() { cena.add(criaRebites(rebites, M.rebite)); } };
}
