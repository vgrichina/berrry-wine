import os, sys, json, hashlib, pathlib, resource, subprocess, time, signal, datetime
R = pathlib.Path('/tmp/tuxracer-tested-syntax-publication-oct29/repo').resolve()
T = R.parent
HOST = pathlib.Path('/home/user/wine-assembly')
D = HOST/'scratch/usage-watch'
NAME = 'tuxracer-tested-syntax-publication-oct29'
SSH = 'ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
E = R/'evidence'
E.mkdir(exist_ok=True)
def sha(p): return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def write(name, obj):
    data = json.dumps(obj, indent=2).encode()
    assert len(data) < 1048576
    (E/name).write_bytes(data)
def limits():
    return {k:list(resource.getrlimit(getattr(resource,k))) for k in ['RLIMIT_DATA','RLIMIT_AS','RLIMIT_CPU','RLIMIT_FSIZE','RLIMIT_NOFILE']}
INHERITED = limits()
def cap(kind, n):
    soft,hard=resource.getrlimit(kind)
    resource.setrlimit(kind,(min(n,hard) if hard != -1 else n,hard))
cap(resource.RLIMIT_DATA,128*1024**2)
cap(resource.RLIMIT_CPU,90)
cap(resource.RLIMIT_FSIZE,12*1024**2)
WALS = {str(p):p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('*-wal')}
if (E/'initial').exists():
    WALS=json.loads((E/'initial').read_text())['initialSharedWALBaseline']
SESSION_ID=os.environ.get('CODEX_THREAD_ID')
SESSIONS=list(pathlib.Path('/home/user/.codex/sessions/2026/10/29').glob('*'+str(SESSION_ID)+'*'))
def footprint(p):
    if not p.exists(): return 0
    return sum(x.stat().st_blocks*512 for x in p.rglob('*') if x.is_file())
def admission(label):
    s=os.statvfs(R); mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
    task=footprint(T); events=D/NAME
    wal_growth=sum(max(0,pathlib.Path(p).stat().st_size-n) for p,n in WALS.items() if pathlib.Path(p).exists())
    session_bytes=sum(p.stat().st_blocks*512 for p in SESSIONS)
    owned=task+footprint(events)+session_bytes+wal_growth
    rec=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(), device=R.stat().st_dev,f_bavail=s.f_bavail,blockSize=s.f_frsize,freeBytes=s.f_bavail*s.f_frsize,aggregate=125829120,requiredBytes=3175088128,MemAvailable=mem,memRequired=2147483648,allocation=25165824,taskPhysicalBytes=task,sessionPhysicalBytes=session_bytes,eventsPhysicalBytes=footprint(events),positiveSharedWALGrowthCountedOnce=wal_growth,measuredOwnedBytes=owned,remainingGrowthAndBuffer=125829120,projection='aggregate remaining growth includes materialization/Git8MiB, evidence1MiB, session/events/WAL8MiB, publication3MiB, uncertainty4MiB in own24MiB; transferred allocation retained through coordinator closeout',admissionSHA256=sha(D/(NAME+'-admission.json')))
    rec['PASS']=rec['freeBytes']>=3175088128 and rec['freeBytes']-125829120>=2982150144 and mem>=2147483648 and owned<=25165824
    write(label+'.admission.json',rec)
    if not rec['PASS']: raise RuntimeError('FIRST ADMISSION FAILURE '+label)
def validate(cwd):
    p=pathlib.Path(cwd).resolve(strict=True)
    if p != R and R not in p.parents: raise ValueError('outside owned task directory')
    if not p.is_dir(): raise ValueError('not directory')
    return p
def rss_group(pgid):
    total=0; maximum=0
    for d in pathlib.Path('/proc').iterdir():
        if not d.name.isdigit(): continue
        try:
            stat=(d/'stat').read_text().rsplit(')',1)[1].split()
            if int(stat[2])==pgid:
                rss=int(next(x.split()[1] for x in (d/'status').read_text().splitlines() if x.startswith('VmRSS:')))*1024
                total+=rss; maximum=max(maximum,rss)
        except (OSError,StopIteration,ValueError): pass
    return total,maximum
def run(argv, label, *, cwd, git=False):
    cwd=validate(cwd)
    if git and (argv[:3] != ['git','-C',str(R)]): raise ValueError('Git -C required')
    admission(label)
    def child_limits():
        cap(resource.RLIMIT_DATA,(256 if git else 128)*1024**2)
        cap(resource.RLIMIT_CPU,90); cap(resource.RLIMIT_FSIZE,12*1024**2)
    env=os.environ.copy()
    for k in ['GIT_DIR','GIT_WORK_TREE','GIT_INDEX_FILE','GIT_COMMON_DIR','GIT_OBJECT_DIRECTORY']: env.pop(k,None)
    env.update(GIT_SSH_COMMAND=SSH,GIT_ALTERNATE_OBJECT_DIRECTORIES=':'.join(STORES),GIT_TERMINAL_PROMPT='0')
    start=time.monotonic(); peak=0; incident=None
    out=E/(label+'.stdout'); err=E/(label+'.stderr')
    p=None
    try:
        with out.open('wb') as o, err.open('wb') as e:
            p=subprocess.Popen(argv,cwd=str(cwd),env=env,stdout=o,stderr=e,start_new_session=True,preexec_fn=child_limits)
            while p.poll() is None:
                total,maximum=rss_group(p.pid); peak=max(peak,total)
                selfrss=int(next(x.split()[1] for x in pathlib.Path('/proc/self/status').read_text().splitlines() if x.startswith('VmRSS:')))*1024
                if total+selfrss>512*1024**2 or maximum>128*1024**2 or selfrss>128*1024**2: incident='physical RSS limit'
                if time.monotonic()-start>120: incident='wall limit'
                if out.stat().st_size+err.stat().st_size>2*1024**2: incident='capture limit'
                if incident: break
                time.sleep(.025)
    finally:
        if p:
            try: os.killpg(p.pid,signal.SIGKILL)
            except ProcessLookupError: pass
            p.wait()
    rec=dict(argv=argv,cwd=str(cwd),exitCode=p.returncode if p else None,wallSeconds=time.monotonic()-start,peakGroupRSS=peak,incident=incident,cleanup='process group SIGKILL after operation; child reaped',stdoutBytes=out.stat().st_size,stderrBytes=err.stat().st_size)
    write(label+'.json',rec)
    if incident or p.returncode: raise RuntimeError('FIRST OPERATION FAILURE '+label)
    return out.read_bytes()
def git(args,label, *, cwd, mutate=False, init=False):
    cwd=validate(cwd)
    if init:
        assert cwd==R and not (R/'.git').exists()
    elif mutate:
        top=run(['git','-C',str(R),'rev-parse','--show-toplevel'],label+'-top',cwd=cwd,git=True).decode().strip()
        gd=run(['git','-C',str(R),'rev-parse','--absolute-git-dir'],label+'-gitdir',cwd=cwd,git=True).decode().strip()
        assert pathlib.Path(top).resolve()==R and pathlib.Path(gd).resolve()==R/'.git'
    return run(['git','-C',str(R)]+args,label,cwd=cwd,git=True)
STORES=json.loads((D/(NAME+'-object-stores.json')).read_text())['stores']
def main():
    assert sha(D/(NAME+'-dispatch.json'))=='cff4cf820b5f13a088e2bd234ee1a21100921098111f2ddd9bb68bae544506d2'
    assert sha(D/(NAME+'-admission.json'))=='092d06578f3a125df527d04509f5365522c526097d3ecaf85434fa39502d94df'
    dispatch=json.loads((D/(NAME+'-dispatch.json')).read_text())
    write('initial',dict(sessionID=SESSION_ID,sessionPaths=[str(x) for x in SESSIONS],initialSharedWALBaseline=WALS,positiveGrowthCount='once against initial baseline',inheritedLimits=INHERITED,appliedLimits=limits(),mountArgv=[],intendedFiles=[],runtime=False,rootRefReceipt=str(D/NAME/'root-ref-digest.json'),allocationRetention='through coordinator closeout'))
    controls={}
    for label,cwd in [('root',HOST),('donor',pathlib.Path('/tmp/tuxracer-real-media-tcl-syntax-gap-oct29/repo')),('outside',pathlib.Path('/tmp'))]:
        try: run(['/usr/bin/true'],'negative-'+label,cwd=cwd)
        except ValueError: controls[label]='rejected before spawn'
        else: raise AssertionError(label)
    try: run(['/usr/bin/true'],'omitted')
    except TypeError: controls['omitted']='rejected before spawn'
    else: raise AssertionError('omitted')
    assert run(['/bin/pwd'],'sentinel',cwd=R).decode().strip()==str(R)
    controls['ownedSentinel']='PASS';write('containment',controls)
    launch=D/'tuxracer-serial-lexical-independent-accept-oct29/retained-evidence/launch-configuration.json'
    assert sha(launch)=='84c1c11306bd7265aa6765911faf2296e230b8d7c578212427d1d8a4514f2115'
    lc=json.loads(launch.read_text()); assert lc['ssh']==SSH and lc['mountArgv']==[] and lc['intendedFiles']==[]
    write('launch-configuration',dict(receipt=str(launch),sha256=sha(launch),ssh=SSH,mountArgv=[],intendedFiles=[],validation='reuse exact unchanged configuration receipt; no mount execution'))
    pins={}
    for rel,pin in dispatch['testedWIP'].items():
        p=pathlib.Path(pin['path']);assert p.stat().st_size==pin['bytes'] and sha(p)==pin['sha256'];pins[rel]=pin
    manifest=json.loads(pathlib.Path(dispatch['retainedEvidenceManifest']).read_text())
    retained=pathlib.Path(dispatch['canonicalReceipt']).parent.parent
    verified=[]
    for rel,pin in manifest.items():
        p=retained/rel
        assert p.stat().st_size==pin['bytes'] and sha(p)==pin['sha256'],rel
        verified.append(dict(path=str(p),**pin))
    write('inherited-evidence',dict(manifest=str(dispatch['retainedEvidenceManifest']),manifestSHA256=sha(dispatch['retainedEvidenceManifest']),verified=verified,canonicalReceipt=str(dispatch['canonicalReceipt']),canonicalSHA256=sha(dispatch['canonicalReceipt']),tests='reused unchanged; API equals actual CLI; literals1->4; syntax6->1; mutation killed; computed UNKNOWN; no rerun',incidents='all predecessor staging, alternate nesting, setup, argv and result collision receipts preserved'))
    git(['init','--initial-branch=task/'+NAME], 'init',cwd=R,init=True)
    git(['config','core.sparseCheckout','true'],'config-sparse',cwd=R,mutate=True)
    admission('sparse-definition')
    (R/'.git/info/sparse-checkout').write_text(''.join('/'+p+'\n' for p in pins))
    git(['checkout','-b','task/'+NAME,dispatch['base']],'checkout',cwd=R,mutate=True)
    original=git(['show',dispatch['base']+':'+dispatch['sourcePins']['source']['path']],'base-source',cwd=R)
    assert hashlib.sha256(original).hexdigest()==dispatch['sourcePins']['source']['sha256']
    admission('materialize')
    for rel,pin in pins.items():
        p=R/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(pathlib.Path(pin['path']).read_bytes());assert sha(p)==pin['sha256']
    git(['add','--sparse','--']+list(pins),'stage',cwd=R,mutate=True)
    changed=git(['diff','--cached','--name-only'],'staged-paths',cwd=R).decode().splitlines();assert sorted(changed)==sorted(pins)
    git(['diff','--cached','--check'],'diff-check',cwd=R)
    git(['diff','--cached','--no-ext-diff'],'review-diff',cwd=R)
    write('materialization',pins)
    print('READY_FOR_DIFF_REVIEW',flush=True)
if __name__=='__main__':
    try: main()
    except Exception as exc:
        write('FIRST-FAILURE',dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),error=repr(exc),allocationRetained=True))
        print('STOP',repr(exc));sys.exit(1)
