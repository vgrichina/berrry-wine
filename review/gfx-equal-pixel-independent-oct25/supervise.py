import subprocess,resource,os,signal,sys,time,json,selectors,pathlib
# All children inherit these caps, including CLI children of the Node test.
def limits():
 os.setsid()
 resource.setrlimit(resource.RLIMIT_CPU,(60,60))
 resource.setrlimit(resource.RLIMIT_FSIZE,(24*1024*1024,24*1024*1024))
env=dict(os.environ,NODE_OPTIONS='--max-old-space-size=128')
p=subprocess.Popen(sys.argv[1:],stdout=subprocess.PIPE,stderr=subprocess.PIPE,preexec_fn=limits,env=env)
s=selectors.DefaultSelector(); s.register(p.stdout,selectors.EVENT_READ);s.register(p.stderr,selectors.EVENT_READ); out=bytearray(); deadline=time.monotonic()+60; reason=None
try:
 while s.get_map():
  if time.monotonic()>deadline: raise RuntimeError('wall limit')
  for key,_ in s.select(.1):
   b=os.read(key.fd,8192)
   if not b:s.unregister(key.fileobj);continue
   out.extend(b)
   if len(out)>131072:raise RuntimeError('output limit')
 p.wait(timeout=1)
except Exception as e:
 reason=str(e);os.killpg(p.pid,signal.SIGTERM)
 try:p.wait(timeout=2)
 except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait(timeout=2)
finally:
 try:os.killpg(p.pid,signal.SIGKILL)
 except ProcessLookupError:pass
(pathlib.Path('/tmp/gfx-equal-pixel-independent-accept-oct25/ops') / os.environ.get('GFX_LOG', 'tests.log')).write_bytes(out[:131072])
print(out[-3500:].decode(errors='replace'));print(json.dumps({'exitCode':p.returncode,'reason':reason,'capturedBytes':len(out),'heapMiB':128,'cpuSeconds':60,'wallSeconds':60,'fileBytes':25165824,'outputBytesLimit':131072}))
sys.exit(1 if reason else p.returncode)
