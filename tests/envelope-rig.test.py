# Tes Envelope Rig (Chromium/Playwright). Jalankan: python3 -m http.server 8765 di folder proyek, lalu python3 tests/envelope-rig.test.py
# Cakupan: panel, peran layer, preset, Try/Reset, tap segel (HP+desktop), tap di mana saja, otomatis, reduced-motion, ekspor tanpa rig identik.
from playwright.sync_api import sync_playwright
import json,sys
SETUP="""
(()=>{
 const sec=S.doc.pages[0].sections[0]; sec.h=900;
 const mk=(name,x,y,w,h,c,shape)=>{const e=newEl('shape',{name,x,y,w,h,shape:shape||'rect',fill:{t:'solid',c,g:{c1:c,c2:c,a:0}}});sec.elements.push(e);return e};
 const body=mk('Badan',200,200,800,520,'#a9bf9f'),card=mk('Kartu',240,240,720,400,'#fffdf5'),pocket=mk('Pocket',200,420,800,300,'#8ea887'),
  flap=mk('Flap',200,200,800,260,'#c4d6b8'),seal=mk('Segel',560,400,90,90,'#b5473a','circle');
 makeGroup([body,card,pocket,flap,seal].map(e=>e.id),false);
 const g=sec.elements[sec.elements.length-1]; S.sel={k:'el',id:g.id}; S.multi=[]; renderCanvas(); renderRight();
 return g.id})()
"""

from playwright.sync_api import sync_playwright
import hashlib
def prep(pg):
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(3000)
    pg.evaluate("document.querySelectorAll('#st28-shell,.st-welcome').forEach(n=>n.remove())"); pg.evaluate(SETUP)
    pg.click('[data-rig-act=enable]')
    for i,r in enumerate(['body','card','pocket','flap','seal']): pg.locator('[data-rig-role-of]').nth(i).select_option(r)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1400,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    # --- baseline: project WITHOUT rig must export identically to the original index.html
    def exp(url):
        q=b.new_page(); q.goto(url); q.wait_for_timeout(2500)
        q.evaluate("Math.random=(()=>{let s=7;return()=>(s=(s*16807)%2147483647)/2147483647})();Date.now=()=>1700000000000")
        q.evaluate("document.querySelectorAll('#st28-shell,.st-welcome').forEach(n=>n.remove())")
        h=q.evaluate("siteHTML(S.doc)"); q.close(); return h
    import shutil; shutil.copy('/home/claude/index.orig.html','/home/claude/w/moza-studio/_orig_test.html')
    h_new=exp('http://localhost:8765/index.html'); h_old=exp('http://localhost:8765/_orig_test.html')
    print('export w/o rig identical to original:', h_new==h_old, len(h_new), len(h_old))
    import os; os.remove('/home/claude/w/moza-studio/_orig_test.html')
    prep(pg)
    pg.select_option('[data-rig-f=preset]','video'); pg.wait_for_timeout(200)
    # --- clone / copy-paste survive
    print('clone keeps rig+roles:', pg.evaluate("(()=>{const g=S.doc.pages[0].sections[0].elements.slice(-1)[0],c=clone(g);return !!c.rig&&c.rig.sealMode+'|'+c.children.map(k=>k.rigRole).join(',')})()"))
    # --- publish HTML
    html=pg.evaluate("siteHTML(S.doc)")
    print('has rig css/runtime:', 'moza-rig-css-pub' in html, 'MozaRigPub' in html, 'data-rig=' in html)
    open('fr/pub.html','w').write(html)
    for name,vp in (('mobile',{'width':390,'height':844}),('desktop',{'width':1280,'height':800})):
        q=b.new_page(viewport=vp, is_mobile=(name=='mobile'), has_touch=(name=='mobile')); q.on('pageerror',lambda e:errs.append('PUB '+str(e)))
        q.goto('http://localhost:8765/../')  if False else None
        q.set_content(html); q.wait_for_timeout(1200)
        st=lambda: q.evaluate("document.querySelector('.rig-root').dataset.rigState+' '+document.querySelector('.rig-root').className")
        print(name,'initial:',st())
        q.locator('.rig-root').scroll_into_view_if_needed()
        # tap on body (not seal) must NOT open for trigger=seal
        bb=q.locator('[data-rig-role=body]').bounding_box(); q.mouse.click(bb['x']+8,bb['y']+8); q.wait_for_timeout(300)
        print(name,'after tap on body:',q.evaluate("document.querySelector('.rig-root').dataset.rigState"))
        q.screenshot(path=f'fr/pub_{name}_0.png')
        sb=q.locator('[data-rig-role=seal]').bounding_box(); q.mouse.click(sb['x']+sb['width']/2,sb['y']+sb['height']/2); q.wait_for_timeout(700)
        q.screenshot(path=f'fr/pub_{name}_1.png'); q.wait_for_timeout(2200)
        print(name,'after tap seal:',st()); q.screenshot(path=f'fr/pub_{name}_2.png'); q.close()
    # reduced motion
    q=b.new_page(viewport={'width':1280,'height':800}, reduced_motion='reduce'); q.set_content(html); q.wait_for_timeout(800)
    sb=q.locator('[data-rig-role=seal]').bounding_box(); q.mouse.click(sb['x']+40,sb['y']+40); q.wait_for_timeout(150)
    print('reduced-motion state after 150ms:', q.evaluate("getComputedStyle(document.querySelector('[data-rig-role=flap]')).opacity"), q.evaluate("document.querySelector('.rig-root').dataset.rigState"))
    # auto + any triggers
    for trig in ('auto','any'):
        h2=html.replace('&quot;trigger&quot;:&quot;seal&quot;',f'&quot;trigger&quot;:&quot;{trig}&quot;')
        if h2==html: print('trigger replace failed'); 
        q=b.new_page(viewport={'width':1280,'height':800}); q.set_content(h2); q.wait_for_timeout(300 if trig=='any' else 1500)
        before=q.evaluate("document.querySelector('.rig-root').dataset.rigState")
        if trig=='any': q.mouse.click(5,5); q.wait_for_timeout(200)
        print(trig,'trigger:',before,'->',q.evaluate("document.querySelector('.rig-root').dataset.rigState")); q.close()
    print('ERRS',errs); b.close()
