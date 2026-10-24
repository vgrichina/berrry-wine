import os,pathlib,subprocess,json,time,resource,signal,selectors,ctypes,sys,hashlib
P=pathlib.Path(__file__).parent
ctypes.CDLL(None).prctl(36,1,0,0,0)
name=sys.argv[1]; heavy=sys.argv[2]=='heavy'; args=sys.argv[3:]
available=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
floor=2684354560 if heavy else 805306368
assert available>=floor,('memory admission rejected',available,floor)
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(90 if heavy else 60,)*2)
 resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,)*2)
argv=['/usr/local/bin/node','--max-old-space-size='+('512' if heavy else '256'),*args]
t=time.monotonic();proc=subprocess.Popen(argv,cwd=P,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,preexec_fn=limits)
sel=selectors.DefaultSelector();outputs={};total=0;reason=None
for stream,label in [(proc.stdout,'stdout'),(proc.stderr,'stderr')]:
 sel.register(stream,selectors.EVENT_READ,label);outputs[label]=open(P/(name+'.'+label),'wb')
while sel.get_map() or proc.poll() is None:
 if time.monotonic()-t>60:reason='wall limit'
 if reason:break
 for key,_ in sel.select(.1):
  b=os.read(key.fd,4096)
  if not b:sel.unregister(key.fileobj);continue
  if total+len(b)>131072:reason='combined output limit';b=b[:131072-total]
  outputs[key.data].write(b);total+=len(b)
  if reason:break
if reason or proc.poll() is None:
 try:os.killpg(proc.pid,signal.SIGTERM)
 except ProcessLookupError:pass
 try:proc.wait(timeout=2)
 except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL)
proc.wait()
try:os.killpg(proc.pid,signal.SIGTERM)
except ProcessLookupError:pass
deadline=time.monotonic()+2
while time.monotonic()<deadline:
 try:
  pid,_=os.waitpid(-1,os.WNOHANG)
  if pid:continue
  os.killpg(proc.pid,signal.SIGKILL);time.sleep(.02)
 except (ChildProcessError,ProcessLookupError):break
while True:
 try:
  pid,_=os.waitpid(-1,os.WNOHANG)
  if not pid:break
 except ChildProcessError:break
for f in outputs.values():f.close()
try:os.killpg(proc.pid,0);remaining=True
except ProcessLookupError:remaining=False
r={'argv':argv,'pid':proc.pid,'exit':proc.returncode,'reason':reason,'wallSeconds':time.monotonic()-t,'MemAvailable':available,'memoryFloor':floor,'cpuLimit':90 if heavy else 60,'wallLimit':60,'combinedOutputBytes':total,'combinedOutputLimit':131072,'remainingGroup':remaining,'reaped':True,'childCPUSeconds':resource.getrusage(resource.RUSAGE_CHILDREN).ru_utime+resource.getrusage(resource.RUSAGE_CHILDREN).ru_stime,'maxChildRSSBytes':resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss*1024}
(P/(name+'.json')).write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r));sys.exit(proc.returncode if not reason and not remaining else 125)
