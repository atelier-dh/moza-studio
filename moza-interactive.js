/* Moza Studio V5 — interactive content elements.
 * Non-invasive integration: original Atelier application, data schema, RSVP,
 * auth, cloud configuration and renderer remain untouched.
 * Widgets use Atelier's existing sandboxed HTML embed implementation.
 */
(function(){
'use strict';
if(window.MozaInteractive)return;
const MAX_ITEMS=8;
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeColor=(s,def)=>/^#[0-9a-fA-F]{6}$/.test(String(s))?String(s):def;
const validState=()=>typeof S!=='undefined'&&S?.mode==='design'&&S.doc&&Array.isArray(S.doc.pages);
const target=()=>validState()&&S.sel?.k==='el'?T('el'):null;
const itemDefaults=kind=>kind==='accordion'?[{title:'Apa itu acara ini?',body:'Klik pertanyaan untuk membuka informasi lengkap tentang acara.'},{title:'Kapan acaranya?',body:'Tuliskan tanggal, waktu, dan lokasi acara di sini.'},{title:'Bagaimana cara konfirmasi?',body:'Silakan isi RSVP pada halaman undangan.'}]:[{title:'Cerita Kami',body:'Kenali kisah kami lebih dekat.'},{title:'Acara',body:'Lihat informasi acara dan jadwal kegiatan.'},{title:'Lokasi',body:'Temukan tempat acara dan informasi perjalanan.'}];
function defaultConfig(kind){return{version:1,kind,items:itemDefaults(kind),accent:'#b76e79',paper:'#ffffff',text:'#302c32',exclusive:true};}
function itemMarkup(items,kind){
 if(kind==='accordion')return items.map((it,i)=>`<details class="mza-item" ${i===0?'open':''}><summary><span>${safe(it.title)}</span><span class="mza-plus" aria-hidden="true">+</span></summary><div class="mza-answer">${safe(it.body).replace(/\n/g,'<br>')}</div></details>`).join('');
 return items.map((it,i)=>`<section class="mza-slide" role="tabpanel" id="slide-${i}" aria-labelledby="tab-${i}" tabindex="0"><h3>${safe(it.title)}</h3><p>${safe(it.body).replace(/\n/g,'<br>')}</p></section>`).join('');
}
function buildWidget(config){
 const kind=config.kind==='tabs'?'tabs':'accordion';
 const items=(Array.isArray(config.items)?config.items:[]).slice(0,MAX_ITEMS).map(x=>({title:String(x.title||'Judul').slice(0,160),body:String(x.body||'').slice(0,1600)}));
 const accent=safeColor(config.accent,'#b76e79'),paper=safeColor(config.paper,'#ffffff'),text=safeColor(config.text,'#302c32');
 const common=`:root{color-scheme:light}*{box-sizing:border-box}html,body{margin:0;width:100%;min-height:100%;font:15px/1.55 system-ui,-apple-system,Segoe UI,sans-serif;color:${text};background:transparent}body{display:block;padding:8px}button,summary{-webkit-tap-highlight-color:transparent}button:focus-visible,summary:focus-visible,.mza-slide:focus-visible{outline:3px solid ${accent};outline-offset:3px}`;
 const base=`<style>${common}`;
 if(kind==='accordion'){
  return `${base}.mza-wrap{width:100%;margin:0 auto}.mza-item{background:${paper};border:1px solid ${accent}44;border-radius:12px;margin:0 0 9px;overflow:hidden}.mza-item[open]{border-color:${accent}77}.mza-item summary{cursor:pointer;min-height:52px;padding:14px 16px;display:flex;gap:12px;align-items:center;justify-content:space-between;list-style:none;font-weight:650;touch-action:manipulation}.mza-item summary::-webkit-details-marker{display:none}.mza-plus{font-size:22px;font-weight:400;color:${accent};transition:transform .2s}.mza-item[open] .mza-plus{transform:rotate(45deg)}.mza-answer{padding:0 16px 18px;white-space:normal;overflow-wrap:anywhere;color:${text};opacity:.87}@media(max-width:420px){body{padding:3px}.mza-item summary{min-height:48px;padding:12px;font-size:14px}.mza-answer{padding:0 12px 16px;font-size:14px}}@media(prefers-reduced-motion:reduce){*{transition:none!important}}</style><div class="mza-wrap" aria-label="Pertanyaan dan jawaban">${itemMarkup(items,kind)}</div>${config.exclusive?'<script>document.querySelectorAll(".mza-item").forEach(d=>d.addEventListener("toggle",()=>{if(d.open)document.querySelectorAll(".mza-item").forEach(x=>{if(x!==d)x.open=false})}));</script>':''}`;
 }
 const labels=items.map((x,i)=>`<button type="button" role="tab" class="mza-tab" id="tab-${i}" aria-selected="${i===0?'true':'false'}" aria-controls="slide-${i}" tabindex="${i===0?'0':'-1'}" data-tab="${i}">${safe(x.title)}</button>`).join('');
 return `${base}.mza-root{background:${paper};border:1px solid ${accent}44;border-radius:15px;overflow:hidden;width:100%;height:100%;display:flex;flex-direction:column}.mza-tabs{display:flex;gap:4px;padding:10px 10px 6px;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:thin;flex:0 0 auto}.mza-tab{flex:0 0 auto;white-space:nowrap;border:0;background:transparent;color:${text};padding:10px 14px;font:600 14px system-ui;cursor:pointer;border-bottom:2px solid transparent;touch-action:manipulation}.mza-tab[aria-selected=true]{color:${accent};border-color:${accent};background:${accent}10}.mza-viewport{overflow:hidden;flex:1 1 auto;min-height:0;touch-action:pan-y}.mza-track{display:flex;height:100%;transition:transform .32s ease;will-change:transform}.mza-slide{min-width:100%;height:100%;padding:14px 22px;overflow-y:auto;overflow-wrap:anywhere}.mza-slide h3{font-size:20px;margin:0 0 11px;color:${accent}}.mza-slide p{margin:0;white-space:normal}.mza-nav{display:flex;justify-content:space-between;align-items:center;padding:7px 12px;border-top:1px solid ${accent}33}.mza-arrow{border:1px solid ${accent}55;background:${paper};color:${accent};border-radius:8px;min-height:34px;min-width:45px;cursor:pointer;font-size:19px}.mza-count{font-size:12px;color:${text};opacity:.7}@media(max-width:420px){body{padding:2px}.mza-tab{font-size:13px;padding:9px 11px}.mza-slide{padding:12px 14px}.mza-slide h3{font-size:17px}}@media(prefers-reduced-motion:reduce){.mza-track{transition:none}}</style><div class="mza-root"><div class="mza-tabs" role="tablist" aria-label="Informasi">${labels}</div><div class="mza-viewport"><div class="mza-track">${itemMarkup(items,kind)}</div></div><div class="mza-nav"><button class="mza-arrow" type="button" data-step="-1" aria-label="Sebelumnya">‹</button><span class="mza-count" aria-live="polite">1 / ${items.length}</span><button class="mza-arrow" type="button" data-step="1" aria-label="Berikutnya">›</button></div></div><script>(function(){const r=document.querySelector('.mza-root'),tabs=[...r.querySelectorAll('[role=tab]')],track=r.querySelector('.mza-track'),count=r.querySelector('.mza-count'),viewport=r.querySelector('.mza-viewport');let index=0,start=null;const go=(n,focus)=>{index=Math.max(0,Math.min(tabs.length-1,n));track.style.transform='translateX(-'+(index*100)+'%)';tabs.forEach((t,i)=>{t.setAttribute('aria-selected',i===index?'true':'false');t.tabIndex=i===index?0:-1});count.textContent=(index+1)+' / '+tabs.length;tabs[index].scrollIntoView({block:'nearest',inline:'nearest'});if(focus)tabs[index].focus()};tabs.forEach((t,i)=>{t.addEventListener('click',()=>go(i,false));t.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'||e.key==='Home'||e.key==='End'){e.preventDefault();go(e.key==='Home'?0:e.key==='End'?tabs.length-1:index+(e.key==='ArrowRight'?1:-1),true)}})});r.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>go(index+Number(b.dataset.step),false)));viewport.addEventListener('touchstart',e=>{start=e.changedTouches[0].clientX},{passive:true});viewport.addEventListener('touchend',e=>{if(start===null)return;const delta=e.changedTouches[0].clientX-start;if(Math.abs(delta)>45)go(index+(delta<0?1:-1),false);start=null},{passive:true});})();</script>`;
}
function add(kind){
 if(!validState()){typeof toast==='function'&&toast('Buka proyek di Design Editor dulu.');return false}
 const config=defaultConfig(kind);
 const el=newEl('embed',{name:kind==='accordion'?'Accordion FAQ':'Sliding Tabs',w:kind==='accordion'?580:650,h:kind==='accordion'?305:290,embedKind:'widget',embedLive:true,embedCode:buildWidget(config),mozaWidget:config});
 addEl(el,selSecId());
 // Atelier's default geometry is proportional to a 1200px canvas. Embedded
 // accordions need larger phone-specific tap/reading areas, so make explicit
 // breakpoint overrides without changing any inherited responsive engine.
 if(typeof setGeom==='function'){
  const d=el.y;
  setGeom(el,'t',{x:44,w:680,h:kind==='accordion'?345:310,y:Math.max(12,Math.round(d*768/1200))});
  setGeom(el,'m',{x:15,w:345,h:kind==='accordion'?355:290,y:Math.max(12,Math.round(d*375/1200))});
  if(typeof afterEdit==='function')afterEdit();
 }
 if(typeof toast==='function')toast((kind==='accordion'?'Accordion':'Sliding Tabs')+' ditambahkan. Edit judul dan isi dari panel Properties, lalu coba Preview.');
 return true;
}
function mutate(fn){
 const e=target();if(!e?.mozaWidget||e.locked)return false;
 commit(discrete());fn(e.mozaWidget);
 e.embedCode=buildWidget(e.mozaWidget);
 e.embedKind='widget';e.embedLive=true;
 afterEdit();return true;
}
function makeInspector(){
 const e=target(),w=e?.mozaWidget;
 if(!w)return '';
 const title=w.kind==='accordion'?'Accordion / FAQ':'Sliding Tabs';
 const rows=w.items.map((it,i)=>`<div class="mz5-row"><div class="mz5-rowhead"><b>Item ${i+1}</b><div><button type="button" class="btn sm" data-a="mz5-up" data-i="${i}" ${i?'':'disabled'} aria-label="Geser ke atas">↑</button><button type="button" class="btn sm" data-a="mz5-down" data-i="${i}" ${i<w.items.length-1?'':'disabled'} aria-label="Geser ke bawah">↓</button><button type="button" class="btn sm" data-a="mz5-remove" data-i="${i}" ${w.items.length>1?'':'disabled'} aria-label="Hapus item">✕</button></div></div><label>Judul / pertanyaan<input maxlength="160" data-mz5-title="${i}" value="${safe(it.title)}"></label><label>Penjelasan<textarea rows="3" maxlength="1600" data-mz5-body="${i}">${safe(it.body)}</textarea></label></div>`).join('');
 return `<section class="mz5-panel" aria-label="Moza interaktif"><div class="mz5-head"><b>▣ Konten Interaktif</b><small>V5</small></div><p class="hint"><strong>${title}</strong> · Klik untuk membuka, atau geser ke samping. Aktif di Preview dan website publik.</p><label>Tipe<select data-mz5-kind><option value="accordion" ${w.kind==='accordion'?'selected':''}>Accordion (buka-tutup)</option><option value="tabs" ${w.kind==='tabs'?'selected':''}>Sliding Tabs (geser samping)</option></select></label>${rows}<button type="button" class="btn sm pri mz5-add" data-a="mz5-add" ${w.items.length>=MAX_ITEMS?'disabled':''}>+ Tambah Item</button><div class="mz5-options"><label>Warna aksen<input type="color" data-mz5-color="accent" value="${safeColor(w.accent,'#b76e79')}"></label><label>Warna latar<input type="color" data-mz5-color="paper" value="${safeColor(w.paper,'#ffffff')}"></label>${w.kind==='accordion'?`<label class="mz5-check"><input type="checkbox" data-mz5-exclusive ${w.exclusive?'checked':''}> Hanya satu terbuka</label>`:''}</div><p class="hint">Di canvas widget bisa dipindah dan diubah ukuran. Klik <b>Preview</b> untuk mencoba interaksinya. Tidak mengubah fitur RSVP.</p></section>`;
}
function addUI(){
 if(!validState())return;
 const left=document.querySelector('#left');
 if(left&&S.tab==='elements'&&!left.querySelector('.mz5-library')){
  const holder=document.createElement('div');holder.className='mz5-library';
  holder.innerHTML='<h4>▣ Elemen Interaktif</h4><p class="hint">Klik judul untuk membuka penjelasan, atau geser antar informasi.</p><div class="mz5-tiles"><button type="button" class="btn sm" data-a="mz5-insert-accordion">▾ Accordion / FAQ</button><button type="button" class="btn sm" data-a="mz5-insert-tabs">⇄ Sliding Tabs</button></div>';
  left.prepend(holder);
 }
}
const oldLeft=renderLeft;
renderLeft=function(){oldLeft();addUI()};
const oldRight=renderRight;
renderRight=function(){oldRight();const r=document.querySelector('#right');if(r&&validState()){const h=makeInspector();if(h)r.insertAdjacentHTML('beforeend',h)}};
const oldTop=renderTop;
renderTop=function(){oldTop();if(!validState())return;const t=document.querySelector('#top');if(t&&!t.querySelector('[data-a="mz5-insert-accordion"]')){
  const a=t.querySelector('[data-a="moza-v4-palette"]')||t.querySelector('[data-a="preview"]');
  if(a)a.insertAdjacentHTML('beforebegin','<button class="btn" type="button" data-a="mz5-insert-accordion" title="Tambahkan elemen FAQ yang bisa dibuka dan ditutup">▾ FAQ</button><button class="btn" type="button" data-a="mz5-insert-tabs" title="Tambahkan tab geser horizontal">⇄ Tabs</button>');
 }};
ACT['mz5-insert-accordion']=()=>add('accordion');
ACT['mz5-insert-tabs']=()=>add('tabs');
ACT['mz5-add']=()=>mutate(w=>{if(w.items.length<MAX_ITEMS)w.items.push({title:'Judul baru',body:'Tulis penjelasan di sini.'})});
ACT['mz5-remove']=b=>mutate(w=>{if(w.items.length>1)w.items.splice(Number(b.dataset.i),1)});
ACT['mz5-up']=b=>mutate(w=>{const i=Number(b.dataset.i);if(i>0)[w.items[i-1],w.items[i]]=[w.items[i],w.items[i-1]]});
ACT['mz5-down']=b=>mutate(w=>{const i=Number(b.dataset.i);if(i<w.items.length-1)[w.items[i],w.items[i+1]]=[w.items[i+1],w.items[i]]});
document.addEventListener('change',event=>{
 const el=event.target;
 const t=el.closest('[data-mz5-title]');if(t){mutate(w=>{const i=Number(t.dataset.mz5Title);if(w.items[i])w.items[i].title=t.value.slice(0,160)});return}
 const b=el.closest('[data-mz5-body]');if(b){mutate(w=>{const i=Number(b.dataset.mz5Body);if(w.items[i])w.items[i].body=b.value.slice(0,1600)});return}
 if(el.matches('[data-mz5-kind]')){mutate(w=>{w.kind=el.value==='tabs'?'tabs':'accordion'});return}
 if(el.matches('[data-mz5-exclusive]')){mutate(w=>{w.exclusive=el.checked});return}
 if(el.matches('[data-mz5-color]')){mutate(w=>{w[el.dataset.mz5Color]=safeColor(el.value,'#ffffff')})}
});
window.MozaInteractive={version:'5.0.0',add,buildWidget,defaultConfig,status:()=>({ready:validState(),selectedWidget:!!target()?.mozaWidget})};
try{if(validState()){renderLeft();renderRight();renderTop()}}catch(e){console.warn('[Moza V5] initial UI refresh skipped',e)}
console.info('[Moza V5] Accordion & Sliding Tabs installed; existing Atelier core unchanged.');
})();
