## Measuring jank in the browser (`lib/perf-hud.js`)

The browser run loop is a `setTimeout(step, 0)` chain in `host.js`: each step runs a guest slice, then the worker threads, then a repaint — all on the main thread. So a dropped frame is never "rendering was slow", it is "one step held the thread too long", and the question is always *which phase*.

Turn on **FPS graph** in the `?debug` toolbar (or load `?debug&perf` to start it enabled). The overlay draws, per step, a stacked bar of `guest` / `threads` / `paint` / `other` against 16.7ms and 33ms guides, plus the rAF frame-interval line underneath. A tall bar is literally a step the browser could not interrupt; its color says who to blame.

**`PRESENT/s`, application FPS, and `page fps` are different measurements.** The page may composite at 60 while the emulated machine advances slowly. `PRESENT/s` counts explicit DirectDraw/OpenGL presents, falling back to dirty canonical-surface flushes for GDI-only programs; an application may present more than once per logical animation frame, so its own FPS counter is authoritative for gameplay speed. `M blocks/s` reports actual retired basic blocks, not requested budgets or x86 instructions. Blocks have variable cost. Always name the metric when quoting it.

`throttled%` is the share of steps where the worker budget (`maxWallMs` in `host.js`) expired with work still pending. **A high number is not automatically the bug** — measured on Blobby: 100% throttled, but quadrupling the budget *lowered* guest fps from 29 to 17 and produced 240 long tasks. It means the game loop always has work, not that the scheduler is starving it. The ceiling there is interpreter throughput, so look at what costs instructions, not at the budget.

### Null OpenGL diagnostic

Load `?debug&perf&gl-renderer=null` before launching an OpenGL game to discard
packed geometry and pixel presentation. This diagnostic retains guest CPU
execution, command generation, transport, queue ordering, synchronization,
texture upload decoding and the software backend's GL state/query mirror.
It never enables the native software rasterizer. Completed swaps still count
in `PRESENT/s`, but no new GL image appears; GDI menus may remain visible.

This currently applies to OpenGL, not Direct3D or Glide. Bitmap drawables and
framebuffer reads/copies fail explicitly because null mode has no pixels to
return. Capability queries use the software state mirror, so check whether a
game selects a different path before interpreting a comparison. This is a
benchmark mode, not a usable display renderer.

Compare the same build, scene, resolution, thread mode and measurement window
against `gl-renderer=webgl`. Exclude loading and verify gameplay independently
of the blank image. The difference includes renderer CPU work, backpressure,
pixel transfer and presentation; it is not a GPU timing measurement. A small
difference points toward retained work (such as guest emulation), while a
large difference warrants profiling the rendering path. Overlapping work and
game frame caps prevent simply subtracting the rates to obtain GPU cost.

### Streaming a real session

`?debug&perf&perf-stream` posts batched samples to `tools/dev-server.js`, which prints one line per second and can append NDJSON. Use it when someone reports jank *they* experienced — a scripted run is a different session on a different machine load:

```bash
node tools/dev-server.js --perf-log=/tmp/perf.ndjson
# then open http://127.0.0.1:8080/?debug&perf&perf-stream and play
04:24:15 ssnalq game  59fps  page 60  steps 28.0M/s  step p50 2.3 p99 3.6ms  guest 3% thr 94%  throttled 0%    ▁▂▂▁▂▂
04:24:19 ssnalq game  29fps  page 60  steps 10.5M/s  step p50 14.8 p99 21.2ms  guest 0% thr 99%  throttled 100% ▅▅▅▆▆▇
```

The example above is historical: its `steps` values were requested-budget counters,
not measured instruction throughput. Current output labels actual work `blocks`.
Throttling now also includes the main cooperative slice's elapsed-time cutoff;
individual WASM calls/native handlers remain non-preemptible.

`?perf-stream=URL` aims it elsewhere; the sink accepts cross-origin posts so the page can be served from another port.

`host.js` feeds it through `window.WinePerf.{stepBegin,mark,stepEnd}` — four `performance.now()` calls per step, and the seam is null unless the HUD is on. `window.WinePerf.snapshot()` returns the same numbers as JSON, so headless runs get real phase attribution instead of inferring it:

```bash
node tools/profile-web-frames.js --app=blobby_volley --seconds=20 --query='?debug&perf' \
  --report-eval='JSON.stringify(window.WinePerf.snapshot())'
```

**`--headful` when the number will be quoted.** Headless Chrome has no compositor surface and no display refresh to pace rAF against, so its frame intervals describe a browser nobody runs — pass `--headful` for anything presented as what the app feels like, and keep headless for pass/fail checks that only need the page to work. `--cpu-profile` is what answers "what is it spending time on" (V8 self time; resolve the `wasm-function[N]` names with `node tools/func-index.js N`), and `--guest-key=VK@atSec:holdSec` holds a guest key down *during* the sample, which is how you measure a scrolling map rather than an idle one.

**Check `uptime` before trusting any of it.** This box regularly sits at load 20-40 with several agent sessions running sweeps, and at that load the browser numbers measure the machine, not the emulator. `profile-web-frames.js` prints `loadavg` either side of every sample and flags anything above 4 for exactly this reason.

**Rule:** before adding a `console.log` to source, check that none of the above already covers it. If tracing a new primitive that isn't wrapped yet, add a `wrap(...)` entry to the `gdi` block (or the appropriate one) — that investment pays off on every future session. Source stays clean between sessions; tracing is a runtime flag, not an edit.

## Debugging a real iPhone (`tools/ios-selftest-server.js`, `tools/ios-eval.js`, `tools/ios-lab/`)

**Chrome device emulation is not iOS and cannot reproduce the phone-only bugs.** It has no
retractable toolbars, so `vh`, `svh`, `lvh` and `dvh` are all the same number there and nothing
about the scroll-to-collapse mode can be tested in it. Safari Web Inspector over USB needs the
cable and a Mac in front of the device. So the page talks back instead:

```bash
node tools/ios-selftest-server.js --log=/tmp/diag.ndjson   # serves the repo on 0.0.0.0:8099
# on the phone: http://<lan-ip>:8099/?diag=1     (the app, instrumented)
#               http://<lan-ip>:8099/tools/ios-lab/   (the lab, no emulator in it)
node tools/ios-eval.js 'innerHeight'                       # a REPL into whatever page is open
```

- `lib/phone-diag.js` is inert without `?diag`. With it, the page posts a snapshot twice a second
  and the server prints one line per *change* — verdict, plus `AUDIO` (context state, whether the
  clock is moving, analyser RMS, `navigator.audioSession.type`) and `SCROLL` (document vs viewport
  height, scrollY, touchmove count, and an `elementFromPoint` hit test on the swipe strip).
- `tools/ios-lab/` is four one-file pages with no emulator in them, each isolating one hypothesis:
  A plain document, B an invisible `200svh` spacer, C the app's exact shape (fixed full-viewport
  panel that eats touches + a swipe strip), D an inner scroller as the known-negative control.
  C's shape is query-driven (`?spacer=dvh|svh&gutter=N&right=N&autohide=0`) so one page A/Bs two
  layouts on the device without an edit. Each page names itself in the log.
- `tools/ios-eval.js` posts an expression, the page evals it and posts the answer back, and the
  server holds the HTTP response open so the shell command prints what the device said. This is
  how a candidate fix gets tried on the phone before it is written into `index.html`.
- `test/test-web-ios-lab.js` only checks the lab pages *load* — a page that throws halfway through
  its setup still shows a readout and still reports, which is worse than no reading at all.

**The unit matters and is the bug we already hit:** `dvh` is the *dynamic* viewport and tracks the
toolbars as they move, so a `dvh`-sized spacer grows mid-gesture and the scroll target runs away
from the finger. `svh` (bars visible) and `lvh` (bars retracted) are constants. Size overflow in
`svh`; test "are the bars down?" as `innerHeight >= 100lvh - 8`.
# Asset cache diagnostics

With `?debug`, asset fetches log `[asset-cache]` response metadata: path (without
query parameters), method, requested range, HTTP status, Cache-Control, ETag,
Content-Range, Content-Length, CDN cache status, and Age. This covers whole-file,
split-part, and range-provider requests without consuming response bodies or
changing fetch cache policy.

`browserCache: unknown: service worker hides cache attribution` means the page
cannot determine whether the worker's underlying fetch used the browser cache.
It does not mean caching is disabled. `cdnCache: HIT` describes the CDN response,
not a browser cache hit; headers themselves can also come from cached responses.
The logged Content-Length is response size, not proof of network bytes transferred.
Normal mode emits no asset-cache diagnostics.
