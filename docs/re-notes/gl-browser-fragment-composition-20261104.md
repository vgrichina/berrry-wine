# Browser fixed-function fragment composition — 2026-11-04

`test/test-opengl-fragment-composition-web.js` extends the native alpha repair
`8fe71d6f0` and queued Node coverage `9800e74b3` with browser pixel coverage.
Run with the installed Puppeteer and Chrome; no package installation is needed:

```sh
GL_BROWSER_FRAGMENT_EVIDENCE=scratch/runs/20261104-gl-browser-fragment-composition \
  flock /tmp/wine-local-runtime.lock node test/test-opengl-fragment-composition-web.js
```

The test uses both existing shipped modules, public `LoadLibraryA` and
`GetProcAddress`, generated x86 PUSH/CALL/RET sequences, and ordinary GL calls.
The compiled WAT producer writes the actual shared command records. JavaScript
sets up the fixture and executes the x86 snippets; it does not synthesize GL
packets or substitute a rasterizer. Each public call checks bounded completion
and stdcall stack cleanup. The existing `calc.exe` only initializes PE/import
metadata; this is not a calculator application or gameplay test.

The browser route is `GuestRpc.createWorkerImports` / production main broker /
`GLRenderHost.Bridge` / shared packet leases / a physical browser Worker /
`GLRenderWorker.create` / `OpenGLHostBridge` / production `WebGLBackend` and
fixed-function shaders. The small test port forwards requests and ImageBitmaps;
its consumer scheduler holds the first packed draw and subsequent texture bind
within the production two-publication credit bound.
It imports the production endpoint rather than replacing its execution.
Platform imports unrelated to these operations are inert fixture services.

The physical process manager and `d3d-render-worker.js` endpoint factory are
outside this browser test's route. In particular, version selection here is
passed directly to the production `GLRenderWorker.create` endpoint. This does
not establish WebGL2 selection through the process-manager factory. The prior
Node test covers its different native software worker route.

Both WebGL versions are requested explicitly. The test records the actual
context class, context VERSION/renderer, endpoint version, and browser CDP
`SystemInfo.getInfo` GPU data. Chrome requests ANGLE SwiftShader: successful
coverage is browser WebGL implemented in software by ANGLE, not physical GPU
coverage and not the project's WAT or JavaScript software rasterizer. Context
creation failure fails the test; no software fallback is accepted.

The first full-screen draw applies RGBA MODULATE, half linear fog to RGB while
preserving texture-modulated alpha, then SRC_ALPHA/ONE_MINUS_SRC_ALPHA against
a nonzero RGBA destination. Before consuming that draw, the producer changes
the native texture binding and publishes the changed binding as the second
leased batch. Delivery is then released. Before the next draw, the producer
changes copied fog color and fog range, destroys the fog setter's scratch
contents, and changes blend factors to ONE/ONE_MINUS_SRC_ALPHA. The second
draw overlaps only the right half. Independent normalized equations
check every RGBA8 pixel, allowing three byte levels for shader/storage rounding.
Alternative calculations must differ visibly: reordered texture/fog/blend,
fog-modified alpha, missing texture alpha, missing destination, stale texture,
fog or blend state, reversed draws, missing first draw, and applying new state
to the old batch. A third draw uses DST_ALPHA/ONE_MINUS_DST_ALPHA to expose
stored destination alpha in RGB. The host's presented Worker ImageBitmap must
also match that witness's RGB; Canvas presentation alpha is not the RGBA
attachment oracle.

Evidence is under `scratch/runs/20261104-gl-browser-fragment-composition/`:
exact Git SHA, relevant binary diff and owned new-file patches; existing module
and PE paths/hashes; build/browser logs; small pixel results and captures. No
source snapshots, media copies, archives or invalid-pointer probes are used.

Validation: **PASS** all four module/version combinations, 101 public x86 calls
and 36 shared packet leases each, zero copied batches, actual endpoint closure.
Each case checks 64 pixels at three RGBA attachment stages and the presented
RGB witness. Representative left/right composition pixels are
`[114,68,172,116]` / `[231,56,109,194]`; the subsequent DST_ALPHA witness is
`[178,37,94,92]` / `[249,13,26,95]`. All eleven alternative equations differ
visibly. Screenshots show the purple/red witness halves; the main-module
WebGL2 capture was personally inspected.

Actual WebGL context classes and endpoint versions were 1 and 2 as requested.
CDP reports `ANGLE_SWIFTSHADER`. The page renderer string reports Intel UHD
620, so it must not be used to claim a hardware route. Both module and PE
hashes are in `result.json`; modules are referenced in place.

Three earlier fixture runs are retained separately. The first stopped at
shared-memory transfer because custom HTTP responses lacked isolation headers;
the fixture now sets them. Two runs reached real WebGL1 but the test scheduler
deadlocked its own queue: public x86 handlers publish individual calls, so
holding draw plus glFlush exhausted both credits before the texture bind.
The final scheduler holds draw plus texture bind instead. No production code
changed and no production defect was demonstrated. These are fixture repairs,
not browser or rendering regressions.

The final four-case run took 18.351 seconds; all four browser runs together
took 137.367 seconds, including startup and closure. Every root Chrome PID is
absent, all servers report closed, and the LOCAL lock was verified available
before release to the next game. No browser was started before both preceding
game turns explicitly released. The locked full build passed; native adjacent
composition regressions are recorded in the same run directory.

Box ID/state/expiry: NA. The coordinator retains future allocation and shutdown
ownership; this worker launches only its own local browser and loopback server.
