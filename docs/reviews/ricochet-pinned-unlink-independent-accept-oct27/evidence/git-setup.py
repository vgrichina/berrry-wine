import pathlib,json,hashlib
O=pathlib.Path('/tmp/ricochet-pinned-unlink-independent-accept-oct27/ops');R=O.parent/'repo';G=R/'.git';assert (G/'HEAD').read_text().strip()=='ref: refs/heads/task/ricochet-pinned-unlink-independent-accept-oct27'
D=pathlib.Path('/tmp/ricochet-pinned-unlinked-version-repair-oct27/repo/.git/objects');seen=set();pins=[]
def visit(d):
 d=d.resolve()
 if d in seen:return
 seen.add(d);assert d.is_dir();a=d/'info/alternates';pins.append(dict(path=str(d),readOnly=True,alternatesSHA256=hashlib.sha256(a.read_bytes()).hexdigest() if a.exists() else None))
 if a.exists():
  for line in a.read_text().splitlines():visit(pathlib.Path(line) if line.startswith('/') else d/line)
visit(D)
(G/'objects/info/alternates').write_text(''.join(p['path']+'\n' for p in pins));(G/'config').write_text('''[core]
 repositoryformatversion = 0
 filemode = true
 bare = false
 logallrefupdates = true
 sparseCheckout = true
[user]
 name = Wine Ops
 email = wine-ops@local
[remote "origin"]
 url = git@github.com:vgrichina/wine-assembly.git
[gc]
 auto = 0
[maintenance]
 auto = false
''');(G/'info/sparse-checkout').write_text('/docs/reviews/ricochet-pinned-unlink-independent-accept-oct27/\n');(G/'info/exclude').write_text('/tools/\n/test/\n')
(O/'git-configuration.json').write_text(json.dumps(dict(branch='refs/heads/task/ricochet-pinned-unlink-independent-accept-oct27',strategy='Isolated sparse orphan REPORT ONLY; never merge whole tree',alternates=pins,configSHA256=hashlib.sha256((G/'config').read_bytes()).hexdigest(),noCheckoutFetchRepack=True),indent=2));print('Own sparse orphan report repository configured; donors read only, no checkout/fetch/repack.')
