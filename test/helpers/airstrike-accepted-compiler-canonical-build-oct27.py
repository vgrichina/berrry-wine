import os,sys,pathlib,json,hashlib,resource,importlib.util,time,subprocess,shutil
R=pathlib.Path(__file__).resolve().parent;P=R/'repo';O=R/'outputs';O.mkdir(exist_ok=True)
NODE=shutil.which('node');assert NODE
ENV={'PATH':str(R/'bin')+':'+str(pathlib.Path(NODE).parent)+':/usr/local/bin:/usr/bin:/bin','HOME':'/home/user','LANG':'C.UTF-8','TZ':'UTC','GIT_NO_LAZY_FETCH':'1','GIT_OPTIONAL_LOCKS':'0','GIT_TERMINAL_PROMPT':'0','WINE_WAT_FRONTEND_REUSE':'1'}
marker=os.environ.get('PALETTE_BROWSER_SUPERVISED','');os.environ.clear();os.environ.update(ENV,PALETTE_BROWSER_SUPERVISED=marker)
if sys.argv[1]=='child':
 label=sys.argv[2];cmd=sys.argv[3:]
 with (O/(label+'.stdout')).open('wb') as out,(O/(label+'.stderr')).open('wb') as err:
  try:r=subprocess.run(cmd,cwd=P,stdout=out,stderr=err)
  except Exception as e:err.write((repr(e)+'\n').encode());sys.exit(125)
 sys.exit(r.returncode)
assert hashlib.sha256((R/'supervisor.py').read_bytes()).hexdigest()=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
spec=importlib.util.spec_from_file_location('supervisor',R/'supervisor.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
def run(label,cmd):
 def check():
  if sum(p.stat().st_size for p in O.glob(label+'.std*'))>2*1024**2:return 'distinct output cap'
  if time.time()>1793137500:return '21:45 cutoff'
 r=s.supervise([sys.executable,__file__,'child',label,*cmd],rss_limit=10*1024**3,cpu_limit=90,wall_limit=120,output_limit=2*1024**2,check=check)
 (O/(label+'.supervisor-output')).write_bytes(r.pop('output'));(O/(label+'.json')).write_text(json.dumps(r,indent=2));assert r['exit']==0 and r['stopReason'] is None and r['cleanupComplete'],(label,r)
 return r
manifest=json.loads((R/'source-manifest.json').read_text())
for f in manifest['files']:
 b=(P/f['path']).read_bytes();assert len(b)==f['bytes'] and hashlib.sha256(b).hexdigest()==f['sha256'],f['path']
mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
cg=pathlib.Path('/sys/fs/cgroup')/pathlib.Path('/proc/self/cgroup').read_text().strip().split(':')[-1].lstrip('/');rows=[]
while str(cg).startswith('/sys/fs/cgroup'):
 mx=(cg/'memory.max').read_text().strip() if (cg/'memory.max').exists() else 'max';cur=int((cg/'memory.current').read_text()) if (cg/'memory.current').exists() else 0;rows.append(dict(path=str(cg),maximum=mx,current=cur));cg=cg.parent
pre=dict(at=time.time(),location=str(R),hostname=os.uname().nodename,memAvailable=mem,freeDisk=shutil.disk_usage(R).free,cgroups=rows,limits=pathlib.Path('/proc/self/limits').read_text(),environment=ENV,sourceHead=manifest['head'],sourceFiles=len(manifest['files']),node=NODE,command=['bash','tools/build.sh'],limitsRequested=dict(rss=10*1024**3,cpu=90,wall=120,file=24*1024**2,output=2*1024**2),wholeInvocationCPUCompleteness='UNKNOWN')
(O/'preflight.json').write_text(json.dumps(pre,indent=2));assert mem>11*1024**3 and pre['freeDisk']>1024**3+512*1024**2;assert all(x['maximum']=='max' or int(x['maximum'])-x['current']>11*1024**3 for x in rows)
code='const fs=require("fs"),c=require("crypto");console.log(JSON.stringify({exec:process.execPath,version:process.version,flags:process.execArgv,environment:process.env,limits:fs.readFileSync("/proc/self/limits","utf8"),sha256:c.createHash("sha256").update(fs.readFileSync(process.execPath)).digest("hex")}))'
run('node-startup',[NODE,'-e',code])
run('build',['bash','tools/build.sh'])
for name in ['wine-assembly.wasm','wine-assembly.compat.wasm']:
 code='const fs=require("fs"),c=require("crypto");const b=fs.readFileSync('+json.dumps('build/'+name)+');if(!WebAssembly.validate(b))throw Error("validation failed");const m=new WebAssembly.Module(b);console.log(JSON.stringify({bytes:b.length,sha256:c.createHash("sha256").update(b).digest("hex"),valid:true,imports:WebAssembly.Module.imports(m),exports:WebAssembly.Module.exports(m)}))'
 run(name+'-validation',[NODE,'-e',code]);shutil.copyfile(P/'build'/name,O/name)
(O/'complete.json').write_text(json.dumps(dict(build='PASS unchanged trusted CPU90/wall120',bothModules='VALIDATED',wholeInvocationCPUCompleteness='UNKNOWN',historicalCPU=105.48018,historicalDecision='REJECTED; old modules UNQUALIFIED')))
