"""Task-owned bounded supervisor; no donor code executes here."""
import datetime, hashlib, json, os, pathlib, resource, signal, subprocess, time
ROOT=pathlib.Path('/tmp/toyvm-offline-receipt-validation-cli-oct29/repo').resolve()
TASK='toyvm-offline-receipt-validation-cli-oct29'
OWN=ROOT/'test/toyvm-offline-receipt-validation-cli-oct29'
EVIDENCE=OWN/'evidence'; EVIDENCE.mkdir(exist_ok=True)
HOST=pathlib.Path('/home/user/wine-assembly')
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
STORES=json.loads((HOST/'scratch/usage-watch'/f'{TASK}-object-stores.json').read_text())['stores']
ENV=dict(os.environ, GIT_ALTERNATE_OBJECT_DIRECTORIES=':'.join(STORES),GIT_SSH_COMMAND=SSH,PYTHONDONTWRITEBYTECODE='1',GIT_CONFIG_NOSYSTEM='1',GIT_TERMINAL_PROMPT='0')
MiB=1024**2
SUPERVISOR_INHERITED={k:resource.getrlimit(getattr(resource,k)) for k in ['RLIMIT_DATA','RLIMIT_CPU','RLIMIT_FSIZE','RLIMIT_AS']}
resource.setrlimit(resource.RLIMIT_DATA,(min(128*MiB,resource.getrlimit(resource.RLIMIT_DATA)[0]) if resource.getrlimit(resource.RLIMIT_DATA)[0]>=0 else 128*MiB,resource.getrlimit(resource.RLIMIT_DATA)[1]))
resource.setrlimit(resource.RLIMIT_CPU,(90,90))
resource.setrlimit(resource.RLIMIT_FSIZE,(12*MiB,12*MiB))

def write(name,value):
    text=json.dumps(value,sort_keys=True,indent=2)+'\n'
    existing=EVIDENCE/(name+'.json')
    if tree_bytes(EVIDENCE)-(existing.stat().st_size if existing.exists() else 0)+len(text.encode())>MiB: raise RuntimeError('aggregate evidence cap')
    (EVIDENCE/(name+'.json')).write_text(text)

def validate(*,cwd):
    p=pathlib.Path(cwd).resolve(strict=True)
    if not p.is_dir() or not p.is_relative_to(ROOT): raise ValueError('outside owned task cwd')
    return p

def tree_bytes(p):
    if p.is_file(): return p.stat().st_size
    return sum(f.stat().st_size for f in p.rglob('*') if f.is_file() and not f.is_symlink())

def admit(name):
    s=os.statvfs(ROOT); free=s.f_bavail*s.f_frsize
    mem=int(next(l.split()[1] for l in pathlib.Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024
    startup=json.loads((OWN/'startup.json').read_text())
    sessions=sum(pathlib.Path(p).stat().st_size for p in startup['sessionPaths'])
    events=HOST/'scratch/usage-watch'/TASK/'events.jsonl'
    positive_wal=sum(max(0,pathlib.Path(w['path']).stat().st_size-w['bytes']) for w in startup['initialPositiveSharedWALCountedOnce'])
    used=tree_bytes(ROOT)+sessions+events.stat().st_size+positive_wal
    r=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),operation=name,device=ROOT.stat().st_dev,f_bavail=s.f_bavail,blockSize=s.f_frsize,freeBytes=free,aggregate=125829120,requiredBytes=3175088128,projectionBytes=125829120,remainingAfterProjection=free-125829120,MemAvailable=mem,memRequired=2147483648,taskUsedBytes=used,taskAllocation=24*MiB,positiveWALGrowthCountedOnce=positive_wal,sessionBytes=sessions,eventsBytes=events.stat().st_size)
    r['PASS']=free>=3175088128 and mem>=2147483648 and used<=24*MiB and tree_bytes(EVIDENCE)<=MiB
    with (EVIDENCE/'admission.jsonl').open('a') as f:f.write(json.dumps(r)+'\n')
    if not r['PASS']: raise RuntimeError('admission rejected: '+json.dumps(r))

def processes():
    result={}
    for p in pathlib.Path('/proc').iterdir():
        if not p.name.isdigit(): continue
        try:
            parts=(p/'stat').read_text().rsplit(')',1)[1].split()
            result[int(p.name)]=(int(parts[1]),int(parts[2]),int(parts[21])*os.sysconf('SC_PAGE_SIZE'))
        except (OSError,ValueError,IndexError):pass
    return result

def current_rss(pid,procs):return procs.get(pid,(0,0,0))[2]

def run(argv,*,cwd,name,git=False,expect=0):
    cwd=validate(cwd=cwd)
    if git and argv[:3]!=['git','-C',str(ROOT)]:raise ValueError('explicit owned git -C required')
    admit(name)
    started=time.monotonic();out=EVIDENCE/(name+'.stdout');err=EVIDENCE/(name+'.stderr')
    inherited={k:resource.getrlimit(getattr(resource,k)) for k in ['RLIMIT_DATA','RLIMIT_CPU','RLIMIT_FSIZE','RLIMIT_AS']}
    def limits():
        resource.setrlimit(resource.RLIMIT_DATA,((256 if git else 128)*MiB,)*2)
        resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(12*MiB,)*2)
    p=None;reason=None;peak=0;tracked=set()
    try:
        with out.open('wb') as o,err.open('wb') as e:
            p=subprocess.Popen(argv,cwd=str(cwd),env=ENV,stdout=o,stderr=e,start_new_session=True,preexec_fn=limits)
            while True:
                procs=processes(); owned={p.pid}
                while True:
                    expanded=owned|{pid for pid,v in procs.items() if v[0] in owned or v[1]==p.pid}
                    if expanded==owned:break
                    owned=expanded
                group=list(owned);tracked.update(owned)
                group_rss=sum(current_rss(pid,procs) for pid in group)+current_rss(os.getpid(),procs)
                peak=max(peak,group_rss)
                if group_rss>512*MiB or (not git and any(current_rss(pid,procs)>128*MiB for pid in group)) or current_rss(os.getpid(),procs)>128*MiB:reason='physicalRSS'
                if time.monotonic()-started>120:reason='wall'
                if out.stat().st_size+err.stat().st_size>2*MiB:reason='capture'
                if tree_bytes(EVIDENCE)>MiB:reason='aggregate evidence'
                if reason or p.poll() is not None:break
                time.sleep(.01)
            if reason:os.killpg(p.pid,signal.SIGKILL)
            p.wait(timeout=3)
    finally:
        if p is not None:
            try:os.killpg(p.pid,signal.SIGKILL)
            except ProcessLookupError:pass
        for pid in tracked:
            if pid==p.pid:continue
            try:os.kill(pid,signal.SIGKILL)
            except ProcessLookupError:pass
        remaining=[pid for pid,v in processes().items() if p is not None and (v[1]==p.pid or pid in tracked)]
        write(name,dict(argv=argv,cwd=str(cwd),exit=None if p is None else p.returncode,stopReason=reason,peakCurrentPhysicalRSS=peak,rssMethod='/proc/<pid>/stat resident pages; never getrusage',inheritedLimits=inherited,appliedDATA=(256 if git else 128)*MiB,groupCap=512*MiB,wallSeconds=time.monotonic()-started,remainingProcessGroup=remaining,stdoutBytes=out.stat().st_size,stderrBytes=err.stat().st_size))
    if reason or p.returncode!=expect or remaining:raise RuntimeError(name+' failed: '+str(reason)+' exit '+str(p.returncode))
    return out.read_bytes()

def git(args,*,cwd,name,mutation=False,initial=False):
    cwd=validate(cwd=cwd)
    if initial:
        if cwd!=ROOT or (ROOT/'.git').exists() or args!=['init']:raise ValueError('invalid init')
    elif mutation:
        for flag,expected in [('--show-toplevel',str(ROOT)),('--absolute-git-dir',str(ROOT/'.git'))]:
            got=run(['git','-C',str(ROOT),'rev-parse',flag],cwd=cwd,name=name+'-'+flag[2:],git=True).decode().strip()
            if pathlib.Path(got).resolve()!=pathlib.Path(expected):raise ValueError('git identity mismatch')
    return run(['git','-C',str(ROOT),*args],cwd=cwd,name=name,git=True)

def controls():
    rejected=[]
    for name,kwargs in [('omitted',{}),('root',{'cwd':HOST}),('donor',{'cwd':'/tmp/toyvm-cleanup-receipt-independent-accept-oct29/repo'}),('outside',{'cwd':'/tmp'})]:
        try:run(['/usr/bin/python3','-B','-c',"raise SystemExit('MUST NOT SPAWN')"],name='negative-'+name,**kwargs)
        except (TypeError,ValueError):rejected.append(name)
        else:raise AssertionError(name)
    write('cwd-negative-controls',dict(PASS=len(rejected)==4,rejectedBeforeSpawn=rejected))
    r=run(['/usr/bin/python3','-B','-c','import os;print(os.getcwd())'],cwd=ROOT,name='owned-positive-sentinel')
    assert r.decode().strip()==str(ROOT)

if __name__=='__main__':controls()
