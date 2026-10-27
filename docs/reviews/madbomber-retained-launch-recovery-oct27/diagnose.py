import sys,os,json,time,hashlib,shutil,subprocess,importlib.util
from pathlib import Path
sys.dont_write_bytecode=True
O=Path(__file__).parent
ROOT=Path('/home/user/wine-assembly')
def save(n,v): (O/n).write_text(json.dumps(v,indent=2)+'\n')
def sha(b): return hashlib.sha256(b).hexdigest()
def gate(label):
 free=shutil.disk_usage(O).free
 mem=int(Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 j=dict(at=time.time(),free=free,memAvailable=mem,activeFuture=150994944,newTask=33554432,projectedFree=free-150994944-33554432,floor=2982150144,memoryRequired=2281701376)
 j['pass']=j['projectedFree']>=j['floor'] and mem>=j['memoryRequired'];save('admission-'+label+'.json',j);assert j['pass'],j
def capture(label,argv):
 gate(label)
 with (O/(label+'.stdout')).open('xb') as out,(O/(label+'.stderr')).open('xb') as err:
  start=time.time()
  try:
   p=subprocess.run(argv,stdout=out,stderr=err,timeout=55);code=p.returncode
  except subprocess.TimeoutExpired: code='timeout'
 save(label+'.json',dict(argv=argv,start=start,end=time.time(),exitStatus=code,stdout=dict(bytes=(O/(label+'.stdout')).stat().st_size,sha256=sha((O/(label+'.stdout')).read_bytes())),stderr=dict(bytes=(O/(label+'.stderr')).stat().st_size,sha256=sha((O/(label+'.stderr')).read_bytes()))))
 print(label,code)
def supervise(args):
 p=Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
 assert sha(p.read_bytes())=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
 s=importlib.util.spec_from_file_location('sup',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
 r=m.supervise([sys.executable,str(Path(__file__)),*args],rss_limit=134217728,cpu_limit=90,wall_limit=120,output_limit=2097152)
 b=r.pop('output');save(args[0]+'-supervision.json',r);(O/(args[0]+'-supervision.log')).write_bytes(b);print(b.decode()[:8192]);assert not r['stopReason'] and r['exit']==0
if __name__=='__main__':
 if sys.argv[1]=='supervise':supervise(sys.argv[2:])
 elif sys.argv[1]=='verify':
  import finish
  finish.check()
 elif sys.argv[1]=='help':
  capture('exec-help',['/home/user/.ascii/boat','exec','--help'])
  capture('info-help',['/home/user/.ascii/boat','info','--help'])
 elif sys.argv[1]=='remote-readonly':
  code='''from pathlib import Path
import os,json,hashlib,time
p=Path('/home/user/madbomber-restart-oct27')
names=['supervisor.py','controller.js','remote-run.py','environment.json','pre-guest.json','startup-supervision.json','run-supervision.json','run-supervision.log']
files={}
for n in names:
 f=p/n
 if f.exists():
  b=f.read_bytes();files[n]={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
  if n in ['environment.json','run-supervision.json','run-supervision.log']:files[n]['text']=b[:8192].decode(errors='replace')
procs=[]
for q in Path('/proc').glob('[0-9]*'):
 try:
  c=q.joinpath('cmdline').read_bytes()
  if b'madbomber-restart-oct27' in c and b'python3\\x00-c' not in c:procs.append({'pid':int(q.name),'cmd':c.decode(errors='replace')[:1024]})
 except OSError:pass
dirs={}
for root in ['/tmp','/home/user/.ascii','/home/user/.local/state','/var/log']:
 d=Path(root)
 if d.is_dir():dirs[root]=[{'name':f.name,'dir':f.is_dir()} for f in d.iterdir() if any(t in f.name.lower() for t in ['boat','exec','command','log'])][:80]
print(json.dumps({'at':time.time(),'files':files,'outExists':(p/'out').exists(),'processes':procs,'directories':dirs,'allocated':sum(f.stat().st_blocks*512 for f in p.rglob('*')),'memAvailable':int(Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024}))
'''
  capture('remote-readonly',['/home/user/.ascii/boat','exec','--json','--timeout','30','bx_auvzp2av','python3','-c',code])
 elif sys.argv[1]=='remote-log-index':
  code='''from pathlib import Path
import json,time
roots=['/home/user/.boat','/home/user/.ascii','/home/user/.local/share/boat','/home/user/.local/state/boat','/tmp/.boat','/tmp/boat','/tmp/boat-exec','/var/lib/boat','/run/boat','/var/log/boat']
rows=[]
for n in roots:
 p=Path(n);r={'path':n,'exists':p.exists()}
 if p.is_dir():r['entries']=[{'name':q.name,'dir':q.is_dir(),'bytes':q.stat().st_size} for q in p.iterdir()][:80]
 rows.append(r)
print(json.dumps({'at':time.time(),'locations':rows}))
'''
  capture('remote-log-index',['/home/user/.ascii/boat','exec','--json','--timeout','30','bx_auvzp2av','python3','-c',code])
 elif sys.argv[1]=='remote-state-index':
  code='''from pathlib import Path
import json,time
p=Path('/home/user/.ascii/state')
rows=[]
for q in p.iterdir():
 r={'name':q.name,'dir':q.is_dir(),'bytes':q.stat().st_size}
 if q.is_dir() and any(x in q.name.lower() for x in ['exec','command','log','process']):r['entries']=[{'name':f.name,'bytes':f.stat().st_size,'dir':f.is_dir()} for f in q.iterdir()][:80]
 rows.append(r)
print(json.dumps({'at':time.time(),'stateIndex':rows}))
'''
  capture('remote-state-index',['/home/user/.ascii/boat','exec','--json','--timeout','30','bx_auvzp2av','python3','-c',code])
 elif sys.argv[1]=='preserve':
  prior=Path('/tmp/madbomber-gameover-restart-gameplay-oct27/ops');names=['guest-launch.json','guest-launch-empty-stdout.txt','launch-failure-readonly-check.json','result.json','evidence-manifest.json','publication.json','remote-configuration.json','startup-receipt.json','box-handback.json']
  dest=O/'prior';dest.mkdir();rows=[]
  for n in names:
   b=(prior/n).read_bytes();(dest/n).write_bytes(b);rows.append(dict(path=str(prior/n),bytes=len(b),sha256=sha(b)))
  save('preserved-prior.json',rows)
  events=ROOT/'scratch/usage-watch/madbomber-gameover-restart-gameplay-oct27/events.jsonl'
  selected=[]
  for line in events.open():
   if any(x in line for x in ['--detach','guest-launch','launch-failure-readonly-check']):selected.append(json.loads(line))
  save('prior-launch-events.json',selected)
  print('preserved',len(rows),'files;',len(selected),'event records')
 else:raise SystemExit('unknown diagnostic action')
