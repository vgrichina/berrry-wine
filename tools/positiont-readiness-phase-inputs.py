#!/usr/bin/env python3
"""Bounded lifetime of exact transient canonical-gate inputs."""
import pathlib, json, hashlib, subprocess, os, shutil, sys
R=pathlib.Path(__file__).resolve().parent.parent
E=R/'docs/re-notes/render-positiont-build-readiness-20261023'
phase=sys.argv[1]
assets={'fonts/Terminal.fon':'fb0ed91d991e23a7e59eea339bd5763c5557ed87','docs/dos-corpus/live/toyvm-bundle.js':'4ba63492b67c92a996f817ad241fae94f9e09c59','docs/dos-corpus/live/toyvm-jit-bundle.js':'2f3df6e171cc0a573953cec4de1addad26759ca9'}
def blob(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
rows=json.loads((E/'complete-js-input-admission.json').read_text())['files']
pins=json.loads((R/'test/support/positiont-com-source-pins.json').read_text())
release=[];copies=[]
for row in rows:
 f=row['path'];p=R/f
 if not p.exists():continue
 if phase=='bundle' and f.startswith('test/watx-compiler-'):continue
 if f in pins:raise RuntimeError('refuse pinned release '+f)
 assert blob(p.read_bytes())==row['blob']
 release.append(row)
if phase=='bundle':
 for f,h in assets.items():
  b=subprocess.check_output(['git','-C','/home/user/wine-assembly','cat-file','blob',h],env=dict(os.environ,GIT_NO_LAZY_FETCH='1'))
  assert blob(b)==h
  copies.append((f,h,b))
else:
 for f,h in assets.items():
  p=R/f
  if not p.exists():continue
  b=p.read_bytes();assert blob(b)==h
  release.append(dict(path=f,blob=h,bytes=len(b)))
external=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/render-positiont-build-readiness-oct23')
external_bytes=int(subprocess.check_output(['du','-sb',str(external)]).split()[0])+8192
current=int(subprocess.check_output(['du','-sb',str(R)]).split()[0])+external_bytes
removed=sum((R/x['path']).stat().st_size for x in release)
new=sum(len(b) for f,h,b in copies)
combined=0
if phase=='concat':
 tree=json.loads((E/'candidate-tree.json').read_text())
 import re
 combined=10+sum((R/'src'/f).stat().st_size for f in re.findall(r'\(include "([^"]+)"\)',(R/'src/main.watx').read_text()))
projected=current-removed+new+combined+8388608+262144
rec=dict(phase=phase,before=current,externalBytes=external_bytes,released=release,copies=[dict(path=f,blob=h,bytes=len(b),donor='/home/user/wine-assembly:object:'+h) for f,h,b in copies],newBytes=new,combinedProjectedBytes=combined,reserve=8388608,growth=262144,projected=projected,cap=67108864,free=shutil.disk_usage(R).free)
rec['admitted']=projected<=67108864 and rec['free']-new-combined-262144>=2982150144
(E/('phase-'+phase+'.json')).write_text(json.dumps(rec,separators=(',',':'))+'\n')
print('READINESS_PHASE '+json.dumps({k:v for k,v in rec.items() if k not in ['released','copies']}),flush=True)
if not rec['admitted']:raise SystemExit(2)
for row in release:(R/row['path']).unlink()
for f,h,b in copies:
 p=R/f;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
