# Worker input wake and async boundary contract — 2026-11-04

`test/test-worker-input-slice-wake.js` now models the current asynchronous
host boundary. It also exposed and fixes an actual lost-wake scheduling race:
keyboard input arriving before a pending GetMessage-wait reply could be followed
by a stale 50 ms host sleep.

Evidence: `scratch/runs/20261104-worker-input-wake-contract/`. `start-sha.txt`
records the initial shared-main commit. The predecessor is
`96867f14d3bfbfc32b711254744a5b31adb00bd4`, described in
[the host rAF contract note](host-raf-worker-contract-20261104.md).

## Async test contract

`first-failure.log` reproduces the predecessor's retained
`baseline-worker-input-slice-wake.log`: the test synchronously expected a slice
before `_pumpWaveCallbacksAtBoundary()` completed. Its mock also lacked the
current idle main link (`threadSendDepth: 0`, `_waveOffer: null`).

The replacement drives the shipped host loop with explicit promise mailboxes
for service-pump entry, slice admission, and successor scheduling. It holds the
real host pump through `hostCtx.pumpWaveCallbacks`; it neither replaces that
pump nor waits a guessed number of microtasks, event-loop turns, or milliseconds.
A 30-second watchdog only fails a missing protocol event. A deterministic
MessageChannel, timer map, and rAF queue expose browser task delivery; the actual
host `_scheduleStep`, `_postStep`, `_wakeStep`, and presentation methods run.
The real renderer owns keyboard enqueue, queue depth publication, dequeue,
active events, slice holds, and repaint scheduling. Only its compositor leaf
is an observation point; this is a scheduling test, not a pixel oracle.

The real RPC broker and Worker imports exercise slot-scoped event reads against
the actual host input closures. Foreign process input stays queued while owned
keydown/character/keyup events dequeue exactly once in order. Active arguments
survive a sibling poll, slice completion and repaint. Foreign-only polls retain
the outer active event. An explicit stale nonzero depth exercises a brokered
empty poll and scope clearing; a published zero depth instead uses the Worker's
local fast path. The first two fixture-development logs preserve assertions
corrected to respect those existing semantics; neither establishes a production
defect.

Original cases remain: JS/WAT slot 9, independent queue-depth/wake publication,
real keyboard wake and dequeue publication, guest-created threads unable to
consume main's wake, the real interpreter's complete-block one-shot exit and
normal next run, initial 100k budget, 200 ms throughput adaptation to 6k, then
1k input slices and live focus propagation.

Additional cases verify admission only after services complete; input during
that await; current configured budget, burst expiry and 1k floor; early wake
results excluded from throughput adaptation; wrong-instance focus rejection;
no repaint while a slice is held and one completed repaint; ticks/audio
completion service continuity; and stopping during an awaited service boundary
without another slice or successor. No test substitutes sleep or flushing for
the original first-slice assertion.

## Proven production race and fix

`async-contract-third.log` is the first production failure: the next schedule
delay is 50 instead of 0 at “input preceding a message-wait reply prevents stale
host parking”. A browser key enqueues and publishes its wake while a Worker
slice reply is outstanding. `_wakeStep()` has no timer to cancel. The subsequent
yield-7 reply then installs a message-wait park even though that input was not
covered by the reply.

`host.js` now increments a host-local wake generation on true input publication
and snapshots it after boundary services, before slice admission. A changed
generation prevents that reply from installing a stale GetMessage park. It
does not dequeue input, consume the shared one-shot wake, alter a guest wait
frame, or change normal Sleep/WaitFor scheduling. A generation rather than
shared queue depth prevents foreign queued input from disabling parking.

Controls verify drained input still parks, input cancels an already armed park,
repeated wakes coalesce into one successor, and a foreign event observed before
admission permits ordinary parking. These opposite orderings are required for
the passing result. `lib/thread-manager.js` and `lib/renderer.js` are unchanged.
The callback census refresh records the host file hash and this scheduling
review; broader callback ownership remains pending.

## Validation and limits

`verify.py` retains command/exit results in `verification.json`. The final test
fails against the exact predecessor host (`before-host.log`) and passes with
the fix. In-memory negative controls reject removing the 1k input cap, shared
wake pulse, or renderer publication hold. `control-preload.cjs` retrieves the
old host from Git and applies controls only in memory, without source archives
or changing shared files.

Focused checks cover input wake/event slots/receipt/focus, browser Worker slice
selection/vblank, thread manager/scheduler/bootstrap progress/retirement,
host rAF, Worker repaint boundaries, all 11 renderer display-failure cases,
presentation filter, callback census and its tests, and test-tier membership.
The serialized full build uses `flock /tmp/wine-build.lock bash tools/build.sh`;
see `build.log`. These establish offline scheduling semantics, not full-27,
gameplay, real GPU pixels, or full-capture qualification.

Git is the source archive: retain the exact SHA, relevant binary diff, owned
new-note patch, and hashes with the unique logs/helpers. No source-tree archive
or media copies were made. No box was assigned (ID/state/expiry: not applicable),
and no browser, game, runtime lifecycle action, subworker, successor or public
deployment was used. Coordinator runtime ownership is unchanged. Next work is
any separately authorized runtime/capture qualification; none is inferred here.
