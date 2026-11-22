import re,pathlib
r=pathlib.Path(__file__).resolve().parent.parent
h=(r/'index.html').read_text()
def esc(s): return s.replace('</script','<\\/script')
css=(r/'css/style.css').read_text()
h=re.sub(r'<link[^>]*css/style.css[^>]*>',lambda m:'<style>'+css+'</style>',h)
def inl(m):
    tag=m.group(0); src=re.search(r'src="([^"]+)"',tag).group(1)
    code=esc((r/src).read_text())
    return tag.replace(' src="%s"'%src,'').replace('></script>','>'+code+'</script>')
h=re.sub(r'<script[^>]*src="[^"]+"[^>]*></script>',inl,h)
(r/'dist').mkdir(exist_ok=True);(r/'dist/rubik-solver.html').write_text(h)
print(len(h))
