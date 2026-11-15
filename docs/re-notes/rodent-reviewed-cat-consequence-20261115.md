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

The single original run has not yet been launched at route publication.
Final validation passed all 28 policy, nine HTTP, and eleven actual CLI
controls, including UNKNOWN, late ACK, changed focus/window identity,
independent UP, silent-parent fallback, release-child death, parent death,
native menu consumption, and capture after UP. Native/watchdog/supervisor
waits are retained; orphan release-child waits remain explicitly unknown.

Static NE inspection shows RODENT imports only VBRUN100 ordinal 100.
FIELD100 and WEPUTIL are declared runtime modules in the registered route;
FIELD100 is also mounted as data because VB opens it through the filesystem.
The complete WEP2 directory, DLL candidates, type libraries, fonts and actual
runtime/source closure will be pinned after predecessor releases. Git commit
and binary diffs preserve source identity without copying source or media.
