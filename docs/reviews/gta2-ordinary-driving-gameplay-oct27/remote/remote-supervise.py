import os,sys,pathlib,json,time,hashlib,resource,importlib.util,shlex,shutil
H=pathlib.Path('/tmp/gta2-ordinary-driving-gameplay-oct27');R=H/'runner';M=1048576
mode=sys.argv[1];assert mode in ('compile-startup','guest-startup','compile','guest')
assert time.time()<1793100240,'guest cutoff11:24UTC'
src=(H/'trusted-supervisor.py').read_bytes();assert hashlib.sha256(src).hexdigest()=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
# Derived remote-only supervisor changes requested CPU limit; local trusted helper is unchanged.
code=src.decode().replace('lower_limit(resource.RLIMIT_CPU, 90)','lower_limit(resource.RLIMIT_CPU, cpu_limit)')
sup=type(sys)('remote_supervisor');exec(compile(code,'trusted-supervisor-derived-remote','exec'),sup.__dict__)
node='/home/user/.nvm/versions/node/v24.22.1/bin/node';build=mode.startswith('compile');heap=4096 if build else 2048
os.environ.clear();os.environ.update(PATH=str(pathlib.Path(node).parent)+':/usr/bin:/bin',HOME='/home/user',LANG='C.UTF-8',LC_ALL='C.UTF-8',TZ='UTC',PYTHONDONTWRITEBYTECODE='1',NODE_OPTIONS='--max-old-space-size='+str(heap))
if mode.endswith('startup'):
 js="const fs=require('fs');console.log(JSON.stringify({execPath:process.execPath,version:process.version,execArgv:process.execArgv,env:process.env,limits:fs.readFileSync('/proc/self/limits','utf8'),pngjs:require.resolve('pngjs'),app:require('./lib/apps').APPS.gta2_demo,usage:process.memoryUsage()}));"
 cmd=[node,'-e',js]
 if mode=='guest-startup':cmd=[node,str(H/'startup.js')]
elif build:cmd=['/bin/bash','tools/build.sh']
else:cmd=[node,*json.loads((H/'guest-args.json').read_text())]
if mode=='compile':assert not (H/'canonical-compile-once.json').exists();(H/'canonical-compile-once.json').write_text(json.dumps(dict(at=time.time(),command=cmd)))
if mode=='guest':assert not (H/'guest-once.json').exists();(H/'guest-once.json').write_text(json.dumps(dict(at=time.time(),command=cmd)))
(H/'captures').mkdir(exist_ok=True)
out=H/(mode+'.stdout');err=H/(mode+'.stderr');out.touch(exist_ok=False);err.touch(exist_ok=False)
start=dict(at=time.time(),mode=mode,command=cmd,commandSHA256=hashlib.sha256(json.dumps(cmd).encode()).hexdigest(),environment=dict(os.environ),environmentSHA256=hashlib.sha256(json.dumps(dict(os.environ),sort_keys=True).encode()).hexdigest(),nodeSHA256=hashlib.sha256(pathlib.Path(node).read_bytes()).hexdigest(),inheritedLimits={n:resource.getrlimit(getattr(resource,'RLIMIT_'+n)) for n in ('DATA','AS','RSS','CPU','FSIZE')},resources=dict(physicalRSS=(6144 if build else 4096)*M,CPU=180,wall=240,FSIZE=24*M,output=4*M if build else 2*M),sourceRevision='4a2bec145ef34b0d084b96b09a682a16e89703fd',trustedSourceSHA256=hashlib.sha256(src).hexdigest(),remoteDerivedSHA256=hashlib.sha256(code.encode()).hexdigest())
(H/(mode+'-start.json')).write_text(json.dumps(start,indent=2))
os.chdir(R)
shell='exec '+shlex.join(cmd)+' >'+shlex.quote(str(out))+' 2>'+shlex.quote(str(err))
def check():
 used=sum(p.lstat().st_blocks*512 for p in H.rglob('*') if not p.is_symlink())
 if used+64*M>1024*M:return 'remote allocation including64MiB reserve'
 if time.time()>=1793100240:return 'guest cutoff'
 if out.stat().st_size+err.stat().st_size>(4 if build else 2)*M:return 'stdout/stderr output limit'
 if shutil.disk_usage(H).free<1024*M:return 'remote physical disk floor'
 return None
q=sup.supervise(['/bin/bash','-c',shell],rss_limit=(6144 if build else 4096)*M,cpu_limit=180,wall_limit=240,output_limit=(4 if build else 2)*M,check=check)
(H/(mode+'-supervisor-output')).write_bytes(q.pop('output'));(H/(mode+'-receipt.json')).write_text(json.dumps(q,indent=2));print(json.dumps({k:q[k] for k in ('exit','stopReason','peakRSS','cpuSeconds','wallSeconds','cleanupComplete')}))
if q['stopReason'] or q['exit']!=0 or not q['cleanupComplete']:raise SystemExit(1)
