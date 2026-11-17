# Native SDL pointer arrival and LMarbles Puzzle 7

Status: BLOCKED. An unpublished candidate passes the original public SDL
consumer fixture; native candidate validation was not launched because the
required census row cannot be committed without foreign WIP. Puzzle 7 clear/tally/Puzzle 8
remain unproved. The generic per-slot CLI scope repair is retained.

The fresh fixed-600-second diagnostic reproduced the first coordinate press
reopening the native level-7 confirmation. Before the press, verified original
SDL state and the game's last-motion state were client (568,359), the seventh
selector. Canvas (130,170) became client (107,127). After the press SDL held
(107,127), but the game still held lastMotion (568,359), mode 0, selected 0.

The first divergence is at production coordinate input: handleMouseDown moves
the current pointer but does not produce a movement phase before the button.
Native API trace then shows DispatchMessageA for WM_LBUTTONDOWN at API 426086,
followed by the WinDIB pump's GetCursorPos/ScreenToClient at 426100/426101.
The pointer, lParam and HWND are correct; a missing button is not the cause.
Original SDL's button handler updates its stored coordinates. Its subsequent
PrivateMouseMotion sample computes zero delta and suppresses the motion event,
so LMarbles retains the selector classification.

Original DLL disassembly and native return addresses agree: the WinDIB pump
at RVA 2eb80 drains PeekMessage/GetMessage/DispatchMessage, then samples the
cursor and calls PrivateMouseMotion. WM_MOUSEMOVE's window handler updates
focus; it does not itself emit SDL motion. PrivateMouseButton updates SDL's
stored x/y; PrivateMouseMotion returns without enqueuing when both deltas are
zero. No source console tracing or guest state writes were added.

The new isolated fixture initializes the authentic SDL DLL through public
SDL_Init/SDL_SetVideoMode, drives the production renderer/USER input path and
reads public SDL_PollEvent/SDL_GetMouseState. A direct coordinate press is red.
An explicit motion followed by a button in the same pump also produces only
SDL button type 5, no motion type 4. This independently rejects the reverted
queue-only approach. With the candidate, a coordinate press produces native
motion (140,150) in its arrival pump with no button; a later pump receives the
button, and ordinary release yields type 6. SDL state changes match each phase.
This fixture is isolated and does not claim native game selection by itself.

The candidate enables pointer-arrival timing independently of CLI button
release timing. Coordinate presses generate travel when their position changes;
the existing per-window hover hold remains active for 30 guest milliseconds
and an empty poll even while CLI release timing stays disabled. The receipt
still means producer handler consumption, not SDL dispatch or selection. All
queued effects remain visible to the existing guarded cancellation machinery.
The browser's default behavior and the generic inputEventScope repair remain
unchanged. This is a timing floor, not a guarantee that every possible guest
has completed a frame; fresh native validation is required.

The diagnostic exited through native Escape from the setup menu at about
303 seconds, with Exit0 and actual native/watchdog/supervisor/outer waits 0,
separate EOFs and heavy-lock release. It did not clear Puzzle 7. Clicking Back
without effective hover instead activated the stale Start item. Two action
review entries incorrectly described transitional black captures; the original
entries and explicit discrepancy JSON are retained, and no gameplay outcome
is attributed to them. Final Escape was based on a separately viewed complete
setup scene. Its non-final controller attempted a post-exit capture and latched
"native terminal"; that failure is retained and no input was retried.

Evidence: scratch/runs/20261114-lmarbles-sdl-selection/. Exact source Git SHA,
relevant dirty/new-file patches, module/source identities, original 87-file
media inventory, 86 manifest mappings and CRT hashes are recorded without
source/module/media copies. No boxes, network deployment, other workers,
original state/config/save/score writes, UNKNOWN replay or runtime extensions.

Publication blocker: the required `lib/renderer-input.js:host-file` census row
shares `tools/callback-ownership-census.json` with foreign uncommitted review
rows tied to other agents' WIP. An explicit-path commit would adopt those
foreign hunks; omitting the renderer row would break the clean-main gate.
Only the owned renderer row was updated/reviewed; every foreign hunk was
preserved. Candidate source/tests and that row remain uncommitted. No 900-second
original validation was launched. Native first-press selection with the
candidate, Puzzle 7 clear/tally/Puzzle 8 and published causal fix remain missing.

Focused passing controls: original public SDL motion/button pumps; actual CLI
producer/RPC main and worker scopes; guarded inputs; immutable input owner;
renderer button holds, cursor, drag mask, letterbox and relative mouse.
The scope fixture now explicitly chooses a 200-ms fixture batch clock and
advances one batch after draining arrival before asserting DOWN; it retains
all prior scope assertions. Two unrelated tests also fail with the baseline
renderer loaded from Git in memory: initial-input-state extracts a host poll
without its windowLookupLifetime context; track-mouse-event's old extraction
expects two observations and receives none. They were not repaired here.
The early fixture failure "Couldn't create mutex" was fixed by installing the
production ThreadManager in the isolated harness, and is not counted as the
causal red. The initial native SDL video/hover setup then passed independently.

The diagnostic log retains callback-owner-retired/sliceDone diagnostics after
Exit0; no clean Worker teardown claim is made. Workers 1 and 2 were actually
instantiated (2317 exports, 294 brokered imports each). Postflight original
media inventory has zero drift. Only result.json-named finite-action captures
and compact native/API logs are retained. Box ID none, state NOT_CREATED,
expiry null, stop receipt N/A.

The required full build passed under both heavy and build locks after the exact
renderer census review. The first queued build had failed that same missing
review and its evidence is retained. Final native public SDL and actual CLI/RPC
scope controls passed again against the rebuilt module. No code commit or
published selection fix is claimed; this note alone is published.
