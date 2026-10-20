# Opaque P8 all-key rejection — 2026-10-20

The compiled software span now rejects a filtered opaque P8 footprint when
all four fetched native indices equal the surface key, independently of
palette RGB. It preserves framebuffer and depth instead of painting the key.
This is a bounded endpoint correction, not a resolution of mixed filtering.

Base: reviewed `3613e8afe93525fbf37cbeb2ebd4eae261a82c12`, independently
accepted by `a8ece350e92f958d8f0c0fff407f5b2fa4f634e0`.
Fresh main before source edits was
`ad171b162eec9419bf97ecaea179879264c1ec19`. Its renderer differs from the base
only by the predecessor's nonkey identity repair; GL raster and all five
compiler files are identical. This task stays on its own branch. No main
integration was performed.

## Diagnosis and bounded contract

`d3dim_decode_surface_pixel` delegates to the format decoder. For P8 that
decoder falls through to `raw_key | 0xff000000`; it does not look up the
palette. The filtered FALSE rejection compares sampled RGB against that raw
value. With key 0 and red palette entry 0, four keyed taps therefore write
`0xffff0000` and depth `0.25`. The original predecessor evidence reproduced
this on both its baseline and its fixed source.

The primary-contract report
`docs/re-notes/d3d-state144-contract-20261020.md` at main, also retained
under `scratch/runs/20261020-d3d-state144-contract-oct20/REPORT.md`, establishes
the narrow all-fetched-key rejection and all-fetched-nonkey draw endpoints
for ordinary opaque P8. Its native FALSE mixed/zero-weight algorithm, initial
state144, Device3 compatibility and alpha-palette precedence remain unresolved.
No new native observation or external contract search is claimed here.

Changing the shared decoder to look up P8 palette entries would change the
RGB comparator for mixed footprints. Instead, the existing footprint helper's
identical coordinate/address arithmetic now produces a four-bit native-key
mask. The existing membership helper wraps `mask != 0`, preserving the
reviewed nonkey guard. An added span guard rejects **only mask 15**, only when
the existing opaque P8 identity mode applies, filtering is enabled, TRUE
replacement is disabled and the fragment is still eligible. All four fetched
taps count, including zero-weight taps. A mixed mask, even when only its
nonkey taps have zero weight, keeps the previous behavior.

Point keying, alpha-bearing palettes, GL border routing, disabled/absent
surface key, TRUE replacement and 16-bit paths keep their prior logic.
The decoder and every existing production function except the span and
membership helper are asserted unchanged by the regression. Alpha and depth
tests still occur after key rejection. The mask contains bits, not logical
AND operands; the new guard's logical operands are normalized predicates.

## Executed regression

From the task repository root, with an existing output directory:

```sh
node --check docs/re-notes/d3d-allkey-decode-20261020.js
node docs/re-notes/d3d-allkey-decode-20261020.js /absolute/output > /absolute/output/tests.json
git diff --check
```

The dedicated JS regression derives its closure harness from the predecessor,
without changing that predecessor or its evidence. It compiles actual source
functions through the vendored WATX production compiler and executes them
in Node v24.18.1. It does not substitute a JS key-decision model.

- **1,564 span cases pass**, checking framebuffer, depth and sample.
  Coverage includes black and nonblack keys, duplicate RGB, native keys
  0/1/7/255, all-key/nonkey/all 14 mixed masks, distinct mixed colors,
  exact-zero and small-positive weights, wrap/mirror/clamp, nonfinite
  coordinates, point/TRUE/disabled-key paths, palette-alpha exclusions,
  actual GL border sampling, and three 16-bit texture formats compared
  against the forced-general path.
- The red repro retains framebuffer `0x12345678` and depth `1` with the
  fix. Both the reviewed baseline and a mutation removing only the added
  all-key rejection write `0xffff0000` and depth `0.25`. The same control
  exposes nonblack nonzero-key defects, except the intentional equality case:
  raw key 255 and RGB blue 255 already reject in baseline.
- **1,533 removed-fix differential cases** exactly reproduce the reviewed
  baseline, proving the helper refactor itself does not change span output.
  The earlier nonkey guard-removal mutation still exposes duplicate-black
  nonkey rejection; the actual fix continues to draw those nonkey indices.
- **15,552 independently traced sampler footprints / 746,496 mask checks**
  pass. Only the sampler fetch boundary is instrumented to log addresses;
  its production coordinate arithmetic is unchanged. The matrix uses 3x5,
  4x2 and 1x1 textures with padded rows, all 16 address-mode pairs, 18
  coordinates per axis including float32 rounding and saturation boundaries,
  and single-key/single-nonkey placements for keys 0/7/255. The returned mask
  and original boolean membership both agree with actual fetched addresses.
- Additional controls preserve alpha NEVER rejection and the existing
  TRUE-plus-alpha-palette trap on fixed, baseline and removed-fix modules.

Format/palette metadata access uses fixture adapters; guest depth translation
is identity and extent bookkeeping is a no-op. Disabled clipping, fog,
blending, second texture, stencil and other unrelated paths trap. Real
sampling, decoding, stage combination, alpha predicates, depth comparison,
framebuffer/depth stores and GL border sampling execute. The render target
is 32-bit; the 16-bit coverage refers to textures. The retained functions,
adapters, source/compiler hashes and numeric observations are in `tests.json`.

| Artifact | SHA256 |
| --- | --- |
| Fixed core | `7e489e3c28dfcef5d3736f521440a43762db125d5ae92244901714434d3cb738` |
| Fixed compiled closure | `e2f5144ecc1c89f30b1ac6e8c0e937b0c8701e7c97dd4dafb4d828c8f5e62412` |
| Reviewed baseline closure | `2be07a322bc7593ecce00f9d25b3085a07f2fd02b35b48d7e4b037d86703d471` |
| All-key rejection removed | `28702bf6c2daa234cd53e1cbfb32ace2a660591f59b1f9b543eacc594383ed2a` |
| Sampler trace closure | `4e0303124e7be6b3e54bc681e13ff83938fe3a30daa32e2126fafd4c56b99102` |

The baseline closure hash differs from the predecessor's harness because this
dedicated regression retains real GL border helpers instead of trap stubs.
The production baseline core remains the exact reviewed object.

## Recovery, limits and stopping point

Evidence: `scratch/runs/20261020-d3d-allkey-decode-oct20/`, including
`tests.json`, six WAT/Wasm closures, setup/preflight, recovery patch, receipt
and hashes. The first control expectation incorrectly assumed every nonblack
RGB differed from a raw key; its failure is retained as
`initial-control-expectation.stderr`. It was a fixture assertion correction;
no production change followed that failure.

The fresh independent repository uses read-only object alternates and exact
sparse patterns installed and verified before checkout. Admission includes
the 2,210,398,208-byte floor, 32 MiB reserve and 24 MiB concurrent caps. Own
checkout, metadata and evidence remain under 8 MiB. Only this report,
dedicated JS and the core source are committed; original evidence is retained
in place. Recreate ignored compiled artifacts with the command above.

No full build, full VM, browser, GPU, native driver, benchmark, Boat access,
worker launch, public deployment or held diagnostic was run. Real surface
metadata/allocation, GPU upload/cache/shader agreement and end-to-end draw
qualification remain untested. FALSE mixed/zero-weight policy, initial
state144, Device3 and alpha/key contracts remain open. This task stops with
the tested branch for independent review, without main integration.
