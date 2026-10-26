import os,json,hashlib,pathlib,datetime,shutil
B=pathlib.Path('/tmp/civ2-win16-ordinary-gameplay-oct26')
R=pathlib.Path('/home/user/wine-assembly/scratch/runs/civ2-win16-ordinary-gameplay-oct26')
p=json.load(open('/home/user/wine-assembly/scratch/usage-watch/civ2-win16-pinned-inputs-oct26.json'))
def sha(f):
 h=hashlib.sha256()
 with open(f,'rb') as s:
  for c in iter(lambda:s.read(1024*1024),b''): h.update(c)
 return h.hexdigest()
checks=[]
for root,entries in [(B/'source',p['files']),(pathlib.Path(p['fixture']),p['fixtureManifestFiles'])]:
 for e in entries:
  f=root/e['path']; actual=sha(f)
  checks.append(dict(path=str(f),bytes=f.stat().st_size,sha256=actual,ok=f.stat().st_size==e['bytes'] and actual==e['sha256']))
assert all(e['ok'] for e in checks)
out=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),originalmain=p['revision'],sparseSnapshot=True,sourceFiles=len(p['files']),fixtureFiles=len(p['fixtureManifestFiles']),checks=checks)
(R/'pinned-verification.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({k:v for k,v in out.items() if k!='checks'}))
