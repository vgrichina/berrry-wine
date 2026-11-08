# Recoil bounded probe journal, 2026-11-08

The new probe journal retains both uncached three-source reads and their six
proof records in one immutable transaction. It awaits a bounded durable flush
before the gate's final ownership and freshness checks. **Production storage
still does not meet the existing 250 ms fence. No Recoil qualification or input
admission is claimed.** No original, game, Resume, M, input or replay was run.
Full27, parity, audio and FPS remain open.

Evidence R: `scratch/runs/20261108-recoil-probe-journal-1753/`.
Starting main: `e00ca4e8c` (full SHA in `starting-git-sha.txt`). The predecessor
is published `f48707051`, documented in
`recoil-source-transport-20261108.md`. `measured-journal-regression.json` is the
independently audited measurement, including every trial and refusal.

## Implementation and fences

`tools/native-source-retention.cjs` adds a probe-scoped journal with a 32 MiB
record bound, exactly two ordered read groups, and at most six response and six
proof records. Admission serializes each complete envelope/proof immediately;
later mutation cannot change it. Counting admission records does not repeatedly
parse already retained large WASM responses. Before flushing, validation requires
three distinct source lanes and matching guest/decoder/compositor proofs in each
read, unique response sequences, ordered groups, unchanged identities across
reads, successful uncached responses, original timestamp brackets, complete
source sizes and SHA-256 matches. Refusals and partial evidence are preserved in
an explicitly incomplete diagnostic transaction; they cannot qualify.

The new file is exclusively created, written, fsynced and closed; its directory
is then fsynced and closed so a durable file does not depend on an unpersisted
name. This is one transaction flush, including the necessary directory barrier.
Its <=250 ms monotonic bound includes validation/serialization. Timeout is a
terminal refusal, even if a delayed timer callback loses a race to IO completion.
The writer is awaited to settlement after failure or timeout. A timed-out flush
can therefore take longer to *drain* than its admission deadline. It never returns
a late certificate. A `complete:true` header means content completeness only;
it is neither a successful durability receipt nor a certificate. There is no
journal recovery path that can certify or replay an abandoned probe.

`native-software-gate.cjs` uses the journal for `responseDirectory` probes.
Pre-probe source discovery and explicit legacy callback callers retain their
existing individual sinks. `strict-software-gate.cjs` opens the transaction,
labels its two reads, flushes after actual PNG decode and all existing evidence
saves, then runs the existing current page/software/guest owner, instance,
script/context, retirement and freshness checks. Both reads' original request
ages, both copy ages and PNG age through decode/save remain <=250 ms. No timestamp
is refreshed for durability. The normal independent challenged clock wrapper
still runs its fresh post-probe census, rechecks all these ages and enforces the
immutable five-second compound window. Neither clock producer nor kernel/parent
custody was changed. Existing source lanes use allSettled; failure additionally
awaits the diagnostic journal/writer drain, closes the gate and forbids replay.

## Actual Chrome measurement and remaining cause

One fresh box ran two finite controlled fixtures under the existing kernel
custodian, production parent census/subreaper and runtime lock. Each alternated
journal/legacy/journal/legacy using actual Chrome Debugger.getScriptSource calls.
The exact accepted WASM (2,182,663 bytes, `6cf120d0`) and decoder/compositor
(`f468ffce` / `cb21daaf`) were compiled/read, without executing a guest. Their
existing retained module/source paths were reused, independently hash-checked.
The causal VM supplies synthetic owner/instance objects and a decoded 1-pixel
PNG; the normal native adapter, strict Software gate, phase-save callback and
independent clock guard run their real code. This measures their complete
source/evidence path, not actual game ownership, HUD or Software qualification.

All 36 complete envelopes and 36 source proofs were recovered and audited.
Every journal trial has six envelopes and six proofs with their original
request/response timestamps and full accepted byte hashes. Legacy trials stopped
after the first three-source read when their existing gate expired; they were
not forced into a six-response success. All eight trials refused certification.
Remote-a preceded tightening the flush bound to include preparation and an
explicit elapsed-time check; remote-b exercises those final semantics. Small
intermediate patches reconstruct both measured retention versions and the
fixture instrumentation exactly, verified against their actual provider hashes.
The final source differs from remote-b only in its explanatory header comment.

| Journal trial | Two-read source window | Journal IO, excluding preparation/open | Outcome |
| --- | ---: | ---: | --- |
| remote-a / 1 | 219 ms | 102.33 ms | source freshness expired |
| remote-a / 3 | 240 ms | 82.33 ms | source freshness expired |
| remote-b / 1 | 276 ms | 224.08 ms | bounded flush timeout; writer drained |
| remote-b / 3 | 226 ms | 180.49 ms | source freshness expired |

Source-message intervals in the four journal trials were 72.57–110.99 ms per
lane. They do not include every later retention/proof/save step. File fsync alone
was 53.52, 53.66, 156.17 and 137.70 ms; directory fsync was respectively 31.57,
16.03, 54.08 and 32.10 ms. These actual durable waits forbid a latency success
claim from batching alone.

The instrumented remote-b trials identify the additional normal-driver cost.
After the final source response, durable completion took **469 / 523 ms**; the
oldest original source was then **745 / 749 ms** old. The remaining owner-save,
PNG/pixel-save and return-save barriers consumed **82.45+66.21+65.89 ms** and
**88.39+127.98+103.14 ms**, respectively, before journal validation/write/durability.
The save between source reads cost **56.03 / 45.60 ms**, increasing first-to-second
request separation to **170 / 138 ms**. One trial was already beyond 250 ms at
its last source response, before the final journal. Entry-save costs of
83.94 / 108.71 ms are outside source age but still inside the compound window.
This is measured evidence of remaining per-phase durability plus journal storage
service time, not a conjectured Chrome-only transport delay.

The implementation-ready next correction is to stage the existing phase JSON
and the *actually decoded* PNG as immutable records in the same transaction,
while preserving every original timestamp and phase payload. Replace their
individual fsyncs with that transaction's final barrier. Pre-create and durably
name a bounded append journal before the compound window, then stream immutable
frames asynchronously while source reads proceed; validate lengths/hashes and
await one final data sync/close before the unchanged current-owner/census/freshness
gates. Frame bounds, aborted/partial writes, crashes and writer drain need the
same negative controls. This removes the measured intermediate phase barriers
and per-probe directory sync; it must be measured again. Even that cannot be
promised to meet 250 ms on this volume: the observed 137–156 ms file sync leaves
only 94–113 ms for both fresh reads, remaining checks and independent census.
If overlap/preallocation cannot reduce that measured service time, a genuinely
faster durable volume is required. A tmpfs substitution or relaxed freshness is
not a correction.

## Selection, tests and lifecycle

`selected-runtime-pins.json` starts with the assigned selected1067 manifest.
Only the native adapter, retention module and strict gate change among shared
providers. The exact prior `next-driver-retention.patch` was applied to the new
physical driver only; its 29-helper closure was normally relocated and freshly
pinned. All 1,067 providers resolve and hash-check; normal physical closure passes.
Original851, accepted1066 (`position-runtime-pins.json`, not the nonexistent
`runtime-pins.json`) and selected1067 predecessor manifests remain immutable.
No new original was started. `relocated-helper-changes.patch` records the small
helper changes; the remaining physical helpers are the normal runtime closure,
not a source-tree archive.

Focused checks pass: eight journal/sink test entries, including actual process
crash before fsync, exclusive refusal after crash, immutable complete groups,
partial/duplicate/mismatched/refused records, byte bounds, write/fsync/close and
directory failures, timeout writer drain, failed source lanes and retirement
through flush. Native13, strict46 and owner28 negative controls pass, preserving
actual PNG decoding, allSettled, sticky UNKNOWN and no replay. Clock, runtime
selection and physical helper closure tests pass. The final locked full build
passes; logs and exact relevant binary diff are in R.

Initial local fixture attempts are retained: local-a stopped on a fixture
copy-before-install error; local-b used the fixture's tiny module pin and was
refused. Both drained normally. local-c supplied the corrected accepted pins;
its results preceded the removal of repeated admission parsing. These are not
accepted production performance comparisons. Final local-d uses the final
implementation: both journal probes refused freshness, while both legacy
baseline probes returned unqualified results after their fresh final censuses.
Local logs remain separate from the production measurements. The first clock
test invocation omitted its required environment and stopped before Chrome;
the corrected locked invocation passed all actual Chrome clock controls.

Both remote kernel drains exited 0: **158/158 and 176/176** owned/reaped tasks,
empty remaining/unresolved lists. This does not audit CLONE_UNTRACED or establish
exhaustive lineage outside the custodian's stated scope. No outer runtime timeout
killed either supervisor. Before stop, independent checks found **338** recorded
PID/start identities absent, all four ports closed, both profiles absent, no
runtime FD writers and the runtime lock free. All **136 unique remote outputs /
89,762,902 bytes** were retrieved and independently reopened/hash-verified before
the delegated normal stop.

Box **bx_q54tv2w3** is **ARCHIVED**, current expiry NULL; initial expiry was
**2026-11-08T18:24:09.226Z**. Normal stop **stop_0f0339ee0901f6c3** completed
**18:04:26.588Z**, forced FALSE, error NULL. The observable independent 25-minute
watchdog preceded the one persisted UUID-idempotent create; actual ID/expiry
preceded runtime. Local lifecycle roles exited 0 and their supervisor recorded
no remaining children. Exact Git SHA, relevant binary diff, small owned patches
and existing source/module path/hash references provide recovery without source
archives, media duplication or peer WIP. No old box resume/delete, deployment,
private game writes, clock/seed change or subworkers were used.
