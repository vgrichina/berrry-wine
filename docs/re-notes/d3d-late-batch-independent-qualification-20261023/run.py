import os,sys,resource,subprocess,selectors,time,signal,pathlib,json
BASE=pathlib.Path('/tmp/d3d-late-batch-independent-oct23')
COUNT=BASE/'capture-count'
used=int(COUNT.read_text()) if COUNT.exists() else 410000
assert used<524288, 'aggregate capture'
assert int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable:')))*1024>=805306368, 'MemAvailable'
assert sum(p.stat().st_size for p in BASE.rglob('*') if p.is_file() and not p.is_symlink())<6291456, 'private disk cap'
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(60,60))
 resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
env=os.environ.copy()
env['GIT_NO_LAZY_FETCH']='1'
env['GIT_SSH_COMMAND']='ssh -i /home/user/.ssh/wine_github_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts'
p=subprocess.Popen(sys.argv[1:],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,env=env,preexec_fn=limits,start_new_session=True)
s=selectors.DefaultSelector();s.register(p.stdout,selectors.EVENT_READ);start=time.monotonic()
try:
 while s.get_map():
  assert time.monotonic()-start<60,'wall60'
  for key,_ in s.select(.1):
   b=os.read(key.fd,4096)
   if not b:s.unregister(key.fileobj);continue
   assert used+len(b)<=524288,'streamed aggregate capture'
   used+=len(b);COUNT.write_text(str(used));sys.stdout.buffer.write(b);sys.stdout.buffer.flush()
 sys.exit(p.wait(timeout=max(.1,60-(time.monotonic()-start))))
except BaseException:
 if p.poll() is None:os.killpg(p.pid,signal.SIGKILL);p.wait()
 raise
