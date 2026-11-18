# NFS III completed-frame publication lifetime, 2026-11-18

Evidence: `scratch/runs/20261118-nfs3-deferred-publication-visible-frame/`.
All predecessor UNKNOWN scopes remain closed. No renderer fence has changed.

`tools/nfs3-deferred-publication.cjs` observes existing Presenter, slice,
composition and source-staleness calls. It preserves synchronous return values,
exceptions and receivers. It neither reads pixels nor calls guest exports,
polls/wakes an actor, changes freshness, schedules work or paints. Optional
native state reads use the tested module's region map and read the primary's
published DIB/RT/creator/sequence, current allocation and CPU-present sequence.
The sequence is checked twice; an incoherent record is explicitly identified.
Its event repository and stale-wrapper restoration state are bounded.
Retirement, HWND reuse, foreign instances/processes, hide, source replacement,
GDI depth, active/poisoned writers and endpoint closure remain observations;
this witness does not authorize input or mid-slice publication.

The final authored 64-draw Device2 control uses the recovered exact c9 browser
graph plus published host-step corrections, b8c8 native module, a separate
native USER actor and ordinary guest/render Workers. Five accepted completed
frames were observed, three while publication was held, with five ordinary
publications during the trace. The longest observed interval from a held
completion to a later publication was 2718.90 ms. Actual compositor stale
predicates all returned false. Native primary DIB/creator records matched.
The whole blue rectangle and white background were personally reviewed;
retained GPU, connected logical canvas and exclusive compositor source each
have 76,800 nonwhite and 230,400 white pixels, fingerprint 328607173.
Thus a long await with a pending repaint can recover through ordinary
boundaries; that observation alone cannot explain the original's white page.

Earlier authored scopes are retained honestly: the first trace did not yet
distinguish rejected deliveries; a second control failed an unnecessary
minimum-frame-count assertion despite correct pixels, and a later startup
rAF poll hit its immutable protocol timeout before witness installation.
The driver now uses finite external startup observation and records accepted
deliveries separately. No failed scope was reused. These are harness controls,
not original-game retries or evidence of a rendering repair.

Focused witness tests cover direct native-table reads, allocation mismatch,
uncommitted sequence, invalid entry, bounded retention, source replacement,
restoration ownership and exception neutrality. Existing Worker GDI publication
fences, capture-ordering and native freshness regressions pass. The locked
full build passes. No causal runtime correction is claimed by this preparation.

The fresh original after preparation exposed an earlier, ordinary boundary
failure: `_overlayFrameLayer` returned CPU layer objects 10–13 instead of retained
GPU layer 5, with guest/GDI depths zero and native allocation/creator valid.
Every actual GPU stale predicate returned false. Publication 17→18 and 19→24
published those replacements. The subsequent held slice merely preserved an
already white source. The whole page was reviewed white and the scope closed
with zero input; no endpoint was reopened.

The repair gives native GPU presents the same scan-out priority as explicit
CPU primary presents. `d3dim_gps_window_primary_slot(hwnd,dib)` validates the
actual submitted HWND, current entry/DIB/creator, CPU-present stamp and stable
publication sequence. CPU fallback selects that exact primary before scoring
unrelated offscreens. Existing derived-byte, parked/scroll hold and all
publication fences remain. Actual retained CPU writes still upload; a later
CPU present, changed cooperative HWND, old DIB or retirement revokes the GPU
pin. This adds no paint inside a guest slice and changes no freshness clock.

The authored Device2 fixture uses ordinary native Lock/write/Unlock before
GPU drawing, so the completed GPU frame has a black CPU backing while an
unrelated offscreen is white. With the same EXE, separate USER/DirectInput
threads, 64-draw pressure and normal browser/render Workers, old source
publishes 307,200 opaque white pixels (fingerprint 2596822469), while retained
GPU pixels remain the blue quarter (fingerprint 328607173). The new source,
connected canvas and retained GPU all match that complete blue-quarter frame.
Both whole screenshots were personally reviewed. The old diagnostic correctly
rejects the replaced selected layer; its complete pixel report is retained.

The native producer/software-executor/host regression also fails when only
the arbitration block is removed (CPU fallback returns 1 and steals the GPU
layer), and passes with the repair, checking every retained GPU pixel. Earlier
native comparison with no registered window did not exercise a destination;
that was corrected by registering the native window table before comparison.
Native negatives cover wrong DIB, HWND switch, CPU-present stamp, retained
native writes, Lock/readback, retirement, reuse and queued Flip backpressure.
8/16/32-bit host tests cover whole pixels, real CPU replacement and unowned
fallback. Existing GDI/guest publication fences and retained-primary tests
pass; locked full build passes.

A separately coordinated, backwards-compatible `entropy_u32` host import is
included because the gears owner's in-progress native import caused an actual
LinkError in the shared harness. It uses Web Crypto CSPRNG only, without a
weak fallback; that owner tested real native/compat and normal browser Worker
pointer semantics. No gears native files or foreign render Worker files were
edited here.

Published `cf7044e37` was exercised on a fresh exact original (135 media pins,
eight actual owner module readbacks, b91a6cdc native module recovered from the
b8c8 source plus this native patch). Whole Corvette loading and whole rainy
cockpit at 0 MPH were personally reviewed. The actual DIB table now confirms
slot 14 is the native 640×480 RGB565 primary with entirely black CPU bytes;
slot 18 is an unrelated 640×480 offscreen with every byte FF. The compositor
source and retained GPU match. This directly validates the causal repair on
the original, not only the authored fixture.

The first requested throttle did not reach input preparation: the screenshot
was 17,736 ms old when the command was processed, so the old driver passed a
negative preparation budget. The scope closed UNKNOWN with zero physical
edges and actual native/watch EOF. It was not reopened. The association commit
label in that scope's environment was mistyped; a retained erratum records
this. Exact recovered source, module bytes and eight actual owner readbacks
are authoritative; the runtime was unaffected.

`reviewedInputAdmission` now refuses an expired/future screenshot or insufficient
preparation reserve as known NOT_SENT before any browser request. It retains
the original screenshot timestamp, unchanged 15s lifetime, 3s native preparation,
500ms native confirmation and independent 250ms physical UP. A fresh capture
and its filesystem handoff are retrieved together to avoid spending the review
window between requests. Focused tests reproduce the exact negative-budget
failure and check known refusal, boundary, clock and admitted reserve cases.
