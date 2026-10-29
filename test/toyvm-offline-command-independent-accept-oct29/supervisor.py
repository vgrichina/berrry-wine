import os, sys, json, time, pathlib, hashlib, subprocess, resource, signal, datetime
OWN = pathlib.Path('/tmp/toyvm-offline-command-independent-accept-oct29/repo').resolve()
ROOT = pathlib.Path('/home/user/wine-assembly')
TASK = 'toyvm-offline-command-independent-accept-oct29'
M = 1048576
SSH = 'ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
STORES = json.loads((ROOT/'scratch/usage-watch'/f'{TASK}-object-stores.json').read_text())['stores']
ENV = dict(os.environ, GIT_ALTERNATE_OBJECT_DIRECTORIES=':'.join(STORES), GIT_SSH_COMMAND=SSH, PYTHONDONTWRITEBYTECODE='1', GIT_CONFIG_NOSYSTEM='1')
ENV.pop('GIT_DIR', None); ENV.pop('GIT_WORK_TREE', None)
# Parent Python keeps its own DATA ceiling; only a Git child receives 256 MiB.
resource.setrlimit(resource.RLIMIT_DATA,(128*M,resource.getrlimit(resource.RLIMIT_DATA)[1]))
resource.setrlimit(resource.RLIMIT_CPU,(90,90))
resource.setrlimit(resource.RLIMIT_FSIZE,(12*M,12*M))
EV = OWN/'test'/TASK/'evidence'; EV.mkdir(exist_ok=True)
def save(name, data):
    b = (json.dumps(data, indent=2, allow_nan=False)+'\n').encode()
    assert len(b) < M
    (EV/name).write_bytes(b)
def validate(cwd):
    p = pathlib.Path(cwd).resolve()
    if not p.is_dir() or not p.is_relative_to(OWN): raise ValueError('outside owned directory')
    return p
def footprint(p):
    if p.is_file(): return p.stat().st_size
    return sum(x.stat().st_size for x in p.rglob('*') if x.is_file() and not x.is_symlink()) if p.exists() else 0
def admission(label):
    st=os.statvfs(OWN); mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
    used=footprint(OWN); free=st.f_bavail*st.f_frsize
    baselineFile=EV/'baseline.json'
    baseline=json.loads(baselineFile.read_text()) if baselineFile.exists() else {}
    sessions=sum(footprint(pathlib.Path(p)) for p in baseline.get('sessionPaths',[]))
    events=footprint(ROOT/'scratch/usage-watch'/TASK/'events.jsonl')
    walGrowth=sum(max(0,pathlib.Path(p).stat().st_size-size) for p,size in baseline.get('initialSharedWAL',{}).items() if pathlib.Path(p).exists())
    total=used+sessions+events+walGrowth
    data=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(), operation=label, device=OWN.stat().st_dev, f_bavail=st.f_bavail, blockSize=st.f_frsize, freeBytes=free, aggregate=125829120, requiredBytes=3175088128, futureGrowthIncludingUncertaintyBuffer=125829120, remainingAfterForecast=free-125829120, ownedBytes=used, allocation=24*M, MemAvailable=mem, memRequired=2147483648, admissionVersion='db706f7d85c101251d6b2a93baffd9ee8444c44e9173e593fd5f27444ee89072')
    data.update(sessionBytes=sessions,eventBytes=events,positiveSharedWALGrowthCountedOnce=walGrowth,completeMeasuredTaskBytes=total,remainingPublicationMiB=3,retainedBufferMiB=8)
    data['PASS']=free-125829120>=3175088128 and total+11*M<24*M and mem>=2147483648
    with (EV/'admission.jsonl').open('a') as f: f.write(json.dumps(data)+'\n')
    if not data['PASS']: save('first-admission-failure.json',data); raise RuntimeError('admission failed; no retry')
def limits(git):
    resource.setrlimit(resource.RLIMIT_DATA, (256*M if git else 128*M,256*M if git else 128*M))
    resource.setrlimit(resource.RLIMIT_CPU,(90,90)); resource.setrlimit(resource.RLIMIT_FSIZE,(12*M,12*M)); resource.setrlimit(resource.RLIMIT_CORE,(0,0))
def live(group):
    rows=[]
    for d in pathlib.Path('/proc').iterdir():
        if d.name.isdigit():
            try:
                s=(d/'stat').read_text().rsplit(')',1)[1].split()
                if int(s[2])==group:
                    rss=int(next(x.split()[1] for x in (d/'status').read_text().splitlines() if x.startswith('VmRSS:')))*1024
                    rows.append((int(d.name),rss))
            except (OSError,StopIteration,ValueError): pass
    return rows
def run(argv, *, cwd, label='command', git=False):
    cwd=validate(cwd)
    if git and argv[:3]!=['git','-C',str(OWN)]: raise ValueError('explicit owned git -C required')
    admission(label)
    out=EV/(label+'.stdout'); err=EV/(label+'.stderr')
    start=time.monotonic(); peak=0; reason=None
    with out.open('wb') as o, err.open('wb') as e:
        p=subprocess.Popen(argv,cwd=cwd,env=ENV,stdout=o,stderr=e,start_new_session=True,preexec_fn=lambda: limits(git))
        while p.poll() is None:
            rows=live(p.pid); peak=max(peak,sum(r for _,r in rows))
            if any(r>128*M for _,r in rows) or peak>512*M: reason='physical RSS cap'
            if time.monotonic()-start>120: reason='wall cap'
            if out.stat().st_size+err.stat().st_size>2*M: reason='capture cap'
            if reason: os.killpg(p.pid,signal.SIGKILL); break
            time.sleep(.01)
        p.wait()
    try: os.killpg(p.pid,signal.SIGKILL)
    except ProcessLookupError: pass
    data=dict(argv=argv,cwd=str(cwd),exit=p.returncode,seconds=time.monotonic()-start,peakPhysicalRSS=peak,reason=reason,stdout=str(out.relative_to(OWN)),stderr=str(err.relative_to(OWN)),cleanupRemaining=live(p.pid))
    with (EV/'operations.jsonl').open('a') as f: f.write(json.dumps(data)+'\n')
    if reason: save('resource-incident.json',data); raise RuntimeError(reason)
    return p.returncode,out.read_bytes(),err.read_bytes()
def git(args, *, cwd, label, mutate=False, init=False):
    validate(cwd)
    if init:
        if pathlib.Path(cwd).resolve()!=OWN or (OWN/'.git').exists(): raise ValueError('bad initialization')
    elif mutate:
        for opt,expected in [('--show-toplevel',str(OWN)),('--absolute-git-dir',str(OWN/'.git'))]:
            rc,out,_=run(['git','-C',str(OWN),'rev-parse',opt],cwd=cwd,git=True,label=label+opt)
            if rc or out.decode().strip()!=expected: raise ValueError('repository identity mismatch')
    rc,out,err=run(['git','-C',str(OWN),*args],cwd=cwd,git=True,label=label)
    if rc: raise RuntimeError(f'git {label} exit {rc}: '+err.decode()[:1000])
    return out
def baseline():
    receipts={}
    for suffix,pin in [('dispatch','8546ea7267fe5073193dca88011af7893d01b387518d51b12346ec3aae589c43'),('admission','db706f7d85c101251d6b2a93baffd9ee8444c44e9173e593fd5f27444ee89072')]:
        p=ROOT/'scratch/usage-watch'/f'{TASK}-{suffix}.json'; actual=hashlib.sha256(p.read_bytes()).hexdigest(); assert actual==pin; receipts[suffix]=dict(path=str(p),sha256=actual)
    tid=os.environ.get('CODEX_THREAD_ID'); sessions=list(pathlib.Path('/home/user/.codex/sessions').rglob(f'*{tid}*'))
    wals={str(p):p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('*-wal')}
    save('baseline.json',dict(task=TASK,thread=tid,sessionPaths=[str(p) for p in sessions],sessionBytes=sum(footprint(p) for p in sessions),initialSharedWAL=wals,positiveSharedWALBaselineCountedOnce=sum(wals.values()),limits={str(k):resource.getrlimit(k) for k in [resource.RLIMIT_DATA,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE,resource.RLIMIT_AS]},receipts=receipts,mountArgv=[],mountFiles=[],mountExecution=False,ssh=SSH,allocationBreakdownMiB=dict(git=3,tests=1,evidence=1,eventsWAL=8,publication=3,buffer=8),offlineValidationOnly=True,runtimeQualified=False))
    controls=[]
    for p in [None,ROOT,pathlib.Path(STORES[0]).parents[1],pathlib.Path('/tmp')]:
        try:
            if p is None: run([sys.executable,'-c','raise Exception("spawned")'])
            else: run([sys.executable,'-c','raise Exception("spawned")'],cwd=p)
        except (TypeError,ValueError) as e: controls.append(dict(cwd=str(p),rejected=type(e).__name__))
        else: raise AssertionError('containment failed')
    rc,out,_=run([sys.executable,'-c','import os,resource,json; print(json.dumps({"cwd":os.getcwd(),"data":resource.getrlimit(resource.RLIMIT_DATA)}))'],cwd=OWN,label='contained-sentinel')
    assert rc==0 and json.loads(out)['cwd']==str(OWN)
    save('containment.json',dict(negativeControls=controls,sentinel=json.loads(out),PASS=True))
if __name__=='__main__': baseline()
