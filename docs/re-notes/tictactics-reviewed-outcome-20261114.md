# TicTactics: one reviewed registered original, 2026-11-14

The registered `tictac` route in `lib/apps.js` selects the existing local
`test/binaries/entertainment-pack/tictac.exe` (28,432 bytes, SHA-256
`0c42754ee5441d74ded4e8389817ec7c7b834984a2c81c4807ab22c0afed3e37`),
with runSlice cooperative 25000 / compat 100 and no declared DLL or file closure. Exact media sizes and
SHA-256 are recorded in `scratch/runs/20261114-tictactics-reviewed-outcome/`.
No download, alternate executable or configuration change is authorized.

## Rules established from the native executable

This is not assumed to be ordinary 3×3 tic-tac-toe. Resource menu entries offer
3×3, 3×3×3 and 4×4×4. The preference reader at `0x01002040` calls the clamping
profile helper `0x01001f70`: key index 4 (`Game`) defaults to 2, range 0–2
(`0x010020cd`–`0x010020da`). The shape initializer `0x01003560` maps 0 to
width 3 / one layer, 1 to width 3 / three layers, and 2 to width 4 / four
layers. It computes cells per layer as width squared and total cells as that
product times layers (`0x01003631`–`0x0100364e`). Thus the absent-profile
default is a 64-cell cube. The original's actual visible shape still needs
personal review before gameplay.

Native pixel-to-cell mapping is `0x010014c0`; `0x010015c0` accepts a mapped
cell only when it is not -1 and its native occupancy is zero. Mouse-down
previews a valid cell; mouse-up commits it (`0x01001ab7` onward). The native
commit routine `0x01002d50` paints the current piece, checks a winning line,
checks full-board exhaustion, switches players with XOR 3, and invokes the
computer only on player value 1 (`0x01002de4`–`0x01002e00`). This establishes
separate own placement and computer reply; receipt consumption alone proves
neither persistent board change nor a natural outcome.

The rule initializer builds native winning lines from the static direction
table at `0x01005050`. For the width-4 variant, the outcome checker at
`0x01002b70` requires four equal nonzero pieces on a generated line. The
width-3 path compares three. Winning pieces are retained for native flashing;
full-board exhaustion ends play. Startup `0x01003760` chooses the starting
player from the untouched Start preference, randomly when it is zero, and
can immediately place a computer opening. Human color and actual next turn
must therefore be established from complete original pixels and this native
mapping, not from the title or a presumed X/O convention. No live board memory,
seed, solver, minimax or native AI move computation is read or reproduced.

The native menu IDs further establish color identity without assuming X/O:
“Random player starts” is ID `0x6f`, “Red always starts” is `0x70`, and
“Blue always starts” is `0x71`. The unchanged start-option handler at
`0x01001827` subtracts `0x6f`, so native player 1 is Red and player 2 Blue.
The commit path invokes the computer on player 1, making the human Blue.
Actual initial occupancy and next turn still require the original pixels;
these static menu labels are not a reason to change the starting preference.

## Guarded controller

`tools/tictactics-controller.py` derives finite single-click transport from
the released turn-based controllers. It requires a permanent PID/start/window
binding, a personally reviewed complete board, rules and player/turn evidence,
an empty target and a settled opponent before each placement. Placement scenes
expire after 5 seconds; menu scenes after 30. There is at most one ordinary
bootstrap Start and an irreversible final 180-second Quit reserve.

Each action prearms an independent 1750ms fallback UP, validates a unique
nonce and owner/epoch receipt, and joins the release child before capturing.
UNKNOWN, mixed identity, cancellation, late ACK and child death close input
without replay or rebinding. Policy and transport fixtures establish controls,
never original-game progress. Evidence retains compact logs, selected PNGs,
Git SHA and binary patches, without source or media snapshots.

Validation: 19 policy tests, nine loopback HTTP controls and ten actual CLI
controls pass. The actual CLI cases cover a finite pointer pulse, late ACK,
UNKNOWN after consumption, cancellation, window replacement, release-child
death, parent death, fallback UP and capture ordering. They use a synthetic
Solitaire fixture and establish no TicTactics game progress. One HTTP fixture
initially read the terminal record before the release child finished writing
it; waiting for that terminal record fixes the test-side race.

GLtron ticket-lifetime and Golf actual waits, both EOFs, heavy release and
absent exact PIDs have been personally checked before starting heavy work.
The sole original follows the full locked build and explicit publication.
