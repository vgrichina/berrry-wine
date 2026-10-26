import subprocess,resource,os,sys,pathlib,selectors,time,signal,json
R=pathlib.Path('/home/user/wine-assembly/scratch/runs/civ2-win16-footprint-recovered-gameplay-oct26')
env=os.environ.copy();env['GIT_SSH_COMMAND']='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def limits():
 resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
 resource.setrlimit(resource.RLIMIT_CPU,(90,90))
 resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
watch=subprocess.Popen(['tail','-f','/home/user/wine-assembly/messageboard.txt'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
cmd=['git','-c','gc.auto=0',*sys.argv[1:]]
start=time.monotonic();p=subprocess.Popen(cmd,cwd=R,env=env,preexec_fn=limits,start_new_session=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT);sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ);data=bytearray();reason=None
try:
 while sel.get_map() or p.poll() is None:
  for key,_ in sel.select(.1):
   b=os.read(key.fd,8192)
   if not b:sel.unregister(key.fileobj)
   else:data.extend(b)
  if len(data)>2097152 or time.monotonic()-start>120:
   reason='output/wall cap';os.killpg(p.pid,signal.SIGKILL);break
 p.wait();sys.stdout.write(data[:8192].decode(errors='replace'))
 with open(R/'git-operations.jsonl','a') as f:f.write(json.dumps(dict(command=cmd,gitDataLimit=536870912,wallSeconds=time.monotonic()-start,outputBytes=len(data),exitCode=p.returncode,stopReason=reason,output=data[:8192].decode(errors='replace')))+'\n')
finally:
 watch.terminate();watch.wait()
sys.exit(p.returncode or (1 if reason else 0))
