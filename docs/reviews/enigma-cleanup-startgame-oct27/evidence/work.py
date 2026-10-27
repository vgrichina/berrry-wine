import os,sys,json,pathlib,subprocess,hashlib,time,shutil,resource,shlex,fcntl,importlib.util,concurrent.futures,base64,zlib,threading,tarfile,io
H=pathlib.Path('/tmp/enigma-cleanup-startgame-oct27');O=H/'ops';ROOT=pathlib.Path('/home/user/wine-assembly');BOX='bx_mueag3dn'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def save(n,j):
 p=O/n;t=p.with_name(p.name+'.tmp');t.write_text(json.dumps(j,indent=2)+'\n');t.replace(p)
def sha(b):return hashlib.sha256(b).hexdigest()
def allocated(p):
 if not p.exists():return 0
 return sum(x.lstat().st_blocks*512 for x in ([p,*p.rglob('*')] if p.is_dir() else [p]) if x.exists())
def ext(tag):
 d=ROOT/'scratch/usage-watch'/tag;paths=[d];e=d/'events.jsonl'
 if e.exists():
  with e.open() as f:tid=json.loads(next(f))['thread_id']
  paths+=list(pathlib.Path('/home/user/.codex/sessions/2026/10/27').glob('*'+tid+'*'))
 return sum(allocated(p) for p in paths)
def gate(label):
 if not (O/'baseline.json').exists():save('baseline.json',dict(at=time.time(),wal={str(p):allocated(p) for p in pathlib.Path('/home/user/.codex').glob('*.sqlite-wal')}))
 b=json.loads((O/'baseline.json').read_text());wal=sum(max(0,allocated(pathlib.Path(p))-v) for p,v in b['wal'].items())
 tags=['enigma-cleanup-startgame-oct27','alien-cleanup-menu-mission-oct27','ricochet-cleanup-round-play-oct27','airstrike-cleanup-ordinary-quit-oct27','penguin-causal-independent-accept-cleanup-oct27']
 rows=[]
 for tag in tags:
  used=allocated(pathlib.Path('/tmp')/tag)+ext(tag);rows.append(dict(task=tag,actual=used,remaining=max(0,96*1048576-used)))
 own=next(r['actual'] for r in rows if r['task']==H.name)+wal
 future=sum(r['remaining'] for r in rows)+16*1048576
 free=shutil.disk_usage(H).free;mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 # MemAvailable already excludes live client RSS; charge remaining client promises only.
 clients=[]
 for p in pathlib.Path('/proc').glob('[0-9]*'):
  try:
   cmd=(p/'cmdline').read_bytes().split(b'\0');st=(p/'stat').read_text().split(') ')[1].split()
   if cmd and pathlib.Path(os.fsdecode(cmd[0])).name=='codex' and b'exec' in cmd:clients.append(dict(pid=int(p.name),rss=int(st[21])*4096))
  except (OSError,IndexError):pass
 remainingClients=sum(max(0,320*1048576-r['rss']) for r in clients)+max(0,5-len(clients))*320*1048576
 required=remainingClients+256*1048576+805306368
 j=dict(at=time.time(),rows=rows,walPositiveOnce=wal,own=own,ownAllocation=96*1048576,ownReserve=40*1048576,free=free,future=future,projected=free-future,floor=2982150144,clients=clients,memAvailable=mem,requiredRAM=required)
 j['pass']=own+40*1048576<=96*1048576 and j['projected']>=j['floor'] and mem>=required;save('admission-'+label+'.json',j);assert j['pass'],j
 return j
lock=threading.Lock();inflight_reserved=0
def api(command,detach=False):
 global inflight_reserved
 with lock:
  d=O/'responses';d.mkdir(exist_ok=True);used=sum(x.stat().st_size for x in d.iterdir())
  assert used+inflight_reserved+8192<=1048576,dict(reason='API response budget exhausted BEFORE dispatch',used=used,reserved=inflight_reserved)
  inflight_reserved+=8192
 argv=['/home/user/.ascii/boat','exec','--no-update','--json']+(['--detach'] if detach else ['--timeout','10'])+[BOX,command];t=time.monotonic()
 p=subprocess.run(argv,capture_output=True,timeout=20);raw=p.stdout;err=p.stderr
 with lock:
  inflight_reserved-=8192
  d=O/'responses';d.mkdir(exist_ok=True);n=str(time.time_ns());(d/(n+'.stdout')).write_bytes(raw);(d/(n+'.stderr')).write_bytes(err)
  with (O/'requests.jsonl').open('a') as f:f.write(json.dumps(dict(response=n,argvPrefix=argv[:-1],commandSHA256=sha(command.encode()),commandBytes=len(command.encode()),elapsed=time.monotonic()-t,stdoutBytes=len(raw),stderrBytes=len(err),exit=p.returncode))+'\n')
  assert len(raw)+len(err)<=8192 and sum(x.stat().st_size for x in d.iterdir())<=1048576,'API capture limit'
 assert p.returncode==0,dict(exit=p.returncode,response=n)
 j=json.loads(raw);assert not j.get('stdoutTruncated') and not j.get('stderrTruncated'),j
 if not detach:assert j.get('exitCode')==0,j
 return j
def py(code):return api('python3 -c '+shlex.quote(code))
def put_bytes(remote,data,label):
 compressed=zlib.compress(data,6);encoded=base64.b64encode(compressed).decode();wire=remote+'.z64'
 for i in range(0,len(encoded),48000):
  part=encoded[i:i+48000];py('import pathlib;p=pathlib.Path('+repr(wire)+');p.parent.mkdir(parents=True,exist_ok=True);f=p.open('+repr('x' if i==0 else 'a')+');f.write('+repr(part)+');f.close();print('+repr(str(i)+':'+sha(part.encode()))+')')
 code='import pathlib,base64,zlib,hashlib;p=pathlib.Path('+repr(wire)+');b=zlib.decompress(base64.b64decode(p.read_bytes()));assert len(b)=='+str(len(data))+' and hashlib.sha256(b).hexdigest()=='+repr(sha(data))+';q=pathlib.Path('+repr(remote)+');assert not q.exists();q.write_bytes(b);p.unlink();print("verified '+str(len(data))+' bytes")'
 py(code);save('stage-'+label+'.json',dict(target=remote,bytes=len(data),sha256=sha(data),encodedBytes=len(encoded),maxChunk=48000))
def fetch(remote,name,size,digest,compressed=False):
 start=time.monotonic()
 def one(off):
  code='import pathlib,base64,zlib;b=pathlib.Path('+repr(remote)+').read_bytes();'+('b=zlib.compress(b,9);' if compressed else '')+'print(base64.b64encode(b['+str(off)+':'+str(off+4096)+']).decode())'
  return off,base64.b64decode(py(code)['stdout'].strip(),validate=True)
 pieces={}
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  for off,b in pool.map(one,range(0,size,4096)):pieces[off]=b
 wire=b''.join(pieces[k] for k in sorted(pieces));assert len(wire)==size;data=zlib.decompress(wire) if compressed else wire;assert sha(data)==digest
 (O/name).write_bytes(data);r=dict(path=remote,bytes=len(data),sha256=digest,wireBytes=len(wire),elapsed=time.monotonic()-start,chunk=4096,maxInflight=4);r['passGate']=r['elapsed']<=5;save(name+'.receipt.json',r);return r
def git(args):
 def limits():resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
 with open('/tmp/wine-ops-production-git.lock','a') as l:
  fcntl.flock(l,fcntl.LOCK_EX)
  return subprocess.call(['git','-c','gc.auto=0','-c','pack.threads=1','-c','pack.window=0',*args],preexec_fn=limits,env=dict(os.environ,GIT_SSH_COMMAND=SSH,GIT_OPTIONAL_LOCKS='0'))
if __name__=='__main__':
 a=sys.argv[1:]
 if a[0]=='run':
  gate(a[1]);p=pathlib.Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py');assert sha(p.read_bytes())=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
  s=importlib.util.spec_from_file_location('trusted',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
  r=m.supervise([sys.executable,__file__,*a[2:]],rss_limit=(256 if a[2]=='git' else 128)*1048576,cpu_limit=90,wall_limit=120,output_limit=2097152);out=r.pop('output');(O/(a[1]+'.log')).write_bytes(out);save(a[1]+'.execution.json',r);print(out[:8192].decode(errors='replace'));print(json.dumps(r));assert r['exit']==0 and not r['stopReason']
 elif a[0]=='git':sys.exit(git(a[1:]))
 elif a[0]=='script':exec(pathlib.Path(a[1]).read_text())
