# Deus Ex ordered observer: physical Worker and shipped WASM integration

The ordered producer observer now runs against actual x86 execution in physical
Node Workers, including the shipped `lib/guest-worker.js` slice path. The optional
adapter is retained as `lib/deusex-ordered-producer-observer.js`. It remains
read-only and opt-in: no browser dependency graph, scheduling default or guest
instruction handler changed. This qualifies fixture integration, **not a natural
owning-writer chain or gameplay**.

Predecessor: [ordered producer observer](deusex-ordered-producer-observer-20261104.md),
`dcf6eab5fe7bde5305d46bc34fd4d3d342a60e85`. New evidence is in
`scratch/runs/20261104-deusex-worker-observer-integration/`. The prior restricted
JavaScript executor is not used in these execution tests.

## Actual execution and controls

`integration.cjs` instantiates the existing `build/wine-assembly.wasm` in physical
`worker_threads` with shared 512 MB memory. Actual Worker thread IDs are retained.
The shipped module SHA-256 is
`4ddc8336097ef4b8503c6e6d2bb7fb05a2a1084800322523c8959b7128ca217a`.
Each fixture runs separately with raw `exports.run(1)`, the existing
`OwningDrawObserver.run`, and that collector plus the ordered adapter. Both
instruction-granularity and ordinary block execution are exercised at two fresh
SoftDrv fixture bases. All three arms have identical returned block counts,
EIP/register/MMX sequences, final states and full 512 MB memory hashes. A separate
zero-store observed/control pair retains equal before/after bytes for an actual
executed MOVQ. Explicit observation also leaves whole memory and getters unchanged.

`transport.cjs` additionally loads the actual `lib/guest-worker.js` source into a
physical Node Worker, instantiates the shipped WASM through its normal `init`, and
drives its normal queued `slice` commands. Its sole source addition is an appended
fixture accessor for the instance and `drawObserver`; no shipped function body is
replaced. A separate MessagePort initializes the controlled fixture and installs
the collector/adapter. The observed and collector-only controls match complete
memory, returned counts and architectural traces: **24 slices** with instruction
granularity and **8 slices** with ordinary blocks, including the final trap.
The real GuestRpc broker services fixture initialization's log and beep begin
imports; those imports are bounded test stubs. No guest DLL initializers run.
This is the Node transport, not a browser/Chrome qualification or a new public
Worker command for enabling the adapter.

The original SoftDrv MOVQ descriptor loads/stores, indexed dword light store,
absolute palette-pointer store and three word palette-lane stores execute in
WASM. Original instruction bytes are read from the existing media path
`test/binaries/candidates/deus-ex-demo/installed/system/softdrv.dll`, SHA-256
`25d14f3b6cca27053aa05b191424f4c0c0dffe0837406b44eb606cb9d8aeae18`.
Only known absolute store operands are relocated. Independent expected memory
values verify 32/255 shift/mask, the light payload, selected pointer and
`0x4000/0x4000/0x2000` palette lanes. The byte reads and effective destinations
are retained in ordered before/after records.

The final fixture instruction is UD2. Direct execution propagates the real
`WebAssembly.RuntimeError: unreachable`; the shipped Worker reports `unreachable`
in its normal slice response. Observed and control errors and full post-trap
memory/state match. The collector retains `trap-or-unobservable`; stopping the
adapter persists the evidence. Portable tests also verify exact underlying thrown
object and return/receiver/argument preservation, duplicate attachment rejection,
foreign-thread rejection and wrapper restoration.

## Demonstrated adapter defect and fix

The predecessor adapter resolved module identity at every callback but retained
only base/size/hash, dropping index and lifecycle generation. A controlled
same-base SoftDrv generation transition therefore produced an overlapping-store
pair across two module identities: one identity change, zero pending drops.
The fixed adapter preserves the complete fresh module identity. The same actual
Worker/WASM fixture records two identities, drops the pending pair, and emits no
cross-generation store pair. This is an observer integration defect, not an x86
or Deus Ex rendering defect.

The adapter also assigns a distinct ID to each collector frame object, even when
its engine/viewport/ESP/caller values repeat, and reads `owner.ex` at each boundary
so replacing the owning exports object is rejected. Stop is idempotent: a stale
handle cannot unregister a later attachment. The committed focused regression
covers these lifecycle cases. The store decoder and arithmetic/consumer core
remain byte-for-byte unchanged from the predecessor; `audit.json` pins that core
and the exact unchanged predecessor arithmetic artifacts by SHA-256.

## Fixture isolation and remaining gaps

All module-table rows, PE identity headers, Draw stack/arguments, register/code
initialization and bridge jumps in these tests belong to our isolated fixtures.
The collector recognizes a synthetic Draw entry and resolves synthetic live
Engine/SoftDrv rows from actual exported tables; no frame/module snapshot is
supplied to the observer. MMX slot 0 comes from the current RegionMap allocator
base plus the verified source-defined slot ABI. The WASM custom layout section
must equal the current map fingerprint. Source constants and actual MMX load
results guard that binding. The media hash identifies the opcode donor, not a
claim that our synthetic loaded image is the complete original DLL.

Instruction granularity is explicitly armed with the existing
`set_instruction_watchpoint` only inside those fixtures and equally in their
controls. The adapter never arms it. That mode exposes all **seven** targeted
stores; ordinary blocks expose **four**, missing the interior shift/mask stores
and the second palette store in its block. Every adapter record remains labeled
`boundary-interval-only`, including instruction-granularity tests. No new
single-instruction retirement assertion is manufactured from block counters.
Repeated deliveries are not distinct executed instructions. Unrecognized opcodes,
interior writers, omitted intervals, pointer reuse at the same address, allocation
lifetimes, concurrent writers and global cross-Worker ordering remain uncovered.

The consumer boundary captures texture/palette/light inputs, but its fixture
instruction is UD2; this task does not requalify pixel arithmetic. The existing
16-pixel/eight-MMX differential replay, seven discriminating controls and
optional/cold/warm successor tests are reused unchanged by exact hashes in
`audit.json`. The gzip-recovered `producer.json` decompresses to the predecessor's
exact SHA-256 `77096a5d507c4536acdc23127476bcc9b5591148facef700a4cce8644bf6123a`.
No original-game calls, ESP/EIP/argument writes, repaint, Chrome, remote access,
box allocation or lifecycle operation occurred. No box was assigned to this task.

## Verification and recovery

`node test/test-deusex-ordered-producer-observer.js`, both run-owned integration
commands and `flock /tmp/wine-build.lock bash tools/build.sh` pass. The first build
caught our portable fixture base colliding with the raw-region-literal ratchet;
its arbitrary test base was corrected without changing region policy. Earlier
fixture-layout, recovery-path and broker-preflight failures are retained in logs.
They are test setup failures, not guest defects. Build output remains unchanged.

`audit.json`, `source-provenance.json`, `relevant-uncommitted.binary.patch`, small
owned-file patches, execution JSON/logs and `seal.sha256` provide recovery. Git is
the source archive; existing module/media paths and hashes are referenced without
copying them or archiving trees. Next work requires a separately authorized natural
run delivering actual setup/writer boundaries, allocation history and fresh Draw
correlation before selecting any rendering repair. This single assignment ends
with the tested adapter fix and note; no successor work was started.
