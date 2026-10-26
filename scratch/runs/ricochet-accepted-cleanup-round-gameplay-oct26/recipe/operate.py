from transport import *
import sys
sys.path.insert(0,str(O))
from read import readfile
def frozen_read(target,local):
 at=time.monotonic();r=readfile(target,local,deadline=time.monotonic()+25,concurrency=4)
 with (O/'readbacks.jsonl').open('a') as f:f.write(json.dumps(dict(target=target,destination=str(local),elapsed=time.monotonic()-at,receipt=r))+'\n')
 return r
def decision(j):
 assert type(j.get('step',0)) is int and 0<=j.get('step',0)<=256
 if j.get('release'):assert j['release'].startswith('mouseup:')
 for c in j.get('commands',[]):assert set(c)=={'cmd'} and c['cmd'].split(':')[0] in ['mousemove','mousedown','mouseup','keydown','keyup']
 ident=time.time_ns();j['id']=ident
 code='import pathlib,json,time;h=pathlib.Path('+repr(R)+');o=h/"serial";p=o/"continue.json";assert not p.exists() and not (o/"done.json").exists();j='+repr(j)+';p.write_text(json.dumps(j));end=time.monotonic()+40\nwhile time.monotonic()<end:\n d=o/"decision-done.json"\n if d.exists() and json.loads(d.read_text())["id"]==j["id"]:print(d.read_text());break\n if (h/"guest/terminal.json").exists():raise RuntimeError("guest terminated; do not replay")\n time.sleep(.02)\nelse:raise RuntimeError("inflight uncertain; no replay")'
 result=py(code,timeout=45)
 with (O/'decisions.jsonl').open('a') as f:f.write(json.dumps(dict(request=j,response=result))+'\n')
 if j.get('png'):frozen_read('serial/'+j['png'],O/j['png'])
 return result
if __name__=='__main__':
 if sys.argv[1]=='read':print(json.dumps(frozen_read(sys.argv[2],O/sys.argv[3])))
 elif sys.argv[1]=='decision':print(json.dumps(decision(json.loads(sys.argv[2]))))
 elif sys.argv[1]=='state':print(py('import pathlib,json;h=pathlib.Path('+repr(R)+');print(json.dumps({str(p.relative_to(h)):p.read_text()[-5000:] for p in [h/"serial/checkpoint.json",h/"serial/paused.json",h/"serial/decision-done.json",h/"serial/done.json",h/"serial/first-failure.json",h/"guest/terminal.json",h/"controller.log"] if p.exists()}))')['stdout'])
