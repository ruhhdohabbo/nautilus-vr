// Texturas procedurais assadas na GPU uma vez, ao abrir. Nenhum arquivo de imagem é baixado.
// Cada superfície gera duas: A (cor + rugosidade) e B (normal XY + altura).
import * as THREE from 'three';
import { PALETA, param } from './config.js';

const lin = (hex) => {
  const c = new THREE.Color(hex);
  return `vec3(${c.r.toFixed(4)},${c.g.toFixed(4)},${c.b.toFixed(4)})`;
};

const VERT = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;

const RUIDO = /* glsl */`
varying vec2 vUv;
uniform float uPasso;
float h21(vec2 p){ vec3 q=fract(vec3(p.xyx)*.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
float ruido(vec2 p, vec2 per){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  float a=h21(mod(i,per)), b=h21(mod(i+vec2(1.,0.),per)), c=h21(mod(i+vec2(0.,1.),per)), d=h21(mod(i+vec2(1.,1.),per));
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}
float fbm(vec2 p, vec2 per, int oit){
  float s=0., a=.5;
  for(int i=0;i<oit;i++){ s+=a*ruido(p,per); p*=2.; per*=2.; a*=.5; }
  return s;
}`;

const SAIDA = /* glsl */`
void main(){
  vec3 cor; float rug, h;
  superficie(vUv,cor,rug,h);
#ifdef SAIDA_B
  float e=uPasso, hx, hy, d; vec3 c2; float r2;
  superficie(vUv+vec2(e,0.),c2,r2,hx);
  superficie(vUv+vec2(0.,e),c2,r2,hy);
  vec2 n=-vec2(hx-h,hy-h)/e*uForca;
  gl_FragColor=vec4(n*.5+.5,h,1.);
#else
  gl_FragColor=vec4(cor,rug);
#endif
}`;

const FERRO = /* glsl */`
const float uForca=.012;
void superficie(vec2 uv,out vec3 a,out float r,out float h){
  float n1=fbm(uv*14.,vec2(14.),5);
  float escorrido=fbm(uv*vec2(40.,4.)+7.,vec2(40.,4.),4);
  float pontos=ruido(uv*170.,vec2(170.));
  float f=smoothstep(.6,.86,fbm(uv*11.+3.,vec2(11.),5)+escorrido*.16-.05);
  a=mix(${lin(PALETA.olivaCinza)},${lin(PALETA.oliva)},.45)*(.88+.2*n1);
  a=mix(a,${lin(PALETA.ferrugem)},f*.42);
  a*=.92+.16*escorrido;
  r=mix(.58,.92,f);
  h=n1*.5+pontos*.035-f*.12;
}`;

const MADEIRA = /* glsl */`
const float uForca=.006;
void superficie(vec2 uv,out vec3 a,out float r,out float h){
  const float NP=10.;
  float id=floor(uv.x*NP), fx=fract(uv.x*NP);
  float vv=fract(uv.y+h21(vec2(id,3.)));
  float seg=floor(vv*2.), fy=fract(vv*2.);
  float pid=h21(vec2(id,seg+11.));
  float junta=smoothstep(0.,.02,fx)*smoothstep(0.,.02,1.-fx)*smoothstep(0.,.004,fy)*smoothstep(0.,.004,1.-fy);
  float veio=fbm(vec2(uv.x*NP*7.+floor(pid*50.),uv.y*5.),vec2(NP*7.,5.),5);
  float anel=sin(veio*38.+pid*20.)*.5+.5;
  a=mix(vec3(.052,.026,.018),${lin(PALETA.ferrugem)},veio*.8+anel*.22);
  a*=.72+.5*pid;
  a*=mix(.16,1.,junta);
  r=.34+.26*veio;
  h=junta*.5+anel*.02;
}`;

// O tapete não repete: uv vai de 0 a 1 no tapete inteiro (7 x 3,6 m).
const TAPETE = /* glsl */`
const float uForca=.002;
void superficie(vec2 uv,out vec3 a,out float r,out float h){
  vec2 p=(uv-.5)*vec2(7.,3.6);
  float borda=min(3.5-abs(p.x),1.8-abs(p.y));
  vec3 fundo=${lin(PALETA.tijolo)}*.5, marinho=${lin(PALETA.marinho)}*.72, caqui=${lin(PALETA.caqui)}*.72, terra=${lin(PALETA.ferrugem)}*.8;
  a=fundo;
  float losango=abs(fract(p.x*1.6+p.y*1.6)-.5)+abs(fract(p.x*1.6-p.y*1.6)-.5);
  a=mix(a,mix(terra,caqui,smoothstep(.34,.3,losango)),step(borda,.62));
  a=mix(a,caqui,step(borda,.65)*step(.58,borda));
  a=mix(a,marinho,step(borda,.28));
  a=mix(a,caqui,step(borda,.33)*step(.28,borda));
  a=mix(a,marinho,step(borda,.07));
  float ang=atan(p.y,p.x), lob=1.+.14*cos(ang*8.);
  float m=length(p/vec2(1.5,.82))/lob;
  a=mix(a,marinho,smoothstep(1.02,1.,m));
  a=mix(a,caqui,smoothstep(.86,.84,m)*smoothstep(.76,.78,m));
  a=mix(a,fundo*1.25,smoothstep(.76,.74,m));
  a=mix(a,caqui,smoothstep(.34,.32,m));
  a=mix(a,terra,smoothstep(.26,.24,m));
  float fio=ruido(uv*vec2(900.,460.),vec2(900.,460.));
  float gasto=fbm(uv*vec2(14.,7.),vec2(14.,7.),4);
  a*=.72+.42*fio;
  a=mix(a,vec3(dot(a,vec3(.33)))*1.1,smoothstep(.45,.7,gasto)*.35);
  r=.95;
  h=fio*.5;
}`;

// Cáustica clássica e repetível (Dave Hoskins / joltz0r), usada para a luz dançando na sala.
const CAUSTICA = /* glsl */`
varying vec2 vUv;
void main(){
  const float TAU=6.28318530718;
  vec2 p=mod(vUv*TAU,TAU)-250.;
  vec2 i=p; float c=1., forca=.005;
  for(int n=0;n<5;n++){
    float t=1.-3.5/float(n+1);
    i=p+vec2(cos(t-i.x)+sin(t+i.y),sin(t-i.y)+cos(t+i.x));
    c+=1./length(vec2(p.x/(sin(i.x+t)/forca),p.y/(cos(i.y+t)/forca)));
  }
  c/=5.; c=1.17-pow(c,1.4);
  gl_FragColor=vec4(vec3(pow(abs(c),8.)),1.);
}`;

// Película do vidro: R = fuligem na borda + condensação embaixo + marcas de água, G = pó fino.
// É ela, com os caixilhos e o reflexo, que segura a profundidade do vidro no estéreo.
const PELICULA = /* glsl */`
void main(){
  vec2 q=vUv*2.-1.; float r=length(q);
  float n=fbm(vUv*6.,vec2(6.),4), n2=fbm(vUv*vec2(3.,18.)+4.,vec2(3.,18.),3);
  float fuligem=.55*smoothstep(.62,1.02,r+(n-.5)*.18);
  float cond=.22*(1.-smoothstep(-.95,-.35,q.y+(n-.5)*.35));
  float marcas=.10*smoothstep(.62,.8,n2)*(1.-smoothstep(-.6,.2,q.y));
  float po=smoothstep(.93,.985,ruido(vUv*230.,vec2(230.)))*(.35+.65*n);
  gl_FragColor=vec4(clamp(fuligem+cond+marcas,0.,1.),po,0.,1.);
}`;

// ?pelicula=0: vidro limpo. Uma textura preta de 1 px, para o shader não mudar.
function semPelicula() {
  const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
}

export function criaTexturas(renderer) {
  const cena = new THREE.Scene();
  const cam = new THREE.Camera();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  cena.add(quad);

  const assa = (frag, tam, { defines = {}, aniso = 4 } = {}) => {
    const alvo = new THREE.WebGLRenderTarget(tam, tam, {
      depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, anisotropy: aniso,
    });
    quad.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: frag, defines, depthTest: false, depthWrite: false, blending: THREE.NoBlending,
      uniforms: { uPasso: { value: 1 / tam } },
    });
    renderer.setRenderTarget(alvo);
    renderer.render(cena, cam);
    renderer.setRenderTarget(null);
    quad.material.dispose();
    return alvo.texture;
  };

  const par = (corpo, tam, aniso) => ({
    a: assa(RUIDO + corpo + SAIDA, tam, { aniso }),
    b: assa(RUIDO + corpo + SAIDA, tam, { aniso, defines: { SAIDA_B: 1 } }),
  });

  return {
    ferro: par(FERRO, 1024, 4),
    madeira: par(MADEIRA, 1024, 8),
    tapete: par(TAPETE, 1024, 4),
    caustica: assa(CAUSTICA, 512, { aniso: 2 }),
    pelicula: param('pelicula') === '0' ? semPelicula() : assa(RUIDO + PELICULA, 512, { aniso: 2 }),
  };
}
