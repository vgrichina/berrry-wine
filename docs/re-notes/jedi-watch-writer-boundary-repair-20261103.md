# Jedi writer boundary — fault repair proved, exported-entry gap retained

**The retained candidate repairs the selected threaded REP fault/restart cases
and rejects the previously failing direct conversion helper, but it still does
not protect every native writer. No production code is published.** The first
remaining native failure is an API wrapper's argument spill, before either the
conversion helper or Win32 dispatch guard. `runtimeIntegration=false`,
`allWriterProtection=false`, `readyForCampaign=false`.

Exact input: `4ce1e916a1905143b1f20ed691b72544ed840f82`. Evidence:
`scratch/runs/20261103-jedi-watch-writer-boundary-repair/`. The
[predecessor](jedi-rep-first-store-repair-20261103.md) candidate remains
unlanded. This run retains its extension in `candidate-*`, `candidate.patch`,
`candidate-pins.json` and the recovered modules. All six production source
files were restored and verified byte-for-byte against the exact input before
release. Alice's host/controller files and shared census were not edited.

## Fault/restart repair and unchanged interruption evidence

The old fallback committed REP elements through local addresses without
publishing ECX/ESI/EDI progress. An absent translation raised asynchronously,
but the native copy continued using its old stream and block-entry PC. The
retained default failure had five raw handler calls, stale ECX7 and pre-REP
marker2. Source comparison confirms the relevant committed source closure is
unchanged between that predecessor's input20a45dd and this task's exact4ce.
The old failure log is copied into this run; it was not rerun as a new pass.

The candidate carries the REP prefix PC in the six threaded MOVS/STOS operands.
For unarmed fault mode3, a checked element loop verifies the whole source,
then the whole destination, before writing. Each completed element publishes
ECX and indices exactly once. An absent byte sets prefix EIP, fault address
and read/write intent, raises the existing asynchronous exception, and returns
without dispatching the failed block's terminator. It does not manufacture a
guest handler, repair guest damage, or run the handler inside the native copy.
Other fault modes retain the existing path. Armed REP element stepping still
uses the predecessor's mapped-only path and rejects absent memory.

| Same default fault case | Before, retained | Candidate, actual native |
| --- | ---: | ---: |
| Raw handler calls | 5 | **1** |
| Pre/post markers after completion | 2 / 1 | **1 / 1** |
| Exception address / context EIP | 4251648, block entry | **4251660, REP prefix** |
| Context ECX | 7 | **4** |
| Context ESI / EDI | stale entry values | **138354764 / 138416128** |
| Access kind | 0 | **1, destination write** |

The default MOVSD destination case passes all existing assertions, including
bytes before repair, flags, stack, final register values and guest VirtualAlloc
recovery. Two additional selected regressions pass: cached backward MOVSW
with a straddling source fault, and backward MOVSB destination fault. Each
calls the handler once and preserves completed-element progress. This is
threaded absent-page evidence, not PAGE_* protection, optimized-tier, every
SEH classifier or ContinueSearch qualification.

All **19** unchanged corrected REP cases pass on this candidate, without
repeating the predecessor's earlier harness mistakes. The exact same128-byte
CALL/REP MOVSD fixture returns from one `run(16)` with shield80, health100,
ECX1, EAX0, EIP4249740 at the REP prefix, ESI4253832, EDI4253816 and
ESP4262004. The pending CALL return remains4249713. MOVS/STOS widths1/2/4
in both directions, nonloss-before-loss, overlapping vital bytes and destructive
copy overlap retain exact CPU/lazy-flag/stack state and frozen observations.
One explicit disarm/release resumes the remaining REP, preserves PUSHFD flags
and executes the following counter increment once; another run does not repeat
it. The scalar CALL/store fixture also passes. These are fixture-controller
proofs, not production input delivery or original Jedi execution.

## Protected writer set and the first remaining failure

The candidate's intended protected native set is explicit:

| Entry or writer family | Candidate rule | Evidence / limit |
| --- | --- | --- |
| Threaded REP MOVS/STOS, widths1/2/4, 32-bit addressing | One mapped element, then host observation | 19 native cases, precise continuation and explicit resume |
| Admitted scalar instructions | One instruction per decoded block | Scalar CALL/store passes; this alone does not prove a writer barrier |
| `guest_memmove`, `guest_memset`, direct `rep_movs_mem` / `rep_stos_mem`, CRT wrappers | Reject while armed before effects | Eight entry shapes pass; all eight work unarmed |
| Absent REP source or destination | Reject before element or register progress | Two native rejection cases pass |
| Production `win32_dispatch` | Reject at entry before hooks, pins, arguments or callback effects | Native call of the actual function preserves CPU, stack and vitals |
| Direct `wide_char_to_multi_byte` | Reject before codepage resolution, last-error or output writes | Actual predecessor failure now rejects with unchanged CPU, stack and vitals; disarmed conversion still produces80/90 |
| Generated `test_call_*` wrappers and other exported writers | Must reject before their own guest writes | **Not enforced; first remaining failure below** |
| Host memory views, sibling instances, scheduler and input ownership | Must be excluded by an exclusive production controller | Not integrated or qualified here |

Armed decoding also contains a conservative opcode allowlist: register
INC/DEC/PUSH/POP40–5F, MOV88–8B/B0–BF/A0–A5/C6–C7, STOSAA/AB,
PUSH68/6A, NOP90, PUSHFD/POPFD9C/9D, RETC3, CALLE8 and JMPE9/EB.
Code16 and address-size override are rejected. This allowlist was statically
checked and exercised by the positive fixtures; negative opcode membership
and every admitted instruction shape were not independently qualified. It
cannot establish coverage of direct exports or host writes.

The new API suite first proves the direct helper repair, actual production
dispatch rejection and ordinary unarmed conversion. It then invokes the
existing generated `test_call_WideCharToMultiByte` export. That wrapper writes
its ABI arguments through `$gs32` at ESP+4 onward **before** calling the guarded
helper. A valid fixture stack/watch overlap (ESP4249704, shield4249708)
therefore commits both watched words before the guard traps:

```text
before: shield100, health100
entry:  test_call_WideCharToMultiByte
after:  shield80, health90; CPU registers unchanged
error:  RuntimeError: unreachable, reached only after ABI stores
required: unsupported entry rejects before any guest writes
```

`retrieved/generated-api-observation.json`, `api-entries.log` and
`first-native-failure.json` preserve that failure before assertions. No repair,
resume, weakened assertion, later native suite or exhaustive passing rerun
followed. A guard in a shared conversion helper or Win32 dispatcher cannot
protect a wrapper's earlier writes. The next repair needs an exported-entry
contract that rejects unsupported paths before ABI spills, plus a complete
export/writer inventory; then production controller qualification remains.
The generated test export is a native test entry, not proof that ordinary
production Win32 dispatch bypasses its new guard. The all-entry requirement
nevertheless fails. Other direct exports remain unqualified.

## Build, source identity and recovery

One locked full build passed:
`timeout600 flock /tmp/wine-build.lock bash tools/build.sh`. No second full
build was attempted. Fragment balance, logical operands, the reviewed isolated
census overlay and six dispatch-macro checks pass. Actual native
`test-fused-entry-overlap.js` also passes its two interior-entry shapes.
Each native suite had an independent300-second outer timeout. The first
prebuild static failure was an incorrectly classified new census row;
`prebuild-first-failure.json` preserves it and the reviewed classification
repair. It consumed no full-build attempt. The candidate census lives only
in this run and the isolated test source; Alice's shared file was untouched.

Main candidate module:2,091,435 bytes, SHA256
`176938c88bff446a304ed5bfc1de18b094e32d69ab89516f9a766f0cac623e5a`.
Fault fixture module:
`329921c2d938c6e01597636a1d723ab555cc422c213296a08fa2d3285d42763c`.
Failing API fixture module:
`7342cad0731ad469c873d1f9995cdedafe332abc7daf418f1be2fb805a0fc453`.
The compatibility module and every compiled focused module are recovered.

Before allocation, all43 ignored inputs were verified by size/fullSHA and
required host/compiler/pngjs/wabt imports succeeded. A new Git archive contains
all15,794 committed files from exact4ce, excluding foreign WIP. The fresh boat
verified every source and all43 inputs and imports before applying the declared
overlay or building. Post-test verification found exactly the six source
changes and candidate census overlay. The unchanged notepad PE is53,248 bytes,
SHA256 `e7b01ab85a35ba6f577067d13efa522dc3d605de7712340e4acaf7065f866340`.
The existing ignored fault fixture is additionally pinned as
`dd1cb1ccc3e64f20b81adb1e6bf8f1895e1f46276125a76afc2b6e03047be019`.
The extracted source has no Git history; the build log explicitly records its
append-only API comparison and offline Big5-check limits.

The only test boat was fresh `bx_suvu9xw7`, TTL3600, original expiry
`2026-11-03T18:24:46.401Z`, recorded before use. Native work started after
`alice-fault-termination-repair RUNTIME RELEASE` at17:27:48Z. No simultaneous
heavy native tests, foreign/predecessor boats, subworkers, Claude panes,
HeroesII, CACA003B changes, original Jedi campaign, fabricated original-game
handlers or deployment occurred. Local free disk stayed above2GB.

Recovered archive:10,525,916 bytes, SHA256
`644ab4bf5e2590704bfeff7db317fe79632466cebb69cd056e85d373ea3ae607`.
All119 payload sizes/fullSHA, all43 inputs and tested candidate source were
verified locally before the original task's explicitly delegated normal STOP.
Logs, source/input manifests, native modules, fixture scripts, persisted
latches and the first failure are retained. `RECOVERY.md` records restoration;
`result.json`, `final.txt` and lifecycle files record the terminal disposition.
No ready production code exists in this result; only this note is published.

Normal STOP `stop_234a81d121bb12b1` completed with `error:null`,
`forced:false`. Actual state is **STOPPED** at17:34:08.188Z; the final snapshot
completed and was verified at17:34:08.125Z. All three owned build/suite
supervisors were absent before STOP. Custody returns to the coordinator. The
original expiry remains recorded above; the stopped boat has no active expiry.
The first status lookup omitted the explicit boat ID and returned a CLI error;
the corrected lookup and actual info agree on the completed stop and snapshot.
AUTHOR RELEASE ends this single task; no successor or boat reuse is assigned.
