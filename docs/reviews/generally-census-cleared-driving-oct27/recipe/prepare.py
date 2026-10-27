from common import *
import io,tarfile
admission('prepare-admission')
rows=json.loads((H/'source-rows.json').read_text());out=[]
for x in rows:
 p=R/x['path'];b=p.read_bytes();assert len(b)==x['bytes'] and hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==x['oid'],x['path']
 out.append(dict(source=str(p),target='runner/'+x['path'],bytes=len(b),sha256=sha(b)))
game=json.loads((ROOT/'scratch/usage-watch/generally-driving-input-readiness-oct27.json').read_text())['files']
for x in game:
 p=pathlib.Path(x['path']);b=p.read_bytes();assert len(b)==x['bytes'] and sha(b)==x['sha256']
 out.append(dict(source=str(p),target='runner/test/binaries/candidates/generally/'+str(p.relative_to(ROOT/'test/binaries/candidates/generally')),bytes=len(b),sha256=sha(b)))
# Existing installed dependency closure, copied only on remote; no acquisition.
extra=ROOT/'test/binaries/candidates/generally/.wine-assembly-browser.json'
b=extra.read_bytes();out.append(dict(source=str(extra),target='runner/test/binaries/candidates/generally/.wine-assembly-browser.json',bytes=len(b),sha256=sha(b)))
for directory in ('pngjs',):
 codec=ROOT/'scratch/usage-watch/shadow-man-codec-recovery-oct22/node_modules'/directory
 for p in codec.rglob('*'):
  if p.is_file():
   b=p.read_bytes();out.append(dict(source=str(p),target='runner/node_modules/pngjs/'+str(p.relative_to(codec)),bytes=len(b),sha256=sha(b)))
save('stage-manifest.json',out)
save('projection.json',dict(sourceBytes=sum(x['bytes'] for x in out),localLimit=192*M,localReserve=8*M,remoteLimit=1024*M,remoteReserve=64*M,remotePeak=dict(source=sum(x['bytes'] for x in out),stageChunk=4*M,generatedAndModule=64*M,captures=16*M,logs=8*M,publication=8*M,growth=32*M,reserve=64*M),wire=dict(total=8*M,terminal=1*M,captures=4,eachRemote=4*M,transport='base64 <=4096 decoded bytes per response; prefetch full-envelope admission',expectedDimensions='800x600',expectedPNG='measured before full transfer; allocation does not imply4MiB frames can all transfer')))
print('verified',len(out),'files',sum(x['bytes'] for x in out),'bytes')
