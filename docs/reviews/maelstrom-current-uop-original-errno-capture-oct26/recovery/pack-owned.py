from common import *
rows=json.load(open(O/'recovered-git-objects.json'));before=size(R/'.git')
pack=R/'.git/objects/pack';pack.mkdir(exist_ok=True)
argv=['git','-c','pack.threads=1','-c','pack.window=0','-c','pack.windowMemory=16m','pack-objects','--stdout']
with (pack/'owned.pack').open('wb') as f:
 p=subprocess.run(argv,cwd=R,input=('\n'.join(x['oid'] for x in rows)+'\n').encode(),stdout=f,stderr=subprocess.PIPE,preexec_fn=glim,timeout=120);assert p.returncode==0,p.stderr
git('index-pack',str(pack/'owned.pack'))
for row in rows:
 p=R/'.git/objects'/row['oid'][:2]/row['oid'][2:];p.unlink()
for p in (R/'.git/objects').iterdir():
 if p.is_dir() and len(p.name)==2:
  try:p.rmdir()
  except OSError:pass
for row in rows:assert git('cat-file','-t',row['oid']).decode().strip()==row['kind']
git('update-index','--index-version','4')
save('owned-git-packing.json',dict(before=before,after=size(R/'.git'),objects=len(rows),exactObjectsVerified=True,rootDonorUntouched=True))
print(json.dumps(dict(before=before,after=size(R/'.git'))))
