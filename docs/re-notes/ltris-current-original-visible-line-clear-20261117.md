# LTris original: input timeout before gameplay, 2026-11-17

The line clear, counter/score change and native Quit remain **unproved**. One
original LTris 1.2.8 process opened the main menu and Controls. The next ordinary
Player1 click hit the immutable 500 ms guarded-input transport deadline
(507.729 ms observed). Its result became permanent UNKNOWN. No board was
started, no later HTTP request was sent, and the endpoint was never rebound or
retried. A second original was not started.

Evidence: `scratch/runs/20261117-ltris-current-original-visible-line-clear/result.json`.
The six named whole screenshots include the original main menu and Controls,
and four authored-fixture route views. Fixture pixels are not original gameplay
or Quit evidence. Controls shows P Pause; the current original Player1 bindings
were not reached. No configuration, game state, media or clock was changed.

The independent Player1 release returned an actual ACK in 73.460 ms and its
child has an actual exit-0 wait and both EOFs. The timed-out DOWN has no retained
consumption receipt; its application is unknown. Process-identity-checked host
SIGTERM ended the original after 74.044 harness seconds. Native process,
watchdog, supervisor child and outer tool all have actual normal completion and
both EOFs. Host cleanup is **not native Quit**. The original observer also
received SIGTERM before cleanup and preserved its child wait through it. The
watchdog did not fire, the native group is empty and the control listener is gone.

## Published helper repair and validation

Commit `8f02407bd` publishes the previously released sealed runtime/control
helpers and native fixtures. The runtime accepts an explicitly retained module
path and records it. Its observer defers TERM/HUP until the bounded child wait
and pipe drains complete; it neither restarts the native nor changes its
prearmed deadline. A deliberate actual observer SIGTERM regression passes.
The SDL pointer fixture's missing VM `require` was reproduced and repaired using
a require rooted at host.js. This is a test-harness repair, not an SDL game fix.

Twenty policy cases, eleven native guard cases, missing-native-window refusal,
actual compiled-Module transfer/instantiation in a real guest Worker, the SDL
consumer test, the observer-loss test, and the complete authored native
Escape → Y → Back → Quit route pass. The final canonical
`flock /tmp/wine-build.lock bash tools/build.sh` has actual exit 0. The code
commit was immediately pulled and pushed. Initial fixture recipe mistakes,
a separate fixture bind timeout, and pre-repair outer termination 143 remain
recorded failures; they are not counted as passes or retried endpoints.

## Exact inputs and remaining boundary

The retained tested module is `tested.wasm`, 2,335,481 bytes, SHA-256
`533c599a144837890b6b45f6cbace2e52e9b4f48a3a8dd08b4261cd20223b1a1`.
It was retained before execution, then sealed for the actual compile and both
original guest Workers. Compiled-source Git, binary patch and unchanged source
input hashes are retained. All forty original client files, authentic CRT and
39 companion mappings passed verification; all 43 pinned execution-media,
manifest, CRT and ZIP records remained hash-identical afterward.

The original source transport selected exact Git
`95990aee32d4cd9f833857afba136d1d17681a5e`, excluding foreign runtime WIP.
The complete authored route had used `f3de75c048bf4471576f589de167244d560f587e`.
Concurrent published CLI child-observation changes landed between them; their
exact diff is retained and reviewed. That capability was never armed here,
and its transition branches are inactive without an arm. The complete route
was not repeated against the identical later CLI before original launch; this
qualification limitation is explicit. No cause is assigned to the 500 ms
original timeout without a reproducer.

No source tree, media bundle or frame archive was saved. Only result-named
screenshots remain. No worker or box was created; box ID null, state
NOT_CREATED, expiry null, stop receipt NOT_APPLICABLE. Free /home remained
above 1.5 GB. Foreign WIP and originals were preserved.

Next: isolate bounded native/SDL input latency on authored fixtures before a
separately authorized original attempt. This task stops at the concrete
UNKNOWN input blocker; no further original run is scheduled.
