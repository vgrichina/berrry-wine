"""Verify historical module/source, then stream the bounded runtime to assigned Boat."""
import base64, concurrent.futures, hashlib, io, json, pathlib, subprocess, tarfile
E=pathlib.Path(__file__).resolve().parent
W=E.parents[2]
ROOT=pathlib.Path('/home/user/wine-assembly')
DONOR=pathlib.Path('/home/user/wine-assembly-arcanum-software-frame-measure-oct22/runtime')
Q=pathlib.Path('/home/user/wine-assembly-mm-timer-qualified-integrate-oct22/scratch/runs/20261022-mm-timer-canonical-qualification')
BOX='bx_5mu9dnhg'; REMOTE='/home/user/aoe3-original-oct22'
REV='c26252c4a95babe583ade1d1c6e2da0c050be45c'
def sha(b): return hashlib.sha256(b).hexdigest()
def save(n,x): (E/n).write_text(json.dumps(x,indent=2)+'\n')
def run(code):
 p=subprocess.run(['boat','exec','--json',BOX,'--','python3','-c',code],capture_output=True,text=True)
 r=json.loads(p.stdout); assert p.returncode==0 and r['exitCode']==0,r
 return r
def transfer(stream,name):
 run('import pathlib; p=pathlib.Path(%r); p.parent.mkdir(parents=True,exist_ok=True); p.write_bytes(b"")'%(REMOTE+'/'+name))
 h=hashlib.sha256(); pos=0; receipts=[]; pending=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  while True:
   b=stream.read(60000)
   if not b: break
   code='import os,base64;f=os.open(%r,os.O_WRONLY); b=base64.b64decode(%r); assert os.pwrite(f,b,%d)==len(b);os.close(f)'%(REMOTE+'/'+name,base64.b64encode(b).decode(),pos)
   pending.append(pool.submit(run,code)); h.update(b);pos+=len(b)
   if len(pending)==4: receipts.extend(x.result() for x in pending);pending=[]
  receipts.extend(x.result() for x in pending)
 verify=run('import pathlib,hashlib; p=pathlib.Path(%r); assert p.stat().st_size==%d; assert hashlib.sha256(p.read_bytes()).hexdigest()==%r; print("PASS")'%(REMOTE+'/'+name,pos,h.hexdigest()))
 save(name+'.transfer.json',dict(bytes=pos,sha256=h.hexdigest(),receipts=receipts,verification=verify))
 return verify
def git(*args): return subprocess.check_output(['git','-C',str(W),*args],stderr=subprocess.DEVNULL)
def main():
 archive=Q/'qualification-artifacts.tar.gz'; ah=sha(archive.read_bytes())
 assert ah=='3e308c0012e996070a01c1f77d6f399e9aaf7adb2d2620b27af018a80d29e248'
 with tarfile.open(archive) as t: module=t.extractfile('build/wine-assembly.wasm').read()
 assert sha(module)=='f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7'
 trees={r:{p:git('rev-parse',r+':'+p).decode().strip() for p in ['src','lib','tools','host.js','index.html','package-lock.json']} for r in [REV,'ce4ce4f95eacaedff1b3e386f3ce3ae5d85bd16c']}
 assert len({json.dumps(x,sort_keys=True) for x in trees.values()})==1
 pins=[]; stream=io.BytesIO()
 with tarfile.open(fileobj=stream,mode='w:gz') as t:
  def add(rel,b):
   info=tarfile.TarInfo(rel);info.size=len(b);t.addfile(info,io.BytesIO(b));pins.append(dict(path=rel,size=len(b),sha256=sha(b)))
  for p in sorted(DONOR.rglob('*')):
   if not p.is_file():continue
   rel=p.relative_to(DONOR).as_posix();b=p.read_bytes()
   assert b==(module if rel=='build/wine-assembly.wasm' else git('show',REV+':'+rel)),rel
   add(rel,b)
  add('test/run.js',git('show',REV+':test/run.js'))
  for x in json.loads(pathlib.Path('/home/user/wine-assembly-aow2-import-reachability-measure-oct22/scratch/runs/20261022-aow2-import-reachability-measure/font-manifest.json').read_text()):
   b=(ROOT/x['path']).read_bytes(); assert sha(b)==x['sha256'];add(x['path'],b)
  for rel in ['test/binaries/dlls/msvcrt.dll','test/binaries/explorer98/dlls/shlwapi.dll','test/binaries/tlbs/stdole2.tlb']:
   add(rel,(ROOT/rel).read_bytes())
 save('module-inventory.json',dict(source=REV,trees=trees,archive=str(archive),archiveSha256=ah,moduleSha256=sha(module),moduleBytes=len(module),decision='Reuse preserved matching module; no build; historical source, not current main.'))
 save('runtime-pins.json',pins)
 stream.seek(0);transfer(stream,'runtime.tar.gz')
 print(run('import tarfile;tarfile.open(%r).extractall(%r,filter="data");print("staged")'%(REMOTE+'/runtime.tar.gz',REMOTE+'/runtime'))['stdout'])
if __name__=='__main__':main()
