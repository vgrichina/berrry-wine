import pathlib,os,subprocess,selectors,signal,time,resource,json,hashlib,shutil,sys
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';R=H/'repo';W=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch')/H.name
def save(n,j):(O/n).write_text(json.dumps(j,indent=2)+'\n')
def gate(label):
 taskFiles=[p for p in H.rglob('*') if p.is_file()];sessionFiles=[p for p in W.rglob('*') if p.is_file()];owned=max(sum(p.stat().st_size for p in taskFiles),sum(p.stat().st_blocks*512 for p in taskFiles));ext=max(sum(p.stat().st_size for p in sessionFiles),sum(p.stat().st_blocks*512 for p in sessionFiles));dbbase=json.loads((O/'sqlite-baseline.json').read_text()) if (O/'sqlite-baseline.json').exists() else {};positiveDB=sum(max(0,pathlib.Path(p).stat().st_size-n) for p,n in dbbase.items() if pathlib.Path(p).exists());mem=int(next(l.split()[1] for l in pathlib.Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024;free=shutil.disk_usage(H).free
 j=dict(taskBytes=owned,externalSessionBytes=ext,positiveSharedDBGrowth=positiveDB,sharedWALChargedOnce=True,futureTestsAndPublication=6*1048576,futureSessionPositiveDBWAL=12*1048576,reserve=8*1048576,memAvailable=mem,workerClientAllowance=536870912,floor=805306368,free=free);j['projected']=owned+ext+positiveDB+26*1048576;j['pass']=j['projected']<=67108864 and free-(j['projected']-owned)>=2982150144 and mem-536870912>=805306368;save('resource-'+label+'.json',j);assert j['pass'],j
 return j
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(35,40));resource.setrlimit(resource.RLIMIT_FSIZE,(24*1048576,24*1048576));resource.setrlimit(resource.RLIMIT_CORE,(0,0))
def run(label,args,expected=0):
 gate(label);env=dict(os.environ,MNE_SOURCE_ROOT=str(O/'pinned-source'),MNE_ORIGINAL_ROOT='/tmp/maelstrom-frozen-original-recovered-capture-oct25/vfs/maelstrom',MNE_CRT='/tmp/maelstrom-frozen-original-recovered-capture-oct25/runtime/system/msvcrt.dll',MNE_REVIEW_REPO=str(R),MNE_OPS=str(O),NODE_OPTIONS='--max-old-space-size=128',PYTHONDONTWRITEBYTECODE='1')
 p=subprocess.Popen(args,cwd=R,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True,preexec_fn=limits);s=selectors.DefaultSelector();s.register(p.stdout,selectors.EVENT_READ);out=bytearray();start=time.monotonic();reason=None
 while s.get_map():
  if time.monotonic()-start>50:reason='wall';break
  for k,_ in s.select(.1):
   b=os.read(k.fileobj.fileno(),8192)
   if b:out.extend(b)
   else:s.unregister(k.fileobj)
  if len(out)>131072:reason='output';break
 if reason or p.poll() is None and not s.get_map():
  if reason:os.killpg(p.pid,signal.SIGTERM)
 try:p.wait(timeout=3)
 except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
 (O/(label+'.log')).write_bytes(out[:131072]);row=dict(label=label,args=args,exit=p.returncode,expected=expected,reason=reason,bytes=len(out),seconds=time.monotonic()-start,reaped=True,sha256=hashlib.sha256(out[:131072]).hexdigest())
 with (O/'commands.jsonl').open('a') as f:f.write(json.dumps(row)+'\n')
 save('checkpoint-'+label+'.json',dict(base='44e344fdb26daab9a07210656597902ba27cb5f7',candidate=hashlib.sha256((R/'tools/maelstrom-native-errno-latch.cjs').read_bytes()).hexdigest(),inputHashes={a:hashlib.sha256((R/a).read_bytes()).hexdigest() for a in args if (R/a).is_file()},command=row,remaining=['canonical full build','original-game qualification','publication']))
 assert p.returncode==expected and reason is None,(row,out[:1800]);print(json.dumps(row))
if __name__=='__main__':run(sys.argv[1],sys.argv[2:])
