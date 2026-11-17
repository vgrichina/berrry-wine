# LTris parallel local run, 2026-11-16

The requested line clear remains **unproved**. One original LTris 1.2.8 process
ran one human Modern/Normal board with Starting Level 0 unchanged. It reached
native Game Over at Pieces Placed 13, Lines 0, Score 0. No second board or
process was started. The original subsequently returned through native setup
and reviewed Back, visibly selected the main menu's Quit, and exited with
native code 0 after the separately reviewed Enter gesture. No host-shutdown
command or watchdog termination ended the game.

The lifecycle evidence is incomplete: the native process and watchdog both
have actual exit-0 waits and both EOFs, but the outer tool session returned 143
and the supervisor-child wait file is absent. The inner supervisor recorded
its normal completion. The cause of the outer termination is **UNKNOWN**;
neither PID absence nor the inner completion substitutes for that missing
actual wait. There is no claim that every task acceptance condition passed.

Evidence: `scratch/runs/20261116-ltris-parallel-native-line-clear/result.json`.
The result names selected full PNGs, current logs, source identities, patches,
module receipts and the explicit missing supervisor receipt. No remote box,
download, media edit, source archive, WASM dump or public deployment was used.

## Independent runtime and qualification

Owner Telegram199 authorized this independent local lane during the other
workers' runtime work. No heavy-runtime queue was taken. Ports, native process
groups and control evidence were separate. Source edits stayed in the shared
main checkout and touched only newly owned LTris files.

The new, currently uncommitted helpers are:

- `tools/ltris-parallel-native-runtime.py`: exact Git runtime providers and
  relevant unadopted dirty patches, a sealed source memfd, one atomically read
  and sealed WASM buffer, prearmed independent watchdog, native pipe drains,
  native/watchdog waits, and an outer supervisor observer.
- `tools/ltris-parallel-native-runtime.cjs`: an audited immutable source
  transport that refuses omitted project source, plus actual compile,
  compiled-Module transfer and real Worker instantiation receipts. It does
  not read changed shared source as a fallback.
- `tools/ltris-parallel-control.py`: exact-Git published LTris controller and
  guard, audited loopback HTTP, independently waitable absolute transport
  deadlines of 500 ms, one complete observation bounded to 3 seconds, fresh
  native-scene intent binding and reserve enforcement before context recovery.
- `test/test-ltris-parallel-native-runtime.cjs` and
  `test/test-ltris-parallel-guards.py`: independently authored PE generation
  and current actual-native qualification, with fault injection confined to
  fixtures. Small generated PEs remain in the task-owned ignored binary path.

The existing `ltris-controller.py`, `ltris-guard.py`, GTA2 helpers, shared
runtime source and other workers' source were not edited or adopted.

Current native tests covered wrong owner/epoch/identity, process/thread/window
scene generations, expiry, replayed nonce, late ACK, UNKNOWN and parent stall.
Negative cases retained zero later HTTP requests after terminal closure.
Actual renderer DOWN/UP effects were logged before binding; consumed fault
cases released within 1,750 ms. A separate native program with no USER window
was refused. Pure Python policy checks passed all 20 cases; these are policy
tests, not native evidence.

The authored native fixture's initial title-changing design correctly lost its
permanent scene lease. That endpoint closed without retry. Its replacement
kept the main title stable and changed a native child label only after real
WM_KEYUP. Current personally reviewed fixture pixels and native exit-0 waits
establish Escape → End Game Y → selected Back → selected Quit. A later complete
route repeated this through the final absolute-deadline adapter. These are
fixture routes, not an original LTris End Game Y claim. An additional authored
CreateThread program proved actual real Worker loading of the same compiled
module, including inherited sealed source loading and instantiation receipts.

Earlier fixture setup failures and a premature prelaunch capture are retained
as failures. Their endpoints were not reopened. No original was spent on them.

## Original pixels and controls

The original verifier passed immediately before launch: all 40 client files,
authentic CRT and 39 exact companion mappings. The registered `ltris_128`
route retained `C:\LTRIS\ltris.exe`, cwd `C:\LTRIS` and `-w`. Real ticks,
batch size 1000, 1024×768 canvas and real guest Workers were used. Launch fixed
the 1200-second native deadline and independently prearmed 1220-second watchdog;
the irreversible Quit reserve was 180 seconds. Neither deadline was widened.

`controls.png` and `playerenter.png` show original P Pause, Left/Right, Up,
PageDown, Down, End and Delete. No binding changed. `setup.png` shows Modern,
Normal and Starting Level 0. `startconfirmed.png` shows the first and only
board with Michael, Pieces 0, Score 0, Lines 0 and Level 0.

Nineteen finite gestures were consumed with unique nonces and actual release
child waits/both EOFs. Five local expired reviews were refused before DOWN;
they are local NOT_SENT records, not native expiry tombstones. Subsequent
captures and intents were new. Maximum consumed gameplay scene age was
4.966 seconds, maximum menu scene age 14.846 seconds, and maximum release-ACK
hold 0.522 seconds. No UNKNOWN was written for the original.

The three consumed gameplay gestures were two lateral gestures and one End
gesture. Both lateral gestures crossed piece transitions: they do not prove
the intended cyan J or green I placement. `r2.png`, `drop1.png` and `b3.png`
show a yellow S at the right, lower, then settled on the floor. These views do
not distinguish hard drop from natural gravity. There was no disappearing
complete row, counter increase or settled post-clear view. No OCR, solver,
board/piece/score memory read, tracking program, action queue, config change,
speed change or clock freeze was used. No Pause overlay was used for decisions.

`b4.png` establishes native Game Over, Pieces 13, Lines 0, Score 0. Quit became
irreversible at the next reviewed Escape. `q1.png` shows return to native setup;
`backselect.png` shows Back actually selected, and `back.png` shows the main
menu after Enter. A first Up did not visibly select Quit; no Quit was inferred
from its ACK. The separately reviewed `qselect2.png` does show selected Quit.
Its Enter receipt, physical release ACK, subsequent native `[Exit] code=0`,
and actual native exit-0 wait establish the original native Quit consequence.
The original had already ended its board through Game Over, so it did not show
the active-board End Game Y/N prompt qualified by the authored fixture.

## Identity, validation and remaining work

The original source view is Git
`035e10cf849b6d14086814b10c51df3f821246e1`, with exact relevant foreign-WIP
patches retained but excluded from the runtime and all owned new helper bodies
retained as Git patches. The published controller/guard objects were pinned to
`1305d45eb47203f32bfa690117265c4967c72a9d`. The actual standard module was
2,277,562 bytes, SHA-256
`ef7de08a1a1ea564ea7ff2fbd1e3dbbd56cbfc07c19d3db7fcb45c9bac4b5fb8`.
Actual main compile, both real guest Worker receives and instantiations used
that module. No module body was saved to evidence.

Native PID 3206416 and watchdog 3206415 have actual normal waits. Inner
supervisor 3206137 recorded native/watchdog completion. Outer PID 3206136
returned 143 at the tool boundary; its supervisor-child wait and pipe logs are
missing. This evidence cannot be reconstructed by relaunching the original.
Current recorded PID/group/session absence and retired control ports are
recorded separately, without inventing the missing wait.

After the original ended and GTA2 explicitly released the shared build paths,
the bounded `flock /tmp/wine-build.lock bash tools/build.sh` passed. Build
ownership was promptly released to GL. This postflight shared build includes
other workers' unadopted WIP and produced a different module; it is not the
module used by the original. The focused PE structure check and 20 policy tests
also passed. The helper/test source remains uncommitted WIP because the missing
original outer wait prevents treating the complete supervisor lifecycle as
qualified. Only this report is published; exact helper patches remain in the
run and the shared tree.

The task stops with a concrete gameplay blocker: its allowed single board has
ended without a line clear. Another original or board would require another
assignment. Future helper work also needs to prove retention of the outer
supervisor's actual child wait through tool-parent loss before claiming full
lifecycle closure. No additional original run is scheduled here.

Box ID none; state `NOT_CREATED`; expiry none; stop receipt not applicable.
