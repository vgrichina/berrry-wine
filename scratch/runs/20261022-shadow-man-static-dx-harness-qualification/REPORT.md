# Harness repair accepted; qualification blocked on missing retained dependency

Tested source **84f2a0165798f30d7a131dccdcc054a224fbf57b**, actual remote verified on `task/shadow-man-static-dx-harness-qualification-oct22`. Its real parent is **c9681105dd96ab31a8a709eeb61242ad5ad60cae**, followed by 0ee5103f -> c2f50288 -> 7a21579 -> main89f1e9d2. The donor evidence-only tip444c4440 was not used as source parent. A final evidence-only publication follows the tested source on this branch.

Only `test/test-static-dx-version.js` changes: four inserted lines, one deleted line. After instantiation it assigns `ctx.exports = e`, matching the passing VERSION harness. It also accepts the established `WA_TEST_WASM` environment input; absent that input the original `compileSrcWasm()` fallback remains. No assertion, fixture, production source, gate, baseline or dependency changes. No default recompilation or canonical rebuild was performed.

## Causal proof and controls

`lib/filesystem.js` g2w (around1977) reads `ctx.exports` to obtain the guest image base; without it the fallback treats the guest address as the linear-memory address. w2g (around2462) similarly falls back to zero bias. The static test previously supplied memory but never connected its instance exports to this host context. Filesystem callbacks therefore addressed the wrong buffers when reading the mounted named PE resource.

All comparisons use the same retained primary canonical bytes, SHA256 **ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553**,1879387B. The evidence observer delegates unchanged WebAssembly arguments/results and records their hashes. Each row instantiated that exact canonical file once; no compilation from WAT occurred.

| Check | Exit | Result |
| --- | ---: | --- |
| Missing-context baseline, with only canonical-file input adaptation | 1 expected | 6 PASS / 6 FAIL; mounted resource size0, version0.0.0.0 |
| Corrected context | 0 | 12 PASS / 0 FAIL; exact mounted version5.6.7.8 |
| Corrected context, mounted file deliberately absent | 1 expected | 6 PASS / 6 FAIL; no fabricated version |
| Actual corrected test at pushed source | 0 | 12 PASS / 0 FAIL |

The baseline is the actual original test with the canonical input adaptation and no ctx assignment. `causal_remote.py` asserts the entire corrected source equals exactly those two bounded substitutions. The file-absent control removes only the mount; all resource/version expectations remain intact. Existing no-file/no-fabricated-version and exact-file-version assertions are byte-for-byte preserved. Temporary sibling controls were removed in finally blocks. The original test source and all logs are retained.

## Continued qualification and first blocker

The actual pushed source was checked out on the same staging root, with real parent history and only the owned test path changed. All3426 retained closure input paths/hash/modes were verified against the pushed tree; the manifest differs from the accepted prior manifest only for `test/test-static-dx-version.js`. Reused acceptance/51cheapgate/ONEcanonicalbuild/VERSION/NE receipts are SHA-pinned in `reused-receipts.json`; no packaging, dependency reconstruction, full acceptance or build was repeated.

`node test/test-directx-setup.js` exited1 immediately with **Cannot find module 'pngjs'**, required by `lib/raster-canvas.js` -> `lib/canvas-compat.js` -> `test/render-helper.js`. The module observer records **zero compile/instantiate events** for this command. Its intended scope is full-source compilation with an extra DirectXSetup export; that scope was not reached and no functional DirectXSetup result is claimed. Nodev24.18.1. This is the first new unrelated blocker. No dependency installation, workaround, outside fix or further qualification test followed it.

Eight subsequent targeted commands were **NOT RUN**:

- `node test/test-directx-ordinals.js` — JS ordinal resolution.
- `node test/test-dsetup-loading.js` — default source binding fixture, no x86.
- `node test/test-dll-lifecycle-real-pe.js` — canonical generated PE x86, intended four cases.
- `node test/test-dll-import-graph-lifecycle.js` — canonical generated PE x86, intended two cases.
- `node test/test-dll-import-no-ilt.js` — default full-source harness compilation.
- `node test/test-dll-lifecycle-races.js` — canonical generated x86.
- `node test/test-scoped-dll-native.js` — canonical generated x86; this is the native scoped command in the prior qualification recipe.
- `node test/test-scoped-dll-lifecycle.js` — JS/Worker native-ABI simulation, not a full module.

There are **four new canonical-file instantiations total**, including the two intentionally rejecting controls, and zero new module compiles/builds. Prior VERSION and NE passed with extra-export full-source modules, not the stamped canonical file; those accepted receipts are reused without expanding their claims. Authentic native DSETUP11 optional DWORD outputs/ret8, actual installed registry branch/output, complete PE lifecycle qualification and game behavior remain **UNKNOWN/unqualified**. The source fixture's native-dir option supports input/binding checks, not proof of native DSETUP11 execution; originals were not staged or executed.

## Preservation and handoff

Same **bx_f3gs8qm2** remains RUNNING, API responsive, Boat state `idle`, health `ok`, stop:null. Expiry **2026-10-22T23:20:32.491Z**. Coordinator owns shutdown/checkpoint22:25. No workers, replacement tasks, stopped snapshot access, lifecycle mutation, main merge, public deployment, laptop/fleet action, dependency download or original patching occurred.

Retained root `/home/user/shadow-man-dsetup-canonical-qualification-oct22`, tracked-clean HEAD84f2a016. Both canonical modules are unchanged, including compat1881960B SHA25665f6242b586877f000fabdf5f7f516d62f1c2d7894658dff4ef075f90f7d8f65. All prior evidence directories remain; new distinct remote directory is `evidence-static-dx-harness-qualification`. `/proc` comm/cwd audit found no owned Node/build/test processes. Canonical build provenance remains sourcec9681105; the new commit only changes its JS test consumer.

Remote allocation147722240B +67108864B reserve +2097152B allowance <1GiB; free48907309056B >2GiB. Local combined retained/own Git/source/evidence/originals/launcher accounting,8MiB reserve, hostfree floor2982150144B and four readonly original pins are independently checked in `verification.json`/`verify.py`. All protected root/donor Git metadata pins remain unchanged. Evidence transfer includes per-file sizes/SHA256 and API command receipts. Final publication records the actual remote evidence commit separately from the source commit. The ignored canonical binaries remain on the running box and are not backed up by Git; the existing build recipe and accepted provenance receipts are retained.
