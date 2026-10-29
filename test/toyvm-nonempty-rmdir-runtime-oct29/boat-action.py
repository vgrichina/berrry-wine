import sys,os,json,pathlib,subprocess,hashlib,datetime
R=pathlib.Path('/tmp/toyvm-nonempty-rmdir-runtime-oct29'); REPO=R/'repo'; E=R/'e'
D=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-nonempty-rmdir-runtime-oct29-dispatch.json').read_text())
def run(argv,*,cwd):
 p=pathlib.Path(cwd).resolve(strict=True);assert p.is_relative_to(R)
 q=subprocess.run(argv,cwd=p,capture_output=True,timeout=108)
 assert len(q.stdout)+len(q.stderr)<2*1048576
 return q
action=sys.argv[1]; argv=['/home/user/.ascii/boat','--json']
if action=='new':
 assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime.fromisoformat('2026-10-29T05:45:35+00:00')
 pairs=[('/tmp/tvne/repo/'+p,REPO/p,v) for p,v in D['sourcePins'].items()]
 pairs += [('/tmp/tvne/fixture.py',pathlib.Path(D['runtimeFixture']),D['runtimeFixturePin']),('/tmp/tvne/runtime-observer.py',pathlib.Path(D['runtimeObserver']),D['runtimeObserverPin']),('/tmp/tvne/cancellation.json',pathlib.Path(D['originalCancellationReceipt']),D['originalCancellationReceiptPin'])]
 dispatch=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-nonempty-rmdir-runtime-oct29-dispatch.json')
 pairs += [('/tmp/tvne/dispatch.json',dispatch,None)]
 files=[]
 for remote,local,pin in pairs:
  b=local.read_bytes();h=hashlib.sha256(b).hexdigest()
  if pin:assert len(b)==pin['bytes'] and h==pin['sha256']
  files.append(dict(remote=remote,local=str(local),bytes=len(b),sha256=h))
 (E/'staging-manifest.json').write_text(json.dumps(files,indent=2))
 (E/'mount-contract.json').write_text(json.dumps(dict(mountArgv=[],intendedMountedFiles=[],reason='Boat new --file text staging; no filename-bearing mount arguments or guest mount parser',stagedFiles=files),indent=2))
 argv+=['new','--ttl','1800','--name','toyvm-nonempty-rmdir-runtime-oct29']
 for remote,local,_ in pairs:argv+=['--file',remote+'='+str(local)]
elif action in ('info','stop'):
 box=json.loads((E/'boat-identity.json').read_text())['id'];argv += [action,box]
elif action=='execution-preflight':
 box=json.loads((E/'boat-identity.json').read_text())['id']
 files=json.loads((E/'staging-manifest.json').read_text())
 code='import pathlib,hashlib,json,os; files='+repr(files)+'; result=[]\nfor f in files:\n b=pathlib.Path(f["remote"]).read_bytes(); assert len(b)==f["bytes"] and hashlib.sha256(b).hexdigest()==f["sha256"]; result.append(dict(path=f["remote"],bytes=len(b),sha256=f["sha256"]))\nassert pathlib.Path("/dev/fuse").exists() and os.access("/usr/bin/python3",os.X_OK) and os.access("/usr/bin/fusermount3",os.X_OK)\nprint(json.dumps(dict(PASS=True,verified=result,cwd=os.getcwd(),fuse=True)))'
 argv+=['exec',box,'--cwd','/tmp/tvne/repo','--timeout','20','--','/usr/bin/python3','-B','-c',code]
elif action=='runtime':
 box=json.loads((E/'boat-identity.json').read_text())['id']
 assert not (E/'runtime-attempt.json').exists()
 assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime.fromisoformat('2026-10-29T05:50:35+00:00')
 (E/'runtime-attempt.json').write_text(json.dumps(dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),oneAttempt=True)))
 argv+=['exec',box,'--cwd','/tmp/tvne/repo','--timeout','30','--','/usr/bin/python3','-B','/tmp/tvne/runtime-observer.py']
else:raise ValueError(action)
q=run(argv,cwd=REPO)
(E/('api-'+action+'.stdout')).write_bytes(q.stdout);(E/('api-'+action+'.stderr')).write_bytes(q.stderr)
(E/('api-'+action+'.json')).write_text(json.dumps(dict(argv=argv,exit=q.returncode,at=datetime.datetime.now(datetime.timezone.utc).isoformat(),stdoutBytes=len(q.stdout),stderrBytes=len(q.stderr)),indent=2))
if action=='new' and q.returncode==0:
 data=[json.loads(line) for line in q.stdout.splitlines() if line.strip()];(E/'boat-new-response.json').write_text(json.dumps(data,indent=2))
 def find(x):
  if isinstance(x,dict):
   for k,v in x.items():
    if k in ('id','sandboxId') and isinstance(v,str) and v.startswith('bx_'):return v
   for v in x.values():
    b=find(v)
    if b:return b
  if isinstance(x,list):
   for v in x:
    b=find(v)
    if b:return b
 box=find(data);assert box
 (E/'boat-identity.json').write_text(json.dumps(dict(id=box,response='api-new.stdout'),indent=2))
print(q.stdout.decode()[:5000]);print(q.stderr.decode()[:1000]);sys.exit(q.returncode)
