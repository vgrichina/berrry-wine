# Original graphics titles after the native GL shader repair

2026-11-07. Run: `scratch/runs/20261107-graphics-fixed-gl-originals/`.
Quake II, Quake III and GLTron now have personally inspected original gameplay
through the supported Node native GL bridge containing `aaaf6e370`. Forsaken
has inspected gameplay through its registered **software D3D** route. No new
emulator defect was demonstrated and no production source was changed here.
Earlier original captures from before the shader repair remain pre-repair
evidence; they do not become GL passes through this result.

## Tested identity and recovery

The single fresh box was `bx_pfx5b88a`, created 04:32:02.917Z with its UUID
Idempotency-Key persisted in `boat-create-key.json`. No predecessor box was
resumed. Preparation waited for Lords2's source/build release at 04:34:44Z.
The tested main commit was `ce0330c444ea43742259624db5e9cd0240b2f156`, which
includes the published WinExec repair `9b1da000e` as well as the GL repair.
`runtime-pins.json` records every staged path, size and SHA-256. The relevant
tracked source diff is empty (`relevant-source.patch`); the then-untracked
`lib/wininit-boot.js` is retained as `new-lib_wininit-boot.js.patch`. Git plus
these patches is the source recovery recipe; no source/media archive was made.

| Tested input | SHA-256 |
| --- | --- |
| Standard WASM, executed in all 14 original runs | `e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467` |
| Compat WASM, recovered but not executed | `04acbb89f66ad9814836b5e2c34de659b518f4e1994f50c4ee8069c991f02f72` |
| `lib/gpu-backend.js` | `7913166b52ad34b5a7657aefec747aa66bf4b8f4c1cd3e50fa195a7956274ad7` |
| `lib/headless-gl.js` | `7e79d93edd690f4c2338874bcde1961360547bfd031d4b58827484e7b03689fb` |
| Remote Node v24.22.1 | `e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb` |

Registered originals were complete and matched the recorded fixture hashes:
Quake II 67 paths, Quake III 307, GLTron 92, Forsaken 873. The 1,355
predecessor fixture/shared inputs matched, with fonts pinned separately.
`original-fixture-preparation.json` and `runtime-pins.json` preserve the exact
paths and hashes without duplicating game media. A local preparation typo
(`test/binaries/fonts` instead of recorded `fonts/`) was corrected before any
guest ran; see `preparation-correction.json`.

The native environment used `@node-3d/glfw` 7.4.1 and `@node-3d/webgl` 6.0.3,
display `:0`, Mesa llvmpipe LLVM 20.1.2, WebGL 1.0 / GLSL 4.50. The 162 native
dependency files are pinned in `native-pins.json`; nine native libraries were
also recovered individually. The red-pixel context probe returned
`[255,0,0,255]`, error zero and zero remaining contexts after destruction.
Fresh native fixed-function/shader and WGL regressions passed before originals
(`retrieved/fix/native-test-after2.json`, `native-wgl-after2.json`).

## Original startup sweep

The supported command was `node tools/crash-sweep.js
--apps=quake2_demo,quake3_demo,gltron,forsaken_demo --seconds=20 --headless-gl
--modes=coop,threads --jobs=1 --stuck-after=0 --no-build --jsonl=.../actual3/sweep.jsonl`.
All eight serial guests ended with signature `ok`, without an escaped trap or
unimplemented API. WGL creation and make-current returned success for the six
GL guests; Forsaken created no native GL context.

| Original | Coop capture at about 20 seconds | Threads capture at about 20 seconds |
| --- | --- | --- |
| Quake II | Original main menu | Original main menu |
| Quake III | 512×512 logo texture; not display evidence | Same texture; not display evidence |
| GLTron | Black capture at this budget | Original colored main menu |
| Forsaken, software D3D | Original main menu | Near-white capture at this budget |

The existing sweep PNG selector chose Quake III's colorful DX texture slot 35.
Its logo cannot establish visible startup. Followups used the existing
`--png-canvas` / control-server compositor capture instead. The GLTron and
Forsaken equal-time differences are observations, not scheduler diagnoses.

## Ordinary input and actual game progress

Controlled followups used the unchanged `test/run.js`, supported `--headless-gl`,
`--png-canvas`, `--real-ticks`, batch size 200000 and bounded ordinary control
inputs. All six ended with code zero. Each `retrieved/progress-*/` directory
contains its exact launch arguments, runtime log, input/capture evidence,
loaded module hashes and terminal status.

| Title / mode | Personally inspected progress and evidence |
| --- | --- |
| Quake II / coop | Enter → Game → easy → first-person room with weapon/HUD. Paired W and Right inputs changed the view: `world.png`, `moved.png`. |
| Quake III / coop | Actual main menu → choose level → difficulty → Q3DM7 loading → first-person world with bots, weapon and health 122: `world02.png`. W down/up completed; `final.png` shows another view and health 116. The subsequent Left down had no matching up because the 180-second harness guard ended the run; do not claim a fully balanced turn sequence. |
| GLTron / coop | Return through menu/pause → moving cycle/trail; paired A changed direction/minimap: `gltron-unpause.png`, `gltron-left.png`. Later S capture shows player 1 crashed/winner 3; Escape returned to menu. This is game progress, not a survival or level-completion claim. |
| Forsaken / coop | Logo/menu → Start/Volcano → briefing → rendered world with lives 5, shield/hull 128, Pulsar 2000. Fire produced visible green pulses and ammo 1988; Up changed the view: `world.png`, `forsaken-fire.png`, `forsaken-move.png`. Software route. |
| Quake III / threads | Main menu → Q3DM1 Arena Gate → rendered world health 124; Major killed player, mouse input respawned and paired W moved the view: `world01.png`, `world02.png`, `q3t-forward.png`. Black shapes near the torch remain visually questionable and need targeted rendering diagnostics. |
| Forsaken / threads | Original menus/briefing → Volcano world; paired fire produced green pulses/ammo 1992 and Up changed view: `ft-continue.png`, `ft-fire.png`, `ft-look.png`. Software route. |

Quake II threads and GLTron threads reached inspected menus only; gameplay in
those modes was not exercised. Black GLTron trail shadows follow the original
configuration; distant visual artifacts and Quake III torch shapes preclude a
full visual-parity claim. No trap/API/rendering defect was causally established
that justified another emulator repair. In particular, a black/white short
capture alone did not justify changing scheduler semantics or guest files.

All 72 recovered PNG references (66 unique images) were inspected; hashes and
contact-sheet indexes are in `capture-index.json` / `capture-reviews.json`.
The coordinator additionally inspected Quake II movement, Q3DM7 gameplay,
GLTron trail/turn and Forsaken view change (`coordinator-visual-review.json`).
This establishes Node GL original startup/gameplay only: not browser WebGL,
historical 27-title qualification, audio qualification, FPS, or game completion.

## Audit, shutdown and next work

The remote postflight checked 1,784 runtime and 162 native pins unchanged.
The recovered loaded-read audit independently matches 1,781 reads, including
14 standard WASM reads, with no observed bridge errors or escaped traps/API
failures (`identity-audit.json`, raw `loaded-modules.jsonl` and `bridge.jsonl`).
Recovery verifies 268 artifact references / 248 unique hashes, including both
modules, native libraries, unique captures and losslessly compressed logs.
The detailed postflight filename was reused by inventory; the raw traces and
`audit-remote-result.json` retain the remote audit, and `identity-audit.json`
reconstructs it locally.

The startup sweep used jobs=1. Q3 coop started 0.107 seconds before the previous
Q2 supervisor wrote its terminal record, after the Q2 quit request; this small
launch/teardown overlap is recorded rather than described as strict terminal
serialization. Subsequent launches explicitly required previous terminal
records. There was no intentionally concurrent heavy title workload.

Before stopping, `retrieved/cleanup.json` confirmed no owned live process,
closed control port 18123, no owned Unix socket, removed temporary directories
and no browser/profile created. After all unique evidence/modules were
recovered, delegated normal shutdown completed at 04:50:14.095Z:
**box archived, stoppedAt 04:50:14.074Z, forced false, error null, no active
expiry** (`stop-confirmation.json`). No box ownership remains outstanding.

Next useful work is a matched-state Quake III torch alpha/blend investigation,
and optional Quake II / GLTron threads gameplay. Neither is a proved emulator
blocker from this run. No public deployment was performed.
