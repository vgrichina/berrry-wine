# Local new-game pool: historical exclusions and an unproven original demo

Source-only audit on October5; no game activation, browser/build, asset copying or engine edits. This is a targeted expanded pool review, not proof that every corpus game has been examined.

## Recommended next source preparation: Tomb Raider III Windows India/Jungle

`docs/glide-demo-candidates.md:83–98` explicitly records September29 static extraction with **neither installer nor game executed**, no launch registration, and Direct3D2 rather than Glide. No later title-specific gameplay/qualification was found in the retained board or docs. Current local APPS has no Tomb Raider III entry; retained public-desktop snapshots have no such entry. This is stronger than inferring novelty from a missing dashboard screenshot.

Original fixture: `test/binaries/candidates/tomb-raider-3-demo/provenance.json`. Original installer `tr3_demo_01.exe`, 7,777,792 bytes, recorded SHA256 `7287cb147a3f8e08f743bc2e465202d2ba5319f3cc9b88bf5d868330f28c2dcf`; original source URL and static 7z/unshield extraction receipt remain there. Actual EXE re-read during this audit: PE32/i386, 920,064 bytes, SHA256 `8c7b25460f62c180ae675c2696ac66c8f97948a16458d0598ba72794ddcc7814`, matching provenance.

All ten original paths exist under `extracted/Program_Executable_Files`: `tomb3.exe`, four `pix` bitmaps (Title/legal/release/INDIA), `data/jungle.DEM`, `data/JUNGLE.TR2`, `data/MAIN.SFX`, `data/TITLE.TR2`, `data/tombPC.dat`. No payload duplication required. Recorded imports include DDRAW DirectDrawCreate/EnumerateA, DINPUT, DSOUND, WINMM and MSACM32; DirectDraw2/Direct3D2 GUIDs are present. Presence is not compatibility or complete dynamic-dependency proof.

Smallest next step: source-audit original installer/config requirements and exact imported/late DLL closure; prepare a private registered manifest rooted only at this original ten-file tree, preserving paths. Identify ordinary setup/menu/New Game controls from original resources, then request one bounded actual launch and player movement route with source/asset identities. Do not fabricate installer registry success, force guest state, substitute assets, or assume a renderer/backend. First observed missing contract determines any repair scope. This title has no currently established process-architecture prerequisite like WinBoard. TR II Venice is a separate similarly extracted reserve, but only one lane should be selected.

## Checked alternatives: do not recycle prior qualification

| Title | Exact retained evidence / disposition |
|---|---|
| AoE2 | `aoe2-trial.md:14–20,105–117`; Aug26 browser Trial Coastal/camera receipts. Existing-game regression, ineligible new title. |
| NetHack | `nethack-win32.md` Gameplay gate; board Sept5 03:14 c2476a67/88f39c49, 354 changed dungeon pixels and `/private/tmp/nethack-v296-final.png`. Already interactive. |
| QBob | Board Aug14 03:57:55 colorful800×600 gameplay/audio with candidate gate. Later startup regression does not erase prior acceptance. |
| Cave Story | `scratch/runs/20261003-cave-story-logical-gameplay`; ordinary Right/Z and reviewed cave, October3 publication. Already qualified. |
| Heaven Seven | `lib/apps.js` identifies a demoscene64K intro. Not a player-controlled game refill. |
| Vangers | No matching registered app, candidate fixture directory, board entry or reverse-note found in the inspected local pool. Original executable/closure must first be identified; do not assume availability. |
| Arcanum | `arcanum-demo.md:24–36`, September29 ordinary clicks → dialogue → free roam crash site. Historical gameplay. |
| Caesar III | `caesar3-demo.md:30–44`, ordinary name/assignment/live-city gate; historical gameplay, not a new title. |
| Icewind Dale | `icewind-dale-demo.md:600–630`, explicit unpaused tavern floor-click movement and September29 walking census. Historical gameplay. |
| Lure / Beneath a Steel Sky | Their GOG notes explicitly document reviewed player-controlled cell / playable industrial scene in `/private/tmp/free-gog-screenshots.EC8yad/`. Different packaging is not a new game. |
| Serious Sam | Board Oct1 22:30 diagnostic Karnak movement/combat, score100/health95. Production integration limits remain; not a never-played title. |
| Pirates / Hitman | Reverse notes record sailing steering / in-world movement. No new-title refill. |
| Win16 JigSawed / UT2004 | August22 drag061307f / September29 DM-Rankin. Exclude despite later failure receipts. |
| WinBoard | Original assets exist but CreatePipe/child stdio architecture blocker unchanged. Keep prerequisite ready/unassigned; no active refill solely to fill a label. |

Historical temporary images were not re-created or newly hash-qualified. These are retained qualification records used conservatively to avoid counting old games again. No claim of current-runtime success follows.
