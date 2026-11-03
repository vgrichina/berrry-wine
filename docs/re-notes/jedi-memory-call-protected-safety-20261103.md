# Protected absolute memory CALL safety

Run: `scratch/runs/20261103-jedi-memory-call-protected-safety/`.
Exact assigned input `f0d727724`, production prerequisite
`4b3e23bdea7bff18b92e33fba32ad8a0d7a0ccc1`.

The accepted predecessor canonical module rejected unchanged original notepad
`CALL [0x4063e0]` (`ff 15 e0 63 40 00`) at `0x4010d3` during protected
decoding, with CPU, lazy flags and vitals unchanged. That was unsupported
admission, not an established writer defect. Its existing evidence is reused;
no predecessor module is rebuilt or rerun.

Static audit found that the existing indirect CALL handler loads its target,
decrements ESP and writes the return address before inline Win32 dispatch.
Dispatch rejects protected mode, so merely allowing FF would reject after
the CALL's architectural effects. The bounded repair distinguishes the x86
CALL instruction from subsequent service execution.

Only unprefixed 32-bit absolute near CALL (`FF 15 disp32`) is admitted.
Register, base/displacement, SIB, far and neighbouring Group5 forms, every
prefix and 16-bit modes remain excluded. Before any target load or stack
write, the handler checks all four operand and return-slot bytes with the
side-effect-free mapping predicate. DIB spans remain excluded because their
translation can trigger lazy host readback. After loading the target, it
rejects NULL, native wndproc markers, unmapped code and DIB entries before
the return store; the prospective target's first four bytes must be mapped.
This is deliberately narrower than ordinary x86 execution.

After validation, protected CALL writes the return address once, changes ESP
and EIP, and ends the host slice even with a large block grant. It invokes
no service. Normal code targets retain shadow call-stack tracking; thunk
targets retain their ordinary exclusion from that shadow stack. Protected
run entry now refuses thunk EIP before budgets, diagnostics, callback setup
or other state changes. Disarming resumes the existing dispatcher using the
already committed frame. Ordinary CALL retains its existing inline dispatch.
No API is allowlisted and no guest handler or probe byte is manufactured.

The actual canonical module is SHA256
`a4945b9490d805b3f5528122b943b86d7460c38cddefeb7d863782d84b92a79c`.
The unchanged PE, loaded imports, original startup registers/stack and
original prologue are used. Its CALL loads the real `GetCommandLineA` import
(API 194), stops at thunk `0x07500140`, and writes return `0x4010d9` at
`0x074fffac` (ESP was `0x074fffb0`). No API executes in that protected slice.
Both first service entry and retry preserve full 512 MiB memory, CPU, lazy
flags and vitals. This service remains the first protected execution frontier.

The explicit unarmed restart returns normally to unchanged `0x4010d9` and
restores the original pre-CALL ESP. A diagnostic protected follow-through
then executes original MOV ESI,EAX and MOV AL,[EAX], before rejecting
`CMP AL,0x22` (`3c 22`) at `0x4010dd`, with CPU, lazy flags and vitals
unchanged. This follow-through crosses an explicitly unarmed service and
does not prove protected continuity through GetCommandLineA.

The canonical regression passes the original CALL/service/restart sequence
and 58 mapping, target and encoding rejection/retry controls. Controls cover
absent and straddling operand/stack mappings, cold and ordinary-cached
rejection, exact mapping repair/restart, noncontiguous sparse pages,
operand/return-slot aliasing, DIB/wrapped spans, unsafe targets and all
excluded prefixes/forms. Rejected retries check full memory; first attempts
also check CPU/lazy flags, stack, API count and vitals, including the mapped
low bytes of straddling stores. The original code/import remains unchanged.
The service-entry regression additionally checks all mutable globals and
full memory on both initial entry and retry, including a real loaded thunk.

Both locked full builds pass. The final 2126016-byte module passes all eleven
focused suites: compiler closure contract, memory CALL, 1344 register ALU
model/parity controls and 70 exclusions, original scalar PUSH, ten production
service-entry states, all 1632 unsupported exports/ABI contracts, nineteen
REP cases, scalar CALL, fault restart, ordinary animation and render protocol
and cache controls. Service/export rejection checks cover all 2277 mutable
globals and full 512 MiB memory. Accepted unchanged standalone/frontend
compiler evidence is reused; no compiler implementation changed here.

The first cheap gate failed because the callback census detected the changed
CALL/run functions; its log is retained. After reviewing only those entries,
the first full build passed. The first memory CALL suite reached an ordinary
GS-prefix cache-prime rejection; its primary failure and diagnostic logs are
retained. The test now asserts existing ordinary GS/67 rejection, and primes
the remaining excluded forms successfully. Static follow-on audit additionally
excluded unsafe target entries before the final build and full focused rerun.

One fresh boat `bx_jwkmtzsd` was created only after Alice's explicit runtime
release. Actual ID and original expiry `2026-11-03T19:55:28.135Z` were recorded
before use. Staging replaced every tracked path with exact assigned Git blobs
and overlaid only declared owned deltas. All 15868 effective inputs and 57
actual loaded imports, including original PE, stdole2, pngjs and the matching
fault fixture, were size/full-SHA verified before native use and reverified
after the run. Runtime was Node v24.22.1 on x86-64 Linux. A redundant generated
264 MB source archive was removed after verified extraction; the exact Git
blob generation recipe and its full SHA are retained.

Full local recovery verifies all 84 payloads (15540265 bytes) and all six
tested owned code/test/census sources byte-for-byte. The recovery archive is
5365828 bytes, SHA256
`7bbae57478abe10c273acdcc9bd2d5443150eba4d09480d430ab08126e3f11c7`.
The run's `RECOVERY.md` records reconstruction. Heavy/native work ended at
`19:07:40.518Z`; no native processes remained at `19:08:29.952Z`. Runtime
release was posted at `19:09:12Z`. Only after full local recovery verification
was the originally delegated normal STOP requested. Actual state is stopped
at `19:09:18.412Z`; `stop_252447b55a089700` completed with error:null and
forced:false. Snapshot completed/verified at `19:09:18.310Z`. Original expiry
is inactive and custody returns to the coordinator. No foreign/predecessor
boat, resume, subworker, deployment or successor was used.

Alice's host seals, compiler adapters, exports/ABI, REP, register ALU and PUSH
protections remain in force. Callback census changes review only the altered
CALL/run boundaries and retain ownership pending. There is no all-writer,
exclusive-controller, original Jedi attribution or gameplay qualification.
