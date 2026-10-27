import os,sys,pathlib,json,time,hashlib,subprocess,importlib.util,resource
H=pathlib.Path('/tmp/gta2-compressed-retained-staging-driving-oct27');O=H/'ops';R=H/'repo'
MODE=sys.argv[1];compile_mode=MODE.startswith('build');heap=4096 if compile_mode else 2048
NODE='/home/user/.nvm/versions/node/v24.22.1/bin/node'
ENV={'HOME':'/home/user','PATH':str(pathlib.Path(NODE).parent)+':/usr/local/bin:/usr/bin:/bin','LANG':'C.UTF-8','TZ':'UTC','PYTHONDONTWRITEBYTECODE':'1','NODE_OPTIONS':'--max-old-space-size='+str(heap)}
def save(n,v):(O/n).write_text(json.dumps(v,indent=2)+'\n')
def digest(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
if MODE.endswith('-inner'):
 mode=MODE[:-6]
 save(mode+'-startup-environment.json',dict(at=time.time(),cwd=str(R),env=ENV,envSHA256=hashlib.sha256(json.dumps(ENV,sort_keys=True).encode()).hexdigest(),nodeSHA256=digest(NODE),nodeVersion=subprocess.check_output([NODE,'--version'],env=ENV).decode().strip(),limits=pathlib.Path('/proc/self/limits').read_text(),nodeOptions=ENV['NODE_OPTIONS']))
 if mode.endswith('startup'):
  command=[NODE,'-e','console.log(JSON.stringify({ok:true,version:process.version,execPath:process.execPath,heap:require("v8").getHeapStatistics().heap_size_limit,limits:require("fs").readFileSync("/proc/self/limits","utf8")}))']
 elif mode=='build':command=['/bin/bash','tools/build.sh']
 elif mode=='build-continuation':
  source=(R/'tools/build.sh').read_bytes();assert hashlib.sha1(b'blob '+str(len(source)).encode()+b'\0'+source).hexdigest()=='5407cb296ee6cdab2e30a226d1188206beb852af'
  marker=b'node tools/toyvm/bundle-browser.js --check\n';assert source.count(marker)==1
  suffix=source[source.index(marker):];assert not (R/'build/wine-assembly.wasm').exists()
  save('build-continuation-suffix.json',dict(sourceSHA256=hashlib.sha256(source).hexdigest(),suffixSHA256=hashlib.sha256(suffix).hexdigest(),resumeCommand=marker.decode().strip(),compilerInvocationsBefore=0))
  command=['/bin/bash','-e','-c',suffix.decode()]
 elif mode=='preflight':command=[NODE,str(O/'preflight.js')]
 elif mode=='guest':command=[NODE,'test/run.js','--app=gta2_demo','--no-build','--control-stdin','--frozen','--batch-size=1000','--max-batches=200000','--max-seconds=230','--quiet-api','--quiet-blocks','--dx-slot=7','--trace-input']
 else:raise RuntimeError(mode)
 save(mode+'-command.json',dict(argv=command,sha256=hashlib.sha256(json.dumps(command).encode()).hexdigest()))
 with (O/(mode+'.stdout')).open('xb') as out,(O/(mode+'.stderr')).open('xb') as err:
  p=subprocess.Popen(command,cwd=R,env=ENV,stdout=out,stderr=err,stdin=subprocess.PIPE if mode=='guest' else subprocess.DEVNULL)
  save(mode+'-start.json',dict(pid=p.pid,at=time.time(),pending=True))
  if mode=='guest':
   offset=0;pending=None;seen=set();deadline=time.monotonic()+232
   while p.poll() is None and time.monotonic()<deadline:
    if pending is None:
     requests=sorted((O/'control').glob('*.request.json')) if (O/'control').exists() else []
     for request in requests:
      if request.name in seen:continue
      cmd=json.loads(request.read_text());pending=cmd['id'];seen.add(request.name);p.stdin.write((json.dumps(cmd)+'\n').encode());p.stdin.flush();save('control/'+str(pending)+'.dispatch.json',dict(command=cmd,at=time.time(),pid=p.pid));break
    with (O/'guest.stdout').open('rb') as reader:
     reader.seek(offset)
     while True:
      line=reader.readline()
      if not line or not line.endswith(b'\n'):break
      offset=reader.tell()
      if line.startswith(b'[ctl] '):
       reply=json.loads(line[6:]);save('control/'+str(reply.get('id'))+'.reply.json',dict(reply=reply,at=time.time()));assert reply.get('id')==pending;pending=None
    time.sleep(.02)
   if p.poll() is None:p.terminate()
   result=p.wait(timeout=5);save('guest-controller-terminal.json',dict(exit=result,pending=pending,seen=sorted(seen),at=time.time()))
  else:result=p.wait()
  save(mode+'-exit.json',dict(exit=result,at=time.time()))
 sys.exit(result)
assert time.time()<1793106480
spec=importlib.util.spec_from_file_location('s',O/'remote-supervisor.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
def check():
 total=sum((O/(MODE+'.'+x)).stat().st_size for x in ('stdout','stderr') if (O/(MODE+'.'+x)).exists())
 if total>4194304:return 'distinct-streams-output-limit'
 used=sum(p.lstat().st_blocks*512 for p in H.rglob('*') if p.is_file())
 if used+67108864>1073741824:return 'remote-disk-allocation'
cpu=180;wall=240;output=4194304
if MODE=='build-continuation':
 previous=json.loads((O/'build-supervisor.json').read_text());assert previous['exit']!=0 and previous['stopReason'] is None
 cpu-=previous['cpuSeconds'];wall-=previous['wallSeconds'];output-=sum((O/('build.'+x)).stat().st_size for x in ('stdout','stderr'));save('build-remaining-budget.json',dict(cpu=cpu,wall=wall,output=output,originalCPU=180,originalWall=240,originalOutput=4194304))
r=s.supervise(['/usr/bin/python3',__file__,MODE+'-inner'],rss_limit=(6144 if compile_mode else 4096)*1048576,cpu_limit=cpu,wall_limit=wall,output_limit=output,check=check)
output=r.pop('output');(O/(MODE+'.supervisor.log')).write_bytes(output);save(MODE+'-supervisor.json',r)
print(json.dumps({k:v for k,v in r.items() if k!='owned'}));sys.exit(0 if r['exit']==0 and not r['stopReason'] else 1)
