/* Moza Studio — Mask: "foto masuk ke shape" (mask-r2)
   Tombol Mask di dock (Ctrl+Alt+M) dulunya = clipping group: layer paling atas jadi cetakan GAIB (tidak digambar),
   layer di bawahnya hanya terlihat di area yang bertumpuk dengan cetakan. Akibatnya foto + shape yang tidak
   bertumpuk -> hasil kosong / salah, dan banyak bentuk (hati, diamond, hexagon, ...) dipotong sebagai KOTAK.

   Sekarang, jika yang dipilih persis 1 shape + 1 foto:
     A. bentuk punya padanan frame foto (MASKS)  -> foto dimasukkan ke bentuk itu (sama dengan Image > Mask), shape dihapus.
     B. bentuk tidak punya padanan                -> tetap clipping group lama, tapi foto di-fit dulu ke area shape
                                                    supaya hasilnya tidak kosong.
   Selain kombinasi itu (2+ layer lain, banyak foto, dst.) perilaku lama tidak berubah. */
(function(){
'use strict';
if(window.__mozaMaskFit)return;
if(typeof makeGroup!=='function'||typeof findEl!=='function'||typeof MASKS==='undefined')return;
window.__mozaMaskFit=true;

/* jenis shape -> kunci frame foto (MASKS). null = tidak ada padanan */
const KIND={
 circle:'circle',ellipse:'ellipse',triangle:'triangle',star:'star',diamond:'diamond',heart:'heart',
 hexagon:'hex',pentagon:'pentagon',octagon:'octagon',flower:'flower',burst:'burst',cross:'cross',
 shield:'shield',speech:'speech',blob:'blob',arch:'arch',leaf:'leaf',wave:'wave',chevron:'chevron',
 parallelogram:'para',rect:'none',square:'none'
};
const LABEL={circle:'Circle',ellipse:'Oval',triangle:'Triangle',star:'Star',diamond:'Diamond',heart:'Heart',hexagon:'Hexagon',
 pentagon:'Pentagon',octagon:'Octagon',flower:'Flower',burst:'Burst',cross:'Cross',shield:'Shield',speech:'Speech bubble',
 blob:'Blob',arch:'Arch',leaf:'Leaf',wave:'Wave',chevron:'Chevron',parallelogram:'Parallelogram',rect:'Rectangle',square:'Square',
 rrect:'Rounded rectangle',polygon:'Polygon'};
const GEO=['x','y','w','h'];

function frameKey(shape){
 const t=shape.shape||'rect';
 if(t==='polygon'){const n=+shape.sides||6;return n===5?'pentagon':n===6?'hex':n===8?'octagon':null}
 if(t==='rrect')return 'none';
 const k=KIND[t];
 return k&&(k==='none'||MASKS[k])?k:null;
}

/* salin posisi/ukuran/rotasi/flip shape ke foto di semua breakpoint (desktop, tablet, mobile) */
function copyGeometry(from,to){
 GEO.forEach(k=>{to[k]=from[k]});
 to.rot=from.rot||0;
 if(from.flipX)to.flipX=true;else delete to.flipX;
 if(from.flipY)to.flipY=true;else delete to.flipY;
 for(const bp of ['t','m']){
  const src=from.bp&&from.bp[bp];
  if(src&&GEO.some(k=>src[k]!=null)){
   to.bp=to.bp||{};to.bp[bp]=Object.assign({},to.bp[bp]);
   GEO.forEach(k=>{if(src[k]!=null)to.bp[bp][k]=src[k];else delete to.bp[bp][k]});
  }else if(to.bp&&to.bp[bp]){
   GEO.forEach(k=>{delete to.bp[bp][k]});
  }
 }
}

function resolve(ids){
 if(!Array.isArray(ids)||ids.length!==2)return null;
 const fs=ids.map(findEl);
 if(fs.some(f=>!f)||fs[0].list!==fs[1].list)return null;
 const shape=fs.find(f=>f.el.type==='shape'),photo=fs.find(f=>f.el.type==='image');
 if(!shape||!photo||shape===photo)return null;
 if(shape.el.locked||photo.el.locked)return null;
 return {shape,photo,list:fs[0].list};
}

function intoFrame(r,key){
 const {shape,photo,list}=r,s=shape.el,p=photo.el;
 commit(discrete());
 copyGeometry(s,p);
 p.fit='cover';p.px=50;p.py=50;p.zoom=p.zoom||1;
 p.mask=key;
 if((s.shape||'')==='rrect'){p.st=Object.assign({},p.st,{br:+s.rad||+(s.st&&s.st.br)||24})}
 list.splice(list.indexOf(s),1);
 S.sel={k:'el',id:p.id};S.multi=[];S.inGroup=null;
 afterEdit();
 toast(`Foto dimasukkan ke bentuk ${LABEL[s.shape||'rect']||'shape'}. Ganti bentuknya di Image › Mask.`,3600);
}

/* fallback: tidak ada padanan frame -> fit foto ke area shape + pastikan shape jadi cetakan (paling atas) */
function fitThenGroup(r,prev,args,ctx){
 const {shape,photo,list}=r,s=shape.el,p=photo.el;
 commit(discrete());
 copyGeometry(s,p);p.fit='cover';p.px=50;p.py=50;
 list.splice(list.indexOf(s),1);
 list.splice(list.indexOf(p)+1,0,s);
 toast(`Bentuk "${LABEL[s.shape||'rect']||s.shape}" belum punya frame foto — foto dipotong mengikuti area bentuk.`,4200);
 return prev.apply(ctx,args);
}


/* ================= Mask GABUNGAN: 1 foto + 2 atau lebih shape (mask-r2) =================
   Seperti "Use as mask" di Figma dengan beberapa blob: semua shape digabung jadi satu cetakan, foto hanya
   terlihat di dalam shape-shape itu, celah antar-shape kosong. Hasil = SATU elemen foto (responsif, bisa di-resize,
   fotonya bisa diganti) dengan el.mask='compound' + el.maskPath (path SVG ternormalisasi 0..1 terhadap kotak foto). */
const r3=n=>Math.round(n*1000)/1000;
function ellipsePts(n){const o=[];for(let i=0;i<n;i++){const a=i/n*Math.PI*2;o.push([.5+.5*Math.cos(a),.5+.5*Math.sin(a)])}return o}
function roundRectPts(w,h,rad){
 const r=Math.max(0,Math.min(.5,(+rad||0)/Math.max(1,Math.min(w,h)))),rx=r*Math.min(w,h)/w,ry=r*Math.min(w,h)/h,o=[];
 if(!r)return [[0,0],[1,0],[1,1],[0,1]];
 const arc=(cx,cy,a0)=>{for(let i=0;i<=8;i++){const a=a0+i/8*Math.PI/2;o.push([cx+rx*Math.cos(a),cy+ry*Math.sin(a)])}};
 arc(1-rx,ry,-Math.PI/2);arc(1-rx,1-ry,0);arc(rx,1-ry,Math.PI/2);arc(rx,ry,Math.PI);return o;
}
function cssPolygon(css){
 const m=/polygon\(([^)]*)\)/.exec(css||'');if(!m)return null;
 const pts=m[1].split(',').map(q=>{const v=q.trim().split(/\s+/);return [parseFloat(v[0])/100,parseFloat(v[1])/100]});
 return pts.length>2&&pts.every(q=>isFinite(q[0])&&isFinite(q[1]))?pts:null;
}
/* poligon bentuk dalam koordinat lokal 0..1; null = bentuk tidak dikenal (dipakai sebagai kotak) */
function localPoly(s){
 const t=s.shape||'rect';
 if(t==='circle'||t==='ellipse')return ellipsePts(72);
 if(t==='rect'||t==='square')return [[0,0],[1,0],[1,1],[0,1]];
 if(t==='rrect')return roundRectPts(s.w,s.h,s.rad);
 try{const o=outlineOf(s);if(o&&o.length>2)return o}catch(_){}
 const key=frameKey(s);
 if(key&&key!=='none'){const pp=cssPolygon(MASKS[key]);if(pp)return pp}
 return null;
}
function worldPoly(s,ox,oy,geo){
 const g=geo||s,loc=localPoly(s)||[[0,0],[1,0],[1,1],[0,1]],w=g.w,h=g.h,cx=ox+g.x+w/2,cy=oy+g.y+h/2,
  a=(+g.rot||0)*Math.PI/180,c=Math.cos(a),sn=Math.sin(a);
 return loc.map(q=>{let x=(q[0]-.5)*w,y=(q[1]-.5)*h;if(s.flipX)x=-x;if(s.flipY)y=-y;return [cx+x*c-y*sn,cy+x*sn+y*c]});
}
const isShape=e=>e&&e.type==='shape';
const flatGroup=g=>g&&g.type==='group'&&!g.mask&&!g.rot&&!g.flipX&&!g.flipY&&Array.isArray(g.children)&&g.children.length&&g.children.every(isShape);
function resolveCompound(ids){
 if(!Array.isArray(ids)||ids.length<3)return null;
 const fs=ids.map(findEl);
 if(fs.some(f=>!f)||fs.some(f=>f.list!==fs[0].list)||fs.some(f=>f.el.locked))return null;
 const photos=fs.filter(f=>f.el.type==='image'),cut=fs.filter(f=>f!==photos[0]);
 if(photos.length!==1||!cut.length)return null;
 if(!cut.every(f=>isShape(f.el)||flatGroup(f.el)))return null;
 const items=[];cut.forEach(f=>{
  if(isShape(f.el))items.push({s:f.el,ox:0,oy:0,top:f});
  else f.el.children.forEach(c=>items.push({s:c,ox:f.el.x,oy:f.el.y,top:f}));
 });
 if(items.length<2)return null;
 return {photo:photos[0],cut,items,list:fs[0].list};
}
function unionPolys(items,bp){
 const polys=items.map(it=>{
  let geo=null;
  if(bp){const o=it.s.bp&&it.s.bp[bp];if(it.ox||it.oy||!o||GEO.some(k=>o[k]==null))return null;geo=Object.assign({},it.s,o)}
  return worldPoly(it.s,it.ox,it.oy,geo);
 });
 if(polys.some(q=>!q))return null;
 let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
 polys.forEach(q=>q.forEach(v=>{x0=Math.min(x0,v[0]);y0=Math.min(y0,v[1]);x1=Math.max(x1,v[0]);y1=Math.max(y1,v[1])}));
 const U={x:x0,y:y0,w:Math.max(1,x1-x0),h:Math.max(1,y1-y0)};
 return {U,polys};
}
function pathFrom(polys,U){
 return polys.map(q=>'M'+q.map(v=>r3((v[0]-U.x)/U.w)+' '+r3((v[1]-U.y)/U.h)).join('L')+'Z').join('');
}
function overlapRatio(U,p){
 const ix=Math.max(0,Math.min(U.x+U.w,p.x+p.w)-Math.max(U.x,p.x)),iy=Math.max(0,Math.min(U.y+U.h,p.y+p.h)-Math.max(U.y,p.y));
 return (ix*iy)/(U.w*U.h);
}
function applyCompound(r){
 const {photo,cut,items,list}=r,p=photo.el,base=unionPolys(items,null);
 if(!base)return false;
 const approx=[...new Set(items.filter(it=>!localPoly(it.s)).map(it=>LABEL[it.s.shape||'rect']||it.s.shape))];
 /* A) shape menimpa foto  -> foto TIDAK digeser/diskalakan (seperti Figma): yang terlihat = bagian foto di bawah shape.
    B) shape di luar foto  -> foto di-fit (cover) ke kotak gabungan shape supaya hasilnya tidak kosong. */
 const keep=overlapRatio(base.U,{x:p.x,y:p.y,w:p.w,h:p.h})>=.5;
 commit(discrete());
 if(keep){
  const cx=p.x+p.w/2,cy=p.y+p.h/2,a=-(+p.rot||0)*Math.PI/180,c=Math.cos(a),sn=Math.sin(a);
  const toLocal=v=>{const dx=v[0]-cx,dy=v[1]-cy;let x=dx*c-dy*sn,y=dx*sn+dy*c;if(p.flipX)x=-x;if(p.flipY)y=-y;return [(x+p.w/2)/p.w,(y+p.h/2)/p.h]};
  p.maskPath=base.polys.map(q=>'M'+q.map(v=>{const l=toLocal(v);return r3(l[0])+' '+r3(l[1])}).join('L')+'Z').join('');
 }else{
  p.x=r3(base.U.x);p.y=r3(base.U.y);p.w=r3(base.U.w);p.h=r3(base.U.h);p.rot=0;delete p.flipX;delete p.flipY;
  for(const bp of ['t','m']){
   const u=unionPolys(items,bp);
   if(u){p.bp=p.bp||{};p.bp[bp]=Object.assign({},p.bp[bp],{x:r3(u.U.x),y:r3(u.U.y),w:r3(u.U.w),h:r3(u.U.h)})}
   else if(p.bp&&p.bp[bp])GEO.forEach(k=>{delete p.bp[bp][k]});
  }
  p.fit='cover';p.px=50;p.py=50;p.zoom=p.zoom||1;
  p.maskPath=pathFrom(base.polys,base.U);
 }
 p.mask='compound';
 cut.forEach(f=>{const i=list.indexOf(f.el);if(i>=0)list.splice(i,1)});
 S.sel={k:'el',id:p.id};S.multi=[];S.inGroup=null;
 afterEdit();
 toast(`Foto dimasukkan ke ${items.length} shape sekaligus.`+(approx.length?` Bentuk ${approx.join(', ')} dipakai sebagai kotak.`:''),4200);
 return true;
}
/* render: tempelkan mask-image SVG ke .imw foto bermask gabungan (editor, preview, dan publish) */
function maskDecl(d){
 const svg=`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1' preserveAspectRatio='none'><path d='${d}'/></svg>`;
 const u='url('+encodeURIComponent(svg).replace(/'/g,'%27').replace(/\(/g,'%28').replace(/\)/g,'%29')+')';
 const full='data:image/svg+xml,';
 const url=u.replace('url(','url('+full);
 return `-webkit-mask-image:${url};mask-image:${url};-webkit-mask-size:100% 100%;mask-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;`;
}
const prevHTML=elHTML;
elHTML=function(el){
 let h=prevHTML.apply(this,arguments);
 if(h&&el&&el.type==='image'&&el.mask==='compound'&&el.maskPath)h=h.replace('<div class="imw" style="','<div class="imw" style="'+maskDecl(el.maskPath));
 return h;
};

const prevMake=makeGroup;
makeGroup=function(ids,mask){
 if(mask){
  try{
   const rc=resolveCompound(ids);
   if(rc&&applyCompound(rc))return;
  }catch(e){console.error('[mask-fit/compound]',e)}
  try{
   const r=resolve(ids);
   if(r){
    const key=frameKey(r.shape.el);
    if(key!==null){intoFrame(r,key);return}
    return fitThenGroup(r,prevMake,arguments,this);
   }
  }catch(e){console.error('[mask-fit]',e)}
 }
 return prevMake.apply(this,arguments);
};
window.MZMASKFIT={frameKey,version:'mask-r2'};
})();
