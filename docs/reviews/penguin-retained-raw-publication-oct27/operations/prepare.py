from common import *
D=pathlib.Path('/tmp/penguin-published-projectile-gameplay-oct27/ops')
ad=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/penguin-retained-frame-recovery-oct27-admission.json').read_text())
for p,h in ad['verifiedPins'].items():assert sha(pathlib.Path(p).read_bytes())==h,p
names=['api','api-history.jsonl','api-pending.json','actual-capture-plan.json','capture-cursor.json','capture-ledger-start.json','capture-map.jsonl','runtime-inspection.json','runtime-config.json','resource-first-guard.json']
inventory=[]
for name in names:
 src=D/name;dst=H/('prior-resource-first-guard.json' if name=='resource-first-guard.json' else name)
 if src.is_dir():shutil.copytree(src,dst)
 else:shutil.copy2(src,dst)
 for p in (list(src.rglob('*')) if src.is_dir() else [src]):
  if p.is_file():
   q=dst/p.relative_to(src) if src.is_dir() else dst
   assert sha(p.read_bytes())==sha(q.read_bytes())
   inventory.append(dict(donor=str(p),owned=str(q.relative_to(H)),bytes=p.stat().st_size,sha256=sha(p.read_bytes())))
assert used()==2481875
assert json.loads((H/'capture-cursor.json').read_text())['next']==379
save('original-copy-manifest.json',dict(donorCommit='a1240d3e0ed3ceb22a8ebce58113939459effb0a',files=inventory,rawUsed=used(),initialCursor=379,originalBudget=8388608,terminalReserve=1048576))
shutil.copy2('/tmp/penguin-published-projectile-gameplay-oct27/repo/docs/reviews/penguin-published-projectile-gameplay-oct27/receipt.json',H/'prior-receipt.json')
shutil.copy2('/home/user/wine-assembly/scratch/usage-watch/penguin-retained-frame-recovery-oct27-admission.json',H/'admission.json')
print('copied',len(inventory),'original hashes verified, cursor379 used',used())
