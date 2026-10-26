import pathlib,subprocess,os,json,hashlib,time,resource,shlex,shutil,selectors,signal
H=pathlib.Path('/tmp/maelstrom-qualified-original-api-capture-recovered-oct26');O=H/'ops';R=H/'repo'
ROOT=pathlib.Path('/home/user/wine-assembly');C=pathlib.Path('/home/user/.codex');BOX='bx_xfbwmcty'
SOURCE='55f9724ef127100c3bb54aebca73e5cda5472c5f';BASE='62b15e94e8898bc5d855392cf7ff639229177e7d'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def sha(b):return hashlib.sha256(b).hexdigest()
def save(n,j):
 p=O/n;t=p.with_name(p.name+'.tmp');t.write_text(json.dumps(j,indent=2)+'\n');t.replace(p)
def alloc(p):
 try:s=p.lstat();return max(s.st_size,s.st_blocks*512)
 except FileNotFoundError:return 0
def size(p):return alloc(p)+sum(alloc(x) for x in p.rglob('*')) if p.is_dir() and not p.is_symlink() else alloc(p)
def glim():
 for k,v in [(resource.RLIMIT_DATA,536870912),(resource.RLIMIT_CPU,90),(resource.RLIMIT_FSIZE,25165824)]:resource.setrlimit(k,(v,v))
def git(*args,cwd=R):
 p=subprocess.Popen(['git','-c','pack.threads=1','-c','pack.window=0','-c','pack.windowMemory=16m',*args],cwd=cwd,env=dict(os.environ,GIT_SSH_COMMAND=SSH),preexec_fn=glim,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
 # Internal blob transport is read in bounded chunks and is never dumped to model output.
 out=bytearray();err=bytearray();sel=selectors.DefaultSelector();start=time.monotonic()
 for f,d in [(p.stdout,out),(p.stderr,err)]:os.set_blocking(f.fileno(),False);sel.register(f,selectors.EVENT_READ,d)
 try:
  while sel.get_map() or p.poll() is None:
   assert time.monotonic()-start<120,'Git wall limit'
   for key,_ in sel.select(.05):
    b=os.read(key.fileobj.fileno(),8192)
    if not b:sel.unregister(key.fileobj);continue
    key.data.extend(b);assert len(key.data)<=25165824 if key.data is out else len(key.data)<=8192
  p.wait(timeout=1)
 finally:
  if p.poll() is None:os.killpg(p.pid,signal.SIGKILL);p.wait()
  sel.close()
 assert p.returncode==0,(args,p.returncode,err.decode(errors='replace'))
 return bytes(out)
def remote(cmd,timeout=30):
 assert len(cmd.encode())<35000
 p=subprocess.run(['/home/user/.ascii/boat','--no-update','exec','--json','--timeout',str(timeout),BOX,cmd],capture_output=True,text=True,timeout=timeout+15)
 assert len(p.stdout.encode())+len(p.stderr.encode())<=8192
 j=json.loads(p.stdout)
 with (O/'api-history.jsonl').open('a') as f:f.write(json.dumps(dict(at=time.time(),requestBytes=len(cmd.encode()),commandSHA256=sha(cmd.encode()),commandId=j.get('commandId'),responseBytes=len(p.stdout.encode())))+'\n')
 if p.returncode or j.get('exitCode')!=0 or any(j.get(k) for k in ['stdoutTruncated','stderrTruncated','oomKilled','timedOut']):save('api-first-failure.json',j);raise RuntimeError(str(j)[:3000])
 return j
def py(s,timeout=30):return remote('python3 -c '+shlex.quote(s),timeout)
def put(p,target=None):
 import base64
 target=str(target or p);b=p.read_bytes()
 for off in range(0,len(b),18000):
  piece=b[off:off+18000]
  s='import pathlib,base64;p=pathlib.Path('+repr(target)+');p.parent.mkdir(parents=True,exist_ok=True);b=base64.b64decode('+repr(base64.b64encode(piece).decode())+');f=p.open('+repr('wb' if off==0 else 'ab')+');f.write(b);f.close();print(p.stat().st_size)'
  j=py(s);assert int(j['stdout'])==min(off+18000,len(b))
 j=py('import hashlib,pathlib,json;p=pathlib.Path('+repr(target)+');h=hashlib.sha256();f=p.open("rb");\nwhile b:=f.read(8192):h.update(b)\nprint(json.dumps(dict(bytes=p.stat().st_size,sha256=h.hexdigest())))')
 assert json.loads(j['stdout'])==dict(bytes=len(b),sha256=sha(b))
 return dict(target=target,bytes=len(b),sha256=sha(b),readback=j['commandId'])
def account(stage,remoteProjection=22000000,extra=0):
 base=json.load(open(O/'db-baseline.json'));sid=os.environ.get('CODEX_SESSION_ID','');sessions=list((C/'sessions/2026/10/26').glob('*'+sid+'*.jsonl')) if sid else []
 charges=dict(local=size(H),remote=remoteProjection,launcher=size(ROOT/'scratch/usage-watch'/H.name),session=sum(alloc(x) for x in sessions),positiveDBWAL=sum(max(0,alloc(p)-base.get(str(p),alloc(p))) for p in C.glob('*.sqlite*')),futureSessionDBPublication=4194304,reserve=8388608,operation=extra)
 mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable')))*1024;free=shutil.disk_usage(H).free
 procs=[]
 for p in pathlib.Path('/proc').iterdir():
  if not p.name.isdigit():continue
  try:
   cmd=(p/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace');rss=int(next((l.split()[1] for l in (p/'status').read_text().splitlines() if l.startswith('VmRSS:')),'0'))*1024
   if rss and any(x in cmd for x in ['codex','node','boat']):procs.append(dict(pid=int(p.name),rss=rss,command=cmd[:180]))
  except (OSError,ProcessLookupError):pass
 j=dict(at=time.time(),charges=charges,total=sum(charges.values()),cap=67108864,memAvailable=mem,liveClients=procs,localProspectiveHelper=201326592,localRemainingFloor=805306368,hostFree=free,hostFloor=2982150144,passChecks=sum(charges.values())<=67108864 and mem>=805306368+201326592 and free-sum(charges.values())>=2982150144,alreadyLiveRSSNotSubtractedAgain=True)
 save('resource-'+stage+'.json',j);assert j['passChecks'],j
 return j
