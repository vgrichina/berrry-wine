# Pawn normal-interpreter ownership audit: missing CLI admission mechanism

The original fourth-record first writer, selected PV-byte cause, and valid
second reply remain **UNKNOWN**. This task stops at a concrete ownership
mechanism gap. Normal full-interpreter execution is legitimate application
behavior; the gap is proving its exclusive observation scope on the actual
Pawn scheduler. No production code or protected policy was changed, and no
original, CPU fixture, watchdog, worker or box was started.

Evidence: ignored `scratch/runs/20261113-pawn-exclusive-native-1740/`.
Read the 1630 observer and 1550/1520/1445 parent notes and code. Verified all
four parent seal manifests and independently checked the authentic save in
place: 100 bytes, SHA-256
`811659988ee98f19ca08615f1191431993f5d51646ea41efed5fdb6f0ff5cf77`.
Nothing was copied into a replacement save. The prior e4/Nf6/d4 witness and
record four retain their existing limits. No new board review is claimed.

## Distinct contract considered

A normal-interpreter observer could use `native_store_arm`'s existing cache
clear and instruction granularity without entering protected REP mode. It
would need an actual scheduler-owned admission, not the existing observer's
caller-supplied `exclusive:()=>true`. Before baseline and **each** bounded
`run(1)`, that admission must pin the CPU/module/memory and prove every other
CPU executor and host writer paused or accounted, including already admitted
commands, bootstrap, RPC, render callbacks, I/O fills and reentrant execution.
A synchronous owner-controlled sample must bracket that exact invocation;
an `await` permits other actors and requires renewed accounting.

The receipt contract remains finite and conservative: stable generation,
publication serial, fixed range identity, expected EIP/thread, baseline bytes,
and independently established pointer/allocation lifetimes. One observed store
requires epoch delta one and matching actual instruction PC/address/width.
A same-value POP must advance epoch despite equal before/after bytes. API or
host execution, untracked writes, multiple writes, overflow, retirement,
ownership gaps and unavailable lifetime evidence yield explicit UNKNOWN.
Unsplit REP with multiple stores remains UNKNOWN. A stopped prefix cannot be
rearmed past an unsupported interval and promoted to continuous first-writer
evidence. Stable pointer values alone cannot exclude free/reuse at that address.

This is a contract specification, not an implemented or qualified observer.
No facade downgrading `set_rep_store_step` was used on the original.

## Actual mechanisms inspected and their limits

`mechanism-audit.json` records source locations against `source-pins.json`:

- CLI `test/run.js` instantiates its main CPU directly. `controlFrozen` gates
  admission to the next batch. The `frozen` command returns after changing a
  boolean; it does not acknowledge a drained invocation or acquire a writer
  lease. `step` grants whole batches, including ordinary main execution,
  interleaved main runs and thread slices. HTTP eval executes directly from
  its callback. An eval can arrive while the batch loop awaits other work;
  the comment saying the guest is parked is not an all-actor proof.
- `mainSchedulerObserver` observes actual main admission decisions but has no
  authority over guest exports, queues or scheduling. A recorded main-run
  decision does not exclude other writers.
- `ThreadManager.holdWriterObservationBoundary` really holds free-run
  continuations. It does not itself drain existing work or gate every CLI
  ordinary/cooperative entry. `GuestThreadHost.attachWriterObservationAtBoundary`
  genuinely checks transport identities, starting links, pending commands and
  in-flight work before attaching an epoch. Its caller must already hold MAIN
  and free-run continuations. The browser `host.js` supplies such a main-step
  boundary while arming rendering publication, then releases it in `finally`.
  These are useful controls, but the CLI does not call either boundary method.
- `RenderWorker.WriterEpoch` and `observeInstance` account covered calls and
  invalidate host versions. The CLI main is not installed through this facade.
  An idle epoch for only some participants cannot certify a complete census.
- The separate shipped `WRITER_SESSION` protocol is stronger than a fake
  predicate: real Worker registrations have transport custody, enrollment,
  a shared command lock, finite CPU-issued scalar records, retirement and
  unsupported-import invalidation. `tools/gltron-shared-writers.test.cjs`
  exercises this path, and `guest-rpc` invalidates non-diagnostic broker calls.
  However, the CLI main has no `writer_cpu_register` admission, and this
  protocol is not attached to the Pawn controller. A bypassing CPU can be
  detected by a store, which is not proof that it was paused before a step.
  Its own returned scope explicitly leaves construction/destruction/allocation
  lifetimes OPEN. It cannot be adopted as a complete Pawn ownership proof.
- Raw host writes exist, for example `host-imports.read_file` and icon resource
  copying use typed-array stores followed by page-watch notification. Such
  notification is not a universal native-store epoch or exclusion barrier.
  Byte equality, including a same-value write, cannot fill this coverage gap.

Consequently the existing interfaces do not expose a complete CLI owner lease
that can establish the required pre-step census, drain and lifetime scope.
Adding an observer that merely asserts that ownership would hide the missing
mechanism. A production change would require integrating actual admission
across these paths and qualifying it with real competing CPU/host controls;
there is no small run-local adapter currently justified as original proof.
This audit does not claim that such an integration is impossible.

## Exact original instruction frontier

The retained parent disassembly was decoded and checked read-only. Immediately
before origin POP `0x402a4c` (`8f 44 1d 00`) are ADD EBP,EAX at `0x402a30`
(`01 c5`), ADD EBP,[0x4230f8] at `0x402a32` (`03 2d f8 30 42 00`), and MOVSX
EAX,byte [EBP] at `0x402a38` (`0f be 45 00`), followed by PUSH EAX, history
cursor/base loads and SHL EBX,2. `preceding-forms.json` preserves the exact
13-instruction listing from `0x402a22` through POP. These are static facts,
not an observed execution. The 1630 protected refusals remain intentional;
its instruction-only POP fixture is not promoted to original ownership proof.
No additional instruction was whitelisted or policy relaxed.

## Validation, resources and next work

`audit.py` passed all 293 parent seals, whole-save hash, exact listing and source
mechanism assertions. Source provenance records exact Git SHA and relevant
binary diff; Git remains the source archive. No source trees, media or old
archives were copied or removed. This documentation-only change claims no
new production build or execution of the parent's nineteen CPU controls.

Private-backup1730 was still LIVE at the audit, then announced RESOURCE_BLOCKED
at 03:57:01Z: its supported upload received HTTP 401, with no payload transfer,
unlink or capacity change. No resource completion and NFS runtime release
was observed. No launch admission or floor retry was
attempted; the read-only disk sample was below the strict 1.5 GB floor.
There was no heavy runtime for which a watchdog could be prearmed, and no
runtime/watchdog wait is represented as success. No independent cleanup,
box creation, old-box resume or archive operation occurred. Box ID none,
state NOT_CREATED, expiry null, stop receipt N/A.

Next requires the actual scheduler admission/drain and writer/lifetime scope
above. Resource release alone does not resolve it. Any later original also
requires actual resource completion/runtime release, sustained floor above
1.5 GB, heavy lock plus actual child census, fresh source/module freeze and
an observable independent deadline guard. Review e4/Nf6, then d4 before a
cause claim. No third move, replay or state mutation to enter selected code.
