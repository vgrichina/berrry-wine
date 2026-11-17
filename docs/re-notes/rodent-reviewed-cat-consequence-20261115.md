# Original Rodent: personally reviewed level 1 attempt

Run: `scratch/runs/20261115-rodent-reviewed-cat-consequence/`.

This task concerns registered `wep16_rodent`, the original WEP2 VB1 NE
executable, and excludes the Rodent2000 remake. Historical batch schedules,
F2, options and level-edit tests are fixture references, not this game's
gameplay evidence.

The self-contained controller accepts one personally selected arrow press
and independently releases it. It requires current full-scene reviews (five
seconds for board actions, thirty for menus), an unchanged native PID/start
token and loopback socket owner, one permanent window binding, a unique
nonce, and a focused visible child keyboard consumer. The independent UP is
armed before DOWN; ordinary gestures must finish within 1500 ms and the
independent fallback is prearmed at 1750 ms. UNKNOWN closes the route without
replay or rebind. Native Quit reserves the last 180 seconds irreversibly.
Receipts assert transport consumption only. Player movement, block movement,
cat/cheese changes and score/level changes require separate pixel reviews.

Light preparation passed 28 synthetic policy tests and nine HTTP fault
tests. After actual cursor and Chips releases, the full locked build passed.
The native CLI controls use Notepad's actual focused EDIT child: a Right
pair changes its caret x from 4 to 12. DOWN is consumed through synchronous
native SendMessage; UP reaches the child's native message loop. Expecting a
second queued DOWN was an incorrect test assumption. The fixture explicitly
uses native SetFocus on its unique EDIT child; Rodent has no such setup.
The parent-death control waits for both UP and the subsequent terminal file,
avoiding a race between their separate durable writes. No runtime fix was
needed for either fixture correction.

The current native Help decoder read all 13 installed RODENT.HLP topics.
Green/grey blocks move when pushed; light-blue blocks are stationary.
The goal is to enclose cats in 1x1 rooms. Cats, traps and purple yarn kill;
sinkholes temporarily immobilize; the game allows three lives. Cheese gives
100 points plus a level bonus, and finishing a level gives 100 times the
level plus 100, with faster completion scoring more. Help describes numeric
keypad movement including diagonals; this bounded route uses only cardinal
arrows, whose actual visible effect must be reviewed separately. Game Exit
may be used during play. F3 is excluded, and no paused-time claim is made.

The route was published before the single original run at commit
`21a15c8182a6d20e361e1a5bfd9566df5061d524`.
Final validation passed all 28 policy, nine HTTP, and eleven actual CLI
controls, including UNKNOWN, late ACK, changed focus/window identity,
independent UP, silent-parent fallback, release-child death, parent death,
native menu consumption, and capture after UP. Native/watchdog/supervisor
waits are retained; orphan release-child waits remain explicitly unknown.

Static NE inspection shows RODENT imports only VBRUN100 ordinal 100.
FIELD100 and WEPUTIL are declared runtime modules in the registered route;
FIELD100 is also mounted as data because VB opens it through the filesystem.
The launch manifest pinned 513 files: complete WEP2 media, DLL candidates,
type libraries, fonts, WASM, relevant source, helpers and host libraries. Git
commit and a 57,714-byte binary diff preserve source identity without copying
source or media. All 513 listed files were unchanged after shutdown.
However, the actual PATH-selected Node binary was not the pinned /usr/bin/node:
`/home/user/.nvm/versions/node/v24.18.1/bin/node` had SHA-256
`f3432a45b03b2da0d270095fdd8813dc34cbea73f5fc8b18c7a384b7cf9b333a`.
Seven of eight actual mapped host files were pinned before launch; this Node
pin was collected afterward. Complete prelaunch host closure was not achieved.
The next route must resolve and pin the actual executable before launch.
Native startup logs show VBRUN100 loaded as module 13 and FIELD100/WEPUTIL
registered as modules 14/15 for LoadLibrary; registration alone is not a
separate claim that every module was dynamically called.


The original attempt is an honest partial. One native New Game began default
level 1. I personally read each current full scene and selected five finite
80 ms arrow pairs: two Up and three Right. Transport ACKs are separate from
the visible evidence: selected `live-three.png` and `pushed-one.png` show
the player moving from approximately (397,296) to (397,284), a 12-pixel cell,
the vacated cell becoming olive, and the pushed green column extending one
cell above its former edge. The final selected `final-game.png` shows the
player at (433,272), an L-shaped vacated corridor and the pushed row extended
to x=517. The score rose from 4 to 12 while the native clock ran; I do not
credit that increase causally to the pushes. No cat trap, cheese, death, or
level completion was established. No level/options edit, F2, F3, restart,
redeal, second original game, or game-state reader was used.

After the final capture, I mistakenly attempted to reuse its capture name.
The controller rejected this before observation/input and durably closed the
route with `capture name collision before observation`. A subsequent fresh
capture was rejected by that sticky terminal guard. I did not clear the
guard, replay, rebind, or send any further input. Native Game → Exit was
therefore not completed. This is a procedural failure, not an unknown key
being retried or a native Quit claim. The conservative terminal policy was
left intact; no runtime fix was warranted by these observations.

An explicit supervisor cancellation shut down the host, distinct from native
Quit. Actual native PID 77251, watchdog 77250, and supervisor 77232 waits
returned 0, with both EOFs and heavyReleased true. Their PIDs and outer PID
77231 were absent, and port 8653 was closed. The ancillary invoking tool
returned 143 without an actual outer wait record: that outer wait remains
UNKNOWN, separate from the actual child waits. Independent deadline watchdog
was prearmed for 1220 seconds; native bound was 1200 seconds, real ticks and
default 1000 batches. Cancellation ended the attempt earlier. No boxes were
created; box ID/state/expiry are null/NOT_CREATED/null and stop receipt is
not applicable. Runtime/source pins were released to the next assigned worker
after actual shutdown and postflight checking. Evidence retains only three
selected result-named PNGs and compact logs, with no source/media/WASM copies.
