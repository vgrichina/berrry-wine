# NFS3 initial Pause consumer correction, 2026-11-13

Code inspection and a focused actual-adapter reproduction found a distinct
initial-Pause failure in parent `16359a939`: the trusted keyboard edge observer
was installed only by Continue/resume. On a fresh page, initial Escape could
dispatch and release normally, then fail `trusted DOWN required` because no
observer existed. The controller would terminate and close Chrome before fresh
native Pause could be reviewed. The four parent initial-Pause model cases did
not exercise this adapter behavior.

The corrected run-local `emitted-adapter.cjs` installs/resets the observer inside
each hold's identity admission, before the unchanged independently armed release
helper and DOWN. Each hold now requires its own witnessed edges. This also
prevents an earlier hold's trusted edges from satisfying the next hold. The
candidate references the retained parent helper closure explicitly; parent files
are unchanged. This is a run-local controller correction, with no production
emulator change and no locked build required.

Evidence: `scratch/runs/20261113-nfs3-positive-controller-0020/`.
`adapter-tests.json` reproduces the failure using the actual parent adapter and
verifies the corrected adapter's first Escape ordering, missing-UP refusal, and
identity replacement refusal before DOWN. Its VM event target, native hold and
capacity are simulated. It proves consumer ordering only: no Chrome input,
actual release subprocess, native Pause, or positive live transaction was
exercised. Original identity, freshness, single-use review, independent release,
deadline and terminal UNKNOWN guards remain required and unchanged.

All 105 parent sealed artifacts, 35 retained proofs, all 133 existing media plus
EXE/manifest were rehashed without rerunning qualification matrices. The exact
1500ms HELD evidence is retained; 200ms overlap remains terminal UNKNOWN, with no
retry or promotion of historical 82 MPH. The parent raw failed-success report
and historical uncertain joins remain unchanged. Git SHA, relevant binary diff,
new-helper addition patches and hash inventory preserve this candidate without a
source or media archive.

Actual `/home` free space was 1,482,260,480 bytes at the admission decision,
below the strict 1,500,000,000-byte floor. No allocation, original provisioning,
native race input or floor waiting loop occurred. Box ID **NONE**, state
**NOT_CREATED**, expiry **null**, normal-stop receipt **N/A**. No box watchdog was
started because no box was created; inherited boxes were untouched.

Live positive controller qualification, native Single Race Paused/Continue with
two settled full frames and stable observed world/timer, two separately reviewed
bend consequences, and naturally earned lap/result remain UNPROVED. Next, once
actual capacity permits, use this corrected adapter in a newly frozen closure;
prearm an observable independent box deadline before creation, complete the
published current04/original-EXE/all133-media explicit-range staging and compact
consumer provision with whole SHA and actual parent/EOF join, then establish
fresh native Pause and authorize one finite reviewed transaction at a time.
No mock Pause UI or Boids state is native Pause proof. No GPU/FPS/audio/parity or
full27 claim is made.
