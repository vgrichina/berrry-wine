# Host rAF Worker contract repair — 2026-11-04

The repaired `test/test-host-raf-present.js` now uses the real `ThreadManager`
for bootstrap scheduling and drives the actual host/renderer/filter publication
path. It also exposed and fixes a host defect: a failed display at a completed
Worker boundary stopped guest execution, whereas the same failure in an ordinary
rAF callback allowed subsequent slices and frames to continue.

Evidence is retained in `scratch/runs/20261104-host-raf-worker-contract/`.
The starting commit is `c170f6c606f76f2e3899535bc1136c0e0e0effde`.
`first-failure.log` reproduces the stale fixture failure described in
[the display-failure repair note](deusex-display-failure-propagation-20261104.md)
and its retained `baseline-host-raf-present.log`: the fixture provided
`spawnPending`, but the host called `startPendingWorkers`.

## Current contract and retained coverage

Changing that name would preserve an incorrect expectation. Worker bootstrap
now runs in the background because DLL_THREAD_ATTACH can wait on a lock owned
by the creator. Explicit readiness callers can still join `spawnPending()`.
The replacement case instantiates the real manager with deterministic metadata,
interpreter exports and Worker transport. Across successive actual host steps it
checks that bootstrap starts exactly once, main runs while bootstrap is pending,
the pending child cannot run and its handle remains unsignaled. Guest ticks,
audio completion and wave callback pumps continue. The host passes the manager's
DLL/thunk sync state to main and publishes main's completed thunk high-water
state back before the next slice. After readiness, the real runnable selector
admits the child; the stopped variant admits no further slice or successor.

The original presentation cases remain: newest-frame coalescing, no upload before
rAF, held-slice due-frame publication, long-slice rearming, locked-surface retry,
idle shutdown of the frame chain, stop/trap final flush, GDI pacing, redundant
renderer-rAF cancellation, synchronous no-rAF behavior and separate HUD upload
and guest-present counters. The obsolete blocking-readiness assertions are
replaced by the current bootstrap contract, including its stopped variant.

Four added integration variants execute shipped host and renderer scheduling
methods with a shared controllable rAF queue and the actual presentation filter
on small RasterCanvas surfaces: false-return and throwing display failures,
each between slices and after rAF deferral during a held slice. They check that
held publication retains queued damage without counting an upload; failed
display consumes the callback, unwinds repaint and slice holds, and never calls
the upload metric. A subsequent slice continues the service pump, and new
ordinary `scheduleRepaint()` damage publishes exactly once through the normal
host boundary/rAF chain. No direct recovery repaint is injected. The actual
renderer rAF is cancelled by the host after composition.

## Production defect and fix

`boundary-fail-before.log` preserves the first production failure: `running`
became false at “display failure must not stop guest services”. The deferred
`_presentAtBoundary()` call to `_presentNow()` propagated the renderer exception
into `_runThreaded()`'s fatal catch, which called `stop()`. This made an incidental
rAF/Worker overlap determine whether a display failure stopped the application.

The host now catches and reports failure specifically around that deferred
scheduled `_presentNow()` invocation. It consumes the failed frame without
rearming a retry, counting an upload or stopping guest services. Later ordinary
damage can schedule a fresh frame. Direct `_presentNow()` and ordinary rAF
exceptions still propagate. Synchronous no-rAF behavior is unchanged. The
callback census host-file hash and review reason are refreshed; no guest
callback lifetime, invocation ownership or renderer implementation changes.

The final regression against the exact Git pre-fix host fails at the service
continuity assertion (`before-control.log`). Two further in-memory negative
controls reject joining bootstrap and ignoring the Worker publication hold.
`check-controls.cjs` retrieves old source from Git without writing a source
snapshot; `verify.py` reproduces the focused checks and controls.

## Validation and limits

The repaired host suite, 11 renderer-display cases, Worker repaint boundary,
bootstrap progress and retirement, presentation filter, browser-shell Worker
slice selection, Worker vblank yield, tier membership, callback census mutation
tests and census reconciliation pass. These are offline tests, including small
Node Worker/RPC fixtures, without a browser or game. The locked full build
`flock /tmp/wine-build.lock bash tools/build.sh` passes (`build.log`).

One neighboring test is excluded from passing checks:
`test/test-worker-input-slice-wake.js:119` expects the first slice synchronously,
before the host's awaited boundary pump finishes. Its configured-slice assertion
fails identically with the exact pre-fix host; both logs are retained as
`test-worker-input-slice-wake.log` and `baseline-worker-input-slice-wake.log`.
That unowned test remains unchanged. This is not a passing input-wake result.

The fixtures establish caller scheduling, failure propagation, accounting and
recovery. They establish no engine-render completion, viewport/player identity,
selected game layers, immutable backend readback, PNG transaction, real GPU
output or Deus Ex gameplay/full-capture qualification. The missing capture
linkage in the predecessor note remains missing. No fake identities or capture
tokens were introduced, and no browser, box, game input, public deployment,
runtime lifecycle action, subworker or successor task was used. No box was
assigned: ID/state/expiry are not applicable; coordinator box ownership remains
unchanged.

Git remains the source archive. The run retains exact Git SHAs, relevant binary
diffs, the owned new-note patch, file/module hashes and unique logs/helpers.
It contains no source-tree archive or media copy. Next work is the remaining
owning engine/viewport/source-to-immutable-readback contract; the unrelated
input-wake fixture also needs its own current async-host contract repair.
