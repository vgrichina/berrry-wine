import os,sys,pathlib,hashlib,json,time,subprocess,resource,signal,ctypes
R=pathlib.Path('/tmp/tvdt');W=R/'w';M=1048576
soft,hard=resource.getrlimit(resource.RLIMIT_DATA);resource.setrlimit(resource.RLIMIT_DATA,(128*M,hard));resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(12*M,12*M))
ctypes.CDLL(None).prctl(36,1,0,0,0)
pins=json.loads((R/'pins.json').read_text());assert len(pins)==5
for rel,pin in pins.items():
 b=(R/'repo'/rel).read_bytes();assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256']
assert len(str(W/'status.sock').encode())==23
assert not W.exists();W.mkdir()
exe=pathlib.Path(sys.executable).resolve();assert os.access(exe,os.X_OK)
def rows():
 out={}
 for p in pathlib.Path('/proc').iterdir():
  if not p.name.isdecimal():continue
  try:
   b=(p/'stat').read_text();f=b[b.rindex(')')+2:].split();out[int(p.name)]={'pid':int(p.name),'start':f[19],'ppid':int(f[1]),'state':f[0],'ticks':int(f[11])+int(f[12]),'rss':int(f[21])*os.sysconf('SC_PAGE_SIZE')}
  except (FileNotFoundError,ProcessLookupError,PermissionError,ValueError):pass
 return out
code='import os\nTASK_MARKER="toyvm-real-descendant-cpu-limit-oct29"\nchild=os.fork()\nif child:\n os.waitpid(child,0)\nelse:\n x=1\n while True:\n  x=(x*1664525+1013904223)%4294967296\n'
argv=[str(exe),'-B',str(R/'repo/test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'),'--domain','tiny-fixture','--receipt',str(R/'receipt.json'),'--work',str(W),'--live-limit','4096','--write-limit','4096','--file-limit','4096','--rss-limit',str(128*M),'--cpu-limit','1.0','--wall-limit','8','--output-limit','4096','--',str(exe),'-B','-c',code]
s=os.statvfs(R);mem=int(next(l.split()[1] for l in pathlib.Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024
pre={'executable':str(exe),'executableSHA256':hashlib.sha256(exe.read_bytes()).hexdigest(),'version':sys.version,'sourcePins':pins,'argv':argv,'mountArgv':[],'limits':{'DATA':resource.getrlimit(resource.RLIMIT_DATA),'CPU':resource.getrlimit(resource.RLIMIT_CPU),'FSIZE':resource.getrlimit(resource.RLIMIT_FSIZE)},'admission':{'f_bavail':s.f_bavail,'blockSize':s.f_frsize,'device':R.stat().st_dev,'MemAvailable':mem}}
(R/'prelaunch.json').write_text(json.dumps(pre,sort_keys=True));assert mem>=512*M and s.f_bavail*s.f_frsize>=24*M
seen={};samples=[];safety=None;start=time.monotonic();peak=0
with (R/'cli.stdout').open('wb') as out,(R/'cli.stderr').open('wb') as err:
 p=subprocess.Popen(argv,cwd=R/'repo',stdout=out,stderr=err)
 while p.poll() is None:
  snap=rows();selected={p.pid:snap[p.pid]} if p.pid in snap else {}
  for _ in range(8):
   selected.update({pid:r for pid,r in snap.items() if r['ppid'] in selected})
  for r in selected.values():seen[(r['pid'],r['start'])]=r
  rss=sum(r['rss'] for r in selected.values());peak=max(peak,rss)
  if len(samples)<1000:samples.append({'elapsed':time.monotonic()-start,'rows':list(selected.values())})
  own=snap.get(os.getpid(),{}).get('rss',0)
  if time.monotonic()-start>12 or rss>512*M or own>128*M or out.tell()+err.tell()>2*M:
   safety='external safety cleanup';break
  time.sleep(.01)
 if safety:
  for (pid,st),r in seen.items():
   now=rows().get(pid)
   if now and now['start']==st:
    try:signal.pidfd_send_signal(os.pidfd_open(pid),signal.SIGKILL)
    except ProcessLookupError:pass
  p.kill()
 p.wait(timeout=3)
# Production must already have reaped all identities; observer never cleans a passing case.
final=rows();remaining=[r for (pid,st),r in seen.items() if pid in final and final[pid]['start']==st]
mounts=[l for l in pathlib.Path('/proc/self/mountinfo').read_text().splitlines() if str(W/'domain') in l]
report=json.loads((R/'cli.stdout').read_text()) if not safety else None
receipt={'exit':p.returncode,'elapsed':time.monotonic()-start,'safety':safety,'ownedObserved':list(seen.values()),'samples':samples,'remainingIdentities':remaining,'remainingMounts':mounts,'peakGroupRSS':peak,'report':report,'sourceUnmodified':all(hashlib.sha256((R/'repo'/rel).read_bytes()).hexdigest()==pin['sha256'] for rel,pin in pins.items())}
if report:
 b=report.get('backendReceipt',{});receipt['gatePass']=p.returncode==1 and report['accepted'] is False and b.get('stopReason')=='aggregate CPU limit' and b.get('cpuSeconds',0)>1.0 and b.get('wallSeconds',99)<8 and b.get('cleanupComplete') is True and not remaining and not mounts and not safety
else:receipt['gatePass']=False
(R/'canonical-receipt.json').write_text(json.dumps(receipt,sort_keys=True))
print(json.dumps({'gatePass':receipt['gatePass'],'exit':p.returncode,'safety':safety,'stopReason':(report or {}).get('backendReceipt',{}).get('stopReason'),'cpuSeconds':(report or {}).get('backendReceipt',{}).get('cpuSeconds'),'remaining':len(remaining),'mounts':len(mounts)}))
