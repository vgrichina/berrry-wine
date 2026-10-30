import os,sys,pathlib,json,hashlib,ctypes,stat,subprocess,resource,time,signal,base64,socket
R=pathlib.Path('/tmp/tvmd-stage');P=R/'repo';M=1048576
os.chdir(R)
resource.setrlimit(resource.RLIMIT_DATA,(128*M,128*M))
resource.setrlimit(resource.RLIMIT_CPU,(60,60))
resource.setrlimit(resource.RLIMIT_FSIZE,(12*M,12*M))
manifest=json.loads((R/'manifest.json').read_text())
def pin(p):
 b=p.read_bytes();return dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
def identities():
 for rel,want in manifest['sourcePins'].items():assert pin(P/rel)==want,rel
 for key,p in [('fixturePin',R/'fixture.py'),('receiptPin',R/'cancellation-receipt.json')]:assert pin(p)==manifest[key],key
def run(argv,label):
 out=R/(label+'.stdout');err=R/(label+'.stderr');start=time.monotonic();mounts=[];peak=0;samples=[]
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
   found=[s for s in pathlib.Path('/proc/self/mountinfo').read_text().splitlines() if '/tmp/tvmd/domain' in s]
   if found:mounts=found
   status=pathlib.Path("/tmp/tvmd/status.sock")
   if status.exists():
    try:
     with socket.socket(socket.AF_UNIX) as sock:
      sock.settimeout(.1);sock.connect(str(status));data=b""
      while True:
       part=sock.recv(8192)
       if not part:break
       data+=part;assert len(data)<=8192
     state=json.loads(data)
     samples.append(dict(at=time.monotonic(),live=state["live"],peak=state["peak"],written=state["written"],inodes=state["inodes"]))
    except (FileNotFoundError,ConnectionRefusedError):pass
   reason=None
   if time.monotonic()-start>90:reason='wall90'
   if rss>512*M:reason='groupRSS512'
   if rows.get(os.getpid(),(0,0))[1]>128*M:reason='parentRSS128'
   if out.stat().st_size+err.stat().st_size>8192:reason='output8192'
   if sum(f.lstat().st_blocks*512 for root in (R,pathlib.Path("/tmp/tvmd")) if root.exists() for f in [root,*root.rglob("*")])>248*M:reason='disk256includingReserve8'
   if reason:os.killpg(q.pid,signal.SIGKILL);q.wait();raise RuntimeError(reason)
   time.sleep(.005)
 return dict(argv=argv,cwd=str(P),exit=q.returncode,stdout=out.read_text(),stderr=err.read_text(),wall=time.monotonic()-start,groupPeakRSS=peak,mountOwnership=mounts,counterSamples=samples)
identities()
assert int(next(s.split()[1] for s in pathlib.Path('/proc/meminfo').read_text().splitlines() if s.startswith('MemAvailable:')))*1024>=2*1024**3+512*M
if sys.argv[1]=='preflight':
 import platform
 assert platform.machine()=="x86_64"
 assert stat.S_ISCHR(os.stat('/dev/fuse').st_mode)
 fd=os.open('/dev/fuse',os.O_RDWR|os.O_CLOEXEC);os.close(fd)
 ctypes.CDLL('libfuse3.so.3')
 c=ctypes.CDLL(None,use_errno=True);c.syscall.restype=ctypes.c_long
 abi=c.syscall(444,0,0,1);assert abi>=3
 mem=int(next(s.split()[1] for s in pathlib.Path('/proc/meminfo').read_text().splitlines() if s.startswith('MemAvailable:')))*1024
 assert mem>=2*1024**3+512*M
 assert pathlib.Path('/proc/self/fd').is_dir() and pathlib.Path('/proc/self/task').is_dir()
 assert pathlib.Path('/proc/sys/kernel/seccomp/actions_avail').is_file()
 assert os.access('/usr/bin/python3',os.X_OK)
 assert len('/tmp/tvmd/control.sock'.encode())<108
 help=run(['/usr/bin/python3','-B',str(P/'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'),'--help'],'help')
 assert help['exit']==0 and '--rename-evidence' in help['stdout'],help
 result=dict(PASS=True,sourcePins=manifest['sourcePins'],landlockABI=abi,MemAvailable=mem,fuseOpened=True,libfuse=True,procFDseccomp=True,absoluteRoot=str(R),socketBytes=len('/tmp/tvmd/control.sock'.encode()),help=help,limits={n:resource.getrlimit(getattr(resource,n)) for n in ['RLIMIT_DATA','RLIMIT_AS','RLIMIT_CPU','RLIMIT_FSIZE']})
else:
 assert sys.argv[1]=='guards'
 assert time.time()<manifest["cutoffEpoch"],"cutoff reached"
 work=pathlib.Path('/tmp/tvmd');assert not work.exists();work.mkdir()
 argv=['/usr/bin/python3','-B',str(P/'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'),'--domain','tiny-fixture','--receipt',str(R/'cancellation-receipt.json'),'--work',str(work),'--live-limit','262144','--write-limit','32768','--file-limit','32768','--rss-limit','67108864','--cpu-limit','10','--wall-limit','20','--output-limit','8192','--','/usr/bin/python3','-B','-c',(R/'fixture.py').read_text()]
 result=run(argv,'guards');result['report']=json.loads(result.pop('stdout'))
 if result["exit"]==0:
  assert result["mountOwnership"], "real production domain mount not observed"
  report=result["report"];assert report["accepted"] and report["cleanupComplete"],report
  output=base64.b64decode(report["backendReceipt"]["output"]["data"])
  fixture=json.loads(output);assert fixture["PASS"] and fixture["roundtrip"]
  keys=('live','peak','written','inodes')
  def window(bounds):
   selected=[v for v in result['counterSamples'] if bounds[0]+.05<v['at']<bounds[1]-.05]
   assert selected,'missing counter window'
   values=[{k:v[k] for k in keys} for v in selected]
   assert all(v==values[0] for v in values),values
   return values[0]
  baseline=window(fixture['baselineWindow'])
  assert baseline==dict(live=28672,peak=28672,written=8,inodes=5),baseline
  windows=[]
  for case in fixture['cases']:
   before=window(case['beforeWindow']);after=window(case['afterWindow'])
   assert before==after==baseline,(case,before,after)
   windows.append(dict(operation=case['operation'],before=before,after=after))
  reclaimed=window(fixture['reclaimedWindow'])
  assert reclaimed==dict(live=4096,peak=28672,written=8,inodes=1),reclaimed
  final=window(fixture['finalWindow'])
  assert final==dict(live=16384,peak=28672,written=8+fixture['payloadBytes'],inodes=3),final
  fs=report['backendReceipt']['filesystem']
  assert all(fs[k]==final[k] for k in keys),fs
  result['acceptance']=dict(PASS=True,fixture=fixture,rejectionCounterWindows=windows,reclaimed=reclaimed,final=final,metadataReusable=True,callbackCoverage='not established; kernel may reject before backend',limitations='sampled stable windows, no instantaneous syscall counter reads',scope='one production CLI/FUSE mounted namespace case; no gameplay claim')
 result['identitiesAfter']=None;identities();result['identitiesAfter']=True
 result['observerCleanup']=dict(remainingMounts=[s for s in pathlib.Path('/proc/self/mountinfo').read_text().splitlines() if str(work) in s],workPathProcesses=[])
 for f in pathlib.Path('/proc').glob('[0-9]*/cmdline'):
  try:
   if int(f.parent.name)!=os.getpid() and any(a==str(work).encode() or a.startswith(str(work).encode()+b'/') for a in f.read_bytes().split(b'\0')):result['observerCleanup']['workPathProcesses'].append(int(f.parent.name))
  except OSError:pass
 result['fixturePin']=manifest['fixturePin'];result['pythonPin']=pin(pathlib.Path('/usr/bin/python3'))
 result['environment']=dict(PYTHONDONTWRITEBYTECODE='1',inheritedEnvironmentValues='not captured; no credential exposure')
(R/(sys.argv[1]+'.json')).write_text(json.dumps(result,indent=2))
print(json.dumps(dict(saved=sys.argv[1]+'.json',bytes=(R/(sys.argv[1]+'.json')).stat().st_size,exit=result.get('exit'),PASS=result.get('PASS'))))
