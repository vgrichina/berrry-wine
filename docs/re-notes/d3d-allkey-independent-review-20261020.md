# Independent all-key review, 2026-10-20

ACCEPT `0571e3d08272e12bef9cd7bf43d6bcc763c6e649` atop accepted
`3613e8afe93525fbf37cbeb2ebd4eae261a82c12` for the bounded opaque-P8
all-four-fetched-native-key rejection. No production fixes or main integration.

The exact three-file diff adds one four-bit helper, converts the old boolean
membership helper to `mask != 0`, and rejects mask 15 in the span before
alpha/depth processing. Each mask bit uses precisely the previous helper's
address calculation and unsigned byte comparison. The wrapper preserves the
old boolean result for every mask. The guard requires an eligible fragment,
effective opaque P8 identity mode, nonzero filtering and disabled TRUE
replacement. An already rejected fragment stays rejected. The earlier
all-nonkey repair remains effective. Shared raw-key decoding is byte-for-byte
unchanged, as are all other existing functions except the span and membership
helper. GL raster source is unchanged.

Thus mixed masks retain the existing comparison, including zero-weight taps.
Point sampling, no effective key, TRUE replacement, alpha-bearing palettes,
GL border exclusion and 16-bit textures cannot enter the new rejection path.
This establishes preservation, not correctness of unknown native policies.
The accepted state144 contract report at the candidate commit explicitly
limits its FALSE endpoint conclusion to basic all-key transparency; it does
not establish native mixed/zero-weight/default or Device3 behavior. This
review makes no new native/API-conformance claim.

Executed evidence:

- All 25 seals in the original `SHA256SUMS.json` verified in place before
  testing; original evidence was never modified.
- Actual production-compiler closure rerun: 1,564 span cases passed; output
  JSON is byte-identical to original evidence. Baseline and all-key-removed
  controls write red and depth 0.25; fixed preserves destination and depth.
  All 1,533 removed-fix differential cases match baseline. The previous
  nonkey guard-removal control still fails the intended duplicate-black case.
- 15,552 actual sampler footprints and 746,496 mask checks passed again.
  Fetch-boundary instrumentation retains production coordinate arithmetic.
- Independent helper executed 9,216 additional actual span cases against
  baseline and removed-fix modules. It challenges a concrete coverage gap:
  original all-key span cases mostly use uniform 2x2 textures, whereas mask
  tracing alone does not test span wiring on other dimensions. New 3x5, 1x4,
  and 5x1 textures contain nonkey texels outside an all-key local footprint.
  All 3,072 such cases reject, while baseline and removed-fix write.
  Changing one fetched texel yields mixed/repeated-address cases; 2,248
  mixed and 3,896 all-nonkey cases preserve baseline output. All 16 address
  mode pairs and eight independent coordinates per axis are exercised.
  Expected footprint membership comes from actual sampler fetch addresses,
  not the new key-mask helper. No counterexample found.

SHA-256 identities:

| Artifact | SHA-256 |
| --- | --- |
| Candidate core | `7e489e3c28dfcef5d3736f521440a43762db125d5ae92244901714434d3cb738` |
| Baseline core | `8c6433b755581e6705e87051770b1301074b234cabdffef1551b938c4186c184` |
| GL raster | `f7f637d3cb4dc21931346c58927bc501d7e061bbbe3006bcdc11717096374bbe` |
| Fixed Wasm closure | `e2f5144ecc1c89f30b1ac6e8c0e937b0c8701e7c97dd4dafb4d828c8f5e62412` |
| Baseline Wasm closure | `2be07a322bc7593ecce00f9d25b3085a07f2fd02b35b48d7e4b037d86703d471` |
| All-key-removed Wasm | `28702bf6c2daa234cd53e1cbfb32ace2a660591f59b1f9b543eacc594383ed2a` |
| Rerun tests.json | `1e126fba4a273d70cf30b879577ad19a90a24c157545d717aa74fd922ff87fde` |

Evidence directory: `scratch/runs/20261020-d3d-allkey-independent-review-oct20`.
`tests.json` records every compiler/source hash and numeric observation;
`independent.json` records independent case counts; `original-seals.json`
records original manifest identity and all verified hashes. Final receipt and
seal manifest record review commit, verified remote and resource accounting.

Recovery from the candidate plus this report/helper commit, in a repository
containing the five compiler files and the two production source fragments:

```sh
node docs/re-notes/d3d-allkey-decode-20261020.js /existing/output > /existing/output/tests.json
node docs/re-notes/d3d-allkey-independent-review-20261020.js /existing/output > /existing/output/independent.json
```

Fresh isolated Git repository uses shared objects read-only through alternates.
Exact nine-file sparse scope was planned from the diff, installed and verified
before checkout, then checked against materialized index paths. Only this
report/helper are committed. Shared HEAD/index/config and original evidence
are rechecked at completion. No production/main edits, full build, full VM,
GPU, browser, benchmark, runtime access, Boat/SSH commands, workers, held
diagnostic, deployment or laptop game work occurred.

Limits: fixture metadata accessors and identity guest translation; render
target is 32-bit (16-bit coverage concerns textures). Disabled unrelated
paths trap, extent bookkeeping is a no-op. Native mixed/zero-weight/default,
Device3, alpha-key contracts, real metadata allocation, GPU/cache/shader and
end-to-end draw qualification remain open. Integration gates are outside
this review; the board separately records the predecessor's integration
blocked on the existing Jedi raw-literal gate.
