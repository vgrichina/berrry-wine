import ast,base64,ctypes,hashlib,json,os,pathlib,resource,stat,subprocess,sys,time
R=pathlib.Path('/tmp/tvic'); REPO=R/'repo'
os.chdir(REPO)
M=1048576
resource.setrlimit(resource.RLIMIT_DATA,(128*M,128*M))
resource.setrlimit(resource.RLIMIT_CPU,(90,90))
resource.setrlimit(resource.RLIMIT_FSIZE,(12*M,12*M))
manifest=json.loads((R/'manifest.json').read_text())
CLI=REPO/'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'
def run(argv,timeout=30):
    assert pathlib.Path.cwd()==REPO and REPO.resolve()==REPO
    p=subprocess.run(argv,cwd=REPO,env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1'),capture_output=True,timeout=timeout)
    assert len(p.stdout)+len(p.stderr)<65536
    return dict(argv=argv,exit=p.returncode,stdout=p.stdout.decode(),stderr=p.stderr.decode())
def preflight():
    checks={}
    for rel,pin in manifest['sourcePins'].items():
        raw=(REPO/rel).read_bytes(); assert len(raw)==pin['bytes'] and hashlib.sha256(raw).hexdigest()==pin['sha256']; ast.parse(raw)
        checks[rel]=pin
    for name,pin in [('pythonExecutable',manifest['pythonExecutablePin'])]:
        raw=pathlib.Path('/usr/bin/python3').read_bytes(); assert len(raw)==pin['bytes'] and hashlib.sha256(raw).hexdigest()==pin['sha256']; checks[name]=pin
    for filename,key in [('fixture.py','runtimeFixturePin'),('cancellation-receipt.json','originalCancellationReceiptPin')]:
        raw=(R/filename).read_bytes(); pin=manifest[key]; assert len(raw)==pin['bytes'] and hashlib.sha256(raw).hexdigest()==pin['sha256']; checks[filename]=pin
    ast.parse((R/'fixture.py').read_text()); ast.parse(pathlib.Path(__file__).read_text())
    assert stat.S_ISCHR(os.stat('/dev/fuse').st_mode)
    fd=os.open('/dev/fuse',os.O_RDWR|os.O_CLOEXEC);os.close(fd)
    ctypes.CDLL('libfuse3.so.3')
    libc=ctypes.CDLL(None,use_errno=True);libc.syscall.restype=ctypes.c_long
    abi=libc.syscall(444,0,0,1);assert abi>=3,('Landlock ABI',abi,ctypes.get_errno())
    assert pathlib.Path('/usr/bin/fusermount3').is_file()
    for rel in ['self/stat','self/status','self/mountinfo','meminfo']:
        assert pathlib.Path('/proc',rel).read_text()
    assert pathlib.Path('/proc/self/fd').is_dir()
    status=pathlib.Path('/proc/self/status').read_text(); assert 'Seccomp:' in status
    help_result=run(['/usr/bin/python3','-B',str(CLI),'--help'])
    assert help_result['exit']==0
    for option in ['--domain','--receipt','--work','--live-limit','--write-limit','--file-limit','--rss-limit','--cpu-limit','--wall-limit','--output-limit']:
        assert option in help_result['stdout']
    return dict(checks=checks,LandlockABI=abi,devFuse='opened real character device',libfuse='libfuse3.so.3 loaded',argparse=help_result,observerSyntax=True,proc=True,seccompStatus=[x for x in status.splitlines() if x.startswith('Seccomp')],mountArgv=['/usr/bin/fusermount3','-o','rw,nosuid,nodev,fsname=toyvm-accounting,subtype=toyvm-accounting','--','/tmp/tvic/work/domain'])
def case(number):
    assert number in (1,2)
    work=R/('work' if number==1 else 'reject'); work.mkdir(); assert not list(work.iterdir())
    count=1024 if number==1 else 9000
    fixture=(R/'fixture.py').read_text(); assert hashlib.sha256(fixture.encode()).hexdigest()==manifest['runtimeFixturePin']['sha256']
    argv=['/usr/bin/python3','-B',str(CLI),'--domain','tiny-fixture','--receipt',str(R/'cancellation-receipt.json'),'--work',str(work),'--live-limit','8192','--write-limit','8192','--file-limit','8192','--rss-limit','67108864','--cpu-limit','10','--wall-limit','20','--output-limit','8192','--','/usr/bin/python3','-B','-c',fixture,str(work/'domain'/('f'+str(count))),str(count)]
    result=run(argv,45)
    result['report']=json.loads(result['stdout'])
    result['remainingMounts']=[x for x in pathlib.Path('/proc/self/mountinfo').read_text().splitlines() if str(work) in x]
    owned=[]
    for p in pathlib.Path('/proc').glob('[0-9]*/cmdline'):
        try:
            if int(p.parent.name) not in (os.getpid(),os.getppid()) and str(work).encode() in p.read_bytes():owned.append(int(p.parent.name))
        except (OSError,ValueError):pass
    result['remainingOwnedProcesses']=owned
    report=result['report']; backend=report.get('backendReceipt',{});out=backend.get('output',{})
    result['marker']=b'TINY_FIXTURE_COMPLETED' in base64.b64decode(out.get('data',''))
    result['pass']=(not result['remainingMounts'] and not owned and report.get('cleanupComplete') is True and ((number==1 and result['exit']==0 and report.get('accepted') is True and result['marker']) or (number==2 and result['exit']==1 and report.get('accepted') is False and bool(backend.get('filesystem',{}).get('failure')))))
    return result
try:
    label=sys.argv[1]
    data=preflight() if label=='preflight' else case(int(label[-1]))
except BaseException as e:
    data={'blocker':type(e).__name__+': '+str(e)}
(R/(label+'.json')).write_text(json.dumps(data,indent=2))
print(json.dumps(data))
sys.exit(0 if 'blocker' not in data and data.get('pass',True) else 1)
