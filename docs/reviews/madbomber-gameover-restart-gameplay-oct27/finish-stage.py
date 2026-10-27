import sys,json,tarfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent));import manage as m
from stage import api,put,REM
m.gate('finish-stage')
raw=(m.ROOT/'scratch/usage-watch/madbomber-restart-runtime-manifest-oct27.json').read_bytes();put('manifest.json',raw)
plan=json.loads((m.O/'staging-plan.json').read_text())
code='''import pathlib,tarfile,hashlib,json
p=pathlib.Path(ROOT);a=p/'closure.tar.gz'
assert hashlib.sha256(a.read_bytes()).hexdigest()==SHA
with tarfile.open(a) as t:t.extractall(p,filter='data')
rows=json.loads((p/'manifest.json').read_text());bad=[]
for r in rows:
 f=p/r.get('target',r.get('dest'));b=f.read_bytes()
 if len(b)!=r['bytes'] or hashlib.sha256(b).hexdigest()!=r['sha256']:bad.append(str(f))
assert not bad,bad
a.unlink();j=dict(files=len(rows),bytes=sum(r['bytes'] for r in rows),bad=bad,allocated=sum(x.stat().st_blocks*512 for x in p.rglob('*')),passAll=True)
(p/'transfer-receipt.json').write_text(json.dumps(j,indent=2));print(json.dumps(j))
'''.replace('ROOT',repr(REM)).replace('SHA',repr(plan['sha256']))
m.save('transfer-receipt.json',json.loads(api(code)))
(m.O/'git-inputs.tar.gz').unlink()
sup=Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py').read_text().replace('lower_limit(resource.RLIMIT_CPU, 90)','lower_limit(resource.RLIMIT_CPU, 150)').replace('lower_limit(resource.RLIMIT_FSIZE, 24*MIB)','lower_limit(resource.RLIMIT_FSIZE, 4*MIB)')
(m.O/'supervisor.py').write_text(sup)
for n in ['supervisor.py','controller.js','remote-run.py']:put(n,(m.O/n).read_bytes())
env={'PATH':'/home/user/.nvm/versions/node/v24.22.1/bin:/usr/local/bin:/usr/bin:/bin','HOME':'/home/user','LANG':'C.UTF-8','TZ':'UTC','PYTHONDONTWRITEBYTECODE':'1'}
put('environment.json',json.dumps(env).encode())
m.save('remote-configuration.json',dict(environment=env,node='/home/user/.nvm/versions/node/v24.22.1/bin/node',flags=['--max-old-space-size=512'],limits=dict(cpu=150,wall=150,fsize=4194304,rss=2147483648,data='unchanged unlimited',addressSpace='unchanged unlimited'),recipeHashes={n:m.sha((m.O/n).read_bytes()) for n in ['supervisor.py','controller.js','remote-run.py']}))
print(api('from pathlib import Path;p=Path('+repr(REM)+');(p/"commands").mkdir(); print("configured")'))
print(api('import subprocess; r=subprocess.run(["python3","-B",'+repr(REM+'/remote-run.py')+',"startup"],capture_output=True); print(r.stdout.decode()); print(r.stderr.decode());assert r.returncode==0',timeout=30))
m.save('startup-receipt.json',json.loads(api('from pathlib import Path;import json;p=Path('+repr(REM)+');print(json.dumps({"result":json.loads((p/"startup-supervision.json").read_text()),"output":(p/"startup-supervision.log").read_text()}))')))
m.gate('post-stage');print('378 verified; exact Node startup passed')
