import pathlib,os,sys,json,time,hashlib,subprocess,resource,fcntl,importlib.util,shlex,base64,zlib,tarfile,io,shutil
H=pathlib.Path('/tmp/enigma-remote-host-validated-startgame-oct27'); O=H/'ops'; ROOT=pathlib.Path('/home/user/wine-assembly'); BOX='bx_95a6wxyt'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
TRUST=pathlib.Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
def sha(b):return hashlib.sha256(b).hexdigest()
def save(n,v):
 p=O/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,indent=2)+'\n')
def alloc(p):
 if not p.exists():return 0
 return sum(x.lstat().st_blocks*512 for x in ([p,*p.rglob('*')] if p.is_dir() else [p]) if x.exists())
def gate(tag):
 if not (O/'baseline.json').exists():save('baseline.json',dict(wal={str(p):alloc(p) for p in pathlib.Path('/home/user/.codex').glob('*.sqlite-wal')}))
 b=json.loads((O/'baseline.json').read_text());wal=sum(max(0,alloc(pathlib.Path(p))-v) for p,v in b['wal'].items())
 tags=[H.name,'airstrike-portable-fixtures-accepted-main-integration-oct27','gta2-census-cleared-driving-oct27','generally-census-cleared-driving-oct27']
 rows=[]
 for t in tags:
  ep=ROOT/'scratch/usage-watch'/t;actual=alloc(pathlib.Path('/tmp')/t)+alloc(ep)
  ev=ep/'events.jsonl'
  if ev.exists():
   with ev.open() as f:tid=json.loads(next(f))['thread_id']
   actual+=sum(alloc(p) for p in pathlib.Path('/home/user/.codex/sessions/2026/10/27').glob('*'+tid+'*'))
  if t==H.name:actual+=wal
  done=(ep/'result.json').exists();allocation=536870912 if t in ('gta2-census-cleared-driving-oct27','generally-census-cleared-driving-oct27') else 201326592;rows.append(dict(task=t,actual=actual,remaining=0 if done else max(0,allocation-actual),projectionQualification='conservative512MiB per newly dispatched census lane' if allocation==536870912 else 'task192MiB'))
 clients=[]
 for p in pathlib.Path('/proc').glob('[0-9]*'):
  try:
   cmd=(p/'cmdline').read_bytes().split(b'\0');st=(p/'stat').read_text().split(') ')[1].split()
   if cmd and pathlib.Path(os.fsdecode(cmd[0])).name=='codex' and b'exec' in cmd:clients.append(dict(pid=int(p.name),rss=int(st[21])*4096))
  except (OSError,IndexError):pass
 own=rows[0]['actual'];free=shutil.disk_usage(H).free;future=sum(r['remaining'] for r in rows)+16777216
 mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 required=sum(max(0,335544320-r['rss']) for r in clients)+536870912+805306368
 v=dict(at=time.time(),rows=rows,walPositiveOnce=wal,own=own,reserve=58720256,free=free,future=future,projectedFree=free-future,diskFloor=2982150144,memAvailable=mem,requiredRAM=required,clients=clients)
 v['pass']=own+58720256<=201326592 and free-future>=2982150144 and mem>=required;save('admission-'+tag+'.json',v);assert v['pass'],v
def api(command,detach=False):
 d=O/'responses';d.mkdir(exist_ok=True);used=sum(p.stat().st_size for p in d.iterdir());assert used+8192<=8388608
 n=str(time.time_ns());save('commands/'+n+'.json',dict(command=command,sha256=sha(command.encode()),detach=detach))
 argv=['/home/user/.ascii/boat','exec','--no-update','--json']+(['--detach'] if detach else ['--timeout','10'])+[BOX,command]
 with (d/(n+'.stdout')).open('xb') as out,(d/(n+'.stderr')).open('xb') as err:
  p=subprocess.Popen(argv,stdout=out,stderr=err);save('requests/'+n+'.start.json',dict(argv=argv[:-1],pid=p.pid,at=time.time(),state='pending'))
  try:r=p.wait(timeout=20)
  except subprocess.TimeoutExpired:
   p.terminate();p.wait();save('requests/'+n+'.terminal.json',dict(uncertain=True,at=time.time()));raise
 raw=(d/(n+'.stdout')).read_bytes();e=(d/(n+'.stderr')).read_bytes();save('requests/'+n+'.terminal.json',dict(exit=r,stdoutBytes=len(raw),stderrBytes=len(e),at=time.time()))
 assert len(raw)+len(e)<=8192 and sum(p.stat().st_size for p in d.iterdir())<=8388608
 assert r==0,('API_DENIAL_OR_FAILURE',n,r)
 j=json.loads(raw);assert not j.get('stdoutTruncated') and not j.get('stderrTruncated'),n
 if not detach:assert j.get('exitCode')==0,(n,j)
 return j
def py(code):return api('python3 -c '+shlex.quote(code))
def put(remote,b,label):
 s=base64.b64encode(zlib.compress(b,6)).decode();wire=remote+'.z64'
 for i in range(0,len(s),48000):
  part=s[i:i+48000];py('import pathlib;p=pathlib.Path('+repr(wire)+');p.parent.mkdir(parents=True,exist_ok=True);f=p.open('+repr('x' if i==0 else 'a')+');f.write('+repr(part)+');f.close();print("ok")')
 py('import pathlib,zlib,base64,hashlib;p=pathlib.Path('+repr(wire)+');b=zlib.decompress(base64.b64decode(p.read_bytes()));assert len(b)=='+str(len(b))+' and hashlib.sha256(b).hexdigest()=='+repr(sha(b))+';q=pathlib.Path('+repr(remote)+');assert not q.exists();q.write_bytes(b);p.unlink();print("verified")')
 save('stage/'+label+'.json',dict(path=remote,bytes=len(b),sha256=sha(b),encoded=len(s)))
def git(label,args):
 def lim():resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
 argv=['git','-c','gc.auto=0','-c','pack.threads=1','-c','pack.window=0',*args]
 with open('/tmp/wine-ops-production-git.lock','a') as l:
  fcntl.flock(l,fcntl.LOCK_EX)
  with (O/(label+'.stdout')).open('xb') as out,(O/(label+'.stderr')).open('xb') as err:
   p=subprocess.Popen(argv,stdout=out,stderr=err,preexec_fn=lim,env=dict(os.environ,GIT_SSH_COMMAND=SSH,GIT_OPTIONAL_LOCKS='0'));r=p.wait(timeout=65)
 save(label+'.json',dict(argv=argv,exit=r,ssh=SSH,GitChildDATA=536870912));assert r==0,(label,r)
 return (O/(label+'.stdout')).read_text().strip()
if __name__=='__main__':
 mode=sys.argv[1]
 if mode=='supervise':
  label=sys.argv[2];kind=sys.argv[3];gate(label);assert sha(TRUST.read_bytes())=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
  s=importlib.util.spec_from_file_location('trusted',TRUST);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
  def check():
   total=sum((O/(label+'.child.'+suffix)).stat().st_size for suffix in ('stdout','stderr') if (O/(label+'.child.'+suffix)).exists())
   return 'output-file-limit' if total>2097152 else None
  r=m.supervise([sys.executable,str(O/'stream-wrapper.py'),label,sys.executable,__file__,kind,*sys.argv[4:]],rss_limit=(256 if kind.startswith('git') else 128)*1048576,cpu_limit=90,wall_limit=120,output_limit=2097152,check=check)
  out=r.pop('output');(O/(label+'.log')).write_bytes(out);save(label+'.execution.json',r);print(out[:3000].decode(errors='replace'));print(json.dumps({k:v for k,v in r.items() if k!='owned'}));assert r['exit']==0 and not r['stopReason']
 elif mode=='git':print(git(sys.argv[2],sys.argv[3:]))
 elif mode in ('script','gitbatch'):exec(pathlib.Path(sys.argv[2]).read_text())
