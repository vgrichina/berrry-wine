# Generated D3DIM viewport background pixels — 2026-11-07

Added `test/test-d3dim-background-generated-web.js`. No production mismatch was
observed and no production implementation was changed. The existing
`test/test-d3dim-viewport-background-texture.js` needs absent ROCKROLL.SCR;
this regression needs no media. The `-web.js` suffix automatically registers it
in the e2e tier (`node tools/test-tiers.js --check` passed).

The deterministic 8,704-byte PE bootstrap comes from
`tools/kernel32-native-fixture.js`, SHA-256
`6c26eefe8a3fed5bd0d8d9b8c7c3fa0de6daeb5e68d86065ef7bcf9098f833c3`.
Its original entry point is not run. Every factory/method invocation runs a
small generated native x86 caller, including vtable dereference, CALL and RET,
using the guarded public COM harness from
`test/test-legacy-texture-rendered-contract.js`. The existing factory catalog
thunk selection is reused; no COM vtable, private object record, material state
or pixel sampler is patched. There are no extra Wasm exports or test WAT.
Calls assert HRESULT, exact stdcall cleanup, bounded completion and output
canaries. Texture writes and rendered RGB reads use public Surface7 Lock/Unlock.

The 4×2 texture contains eight distinct RGB colors. A separate numerical oracle
computes all 96 destination pixels from texel centers and the original viewport
rectangle; it calls no production sampler/descriptor/shader helper. Each of the
11 observations checks all RGB bytes exactly (9 textured and 2 diffuse clears):

1. Textured material clears to its image despite opaque white diffuse.
2. Diffuse changes to magenta while texture pixels remain identical.
3. Public Lock/Unlock changes texture contents while the handle stays bound.
4. Material switches to a separately created texture.
5. Material hTexture=0 returns to magenta diffuse.
6. Inset viewport (2,1,8,6) samples the complete texture, preserving every
   outside target pixel at RGB (11,22,33).
7. A second device uses separately acquired material and texture handles.
8. First-device pixels retain their own texture.
9. Removing the second device's material texture gives cyan diffuse.
10. First-device pixels remain unaffected by the second device's removal.
11. SetBackground(0) round-trips valid=FALSE; restoring the material restores
    the textured clear. No default color promise for clearing with handle 0.

Legacy SDK documentation describes texture handles as coupling a texture and a
device, with one texture permitted on multiple devices:
[Microsoft DirectX 6 SDK, Texture Handles (archived)](https://library.thedatadungeon.com/directx6/devdoc/live/directx/imover_6ug4.content.htm).
The test acquires handles separately for each device and never requires them to
be numerically different. The background image behavior is the existing emulator
contract in `d3dim_material_texture_entry`, `d3dim_viewport_clear_full`, and the
media-dependent regression, not a new general DX6/DX7 promise or native Windows
conformance claim. Existing `test-d3dim-viewport-lights.js` already tests rejection
of attaching a viewport to two devices, references and teardown; those cases
were reviewed, not duplicated or claimed as newly executed.

Runtime command (inside the fresh small box, complete dependencies and all
162 pins verified before execution):

```sh
D3DIM_BACKGROUND_EVIDENCE=/home/user/d3dim-background-runtime/final \
D3DIM_BACKGROUND_MODULE_DIR=/home/user/d3dim-background-runtime/build \
node test/test-d3dim-background-generated-web.js
```

Both pinned shipped modules passed all 11 observations in software, direct
WebGL and production GuestWorkerLink → RenderWorker.Manager → legacy WebGL
endpoint: 66 observations, 6,336 target pixels. The test primes each GPU target
with a public Device3 DrawPrimitive call because the production GPU declines
clears on targets it has never drawn. Each GPU route reports 2 prime draw calls,
9 texture clears, 2 flat clears, 13 syncs, 0 fallback and 0 errors. Worker paths
have two actual draw batches and acknowledged renderer retirement. Clear calls
use the production legacy endpoint, with public Lock as the readback fence;
this does not test held clear packets or mutation before queue consumption.

Actual environment: Node v24.22.1, Puppeteer 24.16.0, Chrome/151.0.7922.108,
WebGL 2.0, ANGLE on Mesa Intel UHD Graphics 620 (KBL GT2). Browser launch requests
SwiftShader but the reported backend is Intel; the report uses actual identity.
No WebGL 1 run, other browser, native Windows, 8/16-bit or palettized target,
Clear2 explicit-color behavior, explicit D3DRECT array, offscreen viewport,
held queued-clear mutation, original screensaver or historical 27-test-wide
qualification is claimed. Only the supported inset viewport was executed.

Canonical module SHA-256:
`07f1cc970038f8ab31313b8b200edf26caa63473f293f5fc937f5cfe5c5c7f6e`
(2,181,179 bytes). Compat:
`1d4bd4330ea16947959e3f4472339d5a32a61216cd8b5246198d11046b652c3e`
(2,183,825 bytes). Original build source commit:
`344c54a2cebb0af51858c80b78c18e665dc52080`; all 135 recorded src inputs match
that commit and staging commit `227beb484667040cbf1039622a3b25ffda3d025b`.
Retained original build provenance confirms identical module hashes.

Evidence is in `scratch/runs/20261107-d3dim-background-generated/`: `final/`
contains all six inspected pixel galleries, runtime call/pixel/backend JSON,
stdout/stderr and preflight; `initial/` preserves the first canonical software
and direct-WebGL passes followed by Worker bootstrap DataCloneError because my
custom HTTP fixture response lacked COOP/COEP headers. Adding the headers fixed
that harness prerequisite; there was no emulator repair. All six final galleries
have either the inspected software/Worker image hash or the inspected direct-GL
image hash. Module bytes, npm lock, staged-file hashes, source recovery checks,
exact commands, retrieval manifests and owned new-file patches are retained.

Fresh box `bx_sr5g5zns` was allocated using a persisted UUID Idempotency-Key.
One heavy runtime at a time; no guest media, source archives, requested snapshots,
public deployment, nested workers, branches or worktrees. No automated risk flag
occurred. Delegated normal stop `stop_0f73654de77aa2cb` completed at
2026-11-07T03:41:07.386Z, forced=false, error=null, state=archived, active expiry
null (original expiry 04:06:21.822Z). Both browser exits were normal; the remote
process/socket inventory shows no surviving test process or listener.
Local runtime/source ownership was never acquired. Local build is serialized
with the newgame workers; final build/publication details are in result.json.
