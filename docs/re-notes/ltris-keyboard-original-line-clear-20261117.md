# LTris keyboard original attempt, 2026-11-17

The original line clear and changed score/line counter remain **unproved**.
One fresh LTris process reached one Modern/Normal, starting-level-0 board
through ordinary keyboard menus. Three local P Pause intents expired before
arming or DOWN, at capture ages 6.593, 5.033 and 6.374 seconds. No gameplay
gesture was sent. This is an operator timing blocker, not a demonstrated
runtime fault; the five-second gameplay review bound was not changed.

The board subsequently ended through the visible native Escape → “End Game?
y/n” → Y route, showing Game Over, Pieces Placed 4, Score 0 and Lines 0.
Escape returned to setup; reviewed Up selected Back, and Enter returned to
the main menu. The main menu initially needed a keyboard selection before
activation. Its separately reviewed Quit selection and Enter produced native
`[Exit] code=0`. All thirteen consumed keyboard gestures have independent
physical-release ACKs and actual release-child waits with both EOFs. Native,
watchdog, supervisor-child and outer waits all completed with exit 0 and both
EOFs. No host signal, cleanup command or watchdog firing ended the original.
Native Quit is proved; successful gameplay and original Pause are not.

Evidence: `scratch/runs/20261117-ltris-keyboard-original-line-clear/result.json`.
The initial already-reviewed capture name was refused locally before a menu
gesture because its review file existed. That setup error and the three
NOT_SENT Pause records are retained. Captures following menu consumption can
precede the final drawn transition; later full captures, rather than ACKs,
established that the board and setup had actually appeared. No second process
or board was started, and no terminal UNKNOWN endpoint was contacted.

## Native keyboard qualification

The new `test/test-ltris-sdl-keyboard.cjs` authors a small PE using the existing
SDL fixture's PE/import header and a replacement keyboard-only program. It
calls the bundled authentic SDL_Init, SetVideoMode, PollEvent, FillRect, Flip,
Delay and Quit. Enter advances its black menu surface to a green board; P
changes it to red Pause and back to green. A matching actual SDL_KEYUP must
unlock every subsequent keydown. Left and Right change distinct public colors;
Escape exits through SDL_Quit and ExitProcess(0). These are authored fixture
surfaces, not original LTris gameplay.

`test/test-ltris-sdl-keyboard.py` drives that program through the released sealed
runtime and native guard, requiring the expected rendered colors, native-input
return receipts, independent releases and actual lifecycle waits. Intermediate
releases have physical-UP ACKs; the fixture's final Escape instead retains the
actual exited-owner wait, with physical UP explicitly unacknowledged. It is
not counted as a release ACK. The complete fixture route passed before the
original was started. Policy tests, actual-native wrong-owner/late-ACK/UNKNOWN/
parent-stall guards, and the existing real SDL consumer test also pass. The
canonical locked build passed before publication.

## Exact inputs and boundary

Fixture and original used identical runtime provider inventories from Git
`c2a980c5fd491cd66fd17d5c972cf88826c3da06`, with foreign WIP excluded and recorded
as a binary patch. The new test bodies are also retained as patches. Both used
the existing pre-execution-retained module at
`scratch/runs/20261117-ltris-current-original-visible-line-clear/tested.wasm`,
SHA-256 `533c599a144837890b6b45f6cbace2e52e9b4f48a3a8dd08b4261cd20223b1a1`.
Its exact compiled Git/patch proof is reused by hash. Sealed module records and
the original's two real guest Worker receives/instantiations match that hash.
The explicit original batch size 1000 matches the fixture's default 1000;
real ticks, real guest Workers and a 1024×768 canvas were used throughout.

All 43 execution-media/manifest/CRT/ZIP records were verified unchanged before
and after execution. Default controls were personally read from retained prior
whole original Controls and Player1 screenshots on the same unchanged media:
arrows, Up, PageDown, Down, End, Delete and P. Those references are explicit;
they are not described as current-run Controls views. No Controls/Player1
pointer gesture, settings change, guest state read, solver, autoplay, forced
pump, clock edit or deadline change was used. The historical 507.729 ms
Player1 pointer failure remains unreproduced; no pointer repair is claimed.

The original's 1200-second deadline, independent prearmed 1220-second watchdog
and irreversible 180-second Quit reserve remained fixed. All owned native
groups are empty and their listeners retired. Selected whole PNGs, exact
source identities, module/media references, actual waits and EOFs are named in
the result; there is no source archive, frame archive or copied media.

No box or worker was created: box ID null, state `NOT_CREATED`, expiry null,
stop receipt `NOT_APPLICABLE`. Free /home remained above 1.5 GB. The task stops
with the single original allowance spent. Further original gameplay requires
a separate assignment after addressing operator capture-to-input timing
without relaxing the existing freshness predicate.
