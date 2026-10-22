# Nine commands pass; one redundant compilation deviation

Dependency staging is closed and all nine existing commands exited 0 on the retained source **84f2a0165798f30d7a131dccdcc054a224fbf57b** (parent **c9681105dd96ab31a8a709eeb61242ad5ad60cae**). No functional failure was encountered. No production or test-source files changed. This evidence branch starts at 84f2a016, not the donor evidence tip59367d20. Accepted prior gates/build/static-DX/VERSION/NE receipts are reused and SHA-pinned; none was replayed.

**Scope deviation:** `test/test-dll-import-no-ilt.js` has no extra exports. The worker mistakenly ran its existing render helper's default full-source compilation even though its exports can be supplied by canonical. The helper has no supported file-input option; under the assignment this should have caused a stop before that command. One redundant full-source compile occurred outside the permitted extra-export condition. No source modification or expectation bypass occurred. Its resulting module is exactly the canonical core without the layout custom section, as authenticated by the prior `canonical-core-proof.json`. This result does not erase that deviation.

## Dependency and preflight

The only staged package is the already preserved historical pngjs7.0.0: **23 exact files,63864 bytes**. Each `runner/node_modules/pngjs/...` receipt maps to `node_modules/pngjs/...` under the assigned remote root. SHA256/length and exact membership were checked before and after testing. No npm installation, network package fetch, dependency replacement or donor/shared-root writes occurred. `codec-receipt.json` retains the complete immutable per-file inventory. Prior tar SHA256 is c4b71873d48a692dd5eeb1dcb62185c7aafe40f2180c7cc7f30ec71e89a080be; that tar was not downloaded again.

One combined inexpensive preflight covered all nine commands, recursive literal imports (133 files), explicit child runner/compiler entry points, dynamic local targets and runtime tools. Node24.18.1, Python3.12.3 and Bash5.2.21 were available. The required external package resolves locally. Actual 2x2 PNG encode/decode preserves all16 RGBA bytes; encoded83B SHA256475001d612a9019a8697030e0baf3c8c0691dee5ac6133370589228f1e6e5ecd. Required host/render/compiler helper loads pass without compilation. Optional missing @node-3d/glfw/@node-3d/webgl are lazy GL-only paths, and skia-canvas is for app decodeImage assets; none of these generated fixture commands selects those paths. A tools/disasm require example was a comment false positive. Dynamic resolution review and limitations are retained. The first attempt at the evidence preflight had a CommonJS variable-name syntax error, fixed before any functional test.

## Commands and identities

All commands are `node test/<file>` with unchanged assertions and sources. Canonical-file consumers receive supported WA_TEST_WASM/WA_TEST_WASM_SHA256; child runner commands retain their own --wasm/--no-build flags. Per-command source hashes, duration, logs and unchanged observer receipts are in `remote-evidence/qualification.json`.

| Test file | Exit / evidence | Module |
| --- | --- | --- |
| test-directx-setup.js | 0; DirectXSetup stdcall stack+16 and success0 | D: permitted extra test_directx_setup export, absent from canonical |
| test-directx-ordinals.js | 0; named DirectSound/KERNEL32 ordinal resolution | JS only |
| test-dsetup-loading.js | 0; synthetic graph, missing/wrong-name and absent-export controls; no x86 | F: binding fixture |
| test-dll-lifecycle-real-pe.js | 0; all4 cases, no-threads/threads × final/outstanding; child groups absent | C:4 observed instances |
| test-dll-import-graph-lifecycle.js | 0; both2 modes, cycles/shared roots/reverse detach/peer execution; child groups absent | C:2 observed instances |
| test-dll-import-no-ilt.js | 0; all3 OFT-less IAT bindings | U: redundant default full-source compile deviation |
| test-dll-lifecycle-races.js | 0; same-path contention, competing frees, generations, quarantine and sparse reuse | C:1 observed main instance, module passed to2 Workers |
| test-scoped-dll-native.js | 0; actual generated x86 attach/detach/generation receipt | C:1 observed instance |
| test-scoped-dll-lifecycle.js | 0; local+Worker ABI simulation | JS only |

Full SHA256 identities:

- **C** canonical1879387B: `ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553`.
- Retained compat1881960B: `65f6242b586877f000fabdf5f7f516d62f1c2d7894658dff4ef075f90f7d8f65` (not selected).
- **D** test-only extra-export full-source: `92b6563f47f3ebf5875d56c7d5123ab1d8e9424377a871016086e6204e1fa8d7`.
- **F** synthetic binding fixture: `0f7578a13dec8be6afe5b52b587be6bd0f3239f2f4c01bca9abb9335757a6979`.
- **U** redundant default full-source canonical core: `3339329dcae31c3221f7dde20d78245bd2023a92933d3769d5fb0c73bda86386`.

Zero canonical artifact rebuilds. One required extra-export full-source compile, one redundant default full-source compile and one fixture compile occurred. The unchanged observer records8 canonical V8 compile events and8 canonical instantiate events, plus one instantiate each for D/F/U. V8 compile events compile existing WASM bytes, not WAT source. Worker module provenance follows unchanged sources passing the same compiled Module through workerData; individual Worker instances are not independently counted by this existing PID-keyed observer (Workers share PID and can overwrite receipts). Counts are observed lower bounds, not a complete per-Worker event audit. No observer expansion or new test framework was introduced. The API returned successful JSONL frames because timeout>600; the wrapper initially expected one JSON object and failed parsing after all tests had completed. The existing frames were decoded; tests were not rerun.

Native genuine DSETUP11 optional DWORD/ret8 execution and actual installed-registry branch remain **UNKNOWN**. DirectXSetup's existing runtime-success assertion is not evidence of the installed-registry branch. The synthetic binding fixture is not native DSETUP execution. No originals were executed, game run, reinstall, patch or public deployment occurred. No remaining command is NOT RUN; all9 ran once.

## Preservation and handoff

Same **bx_f3gs8qm2**, RUNNING/Boat idle healthy, stop:null; expiry **2026-10-22T23:20:32.491Z**. Coordinator owns shutdown/checkpoint22:50. Remote retained root `/home/user/shadow-man-dsetup-canonical-qualification-oct22` remains tracked-clean HEAD84f2a016. New distinct `evidence-pinned-dependency-qualification` and all prior evidence/modules remain. All3426 source-manifest file hashes/lengths/modes match after testing; both canonical module hashes match before/after. Proc comm/cwd audit finds zero owned Node/build/test processes. No box lifecycle action, SSH attempt, worker launch, main merge or laptop/fleet access occurred.

Remote measured allocation148529152B +67108864B reserve +2097152B finishing allowance <1GiB; free48905723904B >2GiB. Whole local inherited+own+launcher+codec+originals inventory,8MiB reserve and host floor2982150144B are recomputed by verify.py. All four original pins and protected root/donor Git metadata are unchanged. 64 transferred remote evidence files/429902 bytes were SHA256 verified; fixtures and case logs are preserved, not repackaged. Local Git preserves receipts/recovery instructions, not ignored codec files or canonical binaries. Source/test-only compiled in-memory modules can be reconstructed by existing tests but were not saved as binaries; no repeat compile is needed for this handoff. See RECOVERY.md.
