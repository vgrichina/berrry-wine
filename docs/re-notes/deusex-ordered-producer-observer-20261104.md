# Deus Ex ordered producer observer: offline capability prepared

A bounded, run-owned read-only observer now retains ordered producer intervals,
Draw/Worker identity, dynamic writer inputs and before/after destination bytes.
**116 cheap offline checks pass. No natural writer chain or emulator defect is
claimed.** No production emulator patch, Chrome, heavy local WASM instance,
remote execution, box allocation or lifecycle action was used.

This follows [upstream light provenance](deusex-upstream-light-provenance-20261104.md)
(`a9dcbbb60`) and [owning pixel inputs](deusex-owning-pixel-inputs-20261104.md).
Artifacts live in `scratch/runs/20261104-deusex-ordered-producer-observer/`:
`observer.cjs`, `test.cjs`, `test.log`, `test-result.json`, `source-provenance.json`,
small `owned-*.patch` recovery files, `artifact-seal.json` and `result.json`.
Only this note is committed. Helpers remain run-owned because this assignment
prepares a bounded probe, without qualifying a production Worker integration.

## Observable contract

`OrderedObserver` increments one sequence per delivered boundary, including
boundaries later rejected for identity/read errors. Every retained record has a
sequence; paired stores include before/after sequences and PCs. Multiple records
from one boundary share its sequence. Records contain a caller-supplied unique
Draw ID plus engine, viewport, entry ESP, saved caller, Worker slot **0**, MMX
slot **0**, thread **1**, and freshly resolved module base/size/media SHA-256.
Changing the Draw or module identity discards the pending pair and descriptor.
A foreign exports object, Worker/thread mismatch, missing Draw or invalid read
stops with an explicit error. Sequence is observer ordering, not an executed
instruction count or global cross-Worker order.

Each boundary rereads palette-pointer RVA `0x7d308`. An observed pointer change
increments a generation; this is **not** allocation/free lifetime proof, and a
free/reuse at the same pointer can be invisible. Setup boundaries `0x3647f` /
`0x36483` retain the current ECX descriptor and its first 48 bytes, plus all
registers and eight owning-slot MMX qwords. The descriptor is unknown until one
of those boundaries is delivered. The consumer at `0x36509` captures fresh EBP
light bytes, texture base/index/texel, selected palette-entry address/bytes,
register/global palette agreement, descriptor identity, shift and mask. Texture
address calculation follows the predecessor's unsigned MMX calculation; this
run's fixture exercises bounded known addresses, not a new pixel-arithmetic
qualification.

The narrow store decoder recognizes `MOV r32/r16 -> memory`, `MOV EAX -> moffs32`
and `MOVQ MMn -> memory`, including SIB and signed displacements. It computes
actual destinations from **current code and inputs**, then checks byte overlap
against module light `[base+0x752f0, +32)`, pointer-global, shift/mask, current
2048-byte palette and known descriptor. It retains opcode bytes, source register
or MMX input, full registers/MMX, identities and destination bytes before and at
the next delivered boundary. It handles original shift/mask stores `0x36487` /
`0x3648e`, pointer candidates `0x26596` / `0x265ba`, indexed light stores and
16-bit palette initializers `0x265df`, `0x265f2`, `0x265f7`. PC membership by itself
never qualifies a writer. Unrecognized instructions are counted, not interpreted
as absence of stores. Writes outside these windows or through unsupported
opcodes remain outside coverage.

A pair is labeled `boundary-interval-only` by default. The existing Draw adapter
always uses this label: basic-block execution may include interior writes and
can miss the candidate instruction entirely. `single-instruction-adapter-witness`
requires both a trustworthy adapter reporting exactly one retired instruction
and the expected fall-through PC. Only the restricted offline fixture supplies
that assertion here. No production single-instruction hook has been installed.
Unchanged bytes are retained: a zero-to-zero store is not evidence of no writer.

Defaults are 100,000 boundaries, 128 records and 1,000 monotonic milliseconds;
hard option ceilings are 1,000,000 / 256 / 10,000. There is one pending pair,
reads are at most 4096 bytes, and all records and identities are copied. Explicit
record/pending drops, recognized/overlapping stores, unrecognized instruction
counts, identity changes, start time and stop reason/sequence/time are retained.
The time limit is checked only when a boundary arrives; there is no timer and
no guarantee that a blocked scheduler will deliver another boundary. Explicit
stop closes the trace and counts any unpaired writer.

## Using the run-owned helper

From the owning Worker, after the existing collector and SoftDrv are ready:

```js
const { attach } = require('./observer.cjs');
const handle = attach(owningDrawCollector, {
  workerSlot: 0,
  moduleSha256: verifiedOriginalSoftDrvSha256,
  mmxBase: verifiedCurrentRegionMapMainSlotMmxBase,
  drawId: uniqueRunAndDrawInvocationId,
});
// Ordinary scheduling calls the collector's existing observe().
// Persist this result before dropping the handle:
const result = handle.stop('explicit-stop');
```

The example values must come from the new run. The historical SoftDrv base,
light/palette pointers and allocator placements are never watch defaults.
`mmxBase` must be derived from that runtime's RegionMap and verified slot layout;
it must not be copied from an earlier absolute address. `identityModule()` runs
at every observed boundary; its preferred-base argument is a module identity
check, not a selected watch address. Reads translate every guest byte, so this
adapter does not assume adjacent guest pages are adjacent WASM storage.

The wrapper forwards `this`, arguments, return values and thrown underlying
errors, rejects duplicate attachment, and stop restores its own wrapper only.
Observer errors stop collection without changing the underlying return value.
The caller must stop/persist it at the end of the Draw or collection interval;
null-frame callbacks are skipped. Direct users can supply the documented
`exports`, `workerSlot`, `now`, `thread`, `module`, `frame`, `regs`, `mmx0`, `pc`
and read-only `read(address,length)` adapter and call `boundary()` themselves.
An adapter is trusted to identify its owning module/frame and accurately report
retirement; the helper cannot manufacture that evidence.

## Offline verification and limits

Run from the repository root:

```sh
node scratch/runs/20261104-deusex-ordered-producer-observer/test.cjs
```

The test parses section mappings from the existing original SoftDrv PE, reads
small instruction spans directly, and independently relocates known absolute
operands to **two fresh fixture bases**. Original captured owning-frame/MMX,
light, palette and texel inputs come from the predecessor's recovered
`producer.json`. Input paths and SHA-256 values are retained; no module/media
copy was made. A restricted fixture executor dispatches verified original
MOV/MOVQ encodings for descriptor loads/stores, indexed light store, palette
selection and three palette-lane stores. Separate direct-memory expectations
verify the results. This executor is deliberately small; **it is not the shipped
x86/WASM engine and does not qualify its instruction semantics**. The unchanged
predecessor already records actual-WASM pixel/reference and optional/cold/warm
`0x36577` tests; those were not rerun locally or presented as new results.

Checks cover ordered pairs, dynamic address overlap and nonoverlap, fresh
palette generations, descriptor overlap, signed displacement/SIB addressing,
selected consumer inputs, unchanged zero-store bytes, Draw changes, foreign
instance/slot/thread, unmapped/short reads, bounds, caps/drops, deadlines,
pending stop, module validation and two module bases. Adapter controls verify
fresh module resolution on each callback, exact return propagation, underlying
exception propagation, duplicate rejection and restoration. Every direct
observation hashes the complete small fixture code/global/heap/register/MMX
state before and after; adapter tests hash their full linear memory too.
Observer memory mutation is absent. An intermediate test failed when expanded
consumer capture correctly rejected the fixture's missing texture mapping; the
fixture was fixed before the final passing result. That was no guest failure.

The remaining natural proof is still substantial: capture actual setup and
allocation history, deliver the relevant writer boundaries, connect them to the
fresh owning Draw and pixel consumers, account for omitted intervals and pointer
reuse, and replay newly captured inputs on original instructions against an
independent reference before choosing any repair. This helper closes the ordered
recording capability gap for delivered boundaries; it does not make a basic-block
observer an exhaustive instruction or allocation-lifetime tracer.

## Custody and recovery

All new artifacts were created locally; no unique remote artifacts were produced
or left to recover. The retained box **bx_mpnr7rhj** was not contacted. Its last
predecessor observation was RUNNING (API idle, healthy/hydrated), with expiry
**2026-11-04T10:27:15.142Z**; this is historical state, not a new API assertion.
Coordinator retains shutdown ownership. No stop/delete/resume was attempted.
The local-only custody handback was appended before 10:25Z.

Source recovery uses the exact Git starting SHA, relevant binary diff and small
patches for the new helper/test/note. The evidence seal records sizes and full
SHA-256 values. There is no source-tree snapshot/archive or repeated media.
Because the only tracked change is this note and no tracked code changed, a
new full build was unnecessary and is not claimed. Follow-up runtime integration
requires its own actual Worker/WASM and dependency preflight before a separately
authorized natural run.
