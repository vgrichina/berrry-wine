import pathlib, hashlib, json
import run as c
D=pathlib.Path('/tmp/airstrike-console-obscuration-repair-oct27/repo')
A=pathlib.Path('/tmp/airstrike-caption-independent-accept-publication-oct27')
manifest=json.loads((A/'ops/receipt-manifest.json').read_text())
stores=[]; queue=[D/'.git/objects',A/'repo/.git/objects']; seen=set()
while queue:
 p=queue.pop(0).resolve()
 if str(p) in seen: continue
 seen.add(str(p)); assert p.is_dir(); stores.append(str(p))
 alt=p/'info/alternates'
 if alt.exists():
  queue.extend(pathlib.Path(s) if s.startswith('/') else p/s for s in alt.read_text().splitlines())
(c.R/'.git/objects/info/alternates').write_text('\n'.join(stores)+'\n')
(c.R/'.git/config').write_text('[core]\n repositoryformatversion = 0\n bare = false\n sparseCheckout = true\n[remote "origin"]\n url = git@github.com:vgrichina/wine-assembly.git\n[user]\n name = Wine Ops\n email = wine-ops@localhost\n[gc]\n auto = 0\n')
paths=['tools/airstrike-menu-controller.py','tools/airstrike-observation-bridge.py','test/test-airstrike-console-obscuration.py','test/test-airstrike-menu-controller.py','test/test-airstrike-observation-bridge.py']
(c.R/'.git/info/sparse-checkout').write_text('\n'.join('/'+p for p in paths)+'\n/docs/reviews/\n')
c.dump('input-checkpoint.json',dict(donorsReadOnly=True,immutableObjects=stores,paths=paths,rejected='e2525d558e8bd4891e3c14d3b6b2f3c2f5efd0a4',ssh=c.SSH,mountArgv=[],mounts='No mounts or runtime: canonical filename-bearing mount parser not applicable',rootRefReceipt=str(c.ROOT/'scratch/usage-watch/airstrike-caption-interior-geometry-repair-oct27/root-ref-digest.json'),manifestSHA256=hashlib.sha256((A/'ops/receipt-manifest.json').read_bytes()).hexdigest()))
for name in ['reproduce.py','production-renderer-input.js']:
 data=(A/'ops'/name).read_bytes()
 assert hashlib.sha256(data).hexdigest()==manifest['hashes'][name] if 'hashes' in manifest else True
 (c.H/name).write_bytes(data)
print('Configured isolated sparse repository and immutable read-only donors; exact strict SSH; no mount argv.')
