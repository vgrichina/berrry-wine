# Independent filtered-index review — 2026-10-20

**ACCEPT** commit `3613e8afe93525fbf37cbeb2ebd4eae261a82c12` for its
bounded all-nonkey opaque P8 filtered rejection repair. No production changes
or main integration performed by this review.

Remote main independently read as `f5b447ebbc2b047451926053a33b367d578b4a36`,
the candidate's direct parent. The exact diff contains only
`src/09ab-handlers-d3dim-core.wat` and
`docs/re-notes/d3d-filtered-index-identity-20261020.{js,md}`.
Baseline `63d22caf879ca77d891d284f7926416a210136c2` to current main adds five
contract report/helper files only; core, GL sampler and compiler are identical.
The full three-file diff, sampler closure and adapters were inspected.

## Findings

The new membership check reads original P8 bytes, not reverse-mapped palette
RGB. It restores eligibility only after the old color-key test rejects,
only for filtered opaque P8 without GL border addressing, and only if none
of the four fetched indices equals the native key. All four fetched taps
count, including zero-weight neighbours. This is an absence guard, not an
any-key rejection policy. Mixed/all-key footprints retain the old decision.

Its float32 multiplication, half-texel subtraction, floor, saturating
conversion, wrapping i32 neighbour increment and addressing match the actual
sampler. NaN and infinities are canonicalized before footprint arithmetic;
finite multiplication overflow retains the sampler's existing behavior.
GL's non-border route calls that same prepared sampler. Border paths remain
excluded. The helper executes after the sample using the same coordinates,
dimensions, pitch and backing pointer.

The point path still uses native index equality; filtered paths still use
the old RGB comparison followed by this guard. TRUE bypasses rejection and
uses existing per-tap substitution; draw is initialized to one before the
key test, so the new restoration cannot resurrect a TRUE rejection or any
earlier alpha/depth failure. Alpha/stencil/depth tests occur afterwards.
Palette-alpha exclusion and explicit TRUE+alpha trap remain. The 16-bit
fast/general selection and arithmetic are untouched.

The regression genuinely compiles and calls the production span and sampler
closure. Format/palette metadata are fixture-side adapters, g2w is identity
for a valid test depth buffer, extent bookkeeping is a no-op. Other omitted
paths trap; globals disable them. This isolates key/sample/output logic but
does not qualify real surface side tables, allocation, guest translation,
clipping, fog, blending, second texture, stencil, border sampling or 16-bit
render-target encoding. The 16-bit cases exercise **textures**, with a 32-bit
render target. No adapter supplies the expected key result.

## Executed evidence

All 16 seals in the original run directory were verified **in place** without
modification, including its receipt, patch, harness errors and four compiled
closures. The independent rerun's complete JSON equals the original JSON.
Node `v24.18.1`, vendored compiler production mode:

- All 134 original compiled span cases pass, including all 16 membership
  masks, duplicate and nonduplicate colors, nonzero keys, interpolation to
  key RGB, point/filter, disabled/absent key, TRUE, zero-weight and nonfinite
  characterization, and three 16-bit texture formats versus forced general.
- Baseline and guard-removal negative controls reject duplicate nonkey black;
  fixed writes `0xff000000` and depth `0.25` instead of retaining
  `0x12345678` and depth `1`.
- Original address tests use uniform indices and cannot distinguish a wrong
  footprint. The dedicated review helper closes this concrete evidence gap:
  it instruments only the compiled sampler fetch boundary to record four
  actual requested byte addresses; sampler coordinate/address code remains
  unchanged. For 3x5, 4x2 and 1x1 textures, padded pitches, every pair of
  address modes 0/1/2/3 and 18 coordinates per axis, all **15,552 footprints**
  and **124,416 single-key placements** agree with membership. Coordinates
  include half-texel rounding neighbours, signed zero, NaN, both infinities,
  large finite overflow and saturating-conversion boundaries. No
  counterexample found. This is implementation agreement, not native policy.
- Four additional checks establish alpha NEVER preserves framebuffer/depth
  and TRUE+alpha-palette still traps, on both baseline and fixed closures.
  The review helper initially assumed a space after the extracted function
  name; it failed before compilation, was corrected to its actual newline,
  and then passed.

SHA256 identities:

| Artifact | SHA256 |
| --- | --- |
| Candidate core | `8c6433b755581e6705e87051770b1301074b234cabdffef1551b938c4186c184` |
| Baseline/main core | `a5a62fc84ba7c7bff1763db07cd9cdd9c288c11fa28d266440219177d895091a` |
| GL raster source | `f7f637d3cb4dc21931346c58927bc501d7e061bbbe3006bcdc11717096374bbe` |
| Fixed Wasm | `cb0480a0849330a29944a51627c211c0514dec2da6d129757f97cc124993699d` |
| Baseline Wasm | `dc32c5948c93fecfc527d94403aafbc55d20d2f5744c08e0bd375299e5dac18a` |
| Forced-general Wasm | `4a31c6ebffc5f3e5bcbe811a74ff4716b32e8cc36ebd4a0e7bacab7f24fec273` |
| Guard-removed Wasm | `ed036441ad4ae27920883ecfae604228e68324aac254eda783c977a0a59680d7` |
| Independent footprint trace Wasm | `a86757df60a2c08a39ce2ea73b18976f0878b4d1372341eddb16e75f12c99fed` |

Evidence: `scratch/runs/20261020-d3d-index-independent-review-oct20/`.
`tests.json` records full compiler hashes, retained functions/adapters and
observations; `independent.json` records trace identities/counts;
`original-seals.json`, `preflight.json`, `receipt.json`, `remote.txt` and
`SHA256SUMS.json` preserve provenance. Recreate compiled artifacts by running
the candidate helper with an existing absolute evidence directory, then this
review's JS helper with that same directory. Both commands run from repository
root. No full build is necessary.

## Limits and operational boundary

No GPU shader/upload/cache execution, full VM, browser, native runtime or
whole-module build was performed. Full-VM draw/depth integration and GPU
agreement still need separate qualification. FALSE mixed/zero-weight rules,
state144 default, Device3 compatibility and alpha/key precedence remain
unknown. The documented all-key nonblack raw-key decoder bug reproduces
unchanged; it is neither fixed nor counted as native conformance.

This review used a fresh independent repository borrowing read-only Git
objects, with exact sparse patterns verified before the first checkout and
fail-fast setup. Checkout, metadata and evidence remain below 8 MiB; disk
admission reserves floor 2,210,398,208 B plus 32 MiB and 24 MiB concurrent
reservations. Shared HEAD/index/config are checked against preflight.
Only the dedicated report/helper are committed. Original evidence, unrelated
WIP, laptop HeroesII/WarcraftIII, other workers' files and held ScreenSaver
diagnostic remain untouched. No workers, runtime access or main push.
