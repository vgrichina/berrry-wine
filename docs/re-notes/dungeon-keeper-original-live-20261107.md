# Dungeon Keeper original browser runtime, 7 November 2026

One original runtime rendered the game's credits, but the staged input driver
stopped before admitting any native input. Its first failure was
`actual owning renderer readiness timed out` at 14:02:26.826Z. This is a
concrete driver compatibility failure: the required D3D render Worker endpoint
never existed on this original software presentation route. It is not evidence
of an emulator crash. No dungeon, digging, or persistent change was reached.

Evidence is in `scratch/runs/20261107-dungeon-keeper-original-live/`.
I visually reviewed `review/passive-original.png`: original credits over the
rendered dungeon corridor, including Lead Artist Mark Healey and programming
credits. The passive capture was taken at approximately 14:02:22Z before
termination. It is diagnostic evidence, not a bound input-admission capture.
`review/passive-state.json` reports the registered `dungeon_keeper_demo`,
process 1000 running, two active guest threads, a 640×480 canvas,
`Win98Renderer`, no render ports, empty D3D statistics and zero native events.
The actual presentation owner was the page's Win98Renderer; its pinned source
creates a Canvas2D context. No D3D/WebGL render Worker existed. The WebGL UI
selection does not establish an active GPU game backend; hardware GPU identity,
FPS, audio and parity remain unmeasured.

The owned copy of the retained local driver raised its runtime disk guard from
1.5 GB to 2,000,000,000 bytes and omitted the already completed 167-path HTTP
qualification loop. No fixture controls or preparation tests were rerun.
The original route was
`/index.html?debug&candidates&no-log&gl-renderer=webgl&app=dungeon_keeper_demo`.
The 18-field postbinding identity/module/freshness checks, exact numbered ACK,
independently scheduled UP and sticky UNKNOWN rejection remain intact.
The driver never established its binding, so no input bypass was attempted.
The separate diagnostic used passive CDP page state and screenshot operations
only. No guest memory, clocks, configuration, callbacks or handlers were edited.

All retained source, module and media pins matched before staging. Runtime
source checkout was main `d5d4f01d262528c237d3206aa39e592cb959901c`.
The recovered executing module is SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`;
this identifies the actual module without claiming a fresh build at that SHA.
`runtime-pins.json`, relevant binary patches and owned helper patches provide
the recovery recipe. There is no source or media archive. The installed EXE
remains `4d3cd6a7866520f360288b08440e0f20379b4b39216a9576c388e42fcdf72c84`
and the original manifest remains
`97aa5b364ec66e0b31f91c76b7ac40c7ae59319ee2892246d6dc6d52dc5fb7eb`.
All 619 staged file pins were reverified unchanged at shutdown.

The single immutable runtime window was 14:01:23.074603Z–14:26:23.074603Z;
the first terminal failure ended it early. Immediate local free disk was
3,373,662,208 bytes, with subsequent sampled checks above the 2 GB floor.
The extra local background monitor did not survive its launching shell;
continuous local monitoring is therefore not claimed. The runtime's remote
2 GB guard remained installed. No floor violation was observed.

One UUID-idempotent POST created fresh box `bx_c8gd2p3h` at 14:00:52Z,
with original expiry 14:40:52.752Z. No old box was resumed, stopped or deleted.
Under this assignment's explicit shutdown delegation, the driver closed its
browser normally (Chrome exit 0), server, profile and input transport.
`retrieval-verified.json` verifies SHA-256 and length for 24 unique artifacts,
2,632,617 bytes, including the module, logs, capture and cleanup evidence.
Both runtime PIDs were absent, both HTTP/CDP ports closed, no profile/writer
lock remained, and native/held input was empty. A normal stop was requested
at 14:02:54Z; `boat-archive-state.json` confirms `archived`, with stop
completed at 14:02:55.910Z and `forced: false`. The archived box has no active
expiry; 14:40:52.752Z was its original running expiry.

No production source changed, emulator defect was demonstrated, regression
was warranted or full build was needed. Checks cover staged pin identity,
download SHA/length, cleanup, owned JSON/evidence containment and documentation
whitespace. The global evidence checker still reports an unrelated preexisting
Alice containment error and historical missing artifacts; the owned run has
no containment errors. This assignment is finished without retrying the runtime lane.

Next: qualify a driver binding for this actual page-owned software/Canvas2D
presentation path, preserving strict guest/module/page/canvas identity and
renderer continuity without requiring a nonexistent D3D endpoint. A separately
authorized original attempt can then review fresh pixels and use ordinary
native input to enter the dungeon and demonstrate consequential digging.
