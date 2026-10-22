# Fixture repair accepted; canonical build passed; qualification blocked

Tested source is **c9681105dd96ab31a8a709eeb61242ad5ad60cae**, parent **0ee5103fbe521b9c5ea577716d67b155f14f9e11**, on `task/shadow-man-dsetup-fixture-fullmodule-oct22`. Actual canonical remote SHA was verified before the build. History continues through c2f50288 -> accepted7a21579 -> main89f1e9d2. The previous evidence-only e7adc994 tip was not used as source parent. A later evidence-only commit on this task branch does not change the tested source identity.

## Bounded correction and acceptance

Only `test/dsetup-binding-fixture.js` and `test/version-source-fixture.js` changed: six insertions, three deletions. Both import `GUEST_BASE` from the existing generated region map. DSETUP interpolates that shared value into its existing global. VERSION uses a single WAT global for both its exported guest base and its affine translator. All three raw-address ratchet violations are removed through the actual shared source of truth. No numeral obfuscation, gate waiver, exclusion, baseline, manifest or production change.

The source commit changes exactly these two files; every other parent-tree blob and mode remains identical. All prior production, owner correction, accepted census metadata, allocator/layout, native/version source behavior and safeguards are preserved. Reused source acceptance, census/region reviews and 269-record layout equality receipts are pinned in `reused-receipts.json`; no broad acceptance rerun.

On the same retained complete source tree, both existing affected tests passed before and after correction:

* `node test/test-dsetup-loading.js`: synthetic graph, missing/wrong-name controls, real JS/WAT ordinal IAT binding and absent export control; no x86 executed.
* `node test/test-file-version-info.js --source-fixture`: file-backed A/W resources, exact/bounded copies and guards, query languages/strings/translations, retained ANSI answers, malformed resource controls; source fixture only.

`fixture-controls.js` additionally executed both old and corrected fixtures, checked equal exported base and real g2w results at five guest locations, real byte reads and DWORD writes, neighboring guards, unique locations and fixture metadata separation. Both retain the existing memory import minimum16/maximum8192 pages and use the same existing 8192-page (512MiB) test buffer; no enlarged mapping. Samples include the image start, resource offsets, heap, stack and the high native-DLL-shaped address; all are within the unchanged buffer and above the local metadata span. This affine test fixture is not a sparse/full-emulator translator. The two fixture probe results are exactly equal; all26 extracted production functions remain verbatim. Six runtime controls reject independent exported-base disagreement, translation disagreement and metadata aliasing, for each fixture. Existing missing/malformed/absent-export semantic controls remain intact.

An initial evidence-only function-comparison probe failed because its name collector included an inline stub the extraction helper cannot parse. That log is retained. The collector was narrowed to the actual26 extracted production functions, then all probes and six rejecting controls passed. No fixture/source repair resulted from that instrumentation issue.

All **51/51** noncompiling shipping checks passed, using the previous complete receipt runner with only its evidence destination changed. Exact runner, command/exits and logs are retained. Actual complete staging3426 inputs/membership/hash/modes were verified against real pushed HEAD, updating the closure manifest for only the two changed fixture paths. Gates and baselines were unchanged.

## One canonical build

Exactly one ordinary `bash tools/build.sh` ran from the retained root on the same bx_f3gs8qm2, under a clean recorded environment with every gate enabled. Exit0,22.0846095085 seconds; default WATX compiler, Nodev24.18.1. Normal build emitted both artifacts, with323 data segments and no overlaps:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `build/wine-assembly.wasm` | 1879387 | `ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553` |
| `build/wine-assembly.compat.wasm` | 1881960 | `65f6242b586877f000fabdf5f7f516d62f1c2d7894658dff4ef075f90f7d8f65` |

Canonical region layout9a3bc9149d58209c,269 records. Exact build command/env/cwd, source history, Node binary/hash and compiler/loader identities are in `remote-evidence/staging-identity.json`, `canonical-result.json`, `build-inputs.json` and the complete `canonical-build.log`. The ordinary build's two compiler invocations produce its standard primary/compat artifacts; no second build or repair/retry occurred. A local wrapper initially tried to parse streaming API JSONL as one JSON document after successful completion; raw stream is retained, and the remote build result independently establishes exit0. No build was repeated.

## First out-of-scope qualification blocker

Qualification ran three default full-source test commands, in order:

| Test | Exit | Observed scope/result |
| --- | ---: | --- |
| `test-file-version-info.js` | 0 | Full source plus extra query export; A/W/version semantic checks passed |
| `test-ne-file-version.js` | 0 | Full source plus wide-query export; actual NE VER6/7/11 interpreter calls and malformed/PE controls passed |
| `test-static-dx-version.js` | 1 | Full source,6 checks passed and6 failed |

The static test obtains distinct static handles and the correct DPLAYX path, and correctly reports no resource when no file exists. After mounting a generated PE containing a version resource at that path, `GetFileVersionInfoSizeA` still returns0; copy/root-query/signature/version checks subsequently fail. The exact log is `remote-evidence/test-static-dx-version.log`.

Read-only inspection identifies a likely **out-of-scope test harness wiring defect**: this test never assigns `ctx.exports = e` after instantiation, whereas the passing VERSION test does. `lib/filesystem.js` uses `ctx.exports` for guest buffer translation (`g2w`, around1977) and its inverse (`w2g`, around2462), falling back when absent. This is a source-supported diagnosis, not a repaired/retested causal proof. No file outside the two owned fixtures was changed and no additional test/compile was attempted after this blocker.

The evidence-only module observer delegates unchanged inputs/results to WebAssembly APIs and records SHA identities. All three commands compiled their own full-source modules; **zero instantiated the actual stamped canonical file**. The static test's compiled SHA3339329dcae31c3221f7dde20d78245bd2023a92933d3769d5fb0c73bda86386 exactly equals the canonical binary after removing only the `wine-region-layout` custom section, proven by byte hashing without compilation/instantiation (`canonical-core-proof.json`). The two extra-export module hashes and all instantiation events are retained in `module-identities/`. No source slice is presented as canonical/native qualification.

The remaining nine listed commands were **not run after the blocker**: DirectX setup, DirectX ordinals, default DSETUP loading, real PE lifecycle, import graph lifecycle, no-ILT, lifecycle races, scoped native DLL and scoped JS lifecycle. The earlier focused DSETUP test passed only its source-fixture scope. No fresh canonical-file interpreter/loader qualification, authentic native DSETUP11 optional DWORD/ret8 behavior, actual installed registry branch/output, game or Windows parity is claimed. Native DSETUP11 and installed registry remain **UNKNOWN**. Full qualification is incomplete.

## Resources, preservation and handoff

Same RUNNING bx_f3gs8qm2, retained root `/home/user/shadow-man-dsetup-canonical-qualification-oct22`; new evidence `evidence-fixture-fullmodule/`. Existing `evidence/`, `evidence-census-fullmodule/`, `evidence-region-fullmodule/` were preserved. Exact source HEADc9681105, clean tracked staging,3426 closure inputs reverified after qualification; both modules remain there. No owned build/test Node processes remain. Remote allocation146665472B plus67108864B reserve and2097152B receipt allowance is below1GiB; free48908763136B exceeds2GiB. Local admission and final verification include own/reused Git/source/evidence/originals/launcher plus8MiB reserve under64MiB and hostfree floor2982150144B.

The four readonly original pins are reused and independently rehashed at handoff; no original was staged or executed remotely. Protected root/donor Git metadata was not changed. No repack, dependency installation, source closure reconstruction, game download, stopped snapshot access, additional compute, worker, main merge, deployment or laptop action. An SCP evidence read was denied403 for SSH permission; it was not retried. Evidence was collected through the explicitly assigned, already verified Boat API exec channel with per-file SHA verification; no SSH access was bypassed.

Handback22:02UTC, before22:20. Box expiry2026-10-22T23:20:32.491Z; coordinator owns shutdown/checkpoint22:25. This worker leaves the box RUNNING and stops after preserving and publishing this bounded result.
