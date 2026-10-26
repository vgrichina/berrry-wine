from common import *
admit('admission-before-publication.json',True)
review=json.loads((O/'reuse-review.json').read_text());oracle=json.loads((O/'oracle-review.json').read_text());assert review['status']==oracle['status']=='PASS'
# Retain compact recovery evidence; do not duplicate donor payloads or modules.
save('review-harness-adjustments.json',dict(incidents=[dict(finding='Extra guessed local native-result .gz path absent',resolution='Use supplied committed compressed payload seals and equality of every original checkpoint field; do not acquire/repeat runtime'),dict(finding='Candidate versus integration also adds offline canonical build driver',resolution='Explicit tools/maelstrom-diagnostic-canonical-build.cjs allowance; production src and helper unchanged')],finishedOracleGroupReused=True,noNativeRetries=True))
source=run(['git','show','b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a:src/07d-uop-engine.wat'])
assert b'(global.get $dbg_tier_guard)' in source
save('source-guard.json',dict(revision='b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a',path='src/07d-uop-engine.wat',sha256=sha(source),sourceContainsTierGuard=True,helperRequiresPin='cda6aabb3efd8e8f123887315c71747566c166721564e6a01e090224a6cf5fb3'))
assert sha(source)=='cda6aabb3efd8e8f123887315c71747566c166721564e6a01e090224a6cf5fb3'
save('checkpoint.json',dict(candidate=SHA,helperSHA256=oracle['helperSHA256'],fixtureSHA256=oracle['fixtureSHA256'],decision='ACCEPT',completed=['oracle/source review','768 predicate controls','10 scalar mutants','exact 29+7 dependency receipts','original failure unchanged','report'],remaining=['task branch commit/push/exactremote'],remainingQualificationGate='current-main closure qualification; authentic loader/_getptd/original invocation before original game, then gameplay separately'))
dest=R/'docs/reviews'/H.name;dest.mkdir(parents=True,exist_ok=True)
names=['common.py','setup.py','review.py','reuse.py','publish.py','launch.json','configuration.json','parser-resource-failure.json','admission-precheckout.json','admission-review.json','admission-reuse.json','admission-before-publication.json','oracle-review.json','reuse-review.json','fixture.diff','checkpoint.json','review-harness-adjustments.json','source-guard.json']
for n in names:shutil.copyfile(O/n,dest/n)
shutil.copyfile(L/'root-ref-digest.json',dest/'root-ref-digest.json')
manifest=[]
for p in sorted(dest.iterdir()):
 if p.name!='evidence-manifest.json':manifest.append(dict(path=str(p.relative_to(R)),bytes=p.stat().st_size,sha256=sha(p.read_bytes())))
(dest/'evidence-manifest.json').write_text(json.dumps(dict(decision='ACCEPT',candidate=SHA,files=manifest,donorManifest=str(E/'evidence-manifest.json'),donorPackagingAudit='prior root72 verified reused'),indent=2)+'\n')
git('config','pack.threads','1');git('config','pack.window','0');git('config','pack.compression','1')
status=git('status','--porcelain');assert status and all(H.name in s for s in status.splitlines()),status
git('add','docs/reviews/'+H.name);git('diff','--cached','--check')
git('commit','-m','docs: independently accept retained Maelstrom synthetic native oracle and reuse')
commit=git('rev-parse','HEAD');assert git('rev-parse','HEAD^')==SHA
save('commit.json',dict(commit=commit,branch='task/'+H.name,decision='ACCEPT',localOnly=True))
admit('admission-task-push.json',True)
branch='refs/heads/task/'+H.name
before=git('ls-remote','--heads','origin',branch);assert not before,'unexpected existing remote task branch'
git('push','origin','HEAD:'+branch)
remote=git('ls-remote','--heads','origin',branch);assert remote==commit+'\t'+branch,(commit,remote)
save('publication.json',dict(commit=commit,branch=branch,remote=remote,exactRemoteVerified=True,trustedSSH=SSH,noMainPublication=True,decision='ACCEPT'))
save('result.json',dict(status='ACCEPT',candidate=SHA,commit=commit,branch='task/'+H.name,remoteVerified=True,evidence=str(dest/'evidence-manifest.json'),ops=str(O),nativeExecuted=0,rebuilds=0,newDonorPasses=29,retainedDonorPasses=7,noMainPublication=True,boxAssigned=None,boxState='not observed/no access',boxExpiry=None,shutdownOwner='coordinator retains existing box lifecycle',remainingGate='current-main closure qualification; loader-proven authentic CRT/_getptd and original invocation/errno/caller state before original-game acceptance; gameplay separate'))
save('checkpoint-final.json',dict(candidate=SHA,commit=commit,decision='ACCEPT',remoteVerified=True,completed=['all bounded acceptance groups','review taskbranch published'],remainingTaskWork=[]))
admit('resource-final.json',True)
print(json.dumps(dict(status='ACCEPT',commit=commit,remote=remote,manifestFiles=len(manifest))))
