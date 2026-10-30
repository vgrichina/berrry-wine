from control import *
import base64,concurrent.futures,threading,datetime,tarfile,traceback
A=None;watch=None;lock=threading.Lock();journal=[]
REMOTE='/home/user/gltron-render'
def epoch(s):return datetime.datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()
def api(code,label,timeout=30,cwd='/home/user',record=True):
 assert A and time.time()<A['shutdownEpoch']
 argv=[B,'--no-update','--json','exec','--cwd',cwd,'--timeout',str(timeout),A['id'],'--','/usr/bin/python3','-B','-c',code]
 assert sum(len(x.encode())+1 for x in argv)+1024<=16384
 assert not (E/(label+'.json')).exists(),label
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
def collect():
 names=['build-identity.json','eager-input-verification.json','retained-input-verification.json','data-complete-preflight.json','data-complete-result.json','data-complete-guest.json','data-complete-guest.stdout.log','data-complete-guest.stderr.log','data-complete-startup-256.json','data-complete-startup-256.stdout.log','data-complete-startup-512.json','data-complete-startup-512.stdout.log','data-complete-input-preflight.json','data-complete-input-preflight.stdout.log','data-complete-input-preflight.stderr.log','data-complete-png-smoke.json','data-complete-png-smoke.stdout.log','capture/original.png']
 manifest=json.loads(api('import pathlib,json,hashlib;names='+repr(names)+';r={n:dict(bytes=pathlib.Path(n).stat().st_size,sha256=hashlib.sha256(pathlib.Path(n).read_bytes()).hexdigest()) for n in names if pathlib.Path(n).is_file()};print(json.dumps(r))','retrieval-manifest',cwd=REMOTE));save('retrieval-manifest.json',manifest)
 assert sum(w['bytes'] for w in manifest.values())<2*M
 for n,w in manifest.items():
  cap=300000 if n.endswith('.png') else 8192 if n.endswith('.log') else 196608;assert w['bytes']<=cap
  parts=[]
  for off in range(0,w['bytes'],6000):
   s=api('import pathlib,base64;f=pathlib.Path('+repr(n)+').open("rb");f.seek('+str(off)+');print(base64.b64encode(f.read(6000)).decode())','retrieve-'+n.replace('/','_')+'-'+str(off),cwd=REMOTE,record=False);parts.append(base64.b64decode(s.strip(),validate=True))
  b=b''.join(parts);assert pin(b)==w;dst=E/'retrieved'/n;dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes(b)
try:
 box='bx_hk4f9tde';info=json.loads((E/'created-info.stdout').read_text())['sandbox']
 assert info['id']==box and info['state']=='idle' and info['ttlSeconds']==1800
 save('state-check-correction.json',dict(originalFailure='first-failure.json',supportedReadyEvent=True,observedInfoState='idle',APIExecsBeforeCorrection=0,reusedSameFork=True))
 now=epoch(info['createdAt']);assert epoch(info['archiveAfter'])-now<=1801
 A=dict(id=box,source='bx_auex6kaq',createdAt=info['createdAt'],createdEpoch=now,expiry=info['archiveAfter'],cutoffEpoch=now+1200,retrieveEpoch=now+1320,handbackEpoch=now+1380,shutdownEpoch=now+1500,shutdownDelegated=True,remoteRoot=REMOTE)
 save('boat-assignment.json',A)
 out=(E/'watchdog.stdout').open('wb');err=(E/'watchdog.stderr').open('wb');watch=subprocess.Popen(['/usr/bin/python3','-B',str(R/'watchdog.py')],cwd=R,stdout=out,stderr=err,start_new_session=True);assert watch.poll() is None;save('watchdog-armed.json',dict(pid=watch.pid,box=box,deadline=A['shutdownEpoch'],beforeFirstAPIExec=True,allPaths=True,deadlineOrigin='supported info.createdAt'))
 raw=b'gltron-data-complete-transfer-smoke'
 smoke=api('import pathlib,base64,hashlib,json,resource,os;b=base64.b64decode('+repr(base64.b64encode(raw).decode())+');p=pathlib.Path("/home/user/gltron-data-complete-smoke");p.write_bytes(b);assert p.read_bytes()==b;p.unlink();print(json.dumps(dict(sha256=hashlib.sha256(b).hexdigest(),node=os.path.exists("/usr/bin/node"),limits={n:resource.getrlimit(getattr(resource,n)) for n in ["RLIMIT_DATA","RLIMIT_AS","RLIMIT_FSIZE"]})))','explicit-boat-smoke');assert json.loads(smoke)['sha256']==pin(raw)['sha256']
 code='''import pathlib,json,hashlib
r=pathlib.Path('/home/user/gltron-render')
def pin(p):
 b=p.read_bytes();return dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
p=json.loads((r/'pins.json').read_text());assert p['candidate']=='311c42abb41adc1fc16e06b4276005d15db553b2'
for n,w in p['files'].items():assert pin(r/n)==w,n
expected=EXPECTED
for n,w in expected.items():assert pin(r/n)==w,n
conf=json.loads((r/'launch-configuration.json').read_text())['configuration'];assert len(conf['files'])==92
for f in conf['files']:assert pin(r/f['url'])==dict(bytes=f['size'],sha256=f['sha256'])
v=dict(PASS=True,production=p['candidate'],sourceFiles=len(p['files']),modules=expected,originalFiles=len(conf['files']),originalBytes=sum(f['size'] for f in conf['files']));(r/'retained-input-verification.json').write_text(json.dumps(v));print(json.dumps(v))
'''.replace('EXPECTED',repr(json.loads(pathlib.Path('/tmp/gltron-original-main-render-runtime-oct30/evidence/retrieved/build-identity.json').read_text())['modules']))
 api(code,'retained-input-verification',timeout=40,cwd=REMOTE)
 save('assignment-for-transfer.json',A);admission('transfer-forecast')
 items=[(R/'eager-runtime-data.tar.xz','eager-runtime-data.tar.xz'),(R/'runtime-data-manifest.json','runtime-data-manifest.json'),(R/'remote-controller.py','data-complete-controller.py'),(R/'preflight.js','data-complete-preflight.js'),(E/'assignment-for-transfer.json','data-complete-assignment.json')]
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:transferred=list(pool.map(lambda x:transfer(*x),items))
 save('transfer-receipt.json',dict(files=transferred,maxRawChunk=6000,requestResponseLimit=16384,largeSourceMediaTransfers=0))
 code='''import pathlib,json,hashlib,tarfile
r=pathlib.Path('/home/user/gltron-render')
def pin(p):
 b=p.read_bytes();return dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
for f in EXPECTED:assert pin(r/f['path'])=={k:f[k] for k in ['bytes','sha256']}
m=json.loads((r/'runtime-data-manifest.json').read_text());assert m['source']=='c1af564002d53e7eafa4e6f0ad61e6578cfff12d'
with tarfile.open(r/'eager-runtime-data.tar.xz') as t:
 ms=t.getmembers();assert set(x.name for x in ms)==set(m['files']) and len(ms)==len(m['files'])
 for x in ms:
  assert x.isfile() and not pathlib.PurePosixPath(x.name).is_absolute() and '..' not in pathlib.PurePosixPath(x.name).parts
  b=t.extractfile(x).read();assert dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())==m['files'][x.name]
  if (r/x.name).exists():assert pin(r/x.name)==m['files'][x.name]
 t.extractall(r,filter='data')
for n,w in m['files'].items():assert pin(r/n)==w,n
print(json.dumps(dict(PASS=True,members=len(ms),archive=pin(r/'eager-runtime-data.tar.xz'))))
'''.replace('EXPECTED',repr(transferred))
 api(code,'runtime-data-restore',timeout=40,cwd=REMOTE)
 api('import runpy,sys;sys.argv=["data-complete-controller.py","preflight"];runpy.run_path("data-complete-controller.py",run_name="__main__")','remote-preflight',timeout=90,cwd=REMOTE)
 admission('guest-forecast');assert time.time()<A['cutoffEpoch'];(E/'one-guest-invocation.lock').open('x').write(str(time.time()))
 api('import runpy,sys;sys.argv=["data-complete-controller.py","guest"];runpy.run_path("data-complete-controller.py",run_name="__main__")','remote-guest',timeout=110,cwd=REMOTE)
except BaseException as ex:
 save('runtime-failure.json',dict(error=repr(ex),traceback=traceback.format_exc(),at=time.time()))
finally:
 save('api-transfer-journal.json',journal)
 if A:
  try:
   if time.time()<A.get('retrieveEpoch',0):collect()
  except BaseException as ex:save('retrieval-failure.json',dict(error=repr(ex),traceback=traceback.format_exc()))
  finally:
   save('api-transfer-journal.json',journal)
   native(['stop',A['id']],'snapshot-stop',wall=100)
   for n in range(8):
    v=native(['info',A['id']],'final-info-'+str(n))[-1]['sandbox']
    if v['state']=='stopped' and v.get('lastSnapshotStatus')=='completed' and v.get('snapshotAvailable') and v.get('stop',{}).get('status')=='completed':break
    time.sleep(2)
   else:raise RuntimeError('actual snapshot-stop not verified')
   save('lifecycle-proof.json',dict(sandbox=v,originalExpiry=A['expiry'],shutdownDelegated=True))
   if watch:watch.wait(timeout=25);save('watchdog-completed.json',dict(pid=watch.pid,exit=watch.returncode,verifiedStop=True))
 print(json.dumps(dict(box=A['id'] if A else None,stopped=(E/'lifecycle-proof.json').exists(),failure=(E/'first-failure.json').exists())))
