import sys,pathlib,json,time,shutil,subprocess,os,hashlib,base64
H=pathlib.Path(__file__).parent
O=H.parent
sys.path.insert(0,str(O))
import control as c
M=1048576
B=json.loads((H/'accounting-baseline.json').read_text())
def gate():
 own=c.size(O.parent)
 paths={B['launcher'],B['session'],c.A['launcher'],c.A['session']}
 events=sum(c.size(pathlib.Path(p)) for p in paths)
 wal=sum(max(0,pathlib.Path(p).stat().st_blocks*512-v) for p,v in B['walBaseline'].items())
 peng=c.size(pathlib.Path('/tmp/penguin-accepted-contract-main-integrate-oct27'))
 future=max(0,56*M-own-events-wal)+max(0,48*M-peng)
 free=shutil.disk_usage(H).free
 mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 q=dict(at=time.time(),own=own,events=events,positiveWalGrowth=wal,penguinMaterialized=peng,future=future,free=free,projected=free-future,floor=2982150144,memAvailable=mem,passDisk=free-future>=2982150144)
 (H/'accounting.json').write_text(json.dumps(q,indent=2)+'\n')
 if events+wal>8*M or own+events+wal+8*M>56*M or c.size(c.R)>24*M:return 'category allocation'
 if not q['passDisk']:return 'disk floor'
 if mem<1610612736:return 'physical floor'
c.gate=gate
def api(code,label,args=(),detach=False):
 assert gate() is None,gate()
 cmd=['/home/user/.ascii/boat','exec','--json']+(['--detach'] if detach else ['--timeout','15'])+['bx_yqcwfqqf']+(['python3','-B','-c',code,*args] if code else list(args))
 result=c.m.supervise(cmd,rss_limit=128*M,cpu_limit=90,wall_limit=120,output_limit=2*M,check=gate)
 output=result.pop('output');(H/(label+'.api.json')).write_bytes(output);(H/(label+'.supervisor.json')).write_text(json.dumps(result,indent=2)+'\n')
 assert result['exit']==0 and result['stopReason'] is None and result['cleanupComplete'],result
 q=json.loads(output)
 if not detach:
  (H/(label+'.stdout')).write_text(q.get('stdout',''));(H/(label+'.stderr')).write_text(q.get('stderr',''))
  assert q.get('exitCode')==0 and not q.get('stdoutTruncated') and not q.get('stderrTruncated'),q
  return q['stdout']
 return q
if __name__=='__main__':
 if sys.argv[1]=='git':
  env=os.environ.copy();env['GIT_SSH_COMMAND']=c.A['ssh'];env['GIT_NO_LAZY_FETCH']='1';env['GIT_OPTIONAL_LOCKS']='0'
  cmd=[sys.executable,'-B','/home/user/wine-assembly/scratch/usage-watch/light-execution-pool-oct26.py','--slots','2','--',sys.executable,'-B',__file__,'git-lock',*sys.argv[2:]]
  p=subprocess.run(cmd,env=env,capture_output=True,timeout=180);sys.stdout.buffer.write(p.stdout);sys.stderr.buffer.write(p.stderr);sys.exit(p.returncode)
 elif sys.argv[1]=='git-lock':
  import fcntl
  with open('/tmp/wine-ops-production-git.lock','a') as lock:
   fcntl.flock(lock,fcntl.LOCK_EX);assert gate() is None,gate()
   q=c.m.supervise([sys.executable,'-B',__file__,'git-child',*sys.argv[2:]],rss_limit=256*M,cpu_limit=90,wall_limit=120,output_limit=2*M,check=gate)
   b=q.pop('output');label='git-'+str(time.time_ns());(H/(label+'.log')).write_bytes(b);(H/(label+'.json')).write_text(json.dumps(q,indent=2)+'\n');sys.stdout.buffer.write(b)
   assert q['exit']==0 and q['stopReason'] is None and q['cleanupComplete'],q
 elif sys.argv[1]=='git-child':
  import resource
  resource.setrlimit(resource.RLIMIT_DATA,(512*M,512*M));os.execvp('git',['git','-C',str(c.R),*sys.argv[2:]])
 elif sys.argv[1]=='verify':
  code="""import pathlib,json,os,shutil
R=pathlib.Path('/home/user/airstrike-menu-quit-oct27');H=R/'evidence'
print(json.dumps(dict(running=True,root=str(R),paths={str(p):dict(exists=p.exists(),bytes=p.stat().st_size if p.exists() else None) for p in [R/'runner/test/run.js',R/'runner/build/wine-assembly.wasm',R/'game/airstrike-pre6a.exe',H/'bridge.py',H/'node-startup.json',H/'guest-process.json',H/'state.json',H/'terminal.json']},free=shutil.disk_usage(R).free,meminfo=[s for s in pathlib.Path('/proc/meminfo').read_text().splitlines() if s.startswith('MemAvailable:')],ownedProcesses=[dict(pid=p.parent.name,cmd=p.read_bytes().replace(b'\\0',b' ').decode(errors='replace')[:300]) for p in pathlib.Path('/proc').glob('[0-9]*/cmdline') if b'airstrike-menu-quit-oct27' in p.read_bytes() and p.parent.name!=str(os.getpid())])))
"""
  print(api(code,'retained-state'))
 elif sys.argv[1]=='api': print(api(sys.argv[2],sys.argv[3]))
 elif sys.argv[1]=='launch': print(api(None,'launch',('python3','-B','/home/user/airstrike-menu-quit-oct27/evidence/bridge.py','run'),True))
 elif sys.argv[1]=='state':
  previous=json.loads((H/'live-state.json').read_text()).get('frame') if (H/'live-state.json').exists() else None
  code="""import pathlib,time,json,base64
H=pathlib.Path('/home/user/airstrike-menu-quit-oct27/evidence');end=time.time()+10
while True:
 p=H/'state.json';q=json.loads(p.read_text()) if p.exists() else {};t=H/'terminal.json'
 if t.exists():q={'state':'terminal','terminal':json.loads(t.read_text())};break
 if q.get('frame') and q['frame']!=PREVIOUS:break
 assert time.time()<end,'state unavailable';time.sleep(.025)
if q.get('state')=='observation-required':
 b=(H/q['frame']).read_bytes();assert len(b)*4/3<950000;q['png']=base64.b64encode(b).decode()
print(json.dumps(q))
""".replace('PREVIOUS',repr(previous))
  q=json.loads(api(code,'state-'+str(time.time_ns())))
  if 'png' in q:(H/q['frame']).write_bytes(base64.b64decode(q.pop('png')))
  (H/'live-state.json').write_text(json.dumps(q,indent=2)+'\n');print(json.dumps(q))
 elif sys.argv[1]=='observe':
  q=json.loads((H/'live-state.json').read_text());v=json.loads(sys.argv[2]);v['after']=q['after'];v['evidence']=q['frame']+' sha256:'+q['sha256']+'; inspected actual capture and correlated snapshot'
  o={'observation':v};(H/(q['frame']+'.observation.json')).write_text(json.dumps(o,indent=2)+'\n')
  code='import pathlib;pathlib.Path('+repr('/home/user/airstrike-menu-quit-oct27/evidence/'+q['frame']+'.observation.json')+').write_text('+repr(json.dumps(o))+');print("delivered")'
  print(api(code,'observe-'+q['frame']))
