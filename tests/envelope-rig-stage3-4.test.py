exec(open('t1.py').read().split("with sync_playwright")[0])
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1400,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(3000)
    pg.evaluate("document.querySelectorAll('#st28-shell,.st-welcome').forEach(n=>n.remove())"); pg.evaluate(SETUP)
    pg.click('[data-rig-act=enable]')
    for i,r in enumerate(['body','card','pocket','flap','seal']): pg.locator('[data-rig-role-of]').nth(i).select_option(r)
    pg.select_option('[data-rig-f=preset]','video'); pg.wait_for_timeout(200)
    pg.select_option('[data-rig-f=skip]','1'); pg.wait_for_timeout(200)
    print('panel has after/exit/skip/music:', pg.evaluate("['after','exit','skip','music','afterDelay'].map(f=>!!document.querySelector('[data-rig-f='+f+']')).join()"))
    print('rig cfg:', pg.evaluate("JSON.stringify((({after,exit,skip,music,preset})=>({after,exit,skip,music,preset}))(S.doc.pages[0].sections[0].elements.slice(-1)[0].rig))"))
    # second section under the cover + second page
    pg.evaluate("""(()=>{const pgx=S.doc.pages[0];pgx.sections.push(newSec('Hero',700,defBg({color:'#223'}),[newEl('heading',{name:'H',x:200,y:200,text:'HERO'})]));
      S.doc.pages.push(JSON.parse(JSON.stringify({...S.doc.pages[0],id:uid('p'),slug:'kedua',title:'Kedua',name:'Kedua',sections:[newSec('K',600,defBg(),[])]})));renderCanvas()})()""")
    print('pages slugs:', pg.evaluate("pubPgs().map(p=>p.slug).join()"))
    # --- UI-level copy/duplicate/paste-section survive
    r=pg.evaluate("""(()=>{const sec=S.doc.pages[0].sections[0],g=sec.elements.find(e=>e.rig);dupEl(g.id);const d=sec.elements.filter(e=>e.rig);
       const ds=dupSection(sec);return JSON.stringify({dupEl:d.length==2&&d[1].children.map(k=>k.rigRole).join(),dupSec:ds.elements.find(e=>e.rig)?.children.map(k=>k.rigRole).join()})})()""")
    print('dupEl/dupSection:', r)
    pg.evaluate("(()=>{const sec=S.doc.pages[0].sections[0];sec.elements=sec.elements.filter((e,i,a)=>!(e.rig&&a.findIndex(x=>x.rig)!==i));renderCanvas()})()")
    html=pg.evaluate("siteHTML(S.doc,{start:S.doc.pages[0].id})")
    stub="<audio id='bgm' data-auto='1'></audio><script>var au=document.getElementById('bgm');window.__played=0;au.play=function(){window.__played++;return Promise.resolve()};</script>"
    html=html.replace('</body>',stub+'</body>')
    for mode in ('tap','skip'):
        q=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True); q.on('pageerror',lambda e:errs.append('PUB '+str(e)))
        q.set_content(html); q.wait_for_timeout(1000)
        print(mode,'skip button exists:', q.evaluate("!!document.querySelector('.rig-skip')"))
        if mode=='tap':
            sb=q.locator('[data-rig-role=seal]').bounding_box(); q.mouse.click(sb['x']+sb['width']/2,sb['y']+sb['height']/2)
            q.wait_for_timeout(1000); print(' at 1s: exit class?', q.evaluate("document.querySelector('.rig-root').classList.contains('rig-exit')"), 'scrollY', q.evaluate("Math.round(scrollY)"))
            q.wait_for_timeout(3200)
        else:
            q.locator('.rig-skip').click(); q.wait_for_timeout(1500)
        print(' final: exit', q.evaluate("document.querySelector('.rig-root').classList.contains('rig-exit')"),'rootOpacity',q.evaluate("getComputedStyle(document.querySelector('.rig-root')).opacity"),'scrollY>0',q.evaluate("scrollY>100"),'music play calls',q.evaluate("window.__played"))
        q.screenshot(path=f'fr/s4_{mode}.png'); q.close()
    # after = page
    h2=html.replace('&quot;after&quot;:&quot;section&quot;','&quot;after&quot;:&quot;page&quot;').replace('&quot;nextPage&quot;:&quot;&quot;','&quot;nextPage&quot;:&quot;kedua&quot;')
    q=b.new_page(viewport={'width':1280,'height':800}); q.set_content(h2); q.wait_for_timeout(800)
    sb=q.locator('[data-rig-role=seal]').bounding_box(); q.mouse.click(sb['x']+30,sb['y']+30); q.wait_for_timeout(4000)
    print('after=page hash:', q.evaluate("location.hash"))
    # Try opening in editor must NOT scroll / change hash
    pg.evaluate("S.sel={k:'el',id:S.doc.pages[0].sections[0].elements.find(e=>e.rig).id};renderRight()")
    h0=pg.evaluate("location.hash"); pg.click('[data-rig-act=try]'); pg.wait_for_timeout(3500)
    print('editor Try keeps hash & no exit class:', h0==pg.evaluate("location.hash"), not pg.evaluate("document.querySelector('#frame .rig-root').classList.contains('rig-exit')"))
    print('ERRS',errs); b.close()
