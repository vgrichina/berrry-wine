from control import *
admission('receipt')
rc,a,b=run(['python3','/home/user/wine-assembly/scratch/usage-watch/stream-root-ref-digest.py'],cwd=R,env=E,label='root-ref-final');assert rc==0,b
final=json.loads(a);initial=json.loads(Path('/home/user/wine-assembly/scratch/usage-watch/save-sync-owned-upload-accepted-integrate-oct25/root-ref-digest.json').read_text());assert final['sha256']==initial['sha256']
save('root-ref-comparison',dict(initial=initial,final=final,unchanged=True))
save('configuration',dict(ssh=SSH,ownObjects=str(R/'.git/objects'),ownObjectsDistinct=True,donorsReadonly=True,flatLeaves=leaves,nonrecursive=True,mountArgv=[],intendedMountedFiles=[],canonicalParser='inapplicable: no mounts, runtime or guest argv',rootReadonly=True,base=BASE))
# Validate external seals once more and the committed review copies.
seals=json.loads((DONOR.parent/'ops/evidence-manifest.json').read_text())
for v in seals:assert sha(DONOR.parent/'ops'/v['name'])==v['sha256']
reviewdir=R/'docs/reviews/save-sync-upload-independent-accept-oct25'
for p in reviewdir.iterdir():
 if p.is_file():assert git('hash-object',str(p)).strip()==git('rev-parse',REVIEW+':'+str(p.relative_to(R))).strip()
save('accepted-inputs-final',dict(candidate=CAND,review=REVIEW,externalSealsVerified=len(seals),committedReviewFilesVerified=sum(p.is_file() for p in reviewdir.iterdir()),sourceUnchanged=True))
(OUT/'RECOVERY.md').write_text('''Accepted unchanged save-sync candidate integrated into main. publication.json binds pre-main, candidate, independent review, merge, tested tree, source hashes and strictSSH verified refs. Main and task branch were pushed normally and atomically; subsequent receipt commit updates only the task branch.

Reproduce from the merged commit with ACCEPT_REPO set to the checkout: node --max-old-space-size=128 --test test/test-save-sync-owned-upload.js (15); node --max-old-space-size=128 docs/reviews/save-sync-upload-independent-accept-oct25/independent.js (13); node --max-old-space-size=128 test/test-save-sync-upload-validation.js; node --max-old-space-size=128 docs/reviews/save-sync-upload-independent-accept-oct25/offline.js (47 URL/deadline checks only); node --max-old-space-size=128 test/test-vfs-overlay.js (20); node --max-old-space-size=128 --test test/test-d3d9-immutable-rgba-snapshot.js (6). tests.json records all actual commands/results including syntax. Four rejecting controls are reused from exact sealed unchanged review/source fixtures. No real server/save writes or browser/native/guest/wasm/compiler/GPU/gameplay acceptance.

Use own writable .git/objects with explicit validated readonly nonrecursive leaves in configuration.json; never recursive alternates/full clone/repack. Own shallow boundary is base397cdb6c. run.py/control.py retain bounded supervision/admission. Donors and root tracked/index/refs remain readonly. No mounts exist: canonical mount-parser checkpoint inapplicable. Dedicated trusted SSH is exact in configuration.json; no trust edits, Boat/SSH access, or retry of actual platform SSH403. No public deployment or service restart. No assigned box; coordinator owns lifecycle, protected boxes untouched, Claude idle. No agents/workers or successor.

Retained internal diagnostics: fetch traversed a malformed standing .alternate reference; pinned remote refs already verified, so recovered locally instead of retrying. Earlier flat views missed recent overlay review objects. Added their existing original nonrecursive leaves and reconstructed exact missing docs tree from readonly renderer donor index after excluding its receipt-only additions; verified recovered tree hash and each copied blob. recovery-doc-blobs.json/recovered-doc-blobs.json (the latter is actual file) records exact source paths/OIDs. All intended tree objects passed closure before normal publication. Sparse overlay file restored from unchanged index. Accepted evidence whitespace is retained byte-for-byte; production source diff is whitespace-clean. No semantic source expansion.

Task ALL-new cap64MiB includes own objects/checkout/evidence/publication/session/launch/sharedWALSHM/positiveDBgrowth/futures plus8MiB reserve. Installed tools and standing readonly bytes are not double-counted. Final future allowance8MiB covers remaining publication/capture/session/shared growth after checkout completed; initial24MiB projection rejected increased shared WAL and was replaced by measured remaining work, preserving the cap. Node heap128MiB, CPU/wall60s per focused command, file24MiB, combinedcapture128KiB/cumulative2MiB, TERM2/KILL3/reap5s. Admission receipts record fresh RAM>=1GiB and free disk>=2982150144 after projected growth. No runtime claim.
''')
pub=json.loads((OUT/'publication.json').read_text())
save('result',dict(decision='ACCEPT AND INTEGRATED',**pub,tests=json.loads((OUT/'tests.json').read_text()),acceptedSeals=len(seals),rootRefsUnchanged=True,unrelatedAcceptedSourcePreserved=True,blockers=[],box=dict(id=None,state='not assigned',expiry=None,lifecycleOwner='coordinator'),limitations=['Offline JS fixtures only; no real-network saves, storage durability, browser, runtime or gameplay acceptance','No deployment/restart/BoatSSH/guest/wasm/compiler/heavy execution'],recovery='RECOVERY.md'))
# Committed receipt contains reviewable bounded evidence, not indices/raw inventories.
selected=['RECOVERY.md','result.json','publication.json','merged-tree.json','tests.json','closure.json','configuration.json','standing-inputs.json','accepted-inputs-final.json','root-ref-comparison.json','recovered-doc-blobs.json','doc-tree-recovery.json','whitespace-decision.json','accepted-whitespace.json','source-whitespace.json','admission-checkout.json','admission-checkout-recovered.json','admission-recover-doc-tree.json','admission-tests.json','admission-publication.json','admission-push.json','admission-receipt.json','run.py','control.py','resume.py','recover-doc-tree.py','tests.py','publish.py','receipt.py','remote-before.json','main-before-push.json','remote-after.json','push-main-and-task.json','fetch.json']
selected += [k+'.json' for k in json.loads((OUT/'tests.json').read_text())['results']]
manifest={n:dict(bytes=(OUT/n).stat().st_size,sha256=sha(OUT/n)) for n in selected}
save('evidence-manifest',manifest)
dest=R/'docs/reviews/save-sync-owned-upload-accepted-integrate-oct25';dest.mkdir(parents=True,exist_ok=True)
for n in selected+['evidence-manifest.json']:shutil.copyfile(OUT/n,dest/n)
with (R/'.git/info/sparse-checkout').open('a') as f:f.write('/docs/reviews/save-sync-owned-upload-accepted-integrate-oct25/\n')
git('add','--',str(dest.relative_to(R)))
assert all(p.startswith(str(dest.relative_to(R))+'/') for p in git('diff','--cached','--name-only').decode().splitlines())
git('diff','--cached','--check',label='receipt-whitespace')
git('commit','-m','docs(save-sync): record accepted exact-tree integration and verification',label='receipt-commit')
commit=git('rev-parse','HEAD').decode().strip();assert git('status','--porcelain')==b''
admission('receipt-push')
git('push','origin',commit+':refs/heads/'+BRANCH,label='receipt-push')
refs=git('ls-remote','--exit-code','origin','refs/heads/main','refs/heads/'+BRANCH,label='receipt-remote').decode().splitlines();refs={x.split()[1]:x.split()[0] for x in refs}
assert refs['refs/heads/main']==pub['merged'] and refs['refs/heads/'+BRANCH]==commit
for n,v in manifest.items():assert git('hash-object',str(dest/n)).strip()==git('rev-parse',commit+':'+str((dest/n).relative_to(R))).strip()
save('publication-complete',dict(**pub,receiptCommit=commit,receiptRemote=refs['refs/heads/'+BRANCH],receiptVerified=True,committedEvidence=str(dest.relative_to(R)),evidenceSeals=len(manifest),ownIndexClean=True,rootRefsUnchanged=True))
admission('final')
print(json.dumps(json.loads((OUT/'publication-complete.json').read_text())))
