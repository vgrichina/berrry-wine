"""Independent OS watchdog. Never writes to guest output during cleanup."""
import os,pathlib,subprocess,time,signal,json,ctypes
ctypes.CDLL(None).prctl(36,1,0,0,0) # subreaper: independently reap orphan descendants

def members(pgid):
 rows=[]
 for d in pathlib.Path('/proc').iterdir():
  if not d.name.isdigit():continue
  try:
   raw=(d/'stat').read_text();f=raw[raw.rfind(')')+2:].split()
   if int(f[2])==pgid:rows.append(dict(pid=int(d.name),state=f[0],ppid=int(f[1]),pgid=int(f[2]),command=(d/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace')))
  except (OSError,ValueError):pass
 return rows

def supervise(cmd,cwd,env,output,receipt,seconds,observe=None):
 fd=os.open(receipt,os.O_RDWR|os.O_CREAT|os.O_EXCL,0o600);os.posix_fallocate(fd,0,65536)
 start=time.monotonic();p=None;seen={};reaped=[];peak=0;reason='external-monotonic-bound';error=None
 try:
  with open(output,'ab',buffering=0) as log:p=subprocess.Popen(cmd,cwd=cwd,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
  while time.monotonic()-start<seconds-1:
   rows=members(p.pid)
   for r in rows:seen[r['pid']]=r
   if observe:
    result=observe()
    if result:reason=result;break
   if p.poll() is not None and not any(r['state']!='Z' for r in rows):reason='all-owned-processes-exited';break
   time.sleep(.02)
 except BaseException as e:error=repr(e);reason='watchdog-observation-error'
 finally:
  if p:
   for sig in [signal.SIGTERM,signal.SIGKILL]:
    try:os.killpg(p.pid,sig)
    except ProcessLookupError:pass
    if sig==signal.SIGTERM:time.sleep(.2)
   try:p.wait(timeout=.3)
   except subprocess.TimeoutExpired:pass
   until=time.monotonic()+.3
   while time.monotonic()<until:
    try:
     pid,status=os.waitpid(-1,os.WNOHANG)
     if pid:reaped.append(dict(pid=pid,waitStatus=status));continue
    except ChildProcessError:break
    time.sleep(.01)
  elapsed=time.monotonic()-start
  result=dict(reason=reason,observationError=error,elapsedSeconds=elapsed,boundSeconds=seconds,boundPassed=elapsed<=seconds,pgid=p.pid if p else None,parentOsExit=p.returncode if p else None,seen=list(seen.values()),reapedDescendants=reaped,remaining=members(p.pid) if p else [],receiptOutsideGuestQuota=True)
  b=json.dumps(result,indent=2).encode();assert len(b)<65536;os.pwrite(fd,b,0);os.ftruncate(fd,len(b));os.fsync(fd);os.close(fd)
 return result

def admit(current,copy_bytes,budget,overhead=0,growth=67108864):
 required={'CreateProcess-input','parent-export','child-export'}
 assert required<=budget.keys(),'missing copy budget: '+str(required-budget.keys())
 projected=current+sum(budget.values())*copy_bytes+overhead+growth
 assert projected<=939524096,('mutable projection exceeds ceiling',projected)
 return projected
