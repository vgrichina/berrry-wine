import os,sys,pathlib,json,hashlib,resource,time,fcntl,importlib.util,shutil
O=pathlib.Path(__file__).resolve().parent; T=O.parent; R=T/'repo'
P=pathlib.Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
assert hashlib.sha256(P.read_bytes()).hexdigest()=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
s=importlib.util.spec_from_file_location('trusted',P);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
mode=sys.argv[1];cmd=sys.argv[2:];tag=str(time.time_ns()); out=O/(tag+'.stdout');err=O/(tag+'.stderr')
ssh='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
os.environ['GIT_SSH_COMMAND']=ssh;os.environ['GIT_CONFIG_NOSYSTEM']='1';os.environ['GIT_CONFIG_GLOBAL']='/dev/null';os.environ['PYTHONDONTWRITEBYTECODE']='1'
os.environ['RICOCHET_ACCEPT_OPS']=str(O)
(O/'fixtures').mkdir(exist_ok=True)
os.environ['TMPDIR']=str(O/'fixtures')
mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
free=shutil.disk_usage(T).free
events=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/ricochet-final-inventory-writer-contract-repair-oct27')
wal=pathlib.Path('/home/user/.codex/state_5.sqlite-wal')
wal_charge=wal.stat().st_blocks*512 if wal.exists() else 0
used=sum(p.lstat().st_blocks*512 for p in T.rglob('*'))+sum(p.lstat().st_blocks*512 for p in events.rglob('*'))+wal_charge
fleet=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/ricochet-final-inventory-writer-contract-repair-oct27-admission.json').read_text())
clients=[];future=0
for worker in fleet.get('workers',[]):
 pp=pathlib.Path('/proc')/str(worker['clientPID'])
 if pp.exists():
  actual=(pp/'cmdline').read_bytes().rstrip(b'\0').split(b'\0')
  assert actual==[a.encode() for a in worker['argv']], 'client identity changed'
  rss=int((pp/'status').read_text().split('VmRSS:')[1].split()[0])*1024
  clients.append(dict(pid=worker['clientPID'],rss=rss))
 elif not (events.parent/worker['task']/'result.json').exists():future+=335544320
required=805306368+268435456+future
ephemeral_reserve=0 if mode=='git' else 24*1048576
record=dict(command=cmd,mode=mode,at=time.time(),cwd=str(pathlib.Path.cwd()),envHash=hashlib.sha256(json.dumps(dict(os.environ),sort_keys=True).encode()).hexdigest(),ssh=ssh,inheritedLimits={n:resource.getrlimit(getattr(resource,n)) for n in ['RLIMIT_DATA','RLIMIT_AS','RLIMIT_CPU','RLIMIT_FSIZE']},memAvailable=mem,free=free,used=used,clientsAlreadyInMemAvailable=clients,futureClients=future,required=required,walCharge=wal_charge,walBaseline='unknown: charge entire current WAL once, conservative',pythonSHA256=hashlib.sha256(pathlib.Path(sys.executable).read_bytes()).hexdigest(),supervisorSHA256=hashlib.sha256(P.read_bytes()).hexdigest())
(O/(tag+'.command.json')).write_text(json.dumps(record,indent=2))
assert mem>=required, 'fresh physical admission'
assert used+40*1048576<=128*1048576 and free-(128*1048576-used)>=2982150144,'disk admission'
assert used+ephemeral_reserve+40*1048576<=128*1048576,'unnamed publisher staging reserve'
lock=None
if mode=='git':
 lock=open('/tmp/wine-ops-production-git.lock','a');fcntl.flock(lock,fcntl.LOCK_EX)
 os.environ['RICOCHET_GIT_LIMIT_RECEIPT']=str(O/(tag+'.git-limits.json'))
 cmd=[sys.executable,'-S',str(O/'git-child.py'),*cmd]
# Redirection before exec preserves separate streams even on failed creation/setup.
argv=['bash','-c','exec "$@" >"'+str(out)+'" 2>"'+str(err)+'"','capture',*cmd]
def check():
 if sum(p.stat().st_size for p in (out,err) if p.exists())>2097152:return 'combined output limit'
 source=sum(p.lstat().st_blocks*512 for p in R.rglob('*'))
 ops=sum(p.lstat().st_blocks*512 for p in O.rglob('*'))+(wal.stat().st_blocks*512 if wal.exists() else 0)
 event_bytes=sum(p.lstat().st_blocks*512 for p in events.rglob('*'))
 if source>20*1048576 or ops+ephemeral_reserve>52*1048576 or event_bytes>16*1048576:return 'task allocation bucket'
 current=source+ops+event_bytes+ephemeral_reserve
 if current+40*1048576>128*1048576:return 'task allocation reserve'
 future_disk=max(0,128*1048576-current)+16*1048576
 future_disk=max(future_disk,fleet.get("futureDiskConservative",469762048))
 for worker in fleet.get('workers',[]):
  if worker['task']==T.name:continue
  peer=pathlib.Path('/tmp')/worker['task'];ev=events.parent/worker['task']
  actual=sum(p.lstat().st_blocks*512 for root in (peer,ev) if root.exists() for p in root.rglob('*'))
  future_disk+=max(0,128*1048576-actual)
 if shutil.disk_usage(T).free-future_disk<2982150144:return 'host disk floor'
r=m.supervise(argv,rss_limit=(256 if mode=='git' else 128)*1048576,cpu_limit=90,wall_limit=120,output_limit=2097152,check=check)
r['output']=r['output'].decode('utf8','replace');r.update(stdout=str(out),stderr=str(err),commandReceipt=tag+'.command.json')
(O/(tag+'.result.json')).write_text(json.dumps(r,indent=2))
print(json.dumps(dict(receipt=tag,exit=r['exit'],reason=r['stopReason'],cleanup=r['cleanupComplete'],peakRSS=r['peakRSS'])))
remaining=7500
for p in (out,err):
 b=p.read_bytes();visible=b[:remaining];remaining-=len(visible)
 print(p.name+':\n'+visible.decode('utf8','replace'))
assert sum(p.stat().st_size for p in (out,err))<=2097152
sys.exit(1 if r['stopReason'] or not r['cleanupComplete'] else r['exit'] or 0)
