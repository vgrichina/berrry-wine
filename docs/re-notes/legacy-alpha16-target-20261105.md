# Legacy 16-bit alpha-bearing render targets

Task: D3D-LEGACY-TEXTURE-CAPS-AUDIT-20261013. Evidence:
`scratch/runs/run20261105-legacy-alpha16-target/`.

The ordered source-only gate observed AoE3 wow64 setup1950 FINAL at
20:43:09Z, Aranna passive resource2005 at 20:54:13Z, then Conan first draw2030
at 21:18:34Z. Independent checks found 504 absent PIDs, 196 refused ports,
64 absent profiles, four free locks and no heavy runtime. Shared work began
at 21:18:57Z, with a hard deadline of 22:03:49Z. No game, box, subworker or
public deployment was used.

## Publicly accepted formats and storage contract

`support-probe/result.json` records successful real x86 COM Surface7 creation,
Device3 and Device7 creation, GetSurfaceDesc and guarded Lock/Unlock for both
shipped modules. The explicit target caps are `0x2840`, dimensions 8×8.
This establishes these emulator paths, not native Windows support.

| Target | Public flags | Bits | R/G/B/A masks |
| --- | --- | --- | --- |
| A1R5G5B5 | `0x41` | 16 | `7c00/03e0/001f/8000` |
| A4R4G4B4 | `0x41` | 16 | `0f00/00f0/000f/f000` |
| X1R5G5B5 control | `0x40` | 16 | `7c00/03e0/001f/0000` |
| R5G6B5 control | `0x40` | 16 | `f800/07e0/001f/0000` |

Seven selectively read Microsoft-authored DX6.1 SDK topics are retained as
text and hashes in `primary-contract.json`. The existing CHM is referenced by
path and SHA-256, without copying or extracting its tree. Original distribution
authenticity remains unestablished. `ddref_5n3r.htm` defines alpha pixels and
component masks; `ddref_0o8n.htm` lists these alpha layouts as texture formats.
That texture list does not prove render-target support. `imref_15ic.htm` and
`imover_68bo.htm` provide the RGBA blend factors and weighted sum.

The bounded emulator storage contract retains high component bits: A1 alpha
127 stores 0 and 128 stores 1; A4 alpha 127 stores 7 and 128 stores 8
(expanded values 119/136). Five/six-bit RGB expands by bit replication, and
four-bit channels by multiplication by 17. The independent oracle derives
these operations from the declared masks, without production helpers or
shader code. Every selected RGB product divides exactly by 255. For fractional
alpha products, both adjacent byte values must quantize to the same stored
alpha. Thus intermediate byte rounding cannot explain a failed witness.
No universal historical hardware rounding rule is claimed.

## Reproduced failures and repair

The unchanged-renderer matrix in `baseline/result.json` ran both modules on
software, direct WebGL and the actual owning queued Worker before the first
renderer edit. Exact source SHA, relevant uncommitted test patch, module hashes
and JS hashes are recorded. The baseline retains mismatches explicitly; its
status is BASELINE OBSERVATIONS, not rendered success.

A1 software ZERO/ONE lost a destination alpha bit of 1. GPU ONE/ZERO stored
alpha 1 even for source alpha 0. With source RGB `(51,153,204)`, source alpha
255 and destination alpha 0, DESTALPHA should produce black; all routes instead
produced quantized source RGB `(49,156,206)`. Destination alpha 255, inverse
destination alpha and source-alpha saturation provide separate witnesses.

A4 ONE/ZERO with source alpha 0 should store `(51,153,204,0)`. Software stored
`(68,221,153,51)`; both GPU routes stored `(170,119,153,17)`. With destination
alpha 85/170, DESTALPHA requires RGB `(17,51,68)` / `(34,102,136)`; both GPU
routes instead returned the same wrong source-layout result. All alpha targets
had successful public creation and draws. Opaque X1/565 controls had zero
baseline mismatches, including independently varied unused X1 high bits.

Software now decodes A4 destination pixels with their declared format, blends
A1/A4 through the existing RGBA arithmetic, and encodes native alpha-bearing
pixels through the existing format encoder. GPU upload and readback now handle
A4 channel nibbles and preserve A1 alpha bits. Opaque fast paths and capability
masks remain unchanged. No unsupported format was added.

## Regression and limits

`test/test-legacy-framebuffer-blend-web.js` reuses the existing public COM
producer and adds native 16-bit Lock/oracle handling. `regression-final/`
records PASS for both shipped modules and all three routes:

- 42 positive route/target combinations, 1,736 RGB observations and 1,018
  stored-alpha observations, including 828 new native 16-bit observations;
- 34 held draws, with raw draw-time source/destination state and completion
  order checked across later setters;
- 30 rejected negative controls, including 12 forced-opaque A1/A4 controls
  rejected by asymmetric destination-alpha RGB;
- 22,664 public COM call records with the existing stdcall/canary checks,
  zero GPU fallback/backend errors, and normal Chrome 151 exit zero.

The new matrix covers indexed/non-indexed triangles, alpha 0/85/170/255,
127/128 storage boundaries, ONE/ZERO, ZERO/ONE, DESTALPHA, INVDESTALPHA,
SRCALPHASAT, disabled blending and opaque controls. Earlier 32-bit paired-factor,
alpha-test and A8 stored-alpha regressions remain in the same passing run.
Representative A4 Worker baseline/repaired captures were personally reviewed;
channel correctness comes from public Lock readback and production GPU fences.

Focused indexed texture/format/blend/depth, format enumeration, GPU batching,
points, asynchronous Flip, depthless Z and actual WebGL bounded-readback tests
all pass. Both required locked full builds pass (`build-repair.log` and
`build-final.log`), with identical tested module hashes. Runtime cleanup at
21:27Z independently found four absent browser PIDs, eight refused ports,
four absent profiles, four free locks, no heavy process and 7.24 GB free disk.
Exact Git SHAs, relevant binary diffs, the owned new-note patch and unique
tested modules supply recovery without source archives or media copies.

This closes the demonstrated A1/A4 triangle target conversion and alpha-blend
failures. Device7 creation is checked; rendered operations use Device3. Native
Windows, physical GPU hardware, game parity, dithering, other primitive paths,
multiple unfenced draw accumulation and broader capability coverage remain
unqualified. The next discriminator for a broader target contract is a
quantized two-draw dependency without an intervening CPU Lock; this run does
not claim that result. Box ID/state/expiry are not applicable.
