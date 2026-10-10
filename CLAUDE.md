# Wine-Assembly

x86 Windows 98 PE interpreter in raw WebAssembly Text (WAT). Runs real Win32 executables in the browser via a Forth-style threaded code x86 emulator.

## Build

```bash
bash tools/build.sh
```

Compiles the `(include ...)` closure rooted at **`src/main.watx`** with the vendored WATX compiler (`tools/build-compile-wat.js`) into `build/wine-assembly.wasm` — **`wat2wasm` is not used**. `build/combined.wat` is written from the same include list for grep/`check-parens`/`func-index` and is not itself compiled.

**Dispatch is a macro, and every handler ends in `(dispatch-next)`, never `(return_call $next)`.** `src/04-cache.wat` defines `(defmacro (dispatch-next) …)` holding the dispatch step, and `$next` is that macro under a name for the non-tail callers. Each of the 419 sites in 384 functions expands its own copy, so each handler owns a `return_call_indirect` — +32 KB of wasm, **−4.86% gameplay CPU** on StarCraft (null band 1.13%) and −4.37% on Heroes II (band 3.06%) on the quiet box; the branch-miss rate did not move, the win is the deleted call, frame setup and stack check per dispatch. A function that expands the macro must declare `(local $nx_fn i32) (local $nx_op i32)`; the compiler refuses an undeclared local, and `test/test-dispatch-macro.js` refuses a stray `(return_call $next)`. The macro body is several forms with no wrapper: the vendored compiler used to emit **nothing** for a multi-form macro expanded inside a function body (the module validated and ran zero ops), fixed and sealed 2026-09-19 with `test/watx-compiler-macro-body.test.js`, which *calls* such a module rather than only building it. To A/B against the old shape, make the macro body `(return_call $next)` and give `$next` the body back.

**`src/main.watx` is the build, and it is the only place the source order is written down.** To add or reorder a part, edit its `(include "NN-name.wat")` list — nothing else. `lib/wat-manifest.js` parses that list, and every Node consumer (including `WAT_FILES` re-exported from `lib/compile-wat.js`, which is now a getter, not an array) reads it from there; the browser's `lib/watx-launcher.js` fetches `main.watx` and parses it itself. There is no second list to mirror.

An `(include ...)` naming a file that does not exist is a **hard compile error** from the include resolver. The reverse is the case a compiler cannot see — a `src/*.wat` that no `(include ...)` names is simply not part of the program, so it lands in `combined.wat` and is silently absent from the shipped wasm. That, plus filename (`LC_ALL=C`) order, is what `tools/check-wat-manifest.js` (run first in the build) still exists to catch.

Build gates, in order: manifest ↔ glob equality, per-fragment paren balance, memory-map overlaps, region declarations vs the globals the code reads, the raw-address-literal ratchet, JS region-map mirror freshness, no JS copy of an allocated base, no bare address in a JS-embedded WAT fragment, every shake mode still places, WAT↔JS RPC/DIB and shared-constant consistency, complete test-tier membership, `api_table.json` (id == index, append-only), generated dispatch table freshness, API hash table, ordinal data-string offsets, handler-table count, handler ESP cleanup, logical-`i32.and` operands, silent-success stubs, Worker import signatures, browser cache-version graph agreement, toy-VM browser-bundle reproducibility, generated stdcall epilogues, vendored-compiler provenance (SHA-256 + sealed CHANGELOG), nine struct-layout migration gates plus the `GdiObject` variant gate and the FROZEN layout-offset freeze, `combined.wat` paren/label checks, the WATX compile, and compiled data-segment overlaps.

Note "memory-map overlaps" is now a check over a map the **compiler allocates**, not a fixed one — see the Memory Layout section — and the five region gates around it exist because a moved base is silent in JS.

**Important:** When adding new handler opcodes to `02-thread-table.wat`, increase `(table $handlers N funcref)` to match the total entry count (0-based index + 1).

## Memory Layout

512 MB WASM linear memory — `(import "host" "memory" (memory 8192 32768 shared))`, and the **region map** runs to `0x20000000` exactly, with nothing above it.

The import's maximum is 32768 pages, but **nothing grows at runtime**: `host.js` creates the memory with `initial === maximum`, so it is a fixed size chosen once at launch. Every app gets 8192 pages (512 MB); an app that has been *measured* to exhaust the 288 MB sparse backing pool may set `bigMemory: true` in `lib/apps.js` to be created larger instead, and everything above `0x20000000` becomes `$VIRTUAL_BACKING_EXT`, the second sparse backing window. **32768 is the last safe maximum**, not an arbitrary one: `$virtual_backing_ext_end` is `(i32.shl (memory.size) 16)`, which reads correctly at 2 GB and 3 GB because every comparison it feeds is unsigned, and wraps to 0 — silently reporting "no extension window" — at exactly 65536 pages. That window is deliberately **not** a region — a region has to fit inside the import's initial memory, and this one only exists on a host that chose the larger size — which is why `region-layout.js` still reports the map ending at `0x20000000`. Code asks `memory.size`, never the declaration, before touching a byte up there. Black & White 2 is currently the only app in the registry that opts in; a device that cannot spare the pages falls back to 512 MB with a warning rather than failing to launch.

So "512 MB" is still the right number for every app but one, and the ceiling is a per-app launch decision, not something a long-running app drifts into. To check what a browser run actually holds, and whether it is growing, use `tools/memory-series.js` — it reports the wasm size and the JS heap as separate series precisely so guest-arena size is never mistaken for a JS leak.

**Most region bases are the ALLOCATOR's output and are not written down anywhere.** `src/00-regions.wat` declares 174 regions; 166 are `region.declare`, which states a *size* and lets the compiler place it. So a base moves whenever any earlier region changes size or a new one is added, and a hex address copied into a note, a comment or a JS file is wrong at the next edit with nothing to say so — `tools/region-census.js --js-copies` is a hard build gate for exactly that. **Do not read a base out of this file. Run `node tools/region-layout.js`**, which asks the compiler where things actually landed, or read `lib/region-map.generated.js`, the one mirror every host loads.

What *is* durable is the handful of addresses that are an ABI rather than a placement — these are the ones pinned in the declarations and the only ones safe to quote:

| Base | Region | Why it cannot move |
|---|---|---|
| `0x00012000` | GUEST_BASE (60 MB) | what every `g2w` resolves through |
| `0x03D12000` | GUEST_HEAP_BASE (~3.9 MB) | derived, `g2w 0x04100000` |
| `0x07012000` | GUEST_STACK (1 MB) | derived, `g2w 0x07400000` |
| `0x07112000` | THUNK_BASE (256 KB) | derived, `g2w 0x07500000` |
| `0x08000000` | VIRTUAL_BACKING_BASE (288 MB) | sparse `VirtualAlloc` backing window |
| `0x1A000000` | THREAD_CACHE_BASE (~26 MB) | decoded-code cache, carved from the pool's tail to free the direct window |
| `0x1BC00000` | GUEST_PAGE_TABLE (4 MB) | one packed PTE per 4KB guest page |
| `0x1C000000` | DIB_BACKING_BASE (63 MB) | backing window |
| `0x1FF00000` | THREAD_RPC (1 MB) | backing window |

Plus one span, `$DIRECT_WINDOW` `0x0`–`0x08000000`: a transparent named limit, not a region, and the range `$g2w`'s fast path covers. Inside it, four derived `$GUEST_FIXED_POOL_*` holes at `g2w 0x04000000/0x05000000/0x06000000/0x08000000` are guest memory a program may reserve at exactly those addresses (Crusaders of Might and Magic's level files point into them); they are why the thread cache moved out.

The PE loads at its preferred `image_base` (typically `0x400000`). `g2w(guest) = guest - image_base + GUEST_BASE` is now the **direct-window case only** — when that result falls outside `$DIRECT_WINDOW`, `$g2w` tries the DIB range (guest `0x50000000`, backed by DIB_BACKING_BASE) and then the selected sparse translator: the experimental flat page table or the record-walked affine map backed by VIRTUAL_BACKING_BASE. A miss returns the NULL sentinel at `0xF0`; packed-mode misses are authoritative and never fall through to the record walk.

Two things that used to be in this list and are gone: **CACHE_INDEX no longer exists as a region at all**, and the threaded-code cache is `$THREAD_CACHE_BASE`, pinned above the direct window (main's 15 MB plus fifteen worker partitions) — `$THREAD_BASE` survives only as a per-thread cursor global, so the cache size is a partition limit, never a separate region.

See [docs/memory-map.md](docs/memory-map.md) for the full annotated layout, comparison with Windows 98 kernel/user memory model, and analysis of what's emulator-private vs guest-accessible; [docs/watx-region-safety-design.md](docs/watx-region-safety-design.md) for why the map is allocated rather than hand-placed.

## Message / Event Handling

GetMessageA in `09a5-handlers-window.wat` delivers messages in a priority-based phased sequence:

1. **WM_QUIT** — if `$quit_flag` is set
2. **Pending child WM_CREATE** — queued during CreateWindowExA for child controls
3. **Pending child WM_SIZE** — follows child WM_CREATE
4. **Post queue** (`$post_queue_count`, per-thread `$LOCAL_POST_QUEUES` partition) — drained FIFO, 64 slots of {hwnd, msg, wParam, lParam} 16-byte entries per thread. PostMessageA and TranslateAcceleratorA write here. Host diagnostics use the exported queue base, not a fixed address.
5. **Pending main WM_SIZE** (`$pending_wm_size`) — set by CreateWindowExA, consumed after post queue drain
6. **Startup phases** — sequential one-shot messages: WM_ACTIVATEAPP → WM_ACTIVATE → WM_SETFOCUS → WM_ERASEBKGND
7. **Host input poll** — `$host_check_input()` returns packed `(wParam<<16)|(msg&0xFFFF)`, with hwnd/lParam via separate imports
8. **WM_PAINT** — if `$paint_pending` is set for main window
9. **Paint queue** — per-child-hwnd paint queue (`$paint_queue_pop`)
10. **Timers** — `$timer_table` walk, delivers WM_TIMER
11. **WM_NULL** (idle) — returned when nothing is pending

**ShowWindow** delivers WM_SIZE synchronously by redirecting EIP to the wndproc (not via the message queue). This happens inside `$handle_ShowWindow` when the target is `$main_hwnd` and `$pending_wm_size` is non-zero.

**SendMessageA** (`$handle_SendMessageA`) dispatches synchronously: pushes wndproc args on the guest stack, sets EIP to the target wndproc, and uses a CACA0005 continuation thunk to resume the caller when the wndproc returns.

**UpdateWindow** consumes existing damage without creating or expanding it; a clean window sends no paint. `$update_window_prepare` owns common damage checks and visible unsubclassed native-control painting. Win32 `$update_window_now` sends WM_PAINT through `$wnd_send_message`; BeginPaint sends any pending WM_ERASEBKGND with the clipped paint DC and derives fErase from the callback result. Nested sends and guest subclasses preserve the outer guest context. Win16 `$win16_update_window_start` uses an invocation-owned guest-stack continuation for synchronous far WM_PAINT; its BeginPaint adapter owns a separate stack-resident canonical PAINTSTRUCT and far WM_ERASEBKGND continuation, interpreting the full DX:AX result. Both are used by their MoveWindow(TRUE) completion, after position notifications. BeginPaint snapshots and validates consumed damage before callbacks; EndPaint releases its DC without discarding newer invalidations. The sender does not erase an unhandled update. A subclass may replace painting or chain through CallWindowProc to the native painter. This ordering prevents later deferred paint from overwriting work the app draws immediately after the call (Taipei's splash screen). Special native tab/status-bar paint interceptors remain separate exceptions. `test-parent-child-paint-order.js` covers Win32/native/subclass painting; `test-win16-windowpos-defproc.js` covers real far callbacks, partial BeginPaint regions, nested UpdateWindow and positioning, target destruction, and stack restoration.

**Input injection (test harness):** `test/run.js` supports `--input=BATCH:ACTION:ARGS,...` for keydown/keyup/keypress/click/dblclick/post-cmd/png and more. `BATCH:dump-mem:0xADDR[:LEN]` hexdumps guest memory *at that batch* — reach for it instead of `--dump=`, which only fires at exit, by which time a scratch buffer has usually been freed and reissued and its contents are a picture of whatever moved in afterwards (that reads convincingly as corruption). Output format matches `--dump`, so `tools/dump2png.js` parses either. The renderer's `inputQueue` feeds into `check_input()`. See lines 82-159 in run.js for the full list.

## Key Concepts

- **Threaded code:** x86 is decoded into a sequence of (opcode, operand) pairs stored in the thread cache. The `$next` function advances the thread pointer and dispatches via indirect call through the handler table.
- **Lazy flags:** Flags (ZF, SF, CF, OF) are not computed after every instruction. Instead, `flag_op`, `flag_a`, `flag_b`, `flag_res` are stored, and flags are computed on demand by `$get_zf`, `$get_cf`, etc. `flag_sign_shift` is 31 for 32-bit ops, 15 for 16-bit, 7 for 8-bit.
- **g2w / w2g:** Convert between guest (x86) addresses and WASM linear memory addresses. `g2w(guest) = guest - image_base + GUEST_BASE`.
- **API thunks:** Imported Win32 functions are replaced with thunk addresses. When EIP enters the thunk zone, `$win32_dispatch` handles the call.
- **Dispatch handlers:** Each Win32 API has a `$handle_{Name}` function in the appropriate `09a*.wat` subsystem fragment with signature `(param $arg0-4 i32) (param $name_ptr i32)`. The generated `09b2-dispatch-table.generated.wat` contains the br_table that calls these. To add a new API: **append** it to the end of `api_table.json` (ids are array positions and are baked into the compiled hash table — a mid-array insert renumbers everything and `tools/check-api-table.js` fails the build), write `$handle_{Name}` in the appropriate subsystem fragment, then run **both** `node tools/gen_dispatch.js` and `node tools/gen_api_table.js` — the second regenerates the name→id hash table, and skipping it leaves the new API unfindable at runtime with no crash to point at it.
- **Fail-fast stubs:** Unimplemented API handlers call `$crash_unimplemented` which traps with `unreachable`. Do NOT replace these with silent stubs that return 0 — silent stubs hide bugs and make them much harder to debug. When an app hits an unimplemented API, the crash log tells you exactly what to implement next. Implement the real behavior or leave the crash.
- **WAT logical operands:** Normalize raw pointers, handles, counts, and other arbitrary integers before combining them with logical `i32.and`: use `(i32.ne value (i32.const 0))` or `i32.eqz`. A raw even value AND a `0/1` predicate has a clear low bit and silently evaluates false. Raw operands are appropriate only when `i32.and` intentionally performs a bit mask; boolean operands should each be explicitly `0/1`.
- **Yield mechanism:** For async operations (DLL loading, help file fetching), WASM sets `$yield_reason` and returns control to JS. The JS event loop handles the async work, clears the yield, and resumes WASM. Yield reasons: 1=waiting, 2=exited, 3=com_load_dll, 4=help_load.
- **WAT-native windows:** Windows with wndproc `0xFFFF0001` are handled entirely in WAT (e.g., help window). `$wat_wndproc_dispatch` routes messages to the appropriate WAT wndproc.

## Tools

### Dashboard evidence: file convention

When investigating EXE compatibility or changing visible behavior, read
[`ops/README.md` — Agent capture workflow](ops/README.md#agent-capture-workflow).
Save relevant before/after captures and logs in distinct
`scratch/runs/<unique-id>/` folders using the documented `result.json` format.
Use existing test/capture tools; no special capture command is required.
Write artifacts first and publish `result.json` last. Record the actual tested
build, route, and environment; keep unknown values explicit. Inspect evidence
before marking it reviewed, and do not equate a screenshot with playability.
Reference run IDs in task/investigation notes and your messageboard update.

### Optimization variants: native disassembly required

For every new interpreter/JIT optimization variant, including stacked variants,
inspect the generated native disassembly from **both V8 and SpiderMonkey**
alongside benchmarks. Compare against the matching control, and inspect both
the laptop ARM64 and remote x86-64 code when measuring those architectures.
Record module hashes, engine versions, compilation tier and capture commands.
Use `tools/wasm-native.js` and the existing native-capture helpers. Check hot
dispatch paths, register allocation, spills, FP state access and memory-helper
calls before choosing the next optimization. Static disassembly shows code
structure; use profiles to establish where time is spent. Explicitly report
missing captures or engine/tier mismatches; do not treat an older variant's
disassembly as evidence for a new one.

### Shared-agent message board

- Use the repository-root `messageboard.txt` to coordinate with other agents sharing the worktree.
- The file is gitignored and strictly append-only: never rewrite, truncate, or
  context-edit existing entries. `messageboard.txt` is the exception to the
  repository's normal `apply_patch` editing workflow—never use `apply_patch`
  on it. Add every update as a new final line with `echo ... >>
  messageboard.txt`; if an earlier entry is wrong, append a dated `CORRECTION`
  entry instead of changing the original text.
- A context patch anchored to the last line you previously read is still a
  middle edit: another agent can append between that read and the patch, and
  may never see the inserted entry while following the tail. Open the board
  with `>>` for each update so the write targets the actual EOF at write time,
  then immediately run `tail` to verify that the entry is visible at the end.
- Before staging, committing, or editing files another agent may own, read recent entries and start a background watcher:

  ```sh
  tail -n 40 messageboard.txt
  tail -f messageboard.txt &
  ```

- Append dated ownership, overlap, release, and commit notes with `echo` and
  the append redirect. Never use a single `>` redirect or any editor/patching
  tool on the board, and never replace another agent's entries:

  ```sh
  echo "$(date -Iseconds) <agent> <status and files/commit>" >> messageboard.txt
  ```

## Test Binaries

Win98/XP executables in `test/binaries/`. Currently tested:

- **Win98 accessories:** notepad.exe, calc.exe, mspaint.exe
- **Entertainment Pack:** SkiFree (ski32.exe), FreeCell, Solitaire, Minesweeper, Reversi, Golf, Pegged, Rattler Race, Taipei, TicTactics
- **NT/XP:** mspaint.exe (NT version, requires msvcrt.dll + mfc42u.dll from `test/binaries/dlls/`), winmine.exe (XP)
- **Other:** Space Cadet Pinball, Winamp extracted app, Winamp 2.91/2.95 NSIS installers
- **Help files:** `test/binaries/help/` — .hlp files for notepad, calc, freecell, solitaire, mspaint

### Reverse-engineering notes

[docs/re-notes/](docs/re-notes/README.md) — one file per guest binary we have dug into: module load bases and the runtime↔original VA arithmetic, asset/container layout, the app's real API profile, every function entry already identified, headless commands that reach a given screen, and the hypotheses already ruled out. **Read the app's file before starting an investigation on it, and add what you learn when you finish one** — otherwise the same disassembly gets redone every session.

## Run and most-used flags / tools

Open `index.html`, select an app and click Launch; CLI: `node test/run.js --app=sol --quiet-api --max-seconds=30`. Prefer registered app IDs for complete file manifests. Use the CLI's own wall-clock guard; see the full run instructions below.

- `--quiet-api`: suppress unconditional API lines; explicit tracing remains available.
- `--max-seconds=N`: bound wall time; `--max-batches=N` bounds batches.
- `--batch-size=N`: block budget; raise it before diagnosing frozen timed animation.
- `--tick-ms-per-batch=N`: headless guest clock; calendar and zone default to pinned date / UTC.
- `--trace-api[=Names]`, `--trace-from=N --trace-to=N`: bounded API investigation.
- `--trace-ctrl` / `--trace-input`: wrong pixels / swallowed clicks.
- `--trace-sched` / `--trace-thread`: thread progress; read held critical sections first on hangs.
- `--trace-host=Names`: wrap imports when no category fits.
- `--break=ADDR`, `--break-api=Name`, `--watch=ADDR`: stop at the cause.
- `--count=ADDR`, `--input=B:dump-mem:ADDR:LEN`: full-speed hits / live memory.
- `node tools/region-layout.js`: actual allocated bases; never copy movable addresses.
- `node tools/disasm_fn.js EXE ADDR` / `node tools/xrefs.js EXE ADDR`: disassembly / references.
- `node tools/func-index.js N` / `node tools/dump2png.js LOG --width=N`: name WASM functions / inspect pixels.

**Before adding a console.log to source, check built-in tracing first.** Extend the appropriate runtime tracing wrapper when a primitive is missing; source must stay clean between sessions.

## Detailed references

- [CLI run instructions](docs/cli-run.md): manifests, clocks, calendar/time zone, block budgets, threads and child processes.
- [Tracing](docs/tracing.md): full flag table and how to extend runtime categories.
- [Browser performance and iPhone diagnostics](docs/browser-perf.md): HUD metrics, streaming, evidence limits and real-device tools.
- [Source Parts](docs/source-parts.md): WAT include-order table.
- [JS libraries and rendering surfaces](docs/js-libraries.md): library table and required single back-canvas routing.
- [Tools catalog](docs/tools.md): complete commands, measurement policies and examples.

Keep this entry point concise (target ≤25 KB). Add details to docs/; the build fails above 32768 bytes.
