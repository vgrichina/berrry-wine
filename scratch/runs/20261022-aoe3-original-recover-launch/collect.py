"""Bounded evidence recovery only; original media and extracted trees stay remote."""
import base64,hashlib,json,pathlib
from stage import E,REMOTE,run,save
code='''import pathlib,json,hashlib,os,subprocess
r=pathlib.Path(%r)
paths=[]
for d in ['acquisition','msi','installed-audit','game-run']:
 for p in sorted((r/d).rglob('*')):
  if not p.is_file() or '/vfs/' in str(p) or p.suffix.lower() in ['.exe','.msi','.dll','.cab']:continue
  if p.stat().st_size<=4000000:paths.append(p)
for rel in ['bootstrap-run/output.log','bootstrap-run/started.txt','bootstrap-run/exit.txt','bootstrap-run/final.png','bootstrap-run/capture/launch.json','runtime-pins.json','prepare-installed.py','launch-game.py','runner/package.json','runner/package-lock.json','runner/npm.log','apt-update.log','apt-install.log']:
 p=r/rel
 if p.exists():paths.append(p)
assert len(paths)==len(set(paths))
assert sum(p.stat().st_size for p in paths)<16000000
manifest=[dict(path=str(p.relative_to(r)),size=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in paths]
runner=[dict(path=str(p.relative_to(r)),size=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in sorted((r/'runner/node_modules').rglob('*')) if p.is_file()]
(r/'runner-manifest.json').write_text(json.dumps(runner,indent=2)+'\\n')
print(json.dumps(dict(files=manifest,runner=runner)))
'''%REMOTE
r=run(code);save('collection-receipt.json',r);m=json.loads(r['stdout']);save('runner-manifest.json',m['runner']);save('remote-evidence-manifest.json',m['files'])
for x in m['files']:
 target=E/'raw'/x['path'];assert '..' not in pathlib.PurePosixPath(x['path']).parts
 if target.exists() and target.stat().st_size==x['size'] and hashlib.sha256(target.read_bytes()).hexdigest()==x['sha256']:continue
 receipt=run('import base64,pathlib;print(base64.b64encode(pathlib.Path(%r).read_bytes()).decode())'%(REMOTE+'/'+x['path']))
 b=base64.b64decode(receipt['stdout']);assert len(b)==x['size'] and hashlib.sha256(b).hexdigest()==x['sha256']
 target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(b)
print('PASS recovered',len(m['files']),'files',sum(x['size'] for x in m['files']),'bytes; runner pins',len(m['runner']))
