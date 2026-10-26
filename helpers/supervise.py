import os,sys,json,time,resource,subprocess,pathlib,signal,selectors,datetime
from account import accounting
import ctypes
ctypes.CDLL(None).prctl(36,1,0,0,0)
B=pathlib.Path('/tmp/civ2-win16-complete-setup-map-gameplay-oct26')
R=pathlib.Path('/home/user/wine-assembly/scratch/runs/civ2-win16-complete-setup-map-gameplay-oct26')
env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/home/user','NODE_PATH':'/tmp/wa-local-runtime-deps/node_modules','LANG':'C.UTF-8','TZ':'UTC'}
node='/home/user/.nvm/versions/node/v24.18.1/bin/node'
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(90,90))
 resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
def proc():
 out={}
 for d in pathlib.Path('/proc').iterdir():
  if not d.name.isdigit():continue
  try:
   s=(d/'stat').read_text(); a=s[s.rfind(')')+2:].split(); pid=int(d.name)
   out[pid]=(int(a[1]),int(a[19]),int(a[21])*os.sysconf('SC_PAGE_SIZE'),(int(a[11])+int(a[12]))/os.sysconf('SC_CLK_TCK'))
  except (OSError,ValueError,IndexError):pass
 return out
name=sys.argv[1]; cmd=[node,'--max-old-space-size=768',*sys.argv[2:]]
start=time.monotonic(); p=subprocess.Popen(cmd,cwd='/tmp/civ2-win16-ordinary-gameplay-oct26/source',env=env,preexec_fn=limits,start_new_session=True,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
known={}; peak=0; cpupeak=0; count=0; reason=None; sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ)
controlOffset=0; nextAccount=0; peakAllocation=0
receipt=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),command=cmd,environment=env,pid=p.pid,wallLimit=90 if name=='guest' else 120,cpuLimit=90,rssLimit=805306368,fileLimit=25165824,outputLimit=2097152)
(R/(name+'-launch.json')).write_text(json.dumps(receipt,indent=2)+'\n')
with open(R/(name+'.log'),'wb') as log:
 while True:
  table=proc(); owned=set(pid for pid,v in table.items() if pid in known and known[pid]==v[1]);owned.update([p.pid,os.getpid()])
  while True:
   new=owned|{pid for pid,v in table.items() if v[0] in owned}
   if new==owned:break
   owned=new
  for pid in owned:
   if pid in table:known[pid]=table[pid][1]
  rss=sum(table[pid][2] for pid in owned if pid in table);cpu=sum(table[pid][3] for pid in owned if pid in table)
  peak=max(peak,rss);cpupeak=max(cpupeak,cpu)
  if rss>805306368:reason='aggregate RSS exceeded'
  if cpu>90:reason='aggregate CPU exceeded'
  if time.monotonic()-start>receipt['wallLimit']:reason='wall limit reached'
  if time.monotonic()>=nextAccount:
   peakAllocation=max(peakAllocation,accounting()['total']);nextAccount=time.monotonic()+1
   if peakAllocation+8388608+4194304>201326592:reason='task allocation plus 8MiB reserve exceeded'
  if name=='guest' and datetime.datetime.now(datetime.timezone.utc)>=datetime.datetime.fromisoformat('2026-10-26T22:05:00+00:00'):reason='guest cutoff'
  if name=='guest':
   inbox=R/'control-in.jsonl'
   if inbox.exists():
    with open(inbox,'rb') as f:
     f.seek(controlOffset); data=f.read();controlOffset=f.tell()
    if data:
     try:p.stdin.write(data);p.stdin.flush()
     except BrokenPipeError:pass
  for key,_ in sel.select(.01):
   data=os.read(key.fd,8192)
   if data:
    count+=len(data);log.write(data[:max(0,2097152-log.tell())]);log.flush()
   else:sel.unregister(key.fileobj)
  if count>2097152:reason='output limit reached'
  if reason:
   for pid in owned:
    if pid != os.getpid() and pid in table and known.get(pid)==table[pid][1]:
     try:os.kill(pid,signal.SIGKILL)
     except ProcessLookupError:pass
  if p.poll() is not None and not sel.get_map():break
 p.wait()
receipt.update(exitCode=p.returncode,stopReason=reason,wallSeconds=time.monotonic()-start,peakAggregateRSS=peak,peakAggregateCPUSeconds=cpupeak,outputBytes=count,identities=known,peakTaskAllocationIncludingConservativeWAL=peakAllocation)
(R/(name+'-receipt.json')).write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt));sys.exit(0 if p.returncode==0 and not reason else 1)
