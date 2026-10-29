import os, sys, json, time, signal, resource, subprocess
from pathlib import Path
B=Path('/tmp/tuxracer-serial-lexical-independent-accept-oct29')
R=B/'repo'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def save(name,data):
    (B/(name+'.json')).write_text(json.dumps(data,indent=2)+'\n')
def admission():
    s=os.statvfs(B); mem=dict(x.split(':',1) for x in Path('/proc/meminfo').read_text().splitlines())
    initial=json.loads((B/'initial.json').read_text())
    wal={str(p):p.stat().st_size for p in Path('/home/user/.codex').glob('*-wal')}
    positive=sum(max(0,v-initial['WALBaselines'].get(k,0)) for k,v in wal.items())
    session=Path(initial['session']).stat().st_size
    events=Path('/home/user/wine-assembly/scratch/usage-watch/tuxracer-serial-lexical-independent-accept-oct29/events.jsonl').stat().st_size
    owned=sum(p.stat().st_blocks*512 for p in B.rglob('*') if p.is_file())
    gitbytes=sum(p.stat().st_blocks*512 for p in (R/'.git').rglob('*') if p.is_file()) if (R/'.git').exists() else 0
    evidence=sum(p.stat().st_blocks*512 for p in B.rglob('*') if p.is_file() and not p.is_relative_to(R))
    data=dict(at=time.time(),device=B.stat().st_dev,f_bavail=s.f_bavail,blockSize=s.f_frsize,free=s.f_bavail*s.f_frsize,required=3099590656,aggregateOwners=50331648,projection=initial['projection']['projectionPerOwner'],MemAvailable=int(mem['MemAvailable'].split()[0])*1024,ownedPhysicalBytes=owned,gitPhysicalBytes=gitbytes,evidencePhysicalBytes=evidence,sessionBytes=session,eventsBytes=events,positiveWALOnce=positive)
    data['PASS']=data['free']>=data['required'] and data['MemAvailable']>=1073741824 and owned+session+events+positive+3145728+8388608<=25165824 and session+positive<=4194304 and events<=4194304 and gitbytes<=3145728 and evidence<=1048576
    with (B/'admissions.jsonl').open('a') as f:f.write(json.dumps(data)+'\n')
    if not data['PASS']:raise RuntimeError('ADMISSION FAILED '+json.dumps(data))
def limits(git):
    resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(12582912,12582912))
    resource.setrlimit(resource.RLIMIT_DATA,((256 if git else 128)*1048576,)*2)
def run(name,argv,*,cwd,expected=0):
    cwd=Path(cwd).resolve()
    if not cwd.is_relative_to(B) or not cwd.is_dir():raise ValueError('outside owned directory')
    if argv[0]=='git' and (argv[1:3]!=['-C',str(R)] or cwd!=R):raise ValueError('Git containment')
    admission(); env=dict(os.environ,GIT_SSH_COMMAND=SSH,PYTHONDONTWRITEBYTECODE='1',GIT_CONFIG_NOSYSTEM='1',GIT_CONFIG_GLOBAL='/dev/null')
    start=time.monotonic();peak=0;failure=None
    with (B/(name+'.stdout')).open('wb') as out,(B/(name+'.stderr')).open('wb') as err:
        p=subprocess.Popen(argv,cwd=cwd,env=env,stdout=out,stderr=err,start_new_session=True,preexec_fn=lambda:limits(argv[0]=='git'))
        try:
            while p.poll() is None:
                group=0
                for d in Path('/proc').iterdir():
                    if not d.name.isdigit():continue
                    try:
                        fields=(d/'stat').read_text().rsplit(')',1)[1].split()
                        if int(fields[2])==p.pid:
                            rss=int(fields[21])*os.sysconf('SC_PAGE_SIZE');group+=rss
                            if (d/'comm').read_text().startswith('python') and rss>134217728:failure='Python RSS'
                    except (OSError,ValueError,IndexError):pass
                peak=max(peak,group)
                if group>536870912:failure='group RSS'
                if time.monotonic()-start>120:failure='wall'
                if out.tell()+err.tell()>2097152:failure='capture'
                if failure:raise RuntimeError(failure)
                time.sleep(.02)
        finally:
            try:os.killpg(p.pid,signal.SIGKILL)
            except ProcessLookupError:pass
            p.wait()
    receipt=dict(argv=argv,cwd=str(cwd),returncode=p.returncode,seconds=time.monotonic()-start,peakGroupRSS=peak,incident=failure,processGroupReaped=True,limits=dict(cpu=90,wall=120,file=12582912,capture=2097152,gitDATA=268435456,pythonDATA=134217728,pythonRSS=134217728,groupRSS=536870912))
    save(name,receipt)
    if p.returncode!=expected:raise RuntimeError(name+' unexpected exit '+str(p.returncode))
    return (B/(name+'.stdout')).read_text()
def git(name,args,*,mutate=False,init=False):
    if mutate and not init:
        assert run(name+'-top',['git','-C',str(R),'rev-parse','--show-toplevel'],cwd=R).strip()==str(R)
        assert run(name+'-dir',['git','-C',str(R),'rev-parse','--absolute-git-dir'],cwd=R).strip()==str(R/'.git')
    if init:assert not (R/'.git').exists()
    return run(name,['git','-C',str(R)]+args,cwd=R)
if __name__=='__main__':
    controls=[]
    for label,kw in [('omitted',{}),('root',{'cwd':'/home/user/wine-assembly'}),('donor',{'cwd':'/tmp/tuxracer-cwd-contained-lexical-repair-oct29/repo'})]:
        try:run('forbidden',['/usr/bin/python3','-c','raise SystemExit(99)'],**kw)
        except (TypeError,ValueError):controls.append(label+' rejected before spawn')
        else:raise AssertionError(label)
    run('sentinel',['/usr/bin/python3','-c','import os;print(os.getcwd())'],cwd=B)
    save('containment',controls)
    cfg=Path('/tmp/tuxracer-cwd-contained-lexical-repair-oct29/launch-configuration.json')
    import hashlib
    c=json.loads(cfg.read_text());assert c['ssh']==SSH and c['mountArgv']==[] and c['intendedFiles']==[]
    original=Path(c['reuse']);assert hashlib.sha256(original.read_bytes()).hexdigest()==c['reuseSHA256']
    save('launch-configuration',dict(ssh=SSH,mountArgv=[],intendedFiles=[],reuse=str(cfg),reuseSHA256=hashlib.sha256(cfg.read_bytes()).hexdigest(),canonicalReceipt=c))
    R.mkdir();git('init',['init'],mutate=True,init=True)
    donor=Path('/tmp/tuxracer-cwd-contained-lexical-repair-oct29/repo/.git/objects')
    paths=[str(donor)]+(donor/'info/alternates').read_text().splitlines()
    assert all(Path(p).is_absolute() and Path(p).is_dir() for p in paths)
    (R/'.git/objects/info/alternates').write_text('\n'.join(paths)+'\n')
    git('sparse-init',['sparse-checkout','init','--no-cone'],mutate=True)
    git('sparse-set',['sparse-checkout','set','/tools/recovery/tuxracer-original-win32-recovery-oct28.py','/test/tuxracer-parent-relative-independent-oct28.py'],mutate=True)
    git('checkout',['checkout','-b','task/tuxracer-serial-lexical-independent-accept-oct29','fec0a4bc9af1bf10bd3c8056181573f305a1caf9'],mutate=True)
