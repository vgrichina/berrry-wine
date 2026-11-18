# NFS3 native scene freshness, 2026-11-18

Evidence: `scratch/runs/20261118-nfs3-native-scene-freshness-cause/`.
The preceding dynamic inventory original and its UNKNOWN scope stay closed.

The guard's old `observedAt` is page `Date.now()` at a brokered `check_input`.
The Worker negotiates the native protocol once and samples actual check_input
calls at 100ms intervals, using its own performance clock. Empty local input
polls can bypass the broker. More significantly, an empty native GetMessage
parks at yield 7. The normal Worker repeatedly executes has_pending_message
and checks the published input queue, without invoking check_input again until
work appears. Requiring a fresh check_input before allowing physical input
therefore rejects an otherwise live, valid, waiting UI. This is a freshness
source mismatch, not proof that the renderer starves runnable UI work.

An authored x86 control creates its window and GetMessage pump on thread 2,
with separate rendering and DirectInput actors. It uses real normal Workers,
the frozen c9 source and native 7d347 module, and software Device2 rendering.
The light observer-on control completed 60 presents while its UI performed
8,164 native has_pending_message calls. Its last ten check_input calls were
startup work; the native UI retained yield 7, the same process/thread, focus,
window and generation. The old guard was healthy but stale and unready.
Fresh light and eight-draw pressure controls, with attribution off and on,
both reproduced this. Observers add work; sequential shared-host measurements
do not establish neutrality or a speedup.

The correction samples native USER getters immediately after the existing
has_pending_message probe, at most every 100ms and only after the browser
native protocol was negotiated. It sends a reserved negative input_validate
metadata token through the existing asynchronous transport. It never polls
input, wakes or resumes a wait, changes guest clocks/state/memory, modifies
rendering, or reports input consumption. It adds no native module variant or
interpreter optimization. The producing actor supplies its wall time and
performance.timeOrigin + performance.now(); receipt time cannot renew a late
sample. Both ages must remain within the original 250ms fence. The exact live
actor link, Worker and endpoint remain pinned; stopped, stopping, retired,
replaced, delayed and future samples are refused.

Fresh corrected light and pressure controls completed 60 actual software
presents with native_message_wait scenes ready under the unchanged fence.
The light checkpoint was 21ms old. All six old/new light/pressure whole-page
PNGs match exactly, SHA256
`2542b8560f3c313664235302d608184480f0a03929cb8a0caa509421e2ec063a`.
The whole authored blue Device2 region, white page and host strip were reviewed;
these are control pixels, not game effects. Actual dynamic module inventories
verify native 7d347 bytes. The native getter test preserves return 127, exact
imports and memory, distinguishes four native wait probes from one input poll,
and covers synchronous/asynchronous instantiation. Focused guard tests reject
late/future clocks, retired/reused actors and replaced Workers before and after
binding. Legacy native input and GL guard regressions remain passing.

A separate authored input qualification closed before input when personal
review did not arrive by its finite review deadline. It made no DOWN, no bind
and no later runtime request. It is retained as a failed scope, not replayed
or relabeled as an input success. Existing native USER receipt and independent
UP proofs are reused only for their unchanged claims.

The corrected native controls and focused checks, plus the locked full build,
precede publication and the authorized fresh registered original. Its frozen
c9/7d347/135-media/genuine-chooser preparation added only the tested native
wait source correction and the bounded attribution diagnostic; dynamic actual
owner inventory, binder and sampled reader remain in use. The original 500ms
confirmation, 15-second gameplay review, independent UP, operation/identity
checks and 250ms native producer fence stay binding.

The correction is published as `5aa5dabdf`; strict pull/push both returned 0.
The first locked build encountered another owner's silent-handler inventory
WIP; the final locked build passed after that owner corrected it. Native
source/guard and legacy input checks passed before publication. The existing
GL native guard regression also passed. One invocation of the separate GL
browser test omitted its required arguments and failed at argument validation;
it is not an executed GL native case or a claimed pass.

The one fresh original registered and closed normally under independent finite
and disk watchdogs. Dynamic inventory recovered the actual seven guest modules
and one render module with 7d347 bytes. Retired slot 2 / endpoint 3 retained its
normal-return and thread-ID reuse provenance with unknown byte identity null.
The actual UI owner, thread 2 / slot 1, made 57,812 native has_pending_message
calls but only 20 startup check_input calls; the final input poll preceded the
last wait probe by over five minutes. Its native scene remained at GetMessage
yield 7 / PC 0x4cba8e, window/focus 98305, process 1000, generation 1. Native
producer samples now refresh the guard. This confirms the repaired source in
the game, without claiming that idle wait probes consume physical input.

The main actor made 1,346 GPU stream kicks taking 293,837.61ms in aggregate,
maximum 2,439.08ms. These durations include synchronous waits and are not CPU
time. Entry/exit records distinguish synchronous mode 1 from mode 0. The UI's
largest sampled between-run interval was 2,472.42ms, but an idle native wait
does not establish starvation of runnable work. Neither a wrong guest clock,
an interpreter defect nor a runnable starvation branch was proved. Attribution
and readbacks add observer work; no neutrality claim follows from the controls.

Whole-page reviews found an actual cockpit, road, green opponent and rain,
with 0 MPH, race time 0:01.67 and 1/1 laps in `original/cockpit-review.png`.
Its native scene was already 1,229ms old at capture, so the unchanged fence
correctly denied readiness. Other reviewed checkpoints were white below the
host strip, including one with a 15ms-old ready native scene. None supplied
both a fresh reviewed driving frame and admissible native scene. No bind,
DOWN or UP was sent; throttle, steering, Pause and ordinary game Quit remain
unproved. Process cleanup is not ordinary Quit. The unused admission helper
was never invoked. Closed scopes were not replayed.

Read-only witnesses on that same original isolated a concrete remaining
composition condition. At 272 presents, the retained 640x480 GPU layer had
nonwhite sampled pixels, but native d3dim_gps_window_present returned zero
for both the window lookup and render-target 3 lookup. The presenter's stamp
and CPU present sequence both equaled 1; window and instance identities
matched, and merged was false. Nevertheless layer.stale() was true and
_overlayFrameLayer selected no layer. The visible connected presentation
canvas sampled white, agreeing with the white whole-page captures. In frozen
lib/host-imports.js the zero native window-present association is itself a
stale-layer predicate. Its producer/retirement cause is not yet isolated:
these measurements do not justify removing the fence or changing composition
ordering, pixels or memory semantics. No speculative rendering fix or extra
original was attempted.

All seven supervised scopes have actual native and independent watchdog
waits with both stdout/stderr EOF and no leaked descendants. The authored
review-timeout scope is the sole expected nonzero native exit. Evidence retains
Git recovery and owned patches, unique authored inputs, module/media recovery
identities, measurements and three selected whole-page PNGs; exact duplicate
captures are recoverable by hash mapping. No box was created: ID, expiry and
stop receipt are null, state NOT_CREATED. The result closes with the freshness
repair tested and published, and the native window-present association as the
remaining concrete blocker.
