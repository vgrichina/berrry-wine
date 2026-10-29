import os,sys,pathlib,json,hashlib,ctypes,stat,subprocess,resource,time,signal,base64
R=pathlib.Path('/tmp/tvmb'); P=R/'repo'; M=1048576
resource.setrlimit(resource.RLIMIT_DATA,(128*M,128*M));resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(12*M,12*M))
manifest=json.loads((R/'manifest.json').read_text())
def pin(p):
 b=p.read_bytes();return dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
def run(argv,label,cwd=P):
 assert pathlib.Path(cwd).resolve().is_relative_to(R)
 out=R/(label+'.stdout');err=R/(label+'.stderr')
 t=time.monotonic()
 with out.open('wb') as o,err.open('wb') as e:
  q=subprocess.Popen(argv,cwd=cwd,stdout=o,stderr=e,start_new_session=True,env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1'))
  while q.poll() is None:
   rows={}
   for f in pathlib.Path('/proc').glob('[0-9]*/stat'):
    try:
     v=f.read_text().rsplit(')',1)[1].split();rows[int(f.parent.name)]=(int(v[1]),int(v[21])*4096)
    except (OSError,ValueError):pass
   ids={q.pid}
   while True:
    old=len(ids);ids|={pid for pid,v in rows.items() if v[0] in ids}
    if len(ids)==old:break
   reason=None
   if time.monotonic()-t>90:reason='observer wall'
   if sum(rows.get(i,(0,0))[1] for i in ids)>512*M:reason='observer groupRSS'
   if rows.get(os.getpid(),(0,0))[1]>128*M:reason='observer parentRSS'
   if out.stat().st_size+err.stat().st_size>2*M:reason='observer capture'
   if sum(f.stat().st_blocks*512 for f in R.rglob('*') if f.is_file())>48*M:reason='observer disk'
   if reason:os.killpg(q.pid,signal.SIGKILL);q.wait();raise RuntimeError(reason)
   time.sleep(.03)
 return dict(argv=argv,exit=q.returncode,stdout=out.read_text(),stderr=err.read_text(),elapsed=time.monotonic()-t)
def identities():
 for rel,expected in manifest['sourcePins'].items():assert pin(P/rel)==expected,rel
 assert pin(pathlib.Path('/usr/bin/python3'))==manifest['pythonPin']
 assert pin(R/'fixture.py')==manifest['fixturePin']
 assert pin(R/'cancellation-receipt.json')==manifest['receiptPin']
def residual(work):
 mounts=[x for x in pathlib.Path('/proc/self/mountinfo').read_text().splitlines() if str(work) in x]
 procs=[]
 for f in pathlib.Path('/proc').glob('[0-9]*/cmdline'):
  try:
   if int(f.parent.name)!=os.getpid() and str(work).encode() in f.read_bytes():procs.append(int(f.parent.name))
  except OSError:pass
 return dict(remainingMounts=mounts,workPathProcesses=procs)
identities()
if sys.argv[1]=='preflight':
 assert stat.S_ISCHR(os.stat('/dev/fuse').st_mode)
 fd=os.open('/dev/fuse',os.O_RDWR|os.O_CLOEXEC);os.close(fd)
 ctypes.CDLL('libfuse3.so.3')
 c=ctypes.CDLL(None,use_errno=True);c.syscall.restype=ctypes.c_long
 abi=c.syscall(444,0,0,1);assert abi>=3,abi
 assert pathlib.Path('/proc/self/task').is_dir()
 assert pathlib.Path('/proc/self/fd').is_dir()
 assert pathlib.Path('/proc/sys/kernel/seccomp/actions_avail').is_file()
 for p in [R/'observer.py',R/'fixture.py']:compile(p.read_bytes(),str(p),'exec')
 help=run(['/usr/bin/python3','-B',str(P/'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'),'--help'],'cli-help')
 assert help['exit']==0,help
 for f in ['--live-limit','--write-limit','--file-limit','--rss-limit','--cpu-limit','--wall-limit','--output-limit','--domain','--receipt','--work']:assert f in help['stdout'],f
 result=dict(PASS=True,identities=True,realFuseOpened=True,libfuse=True,landlockABI=abi,seccompActions=pathlib.Path('/proc/sys/kernel/seccomp/actions_avail').read_text(),proc=True,syntax=True,help=help)
else:
 case=sys.argv[1];assert case in ['case1','case2']
 work=R/('work' if case=='case1' else 'reject');assert not work.exists();work.mkdir()
 size='1024' if case=='case1' else '9000'
 fixture=(R/'fixture.py').read_text();assert fixture.encode()==(R/'fixture.py').read_bytes()
 argv=['/usr/bin/python3','-B',str(P/'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'),'--domain','tiny-fixture','--receipt',str(R/'cancellation-receipt.json'),'--work',str(work),'--live-limit','16384','--write-limit','8192','--file-limit','8192','--rss-limit','67108864','--cpu-limit','10','--wall-limit','20','--output-limit','8192','--','/usr/bin/python3','-B','-c',fixture,str(work/'domain'/('f'+size)),size]
 result=run(argv,case)
 result['report']=json.loads(result['stdout'])
 result['observerCleanup']=residual(work)
 result['fixturePin']=pin(R/'fixture.py')
 result['marker']='TINY_FIXTURE_COMPLETED' in base64.b64decode(result['report'].get('backendReceipt',{}).get('output',{}).get('data','')).decode(errors='replace')
 result['identitiesAfter']=None;identities();result['identitiesAfter']=True
 assert sum(f.stat().st_size for f in R.glob('*.json') if f.is_file())<M
(R/(sys.argv[1]+'.json')).write_text(json.dumps(result,indent=2))
print(json.dumps(result))
