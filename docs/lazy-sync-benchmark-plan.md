# Synthetic benchmarks for lazy surface synchronization

This is the broader benchmark specification. The implemented low-level browser
suite and first measured results are in [lazy-sync-synthetic-results.md](lazy-sync-synthetic-results.md),
including its explicit end-to-end coverage limits. This plan extends the access-path reproducer in
`tools/audit-d3dim-lazy-sync.js` (deleted in gps/d7; see lazy-sync-audit.md). Workload sizes below are chosen fixtures;
only the MW3 Lock pattern is based on the preceding real-game measurements.

## Two layers and explicit comparison arms

1. **WAT access cost.** Compile through `test/render-helper.js` with narrow
   test exports. Execute long loops inside WAT, not one JavaScript call per
   pixel. Exercise the actual scalar, x87, bulk, uop and GDI paths. Mocked
   fence callbacks are acceptable here, but results are CPU access cost and
   barrier counts, never GPU performance. Run a companion x86 guest loop
   through the interpreter for any changed accessor/fold so direct exports
   do not hide dispatch or native-fold behavior.
2. **Browser surface cost.** Use the shipping guest Worker, command stream and
   render Worker with a real WebGL context. Follow the isolation/startup setup
   in `test/test-d3dim-render-worker-web.js`; collect the frame statistics used
   by `tools/bench-d3dim-gameplay.js`. Actual readPixels, uploads and waiting
   belong in the measurement. Pin the full WASM/JS/region-map artifact set.

Compare **original eager**, **candidate eager (option off)** and **candidate
lazy**. For a narrow fix, also compare its parent with lazy enabled, but mark
an incorrect parent's timing INVALID rather than calling its speed a win.
Runtime exclusions must be the real candidate policy, not a benchmark script
manually disabling the feature immediately before the difficult operation.
Do not combine every fix in the first comparison: attribution requires one
change at a time, followed by the combined candidate.

## Common frame fixture

Use two 640x480 RGB565 render targets, two 256x256 textures and one unrelated
surface. Add a 1024x768 variant to expose readback-size effects. GPU-render an
exact frame-indexed color pattern using non-antialiased, nearest-sampled
integer-positioned geometry. Use representable RGB565 colors. CPU backing
starts with a different known pattern so missing synchronization is visible.

The CPU writes a small opaque HUD region (16 rows x 320 pixels) and a few
scattered pixels. Check both the written pixels and surrounding untouched
GPU pixels. Those dimensions are synthetic, not a reconstructed MW3 HUD.

Keep scene work fixed: one variant has a minimal GPU workload to expose
synchronization costs; another issues approximately 1,100 small draws per
frame to resemble the measured MW3 draw count. Use the same command order,
geometry and seed in all arms. No real-time randomness, animation-dependent
LOD, logging or CPU profiler in timing runs.

## 1. Single-thread untouched Locks: protect the existing win

```text
GPU draws -> Lock / Unlock, no access
          -> Lock / Unlock, no access
          -> Lock -> write HUD -> Unlock -> present
```

Use this MW3-inspired color-target pattern in every comparison. Include a
second variant with texture Locks. Separately run a pure CPU buffer loop
outside the DIB arena to detect accidental overhead on ordinary memory.

Correctness: current-frame GPU background and new CPU HUD survive together.
The simple isolated color-target fixture should need three Lock-triggered
readbacks eagerly and one lazily; count presentation/lifetime readbacks
separately. Confirm the counts rather than assuming the renderer implements
that exact sequence. Report frame time, first-access delay, actual readbacks,
bytes read back, uploads and lazy armed/touched/untouched counts.

## 2. Thread-start exclusion: separate transition from lost savings

Run the common frame fixture for 300 frames with one guest thread, create an
audio-like helper that touches only an unrelated ring buffer, then run 300
more. Repeat with the helper already present at startup. The helper must be
an actual guest CreateThread/Worker route, not just a second JS function.

Then use a surface-touching helper: main Locks and signals an event; helper
reads a pixel, writes a HUD row and signals completion; main Unlocks and
presents. Explicit event ordering makes the expected result deterministic.

Correctness: the transition drains before the helper's first surface access,
fresh pixels are read, CPU writes survive, and exclusion remains in effect
for as long as its policy requires. Measure the transition frame separately
from steady-state before/after frame time. The unrelated helper quantifies
the optimization lost to conservative exclusion even without shared drawing.

## 3. Shared ownership: genuine cross-worker access

Use the same event-ordered frame sequence as case 2 with shared ownership
enabled instead of exclusion. Keep two guest workers alive for the entire
timed phase, so worker construction is outside handoff timings.

Variants:

- Owner-only access with a second idle worker: uncontended metadata cost.
- Helper reads once per frame; owner later writes: remote fence handoff.
- Helper writes a partial row; owner later reads: preserve GPU neighbors.
- Workers use disjoint surfaces: avoid a needless global synchronization.
- Two readers arrive at the same pending surface: stress one synchronization
  with two waiters. Concurrent overlapping writes are excluded because their
  expected order would be undefined.

Use a start gate for the contention variant, but test ordering across repeated
schedules rather than claiming simultaneous arrival is deterministic.
Report first-access/handoff p50/p95/p99, metadata-only cost, wait time,
readbacks per surface and duplicate-fence count. A second WASM instance
executed serially can establish correctness, but cannot measure contention.

## 4. Retained GDI access and conservative DC exclusion

Normal baseline: render, GetDC, draw a small text/rectangle HUD, ReleaseDC,
present. This path already fences at GetDC. It detects added overhead on a
working sequence.

State stress: bind a DC before arming the surface and use GetPixel/SetPixel,
BitBlt and text drawing while pending. Include a selected bitmap alias of
the same guest-owned DIB. Put a DC on the unrelated surface too, to distinguish
surface-specific exclusion from disabling lazy sync everywhere.

The outstanding-DC-plus-Lock combination is accepted by our current internal
paths, but its Windows API validity is not established. Treat it as an
internal state stress test. A policy may reject the sequence explicitly;
that is a correctness result, not a comparable rendering FPS result.

For states the candidate supports, reads must see GPU data, CPU writes must
survive, and untouched neighbors must remain intact. Compare fencing at the
native access boundary against eager Lock for surfaces with outstanding DCs.
Report fence/readback counts and frame time, plus cost on ordinary GetDC use.

## 5. Wide/x87 accesses: measure common case and boundary cases separately

Allocate a larger DIB buffer and attach an aligned subrange as the surface;
the prefix bytes must be legitimately allocated, not a read before an
allocation. Place operands in the prefix that overlap the GPU-owned subrange.

Use x87 FLD/FSTP loops resembling a floating-point copy/conversion pass. Cover
4-, 8- and 10-byte operands through the baseline interpreter and enabled
folded/uop paths, verifying which handler actually executed. Include a plain
integer bulk-copy control using the canonical guest span helpers.

Access distributions:

- Ordinary heap/stack loads, no pending surface: hot-path overhead.
- Aligned in-surface loads: one initial fence, then normal loop throughput.
- Sequential 8-byte loads offset by four bytes: roughly one page-crossing
  load per 512 operands, plus the surface-start overlap once per arm.
- One boundary-crossing operand per iteration: a deliberately adversarial
  stress case, reported separately from the sequential workload.

Use finite, exactly representable numeric patterns for conversion assertions;
avoid NaN-payload comparisons. Match an eager oracle for overlapping bytes and
preserve untouched pixels on stores. Report ns/access or accesses/second,
fences and the equivalent contribution for a stated number of accesses/frame.
Do not convert that into a predicted game's FPS without a measured access mix.

## 6. Backing replacement and release: cold-path cost and reuse safety

Render to surface A; leave a Lock untouched; replace the backing through the
supported SetSurfaceDesc path; reuse the old allocation for B and render a
different pattern. Also test release without replacement, nonfinal Release,
and two wrappers sharing the same backing. If changing a locked surface is
rejected, test the supported post-Unlock sequence and report the rejection
as a separate state-contract check.

Use replacement every 600 frames as a resource-change scenario, every 60
frames as moderate churn, and every frame as stress. These are chosen rates,
not observed game frequencies. Verify the original content/order required by
the API, and that an old pending readback never overwrites a reused allocation.

Measure transition latency, extra fences and steady frames separately. For
the chosen rate, amortized cost/frame = extra transition time / interval;
always show the transition p99 as well, since a small average can hide a hitch.

## 7. Thread-history tracking: test the benchmark itself

Create a helper that starts and exits entirely between the old before/after
measurement checks. Include startup-before-first-check, no new threads, and
reused thread-ID cases. Persistent creation history must reject every run
that exceeded the experiment's supported scope, even if no worker is alive
when inspected. Disable logging; store a counter/generation rather than
allocating a stack trace for every event.

Measure tracking on/off with the same fixed thread workload: no creation,
one startup creation, and repeated creation outside steady rendering. Report
per-creation and total bookkeeping cost separately from Worker startup cost.
This is harness coverage, not proof that shared ownership is correct.

## Correctness and measurement protocol

1. Run each scenario with validation enabled, deterministic scheduling where
   possible, expected fence counts and full pixel comparisons. A failure is
   INVALID, never a faster result. Check intended lazy state was exercised.
2. Time the same fixed work without full pixel hashing, screenshots or tracing
   in the measured loop. Validate immediately after the interval; any final
   drain belongs to a separately reported validation phase. Runtime fences
   needed to produce frames remain inside the interval.
3. Warm up, then use a fixed frame/operation count and alternating A/B/B/A
   rounds. First run A/A to establish noise. Record hardware/browser, artifact
   hashes, actual GL renderer, load and input parameters. Reject software GL
   fallback when the run is meant to measure hardware readback.
4. Start with five paired rounds of at least ten seconds per arm, increasing
   work when necessary. Report paired deltas, spread, p50/p95/p99 frame time
   and counts per frame. Claim "no detectable cost within X" only if the
   measured uncertainty supports X; do not infer zero overhead from a null
   result. Disable present caps/vsync throttling for throughput, and label a
   separately paced frame-latency run if used.
5. Run Chrome first on an idle remote box, then Safari using the same browser
   fixture. A WAT/Node timing is not a Safari performance result.

Expected output columns:

```text
case | arm | correctness | frames | ms/frame p50/p95/p99
     | readbacks/frame | readback bytes/frame | uploads/frame
     | access ns | first-access wait | transition ms | thread creations
     | lazy armed/touched/untouched | actual GPU | artifact hashes
```

Start implementation with cases 1, 5 and 7, then conservative exclusions
(2/4), lifecycle (6), and shared ownership (3). The existing audit supplies
failure controls; the browser fixtures must not substitute its mock readback
for real GPU work.
