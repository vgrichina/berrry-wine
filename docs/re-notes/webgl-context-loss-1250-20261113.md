# WebGL loss/readback: prepared experiment, resource dependency exhausted

Run: `scratch/runs/20261113-webgl-loss-1250/`. Inspected main
`fa008abea09d213178bbf14909ad4d7398f9dc64`; parent WebGL1220 inspected
`56327d542083fcf4e112fd354e4ba08fa92c2058` without launching a browser.
No production change, browser execution, demonstrated defect, or recovery claim.

The dependent packet1240 resource phase finished during preparation. It proved
all 5,770 member hashes and exact original archive-byte recovery, then removed
the released duplicate packet. Its recorded net saving is 46,665,728 bytes;
see `scratch/runs/20261113-caesar-packet-1240/RECOVERY.md`, `restoration.json`
and `reclaim.json`. This worker waited for that resource phase rather than the
Pawn task. Post-reclamation free disk was 1,498,628,096 bytes, still 1,371,904
bytes below the 1,500,000,000-byte floor. A later check was 1,498,152,960
bytes, a 1,847,040-byte gap. There are no task-owned large disposable files to
reclaim. No foreign cleanup was attempted.

The coordinator then started resource worker1305. This worker kept the fixture
ready through that resource phase too. Its `reclaim.json` records exact recovery
and removal of `/tmp/caesar3-extra.tgz` (2,953,216 allocated bytes released),
but free disk remained 1,497,624,576 bytes. Its ISO inspection found 28 opaque
payloads without retained reconstruction dependencies; the ISO correctly remains
intact. See `scratch/runs/20261113-extra-iso-1305/RECOVERY.md` and
`iso-inspection.json`. Thus both available resource phases reached concrete
outcomes without enough headroom for the browser; this is not a wait on Pawn.

The prepared executable is `prepared-context-loss.cjs` in the run directory.
It uses the small real-browser descriptor/draw fixture pattern from
`test/test-d3dim-native16-storage-web.js`, and the production script loading,
source hashing and normal browser-close checks of
`test/test-d3dim-surface-fence-web.js`. It is deliberately retained as a run
input, not installed as an unexecuted permanent regression. Node syntax checking
passed. `run-browser.py` syntax checking also passed; it prepares a separate
session watchdog before launching Node/Chrome, with an observable deadline and
disk-floor receipt, a 90-second deadline, and TERM/KILL of its own process group.
The browser profile uses `/dev/shm`. No browser or watchdog was launched.

Once sustained headroom is available, from the repository root run:

```sh
python3 scratch/runs/20261113-webgl-loss-1250/run-browser.py baseline
```

Use a fresh tag for each invocation. The prepared launcher checks the actual
floor, retains browser output and the watchdog receipt, then removes its own
profile. It creates no box and uses the installed Chrome and Puppeteer.

The inspected contracts are:

- `lib/d3dim-gpu.js`, `call`, `_flip`, `_completeInflight`, `fence`,
  `fenceFlip`, `_writeBack` and `stop`. An accepted single-owner async Flip
  queues a PBO read and swaps DIB ownership. A ranged fence collects the DIB
  originally read; unrelated fences preserve pending work. Collection/writeback
  exceptions must retain the accepted frame and its PBO until successful retry.
- `test/test-d3dim-gpu-async-flip.js` explicitly checks failed collection and
  writeback, unchanged completion counts, pending identity, and later retry.
  `test/test-d3dim-async-readback.js` checks that the process render owner awaits
  `fenceFlip` before swapping/completing; failed waits or target replacement
  report an endpoint error without early completion or DIB publication.
- `docs/direct3d-dual-backend-design.md` requires explicit context-loss outcomes
  and rejects stale completions. `lib/gpu-backend.js` and
  `lib/d3d9-backend.js` have no contextlost/contextrestored listener rebuilding
  invalidated resources. This is source inspection, not evidence of an actual
  failing browser schedule.

The six prepared cases cover RGB565 and 32-bit targets across queued Flip,
synchronous fence, and awaited `fenceFlip`. Each uses real production DRAW and
public `WEBGL_lose_context`, waits for actual loss/restoration events, checks
that failed readback preserves DIB canaries and pending accepted ownership,
and checks that old invalid GPU resources cannot report successful completion
after restoration. The `fenceFlip` case requires a genuinely pending read before
loss. After failed-executor cleanup, it creates a fresh executor on the restored
canvas and requires exact fresh green DIB/RGBA pixels plus untouched row padding.
Recreating the executor is explicit: it does not claim automatic recovery of a
frame lost before CPU visibility. No extra Present or fakeGL loss is used.

Unverified hypothesis retained from WebGL1220: synchronous and queued collection
write back without checking context loss or the GL readback error flag.
`fenceFlip` checks failed sync-wait statuses but its collection likewise lacks
an explicit readback-error check. No speculative patch is justified until the
real experiment demonstrates the failure. If it does, retain failing evidence,
claim only the demonstrated production files, run the same regression after
the fix plus focused checks and the locked build, and publish those changes.

The run manifest records exact Git SHA, source/fixture and existing module
hashes, relevant binary diff and the new note patch in small compressed evidence.
Existing WASM modules were hashed for provenance, not executed. Git is the source
archive; no source-tree/media archive was made. No original game or 27-app
gameplay claim follows. Box ID none, state NOT_CREATED, expiry null, stop receipt
N/A. Next action is sustained disk headroom, then the prepared serialized local
browser run before considering a production fix.
