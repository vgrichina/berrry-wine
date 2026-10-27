import os,sys,json,pathlib,subprocess,hashlib,time,shutil,resource,shlex,base64,zlib,fcntl,importlib.util
H=pathlib.Path('/tmp/enigma-separated-stream-runtime-oct27');O=H/'ops';ROOT=pathlib.Path('/home/user/wine-assembly');R=str(H);BOX='bx_nmvbu5c7';TAG=H.name
NODE='/home/user/.nvm/versions/node/v24.22.1/bin/node'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
SUP=pathlib.Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
def sha(b):return hashlib.sha256(b).hexdigest()
def save(n,j):
 p=O/n;t=p.with_suffix('.new');t.write_text(json.dumps(j,indent=2)+'\n');t.replace(p)
def allocated(p):
 if not p.exists():return 0
 return sum(x.lstat().st_blocks*512 for x in ([p,*p.rglob('*')] if p.is_dir() else [p]) if x.exists())
def ext(tag):
 paths=list((ROOT/'scratch/usage-watch').glob(tag+'*'));e=ROOT/'scratch/usage-watch'/tag/'events.jsonl'
 if e.exists():
  with e.open() as f:thread=json.loads(next(f))['thread_id']
  paths+=list(pathlib.Path('/home/user/.codex/sessions/2026/10/27').glob('*'+thread+'*'))
 return sum(allocated(p) for p in paths)
def gate(label):
 b=json.loads((O/'baseline.json').read_text());wal=sum(max(0,allocated(p)-b['wal'].get(str(p),0)) for p in pathlib.Path('/home/user/.codex').glob('*.sqlite-wal'))
 own=allocated(H)+ext(TAG)+wal;peer=allocated(pathlib.Path('/tmp/airstrike-bridge-independent-accept-oct27'))+ext('airstrike-bridge-independent-accept-oct27')
 free=shutil.disk_usage(H).free;mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 j=dict(at=time.time(),label=label,own=own,allocation=33554432,reserve=8388608,peerMaterial=peer,peerFuture=max(0,29360128-peer),wal=wal,free=free,projected=free-max(0,33554432-own)-max(0,29360128-peer)-8388608,floor=2982150144,memAvailable=mem,required=1610612736)
 j['pass']=own+8388608<=33554432 and j['projected']>=j['floor'] and mem>=j['required'];save('accounting-'+label+'.json',j)
 assert j['pass'],j
 return j
def remote(cmd,timeout=30,detach=False):
 assert len(cmd.encode())<60000
 a=['/home/user/.ascii/boat','exec','--no-update','--json']+(['--detach'] if detach else ['--timeout',str(timeout)])+[BOX,'timeout 120 '+cmd]
 p=subprocess.run(a,capture_output=True,text=True,timeout=timeout+15)
 assert len(p.stdout.encode())+len(p.stderr.encode())<=8192
 j=json.loads(p.stdout)
 with (O/'api-history.jsonl').open('a') as f:f.write(json.dumps(dict(at=time.time(),command=cmd if len(cmd)<2000 else None,sha256=sha(cmd.encode()),requestBytes=len(cmd.encode()),responseBytes=len(p.stdout.encode()),exit=p.returncode))+'\n')
 if p.returncode or (not detach and j.get('exitCode')!=0) or j.get('stdoutTruncated') or j.get('stderrTruncated'):
  save('api-failure-'+str(time.time_ns())+'.json',j);raise RuntimeError('API failure; no unchanged retry')
 return j
def py(code,**kw):return remote('python3 -c '+shlex.quote(code),**kw)
def transfer(items):
 batch=[];size=0
 def flush():
  nonlocal batch,size
  if not batch:return
  code='import pathlib,base64,zlib,hashlib,os\nh=pathlib.Path('+repr(R)+')\n'
  for path,off,mode,data in batch:
   enc=base64.b64encode(zlib.compress(data)).decode()
   code+='p=h/'+repr(path)+';p.parent.mkdir(parents=True,exist_ok=True);b=zlib.decompress(base64.b64decode('+repr(enc)+'));assert hashlib.sha256(b).hexdigest()=='+repr(sha(data))+';p.open('+repr('wb' if off==0 else 'ab')+').write(b);os.chmod(p,'+str(mode)+')\n'
  py(code);batch=[];size=0
 for target,p in items:
  mode=p.stat().st_mode&0o777
  if p.stat().st_size==0:
   if size+600>48000:flush()
   batch.append((target,0,mode,b''));size+=600;continue
  with p.open('rb') as f:
   off=0
   while b:=f.read(30000):
    n=len(base64.b64encode(zlib.compress(b)))+600
    if size+n>48000:flush()
    batch.append((target,off,mode,b));size+=n;off+=len(b)
 flush()
def run(label,args,git=False):
 gate(label)
 spec=importlib.util.spec_from_file_location('sup',SUP);s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
 with open('/tmp/wine-ops-production-git.lock' if git else O/'light.lock','a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX)
  v=s.supervise(args,rss_limit=(256 if git else 128)*1048576,cpu_limit=90,wall_limit=120,output_limit=2097152,check=lambda: None)
 out=v.pop('output');(O/(label+'.log')).write_bytes(out);save(label+'-execution.json',v)
 print(json.dumps({k:v[k] for k in v if k!='owned'}));print(out[:8192].decode(errors='replace'));assert not v['stopReason'] and v['exit']==0
def directgit(args):
 def limits():resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
 return subprocess.run(['git','-c','gc.auto=0','-c','pack.threads=1','-c','pack.window=0','-c','pack.windowMemory=16m',*args],preexec_fn=limits,env=dict(os.environ,GIT_SSH_COMMAND=SSH,GIT_OPTIONAL_LOCKS='0',TMPDIR=str(O))).returncode
if __name__=='__main__':
 if sys.argv[1]=='baseline':
  save('baseline.json',dict(at=time.time(),wal={str(p):allocated(p) for p in pathlib.Path('/home/user/.codex').glob('*.sqlite-wal')}));print(gate('initial'))
 elif sys.argv[1]=='directgit':sys.exit(directgit(sys.argv[2:]))
 elif sys.argv[1]=='git':run(sys.argv[2],[sys.executable,__file__,'directgit',*sys.argv[3:]],True)
 else:run(sys.argv[1],sys.argv[2:])
