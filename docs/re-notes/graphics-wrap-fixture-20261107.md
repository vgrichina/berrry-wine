# D3DIM texture-wrap recording fixture repair — November 7, 2026

Run: `scratch/runs/20261107-graphics-wrap-fixture/`. This repairs only
`test/test-d3dim-texture-wrap.js`. Production rendering is unchanged.

The unchanged test was executed first (`baseline-test.log`, exit 1). Its
software16 assertions completed, then its recording device failed with
`Cannot read properties of undefined (reading 'gl')` in `_submitImmediate`.
The fake declared a 16-bit target but implemented only `device.draw`;
production correctly calls `_storeNative16` after each primitive.

The fixture now explicitly observes `_storeNative16` on its own executor
instance. It asserts the target identity and absence of a real GPU, and
requires alternating draw/storage events for every triangle. Each submission
must contain one triangle, three 32-byte vertices. The UV oracle reads **all**
submissions, respecting each typed array's byte offset and length. Reading
`draws[0].vertices.buffer` previously depended on the backing buffer also
containing other submissions, rather than checking their submitted views.

All existing software pixel checks, describe field 33, WRAPU/WRAPV/WRAP0
expectations and per-triangle UV expectations are unchanged. No production
fallback or conversion bypass was added. This recording fake validates UVs
and submission boundaries; it cannot validate native16 pixel conversion.

## Validation and limits

- `node test/test-d3dim-texture-wrap.js`: PASS (`focused-test.log`).
- Same test with run-local compilation capture preload: PASS
  (`focused-module-test.log`). The preload saves the actual compiled harness
  bytes and its compiler-input identity; it does not change rendering.
- `flock /tmp/wine-build.lock bash tools/build.sh`: PASS (`build.log`).
- Existing `test/test-legacy-framebuffer-blend-web.js` dependent mode: PASS,
  with `FRAMEBUFFER_TARGETS=rgb565,a1,a4,x1`,
  `FRAMEBUFFER_MODES=webgl,worker`, `FRAMEBUFFER_DEPENDENT=1`,
  `CHROME=/opt/google/chrome/chrome`, and
  `FRAMEBUFFER_EVIDENCE=scratch/runs/20261107-graphics-wrap-fixture/native16`.
  The command was bounded with `timeout 360s`; it completed normally.

The actual native16 regression exercises ordinary public COM draws and native
Lock readback in both shipped modules, direct WebGL and the owning queued
Worker. All **16 positive configurations / 96 dependent pixel pairs** passed
with zero native16 tolerance. All **56 negative controls** rejected their
alternative pixel oracle: stale destination, conversion only at final
readback, conversion only per public draw, and stale alpha where applicable.
Same-state merged draws and overlapping primitives distinguish per-primitive
storage from deferred storage; depth/scissor cases also remain covered.
The negative errors in `native16.log` are expected assertions verified by the
unchanged regression, not positive-run failures.

Local Chrome was `151.0.7922.108`, launched headless with SwiftShader flags.
Actual contexts reported WebGL 2.0 and `ANGLE (Intel, Mesa Intel(R) UHD Graphics
620 (KBL GT2), OpenGL 4.6 (Core Profile) Mesa 23.2.1)`; launch flags alone do
not establish backend identity. All positive cases recorded zero errors and
zero fallbacks.
`native16/result.json` records renderer identity, native observations, successful
public calls, merging/upload/readback counts, both loaded module hashes and
normal browser exit (code 0, no signal). These are actual WebGL API/pixel checks
on the recorded backend, not physical-GPU, native Windows, original-game,
performance, or full software/WebGL wrap parity claims. No UV discrepancy was
found in the existing fixture. No original title or remote box was used.

## Exact source and modules

Unchanged reproduction base: `baseline-sha.txt`. Tested source base:
`492cf5f375b4393918023acfcedb1f459444e6e0` (`tested-source.json`).
`tested-source.patch` records relevant tracked uncommitted changes with
`git diff --binary`; `fixture.patch` isolates this repair. The source manifest
pins tracked source/build tools and relevant test helpers, including a broader
inventory than the executed dependency closure. Unrelated shared-tree work is
not part of this repair. `focused-harness-identity.json` seals the actual
compiler inputs, extra WAT and options used for the software pixel assertions.
`owned-new-files.patch` preserves this new note; Git remains the source archive.

| Retained actual module | SHA-256 |
| --- | --- |
| `focused-harness.wasm` | `656516435a801d7e6a3e90f6538f4828ba3e1918349c60a099c13ca42a418c49` |
| `wine-assembly.wasm` | `e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467` |
| `wine-assembly.compat.wasm` | `04acbb89f66ad9814836b5e2c34de659b518f4e1994f50c4ee8069c991f02f72` |

The shipped hashes match both the locked build and the modules recorded by the
native16 regression. Evidence includes logs, module bytes, source patches,
native pixel results and checksummed inventory, without a source/media archive.
The regression's existing `test/binaries/calc.exe` input is referenced by its
SHA-256 in `native16/result.json`; it was not copied. Free disk stayed above
2 GB at recorded checks. Browser/server cleanup completed locally; no box
ownership remains. The run's top-level `result.json` is written last.

Next: no remaining work for this fixture repair. The historical Globe band and
aligned-reference investigation described in `graphics-dx-samples-20261107.md`
remain outside this change.
