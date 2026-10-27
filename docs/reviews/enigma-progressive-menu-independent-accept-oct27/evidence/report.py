import hashlib,json,pathlib,shutil,time,os
B=pathlib.Path('/tmp/enigma-progressive-menu-independent-accept-oct27');O=B/'ops';R=B/'repo';D=R/'docs/reviews/enigma-progressive-menu-independent-accept-oct27';D.mkdir(parents=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def dump(p,v):p.write_text(json.dumps(v,indent=2)+'\n')
pins=json.loads((O/'pinned-inputs.json').read_text())
assert all(sha(R/p)==s for p,s in pins['pins'].items())
required=['boundary','adversaries','ownership','budgets','mutations-v2','final-fresh','measured-cpu']
for name in required:
 s=json.loads((O/(name+'-supervision.json')).read_text());assert s['exit']==0 and s['stopReason'] is None and s['cleanupComplete'],(name,s)
dump(O/'acceptance-checkpoint.json',dict(status='ACCEPT_SOURCE_ONLY',candidate=pins['candidate'],sourceBaseline=pins['sourceBaseline'],pins=pins['pins'],unchangedProductionBoundary='test_progressive.ProgressEntryTests.test_loading_to_menu_production_boundary',firstBehavioralOperation='boundary',passingOperations=required,reusedAffectedMethods=44,reusedReceipt='candidate docs/reviews/enigma-progressive-menu-corrected-source-repair-oct27/evidence/acceptance-checkpoint.json and evidence manifest 1bf93b85073662bcebe3b8a1f6c28e589c2335af775994b700e329c94b4d5abb; coordinator verified all802 payloads',freshMethods=10,rejectingMutations=9,remaining=['actual Enigma menu','Start Game with actual externally reviewed image','gameplay','ordinary in-game Quit','coordinator-owned scoped integration'],guestInvocations=0,nodeExecutions=0,boxes=[],main=False,deploy=False))
dump(O/'operation-source-pins.json',dict(finalTestSHA256=sha(O/'independent.py'),initialTestSHA256=sha(O/'independent-v1.py'),supervisorSHA256=sha(pathlib.Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')),candidatePins=pins['pins'],description='Production method receipts remain valid: subsequent test-file edits only add fresh test methods or mutation harness handling. Candidate implementation and all11fixtures unchanged. Initial failing mutations retained as redundant-guard oracle setup incident; final compound approval mutants remove both guards, never weaken assertions. Commands/config/env-safe hashes/inherited limits in per-operation JSON. No Node configuration executed.'))
E=D/'evidence';E.mkdir()
for p in sorted(O.rglob('*')):
 if not p.is_file() or p.name=='board-watch.log':continue
 target=E/p.relative_to(O)
 if p.suffix in ('.stdout','.stderr'):target=target.with_name(target.name+'.bin')
 target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,target)
source=pathlib.Path('/tmp/enigma-progressive-menu-corrected-source-repair-oct27')
for name in ['result.json','final-affected-supervision.json']:
 shutil.copyfile(source/'ops'/name,E/('reused-'+name))
shutil.copyfile(source/'repo/docs/reviews/enigma-progressive-menu-corrected-source-repair-oct27/evidence/acceptance-checkpoint.json',E/'reused-acceptance-checkpoint.json')
for name in ['enigma-progressive-menu-independent-accept-oct27-admission.json','enigma-progressive-menu-independent-accept-oct27/root-ref-digest.json']:
 p=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch')/name;shutil.copyfile(p,E/p.name)
(D/'README.md').write_text('''# Enigma progressive menu independent acceptance

ACCEPT SOURCE ONLY candidate `9fb63a8ca3b56880321aabfa507a2c0aee61cb4a`, baseline `b160b5403e69f28e92e218849cc8165c67776bd2`. This baseline is not current-main identity. No implementation changes or integration are included.

The first behavioral operation ran the unchanged production Python supervisor CLI reproducer through its exclusive owned synthetic listener. Loading-to-menu, every all-requested-batches ACK plus matching frozen-zero snapshot, later-frame approval, input and after-image reserve passed. The complete production JS runner was hashed, never executed. The unchanged original-owner-live attack passed: copied config, altered URL/PID/sibling inherited listener and renewed schedule cannot attach, issue HTTP or renew authority. Original supervisor lifecycle and public attach refusal remain mandatory.

Fresh production adversaries reject partial/duplicate/wrong-batch ACK, nonzero frozen credits, wrong image dimensions, stale hash/batch and missing external approval without input or blind wire cleanup. Four repeated full-size loading images never grant Start Game; their transport quit is cleanup only. Private scheduler tests separately cover stale loading decisions, cumulative CPU/API/capture/wall/batch and review allowance across checkpoints, uncertain snapshots/disconnect without replay or overlap, and retained action/after-image/cleanup reserves. Nine rejecting in-memory guard mutations establish sensitivity for approval binding, cumulative review/CPU/API/capture reserves, ACK and frozen snapshot checks. These private unit adapters do not establish production authority.

A fresh real production Python CLI case burned at least0.12 CPU seconds in a waited descendant before listener readiness: original budget reported19.63 CPU seconds left from20, outcome retained0.24 descendant-tree CPU seconds, both distinct stdout/stderr sentinel streams survived, and no owned live process remained. CPU/RSS/listener observations are sampled; procfs checks are not atomic isolation against same-UID internal mutation. No stronger security claim is made.

Ten fresh final passing methods (including two unchanged production regressions) plus44 unchanged affected method receipts are accepted by exact11source/fixture hashes. The successful final prior receipt exit0/cleanupComplete true is copied; all earlier prior failures remain in the immutable candidate report. Initial independent mutation meta-tests failed because a second immediate pre-input guard still correctly rejected forged hash/batch approvals. The first test source and stdout/stderr remain; compound mutations remove both checks and pass the unchanged rejection assertions. Optional missing-file reads and initial truncated discovery are recorded as setup incidents, not candidate failures.

`evidence/acceptance-checkpoint.json` gives all pins and remaining gates. `evidence/independent.py` is the executable independent suite; exact commands, safe environment hashes, inherited limits, trusted-supervisor receipts, full controlled wire/capture evidence and cleanup are retained. Raw stdout/stderr copies use `.bin` suffixes for byte preservation. Reproduction uses the original absolute task path and the supplied light execution pool/trusted supervisor (`ops/execute.py`, per-operation JSON); synthetic children only. Source supervisor05326027c821b39960e3417c86786d06a8c824b7fcd731d7c3586b59a5ce40a4, controller2c8d064d21e3d4c86b099591f076115b622450eb76371844324ee8be645f6beb, full JS6dc104b3c10db701c0b1aec5954dd00cc29a7b6009970a5876ccc27426e7fa9e.

Actual Enigma menu, actual Start Game, gameplay and ordinary in-game Quit require separately admitted runtime acceptance. This report authorizes neither main publication nor deployment. Airstrike owns serialized main integration. Root tracked/index/refs and immutable donors stayed read-only; no workers or boxes were launched. Task-branch publication records are retained separately in task ops and the append-only repository messageboard.
''')
manifest=[dict(path=str(p.relative_to(D)),bytes=p.stat().st_size,sha256=sha(p)) for p in sorted(D.rglob('*')) if p.is_file()]
dump(D/'evidence-manifest.json',manifest)
print(json.dumps(dict(verdict='ACCEPT_SOURCE_ONLY',payloads=len(manifest),bytes=sum(r['bytes'] for r in manifest),manifestSHA256=sha(D/'evidence-manifest.json'))))
