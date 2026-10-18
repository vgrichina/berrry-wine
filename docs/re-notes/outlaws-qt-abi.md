# QT_Thunk: source evidence and unresolved entry contract

Source-only investigation, 2026-10-18, based on main
`f3447c936cd026c9acdd130fbdcd7f1be3f23867`. This does not implement or expose
QT_Thunk and is not runtime compatibility evidence. Originals remain untouched.

## Stack normalization is resolved

[Wine's register-entry macro](https://github.com/wine-mirror/wine/blob/master/dlls/krnl386.exe16/kernel16_private.h)
pushes the caller's EBP and establishes a relay EBP.
[RtlCaptureContext](https://github.com/wine-mirror/wine/blob/master/dlls/ntdll/signal_i386.c)
recovers the original EBP and return EIP through that frame and sets captured
ESP to relay EBP + 8. Consequently the argument pointer used by
[Wine's QT implementation](https://github.com/wine-mirror/wine/blob/master/dlls/krnl386.exe16/thunk.c)
is **S + 4**, where S is the emulator handler's ESP including the CALL return.
Its copied range is `min(64, B - (S + 4))`; its eventual caller ESP advances
from S + 4 by the actual 16-bit argument cleanup. Its independently returned
EAX, EDX and ECX must not be replaced with packed DX:AX. This is implementation
evidence, not a complete Windows specification.

The unmodified PMPRO62F wrapper has S = B - 0x54. Thus this copy model includes
64 bytes of an 80-byte span. The actual PMPRO62 FLATTHUNK reads a DWORD and
returns with RETF 4, giving S + 8 = B - 0x4c. The saved EDI, ESI, EBX then pop
correctly. Treating the whole copied range as consumed arguments is wrong.
The raw disassembly and original identities remain under
`scratch/runs/20261018-outlaws-guest-bridge-design/` and the existing acquisition
and loader notes. Neither the operation number nor export name defines this ABI.

## Windows and Wine entry contexts differ

Matt Pietrek's primary account,
[Direct Thunking in Windows 95, DDJ special issue 1996](https://jacobfilipp.com/DrDobbs/articles/DDJ/1996/9614/9614c/9614c.htm),
describes at least 0x3c disposable bytes below EBP. Windows aliases the existing
stack, translates EBP, saves PE EBX/ESI/EDI, and clears DS/ES/FS/GS. Its
pseudocode places the previous SS and FS in DI and SI, and the new SS in DX.
The stack-transform calculation is omitted. That omission matters for other
register contents and high halves. The article does not specify complete return
register or flags semantics. The same author's book repeats this account on
printed pages 192–195 (PDF pages 174–177).

Wine uses a copied stack and its own relay BP frame instead. Its
`K32WOWCallback16Ex` copies the caller-provided span, appends a far return and
enters a register-aware relay. QT itself does not copy modified stack bytes back.
These are distinct implementations: neither proves that a private copied-stack
BP or unchanged incoming DS is the Windows callee-entry contract.

## Implementation decision still required

The coordinator selected a Windows-compatible stack alias rather than a
private copied-stack BP. Before exposing it, finish the callee-entry
BP/segment/register contract.
Do not silently manufacture register values from incomplete pseudocode. General
EBP-relative scratch access, pointers into the original stack, reverse thunks,
and asynchronous callbacks need an explicit supported design or diagnostic
boundary. Worker remains unsupported.

The coordinator permits preserving incoming unspecified register high halves
as an explicit emulator convention. That is not a Windows guarantee and need
not block implementing proven low-word fields. The full PE caller snapshot and
independent successful output merging remain separate requirements.

The existing LibEntry/WEP runner must retain strict stackWords cleanup. A new
mode needs an owned stack alias, argument-start SP and actual final
SP, independent EAX/EDX/ECX, plus an atomic executable-selector-to-live-module
pin. Validate source pages individually (including sparse stacks), wrapping,
alignment, return selector, over-cleanup, owner and generation before settlement.
Restore the complete existing CPU/segments/FP frame on both paths, then merge
only the chosen successful QT outputs. A failed invocation must leave the PE
request parked and diagnostic, never finish it with invented success.

## Prepared discriminating fixtures

`test/helpers/ne-qt-fixture.js` creates a real PE that resolves KERNEL32, walks
its EAT for LoadLibrary16/GetProcAddress16/FreeLibrary16, obtains an NE export,
resolves QT_Thunk by ordinary GetProcAddress, and calls with EDX holding the
far entry. Its wrapper recreates the original scratch and saved-register order.
It records before/after ESP and EBP, independent result registers, scratch
canaries and restored EBX/ESI/EDI, then actually frees the NE module.

The generated NE has real LibEntry and WEP, verifies arbitrary nearest-first
WORD arguments, returns distinct full EAX/EDX/ECX, and supports RETF 0, RETF n,
odd/over-cleanup, trap, infinite-loop and corrupted far-return fixtures. These
are prepared inputs, not tests of an implemented gateway. Pure generation and
NE image validation pass; no canonical build or guest was run. Runtime still
needs main/cooperative, direct/sparse, nested-owner/pin, full-context restoration,
stale settlement/cancellation and original-payload checks after a root grant.

## Alias and lifetime preparation checkpoint

`lib/ne-qt-stack.js` is a read-only planner, not selector publication. Current
segmented handlers require 64KiB-aligned bases, so the supported initial alias
window is the aligned 64KiB containing ESP. EBP, the return slot and documented
scratch must fit within it. Both ends of every guest page must translate into
one contiguous physical window; holes, split backing, wrap and odd pointers are
rejected. This admits qualifying direct and sparse mappings without pretending
that all sparse stacks qualify. A BP-relative scratch write then reaches the
actual PE stack. Pure tests establish those address identities only.

**Mapping lifetime is not established by translation.** The planner cannot pin
VirtualAlloc backing, and the existing virtual-map release path has no apparent
span pin. Before entering aliased sparse memory, add an owned mapping lease or
explicitly reject it. Holding DLL_LOAD_LOCK while executing is not a substitute:
the lock does not protect virtual-map lifetime and would deadlock callbacks.
Thread retirement/process reset must revoke the alias before freeing backing.
An actual gateway must save/restore the original DWORD at S, which its far
continuation overwrites. Scratch modifications by the NE callee remain visible.

The candidate lease location is the unused hidden-page gap 0x8f00..0x9000:
16 records of token/base/backing, between module call records and resource
handles. Audit all users before allocating it. Guard more than VirtualFree:
`virtual_map_release_one` is also called by commit replacement/republication and
exported mapping paths. Release of a reservation or split allocation must
preflight its entire range before mutating any island. Decommit needs the same
guard before zeroing or dropping PTEs. ThreadManager's retired-slot cleanup
currently ignores the result from `guest_map_free`; a lease rejection must not
silently discard stack ownership. These changes were absent at the initial
preparatory checkpoint; the following source candidate supplies this prerequisite.

The source candidate adds `win16_bridge_invoke_target`: under the frame's owned
scope and DLL mutex it resolves a live executable selector to a ready module
and pins it atomically. A pinned frame cannot change its module or entry target;
existing frame teardown releases the pin. This does not expose QT or change
LibEntry/WEP stack cleanup. `test-ne-qt-ownership-candidate.js` prepares native
checks for invalid/data/unloaded addresses, duplicate binding, target changes,
final-free exclusion and stale-frame teardown. Native checks were **not run**
at that checkpoint; the later mapping-lease validation below ran them.

## Mapping-lease source candidate (2026-10-18)

The audited gap now holds 16 records of `{frameToken:i64, guestBase, backing}`.
The module-call table is 24 records × 32 bytes at 0x8C00, ending at 0x8F00;
the DLL/run/ref/size/selector tables end below 0x8C00 and resource descriptors
begin at 0x9000. Handle reset zeros only the handle and resource areas, not
this gap. The process arena's initial zeroing initializes it.

`win16_bridge_stack_lease(token, alignedBase, expectedBacking)` requires the
current owned frame and scope. Under `LOCK_VIRTUAL_MAP` it checks all 16 pages,
both endpoints, physical identity and actual map-record ownership. Direct
windows are admitted only inside the fixed main stack; direct heap/fallback
stacks and DIB mappings are rejected. Sparse leases preserve mapping lifetime;
they do not turn arbitrary HeapAlloc objects into owned thread stacks. A future
gateway must use the caller's actual stack and report unsupported ownership.
No alias selector or QT entry has been published by this change.

Every map release preflights its entire reservation/continuation chain, every
decommit preflights before zeroing/PTE removal, and commit/replacement preflights
before changing an island. Section exports have their own full-range guard.
This is deliberately conservative: a mutation elsewhere in a *single record*
containing a leased page is also rejected. When no lease exists, guards avoid
the additional map-record scan. Unrelated records remain usable. VirtualFree
returns zero with ERROR_INVALID_ADDRESS on rejection; host map-free preserves
mapped-view registration until successful release. The low fixed-stack path
also reports a failed release/decommit while leased.

Lock order is DLL mutex → virtual-map mutex in frame teardown; acquisition
only takes the virtual-map mutex after validating its owned live frame. Mapping
guards never acquire the DLL mutex, and mapped-view unregister acquires no
locks. The lease ledger's own arena cannot be released while leases exist.
Frame teardown restores CPU/segments before dropping its token's lease. A
future selector publication must revoke that selector before this drop.
Existing load_pe rejection on live frames prevents reset before any replacement.
No lock remains held across guest execution.

Retired cooperative and Worker stacks retain their `stackAlloc`, handle record
and scheduler slot when map-free fails. Slot allocation retries retired frees;
closing a duplicate guest handle does not delete scheduler ownership. Heap
fallbacks were never in `stackAlloc` and remain outside this mapping lease.

Pure retirement/planner checks (including an original-source negative control),
touched-source parens, logical-AND, test-tier, JS syntax and diff checks pass.
The canonical build and native tests below passed after the coordinator's
exclusive runtime grant. Recovery commands, from this candidate checkout:

```sh
WA_TEST_WASM="$PWD/build/wine-assembly.wasm" node test/test-ne-stack-lease-candidate.js
WA_TEST_WASM="$PWD/build/wine-assembly.wasm" node test/test-ne-qt-ownership-candidate.js
node test/test-thread-send-scoped-loader.js
```

The first candidate executes real VirtualAlloc/VirtualFree IAT calls and covers
direct/sparse, late-island atomicity, decommit/recommit, unrelated allocations,
section metadata retention, constructed real split records, nested ownership,
stale tokens, table capacity, failed reset and successful cleanup/retry.
The scoped-loader regression compiles a small fixture and also passed during
the granted native lane.
No original game, browser, or QT execution is claimed.

Native validation evidence is retained at
`scratch/runs/20261018-outlaws-map-lease/` in the shared checkout. Build-1
rejected a raw guest-heap address in the new test; the test now derives it from
the region mirror. Build-2/3 exposed missing sparse-checkout build inputs
(Terminal.fon and two tracked generated toyvm bundles), materialized narrowly.
Build-4 passed all canonical gates and compilation within the original 180s
budget. WAT source is exactly commit `8c944b42b9b2166ea8da033b928caf59b71a6097`.

`native-1` passed all six sequential checks in 9.7 seconds: the lease candidate,
QT executable-target pin candidate, scoped-loader Worker retirement, existing
virtual-decommit-unmaps, virtual-map-split-commit and virtual-map-split-rollback.
An additional foreign-owner-ID bind/end/free rejection case passed in a focused
candidate rerun within the original 90s native budget. This changes the native
owner identity to exercise rejection; it is not a claim of simultaneous Worker
guest execution. All subprocesses exited zero; no disk/deadline kill occurred.
The earlier build failures remain retained separately.

Tested canonical module SHA-256:
`8694d56d8961a498594367ff165fa6c850f35161378b1c7edee56baea86dcc6f`.
Compatibility module:
`8ee46cf03d40802402efa69a8639c1f0f723527c38d66c40dbebd2d9c1fe83ea`.
Region mirror (unchanged):
`8a27d3ea0da7fbfcb6f96c91ef590a2a20a568a68aa068594322026b3b203478`;
compiler layout hash `a44784ce3c83726a`. Final free disk was 2,417,893,376 bytes,
above the strict 2GiB floor. PID postflight found no surviving owned build/test
processes. Build outputs stay in the isolated checkout; this note and the
runner/command receipts provide recovery if ignored artifacts are lost.

## QT gateway source candidate (2026-10-18)

Task branch `task/outlaws-qt-gateway-oct18`, WAT checkpoint
`4da5ed1de3065cd3d9cb17bf4552075f587747db`, test follow-up
`77d4a0a31c5bb18233e40bcfadb8cf915673b3a6`, implements the gateway candidate.
It remains off main pending canonical build, native execution and review.
No QT execution or original-payload compatibility is claimed here.

The native frame acquires its scope, executable target pin and mapping lease
before replacing its first owned selector with the original aligned stack
window. Incoming EBP becomes its offset in that window; arguments stay at S+4.
The far continuation replaces the DWORD at S, which frame teardown restores
before releasing backing. BP-relative scratch modifications are already visible
in the original stack; there is no copied-stack fallback or copyback overwrite.
Entry DS/ES/FS/GS are zero, DI/SI hold the old SS/FS low words and DX holds the
new SS. Unspecified high halves follow the documented preservation convention.

The QT return path accepts only the owned continuation and even final SP in
the range S+4 through B-0x3c. It preserves independent EAX/EDX/ECX and actual
RETF cleanup. The old strict LibEntry/WEP stack-word cleanup is unchanged.
Native settlement owns the completed frame, verifies the original request
serial, restores the CPU/segment/FP frame and return slot, then merges only
the successful outputs. Failure restores the suspended caller and leaves its
request parked. Worker and asynchronous invocation yields remain explicit errors.

The source candidate includes ordinary QT_Thunk GetProcAddress dispatch, but
must not be merged merely because pure tests pass. Pure driver cancellation,
planner, fixture/image, existing guest-service and touched source gates passed.
`test/test-ne-qt-gateway-candidate.js` is prepared, **not executed**: real PE
lookup/call, original BP scratch writes, callee-entry segment/DX checks, SI/DI
scratch observations, distinct full results, RETF 0/4/odd/overflow, trap/loop/
corrupt-return/cancellation, foreign-owner rejection, and complete saved-context
comparison on failure. Run both direct and sparse modes after a runtime grant:

```sh
bash tools/build.sh
WA_TEST_WASM="$PWD/build/wine-assembly.wasm" node test/test-ne-qt-gateway-candidate.js
WA_TEST_WASM="$PWD/build/wine-assembly.wasm" node test/test-ne-qt-gateway-candidate.js --sparse
WA_TEST_WASM="$PWD/build/wine-assembly.wasm" node test/test-ne-guest-lifecycle-candidate.js
WA_TEST_WASM="$PWD/build/wine-assembly.wasm" node test/test-ne-stack-lease-candidate.js
WA_TEST_WASM="$PWD/build/wine-assembly.wasm" node test/test-ne-qt-ownership-candidate.js
```

Prepared bounded runner: shared
`scratch/runs/20261018-outlaws-qt-gateway/run-bounded.js`. Proposed budgets are
180s for canonical build, 90s for sequential native tests, 64MiB incremental
disk use, admission at 2GiB+80MiB free, stop at 2GiB+16MiB, and 8MiB logs.
Build prerequisites omitted by the sparse checkout must be materialized
narrowly: `fonts/Terminal.fon` and the two tracked `docs/dos-corpus/live/toyvm*`
bundles. Cooperative scheduler execution, concurrent/nested native scenarios
and original PMPRO62F remain further validation work; prepared tests are not
evidence for those paths.

The first granted canonical build passed in 20.3s, producing module
`3f9aa27ee228fa6e450b7fecf7808d8041b72ed9bf2e948c00b9d219638814ee` from
the candidate above, with unchanged region mirror. Minimum observed free disk
was 2,306,793,472 bytes. Native attempts 1–3 failed **before gateway entry**:
the actual PE lifecycle loaded handle 257 and obtained NE target 0x270040,
but ordinary KERNEL32 GetProcAddress returned zero for QT_Thunk. The initial
test assertion was sharpened to identify the pre-entry failure rather than
assuming every interpreter slice must yield.

Source fix `4d27fdc7365112921c8078e34c5c01b7cdaec8b5` adds QT_Thunk to
`kernel32-exports.json` and regenerates the native image, which is the actual
KERNEL32 lookup authority. Generic API-table registration alone was insufficient.
Named ordinal 585 follows the manifest's emulator-ABI convention; it is not a
claim about Windows version-specific ordinal assignments. The generator's
positive/staleness/invalid-manifest pure checks pass. Follow-up
`fb34f1534e0671942fc6be83d2b62250231d077c` prepares `--cooperative` execution
through ThreadManager's production callback facade. Neither change has been
built or run natively yet: the original runtime budget expired. All failed
receipts remain in the run directory. A new epoch requires a fresh grant:

```sh
node /home/user/wine-assembly/scratch/runs/20261018-outlaws-qt-gateway/run-bounded.js build retry1-build-1 retry1-
node /home/user/wine-assembly/scratch/runs/20261018-outlaws-qt-gateway/run-bounded.js native retry1-native-1 retry1-
```

The native runner now includes `--cooperative`. Deeper callback traps and
nested reverse/lifecycle paths remain unvalidated; the frame teardown's sync
depth check can reject an unwind if a deeper callback fails to unwind itself.
Do not advertise those paths as supported based on the synchronous candidate.

## Granted native validation (2026-10-18, retry1)

After root's hash-verified disk cleanup, the fresh 120s canonical-build and
90s native grant completed. Canonical build passed in 19.2s with minimum
observed free disk 4,340,948,992 bytes. WAT is unchanged from `4d27fdc73`;
the build checkout was `cee09f851`. Tested fixture corrections are committed
as `62c2021e0bc0d4da40d89266cbe3c94d702ee818`.

All seven sequential checks in `retry1-native-3` passed within the original
90s retry1 native window: actual PE→NE QT direct, sparse and production
cooperative callback facade; existing guest lifecycle; stack mapping leases;
executable target pins; and concurrent native KERNEL32 export/image checks.
Each QT mode exercises arbitrary argument vectors, independent full results,
entry segment/DX/SI/DI observations, original BP scratch mutation, RETF zero,
normal and partial cleanup, odd/overflow rejection, trap/loop/corrupt-return
failure restoration, cancellation and complete CPU/flags/segment/FP snapshots.
The direct case also checks foreign-owner rejection. These are synthetic
conformance executions, not original PMPRO62F or Outlaws compatibility evidence.

Earlier retry1 receipts remain retained. Native attempt 1 stopped at the
partial-cleanup fixture: that case deliberately ended before its wrapper's
FreeLibrary16, then replaced the process with a different NE body at reused
addresses. The fixture now explicitly unloads that image before reuse; this
does not claim a general process-replacement/cache fix. Attempt 2 passed
direct and sparse, then the reused secondary instance carried a cancelled
yield18 into the next case. The test now clears yield at new-case startup,
after request cancellation. No production change was needed during retry1.

Canonical module SHA-256:
`f7c9f5c56e2b956659d135a7184fb06adde3372bbbf0674b8733db2c8344873d`.
Compatibility module:
`a26048cee7ad6a45d04c92ba3c4488aa1ba62c06fbbbc3e13a42051f8aeb42db`.
Region mirror remains
`8a27d3ea0da7fbfcb6f96c91ef590a2a20a568a68aa068594322026b3b203478`.
All logs, bounded process/deadline/disk receipts and the generated kernel
fixture are retained in `scratch/runs/20261018-outlaws-qt-gateway/`.
Postflight found no surviving owned build/test processes. Reverse thunks,
deeper nested callback traps, asynchronous yields and Worker QT remain outside
the validated synchronous scope. Integration and any original-payload trial
belong to the coordinator's next separately owned runtime step.
