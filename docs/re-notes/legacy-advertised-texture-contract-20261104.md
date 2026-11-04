# Legacy advertised texture contract: supplied-coordinate projection

Task `D3D-LEGACY-TEXTURE-CAPS-AUDIT-20261013`, following main
`66592e8303f405a7ac72ab39d76b84a91ed199e5`. One demonstrated mismatch is
corrected: **PROJECTED (0x0400) is no longer advertised**. The shared primitive
texture mask changes from `0xf7df` to `0xf3df`. Existing partial texture
generation, software/GPU behavior, filter/address masks, and opt-in defaults
are unchanged. Cube rejection and BORDER rendering were not repeated.

## Producer and consumer trace

All legacy D3D1/2/3/7 producers converge on `fill_primcaps` in
`src/09a8-handlers-directx.wat`:

- Device1/2 GetCaps delegate to Device3 GetCaps; `d3dim_fill_device_desc`
  handles caller-sized 172/204/252-byte descriptors, calling `fill_primcaps`
  twice directly or through `fill_d3d_device_desc`.
- EnumDevices1/2/3 use `d3d_enum_devices_dispatch` and
  `fill_d3d_device_desc` for both HW and HEL, including Ramp/RGB/HAL entries.
- Device7 GetCaps and EnumDevices7 use `d3dim_fill_device_desc7`, which calls
  the same primitive builder twice, then adds MIN/MAG point/linear and
  triangle-only mip filter bits. No other legacy writer of these three fields
  was found. FindDevice's descriptor helper also shares these builders.
- D3D8/9 caps are separate APIs, outside this legacy correction.

The exact source-traced subset below is **not** a new runtime qualification of
every listed feature. Only the PROJECTED counterexample and the stated controls
were executed here; prior notes remain evidence for their own subsets.

| Field/bits examined | Software consumer | GPU consumer / limit |
| --- | --- | --- |
| Texture PERSPECTIVE `1` | `d3dim_draw_textured_triangle` carries UV times RHW; spans divide by interpolated RHW | `lib/d3dim-gpu.js` transports TL RHW/UV to fixed-function backend |
| POW2 `2`, NONPOW2CONDITIONAL `0x100` | Allocation retains width/height; sampler uses actual dimensions | `lib/d3d9-backend.js` validates dimensions; WebGL1 NPOT requires clamp. These bits constrain allowed textures, not general NPOT repeat support |
| ALPHA `4`, TRANSPARENCY `8`, ALPHAPALETTE `0x80`, COLORKEYBLEND `0x1000` | `d3dim_texture_texel`/`d3dim_decode_surface_pixel`, palette alpha and keyed texels feed the textured span | `_textureLevel` and `d3dim_gpu_decode_texture` decode alpha/key modes. Explicit key-blend plus alpha-palette is rejected on both paths; that combination remains unresolved, not newly accepted |
| TEXREPEATNOTSCALEDBYSIZE `0x40` | Normalized UV times actual dimensions before address folding | Normalized UV and backend sampler addressing |
| PROJECTED `0x400` | `d3dim_prepare_draw_vertex` calls `d3dim_texgen`; its mode-zero early return bypasses texture matrix/projection for supplied UVs | The same prepared TL stream reaches worker/GPU routing; fixed-function stages explicitly set `transformFlags: 0`. No later projection repairs it |
| Legacy filter NEAREST/LINEAR `3`; DX7 MIN/MAG point/linear `0x03000300` | Stage MIN/MAG selection and point/bilinear sampler | Descriptor fields 45/46 and backend MIN/MAG sampler |
| DX7 triangle legacy mip bits `0x3c`, MIPFPOINT/LINEAR `0x30000` | Triangle LOD and bounded mip-chain sampling | `_texture` builds levels; backend mip sampler. Line and older interface masks remain without these bits |
| Address WRAP/MIRROR/CLAMP/INDEPENDENTUV `0x17` | `d3dim_address_texel` applied separately to U/V and every tap | Descriptor U/V, `address` lowering, REPEAT/MIRRORED_REPEAT/CLAMP_TO_EDGE |

Absent SQUAREONLY/CUBEMAP and address BORDER are carried through unchanged.
The old texture BORDER bit `0x10` is not treated as a new finding here.
Unassigned/reserved texture bits `0xe200`, filter bits `0xc0`, and address bits
`0xe0` are preserved; no supported runtime operation is inferred from them.
Bit identities are checked against [Wine's legacy d3dcaps.h](https://github.com/wine-mirror/wine/blob/master/include/d3dcaps.h).
The [Microsoft texture transform description](https://learn.microsoft.com/en-us/windows/win32/direct3d9/texture-coordinate-transformations)
describes COUNT3 plus PROJECTED dividing the first two transformed coordinates
by the third; this is the same named fixed-function state used by the DX7
fixture, not a D3D9 runtime test.

## Reproduced public consumer failure

`test/test-legacy-texture-caps-native.js --projected` reuses the existing
`browserFixture` as a local Node VM function with the complete production WASM.
It boots original calc, obtains DD7/D3D7/Device7 through public COM, creates and
locks real surfaces, and issues real x86 indirect vtable calls. It does not
extract WAT handlers or fabricate device/surface records. Canvas only receives
an unused presentation copy; asserted pixels come from public Surface7 Lock
after production software rasterization.

The untransformed `D3DFVF_LVERTEX=0x1e2` triangle has XYZ positions
`(-1,1,.5), (1,1,.5), (-1,-1,.5)`, white diffuse, identity world/view/projection,
an 8x8 viewport, and constant supplied UV `(3/8,5/8)`. Stage zero uses explicit
passthrough TEXCOORDINDEX, point filtering and WRAP. TEXTURE0 is identity with
`_43=q`, making the third output coordinate q from input `(u,v,0,1)`.
SetTransform/GetTransform and Set/GetTextureStageState round-trip every matrix
word and COUNT3|PROJECTED flags, with guarded buffers and checked stdcall ESP.

At target pixel `(2,2)`, the independent 2x2 texel oracle gives:

| Control | Actual RGB, before and after correction |
| --- | --- |
| Projection disabled, q=.5 | 64,192,32 |
| COUNT3\|PROJECTED, q=1 | 64,192,32 |
| COUNT3\|PROJECTED, q=.5 | **64,192,32**, although proper `(u/q,v/q)` requires **160,32,64** |
| Projection disabled again | 64,192,32 |
| Application supplies divided UV, projection disabled | 160,32,64 |

Two negative controls must reach successful public draw and Lock, then fail
specifically at PIXEL ORACLE: (1) require normative projection for the ignored
q=.5 draw; (2) bake the divide while retaining the unchanged ignored-projection
expectation. They observe opposite RGB pairs, proving that the expected failure
is sensitive to the projection and not a blank draw or bootstrap failure.
Both shipped modules execute all five positive observations and both rendered
negative controls, before and after the advertisement correction.

## Actual public caps and preservation checks

The existing deterministic x86 fixture now copies **every** EnumDevices
callback's descriptors, rather than only the final HAL callback. Each module
executes 47 public/factory/release calls and checks 55 descriptors, including
all Device1/2/3 GetCaps sizes on aligned/unaligned buffers, Device7 GetCaps,
and every D3D1/2/3/7 enumeration entry's HW/HEL outputs where applicable.
Guards, HRESULT, exact pre-restore stdcall ESP, bounded completion, callback
context, CONTINUE/CANCEL and outer RET all pass.

Before/after comparisons of every descriptor word show exactly 110 changes per
module: both primitive texture fields in all 55 descriptors lose only `0x400`.
Every other descriptor word is identical. Actual filters remain legacy `0xc3`,
DX7 lines `0x030003c3`, DX7 triangles `0x030303ff`; address caps remain `0xf7`.
The fixture's stale pre-mip triangle-filter and pre-operation-audit expectations
were updated to these already-shipped values (`dwTextureOpCaps=0xf`); the
production change does not alter them. The initial stale-filter assertion
failed after successful public calls; final before/after executions use the
current expectations. Requiring the old PROJECTED advertisement on the fixed
module fails the caps assertion, as intended.

The existing mirror/independent-UV regression passes for canonical and compat:
480 exact RGB observations plus ten rendered negative controls per module.
Only its exact texture-mask expectation changed. The native fixture's offline
oracle exercises 1263 synthetic rejection controls; these are explicitly not
COM runtime evidence. Syntax, owned diff whitespace checks and the mandatory
`flock /tmp/wine-build.lock bash tools/build.sh` pass.

Older extracted-source audit tests still encode historical exact masks,
pre-mip filters and pre-operation caps; they do not establish the current
public contract and were not used as acceptance tests for this correction.

## Recovery and limits

Evidence is under `scratch/runs/20261104-legacy-advertised-texture-contract/`.
`descriptor-comparison.json`, `before-*-all-enum/native-observed.json`,
`after-*/caps/native-observed.json`, `*/consumer/projected-observed.json`
(before consumer files are directly under `before-*`), mirror results and
`build.log` contain the actual observations. Retained before/after modules are
hashed in `source-seal.json`. The exact starting Git SHA plus relevant binary
diff and owned-new-note patch provide source recovery. No source archive or
media copy was made; original calc is referenced by path and SHA-256.

Reproduce with a locked build, then for each module run:

```sh
node test/test-legacy-texture-caps-native.js --wasm=build/wine-assembly.wasm \
  --sha256=<actual-module-sha256> --out=<fresh-run>/caps
node test/test-legacy-texture-caps-native.js --projected \
  --wasm=build/wine-assembly.wasm --sha256=<actual-module-sha256> \
  --out=<fresh-run>/consumer
```

Use `wine-assembly.compat.wasm` for compatibility dispatch. Use
`--expect-projected` only with a recorded original module to reproduce the
pre-correction advertisement. `--offline` runs only synthetic verifier controls.

No browser, game runtime, test box, subworker or deployment was used. GPU
consumer tracing is source evidence, not a new GPU pixel execution. No assigned
box exists to hand back. Full supplied-coordinate texture transforms and
projective interpolation/storage across vertices, clipping, mips and queued
GPU draws remain required before restoring PROJECTED. The first separate
source-visible unresolved combination is alpha-palette plus explicit
COLORKEYBLEND, which needs a resolved contract and public consumer test before
choosing any further capability change. This is one correction, not acceptance
of all remaining texture capabilities or original games.
