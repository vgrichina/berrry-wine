# Palette alpha versus native key identity — 2026-10-20

**Partial contract resolved; D3D-ALPHA-KEY-PRECEDENCE-20261014 remains blocked on a native observation or a version-specific normative statement.** No renderer policy changed. The unknown is whether and how an effective source key operates on an alpha-bearing DirectDraw palette, not whether its fourth byte contains alpha or whether two equal-RGB indices are the same index.

Base: `63d22caf879ca77d891d284f7926416a210136c2`, independently observed at remote main before work. Read the October 14 palette-alpha-render and legacy-key-filter-contract reports and the current TODO. Current main, not the older shared checkout, supplies all tested source. Filtered/state144 policy belongs to the parallel task and is not investigated here.

## Narrow contract table

| API/version and exact format | Determinate contract | Limit |
|---|---|---|
| DirectDraw7 texture, `DDPF_PALETTEINDEXED8`, 8-bit indices, attached 256-entry `DDPCAPS_8BIT` palette with `DDPCAPS_ALPHA` | Each four-byte `PALETTEENTRY` supplies RGB and an 8-bit alpha through `peFlags`. Values 0, 1, 64, 127, 128, 255 remain distinct alpha values. Alpha palettes attach only to `DDSCAPS_TEXTURE` surfaces. [Microsoft CreatePalette](https://learn.microsoft.com/en-us/windows/win32/api/ddraw/nf-ddraw-idirectdraw7-createpalette) | This API contract does not specify precedence with `COLORKEYENABLE`. |
| Same indexed format, ordinary palette without `DDPCAPS_ALPHA` | The fourth byte is not enabled palette alpha; do not reinterpret ordinary palette flags as transparency. The fixture verifies current opaque expansion separately. [GetCaps](https://learn.microsoft.com/en-us/windows/win32/api/ddraw/nf-ddraw-idirectdrawpalette-getcaps) | This does not qualify every ordinary palette flag combination or attachment lifecycle. |
| DX6-era source key on a palettized texture, single low=high key | The native key value denotes an index. Equal RGB at indices 7 and 8 does not make index 8 a member of key 7. [NVIDIA Color Key in Direct3D, issue five](https://developer.download.nvidia.com/assets/gamedev/docs/ColorKey.pdf) | Identity alone does not establish that key rejection is enabled for an alpha palette. No range-key claim. |
| DX6 palette-alpha availability versus DX5 compatibility | Microsoft's contemporary DX6 announcement lists alpha in texture palettes as a new feature. [Microsoft, May 1998](https://news.microsoft.com/source/1998/05/04/microsoft-ships-beta-release-of-directx-6-0/) | Do not project this capability into DX5 from today's aggregated header documentation. No DX5 alpha-palette support claim. |
| DX6-era truecolor with in-texel alpha, e.g. 1:5:5:5 | NVIDIA's issue three says alpha textures use texel alpha and ignore keying; issue four explicitly gives 1:5:5:5 as an alpha format. | Vendor implementation guidance, not a universal Microsoft DX6/7 rule. It never names `DDPCAPS_ALPHA`; extending it to palette alpha would be an inference. |
| DirectDraw indexed 1/2/4-bit, indexed-to-8, and truecolor alpha | Indexed-to-8 is a distinct format; `DDPF_ALPHAPIXELS` describes alpha in the pixel format. [Microsoft DDPIXELFORMAT](https://learn.microsoft.com/en-us/windows/win32/api/ddraw/ns-ddraw-ddpixelformat) | No packed-index, indexed-to-8, alpha-only, or truecolor-key equality fixture here. The 8-bit fixture cannot qualify them. |
| D3D9 `P8` versus `A8P8` | P8 is an 8-bit index; A8P8 includes separate 8-bit texel alpha. [D3DFORMAT](https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dformat) Palette alpha is used only when texture alpha is absent and `ALPHAPALETTE` is supported; otherwise absent alpha is 255. [Texture Palettes](https://learn.microsoft.com/en-us/windows/desktop/direct3d9/texture-palettes) | D3D9 device palettes are not DirectDraw palette objects. This does not decide legacy key precedence; D3D8 behavior is not established here. |
| DX6/7 alpha palette, effective key, nonkey alpha below 128 | Raw membership is false. The alpha value alone cannot encode membership. | **Final fragment survival, key/alpha precedence, and color/depth results remain unknown.** A membership result is not a universal draw result. |

Microsoft's [D3DPrimCaps](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/d3dcaps/ns-d3dcaps-_d3dprimcaps) separately names alpha-palette and transparency support. Capability names do not specify simultaneous use. Modern documentation indexed under historical structure names is not proof of introduction date.

The DX5 SDK-text mirror's [render-state page](https://library.thedatadungeon.com/directx5/html/dire2gah.content.htm) was also inspected. It describes alpha-test acceptance, blending, and independent depth writes, but lists an old ALPHAREF representation and ALPHABLENDENABLE number. It is not used as an ABI or palette-alpha oracle. No authenticated original DX6/7 SDK passage resolving the simultaneous case was recovered. No applicable native receipt was found in the supplied palette bundles or bounded palette/native filename search.

## Current production behavior, not a normative oracle

At the pinned base, `src/09ab-handlers-d3dim-core.wat:749` decodes keyed textures. Mode 1 compares raw indices and clears matching alpha while retaining RGB. Nonmatches retain enabled palette alpha. Mode 2 with an alpha palette traps before decoding; this is an explicit unresolved-contract guard.

The software span at line 5334 has the corresponding explicit-mode guard. Its point-index identity route at line 5342 excludes alpha palettes. Such palettes in ordinary key mode therefore reach the expanded-RGB comparison at line 5540. That is not the corrected ordinary-palette point route and does not preserve duplicate-color index identity.

`lib/d3d9-fixed.js:347` emits `sample0.a < 0.5` discard before combiners and the application's alpha test. Thus a nonkey alpha of 1, 64, or 127 is discarded even when an application test would accept it; 128 survives this predicate. The shared backend filename does not select a D3D9 contract. Source order shows rejected shader fragments never reach the color output; software gates stencil/depth on its draw decision. These are static observations, not measured framebuffer/depth results.

NVIDIA's note describes a default zero-alpha rejection for non-alpha textures and application alpha-test/blend controls. It cannot justify the fixed half-alpha threshold for alpha palettes, nor settle whether a key match should replace their alpha.

## Executed evidence

Run `node docs/re-notes/d3d-alpha-key-contract-20261020.js <evidence-directory>`.

The fixture compiles the exact current `d3dim_texture_fetch_prepared` helper and exact raw-index equality expression from the GPU decoder. It runs 24 pairs: six alpha values × ordinary/alpha mode × key/nonkey index, with identical RGB at both indices. All pass; whole fixture memory remains unchanged. No JS replacement of either WAT computation is used. The excluded truecolor decoder traps if reached. A 64-KiB standalone memory and explicit pointers replace the full VM.

Six additional cases execute the current shader predicate as a scalar expression. They reproduce four nonkey discards below 128 and two survivors. These are **characterization**, with null normative final-draw expectations, not six conformance passes. No GPU is run.

Evidence: `scratch/runs/20261020-d3d-alpha-key-contract-oct20/{helpers.wat,helpers.wasm,tests.json,test.log,test.stderr,preflight.json,receipt.json}`. Source and extracted-module SHA-256 hashes are in `tests.json`. The recovery recipe needs only the two committed files and tracked compiler/core/backend at this base. Initial fixture syntax used an unsupported inline memory export and then a bare `unreachable`; both were corrected before the successful run. No production failure was involved.

## Exact missing native observation and stopping condition

Use an authorized original DX6 device interface and separately Device7 on a documented OS/runtime/driver/device that reports and successfully creates alpha-palettized textures. Record version identities, caps, enumerated `DDPIXELFORMAT`, actual palette creation/attachment flags, HRESULTs, and read-back states. Unsupported/rejected format is evidence of a limitation, not a precedence answer.

Use point sampling at interior texel centers, one stage selecting texture alpha and RGB, no fog/specular/stencil, no border or mixed taps. Set one raw source key (low=high=7) before load. Give indices 7 and 8 identical RGB and independently sweep their alpha through 0,1,64,127,128,255. Include a nonkey whose RGB equals the integer key and an ordinary palette control. Compare effective key disabled/enabled; hold the filtered/state144 question outside this observation.

For each keyed/nonkey case capture:

* Alpha test disabled, ALWAYS, GREATER 0, and GREATER 127; then a stage override to alpha 255, distinguishing pre-combiner key rejection from application alpha testing.
* Blending disabled and SRCALPHA/INVSRCALPHA against a known background. Preserve the full alpha-dependent color result rather than classifying “transparent” as “discarded.”
* Z enabled with a passing depth and ZWRITE on/off. Read color and depth, or use an independently validated farther-geometry occlusion probe. Distinguish unchanged color caused by zero-alpha blending from rejection that also prevents depth writes.

The unresolved outputs are whether key 7 preserves/replaces/ignores palette alpha, whether nonkey low alpha receives any implicit test, which alpha reaches explicit testing/blending, and whether each outcome writes depth. Do not assign guessed expected pixels to these cells. Version-specific native receipts could establish a bounded observed contract; they would not automatically prove every driver equivalent.

Stop here: no renderer edits, runtime access, browser, heavy build, integration, capability changes, or state144 policy selection.
