"""Scoped private-branch publication; never modifies shared refs/index/worktree."""
import hashlib
import json
import shutil
from pathlib import Path
from guard import H, ROOT, EXT, run

session = next(Path('/home/user/.codex/sessions/2026/10/23').glob('*01a16802*.jsonl'))
def size(p):
    return sum(f.stat().st_size for f in p.rglob('*') if f.is_file()) if p.is_dir() else p.stat().st_size

measured = {str(p): size(p) for p in [ROOT, EXT, session]}
future = dict(privateGitIndexNewObjects=8*1024**2, focusedInputsEvidenceOutputs=4*1024**2,
              temporary=1024**2, externalLauncherGrowth=4*1024**2,
              separateOwnSessionGrowth=12*1024**2, reserve=8*1024**2)
free = shutil.disk_usage(ROOT).free
total = sum(measured.values())+sum(future.values())
allocation = dict(measured=measured,future=future,total=total,cap=67108864,
                  hostFree=free,hostAfterIncremental=free-sum(future.values()),hostFloor=2982150144)
assert total<=67108864 and allocation['hostAfterIncremental']>=2982150144
(H/'final-allocation.json').write_text(json.dumps(allocation,indent=2)+'\n')
report = H.with_suffix('.md')
paths = [report]+sorted(p for p in H.rglob('*') if p.is_file() and p.name!='analysis-seals.json')
seals = [dict(path=str(p.relative_to(ROOT)),bytes=p.stat().st_size,
              sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in paths]
(H/'analysis-seals.json').write_text(json.dumps(seals,indent=2)+'\n')
run('final-stage-author-fixed',['git','add','--',str(report.relative_to(ROOT)),str(H.relative_to(ROOT))],destination=EXT)
run('final-staged-check-author-fixed',['git','diff','--cached','--check'],destination=EXT)
receipt = run('final-scope-author-fixed',['git','diff','--cached','--name-only'],destination=EXT)
names = receipt['stdout'].splitlines()
assert names and all(n==str(report.relative_to(ROOT)) or n.startswith(str(H.relative_to(ROOT))+'/') for n in names)
run('commit-author-fixed',['git','-c','user.name=Codex','-c','user.email=codex@openai.com','commit','-m','docs: diagnose original Shadow Man first-zero boundary'],destination=EXT)
sha = run('commit-sha',['git','rev-parse','HEAD'],destination=EXT)['stdout'].strip()
branch = 'task/shadow-man-original-first-zero-cause-oct23'
run('push',['git','push','origin','HEAD:refs/heads/'+branch],destination=EXT)
remote = run('verify-remote',['git','ls-remote','origin','refs/heads/'+branch,'refs/heads/main'],destination=EXT)['stdout']
assert sha+'\trefs/heads/'+branch in remote
# Prove committed bytes of every sealed report/evidence item without native execution.
import subprocess
for entry in seals:
    b = subprocess.check_output(['git','show',sha+':'+entry['path']],cwd=ROOT)
    assert len(b)==entry['bytes'] and hashlib.sha256(b).hexdigest()==entry['sha256']
owned_status = subprocess.check_output(['git','status','--porcelain','--',str(report.relative_to(ROOT)),str(H.relative_to(ROOT))],cwd=ROOT,text=True)
assert not owned_status, owned_status
publication = dict(commit=sha,branch=branch,actualRemote=remote,strictRemoteMatch=True,
                   sealedCommittedFiles=len(seals),ownedStatus=owned_status,allocation=allocation,
                   nativeExecution=False,boxOperation=False,lifecycleOwner='coordinator')
(EXT/'publication.json').write_text(json.dumps(publication,indent=2)+'\n')
print(json.dumps(publication))
