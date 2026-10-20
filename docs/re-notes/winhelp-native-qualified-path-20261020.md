# WinHelp qualified-path native/fullVM requalification — 2026-10-20

**PASS: all seven unchanged callback scenarios, with 70 successful same-VM
siblings in each (490 total).** The prior three WinHelp failures before DLL
entry no longer reproduce on canonical source
`1262cbfcf8b5881543f2fb18c0f80b4bd9429306`.
No production change, fixture repair, oracle relaxation, or rerun was needed.

The exact canonical module SHA-256 is
`bc5412c1ba338ec5b385ff77eca1aa213c156cd5d0693e1cdcbf850867f7ecd4`.
Execution used Linux x86-64, Node `24.18.1`, V8 `13.6.233.17-node.50`, on
`bx_6czhvg6m`. These are actual guest x86 instructions executed through the
full WASM VM, not a source model or a native Windows process.

| Scenario | Original oracle | Successful siblings | DLL Probe entries |
| --- | --- | --- | --- |
| edit-ordinary | PASS | 70 | Not applicable |
| edit-nested | PASS | 70 | Not applicable |
| edit-error | PASS | 70 | Not applicable |
| edit-timeout | PASS | 70 | Not applicable |
| help-ordinary | PASS | 70 | 72 |
| help-nested | PASS | 70 | 73 |
| help-timeout | PASS | 70 | 72 |

## Actual callback observations

WinHelp ran through the public WinHelpA route, RegisterRoutine and the qualified
`c:\ew-native.dll` loader path. No direct callback bridge was used. All three
cases returned public acceptance `1`, rejected an unknown macro with `0`, and
completed the caller. The final actual DLL argument was `71`, with guest-written
computation `0x1047`. Ordinary and nested cases retained outer argument `0x1234`
and computation `0x2234` before siblings. The nested case recorded the extra
Probe entry and passed the inner saved-register/ESP assertions.

The timeout case recorded the actual spin marker `0x71ae0001`, with zero outer
computation as expected, then recovered and completed all 70 siblings. This
is an internal callback timeout, not an external process timeout. All child
processes exited zero; no wall-clock guard fired.

The original oracle checked exact outer stdcall ESP restoration:
`122683384` before and after in every scenario, plus ECX/EDX/EBX/EBP/ESI/EDI
restoration, stack canary `0x51ac0ffe`, and caller completion `0xc001c0de`.
The fixture's DLL uses two stack arguments and `ret 8`; RichEdit uses four
arguments and `ret 16`. Generated code and disassembly are retained.
Actual continuation, argument/computation writes and caller snapshots establish
return-path behavior. The DLL code loads EAX `0x76543210` before return, but the
public API deliberately reports acceptance `1`: this fixture does **not**
independently sample raw DLL EAX at the return instruction. No such observation
is claimed.

RichEdit ordinary/nested text results, error `123`, timeout error `1`, callback
entry counts, actual buffer bounds, nonvolatile clobber isolation and nested
restoration passed the original oracle. Error and timeout outer API returns
were correctly `0`; subsequent siblings still returned successfully.

## Build, source identity and controls

The prior successful MadBomber recipe was reused in a new isolated remote
directory `/home/user/winhelp-qualified-fullvm`. Before building, all 6,441
source blobs were verified, the complete predecessor closure and existing
dependencies were available, and the include/glob gate passed. Only four
tracked blobs differed from ee139a094: the integrated production fix, its test,
and two notes. No npm install or speculative closure-staging loop occurred.

`bash tools/build.sh` passed, including the unchanged 399-entry callback census,
vendored compiler provenance, manifest and layout gates, WATX compilation and
compiled data overlap checks. The exported source directory has no `.git`;
as recorded in the build log, the API-table gate checked IDs/index structure
but could not compare append-only history against HEAD. Exact Git blob
verification provides source identity separately.

Unchanged fixture commit: `2c902c79f362560112ca30d41e4332688046d55a`.
The fixture is an explicit test overlay, not a production source overlay:

- `test/test-edit-winhelp-callback-native.js`: Git blob
  `c88a5de8d7db19f9e4726466d47e6cf09a8a3509`.
- `test/fixtures/edit-winhelp-native/validate.js`: Git blob
  `9a6cfcb1d872f4cd0b1d2d73458a75c85f46243e`.
- Pinned `freecell.hlp`: Git blob
  `5418925c6c66c548daadd61531ea4c2083288e7a`.

Existing offline controls passed: seven generated/disassembled cases, seven
argument negatives, 14 ABI negatives, 14 missing-evidence negatives, seven
synthetic oracle positives and 84 synthetic oracle negatives. Incorrect callback
pop and bad IAT controls are offline validation, **not actual malformed-x86
execution**. Synthetic logs were never counted as runtime evidence. Local
replay of the unchanged oracle against all seven recovered actual logs passed.
The prior source-only review/replay and its validation were inspected separately.

## Evidence, preservation and release

Self-contained evidence:
`scratch/runs/20261020-winhelp-native-qualified-path/`.
`verification.json` holds decoded observations; `recovered/native/` holds the
original logs, runtime receipts, executable bytes and overlays.
`recovered/wine-assembly.wasm`, source/fixture manifests, canonical build log,
offline controls, preservation inventory, scripts and `RECOVERY.md` retain the
module and recovery recipe independently of runtime expiry.

All 168 recovered artifact hashes and the 2,174,111-byte evidence archive hash
were verified. Before/after checks passed for 6,441 source blobs and 22,999
preexisting files, including Army, ICM, callback, JS COM, dependencies and the
MadBomber exact-ee139 source/module. The original module remains
`5e66c75862052b13b73f80bdcbcd67a1a65fd99d3e9e79d33f96548d00cc2a21`.
The actual Node executable hash is recorded in `postflight.json`.

Build/scenarios completed at `13:17:39Z`; controller PID 77705 and task processes
were absent at postflight. Runtime released at `13:19:39Z`, left running with
the assigned `15:53Z` TTL. Logs, module, manifests and recovery recipe were
recovered before release. Local evidence is approximately 11 MB, below the
20 MiB cap; the 2 GiB plus 60 MiB concurrent reserve was maintained.

This report-only task does not modify shared HEAD/index, production, laptop
Heroes II/Warcraft III, or merge main. No screenshot or gameplay qualification
is claimed. No remaining failure was observed within these seven scenarios.
Task commit and verified remote branch are recorded in the final evidence
receipt and append-only repository messageboard.
