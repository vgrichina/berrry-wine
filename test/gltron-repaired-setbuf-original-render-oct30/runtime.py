from control import *
import api,datetime,concurrent.futures,traceback,base64
REMOTE=api.REMOTE
A=None;watch=None

def invoke(mode):
 return api.api('import runpy,sys;sys.argv=["repaired-setbuf-controller.py",'+repr(mode)+'];runpy.run_path("repaired-setbuf-controller.py",run_name="__main__")','remote-'+mode,timeout=110,cwd=REMOTE)

def collect():
 names=['repaired-setbuf-build.json','repaired-setbuf-compile.json','repaired-setbuf-compile.stdout.log','repaired-setbuf-compile.stderr.log','repaired-setbuf-inputs.json','repaired-setbuf-preflight.json','repaired-setbuf-result.json','repaired-setbuf-guest.json','repaired-setbuf-guest.stdout.log','repaired-setbuf-guest.stderr.log','repaired-setbuf-compile-startup.json','repaired-setbuf-compile-startup.stdout.log','repaired-setbuf-startup-256.stdout.log','repaired-setbuf-startup-512.stdout.log','repaired-setbuf-input-preflight.stdout.log','repaired-setbuf-input-preflight.stderr.log','capture/original.png']
 manifest=json.loads(api.api('import pathlib,json,hashlib;names='+repr(names)+';print(json.dumps({n:dict(bytes=pathlib.Path(n).stat().st_size,sha256=hashlib.sha256(pathlib.Path(n).read_bytes()).hexdigest()) for n in names if pathlib.Path(n).is_file()}))','retrieval-manifest',cwd=REMOTE));save('retrieval-manifest.json',manifest)
 assert sum(v['bytes'] for v in manifest.values())<M
 for n,w in manifest.items():
  assert w['bytes']<=(300000 if n.endswith('.png') else 8192 if n.endswith('.log') else 196608)
  parts=[]
  for off in range(0,w['bytes'],6000):
   b=api.api('import pathlib,base64;f=pathlib.Path('+repr(n)+').open("rb");f.seek('+str(off)+');print(base64.b64encode(f.read(6000)).decode())','retrieve-'+n.replace('/','_')+'-'+str(off),cwd=REMOTE,record=False);parts.append(base64.b64decode(b.strip(),validate=True))
  b=b''.join(parts);assert pin(b)==w;p=E/'retrieved'/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
try:
 admission('provision-forecast')
 source=native(['info','bx_qbjcabve'],'fork-source')[-1]['sandbox'];assert source['state']=='stopped' and source['snapshotCompletedAt']=='2026-10-30T13:24:48.381Z' and source['snapshotAvailable']
 created=native(['fork','--ttl','1800','--no-env','--wait','bx_qbjcabve'],'create-fork',wall=100)
 box=next(v['id'] for v in created if v.get('event')=='created')
 info=native(['info',box],'created-info')[-1]['sandbox'];assert info['state'] in ['running','idle'] and info['ttlSeconds']==1800
 now=api.epoch(info['createdAt']);assert api.epoch(info['archiveAfter'])-now<=1801
 A=dict(id=box,source='bx_qbjcabve',createdAt=info['createdAt'],createdEpoch=now,expiry=info['archiveAfter'],cutoffEpoch=now+1200,retrieveEpoch=now+1320,handbackEpoch=now+1380,shutdownEpoch=now+1500,shutdownDelegated=True,remoteRoot=REMOTE)
 api.A=A;save('boat-assignment.json',A)
 watch=subprocess.Popen(['/usr/bin/python3','-B',str(R/'watchdog.py')],cwd=R,stdout=(E/'watchdog.stdout').open('wb'),stderr=(E/'watchdog.stderr').open('wb'),start_new_session=True)
 assert watch.poll() is None;save('watchdog-armed.json',dict(pid=watch.pid,box=box,deadline=A['shutdownEpoch'],beforeFirstAPIExec=True,allPaths=True))
 raw=b'gltron-setbuf-original-transfer-smoke'
 s=api.api('import pathlib,hashlib,json;base='+repr(raw)+';p=pathlib.Path("/home/user/setbuf-smoke");p.write_bytes(base);assert p.read_bytes()==base;p.unlink();print(json.dumps(dict(sha256=hashlib.sha256(base).hexdigest())))','explicit-boat-smoke');assert json.loads(s)['sha256']==pin(raw)['sha256']
 # All pinned original inputs, runner and eager data already retained; no archive restaging.
 code='''import pathlib,json,hashlib
r=pathlib.Path('/home/user/gltron-render')
def pin(p):
 b=p.read_bytes();return dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
p=json.loads((r/'pins.json').read_text());assert p['candidate']=='311c42abb41adc1fc16e06b4276005d15db553b2'
for n,w in p['files'].items():assert pin(r/n)==w,n
for manifest in ['runner-closure-manifest.json','runtime-data-manifest.json']:
 for n,w in json.loads((r/manifest).read_text())['files'].items():assert pin(r/n)==w,n
expected=EXPECTED
for n,w in expected.items():assert pin(r/n)==w,n
c=json.loads((r/'launch-configuration.json').read_text())['configuration'];assert len(c['files'])==92
for f in c['files']:assert pin(r/f['url'])==dict(bytes=f['size'],sha256=f['sha256']),f['url']
print(json.dumps(dict(PASS=True,sourceFiles=len(p['files']),runnerFiles=105,eagerFiles=27,originalFiles=92,modules=expected)))
'''.replace('EXPECTED',repr(json.loads(pathlib.Path('/tmp/gltron-runner-closure-original-render-oct30/completion-receipt.json').read_text())['moduleHashes']))
 api.api(code,'retained-inputs',timeout=40,cwd=REMOTE)
 (E/'assignment-transfer.json').write_text(json.dumps(A));admission('transfer-forecast')
 items=[(R/'crt-delta.xz','repaired-setbuf-crt.xz'),(R/'remote-controller.py','repaired-setbuf-controller.py'),(R/'preflight.js','repaired-setbuf-preflight.js'),(E/'assignment-transfer.json','repaired-setbuf-assignment.json')]
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:transferred=list(pool.map(lambda x:api.transfer(*x),items))
 save('transfer-receipt.json',dict(files=transferred,maxRawChunk=6000,requestResponseLimit=16384,fullSourceMediaTransfers=0))
 code='''import pathlib,json,hashlib,lzma,os
r=pathlib.Path('/home/user/gltron-render')
def pin(p):
 b=p.read_bytes();return dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
for f in EXPECTED:assert pin(r/f['path'])=={k:f[k] for k in ['bytes','sha256']}
b=lzma.decompress((r/'repaired-setbuf-crt.xz').read_bytes());w=CRT;assert dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())==w
p=r/'src/09a6-handlers-crt.wat';tmp=p.with_suffix('.task-new');tmp.write_bytes(b);os.replace(tmp,p);assert pin(p)==w
pins=json.loads((r/'pins.json').read_text());pins['files']['src/09a6-handlers-crt.wat']=w
for n,v in pins['files'].items():assert pin(r/n)==v,n
v=dict(PASS=True,parent='16627061ccc5f151fbe568178471b3076f37cf42',onlyCompileSourceChanged='src/09a6-handlers-crt.wat',crt=w,sourceFiles=len(pins['files']),sourceManifestSHA=pin(r/'pins.json'),allOtherInputsUnchanged=True)
(r/'repaired-setbuf-inputs.json').write_text(json.dumps(v));print(json.dumps(v))
'''.replace('EXPECTED',repr(transferred)).replace('CRT',repr(json.loads((E/'source-boundary.json').read_text())['crt']))
 api.api(code,'apply-exact-crt',timeout=40,cwd=REMOTE)
 assert time.time()<A['cutoffEpoch'];invoke('compile');invoke('preflight')
 admission('guest-forecast');assert time.time()<A['cutoffEpoch'];(E/'one-guest-invocation.lock').open('x').write(str(time.time()));invoke('guest')
except BaseException as ex:save('first-failure.json',dict(error=repr(ex),traceback=traceback.format_exc(),at=time.time()))
finally:
 save('api-transfer-journal.json',api.journal)
 if A:
  try:
   if time.time()<A['retrieveEpoch']:collect()
  except BaseException as ex:save('retrieval-failure.json',dict(error=repr(ex),traceback=traceback.format_exc()))
  finally:
   save('api-transfer-journal.json',api.journal)
   native(['stop',A['id']],'snapshot-stop',wall=100)
   for n in range(16):
    v=native(['info',A['id']],'final-info-'+str(n))[-1]['sandbox']
    if v['state']=='stopped' and v.get('snapshotAvailable') and v.get('lastSnapshotStatus')=='completed' and v.get('stop',{}).get('status')=='completed':break
    time.sleep(2)
   else:raise RuntimeError('actual snapshot-stop not verified')
   save('lifecycle-proof.json',dict(sandbox=v,originalExpiry=A['expiry'],shutdownDelegated=True))
   if watch:watch.wait(timeout=25);save('watchdog-completed.json',dict(pid=watch.pid,exit=watch.returncode,verifiedStop=True))
 print(json.dumps(dict(box=A['id'] if A else None,stopped=(E/'lifecycle-proof.json').exists(),failure=(E/'first-failure.json').exists())))
