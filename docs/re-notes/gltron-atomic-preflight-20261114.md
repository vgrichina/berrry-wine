# GLTron atomic preflight, 2026-11-14

This task stopped before heavy checks and before any original. StarCraft combat
has three actual child waits with both EOFs and a released heavy lock, but its
outer-wrapper wait explicitly records `actualWait:false`, both EOFs false and
`missingProof:true` after tool exit 143. Pegged subsequently declared
`NO_ORIGINAL`. The task requires four actual predecessor waits or the specified
no-original alternative and root confirmation. Process absence and the root's
22:13 dependency-release note do not reconstruct that fourth wait. No original,
Chrome control, full build or game input was launched by this worker.

At 22:18 the coordinator announced a prerequisite amendment and a new
Pegdrag → GLatomic → threadSentinel queue. The new Pegdrag task explicitly
removes its ancillary fourth-wait gate. This worker's GLatomic task file still
contains the four-wait requirement, matching the direct task instruction; no
missing wait was manufactured or counted as passed. That later note is retained
in the evidence for the next assignment's gate decision.

Evidence is `scratch/runs/20261114-gltron-atomic-preflight/result.json`. Code is
**uncommitted WIP** in the shared main checkout and recoverable from the exact
Git SHA and binary patches there. Only this report is published. The required
production Chrome checks and locked full build have not passed for this WIP;
the code must not be treated as approved for an original.

## Prepared change and light validation

The released `ee9c89fe` helper already performs the final page identity,
visibility and paint checks synchronously with the ticket call. Its caller
nevertheless treats a newly held paint, observed after asynchronous module
validation but before that call, as a terminal failed capture. The prepared
change gives that exact passive observation a fresh nonce and explicit
`NOT_READY`, `requestCalled:false`, `ticketCreated:false`,
`inputDispatched:false` fields. Existing armed or pending tickets refuse before
this classification. The only eligible wait is the first startup capture after
`prepareStartup`, within its original fixed deadline. Each new probe validates
the same pinned owner and live modules again. The final page transaction checks
the deadline as well as identity/readiness immediately before requesting a
ticket. It contains no await between those checks and the request.

After a request, there is no passive-wait branch. Failed tickets use a separate
terminal `CAPTURE_TICKET_FAILED` result instead of the predecessor's misleading
precondition classification. Cancellation, post-ticket late holds, ambiguous
arm responses and UNKNOWN close the chain. A final Worker instance and owning
renderer check follows asynchronous module recovery. Original publication,
display, request and readback timestamps remain attached to the image; later
identity checks do not refresh its age. The controller labels initial readiness
as passive rather than promising continued idle paint across module recovery.

Four light focused runs passed. The final run has an actual subprocess wait,
stdout EOF and stderr EOF. It exercises real independent release children and
loopback transport UNKNOWN/late reply, plus focused startup/precheck, fixed
real-time expiry, nonce uniqueness, ambiguous effects, failed-ticket terminality,
permanent identity, no replay and unchanged precision/menu/reserve policies.
These light tests are not production Chrome or game proof.

The unexecuted Chrome extension prepares an exact committed `ee9c89fe` baseline
and the candidate against an attached real WebGL Worker with a recovered live
WASM module. Its producer begin message is introduced after initial readiness,
during `Debugger.getScriptSource`, before page arm. Intended assertions cover
zero requests while held, normal Worker end, one unheld ticket and complete
Chrome compositor pixel equality; a real 250 ms fixed bound during sustained
work; repeated finite Worker intervals; owner replacement between validation
and arm; cancellation of a real pending ticket after ordinary frame damage;
and a post-ticket hold that closes without reopening. Existing actual Chrome
fullscreen/overlay/modal/popover/three-second UNKNOWN checks remain in the test
but were not run here. No prepared assertion is reported as an observed pass.

Only the binding, controller and their existing test contain code WIP. Host,
index, page viewport, renderer and guest settings were not edited by this
worker. There is no guard disablement, forced repaint or hold release in the
candidate, input action loop, solver, guest state/clock write, interpreter
optimization, box, deployment, source/media/WASM archive or reopened old chain.

## Missing proof and next step

Two intact-cycle corners, a natural round outcome, human identity and native
Quit remain unproved. There are no selected PNGs from this task. The previous
original stays closed: its ordinary trusted host fullscreen click succeeded,
the strip disappeared, visibility passed and publication 83 was ready; a new
hold appeared before its ticket. The exact predecessor pre-click refusal was
`touch-cursor`, as recorded in `b9779008`. This does not retrospectively identify
the older f693 run's sole visibility clause.

The next prerequisite is the missing actual predecessor proof or an explicit
owner change to that prerequisite. Then reclaim the released WIP, run the
prepared production Chrome controls and focused tests, pass the locked full
build and publish explicit own paths before considering the one conditional
600/620-second original. That original still needs exact 92 media pins, default
1,000 slices, real clock, independent watchdog, mechanical 180-second Quit
reserve, personally reviewed host fullscreen and native complete scene, one
permanent binding, and individually reviewed finite gestures. No full-27, FPS,
audio, parity, human-win or physical-GPU claim is made. Box ID and expiry are
null, state `NOT_CREATED`, stop receipt `N/A`.
