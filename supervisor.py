"""Task-owned capped subprocess supervisor; never run donor wrappers."""
import datetime, hashlib, json, os, pathlib, resource, signal, subprocess, sys, time

OWN = pathlib.Path('/tmp/toyvm-offline-nonfinite-json-repair-oct29/repo').resolve()
TASK = OWN.parent
ROOT = pathlib.Path('/home/user/wine-assembly')
EV = OWN/'test/toyvm-offline-nonfinite-json-repair-oct29/evidence'
EV.mkdir(parents=True, exist_ok=True)
MiB = 1024**2
SESSION = next(pathlib.Path('/home/user/.codex/sessions/2026/10/29').glob('*'+os.environ['CODEX_SESSION_ID']+'*'))
INHERITED = {n: resource.getrlimit(getattr(resource,n)) for n in ['RLIMIT_DATA','RLIMIT_CPU','RLIMIT_FSIZE','RLIMIT_AS']}
BASELINE = EV/'initial-baseline.json'

def save(name, value):
    data=json.dumps(value, indent=2, sort_keys=True).encode()
    if len(data)>MiB or sum(p.stat().st_size for p in EV.rglob('*') if p.is_file() and p.name!=name)+len(data)>MiB:
        raise RuntimeError('evidence bound')
    (EV/name).write_bytes(data)

if not BASELINE.exists():
    save(BASELINE.name, dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(), session=str(SESSION), sessionInitialBytes=SESSION.stat().st_size,
        sharedWAL={str(p):p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('*-wal')}, inheritedLimits=INHERITED,
        allocationBytes=24*MiB, aggregateBytes=150994944, requiredBytes=3200253952, mountArgv=[], runtimeAllowed=False))
INITIAL=json.loads(BASELINE.read_text())
resource.setrlimit(resource.RLIMIT_DATA,(128*MiB,resource.getrlimit(resource.RLIMIT_DATA)[1]))
resource.setrlimit(resource.RLIMIT_FSIZE,(12*MiB,12*MiB))

def owned_cwd(cwd):
    p=pathlib.Path(cwd).resolve()
    if not p.is_relative_to(OWN) or not p.is_dir():
        raise ValueError('cwd outside owned repository')
    return p

def rss_snapshot():
    rows={}
    for p in pathlib.Path('/proc').iterdir():
        if not p.name.isdigit():continue
        try:
            stat=(p/'stat').read_text().rsplit(')',1)[1].split()
            status=(p/'status').read_text()
            rss=int(next(x.split()[1] for x in status.splitlines() if x.startswith('VmRSS:')))*1024
            rows[int(p.name)]=(int(stat[1]),int(stat[2]),rss)
        except (OSError,StopIteration,ValueError):pass
    return rows

def admission(label):
    st=os.statvfs(OWN)
    mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
    owned=sum(p.stat().st_size for p in TASK.rglob('*') if p.is_file())
    wal=sum(max(0,pathlib.Path(p).stat().st_size-v) for p,v in INITIAL['sharedWAL'].items() if pathlib.Path(p).exists())
    session=SESSION.stat().st_size
    measured=owned+wal+session
    rec=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),operation=label,device=OWN.stat().st_dev,f_bavail=st.f_bavail,blockSize=st.f_frsize,
        freeBytes=st.f_bavail*st.f_frsize,aggregate=150994944,requiredBytes=3200253952,projection=24*MiB,ownedBytes=owned,sessionBytes=session,positiveSharedWALGrowthCountedOnce=wal,
        measuredBytes=measured,remainingProjectionBytes=24*MiB-measured,MemAvailable=mem,supervisorRSS=rss_snapshot().get(os.getpid(),(0,0,0))[2])
    rec['PASS']=rec['freeBytes']>=3200253952 and mem>=512*MiB and measured<=16*MiB and rec['supervisorRSS']<=128*MiB
    save('admission-'+label+'.json',rec)
    if not rec['PASS']:raise RuntimeError('first admission failure: '+label)

def run(argv, *, cwd, label, git=False, _checked=False):
    cwd=owned_cwd(cwd)
    if git:
        if argv[:3]!=['git','-C',str(OWN)]:raise ValueError('explicit Git -C required')
        if not _checked and argv[3]!='init':
            for flag,expected in [('--show-toplevel',str(OWN)),('--absolute-git-dir',str(OWN/'.git'))]:
                code,out,_=run(['git','-C',str(OWN),'rev-parse',flag],cwd=cwd,label=label+'-identity-'+flag[2:],git=True,_checked=True)
                if code or out.decode().strip()!=expected:raise ValueError('Git identity mismatch')
    admission(label)
    env=dict(os.environ, PYTHONDONTWRITEBYTECODE='1')
    stores=json.loads((ROOT/'scratch/usage-watch/toyvm-offline-nonfinite-json-repair-oct29-object-stores.json').read_text())['stores']
    env['GIT_ALTERNATE_OBJECT_DIRECTORIES']=':'.join(stores)
    env['GIT_SSH_COMMAND']='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
    def limits():
        resource.setrlimit(resource.RLIMIT_DATA,((256 if git else 128)*MiB,resource.getrlimit(resource.RLIMIT_DATA)[1]))
        resource.setrlimit(resource.RLIMIT_CPU,(90,90))
        resource.setrlimit(resource.RLIMIT_FSIZE,(12*MiB,12*MiB))
    outpath=EV/(label+'.stdout');errpath=EV/(label+'.stderr')
    start=time.monotonic(); peak=0;incident=None; proc=None
    with outpath.open('wb') as out,errpath.open('wb') as err:
        try:
            proc=subprocess.Popen(argv,cwd=cwd,env=env,stdout=out,stderr=err,start_new_session=True,preexec_fn=limits)
            while True:
                rows=rss_snapshot(); group={pid:v for pid,v in rows.items() if v[1]==proc.pid}
                total=sum(v[2] for v in group.values())+rows.get(os.getpid(),(0,0,0))[2];peak=max(peak,total)
                if total>512*MiB or any(v[2]>(256 if git else 128)*MiB for v in group.values()):incident='physical RSS cap'
                if time.monotonic()-start>120:incident='wall cap'
                if outpath.stat().st_size+errpath.stat().st_size>2*MiB:incident='capture cap'
                if sum(p.stat().st_size for p in EV.rglob('*') if p.is_file())>MiB:incident='evidence cap'
                if incident or proc.poll() is not None:break
                time.sleep(.01)
        finally:
            if proc:
                try:os.killpg(proc.pid,signal.SIGKILL)
                except ProcessLookupError:pass
                proc.wait()
    remaining=[pid for pid,v in rss_snapshot().items() if proc and v[1]==proc.pid]
    rec=dict(argv=argv,cwd=str(cwd),exit=proc.returncode if proc else None,wallSeconds=time.monotonic()-start,groupPeakRSS=peak,
        incident=incident,remainingProcessGroup=remaining,stdoutSHA256=hashlib.sha256(outpath.read_bytes()).hexdigest(),stderrSHA256=hashlib.sha256(errpath.read_bytes()).hexdigest(),
        pythonDataBytes=128*MiB,gitDataBytes=256*MiB,groupRSSBytes=512*MiB,cpuSeconds=90,wallLimitSeconds=120,fileBytes=12*MiB,captureBytes=2*MiB)
    save(label+'.json',rec)
    if incident or remaining:raise RuntimeError('first resource/cleanup incident: '+label)
    return proc.returncode,outpath.read_bytes(),errpath.read_bytes()

if __name__=='__main__':
    if sys.argv[1]=='git':
        rc,out,err=run(['git','-C',str(OWN)]+sys.argv[2:],cwd=OWN,label=os.environ.get('OP','git-operation'),git=True)
    else:
        rc,out,err=run(sys.argv[1:],cwd=OWN,label=os.environ.get('OP','operation'))
    sys.stdout.buffer.write(out[:8192]);sys.stderr.buffer.write(err[:8192]);sys.exit(rc)
