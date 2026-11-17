# Original Quake III Major combat follow-up, 2026-11-14

The original `quake3_demo` reached actual Arena Gate world/HUD, showed Major
on the ordinary native scoreboard, and exposed a clearly named live Major in
the corridor. Finite aimed machinegun and rocket attacks produced native ammo
consequences. A separate surface rocket shot showed firing light/animation.
No reviewed enemy hit reaction, frag, death or score increase was established.
Actual Exit Game / Yes produced guest exit code 0 at 1,663.667 seconds.

Evidence is retained in ignored `scratch/runs/20261114-quake3-major-combat/`.
`result.json`, selected named PNGs, `reviews.jsonl`, input receipts, native
boundaries and wait receipts separate visible results from acknowledgments.
The owner authorized exactly one fresh fixed 1,800-second maximum runtime and
an independent 1,820-second watchdog after the preceding roughly fourteen
minute original cold load. There was no extension or second game launch.

## Reviewed native encounter

The ordinary menu route showed Major on Q3DM1: Arena Gate, then I Can Win
white while the pointer was away over Fight. No bot controls were used.
The original `demoq3/pak0.pk3` entry `default.cfg` documents `bind TAB +scores`.
After actual world/HUD entry and before target search or shooting, the finite
Tab inspection visibly showed Major 0 and UnnamedPlayer 0. A subsequent
released scene shows the scoreboard gone and later guest progress.

| Selected scene | Guest seconds | Reviewed evidence |
| --- | ---: | --- |
| `world-entry-check.png` | 812.390 | Actual courtyard, weapon, crosshair and HUD; ammo 100 |
| `native-scoreboard.png` | 827.568 | Major 0 / UnnamedPlayer 0, tied first |
| `scoreboard-released.png` | 838.395 | Overlay cleared after independent Tab UP |
| `controlled-shot-consequence.png` | 859.113 | Surface-directed machinegun press consumed two rounds, 100 to 98 |
| `left-stairs-arrival.png` | 909.013 | Native crosshair name Major; small partly occluded orange figure |
| `arch-aligned.png` | 1,025.905 | Exposed armed humanoid near courtyard arch |
| `deeper-hall-reviewed.png` | 1,158.647 | Clear live humanoid and native Major name in corridor |
| `major-burst-consequence.png` | 1,178.014 | Released aimed burst, machinegun ammo 98 to 96; no observed hit |
| `room-weapon-consequence.png` | 1,320.090 | Shotgun equipped, ammo 10; later captures show 14 then 16 |
| `rocket-crossing-consequence.png` | 1,435.653 | Rocket Launcher equipped, ammo 10 |
| `rocket-shot-flight-check.png` | 1,466.548 | Surface shot firing light/weapon animation; distinct flight not resolved |
| `rocket-shot-consequence.png` | 1,476.905 | Released surface shot, rocket ammo 10 to 9 |
| `final-courtyard-reviewed.png` | 1,493.669 | Exposed armed orange humanoid beside statue, near crosshair |
| `aimed-rocket-consequence.png` | 1,515.517 | Released aimed rocket, ammo 9 to 8; opponent now farther right |
| `right-rocket-consequence.png` | 1,547.717 | Second released aimed rocket, ammo 8 to 7; no exposed target/hit |
| `final-native-scoreboard.png` | 1,564.743 | Tied first with 0 header; individual rows absent in this frame |
| `native-ingame-menu.png` | 1,594.923 | Actual menu with Exit Game |
| `native-exit-confirmation.png` | 1,634.763 | Actual EXIT GAME? YES/NO |
| `native-yes-hover.png` | 1,649.722 | Pointer on Yes before confirmation click |

Five finite gameplay attack pairs were delivered: two machinegun attacks
(one surface-directed, one aimed at the named Major) and three rocket attacks
(one surface-directed, two aimed toward exposed orange opponents). The
60 ms surface machinegun press consumed two rounds, so it is not represented
as a single round. Menu actions named `aimfire` are zero-delta menu clicks
and are excluded from gameplay attacks.

Every choice followed the latest reviewed full scene. Finite movement, strafes
and turns crossed the courtyard, approached the left stairs, entered the lit
arch/corridor, recovered from a wall near the next arch, collected the shotgun
and returned through the courtyard to the Rocket Launcher. Independent UP
timers were armed before DOWN; all 39 press pairs have acknowledged UP.
Later captures with advancing guest batches establish post-release progress.
Acknowledgment alone is not claimed to establish guest attack consumption.

The later original-game opponent changed position between the human-reviewed
scene and the released attack result. The named corridor target was visible
12.6 seconds before its attack ACK; the first courtyard rocket target was
visible 13.8 seconds before attack ACK, and the second about 24.3 seconds.
These are bounded human review/input observations, not a measured generic
input defect. No target tracking or autoplay was used. Visible ammo changes
and firing animation establish weapon consequences; they do not establish
an outgoing enemy hit. Distinct projectile flight/impact was not resolved in
the selected images. Health settling from 112 to 100 is not promoted to enemy
damage. Statues, pickups and background crosshair names during the quit menus
are not hits or frags. Reviewed HUD score stayed zero. The final scoreboard
header supports zero, but its undrawn rows do not establish final per-name
scores. No death was observed.

## Inputs, build and native execution

All 307 existing media pins and 162 native package pins matched before and
after execution. Native packages were recovered using the existing lock/cache
with `npm ci --offline`; only this run's regenerable `node_modules` was removed
after verification. Recovery paths and package/lock hashes are recorded.
There was no download, original-source/data edit or production change.

Launch HEAD was `27dafb45ae82cfb072ad44e00411d3d4d2fe6ba1`; module SHA-256 was
`dcf6e8f0ca9d361c10fa556fb30835d34cf5bfe4089f84d298cb57fd170dbd42`.
All 317 accepted SuperTux build inputs and the module matched again under
`wine-heavy-runtime.lock`, permitting exact reuse of its locked full build.
`launch-source-pins.json` pins 318 paths; Git binary patches preserve relevant
WIP and owned new controller inputs without a source archive. Native loading
recorded 103 source/package files; all 67 covered by launch source pins
matched, and all 318 launch pins remained unchanged at postflight.

Six finite-input controls passed, including Tab, prearmed UP, duplicate
identity rejection and dead-child UNKNOWN/no replay. Three actual lifecycle
controls passed for normal exit, signal and deadline, each with child wait,
both EOFs and watchdog wait. Read-only observers/watchdog match the tested
predecessor exactly. The first native GL preflight failed its right-edge
resize assertion, as in the preceding task. One unchanged serialized recheck
passed. Both logs remain; the intermittent preflight failure is unresolved.
Neither preflight launched the game.

The sole game ran after the SuperTux wall-time and TIM2 fair turns, with actual
`--headless-gl`, default 1,000-block batches, `--real-ticks` and `--no-threads`.
Native llvmpipe LLVM 20.1.2 was identified; this does not imply physical GPU
execution. `gl_sw_enabled` stayed zero, with 4,239,967 draws and 9,345 native
presents/readbacks. Owner-context and compositor boundaries are recorded.
No software fallback, forced swap/presentation, console map/addbot, guest
calls, state/config/clock/AI/score writes, UNKNOWN replay or tracking occurred.

## Native quit and remaining requirement

The independent watchdog was armed before runtime PID 3426970, at
12:33:44 UTC. Reviewed Exit Game / Yes led to `[Exit] code=0` and native stats
at 1,663.667 seconds, before either fixed limit. This was not timeout-as-Quit.
Runtime actual wait was 0 with separate stdout/stderr EOF and no received
supervisor signal. The watchdog actual wait was 0 with `runtime-terminal`,
not deadline firing. The detached outer supervisor recorded its actual child
wait 0 and both EOFs. The earlier task's outer-wait gap does not recur here.
Runtime, watchdog, launch helper and outer supervisor are absent, and the heavy
lock was released. No further gameplay runtime was launched.

The bounded result advances to identified Major, finite aimed native attacks,
ammo consequences and actual native Quit. The concrete missing requirement
is a reviewed outgoing Major hit or frag with its separate visible consequence;
no renderer, input or AI defect is established by that missing result.

No box was created: ID null, state `NOT_CREATED`, expiry null, stop receipt
N/A. No public deployment occurred. Foreign NE/render/host WIP is preserved.
Full27 remains unproved. This single authorized task ends with this evidence.
