// Carved in Smoke dice roller. Uses the open-source Dice Box 3D physics engine.
(()=>{
const css=document.createElement('style');css.textContent=`
#cis-dice-launch{position:fixed;right:20px;bottom:20px;z-index:2302;padding:12px 19px;border:1px solid #d1a16f;border-radius:15px;background:#754338;color:#ffebd1;font:700 16px Georgia,serif;cursor:pointer;box-shadow:0 8px 22px #0009}
#cis-dice-controls{position:fixed;right:20px;bottom:80px;z-index:2302;width:min(265px,calc(100vw - 40px));padding:17px;border:1px solid #bd9066;border-radius:13px;background:#242a2ff5;color:#eee3d2;box-shadow:0 15px 35px #000b;font:15px Georgia,serif}
#cis-dice-controls[hidden],#cis-dice-stage[hidden]{display:none!important}
#cis-dice-controls .cis-style{margin:12px 0 0}#cis-dice-controls .cis-style select{display:block;width:100%;margin-top:5px;background:#171d20;color:#fff1db;border:1px solid #677078;border-radius:6px;padding:9px;font:15px Georgia,serif}#cis-dice-controls .cis-skills{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;margin:14px 0}
#cis-dice-controls button{background:#854c3b;color:#fff1db;border:1px solid #b78861;border-radius:7px;padding:11px;cursor:pointer;font:16px Georgia,serif}
#cis-dice-controls button:disabled{opacity:.5;cursor:wait}
#cis-dice-controls .cis-skills button:last-child{grid-column:1/-1}
#cis-dice-controls .cis-custom{border-top:1px solid #5d5e60;padding-top:12px;display:flex;gap:8px;align-items:end}
#cis-dice-controls .cis-custom label{flex:1;font:12px Georgia,serif;color:#d8c0a4}
#cis-dice-controls input{display:block;box-sizing:border-box;width:100%;margin-top:5px;padding:10px;border:1px solid #677078;border-radius:6px;background:#171d20;color:white;font:16px Georgia,serif}
#cis-dice-controls .cis-close{margin-top:12px;background:#353e43;width:100%}
#cis-dice-result{margin-top:12px;line-height:1.45;overflow-wrap:anywhere}
#cis-dice-result{min-height:91px;box-sizing:border-box}
#cis-dice-result strong{display:block;font-size:32px;color:#ffd28a}
#cis-dice-stage{position:fixed;inset:0;z-index:2299;pointer-events:none}
#cis-dice-stage canvas{pointer-events:none!important}
#cis-dice-banner{position:fixed;top:12%;left:50%;transform:translateX(-50%);background:#1b232bee;border:1px solid #bd9066;border-radius:12px;color:#f1dec4;padding:12px 25px;text-align:center;white-space:nowrap;box-shadow:0 12px 30px #0009;font:16px Georgia,serif}
#cis-dice-banner strong{display:block;font-size:36px;color:#ffd28a}
#cis-roll-history{position:fixed;top:0;right:0;bottom:0;z-index:2305;width:min(370px,100vw);box-sizing:border-box;padding:22px;background:#242a2f;color:#eee3d2;border-left:1px solid #bd9066;box-shadow:-12px 0 35px #0009;overflow-y:auto;font:15px Georgia,serif}
#cis-roll-history[hidden]{display:none!important}
#cis-roll-history .history-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:18px}
#cis-roll-history h2{font-size:23px;color:#e9ac81;margin:0}
#cis-roll-history button{background:#854c3b;color:#fff1db;border:1px solid #b78861;border-radius:7px;padding:9px 12px;cursor:pointer;font:15px Georgia,serif}
#cis-roll-history-list{display:grid;gap:12px}
#cis-roll-history .history-entry{padding:13px;border:1px solid #5d5e60;border-radius:9px;background:#1a2024}
#cis-roll-history .history-entry header{display:flex;justify-content:space-between;gap:10px;color:#e9ac81;font-weight:bold}
#cis-roll-history .history-entry p{margin:8px 0 0;overflow-wrap:anywhere}
#cis-roll-history .history-result{font-size:19px;color:#ffd28a;font-weight:bold}
#cis-roll-history-empty{color:#d8c0a4}
#cis-dice-controls .cis-history-open{width:100%;margin-top:10px;background:#353e43}
`;document.head.append(css);
const launch=document.createElement('button');launch.id='cis-dice-launch';launch.type='button';launch.textContent='⚄ Roll Dice';
const panel=document.createElement('section');panel.id='cis-dice-controls';panel.hidden=true;
panel.innerHTML='<strong style="font-size:22px;color:#e9ac81">Dice Roller</strong><label class="cis-style">Dice Style<select id="cis-dice-style"><option value="knight">Knight Armor</option><option value="bronze">Ancient Bronze</option></select></label><div class="cis-skills"><button data-skill="Grit">Grit</button><button data-skill="Finesse">Finesse</button><button data-skill="Charm">Charm</button><button data-skill="Focus">Focus</button><button data-skill="Luck">Luck</button></div><div class="cis-custom"><label>Number of d12s<input id="cis-roll-count" type="number" min="1" max="20" value="2"></label><button id="cis-roll-custom">Roll Custom</button></div><button class="cis-history-open" id="cis-history-open">Roll History</button><button class="cis-close" id="cis-roll-close">Close</button><div id="cis-dice-result" role="status" aria-live="polite"></div>';
const stage=document.createElement('div');stage.id='cis-dice-stage';stage.hidden=true;
const banner=document.createElement('div');banner.id='cis-dice-banner';banner.hidden=true;stage.append(banner);
const historyPanel=document.createElement('aside');historyPanel.id='cis-roll-history';historyPanel.hidden=true;historyPanel.setAttribute('aria-label','Roll History');
historyPanel.innerHTML='<div class="history-head"><h2>Roll History</h2><button id="cis-history-close" type="button" aria-label="Close roll history">Close</button></div><div id="cis-roll-history-list"></div><p id="cis-roll-history-empty">No rolls yet.</p>';
document.body.append(stage,panel,launch,historyPanel);
const historyList=historyPanel.querySelector('#cis-roll-history-list'),historyEmpty=historyPanel.querySelector('#cis-roll-history-empty');
const history=[];
function addHistory(label,values,zero){
 const winning=zero?Math.min(...values):Math.max(...values);
 const timestamp=new Date();
 history.unshift({label,values:[...values],winning,zero,timestamp:timestamp.toISOString()});
 const entry=document.createElement('article');entry.className='history-entry';
 const heading=document.createElement('header');const skill=document.createElement('span');skill.textContent=label;const outcome=document.createElement('span');outcome.className='history-result';outcome.textContent=String(winning);heading.append(skill,outcome);
 const time=document.createElement('p');time.style.cssText='font-size:12px;color:#c5b5a3;margin:6px 0';time.textContent=timestamp.toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit'});
 const dice=document.createElement('p');dice.textContent='Rolls: '+values.join(', ');
 const rule=document.createElement('p');rule.textContent='Result used: '+winning+' ('+(zero?'lowest — zero-skill rule':'highest')+')';
 entry.append(heading,time,dice,rule);historyList.prepend(entry);historyEmpty.hidden=true;
}
panel.querySelector('#cis-history-open').onclick=()=>{historyPanel.hidden=false;panel.hidden=true};
historyPanel.querySelector('#cis-history-close').onclick=()=>{historyPanel.hidden=true;panel.hidden=false};
const result=panel.querySelector('#cis-dice-result'),customCount=panel.querySelector('#cis-roll-count');
const styleSelect=panel.querySelector('#cis-dice-style');
styleSelect.value=localStorage.getItem('cis-dice-style')==='bronze'?'bronze':'knight';
styleSelect.addEventListener('change',()=>localStorage.setItem('cis-dice-style',styleSelect.value));
launch.onclick=()=>{panel.hidden=!panel.hidden};
panel.querySelector('#cis-roll-close').onclick=()=>{panel.hidden=true;stage.hidden=true;historyPanel.hidden=true;diceBox?.clear()};
let diceBox=null,initPromise=null,busy=false,rollToken=0;let glbEngine=null;
// Dismiss only completed dice visuals; keep the roller and history usable.
let diceOverlayReady=false;
document.addEventListener('pointerdown',(event)=>{
 if(!diceOverlayReady||stage.hidden)return;
 // Interactions with the roller, its launch button, or history must not dismiss it.
 if(event.target.closest('#cis-dice-controls, #cis-dice-launch, #cis-roll-history'))return;
 stage.hidden=true;
 banner.hidden=true;
 panel.hidden=true;
 diceOverlayReady=false;
},true);
async function initialize(){
 if(diceBox)return diceBox;
 if(initPromise)return initPromise;
 initPromise=(async()=>{
  const url='https://unpkg.com/@3d-dice/dice-box@1.1.4/dist/';
  const module=await import(url+'dice-box.es.min.js');
  const box=new module.default({
   container:'#cis-dice-stage',assetPath:'assets/',origin:url,
   gravity:1,friction:.72,restitution:.45,angularDamping:.37,linearDamping:.33,
   throwForce:6,spinForce:5,scale:5.5,themeColor:'#873f42',
   enableShadows:true,offscreen:false,settleTimeout:5500
  });
  await box.init();diceBox=box;return box;
 })();
 try{return await initPromise}catch(e){initPromise=null;throw e}
}
function display(label,values,zero){
 const winning=zero?Math.min(...values):Math.max(...values);
 result.replaceChildren();
 const info=document.createElement('span');info.textContent=label+' · '+values.length+'d12 · '+(zero?'Lowest':'Highest');
 const number=document.createElement('strong');number.textContent=String(winning);
 const detail=document.createElement('span');detail.textContent='Dice: '+values.join(', ')+(zero?' · Zero-skill rule':'');
 result.append(info,number,detail);
 banner.replaceChildren();
 const heading=document.createElement('span');heading.textContent=label+' result';
 const large=document.createElement('strong');large.textContent=String(winning);
 banner.append(heading,large);banner.hidden=false;
}
function setBusy(value){busy=value;panel.querySelectorAll('button[data-skill],#cis-roll-custom').forEach(b=>b.disabled=value)}
async function roll(label,score,isCustom){
 if(busy)return;
 const zero=!isCustom&&score===0;
 const qty=zero?2:score;
 if(!Number.isInteger(qty)||qty<1||qty>20){result.textContent='Enter a number from 1 to 20.';return}
 const token=++rollToken;
 setBusy(true);diceOverlayReady=false;banner.hidden=true;
 stage.hidden=false;
 try{
  if(!glbEngine)glbEngine=await import('./dice-3d.js?v=bronze-choice-19');
  if(token!==rollToken)return;
  const values=await glbEngine.roll3d(qty,styleSelect.value,Number(localStorage.getItem('cis-dice-scale')||'1.5'));
  if(token!==rollToken)return;
  if(values.length!==qty||values.some(v=>!Number.isInteger(v)||v<1||v>12))throw Error('Invalid 3D face results');
  display(label,values,zero);
  addHistory(isCustom?'Custom Roll':label,values,zero);
  diceOverlayReady=true;
 }catch(e){
  if(token===rollToken){diceOverlayReady=false;result.textContent='3D dice error: '+e.message;stage.hidden=true;console.error('CiS dice',e)}
 }finally{if(token===rollToken)setBusy(false)}
}
for(const button of panel.querySelectorAll('[data-skill]')){
 button.onclick=()=>{
  const name=button.dataset.skill;
  const el=document.querySelector('[data-total="'+name+'"]');
  const raw=el?.value??el?.textContent;
  const score=Math.max(0,Math.floor(Number(raw)||0));
  roll(name,score,false);
 };
}
panel.querySelector('#cis-roll-custom').onclick=()=>roll('Custom Roll',Number(customCount.value),true);
})();