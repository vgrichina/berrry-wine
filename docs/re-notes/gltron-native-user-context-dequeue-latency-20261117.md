# GLTron native observation age and render drain, 2026-11-17

Evidence: `scratch/runs/20261117-gltron-native-user-context-dequeue-latency/result.json`.

No production repair is justified by this investigation. No new original was
launched. Two live turns, a round consequence and original native Quit remain
unproved. The predecessor's software and WebGL endpoints remain closed.

The original retained receipts do not measure native dequeue. Both failures
have token zero. Software observation-to-host-DOWN was 10 ms, with a 6 ms CDP
DOWN round trip; cancellation followed DOWN by 283 ms, at scene age 293 ms.
WebGL observation-to-host-DOWN was 86 ms, with a 34 ms CDP DOWN round trip;
cancellation followed DOWN by 173 ms, at scene age 259 ms. These receipts lack
owning Worker entry/post, render wait and dequeue spans. `status()` also checks
freshness and can cancel before the guest next polls. Calling either number
"native dequeued context age" overstates the evidence.

The new diagnostic runs the real native USER API in the production guest
Worker and actual GPU render Worker. It uses the unchanged retained
`6de8753b667362e909292536a340219ccbf90eedccb2b8405c31975193f5e78e`
module on the immutable `b29ef843aee74fe366aac3698704e3238797ed9e` runtime
graph. Passive wrappers record import spans, actual render record execution,
page context observations, dequeue, validation, consumption, status and normal
publication. They do not call guest exports, pump, render, reset clocks, or
restamp native observations. New fixture arguments select dimensions and the
number of native GL triangles. Four existing fixture recipes retain their
exact published PE bytes, including continuous, parked and delayed cases.

The 800×600 software case draws eight overlapping triangles on each 16 ms
native timer event. The native frontend combines them into `DRAW_UP` records.
The complete first image and subsequent red-background image were personally
reviewed before Enter and Space respectively. Enter reached native USER return
97 ms after applied DOWN, with trusted independent physical UP. Space reproduced
the stale-observation cancellation:

| Phase | Wall timestamp (ms) | Measurement |
| --- | ---: | --- |
| Native poll observed by page | 1794921477576 | Authentic owning context |
| Guest enters synchronous GPU drain | 1794921477602 | Before physical DOWN |
| Physical Space DOWN applied | 1794921477608 | Observation age 32 ms; CDP round trip 16 ms |
| `status()` cancels | 1794921477831 | Age 255 ms; token 0; queue removed |
| Guest GPU drain returns | 1794921478094 | 491.84 ms elapsed |
| Next owning Worker USER import | 1794921478105 | After the drain |
| Page observes that import | 1794921478106 | About 1 ms later; cancelled key absent |

During that drain, overlapping actual render batches took 173.55, 168.36 and
152.71 ms, with PRESENT calls taking roughly 3–4 ms. Those are elapsed call
durations, including any scheduler delay, not independently measured CPU time.
This proves a real render-backpressure route to status cancellation in the
authored workload. Guest runnable scheduling versus render CPU time is not
fully separated. The original command mix, textures and per-frame costs were
not retained; eight untextured overdraw triangles do not establish workload
equivalence to either original scene. In particular this is not an explanation
of the original WebGL failure and not an original-workload qualification.

A preliminary observer installation failed before native launch. A separate
256-triangle no-idle case never initialized an ordinary presented frame within
its bounded run; it is not input qualification. Both failures and their actual
wait/EOF evidence are retained. There was no query after any closed endpoint.
All three authored browser/native runs and their owner/watchdog processes
joined with actual waits, both EOFs and empty owned scopes. Scoped browser
cleanup is distinct from native Quit. No box was created.

The focused suite and canonical locked build pass. Native ownership, freshness
250 ms, delivery 500 ms, independent UP 1750 ms and capture 3000 ms are
unchanged. Active/parked writers, context loss and future-request refusal,
noDown, stale identity and parent-stall proofs remain the predecessor's
unchanged proofs; the focused regressions were rerun. No new old/fixed native
claim is made because there is no production fix. Foreign callback review rows
and WIP are excluded from the diagnostic runtime and publication.

Further work requires an exact original frame workload with the missing
phase spans, then a demonstrated bottleneck and native old/fixed regression
before another original can be authorized. This run stops with that concrete
attribution gap rather than changing fences or guessing at a runtime repair.
