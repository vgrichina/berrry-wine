# Native capture latency: measured boundary, no original retry

The authored SDL fixture did not reproduce the terminal capture delay. No
production repair is justified by these measurements, so no fresh original
was launched. Puzzle8 clear, tally, Puzzle9 and ordinary Quit remain OPEN.
The previous endpoint remains permanently closed; it was never queried.

The retained operation began at 1794957923.10849 with its immutable three-second
deadline. Post-release progress was saved at 1794957924.5131106. The controller
then unconditionally sleeps 1.2 seconds before requesting its snapshot and PNG.
That leaves **at most 395.38 ms** for both requests. The PNG file mtime is
1794957926.232329, after the deadline; mtime is not HTTP completion evidence.
The fixed sleep demonstrably spends the operation budget, but neither capture
request time nor ingress, queue, rendering, encoding or response times were
recorded. Removing the sleep without an affected causal reproduction would
claim more than this evidence supports. All existing limits remain unchanged.

The public live `png:` command is parsed and queued for scheduled batch work.
The PNG action repaints, then `canvasToPng` invokes presentation and repaint,
encodes the entire canvas and writes it synchronously. `settleLiveInput`
resolves removed scheduled actions; the production control server then serializes
and ends its response. The retained log establishes that the PNG action ran,
but cannot partition request-to-dispatch or dispatch-to-response time. The
potential duplicate repaint is source structure, not a measured original cause.

A small authored native consumer loaded the authentic SHA-pinned SDL.dll,
called SDL_Init/SetVideoMode(640,480,16), FillRect and Flip, then captured the
whole 1024x712 desktop using the production renderer, encoder, synchronous file
write and HTTP control server. This is direct authored capture dispatch; it
does **not** reproduce test/run.js's guest batch scheduling, dirty DirectDraw
presentation hook, original scene, original module, or original load. It cannot
exclude an original-only scheduling/presentation delay. No private game or SDL
surface internals were read. The public SDL_Rect is an authored input.

Three initial successful observer-off/on/off runs took 44–86 ms end to end.
The instrumented handler spent 9.7–15.6 ms repainting, 36.9–56.5 ms encoding,
and 0.39–0.74 ms writing. A runnable relocated fixture repeated off/on at
40–150 ms end to end: repaint 8.2–22.8 ms, encode 28.2–90.4 ms and write
0.33–0.62 ms. The HTTP phase observer recorded response-finish for every
instrumented request. These ranges do not establish zero observer overhead.
All twenty captures decoded to identical full-screen pixels; only one selected
whole image per successful process is retained, with no frame series. The
selected image was personally reviewed as an SDL window of colored rectangles.
Offline re-encoding of the retained original whole PNGs took 42–94 ms for the
entry confirmation and 46–66 ms for the initial board, with identical decoded
pixels. Offline timings do not measure the old runtime interval.

The first local helper failed because its copied VM setup lacked the current
host's require binding. Adding createRequire(host.js) repaired the helper;
this failure is retained separately and is not a game/runtime defect. The
fixture remains a small run-specific input in evidence, not a production test.
No tool/lib/source changes or canonical build claim are made by this task.

An independent observable watchdog was armed before each of six native child
processes, including the failed helper. Every native and watchdog process was
actually waited with stdout/stderr EOF; the enclosing helper and invoking tool
also completed. Each successful SDL child called SDL_Quit and remained physically
UP; no input was injected. Watchdogs were disarmed without firing. No box was
created: ID null, state NOT_CREATED, expiry null, stop receipt N/A. Free /home
remained above 1.5 GB. Foreign WIP and held investigations were preserved.

Evidence is `scratch/runs/20261117-lmarbles-native-capture-latency-puzzle8/result.json`.
Git SHA, relevant working diffs, module/source/media hashes and selected named
whole PNGs are recorded there; no source archive or media copies were made.
The concrete blocker is missing original capture phase timing plus lack of an
authored reproduction of that interval. Further work needs a causal authored
reproduction before a tested repair can authorize the conditional original.
