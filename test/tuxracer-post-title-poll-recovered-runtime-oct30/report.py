import control as c, pathlib, json, hashlib, time, os
O=c.O; P=O.parent; I=P/'input-consumption'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
denial=json.loads((O/'snapshot-recovery-denial.json').read_text())
mount=json.loads((P/'same-task-mount-validation.json').read_text())
assert sha(pathlib.Path(mount['receipt']['path']))==mount['receipt']['sha256']
assert mount['PASS'] and len(mount['files'])==157
assert mount['receipt']['argv']==['--app=tuxracer_original_061a']
assert sha(I/'run.pinned.js')=='f96e9bb924700ee571e2904e097f80742ff55638399898ae1dc32454af05b02d'
b=(I/'main-scheduler-observer.js').read_bytes()
assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()=='93fac2a4a2ecea2bf8891f01f9a814a589e36b80'
pins={str(p):dict(bytes=p.stat().st_size,sha256=sha(p)) for p in [I/'main-scheduler-observer.js', I/'README.md', I/'boundary-run.pinned.js.json', I/'boundary-run.current.js.json', I/'regression-controls.json', I/'publication.json', P/'source-manifest.json',P/'limit-controls.json',P/'remote-worker.py',P/'control.py',pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/tuxracer-index-recovery-compaction-oct30.json')]}
assert json.loads((I/'boundary-run.pinned.js.json').read_text())['PASS']
assert json.loads((I/'boundary-run.current.js.json').read_text())['PASS']
assert all(x['rejected'] for x in json.loads((I/'regression-controls.json').read_text()).values())
assert len(json.loads((P/'source-manifest.json').read_text())['inputs'])==141
c.save('preflight.json',dict(status='BLOCKED',pins=pins,mount=dict(receipt=mount['receipt'],count=len(mount['files']),commaFiles=mount['commaFiles'],configurationUnchanged=True,reusedParserReceipt=True),boundaryTests='unchanged passing receipts reused; not rerun',canonicalInputs=141,moduleVerified=False,completeClosure=False,API16KiBSmoke='not reached: no new Boat created',nodeStartup='not reached',guestRuns=0))
c.save('lifecycle.json',dict(newBoat=None,provisioned=False,guestRuns=0,newRenders=0,oldBoxes='not resumed/forked/execed or otherwise mutated',shutdownRequired=False,reason='Exact module prerequisite failed before authorized creation; no new allocation to snapshot-stop',localChild=dict(snapshotPull='terminal -25 SIGXFSZ, waited/reaped by retained supervisor',partial='hashed and removed',recoveryDirectoryExists=(O/'recovery').exists())))
assert not (O/'recovery').exists()
(O/'README.md').write_text('''# Tux Racer selected-module snapshot recovery blocked

No new guest run, renders, compilation or Boat allocation occurred. Polling stop,
scheduler gating and queue consumption remain undistinguished; cause is unknown.
The tested diagnostic dbabdfc2 and retained runner were unchanged. Existing
source-boundary acceptance is referenced only, not repeated or called runtime.

The coordinator compacted two inactive indexes losslessly. Fresh complete-root
allocation passed for selected module1884160 allocated bytes, PNG cap512KiB,
compact report256KiB and8MiB reserve inside64MiB. All standing roots and current
launch events were counted, including the compressed indexes. See the immutable
allocation-before-recovery.json; the old allocation denial remains untouched.

One supported `boat --no-update --json snapshot pull
40ad564a-7673-4d96-8842-a6163a971d0f --path
/home/user/tuxracer-render/build/wine-assembly.wasm --out <owned>/recovery`
was attempted under unchanged CPU90/wall120, file12MiB/capture512KiB and retained
Python128MiB/group512MiB guards. Although extraction selects one file, the CLI
materialized `.sandbox-snapshot-pull-tmp/layer-2.tar.zst` and was terminated by
SIGXFSZ25 at12582912 bytes after6.84s. No stdout/stderr was produced. The module
was never extracted; its required SHA256 remains unverified this task.

The hidden intermediate caused measured allocation68472832 bytes, exceeding the
64MiB budget by1363968 bytes (and consuming the reserve). Initial projection
incorrectly assumed selected-file pull avoided a full-layer temporary. The
partial layer was hashed before removal; its exact identity, argv, first terminal
status, wrapper limits and overage are retained in snapshot-recovery-denial.json.
No retry, workaround, limit change or larger download was attempted. Empty
recovery directories were removed; original sources/indexes/artifacts are intact.

Next prerequisite: supply the accepted1881806-byte module SHA256
5a39225e1a8381ce1c4530d2ce7cd6311bd75576d10968c20e963baf033d41eb
through a supported route with measured intermediate storage fitting the local
allocation and12MiB file limit. Selected snapshot extraction alone does not meet
that contract. Do not retry unchanged, compile, resume an old box or infer a
guest fault. Once exact local closure exists, create one authorized TTL1800 Boat,
perform small supported API smoke on its explicit new ID, then use the exact
README command/runner with observer-only replacement and unchanged runtime limits.
Preserve/inspect new PNGs and verify snapshot-stop before publication, as delegated.

No new runtime lifecycle obligation exists. Main/donor indexes and refs were not
edited; publication adds only this compact blocker report to the new task branch
with parent134e3cd6. Existing original-game SIGXCPU90 does not establish cause.
''')
c.save('report-validation.json',dict(PASS=True,denialPreserved=denial['operation']['exit']==-25,partialRemoved=not pathlib.Path(denial['partial']['path']).exists(),noNewBoat=True,noRuntime=True,pinnedRunnerVerified=True,mountReceiptVerified=True,boundaryReceiptsReused=True,sourceChanged=False))
print(json.dumps(dict(status='BLOCKED_BEFORE_PROVISIONING',cause=denial['cause'],pins=len(pins),newBoat=None)))
