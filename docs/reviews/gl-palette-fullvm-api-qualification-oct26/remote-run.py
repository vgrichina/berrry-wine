import os,pathlib,subprocess,resource,json,time,selectors,hashlib,shutil
HERE=pathlib.Path(__file__).parent;os.chdir(HERE)
NODE='/home/user/.nvm/versions/node/v24.22.1/bin/node'
ARGV=[NODE,'--max-old-space-size=2048','--require','./capture.cjs']
ENV=dict(os.environ,NODE_OPTIONS='',TMPDIR=str(HERE))
def limit():
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
def mem():return int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
admit=dict(memAvailable=mem(),diskFree=shutil.disk_usage(HERE).free,heap=2147483648,moduleArena=536870912,client=268435456,compileOverhead=536870912,floor=1073741824)
admit['required']=sum(admit[k] for k in ['heap','moduleArena','client','compileOverhead','floor'])
assert admit['memAvailable']>=admit['required'],admit
pathlib.Path('remote-admission.json').write_text(json.dumps(admit,indent=2)+'\n')
startup='console.log(JSON.stringify({execPath:process.execPath,version:process.version,argv:process.execArgv,env:{NODE_OPTIONS:process.env.NODE_OPTIONS,TMPDIR:process.env.TMPDIR,PATH:process.env.PATH},limits:require("fs").readFileSync("/proc/self/limits","utf8"),rss:process.memoryUsage().rss}))'
if '--startup' in __import__('sys').argv:
 p=subprocess.run(ARGV+['-e',startup],env=ENV,preexec_fn=limit,capture_output=True,timeout=120)
 pathlib.Path('node-startup.json').write_bytes(p.stdout);assert p.returncode==0,(p.returncode,p.stderr)
 print(p.stdout.decode());raise SystemExit
assert pathlib.Path('node-startup.json').is_file()
cmd=ARGV+['test/test-d3dim-palette-alpha-page-watch.js'];start=time.monotonic()
p=subprocess.Popen(cmd,env=ENV,preexec_fn=limit,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
s=selectors.DefaultSelector();s.register(p.stdout,selectors.EVENT_READ);count=peak=0;minmem=mem();failure=None
with open('test.log','wb') as f:
 while s.get_map():
  if time.monotonic()-start>120:failure='wall120';p.kill()
  if count>2097152:failure='output2MiB';p.kill()
  try:peak=max(peak,int(pathlib.Path('/proc/'+str(p.pid)+'/status').read_text().split('VmRSS:')[1].split()[0])*1024)
  except (OSError,IndexError):pass
  minmem=min(minmem,mem())
  for key,_ in s.select(.1):
   b=os.read(key.fileobj.fileno(),8192)
   if not b:s.unregister(key.fileobj);continue
   count+=len(b)
   if count<=2097152:f.write(b)
code=p.wait();log=pathlib.Path('test.log').read_bytes()
receipt=dict(command=cmd,env={k:ENV[k] for k in ['NODE_OPTIONS','TMPDIR','PATH']},exit=code,elapsedSeconds=time.monotonic()-start,peakRSS=peak,minMemAvailable=minmem,outputBytes=count,logSHA256=hashlib.sha256(log).hexdigest(),limitFailure=failure,pass_=code==0 and failure is None and b'PASS full-VM palette-alpha' in log)
pathlib.Path('test-result.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt));print(log[-8192:].decode(errors='replace'))
raise SystemExit(code or bool(failure))
