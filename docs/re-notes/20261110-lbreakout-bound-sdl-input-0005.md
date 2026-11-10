# LBreakout2 bounded original-consumer observer, 2026-11-10

The passive observer is implemented and tested against the authentic SDL and
original game paddle handler, including in the single changed native fixture.
The first live control failure terminated this task before native input or an
original launch: the inherited inspection helper unconditionally read
`original.log` while inspecting the fixture. That file correctly did not exist.
The helper's case selection is corrected in the retained run-specific patch,
without retrying the runtime. No causal original-game defect or gameplay
progress is claimed. Historical input failure remains unexplained.

Evidence: `scratch/runs/20261110-lbreakout-bound-sdl-input-0005/`. The exact
staged Git SHA is in `runtime-pins.json`; source differences and owned new
files are in `relevant-source.patch`, `relevant-untracked-source.patch`, and
`owned-helper-inputs.patch`. Git is the source archive; no source/media archive
or repeated game-media copy was created. Media used the existing candidate
paths and SHA pins. The native fixture's actual served module was SHA-256
`3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`,
2186068 bytes.

## Concrete observed consumption boundaries

`lib/lbreakout-input-observer.js` is default inert. Explicit installation hashes
the original EXE and SDL bytes, discovers SDL in the current instance's DLL
export table, reads the current EXE image base and relocated keyboard-state
pointer, and validates loaded instruction anchors. It binds the DLL mapping's
state and generation. It assumes no historical load base.

The existing production interpreter `log_eip` block-entry hook supplies the
observations. Records cover SDL WinDIB consumer entry/return, DX5 record decoding
entry/return, SDL_PrivateKeyboard entry/return, SDL_GetKeyState entry/return,
and original paddle-handler invocation/return with keyboard state, inhibit
field +0x3c, coordinates and fire request. Invocation matching uses native return
PC and ESP, not coincident changes in coordinates. Terminal observer records
include the current PC, ESP, yield reason, keys and delivered boundary count.
The observer neither calls a guest routine nor writes guest memory. Trace
configuration only enables/disables the existing interpreter diagnostic.

Records, nesting, DX5 batch size, delivered boundaries and wall-clock lifetime
are bounded. Module changes and foreign-thread delivery stop observation.
Full block tracing changes execution overhead and scheduling; it is diagnostic
coverage, not proof of uninstrumented timing or historical causality. It covers
one owning thread and only delivered block boundaries. Overflow/expiry cannot
prove absence beyond the recorded interval.

The expanded `tools/lbreakout-sdl-input-controls.cjs` uses the authentic routines
already identified in the prior report, with explicit isolated test objects
and config. Both SDL paths give:

| Control at original game handler | Actual observed result |
| --- | --- |
| Right DOWN/UP before handler | right state 0, x 320 |
| Handler while Right held | right state 1, x 328 |
| Handler after release | x 328 |
| Handler while Left held | x 320 |
| Space held/released | fire request 1/0 |
| Right held, +0x3c set | right state 1, inhibit 1, x 320 |

All 14 paddle entries and returns and 159 observer records are checked. The
47-call offline suite includes four further calls exercising the record bound;
expiry, default-inert behavior, invalid bounds and authentic-media rejection
also pass. The exact generated native fixture initializer independently passes
43 original consumer calls and the same 159 records. Its native key callback
is qualified offline: Left DOWN executes original SDL plus the original paddle
handler and returns x 312; release leaves x 312. Drawing uses returned native
coordinates; it contains no keyboard movement implementation.

## Single native fixture and terminal failure

The original production guest Worker was booted in the generated Canvas2D
fixture, using the original module. Prestart instrumentation wraps only the
existing trace import and retains the same instance. The fixture initializer
completed all 43 native controls. The returned startup image was separately
model-reviewed after retrieval: usable dark board, eight yellow rectangles,
white paddle and attached ball. This is a generated diagnostic display, not
original game progress. The Canvas2D/noD3D identity and review/terminal chain
remained in place. The current generated caller's terminal/refusal/pulse guards
were exercised offline before allocation.

At 00:09:28.853Z the first inspection command failed with FileNotFoundError
for `original.log`. No native input had been submitted. The owning browser and
launcher received SIGTERM; the launcher parent actually waited, reporting -15
with separate stdout/stderr EOF at 00:09:45.366Z. No later game protocol,
input, capture, retry, quit, extension, or original launch followed. The
inspection helper now chooses the log for CASE_TAG in the retained local patch;
that repair was not replayed on this box. Native input response, original-game
consumption, ball launch, brick removal, score and level progress are unknown.
There is no supported emulator input repair from this run.

## Validation and lifecycle

The locked build passes after the final observer changes. The expanded original
SDL/game controls, exact generated fixture initializer/callbacks, generated
caller terminal controls, five native-key controls, 14 buffered DirectInput RPC
checks, and original-media verifier (220 files/219 mappings) pass. The native
fixture independently completed the 43 original-consumer controls too. This
qualifies the observer integration and controls; it does not qualify the
fixture's complete live-input sequence or any original experiment.

Only box `bx_e2rs3hqq` was allocated. Its independent immutable watchdog was
observable before allocation, UUID `b02f9c78-466b-4471-bd5a-1abb76f6c678`,
25-minute deadline 00:33:35.871Z, initial expiry
2026-11-10T00:33:35.303Z. All 29 recovered artifacts (27 unique SHA/size pairs)
were independently read and SHA/size verified, with 825 staged pins unchanged,
before requesting the single delegated normal stop. Final independent API read:
ARCHIVED, expiry null; stop `stop_a8256789a9d15f27` completed unforced at
00:10:19.896Z. The watchdog was actually waited with return code 0 and separate
stdout/stderr EOF; UUID/deadline hash and independent stop receipt are retained.
The inherited archived boxes were untouched. /home remained above 1.5 GB free.

Next: a separately assigned run can use the corrected case-specific inspection
helper, qualify the changed fixture's independently released short input, then
perform a separately authorized single original experiment with this observer
prearmed. No longer pulse or historical cause is inferred here. This worker
releases its files and stops.
