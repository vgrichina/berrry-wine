# LBreakout pause completion boundary, 2026-11-10

Code repair `a2b5d0caf` is published on main. Offline controls distinguish SDL P
delivery from original pause handler/display completion and prohibit the first
image until supported completion. Authentic visible pause and score progress
remain unconfirmed: the single authorized original run stopped at its first
unusable image, before any P input.

Evidence: `scratch/runs/20261110-lbreakout-pause-presentation-0110/`. Exact Git
SHA, small relevant binary patches, media path/hash references, tested module,
logs and captures are retained. No source/media archive was made. The historical
source directory named in the older note was absent; diagnosis used the retained
authentic original EXE and its disassembly, recorded in this run.

## Original path and repair

The prior observer recorded correct SDL symbol 112 DOWN, then stopped at its
200001-boundary limit during drawing. An unchanged early frame does not establish
that the original ignored P. Original `_handle_default_key` enters at `0x41e406`,
compares P at `0x41e474`, and takes the pause branch at `0x41e75c`. Local state
at `0x4523b0` changes from 8 to 20, then `_display_text` at `0x407a11` grays the
board, renders text and calls `_stk_display_update(0)` at `0x407b2a`. That update
calls original SDL_UpdateRect. Return to `0x41e7b4` therefore follows the original
pause drawing/update, rather than merely its input delivery. Resume returns from
the state-8 transition at `0x41e7ec`.

`pause_workflow_source()` now composes the completion consumer automatically;
its paired worker preload comes from `pause_completion_preload_source()`. The
observer reuses authentic media/module validation and verifies original pause
instruction anchors. It traces SDL keyboard entry/return, then narrows the trace
to the original handler, then its actual caller return. The gray drawing loop
does not generate diagnostic callbacks. Completion requires the expected state,
the original display/state return, actual handler return and released SDL P
state. A release consumed before handler dispatch is supported too.

The observer retains the existing two-second window, adds a 64-record bound,
and writes no guest memory, clock or artificial handler invocation. The consumer
checks command, Worker and module binding, then waits for a bounded page frame
barrier before its first screenshot. Incomplete, foreign-binding and observer
failures cancel terminally. Existing browser deadlines remain unchanged.

## Validation

- Generated passive observer tests cover SDL-only incompletion, handler/display/
  caller-return ordering, release ordering, expiry and module/state failure.
- The actual generated browser entry point passed offline with process/CDP
  adapters in five modes: success, wrong command binding, wrong module binding,
  SDL-only incomplete, and observer failure. Successful commands wait through
  pending observations before their first image. Negative modes permit no first
  image and no later input, capture or quit.
- Original x86 SDL controls passed P DOWN/UP through both WinDIB and DX5,
  alongside existing original paddle controls. Eight inspection/handoff tests,
  five native-key tests and the locked full build passed before publication.
- Offline setup omissions (nested relative paths and a missing preload) were
  corrected before those tests passed. A later missing generated helper was
  corrected during packaging before watchdog arming or box allocation.

## Single original attempt and terminal custody

Accepted unchanged fixture evidence from `4fc62b7d7` was hash-verified and reused
without another fixture. The original used module SHA-256
`3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`
and 823 verified unchanged pins. All seven images were individually reviewed.
Loading, main menu, Local Game selection/submenu, Resume selection and Start
Original Set selection responded to balanced ordinary native input. The first
image after Enter on Start Original Set, completed at 01:22:12.971Z, has a black
game client with no board, score, title or ball. It is the first unusable image.
No later image was taken to wait for drawing.

Immediate owning cancellation sent SIGTERM to Chrome 6269 and Node 6260 at
01:22:27.970Z. Node's actual parent wait returned -15; stdout and stderr EOFs
are separate records. No independent Chrome reap is claimed. There was no later
game protocol, input, capture, retry, quit or extension. No P, ball launch,
score increase, life loss or level-clear acceptance is claimed.

All 99 remote artifact references, 86 unique contents, were retrieved and
independently SHA/size verified; seven PNGs passed full decode/CRC. These checks
preceded the sole delegated normal stop of fresh box `bx_evdtep7k`, immutable
watchdog UUID `e63f4aff-3435-436e-8e33-f83734ce5fe3`. Its original API expiry was
01:44:10.967Z and immutable watchdog deadline 01:44:10.932Z. Unforced stop
`stop_1c386db483a8b95d` completed at 01:23:20.950Z. Independent API state is
archived/stopped, expiry null. The watchdog's actual wait returned 0, with both
EOFs separately from the launcher records. Prior boxes were untouched; home
remained above 1.5 GB free. No nested workers or local Chrome were used.

Next: diagnose the level-start presentation completion boundary offline before
another separately authorized original attempt. This run cannot validate the
new pause boundary live, because it correctly stopped before reaching pause.
