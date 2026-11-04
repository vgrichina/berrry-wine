# Valid texture, fog and framebuffer blend composition

The new `test/test-opengl-fragment-composition.js` found and fixes lost
framebuffer alpha in native GL filled triangles. Both original built modules
returned `[114,68,172,0]` for a textured, fogged, blended quad whose expected
RGBA8 value is `[114,68,172,116]`. The RGB-only shared D3D blending helper
discarded alpha. GL point/line spans already selected `$gl_sw_blend_rgba`;
`$gl_sw_emit` omitted that selection around `$rasterize_triangle_textured`.
The four-line repair scopes the existing RGBA flag around that call and clears
it afterward, preserving the shared D3D path.

## Missing coverage and independent oracle

The texture-state-query predecessor exercises base-format environment equations
with framebuffer blending disabled. Integer-light-material-fog tests fog without
textures or framebuffer blending. Color-mask tests check blending against their
own unmasked output. None checks the combined RGBA equation and stored alpha.

Each new test run loads the **actual unmodified built module**, initializes it
with the existing `test/binaries/calc.exe` PE, creates a window/DC/pixel format
and WGL context, and resolves GL functions through public LoadLibraryA and
GetProcAddress. Real x86 PUSH/CALL/RET sequences execute the public thunks, with
bounded completion and exact stdcall cleanup assertions. Only the resolver and
window setup bootstrap uses the existing catalog-thunk ID seam, restored after
each call. GL calls use the resolved thunk IDs. No extra WAT exports, mocked
draws, invalid inputs, or state-memory pixel oracle are used.

Eight 8x8 full-frame readbacks per module use GL_RGBA/GL_UNSIGNED_BYTE. The
shader-independent oracle uses normalized arithmetic, then rounds to bytes;
each channel must be within two byte values to allow intermediate native
quantization. All 64 pixels must pass each readback, including the quad diagonal.

Inputs are primary `P=(.75,.5,.25,.75)`, RGBA texture bytes
`T=(64,128,192,128)`, fog `F=(.125,.75,.5,.125)`, destination
`D=(.625,.125,.875,.5)`. A complete nearest-filtered 1x1 RGBA texture uses
GL_MODULATE. Identity matrices and constant eye z=-.5 give linear fog factor
f=.5 with start=0, end=1. For each RGB channel:

```
E.rgb = P.rgb * (T.rgb / 255); E.a = P.a * T.a / 255
S.rgb = f * E.rgb + (1-f) * F.rgb; S.a = E.a
O.rgba = S.rgba * S.a + D.rgba * (1-S.a)
```

This explicitly includes the alpha blend equation `O.a=S.a*S.a+D.a*(1-S.a)`.
Fog's deliberately different alpha must have no effect. These rules follow the
official Khronos [glTexEnv](https://registry.khronos.org/OpenGL-Refpages/gl2.1/xhtml/glTexEnv.xml),
[glFog](https://registry.khronos.org/OpenGL-Refpages/gl2.1/xhtml/glFog.xml), and
[glBlendFunc](https://registry.khronos.org/OpenGL-Refpages/gl2.1/xhtml/glBlendFunc.xml)
reference pages. The registry rejected automated fetches; small exact equation
excerpts were retained from the official KhronosGroup/OpenGL-Refpages source,
with full fetched-content SHA-256, URL and source line ranges in the run.

Analytical controls require the actual composed result to differ by more than
eight bytes in at least one channel from each incorrect model:

| Incorrect model | Expected RGBA8 under that model |
| --- | --- |
| Fog before texture environment | 110,50,166,116 |
| Fog after framebuffer blending | 75,118,142,116 |
| Fog changes alpha | 129,56,189,112 |
| Texture alpha omitted | 70,104,122,175 |
| Destination contribution omitted | 15,48,33,36 |

Actual public rendering controls independently disable fog, texture or blending,
exercise zero/full fog, and change the blend destination. A second draw overlays
red with `(GL_DST_ALPHA, GL_ONE_MINUS_DST_ALPHA)` onto the composed framebuffer.
This makes the stored alpha affect visible RGB; its fixed output is exactly
`[178,37,94,92]`. The before run failed at the earlier alpha assertion, so no
before measurement of that second draw is claimed.

## Validation and evidence

Run: `scratch/runs/20261104-gl-valid-fragment-composition/` (ignored).

- `before.log` / `before.json`: both original modules fail with alpha zero;
  `before-modules.sha256` identifies those exact binaries.
- `flock /tmp/wine-build.lock bash tools/build.sh`: PASS (`build.log`).
- `GL_FRAGMENT_COMPOSITION_EVIDENCE=.../pixels.json node test/test-opengl-fragment-composition.js`:
  PASS both rebuilt modules, eight readbacks and 512 checked pixels each.
- `node test/test-opengl-texture-state-query.js`: PASS, 437 checks.
- `node test/test-opengl-integer-light-material-fog.js`: PASS, 301 checks.
- `node test/test-opengl-color-mask.js`: PASS, including blending and copied
  queued mask state.
- `node test/test-d3dim-vertex-fog.js`: PASS, shared raster fog compatibility.

The rebuilt module SHA-256 values are
`78a0b1d61b23428a1ae909d739440ae0de059bbbd84a69a2ad3e4c37471ad664`
(tail-call) and
`99b579cd17b57f94145df92ae6d28110f24fc284d13a1b2c0ebe3596bd10a77f`
(compat). `pixels.json` records existing binary/media paths and hashes,
actual and independently expected colors, dispatch counts and route. Source
recovery uses the exact base Git SHA, relevant binary diff and owned new-file
patches; no source snapshots, archives or repeated media/module copies.

Limits: this is the synchronous native WAT software route in Node/V8. It does
not establish browser/WebGL or render-worker composition correctness, other
blend factors, multisampling, perspective-varying fog, texture filtering, or
gameplay correctness. The two-byte tolerance is not a general conformance
claim. Box ID/state/expiry: NA. No browser/game/boat allocation or lifecycle
action occurred; coordinator retains future runtime/shutdown ownership.

The bounded assignment is complete. Any broader rendering coverage is future
work; no additional allocation or acceptance task is needed for this change.
