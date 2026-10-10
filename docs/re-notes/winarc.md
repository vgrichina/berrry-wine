# Winarc (wep32-community)

Borland OWL puzzle collection: `binaries/wep32-community/Winarc/Winarc.exe`,
registered as `winarc`. The 400x300 launcher holds only a menu; every puzzle
(Bishops, Boxes, Hex, Knights, Krypto, Life, Loyd, Mazes, Memory, Pegs, Queens,
Rubik, Sieve, Spaceship, Sudoku, Triads) is its own top-level `OWL_Window`
created from the Window menu. A few (help.txt/noname.txt RICHEDIT viewers, the
"colors" dialog) are created hidden at startup.

## Route (headless)

Menus open with press, gap, release: `1500:mousedown:39:31,1520:mouseup:39:31`
opens Window; `1570:mousemove:42:151,1590:mousedown:42:151,1610:mouseup:42:151`
picks Life (Queens is at 52,251). F5 (`keydown:0x74`/`keyup`) is Step.

## Life draws slowly -- capture after the first paint

The Life window ("noname.lif", title `generation N [cells; 51x58 toral]`) paints
its board in one WM_PAINT: CreateCompatibleBitmap(312x274), then the bitmap is
selected into three successive memory DCs (deselected before each DeleteDC),
each live cell is one `Rectangle`, and the last DC is BitBlt'd to the BeginPaint
DC. That one paint is ~3,500 API calls, so at the default batch size the board
first appears around batch 2,900 although the title already reads generation 0
by batch ~2,200. A capture in between shows a blank grey client and looks like
a lost blit; it is not (memory-DC reuse is correct). Each F5 is ~3,700-4,100
calls and two board blits. Evidence: `scratch/runs/20261010T1100Z-winarc-life-step-w6`.

## Open

- The menu accelerator labels read `?F5`: the strings are built at runtime
  (no `F5` text in the resources); not investigated.
- Queens draws its board the same way (240 Rectangles) but has not been
  taken through a reviewed A/B.
