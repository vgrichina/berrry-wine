# Registered Globe: original draw/pixel band oracle, November 7

The selected black-band boundaries are expected texture content in one naturally
completed registered `dx_globe` draw. An independent scalar calculation and a
separate 60-digit Decimal calculation reproduce **12 selected target pixels
exactly**, on both sides of six black/nonblack transitions. No causal emulator
mismatch was demonstrated and no production repair was made. This resolves the
selected band pixels; it does not certify every pixel, seam, or rendering route.

Evidence is in `scratch/runs/20261107-globe-original-band-oracle/`.
Startup/menu/wireframe coverage was not repeated as the deliverable. The
registered executable, texture, ordinary scene configuration and **56-vertex /
108-face** `sphere3.x` were preserved. The 296-vertex archive mesh was not used.
Mesh SHA-256 is
`bb8bd85a4f13ef27777690295264f7f2475b3b4bb4e936e3b3394ee08c05360f`;
executable SHA-256 is
`ef0f198d8781de117100cbb77dd7f5b3e16990448d5a1a081c570359ceaf377b`;
`tex1.ppm` SHA-256 is
`24ead200deb44edec992a8614cea9707bb1e2cd5035a8b7b9bd16c6aeff2182a`.

## One draw and its pixels

`recovered/original/passive-band-7E96B3B492C477714506B8CD9BC0EE80.json`
contains a bounded owning-render-Worker observation. Its complete event order is
natural clear → natural upload → submission 3 → successful completion 4 →
natural readback completion 5. There is exactly one draw in that interval,
108 triangle-list primitives / 324 submitted TL vertices, with no excluded draw.
The observer stops copying after this first readback. No diagnostic `readPixels`,
fence, flush, guest call, guest-memory edit, camera/clock freeze, or input replay
was introduced. Existing diagnostic metadata attaches the descriptor to submitted
vertices; its before/after callbacks make no rendering requests.

The observed target is `rt=131805376`, DIB `471576576`, **292×254**, 32 bpp,
format 6, pitch 1168. Submitted viewport is `(0,0,292,254)`, depth range `[0,1]`,
no scissor. The natural readback rectangle is `[58,41,233,216)`; its raw
bottom-up RGBA bytes and corresponding native DIB bytes are retained. Thus the
oracle compares the completed draw's target pixels, rather than an asynchronous
desktop screenshot. `natural-target.png` visualizes these exact readback bytes;
the later inspected `recovered/original/startup.png` is a different camera phase.

Effective state is Gouraud prelit diffuse, texture×diffuse RGB, texture alpha,
no additional lighting/fog/specular/alpha test/color key, depth enabled and
written with LESSEQUAL, no culling, source ONE / destination ZERO blending.
The descriptor records WRAPU=1, repeat U/V, point min/mag and no mip filter.
The captured submitted coordinates already include the per-triangle U fixup;
this is not a second raw-before-fixup UV acceptance test. Full descriptor,
viewport, fixed-function state, vertex colors/RHW/UVs and exact texture bytes
remain available in the capture.

The current texture is 256×256 RGB565, pitch 512. Independently parsing the
original P6 and quantizing it gives **0/65,536 native-texel mismatches**;
bit-replicated expansion gives **0/65,536 decoded-texel mismatches**. This checks
this draw's texture, rather than inheriting the October result as pixel proof.

## Independent calculation

`oracle.py` uses only Python's standard library, with no emulator imports or
production sampler calls. It computes triangle barycentric coordinates, selects
the nearest depth plane, interpolates UV and diffuse with reciprocal-W weights,
applies point sampling with repeat addressing, expands the exact RGB565 texel,
modulates diffuse and rounds the 32-bit target's RGB channels. It accounts for
the observed fixed POSITIONT path's 1/16-pixel tie bias. Selected samples are
at least 2.5 pixels from triangle edges and 0.18 texels from texel boundaries;
removing that bias selects the same texels for every retained sample.

Of **5,347 robust interior pixels**, **5,246 match RGB exactly** and all 5,347
are within one channel value of the scalar result. The maximum error is 1;
these 101 one-value differences are retained, not called exact parity or used
to justify a speculative fix. Six transition pairs were selected geometrically
from texture changes, without filtering by pixel agreement:

| Target pixels, left / right | Triangle, zero-based | Source texels, left / right | Predicted = observed RGB, left / right |
| --- | --- | --- | --- |
| (214,138) / (215,138) | 45 | (122,124) / (123,125) | (107,97,38) / (0,0,0) |
| (174,53) / (176,53) | 78 | (127,13) / (132,13) | (0,0,0) / (42,45,53) |
| (205,90) / (208,90) | 39 | (122,62) / (125,63) | (73,85,100) / (0,0,0) |
| (193,150) / (197,150) | 42 | (110,133) / (112,134) | (0,0,0) / (141,122,42) |
| (205,77) / (209,77) | 38 | (128,46) / (133,47) | (0,0,0) / (69,74,88) |
| (150,183) / (154,183) | 4 | (91,173) / (93,172) | (101,88,32) / (0,0,0) |

`check-selected.py` separately decodes the raw submitted bytes and re-evaluates
all covering triangles with 60-digit Decimal arithmetic. It independently
confirms the winning triangles, texels, and all 12 exact RGB results.
`oracle.json`, `interior-pixels.json`, and `selected-decimal-check.json` preserve
weights, depths, next intersecting depths, UVs, native texels and channel values.

An affine-interpolation counterfactual changes predicted RGB at **9/12** selected
pixels. The perspective calculation matches all twelve. Every selected UV is
inside `[0,1)`, so repeat and clamp agree there: these samples establish expected
texture content and perspective interpolation, **not general seam/addressing
correctness**. No native Windows reference, software-route comparison, full
scene parity, FPS, audio, historical27 membership or corpus completion follows.

## Qualification, source, and lifecycle

Before allocating, the actual selected deferred observer attachment passed a
manifest-restricted positive case and missing-observer negative case. Fresh
Chromium qualification exercised actual production guest/render Workers,
identity/module/freshness rejection controls, trusted input independent-release
controls, an exact quit ACK, and passive submission/natural-readback hooks.
All owner/module/freshness, ACK and release helpers were inherited unchanged.
The generated fixture's ordinary Lock was allowed to proceed; this was a local
control, not original guest input. The real driver accepted the immutable
25-minute deadline and rejected 35-minute, expired and NaN values. Local
qualification PIDs, ports, profile, writer and held input were cleared.
The locked full build passed.

Tested source is Git
`6d465979ab58628a0b61e971a90f3e50f16dee0e`, with `dirty-source.patch` empty
and `new-source.patch` retaining the relevant untracked `lib/wininit-boot.js`.
`source.json`, frozen pins and owned helper patches preserve reconstruction;
no source-tree/media archive was made. Actual guest and renderer module SHA-256:
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
The live module is retained. Compatibility module was pinned, not executed.
All **525 staged pins** match after execution; all **215 HTTP 200 response
bodies** match their pinned files. Optional-resource and DLL-search 404s remain
in the audit, including optional TLB probes.

Chrome `151.0.7922.108` used the production threaded legacy D3DIM **WebGL**
endpoint, with zero observed fallbacks/errors at the bound capture. The owning
WebGL2 context reports provider/vendor `Google Inc. (Intel)` and renderer
`ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6 (Core Profile)
Mesa 23.2.1)`. These strings do not establish physical-GPU execution.

One UUID-idempotent 40-minute box, `bx_rv23s37q`, was created at
12:55:41Z, original expiry **13:35:41.302Z**. The immutable driver deadline was
**13:20:41.089Z**. Only one heavy runtime ran on the box; no old box was resumed,
held-risk lane retried, worker delegated, or public deployment made. The
original received **zero native input events**. Its exact quit ACK is retained.

The first terminal audit ran immediately after quit and failed its cleanup
assertion without reporting the failing field. A subsequent read-only evidence
inventory established both own PIDs absent, both ports closed, no profile/writer,
no held input, zero pin mismatches and Chrome exit 0. No original runtime was
restarted or input replayed. **33 unique artifacts / 14,745,817 bytes**, including
the live module, raw draw/pixels, screenshot and logs, were recovered and SHA-256
verified before the explicitly delegated normal nonforced stop. The box is
**archived**, expiry null, stop completed at **12:57:47.630Z**, forced=false.
Local disk remained above 2 GB. No runtime custody remains.

The remaining rendering work is a separately scoped seam/edge or native
reference comparison if needed; the selected original black transitions have
an exact texture-content explanation and do not justify a sampler repair.
