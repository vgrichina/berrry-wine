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
The Game menu Exit command can end an unfinished puzzle. The one original
attempt remains unlaunched pending locked build and route publication.
