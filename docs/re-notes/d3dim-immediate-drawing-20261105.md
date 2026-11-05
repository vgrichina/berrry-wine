# Device2/3 immediate drawing — 2026-11-05

Implements `Begin`, `BeginIndexed`, `Vertex`, `Index`, and `End` through the
existing D3DIM primitive pipeline. Run evidence:
`scratch/runs/20261105-d3dim-immediate-drawing/`. Validation and publication
identities are recorded below and in the run manifest.

## Primary contract established before implementation

Microsoft-authored SDK5/6 reference HTML is retained under `primary/` in the
run, with URLs, hashes and retrieval time in `primary/provenance.json`.
The source is a third-party SDK mirror, not a native runtime experiment.
Relevant references are SDK5 [Begin](https://library.thedatadungeon.com/directx5/html/dire6j3p.content.htm),
[BeginIndexed](https://library.thedatadungeon.com/directx5/html/dire88fm.content.htm),
[Vertex](https://library.thedatadungeon.com/directx5/html/dire9xta.content.htm),
[Index](https://library.thedatadungeon.com/directx5/html/dire06jq.content.htm),
[End](https://library.thedatadungeon.com/directx5/html/dire83zr.content.htm), and
SDK6 [Begin](https://library.thedatadungeon.com/directx6/devdoc/live/directx/imref_1b50.content.htm),
[BeginIndexed](https://library.thedatadungeon.com/directx6/devdoc/live/directx/imref_4a78.content.htm),
[Vertex](https://library.thedatadungeon.com/directx6/devdoc/live/directx/imref_44h0.content.htm),
[Index](https://library.thedatadungeon.com/directx6/devdoc/live/directx/imref_5tes.content.htm),
[End](https://library.thedatadungeon.com/directx6/devdoc/live/directx/imref_9wys.content.htm).
The retained SDK7 `d3d.h` and `d3dtypes.h` confirm interface signatures,
enumerations, canonical FVF constants and structure offsets. Their existing
paths/hashes are referenced in the run input manifest. Retained Wine
`wine-device.c.gz` corroborates nonindexed packing but leaves `BeginIndexed`
and `Index` stubbed; those stubs are not evidence for indexed semantics.

| Contract | Implementation |
| --- | --- |
| Device2 accepts D3DVERTEXTYPE 1/2/3 | Normalize to VERTEX/LVERTEX/TLVERTEX, each 32 bytes; LVERTEX reserved DWORD stays at +12. |
| Device3 accepts an FVF, not that enum | Decode actual compact stride and selected supplied UV set before canonical packing. |
| Begin permits Vertex; BeginIndexed permits Index | Per-device modes reject orphan, nested and mismatched calls; Device2/3 non-IUnknown entry points reject calls during a sequence. |
| Index parameter is WORD | Use low 16 bits and reject indices outside the copied source. Indexed POINTLIST is invalid. |
| End flags are reserved | Require zero. Too few vertices fails without drawing; line/triangle lists ignore an incomplete final primitive. |
| SDK6 requires scene brackets | New Begin-family calls require BeginScene; EndScene cannot terminate an active primitive sequence. |
| WAIT, DONOTCLIP, DONOTUPDATEEXTENTS; DX5 OUTOFORDER; DX6 DONOTLIGHT | WAIT fences existing work; clipping/order hints preserve the existing pipeline; preserve clip-status storage for DONOTUPDATEEXTENTS; DONOTLIGHT uses supplied colors or white diffuse/zero specular. |

SDK documents do not establish exact native HRESULTs or recovery state for
every invalid sequence. This implementation uses documented invalid-parameter
failure, a sticky first submission error, and an End that always closes the
sequence. A failed sequence emits no partial geometry. These are explicit
recovery choices, not claims of native HRESULT/recovery equivalence.

## Ownership, capacity and unsupported cases

State +4028 owns a lazily allocated 48-byte descriptor; +3956 records scene
bracketing. These are device lifetime fields, not state-block capture members.
Vertex copies immediately. BeginIndexed owns a canonical copy before success.
Streams grow geometrically by allocating before freeing their previous buffer.
The finite limit is 65,536 submissions/source vertices and 4 MiB raw indexed
input. Capacity and allocator failures return E_OUTOFMEMORY and latch until End.
Final device Release frees descriptor, stream and any unfinished indexed copy;
nonfinal Release preserves them.

End allocates checked TL storage, uses the existing projection/lighting helpers,
and calls the existing primitive funnel. Its Worker encoder copies submitted
vertices/state synchronously. End can therefore free temporary storage before
the delayed consumer runs. The renderer never dereferences the live builder.

Explicit E_NOTIMPL remains for unsupported FVF extensions (blended positions,
non-2D UV dimensions, excessive sets, noncanonical reserved fields), simultaneous
normal/prelit color data without DONOTLIGHT, texture transforms or generated
texture coordinates, and input spans which cannot be proved contiguous. Malformed
primitive/FVF/flags/pointer arguments fail rather than return silent success.
This does not broaden existing lighting, clipping, texture-stage, scene-error,
or native Windows equivalence claims. Existing non-Begin drawing paths retain
their previous scene-bracketing policy. External viewport/material/light-object mutation
and cross-interface misuse are not newly qualified.

## Validation

The final `flock /tmp/wine-build.lock bash tools/build.sh` passed
(`build-final.log`). Tested source was main
`fa829102b696fd6ce6e439e74dd3d18dd4cb350b` plus the owned changes retained as
`relevant-uncommitted.patch` and `owned-new-files.patch`. `tested-source.json`
records exact source, existing input and module paths/hashes. No module/media
copies or source archives were made. Final module SHA-256:

- `build/wine-assembly.wasm`: `34951f71b69b36c353eef5afa40eb398f291da25c4a8b678e8e9b26eb1435103`.
- `build/wine-assembly.compat.wasm`: `38574c63b04f83ef9e0467967cacab43021efe78b88ea85f338bbf32d4da2630`.

`node test/test-d3dim-immediate-drawing.js` passed on both modules: 1,623 real
x86 public COM records and 79 pixel checkpoints each, including actual guest
allocator exhaustion/recovery and the 65,536/65,537 capacity boundary.
`focused-final-uv/` retains the receipts. Tests poison/reuse caller storage,
interleave same-version and different-version devices, release unfinished
sequences, check compact/canonical strides and selected second UV sets, and
compare every solid target pixel against independent colors and DrawPrimitive.

With `CHROME=/opt/google/chrome/chrome`, `LEGACY_RENDER_MODULE_DIR=build`, and
run-specific `LEGACY_RENDER_EVIDENCE`, the finite-deadline
`node test/test-legacy-texture-rendered-contract.js --immediate` and
`--immediate --compat` runs passed. Each module exercised software (77 pixel
checkpoints), direct WebGL (77), and the actual production Worker queue (83).
Both GPU arms reported zero fallback/backend errors. All six primitive types
and valid indexed types ran in each arm. Worker tests held real submissions
while caller storage and device streams were reused, then verified the delayed
red/green/purple submissions and subsequent purple streams. Deliberately dropped
vertices, cross-device colors and corrupted held queue vertices failed at their
designated independent pixel checks. Bootstrap failures cannot satisfy these
negative controls. Final receipts/captures are in `canonical-final/` and
`compat-final/`; all 12 final captures were personally inspected, with hashes
and observations in `capture-review.json`.

The available WebGL implementation was SwiftShader. Physical-GPU and native
Windows runtime/HRESULT equivalence were untested. Allocator exhaustion ran in
the software public-COM tests; GPU allocator-exhaustion arms were untested.

Seven focused regressions passed: interface-spec, creation-interfaces,
indexed-texture, v3-vertex-buffer-draw, texture-release-arena,
viewport-query-interface, and d3d7-stateblocks. `regressions.json` records each
finite process lifetime and zero exit status. The required quiet-handler
inventory decreases by one because Device2 SwapTextureHandles now rejects
active-sequence misuse; its behavior outside a sequence is not newly qualified.

Browser close completed normally (exit 0, no signal), owned server/devtools
ports refused connections, temporary profiles and owned test processes were
absent, and both build/runtime locks were free at handoff. Exact independent
checks and watcher cleanup are in `cleanup.json`. No game original, held crash
investigation, gameplay/historical27 claim, deployment, source archive,
module/media copy, or remote box is involved. The coordinator owns shutdown;
box ID/state/expiry are not applicable. No further task work is scheduled.
