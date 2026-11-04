# D3D7 color placement and the remaining conversion contract

Run: `scratch/runs/20261104-legacy-d3d-color-contract/`. Follows published
`743ae441d` and its exact reference in `test/test-legacy-color-precision.js`.
No production or test arithmetic changed. This is a primary-source research
result with a concrete remaining blocker, not acceptance of the retained patch.

The original DX7 SDK establishes linear Gouraud interpolation, integer pixel
centers, floating-point TL inputs, and a capability for subpixel color
placement. It also documents a CPU FPU default that the preceding note did not
have. **It does not supply the missing clip-generated color conversion and
raster-output quantization sequence in the topics reviewed here.** The CPU
precision setting and the public color-construction macros cannot fill that
gap. Consequently `[108,51,133]` remains the demonstrated snapped-placement
result; `[104,51,131]` remains an independent diagnostic under stated
conventions, rather than a universally required D3D7 byte triplet.

## Source identity and recovery

Official Microsoft sources were browsed first, including the surviving
[DDK D3DPRIMCAPS contract](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/d3dcaps/ns-d3dcaps-_d3dprimcaps)
and [DrawPrimitives2 input contract](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/d3dhal/ns-d3dhal-_d3dhal_drawprimitives2data).
For original DX7 text, Microsoft's hosted
[historical-documentation Q&A](https://learn.microsoft.com/en-us/answers/questions/2224888/documentation-for-earliest-versions-of-direct3d)
provides a discovery lead to a third-party SDK mirror. That answer is not a
technical authority or a Microsoft authentication of the mirrored bytes.

Read the Microsoft-authored `directx.chm` from SDK `dx7sdk-700.1`, pinned at
mirror commit `0e34cd0ff275f5ed91c82963f75297623714acf3`:
[original help file](https://raw.githubusercontent.com/oxiKKK/dx7sdk/0e34cd0ff275f5ed91c82963f75297623714acf3/dx7sdk-700.1/doc/directx7/directx.chm),
[original d3dtypes.h](https://raw.githubusercontent.com/oxiKKK/dx7sdk/0e34cd0ff275f5ed91c82963f75297623714acf3/dx7sdk-700.1/include/d3dtypes.h),
[original d3dcaps.h](https://raw.githubusercontent.com/oxiKKK/dx7sdk/0e34cd0ff275f5ed91c82963f75297623714acf3/dx7sdk-700.1/include/d3dcaps.h).
The help topics identify their build as September 2, 1999. Their Microsoft
content and headers are primary material preserved by a third party; mirror
provenance is recorded separately from official hosting. No original installer
signature or distribution-wide authenticity was verified.

`source-ledger.json` records topic paths inside the CHM, source URLs, short
excerpts, classification and SHA-256. `sdk-tree.json` is the complete,
nontruncated mirror listing. Recover a topic with `7z x directx.chm
devdoc/live/directx/<topic>.htm`; no SDK installer or native D3D7 execution is
needed. The external reference documents are research inputs, not copies of
this checkout. Official HTML downloads and failed URL attempts are retained
separately. Some Data Dungeon `.htm` URLs return only viewer wrappers; those
wrappers were not mistaken for technical text. The CHM contents were read
directly.

## Guarantees, examples and unspecified details

| Source / original topic | Established scope | Does not establish |
| --- | --- | --- |
| Gouraud Shading, `imover_9hk4.htm`; corroborated by [Microsoft's surviving shading description](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/bb153356(v=vs.85)) | Linear interpolation of vertex colors; its midpoint example illustrates the intended field. | A per-operation binary32 graph, coefficient precision, or integer byte conversion after interpolation. |
| Triangle Rasterization Rules, `imover_1mlg.htm` | Integer pixel centers and the top-left fill convention. The original text qualifies hardware variations. | Color-plane setup precision or a color rounding rule; coverage text is not a channel-conversion rule. |
| D3DPRIMCAPS, `imref_33xg.htm`; [official legacy DDK equivalent](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/d3dcaps/ns-d3dcaps-_d3dprimcaps) | SUBPIXEL describes placement of z, color and texture at subpixel positions; SUBPIXELX describes x-only placement. This is a device capability. Specular alpha can carry interpolated vertex fog. | A count of fractional bits or exact clipping/packing operations. |
| Subpixel Correction State, `imover_4m90.htm` | SUBPIXEL and SUBPIXELX render states are ignored. | A state that an application must enable to receive the advertised placement capability. |
| D3DVALUE, `imref_3q90.htm`; D3DTLVERTEX, `imref_3gkk.htm`; original headers | TL screen positions and reciprocal w are floats; diffuse and specular are packed D3DCOLOR inputs. | Every internal hardware value having the same representation as the API struct. |
| DirectDraw Cooperative Levels and FPU Precision, `imover_7410.htm`; [readable archived original](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_7410.content.htm) | Device7 sets the CPU FPU to single precision, round-to-nearest, exceptions disabled by default. FPUPRESERVE saves/restores the calling thread's state while Direct3D uses single precision. Device3 behavior differs. | The clipping expression/order, mandatory memory stores, GPU fixed-point arithmetic, or channel float-to-integer conversion. The included MungeFPCW assembly is an FPU setup example, not clipper/rasterizer source. |
| D3DRGB / D3DRGBA, `imref_9gv8.htm` / `imref_1bfo.htm`; d3dtypes.h | Public color-construction macros multiply supplied normalized components by 255 and cast to long before packing. RGBA_MAKE packs supplied integer components. | That Direct3D must invoke those macros internally on generated clip vertices or framebuffer output. |
| Clipping Volumes, `imover_0bl0.htm`; Primitive Clipping State, `imover_4td0.htm` | Homogeneous clipping volume and enable state. Device7's clipping state supersedes per-call DONOTCLIP. | Clip-plane processing order, generated color representation, truncation versus nearest, or preservation of extra channel precision. |
| [Official DrawPrimitives2 DDI](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/d3dhal/ns-d3dhal-_d3dhal_drawprimitives2data) | Vertex-buffer layout and FVF diffuse/specular fields at the DDI boundary. | The numerical clip/raster conversion contract. Its transformed-vertex wording is not evidence for all DX7 hardware T&L paths. |

For a short direct excerpt, the original Gouraud topic says: “The interpolation
is done linearly.” The original subpixel-state topic says the two states “are
not used, and are ignored by the system.” The full context and independently
hashed topics are available in the run's ledger.

Two tempting substitutions are specifically excluded. The old D3DVALP help
remarks mention 16 fractional bits, but the actual header defines D3DVALUE as
float and ignores the precision parameter; those remarks do not impose a
16.16 rasterizer. Modern D3D9 interpolation and D3D10/11 rasterization or
floating-point specifications were search results, not retroactive D3D7
requirements. No modern tolerance or format-conversion rule was adopted.

## Disposition of the demonstrated pixel

The existing independent calculation is reused unchanged. At `(16,4)`, the
primary clipped fan's continuous affine field, with its explicitly chosen
packed clip colors, gives `[104,51,131]`. Snapping vertices and row edges while
retaining and repacking their colors gives `[108,51,133]`, exactly the public
observation. The causal calculation and fan data remain in
`legacy-fractional-color-20261104.md`; the rational computation remains in
`test/test-legacy-color-precision.js`. Neither was replaced with production
trace output.

The source-level caps population is relevant: `$fill_primcaps` writes
`dwRasterCaps=0x07ff` in `src/09a8-handlers-directx.wat`, including SUBPIXEL
`0x20` and SUBPIXELX `0x40` as defined by the original SDK header.
`$d3dim_fill_device_desc7` uses this population for triangle caps. Thus the
documented subpixel-placement issue is pertinent to our advertised legacy
interface, rather than merely a hypothetical capability of another device.
This is static source evidence, not a new public GetCaps execution or a broad
capability qualification. Neither caps nor their render states were edited.

**Inference:** assigning the colors from a floating edge position to a snapped
integer span endpoint without correcting the color's sample position defeats
the advertised subpixel color placement. Linear Gouraud plus SUBPIXEL supports
repairing that mechanism. It does not select the complete retained candidate
or certify its exact output at numerical boundaries. A general placement
repair needs an independently justified finite conversion policy before it
can meet this assignment's exact-byte acceptance requirement.

The already resolved cyclic red 99 and far blue 116 are numerical diagnostics,
not remaining arithmetic mysteries. The exact reference explains stored TL
rounding and the far clip-color boundary. The SDK's CPU precision default
supports investigating single-precision implementations, but does not make
the reference experiment's particular reciprocal reconstruction and operation
order mandatory. The D3DRGBA macro similarly does not authorize applying its
cast at every internal stage. No ideal-real bytes, bias or tolerance were
introduced to clear the retained candidate's failures.

The retained candidate stays at
`scratch/runs/20261104-legacy-fractional-color/candidate-undivided-f32.diff.patch`
with its original provenance and logs, referenced in place. It was not
reapplied, rebuilt, copied or accepted here. No production source was owned or
edited in this run.

## Exact remaining fact and usable next evidence

The missing fact is a **DX7-specific rule or identified reference implementation
for (a) clip-generated diffuse/fog representation and conversion, (b) the
coordinate precision used to establish the color interpolation field, and (c)
conversion of that field to render-target channel bytes**. CPU FPU state,
public TL layout, and public color constructor behavior answer narrower
questions. The reviewed topics do not connect them into that rule. This is a
bounded negative research finding, not proof that no such DDK document exists.

The mirrored SDK inventory has no reference-rasterizer source directory;
the located reference-related sample files only enable/disable enumeration.
The SDK's Reference Rasterizer topic (`imover_85k4.htm`) explains its testing
role and device identity, but gives no conversion algorithm. An independently
identified Microsoft DX7 reference clipper/rasterizer source release would be
useful even if its behavior must initially be classified as an implementation
example. A source excerpt must identify version, operations and conversions;
an unexplained claim of reference accuracy is insufficient. No original DDK
reference-source release was recovered in this search. Separately authorized,
pinned native D3D7 comparison remains another possible source of evidence;
none was run or authorized by this offline assignment.

## Validation and recovery record

The unchanged rational/binary32 self-tests and analytic fractional-color plan
pass. Fresh public runs exercise both existing modules and all four routes:
ordinary/indexed, immediate/physical Worker, Draw through Surface7 Lock.
Thirty scenes per route include both precision boundaries, the primary pixel
and neighbors, constant/varying diffuse/fog, explicit TL, alpha tests and
distinct texture Q. Complete targets agree across routes and modules;
captured z/w and 1/w match the existing independent binary32 calculations,
capture hashes survive live-state/source/index mutations, and fallbacks are
zero. These assertions establish transport and storage, not color conformance.
The primary public observation remains `[108,51,133]` on both modules.

Accepted fractional-texture, clipped-depth/fog and variable-Q/fog tests also
run on both modules with their public rendered negative controls. Logs and
commands are in `regressions.json`. No code changed, so no new full build or
candidate-module qualification is claimed. Existing modules are recorded by
path and SHA-256 only. `initial-git.txt`, relevant `git diff --binary`, the new
note's patch, source ledger, test logs and `result.json` form the recovery
record; Git remains the source archive.

No Chrome, game, boat, native Windows D3D7, shared heavy-runtime lock,
subworker, deployment, module/media copy, npm or source-tree snapshot was
used. Box ID/state/expiry: not applicable. Coordinator retains shutdown
ownership. The worker stops after publishing the contract evidence with the
specific conversion blocker above; the snapped-placement defect is not waived.
