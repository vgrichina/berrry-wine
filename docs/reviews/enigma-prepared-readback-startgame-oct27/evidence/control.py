import os,sys,json,pathlib,subprocess,hashlib,time,shutil,resource,shlex,fcntl,importlib.util,concurrent.futures,base64,zlib,threading
H=pathlib.Path('/tmp/enigma-prepared-readback-startgame-oct27');O=H/'ops';ROOT=pathlib.Path('/home/user/wine-assembly');OLD=pathlib.Path('/tmp/enigma-separated-stream-runtime-oct27');BOX='bx_nmvbu5c7'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def save(n,j): (O/n).write_text(json.dumps(j,indent=2)+'\n')
def sha(b):return hashlib.sha256(b).hexdigest()
def allocated(p):
 if not p.exists():return 0
 return sum(x.lstat().st_blocks*512 for x in ([p,*p.rglob('*')] if p.is_dir() else [p]) if x.exists())
def ext(tag):
 paths=list((ROOT/'scratch/usage-watch').glob(tag+'*'));e=ROOT/'scratch/usage-watch'/tag/'events.jsonl'
 if e.exists():
  with e.open() as f:tid=json.loads(next(f))['thread_id']
  paths+=list(pathlib.Path('/home/user/.codex/sessions/2026/10/27').glob('*'+tid+'*'))
 return sum(allocated(p) for p in paths)
def gate(label):
 b=json.loads((O/'baseline.json').read_text());wal=sum(max(0,allocated(p)-b['wal'].get(str(p),0)) for p in pathlib.Path('/home/user/.codex').glob('*.sqlite-wal'))
 own=allocated(H)+ext(H.name)+wal;peer=allocated(pathlib.Path('/tmp/airstrike-bridge-retained-main-publication-oct27'))+ext('airstrike-bridge-retained-main-publication-oct27');free=shutil.disk_usage(H).free;mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 j=dict(at=time.time(),own=own,walPositive=wal,allocation=25165824,reserve=8388608,peerMaterial=peer,peerRemaining=max(0,33554432-peer),free=free,projected=free-max(0,25165824-own)-max(0,33554432-peer)-8388608,floor=2982150144,memAvailable=mem,required=1610612736)
 j['pass']=own+8388608<=25165824 and j['projected']>=j['floor'] and mem>=j['required'];save('admission-'+label+'.json',j);assert j['pass'],j
 return j
lock=threading.Lock()
def py(code):
 cmd='python3 -c '+shlex.quote(code);argv=['/home/user/.ascii/boat','exec','--no-update','--json','--timeout','10',BOX,cmd];t=time.monotonic();p=subprocess.run(argv,capture_output=True,timeout=20)
 raw=p.stdout;err=p.stderr;assert len(raw)+len(err)<=8192
 with lock:
  total=sum(p.stat().st_size for p in (O/'responses').glob('*')) if (O/'responses').exists() else 0
  assert total+len(raw)+len(err)<=1048576,('cumulative API response budget',total,len(raw))
  d=O/'responses';d.mkdir(exist_ok=True);n=str(time.time_ns());(d/(n+'.json')).write_bytes(raw);(d/(n+'.stderr')).write_bytes(err)
  with (O/'requests.jsonl').open('a') as f:f.write(json.dumps(dict(response=n,command=cmd,elapsed=time.monotonic()-t,bytes=len(raw)+len(err),exit=p.returncode))+'\n')
 j=json.loads(raw);assert p.returncode==0 and j.get('exitCode')==0 and not j.get('stdoutTruncated') and not j.get('stderrTruncated'),j
 return j
def fetch(path,name,size,digest,compressed=False):
 start=time.monotonic();chunk=4096
 def one(off):
  code='import pathlib,base64,zlib; b=pathlib.Path('+repr(path)+').read_bytes();'+('b=zlib.compress(b,9);' if compressed else '')+'print(base64.b64encode(b['+str(off)+':'+str(off+chunk)+']).decode())'
  return off,base64.b64decode(py(code)['stdout'].strip(),validate=True)
 pieces={}
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  for off,b in pool.map(one,range(0,size,chunk)):pieces[off]=b
 wire=b''.join(pieces[k] for k in sorted(pieces));assert len(wire)==size
 data=zlib.decompress(wire) if compressed else wire;assert sha(data)==digest
 (O/name).write_bytes(data);elapsed=time.monotonic()-start
 receipt=dict(path=path,bytes=len(data),wireBytes=len(wire),sha256=sha(data),elapsed=elapsed,chunk=chunk,maxInflight=4,responses=sum(p.stat().st_size for p in (O/'responses').glob('*')),passGate=elapsed<=5)
 save(name+'.receipt.json',receipt);print(json.dumps(receipt));return receipt
def git(args):
 def limits():resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
 with open('/tmp/wine-ops-production-git.lock','a') as l:
  fcntl.flock(l,fcntl.LOCK_EX)
  return subprocess.call(['git','-c','gc.auto=0','-c','pack.threads=1','-c','pack.window=0',*args],preexec_fn=limits,env=dict(os.environ,GIT_SSH_COMMAND=SSH,GIT_OPTIONAL_LOCKS='0'))
if __name__=='__main__':
 a=sys.argv[1:]
 if a[0]=='run':
  if not (O/'baseline.json').exists():save('baseline.json',dict(at=time.time(),wal={str(p):allocated(p) for p in pathlib.Path('/home/user/.codex').glob('*.sqlite-wal')}))
  gate(a[1]);s=importlib.util.spec_from_file_location('s','/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
  r=m.supervise([sys.executable,__file__,*a[2:]],rss_limit=(256 if a[2]=='git' else 128)*1048576,cpu_limit=90,wall_limit=120,output_limit=2097152);out=r.pop('output');(O/(a[1]+'.log')).write_bytes(out);save(a[1]+'.execution.json',r);print(out[:8192].decode());print(json.dumps({k:v for k,v in r.items() if k!='owned'}));assert r['exit']==0 and not r['stopReason']
 elif a[0]=='git':sys.exit(git(a[1:]))
 elif a[0]=='script':exec(pathlib.Path(a[1]).read_text())
