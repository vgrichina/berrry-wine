"""Bounded owned publication report and resource checkpoint."""
import hashlib
import json
import os
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def main():
    evidence = HERE / 'evidence'
    evidence.mkdir(exist_ok=True)
    for name in ['independent-accept.json', 'independent-accept.stdout', 'independent-accept.stderr', 'initial.stderr']:
        (evidence / name).write_bytes((ROOT / 'e' / name).read_bytes())
    for name in ['prelaunch-controls.json', 'git-readiness.json', 'quota-preflight.json', 'dispatch-preflight.json']:
        (evidence / name).write_bytes((ROOT / name).read_bytes())
    launch = json.loads((HERE / 'inputs/launch-config.json').read_text())
    files = [launch['argv'][i + 1] for i, v in enumerate(launch['argv']) if v == '--file']
    expected = [x['remote'] + '=' + x['local'] for x in launch['files']]
    assert files == expected and len(files) == 9
    assert launch['guestMountArgv'] == [] and launch['mountParserApplicable'] is False
    assert not any(',' in x for x in files)
    assert launch['trustedSSH'] == 'ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
    (evidence / 'launch-reuse.json').write_text(json.dumps(dict(PASS=True, exactFiles=expected,
        parserApplicable=False, noNode=True, noNewExecution=True, trustedSSH=launch['trustedSSH']), indent=2) + '\n')
    v = os.statvfs(ROOT)
    wals = {str(p): p.stat().st_blocks * 512 for p in Path('/home/user/.codex').glob('*sqlite-wal')}
    r = dict(freeBytes=v.f_bavail*v.f_frsize, device=os.stat(ROOT).st_dev,
             f_bavail=v.f_bavail, blockSize=v.f_frsize,
             ownedAllocated=sum(p.stat().st_blocks*512 for p in ROOT.rglob('*') if p.is_file()),
             positiveWALGrowthCountedOnce=True, WALAllocatedCurrent=wals,
             limitation='No independently measured launcher-startup WAL baseline. Existing transferred aggregate reservation retains WAL8MiB and uncertainty9MiB; do not infer startup compliance from this snapshot.')
    (evidence / 'publication-resources.json').write_text(json.dumps(r, indent=2) + '\n')
    report = '''# Sparse-offset rejection: independent scoped acceptance

Candidate `5a88ca099b962e946160afd2d4d71a950bf46db3` is accepted only for the retained sparse-offset allocation rejection. There were zero new runtime invocations. The predecessor remote `281f11d90469335bc51b4fdd8958a78d5a57eb01` and actual snapshot-stopped Boat receipt were independently verified by the coordinator before dispatch; this task does not claim another remote/runtime verification of that predecessor.

The first behavioral checkpoint consumed the original API envelope, original raw runtime result and exact production CLI argv with unchanged fixture. It did not trust the observer gatePASS boolean. All five production sources match dispatch byte/hash pins. Execution-location before/after source identities, actual CLI output and source-owned confinement/FUSE argv agree. The retained manifest binds the selected original payloads; the complete predecessor manifest verification is reused from the coordinator. Source/fixture pins and selected manifest digest are in canonical.json. Raw evidence and original limitations are preserved under inputs/.

Root metadata4096 + empty linked A metadata4096 =8192. The one-byte pwrite at8191 requires dense payload8192, making attempted live16384 exceed12288. File limit8192 and cumulative write limit65536 allow the syscall size. Independently checked production AST order charges before data growth, write mutation and written increment. This is source inference, not an instantaneous rejection measurement.

Actual retained CLI exit1, accepted=false, reason `filesystem allocation limit`; post-reap live8192, peak8192, written0, inodes2, handles0. The exact flushed marker records attemptedOffset8191, attemptedBytes1 and initialSize0. All three observed PID/start identities were absent or reused, the production-owned set matches observed identities, and the mount was disconnected with successful unmount and no external safety cleanup. Direct syscall errno is absent.

Thirteen independent rejecting controls cover wrong guard, counter mismatch, stale PID/start, missing owned identity, remaining mount, changed source-after identity, changed offset argv, missing/stale marker, source wrong guard, dense rounding, offset arithmetic and charging after payload growth. These are offline evidence/source tests, not additional runtime acceptance. No production source was repaired or modified.

Run `python3 -B /tmp/toyvm-sparse-offset-runtime-independent-accept-oct29/ops.py independent-accept python3 -B test/toyvm-sparse-offset-runtime-independent-accept-oct29/accept.py` from the owned repository with original inherited DATA hard>=256MiB/infinity. The child never configures its parent or imports predecessor supervisors. Original supervised PASS outputs are retained in evidence/. The test intentionally checks original raw evidence availability as well as retained copies.

No Node or filename-bearing guest mount argv exists; the unchanged nine-file Boat staging receipt is checked and reused, enumerating every exact file. No parser invocation or Node startup is claimed. Trusted Git SSH identity, known-hosts file and strict verification are unchanged. The supplied process limits and per-operation aggregate admission remain: parent softDATA128/original hard unchanged, Python128/Git256, physical parentRSS128/group512MiB, CPU90/wall120/file12MiB/capture2MiB/evidence1MiB; transferred allocation24MiB sourceGit3/evidence1/WAL8/publication3/uncertainty9. Physical admission receipts are in evidence/; original prelaunch and WAL-baseline procedural limitations remain. This worker has no launcher-startup WAL baseline, so cannot strengthen that claim. Existing recursive alternate warnings are retained unchanged in evidence/initial.stderr; successful Git exit does not remove them. No general hook validation is claimed.

The earlier sparse wrapper remains BLOCKED_BEFORE_RUNTIME with zero invocations. No browser/gameplay/general resource qualification, media operation, broader matrix, runtime replay, main integration or public deployment occurred. Browser allowance remains unchanged and browserAllowed=false. Boat bx_nsk7cdtr is retained snapshot-stopped (original expiry2026-10-29T05:50:03.297Z); this task performed no lifecycle operation. Coordinator retains ownership. Publication is task-branch only; the coordinator owns oversized root messageboard delivery via the bounded task-owned note.
'''
    (HERE / 'REPORT.md').write_text(report)
    manifest = {str(p.relative_to(HERE)): dict(bytes=p.stat().st_size, sha256=hashlib.sha256(p.read_bytes()).hexdigest())
                for p in HERE.rglob('*') if p.is_file() and p.name != 'manifest.json'}
    (HERE / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps(dict(PASS=True, files=len(manifest), ownedAllocated=r['ownedAllocated'], launchFiles=len(files))))


if __name__ == '__main__':
    main()
