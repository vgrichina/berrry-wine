from control import *
limits();signal.alarm(60)
v=json.loads(read(DONOR.parent/'ops/preservation.json'))
for p,h in v['unchangedInputs'].items():
 q=pathlib.Path(p) if p.startswith('/') else R/p
 assert sha(q)==h,(str(q),'unchanged input mismatch')
assert sha('/tmp/maelstrom-native-latch-rejection-reason-oct26/ops/source-inputs.json')==v['standingSourceManifest']
inputs=json.loads(read('/tmp/maelstrom-native-latch-rejection-reason-oct26/ops/source-inputs.json'))
standing=[]
for f in inputs['files']:
 p=pathlib.Path('/tmp/maelstrom-native-latch-rejection-reason-oct26/ops/pinned-source')/f['path'];assert sha(p)==f['sha256'];standing.append(dict(path=str(p),sha256=sha(p),bytes=p.stat().st_size,allocated=blocks(p)))
for n in ['Maelstrom.exe','SDL_net.dll']:
 p=pathlib.Path('/tmp/maelstrom-frozen-original-recovered-capture-oct25/vfs/maelstrom')/n;standing.append(dict(path=str(p),sha256=sha(p),bytes=p.stat().st_size,allocated=blocks(p)))
p=pathlib.Path('/tmp/maelstrom-frozen-original-recovered-capture-oct25/runtime/system/msvcrt.dll');standing.append(dict(path=str(p),sha256=sha(p),bytes=p.stat().st_size,allocated=blocks(p)))
dump(O/'standing-source.json',standing)
for n in ['preservation.json','retained-preservation.json','retained-existing-latch.log','retained-existing-source.log','incidents.json','retained-historical-incidents.json','retained-historical-source-incidents.json']:
 shutil.copyfile(DONOR.parent/'ops'/n,O/('donor-'+n))
p=json.loads(read(O/'donor-retained-preservation.json'));assert p['passed']==1 and p['completeTransformByteIdentical'] and p['originalPinsAndOraclesIdentical']
dump(O/'retained-unaffected.json',dict(candidate=BASE,groups=20,model=13,sourceSnapshot=6,preservation=1,inputPins=v['unchangedInputs'],standingSourceManifest=v['standingSourceManifest'],reused=True,reason='Unaffected complete transform/select hook/source/binary/fixture inputs match prior passing exact-input receipts; no compilation or requalification. Initial coordinator admission independently verified all53 committed donor evidence artifacts.'))
checkpoint('retained-unaffected',dict(passAll=True,reused=True,groups=20),[p for p in v['unchangedInputs'] if not p.startswith('/')],['publication','cleanup'])
pins={p:sha(R/p) for p in ['tools/maelstrom-original-errno-adapter.cjs','tools/maelstrom-native-errno-latch.cjs','tools/maelstrom-select-completion-hook.cjs','test/maelstrom-terminal-callback-closure.test.cjs','test/maelstrom-adapter-scalar-anchor.test.cjs','test/maelstrom-status-event-validation.test.cjs','docs/reviews/maelstrom-state-acceptance-retained-closeout-oct26/remaining-independent.cjs']}
for p,h in pins.items():assert h==sha(DONOR/p)
assert git('tested-head','rev-parse','HEAD')==BASE
tree=git('tested-tree','rev-parse','HEAD^{tree}')
assert tree=='77bc9bfbcb460422df49bcedf0de2d682cbb7410'
assert git('tested-clean','status','--porcelain')==''
dump(O/'source-acceptance.json',dict(verdict='ACCEPT',candidate=BASE,testedTree=tree,repairAuthorsTestedTree='51daaa907df741d8cd77811feb1a9ef8ae3f28c5',pins=pins,review='Only production change is observe() setting closed=true for validated status4/status5 immediately before record(), which calls readLive then persist. Callback throw/reentry cannot bypass terminal closure. Snapshot materializes native/diagnostic/select scalars before callbacks, preserving detached historical values under export mutation. Closure leaves last-key deduplication and nonterminal behavior intact. Rejection still throws after successful persist; a callback throw preserves exact identity. No concrete defect found.',fixtureReconciliation=dict(original='ea00969e24722ff0946aef0e59e18ed8ed4d40f6123b6a23fdfd20b566341996',corrected=pins['test/maelstrom-adapter-scalar-anchor.test.cjs'],why='Prior correction retained byte-exact: status/event are finite reachable enums; unrestricted scalar endpoints retain signed/unsigned u32 normalization. Illegal enum endpoints must reject, not be accepted. No fixture edited. Historical13/3474 conflicting oracle remains historical; corrected13/3748 rerun passes.'),reportedCandidateFields='Older literal7508a8c2/ecd80560 in unchanged reproducer output are fixture metadata, not actual tested HEAD.',remaining=['publication','cleanup'],blockers=[]))
print('ACCEPT',BASE,tree,json.dumps(gate('source-accepted')))
