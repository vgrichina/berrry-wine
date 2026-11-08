# Quake II production observation invalidation, 2026-11-08

Closed a concrete defect in 629a84ab: actual NodeWorker reset, reload and trace
disarm could leave earlier point observations marked valid until another
`log_block` callback. Snapshot retrieval also missed replaced native code when
no further callback occurred. The opt-in production attachment now invalidates
before these operations and checks its owner, memory and native pins on pulls.
Exact identity remains **UNKNOWN**.

Evidence: `scratch/runs/20261108-quake2-exclusive-observation-2258/`.
No game/browser/Chrome, remote, box, original retry or other agent was used.

## Production change

The NodeWorker installs a plain, frozen facade over its actual CPU exports
before handing exports to loaders or other production helpers. Every export
except `run` and an explicit small register/address-read whitelist invalidates
existing observations **before** invoking the function. This includes
`init_thread`, `load_pe`, `set_trace_esp`, register setters and arbitrary calls
through `readExports`. Unknown exports conservatively invalidate; a name
beginning with `get_` is insufficient to grant an exemption.

`run` retains bounded entry/return/failure counts, and an exception invalidates
before propagation. A returned CPU block is never called a completed native
load. Actual local and brokered host imports except `log_block` invalidate
before invocation, including suppressed diagnostic imports. These checks do
not depend on caller-authored continuity, writer or completion booleans.

Setup operations before the first observation are recorded without staling
nonexistent evidence. Once invalidated, records cannot resume after trace
rearming. Events retain only the latest 32 bounded descriptions and a saturated
counter; records retain their existing 32-record bound. The observer writes no
guest state. Execution, import results and exceptions retain their existing
paths. Default remains off; no backend/configuration/timeout/clock/input change
or new trace mode was introduced.

Worker `init` retires the previous observation **before** changing bindings or
attempting instantiation. Status returns at most one `retiredObservation`,
including when the replacement initializer fails, alongside the current
`observation`. This records actual instance/binding retirement, without claiming
that structured-clone object equality identifies underlying shared storage or
module bytes. Enabled replacement starts with no acquired points; disabled
replacement returns no current observer. Empty evidence is no longer marked
as valid point observations. Pulls revalidate actual pinned native bodies and
owner/memory even when tracing has stopped.

## Offline executable coverage

`node tools/quake2-exclusive-observation.test.cjs` reuses the owning queued
fixture in `tools/quake2-owning-load-witness.test.cjs`, the unmodified shipped
CPU and actual shipped NodeWorker command/import dispatcher. It executes the
native acquisition CMP/JNE and source observation at 0x4118d9 with the accepted
explicitly authored 160-byte source. The use arm executes original table and
headnode code through RET, returning EAX4948. Fixture register changes now
invalidate the earlier acquisition, so that use is architectural validation,
never acquisition-to-use continuity.

Seventeen off/on pairs cover acquisition, actual `init_thread`, actual
`load_pe` of the installed EXE, disarm, rearm, a mutating `readExports` call,
native-body replacement detected without another callback, reinit with a new
compiled module, replacement shared memory, missing module, missing memory,
actual CPU `log_eip` import, caller-forged coverage flags, missing trace,
external source-memory replacement, rejected execution arguments and native
use through RET. Each pair compares architectural state, result/error and the
complete direct guest-memory hash. Every fixture Worker is terminated and
awaited; independent parent deadlines precede execution. The execution-error
control is an actual WASM argument-conversion rejection, not a CPU trap claim.

The external source writer deliberately remains undetected as a historical
point invalidation: its current bytes differ from the recorded acquisition
hash, while `allWriters`, `exclusiveOwner`, `instructions`, `completedLoad` and
`exactIdentity` remain UNKNOWN. No certificate is issued for this negative.
Absent trace has zero points and invalid point status. Reset/disarm/rearm/code
controls also execute later native blocks and verify old record counts cannot
grow after invalidation. Worker-import regressions and the required locked
build are checked in this run.

Accepted full native loader/cache/altered-entity experiments are referenced
from [2244](quake2-owning-load-witness-2244-20261108.md) and
[2205](quake2-native-cmodel-binding-2205-20261108.md), without identical reruns.
Their retained `native-load-use.cjs` SHA is
`e6fde32e696e4b544eb188fef2380372f5884a3f68a07754a7e6fe7e0446c186`.
Current CPU PATH/HASH and installed EXE PATH/HASH are retained in the focused
results/references; no module or media copy was made. This run preserves their
fixture I/O/free/format/link limitations.

## Remaining limits and evidence

This is conservative production invalidation, not an exclusive execution
barrier. The facade is installed by NodeWorker; standalone host/import
attachments do not intercept their caller's direct export invocations.
Internal WASM calls and stores, other Workers, main-thread shared
memory writers, native allocation lifetime and fused block interiors remain
uncovered. Snapshot pin checks are point reads and cannot exclude concurrent
changes or an intervening replacement restored before observation. No
post-free completion point, full-load certificate, exact source at later use,
edict ABA solution or gameplay inference follows. A trusted complete writer
and completed-load path is still required before exact identity can change.

Command/log streams are gzip from their first stored byte. Inventory covers
every regular file, with independent stored/original hashes, sizes, gzip CRC
and exact file-set verification; its self seal is recorded externally on the
messageboard. Recovery uses Git SHA and small owned patches, with no source
archive, media/module copy, old/peer deletion or RAM gate. Disk samples exceed
1,500,000,000 bytes; no continuous-floor claim. The observable board watcher
has an independent deadline and same-shell EXIT cleanup with actual waits and
gzip EOF. Box **NONE**, state **NOT_CREATED**, expiry **NULL**, stop receipt
**N/A**. Finish this single task, then STOP.
