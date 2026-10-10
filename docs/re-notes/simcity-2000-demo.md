# SimCity 2000 Win95 Demo (`simdemo.exe`)

Registry id `simcity2000_demo`, local-only (`test/binaries/candidates/simcity-2000-demo/installed/`).
Maxis/MFC, MDI frame + one MDI child. Loads at the usual `0x400000`, so a
runtime EIP is the original VA unchanged.

Reaching the city headlessly (updated 2026-10-10; `test/test-simcity2000-gameplay.js`):

```
node test/run.js --no-build --app=simcity2000_demo --batch-size=20000 \
  --tick-ms-per-batch=16 --max-batches=3200 --max-seconds=240 --stuck-after=0 \
  --no-close --quiet-api \
  --input=25:dlg-cmd:1,700:mousedown:315:148,720:mouseup:315:148 --png=/tmp/sc2k.png
```

`25:dlg-cmd:1` answers the startup "Video Warning" box; "Load Demo City" is
now at (315,148) on the launcher (the old (215,93) misses since the 8-bit
desktop change). Use these batch settings: at run.js's default 200 ms per
batch the game is starved (about 0.1 palette ticks per guest-second) and the
demo notices ("I will now demonstrate some of the Disasters", then "still only
a demo ... return to the main menu") arrive before anything can be done. At
20000-block / 16 ms batches the map is live from ~batch 1500, the date runs
May 1982 -> Aug at batch 3000, and the January 1983 Budget window (pauses the
sim) is up by batch 5000.

The map animates by palette cycling, so an RGB screenshot diff cannot tell input
from animation: 16.8% of the map region (180,70 440x360) changes colour in 3
batches with no input, while two captures 90 batches apart can be identical
(the same phase of the cycle -- an earlier version of the test took that as a
0% null band). The main window's surface is 8-bit and 23% of its pixels
(71,458) use the animated indices 0xab..0xdb, so the animation is on screen.
Read the indices instead: `test_gdi_window_surface_record(hwnd)` gives bits
(+16), stride (+20), bpp (+24) in WASM memory.

Control response: the floating toolbar's rotate-left button (110,262) turns the
whole view -- 37.4% of the map region's palette indices change, against 0%
between two animation frames (whose colours differ by 16.8%).

Animation counter: SC2K has no frame loop and redraws the full map
(`BitBlt` 612x390 from its offscreen DC, return `0x466d83`) only ~4 times in 16
guest-seconds. Its animation clock is palette cycling: `AnimatePalette` on
palette `0x410014` from one site (return `0x4489ac`), entries 0xab+49 every tick
and 0xe0+16 on a slower cadence; the PALETTEENTRY array at `0x4b17d8` rotates
(`PC_RESERVED` grey/dark-blue/black). The test reads a `--count=0x4489ac` hit
counter through `exports.get_count(0)` at both ends of batches 2100-3100: 90
calls = 5.63 per guest-second (81 of them the 0xab range), identical across
runs. Do not count it with `--trace-api`: that re-enables the per-call API log
and writes ~130 MB per run.

Test-harness trap found here: piping run.js stdout (`execFileSync`) loses the
tail of the log, because run.js ends with `process.exit` while pipe writes are
still queued -- it looked like a nondeterministic route. Give run.js a file
descriptor (`stdio: ['ignore', fd, fd]`) instead.

## Functions identified

| VA | What it is |
|---|---|
| `0x00478c77` | startup display check — `GetDeviceCaps` RASTERCAPS/BITSPIXEL/PLANES, then the Video Warning |
| `0x004a87af` | registry-backed settings read (`RegQueryValueEx` through `[0x4d7760]`) |
| `0x0049b7ab` | matching settings write |
| `0x004a4977` | MFC MRU scan: walk an HMENU for a command id in `0xE130..0xE13F` |

## 256-color warning: original cause and indexed-desktop fix (2026-10-09)

`0x00478c77` reads `GetDeviceCaps(hdc, 12)` BITSPIXEL into EDI, `(hdc, 14)`
PLANES into EBX and `(hdc, 38)` RASTERCAPS masked with `RC_PALETTE` (0x100).
The original desktop reported 32 / 1 / 15033, matching its true-color backing,
so the `cmp edi, 8` at `0x478cde` failed and the warning
path runs. It is not a failure path: the code at `0x478cff` reads
`HKCU\Software\Maxis\SimCity 2000 Win95 Demo\Windows\Last Color Depth`, warns
only when the stored depth differs from the current one, and writes the
current depth back. So the box appears once per fresh registry and never
again, exactly as it would on real hardware after a resolution change.
The warning describes a real limitation: palette animation cannot recolor
already-converted 32-bit pixels.

The app registry now requests `desktopColorDepth: 8`. Both browser and CLI
configure process-shared display state before guest execution. Window surfaces
and compatible bitmaps retain 8-bit pixels, while the host converts through a
stable RGBQUAD system palette for presentation. `GetDeviceCaps`, current-mode
enumeration A/W and `GetSystemPaletteEntries` expose that same state.
`RealizePalette` assigns physical slots; `AnimatePalette` changes only the
requested reserved entries and uploads existing window pixels without rewriting
them. Deleting a logical palette releases its physical-slot ownership.

Two additional rendering gaps mattered: native shape drawing previously rejected
8-bit surfaces (black/missing controls), and ordinary `BitBlt` converted indexed
pixels through RGB even when the palettes matched. That collapses separately
animated entries of the same initial color. Matching indexed copies now retain
indices; transient `DIB_PAL_COLORS` transfers carry their logical-to-physical
mapping instead of quantizing those colors again.

`test/test-wat-gdi-indexed-desktop.js` checks real backing depth/stride, A/W mode
queries, retained-pixel animation, offscreen bitmap copies, independently animated
duplicate colors, animation-range isolation, nearest unrealized colors,
`PC_EXPLICIT`, control backgrounds, and restoration to truecolor. Existing palette
and window-surface tests cover the default mode as well.

This adds an initial indexed desktop; it is not a complete implementation of
foreground/background palette arbitration or depth-only `ChangeDisplaySettings`.
DirectDraw exclusive overlays retain their existing truecolor composition.

## "Load Demo City" used to hang: detached HMENU (fixed)

`0x004a4977` is MFC's scan for the MRU id block:

```
esi = GetMenuItemCount(hMenu) - 1
if (!count) return
loop: edi = GetSubMenu(hMenu, esi)
      if (edi) for (ebp = 0; ebp < GetMenuItemCount(edi); ebp++)
                   if (0xE130 <= GetMenuItemID(edi, ebp) <= 0xE13F) return found
      eax = esi; esi--; if (eax) goto loop
```

`hMenu` is `0x00BE0003` — MFC's `CMultiDocTemplate::m_hMenuShared`, loaded by
`LoadMenuA(0x400000, 3)` and *never attached to a window*. Our menu model kept
every blob in `MENU_DATA_TABLE[slot]` and resolved a handle by finding the
window that owns it, so `GetMenuItemCount` answered -1 for this one. `-1 - 1`
is -2, `test eax, eax` is nonzero, and the loop counts down through four
billion iterations.

Measured before the fix (`--handler-hist --handler-hist-thread=0 --handler-hist-start=2060`):
the three blocks `0x004a4993` / `0x004a499e` / `0x004a49ce` take **21,333,15x
entries each, 31.17% apiece — 93% of all work in the run**, with 23M Win32
calls against ~5 per batch before the click. `[sync] ABANDONED wndproc
hwnd=0x1003c msg=0x222 ... after 64 rounds` in the same log is the same event
seen from the other side: `$wnd_send_message` gave the MDI child's
WM_MDIACTIVATE 64 × 1,000,000 steps and gave up.

Fixed in `src/09c5-menu.wat` by materializing an unattached `LoadMenu` handle
as an ordinary dynamic (MNUD) menu built from its RT_MENU template, cached by
resource id (`$menu_detached_handle`). Afterwards: 711k API calls and 60,000
batches in 14.8s where the same route was 23M calls and 134k batches in 71s,
and the map draws. Covered by `test/test-detached-menu-handle.js`.

## City simulation: where the CPU goes (measured 2026-09-21)

Window: batches 8000-20000 of the recipe above (game date Mar -> Jul 1982),
`--handler-hist --handler-hist-thread=0 --handler-hist-start=8000
--hot-block-dump=` plus `--quiet-blocks` (without it the per-batch register
line is 45% of the process). Counts, not timings:

* 47.2M ops, 12.09M block entries: **3.9 ops per block**, ~11-12M ops per
  game month. Terminators: Jcc 75%, fall 7.2%, jmp 7.1%, ret 4.4%, call 4.1%.
* The simulation is 128x128 tile passes written with 16-bit frame locals and
  the same `0 <= x,y < 128` test repeated 2-3 times per tile, each compare its
  own two-instruction block (`cmp word [ebp-x],imm / jl`). No loop matcher
  sees any of it: loop-class-share says `none` 60%, `declined:call` 14%,
  DIAMOND ~16%, SELF 0.4%.

| region (share of block entries) | what it is |
|---|---|
| `0x45ad35` fn, loop `0x45b021` (18.2%) | per-tile score: two 4-compare bounds ladders, tile-bit tests via row tables `0x4b50f0`/`0x4b3710`, one if/else join `jmp` |
| `0x448e20` (12.6%) | neighbour walk: `call 0x40171c` per neighbour, then a tile-type range ladder (`cmp ax,lo / jb / cmp ax,hi / jb`) |
| `0x454f3e` (10.8%) | 128x128 pass clearing flag bits 0x10/0x08, four bounds checks per tile per bit |
| `0x458117` (8.3%) | 128x128 bit-mask pass then tile-type tests |

`0x40171c` is `jmp 0x423a11`: the exe is incrementally linked, 1624 `e9`
thunks at `0x401000..0x402fb8`, and thunk blocks are 1.95% of all block
entries in the window.

Two decoder costs this code shape exposes (counts from the same window):

* `$th_compute_ea_sib` (H149) is 2.76M ops, **5.8% of all ops** — a separate
  dispatch computing an address because the 16/8-bit memory handlers
  (`inc/dec word [ebp-x]`, movzx byte, `mov m16`) have no fused base+disp form.
* The fused `test r,r + Jcc` (H404, 844k) always leaves through
  `$branch_end`, so its not-taken edge never gets the free adjacent
  fall-through a plain Jcc gets.

Wasm self-time split (30000-batch run, `tools/dispatch-attribution.js`):
`$branch_end_at` 9.4% (the desk, including its successor dispatch), the
specialised Jcc handlers 10.9%, `$get_of` 2.1%, GDI/controls ~17% (font face
string compares on every text out, `$gdi_bitmap_font_face_equal` 2.0%, and
`$ctrl_get_wh_packed` 1.8%).

### What those three leads are worth (judged 2026-09-21)

App win = per-event saving × the event's share. Worked out for each lead before
spending the quiet box on it:

* **ILT thunk elision: built, correct, parked.** A direct `call`/`jmp` whose
  target is an `E9` thunk in the code section gets emitted at the thunk's
  destination. New handlers 470/471 bill the skipped block, so a batch still
  buys the same guest work. The result was pixel- and API-count-identical to
  baseline on SimCity, Caesar III, Marbles, Diablo and Heroes II, and it has a
  unit test with a negative control on the write guard. `bench-loops` `ilt_call`
  measured it at ~19ns saved per thunk (+18%). But thunks are 1.95% of block
  entries here and 1.01% on Caesar III, which comes to ~0.1-0.2% of app CPU,
  well inside the 1-3% null band. Not committed. Two traps if it is ever picked
  up again:
  1. **Follow one hop only.** This exe chains thunk to thunk (`0x401ae6` →
     `0x40d94a` → `0x490f93`), and the handler bills exactly one skipped block.
     Billing two as one shifted batch boundaries: +4% API calls, and a
     different PNG.
  2. **Land on the thunk when the transfer into it would have stopped**
     (budget ≤ 0, yield, `$dbg_chain_guard`, a bp on the thunk). Billing it
     anyway moves a batch boundary by one block, and PeekMessage then sees
     input one call early (first divergence at batch 106).

  Because `$dbg_chain_guard` includes the handler histogram, `--handler-hist`
  never shows an elided thunk. Use the plain-run PNG/API oracle and
  `bench-loops` instead.
* **H149 SIB fusion: not built.** Its consumers are spread over 7+ handlers
  (`test_m8_i8`, `movzx8`, `unary_m16`, `alu_m8_i8`, `movzx_r16_m8`, `mov_m16_r16`,
  `mov_r16_m16`, 184k-520k each). Broad fused SIB handlers were already
  measured as a loss in `docs/aoe-performance-optimization.md`. Upper bound
  ~0.5-0.9%.
* **H404 free fall-through: not built.** It is 1.8% of ops and saves at most
  one transfer on an adjacent not-taken edge, so ≤0.3%.

What is left is the 16-bit ALU / compare-ladder code itself: `alu_r16_i16` →
Jcc is the top pair at 3.7% of ops. A fold for that shape is the only lead here
that could clear the null band.

## "Zones never develop" was the city, not the emulator (2026-09-21)

A hand-built test city sat for a year of game time with every zone empty.
Hit counters on the monthly zone pass (the function holding call site
`0x42a465`) showed why, and each rejection was the game's own rule:

* `0x42a423 call 0x402450` → `0x448d3d`: is any road tile (XBLD `0x1d..0x2b`,
  plus a few crossing ids) within the 24 offsets at `0x4b1ec0` (a runtime-filled
  BSS table: the four axes out to 3 tiles, plus the ring at distance 2). 41 of 42
  zone tiles failed it.
* `0x42a465 call 0x401af5` → `0x42b083`: does the tile, or any of its
  neighbours, have XBIT (`0x4b3710`) bit `0x40` (powered)? Empty zone tiles
  never get `0x80`/`0x40` themselves. Only lines, plants and *developed*
  buildings carry power, so an empty block develops only from the edge that
  touches a powered tile, then spreads as buildings appear.

A second city laid out to those rules (zones ≤3 tiles from a road, a power
line touching every block) developed within four sim months and kept
growing. The budget, too, behaves: taxes accrue and are paid in January, so
funds are flat for eleven months of the year. Useful layers besides XBIT:
XBLD `0x4b50f0` (building id; `0x1d..0x2b` roads, `0x0e..0x1c` lines, `0xcf`
coal plant), XZON `0x4b2df0` (low nibble zone type, `0x10..0x80` building
corner bits), XTER `0x4b2b58` (low nibble slope; 0 = flat). All are 128-entry
row-pointer tables indexed `[table + y*4] + x`.

Driving it headlessly, three traps:

* **The demo's 30-minute limit is guest time.** The title-bar countdown
  runs on the headless clock, 200 ms per batch by default, and at zero the
  demo plays a disaster reel (Fire Storm, Volcano) over the city. "No
  Disasters" (WM_COMMAND 32782 to the frame) does not stop it. Pass
  `--tick-ms-per-batch=10`: the sim itself is interpreter-bound (one month is
  ~4000 batches either way), so this buys ~20x the game time.
* **Invisible modals eat input.** "Select Bridge", "connect to your
  neighbor for $1000?" and the January newspaper all block every later click
  without a word. Check a PNG after each batch of actions.
* **Placement is silent.** A building overlapping a road or water is simply
  not placed. A 3x3 building anchors at the clicked tile's top corner, and a
  4x4 one at clicked tile −1.

### Third city (2050 start, 2026-09-21): more UI gaps and workarounds

* **The map view had no scrollbars. Fixed.** The view (class
  `AfxFrameOrView`, WS_BORDER|WS_EX_CLIENTEDGE) creates two `SCROLLBAR`
  children and a `STATIC` size box. Two gaps broke them:
  1. HCBT_CREATEWND fired only for toolbar/combobox/edit native controls, so
     MFC never attached the CScrollBar wrappers. `m_hWnd` (`[obj+0x1c]`)
     stayed 0, and `MoveWindow(0, …)` at `0x40ca01`/`0x40cb59`/`0x40cc24`
     went nowhere.
  2. AdjustWindowRectEx gave the view a 4px border where nccalcsize gives it
     1px, so MFC placed it at (-4,-4) instead of (-1,-1). Its children then
     painted into the MDI child's frame.
  Test: `test/test-child-cbt-native-scrollbar.js`. The brown area after
  maximize is off-map background, not a missing redraw. The view keeps its
  top-left origin, and the map edge (the grey earth wall) is already on
  screen before the maximize.
* **Budget spinners are dead.** The Budget window's up/down arrows are
  ScrollBar controls (WAT control class 7). They are not drawn and ignore
  clicks, and typing into the percent fields does nothing. Posting the
  scroll message works:
  `exports.post_message_q(0x10088, 0x115 /*WM_VSCROLL*/, SB, hwndScroll)`.
  `SB_LINEDOWN` (1) lowers a service by 3% or the tax by 1, `SB_LINEUP` (0)
  raises it, and `SB_PAGEDOWN` does nothing. The post queue drops messages
  sent back to back, so step 30–40 batches between posts. Hwnds are per
  dialog instance: read them from the `[CreateDialog] ctrl` lines.
* **Select Power Plant sets up for ~1,900 batches.** Its WM_INITDIALOG
  moves the box to (0,0), builds eight plant pictures (7 CreateDIBSection)
  and only then centres it at (358,169): guest CPU (88% of batches spend the
  whole budget), not a paint bug. It looked like "a blank grey box whose
  buttons draw only when clicked" because DialogBoxParamA used to show the
  dialog *before* WM_INITDIALOG; since that was fixed it stays hidden until
  init returns and first appears complete and centred. Its buttons are 97x128
  cells in a 3x3 grid (coal, hydro, oil / gas, nuclear, wind / solar,
  microwave, fusion), with the client origin at (3,22). One click on a cell
  picks that plant and closes the picker. `dlg-cmd:<id>` does not.
* **Picker captions (Fixed 2026-09-22).** Each cell's "200 Mw $4,000 /
  Coal Power" is drawn with `CreateFontA(8, ..., "MS Sans Serif")`,
  `SetTextAlign(TA_UPDATECP)` and `MoveToEx` positions computed from
  `GetTextExtentPointA`. A positive 8 is an 8px *cell*. MS Sans Serif's
  smallest strike is 13px, and a raster strike cannot shrink, so Win98 returns
  the 13px cell. `$gdi_bitmap_font_height` used to squeeze the strike to 8px,
  which made the captions unreadable 5px smudges. "Mw" and the price now
  nearly touch on the long rows; that is the game's own x positions.
* **Coal picture (Fixed 2026-09-22).** All eight pictures come from one
  builder (CreateDIBSection returns to `0x4656a0`). It writes a 1064-byte
  BITMAPINFO into a fresh heap block and leaves biXPels/biYPelsPerMeter
  uninitialized (stale title text is seen there). The block for coal, the
  first item, landed at `0x7ee3aff8`, so biHeight was the first dword of the
  next sparse page. That page's backing was not adjacent in WASM memory, and
  CreateDIBSection read the whole struct through one `g2w` pointer. The call
  returned NULL, the cell stayed empty, and the blit helper `0x466cae` bailed
  on the null handle. With a different trace-flag mix the block shifted to
  `0x7ee3af80`, where only the color table crossed, and the coal plant drew
  pink. `$gdi_bitmap_info_wa` now gathers a BITMAPINFO that is not affine
  into a scratch copy. The constructor `0x464ee8` defaults the orientation
  field `+0x18` to -1 (top-down), which is what coal uses.
* **Palette fly-outs never opened (Fixed 2026-09-22).** A press on a group
  button (Recreation, Power, ...) calls MFC's CMenu::TrackPopupMenu
  (`0x48ca94`, called back to `0x48cae4`) with `TPM_RETURNCMD` (0x100),
  owner = the palette `0x10008`, anchored at the press point. The game
  arms whatever id comes back, or re-arms the group's last subtool on 0.
  We returned 0 at once for `TPM_RETURNCMD` and drew nothing. That looked
  like "the button remembers its subtool and overrides a posted
  WM_COMMAND". The call now parks on its thunk (yield 8) while the popup is
  open and returns the picked id (0 when dismissed), without posting it.
  The fly-out opens on the *press*. Click an item to pick it. After a pick
  the game redraws the whole map, ~1,000-3,000 batches of CPU at the
  default budget, and does not read input until it finishes; a press in
  that window is queued, not lost. Power > "Power Plant..." opens the
  Select Power Plant picker `0x10054` the same as posting 32839.
* **The underground (pipes) view leaves the map blank.** After a Pipes or
  Pump action the map, and for a while the status bar, stay grey. The next
  tool change then shows the underground view one tool late. A few thousand
  batches of sim restore it.
  Re-measured 2026-09-22 on a maximized 2050 city: the underground view
  renders correctly. The switch takes ~1,000 batches because every batch
  spends its full 1,000-block budget re-rendering the map (`--batch-stats`),
  under ~2s of wall clock. That is CPU, not a paint bug.
* **The status bar overprinted. Fixed.** Its text kept stale fragments of the
  previous string ("Pipes $3mp $100", "Small Park $20 0010"). The bar is an
  MFC CDialogBar, which means CreateDialogParamA with a NULL DlgProc on a
  classless template. There were three causes:
  1. We gave it the app's main wndproc. MFC's CBT subclass then saw
     AfxWndProc as the old proc and kept no super proc, so WM_ERASEBKGND went
     to DefWindowProc against the NULL-brush class.
  2. DefDlgProc returned at once when there was no DLGPROC.
  3. Its erase ignored wParam's clipped DC and wiped the panel frames.
  Now the bar gets DefDlgProc, which does its default erase through wParam.
  Test: `test/test-dialog-null-dlgproc-erase.js`. Each WM_PAINT is
  BeginPaint (the erase), three `FrameRect(BLACK_BRUSH)`, then
  `ExtTextOutA(ETO_CLIPPED)`.
* **Placement rules seen this run:** "Marinas must be placed across
  shorelines" (the 3x3 must include a water tile). The 4x4 solar plant and
  4x4 zoo take the clicked tile −1 as their top corner, like the coal plant.

## Fourth city (1900 start, 2026-09-22): an 18-year timelapse

Played from 1900 to the demo's end (Apr 1919) in the frozen control VM
(`run.js --control=PORT --frozen`, driven by `tools/ctl.js`) with
`record on`. Three emulator bugs turned up and were fixed:

* **Budget dialog fonts (0be89573).** A DS_SETFONT template's own font and
  base units now size the dialog. Before, it was laid out in the system font.
* **"New City?" in the budget header (db830507).** The header is a read-only
  ES_MULTILINE|ES_AUTOHSCROLL edit holding CRLF text. The unwrapped paint
  path drew each line's CR as a glyph. EM_LINELENGTH, End and Up/Down also
  counted it. Test: `test/test-edit-crlf-lines.js`.
* **The screen froze in the 7th January (866f4550).** Native controls paint
  through their internal DC hwnd+0x40000, which nobody ReleaseDCs. The
  DC-state table (512 slots) adopted a record on first paint and kept it
  after DestroyWindow. The budget dialog opens every January with ~70
  controls. After seven of them GetDC returned NULL and MFC threw
  CResourceException on every repaint, so the map stayed grey while the sim
  ran on. `$wnd_table_remove` now releases both internal DCs. Test:
  `test/test-window-dc-release.js`.
  The same leak is why the **Query box looked like it greyed the map** in
  this session (driving note below). The VM was started on a pre-fix build.
  Near the 512 limit, the extra DCs the open dialog took pushed the view's
  paint over it. The view, scrollbars, status bar and even the dialog's
  frame stayed grey until OK freed them. Re-checked 2026-09-22 on the fixed
  build at 640x480 and 1024x768, maximized, zoomed in and out, in the CLI
  and in the browser: the map stays drawn behind the box. Opening it does
  one view WM_PAINT, a BitBlt from the offscreen map. The DC table stays at
  6-8/512 after open and close. The same route on a build with 866f4550
  reverted reaches 485/512 after seven budget dialogs, and the map is flat
  grey.
  The palette's greyed buttons are the game's own paint. Before the modal
  it calls `InvalidateRect(palette)` and `UpdateWindow` (`0x41d503`) and
  blits the disabled art, and only then calls EnableWindow(FALSE) on the
  frame, the palette and the other tool windows. EnableWindow repaints
  nothing, as on Win98.

What looked like a sim bug and was not: by 1909 about 60% of zoned tiles
were XBLD `0x8a`/`0x8b`. The building names are string-table entries starting
at 612 for id `0x70`, so `0x88`/`0x89` are "Construction" and `0x8a`/`0x8b`
are "Abandoned building". The causes were the game's own rules:

* **No water.** The building's Query dialog said "Watered: No". XBIT bits:
  `0x80` powerable, `0x40` powered, `0x20` piped (reached by the pipe
  network), `0x10` watered (actually supplied). A piped-but-dry tile is
  `0xe0`, a supplied one `0xf0`. Supply is the limit: each pump makes
  ~32,400 gal/month, and adding two connected pumps took watered tiles from
  33 to 111.
* **Unpowered pumps and zones.** A pump next to *empty* zone tiles gets no
  power (see the power rule above), so it reads `0xa0` and pumps nothing. A
  whole industrial block zoned beside a road but not a line never developed,
  which starved residential demand.

Layers added to the list above: XUND `0x4b3dd0` (pipes `0x10..0x1e`; a pump
tile reads `0x1e`, a surface pipe crossing `0x11`), altitude `0x4b3a10`
(u16 per tile, 256-byte rows, low 5 bits = height).

Driving notes:

* **Query is on the right-click menu**, not the palette. The palette's "?"
  goes through MFC `CWinApp::WinHelp` (call at `0x48cde2`), which issues
  `WinHelpA(0x10004, "...sc2usa.hlp", HELP_FINDER=0xB, 0)`. There is no
  .cnt, so Help Topics opens on its Index tab (150 keywords) with no
  Contents tab, as Win98 does. It used to show an empty Contents tab (fixed
  2026-09-22). Right-click a tile, then pick "Query Tile" (32939). The map
  stays drawn behind the query box on a build with 866f4550 (see above).
* **"Dropped" first clicks and one-tile line drags were the harness, not
  the game.** After a tool pick the game redraws for ~1-3k batches before it
  reads input, and a drag sent as one mousemove only reaches the tiles the
  pointer visits. Wait for each `[check_input] msg=0x201/0x200/0x202` line
  before the next event, and send one mousemove per tile. With that, line,
  pipe, zone and bulldoze drags all place every tile. Still verify against
  XBLD/XUND, not the screen.
* **The underground view shifts clicks by (-1,-1) tiles** from the surface
  mapping (it draws the grid at a different altitude). Aim at (x+1, y+1).
* **Clock:** `{"action":"tick","ms":0.5}` before `record on` (tick changes
  are refused while recording) gives ~12k batches per sim month. A ctl
  `step` of more than ~4,000 batches outlives the client timeout.
* **The timelapse:** record at 10 fps, every 200 steps. Then run
  `mpdecimate`, drop frames with full-frame `signalstats` SATAVG < 10 (the
  grey map of the frozen stretch and the Query boxes), and play at 2x. The
  result is 68s for 1901-1919.

## Fifth city (1950 start, 2026-09-22): a 32px-zoom timelapse

A 7x2 road grid (blocks of 6x6), coal plant west, pumps on the river bank,
recorded at the default 32px zoom instead of the whole-map view.

* **Pause is one-way over WM_COMMAND.** Posting `32768` (Pause) to the
  frame `0x10004` pauses, but posting it again does not resume. Posting
  a speed (`32771` Cheetah) resumes.
* **Tick `0.2` ms/batch** gives about one sim month per ~25k batches and
  ~0.8s of the demo's 25-minute clock per 4k-batch chunk (Jun 1960 to May
  1964 in 1.2M batches and 238 demo-seconds).
* **The RCI gauge decides what to zone.** By 1952 about a third of the
  residential and commercial tiles were abandoned, with water mostly fixed.
  The gauge showed R and C negative and I strongly positive: the city had
  two industrial blocks against eleven residential ones. After two more
  industrial strips (and more pumps), built residential tiles went from 106
  (Apr 1952) to 237 (May 1964).
* **Buildings carry water.** Developed tiles next to a watered tile become
  watered, so a pipe every ~4 rows reaches a whole block. Supply is still
  the limit.
* **Screen-to-tile at 32px:** `sx = AX + (y-x)*16`, `sy = AY + ((x+y)*4+2)*2`
  for altitude-4 ground. One click on a scroll arrow moves the view about
  16 tiles, but a right-then-left pair does not come back to the same pixel.
  Recalibrate after every scroll with one cheap placement (a $10 road on
  empty ground), and read where it landed from XBLD.
* **Hills cover the tiles behind them.** A click aimed at an altitude-4
  tile two rows above an altitude-6 hill hits the hill tile, whatever the
  offset. Reach such a tile from another side (bulldoze a neighbour and
  build through it) rather than tuning the aim.
* **Roads and power lines that reach water raise "Select Bridge"**, a modal
  that eats every later click. Cancel it (its Cancel button is top left)
  and stop the drag one tile short of the shore.

## Indexed desktop verification (2026-10-09)

Before run: scratch/runs/20261009T0010Z-simcity-truecolor-before. Final run: scratch/runs/20261009T0048Z-simcity-indexed-desktop. Original fixture, fresh Chrome151 on isolated bx_jhtwtuhf, ordinary Load Demo City and centering click; no guest memory writes. Warning absent, simulation advances and viewport responds. Over34.55seconds,31 physical palette entries changed and4116/20000 water-crop pixels changed. All seven live windows use8-bit backing. Reviewed launcher, city and budget-dialog screenshots are in the run.

Canonical build and indexed-desktop, palette and window-surface regressions pass. Tested module SHA256: 7c0734dbc1670ea141e8e90f0fc5422be061848cd434c84f03d281b609a26b9e. Source pins and original fixture are preserved with the captures. Browser exited cleanly and boat stopped. FPS/audio were not measured; foreground/background palette arbitration and depth-only ChangeDisplaySettings remain outside this change.
