# Renderer startup publication contract

Implementation validation. Evidence: `scratch/runs/20261116-gta2-renderer-startup-publication-repair/`.

The predecessor implementation `1305d45eb47203f32bfa690117265c4967c72a9d`
fixed native USER readiness. Its single original software launch reached the
PLAY/OPTIONS/QUIT menu, then refused before input because its permanent startup
render endpoint was `none` and the actual menu endpoint was `1`. That endpoint
remains permanently UNKNOWN and closed. Neither it nor earlier closed endpoints
are contacted. Historical failure causes remain UNKNOWN.

The new generic contract distinguishes an explicit render-Worker startup
requirement from a GDI-only startup. The original controller declares its actual
D3D Worker requirement; it supplies frozen expected module hashes, never a
renderer endpoint ID. GDI callers can publish a healthy `none` identity. Neither
route may change that permanent identity later. A main-thread CPU rendering
application does not require a separate render Worker.

Before publication, a retained read-only page observer checks the original
process, CPU, USER, module, memory, physical handlers and physical-UP state. It
waits for the runtime's own creation of a render manager, endpoint and legacy
control, requiring actual READY with no ERROR. It pins each observed object at
first creation and refuses replacement, closure, retirement, ambiguity, wrong
CPU endpoint, wrong module/memory or backend. It creates no renderer, calls no
render operation, changes no guest state and installs no gesture endpoint.

The actual newly created render Worker is then checked on its own debugger
session: one endpoint, actual instance and memory, endpoint generation, backend,
control READY/no ERROR, and executed WASM bytes matching the frozen native module.
Both retained owners are checked again before bridge publication. The original
fixed 3000 ms startup deadline includes all this work; it is never extended.
Failures before publication remain positively UNSENT; publication uncertainty
closes permanently with zero later requests. Native USER checks remain intact.

The page bridge freezes its initial full identity. Subsequent none-to-one
publication, owner/port/module/backend changes are failures, with no rebinding.
Renderer generation and target from startup are also checked by the controller
and independent release child's actual renderer observation. COMPLETE remains
500 ms, independent physical UP 1750 ms and aggregate observation 3000 ms.

The new native fixture uses an independently authored DDraw/D3D7 COM sequence
after native CreateWindow/SetFocus and Sleep. It renders one triangle through
real guest public methods, then reports completion through OutputDebugStringA
and SetWindowTextA. It shares only the predecessor's PE/USER bootstrap. The
separate GDI fixture never imports DDraw or D3D. Neither fixture uses original
game bytes, injected export calls or private game state.

Owner Telegram 199 permits independent immutable local runtimes. The new
project runtime helper retains exact Git source in a sealed transient memfd and
the native module in a separate sealed transient memfd. Owned source remains
freshly pinned and must not change during a run. Every final module check still
reads and hashes module bytes anew; module bytes never enter the immutable
source digest shortcut. No source tree, WASM dump or media bundle is retained.
Git SHA and binary patches are the recovery recipe. Shared output builds remain
serialized and coordinated with the live GL and Sims owners.

The final native suite has 34 passing cases: D3D before/after on main and
Worker, GDI-only startup on both, the 20 native USER cases, seven subsequent
renderer identity/failure cases, and original-controller-style early debugger
inventory. All startup cases sent zero input and captured no frames. Failure
cases retained zero-wire local replay/rebind/request refusals. The predecessor
fixture published `none` then observed a genuine renderer; the repair publishes
only after the actual renderer, backend, module and generation are established.
The final shared and sealed HEAD full flock builds passed. The shared focused
set of ten commands passed. The sealed HEAD focused set failed its fixed-500 ms
blank-control child-arm check; its outer supervisor exited zero, which was
initially mistaken for test success. The inner child exit is authoritative. The rebuilt HEAD module SHA-256
`ef7de08a1a1ea564ea7ff2fbd1e3dbbd56cbfc07c19d3db7fcb45c9bac4b5fb8`
exactly matches the retained sealed module.

Exploratory refusals remain evidence, not successful runs. One authored
modal Worker launch failed to load the module because the new immutable runtime
served retained bytes with live shared-file Content-Length. The helper now
obtains real Stats from the same sealed FD; the fresh authored fixture passed
while shared builds used other module bytes. The controller-style early debugger
fixture also exposed duplicate identical engine script descriptors. The same
script ID in the same session is one script; conflicting descriptors or distinct
scripts remain refused. Every accepted module is still freshly recovered and
hashed. The final 34-case suite passed after these corrections.

Implementation `e1d6aad9afe32cc85739e5e810c4b90e283122e4` was committed on main
and immediately published with strict pull/push. Current native qualification
subsequently refused; no original launch was authorized.


A separate native late-publication negative deliberately omits the D3D startup
requirement. After the authored public COM draw completes, reading the permanent
bridge refuses `permanent startup renderer identity changed`; zero input,
zero captures and zero later wire requests. Its earlier premature fixture
completion assertion is retained as unqualified. The final count is 35 passing
native cases, including this expected refusal.

One later shared focused run failed waiting for a blank control child to arm;
its missing arm cause remains UNKNOWN. The focused test now retains the actual
child wait and both EOFs even when the arm assertion fails, with no deadline
change. A fresh full ten-command focused set passed. No original ran during any
of these probes.

Parallel publication does not replace this lane's frozen native inputs. The
runtime uses Git `3bcb7bef7e388ff469cdaa7bb297ecc7a76d3bad` plus the recorded
owned code patch and the matching retained module. The implementation commit
must be published on main, and its exact owned executed files must equal the
qualified fresh pins. Other lanes' later core changes remain outside this view.
No historical endpoint is contacted, rebound or retried.


Final outcome: concrete current qualification blocker

The published main-thread native normal fixture completed first-modal Enter,
second-modal Enter and ArrowUp, each after a personally reviewed whole-host
screenshot with fresh nonce and with actual independent physical UP. The fourth
intent, authored native Quit, failed `actual independent child arm within 500ms`
before any physical DOWN. The child's arm-ACK-ready timestamp is exactly 500 ms
after its configuration start; the parent refused when it observed the result
after the fixed deadline. No bound was extended. Cause beyond that observation
remains UNKNOWN. This endpoint is permanently closed: three subsequent local
replay/rebind/request refusals produced zero later wire requests.

The remaining four Worker normals and all 50 faults were NOT RUN. The required
eight-normal/full-fault qualification has not passed. The single original
software attempt was NOT LAUNCHED; walking, vehicle entry, driving, original
native Quit and WebGL are unproved. The four selected screenshots are authored
fixture views only, listed with hashes in `selected-screenshots.json`.

A final published sealed-HEAD focused run also refused the blank-control child's
unchanged 500 ms prearm bound. Its child actual wait and both EOFs are retained.
Three earlier failed focused probes lack a direct grandchild wait receipt; their
PIDs and groups are absent in the final process audit. This receipt gap is
retained explicitly, not represented as a successful wait. All native fixture,
release-child, watchdog, supervisor, outer and module-holder waits are recorded;
all recorded task PIDs and process groups are closed. No box was created.

The implementation publication title and an earlier messageboard statement
overstated sealed-HEAD focused success by reading the outer supervisor status.
This report and `result.json` correct that claim. Both full builds and the 35
native renderer/USER cases passed; focused HEAD and current normal qualification
did not pass. Next work must repair the current child-arm boundary while
preserving the fixed bounds and permanent closure; it requires a fresh task and
fresh endpoints. Source/build/runtime ownership is released after this report.
