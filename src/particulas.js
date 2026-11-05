// Partículas em suspensão: "neve marinha" do lado de fora da vitrine, entre o vidro e o vídeo,
// e poeira dentro da sala. São elas que dão volume ao espaço no estéreo.
import * as THREE from 'three';
import { PALETA, SALA } from './config.js';
import { VITRINE } from './janelas.js';

const VERT = /* glsl */`
uniform float uT, uAltPx;
uniform vec3 uMin, uTam, uDrift;
#ifdef ESFERA
uniform vec3 uCv; uniform vec2 uCasca; // centro do vidro; raio mínimo e espessura da casca
uniform float uNeveK;
#endif
attribute vec3 aBase; attribute vec2 aVar;
varying float vA;
void main(){
  vec3 p=aBase*uTam+uDrift*uT*(.6+aVar.x*.8);
#ifdef ESFERA
  // A caixa é (ângulo em volta do eixo, ângulo de altura, fração da casca): a neve fica entre o vidro e a imagem, sem nunca passar para trás dela.
  p.x+=sin(uT*.13+aVar.y*40.)*.02;
  p.y+=cos(uT*.11+aVar.x*40.)*.016;
  p=uMin+mod(p,uTam);
  float rr=uCasca.x+uCasca.y*p.z;
  p=uCv+rr*vec3(cos(p.y)*sin(p.x),sin(p.y),-cos(p.y)*cos(p.x));
#else
  p.x+=sin(uT*.13+aVar.y*40.)*.25;
  p.y+=cos(uT*.11+aVar.x*40.)*.2;
  p=uMin+mod(p,uTam);
#endif
  vec4 mv=viewMatrix*vec4(p,1.);
  float d=max(-mv.z,.05);
  float tam=(.012+aVar.y*aVar.y*.03);
  float px=tam*projectionMatrix[1][1]*uAltPx*.5/d;
  gl_PointSize=clamp(px,1.3,26.);
  float k=min(px/1.3,1.);
  vA=k*smoothstep(.45,1.3,d)*smoothstep(0.,.1,fract(uT*.021+aVar.x))*(.25+aVar.x*.75);
#ifdef ESFERA
  vA*=uNeveK;
#endif
  gl_Position=projectionMatrix*mv;
}`;

const FRAG = /* glsl */`
uniform vec3 uCor;
varying float vA;
void main(){
  vec2 q=gl_PointCoord*2.-1.;
  float a=1.-dot(q,q);
  if(a<=0.) discard;
#ifdef ESFERA
  // A neve é da cor do mar atrás dela, com um piso para não sumir na água escura.
  gl_FragColor=vec4(uCor*.6+vec3(.05,.07,.07),a*a*vA);
#else
  gl_FragColor=vec4(uCor,a*a*vA);
#endif
}`;

function nuvem(cena, n, min, tam, drift, cor, comuns, esfera = null) {
  const g = new THREE.BufferGeometry();
  const base = new Float32Array(n * 3), vari = new Float32Array(n * 2);
  for (let i = 0; i < n * 3; i++) base[i] = Math.random();
  for (let i = 0; i < n * 2; i++) vari[i] = Math.random();
  g.setAttribute('position', new THREE.BufferAttribute(base, 3));
  g.setAttribute('aBase', new THREE.BufferAttribute(base, 3));
  g.setAttribute('aVar', new THREE.BufferAttribute(vari, 2));
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    defines: esfera ? { ESFERA: 1 } : {},
    uniforms: {
      uT: comuns.uT, uAltPx: comuns.uAltPx,
      uMin: { value: min }, uTam: { value: tam }, uDrift: { value: drift }, uCor: { value: cor },
      ...esfera,
    },
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false;
  cena.add(p);
  return p;
}

export function criaParticulas(cena, comuns, q, canais) {
  // Neve marinha numa casca em volta do vidro, só no leque que a vitrine enxerga. A cor é uma referência à cor do vídeo agora.
  const fora = nuvem(cena, Math.round(300 * q.poeira),
    new THREE.Vector3(-0.6, -0.4, 0), new THREE.Vector3(1.2, 0.8, 1),
    new THREE.Vector3(0.004, -0.006, 0.003),
    canais[VITRINE.canal].corC, comuns, {
      uCv: { value: new THREE.Vector3(...VITRINE.vidro.C) },
      uCasca: { value: new THREE.Vector2(11.72, 8) },
      uNeveK: { value: 1 },
    });
  const dentro = nuvem(cena, Math.round(420 * q.poeira),
    new THREE.Vector3(-5.8, 0.1, SALA.Z_PROA + 0.3), new THREE.Vector3(11.6, 5.4, 13.4),
    new THREE.Vector3(0.012, -0.008, 0.018),
    new THREE.Color(PALETA.nevoa).multiplyScalar(0.34), comuns);
  return { fora, dentro };
}
