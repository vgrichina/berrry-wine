from control import *
import shutil
admit('publication-prepare')
D=REPO/'test/toyvm-real-cli-file-limit-oct29';E=D/'evidence';E.mkdir(parents=True)
r=json.loads((ROOT/'remote-evidence/runtime.json').read_bytes());assert r['PASS']
b=r['cli']['backendReceipt'];f=b['filesystem']
assert [f[k] for k in ['liveLimit','writeLimit','fileLimit']]==[32768,65536,16384]
assert r['cli']['browserAllowanceRemaining']==dict(cpuSeconds=35.353183,wallSeconds=101.495550694,captures=1)
st=json.loads((ROOT/'stopped-final.stdout').read_bytes())['sandbox']
assert st['state']=='stopped' and st['stop']['status']=='completed' and st['snapshotAvailable'] and st['lastSnapshotStatus']=='completed'
creation=[json.loads(x) for x in (ROOT/'create.stdout').read_text().splitlines()]
expiry=next(x['archiveAfter'] for x in creation if 'archiveAfter' in x)
life=dict(box=st['id'],state=st['state'],originalExpiry=expiry,cutoff='2026-10-29T04:40:00Z',stoppedAt=st['stoppedAt'],snapshotCompletedAt=st['snapshotCompletedAt'],snapshotAvailable=st['snapshotAvailable'],stop=st['stop'],actualStoppedReceipt='stopped-final.stdout')
(ROOT/'lifecycle.json').write_text(json.dumps(life,indent=2)+'\n')
for p in (ROOT/'remote-evidence').iterdir():shutil.copyfile(p,E/p.name)
for n in ['prelaunch-controls.json','quota-preflight.json','git-readiness.json','dispatch-preflight.json','launch-configuration.json','box.json','create.json','create.stdout','create.stderr','runtime.json','runtime.stdout','runtime.stderr','preserve.json','stop.json','stop.stdout','stop.stderr','stopped.stdout','stopped-final.json','stopped-final.stdout','lifecycle.json','wal-baseline.json','operations.jsonl']:
 name='local-'+n if n=='runtime.json' else n
 shutil.copyfile(ROOT/n,E/name)
for n in ['control.py','limit_contract.py','create_once.py','remote_test.py','preserve_stop.py','publish_prepare.py']:shutil.copyfile(ROOT/n,D/n)
pins=json.loads((ROOT/'pins.json').read_bytes());(D/'source-pins.json').write_text(json.dumps(pins,indent=2)+'\n')
initial=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/toyvm-real-cli-file-limit-oct29/root-ref-digest.json')
shutil.copyfile(initial,E/'root-ref-digest.json')
limitations=[
 'Per-file gate qualification only; full resource enforcement, browser and gameplay remain unknown.',
 'Historical missing python alias, UTF-8 slice diagnostic and absent Git metadata from the prior output task remain historical procedural limitations; not rerun here.',
 'Initial policy/source inspections used direct shell outside the task-owned resource supervisor; one combined source inspection exceeded the requested terminal8192-byte presentation ceiling. No behavioral acceptance is inferred from those inspections.',
 'No guest mount argv or intended mounted guest files. No guest mount parser invoked, as prohibited by this task. Production argparse parsed actual CLI flags; Boat --file uploaded the enumerated text files. No comma-bearing upload paths.',
 'The first lifecycle info response was stopping/pending; an assertion stopped preservation script after the successful stop request. A later read-only info established completed snapshot-stop. No runtime or stop invocation was repeated.',
 'Per-operation admission samples and physical monitors do not prove all unobserved resource controls. Positive state WAL growth is counted once against initial baseline; shared coordinator allocations remain reserved.',
 'Process cleanup covers production-owned and externally observed PID/start identities; no external safety cleanup occurred.'
]
canonical=dict(task='toyvm-real-cli-file-limit-oct29',candidate='5a88ca099b962e946160afd2d4d71a950bf46db3',result='PASS: observed isolated production per-file rejection',productionInvocations=1,sourcePins=pins,CLIExit=r['exit'],accepted=r['cli']['accepted'],failure=f['failure'],stopReason=b['stopReason'],attemptedWrite=16385,acceptedWriteBytes=f['written'],maxPossibleLive=28672,filesystem=f,cleanupComplete=r['cli']['cleanupComplete'],filesystemCleanup=b['filesystemCleanup'],remainingIdentities=r['remainingIdentities'],remainingMounts=r['remainingMounts'],externalSafety=r['externalSafety'],browserAllowanceRemaining=r['cli']['browserAllowanceRemaining'],runtimeReceipt='runtime.json',runtimeSHA256=hashlib.sha256((E/'runtime.json').read_bytes()).hexdigest(),lifecycle=life,proceduralLimitations=limitations)
(E/'canonical-receipt.json').write_text(json.dumps(canonical,indent=2)+'\n')
report='''# Actual production CLI per-file rejection

On candidate `5a88ca099b962e946160afd2d4d71a950bf46db3`, exactly one unchanged
`qualify_accounted.py` CLI invocation used the synchronous FUSE backend on fresh
Boat `bx_38g4dtgr`. All five production pins were checked locally and at the
remote execution location before launch. Python and fusermount executables and
the 25-byte status socket path were checked remotely.

The confined Python workload opens one new `/tmp/tvfile/w/domain/profile`, calls
`os.write(fd, b"X"*16385)` once, and closes in `finally` if possible. There are no
payload retries, loops, additional payload files or output. Its cwd is the remote
repository; the absolute path is inside the sole authorized FUSE domain.

The exact separate flags are live 32768, write 65536, file 16384, RSS 134217728,
CPU 2, wall 5, output 4096. The pinned WRITE handler checks cumulative write,
then per-file size, then resize/allocation and mutation. Root and new inode
cost 8192; a hypothetically accepted 16385-byte dense payload rounds to 20480,
giving 28672 < 32768. The attempted 16385 < 65536 but exceeds file 16384.

Observed PASS: CLI exit 1, accepted false, backend failure and stop reason both
exactly `filesystem per-file limit`. Live and peak remained 8192, accepted
written bytes 0, two inodes, zero handles. The rejected file never accepted any
payload, including an oversized version. Backend child was terminated by the
production supervisor (exit -15); no different gate was reported. Unmount exit
0, server exit -15, no residual mount or owned observed PID/start identities,
cleanupComplete true. The 8-second outer safety guard did not act.

Raw CLI stdout/stderr, actual argv, backend counters, identity observations,
remote preflight, API responses and canonical receipt are in `evidence/`.
Only the per-file gate qualifies. Full resource/browser/gameplay remain unknown.
Browser allowance remains CPU 35.353183, wall 101.495550694, captures 1.

The explicitly delegated preservation and snapshot-stop completed; actual
stopped state and completed snapshot are verified in `stopped-final.stdout`.
Original expiry was 04:45:12.444 UTC and the task cutoff was 04:40 UTC.
No old box was reused; no other acceptance group was repeated.

Recovery: the scripts are the exact task-owned fixtures used, with absolute
task paths. They require the existing isolated checkout, pinned dispatch and
cancellation receipt. Do not rerun this task or reuse its work directory.
Reconstruction for a newly authorized task requires rebinding all task paths
and fresh dispatch/admission; production files must remain pinned and unchanged.
No clone, fetch, sparse expansion, main integration, or public deployment occurred.

Procedural limitations are retained in the canonical receipt. Initial policy
and source inspection preceded the guarded supervisor and one combined source
inspection exceeded terminal8192 presentation. The first post-stop info was
still stopping; a later read-only info confirmed stopped without another stop
or runtime invocation. Historical output-task procedural limitations are retained.
The task prohibits guest mount-parser execution and uses no guest mount argv.
Per-operation monitors do not establish all unobserved controls. The oversized
shared board is handled by a coordinator publication note, without append.
'''
(D/'REPORT.md').write_text(report)
manifest=[dict(path=str(p.relative_to(D)),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in sorted(D.rglob('*')) if p.is_file()]
(D/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
assert sum(p.stat().st_size for p in E.rglob('*') if p.is_file())<1048576
admit('publication-prepared')
print(json.dumps(dict(canonical=str(E/'canonical-receipt.json'),files=len(manifest),evidenceBytes=sum(p.stat().st_size for p in E.iterdir() if p.is_file()))))
