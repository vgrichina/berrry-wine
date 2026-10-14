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
