# Offline native GLTron decode/refill discriminator, 2026-11-08

The reusable read-only validator in
[`tools/gltron-native-decode-ring.cjs`](../../tools/gltron-native-decode-ring.cjs)
distinguishes completed native decodes followed by continued refilling from a
decode still pending at an observation bound. Actual x86 controls pass through
the current CPU and queued production Node Worker. This does **not** identify
the cause of the original teal/black startup. No original retry was performed.
The earlier [startup note](gltron-sound-startup-20261107.md) remains correct:
sampled stack words cannot distinguish repeated invocations.

## Exact inputs and native boundaries

Existing files are read by PATHHASH without making media/module copies:

| Path | SHA-256 |
| --- | --- |
| `test/binaries/gltron-0.70/gltron.exe` | `85fb5184262490f0b5967c2b12ee27c77da058364e594b0fc86be7b5814e40ec` |
| `test/binaries/gltron-0.70/sdl_sound.dll` | `31babd4f1e8ed6dfd412aeea8a6bbd48bf01aa24a9fe7c08a78944b0dee9142a` |

`loadedPins` checks complete original refill `0x413258..0x4133dd`, import
thunk `0x423f22`, Sound_Decode RVA `0x1b6b..0x1c38`, and adapter RVA
`0x492a..0x497f`. It applies actual PE HIGHLOW relocation entries to expected
DLL operands and compares all bytes on every delivered transition.

The private monotonically increasing tokens identify the refill invocation and
nested native calls: main CALL `0x4132a7`, return `0x4132ac`; selected decoder
CALL DLL RVA `0x1bff`, return `0x1c02`; adapter-work CALL RVA `0x4959`, return
`0x495e`. Calls require actual target, pushed return and stack delta. Returns
require RET, the matching private frame, saved caller and restored ESP. Repeated
identical PCs/stacks are retained as separate instructions and invocations.

The object comes from ECX at the actual refill entry, and its sample from
`object+0x20`, with the pushed decode argument checked against that sample.
Ring fields are threshold `+0x24`, capacity `+0x2c`, read `+0x30`, write `+0x34`.
The validator records native branch outcomes at `0x41327a` and `0x41329b`, the
write at `0x413358`, read-index changes, loop edge `0x4133d7 -> 0x41326e`, and
the actual outer RET at `0x4133dd`. Equal indices select decode; otherwise the
signed remainder `(read-write+capacity) % capacity` is compared with threshold,
exiting at `0x4133dc` when at most threshold. Actual EDX and branch destinations
are retained rather than substituting a JavaScript unsigned-modulo prediction.

## Interface and deliberate integration limit

The current `host.log_block(eip, esp)` is a decoded-block entry import, including
in `guest-worker.js`. Ordinary blocks can contain multiple instructions; the
existing sampled cache observers explicitly disclaim certified CALL/RET and
complete lifetime coverage. RPC delivery alone supplies neither an instruction
retirement sequence nor a trusted object lifetime. No existing GLTron owning
hook supplies those missing facts, so no production installation is claimed.
No host, census, Worker, CPU or other game source was modified.

The narrowly scoped API is reusable by an exclusive offline controller:

1. Verify original files using `pinMedia`; create a read-only `reader(exports)`
   and `loadedPins(files, relocatedBase, reader.read)` verifier.
2. Create `createValidator({owner, epoch, lifetime, verify, soundBase, ...bounds})`.
   Identity values are caller-owned opaque capabilities, not guessed guest
   pointers or inferred allocation generations.
3. Deliver consecutive `step` events with exact before/after CPU snapshots,
   ring snapshots, object, opcode, native target and argument, sequence,
   `missed:0`, and `granularity:'instruction'`. `finish()` closes the window.

The test controller uses the existing `set_instruction_watchpoint` debugger
mode, which clears fused blocks and publishes one x86 instruction per block,
and ordinary queued Worker `slice(1)` commands. The validator itself only reads;
it does not enable tracing, run the CPU, write guest memory or change registers.
The test-only owning-export seam follows established native Worker tests and
leaves production files unchanged. Each Worker has an independent parent
60-second watchdog, armed before init; the entire test has a 240-second guard.
Every fixture Worker is terminated and awaited by its owner.

Instruction and record bounds are finite (defaults 20,000 / 256; hard maxima
1,000,000 / 4,096), native nesting is limited to eight. Owner/epoch/lifetime,
sample identity, sequence, CPU continuity, granularity, missed events, live
bytes, native stack and bounds failures invalidate the entire conclusion to
UNKNOWN. Lifetime capabilities must come from a trusted controller: this API
does not manufacture complete multi-thread object/module lifetime coverage,
authenticate arbitrary external JSON or certify absence of asynchronous writes.
It is therefore an offline transition validator, not a live causality witness.

## Actual x86 controls

Run `node tools/gltron-native-decode-ring.test.cjs`. At both runtime DLL bases
`0x765000` and `0x965000`, observed and unobserved arms have identical CPU state
and run return at every queued instruction, final entire-memory SHA-256, ring
contents and payload. The shipped module is 2,184,500 bytes, SHA-256
`4b45bda53a90b665896cf3b85d9a157b7c3703563c88b6666e4ee2e4b346bcc3`.

| Synthetic dependency control | Native result at each base |
| --- | --- |
| Return four bytes | 426 instructions, three paired decode returns, writes 0→4→8→12, three loops, actual refill RET. |
| Return eight bytes with read=8/write=12 | 197 instructions, one paired decode return, two actual memcpy calls, split payload and write wrapping to 4, actual refill RET. |
| Native dependency advances read by four and returns four | 800 instructions, six completed decodes, six read changes/writes/loops; a seventh decode is pending. Returned decode history and ongoing refill both remain visible. |
| Selected dependency returns zero without setting EOF | 800 instructions, eight paired decode returns and eight loop edges, write remains zero. |
| Adapter dependency executes an infinite x86 JMP | 800 instructions, one decode call, zero returns/writes/loops, three nested pending tokens. |

Caller, initialized object/sample data, unexecuted DLL initialization, and
dependencies are explicit fixture inputs. The adapter's work target RVA
`0x2a470` is replaced **in fixture memory only** with a JMP to the synthetic
backend. The zero case directly selects that backend; other cases execute the
original adapter. The EXE's decode IAT points to the loaded original DLL;
memcpy IAT points to a synthetic cdecl REP MOVSB implementation. Original
pinned bodies remain unchanged. These controls exercise native CALL/RET,
branches, arithmetic, index stores and copying, but do not exercise a real
music codec or SDL initialization. They justify no audio-quality conclusion.

There are 17 negative controls at each base: owner, epoch, lifetime, missed
events, sequence, block feed, sample reuse, changed return snapshot, pushed call
token, RET destination, sample argument, instruction/record bounds, write,
condition, live code and original PATHHASH. All invalidate or reject as expected.

`DECODE_PENDING_AT_BOUND` means pending in this finite window, never “decode
cannot return.” If earlier calls returned and refills looped, the result is
`RETURNED_DECODE_REFILL_CONTINUES` even when another call is pending; pending
frames are preserved separately. The first chasing-fixture assertion exposed
that distinction and is retained as failed evidence, followed by the corrected
passing run. An initial fixture loader ordinal-import rejection is also retained.

## Validation, evidence and next boundary

Final focused tests: ten native controls (each with observed/unobserved arms),
34 negative controls, full-memory and CPU-step parity PASS.
`flock /tmp/wine-build.lock bash tools/build.sh` PASS after the final code edit.
All logs are gzip from first byte, with independent decompression/CRC/hash
rereads. Test/build logs additionally have producer SHA/size receipts; the board
watch log has an independently computed original hash, not a producer receipt.
Small evidence is in
`scratch/runs/20261108-gltron-native-decode-ring-2215/`; Git SHA plus exact owned
new-file patches provide source recovery. Existing modules/media are PATHHASH
references, not copies. No source archives, old-run deletion or peer edits.
Shared disk initially fell below 1.5 GB: writes/build were held until coordinator
restoration, then resumed. No continuous free-space guarantee is claimed.

The next required boundary is a trusted, continuous owning CPU/module/object
lifetime feed, including asynchronous callback/thread changes and missed-event
invalidation, before this can diagnose an original run. The prior audio callback
and grant progress remain established on their own terms. Full27, parity,
audio quality, FPS, visible geometry and original startup cause remain open.

Box **NONE**, state **NOT_CREATED**, expiry **NULL**, stop receipt **NA**.
Offline only: no Chrome/browser/game/input/remote/runtime, no workers spawned
as agents, and no original retry, configuration, backend, clocks, seed or guest
time changes. The single task ends with the tested validator available and the
original cause explicitly unresolved.
