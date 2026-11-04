# Public DD7/D3D7 cube and BORDER runtime audit

Task: advance `D3D-LEGACY-TEXTURE-CAPS-AUDIT-20261013` beyond accepted
`be2fc9746` sampler rendering. Runtime source is committed main
`0b824288f9d0c849754d68a40f2b13ae1f6ce05a`, plus the recorded owned fixture
patch. Result: **PASS for native cube rejection and the unadvertised BORDER
boundary on both production modules**, through software, owning browser WebGL,
and actual guest/render Workers. No advertised capability mismatch was found;
no production change was necessary. Cube acceptance and BORDER-color sampling
remain unsupported. This does not establish any full27 membership.

The existing [rendered contract](legacy-texture-rendered-contract-20261103.md)
and [Surface4/7 ABI note](../legacy-surface47-abi-20261019.txt) supply the fixture
and ABI context. Accepted source-only cube rejection tests were not repeated.
The existing `test/test-legacy-texture-rendered-contract.js` gains optional
`--cube-border` execution; its original sampler mode remains available.

## Actual advertised contract

Public Device7 `GetCaps` returned identical line/triangle masks in all three
paths and both dispatch modes:

| Field | Actual mask | Relevant advertised bits |
| --- | --- | --- |
| Texture caps | `0xf7df` | `CUBEMAP=0x0800` absent |
| Texture address caps | `0xf7` | WRAP/CLAMP present; `BORDER=0x08` absent |

Public `SetTextureStageState` accepts address value 4 and
`GetTextureStageState` returns 4 for ADDRESSU and ADDRESSV. That state round trip
does **not** advertise BORDER sampling. The test sets distinct border color
`0xff5030d0` (RGB 80,48,208); the observed outside pixels are neither this color
nor the linear border/texel blend `(79,57,197)` (15/16 border plus 1/16 bottom-left
texel). The unsupported fallbacks differ between
backends, consistently with the source comments and absent capability bit.
The regression explicitly characterizes these fallbacks rather than treating
them as a supported BORDER oracle.

## Actual vtable cube rejection

The fixture boots the complete production module with original `calc.exe`,
acquires DD7 via factory dispatch and D3D7/Device7 via public COM, and emits x86
indirect CALL instructions through each acquired object's published vtable.
No extracted handler, fabricated surface record, or direct handler export is
used. Every invocation checks exact stdcall and caller-return ESP and bounded
completion.

Four guarded 124-byte native descriptors select `DDSD_CAPS`, 2x2 RGB32 textures,
and caps2 `0x0200`, `0x0600`, `0xfe00`, or `0x0400` (cube, cube plus one face,
cube plus all faces, face-only). All four actual DD7 CreateSurface slot-6 calls
return **`0x80004001` / E_NOTIMPL**, change poisoned output to **NULL**, preserve
both output and descriptor guards, and leave all descriptor bytes unchanged.
This passes in software/cooperative WebGL/guest Worker for each module: 24
primary rejection calls. Ordinary 2D texture/target creation and subsequent
rendering still succeed. No cube allocation or rendering success is claimed.

## Inspected exact pixels and negative controls

The independent point/bilinear numerical oracle and original 2x2 RGB texture
are reused. Interior UV is `(3/8,5/8)`; outside UV is `(-1/8,9/8)`. Public
Surface7 Lock/Unlock reads target RGB at `(2,2)`; cooperative WebGL additionally
checks actual framebuffer RGBA at `(2,5)`. These are exact channel comparisons,
not screenshot color estimates.

| Requested BORDER sample | Software RGB | Owning WebGL RGB | Queued Worker WebGL RGB |
| --- | --- | --- | --- |
| Point/interior | 64,192,32 | 64,192,32 | 64,192,32 |
| Point/outside | 160,32,64 | 64,192,32 | 64,192,32 |
| Linear/interior | 94,146,70 | 94,146,70 | 94,146,70 |
| Linear/outside | 142,66,86 | 64,192,32 | 64,192,32 |

Software matches the independent WRAP calculation; WebGL matches CLAMP. Each
module executes 28 normal software observations, 28 cooperative GPU
observations, and 44 Worker GPU observations. Corresponding public call counts
are 275/275/467, excluding the extra release-reference metadata rows. GPU
draws/fences/readback syncs are respectively 28/28/28 and 44/44/44, with zero
errors and zero software fallbacks. Worker stats identify the actual legacy
WebGL endpoint and zero software draw completions.

Eight real Worker batches are held while public live ADDRESSU/V setters change
between BORDER and CLAMP/WRAP, then drained. Old queued and next-draw pixels
retain their respective snapshots. The outside BORDER→WRAP transition yields
old `(64,192,32)`, next `(160,32,64)`; WRAP→BORDER yields the reverse. These two
transitions discriminate stale/live state; BORDER↔CLAMP and interior samples
correctly coincide under the unsupported fallback. Render heap retirement is
acknowledged with `heapAdopted: 1` before guest Worker stop.

For each module, all three modes also execute a negative control: replace the
requested BORDER setter with CLAMP on software or WRAP on WebGL/Worker while
keeping the fallback expectation unchanged. Every control reaches successful
COM acquisition, setters, draw and target Lock, then fails specifically at
`PIXEL ORACLE ... /outside`: software observes `(64,192,32)` against expected
`(160,32,64)`; WebGL/Worker observe the reverse. Bootstrap failure and SKIP do
not count. These prove sensitivity of the fallback observations, not BORDER
color implementation.

## Environment, source and recovery

Fresh leased `bx_46nt6vad`, TTL3600, expiry `2026-11-04T02:24:03.264Z`, was
recorded before execution with `shutdownOwner=coordinator`. Chrome is
`151.0.7922.108`, Node `v24.22.1`. The owning cooperative context reports
**WebGL 2.0** and actual renderer **ANGLE (Intel, Mesa Intel(R) UHD Graphics 620
(KBL GT2), OpenGL 4.6 (Core Profile) Mesa 23.2.1)**; the Worker independently
reports the same renderer. Launch arguments requested SwiftShader, but those
arguments are not evidence that SwiftShader ran. Runtime finished normally;
Chrome and the fixture process were absent afterward. No game/input keys were
used. The box is handed back RUNNING/idle for coordinator snapshot/normal STOP.

Both actual tested modules were recovered separately and SHA-256 checked
against remote bytes:

- Canonical, 2,143,540 bytes:
  `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee`.
- Compatibility, 2,146,153 bytes:
  `580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3`.
- Executed fixture:
  `3d5c364c48933c785b3d0910640be13733ceda3704cbccc8aa7b0e0eebaf54cc`.
- Original `test/binaries/calc.exe`:
  `cb71fcc9726f756421519a215c39cf89efd930c9ae0fa5bbb59b64050faef52b`.

The actual retained Nov03 canonical **and** compatibility module bytes were
individually hashed and match these current tested identities. This is not a
substitution of current bytes for an absent historical second identity.

Evidence: `scratch/runs/20261104-legacy-caps-cube-border/`. Numeric results and
unique screenshots are in `canonical/` and `compat/`; both unique modules are
in `modules/`. `source-seal.json` pins staged Git blobs and the sole owned test
patch, excluding foreign shared-tree WIP. `fixture.patch`, `note.patch`, and
`relevant.patch` preserve relevant binary Git diffs, including this new note.
No source-tree archive was made. Media is referenced by existing path/hash.
`recovery-verification.json` verifies 12 screenshots plus both actual modules.
The screenshots and numeric observations were reviewed before result sealing.

Provisioning preserved the initial SSH denial and file-upload TLS failure;
the permitted file API then transferred only verified missing/mismatched
files. The first isolated build lacked the two tracked toy-VM documentation
bundles; their exact Git blobs fixed that staging dependency. The subsequent
`flock /tmp/wine-build.lock bash tools/build.sh` passed on the leased box.
The mandatory shared locked build also passes. Syntax and both planners pass;
the canonical and compatibility runtime executions each pass all three modes
and their rendered negative controls. Initial failures are retained, without
unchanged runtime retries.

Reproduce with the pinned commit plus `fixture.patch`, original calc at its
recorded path/hash, a full locked build, and:
`CHROME=/usr/bin/google-chrome LEGACY_RENDER_SOURCE=<full-source-SHA>
LEGACY_RENDER_MODULE_DIR=build LEGACY_RENDER_EVIDENCE=<fresh-run-directory>
node test/test-legacy-texture-rendered-contract.js --cube-border`.
Repeat with `--compat` for the other actual module. `--cube-border --plan` is
only a numerical planning check and starts no runtime.

Remaining scope: full cube storage/face/mip semantics and genuine BORDER-color
sampling require implementation and their own runtime coverage before either
bit can be advertised. These results do not establish original-game behavior,
legacy interface versions other than the public DD7/D3D7 path, or corpus closure.
