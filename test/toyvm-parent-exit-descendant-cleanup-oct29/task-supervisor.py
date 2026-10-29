import resource
INITIAL={str(k):list(resource.getrlimit(k)) for k in (resource.RLIMIT_DATA,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE)}
import limit_contract
LIMITS=limit_contract.configure_parent()
import os,pathlib,json,hashlib,time,subprocess,signal,sys,ctypes
OWN=pathlib.Path(__file__).resolve().parent
REPO=OWN/'repo'
ROOT=pathlib.Path('/home/user/wine-assembly')
TASK=OWN.name
E=OWN/'e'; E.mkdir(exist_ok=True)
def record(name,data):
    p=E/(name+'.json');p.write_text(json.dumps(data,sort_keys=True,indent=2)+'\n')
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
DIS=ROOT/'scratch/usage-watch'/ (TASK+'-dispatch.json')
ADM=ROOT/'scratch/usage-watch'/ (TASK+'-admission.json')
assert sha(DIS)=='4197e86f18c18030b7b54531a24c69ef4600c18a99596c2e5d5b77c460d7efca'
assert sha(ADM)=='7004f982cc54e1656b9a4693d6c53e2854901702a1aaed556c318e6ec512bad9'
D=json.loads(DIS.read_text()); A=json.loads(ADM.read_text())
def admission(op):
    st=os.statvfs(OWN);free=st.f_bavail*st.f_frsize
    mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
    r=dict(at=time.time(),op=op,device=OWN.stat().st_dev,f_bavail=st.f_bavail,blockSize=st.f_frsize,freeBytes=free,aggregate=A['aggregate'],futureGrowth=A['futureGrowthIncludingUncertaintyBuffer'],requiredBytes=A['requiredBytes'],remaining=free-A['futureGrowthIncludingUncertaintyBuffer'],MemAvailable=mem,memRequired=A['memRequired'],admissionSHA=sha(ADM))
    r['PASS']=r['remaining']>=A['requiredBytes'] and mem>=A['memRequired']
    with (E/'admissions.jsonl').open('a') as f:f.write(json.dumps(r)+'\n')
    if not r['PASS']:raise RuntimeError('FIRST ADMISSION FAILURE; STOP')
def proc():
    out={}
    for p in pathlib.Path('/proc').iterdir():
        if not p.name.isdigit():continue
        try:
            x=(p/'stat').read_text().rsplit(')',1)[1].split();out[int(p.name)]=(int(x[1]),int(x[19]),int(x[21])*os.sysconf('SC_PAGE_SIZE'),x[0])
        except (OSError,ValueError,IndexError):pass
    return out
def run(argv, *, cwd, git=False):
    wd=pathlib.Path(cwd).resolve(strict=True)
    if not wd.is_relative_to(OWN):raise ValueError('cwd outside OWN')
    if git and argv[:3]!=['git','-C',str(REPO)]:raise ValueError('git -C required')
    admission(argv[:4]);n=len(list(E.glob('op*.stdout')))
    out=E/f'op{n}.stdout';err=E/f'op{n}.stderr';start=time.monotonic();owned={};peak=0;cause=None
    ctypes.CDLL(None).prctl(36,1,0,0,0)
    with out.open('wb') as fo,err.open('wb') as fe:
        p=subprocess.Popen(argv,cwd=wd,stdout=fo,stderr=fe,start_new_session=True,preexec_fn=lambda:limit_contract.child_limits(git))
        try:
            while True:
                ps=proc();ids={p.pid,os.getpid()};changed=True
                while changed:
                    old=len(ids);ids.update(k for k,v in ps.items() if v[0] in ids);changed=len(ids)!=old
                owned.update({k:ps[k][1] for k in ids if k in ps and k!=os.getpid()})
                rss=sum(ps[k][2] for k in ids if k in ps);peak=max(peak,rss)
                if ps.get(os.getpid(),(0,0,0))[2]>128*1048576 or rss>512*1048576:cause='RSS';break
                if time.monotonic()-start>120:cause='wall';break
                if out.stat().st_size+err.stat().st_size>2*1048576:cause='capture';break
                if p.poll() is not None:break
                time.sleep(.025)
        finally:
            ps=proc()
            for pid,tick in owned.items():
                if pid in ps and ps[pid][1]==tick:
                    try:os.kill(pid,signal.SIGKILL)
                    except ProcessLookupError:pass
            p.wait(timeout=5)
            while True:
                try:
                    if os.waitpid(-1,os.WNOHANG)[0]==0:break
                except ChildProcessError:break
    rec=dict(argv=argv,cwd=str(wd),exit=p.returncode,cause=cause,peakPhysicalRSS=peak,wall=time.monotonic()-start,stdout=out.name,stderr=err.name)
    record('op'+str(n),rec)
    if cause or p.returncode:raise RuntimeError(json.dumps(rec))
    return out.read_bytes()
def git(args, *, cwd, mutate=False, init=False):
    if init:
        assert cwd==REPO and not (REPO/'.git').exists()
    elif mutate:
        assert run(['git','-C',str(REPO),'rev-parse','--show-toplevel'],cwd=cwd,git=True).decode().strip()==str(REPO)
        assert run(['git','-C',str(REPO),'rev-parse','--absolute-git-dir'],cwd=cwd,git=True).decode().strip()==str(REPO/'.git')
    return run(['git','-C',str(REPO),*args],cwd=cwd,git=True)
def start():
    admission('initial')
    sess=list(pathlib.Path('/home/user/.codex/sessions/2026/10/29').glob('*'+os.environ['CODEX_THREAD_ID']+'*'))
    wal=list(pathlib.Path('/home/user/.codex').glob('*.sqlite-wal'))
    record('initial',dict(session=[dict(path=str(p),bytes=p.stat().st_size) for p in sess],WAL=[dict(path=str(p),bytes=p.stat().st_size) for p in wal],positiveSharedWALCountedOnce=True,limits=LIMITS,inherited=INITIAL,allocation=A,rootRefReceipt=str(ROOT/'scratch/usage-watch'/TASK/'root-ref-digest.json')))
    controls={}
    for key,kw in [('omitted',{}),('root',dict(cwd=ROOT)),('donor',dict(cwd='/tmp/toyvm-shortpath-descendant-timeout-oct29/repo')),('outside',dict(cwd='/tmp'))]:
        try:run(['/bin/pwd'],**kw)
        except (TypeError,ValueError):controls[key]='REJECTED BEFORE SPAWN'
        else:raise AssertionError(key)
    controls['sentinel']=run(['/bin/pwd'],cwd=OWN).decode().strip();record('containment',controls)
    pins={}
    for rel,pin in D['sourcePins'].items():
        p=REPO/rel;actual=dict(bytes=p.stat().st_size,sha256=sha(p));assert actual==pin;pins[rel]=actual
    record('source-pins',pins)
    print('INITIAL PASS')
if __name__=='__main__':
    try:
        if sys.argv[1]=='start':start()
        elif sys.argv[1]=='boat-help':print(run(['/usr/local/bin/boat','--help'],cwd=OWN).decode()[:7600])
    except Exception as e:
        record('first-blocker',dict(at=time.time(),error=str(e)));raise
