import os,resource,subprocess,time,pathlib,json,signal,sys
root=pathlib.Path('/home/user/madbomber-full-midi-oct30').resolve();assert pathlib.Path.cwd()==root
M=1048576
original={str(x):list(resource.getrlimit(x)) for x in [resource.RLIMIT_DATA,resource.RLIMIT_AS,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE]}
assert resource.getrlimit(resource.RLIMIT_DATA)==(-1,-1) and resource.getrlimit(resource.RLIMIT_AS)==(-1,-1)
def allocated():return root.stat().st_blocks*512+sum(p.lstat().st_blocks*512 for p in root.rglob('*'))
mem=int(next(s.split()[1] for s in open('/proc/meminfo') if s.startswith('MemAvailable:')))*1024
assert mem>=max(2*1024*M,4352*M),('RAM admission',mem)
assert allocated()<112*M,('disk reserve',allocated())
resource.setrlimit(resource.RLIMIT_DATA,(256*M,resource.getrlimit(resource.RLIMIT_DATA)[1]))
node='/home/user/.nvm/versions/node/v24.22.1/bin/node';argv=[node,'--max-old-space-size=3072']
env=dict(os.environ,NODE_OPTIONS='');env.pop('NODE_PATH',None)
def limits():
 for which in [resource.RLIMIT_DATA,resource.RLIMIT_AS]:resource.setrlimit(which,(-1,-1))
 resource.setrlimit(resource.RLIMIT_CPU,(180,180));resource.setrlimit(resource.RLIMIT_FSIZE,(64*M,64*M))
def run(name,args):
 started=time.monotonic();o=open(root/(name+'.stdout'),'wb');e=open(root/(name+'.stderr'),'wb');q=subprocess.Popen(argv+args,cwd=root,env=env,preexec_fn=limits,stdout=o,stderr=e,start_new_session=True);peak=0;denial=None
 while q.poll() is None:
  rows={}
  for p in pathlib.Path('/proc').glob('[0-9]*/stat'):
   try:s=p.read_text().rsplit(')',1)[1].split();rows[int(p.parent.name)]=(int(s[1]),int(s[21])*4096)
   except (OSError,ValueError):pass
  ids={q.pid}
  while True:
   more=ids|{k for k,v in rows.items() if v[0] in ids}
   if more==ids:break
   ids=more
  rss=sum(rows.get(i,(0,0))[1] for i in ids);peak=max(peak,rss)
  if rss>4096*M:denial='groupRSS'
  if rows.get(os.getpid(),(0,0))[1]>256*M:denial='parentRSS'
  if time.monotonic()-started>300:denial='wall'
  if (root/(name+'.stdout')).stat().st_size+(root/(name+'.stderr')).stat().st_size>65536:denial='capture'
  if allocated()>112*M:denial='disk reserve'
  if denial:os.killpg(q.pid,signal.SIGKILL);q.wait();break
  time.sleep(.1)
 o.close();e.close();receipt=dict(argv=argv+args,cwd=str(root),originalLimits=original,exit=q.returncode,denial=denial,peakGroupRSS=peak,elapsed=time.monotonic()-started,MemAvailable=mem,allocated=allocated());(root/(name+'.json')).write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt),flush=True)
 return q.returncode==0 and not denial
startup="const fs=require('fs');console.log(JSON.stringify({node:process.execPath,version:process.version,limits:fs.readFileSync('/proc/self/limits','utf8'),shared:new WebAssembly.Memory({initial:1,maximum:1,shared:true}).buffer instanceof SharedArrayBuffer}))"
if not run('startup',['-e',startup]):sys.exit(1)
run('qualification',['test/madbomber-full-module-midi-dispatch-qualification-oct30/qualification.js'])
