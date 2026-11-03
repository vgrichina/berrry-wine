# Protected service continuity: cold command-line allocator frontier

Protected continuity through the original `GetCommandLineA` service remains
unqualified. This audit retains the exact first cause and identifies the
allocator and bulk-writer continuation needed before changing admission.
No production admission is widened, and no opcode-only substitute is offered
for the complete pending-handler/arbitrary-writer/first-loss fixture.

Assigned input `5083f52e5d918569bdad41f0bf7233541a8802d4`, production
`440403b4c8ca83feacd14e2d2cb7655fdd0d0d29`. Evidence and executable recovery
recipe: `scratch/runs/20261103-jedi-protected-service-continuity/`.

## Exact first cause and unchanged evidence

The accepted canonical module is 2,126,016 bytes, SHA256
`a4945b9490d805b3f5528122b943b86d7460c38cddefeb7d863782d84b92a79c`.
Static verification compares 1,161 committed source/compiler/host/test paths
at the assigned input against the predecessor's accepted effective pins and
the current shared bytes. They match. No predecessor boat is used.

Unchanged original notepad bytes `ff 15 e0 63 40 00` at `0x4010d3` load the
actual import `GetCommandLineA`, API194, thunk `0x07500140`. The CALL commits
return `0x4010d9` at `0x074fffac`, then ends its protected slice. The following
protected service entry rejects in `run` before diagnostics/budgets/dispatch.
Accepted first/retry evidence preserves full512MiB and all2,277 mutable
globals, including CPU, lazyflags and vitals. This is unsupported service
admission; it is not an observed vital-writer failure.

Accepted unchanged regression evidence includes the locked full builds and
eleven focused suites, real thunk rejection, exact unarmed-frame restart,
58 CALL mapping/encoding controls, cold/ordinary-cache exclusions, callback
and export refusal, REP, PUSH, ALU, compiler closure, fault restart and normal
animation/render behavior. Those results are reused rather than rerun as new
qualification. Original `CMP AL,0x22` at `0x4010dd` remains a later decoder
frontier, not a replacement for repairing service continuity.

## Actual dispatch and service effects

`static-effects.json` records source hashes, direct callees, syntactic stores
and mutable-global writes for22 functions. It is a conservative effect census;
branches and same-value stores cannot be inferred from a final memory diff.

The full service boundary includes these dependencies:

- `run` has callback/animation/APC guards before thunk dispatch. Below them it
  changes attribution, budgets, cache/wakeup bookkeeping and thunk globals.
  A failed later preflight would already violate whole-entry rejection.
- `win32_dispatch` checks thunk metadata/patch records, reads the return slot,
  changes resource scope and handler depth, then restores/unpins resources.
  Deferred DLL draining can redirect control after the handler. Patch-record
  walking uses guest translations; it is not automatically a pure predicate.
- `win32_dispatch_inner` changes clock/spin/wait counters, synchronizes DirectX
  vtable globals when needed, handles abandoned critical-section state,
  records optional histogram edges, resolves metadata/name addresses and logs
  via host callbacks. It loads five stack arguments even for this zero-argument
  API, calls the generated real handler, restores nonvolatile registers and
  may call the exit hook. A zero-argument handler alone does not bound dispatch.
- `handle_GetCommandLineA` calls `store_fake_cmdline` when cold, then writes EAX
  and increments ESP by4. A warmed-only audit would omit the required cold path.
- `store_fake_cmdline` requests1,536 bytes from `heap_alloc`, immediately
  publishes the pointer in two globals, writes path/quoting/arguments through
  scalar stores and `memory.copy`, then builds argv/token/CRT cells through
  `store_fake_argv_a`. Neither function carries a restart phase/cursor.
- The aligned allocator request is1,544 bytes. It bypasses the small bins
  (maximum256) and the large-arena path (threshold0x7f000), but may walk/split
  the free list, move small leftovers into bins, unlink blocks and charge an
  arena. A recycled result additionally calls `guest_memset`; that helper
  explicitly rejects protected mode after earlier allocator mutations. A
  fresh bump can still reserve an arena, write a header, update the cursor
  and atomically change arena accounting. OOM paths can call host tracing.

Consequently, allowing API194 at the current two rejection sites is unsafe:
there can be guest stores or allocator mutations before a later rejection,
and an entire command-line/argv bulk write can commit between observations.
A run budget does not subdivide these native helper loops. Instrumenting only
`gs8/gs32` misses raw stores, `memory.copy`, allocator metadata and atomics.
Post-service sampling cannot reconstruct a first-loss state inside a service.

## Concrete implementation path

A safe implementation must retain the original frame and debugger arming for
the entire service. Before any effects, recognize and authenticate the exact
thunk/metadata/hook state; preflight all paths the chosen mode will execute,
including the unconditional five-argument stack reads and return mapping.
Unknown services, native markers, callbacks, patched or unaudited descriptors
must continue to reject with full first/retry memory/global equality.

Then provide persistent service phases for allocation and command-line/argv
construction. Start with a proven simple bump allocation if useful; reject
free-list/recycle/reserve/sparse/OOM states before any mutation until each has
an audited continuation. Do not allocate eagerly merely to warm the handler.
Preflight the bump header and arena-accounting destinations before committing
any of them, and represent every committed guest store/bulk element with a
resumable cursor. Preserve the existing pointer-publication order: the two command-line
globals are assigned immediately after allocation, before string/argv writes.
A private phase must distinguish this partially built state from a completed
warm command line, so retry does not skip construction merely because the
pointer is nonzero. Common
dispatch effects and host callbacks need their own audited phase or explicit
pre-effect exclusion, with no silent disarm/rearm.

An alternative whole-service fast path needs a proved complete write set,
including allocator/dispatch metadata, and physical alias exclusion against
**both** protected vitals. The current single watch address does not declare
the second vital or arbitrary controller observation set. Inferring that
health is adjacent to shield is not a general safety argument. Do not add an
API allowlist based only on a service name or a passing warmed invocation.

Acceptance must first traverse the original PE/import frame while continuously
armed, check the actual handler/allocation/string/argv effects, and halt at the
real return boundary before the next x86 instruction. It must also preserve
all memory/globals/CPU/lazyflags/vitals on initial and repeated unsupported
entry; repair a mapping and restart the exact retained frame without duplicate
allocation/cleanup; exercise unknown/native callbacks, cold/ordinary-cached
entries and first-loss before a forbidden subsequent service store. Only then
advance the complete native pending-handler/arbitrary-writer fixture and
original encounter steering. Existing CALL/REP/PUSH/ALU/export/compiler/fault/
host protections remain required.

## Result and lifecycle

This task stops at a genuine safety prerequisite: the cold allocator/service
has no resumable store phases, and this audit has not established a complete
safe service write set. No production repair is published. Removing the
existing service guards would admit effects before later rejection, so all
services remain rejected. The complete native fixture remains unqualified.

The optional `service-effects.cjs` diagnostic and compact pinned input package
are prepared and syntax checked, **not executed**. They would measure ordinary
cold-service memory/global deltas after an explicit diagnostic disarm; they
would not prove protected continuity or repair the missing phases. No new
native test, build or original-game execution occurred. The only new checks
are static source/input/module identity, the22-function effect census and
script syntax/document whitespace. Accepted unchanged native results above
are explicitly reused. This documentation-only change does not require a new
full build.

Alice retained the runtime slot throughout this task. No own boat was created,
used, resumed, stopped or handed off; no predecessor/foreign boat was queried.
The prepared diagnostic was not a reason to repeat an already accepted native
rejection. There are no production/test deltas to leave in the shared tree,
no deployment, subworker or successor. Local disk remained above2GB. Only the
owned note is published; recovery scripts, source pins, first preparation
failure and result stay in the ignored run. No gameplay or all-writer
qualification is claimed.

The continuation work is a production allocator/dispatcher change, not a
missing decoder case. Its minimum durable state is concrete:

| Phase | State retained across host entries | Required stop/retry boundary |
| --- | --- | --- |
| Entry preflight | No new mutable state until admission succeeds | Original thunk EIP, original CALL return slot and ESP; rejected first/retry identical |
| Bump allocation | Chosen arena/header, aligned need1,544, cursor and accounting phase | Before each header/accounting store; no duplicate reservation or charge |
| Pointer publication | Allocated pointer and original two-global assignment order | Never mistake a partially constructed buffer for the warm path |
| Raw command line | Quote/path/argument lengths, source/destination cursors | After each committed scalar/bulk element, before any subsequent write |
| ANSI argv | Path/token cursors, argc, quote state, pointer-table index | Same store boundary for token bytes, argv pointers, CRT cells and terminators |
| Return | Original frame, saved nonvolatiles and completed epilogue phase | Exactly one ESP cleanup and return EIP0x4010d9, before MOV ESI,EAX |

Each phase must retain source mappings and validate its next operation before
changing attribution, cache state, globals or memory. Mapping repair restarts
that exact phase; it must not replay the original CALL or an already committed
store. The free-list/recycled path specifically needs continuation before its
first link/header mutation and before `guest_memset`'s guarded bulk write.
This table describes required implementation, not an implemented candidate.
