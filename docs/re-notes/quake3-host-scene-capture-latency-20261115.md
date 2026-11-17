# Quake III host-scene capture latency, 2026-11-15

Capture repair remains unqualified. The conditional new original was not
launched. Both measured capture routes exceeded the fixed three-second
operation deadline during real production presentation work. Waiting for
ordinary publication instead left the genuine producer hint stale. Neither
result authorizes input or an original. No production source, helper, capture
parameter, deadline, provider, game configuration or native input guard changed.

The predecessor's original remains permanently UNKNOWN. Request 554 was
written at 11:40:49.487 UTC and returned after 5051.962 ms. There were zero later
requests, host consent, permanent binding, game DOWNs, menu, arena, enemy
consequences or native Quit. Host shutdown was a separate consequence. Its
473 passive observations, zero Worker snapshot polls, generation 1,
transport/frame 230, 223 native draws, 209 frontend draws and 14 presents
established startup only. Actual source inventory contained 32 JS and two
WASM sources. The late pixels were not adopted and that original was not
reopened.

Retained metadata identifies a scheduling gap, without explaining the delay:
the accepted completion was transport/frame 230, publication 77; the final
host observation at 11:40:49.458 was sequence 242, pending zero, publication
still 77. The earlier completion therefore did not describe the latest
transport. There is no retained compositor/encoder trace for request 554.
Assigning its duration to a driver, readback or encoder would be unsound.

## Actual production controls

The new test uses actual Chrome 151.0.7922.108, the existing WASM, production
render Worker, packed GL command stream, native WebGL, transferred ImageBitmap,
`GLRenderHost.Bridge` frame consumer and `Win98Renderer` compositor. A 640 by
480 GL layer is displayed inside an 800 by 600 desktop. The complete 1024 by
857 host viewport includes header, fixture button, footer and right/bottom
edge marker. These are authored fixtures, never Q3 gameplay or proxy game
pixels. The native device reported Intel Mesa UHD Graphics 620 through ANGLE.

Source bytes, module bytes, unique realms, installation nonce, endpoint,
window, frame/transport sequence, ordinary publication, pending work, object
identity and viewport geometry were checked against prelaunch pins. The busy
burst uses ordinary GL state boundaries to prevent frontend draw coalescing:
209 frontend draws, 14 actual presents/transfers and 223 native draws. It
matches counters, not Q3 geometry. Recorded decisions overlapped actual
native work, with a two-millisecond epoch comparison margin.

| Control | Measured consequence | Qualification |
| --- | --- | --- |
| Injected 4300 ms Worker wait before GL flush | Screenshot returned in 65.112 ms with identical whole pixels | That wait mechanism did not reproduce the capture delay |
| Production burst, normal full-viewport PNG | Deadline rejection at 3004.990 ms; late reply at 3367.010 ms | Permanent UNKNOWN, one written request, zero later requests, no late pixels adopted |
| Same production burst, `fromSurface:false` | Deadline rejection at 3003.427 ms; late reply at 5093.200 ms | Same permanent closure; no demonstrated benefit |
| Known-busy local scheduling gate | Refused with zero written CDP requests | Safety control passes; no captured scene admitted |
| Ordinary publication after burst | Example settled after 2035 ms; producer hint then stale | Zero screenshot requests; no timestamp refresh or new-frame substitution |

The paired production burst trace starts with Chrome and stops on its native
prearmed timer. No `Tracing.end`, screenshot retry or other CDP request is sent
after UNKNOWN. Raw trace data is reduced to necessary timing/process/thread
boundaries, hash recorded, then removed. No screenshot trace category or pixel
payload is retained. An attempted startup-trace clock marker was rejected;
that failed fixture is preserved, not used as qualification. Final timing
alignment uses the first reference encoder lying inside its actual request/
response interval, including two milliseconds of epoch-rounding margin.

For the normal production burst, the second copy request began 3293.222 to
3347.219 ms after the screenshot write. PNG encoding itself took 4.855 ms.
For `fromSurface:false`, the corresponding interval was 3425.644 to 3514.853 ms
and encoding took 10.920 ms. Several long
`SkiaOutputSurfaceImplOnGpu::SwapBuffers` scopes precede the copy/encoding
boundaries. Those scopes locate observed elapsed time; their internal
GPU/driver/compositor cause and the predecessor original's cause remain
UNPROVED. Trace overhead is not asserted absent.

The first draft fixture reset its own bitmap-consumer canvas dimensions on
every frame and initially coalesced 209 draw records into 14 frontend draws.
Its 4128.503 ms late capture is diagnostic only. The final production consumer
reuses its backing store and replaces the GPU layer through the actual host
bridge. Earlier failure logs and exact source patches remain preserved;
only the final production path supports the conclusions above.

## Whole pixels and native safety

The final balanced idle comparison made six captures per parameter on each of
two scenes: ordinary PNG, `optimizeForSpeed:true`, and `fromSurface:false`.
All 36 complete decoded RGBA images matched their scene's reference, and
source/frame/viewport identity stayed unchanged. Dense-scene whole-request
medians were 76.427, 76.907 and 83.176 ms respectively. Fast encoding reduced
encoder time from 11.604 to 3.671 ms without improving whole-request latency.
An earlier hand-consumer microbenchmark's 24.953 ms / 29.47 percent dense
saving did not persist through the production consumer and never qualified a
repair for the five-second original boundary. The prior investigation filter
was at least 20 ms and 20 percent median saving with full pixels equal; the
final production comparison fails it.

Actual newer queued work, stale producer time, actual same-URL source
replacement and Worker retirement each refused locally with zero written
requests. Late written operations remain UNKNOWN and cannot send later
requests. Passive metadata is only a scheduling hint, never reviewed pixels.

The new native entry point runs the unchanged composed current safety tests
as a fixture only; it cannot launch an original. Fresh controls passed actual
compiled-interpreter key DOWN/UP and Mouse1 DOWN/UP consumption, with native
edge intervals of 130 and 115 ms and independent release ACKs. They also
passed held/pending paint, hidden/clipped/replaced output, owner replacement,
actual fullscreen exit and viewport resize, retired context, compact-readiness
semantic equivalence and delayed-written UNKNOWN controls. Focused regressions passed 76 tests with one optional Chrome-source test
skipped. The fresh native fixture was run separately. The full flock
build passed and reproduced the same WASM SHA-256
`eff47c5b9342ec18b157cd99c1c870977c6e6cb1fafc6589c19c1b3a7170e858`.

One preparatory native invocation lacked composition pins and failed before
browser launch. A subsequent fixture reached the manual host review but
expired without consent input; its closed result is retained. A fresh fixture
used a new personally reviewed whole host capture and nonce within the
original review deadline, then passed. The expired fixture was not resumed.
These fixtures do not consume or qualify the conditional original.

Selected PNGs were personally viewed at original detail as explicit
`image/png` items with unchanged stored bytes. The image loader returned an
octet-stream URL; correcting presentation MIME changes no pixels, hash,
capture timestamp, age or intent. Duplicate identical items are a local
presentation aid, not a universal capture repair. Variable earlier display
handoffs are recorded; they do not prove blank native pixels or explain the
historical timeout. Selected screenshots show fixtures only.

## Outcome and continuation

The concrete blocker is an unqualified material capture path: normal and
alternative full-viewport capture still miss three seconds under production
presentation, while waiting can violate existing producer freshness. No
freshness relaxation, deadline widening/restart, cropped capture, painted
substitute, polling loop or late-reply adoption was introduced. Host consent,
Q3 menu, arena, combat and native Quit remain unattempted in this task.

Next work must identify a necessary presentation/capture scheduling repair
with the existing provider, demonstrate current full-pixel/identity equivalence
and end-to-end benefit under actual production work, then pass current native
and regression guards and publish before consuming the single conditional
original. An unchanged blind original is not authorized by these results.

Sims and TIM explicitly released before this worker entered the heavy slot;
this worker personally checked sealed direct waits and PID/group absence.
TIM's historical missing-watchdog wait remains permanent UNKNOWN and was
never reconstructed from PID absence or used as qualification. No workers or
boxes were created. Runtime closure, selected reviews, failed controls, exact
Git SHAs/binary patches, source pins and compact timing evidence are in
`scratch/runs/20261115-quake3-host-scene-capture-latency/`. Git is the source
archive; no source/media/WASM/frame bundles were added.
