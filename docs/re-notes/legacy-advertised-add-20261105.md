# Advertised legacy D3DTBLEND_ADD (8)

Assignment: D3D-LEGACY-TEXTURE-CAPS-AUDIT-20261013. Evidence:
`scratch/runs/20261105-legacy-advertised-add/`.

## Primary contract established before implementation

Reuse the Microsoft DX6.1 SDK topics and SDK header retained by
[the preceding legacy blend investigation](legacy-advertised-decal-blend-20261105.md).
The Microsoft-authored help is preserved in a third-party SDK mirror pinned
to commit `0e34cd0ff275f5ed91c82963f75297623714acf3`; distribution signature
authenticity has not been established. No formula is inferred from enum names.
The retained input paths, byte lengths, SHA-256 hashes, topic text and header
enum excerpt are recorded in this run's `primary-contract.json`.

DX6.1 `devdoc/live/directx/imref_789w.htm` explicitly defines ADD8 as adding
the texture lookup and Gouraud interpolants, saturating overflowing color
components to their maximum, and preserving source alpha:

```
cPix = cTex + cSrc       (componentwise saturation)
aPix = aSrc
```

The topic says ADD was introduced in DirectX 5.0. It does not exclude ADD
on Device3. The same SDK's `imover_3acl.htm` independently gives the Device3
stage equivalent: COLOROP=ADD, COLORARG1=TEXTURE, COLORARG2=DIFFUSE,
ALPHAOP=SELECTARG2, ALPHAARG2=DIFFUSE. Its unsupported-mode exception names
DECALMASK and MODULATEMASK, not ADD. `imover_163o.htm` identifies Device3
SetRenderState(TEXTUREMAPBLEND) as the texture-handle API.

Consequently ADD's RGB and alpha results are independent of texture alpha;
the same stored RGB in RGBA and no-alpha RGB formats must produce the same
ADD result. Diffuse alpha must survive even when texture alpha is absent,
zero, fractional, or opaque. Saturation applies independently per RGB channel;
there is no alpha addition or alpha modulation in this contract.

Do not transfer the DX7 Device7 obsolete-render-state restriction to Device3.
Mixed legacy/TSS order remains an existing emulator compatibility invariant,
not an SDK guarantee: the SDK calls mixing those APIs unpredictable.

## Implementation and verification

At initial inspection, main `cbbe710fb18cc392fe36aaa221d1f0b2fe426f8e`
retains only legacy modes 1/2/3/4/7 in live and recorded effective state.
ADD8 therefore clears the effective marker despite advertised blend caps.
The software combiner lacks ADD; the GPU descriptor lowering maps operation 7
to MODULATE even though the fixed-function shader already implements ADD.

Preparation remained source-only until AoE3 genuineDXSETUP1925 released at
17:55:42Z, Conan installed-state1935 at 18:16:14Z and Aranna orderedread1945
at 18:31:58Z. Before any shared edit/test/build/runtime, `release-gate.json`
independently verified 345 absent PIDs, 141 refused ports, 36 absent profiles,
four free locks, no heavy process and sufficient disk. The preceding blend
worker had released the exact source/library/test paths at 17:43:35Z.

The live and recorded effective legacy marker now retains ADD8. Effective
stage loading maps it to RGB ADD and alpha SELECTARG2(DIFFUSE), preserving
raw TSS. The software combiner adds RGB bytes with independent unsigned
saturation and selects alpha separately; GPU descriptor lowering preserves
RGB ADD without adding alpha ADD. Neither capability mask changes. Existing
Device7 TextureOpCaps remains `0xF`; this is no new TSS capability promise.

The independent byte oracle uses diffuse RGB `(51,153,255)`, alpha 170,
texture RGB `(180,45,90)` and stored alpha 85. ADD must produce
`(231,198,255)`, alpha 170, in both RGBA and no-alpha formats. Additional
textures use alpha 0/255 and RGB `(240,0,0)` / `(0,180,0)` to distinguish
independent red/green saturation from packed carry or wrap. GREATER tests
at 128 and 213 must respectively retain and reject source alpha 170.
All of these expectations come from the SDK equations, independently of
production state lowering and shader code.

The fixture retains preceding mode/TSS/stateblock coverage and adds
ADD recording isolation, Apply/Capture, both mixed setter orders and held
queued draws. Queued alpha cases switch live state to MODULATE (RGBA) or
COPY (no-alpha) before consumption, providing different alpha outcomes.
The ignored-ADD control calls actual Device3 SetRenderState(21,8),
requires S_OK and raw readback 8, then deliberately cancels only the effective
selection by rewriting the existing raw COLOROP. Raw TSS stays identical;
the independent RGB oracle rejects the resulting ignored effective ADD.

`baseline-summary.json` records the pre-repair failure after successful real
Device3 ADD setter and DP/DIP calls: actual `(36,27,90)` instead of the SDK's
`(231,198,255)`. `render/result.json` and `verification-summary.json` record
the repaired Chrome 151 public COM results:

- Both shipped full modules: software 74 observations, direct WebGL 74,
  queued Worker 94 each, totaling 484 independent pixel observations.
- Twenty held queued draws, including both directions of ADD/mode changes
  and RGBA/no-alpha source-alpha witnesses after live mutation.
- Six successful-setter ignored-ADD controls and six preceding ignored-mode
  controls rejected by independent pixels, one of each per module/backend.
- Actual Device3 SetRenderState, DrawPrimitive and DrawIndexedPrimitive
  HRESULTs checked; raw legacy readback and raw TSS preservation checked.
- GPU routes have exactly 74/94 GPU draws with zero fallback/errors and real
  fence/readPixels synchronization. Each legacy caps field stays `0xFFFF`.
- Adjacent alias and indexed-texture regressions pass; the required
  `flock /tmp/wine-build.lock bash tools/build.sh` passes (`build.log`).

Tested canonical module SHA-256 is
`144d156bec9e4be2654fafeb67d9bf9b6746d514ee83348e2f401547aa7ff4a4`;
compatibility is
`6e5fbefc2089ac7128a82ee843449ed1965c0c79cc0a20fd85c54c4ab34b8244`.
Both unique modules are retained. Canonical captures were inspected;
each backend's decoded screenshot pixels also match across the two modules.

The optional old operation-cap excerpt test still has its known missing
`gl_texture_combine` signature lookup and also encodes ADD's old MODULATE
fallback as an unsupported-operation diagnostic. It is not the acceptance
oracle for this assignment and was not run or edited here. Its repair was not
needed for the real public COM suite plus alias/indexed adjacent checks.

## Evidence and reproduction

From the repository root, after obtaining the local runtime:

```sh
flock /tmp/wine-build.lock bash tools/build.sh
CHROME=/opt/google/chrome/chrome \
LEGACY_BLEND_EVIDENCE=scratch/runs/<run>/render \
node test/test-legacy-advertised-blend-web.js
node test/test-d3dim-texture-stage-alias.js
node test/test-d3dim-indexed-texture.js
```

`implementation-base.txt`, `runtime-relevant.binarydiff` and
`owned-new-files.patch` preserve the exact source reconstruction; Git is the
source archive. `published.json` records the published main SHA and
`artifact-hashes.json` pins the evidence. There is no source archive or copied
game media. The browser exited normally and its server closed; `cleanup.json`
records independent process/port/profile/lock cleanup before final release.
No missing ADD semantic rule remains. No game, subworker, public deployment
or complete legacy-capability audit is claimed. Box ID/state/expiry: N/A.
