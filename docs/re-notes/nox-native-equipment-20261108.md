# Nox native staff pickup, equipment and action, 2026-11-08

Run `20261108-nox-native-equipment` demonstrates native **Force of Nature Staff
of Recharge pickup, automatic equipment, inventory/HUD change and a visible
weapon action with charge consumption** in the registered original demo.
This extends the accepted movement/jump/potion evidence. No target damage,
kill, objective completion, audio-quality, FPS, GL or full-playability claim is
made. No emulator or registration changes were required.

Evidence is retained in `scratch/runs/20261108-nox-native-equipment/`.

## Personally reviewed native sequence

The sole original session used `?candidates&no-log&threads&app=nox_demo` through
Multiplay → Network → Host Game → ordinary map flag placement → Conjurer →
default Jack → Chat Area → native Game panel, Bunker/Arena → GO. No peers or
network gameplay were used. The native class panel explicitly permits bows
and staves. The shipped `default.cfg` maps I/Q to inventory, V to weapon swap,
left mouse to Action/pickup, right mouse to movement, and Home to server menu.
The shipped readme describes Conjurer staff blocking; the native Chat Area
help explicitly says attacks are unavailable there and explains Home.

| Observation | Paired evidence under `review/` | Reviewed result |
|---|---|---|
| Inventory baseline | `inventory-before.png` | Shirt, pants and shoes; fourth top-row slot empty; fist equipped. |
| Equipment identification/pickup | `staff-hover.png`, `staff-pickup.png` | Native `PICK UP / Force of Nature Staff of Recharge`; left pickup removes floor staff, Jack holds the green staff and the fist HUD changes to staff plus purple meter. |
| Inventory and character equipment | `inventory-staff.png`, `staff-inventory-info.png` | Fourth slot gains staff; character preview holds it; native inventory hover repeats its name. |
| Weapon action | `staff-ready.png`, `staff-action.png`, `staff-action-settled.png` | Ordinary left Action produces green energy/particles around Jack; small HUD indicator changes 3 → 2 and purple meter shortens. Settled scene retains equipped staff and charge 2. No hit target was identified. |

Jack reached the staff by following the starting corridor northwest, passing a
room containing a native-labeled Long Sword, shield and helmet, then traversing
the next doorway into the blue-flame room and approaching its northwest alcove.
The sword stayed on the floor after distant and nearby left clicks; its nearby
hand cursor was red-marked. Class incompatibility is a plausible explanation,
not an established emulator defect. The pale object inside the central flame
ring was not identified. The staff later reappeared on the floor while Jack
still held the acquired copy; original `ItemRespawn = 1` remains unchanged.

Nox's relative cursor and native cursor warps required ordinary edge-to-edge
mouse alignment at title/menu and flag placement. An early Multiplay click,
one mislocated Host click and one customization click during panel animation
missed; they are retained as misses. The first Home closed an already-open Game
panel; the second reopened it. All subsequent actions used newly reviewed
captures, not assumed host/game cursor agreement.

## Local transport qualification and original identities

The old cold 50 ms preflight was not rerun unchanged. The run reuses the released
Heretic II capture/owner chain, numbered atomic publisher/consumer, exact ACK
checks and native mouse composition, with the production native input helper's
independent release and delivery-completion assertion. Scratch descriptors add
V/B/Q alongside the already supported I/Home/Space. Original gameplay uses
250 ms inventory/Home pulses and bounded mouse holds.

Before allocation, `generated-composed/` passed actual Chromium tests for the
exact keys I/V/B/Q/Home/Space and both mouse buttons through both helper layers;
native click composition for left/right; five owner/process/endpoint/Worker/
module/epoch replacement refusals; stale/slow capture refusal; partial delivery
cleanup; exact positive key/combo requests; wrong ACK identity; sticky UNKNOWN
and late ACK closure; and independent release during delayed sampling.
`cold-delivery-cause.json` injects 120 ms completion delay after actual native
keydown: the 50 ms case fails the unchanged delivery assertion and independently
releases; the 250 ms case passes and releases. This is a controlled reproduction
of the timing mechanism, not a recovered timing measurement from the prior run.
The exact production entrypoint then passed its 250 ms native preflight and
stopped at the no-original-launch boundary locally. It also passed remotely.
Three `ops/browser-native-input.test.cjs` regressions passed. No shared helper
or WAT/JS emulator defect/fix is claimed.

The retained original manifest matched all **125 files, 50,450,550 bytes**,
with no missing/extra installed files. The registered manifest's 124 data files
plus separately loaded EXE equal that closure. EXE SHA-256 remains
`496123ad275e5d626f31a845033c7ddb7d86fbbf3c2532d2e1f639f8bc77a781`.
`fixture-identity.json` and `closure-verification.json` retain these checks;
media is referenced by existing paths and hashes, not archived/copied locally.

Source commit: `9d2050843b40d19314a41741dd8463fc7e042c95` on main.
`source-sha.txt`, `relevant-source.patch`, run helper/new dependency patches and
`runtime-pins.json` retain recovery inputs. Git is the source archive; no source
tree or repeated media archive was made. All **766 pins** matched before launch
and after teardown. The actual recovered guest module is 2,182,500 bytes, SHA-256
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.

Actual rendering was page `Win98Renderer` with its existing
`CanvasRenderingContext2D`, guest Worker endpoint 1/slot 0, and two additional
guest thread slots. No owning D3D render endpoint/Worker was present. A renderer
selector is not counted as GL coverage. Chrome was `151.0.7922.108`, V8
`15.1.206.16`, native viewport 945×889, no viewport emulation; intrinsic canvas
640×480, page rectangle 945×855 at top 34.

No guest configuration/state/clock edits, private handler calls, cheats,
fabricated saves, source/media archives, public deployment, nested workers,
second box, resume or delete occurred. Local preparation errors (manifest
`game/` prefix and compressed predecessor pins) happened before allocation and
are retained; neither was passed off as transport success.

## Recovery and lifecycle

Fresh UUID box `bx_umftmwa6` was created at 00:49:25 UTC with initial expiry
01:14:25.094 UTC. Observable detached normal-stop and watchdog delegates were
armed before allocation; immutable watchdog deadline was 01:14:24.870 UTC and
browser deadline 01:11:24.870 UTC. One heavy browser and one original guest
session ran. There were 43 exact ACKs, no original UNKNOWN or replay.

Chrome exited 0 without a signal at 00:58:22.621 UTC. Both ports closed and its
profile/writer lock disappeared. The first teardown assertion found controller
PID 6348 still draining after Chrome exit; later read-only inspection confirmed
it absent, and `terminal-drained-remote-result.json` records both PIDs absent,
all ACKs matched and every staged pin unchanged. This passive recheck did not
replay any input. Unique evidence, live module, final lifecycle state and stop
receipt are recorded by the run's final verification and recovery records.

All 490 evidence references were retrieved and hash-verified before the stop
request, recorded in `retrieval-verified.json`. The final stop receipt
`stop_53ae591d4caaee85` completed at **2026-11-08 01:00:15.813 UTC**,
`forced=false`, with box `bx_umftmwa6` archived and expiry cleared. The detached
watchdog observed normal stop. The DOM event recorder did not include mouse-up
events, so it cannot independently prove mouse-event balance; exact command
ACKs, the independent-release helper and final browser/process teardown are
the retained evidence, rather than a claim of complete DOM-event balance.

The worker launcher ended with signal 143 during final documentation checks,
after retrieval and shutdown, before producing `result.json` or `final.txt`.
The cause of that termination is unknown. The coordinator verified the matching
processes were absent, reclaimed this unfinished note, inspected the inventory,
pickup and before/action/settled captures, and completed publication from the
retained evidence. This is an interrupted worker result, not a clean terminal
worker pass; no original input was repeated or box resumed for recovery.

Next meaningful extension is an observed staff projectile/impact against an
identified target or another native objective, in a separately assigned run.
The requested equipment/action consequence is demonstrated; this worker stops.
