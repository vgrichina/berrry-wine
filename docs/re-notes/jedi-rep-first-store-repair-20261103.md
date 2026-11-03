# Jedi REP first-store repair — candidate retained, not landed

**The exact REP MOVSD first-store fixture is repaired by a native element
boundary, but the candidate is not ready for production.** The required
fault-restart regression fails, and a direct native conversion API still writes
both vitals before returning. No production code is published.
`runtimeIntegration=false`, `readyForCampaign=false`,
`allWriterProtection=false`, `authenticJediExecution=false`.

Exact input: `20a45ddfe5f9832c534fa3bb381552d838f74297`. Evidence:
`scratch/runs/20261103-jedi-rep-first-store-repair/`. The
[predecessor](jedi-pinned-native-store-fixture-20261103.md) candidate was
**UNLANDED** and was reused as such. This task also leaves its candidate only
in the ignored run directory. Its three production files were restored and
verified byte-for-byte against the exact input before releasing ownership.

## Native repair and exact before/after proof

The retained candidate adds `set_rep_store_step(address)` alongside the
predecessor's instruction-watch mode. It clears decoded caches and disables
cross-instruction folding through that mode. The six threaded REP
MOVS/STOS handlers execute one mapped element through the scalar guest
accessors, update ECX/ESI/EDI, then force the current native block budget to
zero. With remaining ECX, they return without executing the instruction's
fallthrough terminator: EIP remains at the REP prefix. The final element runs
that terminator so EIP advances normally. Disarming restores the ordinary
bulk path. Flags are never synthesized or repaired.

This is cooperative native **element stepping**, not a native loss predicate
or an exhaustive store barrier. The exclusive fixture controller compares
both vitals after every element and revokes further entry on its first loss
or error. A nonloss element also returns to the controller. No later element
or guest instruction executes before that observation.

`recovery-verification.json` verifies that the complete 128-byte fixture is
identical to the predecessor's actual failing fixture:

```text
CALL handler
handler: REP MOVSD       ; ECX=2, source floats [80,90]
         INC EAX         ; forbidden
```

| Actual native observation | Before: retained instruction candidate | After: element candidate |
| --- | ---: | ---: |
| Shield | 80 | 80 |
| Health | **90, failure** | **100** |
| Remaining ECX | 0 | **1** |
| EIP | 4249742, after REP | **4249740, REP prefix** |
| EAX | 0 | 0 |
| Pending CALL return on stack | 4249713 | 4249713 |

The after case uses one actual `run(16)`, with no post-store guest writes.
The changed EIP is the architectural continuation for the uncompleted REP,
not a relaxed after-instruction expectation. `ESI=4253832`, `EDI=4253816`,
`ESP=4262004` retain the first iteration's progress and pending CALL.
The unchanged baseline CALL/store failure was reused rather than rerun.
The new scalar CALL/store fixture also passes: EAX0, EIP4249750 exactly,
shield80/health100, return4249713 still pending.

Actual candidate module: 2,090,311 bytes, SHA256
`4963b3352e0132cd7a024ecb889a642417f30ec777455886338be697f7fe2741`.
The compatibility module is also recovered. Candidate source, its complete
patch and source hashes are retained in `candidate-*` and
`candidate-pins.json`; none is installed on main.

## Supported scope and rejected paths

The native primitive covers mapped 32-bit-addressing threaded REP MOVSB/W/D
and STOSB/W/D, forward and backward. Each element reads its whole source
before writing and commits register progress once. Byte/word stores may
overlap a watched float; the controller compares the complete vital values.
Protection is between x86 elements, not between bytes inside one element.

The candidate rejects these specific unsupported entries before their own
writes while REP stepping is armed:

- `$guest_memmove` and `$guest_memset`.
- Direct calls to `$rep_movs_mem` and `$rep_stos_mem`, whose bulk signatures
  carry no architectural continuation.
- A REP element with any absent source/destination byte, or 16-bit code.
  A mapped-only debug rejection is not guest SEH fault/restart support.

Actual native tests exercise those four helpers, the native `memcpy`,
`memmove`, `memset`, and `RtlMoveMemory` handler wrappers, and absent source
and destination elements. All ten reject with destination and register state
preserved. The same eight bulk/helper entry shapes remain usable after
disarming. Test-only exports were appended to the owned string fragment in
the compiler VFS; production export/control files were not edited.

Inspection shows why these guards cannot establish all-writer protection.
Scalar `$gs8/16/32/64` are used by many interpreter and API paths, while REP
and CRT helpers also use `memory.copy`/`memory.fill`; other handlers and host
code write linear memory directly. Optimized-tier bulk fast paths, arbitrary
API callbacks, multi-store instructions, direct exported memory writers,
host typed-array writes and sibling instances are not covered by this REP
boundary. A guard at one shared helper does not protect an API's earlier
writes or a fast path that bypasses it. Production must reject unsupported
entries before running them, or supply a resumable store boundary there.

## Passing cases and first real blockers

Nineteen REP cases pass across the retained first suite's fourteen successes
and the remaining suite's five successes. They cover the exact failure,
MOVS/STOS widths1/2/4 in both directions, a nonloss iteration before loss,
overlapping watched bytes and destructive source/destination overlap.
They verify every later element remains uncommitted, ECX/index/EIP/stack
state, unchanged unrelated registers and lazy flags, frozen repeated
read-only snapshots, and revoked input/credits. A separately explicit
debugger release disarms the private fixture controller and resumes the
remaining REP without editing guest data. Guest PUSHFD immediately after
REP verifies flags; the following counter increments exactly once, including
after another run call.

Two harness failures remain intact. The first backward nonloss setup actually
targeted health first; it correctly latched health loss. The next attempt
collided with existing exclusive-create persistence filenames and correctly
reported persistence failure. Separate vital placement and unique filenames
fixed the harness. Assertions were preserved; the fourteen passing cases
were not repeated. These are recorded separately from the native blockers.

The predecessor's **29 native/controller cases are reused evidence, not new
passes on this module**. The fixture controller differs only in its arming
API. Its earliest-error retention, process/thread/generation rejection,
credit/input revocation, host-key release, read-only capture and persistence
failure behavior are retained. Its key acknowledgements concern fixture host
state, not production input delivery. Neither controller is installed in
production CLI/browser execution or owns an original game's input queue.

The locked full build passes, as do `test/test-dispatch-macro.js` (six checks)
and actual native `test/test-fused-entry-overlap.js` (two shapes).
**Required fault restart fails**, at the first selected case:

```text
w4/df0/destination/k3/cold/aligned/plain/mode3/threaded
actual guest handler calls: 5; required: 1
pre-REP marker: 2; required: 1
```

The complete log preserves the observed context and destination bytes. The
test explicitly labels its context as the last handler observation, not the
first. This run did not establish whether that unarmed-path failure predates
the candidate; no successful fault-restart qualification is claimed. The
actual failing fixture module was reconstructed without executing another
case and verified against its logged SHA256:
`d17b178d44b05e0b94c3e08bf9bcfe992217742d5344a9f5f00d14a994ee4849`.
Capture-only launcher mistakes are also retained; they did not rerun native
fixtures.

A separate, precise all-writer blocker is retained as exit2 in
`unsupported-api-first-failure.json`. With stepping armed, the existing
`test_wide_char_to_multi_byte` export reaches the same conversion helper as
the production API. Converting eight pinned UTF16 characters writes native
output bytes for floats80/90 over fixture floats100/100. It returns8 with
**shield80 and health90**, without rejecting the unsupported entry. Its
scalar-store loop has no resumable per-store stop. This direct API entry is
outside the exclusive adapter and proves that the native primitive alone
cannot enforce the requested all-writer contract.

Accordingly the next work is a fault/restart-safe continuation and an explicit
production entry/control contract covering or rejecting all remaining native,
API, host and scheduler writers. Native exceptions must remain inspectable,
with earliest latch, identity checks, credit revocation and failure persistence
preserved. Alice's concurrently owned CLI/thread-control work was not edited
or represented as qualification here. Original binding capture remains gated
on native stop and production control qualification; no original campaign,
handler/Kyle insertion, original guest damage write or screenshot occurred.

## Inputs, recovery and lifecycle

Before allocation, all43 ignored fixture-input members were checked for
existence, size and fullSHA, alongside cheap native host/compiler/pngjs/wabt
imports and the retained source/modules. The PE is the unchanged 53,248-byte
notepad fixture, SHA256
`e7b01ab85a35ba6f577067d13efa522dc3d605de7712340e4acaf7065f866340`.
The sealed source archive from8365c62 was reused: its runtime/test closure is
byte-identical to exact20a45dd, verified by Git comparison before allocation.
No foreign WIP was packaged. The boat verified every one of15,790 committed
source members and43 ignored inputs plus imports before building. Post-test
verification found only the three declared candidate source differences.
The extracted closure's absent Git history and offline Big5 check are explicit
in the full build log. No missing PE/dependency or prior packaging failure was
repeated.

Heavy work used only fresh boat `bx_ck4c9xe3`, finite TTL3600, original expiry
`2026-11-03T17:58:22.846Z`. Actual ID, expiry and original-task delegated normal
STOP were recorded before use. One full candidate build was used; focused
test modules were compiled separately. Native cases remained below60 and
each suite had a300-second outer bound. No original Jedi, browser, subworker,
foreign/predecessor boat/process, Claude pane, HeroesII/font lane, CACA003B
hold or deployment was touched. Local free disk remained above2GB.

Recovered archive: 6,948,168 bytes, SHA256
`0bc751d602409d7e45d84eaa334172b900427ff7ae6160268b2f6dbd6eaf4562`.
All125 payload sizes/fullSHA, candidate source, exact before/after fixture
bytes and43 runtime inputs were verified locally **before normal STOP**.
The archive includes full build/test/failure logs, all candidate and focused
modules, every fixture/script version, persisted latches, source/input pins
and the runtime PE/dependencies. The reused full source/input archives,
baseline modules and29-case evidence remain locally pinned in
`reused-evidence.json`. Recovery instructions and lifecycle/publication records
are in the run's `RECOVERY.md`, `result.json`, `final.txt`, and `SHA256SUMS`.

Normal STOP `stop_89c63f75908c1b5f` completed with `error:null`, `forced:false`.
The boat is **STOPPED** at `2026-11-03T17:11:00.658Z`; its snapshot completed
and was verified at `2026-11-03T17:11:00.504Z`. All nine owned supervisor PIDs
were absent before stopping. Custody returns to the coordinator; original
expiry remains recorded above, although the stopped boat has no active expiry.

No ready production code exists in this result. Only this note is published.
The final AUTHOR RELEASE is recorded in the run and messageboard. Single task
ends here, with no successor.
