# D3DIM consumed-version / display publication Join — 2026-11-08

The production observation path now associates a completed queued D3DIM request
with a stable canonical surface version, its actual canvas decode, the selected
blit chain, and successful display publication. This is an opt-in bounded
observation. It does not establish game FPS, full27, parity, audio, physical GPU
execution, or live gameplay acceptance.

Evidence: `scratch/runs/20261108-d3dim-publication-version-join/`. The run manifest
records the exact base/final Git SHA, binary patches, file hashes, commands,
failed attempts, and final results. No source/media archive or remote box was
created. The final published commit is recorded in that run's `result.json`.

## Installed boundaries

`WineAssembly.armD3dimPublicationObservation({maxRecords})` checks the instrumented
main owner and attaches the same writer epoch to GuestThreadHost, its existing
and future WorkerLinks, ThreadManager, local native exports, host imports, and
the shared renderer before accepting source proofs. Attachment during pending
work fails closed. WorkerLink covers standalone exports, loaders and callbacks
through their actual replies. Timeout, transport ambiguity, retirement,
exception, counter wrap, or unmatched completion poisons coverage. It never
interprets a timeout as worker completion.

Normal host main-plus-thread rendezvous was already guarded. New coverage is for
actual bypasses: free-run continuations, standalone requests, local callbacks,
cooperative instance/stack setup, host PE staging and asynchronous loader writes.
Host mutation invalidation occurs **inside** writer exclusion, before the write;
publishing the mutation clock before entering exclusion is unsafe. Unknown
standalone mutating exports conservatively invalidate earlier source versions.
Process stop/reinitialization and endpoint retirement invalidate old authority.

The released WAT request serial, Encoder header and RPC snapshot remain the
request transport. The source render owner invalidates earlier front-surface
associations before fence/swap and seals a fresh immutable shared journal record
inside exclusion after the actual native swap. The record includes endpoint,
process scope, endpoint/observation generations, batch/ordinal, exact request,
layout, DIB and full palette dependencies, page generations, host mutation
version and source completion clock. No pointer, latest token or byte equality
is used as a version substitute. Watches retain notifications, not an old DIB.
Surface allocation/reuse/free, flips, format/palette association and display
palette state transitions notify lifetime dependencies before mutation.

`_flushGdiSurfacePresentation` witnesses the actual lazy-rebound surface. The
witness starts before rebind and covers palette refresh, every rgbaRect byte,
cache update and stable completion. Orientation, stride, converter masks and
palette ownership must agree with the exact source record. Partial cache updates
need the same previously established version. Unknown or unstable reads clear
provenance while normal pixels continue rendering.

The exact cache version follows actual scene blits, intermediate scaling and the
successful display-filter handoff. A publication row records canonical read
rectangle/layout, cache serial, selected scene and transfer geometry/operations.
Only a completed display publication can add a row. Source-completion,
page-publication and callback-receipt clocks retain their separate domains and
time origins; receipt may arrive later and cannot create a publication.
Duplicates deduplicate by the complete owning tuple. Coalesced, overwritten,
rejected, uncovered and retired source versions enter an explicit ledger.
Diagnostic failure poisons observation without aborting ordinary rendering.

## Qualification and limits

The focused production test compiles the complete WAT. Its positive includes the
actual WAT owed-present branch, Encoder, source replay, RPC snapshot, canonical
RGBA conversion, renderer blit and display publication. Another positive uses
the installed host arming method, real cooperative setup, cached republishing,
indexed palette conversion, delayed fence and actual display-filter handoff.
A callback is deliberately withheld until after positive publication.

Negatives include source/palette writes and replacement, ABA, native retirement,
coalescing, duplicate/stale callbacks, uncovered scene selection, timeout and
owner retirement. A real production WorkerLink and guest worker pause an actual
WAT store before page notification: ordinary composition sees the changed pixel
but the Join rejects the live writer. A reentrant local WAT import exercises the
same boundary on the main/cooperative execution wrapper. The older free-run
counterexample remains a substrate regression, not the new deliverable.
Strict imported-call receiver, exact return/exception and once semantics are
checked with real WebAssembly calls, armed and unarmed.

Unsupported multiwindow, visible child, shaped window, extra DX layer, shared
child overlay, menu/caret/animated/resize-overlay scenes fail closed. Synchronous
legacy execution, overlapping or uncovered writers and exhausted journals also
fail closed. These cases retain normal rendering. A bounded observation that
has retired or poisoned coverage cannot certify later work; use a fresh process
for another observation. The unarmed import-wrapper cost is **unqualified**;
there is no zero-overhead or gameplay-slowdown claim.

The locked build and focused result table are retained separately. The existing
surface-fence line 257 and shared-render-worker line 287 failures reproduce the
released original-HEAD controls. The dynamic-loader fixture also reproduces its
`ThreadSendWaits is not a constructor` failure with the published HEAD host
source. They are limitations, not passing suites. The optional boids browser
test skips without its configured Chrome/media and is not counted as a pass.
The real browser palette Worker regression passes both lazy-sync settings using
the installed Chrome explicitly. No remote box, source/media archive, deployment
or nested worker session was used.
