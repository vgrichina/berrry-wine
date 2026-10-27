from common import *
D=pathlib.Path('/tmp/penguin-published-projectile-gameplay-oct27/repo/docs/reviews/penguin-published-projectile-gameplay-oct27')
dst=H/'prior-published-report';shutil.copytree(D,dst)
items=[]
for p in D.rglob('*'):
 if p.is_file():
  rel=p.relative_to(D);assert sha(p.read_bytes())==sha((dst/rel).read_bytes())
  items.append(dict(original=str(p),archivePath='prior-published-report/'+str(rel),sha256=sha(p.read_bytes()),bytes=p.stat().st_size))
save('prior-report-copy-manifest.json',dict(commit='a1240d3e0ed3ceb22a8ebce58113939459effb0a',files=items))
init=json.loads(pathlib.Path('/tmp/penguin-published-projectile-gameplay-oct27/ops/init-report.json').read_text())
expected='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
assert init['ssh']==expected==os.environ['GIT_SSH_COMMAND']
save('configuration-checkpoint.json',dict(ssh=expected,unchangedPriorReceiptSHA256=sha(pathlib.Path('/tmp/penguin-published-projectile-gameplay-oct27/ops/init-report.json').read_bytes()),mounts='No mount/checkout/runtime launch requested or performed; reuse original canonical production mount receipt in prior-published-report/runtime/startup-mount-receipt.json',rootReceipt='/home/user/wine-assembly/scratch/usage-watch/penguin-retained-frame-recovery-oct27/root-ref-digest.json',helperSHA256=sha(HELPER.read_bytes()),supervisorSHA256='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'))
print('preserved original report',len(items),'files; unchanged SSH verified')
