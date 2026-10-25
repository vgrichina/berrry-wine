from control import *
admission('checkout-recovered')
(R/'.git/shallow').write_text(BASE+'\n')
if True:
 refs=git('ls-remote','--exit-code','origin','refs/heads/main','refs/heads/task/render-byte-identity-independent-accept-oct25','refs/heads/task/render-generation-aba-repair-oct25',label='remote-before').decode().splitlines()
 refs={x.split()[1]:x.split()[0] for x in refs};assert refs['refs/heads/main']==MAIN and refs['refs/heads/task/render-byte-identity-independent-accept-oct25']==REVIEW and refs['refs/heads/task/render-generation-aba-repair-oct25']==CAND
 git('fetch','--no-tags','--no-auto-maintenance','origin','+refs/heads/main:refs/remotes/origin/main','+refs/heads/task/render-byte-identity-independent-accept-oct25:refs/remotes/origin/accepted',label='fetch')
 assert git('rev-parse','refs/remotes/origin/main').decode().strip()==MAIN
 assert git('rev-parse','refs/remotes/origin/accepted').decode().strip()==REVIEW
 changed=git('diff','--name-only',BASE,REVIEW).decode().splitlines()
 allowed={'lib/d3d9-host.js','test/test-d3d9-immutable-rgba-snapshot.js','test/test-d3d9-texture-snapshot-cache.js','test/test-d3d9-rgba-generation-independent.js','test/test-d3d9-rgba-source-identity.js','test/test-d3d9-byte-identity-acceptance.js'}
 assert all(p in allowed or p.startswith('ops/handoffs/render-') for p in changed),changed
 selected=set(changed)|{'lib/*.js','test/test-vfs-overlay.js'}
 (R/'.git/info/sparse-checkout').write_text(''.join('/'+p+'\n' for p in sorted(selected)))
 git('checkout','-q','-b',BRANCH,MAIN,label='checkout')
 git('merge','--no-ff','--no-commit',REVIEW,label='merge')
 tree=git('write-tree').decode().strip()
 actual=git('diff','--cached','--name-only',MAIN).decode().splitlines();assert actual==changed
 for p in changed:assert git('rev-parse',':'+p)==git('rev-parse',REVIEW+':'+p)
 identities();git('diff','--cached','--check',label='diff-check');closure(tree)
 save('merged-tree',dict(preMain=MAIN,candidate=CAND,review=REVIEW,tree=tree,acceptedPaths=changed,unrelatedPreserved=True,rendererSHA256=sha(R/'lib/d3d9-host.js'),overlaySHA256=sha(R/'lib/overlay-store.js')))
 print('Merge scope, identities and complete object closure PASS')
