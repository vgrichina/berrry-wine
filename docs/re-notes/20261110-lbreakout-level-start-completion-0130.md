# LBreakout original level-start completion, 2026-11-10

Repair `b56fdfc8e` is published on main. Premature level-start images are now
withheld, but authentic pause and score progress remain unconfirmed. Evidence is in
`scratch/runs/20261110-lbreakout-level-start-completion-0130/`.

The prior first level-start image followed a fixed 800 ms wait. Its retained
state still showed SDL execution and queued Enter release; it did not establish
completed original drawing. Original `_client_game_init_local` calls
`_init_level`, builds the board/frame/bricks/lives, sets state 8, and returns
success. `_client_game_run` subsequently calls `_stk_display_fade(0,350)` at
`0x41faed`, returning at `0x41faf2`. The fade routine explicitly fills and
updates a black intermediate surface. The first gameplay iteration draws its
dynamic objects and calls `_stk_display_update(1)`, returning at `0x42047a`.

The generated consumer now supports a level-start completion phase for native
Enter. Its passive observer requires local-init entry and actual caller return
(including stack and success result), game-run entry, fade return, first
gameplay display-update return, state 8, and released SDL Enter. Authentic media,
instruction anchors, module generation and owning Worker are checked. A bounded
page-frame barrier follows guest completion before the first image. Command,
module, incomplete observer, observer failure, and failed page presentation
close the consumer terminally before that image or any later action. The
two-second observer bound and immutable runtime deadlines remain unchanged;
there are no guest state/clock writes or artificial guest handler calls.

Validation passed: generated passive level-start observer, existing pause
observer, six actual generated browser-consumer modes with native process/CDP
adapters, original SDL x86 controls, eight inspection tests, native-key tests,
and the locked full build. Accepted fixture `4fc62b7d7` was independently
hash/size checked and reused unchanged without rerunning it.

The single authorized original attempt uses fresh box `bx_6sjht5rk`, prearmed
immutable watchdog UUID `81ac0ec9-d5c1-4582-853d-fc3f52d1ab55`. Original API
expiry is 01:59:08.720 UTC; watchdog deadline is 01:59:09.096962 UTC.

Six images were individually reviewed: loading, main menu, Local Game selected,
local submenu, Resume selected, and Start Original Set selected. Native balanced
Down/Enter pulses visibly navigated those menus. The start command armed at
01:36:36.830 UTC; the original local-init entry was observed at 01:36:38.111 UTC.
No local-init return was observed before the unchanged two-second deadline at
01:36:38.830 UTC. The observer stopped with `deadline`, and the consumer failed
terminally at 01:36:39.014 UTC before any first level-start image. This establishes
an unfinished initialization within the bound, not a completed black board or
an original-game hang. No deadline extension or second live attempt was made.

The consumer sent Chrome SIGTERM; immediate owning cancellation found Chrome
6183 already absent and sent Node 6152 SIGTERM. The actual parent wait returned
-15, with independent stdout and stderr EOF records. No later game protocol,
input, capture, retry, quit, or extension followed the first refusal. There was
no P input, ball launch, score increase, life loss, or level-clear acceptance.

All 101 artifact references, 88 unique contents, were retrieved and independently
SHA-256/size verified before the sole delegated normal stop. All 822 runtime
pins remained unchanged; all six PNGs passed CRC/decompression checks. Unforced
stop `stop_8db3230dd595bf6c` completed at 01:37:59.278 UTC. Independent API state
is archived/stopped, expiry null. The watchdog's actual wait returned 0 with
stdout/stderr EOFs recorded; immutable UUID/deadline verification passed.
Previous boxes were untouched. Q3, Nox and shared providers remained read-only;
no nested workers, local Chrome, source archives, or evidence media copies were used.
Home remained above 1.5 GB free.

The remaining blocker is original local initialization not returning within the
existing observation bound. Any next task should diagnose that work offline
before a separately authorized live attempt. The current run cannot demonstrate
authentic pause or score because it correctly stopped before the first board.
