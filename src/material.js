// Luz da sala, feita à mão para caber no óculos: sem sombras em tempo real e sem pós-processamento.
// A janela é a luz principal: a cor vem do vídeo, e o reflexo e a poça de luz são calculados direto no shader.
import * as THREE from 'three';
import { SALA, PALETA } from './config.js';

export function criaComuns(lampadas, caustica, vitrine) {
  // A luz da janela nasce atrás de toda peça da abertura: nenhuma fica sem ela. A elipse é a do mundo, com o arco já enrolado.
  const zJanela = -8.7;
  return {
    uT: { value: 0 },
    uExp: { value: 1 },
    uCaus: { value: caustica },
    uLampPos: { value: lampadas },
    uLampCor: { value: new THREE.Color(0xD2DBC0).multiplyScalar(2.1) },
    uJanC: { value: new THREE.Vector3(0, vitrine.y, zJanela) },
    uJanAB: { value: new THREE.Vector2(4.284, vitrine.b) },
    uJanArea: { value: Math.PI * vitrine.a * vitrine.b },
    uFonte: { value: new THREE.Vector3(0, 14, -22) },
    uAgua: { value: new THREE.Color(PALETA.teal).multiplyScalar(0.34) },
    uLuzE: { value: new THREE.Vector3(0.05, 0.09, 0.1) },
    uLuzC: { value: new THREE.Vector3(0.05, 0.09, 0.1) },
    uLuzD: { value: new THREE.Vector3(0.05, 0.09, 0.1) },
    uVigPos: { value: [new THREE.Vector3(-SALA.A + 0.4, 2.3, 0), new THREE.Vector3(SALA.A - 0.4, 2.3, 0)] },
    uVigCor: { value: [new THREE.Vector3(), new THREE.Vector3()] },
    uAmbA: { value: new THREE.Color(0x3a4a50) },
    uAmbB: { value: new THREE.Color(0x24211a) },
    uNevoa: { value: 0.022 },
    uCorNevoa: { value: new THREE.Color(0x0b1418) },
    uArco: { value: new THREE.Vector3(SALA.A, SALA.B, SALA.YC) },
    // A sala assada num cubo: uCuboK só vai a 1 depois da captura. Caixa da projeção do reflexo e centro de onde o cubo foi tirado.
    uSalaRefl: { value: null },
    uCuboK: { value: 0 },
    uCxMin: { value: new THREE.Vector3(-6.6, 0, -8.8) },
    uCxMax: { value: new THREE.Vector3(6.6, 6.5, 7) },
    uCxC: { value: new THREE.Vector3(0, 2, 0) },
  };
}

const VERT = /* glsl */`
uniform float uUvEsc;
varying vec3 vW; varying vec3 vN; varying vec2 vUv; varying vec3 vCor;
void main(){
  vec4 p=vec4(position,1.); vec3 n=normal;
  vCor=vec3(1.);
#ifdef USE_COLOR
  vCor*=color;
#endif
#ifdef USE_INSTANCING_COLOR
  vCor*=instanceColor;
#endif
#ifdef USE_INSTANCING
  p=instanceMatrix*p; n=mat3(instanceMatrix)*n;
#endif
  vec4 w=modelMatrix*p;
  vW=w.xyz; vN=mat3(modelMatrix)*n; vUv=uv*uUvEsc;
  gl_Position=projectionMatrix*viewMatrix*w;
}`;

const FRAG = /* glsl */`
#define N_LAMP 4
uniform sampler2D uTexA, uTexB, uCaus;
uniform vec3 uCor, uEmis; uniform float uRough, uMetal, uNormalK, uPiso, uOpac;
uniform float uT, uExp, uJanArea, uNevoa;
uniform vec3 uLampPos[N_LAMP]; uniform vec3 uLampCor;
uniform vec3 uJanC, uFonte, uAgua, uLuzE, uLuzC, uLuzD;
uniform vec2 uJanAB;
uniform vec3 uVigPos[2]; uniform vec3 uVigCor[2];
uniform vec3 uAmbA, uAmbB, uCorNevoa, uArco;
varying vec3 vW; varying vec3 vN; varying vec2 vUv; varying vec3 vCor;

vec3 corJanela(float x){
  float s=clamp(x/uJanAB.x,-1.,1.);
  vec3 v=s<0.?mix(uLuzC,uLuzE,-s):mix(uLuzC,uLuzD,s);
  return mix(uAgua,v,.4);
}
float luzDisco(vec3 P,vec3 N,vec3 C,vec3 W,float A){
  vec3 L=C-P; float d2=dot(L,L); L/=sqrt(d2);
  float nl=clamp((dot(N,L)+.3)/1.3,0.,1.);
  return A*nl*max(dot(W,-L),0.)/(3.14159*d2+A);
}
// Luz de cima que atravessa a vitrine e cai no chão da sala, com a cáustica dançando dentro.
vec3 piscina(vec3 P,vec3 N){
  vec3 S=normalize(uFonte-P);
  // A poça segue calculada no plano z = -7, para não sair do lugar no piso.
  float t=(-7.-P.z)/min(S.z,-.05);
  vec2 q=(P.xy+S.xy*t-uJanC.xy)/uJanAB;
  float r=length(q), dist=max(t,0.);
  float pen=.05+.014*dist;
  float m=1.-smoothstep(1.-pen,1.+pen,r);
  m*=1.-.45*(1.-smoothstep(pen*.3,pen*1.1,abs(r-.7)));
  float c1=texture2D(uCaus,q*2.7+uT*vec2(.021,.013)).r;
  float c2=texture2D(uCaus,q*4.1-uT*vec2(.017,.024)+.37).r;
  float c=min(c1,c2)*9.;
  return mix(uAgua,uLuzC,.3)*m*max(dot(N,S),0.)*(.55+c)*6.;
}
vec3 reflexoJanela(vec3 P,vec3 R,float rough){
  if(R.z>=-.02) return vec3(0.);
  float t=(uJanC.z-P.z)/R.z;
  vec2 q=(P.xy+R.xy*t-uJanC.xy)/uJanAB;
  float s=.04+rough*rough*2.2;
  float m=1.-smoothstep(1.-s,1.+s,length(q));
  return corJanela(q.x*uJanAB.x)*m;
}
vec3 perturba(vec3 N,vec3 P,vec2 uv,vec2 nxy,float k){
  vec3 q0=dFdx(P), q1=dFdy(P); vec2 s0=dFdx(uv), s1=dFdy(uv);
  vec3 q1p=cross(q1,N), q0p=cross(N,q0);
  vec3 T=q1p*s0.x+q0p*s1.x, B=q1p*s0.y+q0p*s1.y;
  float det=max(dot(T,T),dot(B,B));
  float inv=det==0.?0.:1./sqrt(det);
  return normalize(T*inv*nxy.x*k+B*inv*nxy.y*k+N);
}
vec3 filme(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
float ign(vec2 p){ return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715)))); }

void main(){
  vec4 A=texture2D(uTexA,vUv), B=texture2D(uTexB,vUv);
  vec3 alb=A.rgb*uCor*vCor;
  float rough=clamp(A.a*uRough,.06,1.);
  vec3 N=perturba(normalize(vN),vW,vUv,B.xy*2.-1.,uNormalK);
  vec3 V=normalize(cameraPosition-vW);
  float nv=max(dot(N,V),.001);
  vec3 F0=mix(vec3(.04),alb,uMetal);
  vec3 dif=alb*(1.-uMetal);

  vec3 Ld=mix(uAmbB,uAmbA,N.y*.5+.5), Ls=vec3(0.);
  float brilho=2./(rough*rough*rough*rough+.002);
  for(int i=0;i<N_LAMP;i++){
    vec3 L=uLampPos[i]-vW; float d2=dot(L,L); L/=sqrt(d2);
    float a=1./(1.+d2*.32), nl=max(dot(N,L),0.);
    Ld+=uLampCor*a*(nl*.85+.15);
    vec3 H=normalize(L+V);
    Ls+=uLampCor*a*nl*pow(max(dot(N,H),0.),brilho)*(brilho+8.)*.04;
  }
  vec3 corJ=corJanela(vW.x);
  Ld+=corJ*luzDisco(vW,N,uJanC,vec3(0.,0.,1.),uJanArea)*9.;
  for(int i=0;i<2;i++){
    vec3 W=vec3(-sign(uVigPos[i].x),0.,0.);
    Ld+=uVigCor[i]*luzDisco(vW,N,uVigPos[i],W,5.)*5.;
  }
  Ld+=piscina(vW,N);

  // Oclusão aproximada: encontro do piso com a parede e pé das paredes.
  float e=length(vec2(vW.x/uArco.x,(vW.y-uArco.z)/uArco.y));
  float ao=mix(mix(.45,1.,smoothstep(0.,1.2,vW.y)),mix(.35,1.,smoothstep(0.,.17,1.-e)),uPiso);
  ao*=mix(.72,1.,smoothstep(.1,.5,B.b));

  vec3 R=reflect(-V,N);
  vec3 F=F0+(max(vec3(1.-rough),F0)-F0)*pow(1.-nv,5.);
  vec3 refl=reflexoJanela(vW,R,rough)*5.+mix(uAmbB,uAmbA,R.y*.5+.5)*.9+uLampCor*(.05+.07*smoothstep(-.2,.9,R.y));
  vec3 cor=dif*Ld*ao+(Ls+refl)*F*mix(.55,1.,ao)+uEmis;

  float d=length(vW-cameraPosition);
  cor=mix(cor,uCorNevoa+corJ*.12,1.-exp(-d*uNevoa));

  gl_FragColor=vec4(filme(cor*uExp),uOpac);
  #include <colorspace_fragment>
  gl_FragColor.rgb+=(ign(gl_FragCoord.xy)-.5)/255.;
}`;

// Material da sala para qualquer peça nova. Cor por instância (InstancedMesh.instanceColor) e por vértice
// (cores: true + atributo color) já entram na conta. emissao: cor linear somada à luz. opacidade < 1 liga a transparência.
export function criaMaterial(comuns, { tex, cor = 0xffffff, rough = 1, metal = 0, normalK = 1, uvEsc = 1, piso = 0, lado = THREE.FrontSide, cores = false, emissao = 0x000000, opacidade = 1 }) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, side: lado, vertexColors: cores,
    transparent: opacidade < 1, depthWrite: opacidade >= 1,
    uniforms: {
      ...comuns,
      uEmis: { value: new THREE.Color(emissao) }, uOpac: { value: opacidade },
      uTexA: { value: tex.a }, uTexB: { value: tex.b },
      uCor: { value: new THREE.Color(cor) }, uRough: { value: rough }, uMetal: { value: metal },
      uNormalK: { value: normalK }, uUvEsc: { value: uvEsc }, uPiso: { value: piso },
    },
  });
}
