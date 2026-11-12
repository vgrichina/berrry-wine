# Current Uplink living controls and elevator consequence — 2026-11-12

Run: `scratch/runs/20261112-halflife-current-paired-onward-1220/`.

Current module `04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`
reaches textured, living original Uplink gameplay through both SoftwareGL and
WebGL. Both cases show health100/armour0, native forward movement, strafing,
turning, stair navigation, and the scientist moving to the console. WebGL then
uses the elevator call button, enters the elevator, uses its interior button,
passes native **LOADING…**, arrives at a distinct red-lit crate bay, and makes
fresh forward movement out of the elevator. Health remains100. This is current
onward play, with full reviewed before/after frames, rather than menu acceptance.

## Original game and recovery choice

The registered app is `halflife_uplink`, using original installed `hldemo.exe`
SHA256 `e459ef7d19bc0690d2e2d6dca9af1d773b49f8172096e49a694f897119bc4dc1`
and `pak0.pak` SHA256
`c9eac1391845d6fabd93d7a1cc48281275410d35e01b74bd7f02325c65c99a42`.
`media-preflight.json` retains the complete65-file manifest. DLLs use ordinary
mounts, without permanent EXE roots. Neither the media nor guest state was edited.

No complete authenticated floor-cover export and recovery manifest was available
locally for normalLoad/fresh-movement qualification. `recovery-selection.json`
therefore selects ordinary **New game → Easy**, independently in each case.
There is no invented continuation from the historical floor checkpoint. The
historical note identifies that checkpoint as **health44 / pistol9**, not armour9;
accepted historical room/floor play remains intact.

Each browser uses native Configuration → Video → Video modes, accepts the driver
advice, explicitly selects **OpenGL / Default /640×480**, and applies it normally.
WebGL additionally inspects native Controls: “Use item (buttons, scientists, …)”
is bound to **E**. Cancel leaves the bindings unchanged. These are two browser GL
backend cases through native OpenGL; repeated native renderer switching is not
requalified here. `sw.dll` or DirectDraw presence alone is not used as SoftwareGL
proof.

## Actual ownership and consequence

The first case's inherited output directory is misleadingly named `webgl`;
its actual GL endpoint1 has `{api:"gl", backend:"software"}`, and the owning
bridge context has `software:true`, native HWND65564. A separate legacy endpoint
is excluded from the binding. The second case is `webgl2`: its GL endpoint1 has
`backend:"webgl"`, bridge `software:false`, and an observed WebGL1 context.
Both actual guest and owning renderer WASM bytecodes were recovered through CDP
and hash to the module above. `*-state.json` and `*-binding.json` retain the
actual Worker targets, endpoint objects, module, window, memory and buffer.

Binding occurs only after legitimate startup and living-world arrival. All22
postbinding identity fields remain strict, including GL backend/context set,
window objects, renderer epoch and memory/buffer objects. They remain unchanged
through WebGL's elevator transition; there is no postbinding rebind or weakened
restart guard.

The relevant full frames are:

- SoftwareGL: `bound-living-software`, stair/upper-room movement, and
  `software-console-sequence`.
- WebGL: `webgl2-bound-living`, `webgl2-upper-room`, and the console approach.
- `webgl2-use-near-call`: close-range E opens the elevator door. An earlier,
  more distant E produced no established door consequence and is not counted.
- `webgl2-use-departure`: interior E lights the arrow amber and closes the doors.
- `webgl2-elevator-travel`: native LOADING appears.
- `webgl2-arrival-wait`: a different red-lit crate bay and down-arrow control.
- `webgl2-onward-bay`: fresh W advances out into that bay, health100.

All movement/turn/use pulses are bounded and balanced. Every next input uses an
individually reviewed, hash-bound, fresh full frame. No forcecall, teleport,
health/clock writes, console command, observer config write or save edit occurs.
No native save was attempted or exported; no save continuity is claimed.

## Verification and limits

The joined frozen provision verifies565 files before the first browser. A small
separately hashed annex and joined provision select the second backend, verify
all original pins again, and run its exact staged import gate before startup.
The frozen source base is `ed4a50e8a51dfbbe38f6ae9ed6dd0abd28dd8082`;
`relevant-source.patch`, initial/final helper patches and pins preserve relevant
uncommitted source and run-specific inputs. Git is the source archive; no source
tree or repeated game-media pack is archived.

The retained API1…600 envelope,21-second persistent ACK/retained same-operation
read, unknown-publication no-replay checks pass. Exact generated imports pass
positive/minimal/transitive-negative gates. All78 planned generated key/pulse/
wait forms, three independent-release tests,37 retained caller checks, and16
strict binding negatives (including changed backend) pass. The caller suite
requires its retained run argument; its earlier missing-argument invocation
failed and is not presented as a pass. No demonstrated production mismatch
required a code fix. This is documentation-only; no new build was run.

No FPS, GPU performance, audio, backend parity, Safari or full27-game claim is
made from counters. Combat beyond the arrival bay and current floor44/9 recovery
remain unqualified. The next gameplay task is the original bay's onward route,
or recovery of the complete historical export followed by normalLoad and fresh
movement qualification.

## Lifetime, recovery and shutdown

A new private55-minute box used an observable independent deadline watchdog
armed before allocation. The historical02:49:44.460 SIGKILL's sender/cause remains
unknown; this changed lifetime/custody approach does not diagnose that old exit.
No SIGKILL recurred: both Chrome exits are code0/signal-null. Their actual outer
parents waited0 with both output EOFs; kernel custody reaped200/200 and359/359
owned processes, with no remaining or unreaped task and complete command EOF.
The frozen provisions' actual parents also joined before browser startup.

`postflight.json` verifies1,368 recovered references against encoded and original
raw hashes,237 trusted/balanced native events (105 SoftwareGL,132 WebGL), all22
strict postbinding fields, and the selected full-frame reviews. Remote text,
logs and modules were compressed before transfer; reviewed PNGs were reused,
local delivery packs removed, and nine identical recovered artifact paths share
stored bytes through hardlinks. Evidence remains ignored in the owned run.

After retrieval and verification, delegated normal stop
`stop_ec31134b6d1e1b69` completed unforced with null error. Box **`bx_gmuxcjdc`**
is **archived**, stopped **2026-11-12T13:13:48.644Z**, current expiry **null**
(original lease expiry **2026-11-12T13:25:31.917Z**). Both the manager and
independent watchdog have actual parent waits0 and both EOFs. See
`stop-confirmed.json`, `manager-parent-wait.json`, and
`watchdog-actual-wait.json`. No box was left running, deleted or resumed; no
workers or public deployment were used.
