# Tetris for Windows (WEP1 / Win16)

## Modal About keyboard preprocessing — 2026-11-27

Ordinary Enter is valid: ABOUTTET.DLL dialog resources 100 and 101 both
declare a native BUTTON `&OK`, ID 1, style `0x50030001`
(`BS_DEFPUSHBUTTON | WS_TABSTOP`). The guest command branch at segment
1:01AF accepts IDOK/IDCANCEL and calls USER.88 EndDialog. The earlier renderer
observation `20261127-tetris-published-play-root` left About visible because
the Win16 modal pump dispatched Enter directly to that button without dialog
keyboard preprocessing. Its direct `dlg-cmd:1` gameplay test bypassed the bug.

The pump now queries WM_GETDLGCODE before handling Enter/Escape/Tab/arrows.
Far guest queries return through an invocation-owned stack record containing
both MSG layouts and window generations; the shared Win32 synchronous sender
would instead post the far query and prematurely return zero. Requested keys
remain with the guest, navigation uses the shared traversal helpers, and
commands use the Win16 WM_COMMAND layout. Focused tests cover a real nested
DialogBoxIndirect inside the query, target destruction, disabled buttons,
focused pushbutton/default selection and exact restoration of the modal SP.

Evidence and original-game verification: `scratch/runs/20261127-tetris-modal-keyboard-fix-root`.
The clean-candidate locked build and focused regression passed. A single
original Tetris run replaced only `dlg-cmd:1` with renderer Enter down/up at
40/41; F2 at 55/56 and Down at 170/171 retained every existing pixel oracle.
About disappeared, the caption activated, the first piece settled at the
bottom and the preview piece spawned. All three captures were inspected.
The run exited normally in 1.1 seconds under CLI 35s / process-group watchdog
55s / cleanup 65s limits; no leaked process was reported.

## Gameplay regression correction — 2026-09-19

The old test's first failure required an active blue main caption while the
modal About DLL was open. The saved native Win98 reference has an **inactive
gray caption** at exactly that stage:
`test/output/win16-v86-comparison/wep16_tetris/native.png`, with capture/payload
metadata in `native.json` (2026-08-22). Current local captures show the same
activation sequence: gray during About, blue after dismissal. The test now
requires both states, rather than treating gray as missing paint.

Microsoft documents the active/inactive nonclient distinction in
[WM_NCACTIVATE](https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-ncactivate).
The native capture, not the modern documentation alone, is the evidence for
this particular Win98 modal state. This does not prove every About pixel is
native-identical: the native capture uses 16-color VGA and a taskbar, and
dialog background/text differences are outside this test correction.

The former piece assertions also assumed magenta followed by green. Fresh
captures instead show cyan/yellow or gray/cyan sequences. Gray is a valid
piece, so a saturation-only predicate is also wrong. The test now samples
nonblack colors from the active piece inside the black board and from the
Next preview (excluding its gray background), then follows those colors to
the settled piece and successor. The checked board areas exclude gray borders.

Timing matters: with the previous 200 ms/batch clock, removing Down still
allows gravity to settle a piece before the final screenshot. Use 20 ms/batch,
start via F2 at 55/56, capture at 150, Down at 170/171, capture at 230, stop at
245. This leaves time for spawn/painting without letting gravity substitute
for the hard drop.

The top-of-board pixel minimum changes from color-specific 250/400 to 100:
an entering piece may expose only one tile (149 nonblack pixels), depending
on shape/spawn phase. In exchange, the settled-piece check is strengthened
from >100 to >500 matching pixels (four tiles contribute 596), with an
additional exactly-empty bottom-before-drop check. The >600 changed-pixel
board assertion and all About-logo/client-background checks remain.

An in-memory negative variant with Down removed fails specifically at the
settled-piece check. Local logs: `/private/tmp/wa-tetris-corrected2.log`,
`/private/tmp/wa-tetris-no-down2.log`. No runtime behavior changed.
The complete WEP1 suite passes **8/8**, with two additional standalone Tetris
passes. Logs: `/private/tmp/wa-tetris-wep1-suite.log` and
`/private/tmp/wa-tetris-repeat.log` (plus the focused corrected run above).

```sh
node test/test-win16-wep1-gameplay.js tetris
```

## Initial erase versus synchronous UpdateWindow — 2026-09-20

Enabling synchronous Win16 UpdateWindow exposed a runtime ordering bug:
USER.42 ShowWindow(SW_MAXIMIZE) posted WM_ERASEBKGND for main HWND 0x10001;
USER.124 then painted the tiled client immediately; the queued erase later
reached USER.107 DefWindowProc and covered the tiles with the gray class
brush. The opening About logo survived, but its exposed parent was flat gray.
Trace: `/private/tmp/wa-update16-tetris-trace.log`; before/after captures:
`wa-update16-tetris-before.png`, `wa-update16-tetris-after.png`.

ShowWindow now completes its initial erase through a far continuation rather
than posting it. Tetris's existing startup-background and hard-drop checks
pass again, as does the full eight-game WEP1 suite. This was an emulator
ordering regression, not a reason to relax the native-reference assertions.

## Modal About caption and foreground (fixed 2026-10-10, e82eaec16)

`test-win16-wep1-gameplay` failed on main: "Tetris caption must remain visible but inactive behind modal About".
- The About box is a Win16 `DialogBox` (USER.87); `$win16_dlg_run` showed it but never activated it.
- Since aba07804c (2026-09-20), the renderer's foreground is only what was explicitly activated, no longer the
  top of the z-order. A top-level caption is drawn active iff `host_foreground_window()` is that window, so Tetris
  kept a blue caption under its own modal dialog.
- The dialog is now published as foreground once shown, and the foreground goes back to a visible top-level owner
  when it ends. `$active_hwnd` never left the owner, so the focus transaction at dialog end saw no transition and
  would not republish it.

Gameplay A/B on `--tick-ms-per-batch=20` (About OK at batch 40, F2 at 55):
- Down at batch 170 hard-drops the piece and spawns the next one.
- Without input, the piece falls by gravity at ~20 px per guest second, about 2 rows/s at level 1. It is linear
  over 1.6 s and 5 s windows.

Evidence: `scratch/runs/20261010-wep16_tetris-drop-ab`.

## Line clear crashed in GDI.42 InvertRgn (fixed 2026-11-24, issue #32)

GitHub issue #32 reported Best of Windows Entertainment Pack (BOWEP) Tetris
trapping with `RuntimeError: unreachable` the moment a row completes
(prev_eip `0x001068cf`). The BOWEP floppy (`archive.org/details/wep_best-of`,
SZDD-compressed `TETRIS.EX_`) expands to **the same binary** as WEP1's
`TETRIS.EXE` (SHA-256 `7f240d18…48e2b`), as does `ABOUTTET.DLL`; see
`test/binaries/SOURCES.md`.

- Cause: Tetris flashes the completed row with `GDI.42 InvertRgn(hDC, hRgn)`
  (the call at `0x001068d3`, returning to `0x001068d8`). `$win16_gdi` had FrameRgn
  (41) and CombineRgn (47) but no 42, so the call fell to `$crash_unimplemented`.
  The last log line before the trap is `[win16] GDI.42 INVERTRGN ret=0x001068d8`.
- Fix: `$win16_InvertRgn` in `src/09e-win16-api.wat` widens both handles and
  forwards to the 32-bit `$handle_InvertRgn` (`$gdi_hdc_invert_rgn`, XOR per
  region band); Pascal epilogue pops 4 argument bytes, AX = BOOL.
- Test: `test/test-win16-invert-rgn.js` drives ordinal 42 through `$win16_gdi`
  on a real 16-bit frame (fails before: ordinal unhandled).

Line-clear route (deterministic, `--tick-ms-per-batch=20 --batch-size=20000`):
About OK at 40, F2 at 55, then 9 hand-placed pieces; the 10th (an L, rotated
once and moved 4 right) fills columns 8-9 of row 0 at batch 1039. The exact
`--input=` list is `route-input.txt` in the run folder; it was built from a
`run.js --control --frozen` + `tools/ctl.js` session log. After the fix Lines
goes 0 -> 1 and play continues. The BOWEP copy run without `TETRIS.INI` starts
at level 6 but gets the same piece sequence and clears the same row.

Evidence: `scratch/runs/20261124-issue32-bowep-tetris` (repro-crash.log before;
after-fix-*.png, bowep-after-fix-1080.png after).
