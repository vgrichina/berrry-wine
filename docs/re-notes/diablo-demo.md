# Diablo pre-release demo (August 1996)

`lib/apps.js` id **`diablo_demo`**: `DIABDEMO.EXE` with its own `STORM.DLL`,
the `diablo.exe` archive mounted at `c:\` and `z:\`, and
`asyncMultimediaTimer: true`. On the CLI, pass `--async-mm-timer` to match
the page: the loading loop waits on `timeSetEvent` without pumping the
window queue. Saves go to `C:\Save\Game00.sav` plus `Level*.sav`. This is a
different binary from `diablo_shareware` (`diablo-shareware.md`).

## Route to Tristram (CLI, 2026-10-10)

`--batch-size=200000 --tick-ms-per-batch=50 --repaint-every=20`:

| batch | input | screen |
|---|---|---|
| 1500 | move/down/up on 320,265 | NEW GAME -> Choose Class |
| 1730 | move/down/up on 320,310 | WARRIOR -> Enter Name |
| 1960-2005 | G, A, L: each `keydown`+`keypress`+`keyup`, 20 batches apart | name typed |
| 2030 | **`keypress:13`** (WM_CHAR 0x0D) | Tristram by ~3100 |

Clicks are mousemove, mousedown, a 20-batch gap, then mouseup.

**The name field reads WM_CHAR, not WM_KEYDOWN.**
- Enter is accepted only as WM_CHAR 0x0D. Backspace deletes only as WM_CHAR
  0x08.
- A `keydown:13` / `ctl.js key VK_RETURN` is delivered, but the game ignores
  it and stays on Enter Name forever. That is the "dark transition after name
  entry" reported on 2026-10-03.
- `ctl.js type` sends a whole word inside one batch; the field keeps only the
  last letter.
- The page posts WM_CHAR 13 for Enter (`charCodeFromKeyEvent` in
  `lib/browser-input.js`), so Enter works there. It deliberately sends no
  WM_CHAR 8 for Backspace (the WAT edit deletes on WM_KEYDOWN), so on the page
  Backspace cannot edit this name.

## Control and frame counter

Two runs of one command differ only in two clicks. Run A clicks the ground at
(450,230) and the bottom-left INV button at (40,378).
- All captures through the town (b3100) match byte for byte.
- Run A: the warrior walks off and the Inventory panel opens.
- Run B: he stays by the cottage door.

**Frame counter.** The game never Flips or Blts. Each frame is one `Lock`
(returns to `0x40cd84`) / `Unlock` (returns to `0x40d18f`) of the primary
`0x08011008`, which is present-distinct slot 1. It is the same **20 Hz loop**
as the shareware build. At a 25 ms tick every frame is exactly 2 batches
(50 ms) apart: 400 over 19.95 guest-s. At a 50 ms tick the timer and the batch
edges drift and 45 frames in 400 batches drop (17.8 per guest-s), so measure
at 25 ms.
Evidence: `scratch/runs/20261010T0625Z-diablo_demo-control-frames`.
