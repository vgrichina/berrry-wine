# AoWII black-ground producer boundary, 2026-11-06

Run: `scratch/runs/20261106-aow2-ground-producer/` (ignored, authoritative retained evidence).
Tested base main: `656ce5a22c21af79f055cb0b4edfc7f192acaefd`, plus the run's relevant binary diff and new-file patches. No guest code/data changes or rendering repair. The final publication SHA is in the run's `result.json`.

## Result

The first observed completed black-producing GPU operation is the **initial upload of an already-black offscreen terrain DIB**, before the first accepted draw on that target. The trace then identifies the offscreen-to-backbuffer BltFast boundary and the first black backbuffer upload. This advances the accepted late no-covering-triangle result to an earlier, named surface producer boundary; it does **not** identify the first instruction that wrote the terrain DIB or demonstrate an emulator divergence.

At native `[600,300]`, the first original GPU receipt is in `producer-0032.json.gz`, endpoint 1:

| Owner order / command | Operation and retained identity | Selected native / GPU result |
| --- | --- | --- |
| GPU 2 / sequence 1, ordinal 0 | Completed initial target upload, surface 65, rt 131807264, DIB 484888576, 1024×525, pitch 2048, bpp16, format1, rows `[0,525)` | Native `[0,0]` → GPU `[0,0,0,255]` |
| GPU 15 / sequence 8, natural legacy fence | Completed existing readback of surface65, rectangle `[0,116,1024,525)` | Named DIB still `[0,0]` |
| CPU 29462–29463 | BltFast entry at destination `(0,0)`, source65 → destination18; source DIB484888576, destination DIB479797248 | Source `[0,0]`; destination before copy `[66,8]` |
| CPU 29743 | Next retained destination18 Lock boundary after that copy | Destination now `[0,0]`; this is a boundary snapshot, not an API return receipt |
| GPU 17 / sequence 9, ordinal 0 | Completed initial backbuffer upload, surface18, rt131805760, DIB479797248, 1024×768, pitch2048, bpp16, format1 | Native `[0,0]` → GPU `[0,0,0,255]` |
| CPU 30108 | Primary17 presentation boundary after the opening dialog was dismissed, DIB478187520 | Native `[0,0]`; personally reviewed terrain capture is black at the selected ground |

CPU/GPU orders are separate partial orders. The natural legacy fences and named DIB transfer establish the interfaces above; receipt collection timestamps do not establish an instruction-level interleaving. BltFast source/destination coordinates are retained, and selected source `[600,300]` is valid for this `(0,0)` copy. Generic Blt source samples are **not** mapped source texels.

Surface65's allocation hook is CPU29383, before dimensions/backing initialization. No registered Lock/Unlock/Blt/colorfill destination event for surface65 follows that hook in the retained terrain interval. The first GPU read already sees zero. The CreateSurface source contains a normal non-aliased storage zero-initialization path; this trace does not capture its return, requested descriptor, or individual memory stores and therefore cannot attribute the missing intended terrain to that initialization.

## What was observed and what remains unknown

The original ran once from 05:10:26 to 05:20:25 UTC, with observation armed from endpoint setup, before terrain work. Eighty compressed receipt segments retain 61,790 accepted draw API calls, including 13 four-vertex TL triangle strips on surface65 and 61,777 on surface18; 35,965 actual GPU submissions; 48 selected-point uploads and 48 natural readbacks. All 96 retained upload/readback samples are native zero. No observed API decline, GPU clear, excluded GL replay, missing-legacy-source submission, or nontriangle submission was counted. There were no covering triangle records at this point across the early trace. These are counts of the observed routes, **not** proof that the game supplied no ground geometry.

There were no GPU event drops or observation errors. CPU earliest-event retention dropped 5,360 records in nine menu/load segments, indices18,21–23,26–30. The terrain allocation/first-transfer segment32 and subsequent terrain segments have zero CPU drops. `producer-boundary.json`, `first-terrain-cpu-window.json`, `presentation-boundary.json` and the compressed original segments preserve the bounds. No historical gap is filled by inference.

The registered CPU hooks cover DirectDraw allocation/release, Lock/Unlock, Blt/BltFast/colorfill entry, presentation/flip, execute-buffer traces and post-worker software draw traces. Raw guest DIB stores, GDI drawing, other unregistered trace kinds (including the Device3 pre-FVF kind15 boundary), earlier FVF/transform/clip rejection and other uninstrumented paths remain unknown. A source attribution beyond “already-black terrain surface65 DIB before its first GPU upload” requires observing those producers, with the surface's creation descriptor and generation. No guest-PC/asset blame, missing-ground-texel inference, or emulator repair is justified here. The accepted forest native1555/decode/GPU sample was not reused to infer ground texels. No unchanged late triangle-only probe was repeated.

## Passive controls and movement

The new opt-in producer observer wraps natural upload/clear/draw/readback/flip routes, retains owner command context, separates accepted/declined calls from actual submissions, and restores exact methods on disposal. Bounded drains do not request renderer fences, guest exports, writes, batch flushes or extra presentation. Observation exceptions stop observation; real renderer exceptions preserve their identity and propagate. CPU snapshots wrap the existing local `dx_trace` import in run-served worker setup; the ordinary import is still called once with unchanged arguments. Only the run-served setup/endpoint code arms it; default application launch remains disabled.

Before the original, `producer-controls.cjs` used the existing public COM texture rendered-contract fixture and actual owning CPU/GPU Workers on **both shipped modules**, disabled and armed. Each case completed 27 draws. Known public source Lock/write → Blt → target upload → covering draw → Clear7 → Lock/read passed independent native/GPU pixel expectations. Each armed case retained 67 CPU events and 57 GPU events without drops/errors. Armed/disabled pixels and draw/merge/fence/sync/fallback/error/upload/clear counters were identical. The pure observer regression also checks quotas/drains, immutable snapshots, absent-source/nontriangle and excluded-route classification, exact method restoration, source-DIB identity and renderer exception identity.

Reviewed ordinary screenshots: `army-base.png` shows six units and20/20; `confirmed-arrival.png` shows13/20; `south-plotted.png` and `final-world.png` show10/20 with the army moved. Captures were inspected before each next ordinary input. Some earlier clicks selected the city/army or adjusted a plotted destination rather than completing a move; the command/input/capture sequence is retained, and those labels are not treated as movement witnesses. No input implementation was changed. Audio and logical gameplay FPS were not measured.

## Validation and identities

- `node test/test-d3dim-draw-trace.js`
- `node test/test-d3dim-gpu-batching.js`
- `node test/test-d3dim-gpu-points.js`
- `node test/test-d3dim-gpu-fallback-counters.js`
- `node test/test-d3dim-worker-parity.js`
- `flock /tmp/wine-build.lock bash tools/build.sh`
- Existing `test/test-d3dim-ground-diagnostic-web.js`, standard/compatibility armed and disabled: four covering records per armed case, independent pixel/counter equivalence PASS.
- Both-module actual public COM owning-Worker producer controls, plus the single reviewed original.

Standard module SHA256: `02ec4aba196559715635d21427fa08bd0e9e1d83aed734e3ff0df0cfca4f6d64`; compatibility: `73538a238b7083380178a7e7d5534f3aa3aa101bd51816eb1bf63104c442fb6f`. The original served standard module, with exact HTTP payload/worker transform identities retained. The observer source and both modules were identical at controls/preoriginal/endoriginal checkpoints.

Media stays in its existing directory: `test/binaries/win98-games-a-d/Age of Wonders2 demo-SW/extracted/`; `AoW2.exe` SHA256 `a10590e5dbd013d154b00ea53e66670f4e74d38ab33adb2523f0a662af8f89f7`. All1,064 existing path/hash references were verified. There are no source archives or media copies. A first command omitted required `--threads` and exited before any browser/server launch; its log remains. The corrected invocation opened the sole original browser. It exited normally, page errors were zero, and all ten console404 errors are retained rather than suppressed.

All four predecessor exact FINAL releases and independent cleanup were verified before the immutable 05:08:39–05:53:39 gate. No boxes, workers, deployment, guest patches or runtime retry were used. Final resource checks, artifact hashes, source patches and publication identity are recorded before `result.json`, which is written last.
