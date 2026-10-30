import os,sys,pathlib,json,hashlib,ctypes,stat,subprocess,resource,time,signal,socket,base64,datetime
R=pathlib.Path('/tmp/tvsa-stage');P=R/'repo';M=1048576
os.chdir(R)
def lower(k,n):
    s,h=resource.getrlimit(k);resource.setrlimit(k,(min(s,n) if s!=-1 else n,min(h,n) if h!=-1 else n))
lower(resource.RLIMIT_DATA,128*M);lower(resource.RLIMIT_CPU,60);lower(resource.RLIMIT_FSIZE,524288)
manifest=json.loads((R/'manifest.json').read_text())
def pin(p):
    b=p.read_bytes();return dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
def identities():
    for rel,want in manifest['sourcePins'].items():assert pin(P/rel)==want,rel
    for key,name in [('fixturePin','fixture.py'),('receiptPin','cancellation-receipt.json'),('observerPin','observer.py')]:assert pin(R/name)==manifest[key],key
identities();assert time.time()<manifest['cutoffEpoch']
def cleanup():
    mounts=[s for s in pathlib.Path('/proc/self/mountinfo').read_text().splitlines() if '/tmp/tvsa/domain' in s]
    processes=[]
    for f in pathlib.Path('/proc').glob('[0-9]*/cmdline'):
        try:
            if int(f.parent.name)!=os.getpid() and any(a==b'/tmp/tvsa' or a.startswith(b'/tmp/tvsa/') for a in f.read_bytes().split(b'\0')):processes.append(int(f.parent.name))
        except OSError:pass
    return dict(remainingMounts=mounts,processes=processes)
if sys.argv[1]=='preflight':
    import platform
    assert platform.machine()=='x86_64' and stat.S_ISCHR(os.stat('/dev/fuse').st_mode)
    fd=os.open('/dev/fuse',os.O_RDWR|os.O_CLOEXEC);os.close(fd);ctypes.CDLL('libfuse3.so.3')
    c=ctypes.CDLL(None,use_errno=True);c.syscall.restype=ctypes.c_long;abi=c.syscall(444,0,0,1);assert abi>=3
    result=dict(PASS=True,landlockABI=abi,fuseOpened=True,libfuse=True,limits={n:resource.getrlimit(getattr(resource,n)) for n in ['RLIMIT_DATA','RLIMIT_AS','RLIMIT_CPU','RLIMIT_FSIZE']})
else:
    assert sys.argv[1]=='guards'
    work=pathlib.Path('/tmp/tvsa');assert not work.exists();work.mkdir()
    argv=manifest['cliArgv'];out=R/'production.stdout';err=R/'production.stderr'
    start=time.monotonic();started=datetime.datetime.now(datetime.timezone.utc).isoformat();samples=[];mounts=[];peak=0;violation=None
    with out.open('wb') as o,err.open('wb') as e:
        q=subprocess.Popen(argv,cwd=P,stdout=o,stderr=e,start_new_session=True,env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1'))
        while q.poll() is None:
            rows={}
            for f in pathlib.Path('/proc').glob('[0-9]*/stat'):
                try:
                    s=f.read_text().rsplit(')',1)[1].split();rows[int(f.parent.name)]=(int(s[1]),int(s[21])*4096)
                except (OSError,ValueError):pass
            ids={q.pid}
            while True:
                n=len(ids);ids|={pid for pid,v in rows.items() if v[0] in ids}
                if n==len(ids):break
            rss=sum(rows.get(i,(0,0))[1] for i in ids);peak=max(peak,rss)
            found=[s for s in pathlib.Path('/proc/self/mountinfo').read_text().splitlines() if '/tmp/tvsa/domain' in s]
            if found:mounts=found
            try:
                with socket.socket(socket.AF_UNIX) as sock:
                    sock.settimeout(.1);sock.connect('/tmp/tvsa/status.sock');data=b''
                    while True:
                        part=sock.recv(8192)
                        if not part:break
                        data+=part;assert len(data)<=65536
                samples.append(dict(at=time.monotonic(),state=json.loads(data)))
                assert len(samples)<=4000
            except (FileNotFoundError,ConnectionRefusedError):pass
            if time.monotonic()-start>90:violation='wall90'
            if rss>2048*M:violation='groupRSS2048'
            if rows.get(os.getpid(),(0,0))[1]>128*M:violation='parentRSS128'
            if out.stat().st_size+err.stat().st_size>65536:violation='output65536'
            if sum(f.lstat().st_blocks*512 for root in (R,work) for f in [root,*root.rglob('*')])>248*M:violation='disk256includingReserve8'
            if violation:os.killpg(q.pid,signal.SIGKILL);q.wait();break
            time.sleep(.015)
        q.wait()
    result=dict(argv=argv,cwd=str(P),startedAt=started,finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),exit=q.returncode,wall=time.monotonic()-start,groupPeakRSS=peak,mountOwnership=mounts,counterSamples=samples,violation=violation,stdout=out.read_text(),stderr=err.read_text(),observerCleanup=cleanup())
    try:
        report=json.loads(result['stdout']);result['report']=report
        output=base64.b64decode(report['backendReceipt']['output']['data']).decode()
        result['fixtureOutput']=output
        result['syscalls']=[json.loads(l) for l in output.splitlines() if l.startswith('{')]
    except Exception as ex:result['parseError']=str(ex)
    identities()
(R/(sys.argv[1]+'.json')).write_text(json.dumps(result))
print(json.dumps(dict(saved=sys.argv[1]+'.json',productionExit=result.get('exit'),PASS=result.get('PASS'))))
