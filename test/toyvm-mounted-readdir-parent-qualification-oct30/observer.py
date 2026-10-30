import os,sys,pathlib,json,hashlib,ctypes,stat,subprocess,resource,time,signal,base64
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
 out=R/(label+'.stdout');err=R/(label+'.stderr');start=time.monotonic();mounts=[];peak=0
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
   reason=None
   if time.monotonic()-start>90:reason='wall90'
   if rss>512*M:reason='groupRSS512'
   if rows.get(os.getpid(),(0,0))[1]>128*M:reason='parentRSS128'
   if out.stat().st_size+err.stat().st_size>8192:reason='output8192'
   if sum(f.stat().st_blocks*512 for f in R.rglob('*') if f.is_file())>48*M:reason='disk48includingReserve8'
   if reason:os.killpg(q.pid,signal.SIGKILL);q.wait();raise RuntimeError(reason)
   time.sleep(.005)
 return dict(argv=argv,cwd=str(P),exit=q.returncode,stdout=out.read_text(),stderr=err.read_text(),wall=time.monotonic()-start,groupPeakRSS=peak,mountOwnership=mounts)
identities()
assert int(next(s.split()[1] for s in pathlib.Path('/proc/meminfo').read_text().splitlines() if s.startswith('MemAvailable:')))*1024>=2*1024**3+512*M
if sys.argv[1]=='preflight':
 import platform
 assert platform.machine()=='x86_64'
 headers={p:pathlib.Path(p).read_text() for p in ['/usr/include/x86_64-linux-gnu/bits/dirent.h','/usr/include/x86_64-linux-gnu/bits/typesizes.h','/usr/include/x86_64-linux-gnu/bits/types.h']}
 assert 'unsigned short int d_reclen;' in headers['/usr/include/x86_64-linux-gnu/bits/dirent.h']
 assert 'unsigned char d_type;' in headers['/usr/include/x86_64-linux-gnu/bits/dirent.h']
 assert 'char d_name[256]' in headers['/usr/include/x86_64-linux-gnu/bits/dirent.h']
 assert '#define __INO_T_TYPE' in headers['/usr/include/x86_64-linux-gnu/bits/typesizes.h']
 (R/'native-layout.json').write_text(json.dumps(dict(machine=platform.machine(),headerPins={p:pin(pathlib.Path(p)) for p in headers},headers=headers,pythonPin=pin(pathlib.Path('/usr/bin/python3')))))

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
 assert len('/tmp/tvmd/status.sock'.encode())<108
 help=run(['/usr/bin/python3','-B',str(P/'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'),'--help'],'help')
 assert help['exit']==0 and '--rename-evidence' in help['stdout'],help
 result=dict(PASS=True,sourcePins=manifest['sourcePins'],landlockABI=abi,MemAvailable=mem,fuseOpened=True,libfuse=True,procFDseccomp=True,absoluteRoot=str(R),socketBytes=len('/tmp/tvmd/status.sock'.encode()),help=help,limits={n:resource.getrlimit(getattr(resource,n)) for n in ['RLIMIT_DATA','RLIMIT_AS','RLIMIT_CPU','RLIMIT_FSIZE']})
else:
 assert sys.argv[1]=='guards'
 assert time.time()<1793328600,'cutoff reached'
 work=pathlib.Path('/tmp/tvmd');assert not work.exists();work.mkdir()
 argv=['/usr/bin/python3','-B',str(P/'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py'),'--domain','tiny-fixture','--receipt',str(R/'cancellation-receipt.json'),'--work',str(work),'--live-limit','262144','--write-limit','32768','--file-limit','32768','--rss-limit','67108864','--cpu-limit','10','--wall-limit','20','--output-limit','8192','--','/usr/bin/python3','-B','-c',(R/'fixture.py').read_text()]
 result=run(argv,'guards');result['report']=json.loads(result.pop('stdout'))
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
