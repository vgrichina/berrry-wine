import sys,json,shutil,time,os
from pathlib import Path
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).parent));import diagnose as d,gitops as g
O=d.O
def alloc(p):
 seen=set();n=0
 for q in [p,*p.rglob('*')] if p.is_dir() else [p]:
  try:s=q.stat()
  except OSError:continue
  if (s.st_dev,s.st_ino) not in seen:seen.add((s.st_dev,s.st_ino));n+=s.st_blocks*512
 return n
def account(label):
 ext=d.ROOT/'scratch/usage-watch/madbomber-retained-launch-recovery-oct27'
 sessions=list(Path('/home/user/.codex/sessions/2026/10/27').glob('*'+os.getenv('CODEX_THREAD_ID','NONE')+'*'))
 wals=list(Path('/home/user/.codex').glob('*-wal'))
 baselinePath=Path('/tmp/madbomber-gameover-restart-gameplay-oct27/ops/wal-base.json')
 baseline=json.loads(baselinePath.read_text())
 # Earlier retained baseline predates this task: charge all positive current growth once.
 wal=sum(max(0,alloc(p)-baseline.get(str(p),0)) for p in wals)
 used=alloc(O.parent)+alloc(ext)+sum(alloc(p) for p in sessions)+wal
 j=dict(at=time.time(),taskBytes=alloc(O.parent),launcherBytes=alloc(ext),sessionBytes=sum(alloc(p) for p in sessions),WALPositiveGrowthOnce=wal,WALBaseline=str(baselinePath),WALBaselineSHA256=d.sha(baselinePath.read_bytes()),used=used,allocation=33554432,reserveAndFuture=8388608,pass_=used+8388608<=33554432)
 d.save(label+'.json',j);assert j['pass_'];d.gate(label)
account('accounting-before-publication')
p=O/'REPORT.md';s=p.read_text().replace('(including comma-bearing filenames)','(149 files enumerated; zero comma-bearing filenames)');p.write_text(s)
d.save('packaging-incidents.json',dict(incidents=['Initial verification dispatch had no matching handler and performed no checks; its no-op receipt retained, dispatcher corrected to reject unknown actions, then actual verifier run.', 'First real verifier incorrectly required a nonempty comma-bearing-file list; inspected immutable canonical receipt enumerates 149 files with zero commas. Corrected the report and exact receipt assertion; original failed check retained. No parser/runtime replay.', 'Initial publication accounting charged whole pre-existing shared WAL and stopped before Git. Corrected to positive growth once against immutable earlier retained baseline (predates this task); initial rejected accounting retained.']))
rel='docs/reviews/madbomber-retained-launch-recovery-oct27';dest=g.R/rel;dest.mkdir(parents=True)
for p in O.iterdir():
 if p.is_file():shutil.copyfile(p,dest/p.name)
shutil.copytree(O/'prior',dest/'prior')
rows={str(p.relative_to(dest)):dict(bytes=p.stat().st_size,sha256=d.sha(p.read_bytes())) for p in sorted(dest.rglob('*')) if p.is_file()}
(dest/'SHA256SUMS.json').write_text(json.dumps(rows,indent=2)+'\n')
for n,h in rows.items():assert d.sha((dest/n).read_bytes())==h['sha256']
assert json.loads((dest/'verification.json').read_text())['pass_']
assert g.git('rev-parse','HEAD')==g.BASE
g.git('diff','--check','--',rel);g.git('add','--sparse','--',rel);g.git('diff','--cached','--check')
tree=g.git('write-tree','--missing-ok');paths=g.git('diff-tree','--no-commit-id','--name-only','-r',g.BASE,tree).splitlines();assert paths and all(p.startswith(rel+'/') for p in paths)
g.git('commit','-m','Preserve MadBomber detached launch diagnosis and no-replay blocker')
commit=g.git('rev-parse','HEAD');assert g.git('rev-parse','HEAD^')==g.BASE and g.git('rev-parse','HEAD^{tree}')==tree
g.git('push','-u','origin','HEAD:refs/heads/'+g.BR)
remote=g.git('ls-remote','--heads','origin','refs/heads/'+g.BR);assert remote.split()==[commit,'refs/heads/'+g.BR]
d.save('publication.json',dict(branch=g.BR,commit=commit,tree=tree,remoteExact=remote,verified=True,force=False,mainMerged=False,evidence=rel,files=len(rows),manifestSHA256=d.sha((dest/'SHA256SUMS.json').read_bytes()),ssh=g.SSH))
account('accounting-final');print(json.dumps(json.loads((O/'publication.json').read_text()),indent=2))
