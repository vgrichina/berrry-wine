# SuperTux 0.1.3: current browser level progress, 2026-11-08

Reviewed original **Welcome to Antarctica** gameplay establishes same-life
movement, jumps across visible obstacles, collected coins, and a defeated enemy.
The level was not cleared. Both deaths and respawns are retained.

Evidence: `scratch/runs/20261108-supertux-current-browser-level/`.
Only this note was committed; no emulator, timing, registry, or media change.

The tested source was main `e5b25e81505f5f153102e513bc45d15cdddc0ee9`.
The executing guest Worker module was recovered through CDP and SHA-256 matched
the staged build:
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
`runtime-pins.json` records 1,376 runtime inputs. The tracked source patch is
empty; the existing untracked `lib/wininit-boot.js` is preserved as a patch.
The owned harness and this note are also retained as patches, without a source
tree archive.

## Original route and controls

Reused the registered `supertux_013` working directory, `--sdl --datadir data`,
six original DLL seeds, and authentic corpus MSVCRT unchanged. No reacquisition
or installer execution. `tools/verify-supertux-013.js` passed before and after:
787 originals, 16,107,101 bytes, authentic CRT, 786 exact manifest mappings.
HTTP response sizes and hashes independently matched all 787 original files
and the CRT (`http-original-proof.json`). Media recovery remains referenced at
`scratch/runs/20261108-supertux-media-recovery/ready.json` and its recipe.

The shipped README names the actions; the reviewed native Options → Keyboard
Setup confirms **Jump: Space; Power/Run: Left control; movement: cursor keys**.
The ordinary route was Start Game → Slot 1 Free → story → world map → Down
to the first red node labelled Welcome to Antarctica → Enter. Intermediate
loading and story screens are preserved, not counted as gameplay.

Chrome 151.0.7922.108 ran the ordinary browser scheduler with threads enabled.
Trusted-CDP single keys and exact Right+Space, Left+Space, and
Right+Control+Space combinations were checked on blank documents in this same
fresh browser before their game use. Tests include independently scheduled UP,
delayed/rejected/pending acknowledgements, and 100/250/500/1000 ms combo holds.
Generated UNKNOWN cases are isolated controls; original game input had none.
Every game action was admitted against reviewed pixels and current process,
Worker, module, renderer, and canvas identity. There are 39 exact command ACKs,
47 balanced key/mouse pairs, 95 trusted native events, and no held inputs.

## Reviewed consequences

The first life begins in `review/level-ready.png`: four lives, score 250,
coins 10, time 292. Right moves Tux away from the starting grass and advances
the camera; Right+Space visibly ascends over the leading question-block edge
and lands atop the row. An approaching ground enemy then contacts idle Tux
around 02:57:03–04Z. The death animation and native Tux × 3 introduction are
visible in `review/first-death.png`. `pillar-before` is already the respawn and
is excluded from the first-life proof.

The second life has a complete movement/jump/consequence sequence:

| Reviewed capture | Consequence |
| --- | --- |
| `life-two-under-block` | Right moves Tux below the first question block; three lives, score 250, coins 10. |
| `life-two-jump-coin` and its arc sheet | Space hits the underside; the question block becomes spent, score rises to 275 and coins to 11. Tux lands with three lives. |
| `coin-backstep`, `jump-room` | Left moves Tux against fixed scenery without a respawn. |
| `second-life-on-blocks` and its arc sheet | Right+Space ascends before the row, crosses its leading edge, and lands on top; three lives and the spent block persist. |
| `snow-pillars-after` and its arc sheet | A ground jump crosses both snow pillars; the camera advances and Tux lands beyond them. Three lives, score 275, coins 11 persist. |
| `run-jump-progress` | Running jump reaches the next elevated row and collects an airborne coin: score 300, coins 12. |
| `gap-platform-after` and its arc sheet | Jump crosses the raised platform and collects three coins; a flattened enemy and floating 50 appear at landing. Score 425 = prior 300 + 75 coins + 50 stomp; coins 15, three lives. |
| `tall-platform-after` | Another platform crossing collects two more coins: score 475, coins 17, three lives, time 125. |

The second life ends when approaching ground enemies contact idle Tux around
03:00:09Z. `review/second-death.png` preserves the approach, death animation,
and Tux × 2 introduction. The later `three-pillars-jump` command was dispatched
after that respawn and moved the new life near the initial block row. Its
intended destination is **not** evidence of clearing the three-pillar section.
Final HUD: two lives, score 475, coins 17, timer reset to 296.

All named captures and the seven contact sheets were personally reviewed.
The passive sequence retains 1,201 timestamped frames. Its fixed crop loses
the HUD after the page changes layout; full command captures and jump arcs
retain the HUD. Screenshot dimensions/layout vary, so positions are compared
against visible scenery rather than treated as a fixed physical scale.
No private game state, clock, tick, configuration, or guest variable was edited.

## Retrieval, shutdown, and limits

1,682 remote evidence references, 192,829,399 bytes, 848 distinct content hashes
were retrieved and SHA-256 verified before normal box stop. Pins were unchanged.
The first terminal cleanup assertion failed without reporting its predicate;
that failure and first-error record remain. A separate read-only diagnosis and
final custody check passed: browser/controller absent, both ports closed,
profile/writer lock absent, no owned live runtime, all keys up, Chrome exit 0.
The exact initial failed predicate is unknown; no game request was replayed.

Fresh UUID allocation `bx_tbegz496` had an independent observable 25-minute
watchdog prearmed before creation. After evidence retrieval it was normally
stopped at **03:01:46.767Z**, state **archived**, current expiry **null**;
initial expiry was **03:16:33.971Z**. Stop
`stop_5bce0974f6ca118a` completed at 03:01:46.794Z, `forced=false`.
Both lifecycle delegates exited 0 and their supervisor has no children.
No resume, delete, public hosting, nested worker, or RAM gate was used.

This qualifies scoped original SDL Canvas2D browser level action/progress.
It does not establish an exit, checkpoint, GL rendering, FPS, audio quality,
or full playability. Next work is a separate first-level-clear attempt with
prompt reactions to approaching enemies instead of idle review gaps.
