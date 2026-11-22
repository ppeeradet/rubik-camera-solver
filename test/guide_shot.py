import sys,subprocess,time,os
from playwright.sync_api import sync_playwright
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
srv=subprocess.Popen([sys.executable,'-m','http.server','8767','-d',root],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':390,'height':800}).new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8767/index.html'); pg.wait_for_timeout(500)
    pg.click('#guide>summary'); 
    pass
    pg.wait_for_timeout(300)
    pg.screenshot(path='/tmp/g_full.png',full_page=True); print(errs)
finally: srv.terminate()
