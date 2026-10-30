"""Single-task supported API transfer, compile/run and delegated snapshot-stop."""
import control as c,pathlib,json,hashlib,base64,datetime,time,tarfile,os,sys
O=c.O;B='/home/user/.ascii/boat';CHUNK=11264
def call(n,args,wall=90):
 b=c.run(n,[B,'--no-update','--json',*args],cwd=O,wall=wall)
 try:return json.loads(b)
 except json.JSONDecodeError:return [json.loads(x) for x in b.splitlines() if x.strip()][-1]
def box():return json.loads((O/'boat-created.json').read_text())['id']
def remote(n,code,*args,wall=50):
 argv=['exec',box(),'--timeout',str(wall),'--','/usr/bin/python3','-B','-c',code,*args]
 assert sum(len(x.encode())+1 for x in argv)<=16384,'API argument envelope'
 v=call(n,argv,wall=wall+15)
 if not v.get('success') or v.get('exitCode')!=0 or v.get('stdoutTruncated') or v.get('stderrTruncated'):
  if not (O/'first-remote-denial.json').exists():c.save('first-remote-denial.json',dict(name=n,response=v))
  raise RuntimeError('remote rejected '+n+' '+str(v)[:2000])
 return v['stdout']
def closeout():
 started=time.time();v=call('snapshot-stop',['stop',box()],wall=90);c.save('boat-stop.json',v)
 for i in range(10):
  v=call('stopped-info-'+str(i),['info',box()],wall=30);c.save('boat-final-state.json',v);s=v.get('sandbox',v)
  if s.get('state')=='stopped' and s.get('snapshotVerifiedAt') and s.get('lastSnapshotStatus')=='completed' and s.get('stop',{}).get('status')=='completed':
   stamp=datetime.datetime.fromisoformat(s['snapshotVerifiedAt'].replace('Z','+00:00')).timestamp()
   last=json.loads((O/'remote-done.json').read_text()).get('finishedAt',0) if (O/'remote-done.json').exists() else json.loads((O/'boat-assignment.json').read_text())['createdEpoch']
   assert stamp>=last
   c.save('snapshot-stop-proof.json',dict(PASS=True,id=box(),stopped=True,lastSnapshotStatus=s['lastSnapshotStatus'],snapshotCompletedAt=s.get('snapshotCompletedAt'),snapshotVerifiedAt=s['snapshotVerifiedAt'],stoppedAt=s.get('stoppedAt'),postRun=True,stopOperation=s['stop'],closeoutStarted=started));return
  time.sleep(4)
 raise RuntimeError('snapshot-stop verification incomplete')
def transfer(p,target,prefix):
 off=int(remote('existing-offset',"import pathlib,sys;p=pathlib.Path('/home/user')/sys.argv[1];print(p.stat().st_size if p.exists() else 0)",target));h=hashlib.sha256()
 assert 0<=off<=p.stat().st_size
 with p.open('rb') as prior:
  left=off
  while left:
   b=prior.read(min(CHUNK,left));h.update(b);left-=len(b)
 actual=json.loads(remote('resume-prefix-digest',"import pathlib,hashlib,json,sys;p=pathlib.Path('/home/user')/sys.argv[1];print(json.dumps(dict(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())) if p.exists() else json.dumps(dict(bytes=0,sha256=hashlib.sha256(b'').hexdigest())))",target));assert actual==dict(bytes=off,sha256=h.hexdigest())
 with p.open('rb') as f:
  f.seek(off)
  while b:=f.read(CHUNK):
   assert time.time()<json.loads((O/'boat-assignment.json').read_text())['cutoffEpoch']
   h.update(b);code="import pathlib,base64,hashlib,sys,resource;resource.setrlimit(resource.RLIMIT_FSIZE,(12582912,resource.getrlimit(resource.RLIMIT_FSIZE)[1]));p=pathlib.Path('/home/user')/sys.argv[1];off=int(sys.argv[2]);assert (p.stat().st_size if p.exists() else 0)==off;b=base64.b64decode(sys.argv[3]);assert hashlib.sha256(b).hexdigest()==sys.argv[4];f=p.open('ab');f.write(b);f.close();print(off+len(b))"
   v=remote(prefix+'-'+str(off),code,target,str(off),base64.b64encode(b).decode(),hashlib.sha256(b).hexdigest());off+=len(b);assert int(v)==off
   if off%(CHUNK*100)==0:
    actual=json.loads(remote('periodic-full-digest',"import pathlib,hashlib,json,sys;p=pathlib.Path('/home/user')/sys.argv[1];print(json.dumps(dict(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())))",target));assert actual==dict(bytes=off,sha256=h.hexdigest())
   if off%(CHUNK*100)==0:print(json.dumps(dict(transfer=prefix,bytes=off)),flush=True)
 actual=json.loads(remote('final-full-digest',"import pathlib,hashlib,json,sys;p=pathlib.Path('/home/user')/sys.argv[1];print(json.dumps(dict(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())))",target));assert actual==dict(bytes=off,sha256=h.hexdigest())
 c.save(prefix+'-receipt.json',dict(source=str(p),remote=target,bytes=off,sha256=h.hexdigest(),rawChunkBytes=CHUNK,argumentEnvelopeCeiling=16384,incrementalDigest=True))
def collect():
 code="import pathlib,json,hashlib; r=pathlib.Path('/home/user/tuxracer-render/capture');print(json.dumps([dict(path=p.name,bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in r.iterdir() if p.is_file()]))"
 rows=json.loads(remote('capture-manifest',code));c.save('capture-manifest.json',rows)
 # Keep all raw logs remotely in the post-run snapshot; collect compact actual
 # runtime logs compressed in place and the PNGs inside the separate512KiB cap.
 png=[x for x in rows if x['path'].endswith('.png')];assert sum(x['bytes'] for x in png)<=524288,png
 remote('pack-compact-logs',"import pathlib,gzip,json,hashlib; r=pathlib.Path('/home/user/tuxracer-render/capture');p=r/'raw-logs.json.gz';d={x.name:x.read_text() for x in r.iterdir() if x.suffix in ('.stdout','.stderr')};b=gzip.compress(json.dumps(d).encode());assert len(b)<=150000;p.write_bytes(b);print(len(b))")
 rows=json.loads(remote('compact-manifest',code));c.save('capture-manifest.json',rows)
 selected=[x for x in rows if x['path'].endswith(('.png','.json')) or x['path']=='raw-logs.json.gz']
 assert sum(x['bytes'] for x in selected if not x['path'].endswith('.png'))<=262144
 dest=O/'capture';dest.mkdir(exist_ok=True)
 for row in selected:
  assert pathlib.PurePosixPath(row['path']).name==row['path']
  off=0;h=hashlib.sha256()
  with (dest/row['path']).open('xb') as f:
   while off<row['bytes']:
    code="import pathlib,base64,sys; f=pathlib.Path('/home/user/tuxracer-render/capture',sys.argv[1]).open('rb');f.seek(int(sys.argv[2]));print(base64.b64encode(f.read(11264)).decode())"
    b=base64.b64decode(remote('collect-'+row['path']+'-'+str(off),code,row['path'],str(off)));assert b;f.write(b);h.update(b);off+=len(b)
  assert off==row['bytes'] and h.hexdigest()==row['sha256']
def main():
 assert json.loads((O/'closure.json').read_text())['PASS'];c.admission()
 assert (O/'boat-created.json').exists() and (O/'api-smoke.json').exists()
 assert time.time()+240<json.loads((O/'boat-assignment.json').read_text())['cutoffEpoch']
 staging=json.loads((O/'staging-manifest.json').read_text())
 for i,x in enumerate(staging['archives']):transfer(pathlib.Path(x['path']),'packet-'+str(i)+'.tar.gz','archive-'+str(i))
 for name,p in [('observer.js',pathlib.Path(staging['observer']['path'])),('staging-manifest.json',O/'staging-manifest.json'),('remote-worker.py',O/'remote-worker.py')]:transfer(p,name,'write-'+name.replace('.','-'))
 code="""import pathlib,tarfile,hashlib,json,resource
resource.setrlimit(resource.RLIMIT_FSIZE,(12582912,resource.getrlimit(resource.RLIMIT_FSIZE)[1]))
r=pathlib.Path('/home/user/tuxracer-render');r.mkdir()
v=json.loads(pathlib.Path('/home/user/staging-manifest.json').read_text())
for i,x in enumerate(v['archives']):
 p=pathlib.Path('/home/user/packet-'+str(i)+'.tar.gz');assert hashlib.sha256(p.read_bytes()).hexdigest()==x['sha256']
 with tarfile.open(p) as t:
  assert all(x.isfile() and not x.name.startswith('/') and '..' not in pathlib.PurePosixPath(x.name).parts for x in t.getmembers());t.extractall(r,filter='data')
(r/'test/main-scheduler-observer.js').write_bytes(pathlib.Path('/home/user/observer.js').read_bytes())
for n,x in v['files'].items():
 p=r/n;assert p.stat().st_size==x['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==x['sha256'],n
(r/'build/wine-assembly.wasm').unlink()
used=sum(x.lstat().st_blocks*512 for x in [r,*r.rglob('*')])+sum(x.lstat().st_blocks*512 for x in pathlib.Path('/home/user').glob('packet-*.tar.gz'));assert used+8388608+41943040<=268435456
print(json.dumps(dict(PASS=True,files=len(v['files']),allocated=used,historicalModuleRemoved=True)))
"""
 c.save('staging-verification.json',json.loads(remote('verify-stage',code,wall=60)))
 assert time.time()+240<json.loads((O/'boat-assignment.json').read_text())['cutoffEpoch']
 v=call('compile-and-run',['exec',box(),'--detach','--','/usr/bin/python3','-B','/home/user/remote-worker.py'],wall=20);c.save('remote-handle.json',v)
 for i in range(55):
  ready=json.loads(remote('observe-'+str(i),"import pathlib,json; p=pathlib.Path('/home/user/tuxracer-render/capture/done.json');print(p.read_text() if p.exists() else json.dumps({'pending':True}))",wall=15))
  if not ready.get('pending'):c.save('remote-done.json',ready);break
  time.sleep(5)
 else:raise RuntimeError('bounded compile/runtime completion missing; no retry')
 collect()
if __name__=='__main__':
 try:main()
 except BaseException as e:c.save('failure.json',dict(at=time.time(),error=repr(e)));print(repr(e),flush=True)
 finally:
  if (O/'boat-created.json').exists():closeout()
