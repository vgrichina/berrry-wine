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

**Two-player mode is playable end to end.** Open Options (104,31), then Players (120,51), then Two (290,74)
with press-gap-release clicks. Then:

1. Red: the drag above.
2. Blue: drag from the right bin (473,152) and release at (400,112). It lands in column 8.

The turn passes back ("Player 1's turn", "Two Player Game"). Only one-player mode needs the computer
(see Open).

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
  - VBRUN100's Timer control code is segment 70 of VBRUN100.DLL, at arena 0x580000 in both Rattler and
    TicTacDrop. It works as follows:
    - The property setter is at 70:0xf6. Property 2 is Enabled: nonzero goes to 70:0x108 and calls the start
      routine 70:0x1a0; zero goes to 70:0x116 and calls the stop routine 70:0x212.
    - Property 3 is Interval. It stores the dword at ctrl+0x44 and jumps to 70:0x108.
    - The start routine calls SetTimer only when four conditions hold: the interval at ctrl+0x44 is nonzero,
      DS:0x396c == 2 (run mode), the Enabled bit (ctrl+0x42 bit 0) is set, and bits 1-2 are clear.
  - `--count` in the computer-first scenario (Options > Who's First? > Player 2), 2,600 batches:
    - The setter ran 9 times: 6 Enabled sets, **all False** (70:0x116 = 6), and 3 Interval sets.
    - The start routine ran 3 times (all from the Interval sets) and stopped at the Enabled-bit test each
      time (70:0x1db = 0).
  - So the VB timer machinery is fine, and the game never executes `TimerN.Enabled = True`, with the
    computer first or after a player move. Turning Sound off changes nothing.
  - Demo menu handler, decoded with `tools/vb-pcode.js` (2026-10-10):
    - It is p-code segment 0x4ef (linear 0xac0000), offsets 0x0f0..0x1f2, ending at `3fd6`.
    - Every dispatch after the click stays in that segment. `3802 0001 0026`, `3802 0001 0008` and
      `38e5 0001 04b2` are therefore runtime/library calls, not calls into other p-code.
    - The status label's Caption is set by `37dd 00b2 / 37d2 054e / 2c92 "To stop the Demo..." / 15cc /
      ... / 38de 02f8`.
    - The handler never touches a timer and simply returns. Nothing enables one afterwards (setter counts above).
  - So what should drive the computer's move is not in this handler. Candidates:
    - another event procedure (the timers' design-time state looks deliberate);
    - a branch on the INI-derived globals (`NUMOFPLAYERS`, `FIRSTPLAYER`, `g_fDemo`) in a procedure not reached here;
    - a Paint event of a hidden picture (`Picture2Paint` / `Picture3Paint`).
  - Next step: name the core opcodes (`37dd`/`37d2` control refs, `38de` property access, `2502`/`23ab` variable
    store/load), then decode `Picture1_MouseUp` and `Form_Load`.
  - Capture recipe: `--trace-eip-range=0x140000-0x14ffff --trace-eip-detail` armed from batch 0 (a late
    `--trace-eip-from` logged nothing here, cause not found). Dispatches are the rows where EAX equals EIP's low
    word. Bytes come from `--trace-at=<handler> --trace-at-mem=es:esi-N:LEN`.
- A release at x=210 lands in column 2, not column 1. It is not yet known whether that is the game's own
  arithmetic.

## Picture1_MouseUp, traced dynamically (2026-10-10, w5)

All of this is from `--screen=1024x768` at origin/main 841a0036e. Board at batch 1500; drag 361,296 ->
400,262 (above column 1, accepted) or -> 400,298 (over the top cell, rejected).

**Tracing a late window works.** Launch with `--control=PORT --frozen --trace-eip-range=0x140000-0x14ffff
--trace-eip-detail --trace-eip-from=999999` so the flag is present but never auto-armed. Then
`ctl.js eval 'exports.set_trace_eip_range(1,0x140000,0x14ffff)'` before the input and `(0,0,0)` after.
Detailed output stops after about 252k [EIP] lines, so arm at most a few hundred batches at a time. Breakpoints
work too: `eval 'exports.set_bp(0x14298a)'`, then `step 1` stops at the first hit in each batch. At the hit,
`get_sreg_es()`, `get_esi()` and `get_ebp()` give the p-code position and frame. The p-code data segment
(DS) is **0x47f** during dispatch, not 0x17.

**Where things are.** MouseUp is p-code segment **0x52f** (entry 0x30, returns at 0x716). The drop animation
is 0x68f. It calls the delay routine 0x60f, a bare `For i = .. To 2000 : Next`. `365e` is VB's per-statement
tick (decrement SS:0x86, then yield every 32768 statements), not DoEvents. So the animation spins rather than
waits, and it finishes. Win checks run as separate event invocations in 0x53f/0x537 -> 0x65f/0x667. Then
the app is idle in VBRUN's message loop. **No p-code runs at all after that**, and the timer setter (70:0xf6,
runtime 0x5800f6) is never entered after the move.

**Opcodes needed for MouseUp's conditions**, read from VBRUN100 seg 2:

| Op | Meaning |
|---|---|
| `232c X` | push global, via `[DS:X]` into seg `SS:[0x2e2a]` (0x457) |
| `23ab X` | push `[DS:X]` (0xd2 = 0/False, 0xf4 = True) |
| `2498 X` | push local `[BP+[DS:X]]` |
| `264d X` | store a local |
| `2502 X` | store a global |
| `2c03` / `2c0e` / `2c14` | push 1 / 2 / 3 |
| `2bfb` | push 0 |
| `2d37` | `=` |
| `2d96` | `<` |
| `2d83` | `>` |
| `2d5d` | `<=` |
| `3041` / `3008` | float `<` / `>` (fcompp/fnstsw/sahf at 2:0x2fcd) |
| `2da6` | Not |
| `2db1` | And |
| `2dbc` | Or |
| `3753` | nop |
| `298a T` / `2987 T` | if top == 0 goto T |
| `2a71 T` | goto |
| `3d79 n S` / `3d76 n S` | call p-code sub S with n args |
| `3fd6` | return |

`tools/vb-pcode.js decode` loses sync on the variable-length ops (`3d76`, `37d2`, `38de`). The dynamic
dispatch list (`ES:SI-2` = op) is the reliable listing.

**Globals.** G398 (0x457:0x1e4, linear 0x9901e4) is **NUMOFPLAYERS**. 0x4bf:0x918..0x994 reads it with a
Declare'd profile call on the literal "NUMOFPLAYERS" and keeps 1..2, default 1. So the value 1 here is right
for a one-player game. G420 = 0.

**MouseUp's decisions** (locals: L828 = column, L830 = row, L838 = a flag, offsets through the DS:0x47f
table):

- 0x0ac sets `L838 = False`. Then `If 0 < X < f() And 0 < col <= G10c Then If row < 1 Then L838 = True`
  (0x164..0x178). That is the above-the-board release, and it is the only one accepted.
- Over-the-board release at 400,298: col = 1, row = 1, so L838 stays False. The next test, 0x182..0x196,
  is `If Not <array 009e/00ee>(row, col) = 0 Then GoTo 0x25a`. It jumps, which skips the block at
  0x19a..0x258 (`bounce.wav`, and L838 = False or True). At 0x25e `If L838` then fails and the ball goes
  back. **Open:** is that array element (fInUse?) really set for an empty top cell, or is the 2-D index in
  `075a` (2:0x75a, calls 2:0xa51) wrong?
- The final guard at 0x6b2..0x6da is `If Not G420 And ((G398 = 1 And Not L838) Or G398 = 2) Then
  Call 0c1e : ctl244.prop416 = 1`. With an accepted drop, L838 = True, so it is skipped.
- **Forcing that guard True** (writing -1 over the condition at the `298a` breakpoint, 52f:0x6dc) did
  **not** bring a computer move in 600 batches. So that block alone is not the computer's move.

**Next:** read the array element that the over-board path tests (`075a 0002 009e` / `432e 00ee`) on an empty
board, and step through the over-board path's 0x19a..0x25a block. A normal over-board release is probably the
designed interaction, and its rejection the real bug.

Evidence: `scratch/runs/20261010T1200Z-wep16_tictacdp-sound-byname-w6`;
`scratch/runs/20261010T1803Z-wep16_tictacdp-player-move` (w5).
