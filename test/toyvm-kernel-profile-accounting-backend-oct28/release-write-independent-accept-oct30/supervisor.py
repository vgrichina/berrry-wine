import os,pathlib,resource,subprocess,time,json,signal,selectors
ROOT=pathlib.Path('/tmp/toyvm-mounted-create-mkdir-parent-guards-oct30/toyvm-release-write-independent-accept-oct30').resolve()
TOY=ROOT.parent
REPO=ROOT/'repo'
PUB=REPO
E=ROOT/'evidence';E.mkdir(exist_ok=True)
M=1048576
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
inherited={k:list(resource.getrlimit(k)) for k in (resource.RLIMIT_DATA,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE)}
def lower(key,n):
    s,h=resource.getrlimit(key);resource.setrlimit(key,(min(s,n) if s!=-1 else n,h))
# Parent DATA remains original for native Boat/Node; child-only DATA enforcement.
lower(resource.RLIMIT_CPU,60)
lower(resource.RLIMIT_FSIZE,12*M)
def child(git,native=False):
    if native:return
    s,h=resource.getrlimit(resource.RLIMIT_DATA)
    n=(256 if git else 128)*M

    if h!=-1 and h<n:raise RuntimeError('DATA hard conflict')
    resource.setrlimit(resource.RLIMIT_DATA,(n,n))
def rss(pid):
    try:return int(pathlib.Path(f'/proc/{pid}/stat').read_text().rsplit(')',1)[1].split()[21])*os.sysconf('SC_PAGE_SIZE')
    except (OSError,ValueError,IndexError):return 0
def admission():
    forecast=json.loads((ROOT/'coordinator-allocation-forecast.json').read_text())
    launcher=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch')/ROOT.name
    first=json.loads((launcher/'events.jsonl').open().readline())
    assert first['type']=='thread.started'
    session=first['thread_id']
    rollouts=list(pathlib.Path('/home/user/.codex/sessions/2026/10/30').glob('*'+session+'.jsonl'))
    assert len(rollouts)==1
    roots=[pathlib.Path(p) for p in forecast['roots']]+rollouts
    seen=set();allocated=0
    for root in roots:
        for p in ([root,*root.rglob('*')] if root.is_dir() else [root]):
            st=p.lstat();key=(st.st_dev,st.st_ino)
            if key not in seen:allocated+=st.st_blocks*512;seen.add(key)
    assert allocated+8*M+8*M<=64*M,'allocation reserve gate'
    disk=os.statvfs(ROOT).f_bavail*os.statvfs(ROOT).f_frsize
    mem=int(next(l.split()[1] for l in pathlib.Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024
    st=os.statvfs(ROOT)
    sample=dict(at=__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),device=ROOT.stat().st_dev,f_bavail=st.f_bavail,f_frsize=st.f_frsize,diskFree=disk,remainingGrowth=267292672,floor=2147483648)
    if disk-267292672<2147483648:
        (E/('disk-denial-'+str(time.time_ns())+'.json')).write_text(json.dumps(sample));raise RuntimeError(f'aggregate disk admission denied: {disk}')
    return dict(sessionID=session,rollout=str(rollouts[0]),roots=[str(p) for p in roots],physicalAllocated=allocated,allocationBudget=64*M,reserve=8*M,diskFree=disk,remainingAggregateGrowth=267292672,diskFloor=2147483648,MemAvailable=mem,supervisorRSS=rss(os.getpid()),RAMAdmission=False,resourcePolicy='owner 2026-10-30; actual process enforcement retained')
def run(argv,*,cwd,label,git=False,native=False,timeout=90,capture_limit=512*1024):
    if type(capture_limit) is not int or not 1<=capture_limit<=512*1024:raise ValueError("capture limit")
    lexical=pathlib.Path(os.path.abspath(os.fspath(cwd)))
    if not lexical.is_relative_to(ROOT):raise ValueError('outside owned root')
    p=lexical.resolve(strict=True)
    if not p.is_relative_to(ROOT):raise ValueError('resolved cwd escape')
    if git and argv[:3]!=['git','-C',str(p)]:raise ValueError('explicit Git -C required')
    if any((E/(label+suffix)).exists() for suffix in ('.stdout','.stderr','.json')):raise ValueError('capture label already used')
    adm=admission()
    if sum(f.stat().st_size for f in E.rglob('*') if f.is_file())>4*M:raise RuntimeError('aggregate evidence 4MiB')
    env=dict(os.environ,GIT_SSH_COMMAND=SSH,GIT_TERMINAL_PROMPT='0',PYTHONDONTWRITEBYTECODE='1',GIT_CONFIG_COUNT='2',GIT_CONFIG_KEY_0='gc.auto',GIT_CONFIG_VALUE_0='0',GIT_CONFIG_KEY_1='maintenance.auto',GIT_CONFIG_VALUE_1='false')
    start=time.monotonic();peak=0;captured=0
    with (E/(label+'.stdout')).open('wb') as out,(E/(label+'.stderr')).open('wb') as err:
        q=subprocess.Popen(argv,cwd=p,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,preexec_fn=lambda:child(git,native),start_new_session=True)
        sel=selectors.DefaultSelector()
        sel.register(q.stdout,selectors.EVENT_READ,out);sel.register(q.stderr,selectors.EVENT_READ,err)
        violation=None
        while sel.get_map() or q.poll() is None:
            for key,_ in sel.select(.03):
                chunk=os.read(key.fileobj.fileno(),8192)
                if not chunk:sel.unregister(key.fileobj);continue
                room=capture_limit-captured
                key.data.write(chunk[:room]);captured+=min(room,len(chunk))
                if len(chunk)>room:violation='output control'
            total=0
            for f in pathlib.Path('/proc').glob('[0-9]*/stat'):
                try:
                    v=f.read_text().rsplit(')',1)[1].split()
                    if int(v[3])==q.pid:total+=int(v[21])*os.sysconf('SC_PAGE_SIZE')
                except (OSError,ValueError,IndexError):pass
            peak=max(peak,total)
            if total>512*M or rss(os.getpid())>128*M or time.monotonic()-start>min(timeout,90):violation='RSS/wall control'
            if violation:
                try:os.killpg(q.pid,signal.SIGKILL)
                except ProcessLookupError:pass
                q.wait();break
        q.wait();sel.close();q.stdout.close();q.stderr.close()
    rec=dict(argv=[v if len(v)<4096 else {'bytes':len(v.encode()),'sha256':__import__('hashlib').sha256(v.encode()).hexdigest()} for v in argv],cwd=str(p),returncode=q.returncode,peakRSS=peak,wall=time.monotonic()-start,admission=adm,violation=violation)
    (E/(label+'.json')).write_text(json.dumps(rec))
    if (E/(label+'.stdout')).stat().st_size+(E/(label+'.stderr')).stat().st_size>capture_limit:raise RuntimeError('capture ceiling exceeded '+label)
    if q.returncode or violation:raise RuntimeError('operation rejected '+label+' '+(E/(label+'.stderr')).read_text()[:700])
    return (E/(label+'.stdout')).read_bytes()
def git(*args,cwd,label):return run(['git','-C',str(cwd),*args],cwd=cwd,label=label,git=True)
def identity(p,label):
    assert git('rev-parse','--show-toplevel',cwd=p,label=label+'-top').decode().strip()==str(p)
    assert git('rev-parse','--absolute-git-dir',cwd=p,label=label+'-gitdir').decode().strip()==str(p/'.git')
