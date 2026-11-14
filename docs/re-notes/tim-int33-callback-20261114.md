# TIM: real INT33 mouse callbacks and original Puzzle 1

Run: `scratch/runs/20261114-tim-int33-callback/result.json`.
The original installed, packed TIM accepted the actual printed-page-1 manual
answers and reached **PUZZLE 1: TUTORIAL: PUT THE BALL IN THE HOOP**. This proves
entry into Puzzle 1, not a solved puzzle or complete gameplay compatibility.

The predecessor's final note and result were read before editing:
`tim-puzzle1-gameplay-20261114.md` and its named run. Its generated guest
registered a callback but exited with failure because no callback executed.
The restored relative-input experiment had not solved the original game.

`Machine.int33` now stores function 0Ch's CX mask and ES:DX FAR handler.
Input producers queue snapshots of actual movement and button transitions;
they never execute guest code synchronously. At a real-mode `DosSession`
handback with interrupts enabled, outside the host interrupt stub and any
active mouse invocation, the driver saves the interrupted register context,
pushes a real 16-bit FAR return, and enters the handler. AX contains actual
conditions, BX button state, CX/DX virtual coordinates, SI horizontal and DI
vertical accumulated motion counters, cleared by function 0Bh. DS belongs
to the driver. Entry clears IF/TF/DF; guest RETF
reaches a reserved continuation, verifies balanced SS:SP, and restores the
interrupted context, including flags and nonvolatile registers. Multiple
queued transitions retain their own data. STI in a callback cannot recurse
into another mouse callback. Protected-mode delivery is deferred; this change
does not implement a protected-mode mouse callback ABI.

Mask zero, hardware reset and software reset discard pending callbacks.
Changing registration during a callback leaves that invocation's saved
return context alive. Function 14h exchanges the previous CX/ES:DX tuple.
Function 0Ch supplies no invented success result. Mouse hardware reset now
takes the host interrupt path rather than the Wasm fast return, so it clears
the real registration too.

The ABI was checked against Microsoft's original
[Mouse Programmer's Reference, printed 6-18/19 and 6-27/28](https://bitsavers.trailing-edge.com/pdf/microsoft/mouse/990973002-600-R00-1186_Microsoft_Mouse_Programmers_Reference_Guide_1986.pdf)
and [RBIL's function 0Ch/14h entries and tables 03171/03172](https://raw.githubusercontent.com/FDOS/mouse/master/int33.lst).
RBIL resolves the older manual's transposed SI/DI descriptions. The reference
hash and reviewed pages are recorded in `abi-reference.json`.
The [FreeDOS CuteMouse driver source](https://github.com/FDOS/mouse/blob/master/ctmouse.asm)
also confirms that callback SI/DI read the accumulated `mickeys` fields which
function 0Bh exchanges with zero; a native guest test verifies this lifetime.

Actual TIM registers mask 001Fh at **1D35:5D7F**. Its handler switches to a
private guest stack, calls its own routine, restores the original stack and
RETFs; `original-handler.txt` records the bounded disassembly. Session 1
proved this handler ran for balanced press/release, but the pointer landed
at roughly one quarter of the requested position and no answer appeared.
That session ended with an explicit review-response timeout, not success.

The startup trace explains the second primitive: TIM requests horizontal
0–2556 and vertical 0–1916 with functions 07h/08h, then programs ratio 3:3.
These ranges were previously ignored. The driver now stores/clamps the
ranges and position and stores function 0Fh ratios. Browser and ordinary
controlled input map their screen grid into the guest's configured virtual
grid; motion counters follow the configured ratio. Existing input without
explicit ranges retains its conventional grid. This is absolute frontend
mapping, not a full hardware acceleration or sensitivity model.

In session 2, each action followed a newly viewed frame and each balanced
release preceded a fresh consequence/review:

| Reviewed screen | Ordinary action | Observed consequence |
|---|---|---|
| Original title | Enter | Manual prompt for printed page 1 |
| Empty answer boxes | Fishbowl at (543,103) | Fishbowl in first box |
| First box filled | Cat at (351,103) | Cat in second box |
| First two boxes filled | Lightbulb at (350,200) | Accepted answers; black transition |
| Black transition | Wait without input | Actual Puzzle 1 tutorial screen |
| Puzzle 1 | Bound stop | STOPPED, no held input |

The actual manual's printed page 1 (PDF index 2), viewed from the predecessor's
retained page image, lists fishbowl, cat, lightbulb. Session 2's actual guest
callback records contain CX/DX (2172,412), (1404,412), (1400,800), with
movement-plus-press AX=3/BX=1 and release AX=4/BX=0 for each selection.
After the final accumulated-counter ABI correction, session 4 repeated the
same six individually viewed reviews and reached the same original Puzzle 1
screen. Its callback motion counters accumulated across releases and later
presses, as required. Session 3 had safely timed out at the first review with
no input while review notification was missed after a lock wait; that failed
attempt is retained explicitly. Only selected, viewed key PNGs remain, all
named by `result.json`.

The original EXE is
`scratch/game-state/tim-20261114/C/sierra/tim/tim.exe`, SHA-256
`34c844ba4586f27c817442ac5ed2f5b76e35d0c6521a9a9d4e7db66404e7c51c`.
The manual SHA-256 is
`16115f62a074f1dfb5fb80a6c34e4162d717fa74c12c078d35655b11296cb196`.
All 13 installed files, floppy and manual are pinned before/after. Both
original sessions used a fresh private writable overlay; successful session
2 made no overlay writes. No guest, solver, configuration, clock or score
patches were used. The rendered duplicate lower strip is an existing video
presentation issue; Puzzle 1's title, control panel and instruction are
visible, but this task does not claim to fix that presentation.

`test/toyvm-mouse-callback.test.js` generates native 16-bit COM instructions.
The actual CPU registers, executes and RETFs from the handler, which writes
its received data into guest memory and deliberately clobbers registers and
flags. It verifies selection masks, simultaneous conditions, signed motion,
five queued transitions, full interrupted context and caller stack,
nonrecursive lifetime, active unregister/both resets, no later callbacks,
mainline reset with fast interrupts enabled, function 14h exchange, and
native guest range/ratio programming. Removing delivery produces the expected
real-guest timeout. The predecessor's exact COM hash
`fbdea67ec39e9d6d8fbe66f76bbe7ad8656f4539ac4bde4d929760934a9eced1`
now exits 0 after 10,035 dispatches through its executed callback.
The actual original and generated guest runs used module SHA-256
`44dbe86c807add8ad8c1f8010ed455ab8b011d282f9387dfaf42481109710fa1`.

Released predecessor WIP sharing these source files was reviewed and adopted
coherently, rather than publishing unexplained whole-file hunks. It includes
short-DMA completion timing, MZ/EXEC bounds and parent flags, FAT12 startup,
FCB search, read-only CD/MSCDEX mounting, VGA palette-page rendering and
controlled-session input/release support. Its six helper source hashes are
unchanged in `incoming-helper-pins.json`. Focused native short-DMA/audio/floppy
tests, 118 loader/FCB/CD/disk/palette tests, controller lifetime tests, existing
polling/mouse closeout/chord tests and browser CD-wrapper loading passed.
DOM tests are adjunct regressions, not callback execution evidence.
Both browser bundles were regenerated from stable source. Full
`flock /tmp/wine-build.lock bash tools/build.sh` passed while also holding
`wine-heavy-runtime.lock`; test commands and results are in the run JSON/logs.

Every launched native run/build held the heavy lock, with an independent
supervisor deadline armed before child launch, actual child wait and both
stdout/stderr EOF. Session 2 had an immutable 115-second controller deadline
and stopped normally at 73.4 seconds; final session 4 also stopped normally
inside its immutable 115-second deadline. Their independent controller
watchdogs were closed. Queued lock retries launched no guest; they are recorded
separately. No box was created, resumed or deleted. Git plus retained binary
diff/new-file patches is the source recovery record; no source archive or
media copy was made. Next work would be ordinary Puzzle 1 gameplay from this
verified entry point.
