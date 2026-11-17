# Boids renderer-held display capture, 17 November 2026

Evidence: `scratch/runs/20261117-boids-held-display-capture/`.

The prior launcher and Codex child disappeared without final launcher receipts.
Their joins remain UNKNOWN. The retained November 16 run-level results are not
rewritten; no old endpoint was requested and no inherited process was signalled.
Exact recorded native/browser/watchdog PIDs were checked read-only; absence is
not a wait receipt or proof of a clean launcher exit.

An authored public-COM PE running on an actual guest Worker reproduces the old
capture refusal without any host pending flag. At publication 219 the actual
request had writerHeld=true, gdiPaint=0 and repainting=false, with dirty,
lockDeferred and presentDue all false. The published renderer refused the first
capture. Native/browser/watchdog closure records are retained for this new
fixture, separately from the missing inherited launcher join.

The renderer now retains the existing single cancellable capture ticket when
an executing writer or in-flight paint prevents immediate observation. It
schedules no repaint, flush, guest work, idle transition or hold release. Only
an ordinary subsequent unheld composition, successful display and complete
readback can complete the ticket. Existing source, window, process, instance,
viewport, opacity and readback validation remains in force. Renderer-only
requests record immutable boolean boundary predicates alongside the existing
host pending flags; these identify why the request waited and do not certify
an engine frame. Completed pixel arrays remain detached copies.

The shared original/fixture driver now enforces a 3000 ms immutable completion
and delivery bound. All source, media, compiled module and observer suffix
preparation precedes the separate fixed 300/320 second runtime/watchdog clocks;
preparation retains fixed 240/260 second bounds. No input or full-host input
admission changed. The registered application has 38 distinct paths (EXE plus
37 media files); counts always identify paths per runtime rather than asserting
152 distinct registry paths.

Early corrected software and requested-WebGL Worker fixtures passed their entire
literal source/output pixel oracle. Their later extended fault inventory was
not qualified: some faults expired at readiness before reaching the intended
capture fault. A stricter attempt correctly failed that condition. The final
harness requires each intended fault to be reached; it runs the destructive
missing-guest readiness control last so it cannot invalidate later controls.
These authored fixtures are not original game observations or GPU geometry proof.

The focused endpoint/driver/census/transport/draw-trace/decoder suite passes 32
tests. The source-lifetime fixture fails its historical baseline assertion:
source-writer-missing-stamp rather than source-writer-epoch-changed. Replacing
only the renderer with the prior Git renderer produces the same failure; it
is not silently counted as passing. The separate legacy close-pending fixture
requires absent lib/d3dim-gpu.js and cannot qualify context loss here. Its
ENOENT failures are retained. General source ownership remains pending.

Final corrected software/actual-Worker and requested-WebGL/actual-Worker
fixtures pass one complete literal frame each, at publications 121 and 91.
The selected boundaries both have writerHeld=true with all three host queue
flags false. Hold release alone returns no data: completion is the following
ordinary publication and complete readback. Both outputs were personally viewed.
Eight software and nine WebGL native-host fault checks reached their intended
readiness/capture stage and refused. The stream-loss negative sets the native
host bridge failure state; it is not a physical WebGL context-loss experiment.
Both parents and independent watchdogs returned 0 with both pipe EOFs; Chrome
returned 0. No original game, hardware geometry or GPU parity is proved by these
native literal fixtures.

Canonical flock build passed twice after the anchored renderer review. Actual
WAT producer identity and DirectX layer tests pass, including stale source,
owner, page, overlap, poison, viewport and compositor controls. Final endpoint,
driver and census tests pass 22/22. The canonical build covers the shared tree;
native fixtures and originals use only recorded Git plus the owned capture
overlay, excluding foreign shared WIP.

Publication and the two authorized fresh originals will be recorded below. No original has been launched at this report checkpoint. The
unchanged successful software/cooperative route and the different complete
paused/black WebGL/cooperative boundary are not rerun or claimed repaired.
