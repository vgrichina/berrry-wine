import os, sys, json, time, resource, subprocess, signal, pathlib, hashlib, datetime
OWN = pathlib.Path('/tmp/toyvm-cleanup-receipt-type-repair-oct29/repo').resolve()
TASK = OWN.parent
EVID = OWN / 'repair-evidence'
EVID.mkdir(exist_ok=True)
DISPATCH = pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-cleanup-receipt-type-repair-oct29-dispatch.json')
ADMISSION = DISPATCH.with_name('toyvm-cleanup-receipt-type-repair-oct29-admission.json')
STORES = json.loads(DISPATCH.with_name('toyvm-cleanup-receipt-type-repair-oct29-object-stores.json').read_text())['stores']
SSH = 'ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
ENV = dict(os.environ, GIT_ALTERNATE_OBJECT_DIRECTORIES=':'.join(STORES), GIT_SSH_COMMAND=SSH, PYTHONDONTWRITEBYTECODE='1')
BASE = EVID / 'baseline.json'
def emit(name, data):
    (EVID/name).write_text(json.dumps(data, indent=2)+'\n')
if not BASE.exists():
    emit('baseline.json', {'at':datetime.datetime.now(datetime.timezone.utc).isoformat(), 'session': [str(p) for p in pathlib.Path('/home/user/.codex/sessions/2026/10/29').glob('*'+os.environ.get('CODEX_SESSION_ID','NONE')+'*')], 'wal':{str(p):p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('*-wal')}, 'inheritedLimits':{str(k):resource.getrlimit(k) for k in (resource.RLIMIT_DATA,resource.RLIMIT_AS,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE)}, 'mountArgv':[], 'runtimeAllowed':False})
resource.setrlimit(resource.RLIMIT_DATA,(128*1024**2,256*1024**2))
resource.setrlimit(resource.RLIMIT_FSIZE,(12*1024**2,12*1024**2))
def admission(label):
    s=os.statvfs(OWN); mem=int(next(l.split()[1] for l in pathlib.Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024
    used=sum(p.stat().st_blocks*512 for p in TASK.rglob('*') if p.is_file())
    baseline=json.loads(BASE.read_text())
    wal=sum(max(0,pathlib.Path(p).stat().st_size-n) for p,n in baseline['wal'].items() if pathlib.Path(p).exists())
    session=sum(pathlib.Path(p).stat().st_size for p in baseline['session'])
    events=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-cleanup-receipt-type-repair-oct29/events.jsonl').stat().st_size
    d={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'label':label,'device':OWN.stat().st_dev,'f_bavail':s.f_bavail,'blockSize':s.f_frsize,'freeBytes':s.f_bavail*s.f_frsize,'memAvailable':mem,'aggregate':125829120,'admissionSHA256':hashlib.sha256(ADMISSION.read_bytes()).hexdigest(),'futureGrowth':125829120,'minimumFree':3175088128,'ownPhysical':used,'session':session,'events':events,'positiveSharedWALCountedOnce':wal,'ownProjected':used+session+events+wal+8*1024**2,'allocation':24*1024**2}
    d['PASS']=d['freeBytes']-d['futureGrowth']>=d['minimumFree'] and mem>=2147483648 and d['ownProjected']<=d['allocation']
    with (EVID/'admissions.jsonl').open('a') as f:f.write(json.dumps(d)+'\n')
    if not d['PASS']:raise RuntimeError('ADMISSION FAILURE: '+json.dumps(d))
def valid(cwd):
    p=pathlib.Path(cwd).resolve()
    if not p.is_dir() or not p.is_relative_to(OWN):raise ValueError('outside owned directory: '+str(p))
    return p
def limits(git):
    resource.setrlimit(resource.RLIMIT_DATA,((256 if git else 128)*1024**2, (256 if git else 128)*1024**2))
    resource.setrlimit(resource.RLIMIT_CPU,(90,90))
    resource.setrlimit(resource.RLIMIT_FSIZE,(12*1024**2,12*1024**2))
def run(argv, *, cwd, label='operation', git=False, check=True):
    cwd=valid(cwd); admission(label)
    if git and (argv[:3] != ['git','-C',str(OWN)]):raise ValueError('explicit owned git -C required')
    out=EVID/(label+'.stdout'); err=EVID/(label+'.stderr')
    started=time.monotonic(); incident=None; peak_process=0; peak_group=0
    with out.open('wb') as a,err.open('wb') as b:
        p=subprocess.Popen(argv,cwd=cwd,env=ENV,stdout=a,stderr=b,start_new_session=True,preexec_fn=lambda:limits(git))
        try:
            while p.poll() is None:
                rss=0
                for proc in pathlib.Path('/proc').iterdir():
                    if not proc.name.isdigit():continue
                    try:
                        st=(proc/'stat').read_text().rsplit(')',1)[1].split(); group=int(st[2]); r=int(st[21])*os.sysconf('SC_PAGE_SIZE')
                        if group==p.pid:
                            rss+=r
                            peak_process=max(peak_process,r)
                            if r>128*1024**2:incident='process physical RSS'
                    except (OSError,ValueError,IndexError):pass
                peak_group=max(peak_group,rss)
                if rss>512*1024**2:incident='group physical RSS'
                if out.stat().st_size+err.stat().st_size>2*1024**2:incident='capture'
                if time.monotonic()-started>120:incident='wall'
                if incident:raise RuntimeError(incident)
                time.sleep(.03)
        finally:
            try:os.killpg(p.pid,signal.SIGKILL)
            except ProcessLookupError:pass
            p.wait()
    if out.stat().st_size+err.stat().st_size>2*1024**2:incident='capture'
    emit(label+'.json',{'argv':argv,'cwd':str(cwd),'exit':p.returncode,'wall':time.monotonic()-started,'incident':incident,'sampledPeakProcessRSS':peak_process,'sampledPeakGroupRSS':peak_group,'descendantCleanup':'SIGKILL process group at terminal'})
    if incident:raise RuntimeError(label+' resource incident '+incident)
    if check and p.returncode:raise RuntimeError(label+' exit '+str(p.returncode)+' '+err.read_text()[:1000])
    return p.returncode,out.read_bytes()
def git(args, *, label, mutate=False, init=False):
    if mutate and not init:
        for flag,expected in [('--show-toplevel',OWN),('--absolute-git-dir',OWN/'.git')]:
            _,v=run(['git','-C',str(OWN),'rev-parse',flag],cwd=OWN,label=label+'-'+flag[2:],git=True)
            if pathlib.Path(v.decode().strip()).resolve()!=expected:raise ValueError('git identity mismatch')
    if init and (OWN/'.git').exists():raise ValueError('already initialized')
    return run(['git','-C',str(OWN)]+args,cwd=OWN,label=label,git=True)
def controls():
    rejects=[]
    for c in [None,'/home/user/wine-assembly',STORES[-1],'/tmp']:
        try:
            if c is None:run(['touch',str(OWN/'BAD')])
            else:run(['touch',str(OWN/'BAD')],cwd=c)
        except (TypeError,ValueError):rejects.append(str(c))
    assert len(rejects)==4 and not (OWN/'BAD').exists()
    run([sys.executable,'-c','import os;print(os.getcwd())'],cwd=OWN,label='sentinel')
    emit('containment.json',{'rejected':rejects,'sentinel':str(OWN),'PASS':True})
if __name__=='__main__':controls()
