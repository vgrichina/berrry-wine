"""Stage exact reviewed closure and pinned existing assets, never rebuild."""
import io,tarfile,pathlib,json,hashlib
from remote import *
S=pathlib.Path('/home/user/wine-assembly-shadow-man-original-source-oct22/scratch/runs/20261022-shadow-man-original-source')
buf=io.BytesIO()
with tarfile.open(fileobj=buf,mode='w:gz') as t:
 for name in ['probe.py','closure.json','listing-Demos-Shadowman.json']:
  t.add(S/name,arcname=name)
 for p in sorted((S/'ranges').glob('*')):
  if p.is_file():t.add(p,arcname=p.relative_to(S))
transfer(buf.getvalue(),'receipt-dependencies.tar.gz')
print(run('import tarfile;tarfile.open(%r).extractall(%r,filter="data")'%(REMOTE+'/receipt-dependencies.tar.gz',REMOTE+'/receipt'),'receipt-dependencies.json')['stdout'])
print(run('import subprocess,pathlib,hashlib,json;R=pathlib.Path(%r);p=R/"recovery/GS1199.iso";assert p.stat().st_size==674328576;assert hashlib.file_digest(p.open("rb"),"sha256").hexdigest()=="db9ca33413c53d2d333a3d4b2e220d19daab625526d8acf55c1f11e780b28a12";s=subprocess.run(["python3",str(R/"receipt/verify.py"),str(R/"recovery/source/Demos/Shadowman")],capture_output=True,text=True);assert s.returncode==0,s.stderr;(R/"recovery/extracted-members.json").write_text(s.stdout);print(s.stdout)'%REMOTE,'source-verification-api.json')['stdout'])
files={}
for x in json.loads((E/'source-manifest.json').read_text())['files']:files['runtime/'+x['path']]=W/x['path']
files['runtime/build/wine-assembly.wasm']=W/'build/wine-assembly.wasm'
dep=json.loads((E/'historical-dependencies.json').read_text())
for x in dep['assetsVerifiedInPlace']:
 p=pathlib.Path(x['localVerifiedPath']);b=p.read_bytes();assert len(b)==x['size'] and hashlib.sha256(b).hexdigest()==x['sha256'];files['runtime/'+x['path']]=p
codec=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/shadow-man-codec-recovery-oct22')
for x in json.loads((E/'recovery-prerequisites.json').read_text())['codecCoreFiles']:
 p=codec/x['path'].removeprefix('runner/');b=p.read_bytes();assert len(b)==x['size'] and hashlib.sha256(b).hexdigest()==x['sha256'];files[x['path']]=p
pins=json.loads(pathlib.Path('/home/user/wine-assembly-shadow-man-original-recover-runtime-oct22/scratch/runs/20261022-shadow-man-original-recover-runtime/runtime-pins.json').read_text())
for x in pins:
 if x['path'].startswith('test/binaries/'):
  p=pathlib.Path('/home/user/wine-assembly')/x['path'];b=p.read_bytes();assert len(b)==x['size'] and hashlib.sha256(b).hexdigest()==x['sha256'];files['runtime/'+x['path']]=p
manifest=[dict(path=n,size=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for n,p in files.items()]
save('staged-runtime-manifest.json',manifest)
buf=io.BytesIO()
with tarfile.open(fileobj=buf,mode='w:gz') as t:
 for n,p in files.items():t.add(p,arcname=n)
 data=json.dumps(manifest).encode();ti=tarfile.TarInfo('staged-runtime-manifest.json');ti.size=len(data);t.addfile(ti,io.BytesIO(data))
data=buf.getvalue()
print(run('import pathlib,shutil,json;R=pathlib.Path(%r);n=sum(p.stat().st_size for p in R.rglob("*") if p.is_file());assert n+%d+%d+268435456<2147483648;assert shutil.disk_usage(R).free-%d-%d-268435456>=2982150144;print(json.dumps(dict(current=n,archive=%d,expanded=%d,phaseCap=2147483648)))'%(REMOTE,len(data),sum(x['size'] for x in manifest),len(data),sum(x['size'] for x in manifest),len(data),sum(x['size'] for x in manifest)),'runtime-prewrite.json')['stdout'])
transfer(data,'exact-runtime.tar.gz')
print(run('import pathlib,tarfile,json,hashlib;R=pathlib.Path(%r);tarfile.open(R/"exact-runtime.tar.gz").extractall(R,filter="data");rows=json.loads((R/"staged-runtime-manifest.json").read_text());\nfor x in rows:\n p=R/x["path"];assert p.stat().st_size==x["size"] and hashlib.file_digest(p.open("rb"),"sha256").hexdigest()==x["sha256"],str(p)\nprint(json.dumps(dict(passAll=True,files=len(rows),bytes=sum(x["size"] for x in rows))))'%REMOTE,'runtime-staging-api.json')['stdout'])
