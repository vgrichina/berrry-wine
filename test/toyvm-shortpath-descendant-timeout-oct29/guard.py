import os,sys,json,time,pathlib,subprocess,signal,selectors,hashlib,resource
from limit_contract import configure_parent,child_limits
ROOT=pathlib.Path('/tmp/toyvm-shortpath-descendant-timeout-oct29').resolve()
REPO=ROOT/'repo'; E=ROOT/'e'; E.mkdir(exist_ok=True)
ENV=os.environ.copy()
ENV['GIT_ALTERNATE_OBJECT_DIRECTORIES']=':'.join(json.load(open('/home/user/wine-assembly/scratch/usage-watch/toyvm-shortpath-descendant-timeout-oct29-object-stores.json'))['stores'])
ENV['GIT_SSH_COMMAND']='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
ENV['PYTHONDONTWRITEBYTECODE']='1'
def save(name,obj):
    data=json.dumps(obj,indent=2).encode(); assert sum(p.stat().st_size for p in E.glob('*') if p.is_file())+len(data)<1048576
    (E/name).write_bytes(data)
def sample():
    v=os.statvfs(ROOT); mem=int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable:')))*1024
    return dict(at=time.time(),device=os.stat(ROOT).st_dev,f_bavail=v.f_bavail,blockSize=v.f_frsize,free=v.f_bavail*v.f_frsize,MemAvailable=mem,aggregate=176160768,projection=25165824,aggregateVersion='toyvm-child-limit-shortpath-aggregate-20261029T0318.json')
def admission():
    s=sample(); s['PASS']=s['free']-s['aggregate']>=2982150144 and s['MemAvailable']>=2147483648
    with open(E/'admissions.jsonl','a') as f:f.write(json.dumps(s)+'\n')
    if not s['PASS']:save('FIRST-FAILURE.json',s);raise RuntimeError('admission rejected STOP')
def procs():
    result={}
    for p in pathlib.Path('/proc').glob('[0-9]*'):
        try:
            raw=(p/'stat').read_text(); a=raw[raw.rfind(')')+2:].split(); result[int(p.name)]=(int(a[1]),int(a[19]),int(a[21])*os.sysconf('SC_PAGE_SIZE'))
        except (OSError,ValueError,IndexError):pass
    return result
def run(argv,*,cwd,git=False,check=True,observe=None):
    cwd=pathlib.Path(cwd).resolve(strict=True)
    if not cwd.is_relative_to(ROOT):raise ValueError('outside owned directory')
    if git and (argv[:3]!=['git','-C',str(REPO)] or cwd!=REPO):raise ValueError('Git containment')
    admission(); start=time.monotonic(); out=[bytearray(),bytearray()]; known={}; peak=0; ownpeak=0; problem=None; cpus={}; applied={}
    p=subprocess.Popen(argv,cwd=cwd,env=ENV,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,preexec_fn=lambda:child_limits(git))
    sel=selectors.DefaultSelector()
    for i,f in enumerate((p.stdout,p.stderr)):os.set_blocking(f.fileno(),False);sel.register(f,selectors.EVENT_READ,i)
    try:
        while sel.get_map() or p.poll() is None:
            ps=procs(); selected={p.pid,os.getpid()}|{int(pid) for pid,row in known.items() if ps.get(int(pid),(0,-1,0))[1]==row[1]}; changed=True
            while changed:
                before=len(selected); selected|={pid for pid,(pp,st,rss) in ps.items() if pp in selected};changed=len(selected)!=before
            for pid in selected:
                if pid in ps:
                    known[str(pid)]=ps[pid]
                    try:
                        raw=pathlib.Path('/proc',str(pid),'stat').read_text();v=raw[raw.rfind(')')+2:].split();cpus[str(pid)]=(int(v[11])+int(v[12]))/os.sysconf('SC_CLK_TCK')
                        if str(pid) not in applied:applied[str(pid)]=pathlib.Path('/proc',str(pid),'limits').read_text()
                    except OSError:pass
            own=ps.get(os.getpid(),(0,0,0))[2]; total=sum(ps[x][2] for x in selected if x in ps);peak=max(peak,total);ownpeak=max(ownpeak,own)
            if own>128*1048576 or total>512*1048576:raise RuntimeError('physical RSS rejection')
            if time.monotonic()-start>120:raise RuntimeError('wall rejection')
            if sum(cpus.values())>90:raise RuntimeError('aggregate CPU rejection')
            if observe:observe(ps,selected)
            for key,_ in sel.select(.025):
                b=os.read(key.fileobj.fileno(),8192)
                if b:out[key.data].extend(b)
                else:sel.unregister(key.fileobj)
                if sum(map(len,out))>2*1048576:raise RuntimeError('capture rejection')
        rc=p.wait()
    except BaseException as ex:
        problem=str(ex)
        try:os.killpg(p.pid,signal.SIGKILL)
        except ProcessLookupError:pass
        for pid,(pp,st,rss) in known.items():
            if int(pid)==os.getpid():continue
            try:
                if procs().get(int(pid),(0,-1,0))[1]==st:os.kill(int(pid),signal.SIGKILL)
            except ProcessLookupError:pass
        p.wait();rc=p.returncode
    rec=dict(argv=argv,cwd=str(cwd),exit=rc,stdout=out[0].decode(errors='replace'),stderr=out[1].decode(errors='replace'),wall=time.monotonic()-start,processes=known,processLimits=applied,observedCPU=cpus,peakGroupPhysicalRSS=peak,peakSupervisorPhysicalRSS=ownpeak,rejection=problem)
    with open(E/'operations.jsonl','a') as f:f.write(json.dumps(rec)+'\n')
    if problem:save('FIRST-FAILURE.json',rec);raise RuntimeError(problem)
    if check and rc:raise RuntimeError('command failed: '+str(argv[:4])+': '+rec['stderr'][:500])
    return rec
def git(args,*,cwd,mutate=False,init=False):
    if mutate and not init:
        assert run(['git','-C',str(REPO),'rev-parse','--show-toplevel'],cwd=cwd,git=True)['stdout'].strip()==str(REPO)
        assert run(['git','-C',str(REPO),'rev-parse','--absolute-git-dir'],cwd=cwd,git=True)['stdout'].strip()==str(REPO/'.git')
    return run(['git','-C',str(REPO)]+args,cwd=cwd,git=True)
def startup():
    limits=configure_parent()
    with open(E/'supervisor-starts.jsonl','a') as f:f.write(json.dumps(dict(pid=os.getpid(),limits=limits))+'\n')
    if not (E/'startup.json').exists():save('startup.json',dict(limits=limits,session=os.environ.get('CODEX_SESSION_ID'),pid=os.getpid(),sessionPath='/home/user/.codex/sessions',baselineWAL={str(p):p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('*.sqlite-wal')},baselineCount='positive baseline counted once',browserRemaining={'CPU':35.353183,'wall':101.49555,'captures':1},proceduralLimitations=['Initial diagnostic terminal target exceeded; accidental ELF read was truncated by tool. No runtime occurred at that point.']))
    controls={}
    for name,kw in [('omitted',{}),('root',{'cwd':'/home/user/wine-assembly'}),('donor',{'cwd':'/tmp/toyvm-real-cli-descendant-timeout-qualification-oct29/repo'}),('outside',{'cwd':'/tmp'})]:
        try:run(['/bin/false'],**kw)
        except (TypeError,ValueError):controls[name]='rejected before spawn'
        else:raise AssertionError(name)
    controls['sentinel']=run(['/bin/pwd'],cwd=ROOT)['stdout'].strip();save('containment.json',controls)
if __name__=='__main__':startup()
