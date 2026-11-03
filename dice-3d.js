// Carved in Smoke — GLB dice renderer with Cannon physics.
import * as THREE from 'https://esm.sh/three@0.170.0';
import {GLTFLoader} from 'https://esm.sh/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';
import * as CANNON from 'https://esm.sh/cannon-es@0.20.0';
let renderer,scene,camera,world,template,geometry,raf,active=[],last=0,container,loadedStyle=null,cardboardHull=null;const loader=new GLTFLoader();
async function setup(style){
 if(renderer){await loadStyle(style);return;}
 container=document.getElementById('cis-dice-stage');
 await loadStyle(style);
 geometry=diceGeometry();
 scene=new THREE.Scene();
 camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,100);
 camera.position.set(0,32,.01);camera.up.set(0,0,-1);camera.lookAt(0,0,0);
 scene.add(new THREE.HemisphereLight(0xffffff,0x8e7970,4.0));
 scene.add(new THREE.AmbientLight(0xffffff,1.2));
 const sun=new THREE.DirectionalLight(0xffe8ce,4.5);sun.position.set(-7,17,12);scene.add(sun);
 const fill=new THREE.DirectionalLight(0xffffff,3.0);fill.position.set(8,13,-9);scene.add(fill);
 renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.domElement.style.cssText='position:absolute;inset:0;pointer-events:none;width:100%;height:100%';
 container.append(renderer.domElement);
 world=new CANNON.World({gravity:new CANNON.Vec3(0,-30,0)});
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
async function loadStyle(style){
 if(loadedStyle===style)return;
 const filename=style==='bronze'?'Ancient_Bronze_Smooth_Recessed_Gold_D12.glb':style==='cardboard'?'Cardboard_D12_Raised_Rolls_Varied_Tape.glb':'knight_armor_d12_verified_gold_numbers.glb';
 const gltf=await loader.loadAsync('./dice-models/'+filename);
 const model=gltf.scene;
 if(style==='bronze')model.traverse(node=>{if(!node.isMesh)return;node.material=node.material.clone();const mat=node.material;if(mat.isMeshStandardMaterial||mat.isMeshPhysicalMaterial){mat.roughness=Math.max(.4,mat.roughness);mat.metalness=Math.min(.55,mat.metalness);mat.envMapIntensity=1;mat.side=THREE.DoubleSide;}});
 const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
 if(!size.x||!size.y||!size.z)throw Error('GLB has no visible geometry');
 const normalized=new THREE.Group();
 const center=bounds.getCenter(new THREE.Vector3());
 model.position.sub(center);
 // Bronze was exported with its visible face orientation inverted relative to the roller.
 // Rotate only that GLB; Knight Armor retains its verified original orientation.
 // Preserve the GLB's original handedness. Mirroring its X scale inverted the bronze mesh.
 normalized.add(model);
 normalized.scale.setScalar(1.8/Math.max(size.x,size.y,size.z));
 if(style==='cardboard'){
  // The separate, undecorated GLB is the ONLY collision source for this style.
  // Tape and rolled-paper meshes in the visible GLB never enter Cannon physics.
  if(!cardboardHull){
   const collisionGLB=await loader.loadAsync('./dice-models/Cardboard_D12_Unchanged_Collision_Hull.glb');
   const vertices=[];
   collisionGLB.scene.updateMatrixWorld(true);
   collisionGLB.scene.traverse(node=>{
    if(!node.isMesh)return;
    const positions=node.geometry.getAttribute('position');
    if(!positions)return;
    for(let i=0;i<positions.count;i++){
     const point=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(node.matrixWorld);
     if(!vertices.some(existing=>existing.distanceToSquared(point)<1e-8))vertices.push(point);
    }
   });
   if(vertices.length!==20)throw Error('Cardboard collision hull must contain 20 unique vertices, got '+vertices.length);
   const faces=knightFaceNormals.map(normal=>{
    const plane=Math.max(...vertices.map(v=>normal.dot(v)));
    const indices=vertices.map((v,i)=>Math.abs(normal.dot(v)-plane)<1e-4?i:-1).filter(i=>i>=0);
    if(indices.length!==5)throw Error('Invalid cardboard collision face: '+indices.length+' vertices');
    const midpoint=indices.reduce((sum,i)=>sum.add(vertices[i]),new THREE.Vector3()).divideScalar(5);
    const axis=vertices[indices[0]].clone().sub(midpoint).normalize();
    const side=new THREE.Vector3().crossVectors(normal,axis).normalize();
    indices.sort((i,j)=>{
     const a=vertices[i].clone().sub(midpoint),b=vertices[j].clone().sub(midpoint);
     return Math.atan2(a.dot(side),a.dot(axis))-Math.atan2(b.dot(side),b.dot(axis));
    });
    return indices;
   });
   cardboardHull={vertices,faces};
  }
  // Align the independent hull to the same origin and scale as the visible GLB.
  cardboardHull.visualCenter=center.clone();
  cardboardHull.visualScale=normalized.scale.x;
 }
 // Keep all styles in the same physical units, regardless of their source GLB dimensions.
 template=normalized;loadedStyle=style;
}
function diceGeometry(){
 // Regular dodecahedron: each face plane is normal · position = 1.
 // Its 20 vertices are intersections of three adjacent face planes.
 const normals=knightFaceNormals;
 const vertices=[];
 for(let i=0;i<normals.length;i++)for(let j=i+1;j<normals.length;j++)for(let k=j+1;k<normals.length;k++){
  const a=normals[i],b=normals[j],c=normals[k];
  const bc=new THREE.Vector3().crossVectors(b,c),ca=new THREE.Vector3().crossVectors(c,a),ab=new THREE.Vector3().crossVectors(a,b);
  const det=a.dot(bc);if(Math.abs(det)<1e-6)continue;
  const v=bc.add(ca).add(ab).divideScalar(det);
  if(normals.some(n=>n.dot(v)>1+1e-5))continue;
  if(!vertices.some(p=>p.distanceToSquared(v)<1e-8))vertices.push(v);
 }
 const faces=normals.map(n=>{
  const indices=vertices.map((v,i)=>Math.abs(n.dot(v)-1)<1e-5?i:-1).filter(i=>i>=0);
  if(indices.length!==5)throw Error('Invalid d12 face geometry');
  const center=indices.reduce((v,i)=>v.add(vertices[i]),new THREE.Vector3()).divideScalar(5);
  const axis=vertices[indices[0]].clone().sub(center).normalize();
  const side=new THREE.Vector3().crossVectors(n,axis).normalize();
  indices.sort((i,j)=>{
   const a=vertices[i].clone().sub(center),b=vertices[j].clone().sub(center);
   return Math.atan2(a.dot(side),a.dot(axis))-Math.atan2(b.dot(side),b.dot(axis));
  });
  return indices;
 });
 if(vertices.length!==20||faces.length!==12)throw Error('Invalid d12 collision hull');
 return {vertices,faces,labels:normals.map((normal,i)=>({normal,value:i+1}))};
}
// The verified Knight Armor GLB was authored in build_knight_final.py using
// global +Y projected into each pentagon's plane as the numeral-up direction.
// Do not use guessed per-face axes or glyph PCA: both rotate numbers incorrectly.
const knightFaceNormals=[
 [-.525731,.850651,0],[.525731,.850651,0],
 [-.525731,-.850651,0],[.525731,-.850651,0],
 [0,-.525731,.850651],[0,.525731,.850651],
 [0,-.525731,-.850651],[0,.525731,-.850651],
 [.850651,0,-.525731],[.850651,0,.525731],
 [-.850651,0,-.525731],[-.850651,0,.525731]
].map(v=>new THREE.Vector3(...v).normalize());
function knightFaceIndex(normal){
 let best=-Infinity,index=-1;
 for(let i=0;i<knightFaceNormals.length;i++){
  const dot=knightFaceNormals[i].dot(normal);
  if(dot>best){best=dot;index=i;}
 }
 if(best<.99)throw Error('Knight face normal mismatch: '+best);
 return index;
}
// Numeral-up vectors recovered from the Ancient Bronze GLB's face UV mapping.
// Unlike Knight Armor, bronze uses a separate texture orientation on each face.
const bronzeNumeralUp=[
 [-.692,-.428,-.582],[-.269,.166,-.949],[.269,-.166,-.949],[.692,.428,-.582],
 [.594,-.684,-.423],[-.594,.684,-.423],[.953,.257,-.159],[-.953,-.257,-.159],
 [-.423,.594,-.684],[.159,.953,-.257],[.423,-.594,-.684],[-.159,-.953,-.257]
].map(v=>new THREE.Vector3(...v).normalize());

 // Number placement in the approved cardboard GLB differs from Knight Armor.
 // Index = the existing physical face-normal index; value = printed cardboard numeral.
const cardboardValuesByPhysicalFace=[1,11,8,2,7,4,3,5,9,10,12,6];
// Verified against an actual per-face, texture-mapped orthographic projection
// of Cardboard_D12_Raised_Rolls_Varied_Tape.glb (each numeral 1–12).
// These vectors describe the painted glyphs, not the pentagon corners.
// Keep this mapping exclusive to the cardboard dice style.
const cardboardNumeralUp=[
 [0.808902, 0.499929, 0.309431], // 1 original correct
 [0.808209, 0.499500, 0.311926], // 2 original correct
 [0.707602, 0.601080, -0.371488], // 3 corrected 180°
 [0.010788, 0.850601, -0.525700], // 4 corrected 90° CCW
 [0.149626, 0.841075, 0.519813], // 5 original correct
 [0.302843, 0.817420, 0.490011], // 6 original correct
 [0.179182, 0.836884, 0.517223], // 7 corrected 90° clockwise
 [0.812582, -0.502203, 0.295809], // 8 original correct
 [0.308656, 0.809515, 0.499416], // 9 original correct
 [0.264679, 0.864025, -0.428260], // 10 corrected 180°
 [-0.834484, 0.515739, 0.194036], // 11 original correct
 [0.251820, 0.877820, -0.407453], // 12 corrected 180°
].map(v=>new THREE.Vector3(...v).normalize());
function factorForRest(scale){
 const size=new THREE.Box3().setFromPoints(geometry.vertices).getSize(new THREE.Vector3());
 return 1.8/Math.max(size.x,size.y,size.z)*scale;
}
function numeralUp(face){
 const normal=knightFaceNormals[knightFaceIndex(face.normal)];
 const y=new THREE.Vector3(0,1,0);
 return y.addScaledVector(normal,-y.dot(normal)).normalize();
}
function applyLighting(style){
 // Preserve the original lighting for Knight Armor and Ancient Bronze.
 // Unlit cardboard is diffuse and becomes washed out with the metal-die lights.
 const cardboard=style==='cardboard';
 scene.traverse(light=>{
  if(light.isHemisphereLight)light.intensity=cardboard?1.25:4.0;
  else if(light.isAmbientLight)light.intensity=cardboard?0.35:1.2;
  else if(light.isDirectionalLight){
   const isSun=light.position.x<0;
   light.intensity=cardboard?(isSun?1.7:0.75):(isSun?4.5:3.0);
  }
 });
}
export async function roll3d(quantity,style='knight',sizeMultiplier=1){
 await setup(style);applyLighting(style);cancelAnimationFrame(raf);
 for(const d of active){world.removeBody(d.body);scene.remove(d.mesh)}active=[];
 const rollLabels=style==='cardboard'?geometry.labels.map((face,i)=>({normal:face.normal,value:cardboardValuesByPhysicalFace[i]})):geometry.labels;
 const cols=Math.ceil(Math.sqrt(quantity)),scale=Math.min(1.25,Math.max(.48,3.8/cols))*Math.min(2.2,Math.max(.8,Number(sizeMultiplier)||1));
 for(let i=0;i<quantity;i++){
  const mesh=template.clone(true);mesh.scale.multiplyScalar(scale);
  // Collision hull must match the normalized visual size, not the GLB's original scale.
  const usingCardboardHull=style==='cardboard';
  const sourceVertices=usingCardboardHull?cardboardHull.vertices:geometry.vertices;
  const sourceFaces=usingCardboardHull?cardboardHull.faces:geometry.faces;
  const factor=usingCardboardHull?cardboardHull.visualScale*scale:factorForRest(scale);
  const center=usingCardboardHull?cardboardHull.visualCenter:new THREE.Box3().setFromPoints(geometry.vertices).getCenter(new THREE.Vector3());
  const shape=new CANNON.ConvexPolyhedron({
   vertices:sourceVertices.map(v=>new CANNON.Vec3((v.x-center.x)*factor,(v.y-center.y)*factor,(v.z-center.z)*factor)),
   faces:sourceFaces
  });
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
    const dt=Math.min(.05,(now-last)/1000)*1.9;last=now;
    world.step(1/60,dt,8);
    for(const d of active){d.mesh.position.copy(d.body.position);d.mesh.quaternion.copy(d.body.quaternion)}
    renderer.render(scene,camera);
    const settled=active.every(d=>d.body.velocity.length()<.22&&d.body.angularVelocity.length()<.3);stillTime=settled?stillTime+dt:0;
    if((stillTime>.25&&now-started>550)||now-started>4200){
     const up=new THREE.Vector3(0,1,0),screenUp=new THREE.Vector3(0,0,-1);
     const values=[],transitions=[];
     const columns=Math.ceil(Math.sqrt(active.length)),rows=Math.ceil(active.length/columns);
     const visualDiameter=1.8*scale;const spacing=Math.max(2.6,visualDiameter*1.65);
     active.forEach((d,i)=>{
      const q=d.mesh.quaternion.clone();
      const top=rollLabels.reduce((best,f)=>{
       const dot=f.normal.clone().applyQuaternion(q).dot(up);
       return dot>best.dot?{dot,face:f}:best;
      },{dot:-Infinity,face:rollLabels[0]}).face;
      values.push(top.value);
      const tilt=new THREE.Quaternion().setFromUnitVectors(top.normal.clone().applyQuaternion(q),up);
      const flat=tilt.clone().multiply(q);
      const numeralDirection=style==='bronze'?bronzeNumeralUp[knightFaceIndex(top.normal)]:style==='cardboard'?cardboardNumeralUp[top.value-1]:numeralUp(top);
      const textUp=numeralDirection.clone().applyQuaternion(flat);
      textUp.y=0;textUp.normalize();
      // Rotate the projected numeral-up vector exactly onto screen-up (-Z).
      // For a rotation about +Y, x'=cos(a)*x+sin(a)*z and
      // z'=-sin(a)*x+cos(a)*z. atan2(x,-z) makes x'=0,z'=-1.
      const yaw=Math.atan2(textUp.x,-textUp.z);
      const upright=new THREE.Quaternion().setFromAxisAngle(up,yaw).multiply(flat);
      // The bronze 1 glyph's local up direction is 90 degrees off the UV-based vector.
      // Correct only this physical face; do not touch physics or other dice models.
      if(style==='bronze'&&top.value===1){
       upright.premultiply(new THREE.Quaternion().setFromAxisAngle(up,Math.PI/2));
      }
      // Cardboard uses the collision hull, not decorative tape/rolls, for floor contact.
      // Existing Knight Armor and Bronze final placement remains unchanged.
      let restingY;
      if(style==='cardboard'){
       let lowest=Infinity;
       for(const vertex of cardboardHull.vertices){
        const y=vertex.clone().sub(cardboardHull.visualCenter).multiplyScalar(cardboardHull.visualScale*scale).applyQuaternion(upright).y;
        lowest=Math.min(lowest,y);
       }
       restingY=-5-lowest;
      }else{
       const originalRotation=d.mesh.quaternion.clone();
       d.mesh.quaternion.copy(upright);
       const visualBounds=new THREE.Box3().setFromObject(d.mesh);
       restingY=-5+(d.mesh.position.y-visualBounds.min.y);
       d.mesh.quaternion.copy(originalRotation);
      }
      const target=new THREE.Vector3((i%columns-(columns-1)/2)*spacing,restingY,(Math.floor(i/columns)-(rows-1)/2)*spacing);
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
