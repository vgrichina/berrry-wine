# Legacy framebuffer paired blend factors and stored alpha

Task: D3D-LEGACY-TEXTURE-CAPS-AUDIT-20261013. Run:
`scratch/runs/20261105-legacy-framebuffer-blend/`.

## Source-only preparation

Preparation stayed source-only behind Aranna loader1840, AoW2 browser1850,
then AoE3 native-system-info setup1900. Their exact FINAL runtime AND file
RELEASE ALLBUILDSFINISHED records arrived at 19:27:34Z, 19:35:35Z, and
19:46:30Z. Before any test/build/browser or shared renderer edit, the gate
independently verified 408 absent PIDs, 157 refused ports, 44 absent profiles,
four free locks, no heavy process, and sufficient disk. Execution began at
19:48Z with a hard deadline of 20:32:50Z. No subworkers or boxes were used.

The preparation source SHA and relevant uncommitted diff are recorded in
`source-sha-preparation.txt` and `relevant-preparation.diff`. Git is the source
archive; no source-tree snapshot or media copy was made.

## Primary contract

`primary-contract.json` records five selectively read Microsoft DX6.1 SDK
topics from the retained CHM at
`scratch/runs/20261105-legacy-advertised-decal-blend/directx61.chm`.
Its SHA-256 is `ade41d4cac0d000629ef5035827f4c6439dd360bc619b6832b33c53f27379c32`.
The original Microsoft-authored help was preserved by the preceding task in
a third-party version-pinned SDK mirror; original distribution authenticity
has not been established. Only five specific topics were read, without
extracting or duplicating the SDK tree.

`devdoc/live/directx/imref_15ic.htm` defines D3DBLEND: BOTHSRCALPHA (12)
is equivalent to separate SRCALPHA/INVSRCALPHA factors. BOTHINVSRCALPHA
(13) uses inverse source alpha for the source and source alpha for the
destination, overrides the destination blend selection, and is supported
only as SRCBLEND. `imref_5fdw.htm` identifies SRCBLEND=19, DESTBLEND=20,
ALPHABLENDENABLE=27, defaults ONE/ZERO, and places texture blending before
framebuffer alpha blending. `imover_8204.htm` describes framebuffer source
and destination blend pairs and alpha-test rejection. `imover_68bo.htm`
states the weighted-sum equation. `ddref_5n3r.htm` defines DDPF_ALPHAPIXELS
as alpha information interleaved with color and dwRGBAlphaBitMask as its
alpha-channel mask. Thus a public 0x41 flag and 0xff000000 mask establish
eight stored alpha bits; a 0x40 flag and zero mask do not. Enum identities
alone are not the oracle.

## Setter-to-draw route and causal baseline

Public Device3 SetRenderState routes to `d3dim_set_render_state`, which
stores the raw factor unchanged; no 12/13 normalization occurs there.
The software triangle path loads slots 332/336 into source/destination
blend factors and forwards them to `d3dim_blend_rgb` when
`gl_sw_rgba_span` is clear. That RGB helper and its channel helper lack
12/13 cases. `lib/d3dim-gpu.js` independently normalizes source factors
12/13 to the documented pairs. The separate native renderer's
`d3d_software_blend_pack` is not this path.

The first rendered baseline records source
`d3ce00646d5872c7e0da88cb9450981d455c0364`; subsequent baseline records may
name its documentation-only descendant. The relevant renderer diff was
empty until the first repair edit at 19:49:43Z. Every execution records its
actual source and shipped-module hashes. The initial browser command found
no Puppeteer-downloaded executable and launched no browser; all actual runs
explicitly used the already installed `/usr/bin/google-chrome`.

All acquisition, state, Lock/Unlock, and DrawPrimitive/DrawIndexedPrimitive
operations use real public x86 COM calls. The software, direct WebGL, and
production GuestWorkerLink/RenderWorker routes consume both shipped modules;
no excerpt module or substituted draw implementation supplies the proof.

With source RGB (51,153,204), destination RGB (180,45,90), and source alpha
85, the SDK equations require factor 12 to produce (137,81,128) and factor
13 to produce (94,117,166), regardless of the conflicting destination
selection. Both modules' software routes instead produced (51,153,204).
Direct WebGL and the owning queued Worker already passed these RGB cases.
See `baseline-rgb-actual/` and `baseline-13/`.

Explicit RGB targets publicly return flags 0x40 and alpha mask zero. Unused
stored X bytes 17/231 are varied independently and are never interpreted as
destination alpha. Factors 8/11 becoming zero on such a target are not used
as bug evidence.

Separate A8R8G8B8 targets publicly return flags 0x41 and mask 0xff000000.
On both modules and all routes, ONE/ZERO should preserve source alpha 85;
software instead stored zero and both GPU routes stored 255. With source
alpha 255 and destination alpha 85, source DESTALPHA (7) should yield
(17,51,68), alpha 85; it instead yielded full source RGB. INVDESTALPHA (8)
and SRCALPHASAT (11) should yield (34,102,136), with alpha 170 and 255
respectively; both instead yielded black. Each factor has its own unchanged
module baseline in `baseline-alpha/`, `baseline-destination/`,
`baseline-factor8/`, and `baseline-factor11/`.

## Repair and regression

Software triangle draws now lower source factors 12/13 to the documented
pairs at consumption time. Raw GetRenderState values and immutable queued
snapshots remain unchanged. The opaque RGB helper and its fast paths remain
in place. A8R8G8B8 framebuffer blending now uses actual destination alpha
and writes output alpha through the existing RGBA arithmetic, retaining the
legacy ZERO/SRCCOLOR RGB truncation path. GPU upload and readback preserve
the alpha byte only for A8R8G8B8; opaque target handling is retained.
No capability mask changed.

`test/test-legacy-framebuffer-blend-web.js` is the permanent regression.
`regression-checked/result.json` records PASS for both shipped modules on
software, direct WebGL, and the actual owning queued Worker:

- 908 independent RGB observations and 478 stored-alpha observations,
  including 150 additional direct GPU alpha comparisons;
- 22 held draws, verifying captured raw blend slots and completion order
  across later changes to both blend states;
- 18 negative controls rejected at the intended independent RGB oracle:
  old paired-factor ONE/default behavior and forced-opaque destination alpha;
- 12,050 public COM calls, exact stdcall/canary checks, zero GPU fallback or
  backend error, and normal Chrome exit zero.

The independent byte equations cover source alpha 0/85/170/255, conflicting
destination selections, explicit ZERO/ONE and source-alpha pairs, disabled
blending, GREATER alpha tests, indexed/non-indexed draws, and two stored
destination-alpha values. Selected products divide exactly by 255, avoiding
unspecified rounding. RGB and alpha expectations are computed separately
from production blend helpers, descriptors, and shader code.

Focused indexed-texture/light-map/blend/format/depth, Device3/7 state aliases,
lit-material alpha, GPU batching, depthless Z, asynchronous Flip, and the
existing legacy DECAL/COPY/DECALALPHA/ADD public browser regression all pass.
`flock /tmp/wine-build.lock bash tools/build.sh` passes in
`build-final.log`. The tested module hashes, relevant binary diff, owned new
file patches, captures, cleanup checks, and artifact hashes are retained in
the run. Git supplies source recovery; no source archive or media copy was
created. Representative baseline/repaired captures were personally reviewed;
alpha correctness comes from actual channel readback, not the opaque preview.

This closes the demonstrated paired-factor and A8R8G8B8 framebuffer failures.
The broader capability audit remains open. Other alpha target formats,
unsupported destination uses of source-only factors, native Windows,
physical GPU hardware, and game/backend parity are not qualified here.
No game, held investigation, laptop Heroes II lane, or public deployment was
run. Box ID/state/expiry are not applicable.
