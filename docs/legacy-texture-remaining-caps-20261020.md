# Remaining legacy texture caps: BORDER

Parent: D3D-LEGACY-TEXTURE-CAPS-AUDIT-20261013.
Base: fetched origin/main `6ccd344268a34232583ed5895bd79eb134f04fe3`.

The first demonstrated unsupported advertised capability in this bounded
pass is `D3DPTADDRESSCAPS_BORDER` (0x08). Clear only that bit in
`fill_primcaps.dwTextureAddressCaps`: 0xFF → 0xF7. This common producer feeds
line and triangle caps in EnumDevices/EnumDevices7 and GetCaps versions 1,
2, 3 and 7, for both HAL/HEL descriptors where applicable. It must describe
the generic implementation, regardless of which backend is selected.

The retained Microsoft SDK `d3dcaps.h` snapshot in
`scratch/runs/20261020-legacy-cube-caps/` defines WRAP=1, MIRROR=2, CLAMP=4,
BORDER=8 and INDEPENDENTUV=16. The header and its provenance are retained
again with this run. BORDER requests border color outside the texture;
selecting a wrapped texel or clamping to an edge is not that contract.

| Examined contract | Implementation evidence | Decision |
| --- | --- | --- |
| BORDER address | Actual `d3dim_address_texel` handles modes 2/3, otherwise wraps, including mode 4. `d3dim_texture_sample_keyed` calls it for both axes and all point/linear taps, with no border-color input. GPU `address` explicitly maps mode 4 to CLAMP (3), then constructs the sampler with those lowered modes. | Unsupported; clear capability. |
| WRAP/MIRROR/CLAMP | Extracted software helper passes negative, edge and outside coordinates at sizes 3 and 4; GPU lowering retains modes 1/2/3. | Retain bits. |
| INDEPENDENTUV | Software sampler has separate U/V mode arguments and calls; GPU descriptor applies lowering separately to U/V. | Retain bit. Source wiring, not pixel qualification. |
| Operation/filter bits | Located the legacy filter mask and DX7 point/linear additions and operation mask. Unchanged by this fix. | Not fully audited: stop after the first demonstrated fix. No claim that all other advertised bits are supported. |

Reserved address bits remain unchanged; this is one concrete capability
correction, not a broad mask cleanup. No backend behavior or palette handling
changes. Existing full guest tests `test-d3dim-texture-wrap.js` and
`test-d3dim-texture-stage-alias.js` were read but not run under this assignment.

## Validation and limits

Run `node test/test-legacy-texture-remaining-caps.js`. It compiles actual
extracted descriptor builders and GetCaps functions with identity guest-memory
translation and synthetic registers; validates aligned/unaligned guarded output
buffers, HAL/HEL and 172/204/252-byte layouts, and DX7's fixed descriptor.
It checks 90 address fields, retained filter/op values, 72 software address
cases, and executes the extracted JS GPU lowering expression. Enumeration and
sampler linkage are source assertions, not executed callback/draw paths.

Six negative controls restore the old mask, clear each retained defined bit,
or clear reserved bits. All must fail the same contract checker. An optional
first argument supplies an alternate DirectX source file for baseline replay.
The fetched unmodified baseline fails with `unsupported BORDER advertised`.

This is local source conformance, not fullbuild, guest/COM dispatch, actual
GPU/software rendering, or game success. Existing resume403 remains untouched.
No runtime operations, public deployment or main integration were performed.

## Pending cube integration

The pending `f856627b8d6ff022c4713aabb60ea7083ed9f0fc` correction changes
dwTextureCaps at offset 32 (0xFFDF → 0xF7DF); this fix changes offset 44 only.
Neither the pending branch nor its source was modified. The dedicated test
accepts both texture masks and tests composition in memory. During eventual
integration preserve both hunks. The older cube regression hard-codes 0xFF
in its complete primitive descriptor's address slot; update that one expected
value to 0xF7 when integrating both changes. Do not restore BORDER to make
the old expectation pass. This task does not repeat the cube or Surface4/7
implementation audit.

Self-contained replay, baseline, SDK snapshot, source hashes, patch and push
receipt: `scratch/runs/20261020-legacy-texture-remaining-caps/`.
