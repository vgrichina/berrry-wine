from control import *
seen=set();ordered=[];active=set();cycles=[]
def visit(p):
 p=p.resolve()
 if p in seen:return
 if p in active:cycles.append(str(p));return
 if len(seen)+len(active)>2048:raise RuntimeError('alternate store count cap')
 active.add(p)
 f=p/'info/alternates'
 if f.exists():
  if f.stat().st_size>25165824:raise RuntimeError('alternate file cap')
  with f.open() as stream:
   while True:
    s=stream.readline(8192)
    if not s:break
    if not s.endswith('\n'):raise RuntimeError('alternate path excerpt cap')
    s=s.rstrip('\n')
    if s:visit(pathlib.Path(s) if s.startswith('/') else p/s)
 active.remove(p);seen.add(p);ordered.append(str(p))
visit(D/'.git/objects')
save('alternate-recovery.json',{'cause':'pinned donor commit exists but nested Git alternate depth prevented full accepted tree lookup; initial diagnostics retained','method':'read-only bounded traversal of existing alternate paths; leaf-first direct object stores in isolated task repo, no refs listing or object copying','stores':len(ordered),'cycles':cycles,'paths':ordered})
(P/'flat-alternates.txt').write_text('\n'.join(ordered)+'\n')
print(json.dumps({'stores':len(ordered),'cycles':len(cycles)}))
