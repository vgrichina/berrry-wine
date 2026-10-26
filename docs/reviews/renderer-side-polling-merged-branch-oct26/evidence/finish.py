from common import *
resource('prepublication')
pins=json.loads((OPS/'sourcepins.json').read_text()); checkpoint=json.loads((OPS/'checkpoint.json').read_text())
assert len(checkpoint['groups'])==6 and all(g['accepted'] for g in checkpoint['groups'])
assert git('write-tree').decode().strip()==pins['testedTree']
# Confirm every tested worktree byte against index, including inherited dependencies.
for p in ['lib/renderer-input.js',*pins['dependenciesAndFixtures']]:
 if p.startswith('ops/'): continue
 assert (REPO/p).read_bytes()==git('show',':'+p),p
remote=git('ls-remote','--refs','origin','refs/heads/main').decode().strip()
(OPS/'remote-main-prepublication.txt').write_text(remote+'\n')
initial=(OPS/'remote-main-initial.txt').read_text().strip()
assert remote==initial,'Remote main changed; must explicitly reconcile new immutable base'
diff=git('diff','--cached','--raw','--no-abbrev',BASE).decode()
(OPS/'tested-tree-diff.txt').write_text(diff)
write(OPS/'tree-proof.json',{'base':BASE,'baseTree':git('rev-parse',BASE+'^{tree}').decode().strip(),'testedTree':pins['testedTree'],'remoteMainObserved':remote,'scopedChangedPaths':pins['changedPaths'],'proof':'Entire base index read-tree retained; diff-tree base versus tested tree lists ONLY renderer-input and four accepted fixtures. Every other tracked path retains identical Git object and mode. Sparse absence is not staged deletion.','rawDiff':diff,'mainRendererSinceOriginalBasePatchBytes':0,'acceptedBothRepairsApplied':True,'candidateRendererIdentical':True,'protectedPathsUnchanged':['lib/browser-input.js','host.js','all parser/bundle/vfs paths','all other renderer files including byte identity/generation/accounting fixes']})
rootReceipt=run(['python3','/home/user/wine-assembly/scratch/usage-watch/stream-root-ref-digest.py']).stdout
rootInitial=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/renderer-side-polling-merged-branch-oct26/root-ref-digest.json').read_text())
rootFinal=json.loads(rootReceipt); write(OPS/'root-ref-final.json',rootFinal)
assert rootFinal['sha256']==rootInitial['sha256'],'Root refs changed externally; preserve evidence and investigate'
doc=REPO/DOCREL; doc.mkdir(parents=True,exist_ok=True)
(doc/'INTEGRATION.md').write_text(f'''Integrated both accepted physical ownership and side polling repairs onto production main {BASE} in an isolated task branch. Main renderer blob equals original pre-repair blob 7da1e2f5cf7e1e79959ca93134d84ea639c75073, so both original patches apply cleanly without semantic conflict. Final renderer is exactly accepted candidate {CAND} (SHA-256 {pins['mergedRendererSha256']}). Accepted review {REVIEW}; all 32 committed review payloads rehashed and reused, without baseline reruns or new challenge expansion.

Actual merged source/test tree: {pins['testedTree']}. Serial timeout25s Node --max-old-space-size=16 results: independent29 PASS, supplied37 PASS, side controls28 PASS, challenges25 PASS, legacy PASS. Strict aggregate characterization remains 0PASS/3FAIL, matching retained failures on both accepted revisions. Aggregate delivery rearming is intentionally unchanged. Final commit adds only these documentation/evidence files to the tested tree; source and fixture bytes remain identical.

Explicit source/fixture changes: lib/renderer-input.js and the four renderer modifier fixtures recorded in evidence/sourcepins.json. Complete tree comparison proves every other production-main tracked object/mode unchanged, including browser input, parser/bundle/VFS and renderer generation/accounting/byte identity fixes. Missing sparse paths are not deletions. Main publication is reserved to file-bundle-parser-accepted-integrate-oct26; this task publishes only {BRANCH}.

No browser, guest, runtime, gameplay, canonical compile, services or deployment claim. No box assigned (ID/state/expiry N/A); lifecycle remains coordinator owned. Remaining gates: coordinator publication/integration decision against then-current main, and separately authorized runtime validation. Root refs and all donors remained readonly; messageboard was append-only. Initial runner summary parsing incident is preserved; its successful exact execution was reused after parser correction. Stop after verified taskbranch publication; no successor.
''')
(doc/'RECOVERY.md').write_text(f'''Recover branch {BRANCH} using the exact commit and ls-remote receipt in /tmp/renderer-side-polling-merged-branch-oct26/ops/result.json and the append-only repository messageboard. Parent/base is {BASE}. All source/test objects are in the task commit; exact tested pre-evidence tree is {pins['testedTree']}.

Checkout only lib/renderer-input.js, lib/mem-utils.js, lib/region-map.generated.js, the four tests in evidence/sourcepins.json and this review directory. Copy evidence to sibling ops to reuse recorded Node commands and legacy synthetic-filename runner. Pins bind all fixtures and dependencies; no donor absolute path is needed to execute tests. Existing accepted baseline and parent rejection receipts stay at review {REVIEW}; do not rerun unchanged accepted checks for recovery. Both accepted patch payloads and accepted review receipts are retained here.

Execution limits: Node16MiB heap, timeout25s, serial one test group, stdout/stderr128KiB each, individual files24MiB, all focused task data/launcher/session/future positiveWAL once/reserve64MiB. Standing donor objects and installed tools separate. No mounts/runtime argv exists; canonical mount validation is inapplicable. Trusted SSH configuration is in evidence/configuration.json. Main is not authorized for this worker.
''')
e=doc/'evidence'; e.mkdir(exist_ok=True)
names=['sourcepins.json','checkpoint.json','ancestry.json','configuration.json','review-reuse.json','tree-proof.json','tested-tree-diff.txt','physical.patch','side.patch','main-since-original.patch','remote-main-initial.txt','remote-main-prepublication.txt','root-ref-final.json','incidents.txt','initial-checkpoint.json','legacy-keyboard-message-lparam.cjs','run-legacy.cjs','aggregate-latch-repro.cjs','common.py','setup.py','integrate.py','test.py','finish.py','resources-precheckout.json','resources-preintegration.json','resources-pretests.json','resources-prepublication.json']
for g in checkpoint['groups']: names.extend([g['log'],g['name']+'.stderr'])
for n in names: shutil.copyfile(OPS/n,e/n)
for src,dest in [('DECISION.md','accepted-DECISION.md'),('evidence/sourcepins.json','accepted-sourcepins.json'),('evidence/checkpoint.json','accepted-checkpoint.json'),('evidence-manifest.json','accepted-evidence-manifest.json')]:
 shutil.copyfile(REVIEWDIR/src,e/dest)
shutil.copyfile('/home/user/wine-assembly/scratch/usage-watch/renderer-side-polling-merged-branch-oct26/root-ref-digest.json',e/'root-ref-initial.json')
manifest={str(p.relative_to(doc)):{'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in doc.rglob('*') if p.is_file()}
write(doc/'evidence-manifest.json',manifest)
git('add','--sparse','--',DOCREL)
finalTree=git('write-tree').decode().strip()
paths=git('diff','--cached','--name-only',BASE).decode().splitlines()
assert all(p in pins['changedPaths'] or p.startswith(DOCREL+'/') for p in paths)
sourceRelation=git('diff','--name-only',pins['testedTree'],finalTree).decode().splitlines()
assert sourceRelation and all(p.startswith(DOCREL+'/') for p in sourceRelation)
# Boundary avoids traversing unrelated standing history during task publication.
(REPO/'.git/shallow').write_text(BASE+'\n')
git('commit','-m','Integrate accepted renderer physical modifier ownership and side polling')
commit=git('rev-parse','HEAD').decode().strip()
assert git('rev-parse','HEAD^').decode().strip()==BASE
assert git('rev-parse','HEAD^{tree}').decode().strip()==finalTree
write(OPS/'commit.json',{'commit':commit,'parent':BASE,'testedTree':pins['testedTree'],'finalTree':finalTree,'testedToFinalDocsOnly':sourceRelation,'changedPaths':paths,'sourceRendererSha256':pins['mergedRendererSha256']})
print('COMMIT',commit,'TREE',finalTree,'paths',len(paths))
