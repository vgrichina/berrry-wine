import os,sys,json,time,pathlib,hashlib,subprocess,signal,resource
from limit_contract import configure_parent,child_limits
OWN=pathlib.Path('/tmp/toyvm-directory-remove-metadata-reuse-oct29');REPO=OWN/'repo';E=OWN/'private'
limits=configure_parent()
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def record(name,obj):
 (E/(name+'.json')).write_text(json.dumps(obj,sort_keys=True,indent=2))
def admission(name):
 wals={str(p):p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('*-wal')}
 base=json.loads((E/'wal-baseline.json').read_text())['files'];growth=sum(max(0,n-base.get(p,0)) for p,n in wals.items())
 st=os.statvfs(OWN);mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 used=sum(p.stat().st_size for p in OWN.rglob('*') if p.is_file() and not p.is_symlink())
 a=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-directory-remove-metadata-reuse-oct29-admission.json').read_text())
 rec=dict(at=time.time(),device=OWN.stat().st_dev,f_bavail=st.f_bavail,blockSize=st.f_frsize,free=st.f_bavail*st.f_frsize,MemAvailable=mem,ownedBytes=used,positiveWALGrowth=growth,walBudget=8*1048576,requiredBytes=a['requiredBytes'],aggregateVersion='toyvm-directory-remove-metadata-reuse-oct29-admission.json',aggregateFutureGrowth=a['futureGrowthIncludingUncertaintyBuffer'],allocation=24*1048576,limits=limits)
 rec['PASS']=rec['free']-rec['aggregateFutureGrowth']>=rec['requiredBytes'] and mem>=a['memRequired'] and used+growth<24*1048576 and growth<=8*1048576
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
   if time.monotonic()-start>timeout:incident='outer wall'
   if out.stat().st_size+err.stat().st_size>2*1048576:incident='capture'
   procs={}
   for entry in pathlib.Path('/proc').iterdir():
    if not entry.name.isdigit():continue
    try:
     raw=(entry/'stat').read_text();s=raw[raw.rindex(')')+2:].split();procs[int(entry.name)]=(int(s[1]),max(0,int(s[21]))*os.sysconf('SC_PAGE_SIZE'))
    except (FileNotFoundError,ProcessLookupError):pass
   selected={os.getpid(),p.pid}
   while True:
    before=len(selected);selected.update(pid for pid,(ppid,rss) in procs.items() if ppid in selected)
    if len(selected)==before:break
   if procs.get(os.getpid(),(0,0))[1]>128*1048576:incident='parent physical RSS'
   if sum(procs.get(pid,(0,0))[1] for pid in selected)>512*1048576:incident='group physical RSS'
   if incident:p.kill();break
   time.sleep(.02)
  rc=p.wait()
 record(name,dict(argv=argv,cwd=str(cwd),exit=rc,wall=time.monotonic()-start,incident=incident,stdoutBytes=out.stat().st_size,stderrBytes=err.stat().st_size,stdoutSHA256=hashlib.sha256(out.read_bytes()).hexdigest(),stderrSHA256=hashlib.sha256(err.read_bytes()).hexdigest()))
 if incident:raise RuntimeError(incident)
 return rc,out.read_text(),err.read_text()
def git(args,*,name,mutate=False):
 if mutate:
  for opt,want in [('--show-toplevel',str(REPO)),('--absolute-git-dir',str(REPO/'.git'))]:
   rc,out,err=run(['git','-C',str(REPO),'rev-parse',opt],cwd=REPO,name=name+opt,git=True)
   assert rc==0 and out.strip()==want,(out,err)
 return run(['git','-C',str(REPO),*args],cwd=REPO,name=name,git=True)
