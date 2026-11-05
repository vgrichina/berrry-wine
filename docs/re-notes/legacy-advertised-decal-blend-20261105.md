# Advertised legacy DECAL, COPY and DECALALPHA

Assignment: D3D-LEGACY-TEXTURE-CAPS-AUDIT-20261013. Evidence:
`scratch/runs/20261105-legacy-advertised-decal-blend/`.

## Primary contract

Microsoft's [D3DPRIMCAPS documentation](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/d3dcaps/ns-d3dcaps-_d3dprimcaps)
ties each named `dwTextureBlendCaps` bit to the corresponding legacy blending
mode. `fill_primcaps` advertises `0xFFFF`, while the initial implementation's
effective legacy marker at device state +3936 retains only modes 2 and 4.

The original Microsoft DX6.1 SDK supplies explicit formulas, including alpha,
in `devdoc/live/directx/imref_789w.htm` (D3DTEXTUREBLEND), and equivalent stage
operations in `imover_3acl.htm` (Legacy Blending Modes and Texture Stages).
Read these from the legacy help bundled with the DX7 SDK, preserved in a
[third-party mirror at commit 0e34cd0ff275f5ed91c82963f75297623714acf3](https://raw.githubusercontent.com/oxiKKK/dx7sdk/0e34cd0ff275f5ed91c82963f75297623714acf3/dx7sdk-700.1/doc/directx6.1/directx.chm).
The 3,510,428-byte CHM SHA-256 is
`ade41d4cac0d000629ef5035827f4c6439dd360bc619b6832b33c53f27379c32`.
This is Microsoft-authored primary documentation preserved by a third party;
the original distribution's signature/authenticity has not been established.
The exact topic hashes and text are in `sdk61-topics.json`. Recovery uses
`7z e -so <CHM> devdoc/live/directx/<topic>.htm`; no installer is run.

| Mode | Numeric enum | RGB result | Alpha result |
| --- | --- | --- | --- |
| DECAL | 1 | texture | texture alpha |
| MODULATE | 2 | diffuse × texture | texture alpha if present, otherwise diffuse alpha |
| DECALALPHA | 3 | diffuse × (1 − texture alpha) + texture × texture alpha | diffuse alpha |
| MODULATEALPHA | 4 | diffuse × texture | diffuse alpha × texture alpha |
| COPY | 7 | same as DECAL | same as DECAL |

The bundled SDK header `include/d3dtypes.h` independently confirms the enum
values (SHA-256 `441a11c80720b91a240738340210a8810d87462bb6b690d0863515f2a6dd4d68`,
already retained in run `20261104-legacy-d3d-color-contract`).

The older [DX2 enum topic](https://library.thedatadungeon.com/directx2/html/dire8uwp.content.htm)
says DECALALPHA replaces alpha. This conflicts with the later DX6.1 explicit
equation and stage mapping. For Device3, use the DX6.1 contract above, not the
older description. The COPY/DECAL stage example also names ALPHAARG2 after
SELECTARG1; the enum's explicit equation resolves that example typo.

The DX7 SDK's `imover_163o.htm` says TEXTUREMAPBLEND is obsolete and unsupported
on Device7. The new legacy setter regression therefore needs actual Device3
COM acquisition and vtable calls. A Device7 QI alias may exercise existing
stateblock methods on the same backing device. No new Device7 legacy-state
claim follows. The SDK warns that mixing legacy and TSS blending is
unpredictable; preserve this emulator's established explicit-TSS transition
and raw query behavior as a compatibility invariant, rather than claiming
that transition order as a newly discovered SDK guarantee.

## Implementation and verification

The effective legacy marker now retains modes 1, 2, 3, 4 and 7 in live and
recorded state. Effective stage loading lowers DECAL/COPY to SELECTARG1
texture RGBA, and DECALALPHA to BLENDTEXTUREALPHA RGB with SELECTARG2 diffuse
alpha. Raw stage state remains unchanged. The GPU descriptor lowering now
preserves the shader's existing operation 13 instead of silently converting
it to MODULATE. No advertised capability mask changed.

`test/test-legacy-advertised-blend-web.js` consumes both shipped full modules
and calls actual x86 public COM vtables: IDirect3D3/Device3 creation, Texture2
GetHandle, SetRenderState(TEXTUREHANDLE/TEXTUREMAPBLEND), and alternating
DrawPrimitive/DrawIndexedPrimitive. All HRESULT-returning calls must succeed
before their pixel observations. Device7 stateblock methods use a QI alias on
the same backing device; legacy setters and draws remain Device3 calls.

The fixture uses nonwhite diffuse RGB (51,153,255), texture RGB (180,45,90),
diffuse alpha 170 and texture alpha 85. Its independent SDK equations produce
MODULATE RGB (36,27,90), DECAL/COPY (180,45,90), and RGBA DECALALPHA
(94,117,200). Identical stored texture bytes in a no-alpha XRGB format must
sample alpha 255. Public GetSurfaceDesc checks that format distinction.
GREATER alpha-test witnesses at 128 (RGBA) and 213 (XRGB) distinguish texture,
diffuse and opaque alpha through rendered pixels. Target X8 is unused;
the shared observer gained an opt-in RGB-only WebGL comparison for this test.
Existing tests retain their previous alpha comparison by default.

Baseline `baseline-pixels/result.json` records genuine successful legacy COM
setter/draw calls followed by DECAL pixels (36,27,90), incorrectly matching
MODULATE instead of the independent (180,45,90) expectation. After repair,
`render-isolated/result.json` and its six captures record PASS:

- Canonical and compatibility modules, each in software (38 observations),
  direct WebGL (38), and queued Worker (44): 240 positive pixel observations.
- Six ignored-setter controls, one per module/backend, all rejected by DECAL
  pixels after successful surrounding COM calls and draws.
- Same-device mode changes, RGBA/no-alpha texture changes, raw GetTSS
  preservation, unrelated TSS retention, explicit combiner cancellation and
  legacy restoration.
- Stateblock record isolation, End/Apply, Capture active/inactive effective
  legacy state, and both recorded legacy/TSS setter orders.
- Three held Worker draws per module: capture legacy modes 1/3/7, change live
  state before consumption, verify pending sequence, drain, observe old pixels,
  then draw and observe the new live mode. Queue packets retain marker +3936.

Focused alias and indexed-texture tests pass (`adjacent-alias.log`,
`adjacent-indexed.log`). The required final locked full build passes
(`build-final.log`). The optional older excerpt test
`test-legacy-texture-operation-caps.js` fails before compilation with
`missing import signature gl_texture_combine`; the identical failure occurs
with unchanged main's core supplied through process substitution
(`adjacent-operation-caps-main.log`). Its source lookup omits the OpenGL file
containing that function. This pre-existing fixture limitation was not changed.

No game rerun, complete capability-mask audit, new TSS capability promise or
public deployment is claimed. No semantic rule remains missing for the three
selected modes under the DX6.1 Device3 contract.

## Evidence and reproduction

Run from the repository root with the normal installed browser:

```sh
CHROME=/opt/google/chrome/chrome \
LEGACY_BLEND_EVIDENCE=scratch/runs/<run>/render \
node test/test-legacy-advertised-blend-web.js
node test/test-d3dim-texture-stage-alias.js
node test/test-d3dim-indexed-texture.js
flock /tmp/wine-build.lock bash tools/build.sh
```

The run records exact Git SHAs, relevant tracked binary diff and owned new-file
patches. `artifact-hashes.json` identifies the retained evidence; the render
result records both module hashes and loaded production JS hashes. Git holds
the source history; there is no source archive or copied game media.
`release-gate.json` independently verifies predecessor cleanup before runtime
acquisition. `cleanup.json` verifies this worker's browser/server/process,
profile, port and lock cleanup. Box ID/state/expiry: N/A.
