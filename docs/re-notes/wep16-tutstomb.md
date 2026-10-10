# Tut's Tomb (Win16, Entertainment Pack 2)

Registry id `wep16_tutstomb`: `test/binaries/wep16/WEP2/TUTSTOMB.EXE` (uses WEPUTIL). Pyramid solitaire: remove
pairs that sum to 13; a King goes on its own. Main window class `TUTSTOMB`, wndproc seg 1:0x254, created
616x440 at (10,20); a `Stat` child (status bar) at the bottom shows Time and the $ score. DS base in the
arena is 0x110000 (DS:0x0f40 = 0x110f40).

## Window procedure map (seg 1)

- Message switch at 1:0xe6e. A jump table at 1:0xe8a covers messages 1..0x14: WM_CREATE goes to 0xa4c and
  WM_SIZE goes to 0xb62.
- Above 0x20 the switch compares one by one: 0x111 goes to 0x388, 0x200 (mousemove) to 0xa5c, 0x201 (lbuttondown)
  to 0xdd6, and 0x204 to 0xdc6. WM_LBUTTONUP is not handled.
- WM_SIZE stores `cx-1` at DS:0xf02 and `cy-1` at DS:0xf04, and nothing else. This is the only place the
  game learns its client size.
- WM_LBUTTONDOWN returns at once if DS:0xee2 is nonzero. Otherwise it calls 1:0x2c0c(hwnd), which takes no
  coordinates: it acts on the card the WM_MOUSEMOVE handler last hovered (DS:0xc56 / 0xd74). A click with no
  mousemove before it does nothing.

## Fixed 2026-10-10: pyramid laid out at x = -35

The board drew with its apex at x=-35 and the right pile at x=-81, i.e. as if the client were 0 px wide, and
it stayed that way. Win16 ShowWindow posted the main window's first WM_SIZE; USER sends it from inside
ShowWindow, and the game lays out the pyramid in the UpdateWindow that follows, before the queue runs. Win16
ShowWindow now sends that size (SIZE_RESTORED) through its synchronous show continuation. The case is in
`test/test-win16-windowpos-defproc.js`.

## Route (headless, default batch size)

```
node test/run.js --app=wep16_tutstomb --stuck-after=0 --no-close \
  --input=396:mousemove:530:355,398:mousemove:535:358,400:mousedown:535:358,404:mouseup:535:358,460:png:/tmp/t.png
```

The deal is up by batch ~390. In this deterministic deal the bottom-right card is K♠: hovering and clicking
it moves it to the discard pile, and the score goes from -37 to -24.
Evidence: `scratch/runs/20261010T1120Z-wep16_tutstomb-wmsize-fix-w6`.
