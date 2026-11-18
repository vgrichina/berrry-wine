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

The runtime repair was published as `1fe5e1baf` after the focused tests and
locked full build. Exact recovery of the old 7d347 module was verified before
applying only the producer delta, producing `b8c8fa6c`. Both exact-module
light/pressure browser controls completed 60 presents with 62 valid sync
observations each and zero mismatched DIBs. All six authored whole PNGs are
byte-identical; this establishes control pixel equivalence, not game progress.

The one fresh registered original used the frozen c9 source, genuine chooser,
135 verified media files, published wait-source correction and b8c8 native
repair. Actual Worker module inventories were read back. At 11 and 234 presents
the native window-present association was positive with matching primary DIB,
creator, window and CPU stamp. Its whole reviewed page was still white below
the host strip. No binder or physical DOWN/UP was used. The remaining white
composition cause was not established by these snapshots.

The attached submitting process then disappeared, its independent watchdog
reported parent disconnection, and the native supervisor received SIGTERM.
The sender is UNKNOWN; the coordinator explicitly reported sending no signal.
The native receipt records cleanup without leaked descendants, and the tool
wait returned 143, but the dead outer controller did not retain its intended
watchdog/browser waits. This scope remains closed, with that evidence limit.

A preparation correction puts the existing driver and native supervisor under
a detached custodian. It retains actual native/watchdog waits and both EOFs,
with the same 900/920-second limits, 180-second Quit reserve and disk floor.
Real process controls show attached-owner TERM closing the native/browser
before an authored WASM result, while loss of the detached launcher's submitting
process under TERM and KILL allows the browser to execute native WASM and
finish normally. These controls do not identify the original signal sender.
The driver, guest runtime, input confirmation/review/freshness fences and
independent physical release path are unchanged.

Original driving, Pause/Continue and ordinary Quit will be reported only from
the affected additional original after this preparation correction is tested
and published. Neither the closed scope nor an earlier screenshot supplies
those claims.
