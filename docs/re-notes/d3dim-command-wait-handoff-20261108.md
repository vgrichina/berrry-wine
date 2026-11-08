# D3DIM command-bound synchronous native wait handoff — 2026-11-08

The guest command writer now hands off only while its owning Worker is inside
production `Encoder._waitFor()`. The actual browser GuestWorkerLink and render
Worker can seal source versions and publish exact canonical/display rows while
all existing writer checks stay enabled. This is an opt-in observation protocol;
full27, parity, audio, gameFPS and simulationFPS remain open.

Evidence lives in `scratch/runs/20261108-d3dim-command-wait-handoff/`. Git plus the
recorded binary diff and new-file patches is the source archive. The starting
checkout was `cc6a142369d628c7100387522e2d1c6075d1af50`, including published journal
repair `49874a81c`. No source tree archive, game, remote box, public deployment,
old box, peer edit or subworker was used. Box ID/state: not allocated; expiry and
stop receipt: not applicable.

`WorkerLink._ask()` still begins its writer before posting and ends it only at a
successful reply. Each armed command gets a fresh, never reused 32-byte shared
cell, bound to the endpoint identity, command sequence and ticket using exact
64-bit integer fields. The executing Worker validates that identity against its
initialized endpoint and received command sequence. Its current command scope
exists through the serialized command's complete async unwind and is cleared in
`finally`. A subsequent command receives its own cell and ticket, even when the
previous command is parked or ambiguous.

The Encoder resolves the current command's cell only at `_waitFor`. It parks
that ticket contribution only when completion is outstanding. The parked stack
accesses transport control and local statistics, without guest memory access.
A synchronous `finally` restores the writer count and advances the epoch before
returning or throwing to native execution. This includes render errors,
`Atomics.wait` exceptions, strict errors and success. Restoration happens before
checking potentially changed identity, so an invalid owner cannot expose resumed
execution. Already completed waits do not park. Readiness waits, generic RPC
waits, submission and enqueue do not suspend the ticket.

The ticket remains owned by the parent throughout. Shared state closes only from
active on a successful reply; duplicate closes, duplicate parks/resumes, wrong
owner/generation/ticket, counter invalidity and unmatched transitions poison the
epoch. Timeout and retirement preserve ambiguous execution rather than releasing
its ticket. A late reply cannot repair a timed-out command. Ambiguous execution
also permanently prevents rearming that WorkerLink with a replacement epoch;
a fresh epoch must not hide an old command that can still run.

Only this command's contribution is parked. Host/main rendezvous, cooperative
execution, free-run/continuation, standalone, loader/callback, peer render and
other writer contributions retain their existing coverage. An outer writer can
therefore still prevent qualification during a native wait. A consumer that
starts before the handoff or overlaps resumption rejects through the existing
count/epoch interval checks. The source finalizer, canonical witness, immutable
journal, page/palette/lifetime checks and display acceptance gates are unchanged.
No async “waiting” message supplies exclusion evidence.

The permanent browser regression compiles the complete source through the
canonical compiler. Fixture-only exports expose the existing queue/fence routines;
the test adds a pause at the actual gs32 store before its page-watch notice.
It uses installed `WineAssembly.armD3dimPublicationObservation`, actual shipped
guest/render Workers, native queued flip/fence, RPC uploads, canonical RGBA
conversion, renderer scene blits and the actual canvas publication path. WebGL
is requested; this is not GPU throughput qualification.

The browser controls require four exact source/request/canonical/display rows
and all 2×2 ordinary pixels alternating red 17/34. They then reject a second
live writer, missing command-handoff coverage, and the same guest command resumed
past its native fence into a store on the actual selected front DIB. At the
poststore/prewatch pause, the source page proof still matches, ordinary rendering
reads red 68, and the live restored writer prevents a publication. Finally an
actual command times out while parked, after fixture transport delivery is
withheld; its original batch is then delivered. The late successful reply leaves
the ambiguous ticket live and observation poisoned. Eight raw source records
must equal four rows plus four distinct discard ledger entries, with exact owner,
request and source identities and no silent empty accounting.

A matched browser control serves the four original production modules directly
from Git `49874a81c`, without editing the checkout. It retains the expected
four-publication assertion failure and the four outstanding-writer source
rejections. Earlier local attempts are preserved, including the first run's
three rows plus one correctly rejected composition that overlapped a diagnostic
render request. The corrected positive fixture waits for the diagnostic writer
to become idle before composing; rejection controls deliberately compose with
writers still live. No acceptance gate was relaxed to achieve four positives.

The direct regression exercises the actual Encoder wait method on success,
non-strict/strict errors, thrown wait, retirement, already-complete wait and
handoff races, as well as stale owner/generation/ticket, cell reuse/ABA, duplicate
transitions, restoration after identity corruption and parent timeout/retirement
with late replies and rejected rearming. The existing production association
suite remains unchanged and retains main/cooperative/free-run, standalone
poststore/prewatch, palette, lifetime, ABA, coalescing and timeout/retirement
controls. Original surface-fence line 257 and shared-render-worker line 287
failures are retained with their published-source reproductions.

Command cost is measured with matched alternating armed/unarmed actual browser
`readExports` round trips, nine groups of 100 commands per arm after warmup.
The raw trials include descriptor allocation, shared state validation, Worker
transport and native read dispatch. They do not isolate blocked native wait cost
or the full publication observer and do not establish gameplay impact. Raw timing,
source hashes, browser exit/absent-PID, heap-adoption, focused test and locked-build
results are recorded in the run. All heavy local runtime work uses
`/tmp/wine-runtime.lock`; builds additionally use `/tmp/wine-build.lock`. External
GNU timeout supervisors are armed before runtime execution, independently of
Node/browser event loops.

Final validation: the locked full build passes. Sixteen focused suites pass;
seven affected Worker/lifecycle suites also pass after the sticky ambiguity
change. The two existing failures above still reproduce with published source.
The final browser run has four qualified rows, four discard entries and eight
raw source versions, no diagnostic failure, successful heap adoption and Chrome
exit 0 with its PID absent. Its final poisoned epoch and outstanding ticket are
the deliberately exercised timeout exclusion, not a clean-epoch claim.

Final actual command round-trip medians were 19.0 µs unarmed and 37.7 µs armed;
the median within-group difference was 12.0 µs. Ranges were 15.6–30.0 µs unarmed
and 19.85–405.5 µs armed. These noisy whole-path trials do not isolate native
parking or establish a stable per-command overhead estimate. The raw trial
arrays remain available; no timing failure or outlier is removed.

The first Git-served baseline handler omitted isolation headers on its custom
Worker response and failed before guest initialization. That raw harness failure
is retained separately. The corrected handler applies the static server's
COOP/COEP and no-store headers to the Git-served modules as well.
