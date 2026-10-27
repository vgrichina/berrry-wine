import pathlib,os,json,hashlib
H=pathlib.Path(__file__).parent;R=H.parent/'repo';G=R/'.git';D=pathlib.Path('/tmp/enigma-frame-accounting-corrected-admission-oct27/repo/.git/objects')
V=H/'immutable-donor-object-view';V.mkdir()
objects={}
for sub in D.iterdir():
 if len(sub.name)!=2 or not sub.is_dir():continue
 dst=V/sub.name;dst.mkdir()
 for p in sub.iterdir():
  if p.is_file():
   (dst/p.name).symlink_to(p)
   objects[sub.name+p.name]=hashlib.sha256(p.read_bytes()).hexdigest()
 dst.chmod(0o555)
V.chmod(0o555)
(H/'immutable-object-pins.json').write_text(json.dumps(objects,indent=2))
(G/'config').write_text('''[core]
 repositoryformatversion = 0
 filemode = true
 bare = false
 sparseCheckout = true
[user]
 name = Wine Ops Worker
 email = wine-ops@local
[gc]
 auto = 0
[maintenance]
 auto = false
[remote "origin"]
 url = git@github.com:vgrichina/wine-assembly.git
''')
(G/'HEAD').write_text('ref: refs/heads/task/enigma-full-frame-independent-accept-oct27\n')
(G/'info/sparse-checkout').write_text('/test/fixtures/enigma-controller/independent-latency.py\n/docs/reviews/enigma-full-frame-independent-accept-oct27/\n')
(G/'objects/info/alternates').write_text(str(V)+'\n'+(D/'info/alternates').read_text())
print('Sparse evidence orphan configured; immutable content-addressed read-only donor view, no checkout/fetch/repack; strict SSH launcher string retained')
