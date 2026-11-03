# Protected register ALU admission

Run: `scratch/runs/20261103-jedi-register-alu-protected-decode/`.
Exact input `2a0c482d7`, production prerequisite
`5a5b9a4b140ddf6ca702296fe9e15ed1bca21209`.

The previous canonical module rejected original notepad `SUB ESP,0x44`
(`83 ec 44`) at `0x4010cf` during protected decoding, before CPU, lazy flags
or vitals effects. That accepted exact-module control is reused by its recorded
full SHA, without repeating a predecessor runtime. This was an unsupported
instruction boundary, not an established writer bug.

The protected admission set now permits only unprefixed 32-bit Group1
register-immediate ADD, OR, AND, SUB, XOR and CMP (`81`/`83`, ModRM.mod=3).
A side-effect-free ModRM peek excludes memory destinations before the normal
Group1 decoder runs. Instruction-start distance excludes every consumed prefix;
16-bit code/address modes remain rejected. ADC/SBB, byte/word operations,
prefixed forms and neighbouring ALU encodings remain unaudited and excluded.

The existing handlers are unchanged. ADD/SUB retain their original operands,
wrapped result and 32-bit lazy flags; logic preserves the existing unused
lazy a/b fields, and CMP changes flags without writing its destination.
The six admitted handlers touch the register file and flags, with no guest
memory access. Compiler canonical/standalone rules, exports/ABI, REP, service
entry, PUSH preflight and Alice's host seals are preserved.

The new canonical-artifact regression starts at the real PE entry and executes
the unchanged original PUSH/MOV/SUB sequence. Its separate synthetic admission
controls exercise both immediate encodings, all eight registers and arithmetic
edges against independent result/lazy-flag/materialized-flag expectations and
protected/unarmed parity. Exclusion controls cover memory operands, every
prefix class, ADC/SBB, byte aliases and an adjacent register ALU encoding.
They check CPU/flags/vitals/target operands on the initial rejection and full
512 MiB equality on the repeated rejection. Ordinary-supported excluded forms
first populate an ordinary decode; arming must discard those blocks. Address
size Group1 already rejects in ordinary decoding, which is checked explicitly.
No synthetic bytes or handlers replace the original PE probe.

The actual canonical module is SHA256
`065267ce7c208cb369b1fa930425627b3a238c9e184e5aa46d8ef16143b8b5b8`,
2125777 bytes. The unchanged original execution passes PUSH EBP, MOV EBP,ESP,
SUB ESP,0x44 and PUSH ESI. The next real failure is protected-decode rejection
of memory-indirect `CALL [0x4063e0]` (`ff 15 e0 63 40 00`) at `0x4010d3`.
CPU, lazy flags and vitals are unchanged at that rejection. Its target load,
return-stack write and following service transition need their own safety
proof; widening memory CALL admission is outside this register-only fix.
There is no new writer-defect claim and no original Jedi/controller run.

The locked full build passes after fixing an initially undeclared scratch
local, whose failed EMIT log is retained. The first register regression also
retains its ordinary 0x67 cache-prime setup failure; it was corrected to assert
the existing ordinary rejection. All ten focused suites pass: compiler
contract, register ALU, original scalar PUSH, nine production service-entry
states, export/ABI protection, nineteen REP cases, scalar CALL, fault restart,
ordinary animation and render protocol/cache controls. The register suite has
1344 arithmetic/register/immediate model and parity controls plus 70 exclusion
controls. Materialized CF/ZF/SF/OF are checked as well as exact lazy fields.
The final target-operand snapshot refinement is rerun separately without
rebuilding unchanged production code. Existing standalone/frontend evidence
at the exact prerequisite revision is reused; affected contracts are rerun.

One fresh boat `bx_ggs8amks` was created after Alice's explicit runtime
release. Its actual ID and original expiry `2026-11-03T19:40:16.961Z` were
recorded before use. All 15865 effective inputs and 57 actual loaded imports
passed size/fullSHA verification before native use, including the unchanged
original PE, stdole2, pngjs and matching fault fixture. Staging used committed
Git blobs plus only this worker's declared decoder/test delta. Final inputs
were reverified; Node is v24.22.1 on x86-64 Linux. Heavy/native work ended
at 18:46:11.636Z; no native processes remained at 18:46:36Z.

Complete local recovery verifies all 86 payloads (14583316 bytes) and both
owned code/test sources byte-for-byte against the tested boat. The archive
is 5209114 bytes, SHA256
`764fa5d133b9a3e242286577ec90f4253dac327a151835fdc7f409fa7d9cb29c`.
`RECOVERY.md` in the ignored run directory records reconstruction. Only after
full local verification was the explicitly delegated normal STOP requested.
Actual state is stopped at `2026-11-03T18:46:58.487Z`;
`stop_617a2bfedd447d2d` completed, error:null, forced:false. Snapshot
completed/verified at `18:46:58.447Z`. Original expiry is now inactive;
custody returns to the coordinator. Runtime release was posted at 18:46:50Z.

This bounded admission does not qualify all writers, an exclusive controller
or original Jedi attribution/gameplay. No subworker, original Jedi game run,
foreign/predecessor boat operation, deployment or successor is used.
