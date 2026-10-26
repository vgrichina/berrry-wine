import pathlib, json, os, subprocess, resource, selectors, time, signal, shutil, hashlib, sys
B=pathlib.Path(__file__).resolve().parent.parent; O=B/'ops'; R=B/'repo'
ROOT=pathlib.Path('/home/user/wine-assembly'); DONOR=pathlib.Path('/tmp/maelstrom-terminal-callback-closure-repair-oct26/repo')
TASK=B.name; SESSION=os.environ.get('CODEX_THREAD_ID',''); BASE='bbcc8685a900c1714e11b2eda4b7ac99f3d6f105'; BRANCH='task/'+TASK
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def dump(p,v):
 p=pathlib.Path(p); t=p.with_name(p.name+'.tmp'); t.write_text(json.dumps(v,indent=2)+'\n');t.replace(p)
def read(p):
 with open(p,'rb') as f:
  b=f.read(65536); assert not f.read(1), ('read limit',str(p))
 return b
def sha(p):
 h=hashlib.sha256()
 with open(p,'rb') as f:
  while True:
   b=f.read(65536)
   if not b:break
   h.update(b)
 return h.hexdigest()
def blocks(p):
 try:s=p.lstat()
 except FileNotFoundError:return 0
 n=s.st_blocks*512
 if p.is_dir() and not p.is_symlink():
  for q in p.iterdir():n+=blocks(q)
 return n
def gate(label):
 C=pathlib.Path('/home/user/.codex'); baseline=json.loads(read(O/'sqlite-baseline.json'))
 charges=dict(owned=blocks(B),launcher=blocks(ROOT/'scratch/usage-watch'/TASK),session=sum(blocks(p) for p in (C/'sessions/2026/10/26').glob('*'+SESSION+'*')),sharedWALSHM=sum(blocks(p) for pat in ['*.sqlite-wal','*.sqlite-shm'] for p in C.glob(pat)),positiveDB=sum(max(0,p.stat().st_size-baseline.get(str(p),p.stat().st_size)) for p in C.glob('*.sqlite')),future=8388608,reserve=8388608,board=16384)
 peak=sum(charges.values()); mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable:')))*1024;free=shutil.disk_usage(B).free
 r=dict(at=time.time(),charges=charges,projected=peak,cap=67108864,memAvailable=mem,ownRAMAllowance=201326592,free=free,projectedFree=free-peak,passGate=peak<=67108864 and mem>=1275068416 and free-peak>=2982150144)
 dump(O/('admission-'+label+'.json'),r)
 if not r['passGate']:raise RuntimeError(r)
 return r
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
 resource.setrlimit(resource.RLIMIT_AS,(134217728,resource.RLIM_INFINITY))
def child_limits(argv):
 limits()
 if pathlib.Path(argv[0]).name.startswith('python'):
  resource.setrlimit(resource.RLIMIT_AS,(134217728,resource.RLIM_INFINITY))
 else:
  resource.setrlimit(resource.RLIMIT_AS,(resource.RLIM_INFINITY,resource.RLIM_INFINITY))
def run(label,argv,cwd=R,expected=0):
 gate(label)
 assert sum(p.stat().st_size for p in O.glob('*.log')) < 1966080, 'capture budget'
 env=dict(os.environ,GIT_SSH_COMMAND=SSH,NODE_OPTIONS='--max-old-space-size=128',MNE_SOURCE_ROOT='/tmp/maelstrom-native-latch-rejection-reason-oct26/ops/pinned-source',MNE_ORIGINAL_ROOT='/tmp/maelstrom-frozen-original-recovered-capture-oct25/vfs/maelstrom',MNE_CRT='/tmp/maelstrom-frozen-original-recovered-capture-oct25/runtime/system/msvcrt.dll',MNE_REVIEW_REPO=str(R),PYTHONDONTWRITEBYTECODE='1')
 p=subprocess.Popen(argv,cwd=cwd,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True,preexec_fn=lambda:child_limits(argv));sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ);out=bytearray();start=time.monotonic();reason=None
 while sel.get_map():
  if time.monotonic()-start>60:reason='wall';break
  for k,_ in sel.select(.1):
   d=os.read(k.fileobj.fileno(),8192)
   if not d:sel.unregister(k.fileobj)
   else:out.extend(d)
  if len(out)>131072:reason='output';break
 if reason:
  os.killpg(p.pid,signal.SIGTERM)
  try:p.wait(timeout=5)
  except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait(timeout=5)
 else:p.wait(timeout=5)
 log=O/(label+'.log');log.write_bytes(out[:131072]); row=dict(label=label,argv=argv,cwd=str(cwd),code=p.returncode,expected=expected,reason=reason,bytes=len(out),seconds=time.monotonic()-start,reaped=True,log=str(log))
 with open(O/'commands.jsonl','a') as f:f.write(json.dumps(row)+'\n')
 if p.returncode!=expected or reason:raise RuntimeError(str(row)+' '+out[:2000].decode(errors='replace'))
 return out.decode().strip()
def git(label,*args):return run(label,['git','-C',str(R),*args])
def checkpoint(label,result,fixtures,remaining):
 paths=['tools/maelstrom-original-errno-adapter.cjs','tools/maelstrom-native-errno-latch.cjs','tools/maelstrom-select-completion-hook.cjs']+fixtures
 pins={p:sha(R/p) for p in paths}
 dump(O/('checkpoint-'+label+'.json'),dict(base=BASE,head=git('head-'+label,'rev-parse','HEAD'),sourceFixtures=pins,result=result,remaining=remaining,blockers=[],evidence=str(O/(label+'.log'))))
if __name__=='__main__':
 limits();signal.alarm(60)
 label=sys.argv[1]
 if label=='read':
  gate('read-'+str(time.time_ns()));print(read(sys.argv[2])[int(sys.argv[3]) if len(sys.argv)>3 else 0:][:8192].decode())
 elif label=='gate':print(json.dumps(gate(sys.argv[2])))
 else:print(run(label,sys.argv[2:],cwd=R if R.exists() else B)[:8192])
