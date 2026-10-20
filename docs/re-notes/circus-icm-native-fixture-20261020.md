# ICM callback ownership: real-x86 fixture (2026-10-20)

Target: `066436de903151fb03194884f63ab72e0f9071dc`, based on fetched
`origin/main` `d3c332ab8f186564db28226f6484a95be8ae1674`.
**Native suite UNEXECUTED.** This assignment permitted source-only syntax,
fixture generation and static inspection; sandbox.resume403 remains unresolved.
No build, guest execution, runtime probe or production source change occurred.

`test/test-icm-callback-ownership-native.js` follows
`test-icm-installable-driver.js`: generated PE32 EXE, SYSTEM.INI overlay,
loaded x86 DLL export `DriverProc`, production `test/run.js`. The DLL uses
the EXE's resolved IAT for nested calls; it has no DLL-base assumption.
There are no added exports, compiler transforms, invocation/run mocks or
direct calls to ICM implementation functions.

The actual ABI reviewed is `ICOpen(type, handler, mode)`, stdcall 12;
`ICSendMessage(hic, msg, p1, p2)`, stdcall 16; and
`DriverProc(id, hdrv, msg, p1, p2)`, stdcall 20. At DriverProc entry the
arguments occupy ESP+4 through ESP+20. DRV_OPEN's p2 points to ICOPEN,
whose type/handler are at +4/+8. The driver returns an instance ID that
later callbacks must receive. ICClose is stdcall 4.

## Runnable coverage and limits

| Scenario | Assertions designed into fixture (all unexecuted) |
| --- | --- |
| Ordinary | Driver ID, handle, message and parameters; LRESULT; six non-EAX registers, exact ESP and stack canary; caller continuation; close result |
| Nested | DriverProc calls ICSendMessage on the same HIC; inner result and all six register/ESP snapshots; original outer args still produce outer result |
| Sliced | 1,000,100 real decrement/conditional-branch loop iterations exceed the fixed 1,000,000-block inner run budget; completion marker and caller restoration |
| Timeout | Infinite guest loop reaches the existing 64-round bound, returns ICERR_UNSUPPORTED, restores caller and permits another call |
| Acquisition fault | Recursive real ICSendMessage reaches 63 DriverProc entry log markers; child 64 must trap with `unreachable`, without any returned marker |
| Isolation | A second call with new parameters/register seeds plus 70 more sibling calls on the same live HIC follows every successful/timeout scenario; fresh ordinary process after terminal fault |

The callbacks deliberately clobber nonvolatile registers too, testing ICM's
full saved-context contract, not asserting that a Windows driver may disregard
its ABI. EAX is checked as the public API result. EIP/handler resumption is
observed through subsequent guest instructions, API calls and completion.
EFLAGS is not promised by these APIs and is not asserted.

No stale-child/root/depth injection, token identity observation, epoch reset
race, spill-cache exhaustion, arbitrary guest exception/SEH, current-thunk
parking assertion or in-instance recovery after a terminal trap is covered.
The capacity test observes the acquisition trap, not the private ownership
frame or proof that the failed acquisition wrote no guest bytes. The runner
exits immediately on traps, before its normal final memory dump; consequently
this case uses real OutputDebugStringA markers and the crash log, and fresh
process isolation is explicitly weaker than reset of the trapped instance.
Budget crossing follows the inspected production run/branch accounting; the
fixture does not instrument internal slice counts.
The 70 siblings exceed ownership capacity and check the sum of all results,
so a child leaked on each successful return cannot evade this observable test.

These are behavioral regressions, not demonstrated baseline-failing tests
of the three new ownership comparisons. Normal completion is expected to
work before the hardening patch too. The prior 15 source-model cases remain
separate evidence for controlled identity mismatch tests, not native proof.

## Independent ordering review

Reviewed `icm_drv_call` against `src/04-cache.wat`:

1. Pre-entry reads only capture the interrupted context. `sync_depth_enter`
   first calls `invocation_sync_enter`: ensure/validate lifetime, capacity
   check, allocate identity, then publish the child. Only afterward does it
   pin spill state and increment sync depth. Moving it before guest frame
   writes protects the acquisition-failure boundary.
2. The retained child/root/depth are read after entry and kept in WASM locals,
   so nested callbacks cannot overwrite them. `invocation_current` itself
   validates thread/root/process epoch before returning the stack token.
3. After ordinary completion or the bounded timeout, all three comparisons
   precede `sync_depth_leave` and restoration. This matters because
   `invocation_sync_leave` alone passes the *current* token to
   `invocation_leave`, which does not prove it is this ICM call's child.
4. Leave pops ownership first, then decrements depth/unpins spill state and
   may force the spill desk. The patch preserves that production ordering.
   It then captures callback EAX and restores the interrupted registers,
   steps, yields, EIP/handler flag and current thunk.
5. A trap bypasses this epilogue; the patch does not promise finally-style
   cleanup. Timeout with matching ownership still retires the incomplete
   callback and returns unsupported, preserving the existing policy.

No demonstrated defect within this hunk was found. Native qualification of
its rejection guarantees remains incomplete; no production fix is justified
by this source-only review.

## Recovery and approved future execution

Evidence: `scratch/runs/20261020-circus-icm-native-fixture/`.
It contains the fixture source snapshot, generated tiny PEs, disassembly,
static validation script/log, inspected source snapshots and hashes.

Source-only regeneration:

```sh
node --check test/test-icm-callback-ownership-native.js
node test/test-icm-callback-ownership-native.js --generate-only=/tmp/icm-generated
```

Only after a new explicit runtime/build grant: check out this task commit in
a complete authorized checkout, perform its normal `bash tools/build.sh`,
retain the exact source/build receipt and module SHA-256, then run:

```sh
WINE_ASSEMBLY_WASM=/absolute/path/build/wine-assembly.wasm \
WA_ICM_WASM_SHA256=<sha256-from-normalbuild> \
WA_ICM_SOURCE_REV=<exact-40-character-source-commit> \
WA_ICM_ARTIFACTS=/absolute/path/evidence/icm-native \
node test/test-icm-callback-ownership-native.js
```

The suite refuses an unpinned module and never builds. It retains every
generated fixture, command, stdout/stderr log and a runtime receipt, including
failures. The revision is operator-supplied provenance, not independently
attested by the module. No module hash is available from this assignment.
The new filename receives the existing default unit-tier classification;
explicit module prerequisites intentionally fail closed if it is invoked
without qualification inputs. No test-tier policy was changed.
