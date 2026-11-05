// Fecho da popa, espelhando a porta: a carta da viagem do Nautilus sobre um gaveteiro de cartas.
// A imagem é desenhada em canvas ao abrir; as partituras do console saem do mesmo atlas.
import * as THREE from 'three';
import { PALETA } from '../config.js';
import { cilindroEntre, uvMundo } from '../geo.js';
import { caixa, pinta, sorteador } from './salao_comum.js';

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const LARG = 1536, ALT = 768, LARG_MAPA = 1152;

const CONTINENTES = [
  [[-168, 66], [-162, 70], [-156, 71], [-140, 70], [-128, 70], [-115, 68], [-95, 68], [-94, 72], [-82, 73], [-80, 68], [-86, 66], [-94, 61], [-92, 57], [-82, 55], [-80, 51], [-78, 52], [-78, 58], [-76, 62], [-66, 60], [-62, 57], [-56, 52], [-60, 50], [-66, 50], [-60, 46], [-65, 44], [-70, 43], [-74, 40], [-76, 35], [-81, 31], [-80, 26], [-81, 25], [-83, 29], [-90, 29], [-97, 26], [-98, 20], [-95, 18], [-91, 18], [-90, 21], [-87, 21], [-88, 16], [-83, 15], [-83, 10], [-79, 9], [-77, 8], [-80, 7], [-85, 10], [-91, 14], [-96, 16], [-105, 20], [-110, 24], [-112, 30], [-115, 30], [-120, 34], [-124, 40], [-124, 48], [-130, 54], [-138, 59], [-148, 60], [-155, 58], [-163, 55], [-158, 59], [-165, 62]],
  [[-77, 8], [-72, 12], [-66, 11], [-60, 9], [-52, 5], [-50, 0], [-44, -2], [-37, -5], [-35, -8], [-39, -14], [-39, -19], [-42, -23], [-48, -26], [-49, -29], [-53, -34], [-58, -35], [-57, -38], [-62, -39], [-65, -42], [-66, -47], [-69, -51], [-68, -55], [-72, -53], [-75, -48], [-73, -40], [-71, -30], [-70, -18], [-76, -14], [-81, -6], [-80, -2], [-79, 2]],
  [[-6, 35], [3, 37], [10, 37], [11, 33], [20, 31], [25, 32], [32, 31], [34, 28], [37, 21], [39, 15], [43, 12], [51, 12], [48, 5], [41, -2], [39, -8], [40, -15], [35, -20], [35, -24], [32, -28], [27, -34], [20, -35], [18, -32], [14, -22], [12, -16], [13, -8], [9, -1], [9, 4], [4, 6], [-4, 5], [-8, 4], [-13, 8], [-17, 14], [-17, 21], [-13, 27], [-10, 31]],
  [[-9, 37], [-9, 43], [-2, 43], [-1, 46], [-5, 48], [2, 51], [8, 54], [8, 57], [11, 56], [12, 54], [20, 55], [22, 59], [30, 60], [22, 60], [22, 65], [18, 62], [17, 58], [12, 56], [7, 58], [5, 62], [14, 68], [24, 71], [40, 67], [44, 66], [55, 69], [68, 69], [72, 73], [85, 74], [105, 77], [115, 74], [130, 72], [150, 71], [170, 70], [180, 68], [178, 64], [170, 60], [163, 58], [156, 52], [156, 58], [160, 62], [150, 59], [140, 55], [140, 50], [132, 43], [128, 38], [127, 35], [125, 38], [121, 40], [118, 38], [122, 36], [120, 31], [120, 26], [114, 22], [108, 20], [108, 15], [105, 10], [102, 13], [100, 8], [104, 2], [101, 3], [98, 9], [97, 16], [92, 22], [87, 21], [80, 15], [80, 10], [77, 8], [73, 18], [72, 21], [67, 24], [57, 25], [56, 27], [50, 30], [48, 30], [51, 25], [56, 24], [59, 22], [55, 17], [45, 13], [43, 13], [39, 21], [35, 28], [35, 32], [36, 36], [30, 36], [27, 37], [26, 40], [23, 38], [22, 37], [20, 40], [14, 45], [18, 40], [16, 38], [12, 42], [8, 44], [3, 43], [0, 39], [-2, 37], [-5, 36]],
  [[114, -22], [122, -18], [130, -12], [136, -12], [136, -16], [141, -17], [142, -11], [146, -19], [153, -26], [150, -37], [144, -38], [138, -34], [132, -32], [124, -33], [115, -34]],
  [[-73, 78], [-60, 82], [-30, 83], [-18, 76], [-22, 70], [-40, 65], [-44, 60], [-52, 65], [-55, 70]],
  [[49, -12], [50, -16], [47, -25], [44, -24], [44, -17]],
  [[-5, 50], [1, 51], [0, 54], [-3, 58], [-6, 57], [-3, 54], [-5, 52]],
  [[-10, 52], [-6, 52], [-6, 55], [-9, 54]],
  [[-24, 65], [-14, 66], [-15, 64], [-22, 63.5]],
  [[130, 32], [135, 34], [140, 35], [141, 40], [142, 45], [140, 42], [137, 37], [132, 35]],
  [[131, -1], [138, -2], [147, -6], [150, -10], [143, -9], [138, -8], [133, -4]],
  [[109, 1], [116, 7], [119, 3], [116, -4], [110, -3]],
  [[95, 5], [104, -3], [106, -6], [101, -3]],
  [[106, -6], [114, -7], [114, -8.5], [106, -7.5]],
  [[120, 18], [122, 18], [125, 8], [122, 7]],
  [[173, -35], [178, -38], [175, -41], [172, -44], [167, -46], [172, -41]],
  [[-85, 22], [-75, 20], [-78, 22.5]],
  [[80, 9], [82, 7], [80.5, 6]],
];

// A rota do livro: do Japão ao Maelstrom, passando por Vanikoro, Ceilão, Suez, Atlântida e o Polo Sul.
const ROTA = [[152, 30], [165, 33], [180, 33], [-168, 32.5], [-150, 12], [-136, -18], [-150, -17], [-180, -14], [167, -12], [150, -11], [142.5, -10], [122, -11], [97, -12], [80, 6], [66, 14], [50, 13], [40, 20], [33, 28], [32.5, 31.5], [25, 36], [11, 38], [-5.6, 36], [-9, 42], [-25, 32], [-42, 28], [-33, -8], [-38, -32], [-52, -50], [-60, -66], [-48, -72], [-60, -64], [-58, -50], [-38, -22], [-34, -6], [-55, 12], [-74, 24], [-66, 36], [-48, 45], [-12, 50], [-8, 60], [12, 68]];

const mapaX = (lon) => ((lon + 180) / 360) * LARG_MAPA;
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const Y_NORTE = mercY(78), Y_SUL = mercY(-74);
const mapaY = (lat) => ((Y_NORTE - mercY(lat)) / (Y_NORTE - Y_SUL)) * ALT;

function rosa(ctx, x, y, R, cor, escuro) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = 1;
  ctx.strokeStyle = cor;
  ctx.beginPath(); ctx.arc(0, 0, R * 0.82, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 16; i++) {
    ctx.rotate(Math.PI / 8);
    const longo = i % 4 === 3, medio = i % 2 === 1;
    const c = longo ? R : medio ? R * 0.72 : R * 0.5;
    const l = longo ? R * 0.13 : R * 0.08;
    ctx.fillStyle = cor;
    ctx.beginPath(); ctx.moveTo(0, -c); ctx.lineTo(l, -l); ctx.lineTo(0, 0); ctx.fill();
    ctx.fillStyle = escuro;
    ctx.beginPath(); ctx.moveTo(0, -c); ctx.lineTo(-l, -l); ctx.lineTo(0, 0); ctx.fill();
  }
  ctx.restore();
}

// Dois passes de Chaikin e um tremor de 1,5 px. Chaikin só encurta os cantos: o desenho do continente fica o mesmo.
function costaAMao(c, r) {
  let p = c.map(([lon, lat]) => [mapaX(lon), mapaY(lat)]);
  for (let passe = 0; passe < 2; passe++) {
    p = p.flatMap(([x, y], i) => {
      const [x1, y1] = p[(i + 1) % p.length];
      return [[x * 0.75 + x1 * 0.25, y * 0.75 + y1 * 0.25], [x * 0.25 + x1 * 0.75, y * 0.25 + y1 * 0.75]];
    });
  }
  return p.map(([x, y]) => [x + r.entre(-1.5, 1.5), y + r.entre(-1.5, 1.5)]);
}

function desenhaMapa(ctx) {
  const r = sorteador(1870);
  const mar = ctx.createRadialGradient(LARG_MAPA * 0.5, ALT * 0.48, 80, LARG_MAPA * 0.5, ALT * 0.5, LARG_MAPA * 0.72);
  mar.addColorStop(0, '#537f82');
  mar.addColorStop(0.55, hex(PALETA.marinho));
  mar.addColorStop(1, '#1b2c3c');
  ctx.fillStyle = mar;
  ctx.fillRect(0, 0, LARG_MAPA, ALT);

  // Manchas de pintura.
  for (let i = 0; i < 90; i++) {
    const x = r() * LARG_MAPA, y = r() * ALT, R = r.entre(30, 150);
    const g = ctx.createRadialGradient(x, y, 0, x, y, R);
    const tom = r() < 0.5 ? '210,219,192' : '13,23,38';
    g.addColorStop(0, `rgba(${tom},${r.entre(0.012, 0.05)})`);
    g.addColorStop(1, `rgba(${tom},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - R, y - R, R * 2, R * 2);
  }

  // Graticulado.
  ctx.strokeStyle = 'rgba(210,219,192,.2)';
  ctx.lineWidth = 1;
  for (let lon = -180; lon <= 180; lon += 20) {
    ctx.beginPath(); ctx.moveTo(mapaX(lon), 0); ctx.lineTo(mapaX(lon), ALT); ctx.stroke();
  }
  for (let lat = -60; lat <= 60; lat += 20) {
    ctx.beginPath(); ctx.moveTo(0, mapaY(lat)); ctx.lineTo(LARG_MAPA, mapaY(lat)); ctx.stroke();
  }

  // Rumos das rosas dos ventos, como nas cartas antigas.
  ctx.strokeStyle = 'rgba(207,200,122,.13)';
  for (const [lon, lat] of [[-120, -30], [-30, 8], [70, -32]]) {
    const x = mapaX(lon), y = mapaY(lat);
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 1400, y + Math.sin(a) * 1400); ctx.stroke();
    }
  }

  // Continentes em caqui, com sombra de costa aerografada. A costa é arredondada e treme na mão:
  // ligada direto, ponto a ponto, ela teria cara de vetor moderno.
  const rCosta = sorteador(1871);
  const terras = new Path2D();
  const costas = CONTINENTES.map((c) => {
    const p = costaAMao(c, rCosta);
    const trecho = new Path2D();
    p.forEach(([x, y], i) => (i ? trecho.lineTo(x, y) : trecho.moveTo(x, y)));
    trecho.closePath();
    terras.addPath(trecho);
    return trecho;
  });
  ctx.lineJoin = 'round';
  ctx.lineWidth = 11;
  ctx.strokeStyle = 'rgba(190,207,161,.13)';
  for (const c of costas) ctx.stroke(c);
  ctx.fillStyle = hex(PALETA.caqui);
  ctx.fill(terras);
  // Manchas de tinta só na terra.
  ctx.save();
  ctx.clip(terras);
  for (let i = 0; i < 110; i++) {
    const x = rCosta() * LARG_MAPA, y = rCosta() * ALT, R = rCosta.entre(26, 110);
    const tom = hex(rCosta() < 0.55 ? PALETA.ferrugem : PALETA.vidroMar);
    const g = ctx.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, tom);
    g.addColorStop(1, `${tom}00`);
    ctx.globalAlpha = rCosta.entre(0.03, 0.08);
    ctx.fillStyle = g;
    ctx.fillRect(x - R, y - R, R * 2, R * 2);
  }
  ctx.restore();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = hex(PALETA.olivaEscuro);
  for (const c of costas) ctx.stroke(c);
  // Antártida, na borda.
  ctx.fillStyle = hex(PALETA.caqui);
  ctx.beginPath();
  ctx.moveTo(0, ALT);
  for (let x = 0; x <= LARG_MAPA; x += 24) ctx.lineTo(x, ALT - 14 - 9 * Math.sin(x * 0.013) - 5 * Math.sin(x * 0.041));
  ctx.lineTo(LARG_MAPA, ALT);
  ctx.fill();

  // A rota: tracejada em tijolo, quebrando quando atravessa a linha de data.
  ctx.strokeStyle = hex(PALETA.tijolo);
  ctx.lineWidth = 3.2;
  ctx.setLineDash([11, 6]);
  ctx.beginPath();
  ROTA.forEach(([lon, lat], i) => {
    const salto = i && Math.abs(lon - ROTA[i - 1][0]) > 180;
    if (!i || salto) ctx.moveTo(mapaX(lon), mapaY(lat));
    else ctx.lineTo(mapaX(lon), mapaY(lat));
  });
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = hex(PALETA.nevoa);
  for (const [lon, lat] of [ROTA[0], ROTA[8], ROTA[13], ROTA[18], ROTA[29], ROTA[35], ROTA[40]]) {
    ctx.beginPath(); ctx.arc(mapaX(lon), mapaY(lat), 4.2, 0, Math.PI * 2); ctx.fill();
  }

  rosa(ctx, mapaX(-120), mapaY(-30), 68, hex(PALETA.ouro), hex(PALETA.ferrugem));
  rosa(ctx, mapaX(70), mapaY(-32), 42, hex(PALETA.ouro), hex(PALETA.ferrugem));

  // Cartela do título.
  const wc = 400, hc = 100;
  ctx.fillStyle = 'rgba(13,23,38,.82)';
  ctx.fillRect(14, 14, wc, hc);
  ctx.strokeStyle = hex(PALETA.ouro);
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, wc - 12, hc - 12);
  ctx.fillStyle = hex(PALETA.ouro);
  ctx.textAlign = 'center';
  ctx.font = 'italic 34px Georgia, "Times New Roman", serif';
  ctx.fillText('Viagem do Nautilus', 14 + wc / 2, 64);
  ctx.font = '18px Georgia, "Times New Roman", serif';
  ctx.fillText('Carta de Mercator  ·  1867 – 1868', 14 + wc / 2, 94);
  ctx.textAlign = 'left';

  // Envelhecimento nas bordas.
  const v = ctx.createRadialGradient(LARG_MAPA / 2, ALT / 2, ALT * 0.45, LARG_MAPA / 2, ALT / 2, LARG_MAPA * 0.66);
  v.addColorStop(0, 'rgba(13,23,38,0)');
  v.addColorStop(1, 'rgba(13,23,38,.62)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, LARG_MAPA, ALT);

  // Moldura de graus.
  ctx.strokeStyle = hex(PALETA.nevoa);
  ctx.lineWidth = 2;
  ctx.strokeRect(5, 5, LARG_MAPA - 10, ALT - 10);
}

function desenhaPartitura(ctx, x0, y0, w, h, semente) {
  const r = sorteador(semente);
  ctx.fillStyle = '#c9c3a6';
  ctx.fillRect(x0, y0, w, h);
  const g = ctx.createLinearGradient(x0, y0, x0 + w, y0 + h);
  g.addColorStop(0, 'rgba(107,72,62,.08)');
  g.addColorStop(1, 'rgba(107,72,62,.3)');
  ctx.fillStyle = g;
  ctx.fillRect(x0, y0, w, h);
  const tinta = '#2c2a22';
  ctx.strokeStyle = tinta;
  ctx.fillStyle = tinta;
  const m = w * 0.08;
  for (let p = 0; p < 7; p++) {
    const yb = y0 + h * 0.13 + (p * h * 0.8) / 7;
    ctx.lineWidth = 1;
    for (let l = 0; l < 5; l++) {
      ctx.beginPath(); ctx.moveTo(x0 + m, yb + l * 5); ctx.lineTo(x0 + w - m, yb + l * 5); ctx.stroke();
    }
    let x = x0 + m + 16;
    while (x < x0 + w - m - 10) {
      const y = yb + Math.floor(r() * 9) * 2.5;
      ctx.beginPath(); ctx.ellipse(x, y, 3.4, 2.5, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x + 3, y); ctx.lineTo(x + 3, y - 15); ctx.stroke();
      if (r() < 0.25) { ctx.beginPath(); ctx.moveTo(x + 3, y - 15); ctx.lineTo(x + 16, y - 15); ctx.stroke(); }
      x += r.entre(9, 22);
    }
  }
}

export function montaQuadro(L, obstaculos) {
  const canvas = document.createElement('canvas');
  canvas.width = LARG;
  canvas.height = ALT;
  const ctx = canvas.getContext('2d');
  desenhaMapa(ctx);
  desenhaPartitura(ctx, LARG_MAPA, 0, LARG - LARG_MAPA, ALT / 2, 3);
  desenhaPartitura(ctx, LARG_MAPA, ALT / 2, LARG - LARG_MAPA, ALT / 2, 8);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;

  // Medidas da carta no mundo.
  const Xc = 4.44, W = 1.86, H = W * (ALT / LARG_MAPA), yc = 1.82, Z = 6.93;
  const mapa = new THREE.PlaneGeometry(W, H);
  const uv = mapa.attributes.uv;
  const kU = LARG_MAPA / LARG;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * kU);
  mapa.rotateY(Math.PI);
  mapa.translate(Xc, yc, Z);
  L.papel.push(mapa);

  // Moldura escura com filete de latão.
  const x0 = Xc - W / 2, x1 = Xc + W / 2, y0 = yc - H / 2, y1 = yc + H / 2;
  const f = 0.1, zf = Z - 0.05;
  L.madeira.push(caixa(x0 - f, x1 + f, y0 - f, y0, zf, Z + 0.02, 'cbedf', 4));
  L.madeira.push(caixa(x0 - f, x1 + f, y1, y1 + f, zf, Z + 0.02, 'cbedf', 4));
  L.madeira.push(caixa(x0 - f, x0, y0, y1, zf, Z + 0.02, 'edf', 4));
  L.madeira.push(caixa(x1, x1 + f, y0, y1, zf, Z + 0.02, 'edf', 4));
  const b = 0.014, zb = zf - 0.004;
  L.latao.push(caixa(x0 - b, x1 + b, y0 - b, y0, zb, zf + 0.04, 'cf', 0.6));
  L.latao.push(caixa(x0 - b, x1 + b, y1, y1 + b, zb, zf + 0.04, 'bf', 0.6));
  L.latao.push(caixa(x0 - b, x0, y0, y1, zb, zf + 0.04, 'df', 0.6));
  L.latao.push(caixa(x1, x1 + b, y0, y1, zb, zf + 0.04, 'ef', 0.6));

  // Gaveteiro de cartas.
  const gx0 = 3.5, gx1 = 5.38, gz0 = 6.52, gz1 = 7, gy = 0.88;
  L.madeira.push(caixa(gx0, gx1, 0, 0.09, gz0 + 0.02, gz1, 'cfed', 4));
  L.madeira.push(pinta(caixa(gx0 + 0.01, gx1 - 0.01, 0.09, gy - 0.04, gz0 + 0.03, gz1, 'fed', 4), 0xffffff, 0.45));
  L.madeira.push(caixa(gx0 - 0.02, gx1 + 0.02, gy - 0.04, gy, gz0, gz1, 'cbfed', 4));
  L.latao.push(caixa(gx0 - 0.022, gx1 + 0.022, gy - 0.03, gy - 0.02, gz0 - 0.002, gz1, 'fed', 0.6));
  const linhas = 4, alto = (gy - 0.04 - 0.1) / linhas;
  for (let c = 0; c < 2; c++) {
    const xa = gx0 + 0.02 + c * 0.93, xb = xa + 0.9;
    for (let l = 0; l < linhas; l++) {
      const ya = 0.1 + l * alto + 0.006, yb = ya + alto - 0.012;
      L.madeira.push(caixa(xa, xb, ya, yb, gz0 + 0.012, gz0 + 0.03, 'cbfed', 4));
      const xm = (xa + xb) / 2, ym = (ya + yb) / 2, zm = gz0 + 0.012;
      L.latao.push(cilindroEntre(new THREE.Vector3(xm - 0.08, ym, zm - 0.024), new THREE.Vector3(xm + 0.08, ym, zm - 0.024), 0.0065, 6));
      for (const s of [-1, 1]) L.latao.push(cilindroEntre(new THREE.Vector3(xm + s * 0.08, ym, zm - 0.024), new THREE.Vector3(xm + s * 0.08, ym, zm), 0.005, 5));
    }
  }

  // Cartas enroladas em cima do móvel.
  const papel = new THREE.Color(PALETA.caqui).multiplyScalar(0.92);
  const r = sorteador(4);
  for (const [x, z, comp, ang] of [[3.98, 6.78, 0.82, 0.08], [4.01, 6.68, 0.7, -0.04], [3.99, 6.72, 0.76, 0.03]]) {
    const raio = r.entre(0.024, 0.034);
    const y = gy + raio + (x === 3.99 ? 0.05 : 0);
    const dx = (Math.cos(ang) * comp) / 2, dz = (Math.sin(ang) * comp) / 2;
    L.pecas.push(pinta(cilindroEntre(new THREE.Vector3(x - dx, y, z - dz), new THREE.Vector3(x + dx, y, z + dz), raio, 8), papel, r.entre(0.85, 1.05)));
    for (const s of [-1, 1]) {
      const tampa = new THREE.CircleGeometry(raio, 8);
      tampa.rotateY((s * Math.PI) / 2 - ang);
      tampa.translate(x + s * dx, y, z + s * dz);
      L.pecas.push(pinta(uvMundo(tampa, 0.3), new THREE.Color(PALETA.ferrugem), 0.6));
    }
  }

  // Globo de mesa sobre o móvel, com o meridiano de latão.
  const gxc = 4.92, gyc = gy + 0.3, gzc = 6.75, gr = 0.2;
  // A esfera usa a própria carta do atlas.
  const globo = new THREE.SphereGeometry(gr, 20, 12);
  const uvg = globo.attributes.uv;
  for (let i = 0; i < uvg.count; i++) uvg.setX(i, uvg.getX(i) * kU);
  globo.rotateY(2.6);
  globo.rotateZ(0.4);
  globo.translate(gxc, gyc, gzc);
  L.papel.push(globo);
  const meridiano = new THREE.TorusGeometry(gr + 0.022, 0.007, 5, 28);
  meridiano.rotateY(0.5);
  meridiano.translate(gxc, gyc, gzc);
  L.latao.push(uvMundo(meridiano, 0.6));
  const pe = new THREE.CylinderGeometry(0.02, 0.09, 0.09, 12, 1, true);
  pe.translate(gxc, gy + 0.045, gzc);
  L.latao.push(uvMundo(pe, 0.6));

  obstaculos.push({ x0: gx0 - 0.02, x1: gx1 + 0.02, z0: gz0, z1: gz1 });
  return { tex, recortes: [[kU, 0.5, 1 - kU, 0.5], [kU, 0, 1 - kU, 0.5]] };
}
