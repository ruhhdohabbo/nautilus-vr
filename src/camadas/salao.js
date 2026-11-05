// O salão do Capitão Nemo: o órgão na popa, a biblioteca nas baias, a coleção nas vitrines e a carta da viagem.
// Tudo é assado em poucas malhas: dez desenhos no máximo, contando a valva da tridacna, que respira devagar.
import * as THREE from 'three';
import { criaMaterial } from '../material.js';
import { malha, texturaNeutra, texturaPlana } from './salao_comum.js';
import { montaOrgao, folhasDePartitura } from './salao_orgao.js';
import { montaBiblioteca } from './salao_biblioteca.js';
import { montaColecao } from './salao_colecao.js';
import './salao_conchas.js'; // pedido junto com os outros, para não esperar mais uma rodada de rede.
import { montaQuadro } from './salao_quadro.js';

// Vidro das vitrines: quase nada de cor, só o reflexo da vitrine do salão e o brilho das lâmpadas.
function materialVidro(comuns) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, premultipliedAlpha: true,
    uniforms: {
      uJanC: comuns.uJanC, uJanAB: comuns.uJanAB, uLuzC: comuns.uLuzC, uAgua: comuns.uAgua,
      uLampPos: comuns.uLampPos, uLampCor: comuns.uLampCor, uAmbA: comuns.uAmbA,
    },
    vertexShader: /* glsl */`
      varying vec3 vW; varying vec3 vN;
      void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vN=normal; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uJanC,uLuzC,uAgua,uLampCor,uAmbA; uniform vec2 uJanAB; uniform vec3 uLampPos[4];
      varying vec3 vW; varying vec3 vN;
      void main(){
        vec3 V=normalize(cameraPosition-vW), N=normalize(vN);
        float nv=max(dot(N,V),0.);
        float F=.04+.96*pow(1.-nv,5.);
        vec3 R=reflect(-V,N);
        vec3 c=uAmbA*.5*F;
        if(R.z<-.02){
          float t=(uJanC.z-vW.z)/R.z;
          vec2 q=(vW.xy+R.xy*t-uJanC.xy)/uJanAB;
          c+=mix(uAgua,uLuzC,.5)*(1.-smoothstep(.85,1.15,length(q)))*5.*(F+.03);
        }
        for(int i=0;i<4;i++){
          float d=max(dot(R,normalize(uLampPos[i]-vW)),0.);
          c+=uLampCor*(pow(d,1400.)*.22+pow(d,120.)*.004);
        }
        gl_FragColor=vec4(c,.028+F*.5);
        #include <colorspace_fragment>
      }`,
  });
}

// Sombra de contato no piso: é ela que assenta as peças no chão, sem sombra em tempo real. Multiplica o que já foi pintado.
// [x0, x1, z0, z1, alcance], em metros.
const PES = [
  [2.65, 4.35, -3.25, -1.55, 0.5], // tridacna
  [-4.08, -3.12, -2.88, -1.92, 0.5], // corais
  [3.65, 4.45, -0.25, 1.45, 0.35], [-4.45, -3.65, -0.25, 1.45, 0.35], // mesas
  [-3.3, 3.3, 6.3, 7, 0.5], // órgão
  [-1.24, 1.24, 5.68, 6.2, 0.5], // console
  [-0.75, 0.75, 5.26, 5.64, 0.25], // banco
  [5.1, 5.75, -3.6, 6.5, 0.3], [-5.75, -5.1, -3.6, 6.5, 0.3], // estantes
];
function criaSombra() {
  const pos = [], pe = [], alcance = [], idx = [];
  PES.forEach(([x0, x1, z0, z1, m], i) => {
    for (const [x, z] of [[x0 - m, z0 - m], [x0 - m, z1 + m], [x1 + m, z1 + m], [x1 + m, z0 - m]]) {
      pos.push(x, 0.016, z);
      pe.push((x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (z1 - z0) / 2);
      alcance.push(m);
    }
    const a = i * 4;
    idx.push(a, a + 1, a + 2, a, a + 2, a + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aPe', new THREE.Float32BufferAttribute(pe, 4));
  g.setAttribute('aAlc', new THREE.Float32BufferAttribute(alcance, 1));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
    blending: THREE.MultiplyBlending, premultipliedAlpha: true, depthWrite: false,
    vertexShader: /* glsl */`
      attribute vec4 aPe; attribute float aAlc;
      varying vec2 vP; varying vec4 vPe; varying float vAlc;
      void main(){ vP=position.xz; vPe=aPe; vAlc=aAlc; gl_Position=projectionMatrix*viewMatrix*vec4(position,1.); }`,
    fragmentShader: /* glsl */`
      varying vec2 vP; varying vec4 vPe; varying float vAlc;
      void main(){
        vec2 q=abs(vP-vPe.xy)-vPe.zw;
        float d=length(max(q,0.))+min(max(q.x,q.y),0.);
        gl_FragColor=vec4(vec3(1.-.62*(1.-smoothstep(-.02,vAlc,d))),1.);
      }`,
  }));
  m.name = 'salao:sombra';
  m.frustumCulled = false;
  // Depois do piso e do tapete, antes dos vidros.
  m.renderOrder = 1;
  return m;
}

export function cria(mundo) {
  const { cena, comuns, tex, jogador, eventos } = mundo;
  const L = { madeira: [], latao: [], pecas: [], nacar: [], vidro: [], papel: [] };
  const neutra = texturaNeutra();
  const brilhoLatao = new THREE.Color(2.2, 1.78, 1.22);

  const mat = {
    tubo: criaMaterial(comuns, { tex: tex.ferro, cor: brilhoLatao, rough: 0.5, metal: 1, normalK: 0.2 }),
    latao: criaMaterial(comuns, { tex: tex.ferro, cor: brilhoLatao, rough: 0.5, metal: 1, normalK: 0.2, cores: true }),
    madeira: criaMaterial(comuns, { tex: tex.madeira, cor: new THREE.Color(0.72, 0.63, 0.58), rough: 0.85, normalK: 0.25, cores: true }),
    pecas: criaMaterial(comuns, { tex: neutra, rough: 0.82, normalK: 0, cores: true }),
    nacar: criaMaterial(comuns, { tex: neutra, rough: 0.34, normalK: 0, cores: true }),
  };

  const obstaculos = jogador.obstaculos;
  const tubos = montaOrgao(L, mat.tubo, obstaculos);
  const livros = montaBiblioteca(L, comuns, criaMaterial);
  const trid = montaColecao(L, obstaculos);
  const quadro = montaQuadro(L, obstaculos);
  folhasDePartitura(L, quadro.recortes);
  mat.papel = criaMaterial(comuns, { tex: { a: quadro.tex, b: texturaPlana() }, rough: 0.9, normalK: 0, cores: true });

  const valva = malha([trid.superior], mat.nacar, 'salao:valva');
  valva.position.copy(trid.dobradica);

  // Peças grandes desenhadas antes da sala: o que está atrás delas nem chega a ser pintado.
  const opacas = [
    tubos, livros, valva,
    malha(L.madeira, mat.madeira, 'salao:madeira'),
    malha(L.latao, mat.latao, 'salao:latao'),
    malha(L.pecas, mat.pecas, 'salao:pecas'),
    malha(L.nacar, mat.nacar, 'salao:nacar'),
    malha(L.papel, mat.papel, 'salao:papel'),
  ];
  for (const m of opacas) {
    m.renderOrder = -1;
    cena.add(m);
  }
  const vidro = malha(L.vidro, materialVidro(comuns), 'salao:vidro');
  cena.add(vidro);
  cena.add(criaSombra());

  // Reações: a concha fecha um pouco antes do impacto e de vez nele, depois reabre devagar. Os livros levam o tranco.
  const ABERTA = 0.88, FECHADA = -0.2;
  const eixoX = new THREE.Vector3(1, 0, 0);
  const giro = new THREE.Quaternion();
  let fecho = 0, alvoFecho = 0, rapido = false;
  let abalo = 0, velAbalo = 0;
  eventos.addEventListener('pre-impacto', () => { alvoFecho = Math.max(alvoFecho, 0.3); });
  eventos.addEventListener('impacto', (e) => {
    const f = Math.min(e.detail?.forca ?? 1, 1.5);
    alvoFecho = 0.95;
    rapido = true;
    velAbalo += 0.45 * f;
  });

  return {
    atualiza(t, dt) {
      const passo = Math.min(dt, 0.05);
      fecho += (alvoFecho - fecho) * (1 - Math.exp(-passo / (rapido ? 0.07 : 1.6)));
      if (fecho > 0.9) rapido = false;
      if (!rapido) alvoFecho *= Math.exp(-passo / 5);
      const respira = Math.sin(t * 0.37) * 0.035 + Math.sin(t * 0.13 + 1) * 0.02;
      const ang = ABERTA + (FECHADA - ABERTA) * fecho + respira * (1 - fecho);
      giro.setFromAxisAngle(eixoX, -ang);
      valva.quaternion.multiplyQuaternions(trid.base, giro);

      velAbalo += (-630 * abalo - 7 * velAbalo) * passo;
      abalo += velAbalo * passo;
      livros.position.set(abalo * 0.5, Math.abs(abalo) * 0.4, abalo);
      tubos.position.x = abalo * 0.12;
    },
  };
}
