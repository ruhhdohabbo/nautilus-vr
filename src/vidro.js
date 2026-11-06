// As janelas. Todo vidro é uma calota esférica que abaula para o mar, e o vídeo mora numa esfera do lado de fora.
// Cada olho traça o próprio raio: reto até o vidro, dobra na entrada da água e anda até a esfera do vídeo. A imagem ganha
// profundidade real no estéreo, paralaxe quando a cabeça mexe e a dobra de uma lente de verdade.
import * as THREE from 'three';
import { SALA, PALETA } from './config.js';
import { VITRINE, VIGIAS_PAREDE, VIGIAS_ANTEPARA, MARES_LATERAIS, PANORAMICA } from './janelas.js';
import { varreElipse, faixaDeSecoes } from './geo.js';
import { posicaoVigiaParede } from './sala.js';
import { dobraGeo, dobraPonto, dobraNormal, eixosDaParede, xDaChapa } from './curva.js';
import { definesDoRelevo } from './relevo.js';

const VERT = /* glsl */`
varying vec3 vW; varying vec2 vQ;
void main(){
  vQ=uv;
  vec4 w=modelMatrix*vec4(position,1.);
  vW=w.xyz;
  gl_Position=projectionMatrix*viewMatrix*w;
}`;

// Um shader só para todas as janelas. O que muda são as esferas e os eixos do vídeo:
//   vitrine: o mar é concêntrico com o vidro e o vídeo é lido de c0 (uCen). Ela compila RACHA e o relevo (src/relevo.js).
//   vigias da parede: uCen é o centro do mar, e a conta vira a projeção estereográfica pura em volta dele.
//   vigias da antepara: fazem parte da mesma tela da vitrine (MESMA_TELA). Dividem com ela vídeo, mar e relevo.
const FRAG = /* glsl */`
uniform sampler2D uVideo, uPelicula;
uniform samplerCube uSalaRefl;
uniform vec3 uCxMin, uCxMax, uCxC;
uniform vec3 uCup, uMarC, uCen, uEx, uEy, uEw; // esfera do vidro, esfera do mar, de onde o vídeo é lido e os eixos dele
uniform vec2 uMarR, uEsc;                      // raio da lula e da água; da projeção estereográfica para -1..1 do vídeo
uniform float uAgua0, uVideoK;                 // caminho na água do raio de frente; quanto de vídeo há nessa janela
uniform vec4 uRecorte;
uniform vec3 uAguaCor, uLuzVidro;
#ifdef RELEVO_MAPA
uniform highp sampler3D uMapa; // h(u, v, quadro): 1 no ponto mais próximo da lula, 0 na água
uniform float uCamada;
#endif
#ifdef RELEVO_DOMO
uniform vec4 uDomo;            // centro e tamanho da lula neste quadro, em uv
#endif
#ifdef RACHA
uniform sampler2D uRachaA, uRachaB;
uniform vec3 uRacha;      // x: frente da rachadura (0 a 1), y: opacidade, z: brilho do golpe
uniform vec2 uRachaFundo; // espessura do vidro, na escala dos mapas
uniform float uLampK;     // luz das lâmpadas agora
uniform vec3 uLampPos[4];
#define LAMP_K uLampK
#else
#define LAMP_K 1.
#endif
// O centro da curva da vitrine fica no meio da sala. Perto dele, o vidro inteiro amplia um pedacinho da popa, e uma linha dela vira um risco sobre a imagem.
// O reflexo é lido numa curva bem mais aberta, e vem macio e fraco: mostra a sala de pé, como numa janela de verdade, sem competir com o vídeo.
#ifdef RACHA
#define REFL_ABRE vec3(0.,0.,-2.)
#define REFL_ONDA .012
#else
#define REFL_ABRE vec3(0.)
#define REFL_ONDA .004
#endif
#if defined(RACHA) || defined(MESMA_TELA)
#define REFL_MACIO 1.5
#define REFL_K 1.6
#else
#define REFL_MACIO 0.
#define REFL_K 2.6
#endif
varying vec3 vW; varying vec2 vQ;
float ign(vec2 p){ return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715)))); }
// Do raio na água até o vídeo: a saída da esfera de raio R, e a direção desse ponto vista de uCen em projeção estereográfica.
// A projeção é conforme, o bicho não achata nem estica. O último passo aperta a imagem contra a elipse inscrita no quadro:
// de qualquer ponto da sala o raio cai dentro do vídeo, e a borda dele nunca aparece.
vec2 uvDoMar(vec3 D,float b,float c0,float R,out float t){
  t=sqrt(c0+R*R)-b;
  vec3 h=vW+D*t-uCen;
  vec2 q=vec2(dot(h,uEx),dot(h,uEy))/(length(h)+dot(h,uEw))*uEsc;
#ifdef MESMA_TELA
  // A vitrine gasta quase todo o quadro, e nestas vigias sobrava só a beira do vídeo, esticada até virar faixas. Aqui a imagem recua um pouco e só aperta bem perto da borda: estica tanto quanto na borda da vitrine.
  q*=.75;
  float r2=dot(q,q), r4=r2*r2;
  return q/sqrt(sqrt(sqrt(1.+r4*r4)))*.5+.5;
#else
  float r2=dot(q,q);
  return q/sqrt(sqrt(1.+r2*r2))*.5+.5;
#endif
}
void main(){
  vec3 V=normalize(vW-cameraPosition);
  vec3 N=normalize(vW-uCup); // normal real da calota, para o lado do mar
  float c=max(dot(V,N),.02);
  // Ar para água. O vidro é fino perto da distância do mar: as faces são quase paralelas e a direção final é a mesma sem ele.
#ifdef MESMA_TELA
  // A calota pequena abriria o campo como olho de peixe, e a imagem sairia na escala errada. O raio dobra pela esfera da vitrine; a calota fica no reflexo.
  vec3 D=refract(V,-normalize(vW-uMarC),.75188);
#else
  vec3 D=refract(V,-N,.75188);
#endif
  // O raio nasce dentro da esfera do mar: a raiz é sempre real e a distância, sempre positiva.
  vec3 o=vW-uMarC;
  float b=dot(o,D), c0=b*b-dot(o,o);
  // h: o quanto este ponto do vídeo está perto do vidro. Sem relevo, tudo fica na esfera da água.
  float tA,tL,h=0.;
  vec2 uv=uvDoMar(D,b,c0,uMarR.y,tA);
#ifdef RELEVO
  // O uv nas duas esferas, e a mistura pelo h do próprio ponto. O h depende do uv e o uv do h: poucas voltas bastam, porque as duas leituras quase coincidem.
  vec2 uvL=uvDoMar(D,b,c0,uMarR.x,tL);
  #if defined(RELEVO_MAPA)
  h=texture(uMapa,vec3(mix(uv,uvL,.5),uCamada)).r;
  h=mix(h,texture(uMapa,vec3(mix(uv,uvL,h),uCamada)).r,.7);
    #if RELEVO_PASSOS>2
  h=mix(h,texture(uMapa,vec3(mix(uv,uvL,h),uCamada)).r,.7);
    #endif
  #elif defined(RELEVO_DOMO)
  for(int i=0;i<2;i++){ vec2 dq=(mix(uv,uvL,h)-uDomo.xy)/uDomo.zw; h=exp(-dot(dq,dq)); }
  #else
  h=1.;
  #endif
  uv=mix(uv,uvL,h);
#endif
#ifdef RACHA
  // Vidro rachado: desvia a imagem de trás. Sem rachadura ativa, nenhuma amostra a mais.
  float rev=0.; vec2 inc=vec2(0.), rq=vQ*.5+.5;
  if(uRacha.y>.001){
    vec3 rb=texture2D(uRachaB,rq).rgb;
    rev=smoothstep(rb.b-.012,rb.b+.004,uRacha.x)*uRacha.y;
    inc=(rb.xy-.5)*2.*rev;
    uv+=inc*vec2(.03,.0533);
  }
#endif
  vec3 cor=texture2D(uVideo,uRecorte.xy+uv*uRecorte.zw).rgb;
  // Janela sem vídeo é mar parado, nunca TV apagada.
  cor=mix(uAguaCor,cor,uVideoK);
#if !defined(RACHA) && !defined(MESMA_TELA)
  // Os vídeos das vigias vêm num azul ultramarino: puxa para a água da vitrine só onde o azul domina. Bicho e pele ficam naturais.
  float kAz=smoothstep(.25,.7,(cor.b-cor.r)/max(cor.b,.001));
  cor.b*=mix(1.,.5,kAz);
  cor.r+=.024*kAz;
#endif
  // Absorção: raio oblíquo anda mais na água. O vermelho some primeiro, depois o verde, e sobra a cor da água.
  // O que está perto do vidro (h alto) quase não sofre.
  float s=1./(1.+max(tA-uAgua0,0.)*.1*(1.-h*.7));
  vec3 T=vec3(s*s*s,s,.5+.5*s);
  cor=cor*T+uAguaCor*(1.-T.g);
  // Vidro grosso: escurece e esverdeia na borda e no caminho inclinado dentro dele (n = 1,5).
  float x=1.-c, r=length(vQ);
  float g=smoothstep(.84,1.,r)+(1./sqrt(1.-(1.-c*c)*.444)-1.)*.6;
  cor*=mix(vec3(1.),vec3(.5,.64,.58),min(g,1.));
  vec3 luzRacha=vec3(0.);
#ifdef RACHA
  if(rev>.001){
    vec3 ra=texture2D(uRachaA,rq).rgb;
    // Vidro grosso: a mesma rachadura vista na face de trás, mais fraca, com paralaxe real pela normal local.
    vec3 Vg=refract(V,-N,.6667);
    vec2 desl=(Vg/max(dot(Vg,N),.2)-N).xy;
    float fundo=texture2D(uRachaA,rq+desl*uRachaFundo).r;
    float lum=dot(cor,vec3(.3,.59,.11));
    // Faces quebradas: sombra em volta das linhas e um tom para cada caco.
    cor*=mix(vec3(1.),vec3(.5,.47,.45),ra.g*rev);
    cor*=1.+(ra.b-.5)*.2*rev;
    // A linha pega luz: da imagem atrás dela, da água e das lâmpadas, com a face inclinada.
    vec3 Rf=reflect(V,normalize(-N+vec3(inc*.35,0.)));
    float esp=0.;
    for(int i=0;i<4;i++) esp+=pow(max(dot(Rf,normalize(uLampPos[i]-vW)),0.),18.);
    float brilho=lum*.75+.2+esp*.9*uLampK+uRacha.z;
    cor=mix(cor,vec3(.8,.88,.82)*brilho,clamp((ra.r*.95+fundo*.3)*rev,0.,1.));
    luzRacha=vec3(.86,.9,.76)*esp*.012*uLampK*rev;
  }
#endif
  // Daqui em diante, luz linear aproximada: é assim que vidro e sala somam.
  vec3 lin=cor*cor;
  // Película: fuligem na borda, condensação embaixo, marcas de água e pó. Fica presa na profundidade do vidro.
  vec2 pe=texture2D(uPelicula,vQ*.5+.5).rg;
  lin=mix(lin,lin*.72+uLuzVidro*.55,pe.r);
  lin+=uLuzVidro*pe.g*.5;
  // Fio de luz presa no vidro, onde ele encontra o aro.
  lin+=vec3(.06,.085,.07)*smoothstep(.965,.982,r)*(1.-smoothstep(.982,.998,r));
  // Reflexo: Fresnel pela normal local, a sala assada num cubo com projeção em caixa. Vidro soprado não é espelho perfeito: ondula de leve.
  float F=.04+.96*x*x*x*x*x;
  vec3 Nf=normalize(N+REFL_ABRE+vec3(sin(vW.y*2.3+vW.x*1.1),sin(vW.x*1.7-vW.y*.8),0.)*REFL_ONDA);
  vec3 R=V-2.*dot(V,Nf)*Nf;
  vec3 ic=(mix(uCxMin,uCxMax,step(0.,R))-vW)/R;
  vec3 rc=textureCube(uSalaRefl,vW+R*min(ic.x,min(ic.y,ic.z))-uCxC,REFL_MACIO).rgb;
  lin=lin*(1.-F)+rc*F*REFL_K*LAMP_K+luzRacha;
  gl_FragColor=vec4(sqrt(lin)+(ign(gl_FragCoord.xy)-.5)/255.,1.);
}`;

// Cor da água, em valores de tela: a mesma em toda janela.
const AGUA = new THREE.Color(PALETA.marinho).multiplyScalar(0.55).convertLinearToSRGB();

function criaVidro(cena, geometria, canal, comuns, def) {
  // Vigia da mesma tela: usa os mesmos objetos da vitrine, então o que src/relevo.js muda nela vale aqui também. Só a calota é dela.
  const vitrine = def.mesmaTela?.material;
  const uniforms = vitrine ? { ...vitrine.uniforms, uCup: { value: def.cup } } : {
    uVideo: { value: canal.tex }, uPelicula: comuns.uPelicula, uSalaRefl: comuns.uSalaRefl,
    uCxMin: comuns.uCxMin, uCxMax: comuns.uCxMax, uCxC: comuns.uCxC,
    uCup: { value: def.cup }, uMarC: { value: def.marC }, uCen: { value: def.cen },
    uEx: { value: def.ex }, uEy: { value: def.ey }, uEw: { value: def.ew },
    uMarR: { value: def.marR }, uEsc: { value: def.esc }, uAgua0: { value: def.agua0 },
    uRecorte: { value: new THREE.Vector4(...def.recorte) },
    uAguaCor: { value: AGUA }, uLuzVidro: def.luzVidro, uVideoK: { value: 1 },
  };
  // Rachadura e relevo: só a vitrine compila esses trechos. A camada cabecada entrega os mapas da rachadura e o tempo; src/relevo.js, o mapa e os raios.
  if (def.racha) Object.assign(uniforms, {
    uRachaA: { value: null }, uRachaB: { value: null }, uRacha: { value: new THREE.Vector3() }, uLampK: { value: 1 },
    uRachaFundo: { value: new THREE.Vector2(0.07 / def.a, 0.07 / def.b).multiplyScalar(0.5) },
    uLampPos: comuns.uLampPos,
    uMapa: { value: null }, uCamada: { value: 0 }, uDomo: { value: new THREE.Vector4(0.5, 0.5, 0.2, 0.3) },
  });
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, depthWrite: false, uniforms,
    defines: def.racha ? { RACHA: 1, ...definesDoRelevo() } : vitrine ? { MESMA_TELA: 1, ...definesDoRelevo() } : {},
  });
  const m = new THREE.Mesh(geometria, mat);
  m.name = `vidro:${def.id}`;
  m.renderOrder = 10; // depois da sala, para respeitar a profundidade dela; antes das partículas.
  m.userData.canal = canal;
  cena.add(m);
  return m;
}

// ---- Vitrine: calota esférica com o mesmo eixo da parede curva. ----

const { R: Rv, C: CV, meiaX: MEIA_X } = VITRINE.vidro;
const centroVitrine = new THREE.Vector3(...CV);
const pontoEsfera = (x, y, alvo = new THREE.Vector3()) => alvo.set(x, y, CV[2] - Math.sqrt(Rv * Rv - x * x - (y - CV[1]) ** 2));
const paraSala = (p) => centroVitrine.clone().sub(p).divideScalar(Rv);

// Malha polar elíptica: uv é (fx, fy), e vale 1 na borda visível. Passa 3% do corte: a sobra fica atrás do túnel, sem fresta.
function malhaVitrine(b) {
  const pos = [], uv = [], idx = [], A = 16, S = 96, p = new THREE.Vector3();
  const poe = (fx, fy) => {
    pontoEsfera(MEIA_X * fx, CV[1] + b * fy, p);
    pos.push(p.x, p.y, p.z);
    uv.push(fx, fy);
  };
  poe(0, 0);
  for (let i = 1; i <= A; i++) {
    const f = (1.03 * i) / A;
    for (let j = 0; j < S; j++) { const t = (j / S) * Math.PI * 2; poe(f * Math.cos(t), f * Math.sin(t)); }
  }
  for (let j = 0; j < S; j++) idx.push(0, 1 + j, 1 + (j + 1) % S);
  for (let i = 1; i < A; i++) {
    const a0 = 1 + (i - 1) * S, a1 = 1 + i * S;
    for (let j = 0; j < S; j++) { const k = (j + 1) % S; idx.push(a0 + j, a1 + j, a1 + k, a0 + j, a1 + k, a0 + k); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// Lábio e face do aro na chapa; o túnel vai à parte, porque a profundidade dele muda em volta da abertura.
function perfilAroSemTunel(k) {
  return [
    [0, 0.06 * k], [0.03 * k, -0.02 * k],
    [0.03 * k, -0.02 * k], [0.05 * k, -0.16 * k],
    [0.05 * k, -0.16 * k], [0.08 * k, -0.19 * k],
    [0.08 * k, -0.19 * k], [0.34 * k, -0.19 * k],
    [0.34 * k, -0.19 * k], [0.37 * k, -0.16 * k],
    [0.37 * k, -0.16 * k], [0.38 * k, -0.05 * k],
    [0.38 * k, -0.05 * k], [0.5 * k, -0.035 * k],
    [0.5 * k, -0.035 * k], [0.52 * k, 0.012],
  ];
}

// Túnel: da face do aro até 5 cm além da esfera, andando na direção do raio do cilindro. O eixo da esfera é o do cilindro, então a conta fecha.
function montaTunel(a, b, y0, latao) {
  const secoes = [], N = 128, Rw = PANORAMICA.R;
  for (let j = 0; j <= N; j++) {
    const t = (j / N) * Math.PI * 2, u = a * Math.cos(t), y = y0 + b * Math.sin(t);
    const w = Math.sqrt(Rv * Rv - (y - CV[1]) ** 2) - Rw + 0.05;
    secoes.push([dobraPonto(u, y, SALA.Z_PROA - w), dobraPonto(u, y, SALA.Z_PROA - 0.06)]);
  }
  latao.push(faixaDeSecoes(secoes, true));
}

// Caixilhos colados na calota: anel a 78% da abertura e raios que são meridianos dela, só na faixa de fora, para não cortar o meio do vídeo.
// É a paralaxe deles que mostra a curva e separa o vidro da imagem no estéreo.
function montaCaixilhoEsfera(b, latao, rebites) {
  const FRAC = 0.78, ALT = 0.2, LARG_ANEL = 0.07, LARG_RAIO = 0.045, ENTERRA = 0.03;
  const a = MEIA_X;
  // Uma seção: base e topo dos dois lados. Os pontos repetidos dão quina viva. A base entra no vidro: nunca sobra fresta.
  const secao = (p, lado, alt) => {
    const n = paraSala(p);
    const m = (k, h) => p.clone().addScaledVector(lado, k).addScaledVector(n, h);
    const A = m(1, -ENTERRA), B = m(1, alt), C = m(-1, alt), D = m(-1, -ENTERRA);
    return [A, B, B.clone(), C, C.clone(), D];
  };
  const anel = [], N = 128;
  for (let j = 0; j <= N; j++) {
    const t = (j / N) * Math.PI * 2;
    const p = pontoEsfera(FRAC * a * Math.cos(t), CV[1] + FRAC * b * Math.sin(t));
    const fora = new THREE.Vector3(Math.cos(t) / a, Math.sin(t) / b, 0).normalize();
    const n = paraSala(p);
    const lado = fora.clone().addScaledVector(n, -fora.dot(n)).normalize().multiplyScalar(-LARG_ANEL);
    anel.push(secao(p, lado, ALT));
  }
  latao.push(faixaDeSecoes(anel, true));
  for (let j = 0; j < 40; j++) {
    const t = (j / 40) * Math.PI * 2;
    const p = pontoEsfera(FRAC * a * Math.cos(t), CV[1] + FRAC * b * Math.sin(t));
    const n = paraSala(p);
    rebites.push({ p: p.clone().addScaledVector(n, ALT), n, r: 0.018 });
  }
  const RAIOS = 12, DIVS = 8;
  for (let i = 0; i < RAIOS; i++) {
    const t = ((i + 0.5) / RAIOS) * Math.PI * 2;
    const dx = a * Math.cos(t), dy = b * Math.sin(t), l = Math.hypot(dx, dy);
    const secoes = [];
    for (let d = 0; d <= DIVS; d++) {
      const f = FRAC + ((1.02 - FRAC) * d) / DIVS;
      const p = pontoEsfera(dx * f, CV[1] + dy * f);
      const n = paraSala(p);
      const s = new THREE.Vector3(dx / l, dy / l, 0);
      s.addScaledVector(n, -s.dot(n)).normalize();
      const lado = new THREE.Vector3().crossVectors(n, s).multiplyScalar(LARG_RAIO);
      secoes.push(secao(p, lado, ALT * (1 - 0.3 * (d / DIVS))));
    }
    latao.push(faixaDeSecoes(secoes));
  }
}

// ---- Vigias: calotas pequenas, com o mesmo shader. ----

// Esfera do vidro de uma vigia. def.C é o centro da abertura no plano do aro; W aponta para o mar.
function cupulaDe(def) {
  const { C, X, Y, W } = def, { R, r, fundo } = def.cupula;
  const wc = fundo - Math.sqrt(R * R - r * r);
  const centro = C.clone().addScaledVector(W, wc);
  const ponto = (x, y) => C.clone().addScaledVector(X, x).addScaledVector(Y, y).addScaledVector(W, wc + Math.sqrt(R * R - x * x - y * y));
  return { R, r, fundo, centro, ponto };
}

// A malha passa do corte: a sobra fica atrás do fim do túnel, sem fresta entre os dois polígonos.
// Numa parede curva o túnel abre em leque e chega a 2,3% além do raio nas pontas: quem passa de folga é o vidro (folga 1,04).
function malhaCupula(def, cup, aneis, setores, folga) {
  const pos = [], uv = [], idx = [];
  const borda = cup.r * folga;
  const poe = (x, y) => {
    const p = cup.ponto(x, y);
    pos.push(p.x, p.y, p.z);
    uv.push(x / def.a, y / def.b);
  };
  poe(0, 0);
  for (let i = 1; i <= aneis; i++) {
    const rho = (borda * i) / aneis;
    for (let j = 0; j < setores; j++) {
      const t = (j / setores) * Math.PI * 2;
      poe(rho * Math.cos(t), rho * Math.sin(t));
    }
  }
  for (let j = 0; j < setores; j++) idx.push(0, 1 + j, 1 + (j + 1) % setores);
  for (let i = 1; i < aneis; i++) {
    const a0 = 1 + (i - 1) * setores, a1 = 1 + i * setores;
    for (let j = 0; j < setores; j++) {
      const k = (j + 1) % setores;
      idx.push(a0 + j, a1 + j, a1 + k, a0 + j, a1 + k, a0 + k);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// Quanto o raio de frente anda na água, do meio do vidro até o vídeo. Abaixo disso não há absorção.
function caminhoDeFrente(def, cup, centroMar, raioMar) {
  const o = cup.ponto(0, 0).sub(centroMar);
  const b = o.dot(def.W);
  return Math.sqrt(b * b - o.lengthSq() + raioMar * raioMar) - b;
}

function criaVigia(cena, def, canal, comuns, aneis, setores) {
  const cup = cupulaDe(def);
  const { centro, R, X, Y, W } = def.mar;
  const aspecto = (16 / 9) * (def.recorte[2] / def.recorte[3]);
  return criaVidro(cena, malhaCupula(def, cup, aneis, setores, def.chapa ? 1.04 : 1.02), canal, comuns, {
    id: def.id, recorte: def.recorte, luzVidro: def.luzVidro,
    cup: cup.centro, marC: centro, cen: centro, ex: X, ey: Y, ew: W,
    marR: new THREE.Vector2(R, R), esc: new THREE.Vector2(1 / def.q, aspecto / def.q),
    agua0: caminhoDeFrente(def, cup, centro, R),
  });
}

// Aro de latão com túnel até o vidro. k escala as medidas do aro. O túnel passa 3 cm do vidro: nunca abre fresta.
function perfilAro(k, fundoVidro) {
  return [[0, fundoVidro + 0.03], [0, 0.06 * k], ...perfilAroSemTunel(k)];
}

// Na antepara, o aro é desenhado na chapa (def.chapa) e depois enrolado. Nas paredes, é plano mesmo.
function montaAro(def, latao, rebites, passoParafuso, raioParafuso) {
  const { a, b, k, chapa } = def;
  const { C, X, Y, W } = chapa ?? def;
  const g = varreElipse(C, X, Y, W, a, b, perfilAro(k, def.cupula.fundo), a > 1 ? 128 : 48);
  latao.push(chapa ? dobraGeo(g) : g);
  poeParafusos(def, rebites, passoParafuso, raioParafuso);
}

// Parafusos na face do aro.
function poeParafusos(def, rebites, passo, raio) {
  const { a, b, k, chapa } = def;
  const { C, X, Y, W } = chapa ?? def;
  const per = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
  const n = Math.round(per / passo);
  const nRoom = W.clone().negate();
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const c = Math.cos(t), s = Math.sin(t), l = Math.hypot(c / a, s / b);
    const x = a * c + (0.21 * k * c) / a / l, y = b * s + (0.21 * k * s) / b / l;
    const p = C.clone().addScaledVector(X, x).addScaledVector(Y, y).addScaledVector(W, -0.19 * k);
    if (chapa) rebites.push({ p: dobraPonto(p.x, p.y, p.z), n: dobraNormal(p.x, nRoom), r: raio });
    else rebites.push({ p, n: nRoom, r: raio });
  }
}

// Clarão ao redor da vitrine: sem pós-processamento, é o que tira o recorte duro da janela contra a parede.
// Em anéis, para acompanhar a curva da parede, e medido na chapa: o uv guarda x e y dela, e uAB é a elipse desenhada nela.
function criaHalo(cena, def, comuns) {
  const { C, X, Y, W } = def.chapa;
  const perfil = [0.3, 0.6, 1, 1.5, 2, 2.6].map((f) => [f, -0.22]);
  const g = dobraGeo(varreElipse(C, X, Y, W, def.a, def.b, perfil, 96), true);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uAgua: comuns.uAgua, uLuzC: comuns.uLuzC, uJanC: comuns.uJanC, uAB: { value: new THREE.Vector2(def.a, def.b) } },
    vertexShader: `varying vec2 vP; void main(){ vP=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 uAgua,uLuzC,uJanC; uniform vec2 uAB; varying vec2 vP;
      void main(){
        float e=length((vP-uJanC.xy)/uAB);
        float a=exp(-(e-1.)*3.4)*smoothstep(1.62,1.25,e);
        gl_FragColor=vec4(pow(mix(uAgua,uLuzC,.3),vec3(.4545))*a*.26,1.);
      }`,
  });
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  cena.add(m);
}

// Feixe de luz atravessando o ar da sala: uma casca cônica que some nas bordas, cortada pelo piso.
// Nasce na chapa (z = -7), por isso a distância é medida dela e não do plano da luz da janela: é o que esconde o começo da casca.
function criaFeixe(cena, def, comuns) {
  const F = comuns.uFonte.value;
  const pos = [], idx = [], N = 64, S = 8;
  const C = def.chapa.C, largura = xDaChapa(def.a);
  const fim = (SALA.Z_POPA - 3 - F.z) / (C.z - F.z);
  for (let j = 0; j <= N; j++) {
    const t = (j / N) * Math.PI * 2;
    const p = new THREE.Vector3(C.x + largura * 0.98 * Math.cos(t), C.y + def.b * 0.98 * Math.sin(t), C.z);
    for (let s = 0; s <= S; s++) {
      const k = 1 + (fim - 1) * (s / S);
      pos.push(F.x + (p.x - F.x) * k, F.y + (p.y - F.y) * k, F.z + (p.z - F.z) * k);
    }
  }
  const L = S + 1;
  for (let j = 0; j < N; j++) for (let s = 0; s < S; s++) {
    const a = j * L + s;
    idx.push(a, a + 1, a + L, a + 1, a + L + 1, a + L);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uAgua: comuns.uAgua, uLuzC: comuns.uLuzC },
    vertexShader: `varying vec3 vW; varying vec3 vN; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vN=normal; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uAgua,uLuzC; varying vec3 vW; varying vec3 vN;
      void main(){
        vec3 V=normalize(cameraPosition-vW);
        float f=abs(dot(normalize(vN),V));
        float d=vW.z-(${C.z.toFixed(1)});
        float a=f*f*f*smoothstep(.1,1.2,d)*exp(-d*.2)*smoothstep(0.,.8,length(vW-cameraPosition));
        gl_FragColor=vec4(pow(mix(uAgua,uLuzC,.3),vec3(.4545))*a*.13,1.);
      }`,
  });
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  cena.add(m);
}

export function criaJanelas(cena, canais, sala, comuns) {
  const vidros = [];
  const { latao, rebites } = sala;

  const eixosChapa = { X: new THREE.Vector3(1, 0, 0), Y: new THREE.Vector3(0, 1, 0), W: new THREE.Vector3(0, 0, -1) };
  const naChapa = (x, y) => ({ C: new THREE.Vector3(x, y, SALA.Z_PROA), ...eixosChapa });

  // Vitrine. vidros[0] é sempre ela: a camada cabecada depende disso.
  {
    const { a, b, y } = VITRINE;
    const chapa = naChapa(0, y);
    const def = { a, b, k: 1, chapa };
    latao.push(dobraGeo(varreElipse(chapa.C, chapa.X, chapa.Y, chapa.W, a, b, perfilAroSemTunel(1), 128)));
    poeParafusos(def, rebites, 0.46, 0.028);
    montaTunel(a, b, y, latao);
    montaCaixilhoEsfera(b, latao, rebites);

    const { prof, c0, alvo, esc } = VITRINE.mar;
    const cen = new THREE.Vector3(...c0);
    const ew = new THREE.Vector3(...alvo).sub(cen).normalize();
    const ex = new THREE.Vector3(1, 0, 0).addScaledVector(ew, -ew.x).normalize();
    const ey = new THREE.Vector3(0, 1, 0).addScaledVector(ew, -ew.y).normalize();
    // Na água tudo parece mais perto: z metros aparentes são 1,33 z de raio.
    const agua = 1.33 * prof;
    vidros.push(criaVidro(cena, malhaVitrine(b), canais[VITRINE.canal], comuns, {
      id: 'vitrine', a, b, racha: true, recorte: VITRINE.recorte, luzVidro: comuns.uLuzC,
      cup: centroVitrine, marC: centroVitrine, cen, ex, ey, ew,
      marR: new THREE.Vector2(Rv + agua, Rv + agua), esc: new THREE.Vector2(2 * esc * (9 / 16), 2 * esc), agua0: agua,
    }));
    criaHalo(cena, def, comuns);
    criaFeixe(cena, def, comuns);
  }

  // Vigias da parede: uma esfera só para o lado inteiro, centrada no eixo do casco e na linha da chapa.
  VIGIAS_PAREDE.forEach((v, i) => {
    const mar = MARES_LATERAIS[v.lado];
    const meio = posicaoVigiaParede({ lado: v.lado, z: 0 });
    const centro = meio.C.clone().addScaledVector(meio.W, -meio.C.x / meio.W.x);
    const def = {
      id: `parede${v.lado}${i}`, ...posicaoVigiaParede(v), a: v.r, b: v.r, k: 0.42, cupula: v.cupula,
      recorte: [0, 0, 1, 1], q: mar.q, luzVidro: { value: comuns.uVigCor.value[v.lado === 'E' ? 0 : 1] },
      mar: { centro, R: mar.R, X: meio.X, Y: meio.Y, W: meio.W },
    };
    montaAro(def, latao, rebites, 0.27, 0.017);
    vidros.push(criaVigia(cena, def, canais[mar.canal], comuns, 5, 28));
  });

  // Vigias da antepara: a calota segue os eixos locais da parede curva e o aro é enrolado nela. O que se vê por elas é o mar da vitrine.
  VIGIAS_ANTEPARA.forEach((v, i) => {
    const pequena = v.r < 0.4;
    const def = {
      id: `antepara${i}`, ...eixosDaParede(v.x, v.y), chapa: naChapa(v.x, v.y), a: v.r, b: v.r, k: pequena ? 0.3 : 0.42, cupula: v.cupula,
    };
    montaAro(def, latao, rebites, pequena ? 0.2 : 0.27, 0.015);
    const cup = cupulaDe(def);
    vidros.push(criaVidro(cena, malhaCupula(def, cup, pequena ? 4 : 5, pequena ? 22 : 28, 1.04), canais[VITRINE.canal], comuns, {
      id: def.id, cup: cup.centro, mesmaTela: vidros[0],
    }));
  });

  return vidros;
}
