import pathlib,json,hashlib,base64,datetime,time,os,tarfile,importlib.util
import control as c
O=c.O;B='/home/user/.ascii/boat';D=pathlib.Path('/tmp/tuxracer-software-render-msvcrt-retest-oct30');COUNTER=0
def call(n,args,wall=90):
 b=c.run(n,[B,'--no-update','--json',*args],wall=wall)
 try:return json.loads(b)
 except json.JSONDecodeError:return [json.loads(x) for x in b.splitlines() if x.strip()][-1]
def remote(n,code,*args,wall=50):
 box=json.loads((O/'boat-created.json').read_text())['id']
 v=call(n,['exec',box,'--timeout',str(wall),'--','/usr/bin/python3','-B','-c',code,*args],wall=wall+15)
 if not v.get('success') or v.get('exitCode')!=0 or v.get('stdoutTruncated') or v.get('stderrTruncated'):raise RuntimeError('remote operation rejected '+n+' '+str(v)[:1500])
 return v['stdout']
def closeout():
 box=json.loads((O/'boat-created.json').read_text())['id'];start=time.time()
 v=call('boat-stop',['stop',box],wall=90);c.save('boat-stop.json',v)
 for i in range(8):
  v=call('boat-stopped-info-%d'%i,['info',box],wall=30);c.save('boat-final-state.json',v);s=v.get('sandbox',v)
  if s.get('state')=='stopped' and s.get('snapshotVerifiedAt'):
   stamp=datetime.datetime.fromisoformat(s['snapshotVerifiedAt'].replace('Z','+00:00')).timestamp()
   assert stamp>=json.loads((O/'schedule.json').read_text())['createdEpoch']
   c.save('snapshot-stop-proof.json',{'verifiedStopped':True,'snapshotVerifiedAt':s['snapshotVerifiedAt'],'stoppedAt':s.get('stoppedAt'),'id':box,'closeoutStarted':start});return
  time.sleep(4)
 raise RuntimeError('snapshot-stop verification incomplete')
def transfer(p,target,prefix):
 off=0;h=hashlib.sha256()
 with p.open('rb') as f:
  while b:=f.read(16384):
   h.update(b);code="import pathlib,base64,hashlib,sys; p=pathlib.Path('/home/user')/sys.argv[1]; off=int(sys.argv[2]); assert (p.stat().st_size if p.exists() else 0)==off; b=base64.b64decode(sys.argv[3]); assert hashlib.sha256(b).hexdigest()==sys.argv[4]; f=p.open('ab'); f.write(b); f.close(); print(off+len(b))"
   v=remote(prefix+'-%04d'%(off//16384),code,target,str(off),base64.b64encode(b).decode(),hashlib.sha256(b).hexdigest());off+=len(b);assert int(v)==off
   if off%(16384*40)==0:print(json.dumps({'transfer':prefix,'bytes':off}),flush=True)
 c.save(prefix+'-receipt.json',{'source':str(p),'remote':target,'bytes':off,'sha256':h.hexdigest()})
def collect():
 rows=json.loads(remote('capture-manifest',"import pathlib,json,hashlib; r=pathlib.Path('/home/user/tuxracer-render/capture'); print(json.dumps([dict(path=p.name,bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in r.iterdir() if p.is_file()]))"));c.save('capture-manifest.json',rows)
 dest=O/'capture';dest.mkdir(exist_ok=True);assert sum(x['bytes'] for x in rows if x['path'].endswith('.png'))<=8*c.M
 assert sum(x['bytes'] for x in rows if x['path'].endswith('.json'))<=c.M
 for row in rows:
  assert pathlib.PurePosixPath(row['path']).name==row['path']
  # Logs are bounded2MiB; retain real logs locally as raw evidence.
  off=0;h=hashlib.sha256()
  with (dest/row['path']).open('xb') as f:
   while off<row['bytes']:
    code="import pathlib,base64,sys; f=pathlib.Path('/home/user/tuxracer-render/capture',sys.argv[1]).open('rb');f.seek(int(sys.argv[2]));print(base64.b64encode(f.read(16384)).decode())"
    b=base64.b64decode(remote('collect-'+row['path']+'-'+str(off),code,row['path'],str(off)));assert b;f.write(b);h.update(b);off+=len(b)
  assert h.hexdigest()==row['sha256'] and off==row['bytes']
def main():
 assert json.loads((O/'preflight.json').read_text())['PASS'];assert json.loads((O/'host-abi-reuse.json').read_text())['PASS']
 assert json.loads((O/'closure.json').read_text())['PASS']
 c.admission();v=call('boat-create',['new','--ttl','1800','--no-env','--fail-fast','--type','default','--name','tuxracer-main-menu-race-oct30']);c.save('boat-created.json',v)
 now=time.time();expiry=datetime.datetime.fromisoformat(v['archiveAfter'].replace('Z','+00:00')).timestamp()
 c.save('schedule.json',{'createdEpoch':now,'expiryEpoch':expiry,'cutoffEpoch':now+1200,'handbackEpoch':now+1380,'shutdownEpoch':now+1500,'ttl':1800,'owner':'this task; explicit delegated verified snapshot-stop'})
 c.save('boat-assignment.json',dict(box=v['id'],createdEpoch=now,expiry=v['archiveAfter'],cutoffEpoch=now+1200,handbackEpoch=now+1380,shutdownEpoch=now+1500,ttl=1800,owner='this task; explicit delegated preservation plus snapshot-stop',task='tuxracer-main-menu-race-progression-oct30'))
 print(json.dumps({'boat':v['id'],'expiry':v['archiveAfter']}),flush=True)
 import subprocess
 q=subprocess.Popen(['/usr/bin/python3','-B',str(O/'watchdog.py')],cwd=O,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True);c.save('watchdog.json',dict(pid=q.pid,shutdownEpoch=now+1500))
 transfer(D/'packet.tar.gz','standing.tar.gz','standing-transfer');transfer(c.OLD/'candidate.tar.gz','candidate.tar.gz','candidate-transfer');transfer(pathlib.Path('/tmp/tuxracer-vertex-color-gameplay-owner-policy-oct30/candidate-delta.tar.gz'),'delta.tar.gz','delta-transfer')
 for p in [O/'source-manifest.json',O/'remote-worker.py']:
  transfer(p,p.name,'write-'+p.stem)
 pre=json.loads((O/'preflight.json').read_text());arc=json.loads((D/'archive.json').read_text())
 code="""import pathlib,tarfile,hashlib,json
r=pathlib.Path('/home/user/tuxracer-render');r.mkdir()
for n,h in [('standing.tar.gz',%r),('candidate.tar.gz',%r),('delta.tar.gz',%r)]:
 p=pathlib.Path('/home/user')/n;assert hashlib.sha256(p.read_bytes()).hexdigest()==h
 with tarfile.open(p) as t:
  rows=t.getmembers();assert all(x.isfile() and not x.name.startswith('/') and '..' not in pathlib.PurePosixPath(x.name).parts for x in rows);t.extractall(r,filter='data')
v=json.loads(pathlib.Path('/home/user/source-manifest.json').read_text())
for n,x in v['inputs'].items():
 p=r/n;assert p.stat().st_size==x['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==x['sha256'],n
(r/'build/wine-assembly.wasm').unlink()
print(json.dumps({'sourceFiles':len(v['inputs']),'historicalModuleRemoved':True,'allocation':sum(p.lstat().st_blocks*512 for p in [r,*r.rglob('*')])}))
"""%(arc['sha256'],pre['candidateArchiveSHA'],pre['deltaSHA'])
 print(remote('stage',code),flush=True)
 v=call('build-runtime-start',['exec',v['id'],'--detach','--','/usr/bin/python3','-B','/home/user/remote-worker.py'],wall=20);c.save('live-handle.json',v)
 pid=v.get('pid',v.get('processId'));assert isinstance(pid,int) and pid>1, v
 for i in range(48):
  ready=json.loads(remote('observe-%02d'%i,"import pathlib,json; p=pathlib.Path('/home/user/tuxracer-render/capture/done.json');print(p.read_text() if p.exists() else json.dumps({'pending':True}))",wall=15))
  if not ready.get('pending'):c.save('remote-done.json',ready);break
  time.sleep(5)
 else:raise RuntimeError('bounded observation expired; do not restart')
 collect()
if __name__=='__main__':
 try:main()
 except BaseException as e:c.save('failure.json',{'at':time.time(),'error':repr(e)});print(repr(e),flush=True)
 finally:
  if (O/'boat-created.json').exists():closeout()
