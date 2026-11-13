# D3DIM lost-context readback repair and restoration experiment

Run: `scratch/runs/20261113-webgl-loss-fix-1435/`.
Parent: `65dbc2e75`, with actual Chrome/WebGL2 failure recorded in
`scratch/runs/20261113-closed-outlaws-webgl-1400/baseline.json`.
The parent observed a lost context, fence result 1, changed RGB565 DIB bytes,
and cleared accepted queued-Flip ownership. Its restoration event timed out;
the other five cases and fresh restored pixels were unproved.

The prepared production change checks context loss before readback and before
native writeback. A target retains a loss fault, including loss observed by
its canvas event listener when no fence runs during the lost interval.
Restoration cannot make its accepted frame or cached GL objects valid again.
A queued Flip retains its exact inflight record on failure; synchronous and
awaited fences retain dirty work and do not count a completed synchronization.
Explicit stop releases resources and reports the fault. A fresh executor is
required for a deliberate new frame. No extra Present or forced draw is added.

The browser fixture separates restoration permission/timing from production
behavior: two bare WebGL contexts both prevent the loss event's default, but
request restoration either in the listener's microtask or in a later task.
The six renderer cases resolve loss notification in a later task before
requesting restoration. This is a prepared timeout hypothesis, not an observed
cause until the real browser probe runs.

The renderer fixture covers RGB565 and 32-bit queued Flip, synchronous fence,
and awaited fenceFlip. It checks actual public WEBGL_lose_context events,
truthful failure, preserved native DIB and boundary/other-backing canaries,
pending ownership, continued old-frame rejection after restoration, cleanup,
then exact fresh green native/RGBA pixels and row padding through the matching
route on a deliberate fresh executor. The Git control loads only the old
production adapter into memory; it never rewrites the shared checkout.

Six focused checks passed: async Flip ownership/readback loss (including loss
during read), native16 submission errors, batching, points, depthless Z, and
test-tier membership. `flock /tmp/wine-build.lock bash tools/build.sh` passed.
Logs are gzip streams; exact Git identity, relevant binary diff and owned new
test patch are recorded without source archives. Other five renderer libraries
match the parent's hashes; only the owned adapter differs.

Current qualification blocker: after LMarbles1410 released its actual child
with wait 0 and both EOFs, `/home` was below the required 1,500,000,000-byte
floor (1,498,722,304 bytes at the first ready-slot check). Neither the revised
restoration experiment nor the real-browser control/candidate was launched.
The serialized `control-floorcheck` admission recorded no heavy child and
refused before watchdog/Node/Chrome launch; its Python parent was actually
waited with status 1 and both output streams reached EOF.
Production and test changes remain uncommitted WIP pending that acceptance.
No recovery, old text decoding, worker, guest gameplay, or box was performed.
Box ID/expiry null, state NOT_CREATED, stop receipt N/A.

Next, after sustainable headroom and actual-child/board serialization, use
`python3 scratch/runs/20261113-webgl-loss-fix-1435/run-browser.py control`
and then `.../run-browser.py candidate`. The runner takes the heavy runtime
lock, records fresh actual process/disk checks, observably arms an independent
90-second/floor watchdog before launch, uses a RAM browser profile, compresses
both streams, waits the actual child/watchdog and EOFs, and removes its profile
after normal browser close. Inspect six real rows and the timing probe before
committing production code. This experiment makes no 27-app/gameplay claim.
