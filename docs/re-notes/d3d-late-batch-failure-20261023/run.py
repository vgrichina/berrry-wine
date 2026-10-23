import subprocess,sys,os,resource,selectors,time,json
ROOT='/tmp/d3d-late-batch-oct23'
countfile=ROOT+'/capture-count'; used=int(open(countfile).read()) if os.path.exists(countfile) else 65000
assert used<524288
assert int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable:')))*1024>=805306368

def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
env=os.environ.copy();env['GIT_NO_LAZY_FETCH']='1';env['GIT_SSH_COMMAND']='ssh -i /home/user/.ssh/wine_github_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts'
p=subprocess.Popen(sys.argv[1:],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,env=env,preexec_fn=limits,start_new_session=True)
s=selectors.DefaultSelector();s.register(p.stdout,selectors.EVENT_READ);start=time.monotonic(); chunks=[]
while s.get_map():
 if time.monotonic()-start>60: os.killpg(p.pid,9);raise SystemExit('wall limit')
 for key,_ in s.select(.1):
  b=os.read(key.fd,4096)
  if not b:s.unregister(key.fileobj);continue
  if used+len(b)>524288:os.killpg(p.pid,9);raise SystemExit('capture limit')
  used+=len(b);open(countfile,'w').write(str(used));sys.stdout.buffer.write(b);sys.stdout.buffer.flush()
r=p.wait();sys.exit(r)
