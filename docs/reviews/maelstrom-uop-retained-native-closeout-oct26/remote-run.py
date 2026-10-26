import pathlib,json,subprocess,resource,os,time,signal,selectors,sys,datetime,fcntl
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';stage=sys.argv[1];case=sys.argv[2];argv=sys.argv[3:];assert stage in ['compiler','native','preflight'];assert not (O/('attempt-'+case+'.json')).exists()
lock=open('/tmp/wine-ops-heavy-runtime.lock','a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
cutoff=datetime.datetime.fromisoformat(json.load(open(O/'runtime.json'))['guestCutoff'].replace('Z','+00:00'));assert datetime.datetime.now(datetime.timezone.utc)<cutoff
mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable')))*1024;assert mem>=2684354560
allocated=sum(max(p.stat().st_size,p.stat().st_blocks*512) for p in H.rglob('*') if p.is_file());assert allocated<=2*1048576
cpu=600 if stage=='compiler' else 90;wall=600 if stage=='compiler' else 60
receipt=dict(stage=stage,case=case,argv=argv,at=time.time(),memAvailable=mem,minMemory=2684354560,allocated=allocated,remoteBudget=2*1048576,heapMiB=512,arenaMiB=512 if stage=='native' else 0,cpu=cpu,wall=wall,outputMax=131072,fileMax=2097152)
(O/('attempt-'+case+'.json')).write_text(json.dumps(receipt,indent=2))
if stage=='native':(O/'native-attempt.json').write_text(json.dumps(receipt))
env=dict(os.environ,MNE_CANONICAL_ROOT=str(H/'canonical'),MNE_STANDING='/home/user/maelstrom-uop-canonical-native-qualification-oct26/ops',MNE_ANCHORS='/home/user/maelstrom-uop-canonical-native-qualification-oct26/ops/anchors',PYTHONDONTWRITEBYTECODE='1',TMPDIR=str(O));env.pop('NODE_OPTIONS',None)
def limits():resource.setrlimit(resource.RLIMIT_CPU,(cpu,cpu));resource.setrlimit(resource.RLIMIT_FSIZE,(2097152,2097152))
p=subprocess.Popen(argv,cwd=H/'repo',env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,preexec_fn=limits);sel=selectors.DefaultSelector();out={};total=0;start=time.monotonic();reason=None
for n,f in [('stdout',p.stdout),('stderr',p.stderr)]:os.set_blocking(f.fileno(),False);sel.register(f,selectors.EVENT_READ,n);out[n]=open(O/(case+'.'+n),'wb')
while sel.get_map() or p.poll() is None:
 if time.monotonic()-start>wall or datetime.datetime.now(datetime.timezone.utc)>=cutoff:reason='wall/cutoff'
 if reason:
  try:os.killpg(p.pid,signal.SIGKILL)
  except ProcessLookupError:pass
 for k,_ in sel.select(.05):
  b=os.read(k.fileobj.fileno(),8192)
  if not b:sel.unregister(k.fileobj);continue
  out[k.data].write(b[:max(0,131072-total)]);total+=len(b)
  if total>131072:reason='output overflow'
code=p.wait()
for f in out.values():f.close()
receipt.update(exit=code,reason=reason,elapsed=time.monotonic()-start,outputBytes=total,maxRSS=resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss*1024)
(O/('execution-'+case+'.json')).write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt));sys.exit(code if reason is None else 125)
