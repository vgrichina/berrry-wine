import pathlib,json,hashlib,os,shutil,importlib.util,time
H=pathlib.Path(__file__).parent;R=H.parent/'repo';I=H/'inputrepo'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
manifest=pathlib.Path('/tmp/penguin-postloop-shot-acceptance-oct24/manifest.json')
assert sha(manifest)=='4141f5ff9e95ad35f8891394d79706a9a9a4792fe8dffce8f0f59bc4633ed5fd'
m=json.loads(manifest.read_text());gs=[x for x in m if x['kind']=='git']
assert len(m)==291 and sum(x['bytes'] for x in m)==15760340
assert len({(x['donor'],x['revision']) for x in gs})==1
d,rev=next(iter({(x['donor'],x['revision']) for x in gs}))
objects=[];queue=[pathlib.Path(d)/'.git/objects',pathlib.Path('/tmp/penguin-accepted-explicit-budget-main-integrate-oct27/repo/.git/objects')]
while queue:
 p=queue.pop().resolve()
 if str(p) in objects:continue
 objects.append(str(p));a=p/'info/alternates'
 if a.exists():queue.extend(pathlib.Path(x) if x.startswith('/') else p/x for x in a.read_text().splitlines())
for r in (R,I):
 (r/'.git/objects/info').mkdir(parents=True,exist_ok=True);(r/'.git/objects/info/alternates').write_text('\n'.join(objects)+'\n')
(I/'.git/info').mkdir(exist_ok=True);(I/'.git/info/sparse-checkout').write_text(''.join('/'+x['path']+'\n' for x in gs))
(H/'manifest.json').write_bytes(manifest.read_bytes())
(H/'input-identity.json').write_text(json.dumps(dict(donor=d,revision=rev,gitFiles=len(gs),files=len(m),bytes=sum(x['bytes'] for x in m),objects=objects,rootReceipt='/home/user/wine-assembly/scratch/usage-watch/penguin-published-projectile-gameplay-oct27/root-ref-digest.json',incidents=['Initial read-only displays exceeded8192B; original transcript retained.']),indent=2))
print(json.dumps(dict(donor=d,revision=rev,gitFiles=len(gs),manifestSHA256=sha(manifest))))
