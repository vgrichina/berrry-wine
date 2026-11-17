# Original Quake III arena entry and finite movement, 2026-11-14

The original `quake3_demo` reached the actual Q3DM1 arena and HUD after the
ordinary Major / I Can Win / Fight route. Reviewed finite movement changed
position through the courtyard and into a lit archway, with a visible Rocket
Launcher pickup. The actual menu's Exit Game / Yes route then produced guest
Exit code 0 before the fixed deadline. No reviewed scene identified a live
Major target: no gameplay shot, enemy hit, kill, score increase or death was
observed. The requested enemy-consequence/frag objective remains unproved.

Evidence is retained in ignored
`scratch/runs/20261114-quake3-advancing-load-arena/`. `result.json`,
`reviews.jsonl`, `selected-captures.json`, input receipts and native boundaries
separate reviewed scenes from command acknowledgments. Sixteen selected PNGs
pass SHA-256, PNG CRC and inflate verification. Redundant captures were removed
with size/hash records; no frame series, media copy or source archive remains.

The owner explicitly authorized exactly one fresh 1,200-second runtime with an
independent 1,220-second watchdog after the preceding original-shader evidence:
94 original map shaders, 31 changing final-minute queries, and 476 exact
40-byte parser-source-offset matches. This superseded only the former
no-larger-retry restriction. It did not authorize extending an active lease.
There was one actual Quake III runtime, no extension and no second attempt.

## Reviewed route and observed effects

Times below are from the actual capture receipts, relative to CLI guest time.

| Capture | Seconds | Reviewed content |
| --- | ---: | --- |
| `menu-ready.png` | 89.745 | Actual main menu before Enter |
| `roster-ready.png` | 160.507 | Major; Q3DM1: Arena Gate roster |
| `roster-fight-hover.png` | 193.732 | Fight gold beneath pointer before click |
| `difficulty-ready.png` | 217.873 | Actual difficulty menu |
| `icanwin-white-away.png` | 257.939 | I Can Win white; pointer away over Fight |
| `loading-stage.png` | 449.594 | LOADING MAPS/Q3DM1.BSP over levelshot |
| `hud-assets-loading.png` | 652.746 | LOADING GAME MEDIA |
| `player-media-check.png` | 812.159 | AWAITING SNAPSHOT, portraits/icons; still loading |
| `first-world-check.png` | 844.638 | Actual arena geometry, weapon, crosshair and HUD |
| `forward-released.png` | 868.600 | Changed courtyard viewpoint after finite W/release |
| `courtyard-arrival.png` | 923.304 | Changed position and equipped Rocket Launcher, ammo 11 |
| `lit-passage-reviewed.png` | 1034.329 | Position inside the lit arch after further finite W/release |
| `actual-ingame-menu.png` | 1084.781 | Actual menu, including Exit Game |
| `exit-game-hover.png` | 1110.616 | Pointer on Exit Game before click |
| `native-exit-confirmation.png` | 1127.521 | EXIT GAME? YES/NO |
| `native-yes-hover.png` | 1140.767 | Pointer on Yes before the final click |

The first capture at 61.431 seconds showed only an animated background.
A 121.494-second post-Enter capture still showed the previous main menu;
it was waited through without replay. The later roster establishes the
transition. Loading/levelshot and Awaiting Snapshot are not counted as world.

Gameplay used finite W holds (600, 900, 1,000 and 1,000 ms), finite left/right
turns (400, 400 and 800 ms), and one reviewed 80-unit relative horizontal
alignment. Each decision followed a fresh reviewed scene. Releases were
prearmed independently before DOWN. Subsequent captures and advancing guest
counters establish progress after release; acknowledgments alone are not
claimed to prove guest consumption. All fourteen menu/gameplay press pairs
have acknowledged UP. Menu actions using the controller's `aimfire` name
were zero-delta Mouse1 **menu clicks**, not gameplay attacks. No gameplay
Mouse1 was delivered.

The pickup was initially guessed visually to be a shotgun; the later
on-screen **Rocket Launcher** label corrects that guess. Initial health 114
settled to 100 without any reviewed damage event; this is not claimed as
an enemy hit. The HUD score stayed zero in the reviewed scenes. Statues,
floor pickups and torch scenery were not promoted to enemies. No identified
Major target was available on this finite courtyard/arch route before time
was reserved for native Exit. This is a bounded encounter limitation, not
proof of an AI, renderer or other generic defect.

## Inputs, tests and native execution

All 307 existing media path/hash pins matched before and after the run.
All 162 native package pins were recovered with the existing npm lock/cache
using `npm ci --offline`, matched before and after execution, then only this
run's regenerable `native-deps/node_modules` was removed. Recovery commands,
package/lock hashes and reference pin paths remain in `native-recovery.json`.
No download or media substitution occurred.

Launch HEAD was `1d26f291fbdbf548b7c0fe7a6bc084a4b00ab495`.
The module SHA-256 was
`dcf6e8f0ca9d361c10fa556fb30835d34cf5bfe4089f84d298cb57fd170dbd42`.
`launch-source-pins.json` pins 318 paths, including the existing untracked
runtime helper; `launch-source.patch` and addition patches preserve relevant
WIP and owned controller inputs. Native boundary records hash the module and
103 loaded source/package files at load. All 67 loaded paths covered by the
launch source manifest matched, with no postflight source drift. The preceding
SuperTux locked full-build evidence was reused only after exact source/module
identity checks under the heavy lock; its 317-provider manifest and build log
are referenced by `build-reuse-check.json`. No production source changed.

Five finite-input controls and three actual lifecycle controls passed,
including independent UP, dead-consumer/no replay, deadline and both-EOF cases.
Read-only observer/watchdog scripts match the tested BSP-loading predecessor.
The first native GL preflight failed its widened-right-edge resize assertion;
an unchanged serialized recheck passed the complete test. Both logs remain.
That intermittent failure is unresolved, not erased or presented as a fix.
Neither preflight launched the game. A supervisor assertion initially checked
for the wrong success word (`OK` instead of `PASS test-headless-gl`); correcting
that run-local check also preceded the sole game launch.

The runtime used actual `--headless-gl`, `--real-ticks`, default 1,000-block
batches and `--no-threads`. Native llvmpipe LLVM 20.1.2 was identified; native
backend use does not establish physical GPU execution. `gl_sw_enabled` stayed
zero. Final totals were 1,649,858 draws and 4,761 presents/readbacks. There was
no forced presentation, software fallback, owner substitution, console map,
forced guest call, guest state/config/clock/AI edit, autoplay or tracking.

## Shutdown and remaining boundary

The independent watchdog was armed before PID 3396091 launched, with a fixed
1,220-second deadline. Guest Exit code 0 followed the reviewed native Yes click;
there is no max-seconds stop or control-quit command in the run. Native totals
end around 1,153.146 seconds. `terminal.json` records actual runtime wait 0,
stdout/stderr EOF and no received supervisor signal. The watchdog actual wait
was 0, with reason `runtime-terminal`; its deadline did not fire.

The outer tool session nevertheless returned 143 and did not write its own
child-wait/both-EOF receipt. The cause remains unknown.
`outer-supervision-gap.json` explicitly preserves this gap; native completion
does not establish outer wait completion. `process-audit.json` verifies runtime,
watchdog, launch helper and outer supervisor PIDs absent. The heavy lock was
released before finalizing; no game/runtime helper remains active.

Arena entry and finite movement/pickup are established. Firing at Major and
an observed enemy consequence remain the concrete missing gameplay result.
No unchanged runtime was launched to fill that gap. Any next task must begin
from this bounded result and its authorization, rather than promoting pickups
or loading imagery to combat or wider game qualification.

No box was created: ID null, state `NOT_CREATED`, expiry null, stop receipt
N/A. No public deployment occurred. Foreign WIP is preserved.
