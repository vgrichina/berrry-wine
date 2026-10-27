import os,sys,pathlib,json,time,hashlib,subprocess,importlib.util,resource
H=pathlib.Path('/tmp/gta2-census-cleared-driving-oct27');O=H/'ops';R=H/'repo'
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
 else:raise RuntimeError(mode)
 save(mode+'-command.json',dict(argv=command,sha256=hashlib.sha256(json.dumps(command).encode()).hexdigest()))
 with (O/(mode+'.stdout')).open('xb') as out,(O/(mode+'.stderr')).open('xb') as err:
  p=subprocess.Popen(command,cwd=R,env=ENV,stdout=out,stderr=err)
  save(mode+'-start.json',dict(pid=p.pid,at=time.time(),pending=True))
  result=p.wait();save(mode+'-exit.json',dict(exit=result,at=time.time()))
 sys.exit(result)
assert time.time()<1793106480
spec=importlib.util.spec_from_file_location('s',O/'remote-supervisor.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
def check():
 total=sum((O/(MODE+'.'+x)).stat().st_size for x in ('stdout','stderr') if (O/(MODE+'.'+x)).exists())
 if total>4194304:return 'distinct-streams-output-limit'
 used=sum(p.lstat().st_blocks*512 for p in H.rglob('*') if p.is_file())
 if used+67108864>1073741824:return 'remote-disk-allocation'
r=s.supervise(['/usr/bin/python3',__file__,MODE+'-inner'],rss_limit=(6144 if compile_mode else 4096)*1048576,cpu_limit=180,wall_limit=240,output_limit=4194304,check=check)
output=r.pop('output');(O/(MODE+'.supervisor.log')).write_bytes(output);save(MODE+'-supervisor.json',r)
print(json.dumps({k:v for k,v in r.items() if k!='owned'}));sys.exit(0 if r['exit']==0 and not r['stopReason'] else 1)
