# LMarbles pointer selection and Puzzle 6

The selection discrepancy is a CLI coordinate-press ordering defect. A press
at a new point called `handleMouseDown` without first delivering motion there.
SDL updates its mouse state from the button coordinates, but LMarbles classifies
its selected widget on SDL motion. A later move to the same point is suppressed
by SDL. Correct native WM coordinates therefore did not establish selection.

The permitted pre-fix diagnostic reproduced the level-6 reentry prompt at canvas
(354,330). Read-only inspection verified the original SDL_GetMouseState getter
bytes and relocated operands: SDL was at client (331,287), while LMarbles' last
motion remained (556,359), the sixth selector. Explicit same-point WM_MOUSEMOVE
left that mismatch intact. Moving to a distinct board point (322,330), then
onto the brown marble, changed the game's last motion to (331,287) and cursor
mode to 1. The following guarded press visibly selected brown at tile (8,7),
with selected flag 1 and a blue ring. No guest calls or state writes were used.
The distinct point was a wall, despite its initial controller label saying
empty; the reviewed subsequent action and state evidence correct that label.

`test/run.js` now sends motion before coordinate presses in both guarded and
ordinary delivery, including click/right/double click. Both effects remain
inside guarded consumption. The renderer, SDL, owner resolution, immutable
deadlines and terminal UNKNOWN behavior are unchanged. State-only DirectInput
button commands remain available. The regression uses the real CLI public
producer, guard and renderer, checking motion before DOWN, actual target HWND,
client offset, current pointer and ordinary click parity. It failed before the
repair and passed afterward, including the existing UNKNOWN/expiry controls.

Evidence is in `scratch/runs/20261114-lmarbles-pointer-puzzle6/`.
The diagnostic had a fixed 600-second cap and prearmed independent 620-second
watchdog. It quit through native Escape/Y, Back and actual Quit at 198.809s;
actual runtime/watchdog/supervisor/outer-child waits were 0 with separate EOFs.
No slides were attempted in that diagnostic. Actual Workers 1 and 2 were born.

The locked full build and focused guard regression passed. Adjacent input,
cursor and Worker controls are recorded in the run JSON. Existing failures
include WinMine startup missing COMMCTRL, the input-consumption fixture's
missing cliObservation binding, worker API batching's extra dx_trace null
argument, and the mouse_event fixture's X-button assertion. These do not use
the changed pointer path; unrelated WIP was preserved.

A separate public-path fixture also exposed the CLI's missing per-RPC-slot
input-event scope (another slot overwrites lParam/cursor snapshots). It is not
the observed LMarbles selection cause and is retained as a separate finding,
without an unrelated production repair.

Fresh fixed-900/920 validation remains to be recorded. Puzzle 6 clear, tally,
next Puzzle 7 and validation Quit are not yet claimed. Full 27 remains unproved.
No box was created: ID none, state NOT_CREATED, expiry null, stop receipt N/A.
