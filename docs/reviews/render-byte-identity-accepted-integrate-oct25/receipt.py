from control import *
admission('receipt')
pub=json.loads((OUT/'publication.json').read_text())
rc,a,b=run(['python3','/home/user/wine-assembly/scratch/usage-watch/stream-root-ref-digest.py'],cwd='/home/user/wine-assembly',env=E,label='root-ref-final');assert rc==0
initial=json.loads(Path('/home/user/wine-assembly/scratch/usage-watch/render-byte-identity-accepted-integrate-oct25/root-ref-digest.json').read_text());final=json.loads(a)
assert initial['sha256']==final['sha256']
save('root-ref-comparison',dict(initial=initial,final=final,unchanged=True))
save('result',dict(decision='ACCEPT AND INTEGRATED',**pub,tests=json.loads((OUT/'tests.json').read_text()),blockers=[],box=dict(id=None,state='not assigned',expiry=None,lifecycleOwner='coordinator'),limitations=['Source/mock-device JS contracts only; no GPU/runtime/gameplay/compiler/wasm/browser execution','Linear scans and reduced cache capacity remain unbenchmarked','2**32 generation recurrence modeled algebraically; not executed'],recovery='RECOVERY.md',internalCorrections='Missing standing overlay review objects during scoped fetch resolved by adding existing validated nonrecursive flat leaves and pinned-base own shallow boundary; original diagnostic retained; no denial/access retry or limit increase'))
recovery='''Accepted unchanged renderer integrated into main. See publication.json for exact pre-main, candidate, review, merge, tree, source SHA and verified remote refs. Main was pushed normally and atomically with the task branch. Receipt-only commit subsequently changes the task branch only.

Reproduce with installed node and --max-old-space-size=128: node --test test/test-d3d9-immutable-rgba-snapshot.js; node --test test/test-d3d9-rgba-generation-independent.js; node --test test/test-d3d9-rgba-source-identity.js; node --test test/test-d3d9-byte-identity-acceptance.js; node test/test-d3d9-texture-snapshot-cache.js --js-only; node --check lib/d3d9-host.js; node test/test-vfs-overlay.js. Tests.json records commands and exact-tree results, controls retain expected nonzero results. Ops/tests.py safely restores source after controls. No runtime/gameplay claim.

Recover isolated sparse checkout from integration commit in publication.json. Configuration.json names validated nonrecursive readonly object leaves. Keep own writable .git/objects primary; unset GIT_OBJECT_DIRECTORY. No recursive alternate acquisition, repack or full clone. Bound history at base397cdb6c in the own .git/shallow. Preserve readonly donors and existing accepted overlay/qualifier/dashboard/crash/graphics work. control.py/run.py retain commands, resource checks and bounded supervision. No mount invocation exists; parser inapplicable. Exact trusted SSH retained in configuration. Actual remote Boat SSH403 remains a denial; no attempt made. No public deployment/service restart, no boxes assigned; coordinator owns lifecycle and protected boxes untouched. Claude idle. No workers spawned or successors chosen.

All new bytes cap64MiB includes reserve8MiB, session/sharedWALSHM/positiveDB growth/publication/futures; RAM minimum1GiB, disk floor2982150144 after growth; heap128MiB CPUwall60s file24MiB capture128KiB cumulative2MiB TERM2/KILL3/reap5. Standing installed tools and readonly object bytes are separate inputs, zero duplicate staging charge. Admission receipts retain measured/projected totals. Root ref digest streaming comparison unchanged. Original missing standing leaf diagnostic retained in fetch.json; resolved locally without access or limit changes.
'''
(OUT/'RECOVERY.md').write_text(recovery)
# Receipt is additive and deliberately separate from the tested merge tree.
dest=R/'docs/reviews/render-byte-identity-accepted-integrate-oct25';dest.mkdir(parents=True)
names=['result.json','publication.json','merged-tree.json','tests.json','closure.json','configuration.json','standing-inputs.json','accepted-inputs.json','root-ref-comparison.json','admission-checkout.json','admission-checkout-recovered.json','admission-tests.json','admission-publication.json','admission-push.json','admission-receipt.json','control.py','run.py','resume.py','tests.py','publish.py','receipt.py','RECOVERY.md']
names += [p.name for p in OUT.glob('*.json') if p.name in ['original-six.json','unchanged-reviewer.json','extended.json','independent.json','legacy-js.json','syntax.json','overlay-existing.json','predecessor-control.json','alias-control.json','fetch.json','remote-after.json']]
for n in names:shutil.copyfile(OUT/n,dest/n)
manifest={n:dict(bytes=(dest/n).stat().st_size,sha256=sha(dest/n)) for n in names}
(dest/'evidence-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');save('evidence-manifest',manifest)
git('add','--sparse','docs/reviews/render-byte-identity-accepted-integrate-oct25');git('diff','--cached','--check')
paths=git('diff','--cached','--name-only').decode().splitlines();assert all(p.startswith('docs/reviews/render-byte-identity-accepted-integrate-oct25/') for p in paths)
git('commit','-m','docs(renderer): retain accepted byte identity integration receipt',label='receipt-commit')
commit=git('rev-parse','HEAD').decode().strip()
admission('receipt-push')
git('push','origin','HEAD:refs/heads/'+BRANCH,label='receipt-push')
lines=git('ls-remote','--exit-code','origin','refs/heads/main','refs/heads/'+BRANCH,label='receipt-remote').decode().splitlines();refs={x.split()[1]:x.split()[0] for x in lines}
assert refs['refs/heads/main']==pub['merged'] and refs['refs/heads/'+BRANCH]==commit
assert git('status','--porcelain')==b''
save('publication-complete',dict(**pub,receiptCommit=commit,finalRefs=refs,receiptVerified=True,mainUnchanged=True))
admission('final')
print(json.dumps(dict(merged=pub['merged'],tree=pub['tree'],receiptCommit=commit,refs=refs,decision='ACCEPT AND INTEGRATED')))
