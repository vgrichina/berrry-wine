"""Fresh task-local resource supervisor; never imports donor wrappers."""
import datetime, hashlib, json, os, pathlib, resource, selectors, signal, subprocess, sys, time

OWN=pathlib.Path('/tmp/toyvm-nonfinite-repair-independent-accept-oct29/repo').resolve()
TASK=OWN.parent
ROOT=pathlib.Path('/home/user/wine-assembly')
NAME=TASK.name
AREA=OWN/'test'/NAME
EV=AREA/'evidence'
FIX=TASK/'fixtures'
DISPATCH=ROOT/'scratch/usage-watch'/f'{NAME}-dispatch.json'
ADMISSION=ROOT/'scratch/usage-watch'/f'{NAME}-admission.json'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
ENV=dict(os.environ, GIT_SSH_COMMAND=SSH, GIT_ALTERNATE_OBJECT_DIRECTORIES=':'.join(json.loads((ROOT/'scratch/usage-watch'/f'{NAME}-object-stores.json').read_text())['stores']), PYTHONDONTWRITEBYTECODE='1', LC_ALL='C')
COUNT=max([int(p.name.split('-')[0]) for p in EV.glob('[0-9][0-9][0-9]-*.json')],default=0)
BASELINE=json.loads((EV/'baseline.json').read_text())['initialSharedWALBaseline'] if (EV/'baseline.json').exists() else None

def stamp(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(data): return hashlib.sha256(data).hexdigest()
def usage(path):
    files=[p for p in path.rglob('*') if p.is_file() and not p.is_symlink()] if path.exists() else []
    return dict(logical=sum(p.stat().st_size for p in files),allocated=sum(p.stat().st_blocks*512 for p in files))
def wals(): return {str(p):p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('*-wal')}
def save(name,value):
    raw=(json.dumps(value,sort_keys=True,indent=2)+'\n').encode()
    old=EV/name
    prior=old.stat() if old.exists() else None
    u=usage(EV)
    # Include allocated blocks and leave 64KiB for a first-failure record.
    assert max(u['logical']-(prior.st_size if prior else 0)+len(raw),u['allocated']-(prior.st_blocks*512 if prior else 0)+((len(raw)+4095)//4096)*4096)<=1048576-65536
    assert len(raw)<=1048576
    old.write_bytes(raw)

def admit(label):
    st=os.statvfs(TASK); mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
    alloc=json.loads(ADMISSION.read_text()); current=usage(TASK)
    wal=wals(); base=BASELINE or {}
    growth=sum(max(0,v-base.get(k,v)) for k,v in wal.items())
    session=list(pathlib.Path('/home/user/.codex/sessions/2026/10/29').glob('*'+os.environ['CODEX_SESSION_ID']+'.jsonl'))
    sessionbytes=session[0].stat().st_size if session else 0
    projection=dict(taskAllocated=current['allocated'],taskLogical=current['logical'],positiveSharedWALGrowthCountedOnce=growth,sessionBytes=sessionbytes,remainingTaskAllocation=max(0,25165824-current['allocated']-growth-sessionbytes),aggregateFutureGrowth=alloc['aggregate'],floor=2982150144,uncertaintyAndHeadroom=67108864)
    rec=dict(at=stamp(),operation=label,device=os.stat(TASK).st_dev,f_bavail=st.f_bavail,blockSize=st.f_frsize,freeBytes=st.f_bavail*st.f_frsize,MemAvailable=mem,aggregate=alloc['aggregate'],admissionSHA256=sha(ADMISSION.read_bytes()),projection=projection,evidence=usage(EV))
    rec['PASS']=(rec['freeBytes']-alloc['aggregate']>=2982150144+67108864 and mem>=alloc['memRequired'] and current['allocated']+growth+sessionbytes<=25165824 and max(rec['evidence'].values())<=1048576-65536)
    if not rec['PASS']:
        (EV/'FIRST-RESOURCE-FAILURE.json').write_text(json.dumps(rec,indent=2))
        raise RuntimeError('first resource admission failure: '+label)
    return rec

def valid_cwd(cwd):
    p=pathlib.Path(cwd).resolve(strict=True)
    if not p.is_dir() or not p.is_relative_to(OWN): raise ValueError('outside owned repository')
    return p

def proc_table():
    rows={}
    for p in pathlib.Path('/proc').iterdir():
        if not p.name.isdigit(): continue
        try:
            text=(p/'stat').read_text(); fields=text[text.rfind(')')+2:].split()
            rows[int(p.name)]=(int(fields[1]),int(fields[2]),int(fields[3]),int(fields[21])*os.sysconf('SC_PAGE_SIZE'))
        except (OSError,ValueError,IndexError): pass
    return rows

def run(argv,*,cwd,label,git=False,init=False,mutate=False):
    global COUNT
    cwd=valid_cwd(cwd)
    if git:
        if argv[:3]!=['git','-C',str(OWN)]: raise ValueError('Git requires exact explicit -C')
        if init:
            if (OWN/'.git').exists() or argv[3:]!=['init']: raise ValueError('initialization only own new directory')
        elif mutate:
            top=run(['git','-C',str(OWN),'rev-parse','--show-toplevel'],cwd=OWN,label='validate-toplevel',git=True)
            gd=run(['git','-C',str(OWN),'rev-parse','--absolute-git-dir'],cwd=OWN,label='validate-gitdir',git=True)
            if top[0] or gd[0] or pathlib.Path(top[1].decode().strip()).resolve()!=OWN or pathlib.Path(gd[1].decode().strip()).resolve()!=OWN/'.git': raise ValueError('Git identity mismatch')
    elif pathlib.Path(argv[0]).name=='git': raise ValueError('Git flag and explicit -C mandatory')
    admission=admit(label); COUNT+=1; prefix=f'{COUNT:03d}-{label}'
    def limits():
        resource.setrlimit(resource.RLIMIT_DATA,(256*1024**2 if git else 128*1024**2,)*2)
        resource.setrlimit(resource.RLIMIT_CPU,(90,90))
        resource.setrlimit(resource.RLIMIT_FSIZE,(12*1024**2,)*2)
        resource.setrlimit(resource.RLIMIT_CORE,(0,0))
    start=time.monotonic(); out=bytearray(); err=bytearray(); peak=0; samples=0; seen=set(); peakgroup=0; failure=None
    # Pipes are drained incrementally with a combined 2MiB capture ceiling.
    try:
        p=subprocess.Popen(argv,cwd=cwd,env=ENV,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,preexec_fn=limits)
    except Exception as error:
        (EV/(prefix+'.stdout')).write_bytes(b'')
        (EV/(prefix+'.stderr')).write_text(type(error).__name__+': '+str(error))
        save(prefix+'.json',dict(argv=argv,cwd=str(cwd),spawned=False,exception=type(error).__name__+': '+str(error),admission=admission))
        raise
    sel=selectors.DefaultSelector()
    for stream,buf in [(p.stdout,out),(p.stderr,err)]:
        os.set_blocking(stream.fileno(),False); sel.register(stream,selectors.EVENT_READ,buf)
    try:
        while sel.get_map() or p.poll() is None:
            rows=proc_table(); descendants={p.pid}
            for _ in range(len(rows)):
                more={pid for pid,r in rows.items() if r[0] in descendants or r[2]==p.pid}
                if more.issubset(descendants): break
                descendants|=more
            owned={pid:r for pid,r in rows.items() if pid in descendants}; seen.update(owned)
            parentrss=rows[os.getpid()][3]
            peak=max(peak,max((r[3] for r in owned.values()),default=0)); peakgroup=max(peakgroup,sum(r[3] for r in owned.values())+parentrss); samples+=1
            if peak>128*1024**2 or parentrss>128*1024**2 or peakgroup>512*1024**2: failure='physical RSS cap'
            if time.monotonic()-start>120: failure='wall cap'
            if len(out)+len(err)>2*1024**2: failure='capture cap'
            if failure: raise RuntimeError(failure)
            for key,_ in sel.select(.002):
                chunk=os.read(key.fileobj.fileno(),8192)
                if chunk:key.data.extend(chunk)
                else:sel.unregister(key.fileobj); key.fileobj.close()
        p.wait()
    finally:
        try:os.killpg(p.pid,signal.SIGKILL)
        except ProcessLookupError:pass
        for pid in seen-{p.pid}:
            try:os.kill(pid,signal.SIGKILL)
            except ProcessLookupError:pass
        p.wait(); sel.close()
        for stream in (p.stdout,p.stderr):stream.close()
    rows=proc_table()
    remaining=[pid for pid,r in rows.items() if r[2]==p.pid]
    # Explicit raw streams retained, including empty stderr.
    assert len(out)+len(err)<=2*1024**2
    reserve=usage(EV); projected=max(reserve.values())+((len(out)+4095)//4096)*4096+((len(err)+4095)//4096)*4096+16384
    assert projected<=1048576-65536
    (EV/(prefix+'.stdout')).write_bytes(out); (EV/(prefix+'.stderr')).write_bytes(err)
    save(prefix+'.json',dict(argv=argv,cwd=str(cwd),exit=p.returncode,stdout=prefix+'.stdout',stderr=prefix+'.stderr',wallSeconds=time.monotonic()-start,supervisorPhysicalRSS=rows[os.getpid()][3],peakProcessPhysicalRSS=peak,peakGroupPhysicalRSS=peakgroup,procSamples=samples,observedPIDs=sorted(seen),remainingGroup=remaining,cleanupComplete=not remaining,admission=admission,limits=dict(DATA=256*1024**2 if git else 128*1024**2,CPU=90,wall=120,file=12*1024**2,capture=2*1024**2,physicalRSS=128*1024**2,groupPhysicalRSS=512*1024**2),failure=failure))
    assert not remaining
    return p.returncode,bytes(out),bytes(err)

def git(args,*,label,mutate=False,init=False):
    result=run(['git','-C',str(OWN)]+args,cwd=OWN,label=label,git=True,mutate=mutate,init=init)
    assert result[0]==0,(label,result[0],result[2][:1000])
    return result[1]

def baseline():
    global BASELINE
    EV.mkdir(parents=True,exist_ok=True); FIX.mkdir(exist_ok=True)
    BASELINE=wals()
    session=list(pathlib.Path('/home/user/.codex/sessions/2026/10/29').glob('*'+os.environ['CODEX_SESSION_ID']+'.jsonl'))
    save('baseline.json',dict(at=stamp(),session=os.environ['CODEX_SESSION_ID'],sessionPath=str(session[0]) if session else None,initialSharedWALBaseline=BASELINE,positiveGrowthCountedOnce=True,inheritedLimits={str(k):resource.getrlimit(k) for k in [resource.RLIMIT_DATA,resource.RLIMIT_AS,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE]},mountArgv=[],mountFiles=[],mountParserRequired=False,mountReason='No mounts or guest invocation; empty argv',trustedGitSSH=SSH,allocationBytes=25165824,admission=admit('initial')))
