import subprocess,sys,os,signal,resource,time,json,pathlib,selectors
base=pathlib.Path('/tmp/dashboard-utf8-independent-accept-oct25/ops'); label=sys.argv[1]; argv=sys.argv[2:]
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(24*1024*1024,24*1024*1024));resource.setrlimit(resource.RLIMIT_CORE,(0,0))
e=os.environ.copy();e['TMPDIR']=str(base/'tmp');(base/'tmp').mkdir(exist_ok=True);e['NODE_PATH']='/tmp/wa-local-runtime-deps/node_modules';e['NODE_OPTIONS']='--max-old-space-size=128';e.update(json.load(open(base/'git-env.json')))
p=subprocess.Popen(argv,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True,preexec_fn=limits,env=e); sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ); data=bytearray();start=time.monotonic(); reason=None
while sel.get_map():
 if time.monotonic()-start>60: reason='wall';break
 for key,_ in sel.select(.1):
  b=os.read(key.fd,8192)
  if not b:sel.unregister(key.fileobj);continue
  data.extend(b)
  if len(data)>131072:reason='output';break
 if reason:break
if reason:
 os.killpg(p.pid,signal.SIGTERM)
 try:p.wait(timeout=2)
 except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL)
p.wait(timeout=3)
(base/(label+'.log')).write_bytes(data[:131072]); receipt={'argv':argv,'exit':p.returncode,'bytes':len(data),'reason':reason,'seconds':time.monotonic()-start};(base/(label+'.json')).write_text(json.dumps(receipt));print(json.dumps(receipt));print(data[-5000:].decode(errors='replace'));sys.exit(p.returncode if p.returncode>=0 else 1)
