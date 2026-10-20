# Legacy filter capability: MIPNEAREST

Bounded D3D-LEGACY-TEXTURE-CAPS-AUDIT-20261013 continuation, based on fetched
`origin/main` at `7b15136870328d66a8517b9673efad3fd0941294`. This branch changes
only `fill_primcaps.dwTextureFilterCaps` from `0xFF` to `0xFB`, clearing
`D3DPTFILTERCAPS_MIPNEAREST` (`0x04`). The backend behavior is unchanged.

Microsoft defines MIPNEAREST as choosing the nearest texel from the appropriate
mip level, so sampling the currently bound image alone is insufficient.
See the [D3DPRIMCAPS contract](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/d3dcaps/ns-d3dcaps-_d3dprimcaps)
and the [Microsoft SDK constants](https://github.com/microsoft/win32metadata/blob/main/generation/WinSDK/RecompiledIdlHeaders/um/d3dcaps.h).
The cap bit is distinct from the legacy filter enumeration value
`D3DFILTER_MIPNEAREST=3`.

`d3dim_draw_tl_triangle_textured` and `d3dim_gpu_describe` select the stage
MAGFILTER, then MINFILTER, then legacy TEXTUREMAG/MIN. They reduce the selected
value to a boolean: only value 2 selects linear sampling; value 3 selects point.
The software sampler accepts one image's dimensions, pointer and pitch, with
no LOD or mip-chain input. Its point branch fetches one texel from that image.
The GPU JS lowering sets both min/mag from the same boolean and always sets
`mip: 0`. Thus the common advertised MIPNEAREST capability is unsupported.

Run `node test/test-legacy-texture-filter-caps.js`. The dedicated standalone
source test compiles extracted production WAT with the vendored compiler:

- 90 filter fields across primitive caps, HAL/HEL builders and GetCaps 1/2/3/7,
  aligned/unaligned buffers, legacy descriptor sizes and memory guards. The
  DX7 mask becomes `0x030003FB`, retaining its point/linear additions.
- 36 backend cases: four filter-state sources, NEAREST/LINEAR/MIPNEAREST,
  and three stage MIPFILTER values. Verbatim production filter-selection
  statements and JS sampler lowering execute; the actual software sampler,
  address helper and bilinear helper execute with an instrumented fixture
  texel fetch. The checkerboard yields one black point sample or four taps
  producing `0xFF7F7F7F`, always on the bound image.
- Six mutation negatives: restored MIPNEAREST, lost NEAREST, lost LINEAR,
  unrelated mask clearing, enabled GPU mip selection and reversed software
  filter selection. The original main source fails specifically on the
  unsupported MIPNEAREST advertisement.
- In-memory composition with the prior CUBEMAP and BORDER fixes passes.

Evidence and self-contained replay:
`scratch/runs/20261020-legacy-texture-filter-caps/`. The snapshot includes
the source, compiler, test, baseline, logs, patch, SDK reference and hashes.

This is extracted-source conformance, not fullVM, public COM dispatch,
enumeration callback execution, full device setup, GPU rendering or game
qualification. State storage/fog and texel fetch are explicit fixtures; the
full draw function and full GPU descriptor are not executed. No runtime403
probe, build, guest, browser or box action was performed.

The one-fix stopping condition leaves other legacy mip bits (`0x08/0x10/0x20`)
and reserved bits unchanged and unqualified. They are not evidence of
implemented support. Texture-operation audit is outside this task.

Integration remains coordinator-owned. Preserve pending CUBEMAP
`f856627b8d6ff022c4713aabb60ea7083ed9f0fc` at offset 32 and BORDER
`0a63482c363082c95e825b34161f42134831a3a4` at offset 44, along with this new
offset-36 change. Neither prior patch is duplicated or integrated here.
Their existing exact filter-mask assertions will need reconciliation from
`0xFF` to `0xFB` and DX7 `0x030003FF` to `0x030003FB`; retain the prior note
about the cube test's address-mask assertion changing to `0xF7`.
This new test accepts both pre/post cube and border values.

The fetched base retains laptop WarcraftIII/HeroesII work, including
`515897841fde86f9b2e0274387aff10cc9add405` ancestry. Shared HEAD/index and
unrelated WIP are outside this branch; no main merge or ledger edit occurs.
