# Forsaken: one complete unsaturated-to-white transition, 2026-11-12

One fresh natural submission is now explained: GPU19234, **source6215/17**,
changes pixel320,240 from **115,65,33** to white. All28 triangles,84 vertices
(**2,688 bytes**), the actual existing uploaded texture generation, and original
per-triangle before/blend/native colors are retained. Actual GL sampling and
native565 conversion match every step. **No renderer defect is proved.**

This is a fresh witness, not a reconstruction of historical GPU24138/source7608/1.
That historical draw still lacks56 triangles; its bytes are irrecoverable from
the retained records. The [complete-coverage parent](forsaken-complete-fragment-coverage-20261112.md),
`793bbfd56`, remains authoritative about that boundary and about the incoming-white
1815 witness. Its retained-four native565 result41→107→173→222→255 and conditional
opaque332 depth rejection are unchanged. The [texture parent](forsaken-texture-target-provenance-20261112.md)
and [selector parent](forsaken-guest-state-selection-20261112.md) are references,
not replacement outcomes or historical full-byte evidence.

## Selection and original context

Evidence is gitignored under `scratch/runs/20261112-forsaken-unsaturated-whitening-1845/`
(controls/oracle), its `-live/` sibling (first original), and `-retry/` sibling
(successful original). `natural-witness.json.gz`, `original-source-join.json`,
and `transition-analysis.json` identify the successful submission.

Before allocation, the bounded observer was changed to skip incoming-white
pixels and retain a submission only when its original outgoing RGB is white.
It examines at most4,096 eligible center-covering,640×480,16bpp,256×128-texture,
ONE/ONE, ZWRITE-off triangle submissions, at most256 triangles each. It records
all vertices and the existing original per-triangle operations, then discards
non-whitening candidates. It was installed at worker startup, before normal
menus and early gameplay. Four eligible unsaturated candidates were examined;
three did not whiten and the fourth was retained. This does not establish a
global first-white pixel or identify the historical onset.

The successful original used normal Single Player, Normal VOLCANO, four Enter
pulses, forward1800ms, and primary fire2000ms. The later complete frame shows
four lives and the respawn room with projectiles. This frame does not attribute
the selected transition to that input. Fresh owner identities/source keys were
discovered from this execution. The independent inherited draw observer joins
GPU19234 to the complete observer's same source6215/17,28 triangles, target,
state, textures, and identical before/after colors. Its event envelope names
6215/18; the record's source6215/17 is the draw identity.

Actual target entry131805408, DIB472166400,640×480,16bpp format1 and texture
entry131812992, DIB476602368,256×128,pitch512 are execution-local identities.
Generation **d3dim17** has131,072 uploaded RGBA bytes, exactly equal to the
cache, SHA256 `1676c8476888538d4227a25d6ccffc68f56ad713ae1868e0603b796cf046b29d`.
The existing keyed GL texture was read after the original submission through a
temporary framebuffer; binding was restored and the framebuffer deleted.
No original texture was replaced/reuploaded. Repeat U/V, linear min/mag, mip0,
viewport, scissor, fixed-function inputs, complete state and all vertex bytes
are retained. This does not assert an unobserved historical full upload or a
new live filename/gamma/Texture::Load provenance trace.

No guest call/write, configuration/AI/health/clock change, blend override, debug
draw, extra fence or forced flush was used. Original target/depth contents were
left in place. Every original triangle reports depth enabled, LESS, writefalse,
range0..1, depthBits16. The observer reads existing colors and state; it does
not read or reconstruct numerical values from the original depth buffer.

## Actual sampling, order and visibility bound

`natural-oracle.cjs` uses the pinned actual shader/backend, all28 triangles and
all uploaded bytes on a separate scratch target. Local and original renderers
agree: Intel UHD620, ANGLE/Mesa23.2.1, WebGL2, subpixelBits4. Original POSITIONT
bias makes the analytic evaluation point320.0625,240.0625. All three analytic
inclusive coverings agree with actual GL source-on-black coverage:

| Triangle | Analytic z (not a quantized depth claim) | Actual GL source RGBA |
| --- | --- | --- |
| 1 | 0.7697128434 | 116,81,37,255 |
| 3 | 0.7739085567 | 192,192,192,255 |
| 13 | 0.7544937943 | 63,53,16,255 |

The other25 triangles have scratch sourceRGBA0,0,0,0. The oracle uses full
sampling, fixed state and rasterization, not an ideal bilinear sum.

| Original triangle/order | Original before | Original after blend | Original after native565 | Visibility evidence |
| --- | --- | --- | --- | --- |
| 0 | 115,65,33 | 115,65,33 | 115,65,33 | no scratch fragment |
| 1 | 115,65,33 | 231,146,70 | 231,146,66 | PASS: original color changes to exact GL passing result |
| 2 | 231,146,66 | 231,146,66 | 231,146,66 | no scratch fragment |
| 3 | 231,146,66 | 255,255,255 | 255,255,255 | PASS: original color changes to exact GL passing result |
| 4..27 | white | white | white | triangle13 pass/reject UNKNOWN; other24 have no scratch fragment |

The CPU565 bit-replication calculation also matches every actual-GL store and
every original afterNative value. The native store after triangle1 reduces
blue70 to66; triangle3's additive result then saturates all channels. Every
original incoming value joins the preceding original afterNative value exactly.
All28 original steps are either the actual GL passing result or unchanged
rejection, with **zero mismatches**.

The original changes prove that triangles1 and3 produced visible fragments;
no saturated-color inference is used. Triangle13 arrives after white, so its
original depth outcome remains UNKNOWN. Both possible outcomes preserve white.
The remaining25 have no GL fragment at this point. Thus even a conservative
superset allowing independent pass/reject choices reduces, after the two
observed passes, to two color-equivalent possibilities for13: both give exactly
white. Actual fixed-depth quantization/order can only restrict that set.
This bounds the observed final color without pretending to know the original
depth threshold or triangle13 visibility. No production patch follows.

## Controls, source recovery and shutdown

Before either original, the final emitted observer passed real-Chrome whole-target
passivity and unchanged original vertex bytes, including an incoming-white skip,
a rejected non-whitening candidate, and later qualifying selection. Four observer
failure/return-error identity cases passed. Actual production CPU and GPU full
bootstrap controls passed. The emitted worker suffix is byte-identical to the
tested observer. Frozen1,552-file import/whole-provision and stale-final-pin
negative gates passed before allocation; remote final verification covered1,555
paths before original execution. Final1735 attach/private translator, passive
Execute/selection, strict19-field binding, readiness/ACK and independently
released input helpers were reused by exact SHA. The control and reuse manifests
retain those hashes. No original production source changed.

Successful source commit is `5fe3bb6529dc2015c2bb91f3f4e4e219fa174cd7`.
Normal actual CPU/GPU module is
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
Exact Git plus relevant binary patches/owned-input patches are retained; no
source/media archive was made. Media remains referenced by existing path/SHA.
Closed patches/logs use verified lossless gzip with recovery journals. Actual
/home samples stayed above1.5GB for new allocation/input; no RAM gate or host
reserve change was applied. Root artifact review is still pending.

A first local lifecycle attempt collided with the GL control's watchdog receipt
and failed **before create-attempt/provider request**. Its actual manager/owner
and adopted watchdog waits are retained. A fresh sibling avoided that collision.

The first original, **bx_wtcsfdsz**, had a preobserved independent two-hour
watchdog, initial expiry20:47:28.384Z. Its13 full PNGs match all19 identity fields;
147 retained drains contain zero eligible center draws. Request12 mistakenly
specified3500ms, exceeding the inherited2000ms limit. The helper rejected it
**before key-down**; no pulse/capture or successful ACK12 exists. Sticky failure
was preserved, with no replay. Chrome exited0 with both EOFs; remote browser
parent exited1 with both EOFs. All319 unique outputs,19,150,831 raw bytes, passed
two independent GETs and local SHA verification. Normal stop
**stop_8108ec9191412929** completed18:55:39.879Z, unforced/errornull; final state
**archived**, expiry**null**.

A separate fresh retry, **bx_acwny97e**, had its independent two-hour watchdog
observed before creation, initial expiry20:55:47.625Z. Seven full PNGs match all19
identity fields; all commands0..6 have successful ACK, including ordinary quit6.
Seventy-two retained drains report no observer failure. All179 unique outputs,
15,509,993 raw bytes, passed two independent GETs plus local SHA verification,
including the natural witness. Chrome and actual remote browser parent exited0
with separate stdout/stderr EOF. Both new lifecycles have actual local caller0,
owner waitpid0, durable manager0 and watchdog0/EOF receipts. The prior1735/1815
wrapper143 histories remain unchanged; these new receipts do not repair them.

Delegated normal stop **stop_c55c862f32948af3** completed19:01:55.310Z,
forcedfalse/errornull. Final **bx_acwny97e state archived, expiry null**.
Neither box was resumed or deleted; none is billing idle. This docs-only result
needs no production build/regression or patched-original before/after run.
The remaining historical witness is still its missing56 triangles and original
visibility context. This fresh explained transition does not substitute for it.
