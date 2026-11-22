import sys,subprocess,time,os
from playwright.sync_api import sync_playwright
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
srv=subprocess.Popen([sys.executable,'-m','http.server','8766','-d',root],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
errs=[]
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    for name,w,h in [('phone',390,800),('ipadP',820,1180),('ipadL',1180,820)]:
      pg=b.new_context(viewport={'width':w,'height':h}).new_page()
      pg.on('pageerror',lambda e:errs.append(str(e)))
      pg.goto('http://localhost:8766/index.html')
      pg.wait_for_function("document.querySelector('#solverState').classList.contains('ok')",timeout=20000)
      pg.click('#btnDemo'); pg.wait_for_timeout(700); pg.screenshot(path=f'/tmp/e_{name}.png')
      pg.click('#btnSolve'); pg.wait_for_selector('#screen-solve:not([hidden])',timeout=20000)
      pg.click('#btnNext'); pg.wait_for_timeout(900); pg.screenshot(path=f'/tmp/v_{name}.png')
      print(name,'overflowX',pg.evaluate("document.documentElement.scrollWidth>innerWidth"))
finally: srv.terminate()
print(errs)
