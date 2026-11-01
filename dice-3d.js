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
 camera.position.set(0,32,.01);camera.up.set(0,0,-1);camera.lookAt(0,0,0);
 scene.add(new THREE.HemisphereLight(0xffffff,0x5e4242,2.8));
 const sun=new THREE.DirectionalLight(0xffdfb7,3.2);sun.position.set(-7,17,12);scene.add(sun);
 renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.domElement.style.cssText='position:absolute;inset:0;pointer-events:none;width:100%;height:100%';
 container.append(renderer.domElement);
 world=new CANNON.World({gravity:new CANNON.Vec3(0,-60,0)});
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
 const g=mesh.geometry,p=g.getAttribute('position'),uv=g.getAttribute('uv'),index=g.getIndex();
 const point=i=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i):i);
 const tex=i=>new THREE.Vector2().fromBufferAttribute(uv,index?index.getX(i):i);
 const vertices=[],faces=[],labels=[];
 for(let k=0;k<12;k++){
  const positions=[];
  for(let j=k*15;j<k*15+15;j++){
   const v=point(j);
   if(!positions.some(q=>q.distanceToSquared(v)<1e-7))positions.push(v);
  }
  if(positions.length!==6)throw Error('Face '+(k+1)+' has '+positions.length+' points');
  const center=positions.reduce((v,p)=>v.add(p),new THREE.Vector3()).divideScalar(positions.length);
  const middle=positions.reduce((best,p)=>p.distanceToSquared(center)<best.distanceToSquared(center)?p:best);
  const corners=positions.filter(p=>p!==middle);
  const faceCenter=corners.reduce((v,p)=>v.add(p),new THREE.Vector3()).divideScalar(5);
  const axis=corners[0].clone().sub(faceCenter).normalize();
  const normal=new THREE.Vector3().crossVectors(point(k*15+1).sub(point(k*15)),point(k*15+2).sub(point(k*15))).normalize();
  if(normal.dot(faceCenter)<0)normal.negate();
  const side=new THREE.Vector3().crossVectors(normal,axis).normalize();
  corners.sort((a,b)=>{const x=a.clone().sub(faceCenter),y=b.clone().sub(faceCenter);return Math.atan2(x.dot(side),x.dot(axis))-Math.atan2(y.dot(side),y.dot(axis))});
  const indices=corners.map(v=>{let i=vertices.findIndex(q=>q.distanceToSquared(v)<1e-7);if(i<0){i=vertices.length;vertices.push(v)}return i});
  faces.push(indices);
  const t=tex(k*15);
  const value=1+Math.min(3,Math.floor(t.x*4))+4*Math.min(2,Math.floor(t.y*3));
  const p0=point(k*15),p1=point(k*15+1),p2=point(k*15+2);
  const t0=tex(k*15),t1=tex(k*15+1),t2=tex(k*15+2);
  const du1=t1.x-t0.x,dv1=t1.y-t0.y,du2=t2.x-t0.x,dv2=t2.y-t0.y;
  const determinant=du1*dv2-du2*dv1;
  if(Math.abs(determinant)<1e-8)throw Error('Invalid UV orientation for face '+value);
  const textureUp=p2.clone().sub(p0).multiplyScalar(du1).sub(p1.clone().sub(p0).multiplyScalar(du2)).divideScalar(determinant).normalize();
  labels.push({normal,value,textureUp});
 }
 if(vertices.length!==20||faces.some(f=>f.length!==5)||new Set(labels.map(f=>f.value)).size!==12)throw Error('Invalid numbered d12 geometry: '+vertices.length+' vertices, labels '+labels.map(f=>f.value));
 return {vertices,faces,labels};
}
export async function roll3d(quantity){
 await setup();cancelAnimationFrame(raf);
 for(const d of active){world.removeBody(d.body);scene.remove(d.mesh)}active=[];
 const cols=Math.ceil(Math.sqrt(quantity)),scale=Math.min(1.25,Math.max(.48,3.8/cols));
 for(let i=0;i<quantity;i++){
  const mesh=template.clone(true);mesh.scale.multiplyScalar(scale);
  const factor=template.scale.x*scale;
  const center=new THREE.Box3().setFromPoints(geometry.vertices).getCenter(new THREE.Vector3());
  const shape=new CANNON.ConvexPolyhedron({vertices:geometry.vertices.map(v=>new CANNON.Vec3((v.x-center.x)*factor,(v.y-center.y)*factor,(v.z-center.z)*factor)),faces:geometry.faces});
  const body=new CANNON.Body({mass:1,shape,linearDamping:.28,angularDamping:.42,sleepSpeedLimit:.22,sleepTimeLimit:.6});
  const row=Math.floor(i/cols),col=i%cols;
  body.position.set(-9+col*.5,4+row*.8+i*.18,(i%4-1.5)*.7);
  body.velocity.set(8+Math.random()*3,Math.random()*3,Math.random()*3-1.5);
  body.angularVelocity.set(Math.random()*11-5.5,Math.random()*11-5.5,Math.random()*11-5.5);
  body.quaternion.setFromEuler(Math.random()*6,Math.random()*6,Math.random()*6);
  world.addBody(body);scene.add(mesh);active.push({body,mesh});
 }
 let started=performance.now();last=started;let stillTime=0;
 return await new Promise((resolve,reject)=>{
  function frame(now){
   try{
    const dt=Math.min(.05,(now-last)/1000);last=now;
    world.step(1/60,dt,4);
    for(const d of active){d.mesh.position.copy(d.body.position);d.mesh.quaternion.copy(d.body.quaternion)}
    renderer.render(scene,camera);
    const settled=active.every(d=>d.body.velocity.length()<.22&&d.body.angularVelocity.length()<.3);stillTime=settled?stillTime+dt:0;
    if((stillTime>.25&&now-started>550)||now-started>4200){
     const up=new THREE.Vector3(0,1,0),screenUp=new THREE.Vector3(0,0,-1);
     const values=[],transitions=[];
     const columns=Math.ceil(Math.sqrt(active.length)),rows=Math.ceil(active.length/columns);
     const spacing=Math.min(2.6,18/Math.max(columns,rows));
     active.forEach((d,i)=>{
      const q=d.mesh.quaternion.clone();
      const top=geometry.labels.reduce((best,f)=>{
       const dot=f.normal.clone().applyQuaternion(q).dot(up);
       return dot>best.dot?{dot,face:f}:best;
      },{dot:-Infinity,face:geometry.labels[0]}).face;
      values.push(top.value);
      const tilt=new THREE.Quaternion().setFromUnitVectors(top.normal.clone().applyQuaternion(q),up);
      const flat=tilt.clone().multiply(q);
      const textUp=top.textureUp.clone().applyQuaternion(flat);
      textUp.y=0;textUp.normalize();
      const yaw=Math.atan2(-textUp.x,textUp.z);
      const upright=new THREE.Quaternion().setFromAxisAngle(up,yaw).multiply(flat);
      const target=new THREE.Vector3((i%columns-(columns-1)/2)*spacing,0,(Math.floor(i/columns)-(rows-1)/2)*spacing);
      transitions.push({mesh:d.mesh,from:d.mesh.position.clone(),to:target,rotationFrom:q,rotationTo:upright});
     });
     const transitionStart=performance.now(),duration=450;
     function gather(time){
      try{
       const t=Math.min(1,(time-transitionStart)/duration);
       const ease=t*t*(3-2*t);
       for(const d of transitions){
        d.mesh.position.lerpVectors(d.from,d.to,ease);
        d.mesh.quaternion.slerpQuaternions(d.rotationFrom,d.rotationTo,ease);
       }
       renderer.render(scene,camera);
       if(t<1){raf=requestAnimationFrame(gather)}
       else{resolve(values)}
      }catch(e){reject(e)}
     }
     raf=requestAnimationFrame(gather);
     return;
    }
    raf=requestAnimationFrame(frame);
   }catch(e){reject(e)}
  }
  raf=requestAnimationFrame(frame);
 });
}
