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
