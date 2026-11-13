# Browser-qualified D3DIM lost-context readback

Run: `scratch/runs/20261113-webgl-browser-1500/`.
Prepared WIP: parent note commit `4faf5236902aa78025790af65e45611eaeaf33d9`;
the three claimed production/test files initially matched its recorded hashes.
Actual Chrome: `151.0.7922.108`, WebGL2 with ANGLE SwiftShader.
This is renderer qualification, with generated in-memory surfaces, no guest
media and no application gameplay or 27-app promotion.

The control loads `65dbc2e75:lib/d3dim-gpu.js` into the browser without changing
the shared checkout. It reproduces RGB565 queued-Flip false success, native DIB
overwrite, lost pending ownership, and erroneous completion after restoration.
It then fails restored cleanup with GL error 1282. The control's remaining five
rows are unexecuted; all six candidate rows were actually executed.

The restoration experiment now has browser evidence: both bare contexts cancel
the public loss event. Restoration requested in the listener's microtask emits
"context restoration not allowed" and times out after one second; the later
task request restores successfully. Both immediate getError observations are
37442 (CONTEXT_LOST_WEBGL), so that value alone does not distinguish success.
This observed task-boundary behavior explains the original experiment's
restoration timeout on this Chrome build; it is not a cross-browser claim.

The prepared adapter fix retains a context-loss fault before/during readback,
including a public loss event followed by restoration before a fence. Failed
readback preserves accepted queued ownership or dirty work, native bytes and
completion counters. The old frame remains invalid after restoration; shutdown
reports the fault while releasing CPU ownership. A deliberate new executor is
required. No extra Present or forced draw was added.

Actual candidate runs exposed a second failure: after restoration gl.getError
was zero, but shutdown deleted invalidated old GL handles, producing 1282
(INVALID_OPERATION). The next executor then declined its first draw with
"Depth precision/allocation unavailable". The GPU teardown now accepts explicit
context-loss invalidation, forwarded through D3D9 from the faulted D3DIM target.
It clears CPU resource tracking without deleting GL objects already invalidated
by loss. Ordinary teardown still deletes its live GL resources. No GL error is
silently drained as a substitute for this fix.

Final `candidate-final.json` passes all six RGB565/32-bit queued Flip,
synchronous fence and awaited fenceFlip routes. Each row proves public loss and
restoration, truthful readback failure, unchanged DIB/other-backing/boundary
canaries, retained pending or dirty work with zero completed syncs, continued
old-frame rejection, fault-reporting shutdown with GL error zero, then exact
fresh green native/RGBA pixels and row padding on the restored canvas through
the matching route on a new executor. The final fixture checks fresh cleanup
and no production fallback/error too.

Runtime serialization followed Pawn1445's actual native/watchdog/supervisor
wait 0 and both EOF receipts; LMarbles1505 was released after this worker's
final Chrome close 0, Node wait 0/both EOFs, independent watchdog wait 0 and RAM
profile cleanup. Each launch observably armed its own 90-second/disk-floor
watchdog. The first control startup hit the floor at 1,497,944,064 bytes and
was interrupted before probe execution (Node wait 1/both EOFs, watchdog exit
2); no Chrome close receipt was available for that interrupted startup, and
subsequent process inspection found no survivor. Later launches isolated
temporary/cache/config directories alongside the profile in RAM and completed
with normal Chrome close receipts and unfired watchdogs.

Final validation: six matching focused regressions plus GPU backend regressions,
and `flock /tmp/wine-build.lock bash tools/build.sh`. Exact source/module hashes,
Git SHA, relevant binary diffs and owned new-file patches, lossless gzip logs
and decoded hashes are retained in the run, without source archives or copied
media. No recovery was repeated. No worker, box or deployment was created:
box ID/expiry null, state NOT_CREATED, stop receipt N/A.

Next: normal application-level coverage may consume this published fix; this
qualification makes no additional gameplay claim.
