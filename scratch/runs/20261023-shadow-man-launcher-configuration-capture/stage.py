"""Stage full measured original closure, without a local runtime duplicate."""
import os,io,subprocess
from transport import *
W=E.parents[2]
D=pathlib.Path('/home/user/wine-assembly-shadow-man-streamed-installed-runtime-oct22')
RT=D/'runtime'
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def gate():
 a=json.loads((E/'admission.json').read_text())
 actual=sum(int(subprocess.check_output(['du','-s','-B1',p]).split()[0]) for p in a['donors'])
 own=int(subprocess.check_output(['du','-s','-B1',str(W)]).split()[0])
 assert own<a['ownCheckoutEvidenceTempAllowance']
 assert actual+own+a['toolsAllowance']+a['selectedRootInputsAllowance']+a['reserve']<a['cap']
 assert __import__('shutil').disk_usage(W).free>a['hostFloor']
 return own
def main():
 rows=json.loads((E/'runtime-manifest.json').read_text());assert len(rows)==158
 index={l.split('\t')[1]:l.split()[1] for l in subprocess.check_output(['git','ls-files','--stage'],cwd=W,env=dict(os.environ,GIT_NO_LAZY_FETCH='1')).decode().splitlines()}
 planned=[]
 for x in rows:
  p=RT/x['path'];assert p.stat().st_size==x['size'] and sha(p)==x['sha256']
  b=p.read_bytes();assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==x['blob']==index[x['path']]
  planned.append((p,'immutable/runtime/'+x['path'],x['sha256']))
 codecs=json.loads((E/'codec-pins.json').read_text())['files'];assert len(codecs)==23
 for x in codecs:
  rel=x['path'].removeprefix('runner/');p=RT/rel;assert p.stat().st_size==x['size'] and sha(p)==x['sha256'];planned.append((p,'immutable/runtime/'+rel,x['sha256']))
 data=json.loads((E/'accepted/required-data-manifest.json').read_text());assert len(data['files'])==27 and data['totalBytes']==692498
 for x in data['files']:
  p=pathlib.Path(x['source']);b=p.read_bytes();assert len(b)==x['bytes'] and sha(p)==x['sha256'] and hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==x['gitBlob']==index[x['path']];planned.append((p,'immutable/runtime/'+x['path'],x['sha256']))
 ctl=pathlib.Path('/home/user/wine-assembly/tools/ctl.js');b=ctl.read_bytes();h=sha(ctl);assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==index['tools/ctl.js'];planned.append((ctl,'immutable/runtime/tools/ctl.js',h));save('ctl-pin.json',dict(path='tools/ctl.js',bytes=len(b),sha256=h,blob=index['tools/ctl.js'],requires=['fs','path','http']))
 module=DONOR/'canonical-primary.wasm';assert module.stat().st_size==1879387 and sha(module)=='ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553';planned.append((module,'immutable/runtime/build/wine-assembly.wasm',sha(module)))
 for n in ['runtime-manifest.json','codec-pins.json','accepted-installed-payload.json','accepted-parent-registry.json']:
  p=E/n;planned.append((p,'immutable/receipts/'+n,sha(p)))
 planned.append((E/'accepted/required-data-manifest.json','immutable/receipts/required-data-manifest.json',sha(E/'accepted/required-data-manifest.json')))
 planned.append((E/'accepted-parent-registry.json','immutable/registry-preflight.json',sha(E/'accepted-parent-registry.json')))
 for n in ['compile-guard.cjs','game-observer.cjs','dependency-preflight.cjs','forwarding-fixture.cjs','guard-fixture.cjs','watchdog.py','hash_gate.py','prepare_mutable.py']:
  p=E/n;planned.append((p,'fixed/'+n,sha(p)))
 # All material copies admitted before transfer, including complete closure.
 gate();save('staging-plan.json',[dict(source=str(p),target=ROOT+'/'+rel,bytes=p.stat().st_size,sha256=h) for p,rel,h in planned])
 out=[]
 for p,rel,h in planned:
  gate()
  with p.open('rb') as f:r=upload_stream(f,p.stat().st_size,ROOT+'/'+rel)
  assert r['sha256']==h
  out.append(r)
  save('stage-receipts.json',out)
 print('Full closure staged',len(out),flush=True)
if __name__=='__main__':main()
