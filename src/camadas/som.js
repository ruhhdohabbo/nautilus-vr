// O som do casco, todo sintetizado: zumbido elétrico, água lá fora, rangidos nas costelas, bolhas nas vigias
// e a reação à cabeçada. O vídeo central segue direto para a saída e é ele quem domina.
// Os rangidos são calculados uma vez ao abrir a página (banco) e só tocados depois: em tempo real custam
// um buffer e um panner, em vez de um banco de ressonadores por voz.
import { param, SALA } from '../config.js';
import { CANAIS, VIGIAS_PAREDE, VIGIAS_ANTEPARA } from '../janelas.js';
import { posicaoVigiaParede } from '../sala.js';
import { sorteador } from '../geo.js';

const { A, B, YC, Z_PROA, Z_POPA, BAIAS } = SALA;
const PI2 = Math.PI * 2;
const SR = 24000; // O casco abafa o agudo: o banco não precisa de mais que isso e ocupa metade da memória.
const HRTF_MAX = 3; // O quarto panner HRTF é o do vídeo central.
const HORIZONTE = 0.4; // Voz só nasce perto de tocar, para os panners vivos serem os que estão soando.

// Teto rígido da camada: unidade até -6 dBFS, curva suave depois, nunca passa de -1,9 dBFS. Número ímpar de pontos: 0 vira 0.
const LIMITE = (() => {
  const n = 4097, c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1, a = Math.abs(x);
    c[i] = Math.sign(x) * (a < 0.5 ? a : 0.5 + 0.34 * Math.tanh((a - 0.5) / 0.34));
  }
  return c;
})();

// Banco: metal sob pressão. Chapa engastada tem parciais inarmônicos; o que excita é atrito em stick-slip.
const RAZOES = [1, 1.58, 2.14, 2.31, 2.66, 2.92, 3.17, 3.51, 4.27, 5.08, 6.33, 7.9];

function modosDe(r, base, n, t60, inclinacao) {
  const modos = [];
  for (let i = 0; i < n; i++) {
    modos.push({
      f: base * RAZOES[i] * (0.97 + r() * 0.06),
      t60: (t60 / (1 + i * 0.4)) * (0.7 + r() * 0.6),
      g: (0.35 + r() * 0.65) / (1 + i * inclinacao),
    });
  }
  return modos;
}

// Bloco e mola: a tensão sobe na velocidade pedida e solta ao passar do atrito estático, que muda a cada soltura.
// Espera maior dá soltura maior: a irregularidade vem do mecanismo. Devagar são estalos; rápido vira gemido com altura.
// aspereza 1 é chapa seca, cada soltura diferente; perto de 0 o atrito trava num período e o som ganha altura definida.
function atrito(n, vel, pressao, r, aspereza) {
  const exc = new Float32Array(n);
  let tensao = 0, limiar = 1, grao = 0;
  for (let i = 0; i < n; i++) {
    const s = i / SR;
    tensao += vel(s) / SR;
    if (tensao >= limiar) {
      const k = aspereza(s);
      const solta = tensao * (1 - k * r() * 0.45);
      const forca = solta * pressao(s);
      exc[i] += forca;
      grao = forca * 0.16;
      tensao -= solta;
      limiar = 1 + k * 0.7 * (r() - 0.5);
    }
    exc[i] += grao * (r() - 0.5);
    grao *= 0.985;
  }
  return exc;
}

function ressoa(exc, modos, deriva) {
  const saida = new Float32Array(exc.length);
  for (const { f, t60, g } of modos) {
    const raio = Math.exp(-6.91 / (t60 * SR));
    const entrada = g * Math.sin((PI2 * f) / SR);
    let y1 = 0, y2 = 0, a1 = 0;
    for (let i = 0; i < exc.length; i++) {
      if (!(i & 63)) a1 = 2 * raio * Math.cos((PI2 * f * (deriva ? deriva(i / SR) : 1)) / SR);
      const y = exc[i] * entrada + a1 * y1 - raio * raio * y2;
      y2 = y1; y1 = y;
      saida[i] += y;
    }
  }
  return saida;
}

// Tira o DC do atrito (que só empurra para um lado), abafa e fecha sem clique.
function filtra(x, corte, fim = 0.08) {
  const aPb = Math.exp((-PI2 * corte) / SR), aPa = Math.exp((-PI2 * 28) / SR);
  let pb = 0, dc = 0;
  const nFim = Math.floor(x.length * fim);
  for (let i = 0; i < x.length; i++) {
    pb = x[i] + (pb - x[i]) * aPb;
    dc = pb + (dc - pb) * aPa;
    x[i] = pb - dc;
    const falta = x.length - 1 - i;
    if (falta < nFim) x[i] *= falta / nFim;
  }
  return x;
}

function paraBuffer(...canais) {
  let pico = 1e-9;
  for (const c of canais) for (let i = 0; i < c.length; i++) pico = Math.max(pico, Math.abs(c[i]));
  const b = new AudioBuffer({ numberOfChannels: canais.length, length: canais[0].length, sampleRate: SR });
  canais.forEach((c, i) => {
    for (let k = 0; k < c.length; k++) c[k] /= pico;
    b.copyToChannel(c, i);
  });
  return b;
}

// Uma a três solturas secas e o resto é a chapa soando.
function estalo(r) {
  const n = Math.floor(SR * (1.6 + r() * 0.6));
  const exc = new Float32Array(n);
  let p = 0.01;
  const quantos = 1 + Math.floor(r() * 3);
  for (let j = 0; j < quantos; j++) {
    exc[Math.floor(p * SR)] = (0.5 + r() * 0.5) * (j ? 0.55 : 1);
    p += 0.03 + r() * 0.24;
  }
  return paraBuffer(filtra(ressoa(exc, modosDe(r, 130 + r() * 190, 11, 0.9 + r() * 0.7, 0.3)), 2600 + r() * 1200));
}

// Tiques que apertam e afrouxam: o stick-slip no ritmo em que ainda se contam os golpes.
function arrasto(r) {
  const dur = 3 + r() * 1.6, fim = dur * 0.62, n = Math.floor(SR * dur);
  const pico = 6 + r() * 22, ataque = 0.35 + r() * 0.5;
  const vel = (s) => (s >= fim ? 0 : pico * Math.sin(Math.PI * Math.pow(s / fim, ataque)) ** 2 + 0.8);
  const exc = atrito(n, vel, (s) => (s >= fim ? 0 : 1), r, () => 1);
  return paraBuffer(filtra(ressoa(exc, modosDe(r, 90 + r() * 170, 11, 0.7 + r() * 0.5, 0.28)), 2400));
}

// Atrito rápido em chapa grave: o gemido tem altura, e a altura escorrega porque a tensão da chapa muda.
function gemido(r) {
  const dur = 5 + r() * 2, fim = dur * 0.72, n = Math.floor(SR * dur);
  const de = 34 + r() * 46, para = de * (0.6 + r() * 0.7), onda = 0.5 + r() * 0.7;
  const vel = (s) => (s >= fim ? 0 : (de + (para - de) * (s / fim)) * (1 + 0.06 * Math.sin(PI2 * onda * s)));
  const pressao = (s) => (s >= fim ? 0 : Math.sin((Math.PI * s) / fim) ** 1.2);
  // Trava no meio do gemido, onde a pressão é maior, e perde o passo nas pontas.
  const exc = atrito(n, vel, pressao, r, (s) => 0.05 + 0.5 * Math.abs(s / fim - 0.5) ** 1.5);
  const queda = 0.04 + r() * 0.06;
  return paraBuffer(filtra(ressoa(exc, modosDe(r, 42 + r() * 48, 12, 1.2 + r(), 0.2), (s) => 1 - (queda * s) / dur), 2200));
}

// Bolha de Minnaert: seno que sobe enquanto morre. Lá fora, atrás do vidro: abafada.
function bolhas(r) {
  const dur = 0.5 + r() * 1.5, n = Math.floor(SR * dur);
  const x = new Float32Array(n);
  const quantas = 3 + Math.floor(r() * 8);
  for (let j = 0; j < quantas; j++) {
    const f0 = 320 + r() * r() * 900, tau = 0.012 + r() * 0.02, amp = 0.4 + r() * 0.6;
    const i0 = Math.floor(r() * (n - SR * 0.2));
    let fase = 0;
    for (let i = 0, m = Math.floor(tau * 6 * SR); i < m && i0 + i < n; i++) {
      const s = i / SR;
      fase += (PI2 * f0 * (1 + (0.18 * s) / tau)) / SR;
      x[i0 + i] += amp * Math.sin(fase) * Math.exp(-s / tau);
    }
  }
  return paraBuffer(filtra(x, 1500));
}

// Condensação pingando na chapa junto da vigia.
function gota(r) {
  const n = Math.floor(SR * 0.5);
  const exc = new Float32Array(n);
  const f0 = 900 + r() * 900;
  let fase = 0;
  for (let i = 0; i < SR * 0.08; i++) {
    const s = i / SR;
    fase += (PI2 * f0 * (1 + s * 9)) / SR;
    exc[i] = Math.sin(fase) * Math.exp(-s / 0.012) * 0.02;
  }
  const anel = ressoa(exc, [
    { f: 1700 + r() * 500, t60: 0.14, g: 1 }, { f: 2700 + r() * 500, t60: 0.09, g: 0.6 },
  ]);
  for (let i = 0; i < n; i++) anel[i] += exc[i] * 3;
  return paraBuffer(filtra(anel, 4000));
}

// A pancada no casco: corpo de chapas, grave que escorrega para baixo e rumor. Dois canais, porque é o casco todo.
// Nasce devagar de propósito: o ataque é o boom do vídeo, que já bate no teto. Isto cresce por baixo e fica depois que ele some.
function golpe(r) {
  const n = SR * 7;
  const canal = () => {
    const exc = new Float32Array(n);
    exc[0] = 1;
    for (let i = 1; i < SR * 0.05; i++) exc[i] = (r() - 0.5) * 0.25 * (1 - i / (SR * 0.05));
    const corpo = ressoa(exc, [
      { f: 57, t60: 3.2, g: 1 }, { f: 83, t60: 3.6, g: 0.8 }, { f: 121, t60: 2.8, g: 0.6 }, { f: 171, t60: 2.1, g: 0.45 },
      { f: 236, t60: 1.5, g: 0.34 }, { f: 331, t60: 1.1, g: 0.22 }, { f: 467, t60: 0.7, g: 0.14 }, { f: 713, t60: 0.5, g: 0.08 },
    ].map((m) => ({ ...m, f: m.f * (0.985 + r() * 0.03) })));
    let fase = 0, rumor = 0;
    for (let i = 0; i < n; i++) {
      const s = i / SR;
      fase += (PI2 * (25 + 30 * Math.exp(-s / 0.35))) / SR;
      rumor = rumor * 0.992 + (r() - 0.5) * 0.008 * 6;
      const sub = Math.sin(fase) * Math.exp(-s / 1.6);
      corpo[i] = (corpo[i] * 0.6 + sub + rumor * Math.exp(-s / 1.9) * 2) * (1 - Math.exp(-((s / 0.16) ** 2)));
    }
    return filtra(corpo, 1800);
  };
  return paraBuffer(canal(), canal());
}

// O gemido longo depois da pancada: começa em rosnado e vai se soltando em tiques cada vez mais espaçados.
function gemidoLongo(r) {
  const n = SR * 15, fim = 11.5;
  const canal = (desvio) => {
    const vel = (s) => (s >= fim ? 0 : (60 * Math.exp(-s / 3.8) + 7) * (1 + 0.18 * Math.sin(PI2 * 0.31 * s + desvio) + 0.1 * Math.sin(PI2 * 0.87 * s)));
    const pressao = (s) => (s >= fim ? 0 : (1 - Math.exp(-s / 0.5)) * (Math.exp(-s / 3.6) + 0.1) * (1 - s / fim) ** 0.5);
    const exc = atrito(n, vel, pressao, r, (s) => Math.min(1, 0.07 + (s / fim) ** 2));
    const modos = [...modosDe(r, 36, 12, 3.6, 0.16), ...modosDe(r, 168, 9, 1.5, 0.3).map((m) => ({ ...m, g: m.g * 0.5 }))];
    return filtra(ressoa(exc, modos, (s) => 1 - 0.09 * (1 - Math.exp(-s / 6))), 2000, 0.1);
  };
  return paraBuffer(canal(0), canal(1.7));
}

// Ruído em laço: a emenda é uma fusão, porque ruído pardo tem degrau na volta.
function ruido(segundos, proximo) {
  const n = Math.floor(SR * segundos), f = SR, canais = [];
  for (let c = 0; c < 2; c++) {
    const x = new Float32Array(n + f);
    proximo(x);
    for (let i = 0; i < f; i++) {
      const a = i / f;
      x[i] = x[i] * Math.sqrt(a) + x[n + i] * Math.sqrt(1 - a);
    }
    let soma = 0;
    for (let i = 0; i < n; i++) soma += x[i] * x[i];
    const k = 0.25 / Math.sqrt(soma / n);
    for (let i = 0; i < n; i++) x[i] *= k;
    canais.push(x.subarray(0, n));
  }
  const b = new AudioBuffer({ numberOfChannels: 2, length: n, sampleRate: SR });
  canais.forEach((c, i) => b.copyToChannel(c, i));
  return b;
}

// Roda ao abrir a página, com pausas, para o custo não cair no clique de entrada nem dentro da sessão de VR.
// AudioBuffer não depende de contexto: o mesmo banco serve para o som ao vivo e para o render de teste.
export async function criaBanco(semente = Math.random() * 2 ** 32) {
  const r = sorteador(semente);
  const folga = () => new Promise((ok) => setTimeout(ok));
  const banco = { estalo: [], arrasto: [], gemido: [], bolhas: [], gota: [] };
  const receitas = { estalo: [estalo, 3], arrasto: [arrasto, 4], gemido: [gemido, 3], bolhas: [bolhas, 3], gota: [gota, 2] };
  for (const [nome, [faz, quantos]] of Object.entries(receitas)) {
    for (let i = 0; i < quantos; i++) { banco[nome].push(faz(r)); await folga(); }
  }
  banco.golpe = golpe(r);
  await folga();
  banco.gemidoLongo = gemidoLongo(r);
  await folga();
  banco.pardo = ruido(12.7, (x) => {
    let y = 0;
    for (let i = 0; i < x.length; i++) { y = y * 0.995 + (r() - 0.5) * 0.2; x[i] = y; }
  });
  await folga();
  // Água ouvida através do casco: sem nada de chiado em cima, onde a trilha do vídeo não tem nada para disfarçar.
  const aAgua = Math.exp((-PI2 * 1500) / SR);
  banco.branco = ruido(17.3, (x) => {
    let a = 0, b = 0;
    for (let i = 0; i < x.length; i++) {
      const w = r() - 0.5;
      a = w + (a - w) * aAgua;
      b = a + (b - a) * aAgua;
      x[i] = b;
    }
  });
  return banco;
}

// leito é o volume de todo o ambiente, para acertar de ouvido contra o vídeo.
const NIVEL = {
  leito: 1,
  zumbido: 0.056, formante: 0.04, segundo: 0.012,
  pressao: 0.105, marulho: 0.06, parede: 0.12,
  retorno: 0.34,
  rangido: 0.6, gota: 0.05, bolhas: 0.06,
  golpe: 0.3, gemidoLongo: 0.24, cascata: 0.5,
};
const SILENCIO = 0.02; // Quase nada: o leito recua uns 34 dB antes da pancada.
// O buraco da trilha do vídeo abre 1,2 s antes do boom, e o 'pre-impacto' só vem 0,8 s antes. Esperar por ele deixaria o
// leito tocando sozinho dentro do silêncio: quando o vídeo diz que o instante vem aí, o leito já recua junto com a trilha.
const RECUA_ANTES = 1.5;

const T0 = Math.asin(-YC / B);
const pontoNaCostela = (i, r) => {
  const t = T0 + (Math.PI - 2 * T0) * r();
  return [A * 0.97 * Math.cos(t), YC + B * 0.97 * Math.sin(t), Z_PROA + (i * (Z_POPA - Z_PROA)) / BAIAS];
};

const PONTOS_VIGIA = [
  ...VIGIAS_PAREDE.map((v) => posicaoVigiaParede(v).C.toArray()),
  ...VIGIAS_ANTEPARA.map((v) => [v.x, v.y, Z_PROA]),
];

function respostaDoCasco(ctx, r) {
  const n = Math.floor(ctx.sampleRate * 1.6);
  const ir = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const x = ir.getChannelData(c);
    let pb = 0;
    for (let i = 0; i < n; i++) {
      const s = i / ctx.sampleRate;
      const corte = 700 + 4300 * Math.exp(-s / 0.22); // O casco come o agudo primeiro.
      const a = Math.exp((-PI2 * corte) / ctx.sampleRate);
      const w = r() - 0.5;
      pb = w + (pb - w) * a;
      x[i] = pb * Math.exp(-s / 0.26) * (1 - i / n);
    }
  }
  return ir;
}

// Aceita qualquer BaseAudioContext. Em tempo real, agenda(agora) vem de atualiza(); no teste, de OfflineAudioContext.suspend().
export function montaSom(ctx, banco, { semente = Math.random() * 2 ** 32, destino = ctx.destination } = {}) {
  const r = sorteador(semente);
  const inicio = ctx.currentTime;
  const entre = (a, b) => a + (b - a) * r();
  // Filtro e oscilador com automação a-rate recalculam a cada amostra. Para deriva de segundos, por bloco basta e sai bem mais barato.
  const lento = (no) => {
    for (const nome of ['frequency', 'detune']) if (no[nome]) no[nome].automationRate = 'k-rate';
    return no;
  };

  const saida = new WaveShaperNode(ctx, { curve: LIMITE });
  saida.connect(destino);
  const leito = new GainNode(ctx, { gain: 0 });
  leito.connect(saida);
  const casco = new ConvolverNode(ctx, { buffer: respostaDoCasco(ctx, r) });
  const retorno = new GainNode(ctx, { gain: NIVEL.retorno });
  casco.connect(retorno).connect(saida);
  const envioLeito = new GainNode(ctx, { gain: 0 });
  envioLeito.connect(casco);
  for (const p of [leito.gain, envioLeito.gain]) p.setTargetAtTime(NIVEL.leito, inicio, 1.5);

  // Zumbido: a máquina tem uma rotação só, e os dois enrolamentos batem devagar entre si.
  // Fundamental para o fone; harmônicos para o alto-falante do óculos, que quase não reproduz abaixo de 150 Hz.
  const imag = new Float32Array([0, 1, 0.55, 0.36, 0.24, 0.15, 0.1, 0.07, 0.045, 0.03, 0.02]);
  const onda = ctx.createPeriodicWave(new Float32Array(imag.length), imag);
  // Afinada em quinta sobre os drones da trilha do vídeo (36 e 43,5 Hz, ré e fá): perto de 47 Hz ela bateria com eles 3 a 4 vezes por segundo.
  const rotacao = new ConstantSourceNode(ctx, { offset: 54.3 });
  const dobro = new GainNode(ctx, { gain: 2 });
  rotacao.connect(dobro);
  const enrolamento = (pan, detune) => {
    const o = lento(new OscillatorNode(ctx, { frequency: 0, detune }));
    o.setPeriodicWave(onda);
    rotacao.connect(o.frequency);
    return { o, pan: new StereoPannerNode(ctx, { pan }) };
  };
  const e1 = enrolamento(-0.55, 0), e2 = enrolamento(0.55, 4);
  const segundo = lento(new OscillatorNode(ctx, { frequency: 0, type: 'sine', detune: -3 }));
  dobro.connect(segundo.frequency);
  const zumbido = new GainNode(ctx, { gain: NIVEL.zumbido });
  const zumbidoPb = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 520, Q: 0.3 });
  const formante = lento(new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 220, Q: 2.2 }));
  const nivelFormante = new GainNode(ctx, { gain: NIVEL.formante });
  e1.o.connect(e1.pan); e2.o.connect(e2.pan);
  for (const f of [e1.pan, e2.pan]) { f.connect(zumbido); f.connect(formante); }
  zumbido.connect(zumbidoPb).connect(leito);
  formante.connect(nivelFormante).connect(leito);
  const nivelSegundo = new GainNode(ctx, { gain: NIVEL.segundo });
  segundo.connect(nivelSegundo).connect(leito);

  // Água: massa grave de pressão e, por cima, o marulho abafado que passa pelo casco.
  const laco = (buffer, taxa = 1) => new AudioBufferSourceNode(ctx, { buffer, loop: true, playbackRate: taxa });
  const pardo = laco(banco.pardo);
  const pressaoPb = lento(new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 150, Q: 0.4 }));
  const pressao = new GainNode(ctx, { gain: NIVEL.pressao });
  pardo.connect(pressaoPb).connect(pressao).connect(leito);
  const branco = laco(banco.branco);
  const marulhoBp = lento(new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 420, Q: 0.7 }));
  const marulho = new GainNode(ctx, { gain: NIVEL.marulho });
  branco.connect(marulhoBp).connect(marulho).connect(leito);

  // Junto de cada parede, o mar corre mais perto. A distância faz o trabalho: panner barato, sem HRTF, sempre ao lado da cabeça.
  const parede = (x, taxa) => {
    const l = laco(banco.branco, taxa);
    const bp = lento(new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 620, Q: 0.9 }));
    const g = new GainNode(ctx, { gain: NIVEL.parede });
    const p = new PannerNode(ctx, {
      panningModel: 'equalpower', distanceModel: 'inverse', refDistance: 1.2, rolloffFactor: 1.4,
      positionX: x, positionY: 1.7, positionZ: 0,
    });
    l.connect(bp).connect(g).connect(p).connect(leito);
    return { l, bp, g, p };
  };
  const pE = parede(-6.3, 0.97), pD = parede(6.3, 1.04);

  for (const n of [rotacao, e1.o, e2.o, segundo, pardo, branco]) n.start(inicio);
  pE.l.start(inicio, 3.7);
  pD.l.start(inicio, 9.1);

  // Nada aqui se repete: cada parâmetro sorteia seu próximo alvo no seu próprio tempo.
  const deriva = (alvo, min, max, tau, pMin, pMax) => ({ alvo, min, max, tau, pMin, pMax, prox: inicio + r() * pMin });
  const derivas = [
    deriva(rotacao.offset, 54, 54.7, 14, 9, 26),
    deriva(e2.o.detune, -8, 9, 9, 11, 31),
    deriva(segundo.detune, -7, 7, 11, 7, 23),
    deriva(formante.frequency, 150, 330, 10, 8, 24),
    deriva(zumbido.gain, NIVEL.zumbido * 0.8, NIVEL.zumbido * 1.1, 8, 7, 21),
    deriva(pressaoPb.frequency, 90, 230, 7, 5, 17),
    deriva(pressao.gain, NIVEL.pressao * 0.7, NIVEL.pressao * 1.15, 6, 5, 15),
    deriva(marulhoBp.frequency, 300, 700, 5, 4, 13),
    deriva(marulho.gain, NIVEL.marulho * 0.35, NIVEL.marulho * 1.2, 3.5, 3, 10),
    deriva(pE.bp.frequency, 400, 1100, 5, 4, 12),
    deriva(pD.bp.frequency, 400, 1100, 5, 4, 12),
    deriva(pE.g.gain, NIVEL.parede * 0.3, NIVEL.parede * 1.2, 2.5, 3, 8),
    deriva(pD.g.gain, NIVEL.parede * 0.3, NIVEL.parede * 1.2, 4, 3, 8),
  ];

  // Vozes descartáveis: nascem perto de tocar e se desconectam ao terminar.
  let nos = 0, vozes = 0, hrtfVivos = 0, totalVozes = 0;
  const fimHrtf = new Array(HRTF_MAX).fill(0);
  const voz = (buffer, t, { nivel, taxa = 1, pos = null, envio = 0.25, barra = leito, envioBarra = envioLeito }) => {
    const fonte = new AudioBufferSourceNode(ctx, { buffer, playbackRate: taxa });
    const g = new GainNode(ctx, { gain: nivel });
    const e = new GainNode(ctx, { gain: envio });
    fonte.connect(g);
    g.connect(e).connect(envioBarra);
    let p = null, comHrtf = false;
    if (pos) {
      const vaga = fimHrtf.findIndex((f) => f <= ctx.currentTime);
      comHrtf = vaga >= 0;
      if (comHrtf) fimHrtf[vaga] = t + buffer.duration / taxa + 0.1;
      p = new PannerNode(ctx, {
        panningModel: comHrtf ? 'HRTF' : 'equalpower', distanceModel: 'inverse', refDistance: 2.5, rolloffFactor: 1,
        positionX: pos[0], positionY: pos[1], positionZ: pos[2],
      });
      g.connect(p).connect(barra);
      if (comHrtf) hrtfVivos++;
    } else g.connect(barra);
    nos += p ? 4 : 3;
    vozes++; totalVozes++;
    fonte.onended = () => {
      fonte.disconnect(); g.disconnect(); e.disconnect(); p?.disconnect();
      nos -= p ? 4 : 3;
      vozes--;
      if (comHrtf) hrtfVivos--;
    };
    fonte.start(t);
  };

  const sorteia = (lista) => lista[Math.floor(r() * lista.length)];
  const rangido = (t, costela, k, barra, envioBarra) => {
    const s = r();
    const lista = s < 0.42 ? banco.arrasto : s < 0.72 ? banco.estalo : banco.gemido;
    const peso = lista === banco.gemido ? 0.8 : 1;
    voz(sorteia(lista), t, {
      nivel: NIVEL.rangido * peso * k * entre(0.55, 1), taxa: entre(0.82, 1.18),
      pos: pontoNaCostela(costela, r), envio: entre(0.3, 0.6), barra, envioBarra,
    });
  };
  const respingo = (t) => {
    const ponto = sorteia(PONTOS_VIGIA);
    if (r() < 0.6) voz(sorteia(banco.bolhas), t, { nivel: NIVEL.bolhas * entre(0.5, 1), taxa: entre(0.8, 1.2), pos: ponto, envio: 0.15 });
    else voz(sorteia(banco.gota), t, { nivel: NIVEL.gota * entre(0.5, 1), taxa: entre(0.85, 1.15), pos: ponto, envio: 0.5 });
  };

  let proxRangido = inicio + entre(8, 18);
  let proxRespingo = inicio + entre(20, 45);
  let silencioAte = 0, assentaAte = 0;
  const fila = []; // Cascata do impacto, em ordem de tempo.

  return {
    saida,
    agenda(agora) {
      for (let i = 0; i < derivas.length; i++) {
        const d = derivas[i];
        if (agora < d.prox) continue;
        d.alvo.setTargetAtTime(entre(d.min, d.max), agora, d.tau * entre(0.6, 1.4));
        d.prox = agora + entre(d.pMin, d.pMax);
      }
      while (fila.length && fila[0].t <= agora + HORIZONTE) {
        const f = fila.shift();
        // Aba escondida atrasa o relógio da página: o que perdeu a hora não toca de uma vez.
        if (f.t >= agora - 0.5) rangido(Math.max(f.t, agora), f.costela, f.k, saida, casco);
      }
      if (agora < silencioAte) return;
      if (agora >= proxRangido) {
        rangido(agora + 0.05, Math.floor(r() * (BAIAS + 1)), 1);
        proxRangido = agora + (agora < assentaAte ? entre(5, 14) : r() < 0.2 ? entre(2, 7) : 15 + r() ** 1.5 * 45);
      }
      if (agora >= proxRespingo) {
        respingo(agora + 0.05);
        proxRespingo = agora + entre(25, 75);
      }
    },
    // Marulho das paredes acompanha o visitante ao longo do casco.
    cabeca(z) {
      pE.p.positionZ.value = z;
      pD.p.positionZ.value = z;
    },
    preImpacto(t) {
      fila.length = 0;
      silencioAte = t + 8;
      for (const p of [leito.gain, envioLeito.gain]) {
        p.cancelScheduledValues(t);
        p.setTargetAtTime(SILENCIO, t, 0.2);
        p.setTargetAtTime(NIVEL.leito, t + 8, 6); // Se a pancada não vier, o ambiente volta sozinho.
      }
    },
    impacto(t, forca = 1) {
      const k = Math.min(Math.max(forca, 0.15), 1);
      const corpo = 0.5 + 0.5 * k;
      fila.length = 0;
      silencioAte = t + 6;
      assentaAte = t + 30;
      proxRangido = t + entre(14, 20);
      for (const p of [leito.gain, envioLeito.gain]) {
        p.cancelScheduledValues(t);
        p.setTargetAtTime(SILENCIO, t, 0.03);
        p.setTargetAtTime(NIVEL.leito, t + 3.5, 7);
      }
      voz(banco.golpe, t, { nivel: NIVEL.golpe * corpo, envio: 0.15, barra: saida, envioBarra: casco });
      voz(banco.gemidoLongo, t + 0.25, { nivel: NIVEL.gemidoLongo * corpo, envio: 0.5, barra: saida, envioBarra: casco });
      // O choque corre pelas costelas da proa para a popa, passando pelo visitante.
      const n = 3 + Math.round(6 * k);
      let quando = t + 0.5;
      for (let i = 0; i < n; i++) {
        fila.push({ t: quando, costela: Math.round((i * BAIAS) / (n - 1)), k: (NIVEL.cascata / NIVEL.rangido) * k * 0.87 ** i });
        quando += 0.35 + i * 0.2 + r() * (0.3 + i * 0.25);
      }
    },
    estado: () => ({ nos, vozes, hrtf: hrtfVivos, totalVozes, fila: fila.length }),
  };
}

export async function cria(mundo) {
  if (param('som') === '0') return null;
  const banco = await criaBanco();
  let motor = null, ctx = null, prox = 0;
  const cabeca = mundo.camera.position.clone();
  const video = mundo.canais.central.video;
  const impactos = CANAIS.central.impactos ?? [];
  let ultimo = 0;

  mundo.eventos.addEventListener('pre-impacto', () => {
    if (motor && ctx.state === 'running') motor.preImpacto(ctx.currentTime);
  });
  mundo.eventos.addEventListener('impacto', (e) => {
    if (motor && ctx.state === 'running') motor.impacto(ctx.currentTime, e.detail?.forca ?? 1);
  });

  return {
    get motor() { return motor; },
    aoComecar(audioCtx) {
      if (motor) return;
      ctx = audioCtx;
      motor = montaSom(ctx, banco);
    },
    atualiza() {
      if (!motor || ctx.state !== 'running') return;
      const agora = ctx.currentTime;
      const ct = video.currentTime;
      for (let i = 0; i < impactos.length; i++) {
        // Com hiato de quadros (mais de 0,5 s, o mesmo limite da cabecada) não é passagem: o recuo sairia fora de hora.
        if (ct - ultimo < 0.5 && ultimo < impactos[i] - RECUA_ANTES && ct >= impactos[i] - RECUA_ANTES) motor.preImpacto(agora);
      }
      ultimo = ct;
      if (agora < prox) return;
      prox = agora + 0.2;
      motor.agenda(agora);
      motor.cabeca(mundo.camera.getWorldPosition(cabeca).z);
    },
  };
}
