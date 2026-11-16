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
default is a 64-cell cube. The original's complete initial pixels confirmed all four 4×4 layers empty
before gameplay.

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
The complete initial original pixels showed all 64 cells empty and Blue to move;
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
The sole original followed the full locked build and explicit publication.


## Original result: partial game, native Close

Code was published on main as `b2210743410396469c7b6cbd30f2bedecd2b82e6`
before the sole original. Its launch Git SHA was
`b06f21ddba0086afb4dc0a878138d1ad1e61799a`; relevant dirty source hunks are
retained as `relevant-uncommitted.patch`, and the initial owned new files as
`owned-initial.patch`. No registry or runtime source change was warranted.
The locked build passed in 38.410 seconds. It overlapped the final synthetic
CLI controls briefly; the built regular and compat module hashes exactly
matched the released Golf modules, and the original began after both waits.

The native process was permanently bound as PID 4122226, start token
`274486002`, main window `0x10001`, screen 800×600. The fixed launch was
1200 seconds, real ticks and default batch size 1000, with an independent
1220-second watchdog and an irreversible final 180-second Quit reserve.
No ordinary Start was needed: the initial native window already contained
the untouched default game. No second game, restart, option change or rebind
occurred.

Layer numbers run top to bottom; rows run back to front, columns left to
right. Every unlisted cell remained empty. The model personally chose each
placement after reviewing its complete current scene; there was no board
reader, solver, tracking process or queued action list.

| Input | Own persistent effect | Separate computer reply | Evidence |
| --- | --- | --- | --- |
| Blue L2 row 2 column 2, pixel (266,175) | Blue appears at that cell | Red L4 row 4 column 4 | `choice8` review, `move1.png`, consumed receipt and UP ACK |
| Blue L2 row 2 column 3, pixel (287,175) | Both Blue pieces persist | Red L4 row 1 column 4; earlier Red persists | `choice12` review, `move2.png`, consumed receipt and UP ACK |

Final complete board, `B` Blue/human and `R` Red/computer:

```text
L1: .... / .... / .... / ....
L2: .... / .BB. / .... / ....
L3: .... / .... / .... / ....
L4: ...R / .... / .... / ...R
```

Blue was next. No native win, loss or draw was visible. Further placement
proposals expired before intent creation or input, so a third move was never
sent. Complete-scene presentation and tool turnaround repeatedly consumed
the five-second freshness allowance. Some image presentations appeared
blank despite byte identity with the complete retained PNG; this was not
claimed as a blank native board or a new board state. Rather than relax
freshness, the run ended as partial.

The complete native caption Close was personally reviewed from `move2.png`,
which `cmp` proved byte-identical to the fresh `quit2.png` scene. The one
Close click at (367,41) was consumed; its independently prearmed physical UP
received ACK. The original then returned `[Exit] code=0`. Native PID
4122226, watchdog 4122225 and supervisor 4122223 have actual waits, both EOFs,
and absent exact PIDs. The supervisor recorded heavy release, port 8627 was
closed, and the independent deadline watchdog did not fire. This establishes
native Close separately from host teardown. The outer interactive tool
session returned 143; that ancillary value is preserved, not substituted for
the actual native/supervisor waits. Native exit reported one held main
critical section, so no all-thread-clean claim is made.

## Evidence limits and retained artifacts

The 339 launch pins matched at final readback, including the registered
28,432-byte executable and unchanged SHA-256 above. The registered route has
no explicit DLL closure. The runner nevertheless auto-loaded
`test/binaries/dlls/msvcrt.dll` (278,581 bytes, SHA-256
`887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`).
It was omitted from the before-run pins: its post-run identity is recorded,
but its before hash remains UNKNOWN. Thus the complete dynamically loaded
media closure is not claimed to have a proved before/after match.

The synthetic parent-death orphan's unavailable wait remains UNKNOWN in the
control evidence. It is not original-game outcome evidence. Redundant
passive PNGs are removed with their hashes and selected-image aliases kept;
only the initial scene, first reply and final partial board PNGs remain.
The run contains compact logs, actual wait records, result JSON and Git
patches; no source tree, media, WASM copy or frame bundle. No box was created
(box ID/expiry null, state NOT_CREATED, stop receipt NOT_APPLICABLE), and
/home retained over 1.5 GB free. The next heavy worker was explicitly released;
this bounded task makes no further original input or launch.
