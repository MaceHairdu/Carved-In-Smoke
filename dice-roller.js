// Carved in Smoke — physics-driven 3D dice roller.
(async()=>{
const style=document.createElement('style');
style.textContent=`
#cis-dice-launch{position:fixed;right:22px;bottom:22px;z-index:2202;border:1px solid #c59b69;background:linear-gradient(135deg,#824438,#462b30);color:#ffebce;border-radius:14px;padding:12px 19px;box-shadow:0 8px 25px #0009;font:700 16px Georgia,serif;cursor:pointer}
#cis-dice-controls{position:fixed;right:20px;bottom:83px;z-index:2202;background:#242a2ff5;border:1px solid #b78a62;border-radius:13px;padding:17px;width:min(320px,calc(100vw - 40px));color:#eee3d2;box-shadow:0 14px 36px #000b}
#cis-dice-controls[hidden],#cis-dice-stage[hidden],#cis-roll-custom-fields[hidden],#cis-roll-auto-count[hidden]{display:none!important}
#cis-dice-controls label{font-size:12px;color:#d5bda0;display:block;margin:9px 0 5px}
#cis-dice-controls select,#cis-dice-controls input{width:100%;background:#171d20;color:white;border:1px solid #677078;border-radius:6px;padding:9px;font:inherit}
#cis-dice-controls .dice-actions{display:flex;gap:8px;margin-top:14px}
#cis-dice-controls button{flex:1;padding:10px;border-radius:7px;background:#874a3a;border:1px solid #c0926c;color:white;cursor:pointer}
#cis-dice-controls button.secondary{background:#394147}
#cis-dice-result{margin-top:12px;line-height:1.5;font:15px Georgia,serif}
#cis-dice-result strong{display:block;font-size:32px;color:#f4c485}
#cis-dice-stage{position:fixed;inset:0;z-index:2199;pointer-events:none;overflow:hidden}
#cis-dice-stage canvas{display:block;width:100%;height:100%}
#cis-dice-banner{position:absolute;top:9%;left:50%;transform:translateX(-50%);border:1px solid #b78a62;border-radius:12px;background:#1c242bea;padding:12px 28px;color:#f1ddbf;font:17px Georgia,serif;text-align:center;box-shadow:0 12px 30px #000a;white-space:nowrap}
#cis-dice-banner strong{display:block;color:#ffd48b;font-size:36px}
@media(max-width:750px){#cis-dice-banner{top:13%;font-size:14px}#cis-dice-banner strong{font-size:27px}}
`;document.head.append(style);
const launch=document.createElement('button');launch.id='cis-dice-launch';launch.type='button';launch.textContent='⚄ Roll Dice';
const panel=document.createElement('section');panel.id='cis-dice-controls';panel.hidden=true;
panel.innerHTML='<strong style="font:22px Georgia,serif;color:#e9ac81">Dice Roller</strong><label for="cis-roll-skill">Roll</label><select id="cis-roll-skill"><option>Grit</option><option>Finesse</option><option>Luck</option><option>Focus</option><option>Charm</option><option value="custom">Custom d12 pool</option></select><div id="cis-roll-auto-count" style="margin-top:12px;color:#d5bda0;font-size:14px"></div><div id="cis-roll-custom-fields" hidden><label for="cis-roll-count">Number of d12s</label><input id="cis-roll-count" type="number" min="1" max="20" value="2"></div><div class="dice-actions"><button type="button" id="cis-roll-go">Roll d12s</button><button type="button" class="secondary" id="cis-roll-close">Close</button></div><div id="cis-dice-result" role="status" aria-live="polite"></div>';
const stage=document.createElement('div');stage.id='cis-dice-stage';stage.hidden=true;
const banner=document.createElement('div');banner.id='cis-dice-banner';banner.hidden=true;stage.append(banner);
document.body.append(stage,panel,launch);
const skill=panel.querySelector('#cis-roll-skill'),count=panel.querySelector('#cis-roll-count'),result=panel.querySelector('#cis-dice-result');
function skillCount(){return Math.max(0,Math.floor(Number(document.querySelector('[data-total="'+skill.value+'"]')?.value)||0))}
function sync(){const custom=skill.value==='custom';panel.querySelector('#cis-roll-custom-fields').hidden=!custom;panel.querySelector('#cis-roll-auto-count').hidden=custom;if(!custom){const n=skillCount();panel.querySelector('#cis-roll-auto-count').textContent=n===0?'0 '+skill.value+': roll 2d12, keep the lowest.':'Roll '+n+'d12 (current '+skill.value+' total).'}}
skill.onchange=sync;launch.onclick=()=>{panel.hidden=!panel.hidden;if(!panel.hidden)sync()};
let THREE,CANNON,renderer,scene,camera,world,animation=0,dice=[],last=0,rolling=false;
function close(){panel.hidden=true;stage.hidden=true;cancelAnimationFrame(animation);rolling=false}
panel.querySelector('#cis-roll-close').onclick=close;
async function init(){
 if(renderer)return;
 [THREE,CANNON]=await Promise.all([
  import('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js'),
  import('https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js')
 ]);
 scene=new THREE.Scene();
 camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.1,150);
 camera.position.set(0,15,29);camera.lookAt(0,0,0);
 renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;
 stage.append(renderer.domElement);
 scene.add(new THREE.AmbientLight(0xffffff,2.0));
 const light=new THREE.DirectionalLight(0xffd8ae,3.2);light.position.set(-7,16,10);light.castShadow=true;scene.add(light);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(120,120),new THREE.MeshBasicMaterial({color:0x20252b,transparent:true,opacity:.10,depthWrite:false}));
 floor.rotation.x=-Math.PI/2;floor.position.y=-4.3;scene.add(floor);
 world=new CANNON.World({gravity:new CANNON.Vec3(0,-25,0)});
 world.allowSleep=true;
 world.defaultContactMaterial.friction=.48;world.defaultContactMaterial.restitution=.34;
 function wall(pos,normal){const body=new CANNON.Body({mass:0,shape:new CANNON.Plane()});body.position.set(...pos);body.quaternion.setFromEuler(...normal);world.addBody(body)}
 wall([0,-4.3,0],[-Math.PI/2,0,0]);
 wall([-12,0,0],[0,Math.PI/2,0]);wall([12,0,0],[0,-Math.PI/2,0]);
 wall([0,0,-8],[0,0,0]);wall([0,0,8],[0,Math.PI,0]);
}
function buildDie(){
 const geometry=new THREE.DodecahedronGeometry(1,0);
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x812d35,roughness:.38,metalness:.18,flatShading:true}));
 mesh.castShadow=true;
 mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry,10),new THREE.LineBasicMaterial({color:0xe0b67d})));
 const attr=geometry.getAttribute('position'),normalAttr=geometry.getAttribute('normal'),faces=new Map();
 for(let i=0;i<attr.count;i++){
  const normal=new THREE.Vector3().fromBufferAttribute(normalAttr,i).normalize();
  const key=[normal.x,normal.y,normal.z].map(v=>v.toFixed(3)).join(',');
  if(!faces.has(key))faces.set(key,{normal,vertices:[]});
  const p=new THREE.Vector3().fromBufferAttribute(attr,i);
  if(!faces.get(key).vertices.some(v=>v.distanceToSquared(p)<1e-7))faces.get(key).vertices.push(p);
 }
 const list=[...faces.values()];
 if(list.length!==12)throw Error('d12 mesh must have 12 faces; found '+list.length);
 list.forEach((face,i)=>{
  const center=face.vertices.reduce((acc,p)=>acc.add(p),new THREE.Vector3()).divideScalar(face.vertices.length);
  const axis=face.vertices[0].clone().sub(center).normalize();
  const side=new THREE.Vector3().crossVectors(face.normal,axis).normalize();
  const ordered=face.vertices.map(p=>({p,x:p.clone().sub(center).dot(axis),y:p.clone().sub(center).dot(side)})).sort((a,b)=>Math.atan2(a.y,a.x)-Math.atan2(b.y,b.x));
  const radius=Math.max(...ordered.map(v=>Math.hypot(v.x,v.y)));
  const verts=[],uv=[];
  for(let j=0;j<ordered.length;j++)for(const q of [{p:center,x:0,y:0},ordered[j],ordered[(j+1)%ordered.length]]){
   const p=q.p.clone().addScaledVector(face.normal,.008);
   verts.push(p.x,p.y,p.z);uv.push(.5+q.x/(radius*2.1),.5+q.y/(radius*2.1));
  }
  const overlay=new THREE.BufferGeometry();overlay.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));overlay.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));overlay.computeVertexNormals();
  const cv=document.createElement('canvas');cv.width=cv.height=256;const ctx=cv.getContext('2d');
  ctx.fillStyle='#ffe8bf';ctx.font='bold 116px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i+1),128,135);
  const texture=new THREE.CanvasTexture(cv);texture.colorSpace=THREE.SRGBColorSpace;
  mesh.add(new THREE.Mesh(overlay,new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide,depthWrite:false})));
 });
 // A spherical collision hull gives reliable bouncing, rolling and dice-to-dice collisions.
 const body=new CANNON.Body({mass:1,shape:new CANNON.Sphere(.94),linearDamping:.28,angularDamping:.35,sleepSpeedLimit:.13,sleepTimeLimit:.55});
 return {mesh,body,faces:list};
}
function faceValue(die){
 const q=new THREE.Quaternion(die.body.quaternion.x,die.body.quaternion.y,die.body.quaternion.z,die.body.quaternion.w);
 const up=new THREE.Vector3(0,1,0);let best=-Infinity,value=1;
 die.faces.forEach((face,i)=>{const score=face.normal.clone().applyQuaternion(q).dot(up);if(score>best){best=score;value=i+1}});
 return value;
}
function finish(zero,label){
 const values=dice.map(faceValue),outcome=zero?Math.min(...values):Math.max(...values);
 result.innerHTML='';
 const caption=document.createElement('span');caption.textContent=label+' · '+values.length+'d12 · '+(zero?'Lowest':'Highest');
 const big=document.createElement('strong');big.textContent=String(outcome);
 const detail=document.createElement('span');detail.textContent='Dice: '+values.join(', ')+(zero?' (zero-skill rule)':'');
 result.append(caption,big,detail);
 banner.replaceChildren();
 const t=document.createElement('span');t.textContent=label+' result';const v=document.createElement('strong');v.textContent=String(outcome);banner.append(t,v);banner.hidden=false;
 rolling=false;
}
panel.querySelector('#cis-roll-go').onclick=async()=>{
 if(rolling)return;
 const custom=skill.value==='custom';
 let n=custom?Math.floor(Number(count.value)||0):skillCount();
 n=Math.max(0,Math.min(20,n));const zero=!custom&&n===0;if(zero)n=2;
 if(n===0){result.textContent='Enter at least one die.';return}
 const button=panel.querySelector('#cis-roll-go');button.disabled=true;
 try{await init()}catch(e){result.textContent='3D physics could not load. '+e.message;button.disabled=false;return}
 button.disabled=false;cancelAnimationFrame(animation);
 dice.forEach(d=>{scene.remove(d.mesh);world.removeBody(d.body)});dice=[];stage.hidden=false;banner.hidden=true;result.textContent='Rolling…';
 const columns=Math.min(5,Math.ceil(Math.sqrt(n*1.5))),rows=Math.ceil(n/columns);
 const scale=Math.min(1.15,Math.max(.48,4.7/Math.max(columns,rows)));
 for(let i=0;i<n;i++){
  const d=buildDie();d.mesh.scale.setScalar(scale);
  // Scale the collision body to the same visible size.
  d.body.shapes[0].radius=.94*scale;d.body.updateBoundingRadius();
  const col=i%columns,row=Math.floor(i/columns);
  d.body.position.set(-10+col*1.0,5+row*1.4+i*.24,(i%3-1)*1.0);
  d.body.velocity.set(11+Math.random()*6,Math.random()*4,Math.random()*5-2.5);
  d.body.angularVelocity.set(Math.random()*18-9,Math.random()*18-9,Math.random()*18-9);
  d.body.quaternion.setFromEuler(Math.random()*6,Math.random()*6,Math.random()*6);
  world.addBody(d.body);scene.add(d.mesh);dice.push(d);
 }
 rolling=true;const started=performance.now();last=started;let settled=0;const watchdog=setTimeout(()=>{if(rolling){cancelAnimationFrame(animation);finish(zero,custom?'Custom':skill.value)}},8500);
 const label=custom?'Custom':skill.value;
 function tick(now){
  try{
  const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;world.step(1/60,dt,3);
  for(const d of dice){d.mesh.position.copy(d.body.position);d.mesh.quaternion.copy(d.body.quaternion)}
  renderer.render(scene,camera);
  const elapsed=now-started;
  const still=dice.every(d=>d.body.velocity.length()<.3&&d.body.angularVelocity.length()<.45);
  settled=still?settled+dt:0;
  if((settled>.7&&elapsed>1200)||elapsed>7500){clearTimeout(watchdog);finish(zero,label);return}
  animation=requestAnimationFrame(tick);
  }catch(error){clearTimeout(watchdog);console.error('Dice physics error',error);finish(zero,label);result.append(document.createTextNode(' · Animation interrupted; result read from last dice positions.'));}
 }
 animation=requestAnimationFrame(tick);
};
window.addEventListener('resize',()=>{if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
})();
