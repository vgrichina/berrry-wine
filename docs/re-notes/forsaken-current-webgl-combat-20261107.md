# Forsaken current browser WebGL gameplay, 7 November 2026

One fresh registered `forsaken_demo` browser session reached readable Volcano,
responded to thrust, look and firing, and showed player death followed by a
readable respawn. No renderer/input/crash mismatch was established. No
production code changed.

Evidence: `scratch/runs/20261107-forsaken-current-webgl-combat/`.
Candidate: `forsaken-demo`. This supplies browser WebGL evidence missing from
the recent native GL sweep, whose Forsaken arm used software D3D.

## Identity and route

The launch closure was main `35952117c38f3282f1c1ace75fe912cc5a765eea`
plus the recorded, already-present untracked `lib/wininit-boot.js` patch.
`source-identity.json`, `relevant-working-tree.patch` and
`lib_wininit-boot.js.new.patch` preserve that identity without a source archive.
All 1,478 staged inputs match before and after execution. The 871 manifest
entries match the retained November 6 software run's hashes; the executable
and manifest make 873 original fixture paths.

| Input | SHA-256 |
| --- | --- |
| Original `installed/ForsakenDemo.exe`, 3,759,616 bytes | `366ec5d0943daca839836296f9fb52724e94dc155630c6b0c30d7181106b5e24` |
| Registered `.wine-assembly-browser.json`, 132,133 bytes | `587ce145ab73a3fed2c7136425bb6a7bcf28def312d430c8bf7d1be802b2260b` |
| Actually instantiated standard WASM, 2,182,493 bytes | `e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467` |

Chrome `151.0.7922.108`, 1024×768, guest Workers and Threads used the explicit
`d3d-renderer=webgl` route. CDP hashes the instantiated bytecode in the CPU
Workers and owning render Worker, rather than assuming the served file was
loaded. Render Worker target `797436B94A145C7E5C348634DEB31AF1`, endpoint **1**, reports
legacy **WebGL**, WebGL **2.0**, and
`ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6 (Core Profile) Mesa 23.2.1)`.
The inspected checkpoints report zero renderer errors and zero inline or
fallback software draw completions. Those counters do not prove pixel parity.

Complete manifest/hash checks, the native-control schema and balanced A+Ctrl
events were preflighted before the original launch. A separate small WebGL
smoke test returned `[255,0,0,255]`. The ordinary launcher selected Forsaken;
trusted native inputs followed Single Player → Start → Level Volcano → Start
→ readable world. No guest state, media, configuration, clock or queue was
edited, and no outcomes were forced.

## Personally inspected progress

All named images below are in the run's `retrieved/` directory.

| Capture | Observed result |
| --- | --- |
| `volcano-briefing.png` | Readable teal room, doorway, crosshair and original volcano message; LIVES 5, SHLD/HULL 128, PULS 2000, MUG 5. No stale briefing fragments observed. |
| `forward-door.png` | A 600 ms pulse gives no useful movement proof; excluded from that claim. |
| `thrust-fire.png` | Paired A+Ctrl 3 seconds: closer doorway, PULS 1996, SHLD/HULL 128. |
| `corridor-fire.png` | Paired A+Ctrl 15 seconds: entry into the readable textured metal corridor, PULS 1970. Clear translation and firing response. |
| `corridor-combat.png`, `corridor-deeper.png` | Further corridor advance, PULS 1948 then 1918; LIVES 5 and SHLD/HULL 128. The first filename alone is not combat proof. |
| `look-right.png`, `right-recess.png` | Paired right-arrow controls change the view; the longer turn looks back toward the starting-room doorway. No new-room claim. |
| `secondary-response.png` | After paired A+Ctrl+Space, readable **ENEMY KILLED YOU**, red death effects, orange projectile, bike model and skull. This is player-death combat evidence. |
| `death-fire-response.png` | After a fresh paired Ctrl press, readable starting room and **4 LIVES LEFT**, LIVES 4, SHLD/HULL 128, PULS 2000, MUG 5. Respawn and restored readability. |

The initial short-pulse schema bounded holds at 3 seconds. A separately checked
15-second maximum was used for longer ordinary controls. Every hold releases
keys in `finally`. The logo Enter used the same trusted-input helper with CPU
identity checks, since no render endpoint existed at the logo; subsequent
queued controls additionally verify the owning WebGL endpoint. No original was
relaunched. One premature file fetch failed before `boot.png` existed; its
receipt is retained as a harness timing error, not a game fault.

## White death interval and bounded observation

`post-death.png`, `death-transition.png` and `transition-later.png` show a mostly
white interval after the readable death scene. They are excluded from readable
world claims. The retained software run also contains bright death/combat
frames; its readable starting-room capture was inspected here. References and
hashes are recorded in `software-evidence-references.json`, without copying
media or claiming a matched software/WebGL comparison.

Before further input, the existing bounded owning-producer observer retained
`transition-owning-receipt.json`: 70 accepted GPU submissions, 18 selected-point
draw observations, ten natural readbacks and nine accepted depth-only clears.
The 640×480, 16-bit target alternates DIB ownership; the selected point is white
before/after the captured additive `ONE/ONE` draws. The receipt retains owning
sequences, vertices, texture descriptions, native/decoded samples and target
state. Flags **2** clear depth while preserving color; these observations do
not establish a violation of that renderer contract. The observer stopped
before the fresh Ctrl input, after which the readable respawn was captured.
This does not prove Ctrl was necessary or uniquely caused recovery.

No stale briefing, persistent unreadable gameplay after respawn, escaped trap,
or renderer contract mismatch was proved. A speculative repair or new rejecting
regression is therefore unwarranted. Intermediate same-life shield/hull damage,
an enemy kill, hidden-door opening and level completion remain unverified.
No FPS, audio, full-scene parity or historical full-27 qualification is claimed.

## Verification and cleanup

`verification.json` checks **701** successful responses (**574** distinct URLs)
against pinned bytes/hashes, complete collector lifecycle, **38** trusted
events including **36** balanced keyboard events targeting the guest screen,
actual owner modules and all **16** personally inspected PNGs. Focused existing
tests pass: `test-d3dim-gpu-fallback-counters.js` and
`test-d3dim-draw-trace.js`. Native input rejection/balance checks and source/
fixture pre/post checks pass. No new full build is claimed for this docs-only
change.

The UUID Idempotency-Key was persisted before creating fresh box
`bx_zcfkz7gb`. Chrome exited **0** on ordinary stop. No live process remains
among the 16 recorded runtime identities; ports **39263/37553** are closed, the profile
is removed and no keys remain held. All 100 remote evidence files were
retrieved and hash checked before the explicitly delegated normal shutdown.
The box is **archived**, stopped `2026-11-07T06:33:15.422Z`, stop completed,
`forced:false`, with no active expiry. No stopped box was resumed and no public
deployment occurred. Local free space stayed above 2 GB.

Next useful gameplay evidence is an intermediate damage sequence or progress
beyond this corridor. Any further rendering diagnosis needs a demonstrated
public-contract mismatch; the historical brightness lead alone is insufficient.
