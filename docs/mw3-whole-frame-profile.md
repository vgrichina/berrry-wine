# MW3 whole-frame profile, 2026-09-30

Guest execution is the largest measured component in this stationary cockpit
route. Transfers are substantial, but are not the majority of the frame.

```text
Guest present interval: approximately 45–47 ms

  Execute guest + host bridges       29.4–30.5 ms
  Block in Atomics.wait             13.3–14.0 ms
  Outside run/wait                   2.37–2.50 ms
                                    ------------
                                    45.1–47.0 ms

Render worker runs alongside the guest; do NOT add its time again.
  readPixels                         5.45–5.57 ms
  GL color-resource update           2.99–3.66 ms
  >99% of these spans overlap guest waits.
```

The execution row is elapsed time inside `ex.run`, minus explicitly measured
Atomics waits; it includes host imports and OS preemption, not just consumed
CPU. The outside row includes scheduling, messaging, and other worker work;
it is not evidence of an intentional sleep. These three rows form a disjoint
wall-time decomposition of the single surviving guest worker.

## Method and reproducibility

Box8, ANGLE / SwiftShader (software-backed WebGL), Ryzen 9950X, headful Chrome, shipping
shared-WebGL lazy default enabled. Frozen runtime SHA256:
`2c3477ace32507c4f24c252eafd49ae24ce0e6bfda872ee391f05c7aae4d7878`.
No production sources or canonical artifacts changed.

Correction (2026-09-30): this report previously called the renderer hardware
Intel UHD 620. The saved `result.json` CDP `gpuInfo.devices` and
`auxAttributes.displayType` explicitly report SwiftShader and
`ANGLE_SWIFTSHADER`. The earlier label was wrong; the timings below describe
software-backed WebGL, not physical GPU throughput.

Two launches each take three 20-second windows: the first without V8 sampling,
the following two with simultaneous 500-microsecond sampling of the page,
guest worker and render worker. The second launch additionally records bounded
epoch-based `ex.run`, `Atomics.wait`, `readPixels`, and color-update intervals.
Intersection/union calculations clip those intervals to the same measurement
window. There is no screenshot or state polling during the timed interval.
Boundary captures and profile start/stop introduce small sampling-window skew;
sampled shares are normalized to the measured present interval and are estimates.

```
DISPLAY=:0 CHROME=/usr/bin/google-chrome node tools/bench-lazy-games.js \
  --app=mw3 --shipped-default --whole-profile --transfer-profile \
  --seconds=20 --samples=3 --wasm=build/lazy-fence-after.wasm \
  --out=build/lazy-games/mw3-whole2
node tools/summarize-game-profile.js build/lazy-games/mw3-whole2/result.json
```

The second launch records 448/448/430 presents at 22.20/22.19/21.28 presents/s;
p95 is 53.71/52.94/55.11 ms. The first launch is 22.13/21.92/21.59 presents/s.
Load at measured boundaries stays below 4. All six windows have zero GPU
errors and zero software fallbacks. Captures retain the textured cockpit,
terrain and HUD. One guest thread remains after the normal startup helper exits;
no thread birth/death occurs in measured windows.

A separate `mw3-whole-control` launch disables both whole-frame instrumentation
and transfer-stage timers: 20.61/21.83 presents/s, 14.17/13.39 ms transport wait
per present, zero GPU errors/fallbacks. Its geometry differs (2,540/2,023
triangles per present), so it corroborates the scale of waiting but does not
isolate profiler overhead or establish a throughput improvement.

Artifacts: `build/lazy-games/mw3-whole{1,2}/` contain raw profiles, complete
timelines, counters, screenshots and source hashes. `summary.json` in each
directory is produced by the summarizer. The exact measured WASM and a named
reference are in `mw3-whole1/`. The named reference was rebuilt from the frozen
remote sources; `tools/profile-diablo-gameplay.js` verified all noncustom WASM
sections are byte-identical before resolving names. Current source-order guesses
were not used. Guest named summaries sit alongside the raw profiles in
`mw3-whole2/`.

## Guest work

In the two aligned profiled windows, WASM accounts for an estimated
26.1–27.3 ms/present, host JS outside the wait wrapper about 3.4 ms, and idle
samples about 1.7–1.8 ms. Sampling attributes about 0.4 ms/present more to the
wait wrapper than explicit wait timers; use the explicit timers for the disjoint
breakdown above, not the sampled values. V8 samples are wall-time attribution,
including blocking calls, not hardware CPU utilization or CPI.

| Named function | Estimated self ms/present |
|---|---:|
| `x87_island_fast` | 3.26–3.40 |
| `uop_fast` | 3.14–3.53 |
| `branch_end_at` | 2.64–2.75 |
| `th_load32_rop` | 1.49–1.51 |
| `fpu_exec_mem` | 0.97–1.05 |
| `th_store32_rop` | 0.91–0.93 |
| `th_test_jcc` | 0.81–0.86 |

The guest bottleneck is distributed across floating-point execution, the uop
interpreter, control flow and operand movement. This profile does not identify
which original MW3 loops account for each interpreter handler; a guest-PC/hot-loop
census is the next step for a targeted guest optimization.

## Renderer and overlap

The render worker has roughly 21–22 ms/present of sampled non-idle work while
the page is about 87% idle. These are parallel threads, not extra components
to add to the guest interval. SwiftShader rasterization runs through Chrome's
graphics backend and is not separately isolated by this worker CPU profile;
there are no GPU timestamp-query measurements.
The GL-call timings include any driver/GPU waits they trigger.

The readback and color-update spans overlap guest waits by 99.4–99.5% and
99.1–99.9%, respectively. Thus the observed transfer calls occupy about
8.4–9.2 ms/present of the measured wait periods. This demonstrates present
critical-path exposure, not a guaranteed equal saving from removing calls:
GPU waits can migrate to another synchronization point.

Two useful stack findings:

* `getParameter`: about 2.2–2.4 sampled ms/present, exclusively beneath
  `D3DIMRenderWorker.execute` while obtaining the renderer name for a fence
  response. This invariant capability string is a candidate for per-context
  caching. It is a small, concrete A/B opportunity before invasive changes.
* `getError`: about 3.0–3.7 sampled ms/present beneath
  `updateColorResource -> _upload -> _prepare -> _clear`. This is already
  inside the color-update timing above, not another cost to add. The previous
  "GPU upload" figure primarily includes this synchronization/error query;
  it cannot be interpreted as pure byte-transfer bandwidth cost. Removing
  error checking without preserving correctness is not established as safe.

Priority: investigate the hot guest loops for the largest category; independently
A/B caching the renderer-name query as a bounded change. Transfer avoidance
remains worthwhile but is not the only, or largest aggregate, bottleneck.

Follow-up: [guest-loop investigation](mw3-guest-loop-investigation.md) maps the
stable floating-point loops and tests an isolated two-op island candidate.
Correctness checks pass; a whole-game performance improvement remains unproven.

[Post-merge profile of 837f0a74](mw3-postmerge-profile.md): 21.5–23.6 profiled
FPS, 23.1–24.2 in an independent unprofiled control, with the same broad
guest-execution bottleneck. These are new measurements, not a matched speedup.
