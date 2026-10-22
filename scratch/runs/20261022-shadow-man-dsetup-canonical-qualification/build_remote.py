import datetime, hashlib, json, os, signal, subprocess, time
from pathlib import Path
R=Path('/home/user/shadow-man-dsetup-canonical-qualification-oct22'); E=R/'evidence'
C='7a21579f9adb208164312961c249a0aa9080a8b7'; B='89f1e9d2c67aa94d56d2319115589d07204d42e0'
os.chdir(R)
env=dict(os.environ,GIT_NO_LAZY_FETCH='1')
for key in ['NODE_OPTIONS','NODE_PATH','WINE_REGION_MAP','WINE_REGION_SHAKE','WINE_WAT_NAMES','WINE_WAT_COMPILER']:
    env.pop(key,None)
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def resource():
    return dict(allocated=int(subprocess.check_output(['du','-s','-B1',str(R)]).split()[0]),free=os.statvfs(R).f_bavail*os.statvfs(R).f_frsize)
def admit():
    d=resource();assert d['allocated']+67108864+268435456<1073741824 and d['free']>2147483648+268435456;return d
assert not (E/'build-attempt.json').exists(), 'one attempt only'
assert subprocess.check_output(['git','rev-parse','HEAD'],env=env).decode().strip()==C
assert subprocess.check_output(['git','rev-parse','HEAD^'],env=env).decode().strip()==B
manifest=json.loads((E/'build-inputs.json').read_text())
for r in manifest['inputs']:
    p=R/r['path']; assert sha(p)==r['sha256'] and p.stat().st_mode&0o777==int(r['mode'],8)&0o777,r['path']
assert not list((R/'build').glob('*.wasm'))
pre=admit()
with (E/'api-main-preflight.log').open('wb') as log:
    cmd=['node','tools/check-api-table.js','--base='+B]
    t=now();p=subprocess.run(cmd,stdout=log,stderr=subprocess.STDOUT,env=env,timeout=30)
api=dict(command=cmd,cwd=str(R),startedAt=t,finishedAt=now(),exit=p.returncode)
(E/'api-main-preflight.json').write_text(json.dumps(api,indent=2)+'\n')
assert p.returncode==0
assert 'index check only' not in (E/'api-main-preflight.log').read_text()
assert 'no '+B+' copy' not in (E/'api-main-preflight.log').read_text()
assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime(2026,10,22,22,15,tzinfo=datetime.timezone.utc)
attempt=dict(command=['bash','tools/build.sh'],cwd=str(R),source=C,parent=B,main=B,attempt=1,startedAt=now(),environment={k:env.get(k) for k in ['PATH','NODE_PATH','NODE_OPTIONS','GIT_NO_LAZY_FETCH','WINE_REGION_MAP','WINE_REGION_SHAKE','WINE_WAT_NAMES','WINE_WAT_COMPILER']},resourcesBefore=pre)
(E/'build-attempt.json').write_text(json.dumps(attempt,indent=2)+'\n')
start=time.monotonic(); peak=pre['allocated'];reason=None
with (E/'canonical-build.log').open('wb') as log:
    p=subprocess.Popen(['bash','tools/build.sh'],stdout=log,stderr=subprocess.STDOUT,env=env,start_new_session=True)
    while p.poll() is None:
        d=resource();peak=max(peak,d['allocated'])
        if d['allocated']+67108864>=1073741824 or d['free']<2147483648 or time.monotonic()-start>540:
            reason='resource/deadline guard';os.killpg(p.pid,signal.SIGTERM);break
        time.sleep(1)
    code=p.wait(timeout=10)
attempt.update(exit=code,finishedAt=now(),seconds=time.monotonic()-start,sampledPeakAllocation=peak,guard=reason,resourcesAfter=resource(),logSHA256=sha(E/'canonical-build.log'))
mods=[]
for path in (R/'build').glob('*'):
    if path.is_file():mods.append(dict(path=str(path.relative_to(R)),bytes=path.stat().st_size,sha256=sha(path)))
attempt['outputs']=mods
changed=[r['path'] for r in manifest['inputs'] if sha(R/r['path'])!=r['sha256']]
attempt['changedTrackedInputs']=changed
(E/'build-attempt.json').write_text(json.dumps(attempt,indent=2)+'\n')
print(json.dumps(attempt,indent=2));print((E/'canonical-build.log').read_text()[-9000:])
assert not changed
# A failed build ends qualification. No fallback compiler, regeneration or retry.
