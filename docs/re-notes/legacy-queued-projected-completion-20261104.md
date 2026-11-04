# Supplied projected texture: queued and compatibility WebGL completion

The corrected fixture from `ee3d94a31c34914d5903c1d966b7dfc2a5e75ed2`
now passes its complete rendered matrix. This closes the outstanding browser
checks in [the prior pixel investigation](legacy-projected-webgl-pixels-20261104.md).
No additional production defect was demonstrated; the fixture, production code,
independent rational q/w and quotient-derivative mip oracle, tolerance 2, samples
and fault controls were unchanged in this continuation. PROJECTED remains clear
in the actual public capability descriptors.

Evidence: `scratch/runs/20261104-legacy-queued-projected-completion/`.
The exact tested source commit is
`65438de076e5a16458c9bc3b88db7512314b57dd`, with relevant uncommitted hunks
recorded in `relevant-before.diff` (empty). `source-seal.json` records all 42
source, fixture, module and media SHA-256 pins. Git is the source archive.

## Rendered results

One Chrome 151.0.7922.108 process ran on assigned `bx_9n42uwvf`, from
**07:36:18.017Z to 07:37:40.613Z**, and closed normally. The explicit
`LEGACY_PROJECTED_HARD_CLOSE` was `2026-11-04T07:52:00Z`; the 14-minute
runtime ceiling was also retained. No repair wait or retry was needed.

| Module | Route | Cells | Draws per cell | Observations per cell |
| --- | --- | ---: | ---: | ---: |
| canonical | direct WebGL | 4 | 20 | 66 |
| canonical | owning Worker WebGL | 4 | 40 | 121 |
| compat | direct WebGL | 4 | 20 | 66 |
| compat | owning Worker WebGL | 4 | 40 | 121 |

Each group contains direct/indexed public Draw × WebGL1/WebGL2. All **16
positive cells, 480 Draws and 1,496 observations pass**, including 136
clipped-away Clear samples. Every observation uses
synchronous public Surface7 Lock; the direct cells additionally compare actual
GL readPixels. Worker observations require the real legacy WebGL endpoint,
zero errors/fallbacks and zero native/fallback software Draw completions.

Each Worker cell includes ten held production batches: capture a projected
Draw, mutate live TEXTURE0 and disable projection through public COM, then
deliver the captured batch and check all old-state samples before rendering
and checking the new state. Across eight Worker cells that is 80 held pairs,
including independent geometric w, nonconstant texture q, near-clipped Clear
pixels and mip scales selecting levels 1–4. The stable interior post-mutation
samples and analytic 1/16-pixel displacement checks from the predecessor are
now rendered successfully. Every original projected and clipped sample stays.

The five semantic controls each reject with a rendered **PIXEL ORACLE**
mismatch on canonical WebGL1 and WebGL2: ten rendered rejections total.
They preserve successful public Draw and GPU staging. The live-matrix control
uses the owning Worker; the other four use direct WebGL.

| Fault | Actual RGB at rejection | Expected RGB |
| --- | --- | --- |
| ignore projection | 60,70,30 | 20,70,65 |
| divide before interpolation | 20,70,65 | 60,70,30 |
| suppress mip selection | 20,25,30 | 59,101,92 |
| omit near clipping | 60,70,30 | 11,22,33 |
| consume live matrix after capture | 20,25,30 | 60,70,30 |

Both versions produce the listed mismatches. `counts.json` records each cell
and rejection. The closed `result.json` retains public call results, synchronous
RGBA arrays, endpoint statistics and injection hashes.

## Preflight, recovery and limits

Before Chrome, actual Puppeteer 24.31.0 CJS/ESM imports, retained dependency
lock, all staged file hashes, served source/module hashes and HTTP isolation
passed. Both actual modules passed public COM bootstrap and public Draw →
production adapter/compiler recording transport preflight. Existing module
and calc media paths matched their pins; no media or module was copied.
Only one small changed dependency, `lib/deusex-draw-observer.js`, was refreshed
to keep the retained Worker dependency graph pinned to the tested commit.

After normal closure all 42 pins were unchanged, Chrome was absent and the
fixture HTTP port was closed. `closed-process-pins.json` records this check.
`remote-artifacts.json` and `recover.log` verify sizes and full SHA-256 for the
unique closed artifacts. Evidence contains exact Git SHA, relevant binary diff
and the new note patch, with no source tree or media archive.
The four recovered closed artifacts total 126,930,956 bytes; `result.json`
alone is 126,917,519 bytes. A local audit checks every positive RGB against
the unchanged tolerance, its position in the retained 32×32 Lock array, direct
GL readback where available, Worker counters and all ten negative mismatches.
Three selected queued Lock arrays are encoded as `queued-readback-0.png`
through `queued-readback-2.png` and were personally inspected. These are exact
readback images, not canvas-export screenshots. The global evidence checker
reports unrelated existing containment errors; none names this run.

Focused depthless-Z, GPU batching, fallback counters, immutable command capture,
fixed TL plan cache, fixed-function shaders and retained fill-displacement
diagnostic pass. `--plan` passes its projection compiler and analytic margin
checks. `flock /tmp/wine-build.lock bash tools/build.sh` passes. No local browser,
second browser, game, deployment, lifecycle operation or subworker was used.

CDP identifies ANGLE/Vulkan SwiftShader (SwANGLE 5.0.0). Context unmasked strings
report Intel UHD 620/Mesa, as in the predecessor; the conflicting identities
are retained and do not support a physical GPU claim. Negative controls cover
canonical direct draws and the canonical queued live-matrix path; compat and
indexed fault variants were not run. Mixed programmed-pixel GPU linkage,
COUNT4, generated coordinates, other selectors/dimensions, singular/nonfinite q,
wrap/fog combinations, physical hardware and games remain unqualified.

The assigned box is left **RUNNING / API idle**, healthy and hydrated, expiry
**2026-11-04T08:04:15.847Z**. Browser, driver and fixture server are closed.
Shutdown custody returns to the coordinator. No further runtime is needed for
this requested matrix; broader capability qualification is outside this task.
