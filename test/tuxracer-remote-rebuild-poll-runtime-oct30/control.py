"""Task-owned bounded supervisor; donor metadata and sources remain read-only."""
import os,sys,pathlib,json,time,resource,subprocess,signal,hashlib,gzip
O=pathlib.Path(__file__).resolve().parent; G=O/'publication.git'; M=1048576
ROOT=pathlib.Path('/home/user/wine-assembly'); LAUNCH=ROOT/'scratch/usage-watch/tuxracer-remote-rebuild-poll-runtime-oct30'
PREV=O.parent/'post-title-poll-recovered-runtime/completion-receipt.json'
ROOTS=[pathlib.Path(p) for p in json.loads(PREV.read_text())['allocation']['beforeReceipt']['sizes']]+[LAUNCH]
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
ORIG={k:resource.getrlimit(k) for k in [resource.RLIMIT_DATA,resource.RLIMIT_AS,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE]}
def cap(k,n):
 s,h=resource.getrlimit(k);resource.setrlimit(k,(min(n,s) if s!=-1 else min(n,h) if h!=-1 else n,h))
cap(resource.RLIMIT_DATA,128*M);cap(resource.RLIMIT_CPU,90);cap(resource.RLIMIT_FSIZE,12*M)
def save(n,v):
 p=O/n;p.parent.mkdir(exist_ok=True);p.write_text(json.dumps(v,indent=2)+'\n')
def allocated(p):return sum(x.lstat().st_blocks*512 for x in [p,*p.rglob('*')]) if p.exists() else 0
def admission(publication=False):
 sizes={str(p):allocated(p) for p in ROOTS};used=sum(sizes.values());s=os.statvfs(O);free=s.f_bavail*s.f_frsize
 forecast=8*M+(0 if publication else 524288+262144+262144)
 v=dict(at=time.time(),device=O.stat().st_dev,f_bavail=s.f_bavail,blockSize=s.f_frsize,sizes=sizes,used=used,budget=64*M,reserve=8*M,futureGrowth=forecast,free=free,remainingAggregate=267292672,diskFloor=2147483648,RAMAdmission=False,MemAvailable=next(x for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')),checks=dict(allocation=used+forecast<=64*M,disk=free-267292672>=2147483648))
 save('admission.json',v)
 if not all(v['checks'].values()):
  if not (O/'first-denial.json').exists():save('first-denial.json',v)
  raise RuntimeError('allocation/disk denied')
 return v
def checkcwd(cwd):
 p=pathlib.Path(cwd).resolve();assert p==O or p.is_relative_to(O),'unowned cwd';return p
def run(name,args,*,cwd,git=False,wall=120,input=None,allowed=(0,),expect_capture=False,publication=False):
 p=checkcwd(cwd);admission(publication)
 env=dict(os.environ,GIT_SSH_COMMAND=SSH,GIT_NO_LAZY_FETCH='1',PYTHONDONTWRITEBYTECODE='1',BOAT_NO_UPDATE='1')
 def limits():
  if git:
   h=ORIG[resource.RLIMIT_DATA][1];resource.setrlimit(resource.RLIMIT_DATA,(min(256*M,h) if h!=-1 else 256*M,h))
  cap(resource.RLIMIT_CPU,90);cap(resource.RLIMIT_FSIZE,12*M)
 out=O/'live.stdout';err=O/'live.stderr';start=time.monotonic();peak=0;reason=None
 with out.open('wb') as x,err.open('wb') as y:
  q=subprocess.Popen(args,cwd=p,env=env,preexec_fn=limits,stdin=subprocess.PIPE,stdout=x,stderr=y,start_new_session=True)
  if input:q.stdin.write(input)
  q.stdin.close()
  while True:
   rows={}
   for f in pathlib.Path('/proc').glob('[0-9]*/stat'):
    try:s=f.read_text().rsplit(')',1)[1].split();rows[int(f.parent.name)]=(int(s[1]),int(s[21])*4096)
    except (OSError,ValueError):pass
   ids={q.pid}
   while True:
    new=ids|{i for i,v in rows.items() if v[0] in ids}
    if new==ids:break
    ids=new
   rss=sum(rows.get(i,(0,0))[1] for i in ids);peak=max(peak,rss)
   reason='capture512KiB' if out.stat().st_size+err.stat().st_size>524288 else 'wall' if time.monotonic()-start>wall else 'groupRSS512MiB' if rss>512*M else 'supervisorRSS128MiB' if rows.get(os.getpid(),(0,0))[1]>128*M else None
   if reason:
    if q.poll() is None:os.killpg(q.pid,signal.SIGKILL)
    q.wait();break
   if q.poll() is not None:break
   time.sleep(.04)
 data=out.read_bytes();error=err.read_bytes()
 rec=dict(name=name,argv=[a if len(a)<900 else dict(bytes=len(a),sha256=hashlib.sha256(a.encode()).hexdigest()) for a in args],exit=q.returncode,reason=reason,elapsed=time.monotonic()-start,peakRSS=peak,stdoutBytes=len(data),stderrBytes=len(error),stdoutSHA=hashlib.sha256(data).hexdigest(),stderr=error.decode(errors='replace')[-3000:],generatedFileLimit=12*M,captureLimit=524288)
 with gzip.open(O/'operations.jsonl.gz','ab') as f:f.write((json.dumps(rec)+'\n').encode())
 out.unlink();err.unlink()
 if reason or q.returncode not in allowed:
  if expect_capture and reason=='capture512KiB':save('capture-overflow-control.json',rec);return b''
  if not (O/'first-operation-denial.json').exists():save('first-operation-denial.json',rec)
  raise RuntimeError(str(rec))
 return data
def git(*args,input=None,allowed=(0,),mutation=False):
 if mutation:
  assert git('rev-parse','--absolute-git-dir').decode().strip()==str(G)
  assert git('rev-parse','--is-bare-repository').strip()==b'true'
  assert not (G/'index').exists()
 return run('git-'+args[0],['git','-C',str(G),'--git-dir='+str(G),*args],cwd=G,git=True,input=input,allowed=allowed,publication=True)
