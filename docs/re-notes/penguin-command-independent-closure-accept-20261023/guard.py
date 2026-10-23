import subprocess,sys,selectors,time,pathlib,os
counter=pathlib.Path('/tmp/penguin-independent-output-count')
n=int(counter.read_text()) if counter.exists() else 70000
p=subprocess.Popen(sys.argv[1:],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True)
s=selectors.DefaultSelector();s.register(p.stdout,selectors.EVENT_READ);start=time.monotonic()
while s.get_map():
 if time.monotonic()-start>60:
  os.killpg(p.pid,9);raise SystemExit('wall guard rejected')
 for key,_ in s.select(.1):
  b=os.read(key.fd,4096)
  if not b:s.unregister(key.fileobj);continue
  n+=len(b);counter.write_text(str(n))
  if n>524288:os.killpg(p.pid,9);raise SystemExit('output guard rejected')
  sys.stdout.buffer.write(b);sys.stdout.buffer.flush()
raise SystemExit(p.wait())
