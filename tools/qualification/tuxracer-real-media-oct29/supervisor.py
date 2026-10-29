import os, sys, json, pathlib, hashlib, resource, subprocess, time, signal, selectors, datetime
OWN = pathlib.Path('/tmp/tuxracer-admitted-workdir-real-media-oct29').resolve()
REPO = OWN / 'repo'
EV = OWN / 'evidence'
ROOT = pathlib.Path('/home/user/wine-assembly')
M = 1048576
SSH = 'ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def save(name, value):
    EV.mkdir(exist_ok=True)
    p = EV / (name + '.json')
    data = json.dumps(value, indent=2).encode()
    assert len(data) <= M
    p.write_bytes(data)
def digest(p):
    h=hashlib.sha256()
    with open(p,'rb') as f:
        for b in iter(lambda:f.read(65536),b''): h.update(b)
    return h.hexdigest()
def footprint(p):
    return sum(f.stat().st_blocks*512 for f in p.rglob('*') if f.is_file()) if p.exists() else 0
def admission(name):
    st=os.statvfs(OWN); mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
    baseline=json.loads((EV/'baseline.json').read_text()) if (EV/'baseline.json').exists() else {}
    session=pathlib.Path(baseline.get('session','/nonexistent'))
    event=ROOT/'scratch/usage-watch/tuxracer-admitted-workdir-real-media-oct29/events.jsonl'
    wal=sum(max(0,pathlib.Path(p).stat().st_size-n) for p,n in baseline.get('wal',{}).items() if pathlib.Path(p).exists())
    used=footprint(OWN)+(max(0,session.stat().st_size-baseline.get('sessionBytes',0)) if session.exists() else 0)+max(0,event.stat().st_size-baseline.get('eventBytes',0))
    v=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),device=OWN.stat().st_dev,f_bavail=st.f_bavail,blockSize=st.f_frsize,freeBytes=st.f_bavail*st.f_frsize,memAvailable=mem,aggregate=125829120,aggregateReceiptSha256='a34bbcdcf2004fba6c8278052186f3b4ffc50d5ae911f06528c5aefc0a7e8cb4',requiredBytes=3175088128,forecastBytes=125829120,remainingAfterForecast=st.f_bavail*st.f_frsize-125829120,taskUsedBytes=used,sharedPositiveWalGrowthCountedOnce=wal,projection=dict(git=3*M,source=1*M,evidence=1*M,sessionEvents=4*M,future=3*M,reserve=8*M,uncertainty=4*M),allocationBytes=24*M)
    v['PASS']=v['remainingAfterForecast']>=3175088128 and mem>=2147483648 and used<=24*M
    save(name+'.admission',v)
    if not v['PASS']: raise RuntimeError('DECISIVE admission failure '+name)
def contained(cwd):
    p=pathlib.Path(cwd).resolve(strict=True)
    if p != OWN and OWN not in p.parents: raise ValueError('outside owned task')
    return p
def limits(git):
    resource.setrlimit(resource.RLIMIT_DATA,(256*M if git else 128*M,)*2)
    resource.setrlimit(resource.RLIMIT_CPU,(90,90))
    resource.setrlimit(resource.RLIMIT_FSIZE,(12*M,12*M))
    resource.setrlimit(resource.RLIMIT_CORE,(0,0))
def run(name, argv, *, cwd):
    p=contained(cwd)
    git=argv[0]=='git'
    if git and argv[1:3]!=['-C',str(REPO)]: raise ValueError('Git requires explicit owned -C')
    admission(name)
    env=os.environ.copy(); env['GIT_SSH_COMMAND']=SSH; env['PYTHONDONTWRITEBYTECODE']='1'; env['GIT_CONFIG_NOSYSTEM']='1'; env['GIT_CONFIG_GLOBAL']='/dev/null'
    stores=json.loads((ROOT/'scratch/usage-watch/recovered-three-complete-oct29-object-stores.json').read_text())['stores']
    env['GIT_ALTERNATE_OBJECT_DIRECTORIES']=os.pathsep.join(stores)
    start=time.monotonic(); reason=None; peak=0; total=0
    try:
        proc=subprocess.Popen(argv,cwd=p,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,preexec_fn=lambda:limits(git))
    except Exception as e:
        save(name+'.spawn-failure',dict(error=repr(e),argv=argv,cwd=str(p),inheritedData=resource.getrlimit(resource.RLIMIT_DATA)))
        raise
    sel=selectors.DefaultSelector(); data={}
    for stream,label in [(proc.stdout,'stdout'),(proc.stderr,'stderr')]:
        sel.register(stream,selectors.EVENT_READ,label); data[label]=bytearray()
    try:
        while sel.get_map() or proc.poll() is None:
            rss=0
            for status in pathlib.Path('/proc').glob('[0-9]*/status'):
                try:
                    pid=int(status.parent.name)
                    if os.getpgid(pid)!=proc.pid: continue
                    t=status.read_text(); r=next((int(x.split()[1])*1024 for x in t.splitlines() if x.startswith('VmRSS:')),0); rss+=r
                    if r>128*M: reason='process RSS cap'
                except (ProcessLookupError,FileNotFoundError,PermissionError): pass
            peak=max(peak,rss)
            if rss>512*M: reason='group RSS cap'
            if time.monotonic()-start>120: reason='wall cap'
            if reason: break
            for key,_ in sel.select(.05):
                b=os.read(key.fileobj.fileno(),65536)
                if not b: sel.unregister(key.fileobj); continue
                total+=len(b)
                if total>2*M: reason='capture cap'; break
                data[key.data].extend(b)
    finally:
        try: os.killpg(proc.pid,signal.SIGKILL)
        except ProcessLookupError: pass
        proc.wait(); sel.close()
        for label,b in data.items(): (EV/(name+'.'+label)).write_bytes(b)
        save(name,dict(argv=argv,cwd=str(p),returncode=proc.returncode,reason=reason,peakGroupRSS=peak,seconds=time.monotonic()-start,cleanup='process group killed/reaped',captureBytes=total))
    if reason: raise RuntimeError(reason)
    return proc.returncode,bytes(data['stdout']),bytes(data['stderr'])
def git(name,args,*,cwd,mutate=False,init=False):
    contained(cwd)
    if init:
        if pathlib.Path(cwd).resolve()!=REPO or (REPO/'.git').exists(): raise ValueError('invalid initialization')
    elif mutate:
        for flag,expected in [('--show-toplevel',str(REPO)),('--absolute-git-dir',str(REPO/'.git'))]:
            rc,out,_=run(name+'-validate-'+flag[2:],['git','-C',str(REPO),'rev-parse',flag],cwd=cwd)
            if rc or out.decode().strip()!=expected: raise RuntimeError('Git identity mismatch')
    rc,out,err=run(name,['git','-C',str(REPO)]+args,cwd=cwd)
    if rc: raise RuntimeError('Git failure '+name+': '+err.decode()[:1000])
    return out
def setup():
    REPO.mkdir(exist_ok=True); EV.mkdir(exist_ok=True)
    session=next(pathlib.Path('/home/user/.codex/sessions/2026/10/29').glob('*'+os.environ['CODEX_THREAD_ID']+'.jsonl'))
    events=ROOT/'scratch/usage-watch/tuxracer-admitted-workdir-real-media-oct29/events.jsonl'
    if not (EV/'baseline.json').exists():
        save('baseline',dict(session=str(session),sessionBytes=session.stat().st_size,eventBytes=events.stat().st_size,wal={str(p):p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('*-wal')},walCountOwner='coordinator aggregate; positive growth recorded once',inheritedLimits={k:resource.getrlimit(getattr(resource,k)) for k in ['RLIMIT_DATA','RLIMIT_RSS','RLIMIT_CPU','RLIMIT_FSIZE','RLIMIT_AS']},mountArgv=[]))
    checks={}
    for name,c in [('omitted',None),('root',ROOT),('donor',ROOT/'scratch')]:
        try:
            if c is None: run('must-not-spawn',['/bin/touch',str(OWN/'bad-sentinel')])
            else: run('must-not-spawn',['/bin/touch',str(OWN/'bad-sentinel')],cwd=c)
            raise AssertionError('negative spawned')
        except (TypeError,ValueError): checks[name]='rejected before spawn'
    rc,out,_=run('owned-sentinel',[sys.executable,'-c','import os; print(os.getcwd())'],cwd=OWN)
    assert rc==0 and out.decode().strip()==str(OWN) and not (OWN/'bad-sentinel').exists()
    checks['ownedSentinel']='PASS'; save('containment',checks)
    for p,size,h in [('scratch/usage-watch/tuxracer-admitted-workdir-real-media-oct29-dispatch.json',1455,'00f067d7bb01d67022392c7f97550ce22b7d6d2c10a70b453bcc21c9af02998a'),('scratch/usage-watch/real-media-three-oct29-admission.json',1023,'a34bbcdcf2004fba6c8278052186f3b4ffc50d5ae911f06528c5aefc0a7e8cb4')]:
        assert (ROOT/p).stat().st_size==size and digest(ROOT/p)==h
    git('init',['init'],cwd=REPO,init=True)
    git('sparse-init',['sparse-checkout','init','--no-cone'],cwd=REPO,mutate=True)
    git('sparse-set',['sparse-checkout','set','--no-cone','/tools/recovery/tuxracer-original-win32-recovery-oct28.py'],cwd=REPO,mutate=True)
    git('checkout',['checkout','-b','task/tuxracer-admitted-workdir-real-media-oct29','3898e008861bad6c274506664b2804dbdc7d236a'],cwd=REPO,mutate=True)
    print('setup PASS')
if __name__=='__main__':
    resource.setrlimit(resource.RLIMIT_DATA,(128*M,resource.getrlimit(resource.RLIMIT_DATA)[1]))
    for key,value in [(resource.RLIMIT_CPU,90),(resource.RLIMIT_FSIZE,12*M)]: resource.setrlimit(key,(value,value))
    setup()
