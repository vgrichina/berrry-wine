# Rectangular power-of-two mip contract — 2026-11-05

The advertised rectangular power-of-two sampler contract passes the bounded
public DD7/D3D7 cases below. No emulator discrepancy was demonstrated, so no
production code or capability mask changed. The addition is
`test/test-legacy-rectangular-mip-web.js` plus this note.

The prior keyed-format/perspective fixture used square 16×16 chains. This
fixture instead uses XRGB8888 16×4 and 4×16 complete chains, with independent
width/height checks on every public Lock. Their image sizes are
16×4→8×2→4×1→2×1→1×1 and 4×16→2×8→1×4→1×2→1×1.
No color-key sampling claim is added.

The public guest x86 COM path acquires DirectDraw7, queries Direct3D7, creates
surfaces and a device, obtains each child with GetAttachedSurface, locks and
fills native image bytes, sets and reads sampler states and draws. It retains
the existing ABI, output/descriptor guards, capability checks and real owning
Worker transport. Both shipped modules must be tested without test exports.

## Expected samples

For screen triangle (0,0),(32,0),(0,32), authored RHWs q0,q1,q2 and unequal
normalized spans a,b:

```
Q = q0 + (q1-q0)x/32 + (q2-q0)y/32
U = a*q1*x/32; V = b*q2*y/32
u = offsetU + U/Q; v = offsetV + V/Q
ux = (Ux*Q-U*Qx)/Q²; uy = -U*Qy/Q²
vx = -V*Qx/Q²; vy = (Vy*Q-V*Qy)/Q²
rho = max(length(width*ux,height*vx), length(width*uy,height*vy))
LOD = clamp(log2(rho),0,4)
```

A separate finite-quad calculation constructs the three homogeneous planes
from barycentric vertex contributions, differences their affine values across
a unit quad, then applies the quotient rule at the sample. It must agree with
the analytic footprint at both software integer positions and the existing
GPU 1/16-pixel bias. Finite differences of divided UV are not the expected
footprint. A hand-derived unequal-axis sample additionally checks coordinates,
all four gradients and the texture-scaled footprint.

Point mip selects floor(LOD+0.5); linear mip mixes adjacent levels. Each image
uses its own width/height for texel coordinates. Point texels use floor(u*w),
floor(v*h); bilinear uses u*w−0.5,v*h−0.5 and four addressed taps. WRAP uses
positive modular integer indices; CLAMP bounds indices to each image's extent.
No addressed coordinates feed back into the footprint. Precision bounds retain
the prior fixture's independent one 8-bit filter-fraction step and byte-rounding
envelope; no tolerance is fitted to observed pixels.

Samples lie inside the triangle, at least three pixels from its outer axes,
with x+y<29. Both sampling locations must avoid normalized integer boundaries
by 0.04 and nearest-mip half-level ties by 0.07; point taps avoid texel integer
boundaries by 0.08 on nontrivial dimensions. Selection uses only authored
coordinates and the analytic oracle before rendering.

Microsoft documents [non-square mipmaps and adjacent-level blending](https://learn.microsoft.com/en-us/windows/win32/direct3d9/texture-filtering-with-mipmaps),
[texel centers and bilinear weights](https://learn.microsoft.com/en-us/windows/win32/direct3d9/bilinear-texture-filtering),
[point-boundary ambiguity](https://learn.microsoft.com/en-us/windows/win32/direct3d9/nearest-point-sampling)
and [independent address axes](https://learn.microsoft.com/en-us/windows/win32/direct3d9/texture-addressing-modes).
The [legacy D3DPRIMCAPS definition](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/d3dcaps/ns-d3dcaps-_d3dprimcaps)
separately defines POW2 and SQUAREONLY. The fixture requires POW2 and excludes
SQUAREONLY in the returned line and triangle capability words. Microsoft's
[rectangular-chain example](https://learn.microsoft.com/en-us/windows/uwp/graphics-concepts/texture-filtering-with-mipmaps)
explicitly ends 4×2→2×1→1×1. The [mirrored Microsoft DX7 SDK hardware note](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_58h0.content.htm)
describes Device7 trilinear versus point mip filtering (page built 1999-09-02).
The successor-API documents support the shared sampling concepts. The stated
analytic isotropic LOD contract is an explicit mathematical model, not a claim
of universal DX7 hardware precision or an observed native-Windows reference.

## Observed coverage and validation

Run: `scratch/runs/20261105-legacy-rectangular-mip-contract/`.
Exact tested main: `c2137510a` (full SHA in `tested-git-sha.txt`), with the
owned new test recorded as a binary new-file patch. Input
`f6b122eb429cbecf7e481cce798cf3419d146cb0` includes the existing
`ddc9e0e511` quotient-gradient repair. Relevant renderer sources remain
unchanged; the exact fetched module bytes are hashed before compilation.

| Module | SHA-256 |
| --- | --- |
| canonical | `10462bd9693cf4f51d382d33767674b736b84e74346f328306d59e35c5e60031` |
| compatibility | `eb59d32227cc18233f93c7b757e0700f9558f0a31af7e3d38090669d4fc15158` |

For **each orientation and each module**, software checks 47 observations from
21 states, direct WebGL1 and WebGL2 each check 34 observations from a
15-state subset, and owning Worker WebGL1 and WebGL2 each check 42 observations,
including four held-state pairs. Total: **20 routes and 796 pixel observations**.
This is rectangular coverage, not a rerun of the prior square keyed matrix.

Checks include unequal-axis MAG and MIN point/linear filtering; point→linear→point
mip transitions; independent U/V WRAP and CLAMP, restoration to WRAP;
varying RHW `[1,.375,.625]` and `[1,.625,.25]`; no-mip restoration in
software; 2×1/1×2 tail selection; and terminal 1×1 mip clamp.
Every image's public dimensions and XRGB8888 pitch are checked.
The plan has 41 samples per orientation whose LOD differs by more than 0.25
if texture width and height are swapped.

Each Worker completes 23 draws with zero errors, fallbacks, native software
draws or fallback software draws, then acknowledges `render-stopped`.
Held production packets retain their actual selected buffer, owning device,
4096-byte state header, sequence and completion counters. Changing live sampler
state leaves the captured packet unconsumed; public Lock fences establish
subsequent consumption and expected old pixels, then a new draw checks new state.

The full serialized build passed, as did the new plan, shader unit suite,
native mip suite (38 observations), DirectDraw mip-chain suite, and inherited
keyed-format/count-selector/projected plans. Only the new rectangular matrix
was rendered. Three public software negative controls reject nearest-only,
level-zero-only and stale-mip-filter variants at pixel checks after successful
draws. Their expected failure evidence is retained separately.

The first plan rejected an insufficiently discriminating authored U-clamp
sample; its offset was corrected before rendering. Another plan rejected a
non-unique inherited source seam; the seam was narrowed. No sampling margin,
precision envelope or production guard was relaxed. These preparation errors
are not emulator discrepancies. The first actual rectangular runtime passed
all routes in 22.6 seconds. `analysis.json` verifies module/source identities,
all mip dimensions, queued fences, Worker retirement and three negative
rejections. `native-contact.png` and its JSON map contain 36 actual 32×32
target captures, personally inspected; numerical assertions apply to the
selected interior samples, not every image pixel.

Chrome reports ANGLE Intel/Mesa UHD 620 despite requested SwiftShader flags;
the exact renderer strings are preserved without physical-GPU qualification.
Chrome exited normally with code 0 and null signal; its PID and dedicated
profile were removed, and the loopback server closed. No boxes were used
(box ID/state/expiry N/A).

ReturnFire1530 and Lords1542 issued exact releases. Strong1555 terminated
following a platform rejection; the coordinator's explicit recovery
`FINAL runtime AND file RELEASE ALLBUILDSFINISHED` at 16:28:38Z released its
slot. Its held operation was not retried or investigated here. Independent
cleanup verified 225 absent predecessor PIDs, 18 absent profiles, 94 refused
ports, four free locks and no heavy runtime before this audit began.

Reproduction from the repository root:

```sh
node test/test-legacy-rectangular-mip-web.js --plan
flock /tmp/wine-build.lock bash tools/build.sh
RECTANGULAR_MIP_EVIDENCE=/absolute/new/run-directory node test/test-legacy-rectangular-mip-web.js
```

## Limits

Only the stated rectangular POT sizes, authored triangles, XRGB8888 format,
point/linear spatial and mip filters, WRAP/CLAMP address states and interior
samples are in scope. No physical GPU, native Windows, original game, gameplay
or 27-application claim. No anisotropic/NPOT/cube/BORDER extension, projected
texture transform, palette/key precedence or default/FALSE state-144 semantics
is established. Existing unsupported/crash boundaries remain unchanged.
