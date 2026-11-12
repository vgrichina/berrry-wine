# Forsaken: retained explosion atlas and target order, 2026-11-12

For **GPU24138, source7608/1 only**, the original `SMLEXPL.PPM` reproduces
all **16 distinct retained native RGB565 texels**, and `smlexpl.off`
reproduces the four retained triangles' atlas rectangles. The immediately
preceding opaque scene draw supplies the observed destination color. This
closes the sampled asset-content and immediate target-order boundaries;
the complete DIB/upload, live loader-to-destination copy, and exact GPU
sampling remain unresolved. No runtime defect or production patch is proved.

Parent: [guest state selection](forsaken-guest-state-selection-20261112.md),
`9bae6e1815a41455f66aecca813d5270e56b2140`.
Run: `scratch/runs/20261112-forsaken-texture-target-provenance-1805/`.
This is read-only analysis of that parent's retained original evidence and
installed media, with no new original execution or emitted observer change.
The later requested-selector scene **GPU24337, source7680/0, texture210**
is excluded. The selected20011 call does not explain this earlier witness.

## Asset bytes and original writer boundary

The witness binds texture handle244, actual entry131812992, DIB476602368,
256×128, pitch512, 16bpp format1. Its decoded cache generation is `d3dim18`;
the submitted image has that same key. Among all **54 installed PPMs**,
12 have these dimensions. Only
`test/binaries/candidates/forsaken-demo/installed/data/textures/SMLEXPL.PPM`
matches all16 coordinates under top-down RGB565 conversion. No vertically
flipped candidate matches all16. Asset SHA256:
`3decc7c3b982d147253021851673355d9a14a677b90c9e07081eb358c149515a`.

Examples from the actual retained DIB/cache samples, with native bytes in
little-endian order:

| Coordinate | Native bytes | Decoded RGBA |
| --- | --- | --- |
| 92,26 | ff ff | 255,255,255,255 |
| 92,27 | fa ff | 255,255,214,255 |
| 23,14 | 5d ff | 255,235,239,255 |
| 34,7 | 65 bb | 189,109,41,255 |
| 35,7 | 03 8a | 140,65,24,255 |
| 28,25 | c3 20 | 33,24,24,255 |
| 29,25 | 00 00 | 0,0,0,255 |

`analysis.json` retains all16 original RGB triples, native bytes, decoded
values and DIB-relative offsets. All20 sample entries, including repeated
coordinates, agree with bit-replicated RGB565 decoding. This is a content
match at retained coordinates, not a hash of all65,536 DIB bytes.

The original 564-byte `data/offsets/smlexpl.off` begins with one texture name,
`SMLEXPL.PPM`, then count16. Its rectangle descriptors match the submitted
UV bounds exactly: triangle13 uses rectangle4
`(79/256,0)..(115/256,38/128)`; triangles17,18,21 use rectangle2
`(21/256,0)..(46/256,26/128)`. Thus both sampled content and independent
atlas coordinates identify the explosion asset. This does not imply that
the selected sample or the full viewport should be white.

Original EXE SHA256 remains
`366ec5d0943daca839836296f9fb52724e94dc155630c6b0c30d7181106b5e24`.
Read-only original disassembly identifies the P6 surface loader at
`0x4cccb0`, its Lock return`0x4ccf19`, and Unlock return`0x4cd6e4`.
The16-bit path at`0x4cd288` reads RGB bytes through table`0x7f5480`,
divides by mask-derived quantization divisors, shifts the channels and
stores a WORD at`0x4cd3b0`. It also avoids quantizing a nonblack texel to
black. Gamma-table identity and the live filename are not recorded here.

The retained CPU tick30 has this real loader's Lock/Unlock for temporary
surface**243**, this136456088, backing guest23003564: rows159047–159052,
both returns0. Allocation row159053 creates destination surface**244**;
row159054 frees243. These are **allocation/free** kind21/22 events,
not Texture::Load receipts. The inherited CPU observer excludes the Load
API and kind23 copy trace. Consequently the specific243→244 copy and its
filename/bytes are **not proved** by this adjacency. The sample/atlas
content match is stronger evidence than assuming an allocation-order join.
All addresses above are historical identities discovered in retained
records, not instructions to read those addresses in another owner.

## Upload and sampling limits

Nine relevant current source files match final1735's SHA256 pins, including
`d3dim-gpu.js`, `d3dim-draw-trace.js`, the D3D9 backend/fixed/shader files,
`gpu-backend.js` and the three D3DIM/DirectDraw WAT fragments. The recorded
source commit plus empty relevant binary patch reproduces those files.

In that pinned path, `_textureLevel` copies the decoded RGBA into the
`d3dim18` cache; the first use on a target supplies those pixels, and the
backend's keyed texture path uploads/reuses that key. The retained sample
records read the cache's decoded pixels and the observation-time native
DIB. The submitted texture uses repeat U/V, linear min/mag and mip0,
with no key, palette or palette alpha. All16 native/cache decode pairs
match. This excludes a decode discrepancy at these coordinates; it does
not directly read back the GL texture or prove its complete upload.

The observer's loop stops as soon as **four** covering triangles are found.
The witness contains60 submitted triangles (180 owned vertices), but
retains only triangles13,17,18,21. Their constant vertex RGB is64. Applying
an ideal bilinear level-zero model at the retained UVs gives these source
RGB contributions:

| Triangle | Ideal modulated RGB |
| --- | --- |
| 13 | 64.000,64.000,63.448 |
| 17 | 64.000,63.838,63.332 |
| 18 | 45.672,27.247,9.599 |
| 21 | 28.798,18.866,12.241 |

Adding just these four to the observed destination predicts approximately
**243.469,255,255**, rather than observed255,255,255. This is **not a proved
rendering mismatch**: later covering triangles may be absent because of
the four-hit cap, visibility/depth is not recorded, and this arithmetic
is not the actual GPU fragment/sampling oracle. Neither four hits nor
the nominal60 triangles establishes how many fragments passed depth.

## Ordered target contents at 320,240

The target entry131805408 alternates DIBs. The relevant current backing is
**471527424**, not the other buffer472166400. Retained GPU order gives:

| GPU order | Actual operation/source | Color or bytes |
| --- | --- | --- |
| 24117 | Earlier readback to471527424 | native c5 83 |
| 24129 | Natural upload of471527424, command7605 | same c5 83 → 132,121,41 |
| 24130 | Accepted clear, flags2, command7605 | depth clear; color stays132,121,41 |
| 24134 | Opaque scene source7607/0, texture entry131811904 | 132,121,41 → 0,12,8 |
| 24137 | Opaque scene source7607/1, texture entry131812480 | 0,12,8 → 41,166,189 |
| 24138 | Additive source7608/1, explosion texture244 | 41,166,189 → 255,255,255 |
| 24139 | Completed ordinary readback to471527424 | native ff ff |

These actual before/after joins all agree. The immediate destination is
the preceding opaque scene's output, not an already-white target or the
other buffer's contents. This resolves the immediate prior-color ordering
for this pixel; it does not prove every prior CPU write or frame-wide order.
The clear wrapper records target metadata **before** `_clear` reconciles
the target's backing, so its target field still names472166400 while its
after pixel belongs to471527424. The nested upload24129 and subsequent
actual draw targets identify the transition. That diagnostic field timing
must not be interpreted as a cross-buffer color clear.

## Verification and remaining witness

`python3 scratch/runs/20261112-forsaken-texture-target-provenance-1805/analyze.py`
passes the asset scan, native/decode pairs, atlas rectangles, target history,
actual loader rows, nine frozen-source pin checks and EXE identity. It hashes
70 referenced inputs without copying source or media. Small original
disassembly slices and the exact source/owned-file patches are retained in
the run. No build or production regression was needed for this docs-only
finding; inherited observer controls were not rerun or promoted to fresh ones.

The next bounded observation should capture **all** covering triangles of
one natural submission, its existing uploaded texture generation, and the
unchanged depth/target context; then derive an actual sampling/fragment
oracle. Separately the remaining loader edge is live filename/gamma/source
surface → destination244 with a completed kind23 copy receipt. Any observer
change still needs emitted passivity, return/error identity, actual CPU/GPU
bootstrap controls and final freeze/import gates **before** allocation;
reuse final1735 attach/private translator, passive Execute/selection,
19-field identity, ACK/readiness and prearmed independent release helpers.
No blend override or guest write/call is justified by this result.

Actual /home free fell from1,518,219,264 to**1,497,341,952 bytes** during
read-only work; no new native action or box creation followed or preceded
that crossing in this task. No filesystem reserve change was applied.
New box **N/A**, state**NOT_CREATED**, expiry**N/A**, stop receipt**N/A**.
The predecessor's archived box remains historical evidence; it was not
resumed, stopped again or deleted. This task makes no new gameplay,
input-causality, global-first-white, full-scene parity, FPS or audio claim.
