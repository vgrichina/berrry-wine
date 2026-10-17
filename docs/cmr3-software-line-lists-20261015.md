# D3D9 software line lists — 2026-10-15

The original CMR3 demo's ordinary Stages selection reached a checked rejection
for `primitive=2, count=12` on production `dc0611212`, module `02b41f09…`.
The retained video remained the main menu; a stage screen or race was not
established. No draw payload, shader, FVF, stride, LASTPIXEL or antialias state
was retained. This change implements the rejected topology without guessing
those settings. The original game has **not yet been rerun with this change**.

## Implementation

`lib/d3d9-software-backend.js` accepts bounded LINELIST snapshots, validates
two source indices per primitive, and sets native topology flag 32. Polygon
fill and cull do not apply to standalone lines. Antialiased lines and LINESTRIP
remain checked errors; existing vertex/index limits remain in force.

`src/09ah-d3d-software.wat` clips an ordered pair against the six homogeneous
planes and enabled user planes, interpolating the complete vertex payload at
each intersection. POSITIONT retains its screen-space path. Each work record
keeps three ABI storage slots but only AB owns coverage: the third slot is
padding, not a degenerate triangle. Line topology bypasses polygon area and
culling. It shares the existing non-AA line coverage, reciprocal-W varying
interpolation, depth, shader, alpha, stencil, blend, and scissor operations.
LASTPIXEL controls the terminal endpoint of each directed line.

Microsoft's [D3D9 rasterization rules](https://learn.microsoft.com/en-us/windows/win32/direct3d9/rasterization-rules)
specify GDI coverage for non-antialiased lines. Its
[outline and fill documentation](https://learn.microsoft.com/en-us/windows/win32/direct3d9/outline-and-fill-state)
describes LASTPIXEL. Existing wireframe coverage is reused; this work does not
claim an independent hardware oracle for every fractional-coordinate tie.

## Actual validation

All runtime work was sequential on `bx_9ef2wdsw` in the independent checkout
`/home/user/cmr3-software-lines`. No game or browser was launched. Existing CMR3
and Kkrieger checkouts and canonical modules were preserved.

- Owner `66708`, 12:17:55.697–12:18:33.401 UTC, exit 0: canonical build and
  `test-d3d9-software-backend.js`, `test-d3d-software-pipeline.js`,
  `test-d3d-software-user-clip.js`, and
  `test-d3d-software-resumable-setup.js` all passed on
  `579c1eeead52cbf731a65312ff2b31633945fae0`.
- Owner `68983`, 12:21:02.762–12:21:18.159 UTC, exit 0: expanded backend test
  passed on `750bc13fd07a59dfed1e49b19533a561ffea1208`. This commit changes
  only the test; production/compiler sources and the canonical module are
  identical to the first run.
- Three separate mutant checkouts each failed the intended assertion:
  restoring the old topology guard, ignoring user planes in the line clipper,
  and copying the original varying instead of interpolating the intersection.
- The line cases exercise indexed/nonindexed pairs, all eight slope octants
  in both directions, zero length and reversed endpoints, 18 combinations of
  LASTPIXEL/cull/fill, homogeneous left/near clipping, enabled sixth user
  plane plus disabled/inside/outside controls, clip-generated color,
  reciprocal-W interpolation, fixed POSITIONT, scissor, depth rejection,
  programmed color, additive blend and stencil multiplicity at shared
  endpoints, and malformed/AA/LINESTRIP refusals without framebuffer writes.

Canonical module: **1,803,537 bytes**, SHA-256
`937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb`.
Both runs preserved all 6,512 tracked source hashes; separate local Git-blob
verification matches every tested file. The checkout was clean after testing.
Runtime postflight at **12:21:42.880 UTC** found no node/chrome/chromium/wine
survivors. The slot was released to the root agent for Kkrieger.

## Evidence and recovery

Local evidence is in
`scratch/runs/20261015-cmr3-software-lines/`, including owner receipts,
`validate.js`, `validate-r2.js`, extracted logs/source manifests/mutant diffs,
and independent Git-blob checks. Archives were copied back and hash verified:

| Archive | Bytes | SHA-256 |
| --- | ---: | --- |
| `r1.tgz` | 636334 | `1723a92385cbb831f3c82ea65e10f437fccb56f1b43e6f032d11e40faa9e4423` |
| `r2.tgz` | 635614 | `2af6e1dc485824807bc4472e7f7d99da1534528ad602bfef2612e8e4f5f24486` |

Rebuild the pinned source with `bash tools/build.sh`; run the four named test
files sequentially using Node. The expanded test and mutant recipes are
preserved in the second controller. Neither ignored compiled modules nor
these run artifacts are backed up by the source commit.

## Original-game replay handoff

Replay must wait for a fresh sole-runtime grant after the Kkrieger owner.
Use the existing original-game controller and original assets described in
`docs/cmr3-registered-gameplay-20261015.md`; substitute an independently staged
checkout containing this production change and the canonical module hash
above. Preserve the original 302-file inventory, native 12-file inventory,
the genuinely registered 972-entry registry (182940 bytes, SHA-256
`7e59a8770cf1c8d180943539247f3bd3dd5990f3e2eb1be91971250d2e9c7a54`),
and generated profile (316640 bytes, SHA-256
`95f1edbc3cb9aa70a374a61b43bd16818636b0190aa841504130bb718c39c2c7`).
Use ordinary screenshot-informed Escape/Return navigation and a fresh bounded
run/evidence directory; do not patch guest state or replay the previous input
batches as proof of reaching the same menu. Verify the newly loaded module,
record the first remaining renderer error, inspect actual visual progress,
and retain source/fixture/module pre/post hashes and terminal cleanup receipt.
Passing these renderer tests removes the known rejection; it does not prove
race entry, controls, audio, frame rate, or the absence of a subsequent blocker.
