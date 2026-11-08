# D3DIM canonical version protocol — 2026-11-08

Historical released partial-work handoff. The implementation and qualification
status below are superseded by [the installed publication Join note](d3dim-publication-version-join-20261108.md).
The original incomplete claims below describe the released 06:56 state.

Incomplete implementation; all code remains uncommitted on main. No installed
completed-producer / consumed-version / page-publication Join is qualified.
This note supersedes the earlier handoff only for the progress described here.
Evidence: `scratch/runs/20261108-d3dim-canonical-version-protocol/`.

## Implemented WIP

The real WAT queued flip descriptor now carries a nonwrapping request serial.
The production Encoder copies it into the queued record before returning to
the guest. The completed native replay records that exact request rather than
rereading the reused descriptor. Both owed-present branches carry the saved
request through the actual dx_present call. Local trace brackets install and
clear it without additional Worker RPC messages; existing present notices and
surface uploads copy the caller's scalar request before asynchronous delivery.
Explicit null prevents a stale page-local request from supplying provenance.
Serial exhaustion permanently disables request identity while ordinary flips
continue. A request is not a completed token or a pixel-version witness.

The reclaimed completion tap retains endpoint/generation, batch and ordinal,
the source completion clock, and a separate callback receipt clock. Records
remain `qualified: false`, with `consumedSurfaceVersion: null`. The nonqueued
synchronous legacy-call route explicitly invalidates the observation; its
rendering still runs. Reused endpoints, delayed callbacks, duplicates, record
limits, source failure and retirement cannot become qualified receipts.

Optional WriterEpoch exclusion is now available through the observation arm
protocol. It brackets all shared-render dispatcher operations, including peer
endpoints, before their first transition and through awaited fences. Arming
cannot retroactively cover a previously dispatched operation. ThreadManager
can attach the same epoch at an idle boundary; its _runWorkerThread bracket
covers preparatory exports, free-run work, continuations and final cleanup.
These brackets introduce no waits, publication locks or scheduling choices.
Overlapping writers, counter wrap, duplicate release and retirement fail
closed. Read stamps belong to the exact issuing wrapper, so a replacement
owner or copied equal counter cannot validate an old stamp. This mechanism
does not assert complete writer coverage or identify a surface version.

## Real regression boundaries

The focused test compiles the complete current WAT, executes its native swaps
through production replay, and exercises the real Encoder, owed-present,
dx_present, RPC, host canonical surface conversion, renderer blit and page
publication paths. Test-only exports expose existing WAT routines; another
test-only hook pauses an actual gs32 between its store and page-watch notice.
Transport/fence timing is controlled. No game, GPU or browser timing is claimed.

The request survives descriptor overwrite and delayed RPC delivery in both
trace-filter modes; both owed branches and serial exhaustion are checked.
Canonical lazy rebinding consumes a later front than the upload named;
coalesced native swaps can return to the same DIB; in-place writes and ABA
change pixels without advancing the upload version. These remain rejected
association counterexamples, rather than positive Join tests.

A separate Node Worker runs the full WAT module and pauses after a real store,
before its page-watch notification. Actual ThreadManager free-run returns
while that worker remains in flight. Ordinary renderer publication reads the
changed pixel with an unchanged page-watch generation. The installed optional
epoch rejects the read and spans the eventual reply. This is the concrete
post-store race that a page-watch-only version witness would miss. host.js
already brackets its main AND thread rendezvous; the free-run continuation
outside that rendezvous was the demonstrated bypass.

## Exact remaining boundary

This is unfinished integration, not an external machine/media blocker. The
next implementation must establish all of the following together before any
positive production association is emitted:

1. Cover actual guest writers outside _runWorkerThread, including WorkerLink
   _ask standalone exports/loaders/callbacks, main guest execution and local
   cooperative/callback entry. A timeout is ambiguous worker completion and
   must poison coverage. Host-side writes and object/storage retirement also
   need explicit lifecycle coverage. A caller merely attaching the optional
   epoch is not coverage certification.
2. Carry an explicit owning endpoint/process/surface lifetime mapping from the
   completed request tuple to a per-surface canonical version. Invalidate
   before visible transitions; finish publication of the sidecar while the
   transition is still excluded. Page-watch generations alone are post-write
   notices. Latest counters, matching pointers and matching bytes cannot supply
   the missing ownership/version identity.
3. At _flushGdiSurfacePresentation, witness the actual lazy-rebound source and
   all bytes/palette decoded by rgbaRect across a stable exclusion interval.
   Preserve that exact version on the canvas cache and through renderer scene
   selection/blits to actual display publication. Do not pin an old DIB or
   change ordinary rendered bytes, work admission or scheduling.
4. Install the released Join contract with exact owed request, stable consumed
   version and separate publication clock; reject owner replacement, duplicate,
   delayed and unstable reads. Account explicitly for source versions discarded
   or coalesced before publication. No discard ledger or positive Join is
   currently implemented. Keep callback receipt separate from source completion
   and page publication.

Completion tap plus request handoff and exclusion are partial work. They must
not be committed as a narrower finished feature. The existing released Join
model is a contract, not evidence that this production path satisfies it.

## Validation and recovery

Final results and exact command exit codes are retained in qualification-final.log,
focused-tests-final.json and build-final.log under the run directory. The
production request/exclusion regression and separate released Join contract
pass. Fourteen other focused suites pass; post-fix lifecycle, lock-identity and
ThreadManager reruns pass. The locked build is required before any future code
commit; this WIP is intentionally not committed. The
surface-fence and shared-render-worker focused suites have failures reproduced
against original HEAD sources; baseline logs retain their exact errors. Do not
claim those suites pass or attribute their baseline failures to this WIP.

The run retains current Git SHA, binary diffs for all relevant tracked changes,
patches for owned new files and a SHA-256 manifest. No source tree, media or
nested archive was copied. Earlier evidence is preserved. No box was allocated,
resumed, deleted or stopped: ID/state NOTALLOCATED, expiry and stop receipt N/A.
Full27, parity, audio, pacing and gameplay/FPS qualification remain open.
