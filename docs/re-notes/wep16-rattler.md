# Rattler Race (Win16, Entertainment Pack 2, VB1)

Registry id `wep16_rattler`: `test/binaries/wep16/WEP2/RATTLER.EXE` with `FIELD100.DLL`, a VB custom control for
the playfield. The form is 0x10002 (`ThunderForm`). The playfield is 0x10007 (`ThunderClfFld100`, 266x266 at
187,130); it has the keyboard focus during play and owns two `ThunderLabel` children ("Paused.", "Press F3 To
Continue.").

## Controls (verified 2026-10-10)

- **The player is the YELLOW snake.** The green one is the computer's rattler.
- It steers on **WM_KEYDOWN arrow keys** and on **mouse clicks** in the field (a left click turns it left).
- A reversing direction is ignored.
- An ASCII keypad `WM_CHAR` ('6', '2') reaches the focused field control but does **not** steer. An earlier test
  comment claimed "pix_KeyPress (ASCII keypad)"; that is wrong, and the test only passed because the board moves on
  its own.

## Headless route

```
node test/run.js --app=wep16_rattler --batch-size=2000 --repaint-every=20 --input=200:mousedown:300:55,\
201:mouseup:300:55,500:mousedown:210:72,501:mouseup:210:72,520:mousedown:230:94,521:mouseup:230:94,\
800:keydown:37,802:keyup:37
```

- At batch 800 the yellow snake is heading up toward the top wall. LEFT saves it; with no input it dies at
  about batch 850 (2 -> 1 lives).
- `test-win16-vb-gameplay.js` runs this as a steered-vs-control A/B.

## Pace

- The snakes step on WM_TIMER.
- Over batches 700-1000 (60 guest seconds at 200 ms/batch) there are about 11.8 BitBlt and 16 GetPixel calls per
  guest second, the same with or without steering.
- `--trace-win16` gives the census; Win16 apps report 0 Win32 API calls.

Evidence: `scratch/runs/20261010-wep16_rattler-steer-ab`.
