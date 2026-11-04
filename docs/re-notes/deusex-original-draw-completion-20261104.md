# Original Deus Ex Draw completion and viewport/player boundary

The original DLL establishes the native return routes and the viewport/pawn
binding. It does **not** yet supply a capture-qualified owning render event.
`engineRender` and `viewportPlayer` remain null in production and in the new
read-only diagnostic. The remaining obstruction is specific: continuous
owning-instance execution/lifetime evidence and the original viewport's
binding to the selected live HWND/surface are absent. No host metadata
prerequisite was added.

Predecessors: [capture binding](deusex-engine-capture-binding-20261104.md),
published `1f738c1f544987378e1582c38fbbf1d3e5c1c2df`, and
[immutable endpoint](deusex-immutable-capture-endpoint-20261104.md).
Inspected/tested main base: `7bea5e70620c377923346e9ff47ca5f1768d0281`.
Evidence and executable diagnostic:
`scratch/runs/20261104-deusex-original-draw-completion/`.

## Original code and completion routes

The only binary input is the existing
`test/binaries/candidates/deus-ex-demo/installed/system/engine.dll`,
1,736,704 bytes, SHA-256
`3606d3177b4473d1a56405c3e0b372e44dfde475705460be8d68846f6d16a8d0`.
It was read in place, never copied. `audit.cjs` verifies that hash before
inspecting bytes, export thunks, vtable slots, MSVC exception metadata and
490 instructions of Draw. `draw-objdump.txt` independently corroborates its
branches and sole normal return. Disassembly outside Draw is explicitly
linear evidence; padding and neighboring functions are not extra Draw routes.

All addresses below are **preferred VAs**, image base `0x10300000`.
At runtime use `loadedEngineBase + (preferredVA - 0x10300000)`, with the
actual module load generation. Existing `host.js` moduleBases entries retain
`loadAddr`, `origBase`, `generation`; unregister removes matching generations.
A module generation is not a UObject allocation generation.

| Native point | Meaning from actual instructions |
| --- | --- |
| Export #898, `0x10303aad` | `jmp 0x1038e9e0`; entry only. Body takes engine in ECX, viewport at entry ESP+4 and return address at ESP. Four stack arguments, callee cleanup 16 bytes. |
| `0x1038ea19` | Branches directly to `0x1038efc9` if the imported global's dereferenced value is zero. No Lock/render required. |
| `0x1038ed6b` → `0x1038ed6e` | Calls viewport virtual slot +0x60, then tests returned EAX. Original UViewport vtable slot resolves to export Lock → `0x10372f90`. A subclass may override it. |
| `0x1038ed70` | EAX zero branches to `0x1038ef85`, skipping the entire locked render body and Unlock. It still returns normally. |
| `0x1038ed76`–`0x1038ef7f` | Nonzero-Lock path: scene creation, callbacks, optional world draw, post-render callbacks, scene finish, viewport Unlock, renderer tail call. Scene extent/console checks can omit the world draw at `0x1038eeb6`; this path is not proof of visible world/gameplay. |
| `0x1038ef77` → `0x1038ef7a` | Calls viewport slot +0x68 (base vtable resolves to Unlock → `0x103731a0`); landing observes that call returned. This alone precedes another renderer call at `0x1038ef7f`. |
| `0x1038ef82` | Landing after that final renderer call. Then common state restoration and a conditional renderer callback at `0x1038efc3` may still execute/throw. |
| `0x1038efc9`–`0x1038efd9` | Common epilogue restores FS:[0], saved registers, ESP/EBP, then the sole normal `ret 0x10`. The disabled path and failed-Lock path share it. |

A usable native return candidate requires the **same invocation** to have
nonzero Lock, returned Unlock, returned renderer tail, reached the common
epilogue, and reached the saved caller landing with ESP=entryESP+20 and
restored caller EBP. Merely counting hits at these addresses cannot associate
them with one invocation/thread. A shared epilogue hit cannot identify which
route ran. A callee return is also distinct from rendering backend/GPU/display
completion and from immutable host-canvas publication.

Draw installs handler `0x10420a10` through FS:[0]. It loads FuncInfo
`0x10446c50` and jumps through imported `__CxxFrameHandler`. The actual try map
contains two catch entries: typed handler `0x1038efdc` (type descriptor
`0x1047ae68`, object displacement -0x74), and catch-all `0x1038eff0`.
The typed handler calls `0x10413ee0` at `0x1038efeb`; the catch-all logs through
an import and calls the same thunk at `0x1038f007`. That thunk imports
`_CxxThrowException`; the catch-all passes two zero arguments (rethrow).
Neither handler contains a successful normal-return route. Faults/traps or
outward unwinding that bypass these catches must also invalidate an invocation;
absence of a catch hit is not proof that no exception occurred. This audit
identifies original code routes, not a live validation of emulated C++ EH.

## Actual viewport/player relation and lifetime

`UViewport` is a `UPlayer`, not a container for a separately guessed player
object. Original UViewport constructor export `0x103030f3` jumps to
`0x10372930`, whose call at `0x10372956` invokes UPlayer constructor export
`0x10301f7d`. Draw reads its pawn from `[viewport+0x30]` at `0x1038ea2e`.

Original `APlayerPawn::SetPlayer` export `0x10303837` jumps to `0x10368330`.
At `0x10368377`–`0x1036838d` it reads the previous pawn from `[player+0x30]`,
clears that pawn's `+0x5d0` and the player's `+0x30`, then writes
`[newPawn+0x5d0]=player` and `[player+0x30]=newPawn`.
Draw's local `[ebp-0x6c]` is a view actor passed by reference through an actor
callback at `0x1038ea80`; it may change. It must not silently replace the pawn
selected by the viewport or become an invented owning player identity.

The viewport constructor reads Outer at +0x18 and registers itself in
`Outer+0x2c`'s TArray. Original viewport Destroy `0x10372bd0` removes that exact
pointer from the Outer/client array (`0x10372d55`–`0x10372ddf`), then calls
UPlayer Destroy at `0x10372df9`. UPlayer Destroy body `0x103d84f0`, when its
global/pawn guards permit, clears `[pawn+0x5d0]`, invokes the actor-level
virtual destruction route and clears `[player+0x30]`. Conditional cleanup
means stale fields can survive; nonzero/readable memory is not liveness.

The diagnostic checks engine+0x44's client, viewport Outer, unique membership
in the client's bounded TArray, viewport pawn and reciprocal pawn+0x5d0.
These are measured pointer relations, not durable allocation identities.
Destruction/recreation at the same addresses with identical fields passes
snapshot checks: the tested ABA counterexample deliberately remains null.
A Core object-array slot/FName match alone would have the same problem.

Draw also writes a saved byte to **`[ebp+0xb]` at `0x1038eab1`**, overwriting
the high byte of its incoming viewport stack argument. A later raw
`[ebp+8]` read is not a trustworthy viewport pointer. Retain the entry value
and cross-check ESI on enabled-path checkpoints; the disabled early epilogue
has not loaded that ESI. The diagnostic tests both details.

## Concrete read-only diagnostic and discriminating tests

Run `node scratch/runs/20261104-deusex-original-draw-completion/test.cjs`.
`observer.cjs` exports `DrawDiagnostic`, `PC` and `BASE`. `sample(exports,
actualModuleRecord)` uses only register getters, `guest_to_wasm` and
`guest_read32`; it neither arms a breakpoint nor runs guest code, writes
memory, schedules timers, requests presentation or installs a Worker handler.
It is an offline-developed consumer for an owning execution-observation
callback, **not an installed live collector**. One diagnostic belongs to one
exports instance/thread context; mixed instances and changed module load
addresses/generations invalidate it. Reads fail closed on missing getters,
unmapped spans or unreasonable array bounds.

Statuses distinguish entry, missing player, foreign/removed viewport, stale
pawn backlink, lock failure, returned Unlock/tail, epilogue, observed return
pair, caught unwind and incomplete/unobserved unwind. Pointer observations
are separately labeled `pointers`. The render-path result is explicitly
`render-route-return-candidate-unverified-lifetime`;
`observedReturnPair` describes only its checkpoint pair. Every result has
`engineRender:null` and `viewportPlayer:null`, including the best candidate.
Ending observation without a matched return reports incomplete/unobserved
unwind; a Worker slice or repaint counter cannot complete it.

Tests pass **290 checks**: original-PE CFG reachability proves both bypass
routes reach the sole return and the locked body cannot normally reach it
without Unlock/tail; a small emulator executes four actual pinned SetPlayer
MOV instructions to demonstrate old-pawn detachment/new-pawn binding. Other
fixtures mock owning exports/memory, not native game execution. They cover
positive/negative relocation, zero Lock, both catches, no entry/partial
observations, changed stack/frame, stale membership/backlink, missing pawn,
unmapped memory, module reuse, foreign exports, corrupted stack argument,
and identical-address ABA. All candidate identities remain unqualified.
Four in-memory mutations inventing completion, ignoring pawn backlink,
blessing failed Lock or allowing mixed exports are rejected. No binary input
is patched or copied.

All ten existing `test/test-immutable-capture-endpoint.js` cases pass unchanged,
including private RGBA, actual selected stack/live-window checks, holds and
display failures. `flock /tmp/wine-build.lock bash tools/build.sh` passes.
No production/test files were edited. These checks do not qualify concurrent
unowned changes, browser/GPU rendering, full provenance or Deus Ex gameplay.

## Exact next live test and implementation boundary

Existing WASM `set_bp` observes a **basic-block entry before executing it**;
`--count` records address hit totals. `test/run.js` multi-address `--trace-at`
uses BATCH_SIZE=1 and logs main-instance register/stack observations. The
normal browser Worker `sliceDone` transport supplies no continuous successful
Draw checkpoint stream. Its ordinary return, fault registers and timers are
not a substitute. `ret` at `0x1038efd9` is inside the epilogue block: it is a
static instruction to inspect, **not** a promised count/breakpoint location.
The diagnostic can accept a finer-grained snapshot there, but does not require
one; common-epilogue → saved caller landing is the usable block-level pair.

For a separately authorized live test, keep the existing natural game flow
and pinned modules. In the actual owning instance resolve the body entry,
Lock-return, Unlock-return, renderer-tail-return, common epilogue and both
catch entries using its real module map. First use the existing passive count
slots to establish reachability only. Then, through the existing breakpoint
mechanism in that same instance, observe one natural entry and retain
ECX/ESP/EBP, saved return PC and original viewport. Advance the observation
checkpoint through Lock-return → Unlock-return → tail → epilogue → dynamic
saved caller landing. Forward normal execution; no guest call injection,
return simulation, guest writes, forced repaint or input. A failed Lock,
missing checkpoint, catch/trap, module change or bounded observation expiry
ends with null. With one WASM breakpoint, an alternate exception route may
only be detected as an incomplete trace; do not claim complete unwind coverage.
This experiment should first demonstrate an actual nonzero-Lock normal-return
candidate, or identify its first missing native checkpoint.

Promotion beyond that candidate needs an owning-Worker execution observer
with ordered register/stack records across branch/return/exception routes,
plus allocation/destruction/rebind evidence covering viewport and pawn lifetime
and a source-verified original platform-viewport HWND/surface relation. Probe
SetPlayer/Destroy and UObject allocation/free/GC paths, including slot/address
reuse and thread/module teardown; checking only the two endpoint snapshots
cannot prove continuity. Map the platform viewport subclass to the existing
host live-window identity, then correlate the actual completed source to the
immutable capture. Do not insert caller-provided generations/unknown IDs.
This is the missing mechanism, not another request-owner metadata field.
No safe verified completion is claimed until those observations exist.

Evidence records exact Git SHA, relevant binary diff, separate new-file
patches for the note and run helpers, commands/results, and SHA-256 manifest.
Git remains the source archive; no source archives/media/binary copies exist
in this run. No box was assigned (ID/state/expiry not applicable), queried,
allocated, resumed or stopped. No browser, heavy CLI/game runtime, lifecycle,
guest mutation, subworker, successor, deployment or Heroes II work occurred.
Coordinator runtime ownership is unchanged. This single task stops here.
