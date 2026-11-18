# Native startup stabilization and three RM moving scenes, 2026-11-17

Run: `scratch/runs/20261117-rm-startup-geometry-architec-geometry-paired/`.
Helper published on main: `0aba2d17a`, strict pull/push passed.

| Fresh registered original | Reviewed whole-frame result | Changed whole pixels |
|---|---|---:|
| scr_architec / WebGL | Textured architecture and rotating green mechanism | 179,960 |
| scr_geometry / software | Gold structures rotate and regroup over a blue background | 76,340 |
| scr_geometry / WebGL | Gold structures rotate and regroup over a blue background | 135,406 |

Exactly these three originals ran, serially, without guest input. Two meaningful
whole lossless 1280×960 frames were reviewed for each. No accepted Viewer/software
or ARCHITEC/software original was rerun. Full27, backend parity, FPS and audio
remain open.

## Ordinary startup before inspector binding

An authored actual native Device2 program uses ordinary public DirectDraw mode
selection and a delayed first Flip. The owner connection records the initial
1280×960 backing and unpresented canvas before native readiness. Before any
secondary inspector connection, the native startup changes backing to 640×480
and presentation to 1280×926 at y=34. Viewport, visual viewport and DPR remain
1280×960 and 1. The eventual whole image visibly contains the expected blue
rectangle on white. Attachment, disconnect and capture preserve the settled
geometry and native generation. This proves that ordinary native startup can
produce the prior transition; the cause of the closed historical original is
not retroactively attributed to either startup or its inspector.

`InspectionScope` in `tools/inspection-window.cjs` performs finite read-only
pre-binding stabilization. It requires a completed native presenter publication
and an ordinary composed display containing the live window, then 300 ms of
unchanged geometry. Polling is 100 ms, with a 15-second default deadline and
bounded change-only observation records. An in-flight observation also has a
deadline. No dimensions, layout, repaint, ownership or generation are forced.
The baseline is established once. A used scope cannot bind again; a bound
mutation closes it. Whole captures compare against that same baseline before
and after capture and retain the existing viewport, native generation,
ownership and whole-PNG extent guards.

Focused tests cover changing startup, never-stable and never-ready timeouts,
stalled observations, post-binding refusal before screenshot, generation
mutation, repeated binding refusal and incomplete PNG refusal. Existing native
driver/oracle/ownership/UNKNOWN controls pass. The canonical locked build passes
(2,408,676-byte module, no data overlap). The authored native control preceded
the final deadline/dedup refinements; those refinements have focused tests and
all three fresh originals use the published helper exactly. The shared-tree
canonical build remains distinct from the published original module.

## Exact graph and execution evidence

Every fresh original uses published source
`3ab982f2d53a2beb354afe06ed3887860b716ad6` and existing module SHA-256
`06eaa397b64a453ca830b39dad70d63e409bd2f3d2d6bd586687eb0bef541023`.
Actual browser/guest/render-worker module bytes, published source, passive
observer suffixes, HTTP responses and registered executable/scene/texture media
are hash-verified. Media remains at its existing path; no media copy or edit.

Native `d3drm.dll` load/import and DirectDraw receipts accompany actual
`d3dim-gps` endpoints and completed executor PRESENT records:

| Original | Actual executor | DRAW_UP, early → later | PRESENT, early → later |
|---|---|---:|---:|
| ARCHITEC/WebGL | GpuStreamWebGL | 4,967 → 11,191 | 180 → 432 |
| GEOMETRY/software | GpuStreamSoftware | 406 → 757 | 23 → 50 |
| GEOMETRY/WebGL | GpuStreamWebGL | 3,724 → 8,732 | 181 → 445 |

These counts establish execution, not frame rate. Per-call original Device2
traces are not captured. Matching authored Device2 pixel/ownership controls
remain separately labeled reused controls. The published creation repair,
native counterexample, negatives, locked-build proof, nonresizing inspector,
native 285,671-pixel agreement and accepted moving scenes are reused by hash;
they are not relabeled as newly run originals.

## Lifecycle and remaining scope

All four native/browser scopes finish with native exit 0, actual native waits
and both EOFs, awaited browser shutdown, watchdog waits/EOF, and durable
enclosing command/watchdog parent waits plus separate EOFs. Independent deadline
watchdogs were armed before execution and did not fire. The final caller shell
exits 143; its independently owned original continues to normal completion,
with durable receipts proving command and watchdog exit 0. No relaunch, rebind,
later endpoint request or replay follows that caller exit. Known scoped PIDs
and listeners are absent. Browser shutdown is not a native File/Quit claim.

Only seven named selected whole PNGs remain, including the authored frame;
duplicate source/output copies were hash-compared and the duplicate removed.
`result.json` is written last with exact Git, relevant diffs, source/module/media
references and artifact hashes. Foreign WIP is preserved. No archives, frame
series, media copies, workers, boxes, deployment or held-investigation reads.
Home remains above 1.5 GB; no RAM gate. Box ID null, state NOT_CREATED, expiry
null, stop receipt N/A.

The requested startup binding and three paired-motion cases are complete.
Broader corpus coverage, backend parity, FPS and audio remain separate open
work. Release and stop; no further original is authorized by this report.
