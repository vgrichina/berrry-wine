import pathlib,json,hashlib,shutil,zlib
H=pathlib.Path(__file__).parent;R=H.parent/'repo';D=pathlib.Path('/tmp/enigma-retained-review-budget-publication-oct27')
candidate='8ff456e70baa82386e4e51c22f7174409746d326'
obj=D/'repo/.git/objects'/candidate[:2]/candidate[2:]
assert hashlib.sha1(zlib.decompress(obj.read_bytes())).hexdigest()==candidate
view=H/'immutable-donor-object-view';(view/candidate[:2]).mkdir(parents=True,exist_ok=True)
(view/candidate[:2]/candidate[2:]).symlink_to(obj)
(R/'.git/objects/info/alternates').write_text(str(view)+'\n')
(R/'.git/config').write_text('''[core]
 repositoryformatversion = 0
 filemode = true
 bare = false
 sparseCheckout = true
[user]
 name = Wine Ops Worker
 email = wine-ops@local
[gc]
 auto = 0
[maintenance]
 auto = false
[remote "origin"]
 url = git@github.com:vgrichina/wine-assembly.git
''')
(R/'.git/info/sparse-checkout').write_text('/docs/reviews/enigma-review-budget-independent-accept-oct27/\n')
q=json.loads((H/'local-frame-slot/boundary.json').read_text())
assert q['outcome']['clicked'] and q['outcome']['reviewSecondsUsed']<.25
assert all(x['completed'] for x in q['reviews']) and q['supervisor']['remainingOwnedLive']==[]
assert q['supervisor']['childReturncode']==-15
for p in ['first-boundary','adequate','local-frame-slot']:
 r=json.loads((H/(p+'.json')).read_text());assert r['exit']==0 and not r['stopReason'] and r['cleanupComplete']
out=R/'docs/reviews/enigma-review-budget-independent-accept-oct27';out.mkdir(parents=True)
report=dict(status='REJECT',candidate=candidate,sourcePins=json.loads((D/'ops/receipt-manifest.json').read_text())['sourcePins'],
 canonicalDonorManifest=str(D/'ops/receipt-manifest.json'),
 production='Exact pinned Python main --launch-config, actual supervisor-owned offline Python child/listener/HTTP, synthetic640x480 images, controlled clock only; no Node/guest/Boat/API',
 firstBoundary='Unchanged original-reproducer SHA6665d61da745a7c33546b15b73f5311ccda51b6f978d6905f1e455ab06fea461: original28s exhausts, review completion [true,false], no input; PASS',
 positive='Explicit34s [16,18] reviews both complete; exactly one click; every step fully ACKed then matching frozenzero snapshot; final quit; PASS',
 rejection=dict(firstSlotSeconds=.25,productionFrameReadSeconds=2,reviewSecondsUsed=q['outcome']['reviewSecondsUsed'],clicked=True,reason='capture() reads and persists full frame before review() starts clock. Full-frame read latency debits neither checkpoint review slot nor cumulative review allowance.',smallestCommand=['python3','test/fixtures/enigma-controller/independent-transfer.py','--boundary','NEW_OWNED_DIRECTORY','34','{"checkpoint_seconds":[0.25,33.75],"progress_seconds":45}'],instrumentation='Path.open context proxy advances only controlled time by2 after production bounded read(700001) of first menu PNG; no decision, controller, supervisor, ACK or authority replacement. Fixture read_bytes(-1) is undelayed. Socket timeout is not simulated or bypassed; latency occurs at local full-frame read after HTTP response.'),
 retainedPriorReceipts='Canonical donor exact-pin groups reused, not rerun. Includes prechild cumulative/wall/ready/capture incompatibility, slot theft, cumulative CPU/API/capture/deadline and corrected float-only evidence IO assertion. No independent pass claimed for unresolved broader checks after rejection.',
 remaining='Reject source integration/runtime until full-frame capture/read and durable capture evidence debit the advertised slot and cumulative allowance; independently retest affected boundary. No source repair in this task.',
 incidents=['Initial combined read displays exceeded8192B; transcript retained.','First transfer fixture modeled delay inside HTTP open hook; preserved transfer-slot evidence, refined once to production bounded local frame read to distinguish socket timeout.'],
 cleanup=dict(allSupervisedOperationsCleanupComplete=True,remainingOwnedLive=[],assignedBoxes=[],lifecycleAction='none; coordinator retains lifecycle',boardWatcher='tool session11406; stop at closeout'),
 publication=dict(reportOnlyOrphan=True,neverMergeWholeTree=True,branch='task/enigma-review-budget-independent-accept-oct27',mainOwnership=False))
(H/'independent-rejection.json').write_text(json.dumps(report,indent=2)+'\n')
shutil.copy2(H/'independent-rejection.json',out/'independent-rejection.json')
for name in ['tools','test/fixtures/enigma-controller']:
 dst=out/'reproducer'/name;dst.mkdir(parents=True)
 for p in (R/name).glob('*.py'):shutil.copy2(p,dst/p.name)
for name in ['first-boundary','adequate','transfer-slot','local-frame-slot']:
 src=H/name
 if src.is_dir():shutil.copytree(src,out/'evidence'/name)
for p in H.glob('*'):
 if p.is_file() and p.suffix in ('.py','.json','.stdout','.stderr'):
  shutil.copy2(p,out/p.name)
manifest={str(p.relative_to(out)):hashlib.sha256(p.read_bytes()).hexdigest() for p in out.rglob('*') if p.is_file()}
(out/'evidence-hashes.json').write_text(json.dumps(manifest,indent=2)+'\n')
(out/'.gitattributes').write_text('evidence/** -whitespace\n*.stderr -whitespace\n')
print('PASS independent rejection assertions, source pins, report closure',len(manifest))
