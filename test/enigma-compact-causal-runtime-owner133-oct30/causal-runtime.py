import os,sys,json,pathlib,time,hashlib,base64,contextlib,io,datetime,signal
import owner133_ops as gate
gate.setup();ops=gate.ops;R=ops.ROOT;O=gate.OUT/'e';B='/home/user/.ascii/boat';M=1048576
native=ops.subprocess.Popen
def admitted(*a,**kw):gate.admission();return native(*a,**kw)
ops.subprocess.Popen=admitted
def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def save(n,v):(O/n).write_text(json.dumps(v,indent=2)+'\n')
def call(name,args,wall=90,compact=False):
 with contextlib.redirect_stdout(io.StringIO()):rc,s=ops.run(name,args,cwd=ops.REPO,wall=wall)
 assert rc==0,('first failed operation',name,rc,s[:300])
 try:v=json.loads(s)
 except json.JSONDecodeError:v=[json.loads(line) for line in s.splitlines() if line.strip()][-1]
 if compact:
  rec=json.loads((ops.E/(name+'.json')).read_text())
  with (O/'transport.jsonl').open('a') as f:f.write(json.dumps(dict(name=name,argv=rec['argv'],elapsed=rec['elapsed'],stdoutSHA256=hashlib.sha256(s.encode()).hexdigest()))+'\n')
  for x in ['json','stdout','stderr']:(ops.E/(name+'.'+x)).unlink()
 return v
def remote(name,code,*args,wall=50,compact=False):
 box=json.loads((O/'boat-created.json').read_text())['id']
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
  if (O/'closeout.json').exists():return
  time.sleep(min(30,max(0,d['shutdownEpoch']-time.time())))
 if not (O/'closeout.json').exists() or not json.loads((O/'closeout.json').read_text()).get('verifiedStopped'):closeout()
def setup():
 assert not (O/'boat-created.json').exists()
 a=json.loads((R/'archive.json').read_text());h=hashlib.sha256();n=0
 for part in a['parts']:
  with (R/part).open('rb') as f:
   while b:=f.read(65536):h.update(b);n+=len(b)
 assert h.hexdigest()==a['sha256'] and n==a['bytes']
 manifest=json.loads((R/'transfer-manifest.json').read_text());mount=json.loads((R/'mount-enumeration.json').read_text())
 files=[row['target'] for row in manifest if row['target'].startswith('vfs/')]
 assert sorted(files)==sorted(mount['files'])
 assert (O/'preflight.json').exists();gate.admission()
 v=call('boat-create',[B,'--no-update','--json','new','--ttl','1800','--no-env','--fail-fast','--type','default','--name','enigma-causal-owner133'])
 save('boat-created.json',v)
 now=time.time();expiry=datetime.datetime.fromisoformat(v['archiveAfter'].replace('Z','+00:00')).timestamp()
 save('boat-assignment.json',dict(id=v['id'],nativeExpiry=v['archiveAfter'],createdEpoch=now,guestCutoffEpoch=min(now+1200,expiry-600),handbackEpoch=min(now+1380,expiry-420),shutdownEpoch=min(now+1500,expiry-300),shutdownDelegated=True,owner='owner133 worker; coordinator retains oversight'))
 save('schedule.json',json.loads((O/'boat-assignment.json').read_text()))
 pid=os.fork()
 if pid==0:os.setsid();watchdog();os._exit(0)
 save('watchdog.json',dict(pid=pid,at=utc()));print(json.dumps(v),flush=True);return a

def stage(a):
 code="import pathlib,tarfile,hashlib,json; p=pathlib.Path('/home/user/enigma-original.tar.gz'); assert hashlib.sha256(p.read_bytes()).hexdigest()=='"+a['sha256']+"'; r=pathlib.Path('/home/user/enigma-original'); r.mkdir(); t=tarfile.open(p); rows=t.getmembers(); assert all(not x.issym() and not x.islnk() and not pathlib.PurePosixPath(x.name).is_absolute() and '..' not in pathlib.PurePosixPath(x.name).parts for x in rows); assert sum(x.size for x in rows)<128*1048576; t.extractall(r,filter='data'); print(json.dumps(dict(files=len(rows),bytes=sum(x.size for x in rows))))"
 print(remote('stage',code),flush=True)
 for local,target in [(R/'causal-guest.py','guest-progression.py'),(R/'progression-args.json','guest-args.json')]:
  b=local.read_bytes();assert len(b)<=49152
  remote('write-'+target,"import pathlib,base64,hashlib,sys;b=base64.b64decode(sys.argv[2]);assert hashlib.sha256(b).hexdigest()==sys.argv[3];pathlib.Path('/home/user/enigma-original',sys.argv[1]).write_bytes(b);print(sys.argv[3])",target,base64.b64encode(b).decode(),hashlib.sha256(b).hexdigest())

def execute():
 print(remote('runtime',"import subprocess,json; q=subprocess.run(['/usr/bin/python3','-B','/home/user/enigma-original/guest-progression.py'],capture_output=True,text=True,timeout=116); print(json.dumps(dict(exit=q.returncode,stdout=q.stdout[-1000:],stderr=q.stderr[-2000:]))); assert q.returncode==0",wall=120),flush=True)
def transfer(a):
 off=0;pending=[];k=0
 code="import pathlib,base64,sys,hashlib,json; p=pathlib.Path('/home/user/enigma-original.tar.gz'); n=int(sys.argv[1]); assert (p.stat().st_size if p.exists() else 0)==n; rows=[json.loads(s) for s in sys.argv[2:]]; assert len(rows)<=4; f=p.open('ab'); total=n\nfor row in rows:\n b=base64.b64decode(row['data']); assert len(b)<=49152; assert hashlib.sha256(b).hexdigest()==row['sha256']; f.write(b); total+=len(b)\nf.close(); print(total)"
 def flush():
  nonlocal off,k,pending
  if not pending:return
  s=remote('transfer-%03d'%k,code,str(off),*[json.dumps(row) for row in pending],compact=True)
  off+=sum(row['bytes'] for row in pending);assert int(s)==off;k+=1;pending=[]
  if k%10==0:print(json.dumps({'transferred':off,'total':a['bytes'],'at':utc()}),flush=True)
 for part in a['parts']:
  with (R/part).open('rb') as f:
   while b:=f.read(49152):
    pending.append(dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),data=base64.b64encode(b).decode()))
    if len(pending)==1:flush()
 flush();assert off==a['bytes'];save('transfer-complete.json',dict(bytes=off,sha256=a['sha256'],at=utc()))
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
