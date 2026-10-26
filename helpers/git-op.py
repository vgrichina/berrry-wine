import subprocess,resource,os,sys,pathlib,selectors,time,signal,json
R=pathlib.Path('/home/user/wine-assembly/scratch/runs/civ2-win16-post-intro-dialog-gameplay-oct26')
from account import accounting
import shutil
mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable:')))*1024
allocation=accounting()['total']+33554432;free=shutil.disk_usage(R).free
if mem<2415919104 or allocation>134217728 or free-33554432<2982150144:
 with open(R/'git-operations.jsonl','a') as f:f.write(json.dumps(dict(admitted=False,memAvailable=mem,required=2415919104,allocationProjection=allocation,diskFree=free,command=sys.argv[1:]))+'\n')
 print('GIT ADMISSION DENIED; no unchanged retry');sys.exit(4)
def proc():
 out={}
 for d in pathlib.Path('/proc').iterdir():
  if not d.name.isdigit():continue
  try:
   s=(d/'stat').read_text();a=s[s.rfind(')')+2:].split()
   out[int(d.name)]=(int(a[1]),int(a[19]),int(a[21])*os.sysconf('SC_PAGE_SIZE'),(int(a[11])+int(a[12]))/os.sysconf('SC_CLK_TCK'))
  except (OSError,ValueError,IndexError):pass
 return out
env=os.environ.copy();env['GIT_SSH_COMMAND']='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def limits():
 resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
 resource.setrlimit(resource.RLIMIT_CPU,(90,90))
 resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
watch=subprocess.Popen(['tail','-f','/home/user/wine-assembly/messageboard.txt'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
cmd=['git','-c','gc.auto=0',*sys.argv[1:]]
start=time.monotonic();p=subprocess.Popen(cmd,cwd=R,env=env,preexec_fn=limits,start_new_session=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT);sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ);data=bytearray();reason=None
known={};peak=0;cpuPeak=0
try:
 while sel.get_map() or p.poll() is None:
  table=proc();owned={os.getpid(),p.pid}
  owned.update(pid for pid,v in table.items() if known.get(pid)==v[1])
  while True:
   new=owned|{pid for pid,v in table.items() if v[0] in owned}
   if new==owned:break
   owned=new
  for pid in owned:
   if pid in table:known[pid]=table[pid][1]
  peak=max(peak,sum(table[pid][2] for pid in owned if pid in table));cpuPeak=max(cpuPeak,sum(table[pid][3] for pid in owned if pid in table))
  for key,_ in sel.select(.1):
   b=os.read(key.fd,8192)
   if not b:sel.unregister(key.fileobj)
   else:data.extend(b)
  if len(data)>2097152 or time.monotonic()-start>120 or peak>805306368 or cpuPeak>90:
   reason='output/wall/RSS/CPU cap';os.killpg(p.pid,signal.SIGKILL);break
 p.wait();sys.stdout.write(data[:8192].decode(errors='replace'))
 with open(R/'git-operations.jsonl','a') as f:f.write(json.dumps(dict(command=cmd,gitDataLimit=536870912,memAvailable=mem,requiredMemAvailable=2415919104,allocationProjection=allocation,peakTreeRSS=peak,peakTreeCPU=cpuPeak,wallSeconds=time.monotonic()-start,outputBytes=len(data),exitCode=p.returncode,stopReason=reason,output=data[:8192].decode(errors='replace')))+'\n')
finally:
 watch.terminate();watch.wait()
sys.exit(p.returncode or (1 if reason else 0))
