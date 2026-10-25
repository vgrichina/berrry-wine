from control import *
admission('checkout-recovered')
# Network refs were verified. All pinned objects resolved from readonly flat inputs;
# avoid fetch's unrelated malformed standing .alternate ref traversal.
(R/'.git/shallow').write_text(BASE+'\n')
for ref,oid in [('refs/remotes/origin/main',MAIN),('refs/remotes/origin/accepted',REVIEW)]:
 assert git('cat-file','-t',oid).strip()==b'commit';git('update-ref',ref,oid)
changed=git('diff','--name-only',BASE,REVIEW).decode().splitlines()
assert all(p in {'lib/save-sync.js','test/test-save-sync-owned-upload.js'} or p.startswith('ops/handoffs/save-sync-owned-upload-repair-oct25/') or p.startswith('docs/reviews/save-sync-upload-independent-accept-oct25/') for p in changed)
selected=set(changed)|{'lib/*.js','test/test-vfs-overlay.js','test/test-d3d9-immutable-rgba-snapshot.js','test/test-save-sync-upload-validation.js','test/test-save-bundle.js'}
(R/'.git/info/sparse-checkout').write_text(''.join('/'+p+'\n' for p in sorted(selected)))
assert git('rev-parse','HEAD').decode().strip()==MAIN
git('merge','--no-ff','--no-commit',REVIEW,label='merge')
tree=git('write-tree').decode().strip()
actual=git('diff','--cached','--name-only',MAIN).decode().splitlines();assert actual==changed
for p in changed:assert git('rev-parse',':'+p)==git('rev-parse',REVIEW+':'+p)
identities();git('diff','--cached','--check',label='diff-check');closure(tree)
save('merged-tree',dict(preMain=MAIN,candidate=CAND,review=REVIEW,tree=tree,acceptedPaths=changed,unrelatedPreserved=True,saveSyncSHA256=sha(R/'lib/save-sync.js'),rendererSHA256=sha(R/'lib/d3d9-host.js'),overlaySHA256=sha(R/'lib/overlay-store.js')))
print(json.dumps(dict(tree=tree,paths=len(changed))))
