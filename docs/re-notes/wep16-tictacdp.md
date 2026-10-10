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
  no timer (SetTimer is never called), and nothing pending explains the wait. Narrowed down so far:
  - The EXE has `Timer1_Timer`, `Timer2_Timer` and `Timer3_Timer` handlers, plus `xRndCol`, `NextRColChk`
    and `NextDGColChk`, so the computer's move almost certainly runs from a VB Timer control.
  - None of the three is ever enabled. There is no USER.10 SetTimer in the 2,000 startup batches or after a
    move, and no GetTickCount/GetCurrentTime either: the splash does not use a timer.
  - VB timers themselves work here. Rattler's VBRUN100 calls SetTimer from its timer code (eip 0x5801f7)
    and its snakes step on WM_TIMER. So TicTacDrop's own code stops before it would set `TimerN.Enabled`.
    The EXE has `AnimationErr` / `ApiError` labels, so a VB runtime error swallowed by `On Error` is a
    candidate.
  - After the drop, Picture1_MouseUp (this game drags by hand: Picture1_MouseDown/MouseMove/MouseUp with
    `BltMouseObject`, not VB drag-and-drop) only updates the two status labels and returns.
  - Next step: find what the VB code checks between the label update and enabling the timer. That needs VB3
    p-code reading or a breakpoint on the VBRUN100 property-set path for `Timer.Enabled`.
- A release at x=210 lands in column 2, not column 1. It is not yet known whether that is the game's own
  arithmetic.

Evidence: `scratch/runs/20261010T1200Z-wep16_tictacdp-sound-byname-w6`.
