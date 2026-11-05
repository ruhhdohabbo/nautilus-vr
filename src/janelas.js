// O QUE PASSA EM CADA JANELA. Para trocar um vídeo:
//   1. coloque o arquivo em videos/ e registre o canal em tools/prepara_videos.mjs, depois rode o script;
//   2. aponte o canal aqui embaixo.
// Cada canal diferente é um decodificador a mais no óculos: mantenha poucos (hoje 3).

export const CANAIS = {
  // impactos: instante (s) em que a lula bate no vidro, no ataque do boom. A camada cabecada se guia por ele.
  central: { src: 'videos/central.mp4', luz: 'videos/central.luz.json', som: true, impactos: [721 / 24] },
  animais1: { src: 'videos/animais1.mp4', luz: 'videos/animais1.luz.json' },
  animais2: { src: 'videos/animais2.mp4', luz: 'videos/animais2.luz.json' },
};

// A antepara da proa curva em volta de um eixo vertical em x = 0, z = ZC. R é o raio da parede (m).
// Com ZC - R = -8, o meio da parede recua 1 m e as pontas chegam a z = -5,95, ainda 1,5 m atrás do gradil.
export const PANORAMICA = { R: 11, ZC: 3 };

// Todo vidro é uma calota esférica que abaula para o mar, côncava para quem está dentro: é como um vidro de pressão trabalha.
// Cada olho sai reto pelo ar, dobra no vidro (ar para água, n = 1,33) e anda até uma esfera de vídeo do lado de fora.
// recorte: [u, v, largura, altura] da parte do vídeo usada, para duas janelas não mostrarem o mesmo quadro.

// Vitrine: calota esférica com o mesmo eixo da parede; o mar é concêntrico e o vídeo é lido a partir de c0, onde a visita começa.
//   a, b: elipse da abertura, desenhada na chapa (a em arco). vidro.meiaX: onde o túnel encontra o vidro nas pontas.
//   mar.prof: profundidade aparente da água (m). mar.alvo: para onde aponta o eixo do vídeo. mar.esc: quanto o vídeo cobre, em projeção estereográfica.
export const VITRINE = {
  canal: 'central', a: 4.4, b: 2.5, y: 3.0, recorte: [0, 0, 1, 1],
  vidro: { R: 11.6, C: [0, 3, 3], meiaX: 4.518 },
  mar: { prof: 6, c0: [0, 1.62, -1.6], alvo: [0, 2.8, -8.6], esc: 2.4 },
};

// Cada parede lateral é uma janela só para o mesmo mar: as quatro vigias do lado olham para a mesma esfera, em volta do casco,
// então o animal some atrás de uma chapa e reaparece na vigia seguinte.
//   q: metade da largura do vídeo em projeção estereográfica, tan(ângulo/2). Menor = imagem maior.
export const MARES_LATERAIS = {
  D: { canal: 'animais1', R: 12.4, q: 0.36 },
  E: { canal: 'animais2', R: 12.4, q: 0.36 },
};

//   cupula.R: raio da esfera do vidro. cupula.r: raio do corte da calota. cupula.fundo: quanto a borda do corte fica atrás do aro.
export const VIGIAS_PAREDE = [
  { lado: 'D', z: -3.5 }, { lado: 'D', z: -1.17 }, { lado: 'D', z: 1.17 }, { lado: 'D', z: 3.5 },
  { lado: 'E', z: -3.5 }, { lado: 'E', z: -1.17 }, { lado: 'E', z: 1.17 }, { lado: 'E', z: 3.5 },
].map((v) => ({ r: 0.52, cupula: { R: 1.8, r: 0.52, fundo: 0.24 }, ...v }));

// Vigias na antepara da proa, ao redor da vitrine (x, y na chapa, em metros). Fazem parte da mesma tela: a parede é uma chapa
// com furos para o mesmo mar, e a imagem da vitrine continua nelas, com a mesma escala e a mesma profundidade.
const GRANDE = { r: 0.52, cupula: { R: 1.8, r: 0.52, fundo: 0.24 } };
const PEQUENA = { r: 0.3, cupula: { R: 1.05, r: 0.3, fundo: 0.24 } };
export const VIGIAS_ANTEPARA = [
  { x: -5.3, y: 1.75, ...GRANDE },
  { x: 5.3, y: 1.75, ...GRANDE },
  { x: -4.05, y: 4.82, ...PEQUENA },
  { x: 4.05, y: 4.82, ...PEQUENA },
];
