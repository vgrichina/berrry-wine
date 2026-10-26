from common import *
import resource as limits
limits.setrlimit(limits.RLIMIT_FSIZE,(24*1024**2,24*1024**2))
resource('precheckout')
write(OPS/'configuration.json',{'sshCommand':SSH,'mountArgv':None,'intendedMountedFiles':[],'mountValidation':'Not applicable: offline Git/Node only, no guest or mount execution','readiness':'16MiB Node serial, no compilation/instantiation, <=128KiB per test output, 24MiB individual files, 64MiB aggregate allocation','rootInitialRefReceipt':'/home/user/wine-assembly/scratch/usage-watch/renderer-side-polling-merged-branch-oct26/root-ref-digest.json'})
run(['git','init','-q',str(REPO)])
alt=REPO/'.git/objects/info/alternates'
alt.write_text(''.join(str(p/'.git/objects')+'\n' for p in DONORS))
git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
git('config','user.name','Wine Assembly Agent'); git('config','user.email','agent@wine-assembly.local')
git('config','core.sparseCheckout','true')
files=['lib/renderer-input.js','lib/mem-utils.js','lib/region-map.generated.js']
(REPO/'.git/info/sparse-checkout').write_text(''.join('/'+p+'\n' for p in files))
git('read-tree','-m','-u',BASE)
git('symbolic-ref','HEAD','refs/heads/'+BRANCH); git('update-ref','refs/heads/'+BRANCH,BASE)
assert git('write-tree').decode().strip()=='07ea4ac31d2470f447458d6ef088ef4b32544ece'
remote=git('ls-remote','--refs','origin','refs/heads/main').decode().strip()
(OPS/'remote-main-initial.txt').write_text(remote+'\n')
print('remote main',remote)
manifest=json.loads((REVIEWDIR/'evidence-manifest.json').read_text())
for n,v in manifest.items():
 b=(REVIEWDIR/n).read_bytes(); assert sha(b)==v['sha256'] and len(b)==v['bytes'],n
 assert git('show',REVIEW+':'+str((REVIEWDIR/n).relative_to(DONORS[2])))==b,n
write(OPS/'review-reuse.json',{'review':REVIEW,'candidate':CAND,'verifiedCommittedReviewPayloads':len(manifest),'manifestSha256':sha((REVIEWDIR/'evidence-manifest.json').read_bytes()),'baselineResultsReused':{'independent':'2 PASS / 27 FAIL','supplied':'1 PASS / 36 FAIL','newParent':'0 PASS / 25 FAIL','strictAggregateBothRevisions':'0 PASS / 3 FAIL'},'decisionSha256':sha((REVIEWDIR/'DECISION.md').read_bytes())})
# Compare exact trees, never replace current main renderer wholesale.
history={}
for a,b,name in [(ORIGINAL,PARENT,'physical'),(PARENT,CAND,'side'),(ORIGINAL,BASE,'main-since-original')]:
 patch=git('diff','--binary',a,b,'--','lib/renderer-input.js')
 (OPS/(name+'.patch')).write_bytes(patch)
 history[name]={'from':a,'to':b,'patchSha256':sha(patch),'bytes':len(patch)}
 history[name]['rendererFrom']=git('rev-parse',a+':lib/renderer-input.js').decode().strip()
 history[name]['rendererTo']=git('rev-parse',b+':lib/renderer-input.js').decode().strip()
write(OPS/'ancestry.json',history)
print(json.dumps(history,indent=2))
