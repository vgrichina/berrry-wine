# TetriNET

`test/binaries/candidates/tetrinet/TETRINET.EXE`, app id `tetrinet`. A Delphi
VCL program: every screen is a `TForm`, and the text boxes are `TEdit` (WAT EDIT,
class 2). The server listens on 31457. The game is played across two emulator
processes in one virtual-LAN room (`test/test-vlan-tetrinet.js`).

## Windows (single-process run, `--batch-size=25000`)

| hwnd | what |
|---|---|
| 0x10002 | TForm1, the main form (partyline, setup screens) |
| 0x10020 | a TEdit on the main form (parent chain 0x1001e -> 0x1001d -> 0x10002) |
| 0x10011 | TForm2, "TetriNET Playing Fields", **top-level**, no EDIT child |

Numbers differ in the two-seat run: there the partyline chat TEdit was 0x10043.
Read them with `--input=B:dump-windows:label`, not from this table.

Reaching the fields form alone: `--app=tetrinet --batch-size=25000
--input=1200:click:319:284,1500:click:57:455`. The first click dismisses the
first-run dialog, the second opens Playing Fields. Focus is 0x10011 from batch
~1505 on. No game is running in one process, so nothing falls.

## Keyboard

The fields form takes the game keys itself (verified: Left moves, Space
hard-drops). **Fixed 2026-10-10 (f5fa852b6):** every arrow
key used to move the focus to the main form's first TEdit. The renderer's
`_findWatEditTarget` asked WAT's `edit_command_target()`, and that export
`set_focus`es the first visible EDIT in any window before it returns.
`check_input_hwnd` then said `keyboard -> focus 0x10020` (or `0x10043` on the
two-seat route), and the piece did not move. If keys stop working again, look
for something that moves focus between `renderer.handleKeyDown` and the guest's
poll. `exports.get_focus_hwnd()` read in a frozen control session before and
after `renderer.handleKeyDown(37)` tells that apart from guest behaviour in one
eval.

## Two-seat gameplay A/B (server side)

`test/test-vlan-tetrinet.js`, with `VLAN_AB_VK` set to 37 (Left, default and
checked), 32 (Space) or 0 (no key). The server, bob, clicks Start New Game at
GAME=5300100. At GAME+5 it raises Playing Fields, at GAME+12 it focuses the
form, and at GAME+19 it takes t0. Six presses follow at GAME+22.., and t1 is
taken at GAME+41. The client runs at `--tick-ms-per-batch=20`. Otherwise its
untouched pieces top out and the match ends before the window.

Result on a 4 vCPU boat, two rounds, identical pixels each round
(`scratch/runs/20261010T1035Z-tetrinet-focus-ab`). The piece is measured as the
coloured-pixel box in the own field at x 21..212, y 47..398, in 16 px cells:

| arm | t0 | t1 |
|---|---|---|
| none | col 5, rows 79..110 | col 5, rows 159..190 |
| Left x6 | col 5 | **col 0** (against the wall), rows 159..190 |
| Space x6 | col 5 | pieces stacked at the bottom, rows 47..398 |

## Frame counter

There is no BitBlt and no SetTimer. The loop is PeekMessageA plus timeGetTime.
Each field is drawn one 8x8 cell at a time by StretchBlt from a tile sheet:
return address **0x419f7b** (1053 of 1057 StretchBlt calls).
InvalidateRect at return **0x41680d** covers the six field windows. Count both
with `--count=0x419f7b,0x41680d` and read them at fixed batches with
`--input=B:hit-counts:label`. Do not read them through a control eval:
its timing follows the wall clock, and on the boat it landed 100k+ batches after
the match had ended.

Over batches GAME+45..GAME+345 (60 guest-s at 200 ms/batch): none 4.40 cell
blits/guest-s, Left 4.33, Space 7.57 (InvalidateRect 0, 0, 18). TetriNET draws
only on change: a row step of the falling piece (about 1.1 rows/guest-s),
a landing, or a peer's field arriving off the wire. So this rate depends on
input and on the peer. It is not a fixed frame rate.
