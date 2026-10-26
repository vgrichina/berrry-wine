# Maelstrom UOP-enabled native errno observer — bounded repair

The opt-in helper now supports the pinned select completion with UOP enabled
through **explicit native threaded CALL/RET boundaries**. This is a distinct
supported diagnostic route. Inlined UOP CALL/RET is not claimed equivalent or
qualified. The default helper still rejects UOP; production source and game
assets are unchanged. There was no guest attempt or canonical module build.

Base: `44e344fdb26daab9a07210656597902ba27cb5f7`.
The unchanged scalar reproducer uses the original batch 36170 completion from
`345dee2cd02b779f87d0ae38071ccb0976631577`, retained module
`aca2e70da288cea022848e8d4dee7645feebfa9eb106580433841a8527c483a1`.
Its phase 3, completions 1, return 0x7a3362, result 0 and token 7 are preserved.
Baseline fails with reason 3/mode bits 4; the repair reaches completed status 2.
Errno/caller are still uncaptured at that point. Original-game errno/caller
remain UNKNOWN; zero-filled original fields are not observed zero values.

## Source-derived route

`src/07e-uop-compiler.wat` classifies E8 and FF /2 as kind 23, and RET as
kind 24. `uc_emit_block` emits CALL as an ICG check (for FF /2), return-address
store, ESP decrement, budget check and jump. `uc_emit_ret` loads the return
candidate, compares it, releases ESP only on a match and jumps; a mismatch
leaves to threaded RET with ESP untouched. These transfers can bypass
`th_call_r`/`th_ret`. `uop_fast` also leaves global EIP at the last EXIT,
so treating a UOP trace head as an instruction-level CALL/RET observation
would be unsafe.

With `uopNativeBoundaries: true`, the generated `uc_decode` marks only the
pinned CALL EDI at 0x7a3364 and CRT RET at loaded-base+0xc438 unsupported for
lowering, before reading guest bytes. This uses the existing `uc_unsup`
record, scan termination and threaded side-exit mechanism, from module startup
onward. No warmed trace in this generated module can inline either instruction.
The compiler may decline a whole head or exit before the instruction. It does
not replace the instruction with an observation or claim the unsupported
inline route worked. No UOP disable, yield clear or budget alteration is added.

The actual CALL/RET handlers still push/pop the guest return address and
execute CRT code. The observer additionally permits precisely CALL boundary
EIP 0x7a3364 and RET boundary source loaded-base+0xc438, only in the captured
UOP=1 mode. Existing threaded block PCs remain eligible. Native target, EDI,
EBP, ESP, select token/thread/register-bank/result and immutable completion
identity checks remain. Nested native relative CALL/RET below the owned frame
can execute; an unexpected owner register CALL, released frame or stale
completion rejects. `mne_return` captures the actual EAX pointee and caller
frame after RET's real pop, before `branch_end` can execute the successor CMP.

Configure UOP before `mne_start`. The start mode is invocation-owned. The
instrumented public `set_uop` marks an active invocation rejected on a mode
change, even if the mode later switches back, while retaining the setter's
original normalization, flush and hot-gate behavior. Calls before start or
after a terminal record remain inert for the observer. The adapter's accepted
terminal closure logic is reused unchanged.

## Bounded evidence

`test/maelstrom-uop-native-observer.test.cjs` compiles a small extracted Wasm
fixture with 4 MiB memory, the production observer, full `uop_fast`, native
CALL/RET and register/ADD handlers. A bounded fixture decoder reads pinned
SDL_net and `_errno` bytes. Production UOP MOV/EXIT reaches the CALL boundary;
the native `_errno` E8, ADD EAX,8 and RET execute, including a controlled
**fixture native `_getptd` callee** (MOV EAX,fixture-ptd; RET). This is not an
authentic `_getptd`/TLS qualification. No host code fabricates `_errno`'s return
pointer or skips its native CALL/ADD/RET. The test stops before CMP and checks
errno values 0, 4, 10004 and UINT32_MAX plus caller/frame storage. Enabled and
inert observers leave identical fixture memory, registers, flags, budgets and
control trace. The production `msc_end` completes a token-owned fixture invocation and invokes
the generated completion hook; duplicate completion rejects. The actual compiler
prefix/`uc_unsup` also executes in a second
small Wasm fixture, checking exact boundaries and unrelated-address fallthrough.

Nine new behavioral groups cover owner/token/stale/foreign completion,
wrong native route, nested calls, irreversible UOP switching, disabled getters,
unsupported modes, terminal immutability and throwing/reentrant host callbacks.
The seven retained non-UOP, source-snapshot, rejection, adapter, scalar-anchor,
status/event and terminal-closure suites pass unchanged, including 511 failure
combinations, 3748 scalar boundary cases and 68 terminal callback cases. The CLI
emits all six fragments; exact transform readback passes. Logs and hashes are
in `acceptance.json` and `evidence-manifest.json`. Large accepted evidence is
referenced, not recopied.

## Recovery and remaining gates

This commit contains the helper, focused fixture and raw scalar JSON. Recreate
`ops/pinned-source` from `fixture-inputs.json`'s immutable standing paths and
verify every SHA-256. Those historical pre-transform source pins intentionally
differ from some production-tree fragments. Recover baseline helper bytes with
`git show 44e344fdb26daab9a07210656597902ba27cb5f7:tools/maelstrom-native-errno-latch.cjs`.
Restore `recovery/*.py` into the isolated task `ops` directory before running
`ops/run.py`, with MNE_SOURCE_ROOT/MNE_ORIGINAL_ROOT/MNE_CRT as recorded;
it sets these inputs itself from the isolated task path. Baseline command is
`node test/maelstrom-uop-native-observer.test.cjs --baseline` (expected exit 1),
repair command omits `--baseline` (expected exit 0). The tests require the
existing installed WATX compiler (or MNE_WATX) and an explicit writable MNE_OPS;
all installed identities and original binary pins must match. Restore ignored
Wasm only by these small fixtures and check `acceptance.json` hashes.

For helper generation, add `uopNativeBoundaries: true` to the existing explicit
configuration and use `--enable-exact-native-latch CONFIG NEW_DIRECTORY`.
Install all six generated fragments together in a **future separately authorized**
canonical diagnostic build; partial installation is not supported. Keep UOP
mode stable from invocation start. Full canonical compilation, complete UOP
compiler/dispatcher behavior and original-game execution are later gates.
This task provides no gameplay, production-runtime, authentic original errno,
or original caller result and does not authorize another guest.

Resource receipts preserve the 64 MiB task cap, 8 MiB reserve, free-disk and
memory floors, installed-tool separation and bounded outputs. All test children
were reaped; incidents are disclosed. Root refs match the launcher digest;
root tracked/index/refs and donors were read-only, with append-only board notes.
No test box was assigned or accessed. Existing boxes remain coordinator-owned.
Final tested tree, commit, trusted SSH remote readback and handoff are recorded
in external `/tmp/maelstrom-uop-owned-native-observer-repair-oct26/ops/result.json`.
