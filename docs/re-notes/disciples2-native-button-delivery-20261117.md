# Native button delivery, 17 November 2026

Evidence: `scratch/runs/20261117-disciples2-native-button-delivery/`.

The authored real-ticks slow USER pump reproduces the missing-DOWN mechanism.
The renderer handler enqueues movement, hit-test and DOWN. The old guard reports
CONSUMED immediately on that handler's return. Independent release then purges
the still-undelivered tagged DOWN and queues UP. The guest's ordinary wndproc
sets its public title to `UP WITHOUT DOWN`. Movement coalescing is not needed
for this reproduction. No original endpoint was reused.

The repair keeps host application separate from native consumption. Production
CLI tickets remain DELIVERY_PENDING after the handler returns and acknowledge
CONSUMED only when the exact resulting edge returns through `check_input`.
Receipts explicitly identify `native-input-return`, retain host `appliedAt`,
and include the actual message metadata. This boundary does not assert guest
DispatchMessage/wndproc execution or a game consequence. The Disciples
controller refuses a host-handler receipt.

Release continues to cancel a pending edge and purge its queued effects before
issuing independent UP. It never preserves DOWN for delivery after UP. The
immutable wall/monotonic deadline, nonce tombstones and original release
references are unchanged. The post-handler public USER context is pinned until
native delivery, so target, focus, modal, generation or retirement changes
cancel the edge. The pre-handler reviewed context remains mandatory.

The authored normal and slow PE fixtures use the ordinary public message pump,
renderer, native module and actual Node guest Worker helper. Their input
consumer is the main VM. An ordinary GetTickCount loop under existing
`--real-ticks` makes the slow pump genuinely wait; Sleep alone would measure
scheduler batch time. Both positive fixtures show DOWN before independent UP
and the guest caption `UP after DOWN`. A separately armed process owns release.
Early release cancels without consumption and without a later DOWN. Production
guard plus actual renderer-queue units cover expiry, focus/target changes,
retirement, owner replacement, inspection/effect UNKNOWN, missing edges,
lookalike events and nonce replay. Current input-owner, reviewed-context,
independent-release and per-slot metadata tests pass.

The broader `test-input-consumption-state.js` extraction fixture fails with
`cliObservation is not defined` on both HEAD and the delivery patch. Its
baseline failure is retained and is not counted as a pass. Early experimental
cross-thread PE shapes that did not establish guest handling are retained as
failed experiments and are not qualification.

The canonical flock build and focused current native input/context tests passed.
Material commit `91285ebf1` and correction `b954d09da` were published before the
single original. The correction removed an accidentally included concurrent VB
snapshot dependency, then restored that exact line as its owner's uncommitted
work. The runtime uses Git `b954d09daff03a15659b2a96afa823fe0d1af5be`, no owned
patches and no foreign WIP. The sealed source SHA-256 is
`30e697d2a04e85a24c8c663e03392ee6e54dd1c50850b1de1eafa977655e9e99`;
the independently compiled module is
`1360defeb5faa36d2007b4c4c3b5651e8c11e0a9fd80c4b07661b220e09c75b1`.
The same holder qualified normal native DOWN at 50 ms and slow DOWN at 294 ms,
both followed by independent UP and the guest's `UP after DOWN`. Early release
produced CANCELLED, no consumedAt/nativeMessage, UP without DOWN and no late
DOWN. Native, release, watchdog and supervisor actual waits completed zero with
both EOFs. These fixtures use a main-VM input consumer and an actual guest
Node Worker helper; they do not qualify a Worker-owned window procedure.

The one fresh original verified all 128 unchanged media files before and after.
No `f.sg`, imported save, config, EXE, clock, hold or deadline change was used.
Its independently prearmed native/watchdog limits remained 3600/3620 seconds
with a 300-second Quit reserve. The personally viewed complete main-menu frame
authorized one Single Player click: actual native DOWN then UP, confirmation
87.845 ms and independent UP 134.180 ms. A later full frame showed the Single
Player menu. One newly reviewed New Quest click confirmed in 37.407 ms and
released in 120.969 ms. `original/quest-choice.png` then visibly showed the
selected Search for Timmoria scenario, map size 48×48. This is real original
progress beyond the previous missing-DOWN menu blocker, not map gameplay.

The freshly reviewed forward-arrow click at canvas (947,682) was CANCELLED
before its handler ran: `handlerApplied:false`, `consumed:false`, no native
message, reason `reviewed native scene changed`. Independent release still
acknowledged. The controller latched a terminal failure; no later live request,
capture, rebind, replay or second original followed. Offline replay of the
published validator over the retained public snapshot deterministically reports
`pointer outside reviewed target`: its 800×600 native target rectangle is
compared directly with the 1024×712 canvas click. The CLI passes the parsed
canvas coordinates to this validator; the renderer maps them later. This is a
demonstrated coordinate-space blocker. The live wrapper discards the detailed
validation error, so no claim is made that its generic reason proves this was
the only mismatch at that instant. Fix review-space conversion using the actual
public viewport transform and preserve target containment; do not bypass it or
guess native coordinates for another original.

Owned host cancellation closed the original. Native and watchdog actual waits
were zero with both EOFs; this is not native Quit. The holder's module hash was
verified immediately before normal closure; holder and independent holder wait
also completed normally. No map/hero/town/turn action or native Quit is claimed.
Only selected complete screenshots remain, with hashes for omitted observations.
No box was created: ID null, state NOT_CREATED, expiry null, stop not applicable.

The concurrent VB authored dialog fixture exposed an additional unsupported
synchronous native BUTTON path: successful `dialog_route_mouse_screen` can
return without a queued check_input edge. The new guard truthfully closes it
UNKNOWN rather than inventing consumption. The VB owner received the guard and
runner ownership for a separately witnessed synchronous native-return boundary;
that work is excluded from this sealed runtime and is not qualified here.
