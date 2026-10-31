// Carved in Smoke — animated 3D d12 roller
(async function(){
const css=document.createElement('style');css.textContent=`
#cis-dice-launch{position:fixed;right:22px;bottom:22px;z-index:2100;border:1px solid #d3a16c;background:linear-gradient(145deg,#8c4c3b,#472a2c);color:#fff1d5;border-radius:18px;padding:13px 19px;box-shadow:0 8px 28px #0009;font:700 16px Georgia,serif;cursor:pointer}
#cis-dice-controls{position:fixed;right:20px;bottom:82px;z-index:2101;background:#242a2fee;border:1px solid #ad8462;border-radius:14px;padding:17px;width:min(330px,calc(100vw - 40px));box-shadow:0 15px 35px #000b;color:#eee3d2}
#cis-dice-controls[hidden],#cis-dice-stage[hidden]{display:none!important}
#cis-dice-controls label{font-size:12px;color:#d5bda0;display:block;margin:8px 0 5px}
#cis-dice-controls select,#cis-dice-controls input{width:100%;background:#171d20;color:white;border:1px solid #677078;border-radius:6px;padding:9px;font:inherit}
#cis-dice-controls .dice-actions{display:flex;gap:8px;margin-top:14px}
#cis-dice-controls button{flex:1;padding:10px;border-radius:7px;background:#874a3a;border:1px solid #c0926c;color:white;cursor:pointer}
#cis-dice-controls button.secondary{background:#394147}
#cis-dice-result{margin-top:12px;font:16px Georgia,serif;line-height:1.5;min-height:25px}#cis-dice-result strong{display:block;font-size:32px;color:#f2c17b;margin:5px 0}#cis-dice-stage .cis-dice-banner{position:absolute;left:50%;top:12%;transform:translateX(-50%);background:#1b2228ee;border:1px solid #c29262;border-radius:12px;padding:12px 25px;text-align:center;font:18px Georgia,serif;color:#eee3d2;box-shadow:0 12px 32px #0009;white-space:nowrap}#cis-dice-stage .cis-dice-banner strong{display:block;font-size:36px;color:#ffd28a}
#cis-dice-stage{position:fixed;inset:0;z-index:2099;pointer-events:none;overflow:hidden}
#cis-dice-stage canvas{width:100%;height:100%;display:block}
@media(prefers-reduced-motion:reduce){#cis-dice-stage{display:none!important}}
`;document.head.appendChild(css);
const launch=document.createElement('button');launch.id='cis-dice-launch';launch.type='button';launch.textContent='⚄ Roll Dice';launch.setAttribute('aria-label','Open 3D dice roller');
const panel=document.createElement('div');panel.id='cis-dice-controls';panel.hidden=true;panel.innerHTML='<strong style="font:22px Georgia,serif;color:#e9ac81">Dice Roller</strong><label for="cis-roll-skill">Roll</label><select id="cis-roll-skill"><option value="Grit">Grit</option><option value="Finesse">Finesse</option><option value="Luck">Luck</option><option value="Focus">Focus</option><option value="Charm">Charm</option><option value="custom">Custom d12 pool</option></select><div id="cis-roll-auto-count" style="margin-top:12px;color:#d5bda0;font-size:14px"></div><div id="cis-roll-custom-fields" hidden><label for="cis-roll-count">Number of d12s</label><input id="cis-roll-count" type="number" min="1" max="20" value="2"></div><div class="dice-actions"><button type="button" id="cis-roll-go">Roll d12s</button><button type="button" class="secondary" id="cis-roll-close">Close</button></div><div id="cis-dice-result" role="status" aria-live="polite"></div>';
const stage=document.createElement('div');stage.id='cis-dice-stage';stage.hidden=true;const banner=document.createElement('div');banner.className='cis-dice-banner';stage.appendChild(banner);document.body.append(stage,panel,launch);
const skill=panel.querySelector('#cis-roll-skill'),count=panel.querySelector('#cis-roll-count'),result=panel.querySelector('#cis-dice-result');
function sync(){const custom=skill.value==='custom';panel.querySelector('#cis-roll-custom-fields').hidden=!custom;panel.querySelector('#cis-roll-auto-count').hidden=custom;if(custom)return;const total=document.querySelector('[data-total="'+skill.value+'"]');const n=total?Math.max(0,Number(total.value)||0):0;count.value=n;panel.querySelector('#cis-roll-auto-count').textContent=n===0?'Automatically rolls 2d12 and takes the lowest (0 '+skill.value+').':'Automatically rolls '+n+'d12 using your '+skill.value+' total.';}
skill.addEventListener('change',sync);launch.onclick=()=>{panel.hidden=!panel.hidden;if(!panel.hidden)sync()};panel.querySelector('#cis-roll-close').onclick=()=>{panel.hidden=true;stage.hidden=true};
let THREE=null,renderer=null,scene=null,camera=null,frame=0;
async function setup(){if(renderer)return true;try{THREE=await import('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js');}catch(e){return false}
scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,100);camera.position.set(0,0,24);
renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;stage.appendChild(renderer.domElement);
scene.add(new THREE.AmbientLight(0xffffff,2));const light=new THREE.DirectionalLight(0xffd8a3,3);light.position.set(-5,8,12);scene.add(light);return true}
function makeDie(value){
 const geometry=new THREE.DodecahedronGeometry(1.05,0);
 const body=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x862f35,roughness:.46,metalness:.12,flatShading:true}));
 body.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry,12),new THREE.LineBasicMaterial({color:0xd8ad73})));
 // Build actual pentagonal face overlays, with their numbers texture-mapped to the surface.
 // Unlike sprites and rectangular labels, these rotate with the die and cannot float.
 const positions=geometry.getAttribute('position'),faces=new Map();
 for(let i=0;i<positions.count;i+=3){
  const a=new THREE.Vector3().fromBufferAttribute(positions,i);
  const b=new THREE.Vector3().fromBufferAttribute(positions,i+1);
  const c=new THREE.Vector3().fromBufferAttribute(positions,i+2);
  const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
  if(normal.dot(a)<0)normal.negate();
  const key=[normal.x,normal.y,normal.z].map(v=>v.toFixed(3)).join(',');
  if(!faces.has(key))faces.set(key,{normal,points:[]});
  const face=faces.get(key);
  for(const p of [a,b,c])if(!face.points.some(q=>q.distanceToSquared(p)<.000001))face.points.push(p);
 }
 const all=[...faces.values()];
 if(all.length!==12)throw Error('Invalid d12: '+all.length+' faces');
 all.forEach((face,index)=>{
  const center=face.points.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).divideScalar(face.points.length);
  const u=face.points[0].clone().sub(center).normalize(),v=new THREE.Vector3().crossVectors(face.normal,u).normalize();
  const points=face.points.map(p=>({p,x:p.clone().sub(center).dot(u),y:p.clone().sub(center).dot(v)})).sort((a,b)=>Math.atan2(a.y,a.x)-Math.atan2(b.y,b.x));
  const radius=Math.max(...points.map(p=>Math.hypot(p.x,p.y)));
  const vertices=[],uvs=[];
  for(let j=0;j<points.length;j++){
   for(const p of [{p:center,x:0,y:0},points[j],points[(j+1)%points.length]]){
    const shifted=p.p.clone().addScaledVector(face.normal,.006);
    vertices.push(shifted.x,shifted.y,shifted.z);
    uvs.push(.5+p.x/(radius*2.16),.5+p.y/(radius*2.16));
   }
  }
  const surface=new THREE.BufferGeometry();
  surface.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  surface.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  surface.computeVertexNormals();
  const cv=document.createElement('canvas');cv.width=cv.height=256;
  const ctx=cv.getContext('2d');ctx.clearRect(0,0,256,256);
  ctx.fillStyle='#ffe7b9';ctx.font='bold 115px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(index+1),128,133);
  const texture=new THREE.CanvasTexture(cv);texture.colorSpace=THREE.SRGBColorSpace;
  body.add(new THREE.Mesh(surface,new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide,depthWrite:false})));
 });
 body.userData.target=new THREE.Quaternion().setFromUnitVectors(all[value-1].normal,new THREE.Vector3(0,0,1));
 return body;
}
let current=[];
panel.querySelector('#cis-roll-go').onclick=async()=>{let n=skill.value==='custom'?Number(count.value):Number(document.querySelector('[data-total="'+skill.value+'"]')?.value||0);n=Math.max(0,Math.min(skill.value==='custom'?20:100,Math.floor(n)||0));const zero=n===0;if(zero)n=2;const values=Array.from({length:n},()=>crypto.getRandomValues(new Uint32Array(1))[0]%12+1);const outcome=zero?Math.min(...values):Math.max(...values);
const rollName=skill.value==='custom'?'Custom':skill.value;result.replaceChildren();const heading=document.createElement('span');heading.textContent=rollName+' · '+n+'d12 · '+(zero?'Lowest':'Highest')+' result';const winner=document.createElement('strong');winner.textContent=String(outcome);const detail=document.createElement('span');detail.textContent='Dice: '+values.join(', ')+(zero?' (zero-skill rule)':'');result.append(heading,winner,detail);banner.replaceChildren();const bannerLabel=document.createElement('span');bannerLabel.textContent=rollName+' result';const bannerValue=document.createElement('strong');bannerValue.textContent=String(outcome);banner.append(bannerLabel,bannerValue);count.value=n;
cancelAnimationFrame(frame);current.forEach(d=>scene?.remove(d));current=[];stage.hidden=false;
if(!(await setup())){detail.textContent+=' · 3D renderer unavailable';stage.hidden=true;return}
const duration=1900,started=performance.now();
const columns=Math.min(5,Math.ceil(Math.sqrt(n*1.6))),rows=Math.ceil(n/columns);
const spacing=Math.min(2.8,14/columns),size=Math.min(1,Math.max(.48,4/Math.max(columns,rows)));
for(let i=0;i<n;i++){
 const die=makeDie(values[i]);scene.add(die);current.push(die);
 const col=i%columns,row=Math.floor(i/columns);
 const x=(col-(Math.min(columns,n)-1)/2)*spacing-2.5;
 const y=((rows-1)/2-row)*spacing;
 die.scale.setScalar(size);
 die.userData={...die.userData,x,y,start:new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random()*6,Math.random()*6,Math.random()*6)),turns:3+Math.random()*2};
}
function animate(now){
 const t=Math.min(1,(now-started)/duration),ease=1-Math.pow(1-t,3);
 for(let i=0;i<current.length;i++){
  const die=current[i],u=die.userData;
  const x=-19+(u.x+19)*ease;
  const bounce=Math.abs(Math.sin(t*13+i*.6))*1.5*(1-t);
  die.position.set(x,u.y+Math.sin(t*Math.PI)*2.2*(1-t)+bounce,0);
  const spin=new THREE.Quaternion().setFromEuler(new THREE.Euler((1-t)*u.turns*Math.PI*2,(1-t)*u.turns*Math.PI*2*.75,0));
  die.quaternion.copy(spin).multiply(u.target);
 }
 renderer.render(scene,camera);
 if(t<1)frame=requestAnimationFrame(animate);
}
frame=requestAnimationFrame(animate);
};
window.addEventListener('resize',()=>{if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
})();