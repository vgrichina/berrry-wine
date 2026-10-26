import pathlib,subprocess,json,os,hashlib,shutil,time,shlex,resource
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';R=H/'repo';ROOT=pathlib.Path('/home/user/wine-assembly');C=pathlib.Path('/home/user/.codex');W=ROOT/'scratch/usage-watch'/H.name
BOX='bx_vs4xtsz3';REV='c6279bb936462834ccd9b51ea99a684a5befcda3';DONOR=pathlib.Path('/tmp/maelstrom-current-main-uop-build-native-oct26');S=pathlib.Path('/tmp/maelstrom-frozen-original-recovered-capture-oct25');OLD=pathlib.Path('/tmp/maelstrom-accepted-diagnostic-original-capture-oct26')
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def save(n,j):(O/n).write_text(json.dumps(j,indent=2)+'\n')
def sha(b):return hashlib.sha256(b).hexdigest()
def alloc(p):
 try:s=p.lstat();return max(s.st_size,s.st_blocks*512)
 except FileNotFoundError:return 0
def size(p):return alloc(p)+sum(alloc(f) for f in p.rglob('*')) if p.is_dir() and not p.is_symlink() else alloc(p)
def glim():
 for k,v in [(resource.RLIMIT_DATA,536870912),(resource.RLIMIT_CPU,90),(resource.RLIMIT_FSIZE,25165824)]:resource.setrlimit(k,(v,v))
def git(*a,cwd=R):
 p=subprocess.run(['git','-c','pack.threads=1','-c','pack.window=0','-c','pack.windowMemory=16m',*a],cwd=cwd,env=dict(os.environ,GIT_SSH_COMMAND=SSH),preexec_fn=glim,capture_output=True,timeout=120)
 assert len(p.stdout)+len(p.stderr)<=131072
 if p.returncode:raise RuntimeError(str((a,p.returncode,p.stderr[:2000])))
 return p.stdout
def blob(p):
 # Source blobs may exceed the capture cap: redirect to bounded in-memory pipe,
 # never tool output. User source closure explicitly authorizes these reads.
 return subprocess.check_output(['git','show',REV+':'+p],cwd=DONOR/'repo',preexec_fn=glim,timeout=120)
def remote(cmd,timeout=30,detach=False):
 assert len(cmd.encode())<=36000
 args=['/home/user/.ascii/boat','--no-update','--json','exec']
 if detach:args+=['--detach']
 else:args+=['--timeout',str(timeout)]
 p=subprocess.run(args+[BOX,cmd],capture_output=True,text=True,timeout=timeout+15)
 assert len(p.stdout.encode())+len(p.stderr.encode())<=131072
 try:j=json.loads(p.stdout)
 except Exception:save('api-error.json',dict(returncode=p.returncode,stdout=p.stdout[:4000],stderr=p.stderr[:4000]));raise
 with (O/'api-history.jsonl').open('a') as f:f.write(json.dumps(dict(at=time.time(),requestBytes=len(cmd.encode()),responseBytes=len(p.stdout.encode())+len(p.stderr.encode()),commandSHA256=sha(cmd.encode()),commandId=j.get('commandId'),detach=detach))+'\n')
 if p.returncode or (not detach and j.get('exitCode')!=0) or any(j.get(k) for k in ['stdoutTruncated','stderrTruncated','oomKilled','timedOut']):save('api-error.json',j);raise RuntimeError(str(j)[:2000])
 return j
def py(s,timeout=30):return remote('python3 -c '+shlex.quote(s),timeout)
def put(p,target):
 b=p.read_bytes()
 import zlib,base64
 for off in range(0,len(b),18000):
  enc=base64.b64encode(zlib.compress(b[off:off+18000])).decode()
  py('import pathlib,zlib,base64;p=pathlib.Path('+repr(str(target))+');p.parent.mkdir(parents=True,exist_ok=True);p.open('+repr('wb' if off==0 else 'ab')+').write(zlib.decompress(base64.b64decode('+repr(enc)+')));print("ok")')
 j=py('import pathlib,hashlib,json;p=pathlib.Path('+repr(str(target))+');b=p.read_bytes();print(json.dumps(dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())))')
 assert json.loads(j['stdout'])==dict(bytes=len(b),sha256=sha(b))
 return dict(target=str(target),bytes=len(b),sha256=sha(b),readbackCommand=j.get('commandId'))
def account(stage,remoteBytes=None,remoteProjection=27510736):
 base=json.load(open(O/'db-baseline.json'));session=list((C/'sessions/2026/10/26').glob('*01a17792-ce1d-7f43-8678-8bcdabd5c979.jsonl'));assert len(session)==1
 charges=dict(localAllMetadata=size(H),remoteAllMetadata=max(remoteBytes or 0,remoteProjection),launcherAllMetadata=size(W),sessionAllMetadata=size(session[0]),positiveDB=sum(max(0,alloc(p)-base.get(str(p),0)) for p in C.glob('*.sqlite')),WALSHMOnce=sum(alloc(p) for p in C.glob('*.sqlite-*')),futurePublicationSessionOnce=4194304,positiveDBFutureOnce=2097152,reserve=8388608)
 mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable')))*1024;free=shutil.disk_usage(H).free;peak=sum(charges.values())
 j=dict(at=time.time(),charges=charges,peak=peak,cap=67108864,memAvailable=mem,client=536870912,helper=16777216,remainingFloor=805306368,diskFree=free,diskFloor=2982150144,passChecks=peak<=67108864 and mem>=1895825408 and free-charges['futurePublicationSessionOnce']-charges['positiveDBFutureOnce']-charges['reserve']>=2982150144)
 save('resource-'+stage+'.json',j);assert j['passChecks'],j;return j
def remoteInventory():
 j=py('import pathlib,json,shutil,os,resource;h=pathlib.Path('+repr(str(H))+');a=lambda p:max(p.lstat().st_size,p.lstat().st_blocks*512);q=pathlib.Path("/home/user/.ascii/processes");owned=sum(a(p) for p in [h,*h.rglob("*")]) if h.exists() else 0;external=a(q)+sum(a(p) for p in q.rglob("*") if p.lstat().st_mtime>1793007420) if q.exists() else 0;print(json.dumps(dict(uid=os.getuid(),pid=os.getpid(),allocated=owned+external,ownedTreeAllocated=owned,processArtifactsAllocated=external,memAvailable=int(next(l.split()[1] for l in open("/proc/meminfo") if l.startswith("MemAvailable")))*1024,free=shutil.disk_usage("/tmp").free,limits={str(k):resource.getrlimit(k) for k in [resource.RLIMIT_DATA,resource.RLIMIT_AS,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE]})))')
 return json.loads(j['stdout'])
