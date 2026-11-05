# Explicit-TRUE keyed mip formats and perspective — 2026-11-05

This advances D3D-LEGACY-TEXTURE-CAPS-AUDIT-20261013 beyond the XRGB affine
qualification in [the keyed mip repair](d3dim-keyed-mip-20261105.md).
`test/test-d3dim-keyed-mip-formats-web.js` demonstrates a perspective mip
footprint defect in the WebGL atlas sampler and covers the repaired behavior
through public guest x86 COM calls in both shipped modules.

## Demonstrated discrepancy and repair

On published main `500de599fa9e1839d090404f713f908fbe9b98ab`, explicit
`COLORKEYENABLE=TRUE` and `COLORKEYBLENDENABLE=TRUE`, RGB565, MIN LINEAR,
MIP LINEAR, RHW `[1,.25,.25]`, the public draw's sample `(20,1)` returned
WebGL RGBA `[88,92,91,148]`. The independently derived quotient footprint
at the existing GPU sampling position gives rho `7.653119835`, LOD
`2.936047990` and ideal alpha `155.617312230`, outside the permitted
filter-precision interval `[151.489166334,159.708369155]`.

An independent calculation using GL quad finite differences instead gives
rho `8.025685507`, LOD `3.004624624`, RGB `[88.299,92.309,90.828]`, alpha
`148.139087827`: it explains the observed wrong inter-level weight. The
unprojected atlas helper was differentiating already divided UV across a
quad. `lib/d3d9-shader.js` now differentiates affine `UV*geometricRHW` and
RHW, then evaluates the quotient derivative at the fragment, as the projected
atlas helper already does. `lib/d3d9-backend.js` binds that geometric RHW to
`solid_q` when lowering the optional solid transport; the rectangle's own
RHW of one is not the triangle's RHW. The correction applies to the common
unprojected mip atlas, including unkeyed uses. It adds no chosen LOD or CPU
sampling path. The repaired public sample is `[89,95,93,156]` in both modules.

`first-discrepancy.json` and its native-size capture preserve the first genuine
rendering failure. Earlier attempts remain separate: `first-runtime` exposed
an inadequate flat two-byte tolerance for composed fixed-point filtering;
`precision-runtime` exposed a nearest-mip fixture exactly at a half-level tie.
The final point fixture avoids half-level ties and asserts a margin. Neither
preparation failure is presented as another backend defect.

## Public fixture and independent oracle

The fixture CALLs acquired DirectDraw7, Surface7 and Device7 vtables. A guest
x86 EnumTextureFormats callback copies public DDPIXELFORMAT descriptors.
Only advertised requested formats are created as textures. Public enumeration
reports RGB565 and XRGB8888 as the requested non-alpha formats; X1RGB1555,
RGB24 and indexed8 are unadvertised. Their route checks release acquired
objects and attempt no requested-format texture creation or rendering.
An advertised-format creation failure is distinguished from rendering failure.
No formats or capabilities were added to make the test pass.

Each 16→8→4→2→1 image is acquired with GetAttachedSurface, locked, checked
for its own dimensions, native descriptor and aligned pitch, filled through
native bytes, unlocked and explicitly keyed. RGB565 pitches are 32,16,8,4,4
bytes. Padding uses a sentinel. Keys differ per image, including zero, native
interior values and `0xffff`; SetColorKey/GetColorKey roundtrip each singleton.
Public DirectDraw CKeyCaps is zero: COLORSPACE ranges are unadvertised, so
this is singleton endpoint/conversion coverage, not ranged membership proof.
Absent indexed8 advertisement means no new per-image palette coverage.

The oracle quantizes authored colors from descriptor masks and expands their
channel bits independently. Native key membership converts matching taps to
zero RGBA before interpolation. It derives U=u*RHW, V=v*RHW, Q=RHW, quotient
coordinates and quotient-rule derivatives from the authored triangle. The
maximum texture-scaled gradient determines log2 LOD. A hand-calculated
coordinate/gradient check and discriminating filter/state controls run before
rendering. No surface records, chosen LODs or renderer samples feed the oracle.

Ideal colors are retained alongside per-channel precision intervals. The
interval calculation propagates one 8-bit fractional weight step and byte
rounding through spatial/mip interpolation and application blending; its
bounds use authored taps, not observed pixels. Direct WebGL also checks alpha.
Software uses integer sample centers; GPU checks explicitly account for the
pre-existing fixed-function 1/16-pixel bias. Exact nearest-mip half-level ties
and hardware-specific filter precision are not qualified here.

## Results and validation

The final exact-source run is `verified-runtime` in ignored evidence directory
`scratch/runs/20261105-d3dim-keyed-mip-formats-recovery/`. It checks the SHA-256
of actual fetched Wasm bytes before compilation, disables HTTP caching and
records renderer source hashes. Both shipped modules use their existing
production exports; no new Wasm test exports or constructed surface records
are involved.

| Coverage per shipped module | Software | Direct WebGL 1/2 | Queued Worker WebGL 1/2 |
| --- | ---: | ---: | ---: |
| RGB565 observations | 35 | 35 each | 43 each |
| XRGB perspective observations | 20 | 20 each | 24 each |

Total: **598 rendered observations on 20 routes**, plus **30 unadvertised
format route checks**. XRGB cases are the new perspective cases, not a repeat
of the earlier 242-observation affine qualification. Checks include native
key conversion, MIN/MAG point/linear, MIP NONE/POINT/LINEAR, last-image clamp,
alpha GREATER-zero/EQUAL-255, source-alpha blending, key disable/restore and
varying-RHW mip selection. Worker held batches change live state before drain,
then verify the queued old state and a subsequent new draw through public Lock
fences. Each RGB565 Worker reports 27 draws; each XRGB Worker reports eight.
All eight Workers report zero errors, fallbacks and native/fallback software
draws. Direct GPU reads use readPixels; Worker pixels use production fences.

Validation includes the new public fixture, `test-d3d9-shader.js`,
`test-legacy-integer-center-interpolation.js`,
`test-legacy-solid-coverage-transport.js`, `test-d3dim-native-mip.js`,
`test-directdraw-mip-chain.js`, `test-d3dim-indexed-texture.js`,
`test-gl-software-raster.js`, actual WebGL1/2 `test-d3dim-gpu-mip-web.js`
(37 checks per version), `test-d3d9-shader-web.js`, and
`flock /tmp/wine-build.lock bash tools/build.sh`.
The additional count-selector `--plan` check fails with pre-existing
`ReferenceError: transport is not defined`; the same failure was reproduced
with the published baseline shader/backend loaded from Git in memory.
It is not reported as passing or repaired. The general shader browser test's
first invocation had a missing macOS default Chrome path; the Linux-path run
passes. Both attempts remain in evidence.

Native-size 32×32 captures are retained for every passing observation, with a
representative native-size contact sheet and JSON mapping. The failed sample
and representative final captures were personally inspected. Browser reports
ANGLE Intel/Mesa UHD 620 despite requested SwiftShader launch flags; these
strings are retained without physical GPU qualification. No native Windows,
original-game, corpus or gameplay comparison was performed.

FALSE/default state-144 membership, DDPCAPS_ALPHA precedence and missing-child
key inheritance retain their explicit unsupported boundaries. No semantics
for those combinations are inferred by this repair.

## Recovery and reproduction

The predecessor `20261105-d3dim-keyed-mip-formats/` terminated on model capacity
before shared edits, tests, builds or browsers. Its prepared files remain
historically UNEXECUTED and unchanged. Recovery uses fresh evidence, exact
Git SHA, relevant binary diff and new-file patches; no source-tree archive or
game-media copies were made. Initial fixture failures and subsequent correction
runs are retained independently. Box ID/state/expiry are N/A; no box was used.

From the repository root:

```sh
node test/test-d3dim-keyed-mip-formats-web.js --plan
flock /tmp/wine-build.lock bash tools/build.sh
KEYED_MIP_FORMATS_EVIDENCE=/absolute/new/run-directory node test/test-d3dim-keyed-mip-formats-web.js
```
