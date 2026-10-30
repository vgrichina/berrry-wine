from supervisor import *
from objects import pin
import base64,datetime,hashlib,traceback
assert json.loads((E/'preflight.json').read_text())['PASS']
assert json.loads((E/'fixture-preflight.json').read_text())['PASS']
assert not (E/'boat-assignment.json').exists()
B='/home/user/.ascii/boat';A=None
def events(b):return [json.loads(l) for l in b.decode().splitlines()]
def native(args,label,timeout=30):return run([B,'--no-update','--json',*args],cwd=E,label=label,native=True,timeout=timeout)
def info(label):return events(native(['info',A['id']],label))[-1]['sandbox']
def api(code,label,timeout=20,cwd='/tmp'):
    assert time.time()<A['shutdownEpoch']
    code="import os;assert os.getcwd()=="+repr(cwd)+";"+code
    assert sum(len(x.encode())+1 for x in [code])+1024<=16384
    v=events(native(['exec','--cwd',cwd,'--timeout',str(timeout),A['id'],'--','/usr/bin/python3','-B','-c',code],label,min(timeout+10,90)))[-1]
    assert v.get('success') is True and v.get('exitCode')==0 and not v.get('stdoutTruncated') and not v.get('stderrTruncated'),v
    return v
def epoch(v):return datetime.datetime.fromisoformat(v.replace('Z','+00:00')).timestamp()
try:
    run([B,'--no-update','--version'],cwd=E,label='native-startup',native=True)
    created=events(native(['new','--ttl','1800','--no-env','--name','toyvm-sticky-enospc-oct30'],'provision',90))
    box=next(v['id'] for v in created if v.get('event')=='created');assert box.startswith('bx_')
    ready=next(v for v in created if v.get('event')=='ready')
    # Persist explicit new identity immediately; never self/current or old Boat.
    expiry=ready['archiveAfter'];now=time.time();expires=epoch(expiry)
    A=dict(id=box,expiry=expiry,createdEpoch=now,cutoffEpoch=min(now+1200,expires),handbackEpoch=min(now+1380,expires),shutdownEpoch=min(now+1500,expires),shutdownDelegated=True,lifecycleOwner='coordinator delegates snapshot-stop on all completion/blocker paths',remoteBudget=256*M,reserve=8*M)
    (E/'boat-assignment.json').write_text(json.dumps(A,indent=2))
    initial=info('initial-info');createdEpoch=epoch(initial['createdAt'])
    A.update(createdAt=initial['createdAt'],createdEpoch=createdEpoch,cutoffEpoch=min(createdEpoch+1200,expires),handbackEpoch=min(createdEpoch+1380,expires),shutdownEpoch=min(createdEpoch+1500,expires))
    (E/'boat-assignment.json').write_text(json.dumps(A,indent=2))
    watchout=(E/'watchdog.stdout').open('wb');watcherr=(E/'watchdog.stderr').open('wb')
    watchdog=subprocess.Popen(['/usr/bin/python3','-B',str(ROOT/'watchdog.py')],cwd=ROOT,stdout=watchout,stderr=watcherr,start_new_session=True,env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1'))
    (E/'watchdog-armed.json').write_text(json.dumps(dict(pid=watchdog.pid,deadline=A['shutdownEpoch'],box=A['id'],owner='delegated worker',armed=True)))
    smoke=b'explicit-new-boat-api-transfer-capture-smoke';assert len(smoke)<=16384
    code="import pathlib,base64,hashlib,json,resource;p=pathlib.Path('/tmp/tvsa-smoke');b=base64.b64decode("+repr(base64.b64encode(smoke).decode())+");p.write_bytes(b);assert p.read_bytes()==b;print(json.dumps(dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),limits={n:resource.getrlimit(getattr(resource,n)) for n in ['RLIMIT_DATA','RLIMIT_AS','RLIMIT_CPU','RLIMIT_FSIZE']})));p.unlink()"
    v=api(code,'explicit-api-smoke');assert json.loads(v['stdout'])['sha256']==hashlib.sha256(smoke).hexdigest()
    (E/'smoke-receipt.json').write_text(json.dumps(dict(PASS=True,box=box,bytes=len(smoke),smoke=v,ordering='create explicit new ID; API smoke; then transfer/guest')))
    S=E/'stage';manifest=json.loads((E/'runtime-manifest-base.json').read_text());manifest['cutoffEpoch']=A['cutoffEpoch'];(S/'manifest.json').write_text(json.dumps(manifest))
    files=sorted(p for p in S.rglob('*') if p.is_file());total=sum(p.stat().st_size for p in files);assert total+8*M<=256*M
    expected={p.relative_to(S).as_posix():pin(p.read_bytes()) for p in files};chunks=0
    for i,p in enumerate(files):
        rel=p.relative_to(S).as_posix();data=p.read_bytes()
        for off in range(0,len(data),8000):
            raw=data[off:off+8000]
            code="import pathlib,base64,hashlib;p=pathlib.Path("+repr('/tmp/tvsa-stage/'+rel)+");p.parent.mkdir(parents=True,exist_ok=True);b=base64.b64decode("+repr(base64.b64encode(raw).decode())+");f=p.open("+repr('wb' if off==0 else 'ab')+");f.write(b);f.close();assert p.stat().st_size=="+str(off+len(raw))
            if off+len(raw)==len(data):code+=';assert hashlib.sha256(p.read_bytes()).hexdigest()=='+repr(hashlib.sha256(data).hexdigest())
            api(code,f'transfer-{i}-{off}');chunks+=1
    code="import pathlib,hashlib,json;r=pathlib.Path('/tmp/tvsa-stage');expected="+repr(expected)+";actual={p:dict(bytes=(r/p).stat().st_size,sha256=hashlib.sha256((r/p).read_bytes()).hexdigest()) for p in expected};assert actual==expected;print(json.dumps(dict(PASS=True,files=len(actual),bytes=sum(v['bytes'] for v in actual.values()))))"
    api(code,'remote-hash-verification')
    (E/'transfer-receipt.json').write_text(json.dumps(dict(PASS=True,box=box,expected=expected,chunks=chunks,maxRawChunk=8000,totalBytes=total,remoteHashesVerified=True)))
    for mode in ['preflight','guards']:
        if mode=='guards':
            assert time.time()<A['cutoffEpoch']
            with (E/'one-production-invocation.lock').open('x') as f:f.write(str(time.time()))
        code="import runpy,sys;sys.argv=['/tmp/tvsa-stage/observer.py',"+repr(mode)+"];runpy.run_path(sys.argv[0],run_name='__main__')"
        api(code,'remote-'+mode,80 if mode=='guards' else 20,cwd='/tmp/tvsa-stage')
        v=api("import pathlib;p=pathlib.Path('/tmp/tvsa-stage/"+mode+".json');assert p.stat().st_size<=524288;print(p.read_text())",'capture-'+mode,cwd='/tmp/tvsa-stage')
        (E/('runtime-'+mode+'.json')).write_text(json.dumps(json.loads(v['stdout']),indent=2))
    r=json.loads((E/'runtime-guards.json').read_text())
    print(json.dumps(dict(box=box,exit=r['exit'],steps=[s['step'] for s in r.get('syscalls',[])],reportAccepted=r.get('report',{}).get('accepted'),filesystem=r.get('report',{}).get('backendReceipt',{}).get('filesystem'))))
except BaseException as ex:
    (E/'runtime-error.json').write_text(json.dumps(dict(error=repr(ex),traceback=traceback.format_exc())))
    raise
finally:
    if A:
        # Even capture/publication failure must never leave the allocated Boat.
        try:
            code="""import pathlib,os,json,subprocess,signal,time
root='/tmp/tvsa';mounts=[l for l in pathlib.Path('/proc/self/mountinfo').read_text().splitlines() if root+'/domain' in l]
if mounts:subprocess.run(['/usr/bin/fusermount3','-u','--',root+'/domain'],capture_output=True,timeout=5,check=True,cwd='/tmp')
processes=[]
for f in pathlib.Path('/proc').glob('[0-9]*/cmdline'):
 try:
  if int(f.parent.name)!=os.getpid() and any(a==root.encode() or a.startswith((root+'/').encode()) for a in f.read_bytes().split(b'\\0')):processes.append(int(f.parent.name))
 except OSError:pass
for pid in processes:
 try:os.kill(pid,signal.SIGTERM)
 except ProcessLookupError:pass
time.sleep(.1)
remaining=[pid for pid in processes if pathlib.Path('/proc/'+str(pid)).exists()]
assert not remaining,remaining
mounts=[l for l in pathlib.Path('/proc/self/mountinfo').read_text().splitlines() if root+'/domain' in l]
assert not mounts
seen=set();allocated=0
for r in [pathlib.Path('/tmp/tvsa-stage'),pathlib.Path(root)]:
 if r.exists():
  for p in [r,*r.rglob('*')]:
   s=p.lstat();key=(s.st_dev,s.st_ino)
   if key not in seen:seen.add(key);allocated+=s.st_blocks*512
assert allocated+8388608<=268435456
print(json.dumps(dict(PASS=True,remainingMounts=mounts,processes=remaining,reaped=processes,physicalAllocated=allocated,budget=268435456,reserve=8388608)))
"""
            v=api(code,'final-cleanup');(E/'remote-allocation-cleanup.json').write_text(v['stdout'])
        except BaseException as ex:(E/'cleanup-error.json').write_text(json.dumps(dict(error=repr(ex))))
        native(['stop',A['id']],'snapshot-stop',90)
        for n in range(8):
            final=info('final-info-'+str(n))
            if final['state']=='stopped' and final.get('lastSnapshotStatus')=='completed' and final.get('snapshotAvailable') and final.get('stop',{}).get('status')=='completed':break
            time.sleep(2)
        assert final['state']=='stopped' and final['lastSnapshotStatus']=='completed' and final['snapshotAvailable'] and final['stop']['status']=='completed',final
        lifecycle={k:final.get(k) for k in ['id','state','createdAt','stoppedAt','snapshotCompletedAt','snapshotVerifiedAt','lastSnapshotStatus','snapshotAvailable','stop']};lifecycle.update(originalExpiry=A['expiry'],shutdownDelegated=True)
        (E/'lifecycle-proof.json').write_text(json.dumps(lifecycle,indent=2))
        print(json.dumps(dict(snapshotStopped=True,lifecycle=lifecycle)))
        if 'watchdog' in globals():
            watchdog.terminate();watchdog.wait(timeout=5);watchout.close();watcherr.close()
            (E/'watchdog-disarmed.json').write_text(json.dumps(dict(pid=watchdog.pid,reason='actual stopped/completed snapshot verified')))

