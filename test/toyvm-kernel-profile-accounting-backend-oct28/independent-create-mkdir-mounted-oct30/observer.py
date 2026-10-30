import os,sys,pathlib,json,hashlib,ctypes,stat,subprocess,resource,time,signal,base64,socket
R=pathlib.Path('/tmp/tvmd-stage');P=R/'repo';M=1048576
os.chdir(R)
def lower(k,n):
 s,h=resource.getrlimit(k);resource.setrlimit(k,(min(s,n) if s!=-1 else n,min(h,n) if h!=-1 else n))
lower(resource.RLIMIT_DATA,128*M)
lower(resource.RLIMIT_CPU,60)
lower(resource.RLIMIT_FSIZE,524288)
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
       data+=part;assert len(data)<=32768
     state=json.loads(data)
     samples.append(dict(at=time.monotonic(),live=state["live"],peak=state["peak"],written=state["written"],inodes=state["inodes"],callbacks=state["namespaceEvidence"]["callbackCount"],openHandles=state["openHandles"]))
    except (FileNotFoundError,ConnectionRefusedError):pass
   reason=None
   if time.monotonic()-start>90:reason='wall90'
   if rss>512*M:reason='groupRSS512'
   if rows.get(os.getpid(),(0,0))[1]>128*M:reason='parentRSS128'
   if out.stat().st_size+err.stat().st_size>65536:reason='output65536'
   if sum(f.lstat().st_blocks*512 for root in (R,pathlib.Path("/tmp/tvmd")) if root.exists() for f in [root,*root.rglob("*")])>248*M:reason='disk256includingReserve8'
   if reason:os.killpg(q.pid,signal.SIGKILL);q.wait();raise RuntimeError(reason)
   time.sleep(.015)
 return dict(argv=argv,cwd=str(P),exit=q.returncode,stdout=out.read_text(),stderr=err.read_text(),wall=time.monotonic()-start,groupPeakRSS=peak,mountOwnership=mounts,counterSamples=samples)
identities()
assert time.time()<manifest['cutoffEpoch']
if sys.argv[1]=='preflight':
 import platform
 assert platform.machine()=='x86_64'
 assert stat.S_ISCHR(os.stat('/dev/fuse').st_mode)
 fd=os.open('/dev/fuse',os.O_RDWR|os.O_CLOEXEC);os.close(fd)
 ctypes.CDLL('libfuse3.so.3')
 c=ctypes.CDLL(None,use_errno=True);c.syscall.restype=ctypes.c_long
 abi=c.syscall(444,0,0,1);assert abi>=3
 assert pathlib.Path('/proc/self/fd').is_dir()
 result=dict(PASS=True,landlockABI=abi,fuseOpened=True,libfuse=True,procFD=True,limits={n:resource.getrlimit(getattr(resource,n)) for n in ['RLIMIT_DATA','RLIMIT_AS','RLIMIT_CPU','RLIMIT_FSIZE']})
else:
 assert sys.argv[1]=='guards'
 work=pathlib.Path('/tmp/tvmd');assert not work.exists();work.mkdir()
 argv=manifest['cliArgv']
 result=run(argv,'guards')
 try:report=json.loads(result.pop('stdout'))
 except Exception:raise RuntimeError('non-JSON production report')
 result['report']=report
 (R/'guards-first.json').write_text(json.dumps(result))
 assert result['exit']==0 and report['accepted'] and report['cleanupComplete'],report
 fixture=json.loads(base64.b64decode(report['backendReceipt']['output']['data']))
 assert fixture['PASS'] and fixture['roundtrip'] and fixture['finalEmpty']
 stableKeys=('live','peak','written','inodes','openHandles')
 observations=[]
 for case in fixture['cases']:
  before=[s for s in result['counterSamples'] if case['begin']+.025<s['at']<case['attempt']-.025]
  after=[s for s in result['counterSamples'] if case['finish']+.025<s['at']<case['end']-.025]
  assert before and after,'missing accounting windows'
  values={k:before[0][k] for k in stableKeys}
  assert all({k:s[k] for k in stableKeys}==values for s in before+after),'accounting changed during rejected syscall'
  delta=after[-1]['callbacks']-before[0]['callbacks']
  assert delta in (0,1)
  observations.append(dict(op=case['op'],expected=case['expected'],actual=case['actual'],namespaceContentUnchanged=case['unchanged'],accountingBefore=values,accountingAfter={k:after[-1][k] for k in stableKeys},actualBackendCallbacks=delta,coverage='observed' if delta else 'unobserved; kernel may preempt'))
 fs=report['backendReceipt']['filesystem'];ev=fs['namespaceEvidence']
 assert ev['limit']==64 and len(ev['records'])<=64 and ev['callbackCount']>=5
 expected=[(35,0,1),(9,0,1),(9,0,3),(9,0,3),(35,0,5),(11,39,3),(10,0,5),(11,0,3),(11,0,3),(10,0,1),(11,0,1)]
 assert [(v['opcode'],v['errno'],v['inode']) for v in ev['records']]==expected,'callback/syscall discrepancy'
 assert ev['callbackCount']==11 and not ev['countSaturated']
 assert [v['callbackCount'] for v in ev['records']]==list(range(1,12))
 assert all(set(v)=={'opcode','errno','inode','unique','callbackCount'} for v in ev['records'])
 assert all(type(x)is int and 0<=x<(1<<64) for v in ev['records'] for x in v.values())
 assert len({v['unique'] for v in ev['records']})==11
 for private in ('parent-file','nonempty','child,comma','Q7z!'):assert private not in json.dumps(fs)
 assert (fs['live'],fs['inodes'],fs['written'],fs['openHandles'],fs['failure'])==(4096,1,4,0,None)
 assert result['mountOwnership'],'no actual mount observed'
 # Counter samples are compacted after checking every rejection window.
 result.pop('counterSamples')
 successLabels=['create-parent-file','mkdir-parent','mkdir-empty','mkdir-nonempty','create-comma-child']
 result['acceptance']=dict(PASS=True,syscalls=observations,successfulCreateMkdir=[dict(syscall=label,actualErrno=0,callback=ev['records'][i]) for i,label in enumerate(successLabels)],expectedCallbacks=expected,numericOnly=True,privacy=True,nestedParentIdentity=fixture['nestedParentIdentity'],READDIRRawDotDot='not separately observable through Python listdir; stat nested .. identity checked',sourceOracle='exact fuse_backend.py handlers9/35 and unchanged production fixture',roundtrip=True,finalEmpty=True)
 identities()
 remaining=[s for s in pathlib.Path('/proc/self/mountinfo').read_text().splitlines() if '/tmp/tvmd/domain' in s]
 processes=[]
 for f in pathlib.Path('/proc').glob('[0-9]*/cmdline'):
  try:
   if int(f.parent.name)!=os.getpid() and any(a==b'/tmp/tvmd' or a.startswith(b'/tmp/tvmd/') for a in f.read_bytes().split(b'\0')):processes.append(int(f.parent.name))
  except OSError:pass
 result['observerCleanup']=dict(remainingMounts=remaining,processes=processes)
 assert not remaining and not processes
(R/(sys.argv[1]+'.json')).write_text(json.dumps(result))
print(json.dumps(dict(saved=sys.argv[1]+'.json',PASS=result.get('PASS',result.get('acceptance',{}).get('PASS')))))
