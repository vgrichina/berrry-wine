# Current Quake III browser startup, world and control boundary — 2026-11-08

The current module naturally reaches the native menu on both actual SoftwareGL
and WebGL, and reaches the textured Q3DM1 world on SoftwareGL. The sweep's gray
frame at 20 seconds was an incomplete startup observation. This run does **not**
complete paired movement/fire/torch acceptance. The concrete WebGL blocker is
the run observer's readiness predicate, not an observed emulator startup failure.
Evidence is retained in `scratch/runs/20261108-q3-current-browser-world/`.

## Inputs and provenance

The staged checkout is `44aca66a0c16ee9a002cb923228dcfbb7ca7cabd`; the relevant
tracked runtime diff is empty. `relevant-source.patch`, the untracked
`lib/wininit-boot.js` new-file patch, `owned-helpers.patch`, helper pins and three
runtime pin versions retain the exact inputs. Git remains the source archive.
No emulator, acquisition, guest config, clock or tick code was edited. The
guest's ordinary generated config is observed, never replaced or executed as
an injected command.

The standard module is 2,182,500 bytes, SHA-256
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
The accepted Nov 7 firing/torch run used `e415…`; its gameplay is not current
coverage. Both current source selectors are present in every original launch:
`gl-renderer` and `d3d-renderer`. Actual contexts and draws determine the results
below.

The complete existing registered `quake3_demo` closure was reused. There are
916 staged runtime/helper/media pins. The unchanged PK3 at
`test/binaries/candidates/quake-3-arena-demo-installer/installed/demoq3/pak0.pk3`
is 46,853,694 bytes, SHA-256
`e77abad2466f45a0a7ea018445528f9b95a0fe7789fa1abc1a7718bbf0754b08`.
The accepted 90-chunk, 524,288-byte transfer recipe verifies every chunk,
assembles once, independently rereads the full file and removes temporary
chunks. No source or media archive was created; media remains path/hash
references.

## Natural startup and actual renderers

One fresh UUID-keyed box runs the heavy browser sessions serially. The first
software session bound its input identity to the initial GL endpoint too early.
At 02:58:29 its reviewed frame is gray. By 02:59:20 raw diagnostics show a
resident full PK3, no pending VFS read or read fault, changing guest EIP, 108,888
GL batches including 108,648 software-front batches, and presentation sequence
248. Q3 has created a later legacy endpoint for its software producer. The
early binding cannot authorize input after that owner transition.

No guest input was sent in this first session. Its exact quit ACK precedes
normal Chrome exit; controller/Chrome PIDs, ports and profile are verified gone
before the second software session. The run observer is changed to wait for a
live producer with triangles before binding. This is a harness correction,
not an emulator fix or an original failure reproduced and repaired.

The second software session launches at 03:00:29.688 and its personally reviewed
menu is captured at 03:00:59.478–59.826. A short raw observation at 03:00:51
shows PK3 seek positions, guest EIP `0x42cea6`, software flag 1, a real software
GL context, and advancing software-front batches. The initial native GL
endpoint and the later legacy producer are retained rather than relabelled.
`FixedFunctionGL`, context `software=true`, software-front execution, CPU
triangle counts and advancing presentation sequence establish SoftwareGL;
the D3DIM software-draw counter is zero and is not used as a GL draw counter.

Native menus retain Q3DM1: Arena Gate. All eight level-menu tabs toward Fight
are individually acknowledged and reviewed. The initial Tab selected
Multiplayer instead of Single Player; Escape and Up correct that ordinary
menu selection. Additional difficulty focus corrections are retained; no
console, map injection, private state or pause/freeze control is used.

After Fight, bounded ten-second passive commands show these distinct phases:

| Capture time, UTC | Personally reviewed checkpoint |
| --- | --- |
| 03:05:07 | Connecting to localhost, awaiting connection |
| 03:05:43 | Loading Q3DM1, `maps/q3dm1.bsp`, Arena Gate / Single Player |
| 03:06:00 | Loading `cells` |
| 03:06:19 | Textured courtyard, weapon, HUD ammo 100 and health 122 |

Raw diagnostics also retain changing PK3 seeks, guest registers/code/stack,
no pending/faulted VFS read, GL triangle progression and zero fallback.
This is natural load progression, not a frozen 20-second screenshot accepted
as gameplay. The strict capture chain rereads actual CPU and render module
bytes and maintains process/Worker/module/epoch/context/canvas continuity;
both owning module hashes are the current `f965…` module in these software
captures.

## Actions that remain unproved

The acknowledged 1,200 ms MouseLeft action produces `first-fire.png` at
03:06:34 with ammo still 100 and health 66. Its camera differs from the first
world frame. It is **not** accepted as firing or ammo consumption. A subsequent
1,800 ms W hold ends at 03:06:52 on “Fragged by Major”; that frame is not proof
of forward movement. A separate 150 ms native click at the death screen does
not produce a reviewed respawn. The first failed gameplay acceptance boundary
is therefore the ammo-unchanged mouse action, followed by death; this run does
not causally isolate guest mouse delivery or simulation polling. Turn and
torch observations are skipped. No bot-damage or mouse implementation defect
is inferred from these narrow observations.

An Enter respawn request at 03:07:32 is rejected before queueing because its
50-second ACK plus cleanup reserve cannot fit the immutable browser cap.
`deadline-refusal-proof.json` proves no command file, ID file, transport failure
or driver command failure exists for that request. The initial conservative
local “stop” marker and its exact zero-effect correction are both retained.
There is no replay. The 25 software commands have 25 exact ACKs; all admitted
holds use independent release. Final raw state has empty input queue, all
observed physical/async keys up, and mouse button mask zero. Chrome closes
normally at its unchanged 03:08:30 cap.

## WebGL observer blocker and skipped arm

After full software drain, WebGL launches at 03:09:02.530. The actual context
is non-software WebGL 1.0 Chromium, supplied by ANGLE Vulkan SwiftShader
Subzero. It is browser WebGL, not native llvmpipe or an Intel/Mesa claim.
At 03:10:12 raw owning-renderer evidence shows **169,864 GL batches, zero
software batches and presentation sequence 291**, with no endpoint failure.
The guest's generated config contains `bind w "+forward"` and
`bind MOUSE1 "+attack"`. The exact current standard module is recovered from
instantiated Worker bytecode. Unlike the strict software capture chain, the
WebGL observer never writes a completed per-owner module identity binding;
the retained module file alone is not claimed as two independent owner proofs.

The personally reviewed composited menu at 03:11:17 shows Quake III's native
Single Player/Multiplayer/Setup/Demos/Cinematics/Exit screen. Page owner fields
are bracketed across capture. The guest and renderer are progressing, but the
driver is still inside its run-specific producer readiness loop:

```js
stats?.ready && stats.glTriangles > 0 &&
stats.renderEndpointId === a.renderEndpoint
```

For this WebGL GL endpoint, the page reports `d3dStats: {}`. The software-only
counter predicate is false despite the real context, GL batches, presentation
and visible menu. This is the precise causal boundary preventing the current
driver from reaching `chain.establishReady` and its numbered input consumer.
It is an observer error introduced by the software startup correction, not
evidence that Q3's menu fails to load. No WebGL gameplay command is queued.
WebGL Q3DM1 world, movement, turn, firing/ammo and torch are explicitly skipped.
No second WebGL launch or replacement harness is attempted to disguise it.

Explicit `Browser.close` succeeds at 03:12:20; Chrome exits zero. The next
passive readiness poll reports `CDP UNKNOWN Runtime.evaluate` at 03:12:41 after
the intentional shutdown. This observer-after-close error is retained. Input
is closed and no further backend or input follows. There is no UNKNOWN guest
input ACK or unclassified escaped guest trap in the admitted stream.

## Validation and lifecycle

Run-specific W/arrows/menu controls pass independent release under a deliberately
slow sampler; UNKNOWN key and mouse controls prove their up events still run.
JavaScript syntax checks pass. Terminal audit checks all three Chrome exits
zero, all six process identities gone, six ports closed, profiles/writers
absent and all 916 final remote pins unchanged. No emulator source changes
are made, so no new build or failing-before/passing-after emulator regression
is claimed.

All 28 retained PNGs pass chunk CRC and IDAT decoding. All 510 successful full
HTTP reads match staged size/hash pins, and all 388 recovered artifact
references (351 unique hashes) are independently reread before the stop request.
The repository evidence checker retains seven unrelated containment errors;
it is not reported as a clean global gate. This run's metadata references only
its own retained artifacts.

The independently supervised 25-minute watchdog is armed before allocation.
The sole box is `bx_7hpx2hvn`, allocated at 02:57:27.316 with initial expiry
03:22:27.174 and watchdog deadline 03:22:26.948. After independent retrieval
verification, normal stop archives the box at **03:14:52.503**. Final expiry is
null. Receipt **`stop_bfb52f0a4e483c8f`** completes at **03:14:52.522**,
`forced=false`. Normal and watchdog delegates exit zero; the supervisor has no
remaining children. Local free `/home` space remains above 5 GB. No RAM gate, resume,
delete, source/media archive or public deployment is used.

Next work should make the existing readiness observer recognize active native
GL ownership as well as the software producer, then verify original controls
with trusted button delivery and actual simulation progress before claiming
ammo, movement, turn or a torch view. This run establishes current software
world and both menus; it establishes neither paired gameplay nor parity,
FPS, audio, full playability or full27 completion.
