# MCM synchronous source command adapter

Evidence: `scratch/runs/20261120-mcm-synchronous-source-adapter-implementation/`.

The preceding completed-source task launched only startup and closed at its
disk floor before arming. This task changes source before any ordinary launch.
The existing real command lifecycle is sufficient: host boundary admission
installs `SynchronousFlipProducer` in the owning guest Worker; native
`0x20008/0x20009` seal descriptor, serial, page generations and retained RGB565
pixels before the upload broker parks. The actual decoder already consumes
that request through the synchronous publication join. No WAT, shared renderer
or guest Worker implementation change is needed for that path.

`tools/mcm-bound-input.cjs` now exposes `chain.armSynchronousSource()`. It calls
the production `armD3dimPublicationObservation({synchronousSource:true})`,
rechecks the actual process/Worker identities, and requires a new reviewed
capture afterward. Duplicate arming or owner replacement cannot admit input.

When the compositor selects the CPU replacement, the page reader uses
`tools/mcm-synchronous-source.cjs` to require its own completed native source,
descriptor/serial/command batch/Worker slot, decoder canvas proof and qualified
current publication. The former GPS endpoint and its actual executor remain
separately checked. No old GPS tag, full decoder extent, timestamp, repaint or
unsealed canvas is accepted as authority. Capture age remains 12000 ms. The
adapter conservatively refuses a subsequent repaint without a new qualified
row; it does not promote a historical row to current publication.

The focused fixture compiles the native source and runs the actual owning Node
Worker, native Flip, RGB565 seal, retained copy, host decoder and compositor.
The pinned pre-change page adapter at `759080889` rejects that same native
replacement; the new page expression accepts it. Wrong process owner, endpoint,
replacement layer, stale publication, retirement, incomplete decoder and native
partial HUD controls reject. The fixture also exercises a later genuine native
replacement, concurrent native source rejection and producer closure. Mock
arming controls supplement this proof. The 15 GPS/arming/freshness/observer
regressions pass. The guarded locked build passes.

Original-game execution and strict publication receipts are recorded in the
run result after the implementation checks. Prior quarry throttle/turn and
foreground evidence is reused; no storage or signal attribution investigation
is part of this change. Localhost box ID null, NOT_CREATED, expiry null, stop
receipt null; root owns shutdown and this task cleans up its own process groups.

Commit `753deb61e` passed the native fixture, 15 regressions and guarded locked
build. Strict pull failed on foreign `lib/region-map.generated.js` and
`src/00-regions.wat`; no push or foreign conflict resolution occurred. The
affected original used the exact retained module and 311 verified media inputs.
Actual Worker module bytes matched that module. Whole frames show the
video-memory dialog and Enter Name with MCM typed. The screenshot `main-menu`
still shows Enter Name. Two expired review leases refused before dispatch.

At 2026-11-20T09:49:02.326Z the independent outer watchdog sampled
1,485,811,712 free bytes and permanently closed the scope before source arming,
quarry or Escape. No later endpoint request or original retry is allowed.
Native supervisors report exit 143 with no leaks. Driver and inner supervisor/
watchdog have direct wait/EOF records; graceful Chrome/board waits were
interrupted. Cleanup uses local process evidence, not a later browser request.
Ordinary Quit and original current-display binding remain unproved.

After closure, read-only inspection of `lib/gpu-stream-host.js` lines 182–183
found a missing control in the earlier GPS fixture: the real GPS layer occupies
both `_gpuFrameLayer` and `_dxFrameLayer`. The committed selection condition
would send that GPU layer to the synchronous CPU validator. A one-line CPU-kind
condition and a corrected GPS fixture are prepared as **uncommitted WIP** in
`tools/mcm-bound-input.cjs` and `test/test-mcm-current-gps-readiness.js`. No tests
or build were run after closure, so this corrected final tree is not qualified
or published. The earlier native CPU proof remains valid for its tested
version; it is not evidence that the corrected GPS branch passed. The precise
remaining dependency is resource admission for testing/building that correction
in a new task, followed by the original source arm/Escape/current-display/Quit
sequence. No lease, timestamp or repaint workaround was introduced.

## Dual-slot correction follow-up

Evidence: `scratch/runs/20261120-mcm-final-dual-slot-source-quit/`.
The page selector now excludes GPU layers before invoking the completed native
CPU-source validator. The GPS regression uses the production `Presenter.present`
and `Win98Renderer._overlayFrameLayer`, so the actual presenter installs one
GPU layer in both window slots. No hand-assigned GPU kind or alias creates the
positive case. Against `753deb61e`, this same fixture fails specifically in the
CPU-source validator; the corrected selector admits its current GPS owner.

The real compiled native Flip/owning Worker fixture also passes on the corrected
tree, including the native replacement, decoder, filtered compositor and pinned
pre-adapter old-fail/new-pass proof. Wrong owner/endpoint, replaced layer/display,
moved window, stale publication, retirement, incomplete decode, native partial
HUD, concurrent source writing and a repaint without a new qualified row still
reject. All 15 GPS/arming/freshness/scalar observer regressions pass. No source
producer, WAT, historical-row promotion or forced repaint changes were made.
The guarded locked build passes. The follow-up result records strict publication and
whether the affected original became eligible for Escape and ordinary Quit.
