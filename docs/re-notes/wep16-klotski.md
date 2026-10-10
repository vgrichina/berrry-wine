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

## Open: picking is one column to the right

A press over column N moves the block in column N+1:
- A press at client (222,151) is drawn column 2, row 3, yet the column-3 block moves down.
- A press over column 3 does nothing, since the cell below column 4 is occupied.

Ruled out on 2026-10-10:
- The lParam is (222,151), and the client origin is right.
- The POINT the game gets from GetCursorPos plus ScreenToClient is (222,151).
- GetClientRect returns (0,0,472,275) from batch 5; WM_SIZE reports 472x275.
- Drawing matches the game's own coordinates.

Next step: disassemble the WM_LBUTTONDOWN pick with `tools/ne-disasm.js` and find what it subtracts before
dividing by 18.

## Open: puzzle-selector body is blank

The "Select a puzzle" dialog draws eight 72x72 thumbnails, BitBlt into DC 0x141 at x 16/116/216/316 and y 16/116,
from a memory DC. Nothing reaches the screen.

Evidence: `scratch/runs/20261010-wep16_klotski-move-ab`. The 2026-10-03 browser runs saw the same offset
(drag at 246 moved the tile at 265).
