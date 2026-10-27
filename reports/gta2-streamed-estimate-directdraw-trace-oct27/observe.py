import pathlib,time,json,shlex
from api import api
O=pathlib.Path(__file__).parent
code='''import pathlib,json
O=pathlib.Path("/home/user/wineops-gta2-causal-trace-oct27/ops")
r={}
for n in ["guest-start.json","guest-exit.json","guest-supervisor.json","controller-terminal.json"]:
 p=O/n;r[n]=json.loads(p.read_text()) if p.exists() else None
p=O/"controls.json"
if p.exists():
 c=json.loads(p.read_text());r["controlsCount"]=len(c);r["lastControls"]=c[-2:]
for n in ["guest.stdout","guest.stderr"]:
 p=O/n
 if p.exists():
  with p.open("rb") as f:f.seek(max(0,p.stat().st_size-2000));r[n]=dict(bytes=p.stat().st_size,tail=f.read(2000).decode(errors="replace"))
print(json.dumps(r))
'''
j=api('python3 -c '+shlex.quote(code));v=json.loads(j['stdout']);(O/('observe-'+str(time.time_ns())+'.json')).write_text(json.dumps(v,indent=2));print(json.dumps(v))
