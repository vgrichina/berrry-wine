import os,sys,pathlib,json,time,resource,subprocess,signal,selectors,hashlib,datetime
OWN=pathlib.Path('/tmp/toyvm-real-backend-caller-qualification-oct29').resolve()
REPO=OWN/'repo'
OUT=REPO/'test/toyvm-real-backend-caller-qualification-oct29'
OUT.mkdir(parents=True,exist_ok=True)
M=1024**2
resource.setrlimit(resource.RLIMIT_DATA,(128*M,resource.getrlimit(resource.RLIMIT_DATA)[1]))
def save(name,value):
    data=json.dumps(value,sort_keys=True,indent=2).encode()+b'\n'
    if len(data)>M:raise RuntimeError('evidence cap')
    (OUT/name).write_bytes(data)
def validate(cwd):
    p=pathlib.Path(cwd).resolve(strict=True)
    if not p.is_dir() or not p.is_relative_to(OWN):raise ValueError('outside owned task cwd')
    return p
def admission(label):
    s=os.statvfs(OWN);mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
    owned=sum(p.stat().st_blocks*512 for p in OWN.rglob('*') if p.is_file())
    session=next(pathlib.Path('/home/user/.codex/sessions/2026/10/29').glob('*01a18598-06fc-7331-933a-8cf6ff35ba93*'))
    initial=json.loads((OUT/'baseline.json').read_text()) if (OUT/'baseline.json').exists() else None
    sessiongrowth=max(0,session.stat().st_size-(initial['sessionBytes'] if initial else session.stat().st_size))
    wals={str(p):p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('*sqlite-wal')}
    growth=sum(max(0,v-(initial['walBytes'].get(k,0) if initial else v)) for k,v in wals.items())
    r=dict(label=label,at=datetime.datetime.now(datetime.timezone.utc).isoformat(),device=os.stat(OWN).st_dev,f_bavail=s.f_bavail,blockSize=s.f_frsize,freeBytes=s.f_bavail*s.f_frsize,aggregate=176160768,requiredBytes=3225419776,forecastRemaining=176160768,ownPhysicalBytes=owned,sessionGrowth=sessiongrowth,positiveSharedWALGrowthCountedOnce=growth,MemAvailable=mem)
    r['PASS']=r['freeBytes']-r['forecastRemaining']>=r['requiredBytes'] and mem>=2147483648 and owned+sessiongrowth+growth<=24*M
    with (OUT/'admissions.jsonl').open('a') as f:f.write(json.dumps(r)+'\n')
    if not r['PASS']:save('first-resource-failure.json',r);raise RuntimeError('admission failed '+label)
    return r
def caps(git=False):
    resource.setrlimit(resource.RLIMIT_DATA,(256*M if git else 128*M,)*2)
    resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(12*M,)*2)
    resource.setrlimit(resource.RLIMIT_CORE,(0,0))
def sample(pid):
    procs={}
    for p in pathlib.Path('/proc').iterdir():
        if not p.name.isdigit():continue
        try:
            t=(p/'stat').read_text().rsplit(')',1)[1].split();procs[int(p.name)]=(int(t[1]),int(t[21])*os.sysconf('SC_PAGE_SIZE'),(int(t[11])+int(t[12]))/os.sysconf('SC_CLK_TCK'))
        except (OSError,ValueError,IndexError):pass
    ids={pid};last=set()
    while ids!=last:
        last=set(ids);ids.update(k for k,v in procs.items() if v[0] in ids)
    return ids,sum(procs[k][1] for k in ids if k in procs),max([procs[k][1] for k in ids if k in procs] or [0]),sum(procs[k][2] for k in ids if k in procs)
def run(argv,*,cwd,label,git=False):
    cwd=validate(cwd);admission(label)
    env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1',GIT_SSH_COMMAND='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes')
    stores=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-real-backend-caller-qualification-oct29-object-stores.json').read_text())['stores']
    env['GIT_ALTERNATE_OBJECT_DIRECTORIES']=':'.join(stores)
    started=time.monotonic();peak=0;reason=None;seen=set();data=[bytearray(),bytearray()]
    with (OUT/(label+'.stdout')).open('wb') as so,(OUT/(label+'.stderr')).open('wb') as se:
        p=subprocess.Popen(argv,cwd=cwd,env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,preexec_fn=lambda:caps(git))
        sel=selectors.DefaultSelector()
        for i,pipe in enumerate([p.stdout,p.stderr]):os.set_blocking(pipe.fileno(),False);sel.register(pipe,selectors.EVENT_READ,i)
        try:
            while sel.get_map() or p.poll() is None:
                ids,rss,individual,cpu=sample(p.pid);seen.update(ids);peak=max(peak,rss)
                if rss>512*M or (not git and individual>128*M):reason='physical RSS cap'
                if cpu>90:reason='group CPU cap'
                if time.monotonic()-started>120:reason='wall cap'
                if reason:break
                for key,_ in sel.select(.03):
                    b=os.read(key.fileobj.fileno(),8192)
                    if not b:sel.unregister(key.fileobj);continue
                    i=key.data
                    if sum(map(len,data))+len(b)>2*M:reason='capture cap';break
                    data[i].extend(b);[so,se][i].write(b)
                if reason:break
        finally:
            for pid in seen|{p.pid}:
                if pid==os.getpid():continue
                try:os.kill(pid,signal.SIGKILL)
                except ProcessLookupError:pass
            try:os.killpg(p.pid,signal.SIGKILL)
            except ProcessLookupError:pass
            p.wait();sel.close()
    r=dict(argv=argv,cwd=str(cwd),exit=p.returncode,reason=reason,wall=time.monotonic()-started,peakGroupRSS=peak,stdoutBytes=len(data[0]),stderrBytes=len(data[1]),cleanup='owned descendants terminated; child reaped')
    save(label+'.json',r)
    if reason:raise RuntimeError(reason)
    return p.returncode,bytes(data[0]),bytes(data[1])
def git(args,*,label,mutate=False,init=False):
    if init:
        if (REPO/'.git').exists():raise ValueError('initialization already exists')
    elif mutate:
        for flag,expected in [('--show-toplevel',REPO),('--absolute-git-dir',REPO/'.git')]:
            rc,out,err=run(['git','-C',str(REPO),'rev-parse',flag],cwd=REPO,label=label+'-identity-'+flag[2:],git=True)
            if rc or pathlib.Path(out.decode().strip()).resolve()!=expected:raise ValueError('Git identity mismatch')
    return run(['git','-C',str(REPO),*args],cwd=REPO,label=label,git=True)
def baseline():
    session=next(pathlib.Path('/home/user/.codex/sessions/2026/10/29').glob('*01a18598-06fc-7331-933a-8cf6ff35ba93*'))
    save('baseline.json',dict(session=str(session),sessionBytes=session.stat().st_size,walBytes={str(p):p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('*sqlite-wal')},inheritedLimits={n:resource.getrlimit(getattr(resource,n)) for n in ['RLIMIT_DATA','RLIMIT_AS','RLIMIT_CPU','RLIMIT_FSIZE']},allocationRetainedThroughCoordinatorCloseout=True))
def controls():
    rejected=[]
    for name,c in [('root','/home/user/wine-assembly'),('donor','/tmp/toyvm-cleanup-receipt-independent-accept-oct29/repo'),('outside','/tmp')]:
        try:run(['/usr/bin/false'],cwd=c,label='must-not-spawn-'+name)
        except ValueError:rejected.append(name)
    try:run(['/usr/bin/false'],label='must-not-spawn-omitted')
    except TypeError:rejected.append('omitted')
    rc,out,_=run(['/usr/bin/pwd'],cwd=OWN,label='owned-sentinel')
    assert rc==0 and out.decode().strip()==str(OWN) and len(rejected)==4
    save('cwd-controls.json',dict(rejectedBeforeSpawn=rejected,sentinel=out.decode().strip(),PASS=True))
if __name__=='__main__':
    baseline();controls()
    d=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-real-backend-caller-qualification-oct29-dispatch.json').read_text())
    for name,pin in d['sourcePins'].items():
        b=(REPO/name).read_bytes();assert len(b)==pin['bytes'] and hashlib.sha256(b).hexdigest()==pin['sha256']
    save('pins.json',d)
    for args,label in [(['--help'],'boat-help'),(['--json','limits'],'boat-limits')]:
        rc,out,err=run(['/home/user/.ascii/boat',*args],cwd=OWN,label=label);print(label,rc,out.decode()[:5000],err.decode()[:1000])
