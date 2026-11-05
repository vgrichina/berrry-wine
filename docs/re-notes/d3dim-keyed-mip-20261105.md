# D3DIM keyed mip filtering repair — 2026-11-05

This advances D3D-LEGACY-TEXTURE-CAPS-AUDIT-20261013 for explicit DX7
`COLORKEYENABLE=TRUE`, `COLORKEYBLENDENABLE=TRUE`. Each matching texel becomes
zero RGBA before within-level point/bilinear sampling and between-level
interpolation. Application alpha-test, alpha-source and blend states then
operate normally. The renderer retains gradient-selected mip levels, its
unkeyed behavior and advertised capabilities.

## Primary contract and boundary

The [Microsoft DirectX 7 SDK D3DRENDERSTATETYPE reference](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_5fdw.content.htm)
specifies that explicit `D3DRENDERSTATE_COLORKEYBLENDENABLE` TRUE makes matching
texture samples have zero alpha **and zero color**; the application supplies
alpha test/blend settings. The [SDK Color Keying State](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_3e78.content.htm)
gives `COLORKEYENABLE` FALSE as its initial setting and requires the texture's
source key. It does not establish state 144's initial value or a FALSE-mode
filtered membership equation.

Doug Rogers' NVIDIA [Color Key in Direct3D, pages 1–4](https://developer.download.nvidia.com/assets/gamedev/docs/ColorKey.pdf)
places key-to-alpha conversion before bilinear/trilinear filtering in its
reproduced DDK pipeline. That older pipeline retains RGB; the explicit DX7
state above specifies zero RGB too. The paper's later DX6/TNT discussion does
not establish universal DX7 implicit alpha testing, palette-alpha precedence,
or FALSE/default filtering output. Capability definitions alone do not specify
those pixels. [Microsoft SetColorKey](https://learn.microsoft.com/en-us/windows/win32/api/ddraw/nf-ddraw-idirectdrawsurface7-setcolorkey)
sets the key on a surface; this fixture explicitly sets each mip image's key.

Retrieved primary document hashes in run `20261105-d3dim-keyed-mip`:

| File | SHA-256 |
| --- | --- |
| dx7-renderstates.html | 7bcb2f8393d9615e54150ac6c0fe2b79a5a849614a36de1eba3be51e08c97ff0 |
| dx7-colorkey.html | aecde726caa3027bbc66fed838a3d07d5e4008c65803d943f66e46b9b64efdbb |
| ColorKey.pdf | e6e1e2fdfbc3c90f7961ebca0e4cb828c64845c7c6c11e5794fd68acba75aded |

FALSE/untouched state 144 keyed mip draws retain the named
`D3DIM:keyed mip filtering` failure. Effective key plus `DDPCAPS_ALPHA` remains
explicitly unsupported. Encountering an unkeyed mip child from a keyed root
also fails explicitly; this repair does not invent inheritance. No native
Windows comparison establishes these remaining combinations.

## Implementation

`src/09ab-handlers-d3dim-core.wat` now calls the existing keyed-tap sampler for
each selected mip image using that image's dimensions, pitch, format, palette
and native key. It removes a level-zero resample that would otherwise overwrite
the mip result. Existing LOD/derivative/interpolation calculations stay intact.
The GPU mip metadata seam additionally exposes each child's has-key flag;
`lib/d3dim-gpu.js` uploads the existing zero-RGBA decoded images throughout the
chain when explicit key blending is enabled. FALSE/default still falls back
to the native named failure, and unresolved alpha palettes remain rejected.

## Public guest regression and results

`test/test-d3dim-keyed-mip-public-web.js` reuses the public guest x86 COM fixture.
It obtains the real DirectDraw7, Surface7 and Device7 interfaces and CALLs their
published vtables. CreateSurface/GetAttachedSurface build a five-image 16→1
chain; public Lock/Unlock fill X8R8G8B8 images; SetColorKey is called on every
image. Public state setters/getters, Clear, BeginScene, DrawPrimitive, EndScene
and Lock exercise production code. There are no extra Wasm test exports,
constructed surface records, fixed LODs or replacement samplers.

Twenty-one states cover transparent/opaque texels, distinct mip 1/2/3 and
last-level clamping, MIN point/linear, MAG linear, MIP NONE/POINT/LINEAR,
bilinear/trilinear mixed key coverage, application GREATER-zero and EQUAL-255
alpha tests, source-alpha blending, explicit diffuse alpha override, key
disable/restore and unkeyed controls. Four held old/next state pairs add eight
Worker observations, including key-state and alpha-test/blend transitions.
The independent oracle converts keys before filtering. RGB tolerance is two
byte values; direct WebGL also checks alpha. It accounts explicitly for the
existing fixed-function shader's 1/16-pixel sampling bias versus software's
integer centers; no bias was introduced by this repair. X in the DIB is not
asserted as alpha.

The exact final fixture reproduces ten old failures on baseline modules from
`d2d4cfa9940d3dde7a62fd3ecc3a32eb8c7913d1` (which includes the input baseline).
Software/direct WebGL fail inside public DrawPrimitive; queued Worker draws
return S_OK, capture a real production draw/state batch, then fail on the public
Lock fence with the Wasm unreachable retained in Worker logs. This distinction
is asserted rather than treating the queue as synchronous.

Both repaired shipped modules pass **242 observations**: two software routes
with 21 each, four direct WebGL 1/2 routes with 21 each, and four real queued
RenderWorker WebGL 1/2 routes with 29 each. Each Worker reports 29 GPU draws,
29 readback fences, zero errors/fallbacks and zero native/fallback software
draws. Direct WebGL uses actual `readPixels`; Worker pixels arrive through the
production fence. Browser reports ANGLE Intel/Mesa UHD 620; launch requested
SwiftShader, so the renderer report is retained without claiming physical GPU
qualification or a Windows hardware comparison.

| Shipped module | Repaired SHA-256 |
| --- | --- |
| wine-assembly.wasm (2,171,424 bytes) | b1e7fad7a43aae382b9cd3aff51df383b782e5e8a1d285aef1fb847864dc326a |
| wine-assembly.compat.wasm (2,174,070 bytes) | 5ae40c5b05bc9b71423c2c2293804db3b6c7896fec8ea4bcf725103c0c157014 |

`old-fail-final/result.json`, `new-pass-final/result.json` and
`unsupported-false/result.json` retain fixture/module hashes, COM calls,
render observations and Worker statistics. FALSE still fails on all ten
repaired routes. Native-size 32×32 DIB captures are saved for every passing
observation. The worker personally inspected `native-size-contact.png`: eight
selected states across all ten routes, with unchanged 32×32 tiles and a JSON
mapping. Key black versus clear, selected child colors, mixed filtered coverage
and alpha rejection/blending are visible. These are generated fixtures; no
original game or native Windows run was performed. Multi-format keyed mips,
perspective keyed coverage and missing-key/alpha-palette negative matrices are
not new public-COM coverage here; existing unkeyed/native format tests remain.

Validation commands (from repository root):

```sh
flock /tmp/wine-build.lock bash tools/build.sh
node test/test-d3dim-keyed-mip-public-web.js --plan
KEYED_MIP_EVIDENCE=ABSOLUTE_RUN_DIR node test/test-d3dim-keyed-mip-public-web.js
KEYED_MIP_EVIDENCE=ABSOLUTE_RUN_DIR node test/test-d3dim-keyed-mip-public-web.js --unsupported-false
node test/test-d3dim-native-mip.js
node test/test-directdraw-mip-chain.js
node test/test-d3dim-indexed-texture.js
node test/test-gl-software-raster.js
```

The full build and listed focused regressions pass; native mip suite retains
38 production-path unkeyed observations and its FALSE trap check. To reproduce
the old failure, use `--old-fail` with `KEYED_MIP_MODULE_DIR` pointing at the
retained baseline modules. Browser runs used the local runtime/browser locks.

## Evidence and remaining work

Evidence is ignored under `scratch/runs/20261105-d3dim-keyed-mip/`: source SHA,
relevant binary diff and new-file patches, unique baseline modules, primary
documents, logs, captures and JSON. No source-tree snapshot or game-media copy
was made. Intermediate `new-pass01` read old modules before build completion;
`new-pass02` exposed a fixture software-version guard, and `new-pass03` exposed
the pre-existing GPU sampling bias. These are retained as failed preparation
attempts; final old/new runs use identical fixture hashes.

The next semantic blocker for a broader repair is primary/native evidence for
FALSE/untouched state 144 filtered key membership, palette alpha precedence and
key inheritance. This commit completes the explicit-TRUE repair and leaves
those unsupported combinations visible.
