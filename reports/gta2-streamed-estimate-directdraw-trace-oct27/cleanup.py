import pathlib,json,time,shlex
from api import api
O=pathlib.Path(__file__).parent
code='''import pathlib,json,time
O=pathlib.Path("/home/user/wineops-gta2-causal-trace-oct27/ops");r=json.loads((O/"guest-supervisor.json").read_text());survivors=[]
for pid,start in r["owned"]:
 try:
  s=pathlib.Path("/proc",str(pid),"stat").read_text().split(") ")[1].split()
  if s[19]==start:survivors.append(dict(pid=pid,start=start,state=s[0]))
 except FileNotFoundError:pass
c=json.loads((O/"controller-terminal.json").read_text());assert not survivors and r["cleanupComplete"] and c["pending"] is None
H=O.parent;used=sum(p.lstat().st_blocks*512 for p in H.rglob("*") if p.is_file())
print(json.dumps(dict(at=time.time(),ownedSurvivors=survivors,supervisor=r,controllerPending=c["pending"],guestExit=json.loads((O/"guest-exit.json").read_text()),remoteUsed=used,box="bx_cqss3x42",state="RUNNING: supported exec succeeded",lifecycleMutations=0,expiry="2026-10-27T14:27:50.265Z",shutdownOwner="coordinator",cutoff="14:08Z",handback="14:12Z",shutdown="14:15Z")))
'''
j=api('python3 -c '+shlex.quote(code));v=json.loads(j['stdout']);(O/'cleanup-remote.json').write_text(json.dumps(v,indent=2));print(json.dumps(v))
