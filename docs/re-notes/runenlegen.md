# Runenlegen

## Current acceptance state (2026-10-04)

Registered app `runenlegen` uses `test/binaries/wep32-community/Runenlegen/Runenlegen.exe`. The registry declares no companion files or DLLs. The adjacent CHM is optional help, not a declared mounted dependency. Availability does not rule out unknown dynamic dependencies.

The public `DESKTOP_APPS` snapshot was refreshed on 2026-10-04: 42 entries, excluding Runenlegen. Exact source, timestamp, EXE hash and 126 current runtime/source pins are recorded under `scratch/new-games-pipeline-20261004/runenlegen-preparation/`.

Prior run `scratch/runs/20261003-runenlegen-gameplay-restored13/` did **not** qualify gameplay. Runes and counters changed autonomously without board input; the Mode menu exposed Demomode. The board appeared clipped at the lower/right window boundaries, and attempted maximization did not expand it. File → New opened the rules dialog, but the route deadline expired before Beginner/OK executed. This is an incomplete route, not evidence that these controls failed.

## Prepared ordinary route

The bounded route allowed 300 seconds including visual review and ran after Crimsonland released the serial browser slot.

1. Capture the actual current window and relocate controls from visible geometry. Historical positions were File `(333,251)`, New `(352,271)`, Beginner `(96,79)` and OK `(152,180)`; these are reference coordinates, not an assertion about the next layout.
2. Complete File → New → Beginner → OK promptly, retaining transition screenshots.
3. Compare the resulting board immediately and after 1.5 seconds idle. Autonomous placement or counters cannot prove player control. Inspect the visible Mode menu if necessary; only toggle Demomode when its actual state is established.
4. Once a stable player board and readable legal target are personally reviewed, record an ordinary placement click with before/after images. Choose the target from the actual rune and board, not an assumed coordinate.

If player mode remains ambiguous, or clipping prevents reading a legal target, preserve an incomplete/scene-only outcome. Record window geometry, exact errors and missing requests before proposing a focused diagnostic. The old clipped image alone does not identify a renderer defect. No FPS, complete rendering, distribution or release qualification is implied.

The prepared helper retains fresh-output refusal, explicit slot/TTY guards, current source preflight, actual served-source verification, scene-review gating and cleanup receipts. No engine edits, guest-state writes or execution-mode overrides are part of this route.

## Beginner placement result

`scratch/runs/20261004-runenlegen-beginner-placement/` records the current ordinary route. Beginner was visibly selected before OK. Immediate and 1.5-second idle images stayed at 72 runes, 0 points and 96 moves. One click at `(496,288)` placed the yellow preview rune in the first visible board cell, changed the preview to pink, and changed counters to 71 runes and 92 moves. The following idle image stayed unchanged. The moves field is not interpreted as a count of turns taken.

This proves a limited player-turn response, separate from startup autoplay. It does **not** accept full rendering: the right/bottom board remains clipped by the small window. Outcome is partial and the lane remains active for a clear full-board screenshot. Browser session 92770 exited cleanly at `2026-10-04T02:37:51.013Z`; both browser and server closed. All 86 served-source checks passed, with 35 hashed artifacts in the preparation directory's `validation.json`. No FPS was measured.

Next investigate actual window creation/style and layout dimensions before changing an engine. The current geometry receipt only records the 1024×740 renderer desktop, not guest window/client rectangles. The executable imports `CreateWindowExA`, `AdjustWindowRectEx`, `MoveWindow`, `GetWindowRect`, `GetSystemMetrics` and `GetClientRect`; its mere import list does not establish which call caused clipping. A bounded owning-call trace can distinguish guest-requested fixed geometry from incorrect client size or layout return values. No such trace or source repair has run yet.

### Static minimum-size hypothesis

The actual main creation call at `0x40492d` uses style `0x00ca0000` (caption/system menu/minimize; no sizing border or maximize box) and `CW_USEDEFAULT` dimensions. Startup calls at `0x404958` and `0x4049a2` request zero width and height. Its main window procedure handles `WM_GETMINMAXINFO` at `0x404415`, deriving minimum tracking dimensions from child rectangles and adjusted frame metrics. Unhandled messages reach `DefWindowProcA` at `0x404566`.

Current renderer defaults are 400×300; `host-window.js` preserves that size when a hidden top-level window requests zero dimensions. WAT sends `WM_WINDOWPOSCHANGING`, but current `DefWindowProcA` has no corresponding minimum-size negotiation branch. This is a source-backed hypothesis for retaining the undersized window, not an observed callback trace.

Microsoft documents that [DefWindowProc processes WM_WINDOWPOSCHANGING by querying WM_GETMINMAXINFO](https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-windowposchanging) for applicable window styles. The [window size and position overview](https://learn.microsoft.com/en-us/windows/win32/winmsg/window-features) also describes minimum/maximum tracking constraints. These support examining the default-message path rather than forcing a larger window from the harness.

`window-sizing-capture-plan.json` in the preparation directory specifies the bounded owning-Worker call/rectangle trace and passive renderer inventory. Actual callback execution and returned minimum dimensions remain unproven. No engine repair or additional runtime has been authorized by this analysis.

### Actual owning sizing capture

`scratch/runs/20261004-runenlegen-window-sizing/` captures the ordinary startup on canonical prebuilt `f40d4ca3`, with a private passive Worker observer. Current WAT included a separate Crimsonland candidate; it was not the module executed here. Production source and private Worker hashes are recorded separately.

The main window's two actual zero-size `MoveWindow` calls reach `DefWindowProcA` with `WM_WINDOWPOSCHANGING`. Both return with `WINDOWPOS.cx/cy` still zero. A successful subsequent `GetWindowRect` remains 400×300. Main `GetClientRect` returns 394×255; passive renderer inventory agrees with the 400×300 outer frame while its children independently occupy 484×404 and 164×404. The personally reviewed screenshot shows the resulting clipping.

These positive argument/output records support the missing minimum-size negotiation hypothesis. No `WM_GETMINMAXINFO` result was captured, so desired minimum dimensions remain unknown. The final trace reaches its 128-event sizing cap and per-API caps; it cannot prove global callback absence. The earlier saved snapshot contains the startup chain with 117 sizing events, no sizing drops, and tracing still armed, though its DefWindowProc API stream already has later drops.

Session 16535 exited cleanly at `2026-10-04T06:07:35.483Z`; all original observer imports were restored and tracing disarmed. All 86 served checks passed; `sizing-observer/runtime-validation.json` pins 34 published artifacts. This diagnostic adds no gameplay or FPS qualification. Next is a reviewed, narrowly scoped default minimum-size negotiation repair and regression plan, followed by an ordinary full-board check after any accepted build.

### Private repair validation

The shared `DefWindowProcA/W` change now queries the real guest minimum-size callback during default `WM_WINDOWPOSCHANGING` handling, using separate per-call scratch storage and rejecting incomplete callback output. It does not force Runenlegen-specific dimensions or alter host rendering defaults.

The private full-source control fails the new real-x86 callback regression at the expected missing callback (`0 != 1`). The candidate passes A/W callback, MoveWindow/SetWindowPos sizing, ABI, flags/styles, nested storage, sparse output/canaries, malformed limits and destruction cases. A separate shortened-budget variant executes an actual non-returning guest callback and confirms its output is rejected. Existing `test-windowpos-changing.js`, `test-wat-windowposchanged.js` and `test-win16-windowpos-defproc.js` also pass.

Production-shaped private modules are control `cac19c82387028429a827accceb1db82e79776cfade6338e3659f8a349bd3b6d` (1,664,736 bytes) and candidate `ad7c3f576405d03c2d7183d0aeacc2bee0998490b23952129ff0ddaaa4cd7499` (1,665,436 bytes). The canonical `f40d4ca3` module remains unchanged. Exact source pins and logs are in `minmax-implementation/validation-run/publication.json` under the preparation directory. Sessions 19279/45997 exited successfully and the compile/test resource was released. Full-board browser acceptance has not yet run; no FPS or release pass is claimed.

### Private candidate browser acceptance: separate child overlap remains

The ordinary candidate run is published at `scratch/runs/20261004-runenlegen-minmax-candidate/`: 34 artifact hashes and 86 served-source checks pass. Session 44313 exited zero; browser/server closed at 2026-10-04T17:45:42.197Z with no cleanup errors and no remaining process. Canonical f40 is unchanged.

The main frame now measures 658×451 rather than 400×300. Ordinary title dragging reveals its full frame, but the preview overlaps the board and roughly 170 pixels at the right remain unused. Root visually rejected the full-board gate. Beginner setup reaches stable 72 runes / 0 points / 96 moves; no placement was attempted after this gate failed. The result remains unknown, gameplayScreenshots empty, performance null; the earlier limited placement evidence is unchanged.

Passive renderer metadata records both children at (0,0), with outer dimensions 484×404 and 164×404. This proves their host metadata overlap, not the owning WAT geometry table or the responsible call sequence.

Static disassembly proves main WM_SIZE handler 0x4044cb first sizes the board at (0,0), obtains its rectangle and maps coordinates, then places the second child at a computed nonzero x through MoveWindow caller 0x404555. Registered board procedure 0x4026ec handles WM_SIZE at 0x403157 and self-sizes at (0,0) through caller 0x4031c2. Preview procedure 0x403514 handles WM_SIZE at 0x4037d0 and similarly resets (0,0) through 0x403835. The superficially similar 0x4039ff call belongs to a different custom control and is not the board procedure.

MoveWindow already compares pre/post client dimensions and adds SWP_NOSIZE for equality; DefWindowProc derives WM_SIZE only without that flag. A concrete discrepancy to test is fixed-frame arithmetic: AdjustWindowRectEx currently adds four pixels per side for this captioned style, while defwndproc_frame_width/NCCALCSIZE use three when WS_THICKFRAME is absent. That predicts a two-pixel excess in client width and height, which could provoke the preview's self-resizing WM_SIZE and reset its origin. This is not yet a demonstrated runtime cause. No child-placement patch was made.

### Corrected frame inverse and ordinary full-board acceptance

An actual generic-class API test confirmed AdjustWindowRectEx→CreateWindowExA→GetClientRect inflated fixed-caption clients by 2×1 pixels, and by 2×2 with a real attached menu. Thick-frame menu cases gained one extra vertical pixel. The narrow correction shares the existing fixed/sizing frame selector and matches the current 18-pixel menu reservation; it does not change renderer geometry, force sizes, or special-case this title. Thirty Ex/nonEx/style/edge/menu cases and four existing geometry/minmax suites pass. The durable regression is `test/test-adjust-client-roundtrip.js`.

Private production-shaped candidate `14aadaac5e6b64bbad3a0c846774ec48cae9eeb204bf7f3d7e241dc472a1c124` now shows the full 12×8 board with preview at right. After ordinary File→New→Beginner→OK, board/idle remain72 runes,0points,96moves. Ordinary click(56,98) places the gold M rune in the first cell, changes preview to pink M, and leaves71runes/0points/95moves stable in the following idle image. Root personally accepted this narrow scene/input evidence. Startup autoplay is excluded; no completed-game or FPS claim.

`scratch/runs/20261004-runenlegen-frame-candidate/` pins33artifacts and86served checks, all passing. Browser25427 exited0; cleanup18:10:04.170Z closes browser/server without errors and process check is clear. Canonicalf40 remains untouched; shared-source/main integration and public release are separate pending work.

## The 8x45 window on the CLI, and the frame counter (2026-10-10)

On the CLI's 640x480 screen the main window stayed an 8x45 frame. Startup
moves it to size 0x0 twice so that DefWindowProc's WM_WINDOWPOSCHANGING asks
WM_GETMINMAXINFO for the real size. The second answer is 656x449 (the 484x404
board plus the 164-wide info panel, adjusted), but `$windowpos_defproc_minmax`
discarded any MINMAXINFO whose `ptMaxTrackSize` was below `ptMinTrackSize`.
At 640x480 the default maximum is narrower than 656. USER/Wine raise the
maximum to the minimum instead, and so do we now. This reproduced on
`ce4f60b2` itself; the browser's 1024-wide desktop hid it.

The game centres itself from the pre-sizing 8x45 rectangle, so at 640x480 the
correct window starts at (316,217) and runs off-screen, as on real Windows.
Use `--screen=1600x1200` for a CLI route: File (816,607) -> New (838,628) ->
Beginner (96,79) -> OK (152,180); generating the board takes ~6000 batches;
a click on (820,640) places the first rune.

Frame counter: painting is event-driven (`InvalidateRect` -> `BeginPaint` ->
`BitBlt`). Idle: 0 paint cycles over 1000 batches. One placement: 3 paint
cycles, 14 blits. Frames per second is not a meaningful unit for this game.
Evidence `scratch/runs/20261010T0730Z-runenlegen-minmax-fix-frames-w6`.
