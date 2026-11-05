// Medidas do salão (em metros) e presets de qualidade.
export const param = (nome, padrao = null) => new URLSearchParams(location.search).get(nome) ?? padrao;

export const SALA = {
  // Abóbada: elipse vista de frente, cortada pelo piso em y = 0.
  A: 6.4, B: 4.9, YC: 1.5,
  FACETAS: 12,
  Z_PROA: -7, Z_POPA: 7,
  BAIAS: 6,
  Z_GRADIL: -4.4,
};

// Paleta oficial do job (kv 20 mil leguas - paleta de cores.png).
export const PALETA = {
  tijolo: 0xA24847, terracota: 0xB27159, ferrugem: 0x6B483E,
  oliva: 0x7B7C57, musgo: 0x898B4B, olivaEscuro: 0x353A26, olivaCinza: 0x7F7E69,
  caqui: 0xB3AD94, ouro: 0xCFC87A, malva: 0x695252,
  teal: 0x669194, marinho: 0x2C4357, abismo: 0x0D1726, vidroMar: 0xBECFA1, nevoa: 0xD2DBC0,
  lilas: 0xB8AEB1, verdeMar: 0x50715C,
};

const PRESETS = {
  baixa: { pixelRatio: 1, xrEscala: 0.8, foveacao: 1, rebites: 0.5, poeira: 0.5 },
  media: { pixelRatio: 1.5, xrEscala: 1, foveacao: 1, rebites: 1, poeira: 1 },
  alta: { pixelRatio: 2, xrEscala: 1.2, foveacao: 0.5, rebites: 1, poeira: 1.5 },
};

export const qualidade = () => PRESETS[param('q', 'media')] ?? PRESETS.media;
