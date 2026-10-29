import os,sys,json,time,pathlib,subprocess,hashlib,signal
import limit_contract as lc
ROOT=pathlib.Path(__file__).resolve().parent
REPO=ROOT/'repo'
lc.configure_parent()
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def rows():
 r={}
 for p in pathlib.Path('/proc').iterdir():
  if not p.name.isdigit():continue
  try:
   f=(p/'stat').read_text().rsplit(')',1)[1].split();r[int(p.name)]=dict(ppid=int(f[1]),start=f[19],rss=int(f[21])*4096,cpu=(int(f[11])+int(f[12]))/os.sysconf('SC_CLK_TCK'))
  except (OSError,ValueError,IndexError):pass
 return r
def admit(label):
 a=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-real-cli-file-limit-oct29-admission.json').read_bytes())
 s=os.statvfs(ROOT);m=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 allocated=sum(p.stat().st_blocks*512 for p in ROOT.rglob('*') if p.is_file() and not p.is_symlink())
 wal=pathlib.Path('/home/user/.codex/state_5.sqlite-wal');baseline=ROOT/'wal-baseline.json'
 if not baseline.exists():baseline.write_text(json.dumps(dict(path=str(wal),allocated=wal.stat().st_blocks*512 if wal.exists() else 0)))
 b=json.loads(baseline.read_text());growth=max(0,(wal.stat().st_blocks*512 if wal.exists() else 0)-b['allocated'])
 r=dict(label=label,time=time.time(),free=s.f_bavail*s.f_frsize,device=ROOT.stat().st_dev,MemAvailable=m,aggregate=a['aggregate'],required=a['requiredBytes'],allocated=allocated,positiveWALGrowthOnce=growth,allocation=24*1048576)
 r['PASS']=r['free']>=a['requiredBytes'] and m>=a['memRequired'] and allocated+growth<=24*1048576
 with (ROOT/'operations.jsonl').open('a') as f:f.write(json.dumps(r)+'\n')
 if not r['PASS']:raise RuntimeError('exact admission rejection '+json.dumps(r))
def run(argv,*,cwd,label,git=False,timeout=120):
 p=pathlib.Path(os.path.abspath(os.fspath(cwd)))
 if not p.is_relative_to(ROOT):raise ValueError('lexical outside owned root before existence')
 p=p.resolve(strict=True)
 if not p.is_relative_to(ROOT):raise ValueError('canonical outside owned root')
 if git:
  assert argv[:3]==['git','-C',str(REPO)] and p==REPO
 admit(label)
 env=dict(os.environ,GIT_SSH_COMMAND=SSH)
 q=subprocess.Popen(argv,cwd=p,env=env,preexec_fn=lambda:lc.child_limits(git),stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 start=time.monotonic();out=bytearray();err=bytearray();seen={};incident=None;maxrss=0;cpu={}
 for stream in (q.stdout,q.stderr):os.set_blocking(stream.fileno(),False)
 while True:
  rs=rows();selected={q.pid};old=set()
  while old!=selected:
   old=set(selected);selected.update(pid for pid,r in rs.items() if r['ppid'] in selected)
  for pid in selected:
   if pid in rs:seen[(pid,rs[pid]['start'])]=rs[pid];cpu[(pid,rs[pid]['start'])]=rs[pid]['cpu']
  group=rs.get(os.getpid(),{}).get('rss',0)+sum(rs.get(pid,{}).get('rss',0) for pid in selected);maxrss=max(maxrss,group)
  for stream,buf in ((q.stdout,out),(q.stderr,err)):
   try:buf.extend(os.read(stream.fileno(),65536))
   except BlockingIOError:pass
  if group>512*1048576 or rs.get(os.getpid(),{}).get('rss',0)>128*1048576 or sum(cpu.values())>90 or time.monotonic()-start>timeout or len(out)+len(err)>2*1048576:
   incident='outer resource guard'
   for (pid,identity),row in seen.items():
    now=rows().get(pid)
    if now and now['start']==identity:
     try:os.kill(pid,signal.SIGKILL)
     except ProcessLookupError:pass
   break
  if q.poll() is not None:
   out.extend(q.stdout.read() or b'');err.extend(q.stderr.read() or b'');break
  time.sleep(.02)
 rc=q.wait(timeout=2)
 (ROOT/(label+'.stdout')).write_bytes(out);(ROOT/(label+'.stderr')).write_bytes(err)
 r=dict(argv=argv,cwd=str(p),exit=rc,incident=incident,wall=time.monotonic()-start,peakGroupRSS=maxrss,stdoutBytes=len(out),stderrBytes=len(err))
 (ROOT/(label+'.json')).write_text(json.dumps(r,indent=2)+'\n')
 print(json.dumps(dict(label=label,exit=rc,incident=incident,stdoutBytes=len(out),stderrBytes=len(err))))
 return rc,bytes(out),bytes(err)
def git(label,args):
 for flag,expected in [('--show-toplevel',str(REPO)),('--absolute-git-dir',str(REPO/'.git'))]:
  rc,out,err=run(['git','-C',str(REPO),'rev-parse',flag],cwd=REPO,label=label+flag,git=True)
  assert rc==0 and out.decode().strip()==expected
 return run(['git','-C',str(REPO),*args],cwd=REPO,label=label,git=True)
if __name__=='__main__':
 label=sys.argv[1];args=sys.argv[2:]
 rc,_,_=git(label,args[1:]) if args[0]=='git' else run(args,cwd=REPO,label=label)
 sys.exit(rc)
