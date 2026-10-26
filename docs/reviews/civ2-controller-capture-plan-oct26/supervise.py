import os,sys,pathlib,json,time,resource,subprocess,selectors,signal,shutil,hashlib,fcntl,datetime
B=pathlib.Path('/tmp/civ2-controller-acceptance-capture-reserve-repair-oct26')
ROOT=pathlib.Path('/home/user/wine-assembly')
N=B.name
SESSION=pathlib.Path('/home/user/.codex/sessions/2026/10/26/rollout-2026-10-26T22-19-45-01a17a4c-5674-7081-97e7-40d3eef7b42e.jsonl')
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def size(p):
 if not p.exists():return 0
 total=0
 for x in [p,*p.rglob('*')] if p.is_dir() else [p]:
  try:total+=x.lstat().st_blocks*512
  except FileNotFoundError:pass # Git atomic lock/rename while measuring.
 return total
def account():
 cfg=B/'ops/wal-baseline.json'
 if not cfg.exists():cfg.write_text(json.dumps({str(p):size(p) for p in pathlib.Path('/home/user/.codex').glob('*-wal')}))
 base=json.loads(cfg.read_text()); peakfile=B/'ops/wal-peak.json'; peaks=json.loads(peakfile.read_text()) if peakfile.exists() else {}
 for p in pathlib.Path('/home/user/.codex').glob('*-wal'):peaks[str(p)]=max(peaks.get(str(p),0),max(0,size(p)-base.get(str(p),0)))
 peakfile.write_text(json.dumps(peaks))
 entries={str(p):size(p) for p in [B,ROOT/'scratch/usage-watch'/N,SESSION]}
 total=sum(entries.values())+sum(peaks.values())
 return dict(entries=entries,positiveWALGrowthOnce=peaks,measuredBytes=total,futureBytes=24*1024**2,reserveBytes=8*1024**2,sourceGitOutputPublicationBudgetBytes=8*1024**2,projectedBytes=total+40*1024**2,allocationBytes=48*1024**2)
def admission():
 a=account();mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable:')))*1024
 clients=[]
 for d in pathlib.Path('/proc').iterdir():
  try:
   cmd=(d/'cmdline').read_bytes().replace(b'\0',b' ').decode()
   if '/bin/codex ' in cmd:
    rss=int(next(l.split()[1] for l in (d/'status').read_text().splitlines() if l.startswith('VmRSS:')))*1024
    clients.append(dict(pid=int(d.name),rss=rss,argv=cmd))
  except (OSError,StopIteration,ValueError):pass
 required=(768+256+64*len(clients))*1024**2
 free=shutil.disk_usage(B).free
 # Other four tasks retain their complete allocations, conservatively remaining.
 remaining=4*96*1024**2+max(0,48*1024**2-a['measuredBytes'])
 r=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),accounting=a,memAvailable=mem,requiredMemAvailable=required,residentClients=clients,unlaunchedClients=0,residentRSSAlreadyDeducted=True,guestReservationReleased=True,diskFree=free,remainingFleetGrowth=remaining,projectedFree=free-remaining,diskFloor=2982150144)
 r['admitted']=mem>=required and r['projectedFree']>=r['diskFloor'] and a['projectedBytes']<=a['allocationBytes']
 (B/'ops/admission.json').write_text(json.dumps(r,indent=2)+'\n')
 if not r['admitted']:raise SystemExit('fresh aggregate admission denied: '+json.dumps({k:v for k,v in r.items() if k not in ('residentClients','accounting')}))
 return r
def proc():
 out={}
 for d in pathlib.Path('/proc').iterdir():
  try:
   s=(d/'stat').read_text();v=s[s.rfind(')')+2:].split();out[int(d.name)]=(int(v[1]),int(v[19]),int(v[21])*os.sysconf('SC_PAGE_SIZE'),(int(v[11])+int(v[12]))/os.sysconf('SC_CLK_TCK'))
  except (OSError,ValueError,IndexError):pass
 return out
mode=sys.argv[1]
if mode=='admit':
 r=admission();print(json.dumps({k:v for k,v in r.items() if k not in ('residentClients',)}));sys.exit(0)
a=admission();git=mode=='git';cmd=['/usr/bin/git','-c','gc.auto=0',*sys.argv[2:]] if git else sys.argv[2:]
env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/home/user','LANG':'C.UTF-8','TZ':'UTC','NODE_PATH':'/tmp/wa-local-runtime-deps/node_modules','GIT_SSH_COMMAND':SSH}
def limits():
 if git:resource.setrlimit(resource.RLIMIT_DATA,(512*1024**2,512*1024**2))
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(24*1024**2,24*1024**2))
lock=open('/tmp/wine-ops-production-git.lock','a') if git else None
if lock:fcntl.flock(lock,fcntl.LOCK_EX)
watch=subprocess.Popen(['tail','-f',str(ROOT/'messageboard.txt')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
start=time.monotonic();p=subprocess.Popen(cmd,cwd=B/'repo',env=env,preexec_fn=limits,start_new_session=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
poolpid=os.getppid()
assert b'light-execution-pool-oct26.py' in pathlib.Path('/proc',str(poolpid),'cmdline').read_bytes(),'required outer pool reservation absent'
sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ);known={};peak=0;cp=0;data=bytearray();count=0;reason=None;nextaccount=0
cap=(256 if git else 128)*1024**2
while sel.get_map() or p.poll() is None:
 table=proc();owned={poolpid,os.getpid(),p.pid,watch.pid}|{pid for pid,v in table.items() if known.get(pid)==v[1]}
 while True:
  more=owned|{pid for pid,v in table.items() if v[0] in owned}
  if more==owned:break
  owned=more
 for pid in owned:
  if pid in table:known[pid]=table[pid][1]
 peak=max(peak,sum(table[pid][2] for pid in owned if pid in table));cp=max(cp,sum(table[pid][3] for pid in owned if pid in table))
 for key,_ in sel.select(.02):
  b=os.read(key.fd,8192)
  if not b:sel.unregister(key.fileobj)
  else:
   count+=len(b)
   if len(data)<2097152:data.extend(b[:2097152-len(data)])
 if peak>cap or cp>90 or time.monotonic()-start>120 or count>2097152:reason='physical/CPU/wall/output limit'
 if time.monotonic()>nextaccount:
  if account()['projectedBytes']>48*1024**2:reason='complete allocation limit'
  nextaccount=time.monotonic()+1
 if reason:
  for pid in owned:
   if pid not in (os.getpid(),poolpid) and pid in table and known.get(pid)==table[pid][1]:
    try:os.kill(pid,signal.SIGKILL)
    except ProcessLookupError:pass
p.wait();watch.terminate();watch.wait()
receipt=dict(command=cmd,environment=env,outerPoolPid=poolpid,outerPoolIncluded=True,gitDataLimit=512*1024**2 if git else None,physicalLimit=cap,cpuLimit=90,wallLimit=120,fileLimit=24*1024**2,outputLimit=2097152,excerptLimit=8192,peakAggregateRSS=peak,peakAggregateCPU=cp,wallSeconds=time.monotonic()-start,outputBytes=count,exitCode=p.returncode,stopReason=reason,output=data[:8192].decode(errors='replace'))
with open(B/'ops/operations.jsonl','a') as f:f.write(json.dumps(receipt)+'\n')
print(receipt['output'],end='');print(json.dumps({k:v for k,v in receipt.items() if k not in ('environment','output')}))
sys.exit(p.returncode or (1 if reason else 0))
