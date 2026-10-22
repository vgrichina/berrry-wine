from pathlib import Path
import json,hashlib,subprocess
E=Path('/home/user/aoe3-system-capabilities-diagnosis-oct22');S=Path('/home/user/aoe3-canonical-c7fae5ac-staged')
def check(p,r):
 assert p.stat().st_size==r['bytes'],str(p)
 with p.open('rb') as f:assert hashlib.file_digest(f,'sha256').hexdigest()==r['sha256'],str(p)
for n,r in json.loads((E/'remote-seals.json').read_text()).items():check(E/n,r)
for p,r in json.loads((E/'analysis-identities.json').read_text()).items():check(Path(p),r)
for r in json.loads((E/'source-version-context.json').read_text()):
 p=S/r['path'];check(p,r['sourceSeal']);ls=p.read_text().splitlines();n=r['firstLine']-1;assert r['text']=='\n'.join(f'{i+1}: {ls[i]}' for i in range(n,n+len(r['text'].splitlines())))
for n in ['guest/excerpts.json','prior-boundary.json']:
 d=json.loads((E/n).read_text());raw=Path(d['raw']['path']).read_bytes();check(Path(d['raw']['path']),d['raw'])
 for r in d['samples']:
  b=raw[r['offset']:r['offset']+r['bytes']];assert b.decode()==r['text'] and hashlib.sha256(b).hexdigest()==r['sha256']
 for bad in [raw[:-1],raw+b'x']:assert hashlib.sha256(bad).hexdigest()!=d['raw']['sha256']
pid=json.loads((E/'guest/launch.json').read_text())['pid'];assert not Path(f'/proc/{pid}').exists()
print('PASS all remote evidence seals, exact retained native/source identities, source excerpt text, full old/new log seals and byte offsets; truncated/appended raw controls reject; guest absent')
