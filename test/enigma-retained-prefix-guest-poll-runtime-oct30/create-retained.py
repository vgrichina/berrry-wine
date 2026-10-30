from pathlib import Path
r=Path(__file__).parent
out=r/'retained-prefix'
for p in [out,out/'e',out/'raw',out/'images']:p.mkdir(exist_ok=True)
s=(r/'small_transfer_ops.py').read_text().replace("small-transfer/e","retained-prefix/e")
a=s.index('def admission():');b=s.index('\ndef check_evidence',a)
s=s[:a]+'''WATCH=PathDummy=None
CACHE=None
LAUNCH=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/enigma-retained-prefix-guest-poll-runtime-oct30')
ROOTS=[ROOT,pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/enigma-guest-poll-causal-runtime-oct30'),pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/enigma-compact-causal-runtime-owner133-oct30'),pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/enigma-start-game-causal-repair-owner133-oct30'),LAUNCH]
def physical(p):
 return p.lstat().st_blocks*512+sum(x.lstat().st_blocks*512 for x in p.rglob('*')) if p.exists() else 0
def identity(p):
 s=p.stat();return (s.st_dev,s.st_ino,s.st_size,s.st_mtime_ns,s.st_ctime_ns)
def establish():
 global CACHE
 active=ROOT/'retained-prefix'
 pins=[ROOT/'archive.json',ROOT/'transfer-manifest.json',ROOT/'mount-enumeration.json']+[ROOT/x for x in json.loads((ROOT/'archive.json').read_text())['parts']]
 CACHE=dict(fixed=sum(physical(p) for p in ROOTS)-physical(active)-physical(LAUNCH),pins={str(p):identity(p) for p in pins},at=time.time())
 return CACHE
def admission():
 global CACHE
 if CACHE is None:establish()
 assert all(identity(pathlib.Path(p))==v for p,v in CACHE['pins'].items()),'fixed archive/manifest identity changed'
 st=os.statvfs(ROOT);mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 allocated=CACHE['fixed']+physical(ROOT/'retained-prefix')+physical(LAUNCH)
 sample=dict(at=time.time(),free=st.f_bavail*st.f_frsize,MemAvailable=mem,allocated=allocated,aggregateRemaining=200183808,memoryPolicy='observational only; owner 2026-10-30',accounting='fixed roots at verified exclusive boundary plus current owned outputs and launcher logs')
 sample['checks']=dict(disk=sample['free']-200183808>=1610612736,allocation=allocated+8*1048576<=64*1048576)
 if not all(sample['checks'].values()):
  with (E/'first-denial.json').open('x') as f:json.dump(sample,f)
  raise RuntimeError(('first genuine denial',sample))
 (E/'latest-admission.json').write_text(json.dumps(sample));return sample
''' +s[b:]
(r/'retained_ops.py').write_text(s)
s=(r/'small_transfer_gate.py').read_text().replace('small_transfer_ops','retained_ops').replace("/'small-transfer'","/'retained-prefix'")
(r/'retained_gate.py').write_text(s)
s=(r/'small-transfer-runtime-v2.py').read_text().replace('small_transfer_gate','retained_gate')
s=s.replace("native=ops.subprocess.Popen\ndef admitted(*a,**kw):gate.admission();return native(*a,**kw)\nops.subprocess.Popen=admitted","native=ops.subprocess.Popen")
# Every operation has distinct capture names, including control/collection.
s=s.replace('def call(name,args,wall=90,compact=False):','SEQ=0\ndef call(name,args,wall=90,compact=False):\n global SEQ\n SEQ+=1;name="%04d-%s"%(SEQ,name)')
a=s.index('def setup():');b=s.index('\ndef stage',a)
s=s[:a]+'''def setup():
 assert (O/'preflight.json').exists() and not (O/'boat-created.json').exists()
 v=call('lifecycle-info',[B,'--no-update','--json','info','bx_w72496sc'])
 box=v.get('sandbox',v)
 assert box['state']=='stopped' and box['snapshotVerifiedAt']=='2026-10-30T07:14:38.646Z',('unexpected state',box)
 # Arm independent lifecycle guard before resume, including uncertain resume failure.
 save('boat-created.json',dict(id='bx_w72496sc'))
 now=time.time()
 save('schedule.json',dict(id='bx_w72496sc',armedEpoch=now,absoluteCutoffEpoch=now+1200,handbackEpoch=now+960,shutdownEpoch=now+1080,shutdownDelegated=True))
 pid=os.fork()
 if pid==0:os.setsid();watchdog();os._exit(0)
 save('watchdog.json',dict(pid=pid,at=utc()))
 v=call('resume',[B,'--no-update','--json','resume','bx_w72496sc'])
 save('resume.json',v)
 v=call('resumed-info',[B,'--no-update','--json','info','bx_w72496sc'])
 box=v.get('sandbox',v);assert box['state'] in ('running','ready'),box
 expiry=datetime.datetime.fromisoformat(box['archiveAfter'].replace('Z','+00:00')).timestamp()
 d=json.loads((O/'schedule.json').read_text());d.update(liveExpiry=box['archiveAfter'],resumedAt=utc(),shutdownEpoch=min(d['shutdownEpoch'],expiry-30),absoluteCutoffEpoch=min(d['absoluteCutoffEpoch'],expiry))
 save('schedule.json',d);save('boat-assignment.json',box)
 assert time.time()+180<d['shutdownEpoch'],'insufficient live lifetime'
 return json.loads((R/'archive.json').read_text())
''' +s[b:]
s=s.replace("d=json.loads((O/'schedule.json').read_text())\n while time.time()<d['shutdownEpoch']:","d=json.loads((O/'schedule.json').read_text())\n while time.time()<d['shutdownEpoch']:\n  d=json.loads((O/'schedule.json').read_text())")
a=s.index('def transfer(a):');b=s.index('def collect():',a)
s=s[:a]+'''PREFIX=13156352
PREFIX_SHA='1600f60cdbf1733d0f88ee0592fa31e642dc607ffa7bfc933a6d95e3a1b4696f'
def transfer(a):
 startCPU=time.process_time()
 v=json.loads(remote('prefix-smoke',"import pathlib,hashlib,json; p=pathlib.Path('/home/user/enigma-original.tar.gz'); print(json.dumps(dict(offset=p.stat().st_size,sha256=hashlib.file_digest(p.open('rb'),'sha256').hexdigest())))"))
 assert v==dict(offset=PREFIX,sha256=PREFIX_SHA),v
 save('prefix-smoke.json',v)
 off=0;k=0;done=0
 for part in a['parts']:
  with (R/part).open('rb') as f:
   while b:=f.read(CHUNK):
    if off<PREFIX:
     assert off+len(b)<=PREFIX;off+=len(b);continue
    h=hashlib.sha256(b).hexdigest();args=(str(off),base64.b64encode(b).decode(),h)
    bounded_command(TRANSFER_CODE,args)
    v=json.loads(remote('append-%04d'%k,TRANSFER_CODE,*args,compact=True))
    assert v==dict(offset=off,end=off+len(b),sha256=h),v
    off+=len(b);k+=1
    if k==3:
     cpu=time.process_time()-startCPU;predicted=cpu/3*253
     save('measured-api-overhead.json',dict(cpuSeconds=cpu,measuredCalls=4,remainingChunks=250,predictedTotalCPU=predicted,currentCPU=time.process_time(),cap=60))
     assert predicted+time.process_time()+8<60,'measured remaining operation cannot fit CPU60'
    if k%50==0:print(json.dumps(dict(appendedChunks=k,offset=off,cpu=time.process_time())),flush=True)
 assert off==a['bytes'] and k==253
 v=json.loads(remote('archive-sha',"import pathlib,hashlib,json; p=pathlib.Path('/home/user/enigma-original.tar.gz'); print(json.dumps(dict(bytes=p.stat().st_size,sha256=hashlib.file_digest(p.open('rb'),'sha256').hexdigest())))"))
 assert v==dict(bytes=a['bytes'],sha256=a['sha256']),v
 save('transfer-complete.json',dict(**v,chunks=k,resumedOffset=PREFIX,appendedBytes=off-PREFIX,rawChunkMax=CHUNK,commandByteLimit=COMMAND_LIMIT,cpu=time.process_time(),at=utc()))
''' +s[b:]
s=s.replace("a=setup();transfer(a);stage(a)","a=setup();transfer(a);stage(a)")
(r/'retained-runtime.py').write_text(s)
for n in ['retained_ops.py','retained_gate.py','retained-runtime.py']:
 p=r/n;compile(p.read_text(),n,'exec');p.chmod(0o444)
print('created immutable retained helpers')
