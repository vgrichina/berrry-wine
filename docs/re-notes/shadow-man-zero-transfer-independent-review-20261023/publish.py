#!/usr/bin/env python3
"""Publish only owned review files; no shared ref/index mutation."""
import hashlib,json,pathlib,subprocess,sys
H=pathlib.Path(__file__).resolve().parent
R=H.parents[2]
E=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/shadow-man-zero-transfer-independent-review-oct23')
BRANCH='task/shadow-man-zero-transfer-independent-review-oct23'
def git(*a):return subprocess.check_output(['git',*a],cwd=R).decode().strip()
assert git('symbolic-ref','--short','HEAD')==BRANCH
report=H.with_suffix('.md')
paths=[str(report.relative_to(R)),str(H.relative_to(R))]
seals=[{'path':str(p.relative_to(R)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [report,*sorted(H.iterdir())] if p.is_file() and p.name!='seals.json']
(H/'seals.json').write_text(json.dumps({'scope':'owned review files before publication; excludes self and external publication receipts','files':seals},indent=2)+'\n')
git('add','--',*paths)
staged=git('diff','--cached','--name-only').splitlines()
assert staged and all(p==paths[0] or p.startswith(paths[1]+'/') for p in staged),staged
git('diff','--cached','--check')
subprocess.run(['git','-c','user.name=Codex','-c','user.email=codex@openai.com','commit','-m','Review Shadow Man zero-transfer provenance source acceptance'],cwd=R,check=True)
commit=git('rev-parse','HEAD')
assert not git('status','--porcelain','--',*paths)
for s in seals:
 b=subprocess.check_output(['git','show',commit+':'+s['path']],cwd=R)
 assert len(b)==s['bytes'] and hashlib.sha256(b).hexdigest()==s['sha256']
(E/'local-publication.json').write_text(json.dumps({'branch':BRANCH,'commit':commit,'report':str(report),'sealedFiles':len(seals),'ownedStatusClean':True},indent=2)+'\n')
print(json.dumps({'commit':commit,'branch':BRANCH,'ownedFiles':len(staged),'verifiedSeals':len(seals)}))
