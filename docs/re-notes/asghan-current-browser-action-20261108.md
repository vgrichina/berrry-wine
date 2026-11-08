# Asghan demo: current browser jump and enemy-contact damage, 2026-11-08

The original registered software demo shows current terrain-relative movement,
vertical and forward jumps, and a visible native combat consequence: an adjacent
orc damages Asghan, shortening the green health bar. **Outgoing sword damage,
enemy defeat, destruction and pickup remain unproved.** This result includes
incoming combat damage; it is not another movement-only acceptance.

Evidence: `scratch/runs/20261108-asghan-current-browser-action/`.
Tested main SHA: `8fdba6283331ae518068cf0260fb9d4ba6e77ca5`.
Recovered executing guest Worker module SHA-256:
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
Only this note changes in Git. No emulator mismatch or repair is established.

## Original media and actual route

Reused all 120 installed fixture files, 30,448,512 bytes, under
`test/binaries/win98-games-a-d/Asghan-demo-installed`. The registered route
remains `_start.exe`, CW3220/SMACKW32, the existing manifest and
`c:\asghan.dem` working directory. Retained native setup outputs `_start.stp`,
`_start.cdp` and `app.exe` were unchanged. No installation, setup editing,
alternate executable or forced D3D renderer was used.

The current executable matches the recorded historical SHA-256
`29069cc0d8e81ebb601fe70fac62a29c637eec4371946fc3bd4c64c60f275ca5`;
the manifest matches
`af9b9c136595e3b8496cd6c07b368b1912f8699238814873f32d989627540957`.
The November 2 run directory is unavailable locally, so historical equality of
the remaining files stays unknown. Current hashes, sizes and original paths
are in `media-refs.json`, verified again after the run. Historical
`636ffe63407f38e30ab7429187441086a3473c0b` is the WORD-handle alias fix;
it supplies no current jump/combat evidence.

The shipped readme section 3 supplies Up/Down movement, Left/Right turning,
Alt jump, Alt+Up forward jump, Ctrl combat stance, Ctrl+Up fast attack,
Ctrl+Down block and Space action. The reviewed ordinary route was title →
Enter → visible NEW GAME → Enter → opening camera → neutral pier gameplay.
No opening-camera image is counted as player movement.

Chrome 151.0.7922.108 used the ordinary browser scheduler and guest Workers.
Each reviewed capture/admission binds process 1000, its actual guest endpoint,
Worker target/instance, recovered live module, page renderer, canvas and the
visible process-owned **Win Alis** window object. Network responses match the
original executable and native setup outputs. All 708 runtime pins matched
before launch and after closure. HTTP logs independently match 69 original
files, including executable, both DLLs, manifest and setup outputs; the other
51 original paths have no recorded HTTP request. All 120 were staged and
hash-verified; staging is not described as HTTP consumption.

The guest uses its software/DirectDraw route; the page presents through
`CanvasRenderingContext2D`. Every captured identity has render endpoint and
renderer target `none`; there is no recovered 3D Worker/context. The visible
host GPU selector does not make this GL or D3D gameplay evidence.

## Reviewed gameplay consequence

| Capture in `review/` | Observed result |
| --- | --- |
| `pier-neutral.png` | Hero standing on wooden planks, with identifiable wall, ground and lantern. |
| `pier-jump-during-900.png`, `pier-jump-during-1800.png`, `pier-jump.png` | Alt produces airborne boots above the pier/shadow, descent, then landing. Camera movement alone does not explain the boot-to-ground separation. |
| `pier-forward.png` | Up leaves the planks and retains a new ground position against the rock wall. |
| `turn-left.png`, `enemy-approach.png` | Left changes heading along the path; Up approaches the visible green orc beside a barrel. |
| `path-running-jump-during-900.png`, `path-running-jump-during-1800.png`, `path-running-jump.png` | Alt+Up produces a forward airborne arc and landing on the path as the orc approaches. |
| `close-fast-attack.png`, `sword-contact.png` | Ctrl+Up establishes a visible sword/combat stance facing the orc. No outgoing damage is inferred from that stance. |
| `step-to-orc.png` | Short Up closes the remaining gap; models are adjacent, green bar still full. |
| `contact-fast-attack-during-300.png`, `contact-fast-attack.png` | Orc contact/weapon action and red ground marks accompany a shorter green bar. |
| `native-menu.png`, `menu-settled.png` | Further contact leaves a shorter bar; Escape then opens the native SAVE GAME icon/menu overlay. No further gameplay inputs follow. |

A direct read of the existing PNG pixels at row 666 measures green spans
**190 → 170 → 150 pixels**, respectively in `step-to-orc`,
`contact-fast-attack` and `native-menu`; see `health-pixels.json`.
These are displayed pixel widths, not decoded private health values.
The hero remains alive; no respawn is joined into this sequence.
The first Ctrl+Up attempts were outside contact range. Later contact proves
incoming damage, but the sampled sword poses do not establish an outgoing hit.
The final native menu was used only to conclude the attempt; no hidden pause,
state/configuration edits, clock changes or scheduler forcing occurred.

## Controls, evidence and shutdown

The released SuperTux native-CDP driver supplies independent releases, exact
ACKs and sticky UNKNOWN closure. New Alt, Alt+Up and Ctrl+Up events were tested
locally against the actual production Worker running registered Calc, with
trusted native events and forwarding `takeInput` observations of DOWN/UP
consumption. Initial isolated observer/expectation failures are retained:
watching `shift` missed `takeInput`, a repeated top-level declaration failed,
and Alt DOWN is WM_SYSKEYDOWN rather than WM_KEYDOWN. The corrected local
qualification passes. Repeated local observers produce duplicate observation
rows; these are not counted as duplicate native dispatch or consumption.

Generated negative controls reject changed owner/window/canvas/renderer/module,
wrong image, missing module, stale scene and UNKNOWN before dispatch.
Pending/rejected acknowledgements still attempt one independently scheduled
release. These isolated controls are separate from the original game, which
has 16 exact command ACKs, 12 pulses, 16 balanced trusted DOWN/UP pairs,
zero UNKNOWNs and no held keys. PNG decode/CRC checks pass for 58 retained
images, including intermediate frames. Intermediate frames corroborate arcs;
only bound full captures admit subsequent inputs.

227 remote references, 16,430,219 bytes, were retrieved and independently
SHA-256 checked **before normal box stop**. Browser/controller PIDs and both
ports are absent, profile/writer lock removed, Chrome exit 0. The source SHA,
relevant binary patches, owned-input patches, module and media references are
retained without a source archive. No media copy is bundled into evidence.

Fresh UUID-idempotent box **bx_yttv83f4** had an independently observable
25-minute watchdog armed before allocation. Normal stop completed at
**2026-11-08T04:35:55.693Z**, state **archived**, expiry **null**, initial
expiry **04:56:55.676Z**. Receipt **stop_8b2f3ba865f9cd82**, `forced=false`.
Both lifecycle delegates exited 0; supervisor has no children. Disk stayed
above 5 GB. No RAM gate, old-box resume/delete, nested worker or deployment.

Next work is outgoing-hit/enemy-defeat or native pickup evidence with actual
attack timing/polling observations. FPS, audio, full-game playability and
GL/D3D corpus coverage remain separate.
