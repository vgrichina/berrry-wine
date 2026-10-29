import os,sys,json,time,pathlib,hashlib,subprocess,signal,resource
from limit_contract import configure_parent,child_limits
OWN=pathlib.Path('/tmp/toyvm-validated-quota-descendant-cpu-oct29');REPO=OWN/'repo';E=OWN/'private';E.mkdir(exist_ok=True)
limits=configure_parent()
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def record(name,obj):
 p=E/(name+'.json');p.write_text(json.dumps(obj,sort_keys=True,indent=2))
def admission(name):
 st=os.statvfs(OWN);mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 used=sum(p.stat().st_size for p in OWN.rglob('*') if p.is_file() and not p.is_symlink())
 rec=dict(at=time.time(),device=OWN.stat().st_dev,f_bavail=st.f_bavail,blockSize=st.f_frsize,free=st.f_bavail*st.f_frsize,MemAvailable=mem,ownedBytes=used,requiredBytes=3225419776,aggregateVersion='dispatch-admission-2e7c4b99',projectedRemaining=24*1048576,limits=limits)
 rec['PASS']=rec['free']-24*1048576>=3225419776 and mem>=2147483648 and used<24*1048576
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
if __name__=='__main__':
 mode=sys.argv[1]
 if mode=='cmd':
  rc,out,err=run(sys.argv[3:],cwd=OWN,name=sys.argv[2]);print(json.dumps(dict(exit=rc,stdout=out[:4500],stderr=err[:500])))
 elif mode=='git':
  rc,out,err=git(sys.argv[3:],name=sys.argv[2],mutate=sys.argv[3] in ['add','commit','push','config']);print(json.dumps(dict(exit=rc,stdout=out[:2000],stderr=err[:1000])))
 elif mode=='pins':
  d=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-validated-quota-descendant-cpu-oct29-dispatch.json');a=d.with_name('toyvm-validated-quota-descendant-cpu-oct29-admission.json')
  assert hashlib.sha256(d.read_bytes()).hexdigest()=='1fee4eaf6d259b5d3d2ed8a01ed0f777f1109e8777d22d7afe990bad60c2b0b2'
  assert hashlib.sha256(a.read_bytes()).hexdigest()=='2e7c4b99f227e67760e270635ac1f8c26de64b87a02cebfbabfa6195ee68fe9d'
  dispatch=json.loads(d.read_text())
  for relative,pin in dispatch['sourcePins'].items():
   b=(REPO/relative).read_bytes();assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256']
  assert hashlib.sha256((OWN/'limit_contract.py').read_bytes()).hexdigest()==dispatch['limitModulePin']['sha256']
  record('pins',dispatch);admission('pins');print('pins PASS')
