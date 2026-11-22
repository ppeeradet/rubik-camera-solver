import sys,subprocess,time,os
from playwright.sync_api import sync_playwright
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
srv=subprocess.Popen([sys.executable,'-m','http.server','8767','-d',root],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':390,'height':800},has_touch=True).new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8767/index.html'); pg.wait_for_timeout(500)
    pg.click('#guide>summary'); pg.wait_for_timeout(300)
    t0=pg.evaluate("document.getElementById('guideCube').style.transform")
    pg.query_selector('#guideScene').scroll_into_view_if_needed(); pg.wait_for_timeout(200)
    box=pg.query_selector('#guideScene').bounding_box(); cx=box['x']+box['width']/2; cy=box['y']+box['height']/2
    pg.mouse.move(cx,cy); pg.mouse.down(); pg.mouse.move(cx+90,cy-30,steps=6); pg.mouse.up()
    t1=pg.evaluate("document.getElementById('guideCube').style.transform")
    print(t0,'->',t1,errs)
    pg.query_selector('#guideScene').scroll_into_view_if_needed(); pg.screenshot(path='/tmp/g_drag.png')
finally: srv.terminate()
