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
c9/7d347/135-media/genuine-chooser preparation will add only the tested native
wait source correction and the bounded attribution diagnostic; dynamic actual
owner inventory, binder and sampled reader remain in use. The original 500ms
confirmation, 15-second gameplay review, independent UP, operation/identity
checks and 250ms native producer fence stay binding.
