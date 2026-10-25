from control import *
admission('publication')
m=json.loads((OUT/'merged-tree.json').read_text());t=json.loads((OUT/'tests.json').read_text())
assert t['allPass'] and t['tree']==m['tree'];identities()
assert git('write-tree').decode().strip()==m['tree']
assert git('diff','--name-only').strip()==b''
assert git('diff','--cached','--name-only',MAIN).decode().splitlines()==m['acceptedPaths']
for p in m['acceptedPaths']:assert git('rev-parse',':'+p)==git('rev-parse',REVIEW+':'+p)
git('diff','--cached','--check');closure(m['tree'])
commit=git('commit-tree',m['tree'],'-p',MAIN,'-p',REVIEW,'-m','merge(renderer): integrate accepted exact byte snapshot identity',label='merge-commit').decode().strip()
git('update-ref','refs/heads/'+BRANCH,commit,MAIN)
for n in ['MERGE_HEAD','MERGE_MSG','MERGE_MODE','AUTO_MERGE']:
 p=R/'.git'/n
 if p.exists():p.unlink()
assert git('status','--porcelain')==b''
save('integration-commit',dict(preMain=MAIN,candidate=CAND,review=REVIEW,merged=commit,tree=m['tree'],branch=BRANCH))
admission('push')
fresh=git('ls-remote','--exit-code','origin','refs/heads/main',label='main-before-push').decode().split()[0]
assert fresh==MAIN,('Main changed; reconcile and retest before main push',fresh)
git('push','--atomic','origin',commit+':refs/heads/'+BRANCH,commit+':refs/heads/main',label='push-main-and-task')
lines=git('ls-remote','--exit-code','origin','refs/heads/main','refs/heads/'+BRANCH,label='remote-after').decode().splitlines()
refs={x.split()[1]:x.split()[0] for x in lines};assert refs=={'refs/heads/main':commit,'refs/heads/'+BRANCH:commit}
save('publication',dict(preMain=MAIN,candidate=CAND,review=REVIEW,merged=commit,tree=m['tree'],branch=BRANCH,refs=refs,verified=True,normalNonforceAtomicPush=True,sourceIdentity=dict(renderer=m['rendererSHA256'],overlay=m['overlaySHA256'])))
print(json.dumps(json.loads((OUT/'publication.json').read_text())))
