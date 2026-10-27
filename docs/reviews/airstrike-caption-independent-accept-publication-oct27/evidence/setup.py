import pathlib,hashlib,json,shutil
import run as c
D=pathlib.Path('/tmp/airstrike-console-obscuration-repair-oct27')
pins=json.loads((D/'ops/result.json').read_text())['sourcePins']
for n,h in pins.items():assert hashlib.sha256((D/'repo'/n).read_bytes()).hexdigest()==h
shutil.copytree(D/'repo',c.R,dirs_exist_ok=True,ignore=shutil.ignore_patterns('.git','__pycache__'))
shutil.copytree(D/'ops',c.H/'donor-evidence',ignore=shutil.ignore_patterns('__pycache__','startup-*'))
for name in ['production-run.js','production-renderer.js','production-renderer-input.js']:
 shutil.copyfile(D/'ops'/name,c.H/name)
ret=pathlib.Path('/tmp/airstrike-accepted-dispatch-quit-oct27/ops/retained')
shutil.copytree(ret,c.H/'retained',ignore=shutil.ignore_patterns('__pycache__'))
c.dump('input-identities.json',dict(sourcePins=pins,donor=str(D),donorIndexSHA256=hashlib.sha256((D/'repo/.git/index').read_bytes()).hexdigest(),donorHEAD=(D/'repo/.git/HEAD').read_text(),files={str(p.relative_to(D)):dict(sha256=hashlib.sha256(p.read_bytes()).hexdigest(),bytes=p.stat().st_size) for p in D.rglob('*') if p.is_file() and '.git' not in p.parts},SSH=c.SSH,mountValidation='not applicable: no mounted execution',node='forbidden; not executed'))
print('Exact pinned candidate copied unchanged; donor receipts and incidents retained read-only.')
