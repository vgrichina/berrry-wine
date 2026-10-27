import pathlib,json,hashlib,zlib,os
H=pathlib.Path(__file__).parent;R=H.parent/'repo'
start=pathlib.Path('/tmp/enigma-accepted-progressive-menu-main-integrate-oct27/repo/.git/objects')
seen=set();todo=[start];target='0a61c1bc254e3e455607e01d2e29d7f97c2806ef';found=None
while todo:
 p=todo.pop().resolve()
 if p in seen:continue
 seen.add(p)
 q=p/target[:2]/target[2:]
 if q.is_file():found=q;break
 alt=p/'info/alternates'
 if alt.exists():
  for line in alt.read_text().splitlines():todo.append(pathlib.Path(line) if line.startswith('/') else p/line)
 assert len(seen)<512
assert found,'source commit loose immutable object not found; stop without fetch'
raw=found.read_bytes();assert len(raw)<1048576
assert hashlib.sha1(zlib.decompress(raw)).hexdigest()==target
view=H/'immutable-donor-object-view';(view/target[:2]).mkdir(parents=True,exist_ok=True)
link=view/target[:2]/target[2:];link.symlink_to(found)
(R/'.git/objects/info/alternates').write_text(str(view)+'\n')
(H/'object-view.json').write_text(json.dumps(dict(sourceCommit=target,readOnlyDonorObject=str(found),compressedBytes=len(raw),compressedSHA256=hashlib.sha256(raw).hexdigest(),view=str(view),method='Read-only immutable content-addressed donor file symlink; no materialized object copies, tree checkout, repack, fetch or donor mutation',visitedObjectStores=len(seen),originalWarning='git-donor-object.stderr preserved'),indent=2)+'\n')
print('PASS bounded immutable source commit object view; no nested alternates')
