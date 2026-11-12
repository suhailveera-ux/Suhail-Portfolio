// Hero visual "scenes": WebGL/Three.js-less particle stage, kinetic hero-title
// builder (per-letter SVG split used for the letter-by-letter reveal + desktop
// cursor-reactive hover), and related measurement helpers.
/* ============================================================
   THE SIGNAL FIELD — improved cinematic 3D
   One particle body drawn in two passes (sharp core + soft halo for fake bloom),
   plus constellation lines, an orbital "signal" streak, two rims and a haze.
   Shapes morph on scroll/section: funnel → net → helix → ring.
   Budget: ≤4,000 points, DPR ≤1.5, paused when hidden/off-screen.
   ============================================================ */
const GL=(()=>{
const R=Math.random,TAU=Math.PI*2,g=()=>(R()+R()+R()+R()-2)/2;
let GLOW=null;
function makeGlow(){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d'),r=x.createRadialGradient(128,128,0,128,128,128);r.addColorStop(0,'rgba(198,244,50,.8)');r.addColorStop(.28,'rgba(198,244,50,.2)');r.addColorStop(.6,'rgba(120,220,200,.05)');r.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=r;x.fillRect(0,0,256,256);return new THREE.CanvasTexture(c)}

/* Network layout shared by the point shape and the constellation lines */
const NET=(()=>{const L=[3,5,7,5,3],lay=L.map((n,l)=>Array.from({length:n},(_,k)=>[(l-2)*2.45,(k-(n-1)/2)*1.5,g()*.55]));const edges=[];for(let l=0;l<4;l++)lay[l].forEach((a,ai)=>lay[l+1].forEach((b,bi)=>{if((ai+bi+l)%2===0||R()<.3)edges.push([a,b])}));return{nodes:lay.flat(),edges}})();

const SH={
 /* FUNNEL — wide intake, swirl, glass throat, droplet pool at the tip */
 funnel:N=>{const a=new Float32Array(N*3);for(let i=0;i<N;i++){const u=R(),k=i*3;if(u<.10){const an=R()*TAU,rr=Math.sqrt(R())*.62;a[k]=Math.cos(an)*rr;a[k+1]=-4.9-g()*.3;a[k+2]=Math.sin(an)*rr*.8}else{const t=Math.pow(u,.92),an=R()*TAU+t*4.4,rr=4.1*Math.pow(1-t,1.22)+.14,blend=Math.pow(R(),6);a[k]=Math.cos(an)*rr;a[k+1]=4.5-t*9.2+g()*.05;a[k+2]=Math.sin(an)*rr*.55+g()*.12;if(blend>.985){a[k]*=.82;a[k+1]+=g()*.2}}}return a},
 /* HELIX — double strand with rungs and a soft spine */
 helix:N=>{const a=new Float32Array(N*3);for(let i=0;i<N;i++){const k=i*3,t=R(),an=t*TAU*2.6;
  if(i%11===0&&i>0){const tt=R(),x1=Math.cos(an)*1.85,x2=Math.cos(an+Math.PI)*1.85,z1=Math.sin(an)*1.85,z2=Math.sin(an+Math.PI)*1.85;
   a[k]=x1+(x2-x1)*tt;a[k+1]=-4.8+t*9.6+g()*.05;a[k+2]=z1+(z2-z1)*tt}
  else{const side=i%2?0:Math.PI;a[k]=Math.cos(an+side)*1.85+g()*.06;a[k+1]=-4.8+t*9.6;a[k+2]=Math.sin(an+side)*1.85+g()*.06}}return a},
 /* RING — dense torus, inner orbit and a thin outer halo */
 ring:N=>{const a=new Float32Array(N*3);for(let i=0;i<N;i++){const k=i*3,u=R(),an=R()*TAU;if(u<.14){const rr=Math.sqrt(R())*3.35;a[k]=Math.cos(an)*rr;a[k+1]=Math.sin(an)*rr*.9;a[k+2]=g()*.45}else if(u<.9){const rr=3.75+g()*(u<.6?.16:.42);a[k]=Math.cos(an)*rr;a[k+1]=Math.sin(an)*rr*.96;a[k+2]=g()*(u<.6?.22:.7)}else{const rr=4.7+g()*.25;a[k]=Math.cos(an)*rr;a[k+1]=Math.sin(an)*rr*.96;a[k+2]=g()*.2}}return a},
 /* NET — layered graph with dense edge traffic */
 net:N=>{const a=new Float32Array(N*3);for(let i=0;i<N;i++){const k=i*3;if(R()<.16){const n=NET.nodes[Math.floor(R()*NET.nodes.length)],s=.11*Math.sqrt(R());a[k]=n[0]+g()*s;a[k+1]=n[1]+g()*s;a[k+2]=n[2]+g()*s}else{const e=NET.edges[Math.floor(R()*NET.edges.length)],p=e[0],q=e[1],t=R();a[k]=p[0]+(q[0]-p[0])*t+g()*.04;a[k+1]=p[1]+(q[1]-p[1])*t+g()*.04;a[k+2]=p[2]+(q[2]-p[2])*t+g()*.04}}return a}
};
let ready=false,frozen=false,renderer,scene,cam,core,halo,deco,lines,rimA,rimB,haze,sats,U,N,aFrom,aTo,from,to,rnd,lineMat,cur='',raf=0,last=0,clock=0,mob=false,vw=24,vh=13.6,vis=true,scrollP=0,kickZ=0;
let cageA=null,cageB=null,comet=null,cometPos=null,shock=null,shockMat=null,ignited=false,cometTick=null;
const base={x:.16,y:-.3},mouse={x:0,y:0,sx:0,sy:0,on:false},cache={},TONE={funnel:.15,net:.62,helix:.4,ring:.05};
const shape=n=>cache[n]||(cache[n]=SH[n](N));

function lineGeometry(){
 const pos=[];NET.edges.slice(0,70).forEach(e=>{pos.push(e[0][0],e[0][1],e[0][2],e[1][0],e[1][1],e[1][2])});
 const g2=new THREE.BufferGeometry();g2.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));return g2}
function ringGeometry(radius,seg){
 const p=[];for(let i=0;i<=seg;i++){const a=i/seg*TAU;p.push(Math.cos(a)*radius,Math.sin(a)*radius,0)}
 const g2=new THREE.BufferGeometry();g2.setAttribute('position',new THREE.Float32BufferAttribute(p,3));return g2}
function satSystem(){
 const COUNT=mob?60:120,pos=new Float32Array(COUNT*3),dat=new Float32Array(COUNT*4);
 for(let c=0;c<3;c++){for(let i=0;i<COUNT/3;i++){const idx=c*COUNT/3+i;const tail=i/(COUNT/3);dat[idx*4]=c/3*TAU+tail*.55;dat[idx*4+1]=4.0+c*.5;dat[idx*4+2]=(c+1)*.33;dat[idx*4+3]=(1-tail)*(c===0?2.6:1.7)+.5}}
 const g2=new THREE.BufferGeometry();g2.setAttribute('position',new THREE.BufferAttribute(pos,3));g2.setAttribute('aData',new THREE.BufferAttribute(dat,4));
 const m=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uPR:{value:Math.min(devicePixelRatio||1,1.5)}},transparent:true,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending,
  vertexShader:`attribute vec4 aData;uniform float uTime,uPR;varying float vT;void main(){float ang=aData.x+uTime*aData.z;float rad=aData.y;vec3 p=vec3(cos(ang)*rad,sin(ang)*rad*.78,sin(ang*1.7)*rad*.32);vT=aData.w;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=min(uPR*10.,aData.w*uPR*(30./-mv.z));}`,
  fragmentShader:`varying float vT;void main(){float d=length(gl_PointCoord-.5);float a=1.-smoothstep(0.,.5,d);gl_FragColor=vec4(vec3(.82,.99,.36),a*a*(.25+vT*.55));}`});
 return new THREE.Points(g2,m)}

function init(o){if(ready)return true;if(!window.THREE||!window.gsap)return false;
 try{renderer=new THREE.WebGLRenderer({canvas:document.getElementById('gl'),alpha:true,antialias:false,powerPreference:'high-performance'})}catch(e){return false}
 if(!renderer.getContext())return false;
 frozen=!!o.frozen;mob=innerWidth<820||!matchMedia('(hover:hover) and (pointer:fine)').matches;N=mob?1600:4000;
 if(!GLOW)GLOW=makeGlow();
 const PR=Math.min(devicePixelRatio||1,1.5);renderer.setPixelRatio(PR);renderer.setSize(innerWidth,innerHeight,false);renderer.setClearColor(0,0);
 scene=new THREE.Scene();cam=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.1,70);cam.position.set(0,0,14);
 vh=2*Math.tan(52*Math.PI/360)*14;vw=vh*cam.aspect;
 from=new Float32Array(N*3);to=new Float32Array(N*3);rnd=new Float32Array(N*4);
 for(let i=0;i<N*4;i++)rnd[i]=R();
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(N*3),3));
 aFrom=new THREE.BufferAttribute(from,3).setUsage(THREE.DynamicDrawUsage);
 aTo=new THREE.BufferAttribute(to,3).setUsage(THREE.DynamicDrawUsage);
 geo.setAttribute('aFrom',aFrom);geo.setAttribute('aTo',aTo);geo.setAttribute('aRnd',new THREE.BufferAttribute(rnd,4));

 U={uTime:{value:0},uMix:{value:1},uPR:{value:PR},uTone:{value:.15},
    uMouse:{value:new THREE.Vector2(999,999)},uStr:{value:0},
    uOff:{value:new THREE.Vector2(4.6,.15)},uScale:{value:1},
    uRot:{value:new THREE.Vector2(.18,-.3)},uPulse:{value:0},uGlow:{value:1},uAlpha:{value:1},
    uBurst:{value:0},uFlow:{value:0}};

 const VERT=`
  attribute vec3 aFrom,aTo;
  attribute vec4 aRnd;
  uniform float uTime,uMix,uPR,uStr,uScale,uPulse,uTone,uGlow,uAlpha,uBurst,uFlow;
  uniform vec2 uMouse,uOff,uRot;
  varying vec3 vC;varying float vA;
  mat3 rx(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,-s,0.,s,c);}
  mat3 ry(float a){float c=cos(a),s=sin(a);return mat3(c,0.,s,0.,1.,0.,-s,0.,c);}
  void main(){
    float st=clamp(uMix*1.45-aRnd.x*.45,0.,1.);
    float e=st*st*(3.-2.*st);
    vec3 p=mix(aFrom,aTo,e);
    float arc=sin(e*3.14159265);
    /* curl-ish organic drift + mid-morph outward arc */
    float n1=sin(p.y*1.15+uTime*.42+aRnd.y*6.283);
    float n2=cos(p.z*1.35-uTime*.34+aRnd.z*6.283);
    float n3=sin(p.x*.95+uTime*.3+aRnd.w*6.283);
    p+=vec3(n1,n2,n3)*(.09+.34*arc)*(.45+aRnd.y);
    /* mid-morph swirl: the body twists as it changes shape, then settles */
    float sw=arc*(.55+.35*aRnd.y)*(.35+uFlow);
    float ca2=cos(sw),sa2=sin(sw);
    p.xz=mat2(ca2,-sa2,sa2,ca2)*p.xz;
    /* ignition burst: contract then rebound outward */
    p*=1.-uBurst*.34;
    p+=normalize(p+vec3(.001))*uBurst*(.35+aRnd.z*.9);
    p*=1.+sin(uTime*.65+aRnd.x*4.0)*.013;
    p=ry(uRot.y+uTime*.055)*rx(uRot.x)*p*uScale;
    p.xy+=uOff;
    /* magnetic swirl around cursor */
    vec2 d=p.xy-uMouse;float dist=length(d);
    float f=exp(-dot(d,d)/4.4)*uStr;
    float an=f*1.5,c=cos(an),s=sin(an);
    p.xy=uMouse+vec2(c*d.x-s*d.y,s*d.x+c*d.y)+normalize(d+.0001)*f*.38;
    /* travelling data pulse (squared manually: pow() with a negative base is undefined in GLSL) */
    float q=(p.y-uPulse)/.95;
    float band=exp(-q*q);
    vec4 mv=modelViewMatrix*vec4(p,1.);
    float depth=-mv.z;
    gl_Position=projectionMatrix*mv;
    float tw=.86+.14*sin(uTime*2.1+aRnd.y*31.);
    float sz=(.55+pow(aRnd.z,2.6)*2.5)*(1.+band*1.3)*uGlow*tw;
    gl_PointSize=min(uPR*20.,sz*uPR*(31./depth));
    vec3 lime=vec3(.78,.96,.20),teal=vec3(.18,.84,.76),white=vec3(.94,.98,.96),ember=vec3(1.,.44,.24);
    float h=clamp((p.y+5.5)/11.,0.,1.);
    vec3 col=mix(teal,lime,smoothstep(.04,.58,h));
    col=mix(col,white,smoothstep(.62,1.,h)*.55);
    col=mix(col,lime,.12+uTone*.26);
    if(aRnd.x>.982)col=mix(col,ember,.85);
    col+=lime*band*.75;
    vC=col;
    vA=(.30+.52*aRnd.y)*(1.-smoothstep(14.,30.,depth)*.85)*(1.+band*.9)*tw*uAlpha;
  }`;
 const FRAG=`varying vec3 vC;varying float vA;void main(){vec2 uv=gl_PointCoord-.5;float d=length(uv);float core=1.-smoothstep(.06,.5,d);float bloom=exp(-d*7.5);float a=(core*core+bloom*.42)*vA;if(a<.002)discard;gl_FragColor=vec4(vC,a);}`;
 const mkMat=(glow,alpha)=>new THREE.ShaderMaterial({uniforms:Object.assign({},U,{uGlow:{value:glow},uAlpha:{value:alpha}}),vertexShader:VERT,fragmentShader:FRAG,transparent:true,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending});
 core=new THREE.Points(geo,mkMat(1,1));halo=new THREE.Points(geo,mkMat(4.8,.2));core.frustumCulled=halo.frustumCulled=false;

 /* decoration that must share the body's offset / rotation / scale */
 deco=new THREE.Group();scene.add(deco);
 lineMat=new THREE.LineBasicMaterial({color:0x9fe9d8,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
 lines=new THREE.LineSegments(lineGeometry(),lineMat);deco.add(lines);
 rimA=new THREE.Line(ringGeometry(4.25,120),new THREE.LineBasicMaterial({color:0xc6f432,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));rimA.rotation.x=1.22;deco.add(rimA);
 rimB=new THREE.Line(ringGeometry(5.15,120),new THREE.LineBasicMaterial({color:0x7de0c8,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));rimB.rotation.x=-.9;rimB.rotation.y=.5;deco.add(rimB);
 sats=satSystem();deco.add(sats);
 haze=new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW,transparent:true,opacity:.2,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending,color:0xc6f432}));haze.scale.set(15,15,1);deco.add(haze);

 scene.add(core);scene.add(halo);

 /* ---- wireframe "containment core": real geometry around the particles ---- */
 try{
  const cageMat=op=>new THREE.LineBasicMaterial({color:0xc6f432,transparent:true,opacity:op,depthWrite:false,blending:THREE.AdditiveBlending});
  cageA=new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(3.05,1)),cageMat(.07));
  cageB=new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(4.45,0)),cageMat(.045));
  cageB.material.color=new THREE.Color(0x7de0c8);
  deco.add(cageA);deco.add(cageB);
 }catch(e){cageA=cageB=null}

 /* ---- signal comet: bright head + fading tail traveling on a 3D path ---- */
 try{
  const CN=mob?34:64;cometPos=new Float32Array(CN*3);const ct=new Float32Array(CN);
  for(let i=0;i<CN;i++)ct[i]=i/(CN-1);
  const cg=new THREE.BufferGeometry();
  cg.setAttribute('position',new THREE.BufferAttribute(cometPos,3).setUsage(THREE.DynamicDrawUsage));
  cg.setAttribute('aT',new THREE.BufferAttribute(ct,1));
  comet=new THREE.Points(cg,new THREE.ShaderMaterial({
   uniforms:{uPR:{value:U.uPR.value},uAlpha:{value:0}},
   transparent:true,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending,
   vertexShader:`attribute float aT;uniform float uPR;varying float vT;void main(){vT=aT;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=min(uPR*18.,(1.25-aT*1.05)*uPR*(30./max(.1,-mv.z)));}`,
   fragmentShader:`varying float vT;void main(){float d=length(gl_PointCoord-.5);float a=1.-smoothstep(0.,.5,d);vec3 c=mix(vec3(1.,1.,.92),vec3(.78,.96,.2),clamp(vT,0.,1.));gl_FragColor=vec4(c,a*a*(1.-clamp(vT,0.,1.))*.85);}`}));
  comet.frustumCulled=false;deco.add(comet);
 }catch(e){comet=null}

 /* ---- shock ring, fired on every morph ---- */
 try{
  shockMat=new THREE.LineBasicMaterial({color:0xc6f432,transparent:true,opacity:0,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending});
  shock=new THREE.Line(ringGeometry(1,140),shockMat);shock.scale.setScalar(.1);deco.add(shock);
 }catch(e){shock=null}

 function shockBurst(){if(!shock||!window.gsap||frozen)return;
  gsap.killTweensOf(shock.scale);gsap.killTweensOf(shockMat);
  shock.scale.set(.35,.35,.35);shockMat.opacity=.85;
  shock.rotation.set(mouse.sy*.3,mouse.sx*.3,0);
  gsap.to(shock.scale,{x:11,y:11,z:11,duration:1.5,ease:'expo.out'});
  gsap.to(shockMat,{opacity:0,duration:1.5,ease:'power2.in'})}

 function cometUpdate(){
  if(!comet||!cometPos)return;
  const n=cometPos.length/3,t=clock*(mob?.5:.72),CN=n;
  for(let i=0;i<CN;i++){
   const tt=t-i*.014*(CN>40?1:.7);
   const a=tt*1.05,b=Math.sin(tt*.63)*1.5;
   const rad=4.15+Math.sin(tt*.9)*.55;
   cometPos[i*3]=Math.cos(a)*rad;
   cometPos[i*3+1]=Math.sin(a*.72)*3.1+b;
   cometPos[i*3+2]=Math.sin(a)*rad*.52;
  }
  comet.geometry.attributes.position.needsUpdate=true;
  if(comet.material.uniforms)comet.material.uniforms.uAlpha.value=.9;
 }

 /* fire the shock on ignition and on every section morph */
 window.__srbShock=shockBurst;cometTick=cometUpdate;

 addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight,false);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();vw=vh*cam.aspect;layout();if(frozen)render()});
 document.addEventListener('visibilitychange',()=>{if(frozen)return;if(document.hidden){cancelAnimationFrame(raf);raf=0}else if(!raf){last=performance.now();raf=requestAnimationFrame(frame)}});
 addEventListener('scroll',()=>{const max=Math.max(1,document.documentElement.scrollHeight-innerHeight);scrollP=Math.min(1,scrollY/max)},{passive:true});
 if(!mob&&!frozen)addEventListener('pointermove',e=>{mouse.x=e.clientX/innerWidth*2-1;mouse.y=-(e.clientY/innerHeight*2-1);mouse.on=true},{passive:true});
 const want=cur||'funnel';cur='';ready=true;set(want,true);layout();
 if(frozen){U.uOff.value.set(mob?0:4.6,mob?1.55:.15);U.uScale.value=mob?.62:1;tick(0);render()}
 else{
  /* cinematic ignition: particles fly in from a surrounding cloud and lock into the funnel */
  for(let i=0;i<N;i++){const k=i*3,r=9+R()*7,th=R()*TAU,ph=Math.acos(2*R()-1);
   from[k]=Math.sin(ph)*Math.cos(th)*r;from[k+1]=Math.cos(ph)*r*.72;from[k+2]=Math.sin(ph)*Math.sin(th)*r*.55}
  aFrom.needsUpdate=true;U.uMix.value=0;
  gsap.to(U.uMix,{value:1,duration:2.4,ease:'power2.out',delay:.12});
  /* burst + shock timed to the assembly */
  gsap.timeline({delay:.05}).to(U.uBurst,{value:.85,duration:.25,ease:'power2.in'})
   .to(U.uBurst,{value:0,duration:1.4,ease:'elastic.out(1,.55)'},'>')
   .add(()=>{try{if(window.__srbShock)window.__srbShock()}catch(e){}},1.85);
  kickZ=.8;last=performance.now();raf=requestAnimationFrame(frame)
 }
 return true}

function layout(){const m=innerWidth<820;
 gsap.to(U.uOff.value,{x:m?0:4.6,y:m?1.55:.15,duration:1.1,ease:'power3.inOut',overwrite:true});
 gsap.to(U.uScale,{value:m?.62:1,duration:1.1,ease:'power3.inOut',overwrite:true});
 gsap.to(U.uRot.value,{x:m?.05:.18,y:m?.1:-.3,duration:1.1,ease:'power3.inOut',overwrite:true})}

function set(n,inst){if(!SH[n])return;const was=cur;cur=n;if(!ready||was===n)return;const t=shape(n);
 if(inst||frozen||!was){from.set(t);to.set(t);U.uMix.value=1}
 else{const m=U.uMix.value;for(let i=0;i<N;i++){const st=Math.min(1,Math.max(0,m*1.45-rnd[i*4]*.45)),e=st*st*(3-2*st),k=i*3;for(let j=0;j<3;j++)from[k+j]+=(to[k+j]-from[k+j])*e}
  to.set(t);U.uMix.value=0;gsap.to(U.uMix,{value:1,duration:1.5,ease:'power3.inOut',overwrite:true})}
 aFrom.needsUpdate=true;aTo.needsUpdate=true;
 gsap.to(U.uTone,{value:TONE[n]||.2,duration:1.4,ease:'power2.inOut',overwrite:true});
 if(lineMat)gsap.to(lineMat,{opacity:n==='net'?.5:0,duration:1.2,ease:'power2.inOut',overwrite:true});
 if(rimA)gsap.to(rimA.material,{opacity:n==='ring'?.5:n==='helix'?.22:0,duration:1.2,overwrite:true});
 if(rimB)gsap.to(rimB.material,{opacity:n==='ring'?.28:n==='net'?.14:0,duration:1.2,overwrite:true});
 if(haze)gsap.to(haze.material,{opacity:n==='ring'?.3:.18,duration:1.2,overwrite:true});
 if(cageA)gsap.to(cageA.material,{opacity:n==='funnel'?.09:n==='ring'?.05:.025,duration:1.2,overwrite:true});
 if(cageB)gsap.to(cageB.material,{opacity:n==='helix'?.06:n==='net'?.05:.02,duration:1.2,overwrite:true});
 /* banger moment: contract + shock ring on every shape change */
 if(!frozen&&window.gsap&&!inst){
  try{
   gsap.killTweensOf(U.uBurst);
   gsap.timeline().to(U.uBurst,{value:.9,duration:.2,ease:'power2.in'})
     .to(U.uBurst,{value:0,duration:1.25,ease:'elastic.out(1,.55)'});
   gsap.fromTo(U.uFlow,{value:.9},{value:0,duration:1.4,ease:'power3.out'});
   if(window.__srbShock)window.__srbShock();
   const fl=document.querySelector('.morph-flash');
   if(fl)gsap.fromTo(fl,{opacity:.26},{opacity:0,duration:1.15,ease:'power2.out'});
   const k={v:1.05};kickZ=k.v;
   gsap.to(k,{v:0,duration:1.1,ease:'power3.out',onUpdate:()=>{kickZ=k.v}});
  }catch(e){}
 }
 if(frozen){tick(0);render()}}

function tick(dt){
 U.uTime.value=clock;
 mouse.sx+=(mouse.x-mouse.sx)*Math.min(1,dt*4.5);
 mouse.sy+=(mouse.y-mouse.sy)*Math.min(1,dt*4.5);
 const tilt=.14;
 U.uRot.value.set(base.x-mouse.sy*tilt+(scrollP-.5)*.34,base.y+mouse.sx*tilt+scrollP*1.1);
 U.uStr.value+=((mouse.on?1:0)-U.uStr.value)*Math.min(1,dt*2.4);
 U.uMouse.value.set(mouse.sx*vw*.5,mouse.sy*vh*.5);
 U.uPulse.value=-6.2+((clock%2.8)/2.8)*12.4;
 /* camera parallax + dolly, richer depth on desktop */
 const px=mob?.12:.4, py=mob?.1:.3;
 cam.position.x+=(mouse.sx*px-cam.position.x)*Math.min(1,dt*2.2);
 cam.position.y+=(-mouse.sy*py+(0.5-scrollP)*.55-cam.position.y)*Math.min(1,dt*2.2);
 kickZ*=Math.pow(.08,dt);
 cam.position.z=14-Math.sin(scrollP*Math.PI)*1.15+kickZ;
 cam.lookAt(0,0,0);
 /* wireframe containment cores: slow counter-rotation + breathing */
 if(cageA){cageA.rotation.y+=dt*.11;cageA.rotation.x+=dt*.045;const s=1+Math.sin(clock*.7)*.018;cageA.scale.setScalar(s)}
 if(cageB){cageB.rotation.y-=dt*.07;cageB.rotation.z+=dt*.03;const s=1+Math.cos(clock*.5)*.03;cageB.scale.setScalar(s)}
 if(cometTick)cometTick();
 /* decoration shares the body transform so lines/rims/orbits stay glued */
  if(deco){deco.position.set(U.uOff.value.x,U.uOff.value.y,0);deco.scale.setScalar(U.uScale.value);
   /* same transform the vertex shader applies, so lines, rims and orbits stay glued to the body */
   deco.rotation.set(U.uRot.value.x,U.uRot.value.y+clock*.055,0);
  if(rimA)rimA.rotation.z+=dt*.22;if(rimB)rimB.rotation.z-=dt*.15;
  if(sats)sats.material.uniforms.uTime.value=clock;
  if(haze){haze.material.rotation=clock*.05;haze.scale.setScalar(15+Math.sin(clock*.6)*.7)}}
}
function render(){renderer.render(scene,cam)}
function frame(now){raf=requestAnimationFrame(frame);vis||cancelAnimationFrame(raf);if(!vis){raf=0;return}
 const dt=Math.min((now-last)/1000,.05);last=now;clock+=dt;tick(dt);render()}
return{init,set,setVisible:v=>{vis=v;if(v&&ready&&!frozen&&!raf){last=performance.now();raf=requestAnimationFrame(frame)}},get ready(){return ready}}})();
