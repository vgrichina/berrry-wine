# JigSawed (Win16, Entertainment Pack, VB1)

Registry id `wep16_jigsawed`: `test/binaries/wep16/WEP2/JIGSAWED.EXE` with `VBRUN100.DLL`, picture files
`BRICKS.BMP`, `FISH.BMP`, `RUG.BMP`, `TANKER.BMP` and `TREES.BMP`. It is a Visual Basic 1 program, so every
control is a `Thunder*` class with a guest wndproc. `ThunderCommandButton` and `ThunderLabel` are shadowed onto
the native BUTTON and STATIC wndprocs (`$win16_shadow_command_button`, `09e2-win16-dialog.wat`).

## Headless route (`test/test-win16-jigsawed.js`)

```
node test/run.js --app=wep16_jigsawed --max-batches=1500 --quiet-blocks --input=205:dlg-click:1,\
215:click:20:31,240:click:80:52,300:click:150:150,330:click:475:180,800:png:/tmp/board.png
```

- Batch 205 dismisses the startup About box. Since about September it opens at batch 198, not 172; a
  `dlg-click` before it exists logs `NO DIALOG`, and the About box then blocks the whole route.
  `B:wait-dlg-control:1` waits for it robustly, but it delays every later event.
- Game > Open puts up the VB1 file picker. Select `bricks.bmp` at (150,150) and press OK at (475,180).
- The picture is scrambled into pieces using the guest clock. In this route a 108x59 piece sits at
  [226,203]-[334,262), and dragging it 60 px down moves it exactly.

## Window layout after loading

- The main window is 0x10002 (maximized 640x480, client origin 4,42).
- The visible viewport is ThunderPictureBox 0x10006, 612x414 at (4,42), with a vertical scrollbar at x 616 and
  a horizontal one at y 456.
- The board is ThunderPictureBox 0x10007, 640x480, a child of 0x10006, scrolled to screen (-10,9).
- The game draws into a 640x480 AutoRedraw memory bitmap (CreateCompatibleBitmap / CreateCompatibleDC), then
  BitBlts piece rectangles to the viewport.

## Fixed 2026-10-10

1. **Thunder OK did nothing** (f4f937b3f). The picker form is owned by the main window, so `$button_wndproc`'s
   VCL heuristic posted CN_COMMAND (0xBD11) back to the button instead of WM_COMMAND to the form. That heuristic
   came in with 312d48941 (2026-08-26) and is now skipped under `$is_win16`.
2. **USER.59 SetActiveWindow trapped** (f4f937b3f). The form calls it on its owner after hiding. It now runs
   the Win16 focus/activation path and returns the previously active window.
3. **The board covered the caption, menu and scrollbars** (a00df147f).
   `$gdi_win16_autopresent_child_bitmap` attaches the 640x480 AutoRedraw bitmap as 0x10007's own surface,
   which is correct. But `_clipRectForChildSurface` in `lib/renderer.js` clipped a child surface only to the
   top-level frame. It now intersects every ancestor's client area.

## Measured

- The board repaints only on input. Batches 850-1450 of the drag A/B saw 9 BitBlt and 3 FillRect calls in the
  drag arm and none in the control arm.
- `--trace-win16` is the counter for this app, since Win16 apps report 0 Win32 API calls.
- Evidence: `scratch/runs/20261010-wep16_jigsawed-piece-drag-ab`.

## Open

- While a piece is dragged, nothing is drawn at the cursor in the captures; the source spot goes black until
  release.
- Placing a piece into its solved slot has not been tested.
