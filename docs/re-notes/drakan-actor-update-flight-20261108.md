# Drakan: actor-update boundary located; passive observer prerequisite unresolved

No new original was launched and sustained flight remains open. Local inspection locates the simulation dispatch after the buffered drain, but the available EIP trace changes the accepted emulator's execution policy. The observer prerequisite therefore did not pass. No production defect or repair is claimed, and the ineffective T-only attempt was not repeated.

Evidence is in `scratch/runs/20261108-drakan-actor-update-flight/`. This follows the accepted [separate-drain ascent](drakan-buffered-ascent-20261108.md) (`cc6a14236`) and [same-drain cancellation observation](drakan-sustained-flight-20261108.md) (`4ea03045c`). Their conclusions are retained: the latter original's T-down timestamp249363 proves its handler ran; cancellation before integration remains an inference, not a dynamically observed actor update.

## Installed-media boundary

`check-static-boundary.cjs` passes against both installed files and their accepted media SHA256 pins. It independently rechecks the historical live snapshot: all8192 callback bytes match after PE relocations, all576 EXE drain bytes match, the object handler is `dragon.rfl+0x4b320`, and the actor vtable is `+0x150b20`. Actor `+0x58` links back to that object, `+0x70` is1 and ascent word `+0x78` is0. These are historical identity facts from the previous stopped original; they are **not fresh samples** for another action.

The following addresses are preferred EXE/RFL addresses. RFL preferred base is `0x10000000`; its historical live base was `0x713000`. A fresh owner must establish its own base and compare relocated live bytes before using these addresses.

| Stage | Installed code | What it establishes |
| --- | --- | --- |
| Buffered drain | EXE `0x407a95` calls `0x405770`, returns at `0x407a9a` | Returned records are dispatched inside the drain before this return. |
| Simulation admission | `0x407a9a..0x407ab3` | Requires `[0x476fd0]&4`, clear `[0x47b710]&1`, and nonzero `[0x476fe0]`. |
| Simulation call | `0x407aba` calls `0x40a090` with root `0x47b490` | This is the relevant post-input simulation, rather than the earlier interface callback. |
| Object dispatch | `0x40a127`, `0x40a172` | Both call object `+0xa8` with event4, from root list/count pairs `+0x230/+0x238` and `+0x23c/+0x244`; objects flagged `0x80000000` are skipped. |
| Historical actor handler | RFL `0x1004b320`, event4 table target `0x1004b369` | Loads actor from object `+0xa0`, then calls `0x1004c310` at `0x1004b36b`. Return site is `0x1004b370`. |
| Actor state selection | `0x1004c49c..0x1004c4b7` | Actor `+0x70 == 1` calls `0x1004da10` at `0x1004c4a9`, returns at `0x1004c4ae`; state0 selects `0x1004c510`. |

`0x1004c310` can return early: actor `+0x4fc`, network ownership, object flags and actor `+0x64` affect its path. Observing the outer return alone does not establish that the state1 body ran. The state1 body has a common epilogue `0x1004e6dc..0x1004e6f4`. These are candidates for a future observer's entry/return correlation, not proof of executed physics or flight in this task.

Several tempting signals are insufficient:

- GetDeviceData return `0x405868` precedes the original callback dispatch and actor update.
- Global `0x47acd8` increments at `0x40a0fe` **before** either actor list dispatches. A changed counter is not a completed actor update.
- `0x407abf` is reached both after the simulation call and when `[0x476fe0]` skips it.
- A later frame, render call, or clear ascent bit alone does not identify this actor's completed update or establish down was active during it.

The result JSON retains installed-byte hashes for the frame guards, event4 dispatches, dispatch tables, actor step and state1 body. Those newly located live ranges have not been verified in a fresh original; their `liveBytesVerified` fields deliberately remain false.

## Newly demonstrated observer limitation

Under `wine-runtime.lock`, `check-exact-observer.cjs` instantiates the accepted2182663-byte module with SHA256 `6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`, from the published `979e342930c4201f231533d3d492babdec778960` closure. It does not load or run a guest, write guest memory, poll input, or call a game handler.

The exact module's `get_dbg_tier_guard()` reads0 initially,1 after `set_trace_eip_range(1,0x600001,0x600000)` (an empty interval), and0 after disarming. Thus even an EIP observer that can never emit a row changes execution policy. Inspection of `dbg_recompute` explains the change: EIP tracing sets both the per-block desk guard and the tier guard, preventing ordinary chained/micro-op loop execution. The test directly measures the exported tier guard; the desk-guard explanation is source inspection, not an independently exported measurement.

This does not prove a Win32 divergence, a timing regression, or that all future passive observers are impossible. It does show that the existing trace cannot simply be described as a qualified, zero-policy-change natural-boundary observer. No trace was armed in a game. The earlier import-forwarding controls remain useful evidence for their existing input observer, but they do not qualify an actor-completion observer: that import is upstream of callback dispatch and simulation. No new claim of receiver/argument/return/exception preservation for an actor observer is made.

The concrete blocker is still the required **locally qualified passive completion signal**. It must correlate this owner's original drain, actor/state1 entry and completed return, while retaining down-active evidence before the independent2000ms release. Matching only an input consume or a pre-dispatch frame counter would leave the original limitation intact. Owner/module/freshness/sticky-UNKNOWN negatives and exact-once forwarding need to pass for that actual observer before allocation. Calling an extra clock/input export to force progress or using a breakpoint/private handler is not a substitute.

## Disposition and recovery

Only this note is committed; no production source changes or full build claim. Local exact-module guard assertions, installed-media hashes, four direct call edges, both event4 dispatch encodings, table selection, actor-state selection, and the historical relocated callback/drain comparisons pass. The ignored run retains the scripts, targeted disassemblies, raw test output, JSON results, Git identity and relevant binary diff. There is no source/media archive; media and the prior unique module are referenced at their existing paths and hashes.

Box ID/state/expiry/stop receipt: **not allocated / not applicable / not applicable / not applicable**. No watchdog or remote runtime was started because the preallocation gate failed. The local qualification process exited0 and released its runtime lock. No old box was resumed or deleted, no new gameplay input was sent, and no public deployment or subworker was used.

Next work is local observer qualification against the explicit boundaries above. Only after that passes should a fresh original receive the single T<=2000ms attempt with independent release. A missed deadline ends that attempt without replay or lengthening; Up and button-free mouse heading remain conditional on reviewed takeoff. Sustained flight, visible translation, worldZ, full27/parity/audio/FPS and publication Join remain open.
