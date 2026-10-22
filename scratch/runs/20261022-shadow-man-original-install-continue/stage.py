import pathlib,io,tarfile,json,hashlib
from remote import *
D=pathlib.Path('/home/user/wine-assembly-shadow-man-exact-runtime-closure-oct22');S=D/'scratch/runs/20261022-shadow-man-exact-runtime-closure'
files={}
for x in json.loads((S/'source-manifest.json').read_text())['files']:
 p=D/x['path'];b=p.read_bytes();assert len(b)==x['size'] and hashlib.sha256(b).hexdigest()==x['sha256'];files['runtime/'+x['path']]=p
files['runtime/build/wine-assembly.wasm']=D/'build/wine-assembly.wasm'
assert hashlib.sha256(files['runtime/build/wine-assembly.wasm'].read_bytes()).hexdigest()=='f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7'
for x in json.loads((S/'historical-dependencies.json').read_text())['assetsVerifiedInPlace']:
 p=pathlib.Path(x['localVerifiedPath']);b=p.read_bytes();assert len(b)==x['size'] and hashlib.sha256(b).hexdigest()==x['sha256'];files['runtime/'+x['path']]=p
codec=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/shadow-man-codec-recovery-oct22')
for x in json.loads((S/'recovery-prerequisites.json').read_text())['codecCoreFiles']:
 p=codec/x['path'].removeprefix('runner/');b=p.read_bytes();assert len(b)==x['size'] and hashlib.sha256(b).hexdigest()==x['sha256'];files[x['path']]=p
P=pathlib.Path('/home/user/wine-assembly-shadow-man-original-recover-runtime-oct22/scratch/runs/20261022-shadow-man-original-recover-runtime')
for x in json.loads((P/'runtime-pins.json').read_text()):
 if x['path'].startswith('test/binaries/'):
  p=pathlib.Path('/home/user/wine-assembly')/x['path'];b=p.read_bytes();assert len(b)==x['size'] and hashlib.sha256(b).hexdigest()==x['sha256'];files['runtime/'+x['path']]=p
manifest=[dict(path=n,size=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for n,p in files.items()];save('staged-runtime-manifest.json',manifest)
buf=io.BytesIO()
with tarfile.open(fileobj=buf,mode='w:gz') as t:
 for n,p in files.items():t.add(p,arcname=n)
 for n in ['source-manifest.json','historical-dependencies.json','module-recovery.json']:
  t.add(S/n,arcname='receipt/'+n)
 data=json.dumps(manifest).encode();ti=tarfile.TarInfo('staged-runtime-manifest.json');ti.size=len(data);t.addfile(ti,io.BytesIO(data))
 # genuine six-file support identities and original media seals
 T=pathlib.Path('/home/user/wine-assembly-shadow-man-tools-ready-child-runtime-oct22/scratch/runs/20261022-shadow-man-reviewed-child-runtime/raw')
 for n,a in [('support-manifest.json','support-expected.json'),('original-seals.json','original-expected-seals.json')]:t.add(T/n,arcname=a)
data=buf.getvalue();assert len(data)+sum(x['size'] for x in manifest)+16000000<58720256
save('stage-archive.json',dict(size=len(data),sha256=hashlib.sha256(data).hexdigest(),expanded=sum(x['size'] for x in manifest),count=len(manifest)))
transfer(data,'exact-runtime.tar.gz')
print(run('import pathlib,tarfile,json,hashlib;R=pathlib.Path(%r);tarfile.open(R/"exact-runtime.tar.gz").extractall(R,filter="data");rows=json.loads((R/"staged-runtime-manifest.json").read_text());\nfor x in rows:\n p=R/x["path"];assert p.stat().st_size==x["size"] and hashlib.file_digest(p.open("rb"),"sha256").hexdigest()==x["sha256"],str(p)\nprint(json.dumps(dict(passAll=True,files=len(rows),bytes=sum(x["size"] for x in rows))))'%REMOTE,'stage-api.json')['stdout'])
