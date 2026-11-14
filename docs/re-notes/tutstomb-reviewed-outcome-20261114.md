# Tut’s Tomb: reviewed original deal, 2026-11-14

Evidence directory: `scratch/runs/20261114-tutstomb-reviewed-outcome/`.
This report is prepared before the one original and will record its actual
visible outcome, including partial progress when native evidence is absent.

The route uses registered `wep16_tutstomb`, the existing local
`test/binaries/wep16/WEP2/TUTSTOMB.EXE`, its help file, imported CARDS, and
runtime WEPUTIL. No downloaded or substituted executable is involved.
The original’s module-reference table names win87em, KERNEL, GDI, USER,
SOUND and CARDS. CARDS and WEPUTIL each import KERNEL, GDI and USER.
The runner handles the system modules and win87em internally; CARDS is a
real local NE DLL. A registered manifest alone is insufficient to establish
the media closure. Before-launch pins and actual module logs must agree;
an unexpected unpinned dynamic module remains unknown. The earlier
TicTactics MSVCRT before-hash omission remains a gap in that separate run.

The native notes identify the important input behavior: WM_LBUTTONDOWN
acts on the card remembered by WM_MOUSEMOVE, not the DOWN coordinates.
The existing coordinate-press path in `lib/renderer-input.js`, enabled by
`test/run.js`, supplies pointer arrival and a separate 30ms hover pump before
DOWN. The controller chooses one coordinate press, never a hidden second
click or raw native-message bypass. Transport acknowledgements establish
neither selection highlighting nor actual card removal.

`tools/tutstomb-controller.py` requires a personally reviewed complete
default pyramid before permanent PID/start/window binding and admission.
Gameplay reviews expire after five seconds; menu reviews after thirty.
Each first pair member requires a personally chosen visible partner. A
second member requires a separate current scene showing the first selection,
its earlier action, and visible ranks totaling thirteen. A King is single.
Stock actions require a visible legal target and personal justification;
recycling additionally requires the visible draw-three rule. There is no
Start, Deal, New session, undo, solver, card reader or move generator route.

Every gesture independently prearms its 1750ms fallback UP and has a finite
1500ms limit, unique nonce and no replay. UNKNOWN, mixed identity, cancelled
input, late acknowledgement and release-child failure close gameplay.
The fixed runtime reserves an irreversible final 180 seconds for native Quit.
Native UI Exit and host teardown are recorded separately. A normal native
wait can justify OWNER_EXITED when final physical UP has no acknowledgement;
it cannot turn that absence into a physical UP claim.

## Rules and controls reviewed before launch

The built WAT help parser decoded all eleven topics of the existing local
TUTSTOMB.HLP. The native rules define a free card as one with no card above
it, pairs totaling thirteen, Ace one, Jack eleven, Queen twelve and King
thirteen. Kings are removed singly. Only the top turned-over stock card can
be played. Clicking the face-down stock turns one or three cards according
to the untouched options; the green-circle recycle is allowed only for
draw-three. Winning means removing the whole pyramid. The help explicitly
says the first selected card is highlighted, then a successful pair moves
to the upper-right corner. The Casino score is +13 per match, -28 per deal,
-1 per flipped stock card, -1 per ten seconds and -5 per recycle. No Options
control is used to change the original default.

Twenty-five policy tests, nine HTTP controls and eleven actual CLI controls
passed. The latter use a separate Solitaire fixture, establishing transport
behavior without claiming Tut’s Tomb gameplay. Actual renderer dequeues and
native DispatchMessage traces show hover at 1794699467810ms and DOWN at
1794699467840ms: separate pumps thirty milliseconds apart. One native menu
control opened the fixture's first menu. The full build passed under both
the heavy-runtime lock and `/tmp/wine-build.lock` in 49.081 seconds.
The controls cover UNKNOWN after a consumed click and dropped reply, window
replacement, cancellation, late ACK, release-child death before DOWN,
independent fallback, parent death and capture after UP. All eleven native,
watchdog, supervisor and outer fixture waits have actual EOF evidence;
orphan release-child waits after parent death remain unknown.

The initial light policy test caught a missing diagnostic; the initial HTTP
parent-death check raced the release child's terminal-audit write. Both were
corrected and their failed logs retained. The older JavaScript HLP helpers
did not decode this help format correctly; the built native parser above
provides the complete readable rules instead.
