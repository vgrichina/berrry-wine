# StarCraft: personally reviewed enemy consequence (2026-11-14)

This is a distinct combat objective on the existing registered
`starcraft_shareware` route (`ophelia terran1`). The completed Supply Depot
construction run is closed and is only a read-only controller reference.

## Controller and evidence contract

`tools/starcraft-combat-controller.py` permits one personally chosen left click
per invocation. The released Barrage transport supplies permanent native
PID/start-token/window ownership, unique nonces, sticky UNKNOWN and a separately
prearmed 1750 ms UP fallback. Right clicks, drags and action lists are refused.
Every gameplay/navigation scene expires after five seconds; ordinary native
menus expire after thirty. Each input also checks freshness immediately before
DOWN. The final 180 seconds of the immutable runtime belong to irreversible
Quit; reentering gameplay is refused.

Binding requires a personally reviewed actual native title/menu. A splash or
movie cannot be relabelled as a menu, and a later mission scene is not a binding
shortcut. Mission admission is separate and requires a current unobstructed
mission review.

The combat extension requires the selected armed unit's HUD/weapon, the visible
ordinary Attack command, and a separate current visible enemy target after the
consumed Attack command. Move/Stop/Hold support finite native navigation;
construction is refused. Each camera/minimap click needs its own reviewed
intent. There is no recognition, tracking, waypoint list or model action loop;
ordinary native AI may continue after an order.

A result record requires a current settled scene after the attack target order.
Damage/destruction needs a described persistent consequence. Animation alone
cannot qualify. Other units firing forces ambiguous attribution; such a record
does not assert this objective was proven. Every result explicitly declines a
mission-win claim. These fields are human visual attestations, not automated
verification of game pixels or private world state.

The CLI supports `capture NAME`, `bind SCENE`, `admit-mission SCENE`,
`MODE NAME mousedown:X:Y MILLISECONDS SCENE [QUIT_ROUTE]`, and
`result NAME SCENE ATTACK_INTENT`. Reviews are append-only `SCENE-review.json`
records tied to the complete raw PNG hash and native identity. See the focused
tests for the required review fields. `FORSAKEN_CONTROL_OUT` selects the unique
run directory and `FORSAKEN_CONTROL_URL` the direct loopback endpoint.

## Bounded original and validation

Run-specific evidence belongs in
`scratch/runs/20261114-starcraft-enemy-consequence/`. The original uses one fixed
1200-second registered route, a prearmed independent 1220-second watchdog,
real ticks, default 1000 batches and cooperative mode. It follows the actual
Pegged and GLvisible terminal waits and heavy-lock release. No download,
alternate media, cheat, map seed, speed, AI, guest memory or configuration
change is allowed. Source recovery uses exact Git SHA plus binary diffs;
media is referenced by existing path and SHA-256.

## Observed result

**Enemy destruction proven; native Quit proven. Outer-wrapper wait evidence is
incomplete.** This does not establish a mission win.

After separately reviewed native briefing, Start and Tips dismissal, the actual
mission was admitted. The first selected Marine followed finite Move orders
while scouting and died before an Attack order; this was a friendly loss, not
credit toward the objective. Another supply reduction was observed without
attribution. No second mission, cheat or construction substitute was used.

A replacement Marine was personally selected on the eastern platform. Its HUD
showed **40/40 HP, Kills: 0**, with the weapon panel visible. One reviewed minimap
click revealed a red enemy Marine firing beside a burning friendly barracks.
At 417.105 seconds I clicked the visible **Attack** command. A separate current
raw scene showed **Select Target** and that red enemy; at 424.520 seconds I
clicked the enemy at the personally reviewed screenshot position.

The following observation showed red death remains where the enemy had stood,
with the selected friendly Marine below the barracks, **22/40 HP, Kills: 1**.
Later settled scenes retained the same selected Marine's kill counter and HP;
the enemy remained absent. No other friendly shooter was visible in these
scenes. The selected unit's counter increase supplies attribution beyond the
mere disappearance of an enemy. I did not sample the selected Marine's muzzle
flash; the death remains and persistent native HUD consequence are the proof.
A later disappearance without that counter change would not receive the same
attribution. The friendly burning barracks is ambient damage and is not claimed
as an effect of my order.

Eight selected complete 800×600 PNGs remain, with hashes and personal notes in
`personal-scene-reviews.json`:

| Scene | Observation |
| --- | --- |
| `original/bootstrap-current.png` | Actual native briefing menu, before permanent binding |
| `original/select-infantry.png` | Admitted unobstructed mission |
| `original/replacement-hud.png` | Selected replacement Marine, 40/40 HP, Kills 0 |
| `original/base-enemy-view.png` | Visible red enemy, selected armed-unit HUD and Attack command |
| `original/enemy-target-review.png` | Separate active Attack target review |
| `original/combat-observation.png` | Red death remains, selected Marine 22/40 HP, Kills 1 |
| `original/result-final-persistent.png` | Settled enemy absence and persistent selected-unit kill |
| `original/quit-confirmation-review.png` | Native exit confirmation with the result still visible |

Transient PNGs were submitted for personal review during operation, validated,
and then removed; their metadata/hashes and input receipts remain. There is no
frame series, source-tree archive or copied media/WASM in this run. Several
reviews expired before admission/arming and sent nothing; a new raw scene and
new choice were used each time. No input UNKNOWN, replay or rebind occurred.
The original contains 21 consumed finite left clicks, all 400 ms. Gameplay
intent ages were 3.442–4.609 seconds and were checked again before DOWN. All
21 independent release children exited 0 with actual waits and both EOFs, and
physical UP was acknowledged, including the final confirmation.

## Native Quit and missing outer proof

Quit began irreversibly at 488.589 seconds, before the 1020-second gameplay
cutoff. Each native step was separately reviewed: **MENU → End Mission → Exit
Program → “Are you sure you want to exit Starcraft?” → Exit Program**. The final
confirmation was consumed at 518.388 seconds. The log records guest
`[Exit] code=0`, CLI duration **519.380 seconds**, and the actual native wait
completed at **519.694 seconds**.

Native, watchdog and supervisor child each have actual exit-0 waits with both
EOFs. The watchdog exited unfired, the supervisor recorded heavy-lock release,
all four relevant process IDs were absent, and port 8607 was closed. No host
quit, cancellation request or deadline signal ended the native process.

The launching tool session returned **143** without its Python wrapper writing
`outer-wait.json`. The surviving outer process did record the actual successful
supervisor-child wait, but its own wait and separate EOFs cannot be recovered
from process absence. `original/outer-wait.json` and
`launch-wrapper-missing-proof.json` explicitly record `actualWait: false`,
`missingProof: true`; they do not invent exit 0 or EOFs. Thus combat and native
Quit have their own positive evidence, while the requested complete outer
closure proof remains missing. The coordinator explicitly released the next
independent task on the established terminal/heavy-release evidence while
retaining this gap. The closed original was not reopened or rerun.

The native log also retains two secondary-thread EIP=0 diagnostics and 26
abandoned parked critical-section enters; one thread remained active in the
final summary. Native Exit Program and process exit 0 do not establish clean
shutdown of every emulated thread. No runtime patch was attempted. The ancillary
read-only messageboard watcher likewise returned tool status 143 without a
separate child/EOF receipt; this is disclosed independently.

## Reproducibility and checks

Tested Git base: `ee9c89feb84901561d1999d9d5a9ba3fcdbaa8be`. Relevant uncommitted
runtime hunks and owned new controller/test files are retained as binary patches
in the run directory. The final report also has a new-file patch. The tested
WASM is referenced by path: 2,200,987 bytes, SHA-256
`c94ccf1b179f18bd4b47867445afed8cef2f1393b19aabfd259c7f3b94a7be09`
(the authoritative full hash is recorded in `launch-pins.json`).

Validation passed: **34 own policy tests, 12 actual HTTP tests, 10 actual CLI
and child tests**, plus `flock /tmp/wine-build.lock bash tools/build.sh` under
the heavy lock. The new combat sequence runs through actual controller CLI
children. Fault injection and synthetic review fields belong only to isolated
Solitaire fixtures; none was loaded into StarCraft.

Postflight checks found **2,948 pins, zero drift**. The unchanged registered
`ophelia terran1` app and all twelve existing media/system-data dependency files
matched the prior pins and their own before/after hashes. The existing missing
non-seed shell32.dll/builtin fallback was unchanged. All 64 transient/raw PNGs
passed CRC, inflate and 800×600 validation before pruning; the eight selected
PNGs were retained. No FPS, audio, browser parity, full-suite compatibility or
mission-completion claim follows from this run.

Box ID and expiry are null; state is **NOT_CREATED** and stop receipt is not
applicable. No box or worker was created. Work ends with publication of this
controller, its tests and this report; no further native action is required.
