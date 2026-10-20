# Filtered P8 index identity — 2026-10-20

The all-nonkey filtered P8 false rejection is repaired. The span retains its
existing FALSE-mode rejection expression, then cancels that rejection only
when an ordinary opaque P8 footprint contains no native key indices.
The membership helper uses the sampler's float32 half-texel footprint,
nonfinite canonicalization, addressing and original byte indices. All four
fetched taps participate in this **absence check**, including zero-weight taps.
It does not introduce an any-key-tap rejection rule.

Point identity, explicit TRUE replacement/bypass, alpha palettes, GL border
taps and 16-bit paths retain their existing behavior. Alpha palettes and GL
border addressing remain outside this bounded identity path. Mixed footprints
retain the old result exactly; their tests are characterization, not native
FALSE-mode conformance.

## Source reconciliation and reproducer

Initial main: `63d22caf879ca77d891d284f7926416a210136c2`.
Fresh main at final review: `f5b447ebbc2b047451926053a33b367d578b4a36`;
its intervening five files are contract reports/checks only, with identical
renderer/compiler blobs. Read report/check `1914ce3492099868c4b4f9a2180b35fbfa093543`.

The prior report supplied a red `key_rgb` to its interpreted expression.
Executing the actual span exposes a narrower, exact reproducer: key index 0,
palette entries 0 and 1 both black, texture indices `[1,1,1,1]`, linear
sampling at `(0.5,0.5)`. The original-index membership oracle is false for
every fetched tap. Baseline leaves framebuffer `0x12345678` and depth `1`;
the fix writes `0xff000000` and depth `0.25`.

Production's existing `d3dim_decode_surface_pixel` does **not** look up a P8
key in the palette: its fallback ORs the raw key with `0xff000000`.
Consequently an all-key red footprint with key 0 survives on both baseline
and patched source. This separate existing all-key decoder defect is retained
as an explicit reproducer, **not** reported as a conformance pass or corrected
by guessing a broader key/filter policy. All-key black rejection is verified.
Changing the decoded key RGB also changes mixed-footprint outcomes and is
outside this narrowly scoped all-nonkey repair.

The regression also verifies nonzero key 1 with duplicate RGB `0x000001`,
and distinct nonkey colors `0x000000`/`0x000002` filtering to `0x000001`.
No palette-RGB-to-index reverse mapping is used.

## Executed checks

From the task checkout:

```sh
node --check docs/re-notes/d3d-filtered-index-identity-20261020.js
node docs/re-notes/d3d-filtered-index-identity-20261020.js /absolute/evidence/directory
git diff --check
```

The JS check extracts and compiles the complete actual production span and
sampler closure with the vendored WATX production compiler, then executes the
WebAssembly in Node/V8. It verifies 134 cases: duplicate/nonduplicate P8,
point/linear, key disabled and absent, TRUE bypass, all-key/all-nonkey,
all 16 native membership masks, mixed/zero-weight footprints, wrap/mirror/clamp,
nonfinite coordinates, and RGB565/XRGB1555/ARGB1555 fast16 versus forced
general sampling. Assertions check framebuffer bytes and depth writes.
Original-index membership is checked separately on all masks. Baseline and
guard-removal mutation both reproduce the duplicate-black rejection.

Surface format/palette side-table access uses explicit fixture adapters;
guest-to-Wasm is identity for the test depth buffer. Execute-buffer extent
bookkeeping is a no-op. Disabled clipping, second texture, fog, blending,
stencil, dithering and border helper paths trap if invoked. Production
color-stage combination, sample decoding, key processing, alpha predicate,
depth comparisons and span framebuffer stores execute unchanged.
The forced-general variant changes only the fast16 branch condition.
Exact retained functions and adapters are listed in `tests.json`.

SHA256 identities:

| Source/artifact | SHA256 |
|---|---|
| Patched renderer core | `8c6433b755581e6705e87051770b1301074b234cabdffef1551b938c4186c184` |
| GL raster source | `f7f637d3cb4dc21931346c58927bc501d7e061bbbe3006bcdc11717096374bbe` |
| Patched compiled closure | `cb0480a0849330a29944a51627c211c0514dec2da6d129757f97cc124993699d` |
| Baseline compiled closure | `dc32c5948c93fecfc527d94403aafbc55d20d2f5744c08e0bd375299e5dac18a` |
| Forced-general closure | `4a31c6ebffc5f3e5bcbe811a74ff4716b32e8cc36ebd4a0e7bacab7f24fec273` |
| Guard-removal mutation | `ed036441ad4ae27920883ecfae604228e68324aac254eda783c977a0a59680d7` |

Evidence: `scratch/runs/20261020-d3d-filtered-index-identity-oct20/`.
It retains four WAT/Wasm closures, source/compiler identities, numeric
observations, initial harness errors, patch, preflight and final receipt.
The initial harness required missing dormant stencil adapters and correction
to the compiler's production input mode; these were fixture errors, not
renderer failures.

## Remaining obligations and scope

No browser, GPU shader execution, full-module build, full VM or native runtime
was run. GPU upload/cache/shader agreement and full-VM opaque P8 draw/depth
behavior still need separately authorized validation. The known nonblack
all-key decode defect needs its own bounded assignment. State144 FALSE
mixed/zero-weight semantics, native initial value, Device3 compatibility and
alpha-palette/key precedence remain unresolved exactly as in the contract
reports. The recorded resume403 was not retried or bypassed.

Operational deviation: sparse setup initially failed because its metadata
`info` directory did not exist, but the following checkout still executed,
temporarily materializing 245 MiB. This violated the 8 MiB cap and
patterns-before-checkout requirement. Immediately corrected to exact sparse
paths before production edits; observed free space at the oversized checkout
was 2,680,438,784 bytes, above floor 2,210,398,208 plus 32 MiB reserve and
24 MiB concurrent caps. The automatically created own upstream stanza was
removed; shared HEAD/index/config hashes match preflight. No unrelated WIP,
laptop HeroesII/WarcraftIII or hold was edited. Final receipt accounts for
task checkout, worktree metadata and retained evidence.
