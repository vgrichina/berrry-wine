# Cooperative GLTron presentation boundary, 2026-11-07

The first missing scene stage is geometry submission, upstream of native scene
drawing and menu presentation. The cooperative original creates its native
context, uploads textures, clears and publishes black once, then remains in
guest sound/SDL activity without submitting menu geometry during the bounded
observation. A compositor dropping a rendered menu was not demonstrated.
No production repair was warranted by this evidence; the precise guest-side
cause remains unresolved. Cooperative menu and gameplay remain unreviewed.

Evidence: `scratch/runs/20261107-gltron-cooperative-presentation/` (ignored).
This single task started after MW3 released its slot, leaving WorldCircuit's
owner-priority slot intact. It follows the
[current six-app sweep](graphics-post-allocator-crash-sweep-20261107.md), not a
historical27 census or a timing/parity comparison.

## Retained evidence first

The 21:55 sweep retained both native contexts and successful WGL creation and
MakeCurrent. Its cooperative endpoint is uniformly black; its threaded endpoint
is the original colored GLTron Game/Video/Audio/Quit menu. Both were personally
inspected here. The cooperative log contains continuing main-thread instruction
samples in bundled `sdl_sound.dll`, plus an active cooperative auxiliary SDL
thread. The threaded auxiliary worker executes two slices and then parks.
Those observations alone do not locate a missing renderer operation: the
retained bridge observer counts context setup, not drawing or presentation.
`retained-analysis.json` preserves the exact log references, hashes and samples.

Read-only source inspection covered `test/run.js`, `lib/thread-manager.js`,
`lib/gl-compat.js`, `lib/gpu-backend.js`, `lib/renderer.js`, audio host imports,
and the GL stream/stat exports. No source files were edited or claimed for a
speculative fix.

## One fresh cooperative original

One UUID-idempotent allocation ran one registered original. Production CLI:

```sh
node test/run.js --app=gltron --no-threads --headless-gl --no-build \
  --quiet-api --trace-api-counts --api-counts-top=300 --gl-census \
  --max-seconds=125 --max-batches=1000000000 --control-stdin --png-canvas \
  --png=<run>/actual/final.png
```

`driver.cjs` requests the existing compositor PNG operation at 5, 10, 20, 40,
80 and 115 wall seconds, serially acknowledging each before another request.
Its five-second command deadline closes the channel at the first unknown
outcome; none occurred. `observe.cjs` passively wraps existing bridge, backend,
scheduler and renderer methods, invoking each once with its original arguments
and receiver. Bounded one-second snapshots retain counters and register getters.
Utility Node workers inherit the preload and emit empty-manager snapshots;
analysis selects snapshots containing the actual cooperative manager. There are
389 total rows and 126 such snapshots, below the 1,500-row observer cap.
No guest input, configuration, clock, binding, private handler or forced guest
render was used. Captures use the CLI's normal presentation-for-read operation.
Diagnostics have overhead: these wall times are not equal-progress markers for
the earlier sweep or threaded mode.

| Stage | Observed evidence |
| --- | --- |
| Context/current | One native context; WGL creation and MakeCurrent return 1. Mesa llvmpipe LLVM 20.1.2, WebGL 1.0. |
| API upload | 172 `glTexImage2D` calls and 172 backend texture uploads; 341 replayed GL/WGL operations total. |
| API geometry | Zero packed spans enqueued, zero executed scene draws, zero scene vertices. API histogram has no `glBegin`, vertex or draw-array/element entry. |
| Swap/publication | One guest `SwapBuffers`, one bridge present, one backend `swapDrawable` call, one context publication and one backend present. They follow the initial clear. |
| Native backend draw | One backend draw: the presentation copy, not guest scene geometry. `present()` calls `_presentRenderTarget()`; no scene draw accompanies it. |
| Compositor/capture | Eight repaint/publication calls including setup and captures. All six requested captures ACK; final PNG also written. |
| Guest progression | Auxiliary instance exists and executes. Final main EIP `0x007a71b7` lies in bundled SDL_sound; auxiliary EIP `0x00a3e5f0` is parked on handle `0x000e0005`. No escaped trap or unimplemented API is logged. |

All seven new 640×480 captures were personally inspected. At 5 and 10 seconds
the compositor is solid teal (`008080ff`); at 20, 40, 80, 115 seconds and exit
it is solid black (`000000ff`). Each image has exactly one RGBA color. The
teal-to-black transition follows the observed initial GL clear/publish; the
capture path is returning the published blank surface. There is no rendered
menu in this run to show being lost downstream.

From roughly 30 seconds onward, 82 one-second main snapshots land at relocated
SDL `0x00a3e990` (original RVA `0x10990`). Retained PE tables/disassembly identify
that function's `WOM_DONE` (`0x3bd`) test and semaphore-release path. Other
samples continue in SDL_sound. The combined API histogram includes 90,556
`waveOutWrite`, 180,716 `ReleaseSemaphore` and 271,178 `WaitForSingleObject`
calls. These establish audio/synchronization activity, not deadlock,
starvation, correct audio timing, decoded progress or audio quality. The final
main-only API count is 636,834; it must not be confused with that combined
histogram. No WAT/JS disagreement, dropped primitive or incorrect scheduler
transition was demonstrated. Pending encoder state and the guest's exact
startup call stack were not sampled independently; the established boundary
is absence of completed scene submission, not a proof of every internal step.

## Reproducibility and checks

Runtime source is main `926c9d037a1820ccb50feed1ad1f822a3a700bd9`.
`runtime-pins.json`, the empty relevant tracked patch and
`new-lib_wininit-boot.js.patch` preserve the actual source composition. Compared
with the 21:55 sweep, 302 relevant source/module files match; the sole changed
runtime source is the already-published `lib/renderer-input.js` physical-key
repair. This run injects no input. Current unrelated working-tree changes are
not part of the staged composition.

The actual standard-module read is 2,182,500 bytes, SHA-256
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`,
identical to the sweep. Compatibility was recovered but not executed. All 126
observed runtime reads match their pins. Pre/postflight match 545 staged inputs
and 162 native dependencies. Node is v24.22.1, display `:0`, GLFW 7.4.1 and
WebGL 6.0.3. Existing native installation/staging and passed predecessor controls
were reused; remote headless-GL and real WGL creation/MakeCurrent/red-readback
checks pass. All 92 registered original-media paths match their manifests and
are referenced by path/size/SHA-256. No repeated media or source archives were
created.

The driver exits zero at the normal 125-second harness deadline; this is not a
guest exit or a menu pass. Helper syntax checks and `validate.cjs` pass, checking
capture pixels, command acknowledgements, loaded hashes, retrieved bytes and
lifecycle records. No production code changed, so no new build or repair
regression is claimed. GLTron has no candidate-corpus entry: evidence stays with
this investigation instead of attaching a dashboard result to another app.

## Recovery and lifecycle

43 remote artifact references / 38 unique contents, 9,473,234 referenced bytes,
were recovered and SHA-256/size verified before the task's delegated normal
shutdown. They include all captures, complete losslessly compressed log,
module reads, counters, native pins/binaries and both modules. Git SHA plus
relevant tracked/new/helper/note patches provide source recovery without a tree
snapshot. Remote cleanup found no owned runtime processes; this CLI run created
no port, profile or held input.

Box `bx_2zjd6jek` was created at 22:16:14Z with original expiry
**22:41:14.808Z**. The detached 25-minute watchdog and separate normal-stop
delegate were armed and observed alive before allocation and before requested
stop. Maximum recorded watchdog heartbeat gap is 1.454 seconds. After verified
retrieval, normal stop `stop_f84a07c7df8f6fa3` completed at
**22:20:40.132Z**, forced=false, error=null. Both lifecycle children exit zero;
the supervisor records no remaining children. The box is **archived**, current
expiry null, archive retention unknown; ownership returns to the coordinator.
No resume, delete or public deployment occurred. Local board watcher is closed.
Launch free space exceeded 5 GB locally and remotely; remote preflight free
space was 57.97 GB.

The next useful discriminator is the cooperative guest's sound initialization
and callback/synchronization progression before its first completed menu draw,
including read-only WAT encoder counters and guest caller stacks. It needs
separate authorization for another original run. This task makes no gameplay,
visual parity, FPS, audio, browser, physical GPU or historical27 claim.
