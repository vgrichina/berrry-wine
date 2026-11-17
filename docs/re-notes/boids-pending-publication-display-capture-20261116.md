# Boids pending host publication, 16 November 2026

Evidence: `scratch/runs/20261116-boids-pending-publication-display-capture/`.

The host used to refuse passive complete-display capture whenever `_dxDirty`,
`_dxLockDeferred` or `_presentFrameDue` was set. An authored continuously drawing
public-COM PE on an actual guest Worker reproduced that refusal with a live
selected window and native GetPixel PASS. At its capture boundary the host had
dirty work, an active writer and completed publication 106. It returned no image.
The separately bounded first unpaced fixture timed out before readiness and
remains failed; it is not rendering evidence.

The host now passes an immutable snapshot of those pending flags to the existing
renderer capture transaction. A queued host update arms a pending ticket. Only
an ordinary unheld repaint, successful composition/display, owner validation and
complete readback can fulfill it. The call schedules no work, flushes no surface,
releases no hold and changes no guest clock or input admission. It does not read
or relabel an in-flight source. Immediate reads without queued host work retain
the existing held/in-flight refusal. Cancellation, owner replacement and failed
readback remain fail-closed, and completed ticket arrays remain detached copies.
Metadata identifies the pending host flags and ordinary publication after request.

The first corrected actual software/Worker native fixture returned three complete
frames at publications 128, 245 and 384. Every pixel of native source and displayed
output matched the independent literal color/transparent-source/black-background
oracle, using only the public viewport for output sampling. The first request
completed about 83 milliseconds after request through natural publication. Native
fixture Sleep(10) is the seed fixture's ordinary loop; production adds no wait.

Eighteen endpoint tests pass, including queue-to-natural-publication, active-writer
holds, cancellation, replacement, failed readback, partial/opaque/viewport checks
and immutable ticket lifetime. Actual WAT producer identity and DirectX layer
regressions passed. A legacy passive-target-inspection test cannot run because
Git main no longer contains its required `lib/d3dim-gpu.js`; all nine ENOENT
failures are retained rather than described as passing.

Serial WebGL/cooperative and WebGL/actual-guest-Worker fixtures subsequently
passed one deliberately selected real queued host boundary each (publications
120 and 121), every source/output pixel, and all five actual-owner negative
controls. Native parent/watchdog waits and both EOFs are present; Chrome closed
with code 0. These requested-WebGL fixtures expose software pixels and do not
prove native GPU geometry. The driver bytes are shared with the originals.

Two concurrent WebGL qualification runs passed their first literal frame but
failed the next five-second controller boundary. They remain failed. An extra
active-host-stop experiment after successful software captures did not return;
its outer tool ended 143 without normal parent/EOF receipts. It does not qualify
native shutdown. The subsequent single-frame software attempt containing that
same extra experiment is also not acceptance. No production lifecycle change is
made for that exploratory failure. Actual Node Worker close/error, context-loss
and stale-generation lifecycle regressions pass separately. The ordinary native
owner controls use the original five faults and normal browser closure.

Canonical flock build passed twice, including the frozen final harness. An
initial 300-second build wrapper expired after spending most of its bound waiting
for the shared lock; that failure remains recorded. Final endpoint/driver/census
unit run passed 20 tests; focused lifecycle/draw-trace/decoder/owner run passed
11 tests. Native producer identity and DirectX layer checks also passed.

Preparation and original observation retain their separate fixed 240/260 and
300/320 second native/watchdog bounds. Originals retain three passive captures,
no input and a sticky failure. No original has yet launched in this repair task;
post-publication outcomes will be appended. All old endpoints remain closed.
