/* Moza Studio — Flip & Rotate (rot-r1)
   1. Tombol "Flip" di dock (muncul saat foto / shape / icon dipilih) -> dropdown Flip horizontal / Flip vertical.
   2. Tombol "Rotate" di dock -> dial putar + input derajat + tombol -90 / +90 / 0.
   3. Badge derajat live saat menarik handle rotasi (snap halus ke kelipatan 45, Shift = 15).
   4. Perbaikan elemen ter-flip: flip sekarang mirror di frame LOKAL elemen, jadi sudut visual selalu = el.rot,
      handle resize tidak terbalik, dan handle rotasi mengikuti pointer.
   Aditif: tidak mengubah struktur data lama (el.flipX / el.flipY / el.rot tetap dipakai). */
(function(){
'use strict';
if(window.__mozaFlipRotate)return;
if(typeof S==='undefined'||typeof ACT==='undefined'||typeof renderTools!=='function'||typeof elStyle!=='function')return;
window.__mozaFlipRotate=true;

const FLIPPABLE=['image','shape','icon'];
const num=v=>Number(v)||0;
const single=el=>!!el&&(!!el.flipX!==!!el.flipY);        // flip di satu sumbu saja
const norm=a=>{a=Math.round(a);while(a>180)a-=360;while(a<=-180)a+=360;return a};
/* sudut yang ditulis ke CSS transform. Dengan scale (flip) di luar rotate, flip satu sumbu membalik arah putar,
   jadi dikompensasi supaya sudut visual tetap = el.rot (mirror terjadi di frame lokal elemen). */
const cssRot=el=>single(el)?-num(el.rot):num(el.rot);

/* ---------- render: sudut CSS + penanda flipY (posisi handle rotasi) ---------- */
const prevStyle=elStyle;
elStyle=function(el){
 let c=prevStyle.apply(this,arguments);
 if(el&&(el.flipX||el.flipY)){
  if(c&&!/;\s*$/.test(c))c+=';';
  if(single(el)&&num(el.rot))c+=`transform:rotate(${cssRot(el)}deg);`;
  if(el.flipY)c+='--mz-fy:1;';
 }
 return c;
};
const prevGeom=applyGeomNode;
applyGeomNode=function(n,el){
 const r=prevGeom.apply(this,arguments);
 if(n&&el&&single(el))n.style.transform=`rotate(${cssRot(el)}deg)`;
 return r;
};
/* runtime prototype membaca sudut transform dari data-sr */
const prevHTML=elHTML;
elHTML=function(el,ctx){
 let h=prevHTML.apply(this,arguments);
 if(h&&el&&!(ctx&&ctx.edit)&&single(el)&&num(el.rot))h=h.replace(`data-sr="${num(el.rot)}"`,`data-sr="${cssRot(el)}"`);
 return h;
};

/* ---------- handle resize pada elemen ter-flip: tukar sisi sesuai posisi visual ---------- */
const prevResize=startResize;
startResize=function(e,id,dir){
 const f=findEl(id);
 if(f&&f.el&&typeof dir==='string'){
  if(f.el.flipX)dir=dir.replace(/[ew]/g,c=>c==='e'?'w':'e');
  if(f.el.flipY)dir=dir.replace(/[ns]/g,c=>c==='n'?'s':'n');
 }
 return prevResize.call(this,e,id,dir);
};

/* ---------- badge derajat ---------- */
let badge=null;
function showBadge(x,y,a){
 if(!badge){badge=document.createElement('div');badge.id='mzfr-badge';document.body.appendChild(badge)}
 badge.textContent=a+'°';badge.style.left=(x+16)+'px';badge.style.top=(y+16)+'px';badge.style.display='block';
}
function hideBadge(){if(badge)badge.style.display='none'}
function snapAngle(a,ev){
 if(ev&&ev.shiftKey)return norm(Math.round(a/15)*15);
 a=norm(a);
 if(ev&&ev.altKey)return a;
 const t=Math.round(a/45)*45;
 return Math.abs(a-t)<=2?norm(t):a;
}

/* ---------- handle rotasi (menggantikan versi sederhana, + badge derajat) ---------- */
startRotate=function(e,id){
 const f=findEl(id);if(!f||f.el.locked)return;e.preventDefault();
 const el=f.el,node=nodeOf(id);let did=false;
 const mv=ev=>{
  if(!did){did=true;commit(discrete())}
  const r=node.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  const a=snapAngle(Math.atan2(ev.clientY-cy,ev.clientX-cx)*180/Math.PI+90,ev);
  el.rot=a;applyGeomNode(node,el);showBadge(ev.clientX,ev.clientY,a);
 };
 const up=()=>{window.removeEventListener('pointermove',mv);hideBadge();if(did){renderCanvas();renderRight();renderTools()}};
 window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up,{once:true});
};

/* ---------- aksi flip ---------- */
const sel=()=>{try{return selIds().map(id=>{const f=findEl(id);return f&&f.el}).filter(Boolean)}catch(_){return []}};
const flippables=()=>sel().filter(el=>FLIPPABLE.includes(el.type)&&!el.locked);
function flip(axis){
 const els=flippables();if(!els.length)return;
 const key=axis==='h'?'flipX':'flipY',next=!els.every(el=>el[key]);
 commit(discrete());els.forEach(el=>{el[key]=next});
 renderCanvas();renderRight();renderTools();
}
ACT['mzfr-flip-h']=()=>flip('h');
ACT['mzfr-flip-v']=()=>flip('v');

function setRot(a,final){
 const ids=selIds();if(ids.length!==1)return;
 const f=findEl(ids[0]);if(!f||f.el.locked)return;
 if(!setRot.did){setRot.did=true;commit(discrete())}
 f.el.rot=norm(a);
 const n=nodeOf(f.el.id);if(n)applyGeomNode(n,f.el);
 if(final){setRot.did=false;renderCanvas();renderRight();renderTools()}
}
ACT['mzfr-rot-step']=b=>{setRot.did=false;const f=findEl(selIds()[0]);if(f)setRot(num(f.el.rot)+num(b.dataset.v),true)};
ACT['mzfr-rot-zero']=()=>{setRot.did=false;setRot(0,true)};

/* ---------- popover ---------- */
let pop=null,popKind=null;
const ICO={
 flip:'<path d="M12 3v18" stroke-dasharray="2 3"/><path d="M8 7L3 17h5zM16 7l5 10h-5z"/>',
 rot:'<path d="M20 12a8 8 0 11-2.4-5.7M20 4v5h-5"/>',
 fh:'<path d="M12 3v18" stroke-dasharray="2 3"/><path d="M8 7L3 17h5zM16 7l5 10h-5z"/>',
 fv:'<path d="M3 12h18" stroke-dasharray="2 3"/><path d="M7 8L17 3v5zM7 16l10 5v-5z" transform="translate(0 0)"/>'
};
function closePop(){if(pop){pop.remove();pop=null;popKind=null}document.querySelectorAll('#dock [data-mzfr].on').forEach(b=>b.classList.remove('on'))}
function placePop(btn){
 const r=btn.getBoundingClientRect(),w=pop.offsetWidth,vw=innerWidth;
 pop.style.top=Math.round(r.bottom+8)+'px';
 pop.style.left=Math.round(Math.max(8,Math.min(vw-w-8,r.left+r.width/2-w/2)))+'px';
}
function flipHTML(){
 const els=flippables(),all=k=>els.length&&els.every(e=>e[k]);
 const item=(a,ic,t,on)=>`<button type="button" class="mzfr-it" data-a="${a}"><svg viewBox="0 0 24 24">${ic}</svg><span>${t}</span><b>${on?'✓':''}</b></button>`;
 return item('mzfr-flip-h',ICO.fh,'Flip horizontal',all('flipX'))+item('mzfr-flip-v',ICO.fv,'Flip vertical',all('flipY'));
}
function rotHTML(){
 const el=sel()[0],a=el?norm(num(el.rot)):0;
 return `<div class="mzfr-dial" id="mzfr-dial" aria-label="Putar elemen"><div class="mzfr-knobwrap" style="transform:rotate(${a}deg)"><i class="mzfr-knob"></i></div><div class="mzfr-read"><input id="mzfr-num" type="number" min="-180" max="180" step="1" value="${a}" aria-label="Derajat"><span>°</span></div></div>
 <div class="mzfr-row"><button type="button" class="mzfr-q" data-a="mzfr-rot-step" data-v="-90">⟲ −90°</button><button type="button" class="mzfr-q" data-a="mzfr-rot-zero">0°</button><button type="button" class="mzfr-q" data-a="mzfr-rot-step" data-v="90">+90° ⟳</button></div>
 <div class="mzfr-hint">Tarik dial atau ketik derajat. Shift = per 15°, Alt = tanpa snap.</div>`;
}
function bindRot(){
 const dial=pop.querySelector('#mzfr-dial'),inp=pop.querySelector('#mzfr-num'),kw=pop.querySelector('.mzfr-knobwrap');
 const paint=a=>{kw.style.transform=`rotate(${a}deg)`;inp.value=a};
 const fromPointer=ev=>{const r=dial.getBoundingClientRect();return snapAngle(Math.atan2(ev.clientY-(r.top+r.height/2),ev.clientX-(r.left+r.width/2))*180/Math.PI+90,ev)};
 dial.addEventListener('pointerdown',ev=>{
  if(ev.target===inp)return;ev.preventDefault();setRot.did=false;
  const mv=e2=>{const a=fromPointer(e2);paint(a);setRot(a,false)};
  mv(ev);
  const up=()=>{window.removeEventListener('pointermove',mv);const a=norm(num(inp.value));setRot(a,true)};
  window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up,{once:true});
 });
 inp.addEventListener('change',()=>{const a=norm(num(inp.value));paint(a);setRot.did=false;setRot(a,true);const i=pop&&pop.querySelector('#mzfr-num');if(i)i.focus()});
 inp.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();inp.blur()}});
}
function openPop(kind,btn){
 closePop();popKind=kind;
 pop=document.createElement('div');pop.id='mzfr-pop';pop.className='mzfr-'+kind;
 pop.innerHTML=kind==='flip'?flipHTML():rotHTML();
 document.body.appendChild(pop);btn.classList.add('on');placePop(btn);
 if(kind==='rot')bindRot();
}
ACT['mzfr-flip-menu']=b=>{popKind==='flip'?closePop():openPop('flip',b)};
ACT['mzfr-rot-menu']=b=>{popKind==='rot'?closePop():openPop('rot',b)};
document.addEventListener('pointerdown',e=>{if(pop&&!e.target.closest('#mzfr-pop,[data-mzfr]'))closePop()},true);
document.addEventListener('keydown',e=>{if(pop&&e.key==='Escape'){closePop()}},true);
addEventListener('resize',()=>closePop());

/* ---------- tombol di dock ---------- */
const prevTools=renderTools;
renderTools=function(){
 const r=prevTools.apply(this,arguments);
 const dock=document.getElementById('dock');
 if(!dock)return r;
 const anchor=dock.querySelector('[data-a="dock-dup"]');
 if(anchor&&!dock.querySelector('[data-mzfr]')){
  const els=sel(),fl=els.filter(el=>FLIPPABLE.includes(el.type)),oneEl=els.length===1?els[0]:null;
  const btn=(a,ic,t,dis)=>`<button type="button" data-a="${a}" data-mzfr="1" ${dis?'disabled':''} title="${t}" aria-label="${t}"><svg viewBox="0 0 24 24">${ic}</svg></button>`;
  let h='';
  if(fl.length&&fl.length===els.length)h+=btn('mzfr-flip-menu',ICO.flip,'Flip',!fl.some(el=>!el.locked));
  if(oneEl)h+=btn('mzfr-rot-menu',ICO.rot,'Rotate (derajat)',!!oneEl.locked);
  if(h)anchor.insertAdjacentHTML('beforebegin',h);
  if(innerWidth<=760){dock.querySelectorAll('[data-mzfr]').forEach(b=>{b.dataset.uxLabel=b.dataset.a==='mzfr-flip-menu'?'Flip':'Putar'})}
 }
 /* sinkronkan popover dengan seleksi saat ini */
 if(pop){
  const ok=popKind==='flip'?flippables().length>0:sel().length===1;
  if(!ok)closePop();
  else{
   const keepFocus=document.activeElement&&document.activeElement.id==='mzfr-num';
   if(popKind==='flip')pop.innerHTML=flipHTML();
   else if(!keepFocus){pop.innerHTML=rotHTML();bindRot()}
   const b=dock.querySelector(popKind==='flip'?'[data-a="mzfr-flip-menu"]':'[data-a="mzfr-rot-menu"]');
   if(b){b.classList.add('on');placePop(b)}else closePop();
  }
 }
 return r;
};
try{renderTools()}catch(_){}

/* ---------- gaya ---------- */
const css=document.createElement('style');css.id='mzfr-css';
css.textContent=`
.el[style*="--mz-fy"]>.h.rot{top:auto;bottom:calc(-28px*var(--iz))}
#mzfr-badge{position:fixed;z-index:400;display:none;pointer-events:none;background:#1c2027;color:#fff;font:600 12px/1 system-ui,sans-serif;padding:6px 8px;border-radius:8px;box-shadow:0 4px 14px rgba(20,25,40,.3)}
#mzfr-pop{position:fixed;z-index:310;background:#fff;border:1px solid var(--line,#e2e5ea);border-radius:14px;box-shadow:0 14px 44px rgba(20,25,40,.25);padding:6px;min-width:200px;font-size:14px}
#mzfr-pop .mzfr-it{display:flex;align-items:center;gap:10px;width:100%;border:0;background:transparent;padding:10px 12px;border-radius:9px;text-align:left;font-size:14px;cursor:pointer;color:inherit}
#mzfr-pop .mzfr-it:hover{background:#f1f3f7}
#mzfr-pop .mzfr-it svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
#mzfr-pop .mzfr-it span{flex:1}#mzfr-pop .mzfr-it b{color:var(--acc,#3a5bf0);width:14px;text-align:center}
#mzfr-pop.mzfr-rot{width:236px;padding:12px}
.mzfr-dial{position:relative;width:132px;height:132px;margin:2px auto 10px;border-radius:50%;border:2px solid #e2e5ea;background:radial-gradient(circle,#fff 55%,#f4f6fb 100%);touch-action:none;cursor:grab}
.mzfr-dial:before{content:'';position:absolute;left:50%;top:5px;width:2px;height:8px;margin-left:-1px;background:#c5cada;border-radius:1px}
.mzfr-knobwrap{position:absolute;inset:0;pointer-events:none}
.mzfr-knob{position:absolute;left:50%;top:-7px;width:14px;height:14px;margin-left:-7px;border-radius:50%;background:var(--acc,#3a5bf0);box-shadow:0 2px 6px rgba(58,91,240,.45)}
.mzfr-read{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:1px;pointer-events:none}
.mzfr-read input{pointer-events:auto;width:54px;border:1px solid transparent;border-radius:8px;background:transparent;text-align:right;font:700 22px/1.2 system-ui,sans-serif;color:var(--ink,#1c2027);padding:2px 0;-moz-appearance:textfield}
.mzfr-read input::-webkit-outer-spin-button,.mzfr-read input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.mzfr-read input:focus{outline:0;border-color:var(--acc,#3a5bf0);background:#fff}
.mzfr-read span{font:700 18px/1 system-ui,sans-serif;color:var(--mut,#737f96)}
.mzfr-row{display:flex;gap:6px}
.mzfr-q{flex:1;border:1px solid var(--line,#e2e5ea);background:#fff;border-radius:9px;padding:8px 4px;font-size:12.5px;font-weight:600;cursor:pointer}
.mzfr-q:hover{background:#f1f3f7}
.mzfr-hint{margin-top:8px;font-size:11px;color:var(--mut,#737f96);text-align:center;line-height:1.4}
`;
document.head.appendChild(css);
window.MZFR={cssRot,flip,setRot,version:'rot-r1'};
})();
