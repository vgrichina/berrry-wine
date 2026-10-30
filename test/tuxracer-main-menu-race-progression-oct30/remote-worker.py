"""Single canonical compile; bounded original app title -> Practice -> race attempt."""
import pathlib,subprocess,resource,time,os,signal,json,hashlib,sys
R=pathlib.Path('/home/user/tuxracer-render');O=R/'capture';O.mkdir(exist_ok=True)
N='/home/user/.nvm/versions/node/v24.22.1/bin/node';FLAGS=['--max-old-space-size=512'];M=1048576
ORIG={k:resource.getrlimit(k) for k in [resource.RLIMIT_DATA,resource.RLIMIT_AS,resource.RLIMIT_CPU,resource.RLIMIT_FSIZE]}
soft,hard=ORIG[resource.RLIMIT_DATA];resource.setrlimit(resource.RLIMIT_DATA,(min(128*M,soft) if soft!=-1 else 128*M,hard))
def save(n,v):(O/n).write_text(json.dumps(v,indent=2)+'\n')
def allocation():
 used=sum(p.lstat().st_blocks*512 for p in pathlib.Path('/home/user').glob('*.tar.gz'))+sum(p.lstat().st_blocks*512 for p in [R,*R.rglob('*')])
 mem=int(next(s.split()[1] for s in pathlib.Path('/proc/meminfo').read_text().splitlines() if s.startswith('MemAvailable:')))*1024
 v=dict(allocated=used,budget=256*M,reserve=8*M,MemAvailable=mem);assert used<=248*M,v
 return v
def run(name,args,wall):
 admission=allocation();started=time.time();start=time.monotonic();reason=None;peak=0
 def limits():
  resource.setrlimit(resource.RLIMIT_DATA,ORIG[resource.RLIMIT_DATA]);resource.setrlimit(resource.RLIMIT_AS,ORIG[resource.RLIMIT_AS])
  for k,n in [(resource.RLIMIT_CPU,90),(resource.RLIMIT_FSIZE,12*M)]:
   s,h=ORIG[k];resource.setrlimit(k,(min(n,s) if s!=-1 else min(n,h) if h!=-1 else n,h))
 a=O/(name+'.stdout');b=O/(name+'.stderr')
 with a.open('xb') as x,b.open('xb') as y:
  q=subprocess.Popen(args,cwd=R,stdout=x,stderr=y,preexec_fn=limits,start_new_session=True)
  while q.poll() is None:
   rows={}
   for f in pathlib.Path('/proc').glob('[0-9]*/stat'):
    try:
     s=f.read_text().rsplit(')',1)[1].split();rows[int(f.parent.name)]=(int(s[1]),int(s[21])*4096)
    except (OSError,ValueError):pass
   ids={q.pid}
   while True:
    new=ids|{p for p,v in rows.items() if v[0] in ids}
    if new==ids:break
    ids=new
   rss=sum(rows.get(i,(0,0))[1] for i in ids);peak=max(peak,rss)
   if time.monotonic()-start>wall:reason='wall'
   elif rss>2048*M:reason='groupRSS2GiB'
   elif rows.get(os.getpid(),(0,0))[1]>128*M:reason='supervisorRSS128MiB'
   elif a.stat().st_size+b.stat().st_size>512*1024:reason='output512KiB'
   if reason:os.killpg(q.pid,signal.SIGKILL);q.wait();break
   time.sleep(.05)
  q.wait()
 v=dict(argv=args,startedAt=started,finishedAt=time.time(),elapsed=time.monotonic()-start,exit=q.returncode,denial=reason,peakProcessTreeRSS=peak,admission=admission,logs={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'tail':p.read_text(errors='replace')[-14000:]} for p in [a,b]})
 save(name+'.json',v)
 if reason or q.returncode:raise RuntimeError(name+' stopped: '+str(q.returncode)+' '+str(reason))
 return v
def main():
 save('remote-environment.json',dict(inheritedLimits={str(k):v for k,v in ORIG.items()},environment={k:os.environ.get(k) for k in ['PATH','NODE_OPTIONS','LANG','TZ']},node=N,flags=FLAGS,allocation=allocation()))
 run('startup',[N,*FLAGS,'-e',"console.log(JSON.stringify({execPath:process.execPath,version:process.version,flags:process.execArgv,limits:require('fs').readFileSync('/proc/self/limits','utf8')}))"],15)
 run('compile',[N,*FLAGS,'tools/build-compile-wat.js'],120)
 modules={p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in (R/'build').glob('*.wasm')}
 assert modules['wine-assembly.wasm']['sha256']!='3b07f522ea5f0bae43f285d0f8ae9ee2ed297eab6997cbefe2bb660abd8aa581'
 save('module-manifest.json',modules)
 assert modules['wine-assembly.wasm']=={'bytes':1881806,'sha256':'5a39225e1a8381ce1c4530d2ce7cd6311bd75576d10968c20e963baf033d41eb'}
 args=[N,*FLAGS,'test/run.js','--app=tuxracer_original_061a','--no-build','--wasm=build/wine-assembly.wasm','--gl-renderer=software','--no-threads','--max-seconds=100','--max-batches=1000000','--quiet-api','--quiet-blocks','--quiet-fs','--png=capture/after.png','--gl-census','--input=17000:png:capture/title.png,18000:keydown:13,26000:keyup:13,30000:png:capture/before.png,31000:mousemove:320:260,32000:click:320:260,38000:png:capture/practice.png,40000:keydown:13,44000:keyup:13,49000:png:capture/course.png,51000:keydown:13,55000:keyup:13','--trace-input-dispatch']
 run('runtime',args,115)
if __name__=='__main__':
 try:main();save('done.json',{'success':True,'finishedAt':time.time()})
 except BaseException as e:save('done.json',{'success':False,'error':repr(e),'finishedAt':time.time()})
