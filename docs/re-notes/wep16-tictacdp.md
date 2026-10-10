# Tic Tac Drop (Win16, Entertainment Pack 4)

Registry id `wep16_tictacdp`: `test/binaries/wep16/WEP4/TICTACDP.EXE`, a Visual Basic 3 program, with
`TicTacDp.brd`, CMDIALOG.VBX and THREED.VBX. The board is drawn into one picture box, 0x10017 (narrow 0x134):
the play area at client (0,32), 580x379. The bins and balls are windowless image controls on that picture
box. The 22 hidden children (0x10018..0x1002d) are off-board sprite strips, not drop targets.

## SOUND through Declare (fixed 2026-10-10, 218fb34a2)

The game Declares the Windows 3.0 tone generator: `OpenSound`, `SetVoiceSound`, `StartSound`,
`WaitSoundState` and `CloseSound` from `sound.drv`. Declare is GetProcAddress by name, and the SOUND module
had no name table, so every drop raised "Sub or Function not defined". The names now resolve (all 17
exports, held as constants in `$win16_sound_ordinal`). The game then loops on `WaitSoundState(1)` until it
answers 0. Nothing is ever queued (OpenSound still answers "device not available"), so every wait state is
already reached.

## Route (headless, default batch size)

The splash clears and the 8x8 board is up by batch 2000. Drag the top red ball out of the left bin and
release it **above** the board, over a column top:

```
--input=1990:mousemove:169:152,2000:mousedown:169:152,2010:mousemove:180:140,2020:mousemove:195:130,\
2030:mousemove:210:112,2040:mouseup:210:112
```

The ball drops to the bottom of column 2 (for x=210), and the status bar says "Computer's turn". A
release over the board itself (screen y 137..250) is rejected: the ball animates back into the bin, the same
result for any x.

## Open

- The computer never moves. After "Computer's turn" the game idles in PeekMessage/WaitMessage. It creates
  no timer (SetTimer is never called), and nothing pending explains the wait.
- A release at x=210 lands in column 2, not column 1. It is not yet known whether that is the game's own
  arithmetic.

Evidence: `scratch/runs/20261010T1200Z-wep16_tictacdp-sound-byname-w6`.
