import pathlib,json,hashlib
import run as c
D=pathlib.Path('/tmp/airstrike-console-obscuration-repair-oct27/repo')
seen=set();queue=[D/'.git/objects'];stores=[]
while queue:
 p=queue.pop(0).resolve()
 if str(p) in seen:continue
 seen.add(str(p));assert p.is_dir();stores.append(str(p))
 a=p/'info/alternates'
 if a.exists():
  for line in a.read_text().splitlines():queue.append((p/line).resolve() if not line.startswith('/') else pathlib.Path(line))
if (c.H/'alternates.json').exists():
 (c.H/'alternates-original.json').write_bytes((c.H/'alternates.json').read_bytes())
stores=[str(c.ROOT/'.git/objects')]
(c.R/'.git/objects/info/alternates').write_text('\n'.join(stores)+'\n')
url='git@github.com:vgrichina/wine-assembly.git'
(c.R/'.git/config').write_text('[core]\n repositoryformatversion = 0\n bare = false\n sparseCheckout = true\n[remote "origin"]\n url = '+url+'\n[user]\n name = Wine Ops\n email = wine-ops@localhost\n[gc]\n auto = 0\n')
(c.R/'.git/info/sparse-checkout').write_text('/tools/airstrike-menu-controller.py\n/tools/airstrike-observation-bridge.py\n/test/test-airstrike*\n/docs/reviews/\n')
c.dump('alternates.json',dict(readOnly=True,objectStores=stores,semantics='Immutable content-addressed root donor objects only; no donor checkout/index/ref/object writes, no fetch/repack. Original overinclusive nested alternate graph retained in alternates-original.json; unnecessary stores removed to eliminate demonstrated nesting warnings.'))
print('Configured strict launcher SSH and sparse orphan report, read-only flattened donor alternates.')
