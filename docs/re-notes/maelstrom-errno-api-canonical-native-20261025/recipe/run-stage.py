import pathlib,json,subprocess,sys,shlex
from api import put,py,call,REMOTE
O=pathlib.Path(__file__).resolve().parent
stage=sys.argv[1]
assert stage in ['cheap','compiler','native']
size=py('import pathlib,json;p=pathlib.Path('+repr(REMOTE)+');rows=[max(f.stat().st_size,f.stat().st_blocks*512) for f in p.rglob("*") if f.is_file()];print(json.dumps(dict(allocated=sum(rows),files=len(rows))))','remote-size')
(O/'remote-size.json').write_text(size['stdout'])
subprocess.run([sys.executable,str(O/'account.py'),'local-stage-admission.json'],check=True)
# Fresh immutable receipt per stage; the remote supervisor requires age <180 seconds.
rpath=REMOTE+'/ops/local-stage-admission.json'
py('import pathlib;p=pathlib.Path('+repr(rpath)+');p.unlink(missing_ok=True)','replace-stage-admission')
put(O/'local-stage-admission.json',rpath)
node='/home/user/.nvm/versions/node/v24.22.1/bin/node'
if stage=='compiler':argv=[node,'--max-old-space-size=2048','--require',REMOTE+'/ops/native-module-bound.cjs',REMOTE+'/repo/tools/maelstrom-errno-canonical-build.cjs']
else:argv=sys.argv[2:]
cmd=['python3',REMOTE+'/ops/supervise.py',stage,*argv]
if stage=='compiler':
 # APIexec detach/status is the documented long-lived route; no remote agent.
 p=subprocess.run(['boat','--json','exec', 'bx_k38z8byn','--detach','--',*cmd],capture_output=True,text=True,timeout=30)
 (O/'compiler-detach.json').write_text(p.stdout);(O/'compiler-detach.stderr').write_text(p.stderr);print(p.stdout+p.stderr);assert p.returncode==0
else:
 r=call(cmd,timeout=90,label=stage+'-dispatch');print(json.dumps(r))
