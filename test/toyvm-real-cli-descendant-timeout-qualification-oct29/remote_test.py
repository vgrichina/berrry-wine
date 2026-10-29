"""One real production CLI timeout qualification; no backend substitution."""
import pathlib,os,resource,subprocess,time,json,signal,socket,base64,hashlib,ctypes
OWN=pathlib.Path('/tmp/toyvm-real-cli-descendant-timeout-qualification-oct29').resolve(); REPO=OWN/'repo'; E=REPO/'test/toyvm-real-cli-descendant-timeout-qualification-oct29';M=1024**2

def save(n,o):
 b=(json.dumps(o,sort_keys=True,indent=2)+'\n').encode();assert len(b)<M;(E/n).write_bytes(b)
def contained(cwd):
 p=pathlib.Path(cwd).resolve()
 if p!=OWN and OWN not in p.parents:raise ValueError('cwd outside own task')
 return p

def rows():
 rs={}
 for p in pathlib.Path('/proc').iterdir():
  if not p.name.isdigit():continue
  try:
   s=(p/'stat').read_text().rsplit(')',1)[1].split();rs[int(p.name)]=dict(pid=int(p.name),start=s[19],ppid=int(s[1]),rss=max(0,int(s[21]))*4096,cpu=sum(int(s[i]) for i in (11,12,13,14))/os.sysconf('SC_CLK_TCK'))
  except (OSError,ValueError):pass
 return rs

def lower(k,n):
 s,h=resource.getrlimit(k);resource.setrlimit(k,(min(s,n) if s!=-1 else n,min(h,n) if h!=-1 else n))

def launch(argv,*,cwd):
 cwd=contained(cwd)
 return subprocess.Popen(argv,cwd=str(cwd),stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1'),start_new_session=True)

def main():
 lower(resource.RLIMIT_DATA,128*M);lower(resource.RLIMIT_CPU,90);lower(resource.RLIMIT_FSIZE,12*M)
 ctypes.CDLL(None).prctl(36,1,0,0,0)
 # The remote allocation uses the same bounded tiny closure, not a build/image.
 v=os.statvfs(OWN);mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 a=dict(at=time.time(),device=os.stat(OWN).st_dev,f_bavail=v.f_bavail,blockSize=v.f_frsize,freeBytes=v.f_bavail*v.f_frsize,aggregate=24*M,projection=24*M,MemAvailable=mem,limits={str(k):resource.getrlimit(k) for k in (resource.RLIMIT_DATA,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE)},PASS=v.f_bavail*v.f_frsize-24*M>=3225419776 and mem>=512*M)
 save('remote-admission.json',a)
 if not a['PASS']:raise RuntimeError('remote admission rejected')
 work=E/'work';work.mkdir();domain=work/'domain'
 fixture='''import os,time,json
fd=os.open(%r,os.O_CREAT|os.O_RDWR,0o600)
os.write(fd,b'parent')
def identity(role):
 s=open('/proc/self/stat').read().rsplit(')',1)[1].split()
 print(json.dumps(dict(role=role,pid=os.getpid(),ppid=os.getppid(),start=s[19],fd=fd)),flush=True)
child=os.fork()
if child==0:
 os.pwrite(fd,b'descendant',0)
 identity('descendant')
 while True:
  os.pwrite(fd,b'x',0)
  time.sleep(.05)
else:
 identity('parent')
 time.sleep(30)
''' % str(domain/'held-accounted-file')
 (E/'fixture.py').write_text(fixture)
 argv=['/usr/bin/python3','-B',str(REPO/'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'),'--domain','tiny-fixture','--receipt',str(E/'cancellation-receipt.json'),'--work',str(work),'--live-limit','32768','--write-limit','65536','--file-limit','4096','--rss-limit',str(128*M),'--cpu-limit','5','--wall-limit','2','--output-limit','8192','--','/usr/bin/python3','-B','-c',fixture]
 save('invocation.json',dict(argv=argv,cwd=str(REPO),fixtureSHA256=hashlib.sha256(fixture.encode()).hexdigest(),backend='actual unmodified CLI load_backend synchronous-fuse'))
 p=launch(argv,cwd=REPO);start=time.monotonic();seen={};live=[];peak=0;reason=None
 os.set_blocking(p.stdout.fileno(),False);os.set_blocking(p.stderr.fileno(),False);out=bytearray();err=bytearray()
 while p.poll() is None:
  rs=rows();selected={p.pid}
  for _ in range(10):selected.update(pid for pid,r in rs.items() if r['ppid'] in selected)
  selected={pid:r for pid,r in rs.items() if pid in selected or (pid in seen and seen[pid]['start']==r['start'])};seen.update(selected)
  peak=max(peak,sum(r['rss'] for r in selected.values()))
  for pipe,buf in [(p.stdout,out),(p.stderr,err)]:
   try:buf.extend(os.read(pipe.fileno(),65536))
   except BlockingIOError:pass
  if (work/'status.sock').exists() and len(live)<3:
   try:
    with socket.socket(socket.AF_UNIX) as s:
     s.settimeout(.2);s.connect(str(work/'status.sock'));state=json.loads(s.recv(8192))
    mounts=[x for x in pathlib.Path('/proc/self/mountinfo').read_text().splitlines() if str(domain) in x]
    if state['openHandles'] and state['written']>=16:live.append(dict(at=time.time(),state=state,mounts=mounts,processes=selected))
   except (OSError,ValueError):pass
  if time.monotonic()-start>15 or peak>512*M or any(r['rss']>128*M for r in selected.values()) or sum(r['cpu'] for r in selected.values())>90 or len(out)+len(err)>2*M:
   reason='outer supervisor resource rejection';break
  time.sleep(.02)
 if reason:
  for pid,r in seen.items():
   cur=rows().get(pid)
   if cur and cur['start']==r['start']:
    try:os.kill(pid,signal.SIGKILL)
    except ProcessLookupError:pass
 p.wait(timeout=5)
 for pipe,buf in [(p.stdout,out),(p.stderr,err)]:
  while True:
   try:b=os.read(pipe.fileno(),65536)
   except BlockingIOError:break
   if not b:break
   buf.extend(b)
 (E/'cli.stdout').write_bytes(out);(E/'cli.stderr').write_bytes(err)
 after=rows();remaining=[r for pid,r in after.items() if pid in seen and seen[pid]['start']==r['start']]
 mounts=[x for x in pathlib.Path('/proc/self/mountinfo').read_text().splitlines() if str(domain) in x]
 save('live-observations.json',live)
 save('process-cleanup.json',dict(observed=seen,remaining=remaining,remainingMounts=mounts,outerReason=reason,peakPhysicalGroupRSS=peak,exit=p.returncode))
 report=json.loads(out); backend=report.get('backendReceipt',{});fs=backend.get('filesystem',{});fc=backend.get('filesystemCleanup',{})
 identities=[json.loads(x) for x in base64.b64decode(backend['output']['data']).decode().splitlines()]
 checks=dict(cliRejected=p.returncode==1 and report['accepted'] is False,wallDeadline=backend.get('stopReason')=='wall deadline',bothFixtureIdentities={x['role'] for x in identities}=={'parent','descendant'},authoritativeLive=bool(live) and any(x['mounts'] for x in live),finalHandlesZero=fs.get('openHandles')==0,quotaNotReached=fs.get('failure') is None,childTreeReaped=backend.get('cleanupComplete') is True and not remaining,callerCleanupTrue=report.get('cleanupComplete') is True,mountDisconnected=not mounts and fc.get('remainingMounts')==[] and fc.get('unmountExit')==0,serverExited=fc.get('serverExit') in [0,-15],outerWithinCaps=reason is None,browserAllowanceUnspent=report.get('browserAllowanceRemaining')==dict(cpuSeconds=35.353183,wallSeconds=101.495550694,captures=1))
 save('qualification.json',dict(PASS=all(checks.values()),checks=checks,fixtureIdentities=identities,backendReceipt=backend,cliExit=p.returncode))
 print(json.dumps(dict(PASS=all(checks.values()),checks=checks,fixtureIdentities=identities,cliExit=p.returncode)))
 if not all(checks.values()):raise RuntimeError('real correctness failure; unchanged reproducer retained; no repair')
if __name__=='__main__':main()
