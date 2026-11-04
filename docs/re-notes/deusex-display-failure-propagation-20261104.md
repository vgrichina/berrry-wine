# Renderer display failure propagation

Current renderer display failures now escape to their callers. An explicit
`false` from `PresentationFilter.present` throws
`Win98Renderer: PresentationFilter.present returned false` at
`_presentDisplayCanvas`. This uses the existing exception path through
`repaint`, `flushRepaint`, renderer rAF, caret blink and host publication.
Returning a Boolean alone would leave those callers ignoring the failure.
The filter implementation and its successful fallback behavior are unchanged.

This repairs the executable obstruction in
[the natural-frame note](deusex-natural-frame-capture-20261104.md) at
`58ab7b51ea8b16bd57b0bcaca508b899a77395d3`. It does **not** establish engine
render completion, viewport-player ownership, selected-source byte identity,
GPU completion, immutable readback or PNG linkage. No capture mechanism or
synthetic engine/actor/readback token was introduced. This failure was
demonstrated offline; it is not established as the cause of the retained game
capture's rejection.

## Reproduction and repair

Pre-repair checkout:
`9f095e32b423ff0b3e1a67a7a2e3839708674f12` on shared `main`.
Evidence: `scratch/runs/20261104-deusex-display-failure-propagation/`.
The new regression imports actual current `Win98Renderer` and
`PresentationFilter`, including actual composition on tiny headless canvases.
A missing presentation context makes the actual filter return `false`.
Before repair, actual display/repaint/flush/rAF/caret return normally despite
that failure. The host `_presentNow` can then report an upload and update the
upload metric. After repair, the exception prevents those success paths.

`test-base.cjs` loads the recorded renderer directly from Git into an in-memory
Node module, without modifying the checkout. It runs the exact final test file:
8 of 11 cases fail before the repair with missing expected exceptions; all 11
pass afterward. `regression-final-against-base.log` and `regression-after.log`
retain both results. An earlier post-repair fixture run had two fixture errors:
RasterCanvas clamps zero dimensions to one, and the initial direct-display
state already matched the requested state. The final fixtures model DOM zero
dimensions explicitly and first enter direct mode before testing its exit.
The initial failure log remains in the run.

The production repair is one explicit-false check. The build's callback census
pins the whole renderer file, so its first run correctly rejected the changed
hash. The separately claimed `tools/callback-ownership-census.json` updates
only the renderer hash and lifetime-review reason. The previous seal exactly
matches the pre-repair renderer; there is no unrelated renderer delta to seal.
Invocation ownership remains pending and nonlocal API guards remain closed.

## Caller and cleanup contract

| Situation | Behavior and executable check |
| --- | --- |
| Filter returns `false` | Display throws; repaint/flush/rAF/host callers cannot complete as successful publication. Missing context and zero-sized output are covered. |
| Filter throws | The original exception object propagates unchanged. Canvas smoothing/quality restoration and repaint `finally` cleanup still execute. |
| Failed repaint | `_repainting` and `_repaintPending` clear. No failed composite is promoted. Existing scheduling flags/timestamps keep their prior exception behavior; this change adds no automatic retry. |
| Failed scheduled rAF | Callback handle and scheduled flag were cleared before repaint; exception escapes. A later ordinary scheduled repaint can recover. |
| Failed caret display | Timer handle was cleared before the callback. Exception escapes before rearming; a later caret scheduling request can recover. Logical caret inversion is not rolled back. |
| Recovery | Restoring the context and making a later normal repaint succeeds. A later display-only call cannot promote an earlier failed composite. |
| Direct CSS display | `nearest`/`browser-hq` logical-canvas paths bypass the filter, retain CSS visibility behavior and complete normally. Missing-filter headless display remains legitimate. |
| Exclusive source | A separate source cannot take the direct shortcut; failure throws and recovery submits that selected source to Canvas2D. |
| Worker/nested repaint | Existing Worker-slice hold and nested-repaint deferral remain intact; they do not attempt a filtered display. |
| Successful filter | Canvas2D, unavailable-GPU fallback, and successful GPU dispatch fixtures still complete normally. |

`check-observer.cjs` installs the **unchanged predecessor observer** around the
actual current renderer/filter. Across five actual compositions it sees a
success, a false-return failure, recovery, a throwing failure and recovery.
Failed transactions clear the candidate and retain the last successful record;
intervening display-only calls do not advance publication. Final publication
sequence is 5. This tests observer transaction bookkeeping, not backend output.

## Validation and retained limits

The focused checks pass: the 11-case regression, current-method predecessor
observer integration, presentation filter, Worker repaint boundary, OpenGL/GDI
composition order, GPU-layer client origin, wallpaper host routing, tier
membership, callback census mutation tests and callback census reconciliation.
`flock /tmp/wine-build.lock bash tools/build.sh` passed; its complete output is
retained as `build.log`.

One existing broader host test fails: `test/test-host-raf-present.js:290` uses
a `threadManager` mock with `spawnPending`, while current host code calls
`startPendingWorkers`. Both the test and `host.js` are byte-identical to the
recorded pre-repair checkout, and that test supplies its own renderer stub.
`baseline-host-raf-present.log` retains the failure. It is not counted as a
passing test. The new regression separately executes actual host `_presentNow`
with the actual repaired renderer for false, throw and recovery, checking both
the returned upload result and upload metric. No unrelated host/mock repair
is included.

The predecessor suites still pass: 60 contract assertions/24 fixture shots,
33 observer assertions, 6 queue tests, 14 timing/readiness cases and 2 actual
staging-preflight negatives. The historical natural fixture retains its 24
obstruction/guard cases, including the historical ignored-false demonstration.
Its `--require-full-link` invocation still exits 1 with `MISSING_ENDPOINT`.
The original 735→736 record remains rejected with its original qualification
reason; pending/held and crossed-publication guards are preserved.
Historical helpers are referenced in place; output paths alone are redirected
into this run. These fixture shots do not contain runtime PNG pixels.

Reproduce the focused and retained checks with:

```sh
python3 scratch/runs/20261104-deusex-display-failure-propagation/verify.py
flock /tmp/wine-build.lock bash tools/build.sh
```

GPU primitives in the new regression are fixture seams around actual filter
dispatch and blitting. No browser or real GPU executed. Successful WebGL
dispatch here establishes control flow only; actual rendered WebGL validation
and full capture linkage remain unproved. No screenshots, forced runtime
repaint, guest writes, input-guard changes, screenshot retries, game/heavy
runtime, box access, lifecycle action, subworker, public deployment or successor
task occurred. No box was assigned: ID/state/expiry are not applicable.

Git is the source archive. The run records exact Git SHA, relevant binary diff,
owned new-file patches, fixture/reference hashes and test logs. No source-tree
snapshot, tar, module copy or media copy is retained. The next capture work
still requires a demonstrated owning engine/viewport/source-to-immutable-readback
contract; this display repair supplies none of those missing endpoints.
