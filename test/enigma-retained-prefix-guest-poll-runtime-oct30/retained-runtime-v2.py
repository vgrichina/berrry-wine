import os,sys,json,pathlib,time,hashlib,base64,contextlib,io,datetime,signal,shlex
import retained_gate as gate
gate.setup();ops=gate.ops;R=ops.ROOT;O=gate.OUT/'e';B='/home/user/.ascii/boat';M=1048576
native=ops.subprocess.Popen
def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def save(n,v):(O/n).write_text(json.dumps(v,indent=2)+'\n')
SEQ=0
def call(name,args,wall=90,compact=False):
 global SEQ
 SEQ+=1;name="%04d-%s"%(SEQ,name)
 with contextlib.redirect_stdout(io.StringIO()):rc,s=ops.run(name,args,cwd=ops.REPO,wall=wall)
 assert rc==0,('first failed operation',name,rc,s[:300])
 try:v=json.loads(s)
 except json.JSONDecodeError:v=[json.loads(line) for line in s.splitlines() if line.strip()][-1]
 if compact:
  rec=json.loads((ops.E/(name+'.json')).read_text())
  with (O/'transport.jsonl').open('a') as f:f.write(json.dumps(dict(name=name,argv=rec['argv'],elapsed=rec['elapsed'],stdoutSHA256=hashlib.sha256(s.encode()).hexdigest()))+'\n')
  for x in ['json','stdout','stderr']:(ops.E/(name+'.'+x)).rename(gate.OUT/'raw'/(name+'.'+x))
 return v
def remote(name,code,*args,wall=50,compact=False):
 box=json.loads((O/'boat-created.json').read_text())['id']
 bounded_command(code,args)
 v=call(name,[B,'--no-update','--json','exec',box,'--timeout',str(wall),'--','/usr/bin/python3','-B','-c',code,*args],wall=wall+15,compact=compact)
 assert v.get('success') and v.get('exitCode')==0 and not v.get('stdoutTruncated') and not v.get('stderrTruncated'),(name,v)
 return v['stdout']
def closeout():
 box=json.loads((O/'boat-created.json').read_text())['id']
 # Safety closeout must remain possible after an admission denial.
 import subprocess
 ops.subprocess.Popen=native
 receipt=dict(at=utc(),id=box)
 for n,args in [('stop',['stop',box]),('info',['info',box])]:
  try:
   q=subprocess.run([B,'--no-update','--json']+args,cwd=O,capture_output=True,text=True,timeout=90)
   assert len(q.stdout)+len(q.stderr)<64*1024
   receipt[n]=dict(exit=q.returncode,stdout=q.stdout,stderr=q.stderr)
  except Exception as e:receipt[n]=dict(error=str(e))
 for attempt in range(6):
  try:
   obj=json.loads(receipt['info']['stdout']);obj=obj.get('sandbox',obj)
   if obj.get('state')=='stopped' and obj.get('snapshotVerifiedAt'):
    receipt['verifiedStopped']=True;receipt['snapshotVerifiedAt']=obj['snapshotVerifiedAt'];receipt['stoppedAt']=obj.get('stoppedAt');break
   time.sleep(5)
   q=subprocess.run([B,'--no-update','--json','info',box],cwd=O,capture_output=True,text=True,timeout=30)
   receipt['info']=dict(exit=q.returncode,stdout=q.stdout,stderr=q.stderr)
  except Exception as e:receipt['verificationError']=str(e);break
 save('closeout.json',receipt)
 print(json.dumps({'closeout':str(O/'closeout.json')}),flush=True)
def watchdog():
 # Separate local lifecycle process, armed before any data transfer or runtime.
 d=json.loads((O/'schedule.json').read_text())
 while time.time()<d['shutdownEpoch']:
  d=json.loads((O/'schedule.json').read_text())
  if (O/'closeout.json').exists():return
  time.sleep(min(30,max(0,d['shutdownEpoch']-time.time())))
 if not (O/'closeout.json').exists() or not json.loads((O/'closeout.json').read_text()).get('verifiedStopped'):closeout()
def setup():
 assert (O/'preflight.json').exists() and not (O/'boat-created.json').exists()
 a=gate.admission();assert a['allocated']+3*1048576+8*1048576<=64*1048576,'planned incremental evidence/publication allocation'
 save('planned-growth.json',dict(allocated=a['allocated'],plannedIncremental=3*1048576,reserve=8*1048576,cap=64*1048576))
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
 v=call('resume',[B,'--no-update','--json','resume','bx_w72496sc','--ttl','1800','--no-env'])
 save('resume.json',v)
 v=call('resumed-info',[B,'--no-update','--json','info','bx_w72496sc'])
 box=v.get('sandbox',v);assert box['state'] in ('running','ready'),box
 expiry=datetime.datetime.fromisoformat(box['archiveAfter'].replace('Z','+00:00')).timestamp()
 d=json.loads((O/'schedule.json').read_text());d.update(liveExpiry=box['archiveAfter'],resumedAt=utc(),shutdownEpoch=min(d['shutdownEpoch'],expiry-30),absoluteCutoffEpoch=min(d['absoluteCutoffEpoch'],expiry))
 save('schedule.json',d);save('boat-assignment.json',box)
 assert time.time()+180<d['shutdownEpoch'],'insufficient live lifetime'
 return json.loads((R/'archive.json').read_text())

def stage(a):
 code="import pathlib,tarfile,hashlib,json; p=pathlib.Path('/home/user/enigma-original.tar.gz'); assert hashlib.sha256(p.read_bytes()).hexdigest()=='"+a['sha256']+"'; r=pathlib.Path('/home/user/enigma-original'); r.mkdir(); t=tarfile.open(p); rows=t.getmembers(); assert all(not x.issym() and not x.islnk() and not pathlib.PurePosixPath(x.name).is_absolute() and '..' not in pathlib.PurePosixPath(x.name).parts for x in rows); assert sum(x.size for x in rows)<128*1048576; t.extractall(r,filter='data'); print(json.dumps(dict(files=len(rows),bytes=sum(x.size for x in rows))))"
 print(remote('stage',code),flush=True)
 print(remote('verify-extracted-manifest',"import pathlib,hashlib,json; r=pathlib.Path('/home/user/enigma-original'); h=hashlib.sha256(); files=sorted(p for p in r.rglob('*') if p.is_file()); [(h.update((p.relative_to(r).as_posix()+'\\0'+str(p.stat().st_size)+'\\0'+hashlib.file_digest(p.open('rb'),'sha256').hexdigest()+'\\n').encode())) for p in files]; print(json.dumps(dict(files=len(files),manifestDigest=h.hexdigest()))); assert len(files)==2663 and h.hexdigest()=='46e5799af7235be8ea9af36fa62801de816766764be9c5cdecf137e8f6fb5940'"),flush=True)
 for local,target in [(R/'owner-policy-guest.py','guest-progression.py'),(R/'guest-poll-args.json','guest-args.json'),(R/'guest-poll-instrument.py','guest-poll-instrument.py')]:
  b=local.read_bytes();assert len(b)<=16384
  remote('write-'+target,"import pathlib,base64,hashlib,sys;b=base64.b64decode(sys.argv[2]);assert hashlib.sha256(b).hexdigest()==sys.argv[3];pathlib.Path('/home/user/enigma-original',sys.argv[1]).write_bytes(b);print(sys.argv[3])",target,base64.b64encode(b).decode(),hashlib.sha256(b).hexdigest())

 print(remote('instrument',"import subprocess;subprocess.run(['/usr/bin/python3','-B','/home/user/enigma-original/guest-poll-instrument.py','/home/user/enigma-original/runner/test/run.js'],check=True);subprocess.run(['/home/user/.nvm/versions/node/v24.22.1/bin/node','--check','/home/user/enigma-original/runner/test/run.js'],check=True)"),flush=True)

def execute():
 print(remote('runtime',"import subprocess,json; q=subprocess.run(['/usr/bin/python3','-B','/home/user/enigma-original/guest-progression.py'],capture_output=True,text=True,timeout=116); print(json.dumps(dict(exit=q.returncode,stdout=q.stdout[-1000:],stderr=q.stderr[-2000:]))); assert q.returncode==0",wall=105),flush=True)
CHUNK=16384
COMMAND_LIMIT=32768
TRANSFER_CODE="import pathlib,base64,sys,hashlib,json; p=pathlib.Path('/home/user/enigma-original.tar.gz'); n=int(sys.argv[1]); assert (p.stat().st_size if p.exists() else 0)==n; b=base64.b64decode(sys.argv[2],validate=True); assert 0<len(b)<=16384; h=hashlib.sha256(b).hexdigest(); assert h==sys.argv[3]; f=p.open('ab'); assert f.tell()==n; assert f.write(b)==len(b); f.close(); assert p.stat().st_size==n+len(b); print(json.dumps(dict(offset=n,end=n+len(b),sha256=h)))"
def bounded_command(code,args):
 argv=['/usr/bin/python3','-B','-c',code,*args]
 shell=shlex.join(argv)
 sizes=dict(argvBytes=sum(len(x.encode())+1 for x in argv),shellBytes=len(shell.encode()),serializedBytes=len(json.dumps({'command':shell},ensure_ascii=True).encode()))
 assert max(sizes.values())<=COMMAND_LIMIT,('encoded command bound',sizes)
 return sizes
PREFIX=13156352
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
def collect():
 s=remote('capture-manifest',"import pathlib,json,hashlib; r=pathlib.Path('/home/user/enigma-original/capture'); print(json.dumps([dict(path=p.name,bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in r.iterdir() if p.is_file()]))")
 rows=json.loads(s);save('capture-manifest.json',rows);dest=gate.OUT/'images';dest.mkdir(exist_ok=True)
 # Preserve raw logs by hash in the stopped Boat snapshot. Fetch only bounded
 # result JSON and images; the 1MiB evidence cap is not a raw-log allowance.
 for row in rows:
  assert pathlib.PurePosixPath(row['path']).name==row['path']
 selected=[row for row in rows if row['path'].endswith('.png') or row['path']=='runtime-evidence.json']
 assert sum(x['bytes'] for x in selected if x['path'].endswith('.png'))<=8*M
 assert sum(x['bytes'] for x in selected if not x['path'].endswith('.png'))<=M
 save('capture-selection.json',dict(selected=selected,snapshotOnly=[row for row in rows if row not in selected]))
 for row in selected:
  assert pathlib.PurePosixPath(row['path']).name==row['path']
  h=hashlib.sha256();off=0
  with ((O if row['path']=='runtime-evidence.json' else dest)/row['path']).open('wb') as f:
   while off<row['bytes']:
    s=remote('collect',"import pathlib,base64,json,sys,hashlib; p=pathlib.Path('/home/user/enigma-original/capture',sys.argv[1]); f=p.open('rb'); f.seek(int(sys.argv[2])); b=f.read(49152); print(json.dumps(dict(data=base64.b64encode(b).decode(),sha256=hashlib.sha256(b).hexdigest())))",row['path'],str(off),compact=True)
    v=json.loads(s);b=base64.b64decode(v['data']);assert hashlib.sha256(b).hexdigest()==v['sha256'] and b;f.write(b);h.update(b);off+=len(b)
  assert off==row['bytes'] and h.hexdigest()==row['sha256']
 print(json.dumps({'captureFiles':len(selected),'path':str(dest)}),flush=True)
if __name__=='__main__':
 try:
  a=setup();transfer(a);stage(a)
  try:execute()
  finally:collect()
 except Exception as e:save('failure.json',dict(at=utc(),error=repr(e)));print(repr(e),flush=True)
 finally:
  if (O/'boat-created.json').exists():closeout()
