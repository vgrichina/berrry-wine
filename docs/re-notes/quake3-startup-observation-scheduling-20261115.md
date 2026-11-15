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

Candidate: observe snapshots passively at this genuine completion boundary,
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

Heavy order is Sims966353, TIMcritical994115, this worker. Existing code,
build and runtime remain untouched until both explicit releases and personal
direct wait/EOF/PID-group verification. No workers or boxes are created.

Evidence: `scratch/runs/20261115-quake3-startup-observation-scheduling/`.
Qualification and the single conditional original outcome are pending.
