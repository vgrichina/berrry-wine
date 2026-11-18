# JAZZ paired motion; ROCKROLL startup scopes closed, 2026-11-18

Run: `scratch/runs/20261118-rm-jazz-rockroll-paired-rendering/`.

| Fresh registered original | Reviewed result | Changed whole pixels |
|---|---|---:|
| scr_jazz / software | White musical shapes rotate and regroup on black | 35,274 |
| scr_jazz / WebGL | White musical shapes expand, rotate and regroup on black | 46,153 |
| scr_rockroll / software | UNKNOWN, closed before inspection baseline | No frames |
| scr_rockroll / WebGL | UNKNOWN, closed before inspection baseline | No frames |

Exactly four originals ran serially, using ordinary registered assets and `/s`,
without guest input, media copies, configuration/state/clock edits or forced
dimensions. Each successful JAZZ case has two reviewed whole lossless 1280×960
frames. Four named whole PNGs remain after byte-identical source/output
duplicates were verified and removed. No accepted Globe, Viewer, ARCHITEC or
GEOMETRY pair was rerun.

Both ROCKROLL cases reached native RM startup but the unchanged 15-second
prebinding stabilization deadline expired. Neither scope established a baseline
or attached a secondary inspector, and neither produced an admissible image.
The saved logs show native `d3drm.dll` load/import and ordinary DirectDraw calls;
the browser error arrays are empty. There is no proved public API/render crash,
and no renderer repair is claimed. Timeout observations were attached to the
helper exception but were not serialized by the existing outer harness; the
exact readiness/geometry condition at timeout remains unknown. No later
endpoint inspection, rebind, relaxed guard or replay followed closure.

## Exact execution and reused controls

All four originals served source `3ab982f2d53a2beb354afe06ed3887860b716ad6`
and the existing module with SHA-256
`06eaa397b64a453ca830b39dad70d63e409bd2f3d2d6bd586687eb0bef541023`.
Actual page/guest/render-worker module bytes, source graph, passive observer
suffixes, successful HTTP responses and ordinary registered media are hash
verified. Media stays at its existing paths and is hash-checked after execution.
Incidental missing icon, optional typelib and local DLL probe requests are
retained as non-200 records; they do not prove the timeout cause.

| Original | Actual executor | DRAW_UP, early → later | PRESENT, early → later |
|---|---|---:|---:|
| JAZZ/software | GpuStreamSoftware | 6,490 → 10,010 | 118 → 181 |
| JAZZ/WebGL | GpuStreamWebGL | 5,462 → 8,635 | 99 → 156 |

These completed executor records establish execution, not FPS or backend
parity. No completed executor trace was captured for the closed ROCKROLL
scopes. Original per-call Device2 traces were not captured. Reused authored
Device2 controls remain separately labeled; they are not original traces.

The exact published `0aba2d17a` helper retains finite completed-present and
stable-geometry startup admission, one baseline, unchanged whole-image/owner/
generation guards and nonresizing inspection. `ae10d9c42` nonresizing inspection,
native pixel agreement, creation counterexample/negatives, focused tests and
locked canonical build proofs are reused by hash. No new canonical build or
product code change was needed or performed in this task. Historical closed
geometry refusals remain separate and are not explained by these fresh runs.

## Lifecycle and remaining work

All four scopes have actual native-command waits and stdout/stderr EOF,
awaited browser shutdown, independent prearmed watchdog waits/EOF, and durable
enclosing command/watchdog actual-parent waits with separate EOF records.
JAZZ exits 0; both ROCKROLL harnesses exit 1 for the stabilization refusal.
No watchdog fired; known scoped PIDs and listeners are absent. The submitting
JAZZ/WebGL shell exited 143 while independent custody continued to normal
completion; this did not trigger a replay or endpoint request. Browser shutdown
is not a native File/Quit claim.

The four originals were launched before the newly supplied JavaScript-only
policy. Their small, actually used Python launch inputs are retained solely as
execution evidence. No further Python helper was invoked after that policy
arrived. Remaining validation, reporting and publication use JavaScript.

`result.json` is written last with exact Git/diffs/source/module/media references
and hash-verified artifacts. Foreign WIP and the starvation worker's owned paths
are preserved. Home remains above 1.5 GB; no RAM gate. No archives, frame series,
bundles, media copies, workers, boxes, deployment or held-investigation reads.
Box ID null, state NOT_CREATED, expiry null, stop receipt N/A.

The goal of meaningful rendering on both backends for both apps is incomplete:
JAZZ passes, while both ROCKROLL scopes are closed UNKNOWN. Further ROCKROLL
original execution requires fresh authorization; the unchanged startup admission
failure needs investigation from retained evidence first. Full27, backend
parity, FPS and audio remain open. Release and stop.
