# Remaining registered historical savers, 7 November 2026

Run `20261107-graphics-remaining-savers` covers original registered
`scr_architec`, `scr_jazz` and `scr_rockroll`, launched with ordinary `/s`
startup. This is a named rendering and bounded crash investigation; it makes no
historical 27-app membership or completion claim. OrganicArt and held lanes are
outside this run.

The tested main revision is `44b01c804e6a62c0d9e1808268dc25489b1e04e5`, with
the explicit `dirty-source.patch` and `new-source.patch` recorded in the run.
The dirty changes are two existing GL browser tests; new files include the
unwired WININIT helper and existing test/tool work. They are recorded for source
recovery, not claimed as saver fixes. Git supplies the source archive; no source
or media archive was created. The fresh runtime reconstructed the exact Git
revision and applied those patches.

All 20 entries in the coordinator's registered input pins matched. Independent
closure verification includes the complete available shared DLL directory,
fonts and runtime source: 1,375 pinned paths. The original executables all
import guest `d3drm.dll`; actual guest DLL load logs and response receipts are
retained. Builtin Win32 imports are distinct from original guest DLLs. Original
media stays referenced by existing paths and SHA-256, without copies in evidence.

The locked full build passed on fresh box `bx_xjtrug2j`. Standard module
SHA-256 is `e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`;
compatibility module is
`04acbb89f66ad9814836b5e2c34de659b518f4e1994f50c4ee8069c991f02f72`.
Both unique modules were recovered and hash verified before runtime cleanup.

The run-specific `sweep.cjs` reuses the prior saver capture helper with a fixed
1100×820 observer viewport and one browser guest at a time. Each case pauses
after browser cleanup for capture inspection before the next original launches.
Architecture and Rock & Roll capture at about 30/45/60 seconds; Jazz gets
60/90/120 seconds because its documented early scene is sparse. The ordinary
registered clock and scene inputs are retained; there is no guest memory write,
scene replacement, registry seeding or injected guest input. Samples precede
screenshots while the guest continues, so counters are interval evidence rather
than exact screenshot/frame correspondence.

All twelve app/backend/execution combinations have three personally inspected
compositor captures. All remain running at their final observation, with no
recorded escaped trap, unimplemented-API trap or page exception. This is bounded
scene coverage, not crash freedom beyond the observation windows.

| App | Backend / execution | Host slices, first → last | Owning WebGL draws, first → last |
| --- | --- | --- | --- |
| scr_architec | software / coop | 4696 → 9395 | unknown on direct software path |
| scr_architec | software / threads | 2296 → 4706 | unknown on direct software path |
| scr_architec | webgl / coop | 516 → 652 | 180 → 360 |
| scr_architec | webgl / threads | 394 → 416 | 143 → 315 |
| scr_jazz | software / coop | 10739 → 21328 | unknown on direct software path |
| scr_jazz | software / threads | 7145 → 14183 | unknown on direct software path |
| scr_jazz | webgl / coop | 150 → 249 | 114 → 212 |
| scr_jazz | webgl / threads | 45 → 56 | 95 → 190 |
| scr_rockroll | software / coop | 3805 → 7539 | unknown on direct software path |
| scr_rockroll | software / threads | 2400 → 4445 | unknown on direct software path |
| scr_rockroll | webgl / coop | 499 → 625 | 205 → 404 |
| scr_rockroll | webgl / threads | 383 → 394 | 101 → 202 |

Host slices are execution observations, not guest instructions, frames or FPS.
Threaded cases also record increasing owning guest Worker slice counts and
execution/RPC activity. All software cases select software, have no owning
WebGL executor and visibly change the guest scene; direct WAT raster draw
completion counters are not exported. WebGL cooperative samples inspect the
owning `D3DIMGpu`; threaded samples inspect the owning render endpoint's
`d3dStats`. All six WebGL cases report zero errors and fallbacks; threaded
receipts additionally report zero completed software/fallback draws. Actual
WebGL provider is ANGLE Vulkan SwiftShader, not a physical GPU measurement.

Architecture shows a textured marble interior with the green central structure
changing orientation, spacing and extent against the same columns, steps and
seats. Jazz shows recognizable lit white notes changing orientation,
arrangement and extent on black. The cooperative scenes remain compact within
this window; the threaded scenes contain larger foreground notes. This does
not compare equal guest time or establish a growth-rate difference. The
documented sparse early Jazz scene is not treated as a rendering failure.
Rock & Roll shows guitars and picks changing pose, placement and apparent
distance against the fixed sunset gradient. Dark faces, patches and texture
edges remain uncertified without a matching reference.

Every capture is included in `visual-review.json`. `named-case-audit.json`
links captures, module receipts, owning counters and providers. Presentation
geometry is identical across each case's three samples; screenshots retain the
fixed observer dimensions. `scene-pixel-observations.json` measures scene-only
changes separately from the desktop/log. These corroborate the visual object
review and do not establish timing or parity. No supplemental browser observer
was attached and no observer resize recovery run was needed.

The response audit matches all 1,895 captured successful bodies against pinned
runtime or exact Git bytes, with zero mismatches. DevTools could not return 45
additional individual response bodies; those deliveries are not independently
hash-certified. Pre/post server closure hashes do not remove that limitation.
All twelve instantiated main/posted Worker module receipts match the standard
module. UI/optional lookup 404s and ANGLE readback performance warnings remain
in logs; this is not a warning-free run claim.

Environment is Chrome 151.0.7922.71, Node 24.22.1, Puppeteer 25.7.0 and
cross-origin isolation. `npm install` removed two stale root native-GL
dependency declarations from `package-lock.json`; the exact two-line metadata
patch, updated lock hash and installed package report are retained in
`retrieved/npm-lock.patch`, `npm-lock-pin.json` and `npm-installed.json`.
The 1,375 runtime pins plus 166 supplemental Git paths pass postflight, with
that explained lock metadata patch explicitly accounted for.

Focused checks passed: `test/test-d3dim-lit-alpha.js`,
`test/test-d3dim-execute-buffer-slots.js`, and
`test/test-d3dim-gpu-fallback-counters.js`. No new implementation defect was
demonstrated, no repair was attempted and no old-failing regression is claimed.

All 180 recovered runtime artifacts (12,814,803 bytes) and both unique modules
were retrieved and SHA-256 verified before the delegated normal nonforced box
stop. Postflight records all 15 named processes absent, no live browser/helper
processes, both HTTP ports refused, all twelve profiles and their locks absent,
empty input queues, no held mouse buttons and no injected key events. No
stopped box was resumed; no public service was deployed.

Box `bx_xjtrug2j` completed the explicitly delegated normal nonforced stop at
`2026-11-07T09:13:53.314Z`: state **archived**, active expiry `null`, stop
`stop_6f710eae0205de96` completed with `forced: false` and no error. Its original
scheduled expiry was `2026-11-07T09:25:46.381Z`. Box/snapshot custody returns to
the coordinator. Recovery uses the exact Git revision, retained patches,
runtime pins, existing original-media paths/hashes, run helpers and recovered
modules. Metadata is published last in `result.json`.

Remaining limits are FPS, timing, audio, same-frame backend parity, native
Windows reference correctness, complete saver cycles, visual edge/texture
correctness and the historical membership census. OrganicArt still requires
authentic installation inputs and was not substituted into this run. Further
work should address those specific prerequisites or matching reference scenes;
these twelve named bounded cases need no immediate rerun.
