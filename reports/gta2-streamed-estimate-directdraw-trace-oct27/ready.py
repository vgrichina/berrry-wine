import json,pathlib,shlex,time,hashlib
from api import api
O=pathlib.Path(__file__).parent;R='/home/user/wineops-gta2-causal-trace-oct27'
code='''import pathlib,json,hashlib,time,shutil
H=pathlib.Path("/home/user/wineops-gta2-causal-trace-oct27");O=H/"ops";R=H/"repo"
def sha(p):
 h=hashlib.sha256()
 with p.open("rb") as f:
  while b:=f.read(65536):h.update(b)
 return h.hexdigest()
p=json.loads((O/"preflight-result.json").read_text());s=json.loads((O/"startup-supervisor.json").read_text());i=json.loads((O/"startup-identity.json").read_text())
modules={n:sha(R/"build"/n) for n in ["wine-assembly.wasm","wine-assembly.compat.wasm"]}
assert modules=={"wine-assembly.wasm":"bf707aa41e2883e1407c71810a15fd5f1816961938c1103c8d1d5bd40cb701d9","wine-assembly.compat.wasm":"ff495de2b12c308013fa489b9fb291ca836171929655ca20df03440946c54dbc"}
assert p["ok"] and p["runnerSHA256"]=="6dc104b3c10db701c0b1aec5954dd00cc29a7b6009970a5876ccc27426e7fa9e" and len(p["files"])==71
assert s["exit"]==0 and not s["stopReason"] and s["cleanupComplete"]
used=sum(q.lstat().st_blocks*512 for q in H.rglob("*") if q.is_file());projection=used+268435456+16777216+67108864
assert projection<=1073741824
print(json.dumps(dict(at=time.time(),preflight={k:p[k] for k in ["ok","app","runnerSHA256","apiTableSHA256","apiCount","moduleSHA256","moduleBytes"]},files=len(p["files"]),imports=len(p["imports"]),modules=modules,node=i,startup=s,startupOutput=(O/"startup.stdout").read_text(),used=used,projection=projection,allocation=1073741824,preflightSHA256=sha(O/"preflight-result.json"),free=shutil.disk_usage(H).free)))
'''
j=api('python3 -c '+shlex.quote(code));v=json.loads(j['stdout']);assert time.time()<1793109180
assert all((O/('transfer-'+str(i)+'.json')).exists() for i in range(120))
v['stagingCompleteBefore15MinuteMargin']=True;v['stagingDeadline']='2026-10-27T13:53:00Z';v['PNGTransfersPlanned']=0
(O/'runtime-readiness.json').write_text(json.dumps(v,indent=2));print(json.dumps(v))
