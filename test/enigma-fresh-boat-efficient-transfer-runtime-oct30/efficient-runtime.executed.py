"""One original-game attempt. No resume, SSH runtime, worker launch or rebuild.

Receipts are streamed once to gzip. Fixed inputs get one content verification,
per-part stat checks, and periodic stat/allocation reconciliation. CPU includes
waited transport children in the forecast; process CPU limits stay 60/60.
"""
import base64, datetime, gzip, hashlib, json, os, pathlib, resource, shlex
import signal, subprocess, sys, time, tarfile, io

C = pathlib.Path(__file__).resolve().parent
R = C.parent
L = pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/enigma-fresh-boat-efficient-transfer-runtime-oct30')
B = '/home/user/.ascii/boat'
M = 1048576
SSH = 'ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
ENV = dict(os.environ, PYTHONDONTWRITEBYTECODE='1', GIT_SSH_COMMAND=SSH, BOAT_NO_UPDATE='1')
ORIG_DATA = resource.getrlimit(resource.RLIMIT_DATA)
PINS = {}
LEDGER = {}
SEQ = 0
BOX = None
LOG = None
BASE = 0
PEAK = 0
OLD_LOGS = 0

def utc(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def save(n, v): (C/n).write_text(json.dumps(v, indent=2)+'\n')
def sha(p):
    with p.open('rb') as f: return hashlib.file_digest(f, 'sha256').hexdigest()
def ident(p):
    s=p.stat(); return [s.st_dev,s.st_ino,s.st_size,s.st_mtime_ns,s.st_ctime_ns]
def physical(p):
    if not p.exists(): return 0
    return p.lstat().st_blocks*512 + (sum(x.lstat().st_blocks*512 for x in p.rglob('*')) if p.is_dir() else 0)
def roots():
    return [R]+[pathlib.Path('/home/user/wine-assembly/scratch/usage-watch')/x for x in [
      'enigma-guest-poll-causal-runtime-oct30','enigma-compact-causal-runtime-owner133-oct30',
      'enigma-start-game-causal-repair-owner133-oct30','enigma-retained-prefix-guest-poll-runtime-oct30',L.name]]
def cpu():
    q=resource.getrusage(resource.RUSAGE_CHILDREN)
    return time.process_time()+q.ru_utime+q.ru_stime
def limits(git=False, native=False):
    resource.setrlimit(resource.RLIMIT_CPU,(60,60))
    resource.setrlimit(resource.RLIMIT_FSIZE,(12*M,12*M))
    if not native:
        hard=resource.getrlimit(resource.RLIMIT_DATA)[1]
        amount=(256 if git else 128)*M
        assert hard==-1 or hard>=amount
        resource.setrlimit(resource.RLIMIT_DATA,(amount,hard))
    else: resource.setrlimit(resource.RLIMIT_DATA,ORIG_DATA)
def establish():
    global BASE,LEDGER
    BASE=sum(physical(p) for p in roots())
    LEDGER={str(p):p.lstat().st_blocks*512 for p in list(C.rglob('*'))+list(L.rglob('*')) if p.is_file()}
    return BASE
def admission(full=False):
    global BASE
    if full:
        for p,s in PINS.items(): assert ident(pathlib.Path(p))==s, 'immutable input changed'
        establish()
    allocated=BASE
    # Only tracked, changed files are restatted. No root walk per API call.
    for root in [C,L]:
        for p in root.iterdir():
            if p.is_file():
                k=str(p); n=p.lstat().st_blocks*512
                allocated+=n-LEDGER.get(k,0)
    free=os.statvfs(R).f_bavail*os.statvfs(R).f_frsize
    # Exact direct-file deltas above include launcher files; nested trees only
    # change at explicit publication/full-check boundaries, never in transfer.
    assert allocated+8*M <= 64*M, ('allocation',allocated)
    assert allocated-OLD_LOGS-INITIAL <= M, ('incremental growth',allocated-OLD_LOGS-INITIAL)
    assert free-267292672 >= 1610612736, ('disk',free)
    return dict(at=utc(),allocated=allocated,reserve=8*M,free=free,aggregateRemaining=267292672,
                MemAvailable=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024,
                CPU=cpu(),RAMAdmission=False)
def tree(pid):
    ids={pid}; todo=[pid]; rss=0
    while todo:
        i=todo.pop()
        try:
            s=pathlib.Path('/proc/%d/stat'%i).read_text().rsplit(')',1)[1].split()
            rss+=int(s[21])*4096
            for x in pathlib.Path('/proc/%d/task/%d/children'%(i,i)).read_text().split():
                x=int(x)
                if x not in ids: ids.add(x);todo.append(x)
        except (FileNotFoundError,ProcessLookupError): pass
    return ids,rss
def run(argv,wall=90,git=False,record=True):
    global SEQ,PEAK
    SEQ+=1;admission();start=time.monotonic(); before=cpu()
    native=argv[0] in [B,'/usr/bin/node']
    with (C/'call.stdout').open('wb') as out,(C/'call.stderr').open('wb') as err:
        p=subprocess.Popen(argv,cwd=C/'repo' if git else C,env=ENV,stdout=out,stderr=err,
                           preexec_fn=lambda:limits(git,native),start_new_session=True)
        try:
            while p.poll() is None:
                _,rss=tree(p.pid);PEAK=max(PEAK,rss)
                own=int(pathlib.Path('/proc/self/stat').read_text().rsplit(')',1)[1].split()[21])*4096
                if rss>512*M or own>128*M: raise RuntimeError('RSS enforcement')
                if time.monotonic()-start>wall: raise RuntimeError('operation wall')
                if (C/'call.stdout').stat().st_size+(C/'call.stderr').stat().st_size>512*1024: raise RuntimeError('capture overflow')
                if cpu()>59: raise RuntimeError('local CPU60 aggregate guard')
                time.sleep(.08)
        except BaseException:
            os.killpg(p.pid,signal.SIGKILL);p.wait();raise
    out=(C/'call.stdout').read_text();err=(C/'call.stderr').read_text()
    assert len(out.encode())+len(err.encode())<=512*1024, 'capture overflow'
    rec=dict(seq=SEQ,argv=[x if len(x)<4096 else dict(bytes=len(x.encode()),sha256=hashlib.sha256(x.encode()).hexdigest()) for x in argv],
             exit=p.returncode,wall=time.monotonic()-start,CPU=cpu()-before,stdout=out,stderr=err)
    if record and LOG:
        compact=dict(rec)
        if len(out)>4096:compact['stdout']=dict(bytes=len(out.encode()),sha256=hashlib.sha256(out.encode()).hexdigest())
        LOG.write((json.dumps(compact,separators=(',',':'))+'\n').encode());LOG.flush()
    assert p.returncode==0,rec
    return out,rec
def api(args,wall=90):
    s,rec=run([B,'--no-update','--json']+args,wall)
    try: v=json.loads(s)
    except json.JSONDecodeError: v=[json.loads(x) for x in s.splitlines() if x.strip()][-1]
    assert not v.get('error') and v.get('success',True),v
    return v,rec
def bound(code,args):
    shell=shlex.join(['/usr/bin/python3','-B','-c',code,*args])
    n=len(json.dumps(dict(command=shell),ensure_ascii=True).encode())
    assert n<=32768, ('serialized command',n)
    return n
def remote(code,*args,wall=50):
    bound(code,args)
    v,rec=api(['exec',BOX,'--timeout',str(wall),'--','/usr/bin/python3','-B','-c',code,*args],wall+15)
    assert v.get('exitCode')==0 and not v.get('stdoutTruncated') and not v.get('stderrTruncated'),v
    return v['stdout'],rec
TRANSFER="import pathlib,base64,sys,hashlib,json,resource;resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(12582912,12582912));p=pathlib.Path('/home/user/enigma-original.parts')/sys.argv[1];n=int(sys.argv[2]);assert (p.stat().st_size if p.exists() else 0)==n;b=base64.b64decode(sys.argv[3],validate=True);assert 0<len(b)<=16384;h=hashlib.sha256(b).hexdigest();assert h==sys.argv[4];f=p.open('ab');assert f.tell()==n;assert f.write(b)==len(b);f.close();assert p.stat().st_size==n+len(b);print(json.dumps(dict(part=p.name,offset=n,end=n+len(b),sha256=h)))"
def preflight():
    global INITIAL,OLD_LOGS
    a=json.loads((R/'archive.json').read_text());closure=json.loads((C/'input-closure.json').read_text())
    assert closure['allPinsMatched'] and closure['checked']==2663
    h=hashlib.sha256()
    for name in a['parts']:
        p=R/name;PINS[str(p)]=ident(p)
        with p.open('rb') as f:
            while b:=f.read(65536):h.update(b)
    assert h.hexdigest()==a['sha256']
    for n in ['archive.json','transfer-manifest.json','mount-enumeration.json','guest-poll-args.json','owner-policy-guest.py','guest-poll-instrument.py']:
        PINS[str(R/n)]=ident(R/n)
    assert sha(R/'transfer-manifest.json')==closure['manifestPin']['sha256']
    assert sha(R/'guest-poll-args.json')=='80194f366b579a2604eec56df0d1dd7ff4a633d731b6d4792688f1da8b85a9a0'
    INITIAL=json.loads((C/'admission.json').read_text())['allocated']
    OLD_LOGS=sum(physical(p) for p in roots() if p not in [R,L])
    establish();admission(full=True)
    s,_=run(['/usr/bin/node','--max-old-space-size=512',str(R/'guest-poll-parser.cjs')]);parser=json.loads(s)
    manifest=json.loads((R/'transfer-manifest.json').read_text()); mount=json.loads((R/'mount-enumeration.json').read_text())
    files=sorted(x['target'] for x in manifest if x['target'].startswith('vfs/'))
    assert files==sorted(mount['files']) and len(files)==2460
    # Reuse the exact retained startup and file-vs-capture receipts. Changed
    # supervisor's capture/legitimate-file controls are checked once here.
    startup,_=run(json.loads((R/'retained-prefix/e/startup.json').read_text())['argv'])
    filectl,_=run([sys.executable,'-B','-c',"import pathlib;p=pathlib.Path('disposable');p.write_bytes(b'x'*2097152);assert p.stat().st_size==2097152;p.unlink()"])
    overflow=False
    try:run([sys.executable,'-B','-c',"import os;os.write(1,b'x'*600000)"])
    except (AssertionError,RuntimeError) as ex:overflow='capture overflow' in str(ex)
    assert overflow
    (C/'call.stdout').write_bytes(b'')
    # Same-process realistic serialization/accounting/receipt forecast. No new
    # process subdivision, no changing the CPU cap or resetting this process.
    t=time.process_time()
    for i in range(100):
        admission();b=b'x'*16384;enc=base64.b64encode(b).decode();hs=hashlib.sha256(b).hexdigest()
        bound(TRANSFER,('archive-000',str(i*16384),enc,hs))
    cost=(time.process_time()-t)/100
    rec=dict(PASS=True,at=utc(),archiveSHA256=a['sha256'],bytes=a['bytes'],parts=len(a['parts']),
       parser=parser,mountFiles=len(files),commaFiles=[x for x in files if ',' in x],startup=json.loads(startup),
       generatedFileCeiling=12*M,captureCeiling=512*1024,legitimate2MiBFilePassed=True,captureOverflowRejected=True,
       localPerChunkCPU=cost,forecast1055LocalCPU=cost*1055,CPU=cpu(),CPUCap=60,guestSupervisionReserveCPU=8,
       immutablePins=PINS,admission=admission(full=True))
    assert cost*1055+cpu()+8<60
    save('preflight.json',rec);print(json.dumps(dict(preflight=True,CPU=cpu(),perChunk=cost)),flush=True)
    return a
def closeout():
    # Safety path uses original transport and no admission dependency.
    rec=dict(id=BOX,at=utc(),delegated=True)
    for name,args in [('stop',['stop',BOX]),('info',['info',BOX])]:
        q=subprocess.run([B,'--no-update','--json']+args,cwd=C,env=ENV,capture_output=True,text=True,timeout=90,preexec_fn=lambda:limits(native=True))
        assert len(q.stdout)+len(q.stderr)<512*1024
        rec[name]=dict(exit=q.returncode,stdout=q.stdout,stderr=q.stderr)
    for i in range(10):
        v=json.loads(rec['info']['stdout']);v=v.get('sandbox',v)
        if v.get('state')=='stopped' and v.get('snapshotVerifiedAt'):
            rec.update(verifiedStopped=True,snapshotVerifiedAt=v['snapshotVerifiedAt'],stoppedAt=v.get('stoppedAt'));break
        time.sleep(3)
        q=subprocess.run([B,'--no-update','--json','info',BOX],cwd=C,env=ENV,capture_output=True,text=True,timeout=30,preexec_fn=lambda:limits(native=True))
        rec['info']=dict(exit=q.returncode,stdout=q.stdout,stderr=q.stderr)
    save('closeout.json',rec)
    assert rec.get('verifiedStopped'),rec
def watchdog(parent):
    os.setsid()
    while True:
        if (C/'closeout.json').exists() and json.loads((C/'closeout.json').read_text()).get('verifiedStopped'):return
        d=json.loads((C/'schedule.json').read_text())
        if not pathlib.Path('/proc/%d'%parent).exists() or time.time()>=d['shutdownEpoch']:break
        time.sleep(2)
    closeout()
def setup():
    global BOX
    v,_=api(['new','--ttl','1800','--no-env','--fail-fast','--type','default','--name','enigma-efficient-original-oct30'])
    BOX=v['id'];save('boat-created.json',v);now=time.time()
    expiry=datetime.datetime.fromisoformat(v['archiveAfter'].replace('Z','+00:00')).timestamp()
    save('schedule.json',dict(id=BOX,createdEpoch=now,expiry=v['archiveAfter'],cutoffEpoch=min(now+1200,expiry-600),handbackEpoch=min(now+1380,expiry-420),shutdownEpoch=min(now+1500,expiry-300),shutdownDelegated=True))
    parent=os.getpid();pid=os.fork()
    if pid==0:
        try:watchdog(parent)
        finally:os._exit(0)
    save('watchdog.json',dict(pid=pid,parent=parent,at=utc()));print(json.dumps(dict(created=BOX,expiry=v['archiveAfter'])),flush=True)
    s,_=remote("import pathlib,json,resource;p=pathlib.Path('/home/user/enigma-original.parts');p.mkdir();print(json.dumps(dict(smoke=True,limits=pathlib.Path('/proc/self/limits').read_text())))")
    save('api-smoke.json',json.loads(s))
def transfer(a):
    startCPU=cpu();start=time.monotonic();k=0;off=0;costs=[]
    for name in a['parts']:
        p=R/name;assert ident(p)==PINS[str(p)];n=0
        with p.open('rb') as f:
            while b:=f.read(16384):
                assert time.time()+200<json.loads((C/'schedule.json').read_text())['cutoffEpoch'],'transfer cutoff forecast'
                h=hashlib.sha256(b).hexdigest();before=cpu()
                s,rec=remote(TRANSFER,name,str(n),base64.b64encode(b).decode(),h)
                assert json.loads(s)==dict(part=name,offset=n,end=n+len(b),sha256=h)
                costs.append(cpu()-before);n+=len(b);off+=len(b);k+=1
                if k==3 or k%64==0:
                    admission(full=True)
                    per=max(sum(costs)/len(costs),max(costs[-3:]))
                    forecast=cpu()+per*(1055-k)+8
                    wallForecast=(time.monotonic()-start)/k*(1055-k)+200
                    save('transport-forecast.json',dict(calls=k,bytes=off,CPU=cpu(),helperCPU=time.process_time(),transportChildCPU=cpu()-time.process_time(),perCallConservativeCPU=per,forecastCPU=forecast,cap=60,wallForecast=wallForecast))
                    assert forecast<60,('supported transport CPU forecast cannot fit unchanged CPU60',forecast)
                    assert time.time()+wallForecast<json.loads((C/'schedule.json').read_text())['cutoffEpoch'],('supported transport cannot fit cutoff',wallForecast)
                if k%128==0:print(json.dumps(dict(chunks=k,bytes=off,CPU=cpu())),flush=True)
    assert off==a['bytes'] and k==1055
    s,_=remote("import pathlib,hashlib,json;ps=sorted(pathlib.Path('/home/user/enigma-original.parts').glob('archive-*'));h=hashlib.sha256();n=0\nfor p in ps:\n with p.open('rb') as f:\n  while b:=f.read(65536):h.update(b);n+=len(b)\nprint(json.dumps(dict(bytes=n,sha256=h.hexdigest(),parts=len(ps))))")
    v=json.loads(s);assert v==dict(bytes=a['bytes'],sha256=a['sha256'],parts=17)
    save('transfer-complete.json',dict(**v,calls=k,CPU=cpu(),helperCPU=time.process_time(),wall=time.monotonic()-start))

def write_remote(local,target):
    b=local.read_bytes();assert len(b)<=16384
    remote("import pathlib,base64,hashlib,sys;b=base64.b64decode(sys.argv[2],validate=True);assert hashlib.sha256(b).hexdigest()==sys.argv[3];pathlib.Path('/home/user/enigma-original',sys.argv[1]).write_bytes(b);print(sys.argv[3])",target,base64.b64encode(b).decode(),hashlib.sha256(b).hexdigest())

def stage_execute_collect(a):
    # The exact verified split archive is consumed as a stream, never joined
    # into a >12MiB file. Every member is safe and the extracted closure is pinned.
    code='''import pathlib,tarfile,io,hashlib,json,resource
resource.setrlimit(resource.RLIMIT_CPU,(60,60))
resource.setrlimit(resource.RLIMIT_DATA,(134217728,134217728))
resource.setrlimit(resource.RLIMIT_FSIZE,(12582912,12582912))
class Parts(io.RawIOBase):
 def __init__(self):self.ps=iter(sorted(pathlib.Path('/home/user/enigma-original.parts').glob('archive-*')));self.f=None
 def readable(self):return True
 def readinto(self,b):
  while True:
   if self.f is None:
    try:self.f=next(self.ps).open('rb')
    except StopIteration:return 0
   n=self.f.readinto(b)
   if n:return n
   self.f.close();self.f=None
r=pathlib.Path('/home/user/enigma-original');r.mkdir();count=0;total=0
with tarfile.open(fileobj=io.BufferedReader(Parts()),mode='r|gz') as t:
 for x in t:
  p=pathlib.PurePosixPath(x.name)
  assert x.isfile() and not p.is_absolute() and '..' not in p.parts
  count+=1;total+=x.size;assert total<128*1048576
  t.extract(x,r,filter='data')
h=hashlib.sha256();files=sorted(p for p in r.rglob('*') if p.is_file())
for p in files:
 with p.open('rb') as f:d=hashlib.file_digest(f,'sha256').hexdigest()
 h.update((p.relative_to(r).as_posix()+'\\0'+str(p.stat().st_size)+'\\0'+d+'\\n').encode())
assert count==2663 and len(files)==2663 and h.hexdigest()=='46e5799af7235be8ea9af36fa62801de816766764be9c5cdecf137e8f6fb5940'
assert hashlib.sha256((r/'modules/wine-assembly.wasm').read_bytes()).hexdigest()=='af202eea3c5c11aadb117b5c8eed1851d50ce2ce4246a4122845699b472fcc2b'
print(json.dumps(dict(files=count,bytes=total,manifestDigest=h.hexdigest())))
'''
    s,_=remote(code);save('extraction.json',json.loads(s))
    for local,target in [(C/'guest.py','guest-progression.py'),(R/'guest-poll-args.json','guest-args.json'),(R/'guest-poll-instrument.py','guest-poll-instrument.py')]:write_remote(local,target)
    s,_=remote("import subprocess;subprocess.run(['/usr/bin/python3','-B','/home/user/enigma-original/guest-poll-instrument.py','/home/user/enigma-original/runner/test/run.js'],check=True);subprocess.run(['/home/user/.nvm/versions/node/v24.22.1/bin/node','--check','/home/user/enigma-original/runner/test/run.js'],check=True)")
    save('observer.json',dict(stdout=s))
    try:
        s,_=remote("import subprocess,json;q=subprocess.run(['/usr/bin/python3','-B','/home/user/enigma-original/guest-progression.py'],capture_output=True,text=True,timeout=115);print(json.dumps(dict(exit=q.returncode,stdout=q.stdout[-1000:],stderr=q.stderr[-2000:])))",wall=105)
        save('runtime-operation.json',json.loads(s))
    finally:
        s,_=remote("import pathlib,json,hashlib;r=pathlib.Path('/home/user/enigma-original/capture');print(json.dumps([dict(path=p.name,bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in r.iterdir() if p.is_file()]))")
        files=json.loads(s);save('capture-manifest.json',files)
        selected=[x for x in files if x['path']=='runtime-evidence.json' or x['path'].endswith('.png')]
        assert sum(x['bytes'] for x in selected)<400000,('local evidence allowance',selected)
        for row in selected:
            assert pathlib.Path(row['path']).name==row['path']
            h=hashlib.sha256();off=0
            with (C/row['path']).open('wb') as f:
                while off<row['bytes']:
                    s,_=remote("import pathlib,base64,sys;p=pathlib.Path('/home/user/enigma-original/capture')/sys.argv[1];f=p.open('rb');f.seek(int(sys.argv[2]));print(base64.b64encode(f.read(16384)).decode())",row['path'],str(off))
                    b=base64.b64decode(s,validate=False);assert b
                    f.write(b);h.update(b);off+=len(b)
            assert off==row['bytes'] and h.hexdigest()==row['sha256']
        save('runtime-complete.json',dict(at=utc(),CPU=cpu(),helperCPU=time.process_time(),peakTransportRSS=PEAK,admission=admission(full=True)))

if __name__=='__main__':
    limits(); INITIAL=json.loads((C/'admission.json').read_text())['allocated']
    LOG=gzip.open(C/'transport.jsonl.gz','wb',compresslevel=6)
    try:
        a=preflight();setup();transfer(a)
        # Guest continuation is installed below before this program is launched.
        stage_execute_collect(a)
    except BaseException as ex:
        save('failure.json',dict(at=utc(),error=repr(ex),CPU=cpu(),helperCPU=time.process_time(),peakTransportRSS=PEAK))
        print(json.dumps(dict(failure=repr(ex),CPU=cpu())),flush=True)
    finally:
        if BOX:closeout()
        LOG.close()
