import pathlib,json,hashlib,subprocess
from transport import ROOT,run,get,guard
out=ROOT/'evidence/session1';out.mkdir(parents=True,exist_ok=True)
manifest=json.loads(run("import pathlib,json,hashlib; p=pathlib.Path('/home/user/madbomber-fps/evidence/session1'); print(json.dumps([{'path':f.name,'size':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in sorted(p.iterdir()) if f.is_file()]))"))
for f in manifest:
 guard(f['size']);p=out/f['path'];get('/home/user/madbomber-fps/evidence/session1/'+f['path'],p);assert p.stat().st_size==f['size'];assert hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256']
(ROOT/'recovery-manifest.json').write_text(json.dumps(manifest,indent=2))
print(len(manifest),sum(f['size'] for f in manifest))
for label,pid in [('npm',26589),('session1',26854)]:
 p=subprocess.run(['boat','exec','bx_ppatp9cq','--status',str(pid)],capture_output=True,text=True);(ROOT/(label+'-status.json')).write_text(p.stdout);assert json.loads(p.stdout)['exitCode']==0
print(run("import subprocess; p=subprocess.run(['python3','-B','/home/user/madbomber-fps/identity.py','after'],capture_output=True,text=True); print(p.stdout,p.stderr); assert p.returncode==0"))
get('/home/user/madbomber-fps/evidence/after.json',ROOT/'after.json');get('/home/user/madbomber-fps/evidence/dependencies.json',ROOT/'dependencies-after.json')
assert (ROOT/'dependencies.json').read_bytes()==(ROOT/'dependencies-after.json').read_bytes()
# Owned process absence and port inventory, no fleet or unrelated cleanup.
print(run("import os,json,subprocess,pathlib; p=pathlib.Path('/home/user/madbomber-fps/evidence/session1'); m=json.loads((p/'identity.json').read_text()); r={'pids':{str(m[k]):os.path.exists('/proc/'+str(m[k])) for k in ['pid','chromePid','serverPid']},'listeners':subprocess.check_output(['ss','-ltnp'],text=True)}; print(json.dumps(r)); pathlib.Path('/home/user/madbomber-fps/evidence/postflight.json').write_text(json.dumps(r,indent=2)); assert not any(r['pids'].values()); assert ':8080 ' not in r['listeners']"))
get('/home/user/madbomber-fps/evidence/postflight.json',ROOT/'postflight.json')
p=subprocess.run(['boat','--json','info','bx_ppatp9cq'],capture_output=True,text=True);(ROOT/'box-handoff.json').write_text(p.stdout)
