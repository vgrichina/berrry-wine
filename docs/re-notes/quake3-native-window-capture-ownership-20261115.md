# Quake III native window capture ownership, 2026-11-15

## Fresh owner-qualified capture assignment

The owner expressly revised the prerequisite for the fresh run
`20261115-quake3-native-owner-qualified-capture`. The missing historical Sims
outer-launcher wait remains PERMANENT_UNKNOWN; no old result or qualification
is changed. It is not a prerequisite for new unrelated runtime work. The new
gate requires Neverhood 1344998's explicit source/build/runtime release,
personally checked sealed direct native/watchdog/supervisor/direct-child
actual waits with both EOFs, recorded PID/group absence, free build/runtime
locks and more than 1.5 GB free on `/home`. At assignment time Neverhood was
the current heavy predecessor; Sims 1497762 follows this fresh task. Normal queue waiting
does not terminate the task.

The released test and this document were adopted after a board claim. All 23
named prior artifacts were hash-checked, including five successful pure waits.
They establish preparation only: no native run, build or original occurred.
The old stopping rationale below describes that terminated assignment, not
the revised gate. The new run preserves all input, source identity, whole-pixel,
publication-age, fixed three-second deadline and permanent UNKNOWN guards.

Static inspection identifies distinct copies to investigate, without assigning
them elapsed time: `WebGLBackend.present` snapshots the drawable into its
presentation canvas; `_publishContext` copies that snapshot into the drawable
layer; the render endpoint transfers an ImageBitmap; the main bridge copies
it into its layer; the renderer composites the displayed desktop. Deferred
ownership avoids canonical DIB readback, but does not remove those presentation
copies. Their presence alone does not establish the timeout's cause.

The adopted fixture now arms the existing bounded host/render diagnostic ring.
Optional Chrome tracing stops through a native timer, so a written UNKNOWN
requires no subsequent trace-stop request. Only necessary timing/process/thread
boundaries survive trace reduction. The fresh runner also records executable
maps against prelaunch dependency pins, actual child waits with both EOFs,
and final PID/group absence. Their execution results follow below.

Further retained-only inspection found that the last original DOM observation
used a 1024 by 757 viewport and displayed `screen-present` at (10,194), with
684 by 525 CSS/backing dimensions. Its hidden logical `screen` had 640 by 480
backing dimensions and the same CSS box. No fullscreen element was present.
This records layout, not historical ownership or filter/gamma settings.
`retained-layout.json` pins the compressed metadata and extracted operands.
An additional authored fixture uses those dimensions and the actual production
PresentationFilter/single-app composition path. It does not replace or replay
the old scene. The original direct-canvas fixture remains a separate control.

## Fresh native results and qualification limit

Neverhood explicitly released source/build/runtime at 14:49:59Z. Personal
verification read 336 sealed references, 239 actual waits with both EOFs,
and verified all 275 recorded PIDs/groups absent, including the direct native,
watchdog, supervisor child and actual outer waits. Both locks were free.
The historical ancillary Sims UNKNOWN was neither reconstructed nor promoted.

The genuine native fixture now passes with the retained host geometry and
actual production PresentationFilter, Intel Mesa UHD 620 through ANGLE WebGL2,
registered HWND 65537, context 1, process 1000, main thread 1 and producer
thread 2. Native GetDC allocated the canonical DIB; the same WASM instance,
window, native surface record and storage survive all ownership transitions.
The unregistered ownership negative fails as required. Deferred ownership,
real GetPixel readback through the pre-GDI fence, and subsequent deferred
reacquisition yield identical complete 1024 by 757 PNG pixels. Screenshot
latencies were 126.027, 102.476 and 109.497 ms. GetPixel returned 0x802040.

Two fixture defects were corrected: the native client rectangle helper needs
window-relative left/top/right/bottom, and every authored frame must clear
its newly selected back buffer. Earlier failed runs are retained separately;
neither defect is a demonstrated production capture defect. An intermediate
run also refused its initial completion hint. No freshness guard was relaxed.

A genuine native 209-draw, 14-present deferred burst captured the whole viewport
in 93.467 ms while native transport was active, with identical full pixels.
This busy diagnostic does not establish current owner-qualified admission.
Its later retirement Runtime.evaluate exceeded the fixed 3-second deadline;
that connection is permanent UNKNOWN with zero later requests or adopted late
pixels. Retirement in subsequent fixtures starts through a bounded request
and is observed through a passive completion binding.

The deferred current-publication control refused capture: its signal arrived
2890 ms after the recorded displayed publication, so it sent zero screenshot
requests. Native producer completion was about 1066 ms after burst start;
the passive settled signal arrived about 2965 ms after producer completion.
This identifies a late fixture publication observation, not a screenshot
encoder bottleneck or the historical original cause. Native trace boundaries
are retained without raw payloads; no timer, age or deadline was rewritten.
The genuine eager GetPixel-per-present control completed its burst in about
4990 ms, then qualified a current publication at age 24 ms and captured exact
full pixels in 36.930 ms. Total burst time is not screenshot request latency.

No necessary production phase blocking a complete current capture beyond three
seconds was demonstrated on these genuine ownership paths. Therefore no generic
production repair is justified or qualified, and the conditional ordinary Q3
attempt remains unconsumed. Host consent, menu, arena, enemy, native Quit and
host stop are all NOT_ATTEMPTED. Historical original ownership and timeout cause
remain UNKNOWN; there was no new request to that original.

The existing `test-gl-native-render-load-web.js` was also run unchanged. It
failed its exact packet-count assertion (14 leased batches versus expected 6,
zero copied batches/bytes). This separate suite failure is preserved rather
than changing an unowned test or claiming full native-suite qualification.
The fresh fixture independently demonstrates actual native GetPixel/fullpixel
ownership transitions. Evidence, dependency pins, relevant patches and direct
closure live in `scratch/runs/20261115-quake3-native-owner-qualified-capture/`.
The focused guard suite passed 74 tests with one skip. Both required full
`flock /tmp/wine-build.lock bash tools/build.sh` builds passed: shared and
HEAD plus the two whole owned files. The latter uses an in-place read overlay,
without moving or editing foreign WIP. Its initial helper failed before build
because Git output exceeded Node's default buffer; increasing only that helper
buffer allowed compilation. An initial module-only native check still served
shared JavaScript through HTTP file streams and is explicitly not full HEAD
runtime qualification. The corrected stream/stat overlay passed the genuine
ownership/fullpixel transitions at 104.068/92.914/138.874 ms, with actual
Worker sources pinned to HEAD and the identical complete viewport PNG.
Shared native WASM SHA-256 is
`eff47c5b9342ec18b157cd99c1c870977c6e6cb1fafc6589c19c1b3a7170e858`;
HEAD-plus-owned native WASM is
`8340c85fd34df408001f1c05502672613ab4103974368801f6945de8abe62d1b`.
The shared build is restored after the HEAD comparison for the next worker.

No production paths, game media, configuration, clocks or foreign WIP changed.
No boxes or workers were created.

## Prior preparation and closed result

Investigation stopped at an unmet runtime prerequisite; no native qualification
or production capture repair. The prepared fixture is unrun and uncommitted.
The conditional original has not been consumed. Historical written UNKNOWN
remains permanent, with no later requests, input, replay or rebinding.

The predecessor `ffc5780db` fixture passes `{exports:{}}` as the window's
instance. `Win98Renderer.deferGpuWindowReadback` requires the actual window
instance's `gl_window_set_gpu_owned(hwnd, 1)` to succeed, after finding an
actual canonical surface. The fixture therefore uses eager merging despite
the bridge receiving a real version-one export. Its 3367/5093 ms timings
establish that fixture's eager behavior; original ownership parity remains
unknown. Neither its encoder comparisons nor an artificial Worker wait
qualifies a repair of the original capture boundary.

Retained original metadata records HWND 65543, context 1, native WebGL,
generation 1, 209 frontend draws, 223 native draws and 14 presents. It does
not record the native ownership bit and exact canonical presentation identity
at screenshot request 554. Source availability cannot fill that evidence gap.
The original is inspected through retained files only and will not be reopened.
The retained boundary, owner observation, scheduling log and compressed
visibility log contain no explicit pending-readback, merged-layer, ownership
export result or canonical-presentation field. Their exact hashes and the
limited text search are retained in `retained-ownership-search.json`.

The new fixture is prepared around the native registration, GetDC allocation,
real WASM exports, native WAT command encoder, GuestRpc broker and production
GLRenderHost path used by `test-gl-native-render-load-web.js`. A native GetPixel
control demands eager canonical readback through the actual pre-GDI fence.
It does not substitute an ownership-success stub or pretend to emulate an
older module. Full displayed capture, ownership transitions and opposing
controls remain to be run after both required source/build/runtime releases
and personal verification of direct waits and absent processes/groups.
The new producer uses ordinary native present flushes and the production
two-publication backpressure. Fourteen presents inside one authored packet
cannot establish parity with that native pacing.

Sims 1309984, then Neverhood 1344998, precede this task in the heavy slot.
Preparation edits only the two newly owned paths. No existing source, helper,
module, build, native runtime, Chrome or original activity is authorized yet.

Sims' explicit release `d1d1d6584b690f803bf4bd369d866061ff4fe7e3f690af1708e3850ae12f5d4b`
records `outerLauncherActualWait: PERMANENT_UNKNOWN` and
`missingOuterWaitNotReconstructed: true`. Its original outer launcher exited
143 without `actual-outer-wait.json`. Personal verification read and hash-checked
121 sealed references, including 119 actual waits with both EOFs, and verified
254 recorded PIDs and groups absent. Those complete waits do not supply the
expressly missing current original outer receipt. The task requires that direct
receipt before heavy activity. This is a permanent evidence gap, separate from
the normal Neverhood queue wait; no missing receipt has been reconstructed.

Only retained-metadata checks and JavaScript syntax checks ran. The native
ownership fixture, fullpixel controls, opposing native controls, shared build
and HEAD-plus-whole-owned build remain unrun. No production phase has therefore
been demonstrated to block the actual deferred path, and no proposed repair or
gameplay claim is qualified. The two new paths remain shared-tree WIP, released
for a future task with an expressly revised prerequisite. No commit or push was
made because the required build is forbidden by the unmet gate. No boxes,
native processes or watchdogs were created by this task.
