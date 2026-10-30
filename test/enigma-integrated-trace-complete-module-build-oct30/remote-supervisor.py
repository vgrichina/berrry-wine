import os,sys,json,pathlib,resource,subprocess,time,signal
ROOT=pathlib.Path('/home/user/enigma-complete').resolve()
M=1048576
assert pathlib.Path.cwd().resolve()==ROOT
original={k:list(resource.getrlimit(getattr(resource,k))) for k in ['RLIMIT_DATA','RLIMIT_AS','RLIMIT_CPU','RLIMIT_FSIZE']}
assert original['RLIMIT_DATA']==[-1,-1] and original['RLIMIT_AS']==[-1,-1],original
resource.setrlimit(resource.RLIMIT_DATA,(256*M,resource.RLIM_INFINITY))
resource.setrlimit(resource.RLIMIT_CPU,(180,180))
resource.setrlimit(resource.RLIMIT_FSIZE,(64*M,64*M))
node='/home/user/.nvm/versions/node/v24.22.1/bin/node'
argv=[node,'--max-old-space-size=3072',str(ROOT/'qualification.js'),sys.argv[1]]
available=int(next(s.split()[1] for s in pathlib.Path('/proc/meminfo').read_text().splitlines() if s.startswith('MemAvailable:')))*1024
allocated=sum(p.lstat().st_blocks*512 for p in ROOT.rglob('*'))+ROOT.lstat().st_blocks*512
assert allocated+64*M<128*M,(allocated,'disk projection')
assert available>= (2048+4352)*M,(available,'memory projection')
assert os.statvfs(ROOT).f_bavail*os.statvfs(ROOT).f_frsize>512*M
reserve=ROOT/'reserve.bin'
if not reserve.exists():
 with reserve.open('wb') as f:
  for _ in range(16):f.write(bytes(M))
env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1',LANG='C.UTF-8',TZ='UTC')
def limits():
 resource.setrlimit(resource.RLIMIT_DATA,(-1,-1))
 resource.setrlimit(resource.RLIMIT_AS,(-1,-1))
 resource.setrlimit(resource.RLIMIT_CPU,(180,180))
 resource.setrlimit(resource.RLIMIT_FSIZE,(64*M,64*M))
def rows():
 r={}
 for p in pathlib.Path('/proc').glob('[0-9]*/stat'):
  try:
   a=p.read_text().rsplit(')',1)[1].split();r[int(p.parent.name)]=(int(a[1]),int(a[21])*4096)
  except (OSError,ValueError):pass
 return r
start=time.monotonic();peak=0;reason=None
with (ROOT/(sys.argv[1]+'.stdout')).open('wb') as out,(ROOT/(sys.argv[1]+'.stderr')).open('wb') as err:
 q=subprocess.Popen(argv,cwd=ROOT,env=env,stdout=out,stderr=err,preexec_fn=limits,start_new_session=True)
 while q.poll() is None:
  r=rows();ids={q.pid}
  while True:
   new=ids|{pid for pid,v in r.items() if v[0] in ids}
   if new==ids:break
   ids=new
  rss=sum(r.get(i,(0,0))[1] for i in ids);peak=max(peak,rss)
  if rss>4096*M:reason='groupRSS'
  if r.get(os.getpid(),(0,0))[1]>256*M:reason='parentRSS'
  if time.monotonic()-start>300:reason='wall'
  if out.tell()+err.tell()>65536:reason='capture'
  if sum(p.lstat().st_blocks*512 for p in ROOT.rglob('*'))>128*M:reason='allocation'
  if reason:os.killpg(q.pid,signal.SIGKILL);q.wait();break
  time.sleep(.08)
record=dict(argv=argv,cwd=str(ROOT),original=original,nodeDATA='unlimited',nodeAS='unlimited',heapMiB=3072,groupRSSMiB=4096,parentRSSMiB=256,available=available,allocated=allocated,peakRSS=peak,elapsed=time.monotonic()-start,exit=q.returncode,denial=reason)
(ROOT/(sys.argv[1]+'-supervisor.json')).write_text(json.dumps(record,indent=2))
print(json.dumps(record));print((ROOT/(sys.argv[1]+'.stdout')).read_text()[:16000]);print((ROOT/(sys.argv[1]+'.stderr')).read_text()[:10000])
sys.exit(1 if reason else q.returncode)
