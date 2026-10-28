# Morrowind (GOTY retail ISO) — local-only candidate

Retail, so **localhost only**: `morrowind` is in `LOCAL_CANDIDATE_APPS` (the
dropdown `index.html` shows only on localhost), never `DESKTOP_APPS`. Nothing
made from the disc is committed, and `tools/deploy-berrry.js` refuses
`test/binaries/candidates/morrowind/` and `downloads/` by name, `--files=`
included (`test/test-deploy-morrowind-local-only.js`). You bring your own disc:

```bash
node tools/prepare-morrowind.js --iso=path/to/your/Morrowind.iso   # needs unshield + 7z
node test/run.js --app=morrowind --memory-mb=1024 --headless-gl --quiet-api \
  --tick-ms-per-batch=2 --stuck-after=100000 --no-close --max-seconds=170
```

The prep tool unpacks `data1.cab` (unshield) and DirectShow out of
`DX81eng.exe` (7z) into `installed/`, copies `Video\*` + the autorun files
into `cd/` with a one-track cue over the image (D: is a CD-ROM labelled
MORROWIND), and writes `.wine-assembly-browser.json`. That manifest also
carries the 432 registry keys `regsvr32 /s` writes for devenum, quartz and
l3codecx, in that order: registering quartz first misses the filter-mapper
`Instance` keys. Both hosts import those keys at every launch. Without them the
title music fails with "Music Error: Can not create filter graph."
The browser path is unverified. It fetches the whole ~900 MB tree eagerly.

## Reproduce (manual, pre-entry)

```bash
I=test/binaries/candidates/morrowind/installed
node test/run.js --exe="$I/Morrowind.exe" --dll-seed=binkw32.dll --vfs-include='**' \
  --iso=downloads/Morrowind.iso --reg-import=test/binaries/candidates/morrowind/registry.json \
  --memory-mb=1024 --headless-gl --quiet-api --stuck-after=100000 --no-close \
  --max-batches=9000000 --max-seconds=570 --input=...
```

- `--iso` because the game checks for its CD and reads `d:\video\*.bik` from it.
- `--memory-mb=1024`: at 512 MB the sparse arena runs out while DirectShow
  builds the title-music graph (`[heap] OOM ... sparse arena`), and the game
  shows `Music Error: Can not play file ... morrowind title.mp3` then exits.
- `--headless-gl`: Morrowind renders through D3D8 on the GL backend.
- `--wasm-enforce-bounds-checks` (a node flag) only when chasing a SIGBUS: the
  headless-gl native module installs a segfault handler that turns a wasm
  out-of-bounds access into SIGBUS with no stack. The flag makes it a JS trap
  with a wasm stack. It costs roughly 3x.

## Reaching gameplay (2026-09-19)

Reached: the prison-ship hold with Jiub, textured, lit and animating. About
2k batches after `chargenname1.mp3` the game shows its "Name" text-entry
prompt (label, caret, OK) over the world, then waits for input. That is the
end of what the driver automates. Before the mip-chain fix the prompt drew as
an empty frame on a fog clear: the UI font textures hit the same rejected
draws. What gets there, in one run of about
3.5 minutes of wall clock:

- The driver: `node test/binaries/candidates/morrowind/drive-morrowind.js OUTDIR 2 1500`.
  It is gitignored like everything else here. Its screenshots are
  `OUTDIR/world-N.png`.
- `--tick-ms-per-batch=2` for the **whole** run, plus `--control-stdin`. The
  driver watches which files the game reads and reacts:

  | file the game reads | driver's mode | what the driver does |
  |---|---|---|
  | a `.bik` in boot | video | ESC pulse every 3 s |
  | `mw_logo.bik` | menu | alternate ESC and a DI click, which lands on New |
  | `splash\*.tga` after the menu | world load | nothing, just wait |
  | `mw_intro.bik` | intro | ESC pulse every 3 s |
  | `music\explore\*` | world | take the screenshots |

  **Do not treat `.bsa` reads after the menu as a world load.** The menu
  itself reads `morrowind.bsa`, and treating that as "loading" made the
  driver stop clicking.
- Timeline at tick 2 (~5000 batches/s):

  | batch | event |
  |---|---|
  | 13.6k | Bethesda logo, skipped at once |
  | 515k | `mw_logo` / menu |
  | 539k | New |
  | 568k | `mw_intro`, skipped |
  | 570k | in world |

- The WebGL D3D9 backend used to reject most world draws, so the world
  showed as a bare fog clear with a crosshair. Two fixes (both in
  `test/test-d3d9-webgl-partial-mips.js`):
  - **Partial mip chains.** Morrowind's DDS textures stop above 1x1, and
    `lib/d3d9-backend.js` threw `incomplete mip chain`. It now clamps with
    `TEXTURE_MAX_LEVEL` on WebGL2, and box-filters the missing levels on
    WebGL1 (headless GL).
  - **Lit draws with no NORMAL.** `lib/d3d9-fixed.js` threw `missing vertex
    semantic 3:0`. The normal now reads as zero, as it does on D3D9.

## What the startup load spends its time on

The load is compute-bound: 79% of batches spend their whole block budget and
only the main thread runs. From the block histogram at batches 100k-200k:

- ~30% msvcrt `_stricmp` (runtime `0xbb37cb`), a byte-at-a-time loop, called from
- ~20% `Morrowind.exe` `0x4b47e0`, a linear list walk that looks up objects by
  name (`vtbl+0x20` GetID, then `_stricmp`, then next). Every lookup walks the
  list, so the load is O(n^2) in the game's own code.
- ~5% `0x6e2e60`, texture conversion one pixel at a time.

`_stricmp` is now bound to the native handler even though the real msvcrt.dll
is loaded (`$native_override_export_api_id` in `08b-dll-loader.wat`, like
`_ftol`). The measurement is fixed work, boot to menu at tick 2, with GL up.
The driver quits when it reaches the menu, and the CPU is `user` from
`/usr/bin/time`:

| arm | batches to menu | user CPU | load avg |
|---|---|---|---|
| without the override | 523k | 97.9 s | 6 |
| with the override | 441k | 74.7 s | 5 |

So the override is about 24% less CPU and 16% fewer batches. It makes ~9.8M
native `_stricmp` calls before the menu (16.6M API calls in total against
6.8M). Splash order is random, so a few thousand batches of it is noise.

Timing on this box is only worth quoting at a low load average. At load 26-61
the same two arms swapped places in wall-clock time from one run to the next.

Two traps:

- **A run whose log has `[gl] context creation FAILED ... No suitable
  display` does not count.** GLFW found no monitor, nothing renders, and it
  reaches the menu at 385k because it skips all drawing.
- **Suppressing the per-call API log is not a lever.** Each API call crosses
  into JS twice (`log`, `log_api_exit`). Gating both behind a wasm flag
  measured 84.3 s against 80.7 s ungated with the same `_stricmp` build on a
  quiet box, which is noise, so it was not kept.

The driver's `MW_STOP_AT=menu MW_NO_TRACE=1` env switches do the fixed-work
run. `MW_NO_TRACE` takes the `[FS] ReadFile` lines the driver keys on from
`--trace-fs` instead of `--trace-api`. Without either, the driver sees no
reads and sits in Bink forever.

Dropping msvcrt.dll entirely is not an option. Morrowind imports C++ exception
handling from it (`__CxxFrameHandler`, the `exception` class members), and
quartz.dll and devenum.dll import it too.

### The emulator heap (2026-09-19)

With `_stricmp` gone, the next cost in any load (the startup load, and the
cell load right after entering the world) was the emulator's own heap:
`$heap_arena_find` 21% and `$heap_alloc` 20% of CPU over batches 150k-250k.
`$heap_alloc` walks one first-fit free list and validates every link through
`$heap_arena_find`, which scanned the whole arena table each time. The lookup
now tries the arena that answered last before scanning. Same fixed work (boot
to batch 250k, tick 2, GL up), user CPU:

| arm | run 1 | run 2 |
|---|---|---|
| HEAD | 51.3 s | 51.2 s |
| arena hint | 30.0 s | |

About 41% less. Left afterwards: `$heap_alloc` 5.4%, `$heap_arena_find` 1.2%,
so size-class free lists would not buy much more.

### The GPU sync per draw

Past the cell load, the world window (batches 560k-600k) is almost all native
GL: 37-38% of CPU is one headless-gl native frame. `lib/d3d9-host.js` called
`gl.finish()` after **every** command, so each draw stalled the pipeline. It
now drains only where something observes the result (fence, readback,
release, reset, a failed command) and flushes at Present. Same wasm, only
`d3d9-host.js` differing, CPU profile of the fixed world window:

| arm | sampled CPU, batches 560k-600k | in the GL sync frame |
|---|---|---|
| finish every command | 68.6 s | 26.6 s (38.8%) |
| finish at observation points | 44.0 s | none |

About 36% less in the world. What was left there was mostly JS: the
command stream's payload copy (`d3d-command-stream.js` `copy`, 18%) and
`run.js`'s `h.log` (19%, plus 8.6% in its callback). `h.log` is called by
`$win32_dispatch` for every API call, and for a COM method it resolved the
name with a linear `apiTable.find` over ~3700 entries. Nearly every call in
the D3D8 world is COM. It is now an index lookup. This is CLI only; the
browser has no such hook.

Every `MW_NO_TRACE` run, on every build, puts up a `Warning` box a few
thousand batches into the world: `Model Load Error:
Meshes\a\A_Imperial_UA_Pauldron.nif cannot load file`. The box draws with no
message text. Neither is investigated yet.

The profile tooling: the driver's `MW_ROOT` runs a worktree's `run.js`, and
`MW_MAX_BATCHES` ends the run at a fixed batch (run.js takes the *first*
`--max-batches`, so passing one through `MW_EXTRA` does nothing). Wake the
display (`caffeinate -u -t 3`) before each run, or GLFW finds no monitor.
`tools/cpuprof-top.js --names` resolves names from `build/combined.wat` beside
it, so a profile of a pinned `WINE_ASSEMBLY_WASM` needs that build's
`combined.wat`, or every name is wrong.

## Boot sequence (default 200 ms/batch, 1000-block batches)

| batch | what |
|---|---|
| ~7k | `bethesda logo.bik` (Bink, has audio) |
| 150k-250k | loading bar over `splash_*.tga` (splash picture itself draws light blue — not investigated) |
| ~560k | `mw_logo.bik`, then title music via DirectShow |
| ~600k | main menu: New / Load / Options / Credits / Exit |
| click | `di-mousedown:1`/`di-mouseup:1` with no move lands on **New** (the DI cursor starts at screen centre, 320,240) |
| +70k | world load (splash TGAs, `morrowind.bsa`/`.esm` reads), then `mw_intro.bik` |

## The Bink clock problem (the main blocker)

Bink paces video against wall time (`timeGetTime`/`QueryPerformanceCounter`
and the DirectSound play cursor). At the default 200 ms/batch, decoding one
frame costs more guest time than the frame lasts, so Bink is permanently
behind: it decodes and skips forever and never presents, with **zero** API
calls from the main thread (main loops inside binkw32 `+0xd100..0xd1db`, the
bitstream decoder). The picture is byte-identical for 300k+ batches. This hit
the Bethesda logo in some runs and `mw_intro.bik` in every run.

ESC only skips a video when it lands while the decoder is between frames, so
ESC schedules are luck, not a fix. What works is a slower guest clock:
`--tick-ms-per-batch=2` plays the logos visibly. `--input=B:tick-ms:N` switches
the cadence mid-run so the boot can stay on the fast clock (added for this app).

Large batches (`--batch-size=10000 --tick-ms-per-batch=20`) give the same
ops-per-guest-ms with fewer batches, but PNG captures of the D3D8 frame came
back as the empty GDI window intermittently at that batch size — use the
default batch size when a picture matters.

## Music restarts every ~1000 batches — not a bug

After the intro, exploration music (`music\explore\mx_explore_N.mp3`) opens a
new DirectShow graph about every 1000 batches. A 3-minute track at
200 ms/batch is ~900 batches, so the tracks really are ending. It does mean
many graph builds per run, which is part of why 512 MB runs out.

## Emulator fixes this app needed (2026-09-18)

- `CoCreateFreeThreadedMarshaler` + FTM inner/IMarshal objects (quartz).
- `ReplyMessage` (one pending reply per cross-thread send depth).
- COM in-proc DLL loads requested from a **cooperative worker thread** (yield 3)
  were never serviced — T3 parked forever. `run.js`/`host.js` now service them
  and sync main's DLL/thunk globals into the worker first (`adoptMainGlobals`).
- `$load_dll` rebases an image that would overflow the low guest spans into a
  sparse reservation. Before, `l3codecx.ax` was placed at `0x45e6000` and its
  image overwrote emulator tables (PAGE_INDEX_ARENA), which surfaced as
  `0xCAC4BAD0` dispatch garbage. quartz/devenum/l3codecx now load near
  `0x7e8x_xxxx`.
- Import-name logging in `$win32_dispatch` used `GUEST_BASE + rva` instead of
  `g2w(image_base + rva)` — out of bounds for a rebased DLL.
- `$static_sys_dll_name_at` stops at the list terminator; a rebased DLL's
  handle is above the pseudo-handle base and used to walk off the list
  (`GetModuleFileNameA`).

## Threads

binkw32 starts two worker threads that sit in `WaitForSingleObject` at
binkw32 `+0xd3c3` (runtime `0x8e13c3` when binkw32 loads at `0x8d4000`,
origBase `0x30000000`). quartz threads appear and exit per graph; one reports
`EIP=0 (likely call/jmp to NULL)` when its thread proc returns — harmless.

## What is hot now, and whether "C++ opts" is the lever (2026-09-19)

One window, `--handler-hist-thread=0 --handler-hist-start=150000
--handler-hist-stop=250000` over the boot/load phase (tick 2, GL up,
`--quiet-api`), with `--hist-json` + `--hot-block-dump`. Counts are
load-immune, so the load-16 box is fine for this. 481.9M ops, 77.2M block
entries, **6.24 ops/block**, 13455 distinct blocks. By module: exe 74.9%,
msvcrt 14.0%, binkw32 0.3%.

The single hottest block is **15.33% of every block entry in the window** —
four times the next one — and it is a C++ container walk:

```
00479abb   test edx,edx / jz            ; __thiscall, ecx = this, eax = N
00479abf   mov edx,[ecx+0x8]            ; cursor = this->head
00479ac2   mov [ecx+0x10],edx
...
00479acd   dec eax                      ; <-- the hot block, self-looping
00479ace   mov edx,[ecx+0x10]           ; cursor
00479ad1   mov edx,[edx+0x4]            ; cursor = cursor->next
00479ad4   mov [ecx+0x10],edx           ; write it back to the object
00479ad7   jnz 0x479acd
```

Seek-to-index over a singly linked list, with the cursor spilled to
`this+0x10` on every step. It has no static xrefs (`tools/xrefs.js`), so it
is reached through a pointer — it is the walk behind the `0x4b47e0` O(n^2)
name lookup already recorded above. Next after it: `0x6e2e8d` and
`0x6f1bb4` at 4.07% each, the per-pixel texture conversion
(byte loads, `shr`/`shl` by CL, `movzx`), then a flat tail of ~1.3% blocks.

Handler ranking for the window: `$th_load32_rop` 12.0%, `$th_load8_ro`
10.4%, `$th_inc_r` 5.3%, `$th_store32_rop` 5.3%, `$th_push_r` 5.2%.

**So: yes to one C++ idiom, no to the obvious ones.** Folding vtable
dispatch, `thiscall` prologues or `push`/`pop` runs is *control flow*, and
this project has already measured that class at ~0 twice (`case_chain`,
dispatch replication's arm H). `0x479acd` is the opposite: a **memory**
idiom, which is the class that has paid here (`rect_run` +12%, `RLE_RUN`
+7%).

It is also a true self-loop block, so `$loop_match_block` in
`src/07b-loop-match.wat` already sees it and declines it.
`tools/match-loops.js --why` on this exe: 5224 self-loops, 2.3% matched, and
**29 `non-streamed-load`** declines — the existing COPY/FILL/LUT/SCAN
predicates all require an *affine* address stream, and a pointer chase has
none. The extension is a fifth predicate: a load whose address is fed by the
value the previous iteration loaded, with one counter and one store back to
a fixed slot.

Arithmetic before building anything: 11.8M block entries and ~59M ops of the
window collapse to ~11.8M handler iterations inside one block entry. At the
`bench-loops.js` prices (~8 ns a dispatch, ~9 ns a block transfer) that is
the largest single interpreter item Morrowind has. But the chase is
serial dependent loads, so the real ceiling is memory latency, not dispatch,
and the fold's win will be smaller than the op count suggests.

**Not yet evidence: this is ONE window, and it is a loading window.** The
`hot-loop-census.js` rule applies — a region at 15% in one window and absent
in the next is a scene, not a fold target. Take the in-world window
(560k-600k) and a menu window before writing any WAT, and remember the world
window is already 37-38% native GL, so the same fold is worth much less
there.

### CORRECTION: that block is a scene, not a fold target (2026-09-19, later)

The 15.33% above is **one loading window**, and it does not survive more of
them. Two independent harnesses now say so.

Six consecutive CLI windows, one run, 750k batches to the post-"New" intro
(`--handler-hist-thread=0,0,0,0,0,0 --handler-hist-start=150000
--handler-hist-stop=750000 --hist-json=`, with `620000:di-mousedown:1` to
click New):

| window | batches | what it is | `exe+0x479a80..479ad9` |
|---|---|---|---|
| w1 | 150k-250k | splash + bink | 8.0% |
| w2 | 250k-350k | loading | 12.9% |
| w3 | 350k-450k | loading | 0.3% |
| w4 | 450k-550k | menu | 6.6% |
| w5 | 550k-650k | menu | 3.2% |
| w6 | 650k-750k | `mw_intro.bik` | **0.0%** |

Mean 5.2%, spread 12.9pp. And twelve windows taken in a real Chrome (below)
never had `0x479acd` in the top **forty** blocks at all.

`tools/hot-loop-census.js` returns the same verdict on both sets:

> NO region holds >=5% of block entries in every window. Nothing here is a
> safe fold target on this evidence.

The list walk is real and recurring, but it is a *load-time* name lookup, so
it is big exactly when the game is reading assets and absent when it is
playing a video. This is the SimGolf/H455 trap the census tool was built for,
and it was one window away from being repeated here. **A Morrowind-specific
fold is not the next work item.** The cross-app levers in
[hot-idiom-census-2026-09-19.md](../hot-idiom-census-2026-09-19.md) —
`cmp`/`test` + Jcc fusion, then the zero-then-load8 / load8+inc pair — are,
because they pay in every window of every app rather than in one scene of
this one.

Still not measured: gameplay proper. w6 is the intro movie; the world window
is past it.

## Driving it in a real browser (frozen mode)

`?app=morrowind&frozen&debug` plus `window.WineFrozen.step(n)` runs the
browser build under an agent's control, which is the only way to reach the
Worker-hosted code path (`--threads` in the CLI keeps the guest's MAIN thread
in-process; the browser puts it in worker slot 0). Three things that cost a
session each:

- **The dev-server needs `--isolate`.** Without the COOP/COEP headers the page
  reports `[threads] not cross-origin isolated — running single-threaded` and
  quietly runs the mode you were not testing.
- **Wait on `WineFrozen.status().hosts`, not on console text.** The
  worker-hosted main thread never prints the cooperative path's "DLLs ready" /
  "Starting run", and a frozen host prints nothing until it is stepped.
  `runningApps` is module-scoped in `browser-shell.js`, not a global.
- The ~5930-file mount takes a minute or two before any of this; give it its
  own budget or it eats the stepping one.

Morrowind at 16ms/step was still on `Initializing Data…` after 26,000 steps
(390s of guest time), so browser windows reach the loading phase only.

## The Worker-mode COM reload loop (2026-09-19)

Threads mode in the browser dies a few seconds in:

```
[COM] Loading DLL: quartz.dll (worker)      x~30, each ~0x130000 lower
[COM] DLL load error: DLL table capacity 32 exhausted
[threads] guest trapped in worker: unreachable @ EIP=0xf523d7
```

`com_create_instance` (`lib/storage.js`) resolves the server through a fixed
`ctx.exports`:

```js
const dllCount  = exports.get_dll_count();
const dllTable  = exports.get_dll_table();
const imageBase = exports.get_image_base();
```

In browser worker mode that is host.js's **idle** instance — the one that
never loaded the PE. `dll_count` is a per-instance global, so the row the
worker just appended is invisible to it, and its `image_base` is 0, so the
export-name reads would be wrong even if the count were right. Every retry
returns `CO_E_DLLNOTFOUND`, the guest yields 3 again, and
`_handleComDllLoadThreaded` (host.js) maps another copy — until the shared
32-row table is exhausted and the thread runs into garbage.

`a4bd125c` fixed the CLI shape of this (`_publishLinkLoaderState` raises main's
count after a worker load) but the browser reaches the loader through
`host.js` → `guest-thread-host.js comLoadDll`, which never publishes. The
right fix is probably to resolve against the **calling** link rather than a
fixed instance, since raising the count alone still leaves `image_base` 0.

It reproduces only at full speed: 1300 frozen steps never trapped, and the
first unfrozen seconds did. It is a race, so a frozen bisect will not find it.

### FIXED, cf4d4000 (2026-09-19)

The guess above about `image_base` was wrong, and the real cause is narrower.
`image_base` **is** seeded on the idle instance — `loadPe` in worker mode
already follows up with `init_thread(7, meta.get_image_base, ...)`. What is
not carried is `$dll_count`. It is a per-instance global, `init_thread` does
not take it, and nothing published it, so:

- after the worker loads the PE, main's count is 0 while the worker's is N,
  and the **first** `CoCreateInstance` searches zero rows whatever is mapped;
- after the worker loads a COM server, main's count still does not move, so
  the retry stops short of the row just written and asks for the same DLL
  again. Forever.

`a4bd125c` fixed the CLI shape of this in `ThreadManager._publishLinkLoaderState`,
called from its own yield loop. `host.js` services the guest-main worker's COM
and LoadLibrary yields **directly** and never enters that loop, which is why
the browser kept the bug. It now publishes after both, and seeds the count
once after `loadPe`.

Verified in Chrome (`?frozen` + Threads, `tools/dev-server.js --isolate`):
each of quartz.dll, devenum.dll and l3codecx.ax now loads **exactly once**
(quartz was ~30x), no `DLL table capacity 32 exhausted`, no trap, and the
guest gets as far as creating its `ActiveMovie Window`.

## Phase-separated profiles (2026-09-19)

One window is not evidence about where an app spends its time, and on this
title it is actively misleading: the 15.33% block recorded further up came
from a window that turned out to be a **video**. So each phase below is
profiled on its own and labelled by its own PNG rather than by a batch number
copied from another run.

Recipe (CLI, tick 2, `--headless-gl`, `--quiet-api`, GL confirmed up —
a `[gl] context creation FAILED` run does not count):

```bash
ESC=$(for b in $(seq 6000 1500 528000); do printf "%d:keydown:27,%d:keyup:27," $b $((b+40)); done)
node test/run.js --exe="$I/Morrowind.exe" --dll-seed=binkw32.dll --vfs-include='**' \
  --iso=downloads/Morrowind.iso --reg-import=.../registry.json \
  --memory-mb=1024 --headless-gl --quiet-api --stuck-after=100000 --no-close \
  --tick-ms-per-batch=2 --max-batches=9000000 --max-seconds=780 \
  --handler-hist --handler-hist-thread=0,0,0,0,0,0 \
  --handler-hist-start=380000 --handler-hist-stop=530000 --hist-json=OUT/w \
  --input="$ESC,385000:png:OUT/p385000.png,..."
```

**The ESC pulse is load-bearing.** Without it the run never leaves phase A.
This replaces the gitignored `drive-morrowind.js`, which is missing from the
tree; it does not watch which files the game reads, it just pulses.

Timeline at tick 2 *with* the pulses: splash from before 380k to ~515k, menu
by 527k (cursor on New).

### Phase A — Bink intro video

Unskipped, this phase does not end. At batch **249k the Bethesda logo is
still on screen** — the entire 250k-batch budget went into one logo.

| window | ops | block entries | ops/block | distinct blocks |
|---|---|---|---|---|
| 50k-100k | 481.8M | 53.9M | 8.93 | 1514 |
| 100k-150k | 3085.9M | 200.0M | 15.43 | 246 |
| 150k-200k | 3614.56M | 200.0M | 18.07 | 214 |
| 200k-250k | 3614.55M | 200.0M | 18.07 | 214 |

The last two windows are the same work twice: same 214 blocks, op counts
0.0002% apart, shares equal to 0.1pp. Every hot region is `binkw32`, and
`binkw32+0x3000cb50..3000d306` alone is 81.4 / 76.5 / 76.5% of block entries.
This is the one region in this app measured stable across consecutive
windows — the opposite of `exe+0x479acd`, which is retracted above.

Handlers, 200k-250k window:

| handler | share of dispatches |
|---|---|
| `$th_fpu_mem_ro` (H190) | 37.61% |
| `$th_fpu_reg` (H189) | 22.43% |
| `$th_fpu_mem` (H188) | 6.51% |
| `$th_compute_ea_sib` (H149) | 6.30% |

**66.6% x87.** Adjacent pairs: H190->H190 23.63%, H189->H189 11.34%,
H190->H189 9.72%, H189->H190 9.29% — **54% of all dispatch transitions are
x87 to x87**. The SIB census is the same story: H188 in `[reg+reg*4+disp]`
forms is over 70% of recorded SIB effective addresses.

**Do not read that as "fuse H189/H190".** An x87 fusion was already built and
measured on Monkey Island and gave nothing, because the cost is inside the
helper calls, not in the dispatch between them; what paid there was moving
the x87 registers into the per-thread FPU_FILE (-16%). The finding here is
that the phase is x87-bound, which says to make those three handlers cheaper,
not to glue them together.

### Phase B — asset load, "Initializing Data..." (~380k-515k)

Six 25k windows, all showing the splash with its progress bar. ops/block is
**2.45-9.32** against phase A's 18.07 — this phase is block-transfer-bound,
the opposite shape, and a fold that helps one cannot help the other.

| region | w1 | w2 | w3 | w4 | w5 | w6 | mean | spread |
|---|---|---|---|---|---|---|---|---|
| `exe+0x4b47e0..4b48a5` | 1.0 | 0.0 | 22.4 | 51.9 | 30.3 | 0.0 | 17.6% | 51.9pp |
| `exe+0x4db590..4db5d0` | 0.1 | 0.0 | 16.5 | 30.6 | 16.7 | 0.0 | 10.6% | 30.6pp |
| `exe+0x4d10eb..4d1337` | 24.1 | 22.7 | 7.1 | 0.0 | 0.0 | 0.0 | 9.0% | 24.1pp |
| `exe+0x4a45f0..4a480c` | 18.5 | 17.2 | 5.4 | 0.0 | 0.0 | 0.0 | 6.8% | 18.5pp |

`0x4b47e0` is the object-name list walk already identified above as O(n^2) in
the game's own code. It peaks at **51.9%** of block entries and is *absent*
from two of the six windows, so even within one phase it is a sub-scene.
`hot-loop-census.js` verdict for phase B: no region holds >=5% in every
window.

### Phase C — menu, and what is still unmeasured

The menu is up at 527k. It has no window of its own yet: the last window
(505k-530k) straddles the tail of `mw_logo.bik` and the menu, which is why
`binkw32+0x30011d80` reappears at 25.3% there.

**Gameplay is still unmeasured**, but not for the reason written here
originally — the click on New works. See "Driving to gameplay" below for
where it actually stops.

### So "the load" is two unrelated problems

- **Phase A** is what a user actually sits through, and it is a video codec
  being interpreted at 2/3 x87 dispatches.
- **Phase B** is the game's own quadratic name lookup plus emulator block
  transfer.

Quoting one number for "load" hides both.

## Driving to gameplay — how far the CLI gets, and the exact wall

Five headless runs (2026-09-19) chasing a gameplay histogram window. None
reached gameplay, but they moved the blocker a long way and ruled out three
input paths. Recorded here so the next session starts from the wall rather
than from the intro.

### The world renders

The DirectInput click on **New** works. With

```
--input="<ESC train>,<DI click train>,..."
  ESC train:  seq 6000 1500 <end>   as B:keydown:27 + B+40:keyup:27
  DI click:   seq 520000 3000 560000 as B:di-mousedown:1 + B+60:di-mouseup:1
```

the game runs `mw_intro.bik`, tears it down and builds the prison-ship hold.
By batch ~810k the captures show the hold **textured, lit, with Jiub in
frame** — i.e. the D3D/GL path, the world geometry and the character model
all work. This is much further than the notes above assumed.

### ESC opens the pause menu and nothing we send closes it

The ESC pulse train is load-bearing for skipping the Bink videos, but any
pulse that lands *after* the world is up opens the in-game pause menu
(`Return / New / Load / Options / Exit` — note `Return`, which the main menu
does not have). It is **not a toggle** in our build:

| run | ESC after 860k | frame at 870k-1040k |
|---|---|---|
| prof4 | none | pause menu, open |
| prof5 | one pulse at 866k | pause menu, open |

Two opposite inputs, same result, so a corrective press is not the fix. End
the train **before the world appears**: `seq 6000 1500 800000` is enough to
skip every video and leaves no menu.

### The real wall: the chargen Name box

With the train ending at 800k the run reaches the character-generation
**Name** text prompt, drawn over the live world, by ~810k — and sits there.
The frame is *byte-identical* from 810k through 900k.

Three input paths tried against that box:

| path | result |
|---|---|
| `keydown`/`keyup` letters | field stays empty through 880k — never reaches it |
| `di-keydown`/`di-keyup` letters | **destructive** — chargen torn down, back at the main menu by 834k |
| `keypress` letters | untested to completion |

So **do not use `di-keydown` for text.** It is for held game keys (movement);
feeding letters through it loses the session.

Getting past the box is the whole remaining problem. Likely candidates for
next time: `keypress` (the WM_CHAR path), or clicking the box's own `OK`
button — it sits at roughly (447,262) in the 640x480 capture, with the
cursor parked near (325,250), so a corner-slam `relmousemove` followed by a
known offset and `di-mousedown:1` is a deterministic way to hit it.

### SOLVED: the Name box clears, and the world resumes

That suggestion is the answer. Corner-slam the cursor, move it to the OK
button, click with DirectInput, and repeat the whole thing every 4000
batches:

```
B:relmousemove:-2000:-2000,
B+200:relmousemove:447:262,
B+300:keypress:74,
B+400:di-mousedown:1,
B+500:di-mouseup:1
```

for `B` in `seq 610000 4000 780000`. The box is gone afterwards and every
subsequent capture is a distinct hash, so the world is animating again. The
run reaches the **prison-ship hold** — textured and lit, Jiub standing in
frame, camera live — at batch ~636k of an 85-second headless-GL run. Pressing
ESC there opens the in-game pause menu (Return / New / Load / Options /
Exit), which is independent proof the world is live and taking input.

A `keypress:74` was sent before each click and was not isolated from the
click, so which of the two clears the box is still unknown. The click is the
one with a mechanism behind it.

That is character generation, not gameplay: no HUD, and the player has not
been released from the census office. Two NPC conversations and a walk out of
the hold remain, which is **wall clock, not a blocker** — at the measured
9.4k batches/s the world appears at ~605k batches, around 65-85 s, leaving
nothing in a 90 s budget. Give this one run **200-240 s** and a real gameplay
frame is in reach.

### Two more things the earlier runs got wrong

- **ESC in the world opens the pause menu, and a blind DI click closes it.**
  The "two opposite inputs, same result" reading above is wrong about why: a
  DI click with the cursor near screen centre lands on the pause menu's
  *first* item, which is `Return`. So a plain click train run through the
  world silently undoes the pause menus the ESC train opens, and captures
  alternate between menu-open and clean-world frames for that reason alone.
- **`--quiet-api-fast` is worth ~25% here** and is not mentioned anywhere
  above: 7,245 -> 9,027 batches/s on back-to-back runs with otherwise
  identical flags. Morrowind makes ~20M API calls in 85 s, so the name-decode
  path is a real share of the run.

### A fixed-batch `--input` schedule is not reproducible for this app

Batch numbers are reproducible *for a fixed input schedule*; how many batches
fit in a fixed wall-clock budget is not. Across runs on one box the rate
ranged **6,836-9,497 batches/s (+-33%)**, so the same 85 s reached anywhere
between batch 604k and 807k. That is why an ESC train ending at 600k skips
`mw_intro.bik` in one run and lets it play in the next. Either repeat every
action across a wide batch span, or drive live with `--control-stdin` /
`tools/ctl.js`; do not aim a single action at a single batch.

**Build the train with `seq -f "%.0f"`.** BSD `seq` switches to `%g` past a
million and prints `1.02e+06`; `run.js` parses that batch number as `1`, so
every action above batch 1M fires immediately and silently. A run built with
a bare `seq` loses its entire walk train and parks on whatever screen the
sub-1M actions left up — which looks exactly like the app being stuck.

Phase timeline on the current build at `--tick-ms-per-batch=2` with a
**700-batch** ESC pulse spacing (denser than the 1500 used above): main menu
up at **460k-545k**, New click then world-load splash ~30k batches later,
`mw_intro.bik` next, world by **~605k** when the ESC train covers the intro.

One run put up `[MessageBox] "Error": "Music Error: Can not play file. Data
Files/Music/Special/morrowind title.mp3"` even at `--memory-mb=1024`. It did
not block progress and did not recur.

### Cheap oracle: md5 the capture series

Every one of these runs was diagnosed by
`md5 -q <dir>/*.png | sort | uniq -c`. A single hash across a 170k-batch
span means the guest is **blocked on a modal**, not running slowly — and it
costs nothing next to reading a histogram that is really measuring a paused
game. Do this before running `hot-loop-census.js` on any window, otherwise
the census faithfully profiles a still frame. It is also what caught the
regression in the table above: prof8's hash differed from prof7's, which is
how the DI-key teardown was spotted at all.

Runs are deterministic (see `project_headless_determinism`), so a batch
number learned from one capture series is reusable in the next run.

## Bink video hang: every thread owned mutexes as thread 1 (2026-09-28, FIXED 82b4c4a5)

Symptom: on the software D3D9 arm a Bink video froze mid-play: run 1 on the
Bethesda logo, run 2 on `mw_intro.bik` frame 224 (the stopping point moves
with the schedule). Main sat in `BinkDoFrame` (exe `call [0x738408]` at
`0x424b75`, return `0x424b7b`), with the MMX count frozen, looping in Bink's
audio decoder (`binkw32+0x30005df4` calling `0x3000cb50`) over a 907 MB
"packet length" read from the frame buffer.

binkw32.dll 1.5a (origBase `0x30000000`) IO layer, `io = bink+0x110`:

| io+ | meaning |
|---|---|
| `0x3c` | ring size (`0x8a000` intro, `0x83000` logo) |
| `0x48` | bytes available to the consumer |
| `0x50` | file read position |
| `0x54` | consumer file position |
| `0x58` | consumer ring pointer |
| `0x5c` | free bytes |
| `0x64`/`0x68` | ring start / end |
| `0x6c` | producer ring pointer |
| `0xcc`/`0xd0`/`0xd4` | lock (WFSO INFINITE) / try-lock (WFSO 0) / unlock (ReleaseMutex); mutex handle at `io+0xdc+4` |

The reader thread (`0x3000a157`) try-locks the mutex, checks
`free >= 0x1000` **unsigned**, reads 0x1000 bytes and `lock add`s the
counters. The consumer (`0x30009d38`) takes the same mutex. Invariant:
`avail + free == ring size`.

Cause: `test/run.js` and `host.js` computed the caller's Win32 thread id from
`ctx.threadId`. Nothing sets it, and every worker import table adopts the
main thread's sync imports, so every thread was thread 1. The reader's
try-lock therefore "re-entered" a mutex main held, and the two sides raced on
the counters. Once `free` went negative, the unsigned check let the reader
fill forever (avail 22 MB in a 0x8a000 ring), overwriting data main had not
read yet. Fix: `ThreadManager.currentWin32ThreadId()` returns the running
slice/RPC thread's id, else 1.

Check it live: find BINK by `[640, 480, frames]` in the first three dwords,
then read dwords `0x53` (size), `0x56` (avail) and `0x5b` (free) of the
struct.

## Title music rebuilt its graph every frame: QUARTZ.VXD (2026-09-28, FIXED ae31f419)

Symptom: from about batch 3.9M, while `mw_logo.bik` still plays, the
software-D3D9 run creates a new DirectShow filter graph on almost every
frame until the guest heap runs out (OOM before the menu at 1024 MB). This is
not the track-end restart described above: the graph never runs at all.

Music code in Morrowind.exe:

| VA | what |
|---|---|
| `0x403630` | music update (entry; `find_fn.js` wrongly says `0x40367d`). Calls play at `0x403702` when `[esi+0x7c]` holds a path, clears it, then calls `0x4034a0` |
| `0x403250` | play: `CoCreateInstance(CLSID_FilterGraph, IID_IGraphBuilder)` at `0x40337a`, `RenderFile` (vtbl+0x34), QI IBasicAudio, flag = 1 |
| `0x4034a0` | QI IMediaControl (IID at `0x73d770`) and IMediaPosition (`0x73d750`), `put_CurrentPosition(0)`, `IMediaControl::Run` (vtbl+0x1c). Success lands on `0x403526` (flag = 2) |
| `0x4037ac` | IMediaEvent poll (`0x73d760`), gated on flag 2 |

Track: `Data Files/Music/Special/morrowind title.mp3`. Counting `0x403526`
is the one-number check: 0 means Run never succeeded.

Cause: Win98 quartz.dll (installed copy, origBase `0x35500000`) builds its
parser ring buffers through `\\.\QUARTZ.VXD`:

- `CreateFileA("\\.\QUARTZ.VXD", GENERIC_WRITE, share 2, OPEN_ALWAYS)`; the
  handle is global `0x355c9088`.
- `0x355c4029`: `DeviceIoControl(h, 1, &pages, 4, obj, 4)` returns a base
  whose `[base+N, base+2N)` is a second mapping of `[base, base+N)`.
  Refcount at `0x355da1cc`; failure gives `hr = 0x8007000e`.
- `0x35533363` / `0x355c3f9c`: ioctl 2 with `&base` frees it; the last
  reference closes the handle.
- The fallback when CreateFile fails (`0x35536014`, ring ctor
  `0x35535fb2(size, extra)`) is NT-style: `CreateFileMappingA` plus two
  `MapViewOfFileEx` at a fixed base. The Win98 section model (one address per
  section) refuses that, so the fallback cannot work here either.

The VFS created a plain file for that name, quartz trusted a VxD that was not
there, ioctl 1 failed, and every Pause/Run returned E_OUTOFMEMORY. Fix: the
VFS fails the whole `\\.\` namespace, and `09a0c` emulates the device. ioctl 1
reserves 2N, commits N and points the upper half's PTEs at the lower half's
backing. After the fix `0x403526` counts once per `0x403250`, about every
60K batches at `--tick-ms-per-batch=2`: that is the title track's own
114 s, so the track really ends and restarts.

### Next wall: the main menu binds an A4R4G4B4 texture (FIXED, same day)

Once the music graph runs, the software run reaches the main menu with a
black background. The host logs `invalid texture resource stage=0 kind=3
levels=1 lod=0 format=26` on every menu draw: D3DFMT_A4R4G4B4. The WAT create
gate had admitted 26 since B&W2 needed it, but `lib/d3d9-host.js` never
learned to sample it, so the whole draw was dropped. It now decodes 26
(nibble × 17); `test-d3d9-pipeline-web.js` draws one through the GPU path.

### Past the menu on software: intro, world, and `--sse` (2026-09-28, box 1)

Same frozen `--control` run shape as above (`--d3d9-renderer=software
--memory-mb=1024 --tick-ms-per-batch=2 --quiet-api --quiet-blocks`, six
ESC press/release pairs 100K batches apart to get through the logos).

- **Menu → New**: a DI click (`di-mousedown:1`, 60 batches, `di-mouseup:1`)
  on New at ~4.2M batches starts "Loading Interior", then `mw_intro.bik`.
- **mw_intro plays past frame 224** (the frame the Bink mutex bug froze on,
  82b4c4a5). Its BINK struct is `[640, 480, 1678 frames, FrameNum, ...]`;
  it advances ~50 frames per 200K batches and is wall-paced (400K batches
  took 17 s), so an ESC at ~5.69M skips it.
- **The world renders on the software D3D9 backend** by ~5.77M: the
  prison-ship hold, with the character-name box over it.
- **Open: the name box takes no input.** DI moves and clicks on its OK,
  `type`, and a raw `keypress` all left the frame byte-identical. That was
  measured while rendering had dropped to ~11 requests per 9K batches, so it
  may be the same "not polling while busy" B&W2 shows in its land picker
  (black-white-2.md), not a dead input path. Unverified.
- **A render-wait "stall" is unconfirmed.** Once, main sat on yield 16 with
  its request marked `done` across many steps, and a manual `clear_yield`
  released it. B&W2 later showed the same snapshot (one `done` request,
  yield 16), but wrapping `ctx.waitD3DRender` showed tokens advancing, about
  one per 17 batches, i.e. just slow. `test/run.js` now logs `[render] main
  parked on completed request` after 1000 checks (666c3e4e); trust that line,
  not a snapshot.

**`--sse` is neutral on boot.** Two fresh runs per arm, identical ESC
schedule, boot to batch 1,492,001 on a quiet box (load < 1): process CPU
**43 s in all four runs**, wall 82/45 s without and 58/39 s with. The wall
spread is present pacing (the headless Present gate is wall-clock 60 Hz),
not work. Gameplay, where SSE code paths would actually run, is unmeasured.

## Call-form census (2026-09-29, box 1, uop-tier-design §15.1)

`--handler-hist --handler-hist-thread=0,0,0 --edge-hist --uop-census`, analysed with
`tools/call-form-weighted.js`. We measured three windows:

- **mw1**: batches 6.1-6.3M.
- **mw2**: 5.0-5.8M, loading `morrowind.esm`.
- **mw3**: 13.0-13.4M. The chargen Name box is up over the software-D3D9
  world. That box takes no typed input on this path, so a free-roam window
  was not reached.

Box 1 needed symlinks `Morrowind.cue` and `Morrowind.iso` in
`~/tdef/test/binaries/candidates/morrowind/cd/` for the CD check.

Results for mw3, as % of all block entries:

- The uop tier covers 40.5-40.7%.
- Guest indirect transfers are 5.5%, spread over about 115 sites; 4.5% of the
  5.5% is at monomorphic sites.
- The top site is `exe+0x6f38d0 call [esp+0x2c]` at 0.67%. It has one target, a
  float interval-overlap callback.
- msvcrt `qsort` (`0x7801ed9a..0x7801ee6f`, 42 blocks) holds 3.9-4.0%. Its three
  `call [ebp+0x14]` sites split 1/3 each across the per-axis comparators
  `exe+0x6e9710`, `exe+0x6e9750` and `exe+0x6e9790`, which looks like
  sweep-and-prune. The comparator is fixed for each `qsort` call.
- Loops declined for `call-indirect`: the heads are 6.6% and the bodies (union
  of SCCs) 11.0-11.3%.
- `_ftol` and `_stricmp` are native overrides of the loaded msvcrt. The fixed
  tool now counts them as api. `jmp [abs] -> guest` is 0.00%.

The load window mw2 had 2.4-3.3% guest indirect, mostly
`exe+0x4d11c7 call [edx+0xe8]` (1.6%, monomorphic), and a declined loop at
`exe+0x4d11c3` with a 5.3% body.

## CRT exports (2026-09-29, docs/crt-native-overrides.md)

Morrowind imports the VC6 `msvcrt.dll`. `tools/crt-hot-exports.js` over the
census windows charges its CRT time as follows:

- **Load:** `sprintf` -> `_output` about 4.4%, `free` 0.78%, `strtok` 0.33%,
  `_strnicmp` 0.15%.
- **Frame:** `qsort` about 4%, almost all of it in the guest comparator
  callback, and `sprintf` -> `$I10_OUTPUT` about 1%.

None of that is a PURE export. `sprintf` needs a byte-exact `_output`, `qsort`
calls back into the guest, and `free`/`strtok` own CRT state. So the
wide-string and `floor` overrides added for UT do not move Morrowind.

The older `_stricmp` override that Morrowind does use does not check the
locale. It is exact only while the app stays in the "C" locale. That holds
for `Morrowind.exe`: its msvcrt imports include `_stricmp` but no `setlocale`
(`tools/pe-imports.js --all --dll=msvcrt.dll`). A DLL it loads could still
change the locale, and that path was not checked.

## 2026-10-05: ordinary browser title reached; input qualification pending

A headful, audio-enabled ordinary run on tested module
`2638e876e6002d0e34cf7acba3d85ddbabb02069f559695f28fe6bad4620eb95`
(source implementation `6604fb90`, subsequently integrated on main) reached the
Bethesda movie and Morrowind title. The registered running instance exposed an
actual 2,147,483,648-byte memory and owning guest Worker; presentation used WebGL.
These are observed values, not an inference from the registry's `bigMemory` flag.

The first harness attempt denied the required shared `msvcp60`, `msvcrt` and
`comctl32` DLL URLs, then trapped at `0x4012e0`. That was an invalid reproduction,
not evidence for an emulator fix. The corrected attempt loaded all four seeded/
required DLLs including Bink and reached the title. A reviewed Bethesda movie
received Escape for 200 ms. Later captures alternated between the rendered title
and black frames; the run did not establish their cause.

One normal pointer move/click requested `(319,247)` over New, then a separately
reviewed 200 ms Enter did not leave the title. The pictured game cursor was near
`(616,471)` within a 640×480 title drawn into a 1024×768 page. This is not enough to
prove a viewport mapping bug: `lib/browser-input.js` maps CSS to logical canvas,
`renderer-input.js` applies the exclusive presentation mapping, and
`handleMouseMove` also accumulates relative DirectInput deltas per input memory.
A game-owned cursor can therefore differ from the browser click position. The
next ordinary route needs actual canvas/client/exclusive viewport and lock state
alongside before/after cursor captures, rather than another guessed click or a
forced guest cursor/text write. No character-generation or gameplay was reached.

The runtime COM search also made HTTP probes for `quartz.dll`, `devenum.dll`, and
`l3codecx.ax` under `binaries/dlls`, `binaries/plugins`, and `dlls`. Although the
strict harness mistakenly returned 403, all three subsequently loaded via the
existing app VFS fallback at `0x7ece0000`, `0x7ecb0000`, and `0x7ec90000`.
Thus these probes do not establish missing filters or failed music initialization.
The normal search order must remain intact: absent shared copies should return
404, not be replaced with invented shared aliases to app-local copies.

Prepared harness parity now inventories finite native names from the frozen DLL
registry plus the declared native images/imports: 60 names, 22 present exact
search paths, and 218 explicitly absent probes. Present bytes are hash-pinned;
normal negative probes receive recorded 404s without poisoning the run, while
unlisted paths remain refused. Native COM and LoadLibrary search paths and the
VFS fallback remain the emulator's original behavior. Runtime closure is not a
claim that all possible dynamic names have been observed.

Local evidence: `scratch/new-game-morrowind-20261005/attempt2`, its
`attempt2-classification.json`, and `runtime-dependency-closure.json`. Session
63255 closed browser/server at 15:34:22.353 UTC with browser exit 0 and no pending
streams; driver exit 1 retains the harness's negative-probe errors. No FPS, audio
quality, or gameplay qualification is claimed. The subsequent helper is prepared
only; it has not been run.

### 2026-10-05 follow-up: relative motion reaches the title, button result unresolved

Attempt6 kept the original1024×768 browser connection and tested module2638.
After a first ordinary16,16 move seeded the per-memory DirectInput point, a
second ordinary+16,0 move completed. The title snapshots differ in exactly417
pixels, bounded by `[320,242,352,263]`; root independently obtained the same
result. This supports a narrow cursor/hover response, not gameplay or an absolute
browser-to-game scaling factor. The game-owned pointer/hover pixels overlap New
and the title logo, so exact target identification remains uncertain.

Read-only getters on the actual owning Worker reported cursor425728,
display count0, and focusHWND65537. Browser state showed CSS cursor`default`,
focused CANVAS, matching keyboard owner, visible Morrowind640×480 at0,0 and an
invisible ActiveMovie window. Exclusive transforms were null. A missing pointer
in a browser screenshot alone was therefore an overly strict harness gate;
these observations do not prove missing guest input.

One ordinary button hold258ms at the unchanged browser point32,16 followed the
relative movement. The title remained after a3second settle. No Name prompt or
gameplay was reached. A later Enter command arrived after the absolute300second
session deadline and was not delivered. Browser/server closed16:51:12.833UTC,
errors empty, Chrome exit0; driver exit2 denotes the deadline.

The frozen source provides two distinct button paths. In
`lib/renderer-input.js:1532`, down updates the host button mask and queues a
DirectInput edge before normal WM routing. Up clears that mask and queues its
edge. `src/09a8-handlers-directx.wat:9447` GetDeviceState samples
`host_get_mouse_buttons`; `lib/host-window.js:1131` returns the current renderer
mask. Buffered GetDeviceData consumes the separate edge ring. A short hold can
only be observed by GetDeviceState if the guest polls during it. Neither the
saved screenshots nor host input receipt establish that polling happened, or
that New's exact hit region contained the interpreted pointer. Do not diagnose
WM coordinate mapping from this alone.

The next useful evidence is a bounded passive observation of actual owning
GetDeviceState/GetDeviceData mouse polls and ordinary button down/up, preserving
original receivers/results and recording callback timing and selected device.
A separately reviewed ordinary longer hold can then test missed polling if
needed; no guest button injection, cursor setter, or guessed scaling belongs in
that experiment. No identical seed-only launch is proposed.

Local immutable evidence: `scratch/new-game-morrowind-20261005/attempt6`, including
`cursor-diff.json`, read-only state snapshots, `pointer-receipts.json`, and
`cleanup.json`. Earlier attempt3 secondary-connection viewport change and
attempt5 human-review phase timeout remain harness failures, not game failures.


## 2026-10-05 — ordinary New click reaches prison Name prompt

The generic DirectInput live-button repair is integrated as main `520d1cde` (source `94d18605`). It separates physical mouse buttons from queued Win32 message snapshots while preserving message and OLE consumers. Its real-WAT before-control failed the new physical-button assertion; the candidate, full production/shake build, CLI mouse control and renderer message-mask regressions passed.

Ordinary browser attempt9 used module `2e2fd8d1ca62cd87f0bc09312bc4836108df610d00cb7771bb5ae22755eceedc`. The original Puppeteer connection seeded (16,16), then moved to (32,16). A reviewed New-target click held the button for 1500 ms and released it normally. The passive host census recorded the actual canvas recipient at page (32,16), then live mask 1. Four retained physical reads returned 0x8000 while the active WM_MOUSEMOVE snapshot still held button mask 0. All 62 retained completed GetDeviceState outputs inside the resolved-down/requested-up interval contained left-button byte 0x80; attempt8's corresponding outputs were zero. This supports the repaired state-selection path, without confusing browser coordinates with the independently observed game cursor.

The click advanced to the red opening movie and then the prison Name dialog, personally reviewed by the coordinator. An Escape intended for the movie arrived after the prison loaded and opened its pause menu; a separately reviewed second Escape returned to the Name prompt. Ordinary typing of Codex completed, but its screenshot raced the original 300-second deadline. Name submission, free movement, gameplay qualification, audio quality and FPS remain unproven.

Local evidence: `scratch/new-game-morrowind-20261005/attempt9/analysis.json`, `host-button-census.json`, `button-observer.json`, `pointer-receipts.json`, `settled.png`, `return-prison.png` and `prison-wait.png`. The host census closed with 73 records and no observer errors. Worker coverage is main-instance only and its 128-record cap overflowed, so the unrecorded tail is unknown. Session 33855 ended at the original deadline, browser/server closed at 17:57:32.462 UTC, Chrome exited 0 and no processes remained; driver exit 2 and the screenshot TargetClose error are retained. The next ordinary route gets a predeclared 600-second total budget for Name/OK and actual player control, without repeating button diagnosis.


## 2026-10-05 — reviewed first-person movement after Name

Ordinary continuation attempt10 used the exact built source `94d18605` and module `2e2fd8d1ca62cd87f0bc09312bc4836108df610d00cb7771bb5ae22755eceedc`, including the generic live DirectInput button repair integrated as main `520d1cde`. No private Worker, API census, instruction trace or guest-state writes were used. The original browser connection clicked New, skipped the opening movie with Space, visibly entered a Name and clicked OK. Requested text Codex rendered as cox; that partial name was accepted normally and the typing limitation remains unresolved.

After the tutorial popup was dismissed with Enter, ordinary W was held from18:22:36.945 to18:22:38.150 UTC (requested1200ms); the camera advanced toward the corridor and the left NPC left view. S from18:22:58.855 to18:23:00.068 reversed movement, restoring the left NPC and wider doorway. A1500ms idle observation retained the camera geometry while NPCs animated. Root personally reviewed all movement frames and input receipts and accepted narrow first-person player control inside the prison ship. This is gameplay evidence beyond the Name form, not proof of complete character generation, quests, audio quality or FPS.

Immutable run: `scratch/runs/20261005-morrowind-prison-movement/result.json`, with four reviewed gameplay images, exact inputs, root review, served-response receipts, frozen source closure and SHA256 artifact manifest. Actual registered memory was2GiB with Worker/WebGL backend; rendered scene640x480 inside1024x768 browser viewport. Session78331 exited0 on ordinary quit before its original600-second deadline. Browser/server closed18:23:55.881 UTC, no cleanup errors, no pending streams, Chrome exited0 and owning processes were absent. Remaining work includes typing fidelity, later game progression and a separately justified gameplay performance counter.

## 2026-10-27 — bounded ordinary-name production input checkpoint

Follow-up original-consumer evidence (2026-10-28):
[Name buffered-keyboard consumer and targeted observation plan](morrowind-name-consumer-20261028.md).
The original executable statically connects NameSpace to DirectInput
`GetDeviceData`, requesting one 20-byte record, and to edit callback `0x638050`.
The first unobserved boundary is its actual API completion at `0x406926`;
matching scan translation and before/after text writes discriminate lost edges
from edit rejection or later overwrite. This is static evidence only: no
transport replay, original guest run or production input repair was performed.

Source `be0eb25fc33f3b057847d6c4e2c4fe5a6a9a426c` did **not** reproduce
the documented Codex → cox loss at the portable browser/renderer/Worker
boundary. `test/test-morrowind-ordered-name-input.js` executes unchanged
`browser-input.js` listeners, the real `Win98Renderer`, complete `host.js`
input closures and its exact input-publisher initializer, and production
`guest-rpc.js` on a real Node OS Worker. DOM objects and the guest-side
consumer are fixtures: no browser, game, compiled guest or gameplay was run.
The consumer records message IDs, full wParam/lParam and destination HWND,
rather than treating concatenated characters as proof of delivery.

Rapid Codex (including physical left Shift for C), explicitly paced delivery
with polls during held keys, and one-event-per-Worker-command draining all
preserved the complete 17-message sequence and five WM_CHAR values. A caller
focus change between commands changed the resolved HWND without losing an
event. Repeat metadata, separate left/right Shift state, an ArrowLeft press,
and browser-blur releases passed. Omitting d from the input produced a
rejected expected-Codex comparison at message index 8, the first differing
keydown. No production event was omitted in the positive cases.

Live `get_key_down_state` samples during held keys returned down; samples
after all releases returned up, even with the character messages still
queued intact. This is a state-sampling distinction, not a reproduced
WM_CHAR failure. The current WAT `di_kbd_collect` compares sampled live
states with previous states, rather than consuming the Win32 character
queue. Its behavior was inspected, not executed here; this checkpoint does
not establish that Morrowind's Name control uses that API, nor that the
Airstrike buffered-key repair diagnoses Morrowind. No ring, filter,
device-lifecycle, modifier or input-path source semantics were changed.

Validation: the new production-boundary probe,
`test/test-browser-worker-input-focus.js`, and
`test/test-keyboard-message-lparam.js` passed under Node v24.18.1 with
`--max-old-space-size=320`, supervised RSS 512 MiB, CPU 90 s, wall 120 s,
file 24 MiB and combined output 2 MiB limits. Git alone received its DATA
limit; Node DATA/AS remained unlimited. The first probe attempt failed on a
test-only generated-signature envelope lookup (`.sigs`); its stderr and
cleanup receipt remain retained. The corrected probe then passed, followed
by the physical-Shift refinement and affected regression checks.

No causal repair or independent game acceptance is justified by this result.
The remaining name-fidelity gate needs a separately authorized observation
of the actual Morrowind Name consumer on a pinned production module: which
WM_CHAR/GetDeviceState/GetDeviceData calls it uses, the ordinary DOM events
and queue/poll schedule, and the first missing consumer observation. The
historical `94d18605` run remains an observation, not a cause or a fresh
before-control; it was not rerun. Existing gameplay qualification above is
unchanged. No full build, guest/browser execution, Boat, main integration,
controls change or game binary patch was performed.

Canonical evidence/publication/cleanup receipt:
`scratch/usage-watch/morrowind-ordered-name-input-oct27/receipt.json`;
the same directory's `evidence.tar.gz` retains operation-specific admission,
stdout/stderr and supervisor results, including the initial harness failure.
Original evidence: `/tmp/morrowind-ordered-name-input-oct27/ops/`.
