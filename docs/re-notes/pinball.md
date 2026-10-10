# Space Cadet Pinball mobile presentation

App `pinball`, executable `test/binaries/pinball/pinball.exe`.
Investigation: 2026-09-10, local LAN8088 isolated branch; not production.

## Startup clipping

Actual Chrome touch viewport 375x628: window 606x460 at (17,-9), client
600x415 at (20,32), virtual desktop 400x670. The single-app compositor bounded
its source to the desktop, yielding only 383x451 at (17,0). Thus Fit lost the
top and right BEFORE scaling. The old fractional mobile crop was measured
against that truncated image, and became wrong when the full scene existed.

The executable contains `-fullscreen` and `-quick`. A browser launch with
`-fullscreen` confirmed a native 641x481 display at (0,0), without caption or
menu. `test/test-pinball-fullscreen-menu.js` also exercises the native
WM_COMMAND 403 toggle and restoration of the menu when leaving fullscreen.

The registry now supplies `singleAppArgs: '-fullscreen'`; browser-shell
selects it only for single-app launches. Ordinary desktop and CLI defaults
are unchanged. This is guest fullscreen, not permission to force Safari's
browser fullscreen API.

## Normal and Table views

Normal (`fit`) contains the entire native scene, including the score panel.
Table (`zoom`) contains native rectangle (32,32,352,449), preserving its aspect
and both ends of the table rather than forcing an aspect-fill trim. The
registry fractions are relative to the 641x481 native display. Pinball's
mode-button labels name the destination: Table / Normal.

Fullscreen rotation initially still failed: the generic single-app maximizer
and `handleScreenResize` treated the game like a maximized desktop window,
changing its width from 641 to 844. The fractional crop then included part of
the score panel. Exclusive games now retain their selected native geometry
through host viewport changes; only presentation is resized.

Touch regions are table-relative in both modes. In Normal they occupy the
table subrectangle, not the score panel; in Table they use the presented
table itself. Existing Z, slash and Space held-key behavior is unchanged.

## Coverage and limits

`test/test-single-app-mode.js`: native dimensions survive rotation, complete
Normal scene, identical contained Table crop in portrait and landscape,
aspect preservation, phone-only startup configuration.
`test/test-touch-controls.js`: table-relative zones and destination labels.
Adjacent keep-aspect and browser touch-input suites also pass.

The browser probe uses the real executable on LAN8088 and captures Normal
and Table in both orientations. Chrome touch emulation is not an iPhone
acceptance test. If the user manually exits native fullscreen via Pinball's
own toggle, the old windowed compositor clipping path is still a separate
general fixed-window issue; the phone profile avoids it at startup rather
than changing desktop placement semantics.

## Fullscreen-menu regression harness correction (2026-09-18)

The release check initially failed 3/4 assertions, identically before and
after the Diablo changes. In Chrome, F4 enters fullscreen and a second F4
restores the caption and menu. The CLI recipe was sending commands too early
(batches 20/30), and its generic `post-cmd` menu-owner lookup falls back to
the first/helper HWND once fullscreen removes the game's menu. Pinball's game
window is the second HWND, so the exit command could go to the wrong window.

The test now uses `wait-title-command` to target the game window explicitly,
after startup at batch 60 and after the transition at batch 100. The menu is
examined at batches 140/150. All four assertions pass: SetMenu detaches then
restores handle 16782948; Options opens with eight entries including Players
and Music; no crash. No emulator change was needed for this reported failure.

## Modal controls and high-score entry

Flipper hit regions now have equal half-table widths; the smaller plunger
region overrides the lower-right lane. Zone borders/backgrounds are invisible
idle, with only a faint pressed highlight. Native modal dialogs hide/release
game controls and fit their complete rectangle, retaining the game view mode.
`dialogbox_hwnd` reads SHARED_DLG_PUMP_HWND for guest DialogBoxParam dialogs;
the existing `modal_dialog_hwnd` remains specific to WAT common-dialog input
routing. Do not conflate these two pumps.

Original EXE VAs: viewer 0x01005412(table), entry
0x01005452(table, score, rank, name), shared dialog proc 0x010051b5.
Entry flag 0x01028270, score 0x01028268, rank 0x01028274, name pointer
0x01028278. Entry initialization enables and focuses EDIT 601+rank; the
viewer intentionally has no caret. Probe the entry branch during the single
real WM_INITDIALOG, not by sending initialization a second time.

Confirmed drawing bug: the entry EDIT overlaps the earlier static name label.
Implicit dialog sibling clipping left only the edit's first three pixel rows
visible, so WM_GETTEXT returned "Mobile" while its glyphs were absent.
`dc_exclude_siblings_for_clip` now lets native controls without explicit
WS_CLIPSIBLINGS draw over siblings in Win32 as already done for Win16.
Custom painters retain their dialog exception (CD Player LED / WEPUTIL).
The real browser probe now shows the text; window-surface tests cover both
the implicit exception and explicit clipping contract.

The mobile proxy also tracks focus obtained outside a gesture. A later tap
can blur/refocus once if the keyboard never appeared, instead of treating DOM
focus as proof Safari opened its keyboard. Visible keyboards are undisturbed.
Browser bridge/unit tests cover this retry; real iPhone acceptance is pending
because no live phone session was connected during this verification.

## Headless play, control response and frame counter (2026-10-10)

CLI route at `--args=-quick --batch-size=50000 --tick-ms-per-batch=10`. The
table reads "Awaiting Deployment" by batch 1000.
- **Plunger:** hold Space for **2 guest-s** (b1000-1200). A 1 s hold lifts
  the ball up the lane and it falls back, which is what the older captures
  showed as "no verified ball movement". After a 2 s hold the ball scores
  (8250 by b1535).
- **Flippers:** Z changes 704 bottom-left pixels and 0 bottom-right; `/`
  (VK 0xBF) changes 728 bottom-right and 0 bottom-left.

Two `--input` runs give byte-identical captures.

**Frame counter.** Space Cadet draws with GDI, so `--present-distinct` sees
nothing. One render pass is `GetDC` (returns to `0x01003454`), then that
frame's dirty-rect `StretchDIBits` (returns to `0x010046e4`; the moving
ball is an 11x11 rect), then `ReleaseDC` (`0x010046ff`). The call chain is
main loop `0x01021109` -> `0x01008a32` -> `0x01014cbd`. Over batches
1200-1800 (6 guest-s) there are 1831 passes. That count is the same at 100k
blocks per batch (1829), but rises to 2422 when batches are 5 ms instead of
10 ms. The loop is the famously uncapped one: it renders whenever its clock
moves, so the headless rate follows the batch-clock granularity and is not an
FPS.
Evidence: `scratch/runs/20261010T0555Z-pinball-control-frames`.

## Headless route, plunger A/B and the frame counter (2026-10-10)

`node test/run.js --app=pinball_plus95 --tick-ms-per-batch=5`: the table is up
by batch ~8000 ("Awaiting Deployment"). Holding Space for ~200 batches and
releasing deploys the ball ("Hit Mission Targets To Select Mission"); without
input the panel still reads "Awaiting Deployment" at the same batch. At the
default 200 ms/batch a short press appears to do nothing: a frame costs ~2.4
batches, so the game sees about two frames per guest second.

Frame counter: every `StretchDIBits` returns through `0x40e3bd` (one dirty
rectangle per call) inside the flush called from `0x415b12`; count frames at
its landing `0x415b17` (`--count=0x415b17`; `0x4151e2` agrees), not
`StretchDIBits` calls (253 frames vs 340 blits in one window). The rate is
interpreter-bound: 253 vs 234 frames for the same 600 batches at a 5 and a
10 ms tick (84 vs 39 per guest second), 186 with the ball in play. Evidence
`scratch/runs/20261010T0705Z-pinball_plus95-control-frames-w6`.
