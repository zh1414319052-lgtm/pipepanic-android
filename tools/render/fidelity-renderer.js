// The rules remain in jspp.js / level-play.js. This layer only presents their state.
// Three.js 0.187.0 (MIT); PipePanic integration GPL-2.0-or-later.
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

const masks=[8,2,9,12,6,3,13,14,7,11,15,10,5,8,1,2,4];
const dirs=[[1,0,-1],[2,1,0],[4,0,1],[8,-1,0]]; // Three X/Z, north = -Z.
const canonical={};
for(const id of [11,5,7,10,13]){let mask=masks[id];for(let turn=0;turn<4;turn++){
 if(!canonical[mask])canonical[mask]={id,turn};mask=((mask<<1)|(mask>>3))&15;
}}
const modelCache=new Map(),waterCache=new Map();
const diagnostics={backend:null,ready:false,error:null,frames:0,times:[],triangles:0,calls:0,loads:0};
let preparing;
function bytes64(text){const str=atob(text),out=new Uint8Array(str.length);for(let i=0;i<str.length;i++)out[i]=str.charCodeAt(i);return out;}
const rawWater=[];
function prepare(){
 if(preparing)return preparing;
 preparing=new Promise((resolve,reject)=>{
  try{
   for(const raw of PUMP_LIQUID.frames){
    const b=bytes64(raw).buffer,h=new DataView(b),n=h.getUint32(0,true),t=h.getUint32(4,true);
    rawWater.push({p:new Float32Array(b,8,n*3),n:new Float32Array(b,8+n*12,n*3),i:new Uint16Array(b,8+n*24,t*3)});
   }
   new GLTFLoader().parse(bytes64(PUMP_ASSET_BASE64).buffer,'',gltf=>{
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(ob=>{if(ob.isMesh){
     const geo=ob.geometry.clone().applyMatrix4(ob.matrixWorld);
     geo.computeBoundingSphere();ob.material.toneMapped=false;
     modelCache.set(ob.name,{geometry:geo,material:ob.material});
    }});
    for(let i=0;i<17;i++)if(!modelCache.has('p'+i+'_opaque'))return reject(new Error('Missing modular pipe '+i));
    diagnostics.loads++;diagnostics.ready=true;resolve();
   },reject);
  }catch(e){reject(e);}
 }).catch(e=>{diagnostics.error=String(e);throw e;});
 return preparing;
}

function environment(renderer){
 const scene=new T.Scene();scene.background=new T.Color(.08,.11,.15);
 for(const [loc,power,scale,color] of [
  [[-4.4,8.1,-4.2],5,[6.3,4.4],0xffe7c6],[[4.9,7.6,-4.8],5,[6.6,2.8],0xb5dcff],
  [[-3.5,5.9,6],3,[4.7,1.4],0xc1e5ff],[[1,4,4.8],2,[4.8,1.35],0xffdda7]]){
  const ob=new T.Mesh(new T.PlaneGeometry(...scale),new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(power),side:T.DoubleSide}));
  ob.position.set(...loc);ob.lookAt(0,0,0);scene.add(ob);
 }
 const generator=new T.PMREMGenerator(renderer),target=generator.fromScene(scene,.06);
 scene.traverse(ob=>{if(ob.isMesh){ob.geometry.dispose();ob.material.dispose();}});generator.dispose();
 return target;
}

// Deform the actual Mantaflow straight-channel surface along the available pipe
// centerline. Opaque junctions cover the joins; the game decides which cells fill.
function waterGeometry(id,frame){
 const key=id+':'+frame;
 if(waterCache.has(key)){const g=waterCache.get(key);waterCache.delete(key);waterCache.set(key,g);return g;}
 const raw=rawWater[frame],v=dirs.filter(d=>masks[id]&d[0]).map(d=>new T.Vector3(d[1],0,d[2]));
 const paths=[];
 if(v.length===1)paths.push({a:v[0],b:new T.Vector3(),short:true});
 else if(v.length===2)paths.push({a:v[0],b:v[1],bend:v[0].dot(v[1])>-.5});
 else for(const d of v)paths.push({a:d,b:new T.Vector3(),short:true});
 const positions=[],normals=[],indices=[];
 for(const path of paths){
  const offset=positions.length/3;
  for(let k=0;k<raw.p.length;k+=3){
   const t=Math.max(0,Math.min(1,(raw.p[k]+.525)/1.05));
   let p,tangent;
   if(path.bend){
    // .21 straight + .31 quarter-circle + .21 straight.
    const length=.42+Math.PI*.31/2,at=t*length;
    if(at<.21){p=path.a.clone().multiplyScalar(.52-at);tangent=path.a.clone().negate();}
    else if(at>length-.21){p=path.b.clone().multiplyScalar(.31+at-(length-.21));tangent=path.b.clone();}
    else {const theta=(at-.21)/.31;
     p=path.a.clone().multiplyScalar(.31*(1-Math.sin(theta))).addScaledVector(path.b,.31*(1-Math.cos(theta)));
     tangent=path.a.clone().multiplyScalar(-Math.cos(theta)).addScaledVector(path.b,Math.sin(theta));
    }
   }else{
    const end=path.short?0:.52;
    p=path.a.clone().multiplyScalar(.52*(1-t)).addScaledVector(path.b,end*t);
    tangent=path.short?path.a.clone().negate():path.b.clone();
   }
   const side=new T.Vector3(-tangent.z,0,tangent.x);
   p.addScaledVector(side,raw.p[k+2]);p.y=raw.p[k+1];
   const n=tangent.clone().multiplyScalar(raw.n[k]).addScaledVector(side,raw.n[k+2]);n.y=raw.n[k+1];n.normalize();
   positions.push(p.x,p.y,p.z);normals.push(n.x,n.y,n.z);
  }
  for(const i of raw.i)indices.push(i+offset);
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 geo.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geo.setIndex(indices);geo.computeBoundingSphere();
 waterCache.set(key,geo);
 // Five canonical centerlines x 16 cached frames; orientations share geometry.
 // Bounded CPU cache avoids rebuilding thousands of vertices every frame.
 while(waterCache.size>80){const old=waterCache.keys().next().value;waterCache.get(old).dispose();waterCache.delete(old);}
 return geo;
}

function makeWaterMaterial(){
 const m=new T.MeshPhysicalMaterial({color:0x0f64ad,metalness:.13,roughness:.12,ior:1.333,clearcoat:1,clearcoatRoughness:.1,emissive:0x0649e8,emissiveIntensity:.42,envMapIntensity:.85});
 m.onBeforeCompile=shader=>{
  shader.vertexShader='attribute vec4 aFlow; varying vec4 vFlow; varying vec2 vPipe;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFlow=aFlow;vPipe=vec2(position.x,-position.z);');
  shader.fragmentShader='varying vec4 vFlow; varying vec2 vPipe;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',
   '#include <clipping_planes_fragment>\nfloat travel=length(vPipe-vFlow.yz*.5); if(travel>vFlow.x) discard;');
 };
 return m;
}

function create(canvas,queue=false){
 const context=canvas.getContext('webgl2',{alpha:true,antialias:true,depth:true,preserveDrawingBuffer:false});
 if(!context)throw new Error('WebGL 2 unavailable');
 const renderer=new T.WebGLRenderer({canvas,context,alpha:true,antialias:true});
 renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
 renderer.setPixelRatio(1);renderer.autoClear=false;renderer.transmissionResolutionScale=1;
 const ext=context.getExtension('WEBGL_debug_renderer_info');
 diagnostics.backend=ext?context.getParameter(ext.UNMASKED_RENDERER_WEBGL):context.getParameter(context.RENDERER);
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,.01,80);
 camera.position.set(0,15,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);
 const env=queue?null:environment(renderer);if(env)scene.environment=env.texture;
 scene.add(new T.HemisphereLight(0xc8e9ff,0x233343,1));
 const light=new T.DirectionalLight(0xeaf4ff,2);light.position.set(-3,8,-5);scene.add(light);
 const glass=new T.MeshPhysicalMaterial({color:0xf0faff,metalness:0,roughness:.085,transmission:1,ior:1.46,thickness:.036,envMapIntensity:.65});
 const waterMaterial=makeWaterMaterial();
 const groups=new Map();let time=0,animFrame=0,lastWidth=0,lastHeight=0,start=0;
 const dummy=new T.Object3D();
 function group(key,geometry,material,liquid=false){
  if(groups.has(key))return groups.get(key);
  const geo=liquid?geometry.clone():geometry;
  if(liquid)geo.setAttribute('aFlow',new T.InstancedBufferAttribute(new Float32Array(128*4),4).setUsage(T.DynamicDrawUsage));
  const mesh=new T.InstancedMesh(geo,material,128);mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.count=0;
  scene.add(mesh);const result={mesh,used:0,liquid,frame:animFrame,frames:new Map([[animFrame,geo]])};groups.set(key,result);return result;
 }
 function add(name,x,y,z,sx,sy,sz,tint){
  const source=modelCache.get(name);if(!source)throw new Error('Missing baked model '+name);
  const isGlass=name.endsWith('_glass'),color=tint||[1,1,1];
  const key=name+':'+color.join(',');
  let mat=isGlass?glass:source.material;
  if(!isGlass&&color.some(c=>c!==1)){
   if(groups.has(key))mat=groups.get(key).mesh.material;
   else {mat=mat.clone();mat.color.setRGB(...color);}
  }
  const g=group(key,source.geometry,mat);
  dummy.position.set(x,z,-y);dummy.scale.set(sx,sz,sy);dummy.rotation.set(0,0,0);dummy.updateMatrix();
  g.mesh.setMatrixAt(g.used++,dummy.matrix);
 }
 function addWater(id,x,y,flow){
  const shape=canonical[masks[id]],geo=waterGeometry(shape.id,animFrame),g=group('water'+id,geo,waterMaterial,true);
  if(g.frame!==animFrame){
   let clone=g.frames.get(animFrame);
   if(!clone){clone=new T.BufferGeometry();clone.setAttribute('position',geo.attributes.position);clone.setAttribute('normal',geo.attributes.normal);clone.setIndex(geo.index);clone.setAttribute('aFlow',g.mesh.geometry.attributes.aFlow);g.frames.set(animFrame,clone);}
   g.mesh.geometry=clone;g.frame=animFrame;
  }
  const angle=shape.turn*Math.PI/2,c=Math.cos(angle),s=Math.sin(angle);
  dummy.position.set(x,0,-y);dummy.scale.set(1,1,1);dummy.rotation.set(0,-angle,0);dummy.updateMatrix();
  g.mesh.setMatrixAt(g.used,dummy.matrix);g.mesh.geometry.attributes.aFlow.setXYZW(g.used,flow[0],flow[1]*c-flow[2]*s,flow[1]*s+flow[2]*c,flow[3]);g.used++;
 }
 function begin(seconds){
  time=seconds;animFrame=Math.floor(seconds*PUMP_LIQUID.fps)%rawWater.length;start=performance.now();
  if(lastWidth!==canvas.width||lastHeight!==canvas.height){lastWidth=canvas.width;lastHeight=canvas.height;renderer.setSize(lastWidth,lastHeight,false);}
  renderer.setScissorTest(false);renderer.setClearColor(0x000000,0);renderer.clear();
  reset();
 }
 function reset(){for(const g of groups.values()){g.used=0;g.mesh.visible=false;}}
 function viewport(x,y,w,h,view){
  reset();renderer.setViewport(x,y,w,h);renderer.setScissor(x,y,w,h);renderer.setScissorTest(true);
  camera.left=view.center[0]-view.half[0];camera.right=view.center[0]+view.half[0];camera.top=view.half[1]+view.center[1];camera.bottom=view.center[1]-view.half[1];camera.updateProjectionMatrix();
 }
 function draw(name,x,y,z,sx,sy,sz,angle,flow,tint){
  // Only rails have a variable orientation; their light is baked separately.
  if(name==='rail'){if(Math.abs(angle)>1){name='rail1';[sx,sy]=[sy,sx];}else name='rail0';}
  add(name+'_opaque',x,y,z,sx,sy,sz,tint);
 }
 function pipe(id,x,y,flow,tint){
  const name=(queue?'q':'p')+id;
  add(name+'_opaque',x,y,0,1,1,1,tint);
  if(modelCache.has(name+'_glass'))add(name+'_glass',x,y,0,1,1,1,[1,1,1]);
  if(!queue&&flow&&flow[0]>=0&&modelCache.has(name+'_glass'))addWater(id,x,y,flow);
 }
 function end(){
  for(const g of groups.values())if(g.used){
   g.mesh.visible=true;g.mesh.count=g.used;g.mesh.instanceMatrix.needsUpdate=true;
   if(g.liquid)g.mesh.geometry.attributes.aFlow.needsUpdate=true;
  }
  renderer.render(scene,camera);
  if(!queue){
   diagnostics.frames++;diagnostics.times.push(performance.now()-start);if(diagnostics.times.length>900)diagnostics.times.shift();
   diagnostics.triangles=renderer.info.render.triangles;diagnostics.calls=renderer.info.render.calls;
  }
 }
 function dispose(){
  for(const g of groups.values()){if(g.liquid)for(const geo of g.frames.values())geo.dispose();g.mesh.dispose();}
  glass.dispose();waterMaterial.dispose();if(env)env.dispose();renderer.dispose();
 }
 console.info('PipePanic Fidelity WebGL2 '+(queue?'queue':'board')+' '+diagnostics.backend);
 return {begin,viewport,draw,pipe,end,dispose};
}
window.PumpFidelity={prepare,create,diagnostics,version:'0.26 / Three r187',stats(){
 const times=diagnostics.times.slice().sort((a,b)=>a-b);
 return {...diagnostics,times:undefined,cpuRenderMs:{median:times[Math.floor(times.length*.5)]||0,p95:times[Math.floor(times.length*.95)]||0},waterCache:waterCache.size,modules:modelCache.size};
}};
