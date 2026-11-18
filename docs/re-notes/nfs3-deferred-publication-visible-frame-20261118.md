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
