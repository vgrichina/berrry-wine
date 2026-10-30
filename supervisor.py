import os,sys,json,time,pathlib,resource,subprocess,signal,hashlib,datetime
OWN=pathlib.Path('/tmp/toyvm-cleanup-receipt-independent-accept-oct29/repo').resolve()
HOST=pathlib.Path('/home/user/wine-assembly')
TASK='toyvm-cleanup-receipt-independent-accept-oct29'
E=OWN/'evidence'; E.mkdir(exist_ok=True)
DISPATCH=HOST/'scratch/usage-watch'/f'{TASK}-dispatch.json'
D=json.loads(DISPATCH.read_text())
ADMISSION=HOST/'scratch/usage-watch'/f'{TASK}-admission.json'
STORES=json.loads((HOST/'scratch/usage-watch'/f'{TASK}-object-stores.json').read_text())['stores']
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
ENV=dict(os.environ,GIT_ALTERNATE_OBJECT_DIRECTORIES=':'.join(STORES),GIT_SSH_COMMAND=SSH,PYTHONDONTWRITEBYTECODE='1')
for k,v in [('RLIMIT_DATA',128<<20),('RLIMIT_FSIZE',12<<20),('RLIMIT_CPU',90)]:
    r=getattr(resource,k); old=resource.getrlimit(r); resource.setrlimit(r,(min(v,old[0]) if old[0]>=0 else v,old[1]))
def save(name,data):
    p=E/name; raw=json.dumps(data,indent=2,sort_keys=True)+'\n'; assert len(raw.encode())<=1<<20; p.write_text(raw)
def admission(label):
    s=os.statvfs(OWN); mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
    a=json.loads(ADMISSION.read_text()); total=sum(p.stat().st_size for p in OWN.rglob('*') if p.is_file())
    baseline=json.loads((E/'startup.json').read_text()) if (E/'startup.json').exists() else {}
    walGrowth=sum(max(0,pathlib.Path(p).stat().st_size-v) for p,v in baseline.get('sharedWALBaselineCountedOnce',{}).items())
    sessionBytes=sum(pathlib.Path(p).stat().st_size for p in baseline.get('session',[]))
    eventDir=HOST/'scratch/usage-watch'/TASK
    eventBytes=sum(p.stat().st_size for p in eventDir.iterdir() if p.is_file())
    footprint=total+sessionBytes+eventBytes+walGrowth
    sample=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),operation=label,device=OWN.stat().st_dev,f_bavail=s.f_bavail,blockSize=s.f_frsize,free=s.f_bavail*s.f_frsize,MemAvailable=mem,aggregate=a['aggregate'],requiredBytes=a['requiredBytes'],projection=a['futureGrowthIncludingUncertaintyBuffer'],admissionSHA256=hashlib.sha256(ADMISSION.read_bytes()).hexdigest(),ownedLogicalBytes=total,sessionBytes=sessionBytes,eventBytes=eventBytes,positiveSharedWALGrowthCountedOnce=walGrowth,completeTaskFootprint=footprint,publicationAndUncertaintyReserve=8<<20)
    sample['PASS']=sample['free']>=a['requiredBytes'] and mem>=a['memRequired'] and footprint+(8<<20)<=24<<20
    with (E/'admission.jsonl').open('a') as f: f.write(json.dumps(sample)+'\n')
    if not sample['PASS']: raise RuntimeError('FIRST ADMISSION FAILURE '+json.dumps(sample))
def checked(cwd):
    p=pathlib.Path(cwd).resolve()
    if not p.is_relative_to(OWN) or not p.is_dir(): raise ValueError('outside owned task')
    return p
def run(argv,*,cwd,label,git=False):
    cwd=checked(cwd)
    if git and argv[:3]!=['git','-C',str(OWN)]: raise ValueError('Git requires explicit own -C')
    admission(label)
    def limits():
        os.setsid()
        if git: resource.setrlimit(resource.RLIMIT_DATA,(256<<20,resource.getrlimit(resource.RLIMIT_DATA)[1]))
    # Git inherits 128MiB DATA from Python: set Git-specific soft cap within unchanged hard limit.
    out=E/(label+'.stdout'); err=E/(label+'.stderr')
    with out.open('wb') as o,err.open('wb') as e:
        p=subprocess.Popen(argv,cwd=cwd,env=ENV,stdout=o,stderr=e,preexec_fn=limits)
        start=time.monotonic(); peak=0; reason=None
        while p.poll() is None:
            selfstat=pathlib.Path('/proc/self/stat').read_text().rsplit(')',1)[1].split()
            rss=int(selfstat[21])*os.sysconf('SC_PAGE_SIZE'); individual=rss
            for proc in pathlib.Path('/proc').iterdir():
                if not proc.name.isdigit(): continue
                try:
                    fields=(proc/'stat').read_text().rsplit(')',1)[1].split()
                    if int(fields[2])==p.pid:
                        r=int(fields[21])*os.sysconf('SC_PAGE_SIZE'); rss+=r; individual=max(individual,r)
                except (OSError,ValueError,IndexError): pass
            peak=max(peak,rss)
            if time.monotonic()-start>120: reason='wall120'
            if rss>512<<20 or individual>128<<20: reason='physicalRSS'
            if out.stat().st_size>2<<20 or err.stat().st_size>2<<20: reason='capture2MiB'
            if reason: os.killpg(p.pid,signal.SIGKILL); break
            time.sleep(.02)
        p.wait()
        try: os.killpg(p.pid,signal.SIGKILL)
        except ProcessLookupError: pass
    save(label+'.json',dict(argv=argv,cwd=str(cwd),exit=p.returncode,peakGroupRSS=peak,limitFailure=reason,descendantCleanup='killpg after completion',stdout=out.name,stderr=err.name))
    if reason: raise RuntimeError(reason)
    return p.returncode,out.read_bytes(),err.read_bytes()
def git(args,*,label,mutate=False,initial=False):
    if mutate and not initial:
        for opts,expected in [(['--show-toplevel'],str(OWN)),(['--absolute-git-dir'],str(OWN/'.git'))]:
            c,o,e=run(['git','-C',str(OWN),'rev-parse']+opts,cwd=OWN,label=label+'-identity-'+opts[0][2:],git=True)
            assert c==0 and o.decode().strip()==expected,(o,e)
    c,o,e=run(['git','-C',str(OWN)]+args,cwd=OWN,label=label,git=True)
    if c: raise RuntimeError(label+': '+e.decode()[:1000])
    return o
def bootstrap():
    for key,sha in [(DISPATCH,'a4c6f97ff500a901777c34d2fe2b6467cdc725ae237929ced66d6240efc41d6f'),(ADMISSION,'d0a6308a59060745b2f663a46acd62139fb098e9a600477e38b992e4c08864b1')]: assert hashlib.sha256(key.read_bytes()).hexdigest()==sha
    negatives=[]
    for val in [HOST,pathlib.Path('/'),pathlib.Path('/tmp/toyvm-cleanup-receipt-type-repair-oct29/repo')]:
        try: run(['false'],cwd=val,label='MUST-NOT-SPAWN')
        except ValueError: negatives.append(str(val))
        else: raise AssertionError('cwd accepted')
    try: run(['false'],label='MUST-NOT-SPAWN')
    except TypeError: negatives.append('omitted')
    c,o,e=run([sys.executable,'-c','import os;print(os.getcwd())'],cwd=OWN,label='owned-sentinel'); assert c==0 and o.decode().strip()==str(OWN)
    session=list(pathlib.Path('/home/user/.codex/sessions/2026/10/29').glob('*'+os.environ['CODEX_THREAD_ID']+'*'))
    save('startup.json',dict(session=[str(x) for x in session],thread=os.environ['CODEX_THREAD_ID'],negativeControls=negatives,inheritedLimits={str(k):resource.getrlimit(k) for k in [resource.RLIMIT_DATA,resource.RLIMIT_AS,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE]},sharedWALBaselineCountedOnce={str(p):p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('*-wal')},ssh=SSH,mountArgv=[],mountFiles=[],runtimeAllowed=False,allocationRetainedThroughCoordinatorCloseout=True))
    assert not (OWN/'.git').exists()
    git(['init','.'],label='init',mutate=True,initial=True)
    git(['config','user.name','Wine Ops acceptance worker'],label='config-name',mutate=True)
    git(['config','user.email','wine-ops@local.invalid'],label='config-email',mutate=True)
    git(['remote','add','origin','git@github.com:vgrichina/wine-assembly.git'],label='remote',mutate=True)
    git(['sparse-checkout','init','--no-cone'],label='sparse-init',mutate=True)
    paths=list(D['sourceArtifacts'])+list(D['priorDispatch']['sourcePins'])+[D['priorDispatch']['flattenedSupervisor']['path']]
    git(['sparse-checkout','set','--no-cone']+['/'+x for x in sorted(set(paths))],label='sparse-set',mutate=True)
    git(['checkout','-b','task/'+TASK,D['candidate']],label='checkout',mutate=True)
    pins={}
    for path,meta in D['sourceArtifacts'].items():
        raw=(OWN/path).read_bytes(); assert len(raw)==meta['bytes'] and hashlib.sha256(raw).hexdigest()==meta['sha256']; pins[path]=meta
    save('input-pins.json',dict(candidate=D['candidate'],sources=pins,backendBase=D['backendBase']))
    print('bootstrap PASS')
if __name__=='__main__': bootstrap()
