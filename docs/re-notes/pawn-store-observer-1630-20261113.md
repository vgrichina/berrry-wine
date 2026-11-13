# Pawn: bounded store observer controls; original cause still unknown

The run-local observer is implemented in `tools/pawn-store-observer.cjs` and
exercised by `node tools/pawn-store-observer.test.cjs`. It repairs observation
granularity and receipt interpretation without changing production primitives.
Evidence is in ignored `scratch/runs/20261113-pawn-store-observer-1630/`.
The fourth-history writer and selected PV-byte provenance on the original
remain **UNKNOWN**. No original was launched or input sent in this task.

Read the 1550, 1520 and 1445 notes. The authentic 100-byte save remains at
`scratch/runs/20261113-pawn-modal-guard-1445/pawn-1445-secondmove.gam`, with
SHA-256 `811659988ee98f19ca08615f1191431993f5d51646ea41efed5fdb6f0ff5cf77`.
Its existing e4/Nf6/d4 witness and fourth record retain their prior limits.
No save, original guest, position, AI, configuration or clock was edited.

## Observer contract and actual primitives

An exclusive controller supplies the exact owning exports and memory, one or
two fixed guest ranges (at most 4096 bytes each), a live exclusivity predicate,
and finite time, instruction, journal and epoch bounds. It must already have
paused all other executors and host writers. A true predicate in the synthetic
fixture establishes only fixture exclusivity. It is not an ownership proof
for a running original. The helper must never be invoked through a concurrent
control evaluation while the ordinary scheduler is executing that instance.

The controller arms `native_store_arm`, which itself clears decoded caches and
enables instruction granularity, then uses `set_rep_store_step` to obtain the
existing protected entry policy and one-element REP continuations. It records
baseline bytes, complete receipt, thread, entry PC and publication serial.
Each `step()` grants `run(1)` and samples the receipt immediately afterwards.
Each range has independent epochs. Exactly one store produces a journal
record with epoch delta, actual PC, address, width, before/after bytes and a
same-value indicator. Two writes by one instruction without an intervening
sample are UNKNOWN, even if the final value looks plausible.

The actual build wraps exports through `tools/protected-writer-entries.js`.
`native_store_get` is deliberately denied while protected mode is active:
its conditional returns are outside the structural read-only export policy.
This is intended conservative behavior, not a primitive regression. The helper
uses the existing `native_store_share(0)` seqlock publication and atomic reads
from the owning memory instead. It verifies memory/receipt agreement before
arming and refuses unstable publication. No production policy was relaxed.

`set_rep_store_step` also installs a value watchpoint. Watching the target data
can introduce a debug halt after its first change. The block count includes
an attempted entry and cannot alone establish committed execution. The helper
watches entry code instead and rejects debug halts explicitly. It never
patches that code or adds a guest instrumentation store.

Continuous scope checks include publication serial, receipt generation and
ranges, bytes, expected EIP, thread and API count between owned steps. Loss of
ownership, unsupported/trapped execution, invalidation, host stores, overflow,
multiple writes or any finite bound returns an explicit `unknown:*` result.
Unknown stops retain the observed prefix with `complete:false`. `firstWriters`
means first observed since this baseline, never first ever or first since an
unobserved allocation. Missing events do not prove no earlier writes. Raw host
memory writes, including same-value writes, are outside the contract and must
be excluded by the actual exclusive owner. A selected PV address also needs
independent pointer/allocation-lifetime checks in that predicate; this helper
does not infer dynamic addresses or their lifetimes from fixed ranges.

## Meaningful interpreter controls and original coverage frontier

Nineteen controls use the shipped interpreter and authored isolated x86 code,
with an unchanged notepad PE as a loader fixture. Arming/stopping preserves the
fixture's guest allocation bytes and CPU registers. Controls establish:

- An interior MOV in a previously cached ordinary fused block yields its
  exact instruction PC after arming; a same-value repeat still advances epoch.
- A one-byte store records width one and leaves the independent second range
  unwritten. Two scalar stores yield an ordered two-record journal.
- A real two-element REP STOSD is split into two records at the same PC with
  distinct addresses. A deliberately degraded instruction-only facade executes
  the same real REP unsplit: epoch delta two, zero accepted records and
  `unknown:multiplewrites`. This negative executes machine code, not fabricated
  receipt fields.
- Real store overflow, host-export stores, foreign execution, sticky invalidation,
  unsupported opcodes and finite record/instruction limits fail closed.
  Protected exports reject attempted host writes and EIP mutation before effects.

The original Pawn executable is independently hashed to
`21f78408e306d77103484bc90accfd511a141131ed1e14990380ecea19de5a58`.
Its exact writer at `0x402a4c` is **`8f 44 1d 00`, POP [ebp+ebx]**. Copying
only these four instruction bytes into the isolated fixture demonstrates:

1. Protected mode rejects this opcode before changing ESP or accepting a store.
2. Instruction-only mode executes it and records the correct PC/address/width.

The protected decoder also excludes the preceding `ADD` forms and `MOVSX` at
`0x402a38`; `src/07-decoder.wat` explicitly describes its admitted subset.
Thus protected continuous original-wide coverage is not qualified, even if
disk becomes sufficient. Instruction-only mode alone does not supply the
protected native/host entry guarantees. Do not silently downgrade protection,
skip an unsupported interval, rearm and call the next writer the first writer.
No production regression was demonstrated, so no production fix is justified.

## Validation and remaining work

The locked production build and nineteen focused controls pass. Their child
processes have actual wait results and separate stdout/stderr EOF receipts;
the board watcher is explicitly reaped. Source provenance records exact Git,
relevant binary diffs, new helper patches and actual source/module hashes.
Git remains the source archive; no source trees or media were bundled.

`original-decision.json` records the fresh heavylock, actual-child and disk
observation. There was no floor-only launch, watchdog, guest input, third move,
UNKNOWN replay or original native wait. Native/watchdog waits are N/A, not
successful runtime receipts. No independent cleanup or box was performed:
box ID none, state NOT_CREATED, expiry null, stop receipt N/A.

Next requires a qualified continuous observation mechanism across the actual
Pawn instruction/host boundaries, sufficient sustained disk headroom and a
fresh source/module freeze. Any heavy original must hold the heavy lock,
exclude actual runtime children and prearm an observable independent deadline
guard. Review native e4/Nf6, then d4, before any original first-writer claim.
Observe history and selected-byte addresses from a proven baseline with stable
pointer lifetimes; preserve explicit unknown wherever continuity is lost.
