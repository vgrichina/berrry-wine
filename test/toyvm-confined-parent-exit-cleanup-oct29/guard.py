import os,sys,pathlib,json,time,hashlib,resource,subprocess,selectors,signal
from limit_contract import configure_parent,child_limits
ROOT=pathlib.Path(__file__).resolve().parent
REPO=ROOT/'repo'; E=ROOT/'e'; E.mkdir(exist_ok=True)
ENV=dict(os.environ,PYTHONDONTWRITEBYTECODE='1',BOAT_NO_UPDATE='1')
if str(ROOT).startswith('/tmp/toyvm-'):
    ENV['GIT_ALTERNATE_OBJECT_DIRECTORIES']=':'.join(json.load(open('/home/user/wine-assembly/scratch/usage-watch/toyvm-confined-parent-exit-cleanup-oct29-object-stores.json'))['stores'])
ENV['GIT_SSH_COMMAND']='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def save(name,x):
    data=json.dumps(x,indent=2).encode(); assert sum(p.stat().st_size for p in E.glob('*') if p.is_file())+len(data)<1048576
    p=E/name
    with p.open('xb') as f:f.write(data)
def procs():
    rows={}
    for p in pathlib.Path('/proc').glob('[0-9]*'):
        try:
            s=(p/'stat').read_text(); a=s[s.rfind(')')+2:].split()
            rows[int(p.name)]=dict(pid=int(p.name),ppid=int(a[1]),start=a[19],state=a[0],pgrp=int(a[2]),session=int(a[3]),rss=max(0,int(a[21]))*os.sysconf('SC_PAGE_SIZE'),cpu=(int(a[11])+int(a[12]))/os.sysconf('SC_CLK_TCK'))
        except (OSError,ValueError,IndexError):pass
    return rows
def admission():
    v=os.statvfs(ROOT); mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable:')))*1024
    aggregate=176160768 if str(ROOT).startswith('/tmp/toyvm-') else 25165824
    x=dict(at=time.time(),device=os.stat(ROOT).st_dev,f_bavail=v.f_bavail,blockSize=v.f_frsize,free=v.f_bavail*v.f_frsize,MemAvailable=mem,aggregate=aggregate,projection=25165824,aggregateVersion='toyvm-confined-parent-exit-cleanup-oct29-admission.json',floor=2982150144)
    x['PASS']=x['free']-aggregate>=x['floor'] and mem>=2147483648
    with (E/'admissions.jsonl').open('a') as f:f.write(json.dumps(x)+'\n')
    if not x['PASS']:save('FIRST-FAILURE.json',x);raise RuntimeError('FIRST admission rejection STOP')
def run(argv,*,cwd,git=False,check=True,observe=None):
    cwd=pathlib.Path(cwd).resolve()
    if not cwd.is_relative_to(ROOT):raise ValueError('outside owned task')
    cwd=cwd.resolve(strict=True)
    if git and (argv[:3]!=['git','-C',str(REPO)] or cwd!=REPO):raise ValueError('Git containment')
    admission(); start=time.monotonic(); known={}; applied={}; peak=0; ownpeak=0; cpu={}; out=[bytearray(),bytearray()]; problem=None; killed=[]
    p=subprocess.Popen(argv,cwd=cwd,env=ENV,stdout=subprocess.PIPE,stderr=subprocess.PIPE,preexec_fn=lambda:child_limits(git))
    sel=selectors.DefaultSelector()
    for i,fd in enumerate([p.stdout,p.stderr]):os.set_blocking(fd.fileno(),False);sel.register(fd,selectors.EVENT_READ,i)
    try:
        while p.poll() is None or sel.get_map():
            ps=procs(); selected={p.pid,os.getpid()}|{int(pid) for pid,r in known.items() if int(pid) in ps and ps[int(pid)]['start']==r['start']}
            for _ in range(len(ps)):
                more={pid for pid,r in ps.items() if r['ppid'] in selected}; old=len(selected);selected|=more
                if old==len(selected):break
            for pid in selected:
                if pid in ps:
                    r=ps[pid];known[str(pid)]=r;cpu[(pid,r['start'])]=r['cpu']
                    if str(pid) not in applied:
                        try:applied[str(pid)]=pathlib.Path('/proc',str(pid),'limits').read_text()
                        except OSError:pass
            rss=sum(ps[pid]['rss'] for pid in selected if pid in ps); peak=max(peak,rss);ownpeak=max(ownpeak,ps[os.getpid()]['rss'])
            if ownpeak>128*1048576 or rss>512*1048576:raise RuntimeError('physical RSS rejection')
            if sum(cpu.values())>90 or time.monotonic()-start>120:raise RuntimeError('CPU/wall rejection')
            if observe:observe(ps,selected)
            for key,_ in sel.select(.005):
                b=os.read(key.fileobj.fileno(),8192)
                if b:out[key.data].extend(b)
                else:sel.unregister(key.fileobj)
                if sum(map(len,out))>2*1048576:raise RuntimeError('capture rejection')
    except BaseException as ex:
        problem=str(ex)
    finally:
        # Only on failure: safety cleanup must never masquerade as production success.
        if problem:
            for pid,r in known.items():
                if int(pid)==os.getpid():continue
                now=procs().get(int(pid))
                if now and now['start']==r['start']:
                    try:os.kill(int(pid),signal.SIGKILL);killed.append([pid,r['start']])
                    except ProcessLookupError:pass
        p.wait(timeout=5)
        for fd in [p.stdout,p.stderr]:fd.close()
        sel.close()
    rec=dict(argv=argv,cwd=str(cwd),exit=p.returncode,stdout=out[0].decode(errors='replace'),stderr=out[1].decode(errors='replace'),wall=time.monotonic()-start,processes=known,processLimits=applied,peakGroupPhysicalRSS=peak,peakSupervisorPhysicalRSS=ownpeak,rejection=problem,safetyKilled=killed,truncated=False)
    with (E/'operations.jsonl').open('a') as f:f.write(json.dumps(rec)+'\n')
    if problem:save('FIRST-FAILURE.json',rec);raise RuntimeError(problem)
    if check and p.returncode:raise RuntimeError('command rejected: '+rec['stderr'][:350])
    return rec
def git(args,*,cwd,mutate=False,init=False):
    cwd=pathlib.Path(cwd).resolve(strict=True)
    if cwd!=REPO:raise ValueError('Git requires owned repo cwd')
    if init:
        assert not (REPO/'.git').exists()
    elif mutate:
        assert run(['git','-C',str(REPO),'rev-parse','--show-toplevel'],cwd=cwd,git=True)['stdout'].strip()==str(REPO)
        assert run(['git','-C',str(REPO),'rev-parse','--absolute-git-dir'],cwd=cwd,git=True)['stdout'].strip()==str(REPO/'.git')
    return run(['git','-C',str(REPO),*args],cwd=cwd,git=True)
def startup():
    limits=configure_parent(); controls={}
    for key,kw in [('omitted',{}),('root',{'cwd':'/home/user/wine-assembly'}),('donor',{'cwd':'/tmp/toyvm-shortpath-descendant-timeout-oct29/repo'}),('outside',{'cwd':'/tmp'})]:
        try:run(['/bin/false'],**kw)
        except (ValueError,TypeError):controls[key]='rejected before spawn'
        else:raise AssertionError(key)
    controls['sentinel']=run(['/bin/pwd'],cwd=ROOT)['stdout'].strip()
    sid=os.environ.get('CODEX_SESSION_ID'); paths=[str(p) for p in pathlib.Path('/home/user/.codex/sessions/2026/10/29').glob('*'+str(sid)+'*')]
    save('startup.json',dict(limits=limits,controls=controls,sessionID=sid,sessionPaths=paths,baselineWAL={str(p):p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('*.sqlite-wal')},baselineCountedOnce=True))
if __name__=='__main__':startup()
