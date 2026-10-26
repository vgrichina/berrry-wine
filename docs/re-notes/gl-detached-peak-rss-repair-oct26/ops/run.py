import os,sys,pathlib,json,resource,subprocess,time,hashlib,shutil,signal,ctypes
H=pathlib.Path('/tmp/gl-detached-peak-rss-repair-oct26'); R=pathlib.Path('/home/user/wine-assembly'); OLD=pathlib.Path('/tmp/gl-launch-controls-retained-challenges-oct26'); S=pathlib.Path('/tmp/gl-browser-launch-control-repair-oct26/source')
os.environ.update(PYTHONDONTWRITEBYTECODE='1',GIT_SSH_COMMAND='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes',GIT_CONFIG_COUNT='2',GIT_CONFIG_KEY_0='gc.auto',GIT_CONFIG_VALUE_0='0',GIT_CONFIG_KEY_1='maintenance.auto',GIT_CONFIG_VALUE_1='false')
name=sys.argv[1]; cmd=sys.argv[2:]; M=1048576
def allocated(p):
 try: return sum(q.lstat().st_blocks*512 for q in ([p,*p.rglob('*')] if p.is_dir() else [p]) if not q.is_symlink())
 except FileNotFoundError: return 0
roots=[H,R/'scratch/usage-watch/gl-detached-peak-rss-repair-oct26']
roots+=list(pathlib.Path('/home/user/.codex/sessions/2026/10/26').glob('*'+os.environ['CODEX_THREAD_ID']+'*'))
baseline=H/'ops/disk-baseline.json'
if not baseline.exists():
 baseline.write_text(json.dumps(dict(wal={str(p):allocated(p) for p in pathlib.Path('/home/user/.codex').glob('*-wal')},old=allocated(OLD))))
base=json.loads(baseline.read_text())
def disk():
 components={str(p):allocated(p) for p in roots}
 components['positiveWALOnce']=sum(max(0,allocated(pathlib.Path(p))-n) for p,n in base['wal'].items())
 components['reproducerFixedPathGrowth']=max(0,allocated(OLD)-base['old'])
 components['futureGrowth']=8*M;components['reserve']=8*M
 return dict(components=components,total=sum(components.values()),projectedFree=shutil.disk_usage(H).free-48*M)
clients=[]
for p in pathlib.Path('/proc').iterdir():
 try:
  argv=(p/'cmdline').read_bytes().split(b'\0')
  if argv[0].startswith(b'/opt/') and b'/bin/codex' in argv[0] and b'exec' in argv:
   clients.append(dict(pid=int(p.name),rss=int((p/'statm').read_text().split()[1])*4096,argv=[a.decode() for a in argv if a]))
 except (OSError,ValueError,IndexError): pass
mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
increments=sum(max(0,320*M-p['rss']) for p in clients)
required=max(2596319232,(256+768+768+3*64)*M+increments)
ad=dict(memAvailable=mem,required=required,clients=clients,clientUnconsumed320MiB=increments,taskCap=256*M,CivCap=768*M,hostReserve=768*M,helperCaps=[64*M]*3,disk=disk(),mountArgv=None,mountValidation='N/A: no guest, mount, or filename-bearing mount argv',GitSSH=os.environ['GIT_SSH_COMMAND'],limits=dict(CPU=90,wall=120,file=24*M,output=2*M,excerpt=8192,treeRSS=256*M,GitDATA='512MiB Git child only',DATA=resource.getrlimit(resource.RLIMIT_DATA),AS=resource.getrlimit(resource.RLIMIT_AS)))
(H/'ops'/f'{name}-admission.json').write_text(json.dumps(ad,indent=2))
assert mem>=required and ad['disk']['total']<=64*M and ad['disk']['projectedFree']>=2982150144,ad
inputs=json.loads((R/'scratch/usage-watch/gl-detached-peak-rss-repair-oct26-handoff.json').read_text())
for f in inputs['files']: assert hashlib.sha256((S/f['path']).read_bytes()).hexdigest()==f['sha256']
(H/'ops/inputs.json').write_text(json.dumps(inputs,indent=2))
def limits():
 for k,n in [(resource.RLIMIT_CPU,90),(resource.RLIMIT_FSIZE,24*M)]:
  a,b=resource.getrlimit(k);resource.setrlimit(k,(min(a,n) if a>=0 else n,min(b,n) if b>=0 else n))
 if cmd[0]=='/usr/bin/git': resource.setrlimit(resource.RLIMIT_DATA,(512*M,512*M))
os.environ['PALETTE_BROWSER_RESOURCE_CONFIG']=json.dumps(dict(roots=[str(p) for p in roots],reserve=8*M,future=8*M,walBaseline=base['wal']))
os.environ['TMPDIR']=str(H/'tmp')
assert ctypes.CDLL(None).prctl(36,1,0,0,0)==0
def rows():
 result={}
 for q in pathlib.Path('/proc').iterdir():
  try:
   raw=(q/'stat').read_text(); f=raw[raw.rindex(')')+2:].split();result[int(q.name)]=(int(f[1]),f[19],max(0,int(f[21]))*4096,sum(int(f[i]) for i in (11,12,13,14))/os.sysconf('SC_CLK_TCK'))
  except (OSError,ValueError,IndexError): pass
 return result
before=rows();existing={(pid,r[1]) for pid,r in before.items() if r[0]==os.getpid()}
p=subprocess.Popen(cmd,cwd=H/'repo',env=os.environ,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,preexec_fn=limits,start_new_session=True)
os.set_blocking(p.stdout.fileno(),False);out=bytearray();peak=0;start=time.monotonic();reason=None;identities={};cpu={}
while True:
 try: out.extend(os.read(p.stdout.fileno(),65536))
 except BlockingIOError: pass
 rr=rows(); selected={pid:r for pid,r in rr.items() if pid==p.pid or (pid,r[1]) in identities or (r[0]==os.getpid() and (pid,r[1]) not in existing)}
 changed=True
 while changed:
  changed=False
  for pid,r in rr.items():
   if pid not in selected and r[0] in selected: selected[pid]=r;changed=True
 for pid,r in selected.items(): identities[(pid,r[1])]=r;cpu[(pid,r[1])]=max(cpu.get((pid,r[1]),0),r[3])
 rss=sum(r[2] for r in selected.values())+rr.get(os.getpid(),(0,0,0,0))[2];peak=max(peak,rss)
 if sum(cpu.values())>90 or rss>256*M or len(out)>2*M or time.monotonic()-start>120 or disk()['total']>64*M: reason='outer resource gate'
 if reason:
  for pid,r in selected.items():
   try:
    fd=os.pidfd_open(pid)
    try:
     if rows().get(pid,(None,None))[1]==r[1]: signal.pidfd_send_signal(fd,signal.SIGKILL)
    finally: os.close(fd)
   except ProcessLookupError: pass
 if p.poll() is not None and not any(pid!=p.pid and r[2]>0 for pid,r in selected.items()): break
 time.sleep(.003)
data=p.stdout.read();out.extend(data or b'')
remaining=[]
for pid,r in rows().items():
 if (pid,r[1]) in identities:
  try: os.waitpid(pid,os.WNOHANG)
  except ChildProcessError: pass
for pid,r in rows().items():
 if (pid,r[1]) in identities: remaining.append([pid,r[1]])
rec=dict(argv=cmd,exit=p.returncode,stopReason=reason,peakRSS=peak,cpuSeconds=sum(cpu.values()),owned=[list(k) for k in identities],remainingOwned=remaining,wall=time.monotonic()-start,outputBytes=len(out),disk=disk())
(H/'ops'/f'{name}.log').write_bytes(out[:2*M]);(H/'ops'/f'{name}.json').write_text(json.dumps(rec,indent=2));print(json.dumps(rec));print(out[:8192].decode(errors='replace'))
sys.exit(1 if reason else p.returncode)
