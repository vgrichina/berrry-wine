import os,sys,json,time,pathlib,hashlib,subprocess,signal,resource
from limit_contract import configure_parent,child_limits
OWN=pathlib.Path('/tmp/toyvm-real-cli-outside-write-confinement-oct29');REPO=OWN/'repo';E=OWN/'private';E.mkdir(exist_ok=True)
limits=configure_parent()
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def record(name,obj):
 p=E/(name+'.json');p.write_text(json.dumps(obj,sort_keys=True,indent=2))
def admission(name):
 baseline=E/'wal-baseline.json'
 wals={str(p):p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('*-wal')}
 if not baseline.exists():
  baseline.write_text(json.dumps(dict(at=time.time(),files=wals,note='Positive on-disk baseline counted once; explicit pre-operation baseline before identity, staging, creation and runtime; not retroactive launcher-startup proof.')))
 base=json.loads(baseline.read_text())['files']
 walGrowth=sum(max(0,size-base.get(path,0)) for path,size in wals.items())
 st=os.statvfs(OWN);mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 used=sum(p.stat().st_size for p in OWN.rglob('*') if p.is_file() and not p.is_symlink())
 rec=dict(at=time.time(),device=OWN.stat().st_dev,f_bavail=st.f_bavail,blockSize=st.f_frsize,free=st.f_bavail*st.f_frsize,MemAvailable=mem,ownedBytes=used,requiredBytes=3200253952,aggregateVersion='/home/user/wine-assembly/scratch/usage-watch/toyvm-real-cli-outside-write-confinement-oct29-admission.json',aggregateFutureGrowth=150994944,projectedRemaining=24*1048576,limits=limits)
 rec['PASS']=rec['free']-150994944>=3200253952 and mem>=2147483648 and used+walGrowth<24*1048576 and walGrowth<=8*1048576
 rec['positiveWALGrowth']=walGrowth;rec['walBudget']=8*1048576
 with (E/'admissions.jsonl').open('a') as f:f.write(json.dumps(dict(operation=name,**rec))+'\n')
 if not rec['PASS']:raise RuntimeError('admission rejected '+name)
def run(argv,*,cwd,name,git=False,timeout=120):
 lexical=pathlib.Path(os.path.abspath(os.fspath(cwd)))
 if not lexical.is_relative_to(OWN):raise ValueError('outside owned root before existence check')
 cwd=lexical.resolve(strict=True)
 if not cwd.is_relative_to(OWN):raise ValueError('symlink escape')
 admission(name)
 env=dict(os.environ,GIT_SSH_COMMAND=SSH,BOAT_NO_UPDATE='1',PYTHONDONTWRITEBYTECODE='1')
 out=E/(name+'.stdout');err=E/(name+'.stderr');start=time.monotonic();incident=None
 with out.open('wb') as o,err.open('wb') as e:
  p=subprocess.Popen(argv,cwd=cwd,env=env,stdout=o,stderr=e,preexec_fn=lambda:child_limits(git))
  while p.poll() is None:
   if time.monotonic()-start>timeout:incident='outer wall';p.kill();break
   if out.stat().st_size+err.stat().st_size>2*1048576:incident='capture';p.kill();break
   ownrss=int(next(x.split()[1] for x in pathlib.Path('/proc/self/status').read_text().splitlines() if x.startswith('VmRSS:')))*1024
   if ownrss>128*1048576:incident='parent physical RSS';p.kill();break
   procs={}
   for entry in pathlib.Path('/proc').iterdir():
    if not entry.name.isdigit():continue
    try:
     raw=(entry/'stat').read_text();fields=raw[raw.rindex(')')+2:].split();procs[int(entry.name)]=(int(fields[1]),max(0,int(fields[21]))*os.sysconf('SC_PAGE_SIZE'))
    except (FileNotFoundError,ProcessLookupError):pass
   selected={os.getpid(),p.pid};changed=True
   while changed:
    before=len(selected);selected.update(pid for pid,(ppid,rss) in procs.items() if ppid in selected);changed=len(selected)!=before
   if sum(procs.get(pid,(0,0))[1] for pid in selected)>512*1048576:incident='group physical RSS';p.kill();break
   time.sleep(.02)
  rc=p.wait()
 record(name,dict(argv=argv,cwd=str(cwd),exit=rc,wall=time.monotonic()-start,incident=incident,stdoutBytes=out.stat().st_size,stderrBytes=err.stat().st_size))
 if incident:raise RuntimeError(incident)
 return rc,out.read_text(),err.read_text()
def git(args,*,name,mutate=False):
 if mutate:
  for opt,want in [('--show-toplevel',str(REPO)),('--absolute-git-dir',str(REPO/'.git'))]:
   rc,out,err=run(['git','-C',str(REPO),'rev-parse',opt],cwd=REPO,name=name+opt,git=True)
   assert rc==0 and out.strip()==want,(out,err)
 return run(['git','-C',str(REPO),*args],cwd=REPO,name=name,git=True)
