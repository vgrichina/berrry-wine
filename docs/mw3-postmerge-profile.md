# MW3 profile after uop merges

Measured frozen commit `837f0a74` on a dedicated ASCII box, 2026-09-30.
The result is still about 22 FPS in the stationary cockpit route. Guest
execution remains the largest frame component; this is not an isolated A/B
measurement of a merge's performance effect.

The follow-up [guest and Chrome native disassembly](mw3-hot-loop-disassembly.md)
uses this exact module and browser version to explain the hot interpreter paths.

## Runtime and method

Box `bx_4r5uzdwv`, AMD Ryzen 9 9950X, 4 assigned vCPUs, 8 GB,
Chrome 151.0.7922.108. CDP confirms **ANGLE SwiftShader**, not physical GPU
rasterization. Both the earlier report and this one used software-backed WebGL.

Measured WASM SHA-256:
`c1c92840fde2c9ae2809154ea64ea9ab91b11effdb0a541099b695f1567a6b93`.
Region layout: `91dc9b166c2ec115`. The named artifact's noncustom sections match
the measured WASM exactly, checked before resolving CPU sample function names.

The repository was exported at the specified commit and built in isolation.
The fixture adds diagnostic tools and untracked MW3 assets, MSVCRT and MFC42.
One host correction is necessary: the committed `lib/guest-worker.js` puts
the lazy-enable `if` inside the `send({ready,...})` object, a syntax error.
The isolated fixture moves that `if` before `send`, matching the correction
already present in the shared working tree, without its unrelated APC edits.
No production WASM, shared source, or canonical build was changed here.

Three 20-second windows follow verified cockpit entry and warmup. Window 0
has frame/wait/transfer timers but no CPU sampling. Windows 1 and 2 sample
the page and all workers at 500 microseconds. No screenshots or polling occur
inside a measured window. The single surviving guest worker supplies presents;
there are no thread lifetime changes in the windows.

## Frame breakdown

| Window | Presents | FPS | p95 interval | Execute excluding waits | Wait | Other |
|---|---:|---:|---:|---:|---:|---:|
| 0 | 460 | 22.80 | 55.64 ms | 27.71 ms | 13.61 ms | 2.54 ms |
| 1 | 476 | 23.61 | 50.54 ms | 28.25 ms | 11.87 ms | 2.23 ms |
| 2 | 435 | 21.50 | 57.26 ms | 31.20 ms | 12.63 ms | 2.67 ms |

The three time columns partition guest wall time, including scheduling and host
imports; they are not hardware CPU-cycle measurements. Geometry varies from
1,978 to 2,230 triangles/present. One-minute load at the boundaries is 2.74–3.07.
All windows have zero GPU-command errors, software-path fallbacks, and dirty
audit misses. Here “zero fallbacks” describes the emulator's renderer route;
Chrome's WebGL backend itself is SwiftShader. The final screenshot was inspected
and retains textured terrain, cockpit, sky and HUD.

An independent unprofiled control (`postmerge-control1`, two 20-second windows,
neither whole-profile nor transfer-profile enabled) records **23.13/24.19 FPS**,
p95 **51.77/48.79 ms**, zero renderer errors and dirty-audit misses. Geometry is
2,232/1,847 triangles per present. The first window has 120 renderer fallback
events, the second zero. This corroborates the frame-rate scale but cannot
isolate instrumentation overhead because the workloads differ.

## Sampled hotspots

Self time estimates, normalized to the corresponding measured present rate:

| Guest function | Window 1 | Window 2 |
|---|---:|---:|
| `uop_fast` | 3.88 ms | 4.23 ms |
| `x87_island_fast` | 3.27 ms | 3.73 ms |
| `branch_end_at` | 2.40 ms | 2.67 ms |
| `th_load32_rop` | 1.19 ms | 1.31 ms |
| `fpu_exec_mem` | 0.98 ms | 1.03 ms |
| `th_store32_rop` | 0.74 ms | 0.77 ms |
| `th_uop_enter` | 0.63 ms | 0.70 ms |

WASM accounts for 25.01/27.66 sampled ms per present; host JS outside waits
accounts for 3.38/4.05 ms. These sampled estimates overlap the explicit wall
partition above and must not be added to it.

Render-worker `readPixels` spans are 5.00/5.58 ms per present and color-update
spans 2.09/2.32 ms, with more than 99.5% of each overlapping guest waits.
Renderer `getParameter` still samples at 2.26/2.22 ms and `getError` at
2.10/2.27 ms; the latter is already inside color-update timing.

## Comparison limits and next work

The historical profile was 21–22 FPS with guest execution 29–30 ms and waits
13–14 ms. This new profile has the same broad bottleneck distribution. Different
launch geometry and a restored machine prevent a causal speedup claim.

A same-host historical-WASM control was attempted but failed to link:
`host.queue_user_apc` is required by that frozen binary and absent from the
clean committed host. The old measurement included uncommitted APC support.
That failed control and two fixture-setup failures are excluded from results.

The x87 island predecode optimization was already in the historical baseline.
The next guest opportunity remains mixed x87/integer loop coverage described
in [the loop investigation](mw3-guest-loop-investigation.md). The repeated
renderer-name query remains an independent bounded caching experiment.

Artifacts: `build/lazy-games/postmerge-profile3/` contains profiles, result and
summary JSON, boundary screenshots, measured/named WASMs, and named guest
summaries. The source/runtime hashes are in `result.json`.

Command:

```sh
DISPLAY=:0 CHROME=/usr/bin/google-chrome node tools/bench-lazy-games.js \
  --app=mw3 --shipped-default --whole-profile --transfer-profile \
  --seconds=20 --samples=3 --wasm=build/postmerge.wasm \
  --out=build/lazy-games/postmerge-profile3
```
