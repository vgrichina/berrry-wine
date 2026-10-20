# State144 contract: bounded result, 2026-10-20

**Disposition: FALSE/default policy remains blocked on missing evidence.**
Do not implement an any-key-tap rejection rule or certify the existing cutoff.
The task's phrase “default FALSE” is not an established native API default.
Explicit FALSE and an untouched device must remain separate test conditions.

Reviewed fresh remote main `63d22caf879ca77d891d284f7926416a210136c2`.
The October 14 report and follow-up JSON were read, then reconciled against
`docs/legacy-colorkey-sdk-contract.md`,
`docs/legacy-colorkey-false-audit-20261015.txt`, and
`docs/colorkey-blend-enabled-20261015.txt` from that main.
Their TRUE implementation/validation supersedes the October 14 missing-plumbing
finding. This report does not repeat those runtime tests. No production files
were changed.

## Primary evidence, versions, and limits

1. **Microsoft DirectX 7 SDK, D3DRENDERSTATETYPE**, preserved HTML:
   [C/C++ reference](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_5fdw.content.htm).
   The enum associates 144 with COLORKEYBLENDENABLE and explicitly names
   IDirect3DDevice7. Short excerpt: “Alpha-blended colorkey mode sets the alpha
   and color of matching texture samples to 0.” Application alpha testing and
   blending control the subsequent result. The entry states neither an initial
   value nor a FALSE-mode filtering algorithm.
   [Library provenance](https://library.thedatadungeon.com/) identifies the
   DirectX 7.0a SDK as the source of the 1999 reference. This is a preserved
   Microsoft text on a third-party host, not an independently authenticated SDK
   binary extraction.

2. **Microsoft DirectX 6 SDK, D3DRENDERSTATETYPE**, preserved
   [Device3-era reference](https://library.thedatadungeon.com/directx6/devdoc/live/directx/imref_5fdw.content.htm).
   Device3 here means the DX6 interface, not DirectX 3. The declaration contains
   state41, stencil states and WRAP0–7, but no state144 or COLORKEYBLENDENABLE.
   Its COLORKEYENABLE entry says “The default value is FALSE.” That establishes
   state41's default only. An absence in this enumeration is not evidence that
   a later runtime must reject state144 on a queried Device3 interface.

3. **Microsoft-authored d3dtypes.h**, [SDK header mirror](https://raw.githubusercontent.com/apitrace/dxsdk/master/Include/d3dtypes.h),
   lines1269–1287 of retrieved file: `#if(DIRECT3D_VERSION >= 0x0700)` encloses
   `D3DRENDERSTATE_COLORKEYBLENDENABLE = 144`. Later compatibility declarations
   mark it retired for DX8 interfaces. This is a later SDK header retaining
   DX7 declarations, not an asserted original 1999 header release. Its
   compile-time version guard supports the DX7 introduction boundary; it
   supplies no runtime acceptance/default rule for Device3.

4. **Microsoft DirectX 7 SDK, D3DPRIMCAPS**, preserved
   [capability reference](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imref_33xg.content.htm).
   COLORKEYBLEND excerpt: “Device supports alpha-blended colorkeying through
   the use of the D3DRENDERSTATE_COLORKEYBLENDENABLE render state.”
   This is an optional capability, distinct from TRANSPARENCY and filter
   support. A device advertising it promises enabled-mode support; advertising
   LINEAR alone cannot supply the missing disabled-mode equation. Current
   `fill_primcaps` advertises texture mask0xF7DF, including COLORKEYBLEND0x1000
   (the October14 mask0xFFDF is historical).

5. **Microsoft DX7 Visual Basic reference**, [CONST_D3DRENDERSTATETYPE](https://library.thedatadungeon.com/directx7/devdoc/live/directx/vbimref_26aq.content.htm):
   “Nonzero to enable alpha-blended colorkeying, or zero to disable it.”
   It reiterates replacement and application-controlled processing but likewise
   does not supply the state144 initial value. The separate
   [Color Keying State page](https://library.thedatadungeon.com/directx7/devdoc/live/directx/imover_3e78.content.htm)
   concerns state41. Neither can be cited as a FALSE-default specification for
   state144. Noncanonical nonzero values are outside this task's TRUE/FALSE
   matrix; production currently selects explicit value1.

6. **NVIDIA, Doug Rogers, Color Key in Direct3D**, [original-host PDF](https://developer.download.nvidia.com/assets/gamedev/docs/ColorKey.pdf),
   pages1–5, especially page4: “If the texture is palletized, the color key is
   an index.” It describes DX5 compatibility in DX6 and TNT behavior: keyed
   alpha becomes zero while RGB remains, followed by filtering and application
   alpha testing, or implicit GREATER0 when testing is disabled. This supports
   native-index identity and a concrete older vendor policy. It does not name
   state144 or prove a DX7 FALSE rule. Alpha-bearing textures/palettes are
   excluded from the table below.

7. **Intel G45 PRM, volume4**, [original-host PDF](https://cdrdv2-public.intel.com/691014/g45_vol_4_subsystem.pdf),
   §4.3.1.2, printed p110: “Kill the pixel if any contributing texel sample
   matches the key”. The alternative replaces matches with zero RGBA and is
   associated with COLORKEYBLENDENABLE. These are hardware choices, not a
   Microsoft mapping of FALSE/default. “Contributing” alone does not settle
   whether a fetched, zero-weight tap participates in the kill operation.

## Actionable truth table

Assume ordinary opaque P8 or RGB565, a supported filter, effective state41
and surface key, a single texture stage selecting texture RGB/alpha, no fog,
and all coverage/depth tests passing. Let K be native key membership, weights
be nonnegative and sum to1, and U be the weighted sum of nonkey RGB.
“Draw” means survives key processing; other application tests can still reject.
The TRUE column is a mathematical consequence of sample replacement, before
format-specific quantization. It does not promise final destination alpha.

| Filter footprint | DX7 explicit TRUE, supported COLORKEYBLEND | DX7 explicit FALSE | Device3/DX6 |
|---|---|---|---|
| All fetched taps keyed | sample RGBA=0; no automatic key discard | reject under basic key transparency with app alpha test disabled | same basic all-key rejection; state144 not in DX6 contract |
| No fetched taps keyed | ordinary filtered RGBA | draw; key identity must not depend on duplicate palette RGB | draw; ordinary filtering |
| Positive keyed and nonkey weights | `(U, 1-sum(key weights))`; app selects test/blend | unresolved: any-match kill versus alpha-derived policies | NVIDIA documents retained-RGB/filtered-alpha policy; not universal hardware proof |
| Only zero-weight taps keyed | same as unkeyed weighted sample | unresolved zero-weight participation | unresolved universal rule |
| Only zero-weight taps nonkey | zero RGBA | unresolved fetched-versus-positive-contribution rule | unresolved universal rule |
| State41 disabled or no effective surface key | ordinary sampling | ordinary sampling | ordinary sampling |

For TRUE with alpha test/blending disabled, zero RGBA still survives and may
write depth. With texture alpha selected and GREATER0 enabled it is rejected;
with opaque diffuse alpha selected instead, GREATER0 can pass. State144 alone
does not select framebuffer blend factors. For FALSE, testing ALWAYS must
not be assumed equivalent to disabling application alpha testing: NVIDIA's
older documented policy distinguishes them.

An untouched DX7 device has **unknown state144 initial value in the recovered
normative evidence**, so no row assigns it to either column. Device3 on a DX7
runtime needs its own observation; sharing an emulator state array is not an
API contract.

## Current source comparison and exact lightweight checks

Run from repository root:

```
node --check docs/re-notes/d3d-state144-contract-20261020/check.js
node docs/re-notes/d3d-state144-contract-20261020/check.js
git diff --check
```

`checks.json` records the extracted predicates, source SHA256s and eight
supplied-sample cases. The JavaScript check parses and interprets the actual
WAT key-rejection expression, using only its simple integer operations and
the linear/general branch. It evaluates the exact GLSL cutoff expression
extracted from the shader generator. It does **not** execute WAT, GLSL,
samplers, upload, draw calls, or framebuffer writes. Supplied samples are
explicitly inputs, not measurements of sampler output.

| FALSE characterization (red key, green nonkeys) | software draw | GPU cutoff draw | oracle |
|---|---|---|---|
| all-key red | no | no | basic rejection agrees |
| all-nonkey green | yes | yes | agrees |
| all-nonkey indices with duplicate key RGB | no | yes | software membership mismatch |
| key weights .25 / .5 / .75 | yes / yes / yes | yes / yes / no | ungraded; FALSE rule unresolved |
| zero-weight keys, positive green | yes | yes | ungraded |
| positive key, zero-weight nonkeys | no | no | ungraded |

The duplicate-index mismatch is a focused consequence of the still-present
filtered RGB comparison, not a new rendering-policy proposal. The source
test expects that characterization and exits successfully; it is not a
renderer conformance PASS. It additionally checks disabled-key and TRUE
bypass controls.

Current core lines5331–5378 and5523–5551 show TRUE tap replacement, exclusion
of the FALSE rejection predicate, and routing away from fast16 to the general
keyed sampler. FALSE fast16/general paths converge on the same postfilter
RGB comparison; the P8 point-only native-index fix does not cover filtering.
Core lines738–740 captures state144 in descriptor field40; decode mode2
clears matching RGBA. `lib/d3dim-gpu.js:810` disables implicit key rejection
when keyBlend is true; FALSE still uses `lib/d3d9-fixed.js:347`'s alpha<0.5
discard. The check asserts those routing facts but does not revalidate the
already-integrated TRUE framebuffer suites.

## Exact remaining blocker and stopping condition

Need either original Microsoft DX7 DDK/SDK normative text explicitly specifying
(a) fresh state144, (b) FALSE key comparison/filter/reject ordering and alpha-test
interaction, (c) zero-weight participation, and (d) Device3 compatibility;
or a separately authorized native observation with runtime/device/driver/caps,
surface format, each HRESULT and returned state recorded.

Minimum discriminating observation: fresh GetRenderState(144), explicit FALSE
then TRUE on Device7 and Device3 separately; ordinary 2x2 P8 and RGB565; 0–4
equal-weight keyed taps, duplicate-color nonkey index, exact-center zero-weight
neighbors and a positive 1/256 key weight. Distinguish alpha-test disabled,
ALWAYS, GREATER0 and EQUAL255, record RGB/alpha and depth through occlusion.
Keep HAL and reference/software results separate and condition enabled-mode
claims on returned capability support. The prior October15 audit provides the
detailed experiment; it was not executed here.

No source located in this bounded follow-up settles those missing cases.
Stop here: no guessed renderer patch, runtime retry, broader audit, or task
refill. Alpha-palette precedence remains separately held.
