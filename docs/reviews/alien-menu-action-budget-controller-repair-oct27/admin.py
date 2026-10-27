import sys,pathlib,os,json,hashlib,shutil,time,subprocess,resource,fcntl
sys.dont_write_bytecode=True
H=pathlib.Path('/tmp/alien-menu-action-budget-controller-repair-oct27');O=H/'ops';R=H/'repo';ROOT=pathlib.Path('/home/user/wine-assembly');DONOR=pathlib.Path('/tmp/alien-dispatch-boundary-independent-publication-oct27/repo');BR='task/'+H.name
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def save(n,j):
 p=O/n;t=p.with_name(p.name+'.new');t.write_text(json.dumps(j,indent=2)+'\n');os.replace(t,p)
def sha(p):return hashlib.file_digest(p.open('rb'),'sha256').hexdigest()
def alloc(p):
 return sum(q.lstat().st_blocks*512 for q in ([p,*p.rglob('*')] if p.is_dir() else [p]) if q.exists())
def json_safe_owned(p):
 try:return str(H) in p.read_text()
 except (OSError,UnicodeError):return False
def gate(stage='gate'):
 wals=list(pathlib.Path('/home/user/.codex').glob('*-wal'));b=O/'wal-baseline.json'
 if not b.exists():save(b.name,{str(p):alloc(p) for p in wals})
 baseline=json.loads(b.read_text());wal=sum(max(0,alloc(p)-baseline.get(str(p),0)) for p in wals)
 session=sum(alloc(p) for p in pathlib.Path('/home/user/.codex/sessions/2026/10/27').glob('*'+os.environ.get('CODEX_THREAD_ID','NONE')+'*'))
 registry=pathlib.Path('/tmp/wine-ops-alien-menu-owners-'+str(os.getuid()));registry_files=list(registry.glob('*')) if registry.exists() else [];registry_bytes=(registry.lstat().st_blocks*512 if registry.exists() else 0)+sum(alloc(p) for p in registry_files if p.is_file() and json_safe_owned(p))
 actual=dict(task=alloc(H),processOwnershipReceipts=registry_bytes,launcher=alloc(ROOT/'scratch/usage-watch'/H.name)+sum(alloc(p) for p in (ROOT/'scratch/usage-watch').glob(H.name+'*') if p.is_file()),session=session,positiveWAL=wal)
 used=sum(actual.values());remaining=max(8388608,46137344-used);free=shutil.disk_usage(H).free;mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 peer=pathlib.Path('/tmp/enigma-process-ownership-controller-repair-oct27');peer_used=alloc(peer)+alloc(ROOT/'scratch/usage-watch'/peer.name)+sum(alloc(p) for p in (ROOT/'scratch/usage-watch').glob(peer.name+'*') if p.is_file());peer_remaining=max(8388608,37748736-peer_used)
 j=dict(at=time.time(),stage=stage,actual=actual,used=used,allocation=46137344,ownRemaining=remaining,peerFuture=peer_remaining,peerMeasuredLowerBound=peer_used,peerAllocation=37748736,free=free,projectedFree=free-remaining-peer_remaining,floor=2982150144,memAvailable=mem,requiredMemory=1610612736,clientAllowance=335544320,testTreeCap=134217728)
 save('admission-'+stage+'.json',j);assert used+8388608<=46137344 and j['projectedFree']>=j['floor'] and mem>=j['requiredMemory'],j
sys.path.insert(0,'/tmp/enigma-retained-canonical-native-msg-qualification-oct26/ops')
import common as c
c.H=H;c.O=O;c.R=R;c.gate=gate

_git_sequence = 0
def git(*a):
 global _git_sequence
 _git_sequence += 1
 cmd=['git','-c','gc.auto=0','-c','pack.threads=1','-c','pack.window=0','-C',str(R),*a]
 raw=c.supervised(cmd,True,'git-'+str(os.getpid())+'-'+str(_git_sequence),str(R))
 with (O/'git.jsonl').open('a') as f:f.write(json.dumps(dict(argv=cmd,out=raw.decode(),supervision='direct Git child DATA512MiB, whole process tree physical256MiB; pool2 then Gitflock'))+'\n')
 return raw.decode().strip()
if __name__=='__main__':
 mode=sys.argv[1]
 if mode=='setup':
  gate('before-checkout')
  a=json.loads((ROOT/'scratch/usage-watch/alien-menu-action-budget-controller-repair-oct27-admission.json').read_text())
  for pin in a['pins']:assert sha(pathlib.Path(pin['path']))==pin['sha256']
  assert json.loads(pathlib.Path('/tmp/alien-accepted-dispatch-menu-mission-oct27/ops/trusted-ssh-config.json').read_text())['command']==SSH
  save('configuration.json',dict(ssh=SSH,mountArgv=[],intendedMountFiles=[],mounts='offline HTTP only; no guest/mount invocation',pins=a['pins'],rootRefReceipt=json.loads((ROOT/'scratch/usage-watch'/H.name/'root-ref-digest.json').read_text())))
  R.mkdir();git('init','-b',BR);git('config','user.name','Wine Ops');git('config','user.email','wine-ops@users.noreply.github.com');git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git');git('fetch','--no-tags',str(DONOR),'ca6c2deddcda40d5c89deb2feb1a4fcf1e711f6b');git('config','core.sparseCheckout','true')
  (R/'.git/info/sparse-checkout').write_text('/test/alien-gameplay-sequence.py\n/test/helpers/alien-control-sequence.py\n/tools/alien-menu-gameplay-controller.py\n/test/fixtures/alien-menu-controller/\n/docs/reviews/'+H.name+'/\n')
  git('checkout','-B',BR,'FETCH_HEAD');save('base.json',dict(commit=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}')))
 elif mode=='test':c.supervised([sys.executable,*sys.argv[3:]],False,sys.argv[2],str(R))
 elif mode=='git':gate(sys.argv[2]);print(git(*sys.argv[3:]))
