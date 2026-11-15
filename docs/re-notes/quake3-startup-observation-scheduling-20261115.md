# Quake III startup observation scheduling, 2026-11-15

The closed layout run remains terminal UNKNOWN. Its 47-byte Worker snapshot
was written before the renderer had completed initialization. The measured
4050 ms synchronous WebGL overlap explains Worker occupancy, without proving
a GPU or driver-internal cause. No historical reply is reclassified.

LIGHT inspection: `tools/quake3-browser-controller.cjs` polls the render
Worker snapshot at startup, before requiring any presentation. The current
fullscreen/compact composition additionally installs per-native-call timing
bindings. Those bindings are diagnostic, not source or ownership guards;
their contribution to the historical delay is unproved.

The existing physical renderer sends `render-event/frame` with an actual
transferred ImageBitmap and a frame token, then `render-done` with the
transport identity after `sharedMessage` has returned and its exclusion
scope has ended. The page Manager tracks transport IDs and pending requests.
Neither notification alone proves current display pixels or GPU completion.
The outer message-chain cleanup also follows this notification. It is a
transport completion boundary, not a guarantee that another queued task
cannot start. The page queue check therefore remains necessary, and a later
unexpected long task still closes a written operation permanently.

Implemented in `tools/quake3-startup-observation-scheduling.cjs`: observe
snapshots passively at this genuine completion boundary,
only for work that emitted a frame. Startup must not send Worker snapshot
evaluations while waiting for this record. Records need a live target,
session, unique execution context and generation, monotonically ordered
transport/frame identity, unchanged actual source identity, a short original
timestamp age, and the pinned process/endpoint/window owner. Context loss,
realm replacement, stale delivery and queue races must refuse admission.
An installation nonce is needed in addition to CDP's numeric binding context:
an event delivered after numeric context reuse must not be attributed to a new
realm. The nonce is pinned before installing the observed expression, whose
actual source remains covered by the ordinary source inventory.
The page's existing Manager sequence and pending map distinguish completed
transport work from newer queued work without submitting a renderer command.
The existing current-display capture validator remains authoritative; passive
metadata is a scheduling hint and cannot replace personally reviewed pixels.

All written operations retain the existing timer that starts before send.
There is no timeout extension, restart, late-reply recovery or written retry.
A NOT_READY result must have zero Worker snapshot requests. Later unexpected
long work can still cause permanent UNKNOWN.

The new route composes the existing source/identity/visibility/capture/input
guards directly, without the optional native-call timing composition. It adds
no GL status query or driver/shader change. Completion records are bounded to
512 emissions, sampled at most every 100 ms after the first initialized frame.
The initial clear cannot suppress that first drawn-frame transition. The
existing required observation stops the startup observer without an extra
Worker request. Original producer timestamps are never refreshed on delivery.

Sims966353 and TIMcritical994115 explicitly released before implementation.
Their 991 and 123 actual wait/EOF records and 1172 and 124 recorded PIDs/groups
were personally verified. No workers or boxes were created.

Qualification passed the full locked build, 73 focused tests (one additional
opt-in test skipped), existing helper controls, fresh actual Chrome source
inventory, and current native key/Mouse1 independent UP, immutable capture,
source/owner replacement, visibility, compact readiness and fullscreen-exit
layout controls. Native key and Mouse1 UP acknowledgements were 140 and 141 ms
after arming. The fresh public/source/scheduling admission gates all passed.

The independent Chrome fixture ran the actual production render Worker,
transport, WebGL, transferred frame and compositor, with a 4.3-second native
`Atomics.wait` inside one ordinary shader query. Both minimal and instrumented
arms reached a valid snapshot/capture with zero startup Worker snapshot polls.
Actual queued transport, stale original timestamps, real context loss,
same-URL changed source with actual byte fetch, and Worker retirement refused
cached admission. Twelve bounded draw round trips had median 2.085 ms minimal
and 7.251 ms instrumented; per-call diagnostic bindings were 0 and 2061. This
is a fixture measurement, not a historical delay-cause or gameplay claim.
A deliberately written late snapshot closed at 3001.465 ms, remained UNKNOWN
after its reply, and permitted zero subsequent requests.

Failed fixture attempts remain distinct: the first exposed clear/frame
throttling; the next met unsupported Chrome LiveEdit and an invalidated test
pin after a preparation edit. The final source-replacement control uses real
changed same-URL scripts. An initial native-control host review expired; the
fresh complete native-control run was personally reviewed within its deadline.
Only the final frozen, closed controls qualify the feature.

Feature `a3fa79677` was published to main before the ONE original. The original
kept the unchanged registered media, real ticks, cooperative 10000 scheduling,
1800-second native bound, independent 1820-second watchdog, 180-second Quit
reserve and fixed three-second operations. Source/build/module stayed frozen.

The original passed startup with 473 passive observations and zero Worker
snapshot polls. Its accepted live generation-1 completion had frame/transport
230, HWND 65543, 223 native draws, 209 frontend draws and 14 presents. Required
actual source inventory fetched 32 JS and two WASM scripts. This is producer
evidence, not personally reviewed gameplay pixels.

The next boundary was the host-consent `Page.captureScreenshot`, request 554,
written at 11:40:49.487 UTC. It exceeded the fixed three-second deadline and
closed permanently UNKNOWN; its 5051.962-ms late reply is not recovery. There
were zero later requests, no host consent, permanent binding, game DOWN,
menu/arena/enemy consequence or native Quit. Browser/host shutdown is separate.
No retry, rebind or reclassification occurred. Screenshot/GPU/driver internal
cause remains unproved; the next work boundary is safe host-scene capture
under the unchanged operation deadline, requiring fresh original authorization.

Direct closure personally verified 67 actual wait/both-EOF records, including
native, watchdog, supervisor child and Chrome, and all 147 recorded PIDs/groups
absent. Both locks were free; source/helper/build/runtime were explicitly
released. An earlier ancillary watcher lost-wait UNKNOWN remains unchanged,
with independently verified absence. Box ID null, state NOT_CREATED, expiry
null, stop receipt NOT_APPLICABLE.

Evidence: `scratch/runs/20261115-quake3-startup-observation-scheduling/`.
`original-boundary.json`, `direct-closure.json`, `runtime-release.json` and
`result.json` retain compact results and hashes. Git SHA plus binary patches
retain source changes; media and host dependencies are pinned without copies.
