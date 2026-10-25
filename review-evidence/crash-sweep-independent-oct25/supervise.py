import subprocess,resource,os,signal,selectors,time,sys,json,pathlib
# Enforce process-group deadline, CPU/file caps and combined streaming output cap.
def limits():
 os.setsid();resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(24*1024**2,24*1024**2))
p=subprocess.Popen(sys.argv[2:],stdout=subprocess.PIPE,stderr=subprocess.PIPE,preexec_fn=limits)
s=selectors.DefaultSelector()
for f in [p.stdout,p.stderr]:s.register(f,selectors.EVENT_READ)
start=time.monotonic();data=bytearray();reason=None
while s.get_map():
 if time.monotonic()-start>60:reason='wall limit';break
 for key,_ in s.select(.1):
  x=os.read(key.fd,8192)
  if not x:s.unregister(key.fileobj)
  else:
   if len(data)+len(x)>128*1024:reason='output limit';break
   data.extend(x)
 if reason:break
if reason:
 os.killpg(p.pid,signal.SIGTERM)
 try:p.wait(timeout=2)
 except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait(timeout=2)
else:p.wait(timeout=2)
pathlib.Path(sys.argv[1]).write_bytes(data)
print(data[:8000].decode(errors='replace'),end='');print(json.dumps({'exit':p.returncode,'reason':reason,'bytes':len(data),'wall':time.monotonic()-start}))
sys.exit(1 if reason else p.returncode)
