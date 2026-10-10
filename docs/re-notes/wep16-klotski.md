# Klotski (Win16, Entertainment Pack 3)

Registry id `wep16_klotski`: `test/binaries/wep16/WEP3/KLOTSKI.EXE` plus `KLOTSKI.SCO`. Main window 480x321 at
(20,20), not maximized; client origin (24,62), client size 472x275. Its 16-bit hwnd is 0x104.

## Headless route (deterministic, 2026-10-10 on 819097f50)

```
node test/run.js --app=wep16_klotski --stuck-after=0 --input=200:click:316:277,220:click:46:51,\
235:click:64:72,265:click:232:374,295:keydown:65,295:keypress:65,295:keyup:65,305:click:222:188,345:png:/tmp/board.png
```

The steps:
1. Batch 200: Welcome MessageBox OK.
2. Batch 220: Game menu.
3. Batch 235: Level 1.
4. Batch 265: "Select a puzzle" OK.
5. Batch 295: type a name ("A").
6. Batch 305: name OK.
7. By batch 345 the Daisy board is up.

## Board geometry, from the game's own Rectangle calls (BeginPaint DC)

- The field spans client x 196-272 and y 88-182.
- Columns of 14-px tiles start at client x 198, 216, 234 and 252 (18-px pitch).
- Rows start at client y 90 (tall row), 126, 144 and 162.
- The two middle cells of the bottom row start empty.

## Input

- On each WM_TIMER the game calls GetCursorPos, ScreenToClient(0x104) and SetCursor, then InvalidateRect. This is
  the hover cursor, at seg 3:0xa7d.
- The press is WM_LBUTTONDOWN, followed by UpdateWindow and SetCapture; WM_LBUTTONUP after a drag moves the block.

## Explained: picking lands one column right (the game's own arithmetic, not an emulator bug)

The WM_LBUTTONDOWN handler (seg 3:0x7e5) stores lParam x and y, then calls the pick routine, entry #18 at
seg 10:0x0:

```
col = floor((x + 13) / cellW) - floor(originX / cellW) + 7
row = floor((y + 4)  / cellH) - floor(originY / cellH) + 7
```

- The live values are originX=198 and originY=90 (the first tile's top-left, centred in the 472-px client), with
  cellW=cellH=18. They are found through the DS selector table: `[DS:0x18c8]:0x1816/0x1818` for the origin,
  `[DS:0x18c6]:0x689c` and `[DS:0x18cc]:0x689e` for the cell size.
- 198 is 11*18, and the two floors are taken separately. So a press in the first 5 px of a tile (x in
  198+18i..198+18i+4) picks column i, and the rest of the tile picks column i+1.
- Verified: a press 2 px into column 2 moves column 2; a press 6 px in moves column 3.
- Every input the game uses matches Win98 for this window: lParam, the GetCursorPos/ScreenToClient POINT, and
  GetClientRect 472x275 (a 480-px window minus a 4-px thick frame each side). The game imports no
  SetWindowOrg or SetViewportOrg.
- Routes should press within the first 4 px of a tile.
- The hover timer at seg 3:0xa7d adds the same +13/+4 and only sets the cursor shape.

## Fixed 2026-10-10: puzzle-selector body was blank

The "Select a puzzle" dialog (DialogBox template 0x4a2, then MoveWindow(110,130,420,280)) draws eight 72x72
thumbnails in its WM_PAINT, BitBlt into the BeginPaint DC at x 16/116/216/316 and y 16/116 from a memory DC.
Those pixels did reach the dialog surface, but WM_ERASEBKGND was delivered to the modal pump *after* EndPaint
(wParam = the already-released paint DC), and the pump's default erase painted the background over them.

Cause: Win16 BeginPaint sent the pending erase through the window's table procedure, which for a dialog is
USER's WNDPROC_DIALOG marker; that path reaches a 16-bit DLGPROC only by queueing. BeginPaint now resolves
the marker to the DLGPROC, sends WM_ERASEBKGND through the far continuation before returning, and on FALSE
does DefDlgProc's erase through the paint DC (re-exposing native controls). Unit case in
`test/test-win16-windowpos-defproc.js`; evidence `scratch/runs/20261010T1035Z-wep16_klotski-selector-fix-w6`.

The small uploads at dialog-surface y 357-370 (x 39..179 step 20) seen in --trace-gdi were not the cause: the
thumbnail uploads land at the right client offset (3,23). What draws those small strips was not identified.
Note `[gdi]` and `[win16]` trace lines come from different streams, so their order in one log is not reliable.
