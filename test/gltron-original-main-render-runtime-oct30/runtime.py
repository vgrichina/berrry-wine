from control import *
import base64,concurrent.futures,threading,datetime,tarfile,traceback
A=None;watch=None;lock=threading.Lock();journal=[]
REMOTE='/home/user/gltron-render'
def epoch(s):return datetime.datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()
def api(code,label,timeout=30,cwd='/home/user',record=True):
 assert A and time.time()<A['shutdownEpoch']
 argv=[B,'--no-update','--json','exec','--cwd',cwd,'--timeout',str(timeout),A['id'],'--','/usr/bin/python3','-B','-c',code]
 assert sum(len(x.encode())+1 for x in argv)+1024<=16384
 start=time.time();q=subprocess.Popen(argv,cwd=R,env=dict(os.environ,BOAT_NO_UPDATE='1'),stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True);sel=selectors.DefaultSelector();out=bytearray();err=bytearray();sel.register(q.stdout,selectors.EVENT_READ,out);sel.register(q.stderr,selectors.EVENT_READ,err);bad=None
 while sel.get_map() or q.poll() is None:
  for k,_ in sel.select(.04):
   b=os.read(k.fileobj.fileno(),4096)
   if not b:sel.unregister(k.fileobj);continue
   room=max(0,16384-len(out)-len(err));k.data.extend(b[:room])
   if len(b)>room:bad='API response overflow'
  if time.time()-start>timeout+15:bad='API wall'
  if bad:
   try:os.killpg(q.pid,signal.SIGKILL)
   except ProcessLookupError:pass
   q.wait();break
 q.wait();sel.close();assert not bad,(label,bad)
 assert q.returncode==0,(label,q.returncode,err.decode(errors='replace')[:1500],out.decode(errors='replace')[:1500])
 v=[json.loads(x) for x in out.decode().splitlines()][-1]
 rec=dict(label=label,request=pin(code.encode()),response=pin(bytes(out)),elapsed=time.time()-start,exit=v.get('exitCode'),success=v.get('success'),responseBytes=len(out))
 with lock:journal.append(rec)
 if record:save(label+'.json',dict(receipt=rec,response=v))
 assert v.get('success') is True and v.get('exitCode')==0 and not v.get('stdoutTruncated') and not v.get('stderrTruncated'),(label,v)
 return v['stdout']
def transfer(p,rel):
 b=p.read_bytes();dest=REMOTE+'/'+rel
 for off in range(0,len(b),6000):
  raw=b[off:off+6000];code='import pathlib,base64;p=pathlib.Path('+repr(dest)+');p.parent.mkdir(parents=True,exist_ok=True);b=base64.b64decode('+repr(base64.b64encode(raw).decode())+');f=p.open('+repr('wb' if off==0 else 'ab')+');f.write(b);f.close();assert p.stat().st_size=='+str(off+len(raw))
  api(code,'transfer-'+rel.replace('/','_')+'-'+str(off),record=False)
 return dict(path=rel,**pin(b))
try:
 assert json.loads((E/'local-preflight.json').read_text())['PASS'];admission('provision-forecast')
 # Local wire smoke checks bounded chunk envelope before provisioning.
 raw=b'gltron-api-transfer-capture-smoke';assert base64.b64decode(base64.b64encode(raw))==raw;save('local-wire-smoke.json',dict(PASS=True,rawChunkLimit=6000,requestResponseLimit=16384,smoke=pin(raw)))
 source=native(['info','bx_rht9232f'],'fork-source-info')[-1]['sandbox'];assert source['state']=='stopped' and source['snapshotAvailable'] and source['lastSnapshotStatus']=='completed';save('fork-source.json',source)
 try:created=native(['fork','--ttl','1800','--no-env','--wait','bx_rht9232f'],'create-fork',wall=100)
 except:
  created=[json.loads(x) for x in (E/'create-fork.stdout').read_text().splitlines()]
  box=next((v['id'] for v in created if v.get('event')=='created'),None)
  if box:
   now=time.time();A=dict(id=box,shutdownEpoch=now+60,expiry=None);save('boat-assignment.json',A)
  raise
 box=next(v['id'] for v in created if v.get('event')=='created');assert box!='bx_rht9232f';ready=next(v for v in created if v.get('event')=='ready');now=time.time();exp=epoch(ready['archiveAfter'])
 A=dict(id=box,source='bx_rht9232f',createdEpoch=now,expiry=ready['archiveAfter'],cutoffEpoch=min(now+1200,epoch('2026-10-30T13:28:22Z')),retrieveEpoch=min(now+1320,epoch('2026-10-30T13:30:22Z')),handbackEpoch=min(now+1380,epoch('2026-10-30T13:31:22Z')),shutdownEpoch=min(now+1500,epoch('2026-10-30T13:33:22Z')),shutdownDelegated=True,remoteRoot=REMOTE)
 save('boat-assignment.json',A)
 out=(E/'watchdog.stdout').open('wb');err=(E/'watchdog.stderr').open('wb');watch=subprocess.Popen(['/usr/bin/python3','-B',str(R/'watchdog.py')],cwd=R,stdout=out,stderr=err,start_new_session=True);assert watch.poll() is None;save('watchdog-armed.json',dict(pid=watch.pid,box=box,deadline=A['shutdownEpoch'],beforeFirstAPIExec=True))
 s=api('import pathlib,base64,hashlib,json,resource,os;b=base64.b64decode('+repr(base64.b64encode(raw).decode())+');p=pathlib.Path("/home/user/gltron-api-smoke");p.write_bytes(b);assert p.read_bytes()==b;p.unlink();print(json.dumps(dict(sha256=hashlib.sha256(b).hexdigest(),node=os.path.exists("/usr/bin/node"),pngjs=os.path.exists("/home/user/wine-assembly/node_modules/pngjs"),limits={n:resource.getrlimit(getattr(resource,n)) for n in ["RLIMIT_DATA","RLIMIT_AS","RLIMIT_FSIZE"]})))','explicit-boat-smoke');assert json.loads(s)['sha256']==pin(raw)['sha256']
 api('import pathlib;p=pathlib.Path('+repr(REMOTE)+');assert not p.exists();p.mkdir()','create-owned-root')
 save('assignment-for-transfer.json',A)
 items=[(R/'pinned-source-closure.tar.xz','source.tar.xz'),(R/'original-media.tar.xz','media.tar.xz'),(R/'pinned-input-closure.json','pins.json'),(R/'remote-controller.py','controller.py'),(E/'launch-configuration.json','launch-configuration.json'),(E/'assignment-for-transfer.json','assignment.json')]
 admission('transfer-forecast')
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:transferred=list(pool.map(lambda x:transfer(*x),items))
 save('api-transfer-journal.json',journal);save('transfer-receipt.json',dict(files=transferred,maxRawChunk=6000,requestResponseLimit=16384))
 code='''import pathlib,tarfile,json,hashlib,re,os
r=pathlib.Path('/home/user/gltron-render');os.chdir(r)
def pin(p):
 b=p.read_bytes();return dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
expected=EXPECTED
for f in expected:assert pin(r/f['path'])=={k:f[k] for k in ['bytes','sha256']}
p=json.loads((r/'pins.json').read_text())
with tarfile.open(r/'source.tar.xz') as t:
 members=t.getmembers();assert all(m.isfile() and m.name in p['files'] and not pathlib.PurePosixPath(m.name).is_absolute() and '..' not in pathlib.PurePosixPath(m.name).parts for m in members);assert set(m.name for m in members)==set(p['files']);t.extractall(r,filter='data')
for n,w in p['files'].items():assert pin(r/n)==w,n
seen=set()
def walk(n):
 if n in seen:return
 seen.add(n)
 for rel in re.findall(r'\(include\s+"([^"]+)"\)',(r/n).read_text()):walk(str(pathlib.PurePosixPath(n).parent/rel))
walk('src/main.watx');assert len(seen)==128
with tarfile.open(r/'media.tar.xz') as t:
 ms=t.getmembers();assert len(ms)==92 and all(m.isfile() and m.name.startswith('binaries/gltron-0.70/') and '..' not in pathlib.PurePosixPath(m.name).parts for m in ms);t.extractall(r,filter='data')
files=json.loads((r/'launch-configuration.json').read_text())['configuration']['files']
for f in files:assert pin(r/f['url'])==dict(bytes=f['size'],sha256=f['sha256'])
v=dict(PASS=True,sourceFiles=len(p['files']),canonicalWATFiles=len(seen),mediaFiles=len(files),mediaBytes=sum(f['size'] for f in files));(r/'source-verification.json').write_text(json.dumps(v));print(json.dumps(v))
'''.replace('EXPECTED',repr(transferred))
 api(code,'remote-source-verification',timeout=40,cwd=REMOTE)
 api('import runpy,sys;sys.argv=["controller.py","preflight"];runpy.run_path("controller.py",run_name="__main__")','remote-preflight',timeout=60,cwd=REMOTE)
 admission('compile-forecast')
 api('import runpy,sys;sys.argv=["controller.py","compile"];runpy.run_path("controller.py",run_name="__main__")','remote-compile',timeout=200,cwd=REMOTE)
 result=json.loads(api('import pathlib;print(pathlib.Path("result.json").read_text())','compile-result',cwd=REMOTE))
 if result['status']=='COMPILED':
  admission('guest-forecast');assert time.time()<A['cutoffEpoch'];(E/'one-guest-invocation.lock').open('x').write(str(time.time()))
  api('import runpy,sys;sys.argv=["controller.py","guest"];runpy.run_path("controller.py",run_name="__main__")','remote-guest',timeout=110,cwd=REMOTE)
 assert time.time()<A['retrieveEpoch']
 names=['source-verification.json','remote-preflight.json','node-startup-120.json','node-startup-120.stdout.log','node-startup-60.json','node-startup-60.stdout.log','png-parser-smoke.json','png-parser-smoke.stdout.log','generated-control.json','output-control.json','compile.json','compile.stdout.log','compile.stderr.log','result.json','build-identity.json','guest.json','guest.stdout.log','guest.stderr.log','capture/original.png']
 manifest=json.loads(api('import pathlib,json,hashlib;names='+repr(names)+';r={n:dict(bytes=pathlib.Path(n).stat().st_size,sha256=hashlib.sha256(pathlib.Path(n).read_bytes()).hexdigest()) for n in names if pathlib.Path(n).is_file()};print(json.dumps(r))','retrieval-manifest',cwd=REMOTE));save('retrieval-manifest.json',manifest)
 for n,w in manifest.items():
  cap=300000 if n.endswith('.png') else 8192 if n.endswith('.log') else 196608;assert w['bytes']<=cap
  parts=[]
  for off in range(0,w['bytes'],6000):
   s=api('import pathlib,base64;f=pathlib.Path('+repr(n)+').open("rb");f.seek('+str(off)+');print(base64.b64encode(f.read(6000)).decode())','retrieve-'+n.replace('/','_')+'-'+str(off),cwd=REMOTE,record=False);parts.append(base64.b64decode(s.strip(),validate=True))
  b=b''.join(parts);assert pin(b)==w;dst=E/'retrieved'/n;dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes(b)
 save('api-transfer-journal.json',journal)
except BaseException as ex:
 save('first-failure.json',dict(error=repr(ex),traceback=traceback.format_exc(),at=time.time()));raise
finally:
 save('api-transfer-journal.json',journal)
 if A:
  # Explicit task delegates snapshot and actual stop on every exit.
  native(['stop',A['id']],'snapshot-stop',wall=100)
  for n in range(8):
   v=native(['info',A['id']],'final-info-'+str(n))[-1]['sandbox']
   if v['state']=='stopped' and v.get('lastSnapshotStatus')=='completed' and v.get('snapshotAvailable') and v.get('stop',{}).get('status')=='completed':break
   time.sleep(2)
  else:raise RuntimeError('actual snapshot-stop not verified')
  save('lifecycle-proof.json',dict(sandbox=v,originalExpiry=A['expiry'],shutdownDelegated=True))
  if watch:watch.wait(timeout=25);save('watchdog-completed.json',dict(pid=watch.pid,exit=watch.returncode,verifiedStop=True))
 print(json.dumps(dict(box=A['id'] if A else None,stopped=(E/'lifecycle-proof.json').exists(),failure=(E/'first-failure.json').exists())))
