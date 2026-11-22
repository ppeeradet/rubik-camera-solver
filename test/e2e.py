import sys, json, random, subprocess, time
from playwright.sync_api import sync_playwright
srv = subprocess.Popen([sys.executable,'-m','http.server','8765','-d','/home/claude/work/rcs'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
errs=[]
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':390,'height':800}).new_page()
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto('http://localhost:8765/index.html')
    pg.wait_for_function("document.querySelector('#solverState').classList.contains('ok')",timeout=20000)
    pg.screenshot(path='/tmp/s_home.png')
    # demo -> solve
    pg.click('#btnDemo'); pg.screenshot(path='/tmp/s_demo.png')
    pg.click('#btnSolve'); pg.wait_for_selector('#screen-solve:not([hidden])',timeout=20000)
    n=pg.evaluate("RCS.S.moves.length"); print('demo moves',n)
    pg.screenshot(path='/tmp/s_solve.png')
    # step through all moves, verify solved
    for _ in range(n): pg.click('#btnNext')
    print('solved?',pg.evaluate("RCS.Cube.fromString(RCS.S.facelets).move(RCS.S.moves.join(' ')).isSolved()"))
    # manual: tap 3D model
    pg.click('#goHome'); pg.click('#btnManual'); pg.screenshot(path='/tmp/s_manual.png')
    pg.click('#palette .sw[data-b="1"]')
    pg.click('#views .view[data-f="F"]'); pg.wait_for_timeout(600)
    pg.click('.st[data-i="18"]',force=True)
    print('cell18',pg.evaluate("RCS.S.cells[18]"))
    pg.click('#btnSolve'); print('err:',pg.inner_text('#editErr'))
    # random scrambles via synthetic classify
    res=pg.evaluate("""()=>{
      const V=RCS.V,C=RCS.Cube,F=V.FACES,rgb={U:[223,229,26],F:[10,162,187],R:[194,29,44],D:[242,245,243],L:[232,87,12],B:[70,212,30]};
      const mv=['U','D','L','R','F','B'],suf=['',"'",'2'];let ok=0,N=30,bad=[];
      for(let t=0;t<N;t++){const c=new C();let s=[];for(let i=0;i<25;i++)s.push(mv[Math.floor(Math.random()*6)]+suf[Math.floor(Math.random()*3)]);c.move(s.join(' '));
        const st=c.asString(),sm={};const k=0.75+Math.random()*0.5;
        F.forEach((f,fi)=>{sm[f]=[];for(let j=0;j<9;j++){const col=rgb[st[fi*9+j]];sm[f].push(col.map(v=>Math.max(0,Math.min(255,Math.round(v*k+(Math.random()-.5)*14)))));}});
        const out=RCS.classifyFace(sm);
        if(out===st){const e=V.validate(out,C);if(!e)ok++;else bad.push(e);}else bad.push('mismatch');}
      return {ok,N,bad:bad.slice(0,3)};}""")
    print(res)
    b.close()
finally:
  srv.terminate()
print('errors:',errs)
