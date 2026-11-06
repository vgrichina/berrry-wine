# Legacy POINTLIST native alpha storage

Evidence: `scratch/runs/20261106-legacy-point-a1-discriminator/`.
The bounded execution gate opened at 2026-11-06 01:21:03 UTC after the ordered
D3D9 MultiplyTransform, Aranna heap and Conan matrix-write final releases.
Independent cleanup checked 391 absent PIDs, 40 refused ports, 27 absent
profiles and four free locks. The deadline was 02:06:03 UTC. No boxes were
assigned; box ID/state/expiry are not applicable.

## Finding and causal baseline

The reported WebGL1 mismatch was a software POINTLIST defect inherited by
the fixture's expected pixels. GPU point storage already retained diffuse
alpha correctly. The landed dependent-native16 repair `23e0990db` addresses
per-primitive storage and RGB565 destination decoding; it did not cause this
point mismatch.

`original-point-baseline.log` reproduces the unchanged test's exact
`WebGL1 case8 format3 exact WAT bytes` failure. Offline review of the prior
worker's retained arrays finds four failing A1 cases, with all 30 differing
byte observations confined to bit 7 of the high byte. All 20 GPU arrays are
identical before/after that worker's repair.

Before editing production or changing the existing fixture, a separate
generated public-COM regression ran both shipped modules. It creates native
Surface7 targets, Device3 and Viewport3 through successful x86 COM calls,
checks the public Lock format, submits DrawPrimitive3/DrawIndexedPrimitive3
POINTLIST calls and reads every native pixel through public Lock. Finite
transformed vertices use z=.5 and rhw=1. The same rendering fixture is retained
unchanged between its causal baseline and final run.

The independent oracle derives component widths/shifts from the public masks,
stores their most significant channel bits and preserves untouched words.
It calls no production encoder, shader, descriptor or raster helper. Its
geometry intentionally follows the existing rounded 2x2 compatibility footprint.
For diffuse `0x004a92d3`, A1 requires native word `0x265a`; software stored
`0xa65a`. Each module failed eight of 13 A1 software cases. Direct WebGL and
the actual owning queued Worker passed, as did X1 and RGB565 neighbors.
These observations are in `public-baseline/result.json`.

The software rectangle helper unconditionally ORed diffuse color with
`0xff000000` before native16 encoding. POINTLIST reused that RGB helper, so
its A1 alpha bit was always set. The original fixture called the same helper
to obtain its expected pixels; parity with that helper was an invalid oracle
for native alpha. Valid public calls establish the implementation defect.

## Format/raster contract and correction

The retained DX6.1 topics in `primary-contract.json` document isolated point
vertices, integer pixel centers/top-left triangle filling, rasterizer depth
comparisons, and DDPIXELFORMAT's alpha flag/mask. Their input is the existing
CHM by path/SHA; Microsoft-authored topics came from a third-party SDK mirror,
whose original distribution authenticity remains unestablished.

Microsoft's [D3DFORMAT documentation](https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dformat)
also defines A1R5G5B5's stored alpha bit and channel ordering. Its later
[rasterization rules](https://learn.microsoft.com/en-us/windows/win32/direct3d9/rasterization-rules)
describe screen-aligned point quads and integer pixel centers. These references
do not establish this emulator's 2x2 size or existing point state bypasses as
complete historical hardware behavior. This repair preserves those existing
geometry/state decisions and corrects native color storage.

`viewport_fill_rect_rgba` retains complete diffuse RGBA for direct, indexed
and execute-buffer points. The existing RGB rectangle entry wraps that helper
and retains its previous opaque-native16 behavior; its 8/32-bit behavior is
preserved. GPU JS, strict errors, caps and supported GPU point formats were
not changed. A4 GPU points remain explicitly unsupported. Retained baseline
module replay additionally reproduces ten A4 software failures per module;
the final ordinary software COM route now retains all four alpha bits.

The existing actual WebGL1/WebGL2 fixture now checks both GPU and WAT helper
bytes against a separate mask-derived oracle, including alpha 127/128. Its
descriptor/helper seam is generated test coverage. The added public-COM mode
uses the actual shipped modules and owning CPU/render Workers. Neither route
is an original game or native Windows execution.

## Validation and captures

- Final public matrix: 20 module/target/route cells, 260 cases, 16,640 native
  pixels and 320 successful public draws, with zero mismatches. A1/X1/RGB565
  cover software, direct WebGL and owning Worker in both modules; A4 covers
  ordinary software COM. Alpha 0/127/128/255, indexed points, NEVER alpha-test
  and blend bypass, viewport intersection, far-point depth bypass/preservation,
  and subsequent triangle depth/blend restoration are checked.
- Actual WebGL1 and WebGL2: 20 independent native-byte cases each, including
  batching, overlap, padded rows, untouched alpha/X bits and state transitions.
- Dependent-native16 regression: all 36 cells, 174 pairs and 102 alternative
  oracle controls pass, including public caps, per-primitive storage and
  depth/scissor preservation. These controls reject alternative pixel models;
  they are not injected renderer faults or native Windows runs.
- Seven focused neighbors pass: indexed texture, batching, point lowering,
  depthless Z/lines, async Flip, fallback counters and draw tracing. The
  bounded-readback browser neighbor passes. Required locked full builds pass.

Two known neighboring failures still reproduce: the viewport background test
reports missing gradient (strip difference 0.0); the caps excerpt fixture
reports missing `gl_texture_combine` import signature. The predecessor run
already reproduced both on its baseline. Logs are retained here; neither is
claimed fixed. No unexpected focused failure was observed.

Personally reviewed compatibility A1 software and owning-Worker before/after
captures are under `public-baseline/` and `public-repaired/`, with filenames
`wine-assembly.compat.wasm-a1-software.png` and
`wine-assembly.compat.wasm-a1-worker.png`. The final A1 captures under
`public-final/` are byte-identical to the reviewed repaired images. RGB tiles
show native RGB as opaque display colors; adjacent grayscale tiles show the
stored alpha channel. Before repair, software incorrectly paints low-alpha
point locations white in the alpha tile; afterward they are black. Worker
captures already show the correct result before repair and retain it afterward.
These are generated native-pixel previews, not gameplay. Coordinator Telegram
relay was requested with these paths and findings.

Chrome is 151.0.7922.108. The public GPU routes actually report WebGL 2.0,
ANGLE Intel UHD 620 (KBL GT2), Mesa 23.2.1 OpenGL 4.6. SwiftShader launch flags
do not establish a SwiftShader renderer result. The separate WebGL1 fixture
asserts its actual WebGL 1.0 context. FPS/audio and performance impact are
unmeasured.

## Reproduction and identities

Run from the checkout, with `CHROME=/usr/bin/google-chrome`:

```sh
POINT_PUBLIC_EVIDENCE=scratch/runs/<id>/public node test/test-d3dim-gpu-points-web.js
POINTLIST_EVIDENCE=scratch/runs/<id>/points.json node test/test-d3dim-gpu-points-web.js
FRAMEBUFFER_DEPENDENT=1 FRAMEBUFFER_EVIDENCE=scratch/runs/<id>/dependent node test/test-legacy-framebuffer-blend-web.js
flock /tmp/wine-build.lock bash tools/build.sh
```

Causal baseline source: `ed1aa7e609cd18b2fcc37ff87bc110734071955b`.
Git plus relevant binary diffs and the owned new-file patch records source;
no source tree or media archive was created. The existing calc PE is used only
as bootstrap and referenced by path/SHA. Four unique tested modules are retained
under `modules/`; exact commands, process identities and cleanup are recorded
in the run.

| Module | Baseline SHA-256 | Repaired SHA-256 |
| --- | --- | --- |
| standard | `d42c4fbcc91d8f20eac4c489f08d9cb2730f4bf2288d72903a09864c4ebb2f09` | `10a0f461f1d4d55e69129df8598ea45a7e1207d411ac39c245fa11d9aefc6c10` |
| compat | `6ca9a332279300ec89ccee7f9958c28c2e917ee36c6f23851e1c0782eb975ed3` | `1e54d2bec7b547f9b985355799a5a7577b2dd8989113d43e9f40896927aa5717` |
