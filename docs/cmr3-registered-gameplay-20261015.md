# CMR3 registered original replay, 15 October

The original demo reaches its animated title and main menu in the software CLI.
Selecting Stages then encounters an unsupported software D3D9 line-list draw.
No race, responsive driving, audible sound, logical FPS, or browser launch is
qualified. The movie contains visible rectangular artifacts. The last displayed
road is a menu video, **not a racetrack gameplay capture**.

## Exact run and controls

Sole remote box `bx_9ef2wdsw`, checkout `/home/user/cmr3-fresh-checkout`, clean
source `dc0611212344ef3778652f4aff5e6c407be5c895`, regular canonical module
1,803,164 bytes / SHA-256
`02b41f090dacdb461ea0b59a77260d6c17432e9d3993d4cc8878cb76a865a33d`.
The controller verifies all 6,505 tracked source files before/after, all 302
original files and twelve authentic native dependencies, and the exact newly
generated registry/profile from `cmr3-fresh-registration-result-20261015.json`.
The real profile is mounted at `C:\WINDOWS\WMSysPr9.prx`. Common native DLL
search contains no binaries. Original assets, registry and native files are
unchanged after the run.

`tools/cmr3-registered-gameplay.js` is the tested bounded controller. It requires
the specific remote checkout and recovered paths; it does not build or download.
Node v24.18.1/linux x64; CLI software D3D9 programmable; cooperative guest
threads; 640x480; 200,000 blocks/batch; synthetic guest clock 200 ms/batch.
This is not equivalent to browser Worker/WebGL execution. No actual HTTP/page
module digest applies to this CLI run. Audio and logical FPS are unknown.

Process 58821 started `2026-10-15T12:03:05.094Z`, child 58847. Guest deadline
540 seconds, controller hard deadline 590 seconds. Existing loopback control
at port 8137 accepted screenshot-informed ordinary keyboard events:

| Input | Executed batches | Observed next screen |
|---|---|---|
| Escape down/up, approximately 1 second | 410 / 418 | Title, PRESS RETURN TO CONTINUE |
| Return down/up, approximately 1 second | 683 / 693 | Main menu, STAGES highlighted |
| Return down/up, approximately 2 seconds | 1033 / 1054 | Last menu image retained; line-list rejection |

The commands were `node tools/ctl.js -s :8137 cmd keydown:27` / `keyup:27`,
then the same commands with `13`. Screenshots used the existing `ctl.js png`
command. No guest memory/state writes, forced menu transition, tracing patch,
fake DLL, or silent primitive omission was used.

## Concrete failure and next implementation boundary

The first explicit rejection is output.log line 821, after batch 1049, during
the second Return hold: `D3D9 software: only bounded point/triangle lists,
strips and fans are implemented (primitive=2, count=12, limit=256)`.
There are 14,259 repetitions through shutdown. Captures 05, 06 and 07 are
byte-identical. The second Return precedes the new draw failure, but this does
not prove which stage screen was being rendered or that fixing lines will be
the only remaining progression defect.

Source boundary: `Device.prepareBatch` in `lib/d3d9-software-backend.js`,
around lines 584–586, allows only `[1,4,5,6]`. Primitive 2 is a line list;
primitive 3 (line strip) is also rejected. `invalid()` throws a real error.
Exact vertex/index data, FVF/declaration, shaders, blend/depth/stencil and
texture state were **not captured**, so they must not be invented for a CMR3
regression. The existing truthful rejection should remain until real semantics
are implemented.

Relevant existing implementation and tests:

- `src/09ah-d3d-software.wat`, `$d3d_software_line_inside` (~1036), implements
  wireframe edge coverage; it is not standalone line-topology support.
- `test/test-d3d-software-pipeline.js` tests independent Bresenham octants/ties,
  endpoints, wireframe interpolation, culling and clipping.
- `test/test-d3d9-software-backend.js` tests topology rejection and fixed/programmed
  draws, immutable snapshots, cancellation and owned allocations.
- `test/test-d3d9-software-bridge.js`, `test/test-d3d9-software-cli.js`, and
  `test/test-d3d-software-user-clip.js` cover adjacent integration paths.

An implementation must establish actual line clipping/interpolation/endpoint
and raster semantics, not remove the guard or substitute degenerate triangles
without proof. No production source was changed in this task.

Shutdown also reports eight abandoned parked Enter calls and three held critical
sections (owners T3/T6). Their causal relevance is unknown; preserved complete
logs avoid presenting the line failure as proof that all scheduler state is sound.

## Retained evidence and cleanup

Local reviewed evidence:
`scratch/runs/20261015-cmr3-registered-gameplay-r2/` in the shared repository.
Remote run has the same suffix below `/home/user/cmr3-fresh-checkout/scratch/runs/`.
Screenshots `01-startup.png`, `02-after-escape.png`, `03-after-return.png`,
`04-title-wait.png`, `05-stages-select.png`, `06-stages-wait.png`,
`07-line-list-failure.png`, and `final.png` were visually inspected by
`cmr3_registered_gameplay`. Screenshot bytes alone do not prove input/playability.
No matching corpus candidate ID exists, so `investigation.json` is published
last and no dashboard result is attached to another game.

Controller 58821 exited zero at `12:05:09.206Z`; child exited zero at
`12:05:08.897Z` after explicit harness quit on the identified failure. Source,
module and fixture postflight passed at `12:05:09.200Z`. Scoped remote process
inventory at `12:06:20.251Z` contains no runtime survivors; slot released to root.
Exit zero is cleanup success, not game success.

Two harness failures remain separately retained: 57376 stopped before guest
spawn because the scratch/runs parent did not exist; 57843 started without
pngjs and therefore without a renderer, and was immediately quit after detection
(child terminal zero `12:02:12.630Z`, no survivors at `12:02:33`). `npm ci
--omit=dev --omit=optional --ignore-scripts --no-audit --no-fund` installed only
the owning checkout's dependencies without changing tracked files. The corrected
controller requires actual 32x32 raster PNG encode/decode and renderer loading
before starting any guest. No game input was sent to the rendererless attempt.

Both run trees were transferred in a 1,578,749-byte tar.gz with SHA-256
`8d8d751d4fd7d89954f9b278471746477969f3b4e7f2438b62b08ba1c9c7248a`.
Independent per-file comparison verified 25 remote artifacts / 4,668,070 bytes
(including the later runtime postflight). Additional local process and capture
receipts are retained. Bulk game/native files stay remote; recover using the
committed original acquisition, assembly, native recovery and registration recipes.
The 2 GiB local free-space floor was preserved. Git stores controller/notes,
not these ignored binaries and evidence files.
