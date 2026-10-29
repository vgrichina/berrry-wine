import os,pathlib,json,hashlib,subprocess,resource,time,signal,datetime,shutil
R=pathlib.Path('/tmp/tuxwat');P=R/'repo';N='/home/user/.nvm/versions/node/v24.22.1/bin/node'
ENV={'PATH':str(pathlib.Path(N).parent)+':/usr/bin:/bin','LANG':'C.UTF-8','TZ':'UTC'}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def rows():
 d={}
 for p in pathlib.Path('/proc').glob('[0-9]*/stat'):
  try:s=p.read_text().rsplit(')',1)[1].split();d[int(p.parent.name)]=(int(s[1]),int(s[21])*4096)
  except (OSError,ValueError):pass
 return d
def run(label,args):
 assert resource.getrlimit(resource.RLIMIT_DATA)==(-1,-1)
 assert resource.getrlimit(resource.RLIMIT_AS)==(-1,-1)
 def limits():
  resource.setrlimit(resource.RLIMIT_CPU,(600,600));resource.setrlimit(resource.RLIMIT_FSIZE,(128*1048576,128*1048576))
 start=time.monotonic();peak=0;reason=None
 with (R/(label+'.stdout')).open('wb') as o,(R/(label+'.stderr')).open('wb') as e:
  q=subprocess.Popen(args,cwd=P,env=ENV,stdout=o,stderr=e,preexec_fn=limits,start_new_session=True)
  while q.poll() is None:
   d=rows();ids={q.pid}
   while True:
    new=ids|{i for i,v in d.items() if v[0] in ids}
    if new==ids:break
    ids=new
   rss=sum(d.get(i,(0,0))[1] for i in ids);peak=max(peak,rss)
   disk=sum(p.stat().st_blocks*512 for p in R.rglob('*') if p.is_file())
   if rss>8*1024**3:reason='RSS8GiB'
   if disk>448*1048576 or shutil.disk_usage(R).free<2*1024**3:reason='disk'
   if sum((R/(label+x)).stat().st_size for x in ['.stdout','.stderr'])>2*1048576:reason='capture'
   if time.monotonic()-start>900:reason='wall900'
   if datetime.datetime.now(datetime.timezone.utc)>=datetime.datetime.fromisoformat('2026-10-29T23:57:00+00:00'):reason='cutoff'
   if reason:os.killpg(q.pid,signal.SIGKILL);q.wait();break
   time.sleep(.1)
 result=dict(argv=args,cwd=str(P),environment=ENV,exit=q.returncode,elapsedSeconds=time.monotonic()-start,peakProcessTreeRSS=peak,denial=reason)
 result['logs']={x:dict(bytes=(R/(label+x)).stat().st_size,sha256=sha(R/(label+x))) for x in ['.stdout','.stderr']}
 (R/(label+'.json')).write_text(json.dumps(result,indent=2))
 return result
m=json.loads((R/'packet-manifest.json').read_text())
for x,pin in m['sourcePins'].items():assert (P/x).stat().st_size==pin['bytes'] and sha(P/x)==pin['sha256'],x
assert shutil.disk_usage(R).free>=2*1024**3
startup=run('startup',[N,'--max-old-space-size=6144','-e','const fs=require("fs"); console.log(JSON.stringify({execPath:process.execPath,version:process.version,argv:process.execArgv,limits:fs.readFileSync("/proc/self/limits","utf8")}))'])
assert startup['exit']==0
result=run('compile',[N,'--max-old-space-size=6144','tools/build-compile-wat.js'])
result['candidate']=m['candidate'];result['packetSha256']=sha(R/'source.tar.gz');result['artifacts']={}
for x in ['wine-assembly.wasm','wine-assembly.compat.wasm']:
 p=P/'build'/x
 if p.exists():result['artifacts'][x]=dict(bytes=p.stat().st_size,sha256=sha(p))
if result['exit']==0:
 script='const fs=require("fs"),h=require("./tools/region-layout-hash.js");const mirror=fs.readFileSync("lib/region-map.generated.js","utf8").match(/LAYOUT_HASH\\s*=\\s*[\x27\"]([0-9a-f]+)[\x27\"]/)[1];for(const p of ["build/wine-assembly.wasm","build/wine-assembly.compat.wasm"]){const b=fs.readFileSync(p);if(!WebAssembly.validate(b))throw Error("invalid "+p);new WebAssembly.Module(b);const hash=h.readSection(b);if(hash!==mirror)throw Error(JSON.stringify({hash,mirror})); console.log(JSON.stringify({p,valid:true,hash,mirror}));}'
 result['validation']=run('validation',[N,'--max-old-space-size=6144','-e',script])
(R/'result.json').write_text(json.dumps(result,indent=2))
