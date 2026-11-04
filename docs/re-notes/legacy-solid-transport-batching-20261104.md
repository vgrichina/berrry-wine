# Bounded batching of opt-in solid transport

The opt-in implementation from `33deb09b6dd5806bcce9601e8a821e91e4e21ebb`
now submits consecutive original triangles in bounded batches within each
`Device.draw`. The default remains disabled. This removes the mandatory draw
per original triangle where uniform capacity permits; it does not establish
rendered equivalence, gameplay performance or full27 repair.

## Backend change

Each rectangle still contributes its two triangles in the original submission
order. Its six vertices carry the same small integer selector. Both GPU stages
use that selector to choose three immutable original attribute records from
uniform arrays. Selection uses explicitly unrolled constant array subscripts,
including under WebGL1; it adds no fragment dynamic-array indexing. Original
vertex replay, clipping, edge ownership, rational attribute reconstruction,
affine device depth and numerator/Q mip derivatives retain their existing code.
No CPU geometry displacement or interpolation is introduced.

Batch capacity is at most eight original triangles. Vertex and fragment uniform
vector limits are queried once per device. A conservative source declaration
counter accounts for arrays, matrices, samplers and comma-separated uniforms
in each generated stage; scalar declarations each consume a whole vector.
Unknown declarations or unavailable/insufficient limits retain capacity one.
This fallback does not certify that a pre-existing capacity-one shader fits the
hardware; ordinary compiler/linker rejection remains authoritative. Capacity
is included in the program cache key. Both input banks and invocation geometry
are bounded by capacity, and unused records in the final bank are zeroed.

No batch spans a `Device.draw` call. Texture/sampler and shader constants,
viewport/depth range, attachments, blend/depth/stencil, cull and scissor setup
remain ordered before that call's submissions. Strip parity uses the original
primitive ordinal, including at odd chunk boundaries. Typed INDEX16 subviews,
including index 65535 under WebGL2, are decoded into original inputs without
GPU restart interpretation. Uint32 and Uint8 indices still reject. Points,
lines, outline eligibility and the option-disabled path keep their existing
dispatch. Existing programmable replay limitations are unchanged.

## Actual Device boundary evidence

Evidence directory: `scratch/runs/20261104-legacy-solid-transport-batching/`.
Git SHA plus relevant binary diff and a patch for this new note reconstruct
the revision; no source archive or media copy is stored. The before test loads
the exact predecessor backend from Git into memory with normal dependencies.
It does not replace worktree files.

The actual production `Device.draw` executes against a recording GPU boundary.
This is a submission/transport test, not a GL compiler or pixel test. In each
WebGL version it submits four consecutive 19-triangle draws: indexed list,
indexed strip, nonindexed fan, then return to list. At each submission the test
independently decodes every primitive's position/RHW, normalized packed color,
signed SHORT2/SHORT4 UV input, Float32 values and default missing components.
It verifies constant rectangle selectors and the generated shader's exact
constant-index assignments in both stages. Inputs include byte-offset vertex
and index subviews and INDEX16 65535; original bytes remain unchanged.

| Reported uniform vector limit, both stages | Predecessor draws | Batched draws | Original triangles |
| --- | ---: | ---: | ---: |
| 0 (capacity-one fallback) | 76 | 76 | 76 |
| 50 | 76 | 28 | 76 |
| 64 | 76 | 20 | 76 |
| 1024 | 76 | 12 | 76 |

Both version configurations give these counts. The independent serialized
primitive records, including ordered inputs, viewport, depth range, depth-write
and blend flags, and all six mip metadata banks, have the same SHA-256 before
and after: `a1e2d127a63b8ee50176afae664384e44faf69fcfd1696cafa46c0f57d072ba5`.
Additional assertions check per-call blend/depth/cull/scissor/color-mask and
two-sided stencil state. Rejections cover unsupported index arrays, short index
buffers, unsupported declarations, out-of-bounds vertices, user clip planes,
WebGL1 outline and missing EXT_frag_depth. Zero-count draws remain empty.
Points/lines and option-disabled ordinary indexed draws are checked separately.
The predecessor fails the same test when batching is required.

Reproduce the before/after submission tests without a browser:

```
node test/test-legacy-solid-coverage-transport.js --backend-sha=33deb09b6dd5806bcce9601e8a821e91e4e21ebb --expect-unbatched
node test/test-legacy-solid-coverage-transport.js
```

The retained small transport matrix now covers both fallback and batched paths,
both WebGL versions, POSITION/POSITIONT and list/strip/fan. Existing source
assertions retain affine-depth and numerator/Q mip formulas. Focused coverage,
interpolation, top-left diagnostic, fixed plan cache, fixed shader, position
type, shader unsupported cases, shader compilation-unit tests, backend
validation-only and tier checks pass. A mistakenly included browser typed-GPU
test stopped at missing `puppeteer` import before launching anything; it is
retained as unavailable, not passing. No dependency installation followed.
The first locked build stopped on another worker's in-flight host/renderer
census hashes; its log is preserved separately from the final build result.
After the owning worker refreshed them, the final
`flock /tmp/wine-build.lock bash tools/build.sh` passed, including both modules
and the compiled data-segment overlap check.

## Remaining qualification

All prior rendered artifacts and their source-bound validator are preserved.
Neither the predecessor's browser driver nor its rendered-evidence validator
was rerun against this changed backend. Those observations belong exclusively
to the earlier shader revision, as documented in
`legacy-solid-shader-rendering-20261104.md`; they do not qualify this batch
selector or its larger uniform arrays. The rendered fixture function and the
rendered-evidence validator are unchanged.

Next work needs actual WebGL1/2 compilation and rendered multi-primitive
overlap, clipping, blending/depth/stencil and public mip checks of this exact
backend, then representative hardware and gameplay measurements. Draw-count
reduction alone does not demonstrate frame-time improvement. Uniform array
pressure and constant-selector branch code grow, and repeated fragment vertex
replay remains expensive. Full-domain clipping/snapping/exact-sign ownership,
W=0, nonlinear/projected/cube gradients, programmable global reset, guest depth
outputs and hardware portability remain unqualified. No default enablement,
normal-path, full27 or rendered repair is claimed.

No box was assigned and no runtime, browser, allocation or lifecycle operation
was performed. Box ID/state/expiry are not applicable to this worker; the
coordinator owns the predecessor box and its closure. No subworker, successor,
public deployment or game session was launched.
