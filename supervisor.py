import os, sys, json, time, resource, signal, subprocess, hashlib
from pathlib import Path
resource.setrlimit(resource.RLIMIT_DATA,(128*1048576,resource.getrlimit(resource.RLIMIT_DATA)[1]))
resource.setrlimit(resource.RLIMIT_CPU,(90,90))
resource.setrlimit(resource.RLIMIT_FSIZE,(12*1048576,)*2)
OWN=Path('/tmp/tuxracer-accepted-syntax-current-main-integration-oct29/repo').resolve()
OUT=Path('/home/user/wine-assembly/scratch/usage-watch/tuxracer-accepted-syntax-current-main-integration-oct29')
E=OWN/'evidence'; E.mkdir(exist_ok=True)
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
ENV=os.environ.copy(); ENV.update(GIT_SSH_COMMAND=SSH,PYTHONDONTWRITEBYTECODE='1',TMPDIR=str(OWN),LC_ALL='C')
ENV['GIT_ALTERNATE_OBJECT_DIRECTORIES']=':'.join(json.loads(Path('/home/user/wine-assembly/scratch/usage-watch/tuxracer-accepted-syntax-current-main-integration-oct29-object-stores.json').read_text())['stores'])
def size(p):
    try:return p.stat().st_size
    except FileNotFoundError:return 0
def files_size(p):return sum(x.stat().st_blocks*512 for x in p.rglob('*') if x.is_file())
def dump(p,v):p.write_text(json.dumps(v,indent=2)+'\n')
def wal():return {str(p):size(p) for p in Path('/home/user/.codex').glob('*-wal')}
if not (E/'initial.json').exists():
    tid=os.environ.get('CODEX_THREAD_ID'); sessions=list(Path('/home/user/.codex/sessions').rglob('*'+str(tid)+'*'))
    dump(E/'initial.json',dict(at=time.time(),sessionID=tid,sessionPaths=[str(p) for p in sessions],sessionBaseline={str(p):size(p) for p in sessions},walBaseline=wal(),eventsBaseline=files_size(OUT),inheritedLimits={n:list(resource.getrlimit(getattr(resource,n))) for n in ['RLIMIT_DATA','RLIMIT_AS','RLIMIT_RSS','RLIMIT_CPU','RLIMIT_FSIZE','RLIMIT_NOFILE']},mountArgv=[],runtime=False,ssh=SSH,rootRefReceipt=str(OUT/'root-ref-digest.json'),forecastMiB=dict(sourceGit=3,tests=1,evidence=1,eventsWAL=8,publication=3,buffer=8)))
INITIAL=json.loads((E/'initial.json').read_text())
def admission(label):
    st=os.statvfs(OWN); mem=int(next(x.split()[1] for x in Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
    growth=sum(max(0,size(Path(p))-v) for p,v in INITIAL['walBaseline'].items())
    session=sum(max(0,size(Path(p))-v) for p,v in INITIAL['sessionBaseline'].items())
    measured=files_size(OWN)+max(0,files_size(OUT)-INITIAL['eventsBaseline'])+growth+session
    r=dict(at=time.time(),operation=label,device=os.stat(OWN).st_dev,f_bavail=st.f_bavail,blockSize=st.f_frsize,freeBytes=st.f_bavail*st.f_frsize,aggregate=125829120,requiredBytes=3175088128,MemAvailable=mem,memRequired=2147483648,ownMeasured=measured,positiveWALGrowthCountedOnce=growth,sessionGrowth=session,allocation=25165824,projection=25165824)
    r['PASS']=r['freeBytes']>=r['requiredBytes'] and mem>=r['memRequired'] and measured+8*1048576<=25165824
    with (E/'admissions.jsonl').open('a') as f:f.write(json.dumps(r)+'\n')
    if not r['PASS']:raise RuntimeError('FIRST ADMISSION FAILURE '+json.dumps(r))
def validate_cwd(cwd):
    p=Path(cwd).resolve()
    if p!=OWN and OWN not in p.parents:raise ValueError('outside owned directory')
    if not p.is_dir():raise ValueError('missing owned cwd')
    return p
def limits(git):
    resource.setrlimit(resource.RLIMIT_DATA,(256*1048576 if git else 128*1048576,)*2)
    resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(12*1048576,)*2)
def rss(pid):
    total=0; pids=[]
    for p in Path('/proc').iterdir():
        if not p.name.isdigit():continue
        try:
            s=(p/'stat').read_text().rsplit(')',1)[1].split()
            if int(s[2])==pid:
                total+=int(s[21])*os.sysconf('SC_PAGE_SIZE');pids.append(int(p.name))
        except (OSError,ValueError,IndexError):pass
    return total,pids
def run(argv, *, cwd, label, git=False, check=True, init=False):
    cwd=validate_cwd(cwd); admission(label)
    if git:
        assert argv[0]=='git' and argv[1:3]==['-C',str(OWN)]
        if not init:
            for flag,expected in [('--show-toplevel',str(OWN)),('--absolute-git-dir',str(OWN/'.git'))]:
                identity=run(['git','-C',str(OWN),'rev-parse',flag],cwd=cwd,label=label+'-identity'+flag,check=True)
                assert identity.decode().strip()==expected
    out=E/(label+'.stdout');err=E/(label+'.stderr'); start=time.monotonic();peak=0;incident=None
    with out.open('wb') as fo,err.open('wb') as fe:
        p=subprocess.Popen(argv,cwd=cwd,env=ENV,stdout=fo,stderr=fe,start_new_session=True,preexec_fn=lambda:limits(git or argv[0]=='git'))
        try:
            while p.poll() is None:
                amount,ids=rss(p.pid);peak=max(peak,amount)
                individual=[]
                for ident in ids:
                    try:individual.append(int(Path('/proc/'+str(ident)+'/statm').read_text().split()[1])*4096)
                    except OSError:pass
                if amount>512*1048576 or (individual and max(individual)>128*1048576) or time.monotonic()-start>120 or size(out)+size(err)>2*1048576:
                    incident='resource cap';break
                time.sleep(.025)
        finally:
            try:os.killpg(p.pid,signal.SIGKILL)
            except ProcessLookupError:pass
            p.wait()
    receipt=dict(argv=argv,cwd=str(cwd),code=p.returncode,peakPhysicalRSS=peak,wall=time.monotonic()-start,incident=incident,cleanup='process group killed; child reaped',stdoutBytes=size(out),stderrBytes=size(err))
    dump(E/(label+'.json'),receipt)
    if incident or (check and p.returncode):raise RuntimeError(json.dumps(receipt))
    return out.read_bytes()
def controls():
    sentinel=OWN/'CONTAINMENT_SENTINEL'
    for p in ['/', '/home/user/wine-assembly','/tmp/tuxracer-published-syntax-independent-accept-oct29/repo','/tmp']:
        try:run([sys.executable,'-c','open("CONTAINMENT_SENTINEL","w").write("bad")'],cwd=p,label='negative')
        except ValueError:pass
        else:raise AssertionError(p)
    try:run([sys.executable,'-c','pass'],label='omitted')
    except TypeError:pass
    else:raise AssertionError('omitted cwd accepted')
    assert not sentinel.exists()
    run([sys.executable,'-c','print("owned cwd positive control")'],cwd=OWN,label='positive')
    dump(E/'containment.json',dict(PASS=True,omittedRootDonorOutsideRejected=True,sentinelAbsent=True))
if __name__=='__main__':controls()
