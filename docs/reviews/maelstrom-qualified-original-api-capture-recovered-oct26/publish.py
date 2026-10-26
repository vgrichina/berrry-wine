from common import *
import sys
stage=sys.argv[1]
account('publication-'+stage,remoteProjection=28000000)
dest=R/'docs/reviews'/H.name;dest.mkdir(parents=True,exist_ok=True)
names=['pins-verified.json','checkout.json','schedule.json','incidents.json','closure.json','runner-diff.json','resource-closure-prepared.json','launch-config.json','closure-binding.json','import-closure-review.json','source-closure-correction.json']
names += ['qualification-reuse.json']
if stage=='final':
 names += ['final-receipt.json','observation.json','collected-manifest.json','checkpoint-guest-terminal.json','checkpoint-staged.json','transfer-roundtrip.json','remote-before-staging-api.json','remote-preguest-api.json','startup-api.json','mount-api.json','archive-transfer.json','resource-immediate-preguest.json']
if stage=='staged':names += ['checkpoint-staged.json','transfer-roundtrip.json','remote-before-staging-api.json','startup-api.json','mount-api.json','archive-transfer.json','resource-archive-transfer.json']
for n in names:
 if (O/n).exists():shutil.copyfile(O/n,dest/n)
for n in ['common.py','prepare.py','stage.py','supervise.py','remote-inventory.py','capture.py','collect.py','analyze.py','publish.py']:
 if (O/n).exists():shutil.copyfile(O/n,dest/n)
for n in ['manifest.json','guest-args.json']:
 shutil.copyfile(H/n,dest/n)
if stage=='final' and (O/'collected').exists():
 for p in (O/'collected').rglob('*'):
  if p.is_file():q=dest/'raw'/p.relative_to(O/'collected');q.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,q)
report='Authentic Maelstrom capture using retained accepted guard module98e136b5, source55f9724 and evidence base62b15e94. Original-game acceptance remains false. '
if stage=='final':report+=json.load(open(O/'final-receipt.json'))['summary']
elif stage=='staged':report+='All remote input hashes, canonical48-file mount enumeration, chunked transfer roundtrip and exact Node startup pass. GuestAttempts0; one authentic attempt remains.'
else:report+='Inputs verified; local closure prepared. No guest attempt yet. Shared box lock wait; no build/native/static replay.'
(dest/'README.md').write_text(report+'\n\nRecipes and exact hashes are retained beside this note. No production repair or main integration. Box lifecycle belongs to coordinator.\n')
git('add','--','docs/reviews/'+H.name)
diff=git('diff','--cached','--stat').decode();assert len(diff.encode())<=8192
save('publication-review-'+stage+'.json',dict(stat=diff,paths=git('diff','--cached','--name-only').decode().splitlines(),at=time.time()))
git('diff','--cached','--check')
git('commit','-m','docs: preserve Maelstrom original capture '+stage+' evidence')
commit=git('rev-parse','HEAD').decode().strip();branch='task/'+H.name
git('push','origin','HEAD:refs/heads/'+branch)
remoteSHA=git('ls-remote','origin','refs/heads/'+branch).decode().split()[0];assert remoteSHA==commit
save('publication-'+stage+'.json',dict(commit=commit,branch=branch,remoteSHA=remoteSHA,verified=True,at=time.time()))
with (ROOT/'messageboard.txt').open('a') as f:f.write(time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())+' '+H.name+' CHECKPOINT '+stage+' commit '+commit+' exact remote refs/heads/'+branch+' VERIFIED; owned evidence only, originalGameAcceptancefalse. '+report+'\n')
print(json.dumps(dict(commit=commit,branch=branch,remoteSHA=remoteSHA,verified=True)))
