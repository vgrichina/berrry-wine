# Tile World owning waveOut callback repair — private candidate

Tile World remains gameplay-unqualified. Its filename/ruleset picker stays visible after ordinary intro-ms selection. Passive attempt2 found two completed DONE|PREPARED headers queued for CALLBACK_FUNCTION, an advancing AudioContext, main waiting to join the audio worker, and that worker waiting on the semaphore its legitimate WOM_DONE callback releases. Raw run: scratch/runs/20261004-tworld-callback-census. Root's visual correction and prior metadata are preserved in scratch/new-game-tworld-20261004/repair/scene-correction.json.

The isolated candidate lives in scratch/new-game-tworld-20261004/repair/after, with exact inherited before snapshots and a 12-file diff in integrated-draft.patch. integrated-readiness.json is the current source authority. No production file or canonical module has been changed.

The WAT entry preserves caller TLS and the interrupted wait tuple. Worker registration binds the actual opener and a generation; offers retain a token across ambiguous transport, refuse nested loader execution, and never execute on the page shadow. The completion queue retains registration/header submission identity, reset-returned buffers, and non-function notifications. Owner-aware scheduling admits callbacks before resolving parked waits and restores saved scheduler deadline bookkeeping after callback return. Closing an ambiguous offer uses a cancellation query that can acknowledge prior acceptance but cannot start a fresh callback.

Private evidence:

- repair/validation.json: real WAT candidate passed, unchanged WAT control failed on parked admission. Initial even-yield predicate defect caught and corrected.
- repair/transport-validation/receipt.json: actual Worker callback released a real semaphore once despite dropped acceptance reply; original wait/TLS restored; generation, expiry, close/stop checked. Before Worker control failed to publish registration.
- repair/integrated-validation/receipt.json: real host completion queue -> owning callback -> real semaphore audio Worker -> natural Worker exit -> normal main join resolution passed. Before-queue control retained the stalled main. Reset/reuse/busy/order/WINDOW/EVENT/NULL/process retirement and ambiguous-close tests passed. Test-only wait-code expectations were corrected and failures preserved.

All test processes/Workers closed; no browser was started. Canonical module remained f40d4ca3382279ff9b826188573f8acd9272eaa2dc5024dcbb69aecc35b49063.

One post-test source correction remains explicitly separate from the passing freeze: suspended active owners return busy rather than retired, retaining their notifications. test-wave-owner-lifetime.js checks this using the actual host method plus in-flight/consumed wait, exited/recycled owner and replaced registration cases. Syntax passed; it has not run after the resource release. Root must review this delta and the integrated source before production integration. Full browser step-loop/ordinary Tile World qualification, relevant existing compatibility tests, and canonical build are still pending. This is not a gameplay, release, performance or audible-quality claim.

## Final source-only lifecycle review (2026-10-04, during Heroes matrix)

The passed integrated snapshot remains immutable at `repair/integrated-validation/receipt.json`. The new frozen draft is `repair/source-review-final/readiness.json` and `patch.diff` (SHA256 `606fd2b008a69956693837a047c45dd8a0a65862c578b15ca45b4c66ba66c3f7`). Production files and canonical module were not changed.

Two post-test corrections remain unexecuted: suspended main/auxiliary owners retain notifications as busy; an ambiguous main callback offer prevents the actual scheduler from handling the cached interrupted yield. Without the latter, an old yield-1 result could complete a now-signaled wait over an already admitted callback's stack. `test-wave-pending-step.js` exercises the actual host scheduler with transport substitutes, including its immutable before-fix control, and checks normal wait completion remains intact. These new tests have syntax checks only; no test/build/browser ran during the matrix.

Remaining review detail: cross-owner close retires the host stream and queue, preventing new offers, but does not currently remove the original opener Worker's registration metadata until its own close/stop. This metadata cleanup needs a bounded lifetime decision; do not infer that host retirement permits injection. CLI real-thread completion scheduling is not qualified by the browser transport tests. Existing standalone callback fixtures also need review for valid loaded guest ownership and the explicit six-argument registration API.

Next gates: run the focused suspension and actual step-loop before/after regressions; rerun the real integrated Worker/WAT dependency test on this final snapshot; check existing waveOut/MM callback compatibility; independent root review; separately granted build and ordinary browser qualification. `source-review-final/ordinary-route.json` specifies a visually gated intro-ms picker-to-board route and actual directional response evidence. The retained picker remains the last observed Tile World result, not gameplay.

## Focused JavaScript validation resumed — 2026-10-05

After the screenshot batch, the frozen host delta was exercised without a browser, Worker or WAT compile. Actual owner admission tests PASS for suspended auxiliary, suspended Worker main and suspended cooperative main; in-flight/consumed-wait owners stay busy and exited/replaced/reopened owners retire. The actual `_runThreaded` step regression PASS preserves the interrupted frame during ambiguous acknowledgement, suppresses stale loader handling, and still completes a normal satisfied wait. The exact before-guard host control fails as expected because it polls/consumes the cached interrupted wait (`actual1`, expected0). Receipt: `repair/source-review-final/focused-validation-20261005.json`, with exact source/test hashes and three retained logs. The new main-suspension assertions are in the working test; the earlier frozen test copy remains immutable.

Actual next action: independent root review of these focused results, then a separately granted real Worker/WAT integrated rerun on the final host snapshot. Cross-owner Worker registration metadata cleanup remains an explicit source-review item; do not imply the browser queue's retirement deletes that remote metadata. No production integration, canonical build, ordinary TileWorld rerun or gameplay qualification occurred. Last visible result is still the retained picker.

## Final private integration and queue-race correction — 2026-10-05

Independent reviewer corpus_categories found a real cross-stream close race: replacing the callback array with `filter` while the async pump awaits an unrelated offer clones the still-pending item. The old array is consumed while the new live array retains the accepted item for another token. The isolated correction removes retired entries in place, preserving queue identity. Actual host-source regression passes; its preserved before-source control fails with one accepted completion incorrectly retained. No ownership gate or callback semantics were relaxed.

After explicit JigSawedME release, the <=180-second private grant ran final snapshot-v2: integrated session51733 exit0 (actual host completion→owning callback→ReleaseSemaphore→auxiliary Worker exit→main join); before-queue19073 exit1 at expected parked-owner assertion; lost-ack/ambiguous-close20058 exit0. All processes closed, no browser/server, canonical module unchanged. `repair/final-validation-20261005/receipt.json` pins five results/logs and verifies the full480-file frozen inventory differs only in the reviewed host-audio correction. Prior snapshots remain immutable.

Next: independent review of the corrected queue/lifecycle contract, explicit remote-registration metadata and CLI scope decisions, then separately coordinated production integration/build and ordinary player-controlled TileWorld route. A passed private dependency chain is not gameplay.

## Private ordinary route — 2026-10-05

After Claude BRW explicit release04:45:15, private full-module build78706 exited0; default tail module `faa06e70…` (1665763bytes), compat `d63a59d4…` (1666794bytes). No test exports/canonical writes. Browser96683 ran the reviewed overlay and normal inputs, reached Level1, collected chips6→5→3 with Right and reversed with Left. Full exact paths/provenance are in `attempt3/scene-review.json`; root scene approval/publication pending. Browser/server closed04:47:11.569Z and processes were clear. Old passive SDL device addresses are freed/stale after audio shutdown, so only actual queue/owner lifecycle and visible gameplay are claimed, not audio fidelity.
