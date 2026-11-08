# D3DIM browser journal repair and native fence boundary — 2026-11-08

The demonstrated production browser journal read is repaired. Chrome
151.0.7922.108 reads the production `SurfaceVersionJournal` from shared storage
without the shared-view `TextDecoder` exception. The actual browser guest/render
Worker fixture now retains all four rejected source records and four discard
ledger entries, with no diagnostic failure or poisoned epoch. Ordinary 2×2
canvas rendering still alternates red 17/34 on every pixel. Native fence writer
qualification remains open: all four source completions correctly reject the
outstanding guest writer, and there are zero qualified browser publications.
This change stops at the explicitly permitted substantive reader repair.

Evidence: `scratch/runs/20261108-d3dim-browser-journal-fence/`. Git is the source
archive. `source-audit.json`, `relevant.diff`, owned-new-file patches and the
manifest retain exact source identities, relevant binary differences, helper
recipes and tested module hashes. No source/media archive, game run, box,
private handler, guest patch, forced state or public deployment was used. Peer
test/operations work was retained. The installed Join source/note and published
[TR2 pacing failure](tr2-qualified-publication-pacing-20261108.md) were reviewed.

The reader acquires the atomic commit length, copies only the committed UTF-8
bytes into an ordinary reader-owned buffer, checks that the commit stayed
unchanged, and decodes/parses the copy. Invalid commits, UTF-8, JSON and non-object
records throw rather than silently becoming an empty successful observation.
Zero/uncommitted and reserved/incomplete slots remain absent. Existing writer
epoch exclusion is still required around source/canonical reads; an absent slot
cannot manufacture source authority. Retirement remains a separate atomic flag
and does not remove the raw source record.

The producer now atomically reserves each slot from zero to -1 before touching
its payload and publishes the positive length only after all bytes are written.
A second producer cannot rewrite either a reserved or committed slot. Oversize
encoding fails before reservation, preserving the existing bounded rejection
fallback. This enforces the existing no-reuse contract, preserving the
release/acquire commit ordering. It does not relax concurrent guest, host or
canonical writer checks. The callback ownership census change updates only the
reviewed render-worker file hash; ownership status remains pending.

`baseline-control.json` loads the exact published `359595941` production module
from Git into the same real Chrome session as the repaired module. The original
committed 66-byte record throws the exact shared-view TypeError; its ordinary
copy control passes. The repaired production reader returns the exact same
record. `journal-chrome.json` also checks exact UTF-8 JSON bytes, Unicode owner,
request/source identity, 64-bit page generations and palette dependency; detached
reader mutations, incomplete/uncommitted payloads, duplicate writes, invalid
indices, overflow, retirement, rejected records, malformed/non-record JSON,
invalid UTF-8 and a commit changed during copy. Two real browser Workers compete
for one slot: exactly one commits a complete 16,038-byte record and the other
rejects before touching payload. The shared assertion helper also runs in the
existing Node production association regression. The initial browser fixture
mistakenly omitted isolation headers; that failure is retained separately and
the corrected isolated test passes.

`journal-chrome.json` retains all 225 timed trials: five sizes, fifteen alternating
matched groups, three arms and 300 iterations per arm, after warmup. Arms measure
raw shared-byte copy, ordinary-buffer decode plus JSON parse, and the complete
production read. Median microseconds per record were:

| JSON bytes | Copy | Ordinary decode/parse | Production read |
| ---: | ---: | ---: | ---: |
| 66 | 0.43 | 0.55 | 1.12 |
| 512 | 0.63 | 0.65 | 1.53 |
| 4,096 | 1.83 | 2.12 | 4.37 |
| 16,384 | 6.33 | 10.77 | 13.25 |
| 65,520 | 19.07 | 18.90 | 16.87 |

The final size is the slot limit, a stress control. Raw ranges and paired deltas
are retained in `cost-summary.json`; GC/JIT/timing noise is substantial, and the
negative largest-size paired delta is not a speedup claim. These arms are not
additive. They measure journal operations, not the complete observer or gameplay.
The repair changes only journal methods and their armed constructor; it adds no
unarmed host/import/renderer call sites. No matched default gameplay impact or
full observer cost is claimed. The previously measured import-wrapper costs
remain separate.

The actual browser fixture uses installed
`WineAssembly.armD3dimPublicationObservation({maxRecords:16})`, production
GuestWorkerLink and render Worker, actual native queued flip/fence, canonical
uploads and the real canvas compositor. Its fixture-only WAT exports expose
existing native routines; no game or GPU throughput is involved. WebGL is
requested, without a GPU draw qualification claim. `browser-fixture.json` retains
all four owner/request/version identities, source timestamps, full RGBA pixels,
canonical owed requests, rejection reasons and dispositions. All four raw source
rejections are `overlapping-or-poisoned-source-writer`; ledger dispositions also
retain the existing publication guard's reason when applicable. There is no
silent empty ledger, record overflow, duplicate source completion, or successful
empty coverage claim. The separately retained Node production Worker fixture
also has four records/four ledger entries/zero qualified rows.

The next seam requires a distinct writer-lifetime protocol. Currently
`WorkerLink._ask()` owns a ticket from posting a command until its reply. A
`q_together` native queue/fence export enters the synchronous production
`Encoder._waitFor()` while that ticket remains live. The render source finalizer
requires exactly its own writer and rejects the guest ticket. Guest Worker
initialization currently gives the Encoder no per-command writer-ticket handoff.
A host message saying “waiting” is insufficient: it can arrive after native
execution resumes. Simply ending the command ticket at enqueue, ignoring it in
the finalizer, or accepting a generic RPC wait would expose poststore/prewatch
and resumed continuation writes.

A future implementation needs an authenticated command-generation-bound shared
handoff at the actual native wait, with exclusion restored synchronously before
any resumed execution or memory access, including every error/timeout path.
Timeout and retirement must still poison ambiguous outstanding execution;
standalone/free-run/continuation commands cannot borrow another command's parked
state. Host/main/cooperative and other concurrent writers must keep their own
coverage. It must retain the existing poststore/prewatch, overlapping writer,
ABA, palette, timeout and retirement negatives and produce actual browser
qualified source→canonical→display rows with complete accounting before an
original game is allowed. No writer lifetime or source acceptance gate changed
in this repair.

The locked full build passes. Fifteen existing focused suites pass, including
production association, Worker lifecycle/lock identity, thread manager/sparse
stack, browser-worker slice/present contracts, cooperative routing, command
capture, page watches, GDI/native surfaces, display filter, MIDI callback and
real browser palette Worker tests with both lazy-sync settings. The production
association report retains its six positive publications and eight discard rows.
The new browser journal suite and actual Worker fixture pass their reader and
accounting checks. Existing `test-d3dim-surface-fence.js:257` and
`test-shared-render-worker.js:287` failures reproduce with the published reader
loaded from Git; both failures are retained, not counted as passes. An initial
misspelled surface-fence filename never ran and is retained as a harness mistake.

Local heavy runtimes were serialized with `/tmp/wine-runtime.lock`; builds used
`/tmp/wine-build.lock`. External GNU `timeout` supervisors were armed before each
runtime/build (300/600/900 seconds with a 15-second escalation bound), independent
of Node/browser event loops. Browser exit/absent-PID and Worker heap-adoption
receipts are retained; final validation checks the owned lifecycle. No remote box
was allocated: ID/state **not allocated**, expiry/stop receipt **not applicable**.
Full27, parity, audio, gameFPS, simulationFPS and production native-fence
publication qualification remain open.
