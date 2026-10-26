import pathlib,subprocess,json,os,sys,time,resource,selectors,signal,datetime,fcntl
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';NODE='/home/user/.nvm/versions/node/v24.22.1/bin/node'
lock=open('/tmp/wine-ops-heavy-runtime.lock','a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
case=sys.argv[1];compat='--compat' in sys.argv;label=case+('-compat' if compat else '-tail');assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime(2026,10,26,1,5,tzinfo=datetime.timezone.utc)
mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable')))*1024;assert mem>=2684354560
(O/'native-attempt.json').write_text(json.dumps(dict(case=case,compat=compat,memAvailable=mem,at=time.time(),arenaMiB=512,heapMiB=512)))
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
argv=[NODE,'--max-old-space-size=512','--require','/home/user/maelstrom-errno-api-canonical-native-oct25/ops/native-module-bound.cjs',str(H/'repo/test/maelstrom-errno-independent-foreign-ret.cjs'),case]+(['--compat'] if compat else [])
p=subprocess.Popen(argv,cwd=H/'repo',stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,preexec_fn=limits);sel=selectors.DefaultSelector();out={};total=0;start=time.monotonic();reason=None
for name,pipe in [('stdout',p.stdout),('stderr',p.stderr)]:os.set_blocking(pipe.fileno(),False);sel.register(pipe,selectors.EVENT_READ,name);out[name]=bytearray()
while sel.get_map() or p.poll() is None:
 if time.monotonic()-start>60:reason='wall'
 if reason:
  os.killpg(p.pid,signal.SIGTERM)
  try:p.wait(timeout=5)
  except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait(timeout=5)
  break
 for k,_ in sel.select(.05):
  b=os.read(k.fileobj.fileno(),65536)
  if not b:sel.unregister(k.fileobj);continue
  total+=len(b);out[k.data].extend(b[:max(0,131072-sum(len(v) for v in out.values()))])
  if total>131072:reason='capture'
rc=p.wait();
for n,b in out.items():(O/(label+'.'+n)).write_bytes(b)
result=dict(case=case,compat=compat,exit=rc,reason=reason,elapsed=time.monotonic()-start,memAvailable=mem,streamBytes=total,reaped=True,cpu=90,wall=60,fileLimit=25165824,heapMiB=512,arenaMiB=512,argv=argv)
(O/(label+'-execution.json')).write_text(json.dumps(result,indent=2));print(json.dumps(result));sys.exit(rc if reason is None else 125)
