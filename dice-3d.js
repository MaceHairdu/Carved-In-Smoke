// Carved in Smoke — GLB dice renderer with Cannon physics.
import * as THREE from 'https://esm.sh/three@0.170.0';
import {GLTFLoader} from 'https://esm.sh/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';
import * as CANNON from 'https://esm.sh/cannon-es@0.20.0';
let renderer,scene,camera,world,template,geometry,raf,active=[],last=0,container;
async function setup(){
 if(renderer)return;
 container=document.getElementById('cis-dice-stage');
 const loader=new GLTFLoader();
 const gltf=await loader.loadAsync('./dice-models/carved_in_smoke_d12.glb');
 template=gltf.scene;
 const bounds=new THREE.Box3().setFromObject(template),size=bounds.getSize(new THREE.Vector3());
 if(!size.x||!size.y||!size.z)throw Error('GLB has no visible geometry');
 const center=bounds.getCenter(new THREE.Vector3());
 template.position.sub(center);
 const factor=1.8/Math.max(size.x,size.y,size.z);template.scale.setScalar(factor);
 geometry=diceGeometry();
 scene=new THREE.Scene();
 camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,100);
 camera.position.set(0,16,25);camera.lookAt(0,0,0);
 scene.add(new THREE.HemisphereLight(0xffffff,0x5e4242,2.8));
 const sun=new THREE.DirectionalLight(0xffdfb7,3.2);sun.position.set(-7,17,12);scene.add(sun);
 renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.domElement.style.cssText='position:absolute;inset:0;pointer-events:none;width:100%;height:100%';
 container.append(renderer.domElement);
 world=new CANNON.World({gravity:new CANNON.Vec3(0,-25,0)});
 world.allowSleep=true;
 const material=new CANNON.Material('dice');
 world.defaultContactMaterial.friction=.55;world.defaultContactMaterial.restitution=.48;
 function wall(pos,rotation){
  const body=new CANNON.Body({mass:0,shape:new CANNON.Plane(),material});
  body.position.set(...pos);body.quaternion.setFromEuler(...rotation);world.addBody(body);
 }
 wall([0,-5,0],[-Math.PI/2,0,0]);wall([-11,0,0],[0,Math.PI/2,0]);
 wall([11,0,0],[0,-Math.PI/2,0]);wall([0,0,-7],[0,0,0]);wall([0,0,7],[0,Math.PI,0]);
 window.addEventListener('resize',()=>{if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
}
function diceGeometry(){
 const mesh=template.getObjectByProperty('isMesh',true);
 if(!mesh)throw Error('No mesh in d12 model');
 const g=mesh.geometry,p=g.getAttribute('position'),uv=g.getAttribute('uv');
 const vertices=[],faces=[],labels=[];
 for(let k=0;k<12;k++){
  const indices=[],normal=new THREE.Vector3();
  for(let j=k*15;j<k*15+15;j++){
   const v=new THREE.Vector3().fromBufferAttribute(p,j);
   let index=vertices.findIndex(q=>q.distanceToSquared(v)<1e-7);
   if(index<0){index=vertices.length;vertices.push(v)}
   if(!indices.includes(index))indices.push(index);
  }
  const center=indices.reduce((v,i)=>v.add(vertices[i]),new THREE.Vector3()).divideScalar(indices.length);
  const axis=vertices[indices[0]].clone().sub(center).normalize();
  const raw=new THREE.Vector3().fromBufferAttribute(p,k*15+1).sub(new THREE.Vector3().fromBufferAttribute(p,k*15));
  const edge=new THREE.Vector3().fromBufferAttribute(p,k*15+2).sub(new THREE.Vector3().fromBufferAttribute(p,k*15));
  normal.crossVectors(raw,edge).normalize();
  if(normal.dot(center)<0)normal.negate();
  const side=new THREE.Vector3().crossVectors(normal,axis).normalize();
  indices.sort((i,j)=>{
   const a=vertices[i].clone().sub(center),b=vertices[j].clone().sub(center);
   return Math.atan2(a.dot(side),a.dot(axis))-Math.atan2(b.dot(side),b.dot(axis));
  });
  const u=uv.getX(k*15),v=uv.getY(k*15);
  const label=1+Math.min(3,Math.floor(u*4))+4*Math.min(2,Math.floor((1-v)*3));
  labels.push({normal,value:label});
  faces.push(indices);
 }
 if(vertices.length!==20||faces.some(f=>f.length!==5)||new Set(labels.map(f=>f.value)).size!==12)throw Error('Invalid numbered d12 geometry');
 return {vertices,faces,labels};
}
export async function roll3d(quantity){
 await setup();cancelAnimationFrame(raf);
 for(const d of active){world.removeBody(d.body);scene.remove(d.mesh)}active=[];
 const cols=Math.ceil(Math.sqrt(quantity)),scale=Math.min(1.25,Math.max(.48,3.8/cols));
 for(let i=0;i<quantity;i++){
  const mesh=template.clone(true);mesh.scale.multiplyScalar(scale);
  const factor=template.scale.x*scale;
  const shape=new CANNON.ConvexPolyhedron({vertices:geometry.vertices.map(v=>new CANNON.Vec3(v.x*factor,v.y*factor,v.z*factor)),faces:geometry.faces});
  const body=new CANNON.Body({mass:1,shape,linearDamping:.18,angularDamping:.23});
  const row=Math.floor(i/cols),col=i%cols;
  body.position.set(-9+col*.5,4+row*.8+i*.18,(i%4-1.5)*.7);
  body.velocity.set(13+Math.random()*6,Math.random()*6,Math.random()*5-2.5);
  body.angularVelocity.set(Math.random()*18-9,Math.random()*18-9,Math.random()*18-9);
  body.quaternion.setFromEuler(Math.random()*6,Math.random()*6,Math.random()*6);
  world.addBody(body);scene.add(mesh);active.push({body,mesh});
 }
 let started=performance.now();last=started;
 return await new Promise((resolve,reject)=>{
  function frame(now){
   try{
    const dt=Math.min(.05,(now-last)/1000);last=now;
    world.step(1/60,dt,4);
    for(const d of active){d.mesh.position.copy(d.body.position);d.mesh.quaternion.copy(d.body.quaternion)}
    renderer.render(scene,camera);
    if(now-started>4100){const up=new THREE.Vector3(0,1,0);resolve(active.map(d=>{const q=new THREE.Quaternion(d.body.quaternion.x,d.body.quaternion.y,d.body.quaternion.z,d.body.quaternion.w);return geometry.labels.reduce((best,f)=>{const dot=f.normal.clone().applyQuaternion(q).dot(up);return dot>best.dot?{dot,value:f.value}:best},{dot:-Infinity,value:1}).value}));return}
    raf=requestAnimationFrame(frame);
   }catch(e){reject(e)}
  }
  raf=requestAnimationFrame(frame);
 });
}
