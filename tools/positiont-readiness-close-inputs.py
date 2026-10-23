#!/usr/bin/env python3
"""Focused existing-donor input closure. No acquisition or source changes."""
import pathlib, subprocess, os, json, hashlib, shutil
R=pathlib.Path(__file__).resolve().parent.parent
E=R/'docs/re-notes/render-positiont-build-readiness-20261023'
T=json.loads((E/'candidate-tree.json').read_text())
env=dict(os.environ,GIT_NO_LAZY_FETCH='1')
donors=[pathlib.Path('/home/user/wine-assembly'),pathlib.Path('/home/user/wine-assembly-render-positiont-com-qualification-fixture-oct23'),pathlib.Path('/home/user/wine-assembly-render-positiont-numerical-independent-review-oct23')]
def read(f,h):
 for d in donors:
  p=d/f
  if p.is_file():
   b=p.read_bytes()
   if hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==h:return b,str(p)
 for d in donors:
  p=subprocess.run(['git','-C',str(d),'cat-file','blob',h],env=env,capture_output=True)
  if not p.returncode:return p.stdout,str(d)+':object:'+h
 raise RuntimeError('missing pinned input '+f+' '+h)
rows=[]
for f,h in T.items():
 if not (f.startswith(('lib/','tools/','test/')) and f.endswith('.js')) or (R/f).exists():continue
 b,d=read(f,h);rows.append((f,h,b,d))
blobs=[]
for p in (R/'.git/objects').glob('*/*'):
 if p.parent.name in ['info','pack']:continue
 h=p.parent.name+p.name
 t=subprocess.run(['git','-C',str(R),'cat-file','-t',h],env=env,capture_output=True).stdout.strip()
 if t==b'blob':blobs.append(p)
external=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/render-positiont-build-readiness-oct23')
external_bytes=int(subprocess.check_output(['du','-sb',str(external)]).split()[0])+8192
current=int(subprocess.check_output(['du','-sb',str(R)]).split()[0])+external_bytes
new=sum(len(b) for f,h,b,d in rows)
dirs=set()
for f,h,b,d in rows:
 p=(R/f).parent
 while p!=R:
  if not p.exists():dirs.add(str(p))
  p=p.parent
removed=sum(p.stat().st_size for p in blobs)
projection=current-removed+new+len(dirs)*4096+8388608+524288
receipt=dict(before=current,externalBytes=external_bytes,sourceBytes=new,newDirectoryUpperBytes=len(dirs)*4096,removeRedundantTaskGitBlobsBytes=removed,reserve=8388608,growth=524288,projected=projection,cap=67108864,hostFree=shutil.disk_usage(R).free,files=[dict(path=f,blob=h,bytes=len(b),donor=d) for f,h,b,d in rows])
receipt['admitted']=projection<=67108864 and receipt['hostFree']-new-524288>=2982150144
(E/'complete-js-input-admission.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({k:v for k,v in receipt.items() if k!='files'},indent=2),flush=True)
if not receipt['admitted']:raise SystemExit(2)
# Retain every tree and commit; unchanged source blobs need not be duplicated in
# this task's thin Git store. Working input files remain exact and hash checked.
for p in blobs:p.unlink()
for f,h,b,d in rows:
 p=R/f;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
print('materialized',len(rows),'exact JS inputs')
