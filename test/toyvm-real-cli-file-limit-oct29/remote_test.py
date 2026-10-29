"""One production CLI invocation; a safety intervention is never PASS."""
import hashlib,json,os,pathlib,resource,signal,subprocess,time
R=pathlib.Path('/tmp/tvfile');repo=R/'repo';work=R/'w'
pins=json.loads((R/'pins.json').read_bytes())
assert all(hashlib.sha256((repo/p).read_bytes()).hexdigest()==v['sha256'] and (repo/p).stat().st_size==v['bytes'] for p,v in pins.items())
assert pathlib.Path('/usr/bin/python3').is_file() and os.access('/usr/bin/python3',os.X_OK)
assert os.access('/usr/bin/fusermount3',os.X_OK) and pathlib.Path('/dev/fuse').exists()
assert len(str(work/'status.sock').encode())<108
assert hashlib.sha256((R/'cancellation.json').read_bytes()).hexdigest()=='543b076948699e1607179782b472f4863125064cdfa3a4632351e8a1f6ed7870'
work.mkdir();assert not list(work.iterdir())
def rows():
 out={}
 for d in pathlib.Path('/proc').iterdir():
  if not d.name.isdigit():continue
  try:
   f=(d/'stat').read_text().rsplit(')',1)[1].split();out[int(d.name)]=dict(ppid=int(f[1]),start=f[19],rss=int(f[21])*4096)
  except (OSError,ValueError,IndexError):pass
 return out
def spawn(argv,*,cwd):
 p=pathlib.Path(os.path.abspath(cwd));assert p.is_relative_to(R);p=p.resolve(strict=True);assert p.is_relative_to(R)
 return subprocess.Popen(argv,cwd=p,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
resource.setrlimit(resource.RLIMIT_DATA,(128*1048576,resource.getrlimit(resource.RLIMIT_DATA)[1]))
resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(12*1048576,12*1048576))
payload='import os\nf=os.open("/tmp/tvfile/w/domain/profile",os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)\ntry:\n os.write(f,b"X"*16385)\nfinally:\n os.close(f)'
argv=['/usr/bin/python3','-B',str(repo/'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'),'--domain','tiny-fixture','--receipt',str(R/'cancellation.json'),'--work',str(work),'--live-limit','32768','--write-limit','65536','--file-limit','16384','--rss-limit','134217728','--cpu-limit','2','--wall-limit','5','--output-limit','4096','--','/usr/bin/python3','-B','-c',payload]
preflight=dict(pinsVerified=pins,pythonExecutable='/usr/bin/python3',fusermountExecutable='/usr/bin/fusermount3',socketBytes=len(str(work/'status.sock').encode()),mountArgv=[],intendedMountedFilenames=[],actualWorkloadPath='/tmp/tvfile/w/domain/profile',workloadCwd=str(repo),attemptedWrite=16385,maxPossibleLive=28672,quotas=[32768,65536,16384])
(R/'remote-preflight.json').write_text(json.dumps(preflight,indent=2)+'\n')
start=time.monotonic();q=spawn(argv,cwd=repo);seen={};external=None
while q.poll() is None:
 current=rows();selected={q.pid};old=set()
 while old!=selected:
  old=set(selected);selected.update(p for p,r in current.items() if r['ppid'] in selected)
 for p in selected:
  if p in current:seen[str(p)+':'+current[p]['start']]=current[p]
 if time.monotonic()-start>8 or sum(current.get(p,{}).get('rss',0) for p in selected)>512*1048576 or current[os.getpid()]['rss']>128*1048576:
  external='outer owned identity safety cleanup'
  for k in seen:
   pid,identity=k.split(':');now=rows().get(int(pid))
   if now and now['start']==identity:
    try:os.kill(int(pid),signal.SIGKILL)
    except ProcessLookupError:pass
  break
 time.sleep(.002)
out,err=q.communicate(timeout=1);assert len(out)+len(err)<1048576
(R/'cli.stdout').write_bytes(out);(R/'cli.stderr').write_bytes(err)
report=json.loads(out) if out else {};backend=report.get('backendReceipt',{});fs=backend.get('filesystem',{})
current=rows();identities=set(seen)|{str(p)+':'+str(s) for p,s in backend.get('owned',[])}
remaining=[k for k in identities if int(k.split(':')[0]) in current and current[int(k.split(':')[0])]['start']==k.split(':')[1]]
mounts=[x for x in pathlib.Path('/proc/self/mountinfo').read_text().splitlines() if str(work/'domain') in x]
receipt=dict(argv=argv,exit=q.returncode,externalSafety=external,wall=time.monotonic()-start,observedIdentities=seen,remainingIdentities=remaining,remainingMounts=mounts,cli=report,preflight=preflight)
receipt['PASS']=q.returncode==1 and report.get('accepted') is False and fs.get('failure')=='filesystem per-file limit' and backend.get('stopReason')=='filesystem per-file limit' and fs.get('written')==0 and fs.get('peak',32768)<32768 and fs.get('live',32768)<32768 and fs.get('openHandles')==0 and report.get('cleanupComplete') is True and not remaining and not mounts and external is None
(R/'runtime.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(dict(PASS=receipt['PASS'],exit=q.returncode,failure=fs.get('failure'),written=fs.get('written'),peak=fs.get('peak'),remaining=remaining,externalSafety=external)))
raise SystemExit(0 if receipt['PASS'] else 1)
