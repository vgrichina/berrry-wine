import os,sys,json,pathlib,hashlib,shutil,importlib.util,time
P=pathlib.Path; M=1048576
H=P(__file__).resolve().parent.parent; O=H/'ops'; ROOT=P('/home/user/wine-assembly')
S=P('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def size(p):
 if not p.exists():return 0
 return sum(q.lstat().st_blocks*512 for q in [p,*p.rglob('*')]) if p.is_dir() else p.lstat().st_blocks*512
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(65536),b''):h.update(b)
 return h.hexdigest()
W=P('/home/user/.codex/state_5.sqlite-wal'); base=O/'wal-baseline.json'
if not base.exists():base.write_text(json.dumps({'bytes':size(W)}))
charges={'task':size(H),'launcher':size(ROOT/'scratch/usage-watch'/H.name),'session':sum(size(p) for p in P('/home/user/.codex/sessions/2026/10/27').glob('*'+os.environ['CODEX_THREAD_ID']+'*')),'positiveWALOnce':max(0,size(W)-json.loads(base.read_text())['bytes'])}
measured=sum(charges.values()); peer=P('/tmp/alien-accepted-dispatch-menu-mission-oct27')
peerremaining=max(0,64*M-size(peer)-size(ROOT/'scratch/usage-watch'/peer.name))
projected=measured+32*M
free=shutil.disk_usage(H).free-max(0,60*M-measured)-peerremaining
mem=int(P('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
kind,name=sys.argv[1:3]; cmd=sys.argv[3:]
a=dict(timestamp=time.time(),charges=charges,projection=projected,allocation=60*M,sourceGitTempEvidence=28*M,sessionEventsPositiveWAL=16*M,publication=8*M,reserve=8*M,peerRemaining=peerremaining,projectedFree=free,floor=2982150144,memAvailable=mem,requiredFutureRAM=1610612736,standingSupervisor=str(S),standingSupervisorBytes=size(S))
a['pass']=projected<=60*M and free>=a['floor'] and mem>=a['requiredFutureRAM']
(O/('admission-'+name+'.json')).write_text(json.dumps(a,indent=2));assert a['pass'],a
assert sha(S)=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
os.environ.update(PYTHONDONTWRITEBYTECODE='1',GIT_NO_LAZY_FETCH='1',GIT_TERMINAL_PROMPT='0',GIT_SSH_COMMAND=SSH,PALETTE_BROWSER_BOOTSTRAP=str(os.getppid()))
spec=importlib.util.spec_from_file_location('supervisor',S);s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
r=s.supervise(cmd,rss_limit=(256 if kind=='git' else 128)*M,cpu_limit=90,wall_limit=120,output_limit=2*M)
out=r.pop('output');(O/(name+'.log')).write_bytes(out)
r.update(command=cmd,admission=a,inheritedLimits=P('/proc/self/limits').read_text(),limits={'physical':(256 if kind=='git' else 128)*M,'cpu':90,'wall':120,'file':24*M,'output':2*M,'excerpt':8192})
(O/(name+'.json')).write_text(json.dumps(r,indent=2));sys.stdout.buffer.write(out[:8192]);print('\nRECEIPT',name,r['exit'],r['stopReason'],r.get('peakAggregateRSS'))
cpath=O/'checkpoint.json';c=json.loads(cpath.read_text()) if cpath.exists() else {'candidate':'2b825a30d178a34aca28b50307d87049693ba529','groups':{},'remaining':['first unchanged production injection','independent races and mutants','normal full entry real Node','dependency audit','conditional merged checks/publication']}
c['groups'][name]={'receipt':str(O/(name+'.json')),'pass':r['exit']==0 and r['stopReason'] is None and r['cleanupComplete']}
if (H/'repo/test').exists():c['sourceFixtureHashes']={str(p.relative_to(H/'repo')):sha(p) for p in (H/'repo/test').rglob('*.py')}
t=cpath.with_suffix('.new');t.write_text(json.dumps(c,indent=2));os.replace(t,cpath)
raise SystemExit(1 if r['stopReason'] or not r['cleanupComplete'] else r['exit'] or 0)
