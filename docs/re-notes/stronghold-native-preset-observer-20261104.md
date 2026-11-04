# Stronghold native preset observer, 2026-11-04

`tools/stronghold-native-preset-observer.cjs` supplies a bounded, read-only
owning-Worker import observer and a pre-instantiation installer for a subsequent
fresh original run. It does not run the game, arm diagnostics, submit inputs,
change the route or classify readiness. The previous failed command19 remains
closed. This work used no Chrome, remote API, box, lifecycle operation or Start.

The dependency is [the original post-preset diagnosis](stronghold-post-preset-readiness-20261104.md)
at `ee482bd91a4df63a12e9bf6d02158b201a8e66b7`. That diagnosis remains valid:
description changes do not prove activation or settings application.

## Observation contract

The installer hooks the original `WebAssembly.instantiate` before the shipped
`lib/guest-worker.js` instantiates its received `init` Module. It returns the
original instance and result shape unchanged. It accepts exactly one slot-0
Module and an exact Worker URL; replacement ends observation. Child slots,
unbound Modules and wrong URLs do not become qualifying owners. The observer
wraps only the existing `host.log_block` import, preserving its normal arguments,
receiver, result and exceptions. No WASM export is replaced or executed by the
observer. In particular it never calls `run`, enables instruction watching,
changes a breakpoint, writes guest memory or restores CPU state.

The caller owns the existing `set_trace_esp` diagnostic. It must enable native
block delivery across the observed interval, including dynamic saved-return
PCs. The existing narrow `0x430e10..0x430f15` trace from the old run cannot supply
this preset history. Registering an import wrapper **after** instantiation does
not instrument the already-bound WASM import. `check()` rejects an observation
with no delivered blocks. No delivered entry means no entry evidence; it never
creates a callback hit from a screenshot, an ACK or a PC requested by the host.

Each relevant delivered block records native PC, ESP, thread, command/event
annotation, `[69165c]`, `[690f7c]`, `[69332c]`, `[1681318]`, and native mouse
`+34/+40/+4c`. Hover, activation, updater and application entries include their
actual stack argument and saved caller; paired returns require the saved PC and
C-calling-convention ESP. These are observed intervals, not certification of
every CALL/RET instruction or exception unwind. Application requires preceding
updater and application-call history. Orphan decision/queue/return boundaries,
wrong owning exports/thread/loader, changed pinned bytes and missing return
stack history terminate the observer with an error and retained pending frames.

Original PE identity is pinned to the existing file:

`test/binaries/candidates/stronghold-crusader-demo/installed/App_Executables/Stronghold Crusader multiplayer demo.exe`

SHA-256 `9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f`.
The test derives VA-to-file offsets from PE sections, verifies every code pin,
and verifies the relocation directory is absent. This main PE loads at
`0x400000`; another base is unsupported, not a qualified relocation variant.
At start and relevant native blocks the observer checks loaded headers and
original instruction bytes. The WASM SHA is an **external compile/send pin**:
the installer cannot hash a transferred `WebAssembly.Module`. The fresh run
must prove its original page-to-Worker Module binding before arming.

## Mandatory native blocks

The observer reuses the existing native instruction-block import plumbing; it
does not split `run(n)` into different grants. The original branch and call
boundaries prevent an entire quantum hiding the decisive transition:

| Transition | Pinned original path and delivered boundaries |
| --- | --- |
| Description | `42d850` entry, conditional branch to `42d862` store, saved caller return; no activation inferred |
| Queue choice 1 | activation entry `42d880`, choice branch `42d9de`, reset return `42d9e3`; original contiguous queue stores before the call to `46cbe0`; read queued state at that callee entry |
| Clear activation edge | reset/UI-helper return block `42da62` contains the `42da71` clear before native return; saved activation return carries after-state |
| Pending/native edge gate | updater `42db40`, branch fallthrough `42db53`, nonzero-edge fallthrough `42db5b`, helper return/recheck `42db68` |
| Application | call block `42db71`, actual `42e490` entry, saved return `42db77`, subsequent clear/join `42db87` |
| Mouse edge | original compare/store fragment `468b39`, changed-held branch `468b49`, newly-held fallthrough `468b50`, join `468b58`; snapshots retain current/prior held state |

Some straight-line addresses can be interior to a predecessor block on another
arrival. They are not individually claimed as universal callbacks. The decisive
branch/call successors and the paired post-state are the required evidence.
With trace enabled, the actual 64-block updater tests deliver the native edge
decision, application entry and return within one ordinary Worker grant.

Limits are positive safe integers: default/max observation duration 10 seconds,
default 1,000,000/max 2,000,000 delivered boundaries, default 2048/max 4096
records, eight pending frames and 4096 characters per annotation. The duration
begins at `start()`, so startup does not consume it; the supplied original live
deadline always wins. An idle timer also expires observation without needing
another guest event. Terminal observations cannot restart. A failed command,
missing history, lost Module, byte mismatch, deadline or capacity stop preserves
partial evidence, including pending native frames. No absence, eventual
application or successful readiness is inferred at a stop.

## Offline execution and parity

Run `node test/test-stronghold-native-preset-observer.js`. Optional
`STRONGHOLD_OBSERVER_RESULT=PATH` writes detailed JSON. Evidence lives in
`scratch/runs/20261104-stronghold-native-preset-observer/`.

The test uses actual shipped `lib/guest-worker.js`, ordinary queued slice
commands, brokered imports, both `wine-assembly.wasm` and
`wine-assembly.compat.wasm`, and the actual loaded original PE. The actual
pre-instantiation installer is exercised. A stable test-only import router
allows fresh failure controls after the parity snapshots; every native callback
comes from WASM execution, never a hand-call to `log_block`.
Each arm records the SHA-256 of the exact Worker source compiled into its Node
module and rejects source drift between controls. The final shared-tree Worker
includes a peer's optional cache-observer registration with that option absent;
its relevant uncommitted patch is retained, not committed by this worker.

Synthetic caller, stack and initial globals exercise rejected/accepted hover,
two rejected activation gates, updater pending-without-edge, updater with an
unsupported application argument 4 and its return, native new-edge/held-edge
mouse fragments, and original choice-1 entry/reset/queue. The latter stops
at its UI text helper; this fixture does not initialize gameplay UI assets. An
exploratory 2048-block grant did not complete that callback and is not proof of
an infinite stall or its cause. The bounded fixture retains its pending
activation frame is retained: this does **not** prove activation completion,
edge clearing, original choice-1 settings application or opponent addition.
DOWN/UP drainage and capture digest annotations in this fixture are explicitly
synthetic controls, not original DOM consumption or captures.

There are two distinct controls. Against a trace-armed **no-observer** Worker,
all 512 MB, register/lazy-flag state, returned block counts, queued slice
commands and trap behavior match. Against an ordinary **untraced no-observer**
Worker, every 64 KiB page matches except the first `THREAD_RPC` page at the
generated region-map base. That page contains the additional normal diagnostic
log-import traffic. Registers, flags, counts, slice commands, guest memory and
traps still match. Whole-memory equality against the untraced control is
therefore explicitly **false**; total RPC command traffic also differs. The
observer itself adds no RPC calls; the expanded diagnostic does. Frozen guest
timing and the original command/deadline limits must remain in force, because
diagnostic wall-clock overhead can exhaust them.

Negative controls cover original-byte/loader/thread/instance mismatches, wrong
Worker/media identity, missing trace, missing application history, command
history, active and idle deadline expiry, record/boundary limits and attempted
restart after failure. Original fragment tests are not original gameplay.

## Recipe for the coordinator's next fresh original attempt

1. Keep the closed run untouched. Make a separately authorized fresh entrypoint
   using the existing route/run helper dependency closure, its original PE/media
   pins and exact reviewed route. Do not weaken the recognizer or repeat an
   activation. Preserve navigation 16384, route 4096, arrival 3072, stability
   768, per-ACK 64, command 40s and original browser 360s bounds.
2. At the existing paused Worker preload injection in
   `20261104-stronghold-setup-preset-native-world/successor-driver.cjs` (before
   `Runtime.runIfWaitingForDebugger`), retain `observe-browser.js`, load this
   tool's UMD source, and install it in the exact owning Worker. Replace the
   former choose-callback preload for this fresh observer window; its separate
   arming would overwrite the trace range. No production helper edit or new
   worker allocation is performed by this offline artifact.

   ```js
   globalThis.__strongholdPreset = StrongholdNativePresetObserver.installPreload({
     expectedWorkerURL: EXACT_TARGET_URL,
     exeSha256: ORIGINAL_PE_SHA256,
     wasmSha256: VERIFIED_COMPILED_AND_SENT_MODULE_SHA256,
     deadlineEpochMs: ORIGINAL_BROWSER_DEADLINE
   });
   ```

3. Before the one preset command, verify one installed slot-0 instance, exact
   Worker URL/target/session, thread 1, original served-byte closure and the
   page's original compile/sent-module evidence for this owning Worker. A
   missing/ambiguous binding is a stop, not permission to supply a guessed pin.
   Following the separately reviewed hover, under the same frozen boundary,
   obtain `entry = __strongholdPreset.entries[0]`, call
   `__strongholdPreset.start()`, and require `status === 'running'`. The caller
   may then use the existing diagnostic export
   `entry.getExports().set_trace_esp(1, 0, 0)` for this bounded window. This
   changes private trace configuration, not guest registers or memory. Do not
   enable API logging or instruction-watch mode. Preserve the original trace
   configuration separately if needed; this observer never guesses/restores it.
4. Annotate `{command: ID, kind:'begin'}` before the original balanced gesture.
   Attach `DOWN-enqueued`, `DOWN-consumed`, `UP-enqueued`, `UP-consumed` only at
   their existing event/explicit-drainage boundaries. Include original ACK
   sequence/step evidence in `ACK` annotations and the actual sealed PNG digest
   in `capture`. These annotations correlate two sources; they never manufacture
   native hits or prove application. No extra input, step, ACK, wait or capture
   is authorized by the observer. Use `check()` at the existing post-ACK
   boundary and require the observer still running; expired or missing delivery
   must stop the observation/attempt truthfully within the original bounds.
5. On first failed command annotate `failed` and persist the report, even when
   it has pending frames. On success require the original recognizer's exact
   ready result and balanced consumption before annotating `success`. Stop and
   collect reports on command failure, detach, loader activity, trap, lost
   instance or deadline. Disable the caller-owned trace on terminal collection;
   never resume a stopped observer. Do not execute Start. Hand lifecycle back
   to the coordinator.

The remaining qualification is this attachment under a fresh original gameplay
run, including actual DOWN/UP consumption/captures and completed choice-1
activation/application. No bound on gameplay convergence is established here.
If strict equality of all private RPC memory/traffic with diagnostics disabled
is required, the existing trace import is an exact demonstrated prerequisite
gap; this worker has not changed production logging to hide it.

Validation includes the focused test and serialized full build. Git SHA and
owned binary/new-file patches are retained in the run; Git is the source
archive. No source snapshots, media or module evidence copies were made. No
box was assigned (ID/state/expiry not applicable); lifecycle remains with the
coordinator. STOP after publication.
