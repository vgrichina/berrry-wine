# Serious Sam: The First Encounter — demo (`serious_sam_demo`)

Croteam, 2001, OpenGL. Registered as `serious_sam_demo` (4cbde5326); candidate
`serious-sam-demo` in `test/candidate-corpus/manifest.json` (archive.org
`SeriousSamDemo.exe`, Disk1 mounted at `C:\`). Reaches player-controlled
gameplay on main with the winmm timer thread on.

An untracked, migration-era `docs/re-notes/serious-sam.md` in the main checkout
recorded private-build experiments (some superseded, some wrong). This file is
the current state; the claims it corrects are listed under "Ruled out / stale".

## Running it

Boat only: the ops box's memory reaper killed local runs, and OpenGL needs
`--headless-gl` (`@node-3d/webgl` + `@node-3d/glfw`, Xorg `:0`).

```sh
DISPLAY=:0 node test/run.js --app=serious_sam_demo --no-build --quiet-api --quiet-blocks \
  --no-close --stuck-after=0 --batch-size=10000 --tick-ms-per-batch=1 --headless-gl \
  --max-batches=73000 --input=...
```

Route (1 ms of guest time per batch; ~60 batches/s while rendering, ~1800 while
loading):

| batch | input | effect |
|---|---|---|
| ~2000 | — | first-run "Information" MessageBox |
| 4000 | Enter (keydown 13) | dismisses it |
| ~20000 | — | intro (Godgames logo, `Levels\Intro.wld`) |
| 21000 / 23000 / 25000 / 27000 | Enter | skip intro, SINGLE PLAYER, NEW GAME, NORMAL |
| ~60000 | — | NETRICSA briefing "Thebes - Karnak" |
| 62000 | mousedown/up at (585,19) | NETRICSA **Exit** button — Escape keydown does *not* close it (keyboard focus is window 0x10008) |
| 64000 | — | Karnak temple room, revolver, health 100 |
| hold W | — | walks through the door into the courtyard; an enemy runs in |

No console setting is needed (see hooks below). Evidence:
`scratch/runs/20261011T0545Z-serious-sam-noconsole-w6` (default input),
`scratch/runs/20261011T0400Z-serious-sam-levelload-w6` (first gameplay).

## Module bases (seeded order Engine, Game, Entities)

| module | runtime base | original base |
|---|---|---|
| Engine.dll | 0x574000 | 0x600c0000 |
| Game.dll | 0x811000 | 0x604a0000 |
| Entities.dll | 0x93f000 | 0x60280000 |
| msvcrt.dll | 0xbee000 | 0x78000000 |

Engine runtime = original − 0x600c0000 + 0x574000. Engine exports its C++
methods by mangled name (`tools/pe-exports.js`), which names most addresses
below.

## Identified functions (Engine originals unless noted)

- `CTStream::ExceptionFilter` 0x600d92d0: filter for EXCEPTION_ACCESS_VIOLATION;
  reads ExceptionInformation[1] (address) and [0] (read=0 → `bReadAccess`),
  finds the stream through FS:[0x2c][Engine `_tls_index`] → block+0xc stream
  list, calls the stream's commit-page virtual. Streams are a two-page window
  over a reservation: on a fault at page p it decommits what it holds and
  commits p and p+1, loading them (inflating, for GRO members) inside the filter.
- Entity load loop 0x6015f794 (`call [edx+0xc]`, progress = i/count →
  "LOADING ENTITIES n%").
- `CRationalEntity::Read_t` 0x6019d8e0 (state-stack count; appends one entry
  per iteration — a corrupt count stalls here), `CMovableEntity::Read_t`
  0x601c8120, `CMovableBrushEntity::Read_t` 0x601c6150.
- zlib `inflate_fast` around 0x601bcff0 (match copy loop 0x601bd087).
- Graphics probe: SearchPathA `OPENGL32.DLL` then `3DFXVGL.DLL`, then
  LoadLibrary; 0x601085a6 uploads a 1x1 GL_RGBA8 texture and enables 32-bit
  textures only if `glGetTexLevelParameteriv(GL_TEXTURE_GREEN_SIZE)` is 8.
- Input hooks installed at 0x600cc1c3: `SetWindowsHookExA(3, 0x600cafb0, 0,
  tid)` and `(4, 0x600cb000, 0, tid)`, handles at 0x6022aed4/0x6022aed8; both
  procs pass the message to the key processor 0x600cae70 and CallNextHookEx.
- Entities.dll static initializer table at 0x603cd2ac (initializers such as
  0x602b8c50).

## Fix chain (all on main)

027c12a54 DLL static TLS · c7c234629 fault mode 5 `reservedPageFaults` ·
ce3aeaad5, 32b9526ec nested fault run keeps `$ip`/page registers ·
bc110628c OPENGL32.DLL system-file stub · 8ed49c3dc glGetTexLevelParameteriv ·
5529ce4aa, 13da5a055 MEM_DECOMMIT unmaps (size-0 bound) · d10ba697's
26aba0e61, d81e4b7e8, 212959d8d decoded-code spill + SEH-walk `$ip` ·
f6c58213a page-crossing accessors re-translate after a fault filter (the
straddling dword that corrupted the state-stack count) · 4cbde5326 registry
entry + browser `reservedPageFaults`.

## Ruled out / stale

- "Hooks 3/4 are unsupported, so movement needs `/inp_iKeyboardReadingMethod=0;`"
  — stale. WH_GETMESSAGE (3) runs for GetMessage and PeekMessage(PM_REMOVE) and
  carries every posted key message; movement works with the default reading
  method (2). WH_CALLWNDPROC (4) is still unimplemented (SetWindowsHookExA
  returns 0); it only sees sent messages and is not needed for movement.
- "The timer callback injected on the main thread corrupts entity loading" —
  wrong: the corrupt count reproduced with the timer thread; the cause was the
  page-crossing accessor (f6c58213a).
- ExceptionInformation[0] write classification: not needed so far.
- Browser route: registered and `reservedPageFaults` is wired into host.js, but
  exercised in a browser; see the bounded startup comparison below for current evidence.

## More addresses and root causes from the 2026-10-01 bring-up

(Recovered from branch `archive/shared-tree-presync-20261011`, Oct 2026. Same
module bases as above; private-build details dropped.)

- Without a working multimedia timer the engine aborts with `Problem with
  initializing multimedia timer - please try again.` Its periodic timer is
  50 ms, callback runtime 0x591610.
- Loading `classes/Player.ecl` from a GRO throws `Expected keyword Package: not
  found` when a reserved stream page reads as zero (default sentinel mode): the
  keyword-mismatch branch is runtime 0x58d931 (original 0x600d9931). The EXE's
  CRT scope filter 0x423830 is what calls `CTStream::ExceptionFilter`.
  `--fault-null=raise` globally is not a fix: it trips an earlier low read
  (address 0xa, EIP 0x580910) and reaches a generic Fatal Error.
- Streams are also reserved *below* 0x70000000 (e.g. 0x6fff0000 for
  `FleshGreen.tex`), so any "fault only above X" cutoff silently reads zeros
  (`TVER` mismatch); the bound has to be the reservation itself.
- A fault inside one REP MOVS must keep the completed iterations, and a second
  fault must not be raised before the first one's handler runs, or the stream
  pointer is clobbered by the exception record (bogus `AFIN` header error).
- Missing `CFlame` (`Class 'CFlame' not found in entity class package file`) is
  optional precaching, not a missing export to synthesize: the demo's
  Entities.dll really lacks `CFlame_DLLClass` (2146 exports). Engine 0x6019eb80
  catches component-load failures (handler FuncInfo 0x601f26e8);
  `CDLLEntityClass::PrecacheClass` 0x6019f2d0; `gam_iPrecachePolicy` BSS
  0x60243b38 (live value 1). The catch path rethrows through the CRT, which
  needs per-invocation SEH dispatch state (fixed in `11-seh.wat`/`09b-dispatch.wat`).
- Stream handling is per thread: `CNetworkTimerHandler::HandleTimer` 0x60175b00
  calls EnableStreamHandling at 0x60175b33 and `DisableStreamHandling`
  (0x600d9290) at 0x60175b6d. A timer callback that borrows the main thread's
  TIB/TLS therefore clears the main thread's stream list and later fails with
  `Can create memory stream, stream handling is not enabled for this thread`.
  The timer needs its own thread context (winmm's timer thread on main does this).
  Note `$apply_seg_override` (`07-decoder.wat`) adds `$fs_base` to the
  displacement at decode time, so swapping `$fs_base` alone under cached code
  does not change which TIB an FS: access reads.
- GL loader 0x5bd140 (runtime) resolves many names but requires only
  `glGetError` and ten WGL calls (including `wglGetCurrentContext`/`DC`).
  `glClearDepth` slot original 0x60231238 (name at 0x6021a838), called from
  0x600fdba7 with 1.0; `glDrawElements` slot 0x60231510, call site 0x6010c0bf.
- Windows: game window HWND 0x10006 (EXE proc 0x4047f0); Engine rendering child
  0x10008 (proc runtime 0x5d20b0) takes focus. An old bug let 0x10008 inherit a
  previous dialog's `WND_DLG_RECORDS` entry and eat Escape (`wnd_slot_reset` now
  clears it).
- `inp_iKeyboardReadingMethod` is original 0x60222ca8 (default 2 = hook array);
  `GetInput` 0x600cc290 polls GetAsyncKeyState when it is 0.

## 2026-10-14 user crash: cooperative lazy fault reads

Telegram76 reports Safari26.4, isolated/SAB available, module SHA256
`e6ac188dd8c7b16d04eaa4b74446ab2c4ab211422738709e33cffda5db444e7e`,
EIP `0x62` after `0xbf86cb`. The preceding address maps to `_CxxThrowException`
in the recorded MSVCRT layout. The earlier Worker io-fill fix `18d061540` is
already on main; it does not make the page able to block on a nested fault read.

On fresh Boat `bx_tgbme2h7`, original hash-pinned demo and MSVCRT SHA256
`887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`:

| Chrome route | 60-second startup result, Enter after 15 seconds |
|---|---|
| Worker threads, baseline9ab60e86c | Croteam intro |
| `?no-threads`, baseline | Exact0x62 trap with matching register values except a heap pointer |
| `?no-threads&eager-files`, baseline | Croteam intro |
| `?no-threads`, policy fix43f04c7c4 | Croteam intro; automatic172-file/119112003-byte preload |

The cooperative reserved-page fault filter runs synchronously and cannot await
a lazy ReadFile cache miss. The browser file policy now keeps data resident for
that route, including explicitly lazy/ranged declarations. A real guest Worker
retains streaming. The tradeoff is startup download and memory for the complete
data tree on the cooperative route; existing launch progress UI covers loading.
No guest binary, handler return, or exception behavior is patched.

Evidence directories: `scratch/runs/20261014-sam-browser-threads`,
`20261014-sam-browser-cooperative`, `20261014-sam-browser-coop-eager`, and
`20261014-sam-browser-coop-fixed`. Each contains the probe, screenshots, logs,
state and dashboard metadata. Policy regression tests also check explicit
range/background declarations and that shared file declarations stay unchanged.
This verifies the reported startup failure in Chrome, not Safari-specific
behavior, full gameplay, audio or FPS. WebGL readPixels INVALID_ENUM warnings
remain visible in the eager/fixed runs and are not resolved by this change.

## 2026-10-14 low FPS: measured software-GPU bottleneck (TG80)

**This measures the separate test box, not the user's Safari hardware.**
Headful Chrome151 / Linux x86-64, `bx_tgbme2h7`, cooperative
`?debug&perf&no-threads&app=serious_sam_demo`, original assets, default640×480,
Normal difficulty, Karnak initial room. Enter inputs navigated Single Player →
New Game → Normal; clicking NETRICSA Exit entered gameplay. Relative mouse input
changed the view for a second sample. F1, `/hud_iStats=1;`, Enter, F1 enabled
the engine's own FPS counter without changing rendering settings.

Runtime log remained enabled. WinePerf recording remained enabled, with its
overlay hidden after NETRICSA so it would not obscure the Exit button. These
diagnostics add overhead; there is no logging-off control. No absolute FPS
generalization or production speedup is claimed. No Worker comparison was made.

Build: remote source `487e2c013216b12dfd8a27eaae621f6139078448` plus the
9-line Rodent patch (runtime equivalent of `df987a415`); module SHA256
`70c6d329d51eee5db553715f53ffc47f3e6e2491b54ae5327f1b8b012427d655`.
Reviewed evidence: `scratch/runs/20261014-sam-low-fps/`, containing screenshots,
raw frame samples, CPU profile, probe, synchronization diagnostics, build patch
and hashes. Browser/controller were closed and runtime ownership released.

| Sample | GL presents / elapsed | Actual GL rate |
|---|---:|---:|
| Initial room, looking upward |64 /20.10s|3.18/s|
| Identical view, CPU profiler enabled |68 /20.19s|3.37/s|
| Turned toward torch wall |81 /20.01s|4.05/s|

Second-scene frame intervals were p50=240ms, p95=324ms; the engine screenshot
shows3.9FPS. WinePerf **double-counted**:128 HUD presents versus64 actual
`OpenGLHostBridge.present` calls in the first sample. Do not quote its
PRESENT/s as application FPS here. Its `main` phase (HUD "guest") also includes
synchronous GL replay; it is not a measure of interpreter time alone.

First-sample cost per actual GL frame (nested timings, not additive):

- Main slice253.64ms, including **230.15ms GL replay**, of which **227.75ms
  was the complete GL presentation path**. Main work outside GL replay23.49ms.
- Cooperative thread work32.59ms; other step work11.51ms. Total step297.73ms
  versus wall314.04ms per frame. Increasing slice budgets is not supported by
  these measurements: the synchronous rendering call dominates.
- The narrower `GpuBackend.WebGLBackend.present` timer was only0.22ms. The
  later `Renderer.mergeGpuLayerIntoBackCanvas` calls Canvas2D `getImageData`
  before writing canonical GDI pixels, where the rendering wait becomes visible.
- 46.09 draws and4,938.56 submitted vertices/frame. CPU profile:21.32s sampled,
  15.01s (70.4%) in that `getImageData`,4.28s (20.1%) WASM. Hottest individual
  WASM function `$x87_island_fast`:0.47s (2.2% total). Interpreter optimization
  is not justified by this run.

The expensive readback **exposes pending rendering**, rather than spending
228ms copying pixels. Same-scene, same-settings diagnostics established:

1. Re-reading the completed640×480 frame took0.40–2.21ms; reading a CPU-canvas
   copy of the identical pixels took0.32–0.65ms.
2. Adding synchronous WebGL `readPixels` before backend present moved202.50ms
   per frame into that earlier call. Whole GL presentation remained207.71ms.
   It did not remove the work or change the rendered scene.
3. Even a **1×1 pixel** read before present in the second scene waited132–161ms.
   Four subsequent calls returned error0 and pixel `[75,58,41,255]`; the first
   reported error1282 with a pre-existing1280. Retain this imperfection when
   interpreting the raw checks. Earlier startup notes already record GL errors.
4. `gl.finish()` alone took0.04ms/frame and did not move the wait in this
   browser; it was not an effective completion discriminator. Wrappers were
   restored before the second scene.

**Environment trap:** the WebGL debug-renderer string claimed Intel UHD620,
but `/usr/bin/google-chrome` is a BetterChromium wrapper injecting
`--use-gl=angle --use-angle=swiftshader` and a fingerprint seed. Actual process
arguments confirm software rendering; there is no `/dev/dri`. The browser
occupied about3 CPU cores and raised host load from0.3 to about4 without a
second benchmark. The advertised WebGL renderer string is not hardware proof.

Next: repeat a fixed gameplay scene with logging off, and obtain the actual
Safari hardware profile before selecting a fix. The helper
`tools/page-probes/sam-frame-cost.js` installs diagnostic wrappers after launch;
call `samBegin()`, wait20seconds, and save `samEnd()`. It records explicit GL
present timestamps and nested replay/presentation cost alongside cooperative
phase times. Use Safari Web Inspector's CPU profile to split interpreter work
from the canonical readback boundary. If hardware reproduces this boundary
stall, investigate rendering completion/canonical-surface synchronization while
preserving GL/GDI ordering. If WASM dominates there, investigate its hot path.
Do not bypass canonical writes or change resolution to claim a fix. **The cause
and rate on the user's Mac remain unmeasured; no FPS fix is claimed.**

### 2026-10-15: local M1 hardware GPU baseline

The Mac is now measured in headful Chrome155.0.8059.40, ANGLE Metal Apple M1
(8 GPU cores), at an actual640×480 GL backend size. CDP GPU information and
browser arguments confirm hardware rendering. Source45c3d0bff5e95bdde5c4a1b863d241d066431ed3,
canonical WASM SHA256
`70c6d329d51eee5db553715f53ffc47f3e6e2491b54ae5327f1b8b012427d655`.
Evidence: `scratch/runs/20261015-sam-local-gpu/`.

Normal difficulty Karnak gameplay, stationary views, three20-second samples
each, logging off, cooperative `?debug&perf&no-threads` route:

| View | Actual GL presents/s | p95 presentation intervals |
| --- | --- | --- |
| Upward stone room |25.27,22.83,22.74|48.1,53.8,52.1ms|
| Torch wall |20.83,20.29,21.37|55.8,58.7,52.5ms|

Counted `OpenGLHostBridge.present` directly, not the double-counted HUD.
GL replay averaged4.90–6.00ms/frame, including4.00–4.71ms presentation.
Main slices averaged29.4–35.5ms and cooperative thread phases9.2–12.5ms.
These nested rendering costs must not be added to main slice time.
A separate20-second CPU-profile control measured18.50presents/s:
69.2% of sampled time in WASM,4.7% in `getImageData`,11.9% idle.
This supports CPU/emulation as the next investigation target on this Chrome
route; the Boat software-rendering wait does not dominate here. No fix claimed.

Reviewed before/after gameplay screenshots show the gun, health100, stone
architecture and torch. This is a stationary performance baseline, not a full
playability test. Safari and the guest-main Worker route remain unmeasured.
Other laptop applications remained open; timing wrappers/perf collection were
enabled with HUD hidden. Profiled and unprofiled samples are separate because
profiling measurably affects throughput. The Boat comparison is not a
controlled speedup: CPU, browser, logging and renderer differ. Benchmark Chrome
was closed after capture; no emulator implementation changes were made.

### 2026-10-15: deferred OpenGL window readback

Implementation36d060063 retains top-level GL window frames on the GPU. A
shared window-surface ownership flag triggers synchronous materialization
before a GDI source/destination descriptor exposes CPU pixels; ordinary GDI
does not make an extra host call. Context retirement and surface resize resolve
pending ownership. Bitmap drawables, child windows and older modules retain
eager publication. The real WAT GetPixel/SetPixel/resize regression, GL/GDI
ordering and context-retirement tests, Worker RPC and shared-render protocol
tests pass, as do existing bitmap, command-stream, frame-state, drawable-size,
screen-surface and frame-counter checks. Canonical build passes.

Headful Chrome155 on M1 hardware GPU,640×480, logging off, three alternating
20-second eager/deferred pairs per mode, using the SAME patched module and
disabling only renderer.deferGpuWindowReadback for the eager control:

| Route / scene | Eager presents/s | Deferred presents/s | Aggregate change |
| --- | --- | --- | --- |
| Cooperative / Karnak room floor |33.63,30.08,32.83|33.47,35.43,35.19|32.18→34.70 (+7.8%)|
| Guest + render Workers / TechTest courtyard |23.44,18.05,23.65|24.54,21.20,28.44|21.71→24.73 (+13.9%)|

These are within-route comparisons, NOT a comparison of threading speed: the
scenes differ. Laptop background applications remained open and the threaded
samples are noisy. The cooperative scene submitted exactly57draws/6,384vertices
per frame in all six samples. Every eager frame performed a window merge;
all six deferred gameplay samples performed ZERO window merges/readbacks.
An explicit post-benchmark Worker resolve returned matching GPU/canonical
RGBA `[83,203,255,255]` and cleared pending ownership. Reviewed screenshots
retain scene geometry, gun and health100. Both benchmark browsers were closed.

WASM SHA256 `2397fae60cc626a31d7a77c527266d2d8473a0005d1c6bbca27581c007181497`.
Evidence: `scratch/runs/20261015-sam-gl-lazy/` and
`scratch/runs/20261015-sam-gl-lazy-worker/`. Earlier Worker samples prefixed
`diagnostic-console-` were captured with the diagnostic console open and are
excluded. Safari remains untested; this does not establish full playability.

Scheduling instrumentation recorded no positive _scheduleStep delay in any
accepted sample. Cooperative gaps between steps totaled0.45–0.62seconds per
20-second sample. That rules out deliberate scheduler sleep for these samples;
it does not retrospectively identify every idle sample in the earlier separate
CPU profile. No scheduler behavior was changed.
