import subprocess,pathlib,json
E=pathlib.Path(__file__).parent
code=r'''
import pathlib,hashlib,json,socket,os
r=pathlib.Path('/home/user/aoe3-original-oct22');n=0
for base,entries in [(r/'runtime',json.loads((r/'runtime-pins.json').read_text())),(r/'installed',json.loads((r/'installed-audit/installed-manifest.json').read_text())['files'])]:
 for x in entries:
  p=base/x['path'];assert p.stat().st_size==x['size'] and hashlib.sha256(p.read_bytes()).hexdigest()==x['sha256'];n+=1
assert n==373
processes=[]
for p in pathlib.Path('/proc').glob('[0-9]*/comm'):
 try:
  name=p.read_text().strip()
  if name in ['node','nodejs','chrome','chromium','chromium-browse']:processes.append({'pid':p.parent.name,'name':name})
 except (OSError,PermissionError):pass
ports={}
for port in [8123,8124]:
 s=socket.socket();ports[port]=s.connect_ex(('127.0.0.1',port));s.close()
x=dict(originalPins=n,passAll=True,runtimeProcesses=processes,portsConnectEx=ports,box='bx_32262dnp',lifecycleOwner='coordinator',state='left running',expiry='2026-10-22T12:53:29.069Z',free=os.statvfs(r).f_bavail*os.statvfs(r).f_frsize)
(pathlib.Path('/home/user/aoe3-oleaut-repair-oct22/evidence/host-census-canonical-20261022T1237Z')/'handback.json').write_text(json.dumps(x,indent=2));print(json.dumps(x))
'''
p=subprocess.run(['boat','exec','--json','--timeout','30','bx_32262dnp','--','python3','-c',code],capture_output=True,text=True);(E/'handback-receipt.json').write_text(p.stdout);(E/'handback-stderr.txt').write_text(p.stderr);x=json.loads(p.stdout);assert x['exitCode']==0;(E/'handback.json').write_text(x['stdout']);print(x['stdout'])
