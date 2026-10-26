import pathlib, os, shutil, json, subprocess, time, sys
from integrate import R,O,P,MAIN,C,A,B,D,CD,MD,git,save,sha,blob,tree,resources
review='docs/reviews/app-files-accepted-merged-branch-oct26'
doc=R/review;doc.mkdir(parents=True,exist_ok=True)
tested=json.loads((O/'tested-tree.json').read_text())['tree']
assert git('write-tree').decode().strip()==tested
# Mark unmaterialized standing tracked entries as sparse; no tree/index content changes.
allpaths=git('ls-files','-z')
r=subprocess.run(['git','update-index','--skip-worktree','-z','--stdin'],input=allpaths,cwd=R,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
assert r.returncode==0,r.stderr[:4096]
save('incidents.json',[
 {'event':'Initial broad combined policy/source reads returned truncated output and exceeded the 8192-byte read-excerpt gate. Later source/provenance reads bounded; no test output exceeded 900 bytes.','effect':'Inspection/capture deviation disclosed; no assertion or resource gate weakened.'},
 {'event':'First integration precondition rejected because candidate parent contains a comment absent in pinned main.','resolution':'Byte-exact comparison after removing the known accepted explanatory comment proved no other baseline app-files difference. Integrated the exact accepted final app-files blob; unrelated main bytes/modes preserved.'},
 {'event':'Pinned main full host differs from accepted host due to parser hardening.','resolution':'Retained main host bytes/mode; exact 16464-byte loadFiles extraction verified unchanged. Original fixtures retained byte-exact, bounded wrapper changes only one full-host identity guard in memory. Both compatibility groups passed.'}
])
tools={}
for name in ['node','git','python3','timeout','ssh']:
 p=pathlib.Path(shutil.which(name)).resolve();tools[name]={'path':str(p),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())}
save('standing-tools.json',tools)
config=json.loads((O/'admission.json').read_text())
save('configuration.json',{'sshCommand':config['sshCommand'],'mountArgv':[],'mountValidation':'N/A no guest/mount/runtime commands. Canonical parser has no invocation to validate.','immutableInputs':{'main':MAIN,'candidate':C,'acceptance':A},'donorsReadOnly':True,'rootRefReceipt':'/home/user/wine-assembly/scratch/usage-watch/app-files-accepted-merged-branch-oct26/root-ref-digest.json','laterRootComparison':'Not required; no root Git writes. Concurrent coordinator/sole-owner ref changes are outside this task.'})
rootreceipt=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/app-files-accepted-merged-branch-oct26/root-ref-digest.json')
shutil.copyfile(rootreceipt,O/'initial-root-ref-digest.json')
mt=tree(MAIN);tt=tree(tested)
diff={p for p in set(mt)|set(tt) if mt.get(p)!=tt.get(p)}
assert [p for p in diff if not p.startswith(('docs/','test/'))]==['lib/app-files.js']
for p in diff:
 assert p=='lib/app-files.js' or p in ['test/app-files-empty-alias-fallback-oct26.test.cjs','test/app-files-empty-alias-independent-oct26.test.cjs','test/app-files-accepted-merged-compat-oct26.cjs'] or p.startswith(('docs/reviews/app-files-empty-alias-fallback-oct26/','docs/reviews/app-files-empty-alias-independent-oct26/'))
pres=json.loads((O/'preservation.json').read_text());pres.update(testedTree=tested,changedPaths=sorted(diff),retainedMainHostEntry=mt['host.js'],unacceptedBrowserVfsAbortRepair=False);save('preservation.json',pres)
report='''# Accepted app-files merged-tree compatibility: merge-ready task branch

Pinned main `'''+MAIN+'''`, accepted candidate `'''+C+'''`, independent acceptance `'''+A+'''`. This task publishes only `'''+B+'''`. No main publication or ownership acquisition. The named VFS main owner remains unimpeded; this branch does not claim current-main reconciliation after its release.

The exact accepted `lib/app-files.js` blob makes an empty alias list fall through to a truthy explicit `vfsPath`, then the literal URL basename, matching actual host mounting. Nonempty alias priority, suffix/comma identity and explicit loading policy remain covered. Relative to pinned main, this adds the accepted guard and four explanatory comment lines; no other production bytes or modes change. Parser, file-bundle, save-sync, renderer, host, browser and VFS remain exactly pinned-main entries. Unaccepted browser/VFS-abort repairs are absent.

All 24 repair and 49 independent-acceptance manifest payloads were rehashed from immutable Git revisions and matched the integrated copies. Existing 7 supplied PASS, 8 independent PASS and three rejected mutations retain exact raw evidence/provenance. The policy and original fixtures are byte-identical to acceptance; installed Node identity is unchanged. The actual host loadFiles extraction is byte-identical (16464 bytes, SHA-256 `5fbb544b0f29130c90f2c14685e979bdfa40caaf43dfeb4d6181a26e62933659`), although the whole host differs because main already hardened its parser. The executable method uses the same bounded transport/provider seams; this is not a parser or runtime acceptance claim.

Only affected merged compatibility groups ran: 7 supplied and 8 independent PASS. The original accepted fixtures are unchanged on disk. The new pinned wrapper verifies exact policy/fixture/full-main-host hashes and extraction, substitutes exactly one old full-host hash guard in memory, and runs every original assertion. The three mutant groups are reused, not rerun: their executable policy/fixture/method/Node closure is unchanged. See closure-reuse.json, checkpoint.json and merged logs. Historical baseline failures and acceptance inspection incidents remain in retained evidence.

Exact tested tree: `'''+tested+'''`. Finalization adds only this report/evidence directory; final tree/commit and the checked docs-only relationship are recorded in ops/final-tree.json and publication.json. No code or test change follows the two compatibility passes. evidence-manifest.json binds all report payloads (excluding itself); accepted manifests bind imported evidence. Parent is pinned main, with accepted source/tests/evidence grafted exactly, avoiding unrelated donor production changes.

Recovery uses existing readonly flat object directories (readonly-objects.json), never a full-history fetch. The focused checkout materializes host, app-files, the three test fixtures and imported/own evidence; every other pinned-main Git tree entry remains intact. No ignored binary or runtime artifact is needed. From repo, serial finite recovery commands are:

```sh
COMPAT_FIXTURE=supplied timeout 30s node --max-old-space-size=16 --test --test-concurrency=1 test/app-files-accepted-merged-compat-oct26.cjs
COMPAT_FIXTURE=independent timeout 30s node --max-old-space-size=16 --test --test-concurrency=1 test/app-files-accepted-merged-compat-oct26.cjs
```

Resource manifests include task checkout/Git/temp/evidence, launcher/session growth, positive shared WAL growth once, 12 MiB future growth once and 8 MiB reserve inside 64 MiB. Initial fresh combined admission checked two 553648128-byte clients and two 58720256-byte growth allowances against the requested floors. Installed tools and borrowed flat objects are separately measured standing inputs. Serial Node heap is 16 MiB, file cap 24 MiB, output cap 128 KiB, capture cap 2 MiB; no build or native arena is allocated. See incidents.json for initial inspection excerpt deviations and ordinary integration corrections.

Remaining gates: coordinator review and current-main reconciliation after the sole main owner releases, then separately authorized browser persistence/runtime/gameplay acceptance. No main, public deployment, Boat, guest, service, restart, SSH runtime, monitoring change, worker, refill or resume. No box assigned: ID/state/expiry N/A; runtime shutdown remains coordinator-owned. Stop after task-branch exact remote verification.
'''
(doc/'REVIEW.md').write_text(report)
resources('prefinalization')
for name in ['admission.json','resources-precheckout.json','resources-validated.json','resources-precompatibility.json','resources-before-supplied.json','resources-before-independent.json','resources-postcompatibility.json','resources-prefinalization.json','readonly-objects.json','accepted-payload-verification.json','preservation.json','closure-reuse.json','tested-tree.json','checkpoint.json','merged-supplied.txt','merged-independent.txt','incidents.json','standing-tools.json','configuration.json','initial-root-ref-digest.json','integrate.py','compatibility.py','finalize.py']:
 shutil.copyfile(O/name,doc/name)
manifest={str(p.relative_to(R)):{'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in sorted(doc.iterdir()) if p.is_file() and p.name!='evidence-manifest.json'}
(doc/'evidence-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
git('add','--',review)
finaltree=git('write-tree').decode().strip()
changed=git('diff','--name-only',tested,finaltree).decode().splitlines()
assert changed and all(p.startswith(review+'/') for p in changed)
assert tree(finaltree)['lib/app-files.js']==tree(C)['lib/app-files.js']
assert git('diff','--name-only','--').decode().strip()==''
save('final-tree.json',{'testedTree':tested,'finalTree':finaltree,'docsOnly':True,'changedPaths':changed,'codeAndTestsUnchangedAfterPass':True})
resources('precommit')
git('-c','user.name=Wine Ops','-c','user.email=wine-ops@localhost','commit','-m','Integrate accepted empty-alias app-files fallback on pinned main')
commit=git('rev-parse','HEAD').decode().strip()
assert git('rev-parse','HEAD^').decode().strip()==MAIN
assert git('rev-parse','HEAD^{tree}').decode().strip()==finaltree
for p,item in manifest.items():
 b=blob(commit,p);assert sha(b)==item['sha256'] and len(b)==item['bytes']
save('commit.json',{'commit':commit,'branch':B,'parent':MAIN,'tree':finaltree,'testedTree':tested,'docsOnly':True,'reportManifestPayloadsVerified':len(manifest),'mainPublished':False,'remaining':['task branch push','exact remote verification','coordinator current-main reconciliation','browser/runtime/gameplay']})
print(json.dumps(json.loads((O/'commit.json').read_text())))
