/* ==========================================================================
   Moza — ENVELOPE RIG  (Tahap 1–2)  v1.0.0-s2
   Elemen BARU. Tidak menyentuh elemen 'envelope' lama (el.env) dan tidak
   menulis ulang fungsi inti: hanya membungkus groupHTML, elPanel, siteHTML.

   Model data (semua tetap elemen biasa):
     grup biasa  g.rig      = {on:true, preset, dur, stagger, ease, flapDir, flapAngle,
                               sealMode, rise, cardScale, zoom, zoomScale, shadow, blur,
                               decor, trigger, autoDelay}
     anak grup   child.rigRole = 'body'|'pocket'|'flap'|'seal'|'card'|'decor'
   Karena tipe tetap 'group' + children, copy-paste, paste section, duplikat,
   ekspor dan Project Linking ikut membawa field tambahan ini apa adanya.
   ========================================================================== */
(function(){
'use strict';
if(window.MozaRigLoaded)return;window.MozaRigLoaded=true;

var ROLES=[['','— (biasa)'],['body','Body (badan amplop)'],['pocket','Pocket (bagian depan)'],['flap','Flap (penutup)'],['seal','Seal (segel)'],['card','Card (kartu/surat)'],['decor','Dekorasi']];
var ROLE_IDS=['body','pocket','flap','seal','card','decor'];
var PRESETS={
 klasik:{label:'Klasik',dur:1100,stagger:140,ease:'cubic-bezier(.4,0,.2,1)',flapDir:'up',flapAngle:170,sealMode:'fade',rise:55,cardScale:1.02,zoom:false,zoomScale:1.08,shadow:30,blur:0,decor:'stay'},
 soft:{label:'Soft',dur:1600,stagger:220,ease:'cubic-bezier(.25,.1,.25,1)',flapDir:'up',flapAngle:160,sealMode:'shrink',rise:45,cardScale:1.03,zoom:true,zoomScale:1.06,shadow:20,blur:0,decor:'stay'},
 dramatis:{label:'Dramatis',dur:1400,stagger:120,ease:'cubic-bezier(.22,1.2,.36,1)',flapDir:'up',flapAngle:180,sealMode:'break',rise:70,cardScale:1.06,zoom:true,zoomScale:1.15,shadow:60,blur:0,decor:'fade'},
 video:{label:'Seperti video referensi',dur:1500,stagger:0,ease:'cubic-bezier(.45,.05,.2,1)',flapDir:'up',flapAngle:175,sealMode:'follow',rise:0,cardScale:1,zoom:true,zoomScale:1.1,shadow:45,blur:3,decor:'stay',exit:'fade',after:'section'}
};
var EASES=[['cubic-bezier(.4,0,.2,1)','Standar'],['cubic-bezier(.25,.1,.25,1)','Lembut'],['cubic-bezier(.22,1.2,.36,1)','Memantul (overshoot)'],['cubic-bezier(.45,.05,.2,1)','Sinematik'],['linear','Linear'],['ease-in-out','Ease in-out']];
var DEFAULT=Object.assign({on:true,preset:'klasik',trigger:'seal',autoDelay:800,after:'stay',nextPage:'',afterDelay:300,exit:'none',skip:false,music:true},PRESETS.klasik);delete DEFAULT.label;

function num(v,min,max,d){v=parseFloat(v);if(!isFinite(v))v=d;return Math.min(max,Math.max(min,v))}
function norm(r){
  var o=Object.assign({},DEFAULT,r||{});
  o.on=o.on!==false;
  o.dur=num(o.dur,200,6000,1100);o.stagger=num(o.stagger,0,1500,140);
  o.flapDir=['up','down','left','right'].indexOf(o.flapDir)>-1?o.flapDir:'up';
  o.flapAngle=num(o.flapAngle,10,180,170);
  o.sealMode=['follow','fade','shrink','break','slide'].indexOf(o.sealMode)>-1?o.sealMode:'fade';
  o.rise=num(o.rise,0,150,55);o.cardScale=num(o.cardScale,.8,1.5,1.02);
  o.zoom=!!o.zoom;o.zoomScale=num(o.zoomScale,1,1.6,1.08);
  o.shadow=num(o.shadow,0,100,30);o.blur=num(o.blur,0,8,0);
  o.decor=o.decor==='fade'?'fade':'stay';
  o.trigger=['seal','any','auto'].indexOf(o.trigger)>-1?o.trigger:'seal';
  o.autoDelay=num(o.autoDelay,0,10000,800);
  o.after=['stay','section','page','scroll'].indexOf(o.after)>-1?o.after:'stay';
  o.nextPage=String(o.nextPage||'').replace(/[^a-zA-Z0-9_\-]/g,'').slice(0,80);
  o.afterDelay=num(o.afterDelay,0,10000,300);o.exit=o.exit==='fade'?'fade':'none';o.skip=!!o.skip;o.music=o.music!==false;
  o.ease=String(o.ease||DEFAULT.ease).replace(/[^a-z0-9(),.\- ]/gi,'').slice(0,60)||DEFAULT.ease;
  return o;
}

/* ------------------------------ CSS (editor + situs terbit) ------------------------------ */
var CSS=[
'.rig-root{perspective:1100px;perspective-origin:50% 40%;transform-origin:50% 40%;overflow:visible;',
 '--rig-dur:1100ms;--rig-ease:ease;--rig-ang:170deg;--rig-rise:55%;--rig-cs:1.02;--rig-zoom:1.08;--rig-sh:30;--rig-blur:0px;',
 '--rig-d-seal:0ms;--rig-d-flap:0ms;--rig-d-card:0ms;--rig-d-decor:0ms}',
/* urutan lapisan otomatis menurut peran: body < flap(terbuka) < card < pocket < flap(tertutup) < seal < dekorasi */
'.rig-root.rig-root>[data-rig-role=body]{z-index:1}',
'.rig-root.rig-root>[data-rig-role=card]{z-index:3}',
'.rig-root.rig-root>[data-rig-role=pocket]{z-index:4}',
'.rig-root.rig-root>[data-rig-role=flap]{z-index:5;transform-origin:50% 0}',
'.rig-root.rig-root>[data-rig-role=seal]{z-index:6}',
'.rig-root.rig-root>[data-rig-role=decor]{z-index:7}',
'.rig-root[data-rig-dir=down]>[data-rig-role=flap]{transform-origin:50% 100%}',
'.rig-root[data-rig-dir=left]>[data-rig-role=flap]{transform-origin:0 50%}',
'.rig-root[data-rig-dir=right]>[data-rig-role=flap]{transform-origin:100% 50%}',
/* transisi: hanya transform / translate / scale / opacity (+ blur ringan pada segel bila diaktifkan) */
'.rig-root>[data-rig-role]{backface-visibility:visible}',
'.rig-root.rig-anim>[data-rig-role=flap]{transition:transform var(--rig-dur) var(--rig-ease) var(--rig-d-flap),opacity calc(var(--rig-dur)*.4) linear calc(var(--rig-d-flap) + var(--rig-dur)*.6),z-index 0s linear calc(var(--rig-d-flap) + var(--rig-dur)*.45)}',
'.rig-root.rig-anim>[data-rig-role=seal]{transition:transform var(--rig-dur) var(--rig-ease) var(--rig-d-seal),translate var(--rig-dur) var(--rig-ease) var(--rig-d-seal),scale var(--rig-dur) var(--rig-ease) var(--rig-d-seal),opacity calc(var(--rig-dur)*.45) ease calc(var(--rig-d-seal) + var(--rig-dur)*.35),filter var(--rig-dur) ease var(--rig-d-seal)}',
'.rig-root.rig-anim>[data-rig-role=card]{transition:translate var(--rig-dur) var(--rig-ease) var(--rig-d-card),scale var(--rig-dur) var(--rig-ease) var(--rig-d-card)}',
'.rig-root.rig-anim>[data-rig-role=decor]{transition:opacity calc(var(--rig-dur)*.6) ease var(--rig-d-decor)}',
'.rig-root.rig-anim{transition:scale calc(var(--rig-dur)*1.3) var(--rig-ease)}',
/* keadaan terbuka */
'.rig-root.rig-open.rig-root>[data-rig-role=flap]{transform:rotateX(var(--rig-ang));opacity:0!important;z-index:2}',
'.rig-root.rig-open[data-rig-dir=down]>[data-rig-role=flap]{transform:rotateX(calc(-1*var(--rig-ang)))}',
'.rig-root.rig-open[data-rig-dir=left]>[data-rig-role=flap]{transform:rotateY(calc(-1*var(--rig-ang)))}',
'.rig-root.rig-open[data-rig-dir=right]>[data-rig-role=flap]{transform:rotateY(var(--rig-ang))}',
'.rig-root.rig-open.rig-root>[data-rig-role=card]{translate:0 calc(-1*var(--rig-rise));scale:var(--rig-cs)}',
'.rig-root.rig-open{scale:var(--rig-zoom)}',
'.rig-root.rig-open>[data-rig-role=decor].rig-fade{opacity:0}',
/* segel */
'.rig-root[data-rig-seal=follow]>[data-rig-role=seal]{transform-origin:var(--rig-ox,50%) var(--rig-oy,0%)}',
'.rig-root.rig-open[data-rig-seal=follow][data-rig-dir=up]>[data-rig-role=seal]{transform:rotateX(var(--rig-ang));opacity:0!important;filter:blur(var(--rig-blur))}',
'.rig-root.rig-open[data-rig-seal=follow][data-rig-dir=down]>[data-rig-role=seal]{transform:rotateX(calc(-1*var(--rig-ang)));opacity:0!important;filter:blur(var(--rig-blur))}',
'.rig-root.rig-open[data-rig-seal=follow][data-rig-dir=left]>[data-rig-role=seal]{transform:rotateY(calc(-1*var(--rig-ang)));opacity:0!important;filter:blur(var(--rig-blur))}',
'.rig-root.rig-open[data-rig-seal=follow][data-rig-dir=right]>[data-rig-role=seal]{transform:rotateY(var(--rig-ang));opacity:0!important;filter:blur(var(--rig-blur))}',
'.rig-root.rig-open[data-rig-seal=fade]>[data-rig-role=seal]{opacity:0!important}',
'.rig-root.rig-open[data-rig-seal=shrink]>[data-rig-role=seal]{scale:.3;opacity:0!important}',
'.rig-root.rig-open[data-rig-seal=slide]>[data-rig-role=seal]{translate:0 40%;opacity:0!important}',
'@keyframes rig-break{0%{transform:rotate(0) scale(1);opacity:1}18%{transform:rotate(-4deg) scale(1.08)}32%{transform:rotate(5deg) scale(1.1)}100%{transform:rotate(28deg) scale(.45) translateY(30%);opacity:0}}',
'.rig-root.rig-open[data-rig-seal=break]>[data-rig-role=seal]{animation:rig-break calc(var(--rig-dur)*.8) ease var(--rig-d-seal) both}',
/* bayangan statis (tidak dianimasikan) */
'.rig-root.rig-sh>[data-rig-role=flap],.rig-root.rig-sh>[data-rig-role=card],.rig-root.rig-sh>[data-rig-role=seal]{filter:drop-shadow(0 calc(var(--rig-sh)*.12px) calc(var(--rig-sh)*.3px) rgba(0,0,0,calc(var(--rig-sh)/250)))}',
'.rig-root.rig-sh.rig-open[data-rig-seal=follow]>[data-rig-role=seal]{filter:drop-shadow(0 calc(var(--rig-sh)*.12px) calc(var(--rig-sh)*.3px) rgba(0,0,0,calc(var(--rig-sh)/250))) blur(var(--rig-blur))}',
'.rig-root>[data-rig-role=seal]{will-change:transform,opacity}.rig-root>[data-rig-role=flap],.rig-root>[data-rig-role=card]{will-change:transform,translate}',
/* prefers-reduced-motion: langsung ke keadaan akhir */
'@media (prefers-reduced-motion:reduce){.rig-root,.rig-root>[data-rig-role]{transition-duration:1ms!important;transition-delay:0ms!important;animation-duration:1ms!important;animation-delay:0ms!important}.rig-root.rig-open{scale:1}}',
'.rig-root.rig-anim.rig-exit{opacity:0!important;pointer-events:none;transition:scale calc(var(--rig-dur)*1.3) var(--rig-ease),opacity 700ms ease}',
'.rig-root.rig-instant,.rig-root.rig-instant>[data-rig-role]{transition-duration:1ms!important;transition-delay:0ms!important;animation-duration:1ms!important;animation-delay:0ms!important}',
'.rig-skip{position:absolute;left:50%;bottom:-46px;translate:-50% 0;z-index:20;border:1px solid rgba(0,0,0,.25);background:rgba(255,255,255,.85);color:#222;font:600 13px/1 system-ui,sans-serif;padding:10px 18px;border-radius:999px;cursor:pointer;min-height:40px}',
'.rig-root.rig-open .rig-skip,.rig-root.rig-exit .rig-skip{display:none}',
/* panel */
'.rig-panel .rig-row{display:flex;gap:6px;align-items:center;margin:4px 0;flex-wrap:wrap}.rig-panel label{font-size:11px;display:flex;flex-direction:column;gap:2px;flex:1 1 90px;min-width:80px}',
'.rig-panel select,.rig-panel input[type=number]{width:100%;min-height:34px;font-size:13px}.rig-panel .rig-kid{display:flex;gap:6px;align-items:center;margin:3px 0}.rig-panel .rig-kid span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.rig-panel .rig-kid select{flex:0 0 150px}'
].join('\n');
/* Editor: moza-product-gallery.css mematikan transition/animation di #frame saat panel Properties aktif (hemat performa).
   Varian khusus editor di bawah (prefix #frame + !important) membuat "Try opening" tetap beranimasi. Situs terbit tidak terpengaruh. */
(function(){
  var extra=[];
  CSS.split('\n').forEach(function(l){
    var m=l.match(/^(\.rig-root\.rig-anim[^{]*)\{transition:(.*)\}$/);
    if(m)extra.push('#frame '+m[1]+'{transition:'+m[2]+'!important}');
    var a=l.match(/^(\.rig-root\.rig-open\[data-rig-seal=break\][^{]*)\{animation:(.*)\}$/);
    if(a)extra.push('#frame '+a[1]+'{animation:'+a[2]+';animation-play-state:running!important}');
  });
  CSS_EDIT=extra.join('\n');
})();
var CSS_EDIT;
window.MOZA_RIG_CSS=CSS;

/* ------------------------------ runtime (ES5, berdiri sendiri; dipakai editor DAN situs terbit) ------------------------------ */
function mozaRigRuntime(){
  if(window.MozaRig)return;
  var R=window.MozaRig={};
  function role(root,r){return root.querySelector(':scope > [data-rig-role="'+r+'"]')||root.querySelector('[data-rig-role="'+r+'"]')}
  function cfg(root){try{return JSON.parse(root.getAttribute('data-rig'))||{}}catch(e){return{}}}
  /* titik putar segel = tepi engsel flap (dalam koordinat segel), supaya segel ikut terangkat bersama flap */
  R.prepare=function(root){
    var c=cfg(root),flap=role(root,'flap'),seal=role(root,'seal');
    if(!seal)return;
    if(c.sealMode==='follow'&&flap){
      var f=flap.getBoundingClientRect(),s=seal.getBoundingClientRect();
      if(s.width&&s.height){
        var px=f.left+f.width/2,py=f.top;
        if(c.flapDir==='down'){py=f.bottom}
        else if(c.flapDir==='left'){px=f.left;py=f.top+f.height/2}
        else if(c.flapDir==='right'){px=f.right;py=f.top+f.height/2}
        seal.style.setProperty('--rig-ox',((px-s.left)/s.width*100).toFixed(2)+'%');
        seal.style.setProperty('--rig-oy',((py-s.top)/s.height*100).toFixed(2)+'%');
      }
    }
  };
  function reduced(){return window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches}
  function nextSection(root){var s=root.closest('section'),n=s&&s.nextElementSibling;while(n&&n.tagName!=='SECTION')n=n.nextElementSibling;return n}
  function afterOpen(root,c,instant){
    var ms=instant?0:(+c.dur||1100)+Math.round((+c.stagger||0)*3)+(+c.afterDelay||0);
    setTimeout(function(){
      if(c.exit==='fade')root.classList.add('rig-exit');
      var beh=reduced()?'auto':'smooth';
      if(c.after==='page'&&c.nextPage){location.hash='#/'+c.nextPage}
      else if(c.after==='section'){var n=nextSection(root);if(n)n.scrollIntoView({behavior:beh,block:'start'})}
      else if(c.after==='scroll'){window.scrollBy({top:window.innerHeight,behavior:beh})}
    },ms);
  }
  /* opts.act=true → dipanggil dari pemicu situs (jalankan musik + aksi setelah terbuka); Try opening di editor TIDAK memakai opts */
  R.open=function(root,opts){
    if(!root||root.classList.contains('rig-open'))return false;
    opts=opts||{};var c=cfg(root);
    if(opts.instant)root.classList.add('rig-instant');
    R.prepare(root);root.classList.add('rig-anim');
    void root.offsetWidth;                                  /* paksa style flush agar transisi jalan */
    root.classList.add('rig-open');root.setAttribute('data-rig-state','open');
    try{root.dispatchEvent(new CustomEvent('rig:open',{bubbles:true}))}catch(e){}
    if(opts.act){
      if(opts.gesture&&c.music!==false){var au=document.getElementById('bgm');if(au&&au.paused){try{var pr=au.play();if(pr&&pr.catch)pr.catch(function(){})}catch(e){}}}
      afterOpen(root,c,!!opts.instant);
    }
    return true;
  };
  R.reset=function(root){
    if(!root)return;
    root.classList.remove('rig-open','rig-exit','rig-instant');root.setAttribute('data-rig-state','closed');
    root.classList.remove('rig-anim');
    try{root.dispatchEvent(new CustomEvent('rig:reset',{bubbles:true}))}catch(e){}
  };
  /* pemicu dasar (Tahap 3 akan melengkapi: musik, Skip, aksi setelah terbuka) */
  R.init=function(scope){
    var roots=(scope||document).querySelectorAll('.rig-root[data-rig]:not(.rig-edit)');
    for(var i=0;i<roots.length;i++){(function(root){
      if(root.getAttribute('data-rig-wired'))return;root.setAttribute('data-rig-wired','1');
      root.setAttribute('data-rig-state','closed');
      var c=cfg(root);
      if(c.skip){var sk=document.createElement('button');sk.type='button';sk.className='rig-skip';sk.textContent='Skip';sk.setAttribute('aria-label','Lewati animasi amplop');sk.addEventListener('click',function(e){e.stopPropagation();R.open(root,{act:true,gesture:true,instant:true})});root.appendChild(sk)}
      if(c.trigger==='auto'){setTimeout(function(){R.open(root,{act:true})},Math.max(0,+c.autoDelay||0))}
      else if(c.trigger==='any'){
        var h=function(e){if(e&&e.target&&e.target.closest&&e.target.closest('.rig-skip'))return;R.open(root,{act:true,gesture:true});document.removeEventListener('click',h,true)};
        document.addEventListener('click',h,true);
      }else{
        root.addEventListener('click',function(e){var s=e.target&&e.target.closest&&e.target.closest('[data-rig-role="seal"]');if(s)R.open(root,{act:true,gesture:true})});
      }
    })(roots[i])}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){R.init()});else R.init();
}
window.MOZA_RIG_RUNTIME=mozaRigRuntime;
var rtFn=mozaRigRuntime.toString();

/* ------------------------------ editor: style + runtime ------------------------------ */
(function(){var s=document.createElement('style');s.id='moza-rig-css';s.textContent=CSS+'\n'+CSS_EDIT;document.head.appendChild(s)})();
mozaRigRuntime();

/* ------------------------------ 1) render: groupHTML (bungkus, bukan tulis ulang) ------------------------------ */
/* ------------------------------ 1a) rotasi/flip layer rig dipindah ke elemen DALAM ------------------------------
   Moza menyimpan rotasi sebagai transform:rotate() dan flip sebagai properti scale pada elemen luar, dengan titik putar di tengah.
   Rig memakai elemen luar itu untuk engsel (transform-origin di tepi flap) dan MENGGANTI transform saat membuka. Akibatnya flap yang
   di-flip/diputar (a) loncat ke atas sejauh tingginya (di-mirror terhadap tepi atas) dan (b) berayun ke bawah saat dibuka.
   Perbaikan: untuk layer yang dianimasikan rig (flap; segel mode ikut-flap/mengecil), rotasi + flip dicabut dari elemen luar
   (lihat CSS [data-rig-mv]) dan dipasang pada anak pertamanya (bentuk/gambar) yang titik putarnya tetap di tengah. */
function mvFlags(k,role,c){
  var rot=((+k.rot||0)%360)!==0,fl=!!(k.flipX||k.flipY),f='';
  if(role==='flap'||(role==='seal'&&(c.sealMode==='follow'||c.sealMode==='shrink'))){if(rot)f+='r';if(fl)f+='f'}
  return f;
}
function moveXform(h,needle,k){
  var i=h.indexOf(needle);if(i<0)return h;
  var m=/ style="[^"]*">/.exec(h.slice(i));if(!m)return h;
  var start=i+m.index+m[0].length,t=/^<[a-zA-Z][a-zA-Z0-9-]*/.exec(h.slice(start));if(!t)return h;
  var rest=start+t[0].length,rot=+k.rot||0,fl=!!(k.flipX||k.flipY);
  /* urutan sama dengan aslinya: putar dulu, baru flip (scale di luar rotate) */
  var tr='transform:'+(fl?'scale('+(k.flipX?-1:1)+','+(k.flipY?-1:1)+') ':'')+(rot?'rotate('+rot+'deg)':'')+';';
  var sm=/^[^>]*?\sstyle="/.exec(h.slice(rest));
  if(sm){var at=rest+sm[0].length;return h.slice(0,at)+tr+h.slice(at)}
  return h.slice(0,rest)+' style="'+tr+'"'+h.slice(rest);
}
var _groupHTML=groupHTML;
groupHTML=function(g,ctx){
  var h=_groupHTML.apply(this,arguments);
  if(!g||!g.rig||g.rig.on===false||g.mask||typeof h!=='string')return h;
  var c=norm(g.rig),edit=!!(ctx&&ctx.edit);
  (g.children||[]).forEach(function(k){
    var r=k.rigRole;if(ROLE_IDS.indexOf(r)<0)return;
    var needle='data-id="'+k.id+'"';
    var mv=mvFlags(k,r,c);
    h=h.replace(needle,needle+' data-rig-role="'+r+'"'+(mv?' data-rig-mv="'+mv+'"':'')+(r==='decor'&&c.decor==='fade'?' class="rig-fade"':''));
    if(mv)h=moveXform(h,needle,k);
  });
  /* class="rig-fade" ganda dengan class milik elemen tidak valid → pindahkan ke atribut data */
  h=h.replace(/ class="rig-fade"/g,' data-rig-fade="1"');
  var pub={dur:c.dur,stagger:c.stagger,flapDir:c.flapDir,sealMode:c.sealMode,trigger:c.trigger,autoDelay:c.autoDelay,after:c.after,nextPage:c.nextPage,afterDelay:c.afterDelay,exit:c.exit,skip:c.skip,music:c.music};
  var sty='--rig-dur:'+c.dur+'ms;--rig-ease:'+c.ease+';--rig-ang:'+c.flapAngle+'deg;--rig-rise:'+c.rise+'%;--rig-cs:'+c.cardScale
   +';--rig-zoom:'+(c.zoom?c.zoomScale:1)+';--rig-sh:'+c.shadow+';--rig-blur:'+c.blur+'px;--rig-d-seal:'+(c.sealMode==='follow'?c.stagger:0)+'ms;--rig-d-flap:'+c.stagger+'ms;--rig-d-card:'+Math.round(c.stagger*3)+'ms;--rig-d-decor:'+Math.round(c.stagger*2)+'ms';
  var attrs=' class="gcl rig-root'+(edit?' rig-edit':'')+(c.shadow>0?' rig-sh':'')+'" data-rig="'+esc(JSON.stringify(pub))+'" data-rig-dir="'+c.flapDir+'" data-rig-seal="'+c.sealMode+'" data-rig-state="closed" style="'+sty+'"';
  return h.replace('<div class="gcl"',function(){return '<div'+attrs});
};
/* dekor memudar: data-rig-fade → class lewat CSS atribut */
CSS+='\n.rig-root.rig-open>[data-rig-role=decor][data-rig-fade]{opacity:0!important}';

/* rot/flip dipindah ke elemen dalam (lihat mvFlags): elemen luar bersih, jadi engsel & animasi rig tidak bentrok */
CSS+='\n.rig-root.rig-root>[data-rig-mv*=r]{transform:none!important}'
 +'\n.rig-root.rig-root>[data-rig-mv*=f]{scale:none!important}'
 +'\n.rig-root.rig-open.rig-root>[data-rig-role=flap][data-rig-mv*=r]{transform:rotateX(var(--rig-ang))!important}'
 +'\n.rig-root.rig-open[data-rig-dir=down]>[data-rig-role=flap][data-rig-mv*=r]{transform:rotateX(calc(-1*var(--rig-ang)))!important}'
 +'\n.rig-root.rig-open[data-rig-dir=left]>[data-rig-role=flap][data-rig-mv*=r]{transform:rotateY(calc(-1*var(--rig-ang)))!important}'
 +'\n.rig-root.rig-open[data-rig-dir=right]>[data-rig-role=flap][data-rig-mv*=r]{transform:rotateY(var(--rig-ang))!important}'
 +'\n.rig-root.rig-open[data-rig-seal=follow][data-rig-dir=up]>[data-rig-role=seal][data-rig-mv*=r]{transform:rotateX(var(--rig-ang))!important}'
 +'\n.rig-root.rig-open[data-rig-seal=follow][data-rig-dir=down]>[data-rig-role=seal][data-rig-mv*=r]{transform:rotateX(calc(-1*var(--rig-ang)))!important}'
 +'\n.rig-root.rig-open[data-rig-seal=follow][data-rig-dir=left]>[data-rig-role=seal][data-rig-mv*=r]{transform:rotateY(calc(-1*var(--rig-ang)))!important}'
 +'\n.rig-root.rig-open[data-rig-seal=follow][data-rig-dir=right]>[data-rig-role=seal][data-rig-mv*=r]{transform:rotateY(var(--rig-ang))!important}'
 +'\n.rig-root.rig-open[data-rig-seal=shrink]>[data-rig-role=seal][data-rig-mv*=f]{scale:.3!important}';
window.MOZA_RIG_CSS=CSS;document.getElementById('moza-rig-css').textContent=CSS+'\n'+CSS_EDIT;

/* ------------------------------ 2) panel di Properties grup ------------------------------ */
function sel(f,opts,val){return '<select data-rig-f="'+f+'">'+opts.map(function(o){return '<option value="'+esc(o[0])+'"'+(String(o[0])===String(val)?' selected':'')+'>'+esc(o[1])+'</option>'}).join('')+'</select>'}
function inp(f,val,min,max,step){return '<input type="number" data-rig-f="'+f+'" value="'+val+'" min="'+min+'" max="'+max+'" step="'+(step||1)+'" inputmode="decimal">'}
function rigPanel(g){
  if(!g||g.type!=='group'||g.mask)return '';
  var body;
  if(!g.rig||g.rig.on===false){
    body='<div class="hint">Jadikan grup ini <b>Envelope Rig</b>: tetapkan peran tiap layer di dalamnya (body, pocket, flap, seal, kartu) lalu atur animasi bukanya. Semua layer tetap elemen biasa. Buat grupnya dulu dengan Ctrl+G dari layer-layer amplop.</div>'
      +'<button class="btn" style="width:100%;margin-top:6px" data-rig-act="enable">✉ Jadikan Envelope Rig</button>';
  }else{
    var c=norm(g.rig),kids=(g.children||[]).map(function(k){
      return '<div class="rig-kid"><span title="'+esc(k.name||k.type)+'">'+esc(k.name||k.type)+'</span><select data-rig-role-of="'+esc(k.id)+'" aria-label="Peran '+esc(k.name||k.type)+'">'
       +ROLES.map(function(r){return '<option value="'+r[0]+'"'+((k.rigRole||'')===r[0]?' selected':'')+'>'+r[1]+'</option>'}).join('')+'</select></div>'}).join('')||'<div class="hint">Grup kosong.</div>';
    var missing=['flap','seal'].filter(function(r){return !(g.children||[]).some(function(k){return k.rigRole===r})});
    body='<div class="hint"><b>1 · Peran layer</b> — urutan lapisan diatur otomatis menurut peran (body &lt; kartu &lt; pocket &lt; flap &lt; seal &lt; dekorasi).</div>'+kids
     +(missing.length?'<div class="hint" style="color:#b45309">Belum ada peran: '+missing.join(', ')+'. Animasi bagian itu dilewati.</div>':'')
     +'<div class="hint" style="margin-top:8px"><b>2 · Animasi</b></div>'
     +'<div class="rig-row"><label>Preset'+sel('preset',[['','— kustom —']].concat(Object.keys(PRESETS).map(function(k){return [k,PRESETS[k].label]})),g.rig.preset||'')+'</label>'
     +'<label>Pemicu'+sel('trigger',[['seal','Tap segel'],['any','Tap di mana saja'],['auto','Otomatis']],c.trigger)+'</label></div>'
     +'<div class="rig-row"><label>Durasi (ms)'+inp('dur',c.dur,200,6000,50)+'</label><label>Delay antar bagian (ms)'+inp('stagger',c.stagger,0,1500,10)+'</label></div>'
     +'<div class="rig-row"><label>Easing'+sel('ease',EASES,c.ease)+'</label>'
     +'<label>Arah flap'+sel('flapDir',[['up','Naik (engsel atas)'],['down','Turun (engsel bawah)'],['left','Kiri (engsel kiri)'],['right','Kanan (engsel kanan)']],c.flapDir)+'</label></div>'
     +'<div class="rig-row"><label>Sudut flap (°)'+inp('flapAngle',c.flapAngle,10,180,5)+'</label>'
     +'<label>Segel'+sel('sealMode',[['follow','Ikut flap terangkat'],['fade','Memudar'],['shrink','Mengecil'],['break','Pecah (getar + hilang)'],['slide','Bergeser']],c.sealMode)+'</label></div>'
     +'<div class="rig-row"><label>Kartu naik (% tinggi kartu)'+inp('rise',c.rise,0,150,5)+'</label><label>Skala kartu'+inp('cardScale',c.cardScale,.8,1.5,.01)+'</label></div>'
     +'<div class="rig-row"><label>Zoom kamera'+sel('zoom',[['0','Mati'],['1','Hidup']],c.zoom?'1':'0')+'</label><label>Skala zoom'+inp('zoomScale',c.zoomScale,1,1.6,.01)+'</label></div>'
     +'<div class="rig-row"><label>Bayangan (0–100)'+inp('shadow',c.shadow,0,100,5)+'</label><label>Blur segel (px, 0–8)'+inp('blur',c.blur,0,8,1)+'</label></div>'
     +'<div class="rig-row"><label>Dekorasi saat buka'+sel('decor',[['stay','Tetap'],['fade','Memudar']],c.decor)+'</label>'+(c.trigger==='auto'?'<label>Delay otomatis (ms)'+inp('autoDelay',c.autoDelay,0,10000,100)+'</label>':'')+'</div>'
     +'<div class="hint" style="margin-top:8px"><b>3 · Setelah terbuka</b></div>'
     +'<div class="rig-row"><label>Aksi'+sel('after',[['stay','Tetap di sini'],['section','Otomatis ke section berikutnya'],['page','Otomatis ke halaman…'],['scroll','Gulir turun']],c.after)+'</label>'
     +(c.after==='page'?'<label>Halaman tujuan'+sel('nextPage',[['','— pilih —']].concat((typeof pubPgs==='function'?pubPgs():[]).map(function(p){return [p.slug,p.title||p.name||p.slug]})),c.nextPage)+'</label>':'')+'</div>'
     +'<div class="rig-row"><label>Jeda sebelum aksi (ms)'+inp('afterDelay',c.afterDelay,0,10000,100)+'</label><label>Amplop saat selesai'+sel('exit',[['none','Tetap terlihat'],['fade','Memudar (crossfade)']],c.exit)+'</label></div>'
     +'<div class="rig-row"><label>Tombol Skip'+sel('skip',[['0','Tidak'],['1','Ya']],c.skip?'1':'0')+'</label><label>Musik mulai di tap pertama'+sel('music',[['1','Ya'],['0','Tidak']],c.music?'1':'0')+'</label></div>'
     +'<div class="rig-row"><button class="btn sm" data-rig-act="try">▶ Try opening</button><button class="btn sm" data-rig-act="reset">↺ Reset</button><button class="btn sm dng" data-rig-act="disable">Matikan Rig</button></div>'
     +'<div class="hint">Ringan di HP: hanya transform + opacity (blur hanya pada segel, opsional). Mengikuti prefers-reduced-motion.</div>';
  }
  return '<div class="rig-panel">'+GRP('rig','✉ Envelope Rig',body)+'</div>';
}
var _elPanel=elPanel;
elPanel=function(){
  var h=_elPanel.apply(this,arguments),el=T('el');
  try{if(el&&el.type==='group'&&!el.mask)h+=rigPanel(el)}catch(e){console.error('[Rig] panel',e)}
  return h;
};

/* ------------------------------ 3) aksi panel (delegasi; undo via commit) ------------------------------ */
function rigNode(el){return document.querySelector('#frame .e-'+el.id+' .rig-root')}
function apply(mut,keepOpen){
  var el=T('el');if(!el||el.type!=='group')return;
  commit(discrete());mut(el);renderCanvas();renderRight();scheduleSave();
}
document.addEventListener('click',function(e){
  var b=e.target.closest&&e.target.closest('[data-rig-act]');if(!b)return;
  var act=b.getAttribute('data-rig-act'),el=T('el');if(!el)return;
  if(act==='enable')return apply(function(g){g.rig=norm(Object.assign({},g.rig,{on:true}));toast('Envelope Rig aktif — tetapkan peran layer')});
  if(act==='disable')return apply(function(g){if(g.rig)g.rig.on=false});
  var n=rigNode(el);
  if(!n){toast('Elemen rig tidak tampil di canvas (halaman/breakpoint lain?)');return}
  if(act==='try'){window.MozaRig.reset(n);void n.offsetWidth;window.MozaRig.open(n)}
  if(act==='reset')window.MozaRig.reset(n);
},true);
document.addEventListener('change',function(e){
  var t=e.target;if(!t||!t.getAttribute)return;
  var rid=t.getAttribute('data-rig-role-of');
  if(rid){var f=findEl(rid);if(!f)return;return apply(function(){if(t.value)f.el.rigRole=t.value;else delete f.el.rigRole})}
  var fld=t.getAttribute('data-rig-f');if(!fld)return;
  apply(function(g){
    var r=g.rig=g.rig||{on:true},v=t.value;
    if(fld==='preset'){if(PRESETS[v]){var p=Object.assign({},PRESETS[v]);delete p.label;Object.assign(r,p,{preset:v})}else r.preset='';return}
    if(fld==='zoom'||fld==='skip'||fld==='music')v=v==='1';
    else if(t.type==='number')v=parseFloat(v);
    r[fld]=v;r.preset='';             /* ubah manual → preset jadi "kustom" */
    g.rig=norm(r);g.rig.preset='';
  });
});

/* ------------------------------ 4) situs terbit / preview / export ------------------------------ */
var _siteHTML=siteHTML;
siteHTML=function(){
  var html=_siteHTML.apply(this,arguments);
  if(typeof html!=='string'||html.indexOf('data-rig="')<0)return html;
  if(html.indexOf('id="moza-rig-css-pub"')<0)html=html.replace('</head>','<style id="moza-rig-css-pub">'+CSS+'</style></head>');
  if(html.indexOf('MozaRigPub')<0)html=html.replace('</body>','<script>/*MozaRigPub*/('+rtFn+')();<\/script></body>');
  return html;
};
})();
