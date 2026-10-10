# Diablo II Shareware demo

## Package and installer

The local package is Blizzard's `DiabloIIDemo.exe`:

- size: 138,309,685 bytes
- SHA-256: `89352716523e474514553e2092a1ae9349c5c7ff9e79c7861dd65fe19be88b61`

`test/test-diablo2-demo-installer.js` drives setup without fixed-batch dialog
timing. It waits for `Diablo II Shareware Setup`, clicks the launcher's Install
button, waits for each real InstallShield control, accepts the default path,
and reaches the shortcut/copy phase. A full acceptance run continued through
the 127 MiB copy. The worker finished after about 205 seconds; the outer setup
window remained on `Adding shortcuts to the start menu..`, but the complete
installed payload was present in the VFS. The retained acceptance screenshot
is `/private/tmp/diablo2-installer-complete.png`.

Saving that VFS exposed a host-export collision: setup creates both the file
`C:\support\images\msproxy` and descendants below a directory with that name.
`lib/vfs-export.js` now preserves the file as `msproxy.__vfs_file__` rather
than failing the whole export. `test/test-vfs-export.js` pins that behavior.

The installer-produced payload is staged locally under
`test/binaries/candidates/diablo-2-demo-installer/installed-extracted/`. Its
core pins are:

| File | Size | SHA-256 |
| --- | ---: | --- |
| `diablo ii.exe` | 2,154,496 | `d0aa0d30b55f8313e04026cca560ef0d178ee76b2ece6c3ccdc1fca4af46b3f1` |
| `d2data.mpq` | 44,301,122 | `82ed65b7f574234a22a36abb4a6d6a1e7f8bebc4746192f39cdb6603ee382d49` |
| `d2music.mpq` | 32,743,265 | `631172d59cc4a8d9b42faade73b194140b6a327811ea556562df9c89f857a694` |
| `storm.dll` | 266,280 | `2b6a27f223aac30d2d383f185705be55f43f37a687aa76ebe307a1035b6eea2d` |

## Registry evidence

The raw captures remain under `/private/tmp` and are not corpus fixtures.
Relative to a clean profile, setup wrote:

- `HKCU\Software\Battle.net\Configuration`, `Server List` = `exodus.battle.net`
- `HKLM\SOFTWARE\Battle.net\Configuration`, `Server List` = `exodus.battle.net`

A clean installed-game launch reaches the menu without pre-seeding either
key. The game itself creates
`HKCU\Software\Blizzard Entertainment\Diablo II Shareware` with:

- `CmdLine` = `ii.exe -skiptobnet`
- `InstallPath` = `C:\`
- `UseCmdLine` = DWORD `0`

It also probes `CompressedData` and preference values, but none is required to
launch this package.

## Compatibility fixes

The installed executable and its DLL graph exposed three concrete gaps:

1. CRTDLL `_vsnprintf` was missing. The bounded formatter now returns `-1`
   without a terminator on truncation, matching the Win9x CRT contract.
2. D2Sound imports authentic Win98 DSOUND ordinals 1 and 2. They now resolve
   to `DirectSoundCreate` and `DirectSoundEnumerateA`.
3. The original 64-entry synchronization table filled during startup. Storm's
   later transient `CreateEventA` returned NULL, so a one-byte MPQ member
   (`data\local\use`) reported `ERROR_HANDLE_EOF` and the game stopped in
   `Archive.cpp` line 143. A 256-entry diagnostic build showed startup fill
   every slot through `e00ff`; the final 512-entry/8 KiB table leaves space
   for the fixed pool and streaming events. The same run then read all MPQs,
   initialized DirectDraw and sound, and rendered the main menu.

The final installer-produced game screenshot is
`/private/tmp/diablo2-installed-sync512.png`: an 800x600 DirectDraw frame with
the animated Diablo II logo, Single Player button, Shareware v1.04 label and
Exit Diablo II button. `test/test-diablo2-demo-installed.js` reproduces this
from a clean profile, skips the intro with normal keyboard input, pins the
EXE/data archives, and validates those menu regions.

One non-fatal diagnostic remains: the loader's first bounded D2CMP `DllMain`
pass reports an incomplete return and the game's recovery path logs an
`SMemReAlloc()` message before normal initialization repeats successfully.
It is not present in the rendered game UI and does not prevent the menu or MPQ
streaming, but it is the next cleanup target if DLL initialization is made
fully resumable.

## Character creation and gameplay

The installed demo originally crashed immediately after confirming a new
Barbarian. A normal-input trace (Single Player, double-click Barbarian, focus
the name field, type `TEST`, press Enter) stopped at batch 588 in two adjacent
CRTDLL imports:

1. `strncmp(0x01e4face, 0x009facf4, 10)` jumped through `0x009c4d7e` to the
   fail-fast unimplemented handler.
2. After implementing that function, `_strnicmp(0x01e4f898, 0x005cb3a4,
   0x7fffffff)` did the same through `0x009c4d78`.

Both are now real cdecl handlers: `strncmp` compares unsigned bytes and both
functions stop at the first difference, a shared NUL, or the requested count;
`_strnicmp` additionally folds ASCII A-Z. Zero count returns equality without
dereferencing either pointer. `test/test-strncmp.js` pins those edge cases and
the cdecl ABI.

With both imports present, the same input sequence clears the animated Act I
loading portal and reaches the playable Rogue Encampment at batch 1600 with a
one-million-block batch budget. The retained frame is
`/private/tmp/d2world-1600.png`; it contains the Barbarian and NPC, rain,
torches, terrain, belt and skill bar, plus the red life and blue mana orbs. A
ground click later scrolls the world to the wagon without a trap; that frame is
`/private/tmp/d2world-2200.png`. `test/test-diablo2-demo-gameplay.js` reproduces
hero creation from `--app=diablo2_demo` and asserts the rendered terrain and
HUD color regions, not merely process survival.

## Performance and SIMD

The playable trace is CPU-emulation bound rather than blocked on an obvious
host-side subsystem. Over 400 seconds it made 1,754,049 Win32 API calls (about
4.4K/s), while the interpreter recorded three active cooperative guest
threads, 17,089,938 block decodes, 46,860 live-cache evictions and 1,672 full
cache clears. The page's DirectDraw path already coalesces dirty presentation
to at most one upload per animation frame. No API, audio, timer, networking or
surface-upload storm was identified.

The cache-clear pressure came from fixed reservation rather than typical
compiled size. The old allocator reserved 16KB for every compiled 4KB guest
page; a fixed-allocator sample of 795 Diablo II pages found a 2,411-byte mean,
with 78.1% fitting in 4KB, 97.1% in 8KB and 99.5% in 12KB. Compiled pages now
use 4/8/12/16KB classes, grow only when emitted code requires it, and recycle
safely retired chunks. A directory clock also makes the separate 128-index
limit explicit instead of refusing all later pages. On the final replay through
batch 1660 this reduced full resets to 13; the fixed-size trace recorded 128
resets during batches 1500–1600 alone and 1,672 by batch 2300. Because the host
load varied substantially, this establishes the cache-pressure improvement but
is not presented as a wall-clock FPS measurement.

MMX is advertised and implemented, with packed operations lowered to
WebAssembly SIMD, but this run retired exactly zero MMX instructions. Static
SIMD clusters exist in `ijl11.dll`, `binkw32.dll` and `smackw32.dll`; the active
game and DirectDraw renderer DLLs contain no credible SIMD routine. The main
EXE's three isolated SSE-looking byte sequences are low-confidence scan
coincidences, SSE is not advertised, and no SSE path executes. Implementing
more SIMD is therefore unlikely to be the first-order gameplay speedup for
this shareware build; interpreter/cache/thread efficiency is the measured
target.

## Gameplay hot-loop census

A post-cache gameplay histogram over batches 1500..1660 mapped runtime block
entries back through each PE's load delta and then checked every hot backward
edge in disassembly. The table groups blocks belonging to the same loop nest;
`top entries` is the hottest constituent block, not a sum or an instruction
count. This avoids double-counting nested loops.

| Guest instance | Runtime range | Original PE range | Top entries | What it does |
| --- | --- | --- | ---: | --- |
| main | `0x86e1ed..0x86e275` | d2gfx `0x100031ed..0x10003275` | 924,243 | clipped rows; inner one-source palette translation at `0x86e24e` |
| main | `0x4d8e70..0x4d8e9f` | EXE, same VA | 739,112 | scans an array of rectangle/region pointers and performs four bounds tests |
| main | `0x86c141..0x86c2e2` | d2gfx `0x10001141..0x100012e2` | 434,355 | 15-row Duff/jump-table renderer with 32 unrolled one-source LUT pixels |
| main | `0x86c34d..0x86c6c3` | d2gfx `0x1000134d..0x100016c3` | 324,300 | 15-row Duff renderer with 32 unrolled two-source 64K blend-table pixels |
| main | `0x86e34d..0x86e418` | d2gfx `0x1000334d..0x10003418` | 251,520 | clipped rows; inner two-source palette/blend translation at `0x86e3ca` |
| main | `0x655465..0x6554af` | d2cmp `0x6fe28465..0x6fe284af` | 235,366 | signed RLE command stream: skip, change row, or `REP MOVS` literal run |
| main | `0x6556a1..0x6557b5` | d2cmp `0x6fe286a1..0x6fe287b5` | 226,217 | clipped RLE row decoder; optional in-place two-input palette translation |
| main | `0x4946e4..0x494748` | EXE, same VA | 217,280 | nested 8x8 lighting/color-grid sampling through `0x430df0` |
| main | `0x65813f..0x658186` | d2cmp `0x6fe2b13f..0x6fe2b186` | 217,088 | nearest-color search using three squared channel distances |
| main | `0x42f8d9..0x42f90c`, `0x42fbe0..0x42fc1c` | EXE, same VAs | 119,808 | initialize and populate the 48x48 map/light grid, including region queries |
| main | `0x430b73..0x430c60` | EXE, same VA | 112,632 | nested lighting interpolation and per-cell contribution calls |
| main | `0x5025ff..0x5026ed`, `0x502a53..0x502b66` | EXE, same VAs | 107,520 | scan fixed bucket arrays and linked game-object/client records |
| main | `0x86c736..0x86c8e0`, `0x86c9a1..0x86ccff`, `0x86cdc3..0x86cff8` | d2gfx `0x10001736..0x10001ff8` | 112,010 | compressed CEL RLE renderers with unrolled LUT/blend suffixes and clipping |
| main | `0x88f753..0x88f790` | d2ddraw `0x10003753..0x10003790` | 96,354 | short DirectDraw buffer/scanline loop |
| main | `0x86e471..0x86e73e` | d2gfx `0x10003471..0x1000373e` | 84,900 | visible-tile/object traversal that selects and calls the renderer variants above |
| main | `0x42145d..0x421475` | EXE, same VA | 120,960 | 128-bucket array plus linked-list callback walk |
| main | `0x493f84..0x49433b` | EXE, same VA | 60,148 | object/cell render preparation with nested fixed 6x6 grids |
| main | `0x4b54fb..0x4b5561` | EXE, same VA | 60,175 | Bresenham-like collision/region walk with bounds queries |
| main | `0x651188..0x651252` | d2cmp `0x6fe24188..0x6fe24252` | 65,174 | scan zero/nonzero spans and emit bounded RLE literal/skip commands |

Smaller measured backedges (hottest block 20K–53K) are the same classes, not a
new dominant idiom: more clipped d2gfx CEL variants (`0x86d0da..0x86d4d5`),
D2CMP state/color transforms (`0x652851..0x65294c`,
`0x653f8f..0x65408b`), EXE object/list traversals (`0x421274..0x4212c1`,
`0x4300d6..0x43049c`, `0x494b22..0x49514e`), short memory scans/fills
(`0x41fd7e..0x41fda6`, `0x4c9e2e..0x4c9e45`), and two short coordinate loops
at `0x4dea38` and `0x4deae2`. Most contain calls, pointer chasing, multiple
branches, or fixed two-dimensional control and are not safe LUT_RUN shapes.

Generalized H418 LUT_RUN removes both genuinely hot byte-translation
self-loops: d2gfx runtime `0x86e24e` and d2cmp runtime `0x655762`. In the same
160-batch main window it reduced handlers from 262,313,891 to 257,258,415
(1.93%) while processing 1,381,859 pixels. The remaining first-order local
target was the straight-line/unrolled d2gfx family, especially
`0x86c141..0x86c2e2`; it needed an unrolled-LUT recognizer, not broader
self-loop recognition.

H431 now handles that fixed-span form at decode time. It recognizes the exact
descending one-source suffix and symbolically validates MSVC's scheduled
two-source blend suffix, then continues into the ordinary outer row tail. On a
full replay of the same batches 1500..1660, main handlers fell again from
257,258,415 to 179,778,066: 77,480,349 fewer, or **30.12% beyond H418 alone**
(31.46% from the original pre-LUT 262,313,891). The d2gfx suffix landings no
longer appear in the hot-block top twenty; the jump-table and row-head blocks
at `0x86c167`, `0x86c141`, `0x86c38e` and `0x86c34d` remain, as expected,
because H431 is nonterminal and does not absorb their control flow. The batch
1652 Rogue Encampment capture remained healthy: terrain 87,447, life orb 3,612,
mana orb 2,910 and 187 quantized colors. Host load forced the replay to its
320-second cap exactly at batch 1680, so this is an instruction-count result,
not a wall-time/FPS claim.

The clipped two-source inner loop at runtime `0x86e3ca` (d2gfx original
`0x100033ca`) now uses H418 as well. Descriptor version one adds a second
advancing byte stream, an auxiliary low-byte register, an absolute table
displacement and a selector for which source cursor terminates the run. A
separate exact recognizer proves the observed `xor/xor`, two loads, `shl 8`,
three increments, 64KB blend lookup, store and `cmp source2,bound / jb` order;
the executor remains the shared universal LUT kernel.

In a fresh batches-1500..1660 profile, `0x86e3ca` fell from the prior capture's
251,520 per-pixel block entries to 26,522 budget resumptions. H418 processed
1,205,355 pixels in 96,689 aggregate runs, while the new canonical ESP load-run
recognition drove H408 2,869,328 times and removed `H343 -> H343` from the top
pairs. That fresh scene retired 145,589,954 main handlers and scored terrain
102,464, life 3,612, mana 2,910 and 189 colors. Its terrain workload differs
from the earlier H431 capture and host load exceeded 80, so neither the total
handler difference nor wall time is presented as an isolated speed percentage.

### High-level meaning of the post-LUT hot blocks

The remaining block heads are easier to understand as engine operations than
as instruction pairs. Counts in this table are correlated entries within loop
nests and therefore must not be added together.

| Operation | Current evidence | Interpretation |
| --- | --- | --- |
| Fixed-shade isometric tile blit | d2gfx `0x10001130`, runtime row heads `0x86c141` (322,448) and `0x86c167` (345,480) | Draws the 15 diamond rows through a Duff jump table. Each source palette index passes through one selected 256-byte row of the 64K table before reaching the 8bpp framebuffer. |
| Per-pixel-lit isometric tile blit | d2gfx `0x10001340`, runtime row heads `0x86c34d` (289,814) and `0x86c38e` (310,515) | Combines a tile byte with a byte from the coordinate-selected light field at `0x10014004`, using `(light << 8) + pixel` into the 64K table. This is palette lighting/shading, not a 16/32bpp arithmetic alpha blend. |
| Clipped palette blit/blend | H418 aggregate 1,205,355 pixels in 96,689 runs; d2gfx `0x100031ed`/`0x1000334d` | The same fixed-shade and per-pixel-lit operations with horizontal clipping. H418 now absorbs their actual pixel loops; the surrounding row setup remains. |
| Tile/collision mask query | EXE `0x4d8e10`, hot scan blocks `0x4d8e70..0x4d8e9f` at roughly 307K--384K entries | Finds which room rectangle contains a world coordinate, resolves that room's row-offset table, loads a 16-bit tile/collision word and applies the caller's mask. This is simulation/spatial-query work, not renderer clipping. |
| Light-grid sampling/build | EXE `0x4946cd` inner 8x8 blocks at 186,048 entries and clamped sampler `0x430df0` at about 194K | Repeatedly clamps coordinates to a 48x48 grid and copies one or four light/color bytes while constructing the small lighting grid consumed by the per-pixel tile renderer. |
| CEL/RLE expansion | d2cmp `0x6fe28465`, runtime `0x655465` at 198,960 entries | Interprets signed commands: negative values skip output or advance a row; positive values copy a literal run. Other d2gfx paths apply the LUT/light operation while decoding compressed CEL rows. |

H431 processed 11,825,842 fixed-span pixels in 718,737 invocations in this
capture. Dividing the two fixed-tile row-head counts by their 15-row shape gives
about 40.8K full-tile equivalents, only as a scale estimate because clipping
and variant dispatch make it non-exact. The important consequence is that H431
has already removed most pixel-by-pixel dispatch, so the remaining d2gfx cost
is increasingly row setup, diamond-shape jump dispatch and function control.

That changes the next optimization level. An exact full-tile handler covering
the fixed-shade and per-pixel-light variants could consume all 15 rows per call
and subsume H431 internally. Separate candidates are the room collision-mask
query, the fixed 8x8 light-grid builder and the signed D2CMP command decoder.
Those are whole engine primitives; generic `XOR -> LOAD8` or `CMP -> Jcc`
fusions would only shave pieces of all four.

### Browser CPU attribution of pixels versus row control

A subsequent Chrome/V8 sampling profile measured actual Rogue Encampment
gameplay rather than inferring native cost from handler counts. The driver did
not arm the handler histogram during the CPU window, moved the Barbarian with a
ground click, and rejected the sample until the rendered frame contained green
terrain plus both life and mana orbs. It then took a separate short histogram
window in the same live instance. Two headless runs captured 46,462 samples
over 15.53s and 34,918 samples over 10.49s. A state-aware intro driver then
repeated the measurement in a real headful/compositor-backed Chrome window:
38,251 samples over 10.43s. Host load was still high (roughly 8--14), so these
are CPU self-time shares only, not FPS or throughput measurements.

The result narrows the multi-row claim considerably:

| Native function | Headless 1 | Headless 2 | Headful | Meaning |
| --- | ---: | ---: | ---: | --- |
| `$next` | 22.98% | 21.53% | 22.44% | Threaded dispatch itself remains the largest single native cost. |
| H431 `$th_lut_span` | 1.68% | 1.58% | 1.97% | The already-folded fixed-span pixel kernel is no longer a dominant cost. |
| H418 `$th_lut_run` | 0.30% | 0.36% | 0.32% | Clipped palette translation/blending is smaller again. |
| all Wasm | 90.0% | 90.4% | 91.1% | Browser presentation/JS is not the principal ceiling in this capture. |

Separating samples whose ancestry goes through `thread-manager.js` puts H431
at 1.82--2.21% of main-path CPU and H418 at 0.36--0.42%; neither ran on the
worker path. Main-thread `$next` alone was 20.15--21.53%. The worker share
varied from 10.7% to 18.3% in these three windows, so the earlier larger blue
HUD share is phase-dependent rather than a fixed split.

The matched histogram explains what remains around H431. In the repeat window,
the fixed-shade row head ran 134,596 times and the per-pixel-lit row head
122,360 times, while H431 ran 265,541 times in total. Accounting for the
existing ESP load-run fusion, the two fixed-tile outer bodies represent about
5.84M row-setup/control handler dispatches out of 62.86M total (about 9.3%);
including their H431 calls makes the theoretical handler-count ceiling about
9.7%. A multi-row handler would not remove the pixel work or all address
calculation, however. At uniform dispatch cost it saves only about two points
of total CPU from `$next`; direct WAT row setup could save some additional
generic-handler cost. Consequently the honest expected ceiling is a few
percent until an A/B prototype measures it, not evidence that the outer tile
loop dominates the whole browser.

### Per-present guest-operation attribution

A temporary guest-EIP range timer measured the main instance between actual
DirectDraw presents. The steady Rogue Encampment window contains 57 frames;
menus, loading and the first loading-to-gameplay spike are excluded. A matched
empty-range control retained the frame/timer hooks but removed all hot-range
transitions. The detailed probe raised median active main-guest time from
77.96ms to 89.04ms (14.2%), so uncorrected probe time is not an honest browser
frame-time result. A standalone Wasm-to-JS timer-import calibration measured
85.7--92.4ns per transition; the full launch made 4.04M transitions.

The table reports exclusive loop-body buckets. “Adjusted” divides the raw
medians and p90s by the measured 1.142 probe inflation. It is a deterministic
Node/V8 CLI estimate of computation per DirectDraw present, not browser wall
time, and helpers outside a listed EIP range remain in `other`.

| Exclusive operation bucket | Raw median | Adjusted median | Adjusted p90 | Mean active share |
| --- | ---: | ---: | ---: | ---: |
| Fixed/per-pixel-lit isometric tile bodies | 12.64ms | 11.07ms | 18.47ms | 14.48% |
| Lighting-grid build/sample/interpolation | 8.75ms | 7.66ms | 11.88ms | 9.87% |
| Object/list/visible-scene traversal | 8.01ms | 7.01ms | 11.68ms | 9.32% |
| CEL renderer bodies | 7.51ms | 6.57ms | 11.69ms | 8.60% |
| Collision walk and room-mask query | 5.94ms | 5.20ms | 7.46ms | 6.56% |
| D2CMP RLE encode/decode/transform | 2.42ms | 2.12ms | 3.15ms | 3.03% |
| Clipped palette/light blits | 2.40ms | 2.10ms | 3.30ms | 2.71% |
| Nearest-palette-color search | 1.97ms | 1.72ms | 2.73ms | 2.34% |
| DirectDraw scanline loop | 0.31ms | 0.27ms | 0.40ms | 0.36% |
| Everything outside those ranges | 37.90ms | 33.18ms | 52.40ms | 42.74% |

Thus the larger named buckets are now ranked per present, but these numbers do
not prove inclusive whole-function cost or transfer directly to browser
milliseconds. The lower-overhead Chrome sampling result above remains the
browser authority: `$next` is 22.44% of total CPU while H431 and H418 themselves
are only 1.97% and 0.32%. The operation timer says where the surrounding guest
work is concentrated; it does not overturn that native attribution.

## Cooperative workers and real browser threads

The browser HUD's blue `threads` phase is literal wall time spent in
`ThreadManager.runBudgeted`, but the name does not mean Web Workers. The three
guest worker WASM instances currently run synchronously and round-robin on the
browser's main JavaScript thread. A sequential per-instance histogram over
batches 1500..1650 found:

| Instance | 50-batch handlers | Dominant work |
| --- | ---: | --- |
| T1, Fog service thread | 0 | parked in `WaitForSingleObject` |
| T2, Storm async worker | 56,384,573 | MPQ Huffman/bitstream decode and ADPCM expansion |
| T3, D2Sound worker | 53,312 | mostly waits and DirectSound service calls |

T2's hottest nests are Storm runtime `0x9a1f40..0x9a21b3` (original
`0x6ffbbf40..0x6ffbc1b3`, Huffman bit refill/tree traversal; 433,747 entries in
its hottest block) and `0x9a2d30..0x9a2e9f` (original
`0x6ffbcd30..0x6ffbce9f`, ADPCM code expansion and predictor/step-index clamps;
432,499). Its secondary loops build/walk the decode trees at
`0x9a1c40..0x9a1e6e` and perform smaller output transforms at
`0x9a31a6..0x9a31f4`. Neither is LUT_RUN, and no worker instance executed H418
during the full replay.

Consequently, real Web Workers should materially improve browser responsiveness
for this workload: nearly the entire blue phase could overlap the main guest
instead of blocking input and paint. At the sampled rates main averaged about
1.61M handlers/batch and T2 1.13M; perfect independent overlap would put a
rough upper bound near 1.7x for their combined CPU phase. That is a ceiling,
not an FPS forecast: main sometimes waits for worker events, host imports such
as audio/window/storage need a main-thread broker, shared emulator allocators
still need locking, and the green d2gfx renderer remains single-threaded. The
existing shared WASM memory, per-thread instances, atomic wait table and
partitioned decode caches provide useful groundwork; the missing broker and
race audit are the implementation cost documented in
`docs/design-real-threads.md`.

## Isolated-Worker bounded MPQ waits

The isolated browser backend originally omitted the bounded-wait poll floor
already used by the cooperative main scheduler. Its guest clock can advance
past Storm's 255ms MPQ completion wait after only one or two concurrent Worker
slices. `resolveMainWorkerWait()` then returned `WAIT_TIMEOUT` while the Storm
decompression worker was still runnable; Storm accepted the resulting short
read, and D2CMP later reported `Codec.cpp` line 1563, `top >= 0`, while decoding
the incomplete data.

`ThreadManager.resolveWait()` now requires both elapsed guest time and up to
the same bounded number of scheduler polls while an isolated main thread still
has runnable guest workers. A signal remains immediate, and a permanently
unsignalled finite wait still times out after the poll ceiling. The focused
regression advances the guest clock by 1000ms during a 255ms wait, proves it
does not complete after the second Worker slice, then signals the event and
proves normal completion.

## The Direct3D renderer (2026-09-19)

The demo ships four renderer back ends beside the executable — `d2ddraw.dll`,
`d2direct3d.dll`, `d2glide.dll`, `d2gdi.dll` — and picks one from
`HK{CU,LM}\Software\Blizzard Entertainment\Diablo II\VideoConfig`. `d2ddraw.dll`
is in the app's static import set, so watching *that* load says nothing about
the choice; the selection shows up as a runtime `[LoadLibrary]` line. Measured,
one headless run per value:

| `Render` | runtime `LoadLibrary` |
|---|---|
| 0 | none (DirectDraw) |
| **1** | **`d2direct3d.dll`** |
| 2 | none (DirectDraw) |
| 3 | `d2glide.dll` — then `UNIMPLEMENTED API: _grGet@12` |
| 4 | `d2gdi.dll` |

`DeviceName` (`"Direct3D HAL"`) and `dwFlags` do not select anything on their
own; `Render` does. The `-d3d` command-line switch does **not** reach the D3D
path — with `-d3d -w` the game loads `d2gdi.dll`. Repro:

```
node test/run.js --app=diablo2_demo --no-build --quiet-api \
  --max-batches=20000 --max-seconds=150 --reg-import=<seed>.json
```

where the seed sets `Render` = DWORD 1 under both the HKCU and HKLM key.

**The renderer is not seeded by default, and should not be**: the DirectDraw
path is what the app uses today and it works. Both failures below are on the
`Render=1` route only.

### How the value is decoded (disassembly, 2026-09-20)

Two separate numbering schemes are involved, and conflating them is the trap.

**The EXE turns `Render` into a flag byte.** `RegQueryValueEx` of the `Render`
name (string at `0x005a6e08`, its only xref) returns into a local, and the
value is then range-checked and dispatched:

```
00401b56  mov  ecx, [esp+0x10]          ; the Render DWORD
00401b5a  lea  eax, [ecx-0x1]
00401b5d  cmp  eax, 3
00401b60  ja   0x401b8f                 ; outside 1..4 -> leave every flag clear
00401b62  jmp  [0x401bbc+eax*4]         ; 4 entries: 401b69 401b73 401b7d 401b87
```

Each arm sets one byte of a five-byte flag block and falls straight out:
`Render` 1 -> `[esp+0x167]`, 2 -> `[esp+0x166]`, 3 -> `[esp+0x165]`,
4 -> `[esp+0x164]`. So the byte written is `[esp+0x168] - Render` — the block
is indexed in descending address order, which is why it does not read as an
array at a glance.

That also explains the two "none" rows in the table above without needing a
second measurement: `Render` = 0 fails the `cmp eax,3` unsigned check (it
wraps to `0xFFFFFFFF`) and sets nothing at all, so the game keeps the
DirectDraw default.

The same block is read back at `0x401a90` *before* the registry is consulted —
bytes `0x165`, `0x164`, `0x166` and `0x168` are each tested and any one of them
set jumps past the registry read entirely. Those are the command-line
overrides, which is why a switch beats the registry rather than merging with
it. The switch names live in a table of `{UPPER, lower, group, id}` records at
`0x005a60e0` (`3DFX`/`3dfx`, `OPENGL`/`opengl`, `D3D`/`d3d`, ... all in group
`VIDEO`), and its ids are **not** `Render` values — do not read the mapping off
that table.

**D2gfx has its own, different numbering.** The backend DLL name is fetched in
`d2gfx.dll` at `0x1000381a`:

```
10003817  mov  eax, [0x1000d1bc+edi*4]  ; edi = video mode
1000381e  cmp  eax, ebx                 ; ebx = 0
10003826  jnz  short 0x10003841
10003829  push 0x1000d2cc               ; "Unsupported video mode - %d"
```

The name table at `0x1000d1bc` is sparse, and its indices are the *video mode*,
not `Render`:

| index | `[0x1000d1bc + i*4]` |
|---:|---|
| 0 | NULL |
| 1 | `D2Gdi.dll` |
| 2 | NULL |
| 3 | `D2DDraw.dll` |
| 4 | `D2Glide.dll` |
| 5 | NULL |
| 6 | `D2Direct3D.dll` |

A NULL entry is the error path above, not a fallback. Three function pointers
sit immediately before the names at `0x1000d1b0` (`0x100029e0`, `0x10002ba0`,
`0x10002de0`), and the selected mode is published to `[0x1001c048]`.

**Reading which backend won, at runtime.** `d2ddraw.dll` is in the app's static
import set, so it is loaded on every route and grepping a log for it proves
nothing — the choice appears only as a runtime `LoadLibrary` of
`d2direct3d.dll` / `d2glide.dll` / `d2gdi.dll`. That load also happens well
after the first frames: it is absent from a 130-batch run even on a seed that
demonstrably ends up in Direct3D, so any probe short of the menu reports
"DirectDraw" for every value. Give it the full 20000-batch run in the repro
above before believing a row.

### Our 8 MB video-memory report makes the game wipe its own code

With the stock report, `Render=1` dies at ~batch 3380 executing zeros at
`d2direct3d+0x929b`, with every register zero. The image is *not* corrupt when
that batch begins — a `dump-mem` of the same address at batches 3000/3100/3200/
3300 shows the real instructions — and `--fault-null` names the culprit in one
line: **561,098,735 unmapped guest accesses from one EIP**, sweeping
`0x0`–`0xfffffffc`. It is a `rep stosd` clearing the whole address space, and it
reaches `d2direct3d`'s own `.text` on the way.

The count comes from a **signed** divide, at `d2direct3d.dll+0x9260`
(original base `0x10000000`):

```
mov  ebx, [0x1001aa88]      ; bytes per pixel
imul ebx, [esp+0x10]        ; * width
imul ebx, [esp+0x14]        ; * height      -> texture size in bytes
mov  eax, [esp+0xc]
sub  eax, edx               ; a video-memory budget, minus a reserve
cdq
idiv ebx                    ; slots = budget / texture size   (SIGNED)
...
shl  eax, 5
mov  ebp, eax
call <alloc>                ; ebp bytes
mov  edi, eax
shr  ecx, 2
rep  stosd                  ; memset of ebp bytes
```

`--trace-at=d2direct3d+0x1000929b` catches it with `EBP=0xfff5c200` — a
negative byte count, i.e. a negative slot count, i.e. the budget came out
below the reserve. `$handle_IDirectDraw2_GetAvailableVidMem` and the two
`GetCaps` sites in `src/09a8-handlers-directx.wat` all report a **8 MB** card
(`0x00800000`), and that is the number feeding this divide.

### Raising it trades the wipe for a texture-slot ceiling

Rebuilt with 64 MB in those five constants, the wipe is gone — and the game
then creates **4094 surfaces against 1 release** before
`IDirectDraw_CreateSurface` fails and it asserts
`C:\D2\Source\D2Direct3D\Src\d3dSprite.cpp, line #85, Expression: success`.
4096 is our DX object-table size, so the cache D2 sizes from the report simply
does not fit. 52 MB asserts in the same place, so this is not a matter of
finding a number between the two failures; the slot table is the next wall.

Nothing else in the corpus is sensitive to the constant: MechCommander — the
app whose `GetCaps` budget comment the 8 MB figure was written for — renders
**pixel-identical** (0 of 307200 pixels differ) at 8 MB and at 64 MB.

So the D3D route needs two things, in this order: a video-memory report that is
not a lie about a 1998 card, and a DX object table that can hold the cache that
report implies. Neither is worth landing until both are done, because each one
alone only moves the crash.

### Resolved 2026-09-19: it is one constant of D2's, read twice

The guess above was close but the mechanism is more specific, and knowing it
turns the tuning into arithmetic.

`d2direct3d` sizes its texture caches in the function whose arena carve begins
at `+0x1000271a`. It reads **`[0x10019968]` — the `dwFree` out-parameter of the
second `GetAvailableVidMem` call, the one asking for `DDSCAPS_NONLOCALVIDMEM`
(AGP) texture memory** — into `edi`, and clamps it to its own hardcoded
`cmp edi, 0x2000000` ceiling. Everything follows from that one value:

* `edi` is the arena **end**. Each cache gets a slice of `edi - base`, and
  `+0x10009260` computes `slots = (end - base) / (bpp*w*h)` with a **signed**
  `idiv`, stores it, then `shl eax,5` and `rep stosd`s `slots*32` bytes.
* Answer **0** and `slots` goes negative. Measured at the fatal call: base
  `0x022f8000`, end `0x00000000`, `slots = -17888`, `slots*32 = 0xfff74200`,
  so the `rep stosd` at `+0x1000929b` walks ~4 GB. That is the 561M-unmapped-
  access wipe above; the all-zero `ESP=0` dump is a consequence, not a clue,
  because the register file lives in memory and the stosd went through it.
* We answered 0 because `free = total - used` and **D2 sizes its caches twice,
  never releasing the first round**. 8 MB and 16 MB produce byte-identical
  traces — the first round succeeds (`EDI=0x00ed4000`), the second gets 0.
* The 32 MB ceiling also explains the 4094 above: a full 32 MB arena is about
  179 tiles of 256x256, 97 of 128x128 and 3276 of 32x32 — roughly 3550 — so
  two rounds overflow a 4096-slot table. **No report makes D2 ask for more**,
  which is what makes the table size a finite answer rather than a guess.

The other ceiling is ours: every surface is really a DIB in `$DIB_BACKING_BASE`
(63 MB), and page rounding plus the `pitch*16+64` slack row costs 1.09x for
256x256, 1.25x for 128x128 and **2.0x** for 32x32 — weighted about **1.29x** of
what we promise. Measured: 64 MB and 48 MB both fill the arena exactly
(`pages used 16384 free 0`), surfaces come back with `dib=0xf0` and
`CreateSurface` fails into the same `d3dSprite.cpp:85` assert — the same
message as slot exhaustion, from a completely different cause.

Landed: `$DX_VIDMEM_TOTAL` = **40 MB** (one named constant replacing the six
scattered literals) and `$DX_MAX` = **8192** with its seven sibling regions.
At 40 MB the first round gets D2's full 32 MB ceiling, the second gets 8 MB,
and the arena settles at `pages used 14977 free 1407`. **No wipe, no assert,
687 live surfaces, and the screen goes from desktop teal to black** — D2 owns
the display and clears it.

Open, and the next lead: it clears but never draws. 120000 batches at
`--batch-size=200000` finish in 24s with a uniformly black frame, so it is idle
rather than working. The wipe and the assert are both gone; what remains is a
present/draw question, not a memory one.

### 2026-09-20: it is not a draw question — the game is spinning, forever

"Clears but never draws" was the wrong reading, and it is worth saying why it
was convincing: the frame is black, nothing is presented, and a fixed batch
budget finishes in the usual wall time. All three are equally true of a guest
executing a two-instruction loop it can never leave, because **batches retire
normally while the guest makes no progress** — a batch is a budget of blocks,
and a tight loop retires blocks as fast as anything else.

Driving the verified route (SINGLE PLAYER, Barbarian, name, OK — see
*Character creation and gameplay*) to Act I on `Render=1` and taking a
snapshot at the black frame puts EIP at **`d2direct3d+0x10009561`**, inside
the texture cache's eviction loop. Disassembled, that loop cannot terminate
for the state it is in:

```
10009561  cmp  [ecx+0x4], esi      ; esi==0 here: count == 0 ?
10009564  jz   0x100095c0          ;   ... then skip the evict AND the dec
          <evict the LRU item>
100095bd  dec  [ecx+0x4]           ; count--
100095c0  mov  eax, [ecx+0x4]      ; count
100095c3  mov  edx, [ecx]          ; nMaxNumItems
100095c5  cmp  eax, edx
100095c7  jz   0x10009561          ; full? evict again
```

With `count == 0` the body is skipped *including the decrement*, and with
`nMaxNumItems == 0` the exit test `count == nMaxNumItems` is always true. A
cache of capacity zero is simultaneously empty and full, so the loop evicts
nothing and re-tests forever. It writes no memory, so nothing in a snapshot
changes and every heuristic that looks for progress reports "idle".

The state was read straight out of the live hang rather than inferred
(`exports.get_ecx()` → the cache, then its first six fields):

```
eip=17d0561  ecx=17f2218  nMaxNumItems=0  count=0  head=7ee30604  tail=7ee305e4
```

`head`/`tail` are real heap pointers, so this cache *had* been populated: the
capacity was zeroed by a later re-size, not left uninitialized from the start.
That matches the two-round behaviour documented above — the second round is
carved from a `dwFree` we have already billed the first round against — and it
means the remaining work is still the video-memory question, not a draw one.

Two things make this newly tractable:

* **The three caches are one global each**, at `d2direct3d+0x1002b218`
  (256x256), `+0x1002b234` (128x128) and `+0x1002b250` (32x32), 0x1c apart,
  laid out `[nMaxNumItems, count, freeHead, freeTail, lruHead, lruTail,
  items]` with 32-byte items. They are passed by pointer, so a VA xref scan
  shows only loads and `mov ecx, imm` — there are no stores to find, which is
  what made the initializer look absent.
* **Both `GetAvailableVidMem` calls are visible in the init**, and they ask
  for *different pools*: `d2direct3d+0x1000248b` passes
  `dwCaps = 0x10005000` (`LOCALVIDMEM|VIDEOMEMORY|TEXTURE`) and
  `+0x1000252e` passes `0x20005000` (`NONLOCALVIDMEM|…`, i.e. AGP), into
  separate `dwTotal`/`dwFree` pairs at `0x10019964/68` and `0x1001996c/70`.
  D2 then takes `edi = max(localFree, min(agpFree, 32 MB))` as the arena end.
  `$handle_IDirectDraw2_GetAvailableVidMem` ignores `lpDDSCaps` entirely and
  answers both from one pool, so a first round billed against local memory
  also shrinks the AGP answer the second round depends on. On real hardware
  those are physically distinct memories and the second answer does not move.

A probe for this is `tools/ctl.js eval`, whose scope now carries `va()` and
`mods` so `va("d2direct3d+0x1002b218")` resolves against the load address this
run happened to pick. Reading a guest module's global used to mean grepping
the run log for its load line and pasting a base into the expression, which is
silently wrong on the next run — a bad base still reads *some* memory and
returns plausible numbers.

### 2026-09-20: found — a texture Release that never freed the surface

The video-memory question above has an answer, and it is ours, not D2's.

`QueryInterface` for `IDirect3DTexture`/`IDirect3DTexture2` does not create a
new object: it hands back another COM view of the DirectDrawSurface's own
`DX_OBJECTS` slot. So the final release through the texture vtable *is* the
final release of the surface. Both handlers called `$dx_free`, which retires
the slot and returns nothing — the DIB pages stayed allocated and
`$dx_vidmem_used` stayed charged for them. `$dx_surface_release`, the one
path that frees the DIB and refunds the bytes, was never reached, because D2
drops its cache through the texture view.

Measured live at the character screen, before the fix:

| | |
|---|---|
| live DirectDraw surfaces | 705, holding 10.7 MB |
| runs in the DIB arena owned by nothing | **4756, holding 48.5 MB** of 63 MB |
| orphan run sizes | 4194 × 1 page, 421 × 10, 95 × 19, 36 × 35 |
| `dwFree` handed to D2 at its last query | **0x88700 — 558 KB** |
| `cacheA_256` | `nMaxNumItems=0 count=0`, real LRU pointers |
| EIP | `0x17d0561` — the spin |

Those orphan sizes are the game's own tile geometries, which is what
identified the owner: a 32x32 at 2 bytes a pixel is one page, a 128x128 is ten
with its slack row, a 256x256 is thirty-five. Nothing else in the process
allocates in that distribution.

So the whole chain, end to end: texture released through the texture view →
pages and video memory stranded → `GetAvailableVidMem` answers 558 KB →
`nMaxNumItems = (limit - base) / (bpp * w * h)` comes out zero → the eviction
loop at `+0x9561` can never exit → black screen forever. Three steps separated
the symptom from the cause, and each one looked like a different subsystem's
bug: a renderer that never draws, then a guest that idles, then a cache that
was never initialized.

After the fix, on the same route at the same point: **10 orphan runs holding
3.7 MB** (the primary/back pair and page rounding), 3584 live surfaces
accounting for all 44.1 MB they hold.

Two notes for anyone working near this:

* **`$dx_free` is not a surface teardown** and never was. Any other view that
  retires a type-2 slot through it leaks the same way; the texture views were
  the two that a shipping app actually took. The rest of that class was
  audited after the fix: of the 25 `$dx_free` call sites, the only shared one
  is `$dx_com_release_basic`, and the 14 APIs routed to it are all DirectDraw,
  DirectSound, DirectInput, material and D3D-root objects — no type 2 among
  them. The measurement agrees: orphan runs fell to 10 and stayed there, which
  they could not do if another path were still leaking.
* **`DxObject.misc2` was a union of two things with different lifetimes** —
  the billed byte count written at creation, and the colour key that
  `SetColorKey` writes over it while the surface is alive. The refund read
  `misc2`, so a keyed surface gave back its colour key. The billed figure now
  lives in `DX_SURF_META+8`, which nothing else writes. D2 does not key these
  surfaces, so this was latent for it — but the fix above routes many more
  surfaces through that refund, which is why the two landed together.

`test/test-d3dim-texture-release-arena.js` covers both, and carries its own
negative control: a bare `$dx_free` must still strand the pages, or the other
assertions stop being evidence.

**Retracted:** the `lpDDSCaps` pool-split lead in the section above — that
`$handle_IDirectDraw2_GetAvailableVidMem` answers local and AGP from one pool,
so D2's `max(localFree, min(agpFree, 32 MB))` defeats its own clamp. That is
still true and still worth fixing one day, but it was **not** why the figure
was 558 KB, and implementing it would have moved the number without touching
the leak underneath. Splitting the pools would have made the black screen go
away far enough to look fixed, which is the worse outcome.

### 2026-09-20: a crash dump that named the wrong function

With the spin gone the route reaches the Act I load — it renders, in D3D — and
then traps: control transfers into blank low memory (`0x140` on one run,
`0x280` on another; the batch differs too, 1560 vs 1637, so this is one of the
nondeterministic paths) and `$decode_block` hits `unreachable` on a run of
zeros.

The dump's `EIP before batch` pointed at `storm+0x19319`, and an hour went into
disassembling that function — a linked-list teardown walk — on the strength of
it. It was innocent. **`eipBefore` is where the *batch* entered**, and a batch
retires up to a million blocks after that, so on any crash that is not in the
first block it names a bystander. The proof was cheap once asked for: a
`--trace-at` on that address shows the function's real live context is
`EBX=0` (a NULL sentinel) with `EDI=0x7e1x007c` (Storm heap headers), while
the trap had `EBX=0x01bb576c, EDI=0x1653`. Different registers, different
function, no relation.

`src/13-exports.wat` has exported `get_dbg_prev_eip` and `get_dbg_prev2_eip`
all along, the second with a comment describing this exact case: when a thread
jumps into blank memory, `prev_eip` is *already inside* the blank run and the
block that jumped is one further back. The crash dump simply never printed
them. It does now, and disassembles `prev2_eip` too, so the next trap into
nothing names its own caller instead of costing a session.

With that printed, `prev2_eip` landed on `d2direct3d+0x645d` immediately — a
function *epilogue*:

```
1000643a  mov  eax, [0x1001aa74]      ; the D3D device
1000643f  mov  ecx, [0x1001b138]      ; a vertex buffer
10006445  push 0x1c / 0x96 / 0x1001af94 / ecx / 4 / eax
10006457  call [edx+0x8c]             ; vtable slot 35
1000645d  pop edi / pop esi / pop ebp / pop ebx / pop ecx
10006462  ret  0x1c
```

Six pushes, vtable slot 35: `IDirect3DDevice3::DrawIndexedPrimitiveVB`. (The
other call on `0x1001b138` — slot 3, four pushes, flags 0x21 — is
`IDirect3DVertexBuffer::Lock`, which is what fixes the object types.) **Our
handler popped 32 bytes for a 28-byte frame.** The v3 signature is
`(primType, lpVB, lpwIndices, dwIndexCount, dwFlags)`; only v7 inserts
`dwStartVertex`/`dwNumVertices` to make it eight dwords, and the v3 handler had
been given the v7 count.

So the epilogue above ran one slot high: the five `pop`s took the wrong saved
registers and `ret` took **the caller's own first argument** as a return
address. That is why the two runs jumped to `0x140` and `0x280` — 320 and 640,
the screen coordinates d2gfx passes its renderer. Nothing was corrupt; the
stack was simply off by one dword, and every downstream symptom was a
consequence of reading it at the wrong offset.

Auditing the rest of the draw family (`$arg0..$arg4` are `esp+4..esp+20`, so a
sixth argument lives at `esp+24`) found four more, each cross-checked against
the hand-written Device3 twins that already pop 28 and 36 for the same
signatures: `Device7_DrawPrimitive` popped 24 for 28, `Device7_`
`DrawIndexedPrimitive` 32 for 36, `Device7_DrawIndexedPrimitiveVB` 32 for 36
*and* read `esp+20/+24`, and `Device7_DrawIndexedPrimitiveStrided` read
`esp+20/+24` — those two short reads handed the core a second copy of `$arg4`
where it wanted `lpwIndices`, and dropped `dwIndexCount` entirely.

With that fixed the route runs clean past the old crash to the Rogue
Encampment: batch 2996, zero faults, `cacheA_256` at capacity 38 and filling,
`vidFree` 39.8 MB. Diablo II now reaches gameplay on `Render=1`.

**Two lessons worth keeping.** A wrong stdcall pop does not fail where it
happens — it fails in the *caller's* epilogue, arbitrarily far away, with a
register set that belongs to nobody, and it reads convincingly as memory
corruption. And the tell is cheap once you know it: the bogus "return address"
is one of the caller's own arguments, so a suspiciously round value like 320
or 640 is not garbage, it is data being executed.

### 2026-09-20: the black ground was a silent-success stub, and it is fixed

Sprites, HUD, rain and torches rendered on `Render=1`; the floor was black.
That shape is the tell. Diablo II batches its floor tiles through
`IDirect3DDevice3::DrawIndexedPrimitiveVB` — vtable slot 35, a TRIANGLELIST
over a Locked vertex buffer, the six-push call site at `0x10006445` already
recorded above — while its sprites go through the implemented
`DrawPrimitive`. `fb397db1` fixed that entry's *pop arity* (32 → 28) and left
the body empty, so the handler stored S_OK, adjusted ESP and drew nothing.

A silent-success stub is the worst failure shape we have: no trap, no
`UNIMPLEMENTED API` line, no wrong return code. The only symptom is absent
geometry, which reads as a texture, palette or format bug and sends the
investigation into the sampler. Both v3 VB entries now forward into the
Device7 VB cores (`$d3dim_vb_draw_primitive` /
`$d3dim_vb_draw_indexed_primitive`), with `start = 0` and `count = -1` so the
core clamps to the whole buffer.

**Verified end to end**, not inferred. `test/test-d3dim-v3-vertex-buffer-draw.js`
rasterizes both entries against a real TLVERTEX buffer (FVF `0x1c4`, stride 32)
and asserts the 28-byte pop, and it fails with "drew nothing" when the stub is
put back. Then the full route — SINGLE PLAYER, Barbarian, name, OK — was driven
to the Rogue Encampment at batch 1650 with `d2direct3d.dll` LoadLibrary'd at
runtime by the registry seeding, and the capture shows grass, the stone wall,
the wagon, the campfire, the NPC and both orbs.

**Budget note for whoever runs the gameplay test next.** That capture took
569s of wall clock for 1680 batches (3 batches/s) on a box at load 13.6.
`test/test-diablo2-demo-gameplay.js` caps its child at 220s, so on a loaded
machine it now times out before it reaches Act I — the assertion is fine, the
budget is not. It is the D3D route that is being timed since the
`startupRegistry` seeding landed; the DirectDraw route the 220s was calibrated
against is no longer what that test exercises.

### 2026-09-20: the route's cost is a frame-limiter spin, not rendering

The 569s above is mostly waste, and `--trace-api-counts` says so in one line.
Over the first 100s of the `Render=1` route, of 56M Win32 calls:

| calls | API |
| ---: | --- |
| 18,720,923 | `PeekMessageA` |
| 18,720,903 | `QueryPerformanceFrequency` |
| 18,720,902 | `QueryPerformanceCounter` |
| 18,303 | `IDirect3DDevice3_DrawPrimitive` |

**99.7% of the route's API calls are three calls in one frame-limiter loop**, at
about 4.3 blocks an iteration. The headless guest clock only advances between
batches, so that loop cannot exit inside a batch: whatever budget is left after
the frame's real work is spent spinning, and nothing else. Surplus
`--batch-size` therefore buys spin, not progress. Measured user CPU for the
identical route (user CPU, because this box sits at load 10-40 and wall time
measures the machine):

| `--batch-size` | user CPU to the Act I load |
| ---: | ---: |
| 200,000 | 91s |
| **50,000** | **49s** |
| 20,000 | 51s |

50,000 is the knee; below it per-batch host overhead takes the saving back.

**`--tick-ms-per-batch` is not the other half of this.** Giving the guest more
time per batch does cut the number of waiting batches, but at 1000ms/batch the
Act I load dies in Diablo II's own "This application has encountered a critical
error" box, which is the documented consequence of stepping over Storm's 255ms
MPQ completion waits (see *Isolated-Worker bounded MPQ waits*). Keep the
default 200.

### 2026-09-20: the gameplay test is event-driven and split

`test/test-diablo2-demo-gameplay.js` no longer fires input at fixed batch
numbers. Every stage waits for the pixels that stage produces, so the route
survives a `--batch-size` change; the old schedule was calibrated against
`--batch-size=1000000` and, at any other budget, clicked screens that were not
up yet (at 50,000 it sat on SELECT HERO CLASS for 400 batches and captured that).
The screen signatures it waits on, at the CLI's 640x480 canvas:

| stage | signature |
| --- | --- |
| main menu | >1000 bright desaturated pixels in *both* `(200,145)-(440,185)` (SINGLE PLAYER) and `(200,425)-(440,465)` (EXIT DIABLO II) |
| SELECT HERO CLASS | >40000 pixels changed from the menu and the centred EXIT plate gone |
| CHARACTER NAME | >400 pixels over a **dim** plate floor in `(495,425)-(615,460)`; that OK plate peaks at 131, not 255, because the screen is lit by one campfire, and a 90 floor scores it 0 |
| Act I load | the centred portal `(185,105)-(455,365)` lit, with `(0,0)-(180,480)` black — D2's own critical-error box also leaves a mostly black frame but paints that left margin |

Working input coordinates are **canvas 640x480**, not the guest's 800x600:
SINGLE PLAYER `(320,164)`, Barbarian `mousemove` + `dblclick` `(315,210)`, name
field `(320,422)`, OK `(553,442)`. The old schedule's `(400,275)` missed the
Barbarian entirely and `(405,527)` was off the bottom of the canvas.

The default run stops at the Act I loading portal: **49s of CPU, about 55s wall
on a quiet box**, 220s at load 26. Its 420s guest guard and the matching 480s
row in `tools/test-timeouts.json` are sized for this machine at load 50, not for
the expected duration. `DIABLO2_FULL_ROUTE=1` continues into the Rogue
Encampment; that took 2163 batches and 270s of wall clock at load 11-17, and is
opt-in precisely because that figure is not bounded on a shared box — the same
opt-in run repeated at load 73-90 passed at batch 3299 after **152s of user CPU
and 11 minutes of wall clock**.

One threshold moved with it. The full route's terrain assertion was `> 50000`
green pixels, calibrated on the 87,447 of the 2026-09-20 capture. That pinned
one camera position: three captures of the same encampment — grass, wagon,
campfire, NPC, Barbarian, both orbs, HUD — score **87,447, 43,950 and 34,552**,
because the count is framing-dependent and the Act I load is one of the
nondeterministic paths. The failure the assertion exists to catch is the
silent-success `DrawIndexedPrimitiveVB` stub, whose black floor scores
743-2,186 — the same range as the menu and loading screens. It is now
`> 20000`: 10x over that failure, 1.7x under the tightest frame that is
genuinely gameplay. The life orb, mana orb and colour assertions are unchanged
(measured 2,974 / 2,902 / 961 against 2,500 / 2,000 / 100).

## 2026-09-28: resolutions, and the 1024x768 "blow-up" that wasn't

### What the binaries support: 640x480 and 800x600, nothing else

`diablo ii.exe` is FileVersion 1.0.4.0 (the menu's "Shareware v 1.04"); the
renderer DLLs carry no version resource. Every layer has exactly two
resolutions, selected by an index of 0 or 1:

| module | site | what it does |
|---|---|---|
| `d2gfx.dll` | `0x10004455` / `0x10004a07` | index 0 -> 640x480, 1 -> 800x600, anything else -> `"Unknown resolution %d"` (`0x1000d5c4`, `Window.cpp`); then AdjustWindowRectEx + SetWindowPos |
| `d2direct3d.dll` | `0x1000207b` | same 0/1 choice, logs `"Opening Direct3D window at 800x600..."` / `640x480`, then `SetCooperativeLevel(hwnd, 0x411)` (FULLSCREEN\|EXCLUSIVE\|MULTITHREADED) and `SetDisplayMode(w, h, 16)` |
| `d2ddraw.dll`, `d2gdi.dll`, `d2glide.dll` | `{640,800}` / `{480,600}` width/height tables (`d2ddraw` `0x1000d310`, `d2gdi` `0x10008290`, `d2direct3d` `0x100134e0`) | same pair |

There is no 1024x768 constant in any of them, no `Resolution` value under
`VideoConfig` (the exe's only VideoConfig value names are `Render`, plus the
`Gamma`/`Perspective` preferences), and no resolution command-line switch:
the switch table at `0x005a60e0` is 3DFX, OPENGL, D3D, RAVE, PERSPECTIVE,
QUALITY, GAMMA, VSYNC, FRAMERATE, the network and character switches, and
`-w`. The pre-LoD game does not let the player choose: **menus are 800x600,
gameplay and cutscenes are 640x480**, fixed. LoD's in-game 800x600 option
does not exist here.

Measured per backend (probe3 on box 3, `--trace-api` on the mode calls, full
route to the Rogue Encampment; all three reach it):

| backend | selected by | cutscenes | menus | gameplay |
|---|---|---|---|---|
| Direct3D (`Render=1` or `-d3d`) | runtime `LoadLibrary d2direct3d.dll` | exclusive `SetDisplayMode(640,480,16)` | exclusive `800,600,16` | exclusive `640,480,16` |
| DirectDraw (default, `Render` 0/2, `-opengl`) | static `d2ddraw.dll` | `640,480,8` then `640,480,16` for Bink | exclusive `800,600,8` | exclusive `640,480,8` |
| GDI (`Render=4`, `-w`) | `d2gdi.dll` | window 648x508 (640x480 client) | `SetWindowPos` 808x628 (800x600 client) | back to 648x508 |
| Glide (`Render=3`, `-3dfx`) | `d2glide.dll` | -- crashes on `_grGet@12` (no glide3x) -- | | |

The emulator honours all of these: `SetDisplayMode` records the mode and
resizes the cooperative window to it, and an exclusive primary is fit-scaled
onto whatever canvas the host has. The GDI path is windowed, so its 808x628
menu window needs a canvas at least that big — that, and not anything in the
DX paths, is why GDI runs are made with `--screen=1024x768`.

### The 1024x768 Direct3D "blow-up" is a harness coordinate bug, not the emulator

Reported: `Render=1` + `-d3d` + `--screen=1024x768` through the benchmark
driver (`~/d2-backends-out/d2-arm.js`) took 374s of user CPU over 3024
batches, made 14,445 presents and "never reached a recognisable menu".

The guest does not know the canvas size exists. Same command line at both
sizes (`--branch-clock --batch-size=50000 --max-batches=3024`, run.js
directly, no driver):

| canvas | API calls | `Flip` | `EndScene` | user CPU |
|---|---:|---:|---:|---:|
| 640x480 | 102,014,423 | 14,445 | 14,440 | 346.8s |
| 1024x768 | 102,014,423 | 14,445 | 14,440 | 348.0s |

and the 600-batch version without `--branch-clock` also matches exactly
(12,402,964 calls, identical block counts, 47.0s vs 46.5s). D2 asks for the
same modes (above) either way.

The driver's own last capture of the failed run (`01-main-menu.png`) **is**
the main menu — 800x600 fit-scaled to 1024x768. Its stage signatures are
written in 640x480-canvas coordinates (SINGLE PLAYER at `(200,145)-(440,185)`),
and with `SCALE=1` they sample the sky above the scaled button, so the menu
check never passed and the driver spent its whole `300 x 10`-batch attempt
budget sitting in the menu. With `SCALE=1.6` (1024/640) the identical run
reaches the menu at **batch 264 in 10.4s**, the same as the 640x480 canvas
(9.4s).

The two numbers that looked like a blow-up are just 2,760 batches of menu:

- **Presents**: the menu flips ~5.2 times per batch — 25 fps at the headless
  clock's 200 ms/batch — so 14,445 flips over 3,024 batches is its normal
  rate, identical at both canvas sizes.
- **CPU**: ~115-125 ms of user CPU per menu batch. 220s of the 347s is the
  guest slice, and 99% of the guest's API calls are the frame limiter's
  `PeekMessageA`/`QueryPerformanceCounter` spin (33.1M of each), as in *the
  route's cost is a frame-limiter spin* above. The remaining ~127s is host
  present work, ~8.8 ms per flip.

So: nothing to fix in the D3D/DDraw emulation for this. A driver that runs
with a non-default `--screen` must scale its sample points by
`canvas width / 640` for the exclusive (fullscreen) backends, and use the
window origin plus 1.25 (800/640) for the windowed GDI menus.

## 2026-09-28: the menu's frame limiter is a QPC clock spin, and now parks

### The loop

`d2win.dll` loads at `0xc97000` (origBase `0x10000000`, so runtime = orig
`- 0x0f369000`). The limiter is the function at orig **`0x1000b670`**, and
every menu and loading screen runs it on the **main thread** (ESP
`0x074ff1c0`, the main guest stack):

```
0x1000b690: PeekMessageA(&msg, 0, 0, 0, PM_NOREMOVE)   ; ret 0x1000b6a3
            if TRUE: GetMessageA / TranslateMessage / DispatchMessageA -> 0x1000b74e
0x1000b6e4: QueryPerformanceCounter(&now)                 ; ret 0x1000b6ef
            QueryPerformanceFrequency(&freq)              ; ret 0x1000b6fa
            _allmul(now - last, 25)  (0x10010fe0)
            if (result > freq) { last = now; frame callback; 0x1000bda0 }
0x1000b742: [0x1005bd08] = [0x1005bd04]
            loop while [0x1001cb68] != 0
```

A 25 fps cap: a frame when `(now - last) * 25 > freq`, i.e. every 40ms of QPC
time. `--trace-api=QueryPerformanceCounter,PeekMessageA` shows the API numbers
stepping by three (Peek, QPC, QPF) with nothing else in between, the peek
returning FALSE every time.

### Why neither detector saw it

* `QueryPerformanceCounter` was not a clock read: only GetTickCount and
  timeGetTime called `$clock_spin_step`.
* QPC and QPF both bumped `$spin_nonpoll_seq`, so to the clock detector every
  pair of reads had "Win32 work" between them.
* The empty-PeekMessage detector requires two peeks with **no** dispatch at all
  in between (`$spin_dispatch_seq` adjacency), and QPC + QPF are two.

`[spin-park]` over the 1,001-batch menu dwell below: no line at all on the old
build (zero trips on any thread).

Where the time went in the headless run, and why the saving is not bigger:
the batch clock steps 1ms per `get_ticks` call and stops at the next batch
boundary minus one (`lib/batch-clock.js`). So each batch the limiter renders a
frame every ~40 loop passes until the clock reaches `base+199`, and then spins
on a frozen millisecond for whatever budget is left. Only that tail is spin --
about 12,000 passes, ~15ms of CPU a batch. The rest of a menu batch is five
real frames of rendering plus the host present.

### The fix

QPC is now a clock read, keyed on the millisecond its count is built from
(`$handle_QueryPerformanceCounter`, `src/09a7-handlers-dispatch.wat`): the
count itself never repeats because `$perf_counter_lo` moves on every call, but
the clock under it does, and that is what the guest is waiting on. The park is
taken before the counter bump and the store, so a woken call is the whole call
again. QPC and QPF are also clock reads for the activity sequence
(`$spin_is_clock_read`, `src/09b-dispatch.wat`). Every existing guard applies
unchanged: same return address and ESP per context, no non-clock Win32 call in
between (an empty peek is neutral; a peek that finds a message is work), at
most `$spin_work_max` blocks of guest work between reads, K=8 to qualify a site,
one park per millisecond, deadline = next millisecond. `--no-spin-park` is the
old arm, which is exact for D2: the old build took zero parks here.
`test/test-qpc-spin-park.js` pins the shape and each of those resets.

The peek detector was deliberately not widened. The loop is waiting on time,
not on the queue, and the clock park is the one that carries the deadline the
schedulers sleep to (`get_spin_deadline_ms` / `get_tick_count`, which QPC now
updates).

### Measured (box 3, `--batch-size=50000 --branch-clock`, user CPU)

Menu dwell: Esc through the intros, then sit in the main menu to batch 1,001
(menu up at batch 264 in both):

| arm | API calls | QPC calls | clock parks | Flips | user CPU |
|---|---:|---:|---:|---:|---:|
| old build | 28,571,479 | 9,258,416 | 0 | 4,035 | 89.9s |
| QPC park | 908,475 | 50,483 | 766 | 3,809 | **79.1s** |
| old build, `--batch-size=60000` | 37,990,087 | 12,385,277 | 0 | 4,256 | 100.2s |
| QPC park, `--batch-size=60000` | 935,956 | 52,232 | -- | 3,938 | **85.2s** |

-12% and -15%. The earlier "220s of 347s was the loop" was the whole guest
slice; the spin tail is ~15ms of a ~110ms menu batch.

Full route through `~/d2-backends-out/d2-arm.js` (three runs each):

| phase | old build | QPC park |
|---|---|---|
| main menu reached | batch 264 (x3) | batch 264 (x3) |
| start -> menu | 8.79 / 8.75 / 8.77s | 8.08 / 8.07 / 8.10s |
| menu -> Act I portal (355 batches) | 6.59 / 6.53 / 6.57s | 6.55 / 6.53 / 6.55s |
| world -> end (630 gameplay batches) | 8.77 / 8.00 / 9.03s, 122 / 113 / 124 flips | 9.10 / 9.10 / 8.95s, 124 / 121 / 126 flips |
| main-thread clock parks, world -> end (run 3) | 249 (all GetTickCount) | 251 |
| main-thread clock parks, start -> menu (run 3) | 0 | 39 |

The menu, hero-class, name, named and Act I loading captures are byte-identical
between the arms. The encampment and final captures differ, but they also differ
between two runs of the old build: the Act I load is nondeterministic (world
reached at batch 3099-3259 across the six runs). The QPC park does not fire in
gameplay (251 against 249 parks), and gameplay CPU per flip is the same (71-75ms
in both arms).

**The fewer Flips are the one guest-visible change, and they are the old
build's artifact.** In the old build the frozen-millisecond tail was not
entirely dead: QPC adds 1us per call, so ~11,000 spin passes could move the
count the 11ms still missing from a 40ms frame and render one more before the
batch ended. That extra frame is bought with surplus budget: the old build
renders 4,035 menu flips at 50,000 blocks and 4,256 at 60,000. The QPC park
ends the tail instead, leaving the menu at 25 fps of guest time as the
limiter intends. In the menu-dwell captures, six of the eight sampled frames
(batches 300-1000) are byte-identical between the arms. The other two differ
only in the phase of the burning DIABLO II logo, since the extra frames shift
the flame animation.

Browser (not measured here, BROWSER-LOCK was held): there the clock is real
and the limiter spins the whole 40ms between frames, so this is where the
saving is large. A qualified site parks after two reads of one millisecond and
sleeps to the next (`CLOCK_SPIN_PARK_MS`, `_spinParkDelay`).

One tooling note: `--slice-split`, `--decode-stats` and `--batch-stats` time
and count only the **first** main-thread `run()` of each batch. D2 has guest
threads, so `test/run.js` also runs main between worker slices within the batch
(the cooperative branch after the spin-park handler), and those runs are
invisible to all three. With the QPC park, the park is taken in one of those
interleaved runs. The next batch's first `run()` then returns immediately on
the pending yield ("blocking wait", 1 block), and the menu's real work happens
in the interleaved runs after the handler clears it. The old build spent the
whole budget in its first run. So on this route those flags read 77ms/batch
against 0.00ms for identical menu frames, which says nothing about cost. Use
user CPU at fixed batches for spin A/Bs.

## 2026-10-04: Glide menu freeze and repeating audio investigation

The user reports frozen menu animation and repeating sound in
`diablo2_glide_demo`. The corrected local observation did **not reproduce
the menu freeze**. Audio continuity and quality remain unverified; this is
not a repair or a resolution of the user report.

The registered route inherits the installed demo and sets VideoConfig
`Render=3` in both registry hives. It dynamically loads D2Glide. All 25
registered files were present (135,378,002 bytes). The observed module was
`f40d4ca3382279ff9b826188573f8acd9272eaa2dc5024dcbb69aecc35b49063`
(1,664,777 bytes); current JavaScript was pinned separately, without claiming
that later WAT source changes were included in this module.

Attempt 1 ended with normal ExitProcess(0) after an Escape key sent without
a fresh visual gate. It is preserved as a harness route failure, not a game
crash or a freeze reproduction. Attempt 2 prohibited Escape, captured state
before input, and reached the Shareware 1.04 menu through an ordinary click
on the visible title screen.

During the 10.3793-second quiet menu interval, Glide host presentation events
increased from 1,539 to 1,812. The logo flames visibly changed between the
first and last images; the coordinator independently confirmed this in
`scratch/diablo2-glide-menu-20261004/root-visual-review.json`. These transport
counts are diagnostic evidence of progress, not qualified game or display FPS.

The AudioContext was running and advanced from 37.883 to 48.263 seconds.
Three later read-only observations of DirectSound worklet voice 720898 showed
an advancing cursor, descriptor sequence 758/770/780, and three different
262,144-byte ring hashes over 4.01 seconds. These concurrent memory snapshots
show producer activity, not an atomic audio recording or proof of seamless
output. Shared waveOut callback registration was zero and its completion
queues were empty; this observation does not support the separate Tile World
or FOTAQ pending-function-callback diagnosis.

Evidence is in `scratch/runs/20261004-diablo2-glide-menu-observation`
(182 hashed artifacts), with raw `analysis.json`, `rings.json`, timed images,
owner samples and the actual served files. All 147 unique served file copies
passed their recorded hashes. The browser was headful Chrome 151 with explicit
`--disable-gpu` and SwiftShader, so this is not proof of parity with the user's
device. Browser session 35990 and its read-only attachment both exited 0;
browser and server closed at 16:29:06.090 UTC.

Next, compare the affected URL, build, browser/device and onset route with
this local identity, then capture output audio if the complaint persists.
No guest state, engine code or pacing was changed, and no gameplay, FPS or
release-readiness claim follows from this menu observation.

## Menu audio (2026-10-06, claude:65967384)

The menu theme is `data\global\music\common\options.wav` (d2music.mpq), first in
d2sound's music table at `0x1000f668`. The playlist (`#10033`, `0x10004640`,
driven by d2sound's thread T3 at `0x100027f0`) opens it via Fog and hands it to
**Storm's DDA streaming**: `SFileDdaBeginEx` (Storm `#255`, called through
`0x1000511a`). Storm creates the 256 KB 22 kHz stereo buffer itself (flags 0xe0)
on the IDirectSound d2sound gave `SFileDdaInitialize` (`#260`), and its own
thread T2 (start `storm+0x6ffc59d0`) Locks/fills it (Lock site `0x6ffc6dc1`) and
Plays it once (`0x6ffc6e89`). So the music never shows as a d2sound
Lock/Play, and a worker's COM calls are not named in `--trace-api`: count the
Storm sites with `--count=storm+0x6ffc6dc4,storm+0x6ffc6e8c` instead.

- d2sound keeps 3D sound only when `DSCAPS.dwMaxHw3DAllBuffers >= 16` (check at
  `0x1000189b`) and otherwise refuses every sound flagged 3D (`#10007`,
  `0x100032a0`). We used to report 0 (and wrote the max rate into +56); fixed in
  1b4d12a1.
- On the CLI's 200 ms/batch clock Storm's decoder is starved: the theme starts
  ~760 guest-s after batch 2500. Record CLI audio with `--video-fps=5` (one video
  second = one guest second) or the mux's `-shortest` cuts the audio away.
- Browser (record-probe, 180 s): continuous music over the live menu, no stuck
  loop (`scratch/runs/20261006T1300Z-diablo2_glide_demo-w4-browser-audio`).

## 2026-10-10: per-object GetTickCount vs the d2win QPC limiter

Two clock loops, which the clock-spin detector must tell apart:

- `0x4293c0` (exe) reads GetTickCount once per object, with `EDI = this`.
  It is not a wait. In town the old detector parked it (in the browser Worker
  build, 4 fps against 41).
- `d2win.dll` `0x1000b6e4` (loaded at 0xc97000 in the CLI) is the real frame
  limiter: QueryPerformanceCounter, QueryPerformanceFrequency and PeekMessage
  in a loop. It copies each count into `ESI:EDI` (`mov esi,[esp+0x14]; mov
  edi,[esp+0x18]`), so ESI changes on every pass of a genuine spin.

a7e5f4f75 counts a read only when EBX/EBP/ESI/EDI match the context's previous
read, discounting any register equal to the previous clock reading. Full
route, same build: the limiter parks 38 by the menu and 40 by the Act I load
in both arms; in town, parks go 0 (check on) vs 106 over 240 batches (off).
Run `20261010T1720Z-clock-spin-regs-check-boat`.
