# Raw shared-render Worker drawable identity

Evidence: `scratch/runs/20261103-gl-raw-worker-drawable/`. Source seal is
published main `fedb31c170920c4dcb66290edd5e62f0232dcb03`, containing
`d2ef199a9be799ca73673727c95ece7d4d13f0c3`. The fresh locked full build passes.
The canonical production module is 2,088,037 bytes, SHA256
`1f39572325be5251c4b9a923e83d4ea9ff33962d4d3e7911a4835df20cf0ae7e`.

## Fixture cause

The original `test/test-shared-render-worker-web.js` fails with
`GL did not publish one transferred frame`. Its raw record builder defaults
`aux` to zero. Both window make-current records supplied only the HDC and
context arguments, although the only window drawable is HWND 1.

`handle_gpu_api` in `src/09a8b-handlers-opengl.wat` resolves an HDC to its
owning HWND (or tagged bitmap surface) and passes that identity as the encoder's
`aux`. The record stores it at byte offset 8. Replay in `lib/gl-compat.js`
calls `makeCurrent(contextHandle, aux)`; target zero fails window lookup and
leaves no current context, so clearing/presenting cannot transfer a frame.

The fixture correction supplies `aux:1` on both WebGL and software window
make-current records. It changes no production code, synchronization,
transport, pixel oracle, bitmap lifetime check, or process/heap assertion.

## Exposed software response bug

With the drawable corrected, the same production module passes the first
WebGL frame but the complete fixture fails later with `DataCloneError`.
`lib/gl-render-worker.js` includes `current.backend.version` as
`webglVersion` in every response. The software backend's permissive Proxy in
`lib/gl-compat.js` returns `() => undefined` for that missing property. Once
the software context is current, the response contains that function and
`postMessage` cannot clone it.

`diagnose-clone.cjs` reproduces this directly with the actual production
adapter and canonical module: creation response clones; correct make-current
returns 1 and active window `[0,1]`, but its `webglVersion` is a function and
the response throws `DataCloneError`. All other response fields clone. This
is a separate production response bug exposed after repairing the fixture.
The coordinator authorized exact production response scope at 12:43:53 UTC;
acknowledgement and ownership followed on the board. The response now reads
version metadata only for WebGL contexts, leaving software version metadata
undefined. The focused protocol regression uses the real software adapter and
requires its bound-context response to survive `structuredClone`, preserve
drawable/configuration, and unbind cleanly. It fails against the old response
and passes with the repair.

## Validation

The original raw fixture still fails before its first frame against the
repaired production files; the corrected fixture passes against those exact
same files and Wasm. `identical-production-pair.json` records both fixture
identities and unchanged production identities across the pair. Compatibility
Wasm stays 2,090,610 bytes, SHA256
`06c2fbeee4051287305986fb8d18e8f6f3d27fda318cca48eceb8a0b6e0ebfd5`.

The full browser fixture retains every pixel, actual Worker, bitmap transfer,
immutable snapshot, shared-packet pool, producer-state, endpoint retirement
and final process/heap assertion. It checks two GL bitmaps, two software GL
fronts, two textured D3D9 draws and both Glide backends, with exactly one
physical Worker, termination and heap adoption. No extra synchronization,
substitution, fallback, skipped case or weakened expectation was added.

Shared-render/drawable regressions, direct and actual delayed-Worker shared
objects, and all four canonical/public/direct/Worker context-copy routes are
checked, including serial real WebGL1/2 replay. Locked full-build results and
exact commands are retained. Personally reviewed red/blue GL frames and
both textured D3D9 colors; the observer also records immutable earlier pixels.
The initial incomplete fixture result and observer setup errors remain in
the initial evidence, separate from complete passing validation.

`RECOVERY.md`, source/module identities, patches, logs, PNGs and full-SHA
retrieval verification are in the run. Publication and retained completed
STOPPED snapshot details are recorded in the final lifecycle sidecars.

Own finite-TTL boat `bx_edgm6v8r` has original expiry
`2026-11-03T14:35:47.493Z`, recorded before use; shutdown owner is this worker.
The original task delegates normal stop only after full-SHA evidence/recovery
retrieval and scoped helper absence, retaining its completed stopped snapshot.
