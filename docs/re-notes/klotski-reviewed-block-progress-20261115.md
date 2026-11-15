# One original WEP3 Klotski puzzle

Run: `scratch/runs/20261115-klotski-reviewed-block-progress/`.

This task permits one registered `wep16_klotski` default first puzzle.
The installed `KLOTSKI.EXE` is 147584 bytes, SHA-256
`4995ff3b4bf35c6153ce65cdf93af5b5c6805e8d453e0f1fe2422582946c2bdb`.
Its static NE module imports are KERNEL, GDI and USER. The registered extra
files are `KLOTSKI.HLP` and `KLOTSKI.SCO`; the registry specifies no extra
Win16 modules. These observations do not establish the full runtime closure.
Media remain at their existing paths, with hashes recorded in the run.

Historical geometry and pick arithmetic in `wep16-klotski.md` are warnings
to verify against the actual current native board, never current coordinate
authority. No historical input batch, puzzle cycling, reset, solver, private
board read or action list is part of this route.

Disassembly of the currently installed EXE independently confirms the pick
routine adds 13 to x and 4 to y before separate cell-size divisions. This
supplies arithmetic, not current origins or board contents. Captures also
record read-only public native window client geometry, cursor output and
mouse-capture HWND; an image is refused while native capture remains held.
These are USER/window observations, never reads of private puzzle storage.

The self-contained controller derives released Rodent transport mechanics.
Each personally chosen drag uses three new guarded nonces for source MOVE,
DOWN and destination MOVE. An independent release child is observably armed
before any of those events, with an immutable 1750 ms fallback. The ordinary
gesture is bounded by 1500 ms. The child receives its ordinary release time
as soon as DOWN is acknowledged, before destination MOVE. No screenshot,
reasoning or audit persistence occurs while DOWN is held. A pulse below
80 ms is rejected before intent creation, prearming or HTTP, incorporating
the preceding released JezzBall admission correction.

Gameplay authorization requires a complete current board review less than
five seconds old. The review identifies the chosen block, source,
destination, occupied neighbors, free area, native move counter and legal
reason. It must explicitly establish current native picking evidence;
tile centers and remembered geometry cannot supply it. Menu reviews expire
after thirty seconds. One permanent native PID/start/window binding and
nonce tombstones prevent rebinding or replay. UNKNOWN closes the route.
The final 180 seconds enter an irreversible Quit phase.

A transport receipt makes no placement claim. Before the next drag, two
separate post-UP complete-scene reviews must show source vacancy,
destination occupancy, preserved neighbors and a native counter increment.
The second review must show the same complete resulting board and counter.
Native exit-block completion and native UI Quit require their own evidence;
closing the host supplies neither claim.

Binding records the complete visible bootstrap state and the restriction to
the first puzzle, without claiming that a puzzle is already selected. The
actual complete board has a separate admission after required native setup.

Qualification passed 32 policy tests, thirteen HTTP controls and eight actual
native CLI controls using Notepad fixtures. The latter exercised native EDIT
hit/selection changes, hover, native capture acquisition/release, source MOVE,
DOWN, destination MOVE and independently prearmed UP; occupied destination
refusal, late ACK, dropped ACK without replay, parent death, unique captures
and sub-80 ms rejection were included. These are controls, not Klotski moves.

The installed Help decoded successfully through the current native WASM.
Its rules permit moving blocks into open space where they fit, prohibit
crossing the dark blue casing, and permit only the red block through the
light blue exit. The objective is the red block at the indicated indented
destination. Each block movement counts as one step irrespective of distance.
The Game menu Exit command can end an unfinished puzzle. The locked build passed. Route commit `549253e1a91f69dc39cf782f727ea44b4dd1706b`
was pulled/pushed successfully before the one original launch.

## Original result: honest partial, zero moves

The original launched once with the registered EXE/HLP/SCO, current built
WASM, default batch size 1000, real ticks and immutable 1200-second native /
1220-second independent watchdog deadlines. The watchdog was observably
armed before the native process. No box was created.

The native log reached the ordinary welcome MessageBox: “Choose your game
board.” The first attempted complete capture, `bootstrap01`, failed before
PNG creation and before permanent binding, bootstrap input or board admission.
The guard requires both public main-window equality and zero native capture
HWND. Its combined assertion reports “native mouse capture still held; no
image”, but neither operand was persisted on this failure. Therefore this run
cannot distinguish a window mismatch from nonzero capture, and the error text
alone does not establish a held physical mouse gesture. This is a controller
bootstrap observation blocker, not proof of a native gameplay defect.

The route wrote its sticky local failure and was not retried, rebound or
replayed. No guarded input was sent; there was no action UNKNOWN receipt.
There is no personally reviewed complete board, chosen block, legal drag,
native step-counter reading, persistent placement proof or exit-block
completion. The requested five-move target was not reached. No original PNG
exists, so the result names no selected screenshot. No other puzzle, reset,
solver, demo, private board read or old action batch was used.

Because the sticky route precluded a reviewed native UI Quit, cancellation
used the supervisor's host SIGTERM path. Native UI Quit is FALSE. Native,
watchdog, supervisor and outer waiter all have actual exit-0 / stdout-EOF /
stderr-EOF records, and their recorded PIDs are absent. This host cancellation
is not evidence of an in-game Quit. Runtime/source/build ownership was released
to Sims immediately after cleanup; no further original will run in this task.

## Provenance and limits

`pins-before.json` records exact Git HEAD, installed media, complete current
NE import listing, default DLL autoload pool, system TLBs, fonts, current
WASM, resolved PATH Node/Python, loaded host module paths and native mapped
libraries. `uncommitted-before.patch` records relevant foreign uncommitted
hunks without copying source trees or media. All eight actual native mapped
files and all loaded host modules matched prelaunch pins. Postflight rehashed
6562 files with zero drift. Original input, binding and movement counts are
zero. The result and compact receipts live only in the ignored run directory.

Qualification is separate from the original: the Notepad drag changed public
EDIT selection from 0 to 458752, acquired/released native capture and dispatched
MOVE/DOWN/MOVE/UP. All 32 policy, 13 HTTP and eight actual CLI controls passed,
plus `flock /tmp/wine-build.lock bash tools/build.sh`. The parent-death control
has an actual killed-parent wait and observable independent UP; its orphaned
release child's wait is UNKNOWN, separately recorded with PID absence. This
unknown does not become an original-run wait claim. The ancillary messageboard
watcher has a separate actual tool wait of 143 after SIGTERM.

A future authorized task should first qualify bootstrap capture behavior with
a native modal fixture and persist both rejected public observations. No
bootstrap admission relaxation or engine fix is causally warranted by this
run. This bounded task stops with the original unsolved.
