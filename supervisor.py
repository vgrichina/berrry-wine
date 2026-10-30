import os, sys, json, time, signal, resource, subprocess, hashlib
from pathlib import Path
from datetime import datetime, timezone
ROOT=Path('/tmp/tuxracer-published-syntax-independent-accept-oct29/repo').resolve()
E=ROOT/'evidence'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
env=os.environ.copy()
env.update(GIT_SSH_COMMAND=SSH,PYTHONDONTWRITEBYTECODE='1',GIT_CONFIG_NOSYSTEM='1')
stores=json.loads(Path('/home/user/wine-assembly/scratch/usage-watch/tuxracer-published-syntax-independent-accept-oct29-object-stores.json').read_text())['stores']
env['GIT_ALTERNATE_OBJECT_DIRECTORIES']=':'.join(stores)
resource.setrlimit(resource.RLIMIT_DATA,(128*1024**2,resource.getrlimit(resource.RLIMIT_DATA)[1]))
def save(name,data):
    (E/(name+'.json')).write_text(json.dumps(data,indent=2)+'\n')
def admission(name):
    s=os.statvfs(ROOT)
    mem=int(next(x.split()[1] for x in Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
    physical=sum(p.stat().st_blocks*512 for p in ROOT.rglob('*') if p.is_file())
    initial=json.loads((E/'initial.json').read_text())
    wal=sum(max(0,Path(p).stat().st_size-n) for p,n in initial['WALBaseline'].items() if Path(p).exists())
    session=Path(initial['session'])
    used=physical+session.stat().st_size+wal
    d=dict(at=datetime.now(timezone.utc).isoformat(),device=ROOT.stat().st_dev,f_bavail=s.f_bavail,blockSize=s.f_frsize,freeBytes=s.f_bavail*s.f_frsize,aggregate=125829120,requiredBytes=3175088128,MemAvailable=mem,physicalOwned=physical,sessionBytes=session.stat().st_size,positiveWALGrowthCountedOnce=wal,allocation=25165824,forecast='Git/source3 tests1 evidence1 events/WAL8 publication3 buffer8 MiB',remainingProjection=125829120)
    d['PASS']=d['freeBytes']>=3175088128 and mem>=2147483648 and used<=25165824
    save(name+'-admission',d)
    if not d['PASS']: raise RuntimeError('admission rejected: '+name)
def validate(cwd):
    p=Path(cwd).resolve()
    if p!=ROOT and ROOT not in p.parents: raise ValueError('outside owned task')
    if not p.is_dir(): raise ValueError('cwd absent')
    return p
def run(argv,*,cwd,name,git=False,mutate=False,initial=False,expected=0):
    p=validate(cwd)
    if git:
        assert argv[:3]==['git','-C',str(ROOT)]
        if initial:
            assert p==ROOT and not (ROOT/'.git').exists() and argv[3]=='init'
        elif mutate:
            for flag,want in [('--show-toplevel',ROOT),('--absolute-git-dir',ROOT/'.git')]:
                got=run(['git','-C',str(ROOT),'rev-parse',flag],cwd=ROOT,name=name+'-'+flag[2:],git=True)
                assert Path(got.strip()).resolve()==want
    admission(name)
    def limits():
        resource.setrlimit(resource.RLIMIT_DATA,((256 if git else 128)*1024**2,resource.getrlimit(resource.RLIMIT_DATA)[1]))
        resource.setrlimit(resource.RLIMIT_CPU,(90,90))
        resource.setrlimit(resource.RLIMIT_FSIZE,(12*1024**2,12*1024**2))
    out=E/(name+'.stdout'); err=E/(name+'.stderr')
    started=time.monotonic(); peak=0; failure=None
    with out.open('wb') as o,err.open('wb') as e:
        child=subprocess.Popen(argv,cwd=p,env=env,stdout=o,stderr=e,preexec_fn=limits,start_new_session=True)
        try:
            while child.poll() is None:
                total=0
                for proc in Path('/proc').iterdir():
                    if not proc.name.isdigit(): continue
                    try:
                        st=(proc/'stat').read_text().split(') ',1)[1].split()
                        if int(st[2])!=child.pid: continue
                        rss=int(st[21])*os.sysconf('SC_PAGE_SIZE'); total+=rss
                        if rss>128*1024**2: failure='physical RSS128MiB'
                    except (OSError,ValueError,IndexError): pass
                peak=max(peak,total)
                if total>512*1024**2: failure='group RSS512MiB'
                if time.monotonic()-started>120: failure='wall120'
                if out.stat().st_size+err.stat().st_size>2*1024**2: failure='capture2MiB'
                if failure: break
                time.sleep(.02)
        finally:
            try: os.killpg(child.pid,signal.SIGKILL)
            except ProcessLookupError: pass
            child.wait()
    save(name,dict(argv=argv,cwd=str(p),exitCode=child.returncode,failure=failure,peakGroupRSS=peak,seconds=time.monotonic()-started,descendantCleanup='process group SIGKILL; direct child reaped',stdoutBytes=out.stat().st_size,stderrBytes=err.stat().st_size))
    if failure or child.returncode!=expected: raise RuntimeError(name+' failed '+str(child.returncode)+' '+str(failure))
    return out.read_text()
def git(args,name,mutate=False,initial=False):
    return run(['git','-C',str(ROOT)]+args,cwd=ROOT,name=name,git=True,mutate=mutate,initial=initial)
