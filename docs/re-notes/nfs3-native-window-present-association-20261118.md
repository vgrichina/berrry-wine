# NFS3 native window-present association, 2026-11-18

Evidence: `scratch/runs/20261118-nfs3-native-window-present-association/`.
All preceding original/UNKNOWN scopes remain closed.

The authored genuine Device2 API control creates its UI on a separate native
thread and renders through normal guest Workers and a real render Worker.
With the frozen c9 browser source and native 7d347 module it reproduced the
zero window-present association. The publication existed, its primary was
still type 2, its creator and cooperative window matched, and its CPU present
stamp was unchanged. Its saved DIB differed from the primary's current DIB.
This was a live Flip transition, rather than evidence of retirement or a
foreign instance. The read-only observer samples existing native sync kicks;
it neither submits a present nor changes guest memory, clocks or input.

The producer swapped the primary/back-buffer DIBs before entering
`d3g_present`, which could synchronously wait for the preceding in-flight
PRESENT. Throughout that wait the old publication failed the exact-DIB check.
The host correctly marked its retained layer stale and excluded it. The old
control retained 114 sync entry/exit observations, all with zero association
and mismatched DIBs. The corrected control retained 58, all with valid
associations and matching DIBs, while completing 60 actual presents.

The correction reserves PRESENT capacity before Flip changes the primary DIB.
The ordinary PRESENT capacity check remains for other callers. Native reader
checks for type, DIB, creator, target window, render target and sequence remain
unchanged, as do CPU retirement and browser window/instance fences. No host
composition, freshness, binder, inventory, physical input or guest clock/state
semantics are changed.

The focused native regression queues actual records behind an asynchronous
consumer and checks the preceding publication at its synchronous backpressure
boundary. It fails against the old producer and passes against the corrected
producer. Existing foreign-target, window-switch, retired-primary,
same-address allocation reuse, CPU-write and whole-pixel checks remain in the
same regression. Separate browser pressure controls and exact module recovery
are recorded in the evidence; whole authored blue/white controls were reviewed
as control pixels, without claiming game progress or observer neutrality.

Original driving, Pause/Continue and ordinary Quit will be reported only from
the authorized fresh original after tested publication. No earlier screenshot
or scope supplies those claims.
