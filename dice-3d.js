// Carved in Smoke — GLB dice renderer with Cannon physics.
import * as THREE from 'https://esm.sh/three@0.170.0';
import {GLTFLoader} from 'https://esm.sh/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';
import * as CANNON from 'https://esm.sh/cannon-es@0.20.0';
let renderer,scene,camera,world,template,raf,active=[],last=0,container;
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
function extractFaces(){
 const unique=[];
 template.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry,positions=geo.getAttribute('position');if(!positions)return;
 for(let i=0;i<positions.count;i++){const p=new THREE.Vector3().fromBufferAttribute(positions,i);o.localToWorld(p);if(!unique.some(v=>v.distanceToSquared(p)<.00001))unique.push(p)}
 });
 return unique;
}
export async function roll3d(quantity){
 await setup();cancelAnimationFrame(raf);
 for(const d of active){world.removeBody(d.body);scene.remove(d.mesh)}active=[];
 const cols=Math.ceil(Math.sqrt(quantity)),scale=Math.min(1.25,Math.max(.48,3.8/cols));
 for(let i=0;i<quantity;i++){
  const mesh=template.clone(true);mesh.scale.multiplyScalar(scale);
  const shape=new CANNON.Sphere(.88*scale);
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
    if(now-started>4100){resolve();return}
    raf=requestAnimationFrame(frame);
   }catch(e){reject(e)}
  }
  raf=requestAnimationFrame(frame);
 });
}
