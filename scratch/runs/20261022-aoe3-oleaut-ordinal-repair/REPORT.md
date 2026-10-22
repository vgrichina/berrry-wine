# OLEAUT32 dynamic ordinal repair, bounded source candidate

Task NEW-GAME-AOE3-DEMO-20261010, task/aoe3-oleaut-ordinal-repair-oct22.

The focused repair is tested and ready for review. Canonical build and original-game retest are blocked by an existing GetProcAddress regression, reproduced unchanged on the exact baseline. No merge, deployment, game launch or gameplay claim.

## Scope and source identity

Tested source commit `24220bf65a04f665c847fc4037a732f8e82db87c` was pushed and independently verified over canonical HTTPS; the following evidence-only commit seals this report.

Independent HTTPS remote-main reconciliation before materialization and before commit: `63d563df7a2b901d222a311ceaf55a0823a22261` at https://github.com/vgrichina/berrry-wine.git. The root checkout is older/different and was not used as source. An independent sparse Git store borrows objects read-only from the accepted donor; root HEAD/index/config/TODOS/ops STATUS seals remain unchanged. Live PID371378 was wine-worker, gpt-6.1-sol, medium, 200000 total-context compaction. No workers/children/delegation.

Before materialization, the focused manifest selected 1092 files / 36553615 source bytes plus 12MiB allowance. The initial broader admission calculation was rejected before checkout. Final measured allocation is in HANDOFF.json and is below 64MiB, with local free space above 2982150144 bytes. During transport repacking, the old and new archives briefly coexisted: the preceding measured60174336 bytes plus the new14860504-byte archive implies about75034840 bytes in the checkout, before launcher/log overhead. This exceeded the67108864-byte allocation; the older archive was deleted in that same preparation step. This transient breach is disclosed rather than claiming continuous compliance. Both transient archives are now absent. Large donor objects were read in place. The transient transport archive was removed after verified extraction; source manifests, transfer receipts and recovery recipe remain.

Final source identity over 1078 src/lib/tools files plus the focused test: `ce23f23ed7fcd525e2e4b4b1afa4d8eeacdb344fc7ca25903e3f78b45eaa9305` (algorithm and exact rows in source-manifest.json and verify.py). Remote and local values match. Documentation/evidence changes do not enter the module closure.

## Why this is the correction

Accepted diagnostic commit `07037a8a2eb82c4a86cd3ee64a098f3e98173e0a` established the executed LoadLibraryA OLEAUT32 request, EXE-alias return `0x400000`, failed ordinal8 lookup and actual native exception/parseURL return chain. That historical module is `f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7`; it is not the source candidate tested here. Diagnosis was not repeated.

The primary implementation source [Wine oleaut32.spec, pinned commit 840a939ee526137639665ff5f587224d6a36403f](https://github.com/wine-mirror/wine/blob/840a939ee526137639665ff5f587224d6a36403f/dlls/oleaut32/oleaut32.spec) explicitly assigns `8 stdcall VariantInit(ptr)`. Exact retained source is raw/oleaut32.spec. This agrees with the existing `system_ordinal_api_id` and handler, rather than guessing an export number.

Two small production changes:

- Append `oleaut32` to STATIC_SYS_DLL_NAMES. The existing module registry now retains its identity across LoadLibraryA/GetModuleHandleA. Existing list positions, DirectX range and registry allocation rules stay intact.
- Add OLEAUT32.DLL#8 → VariantInit to the host ordinal map, covering its separate import-resolution route.

On this exact baseline, static modules already use shared module identity headers; the repair reuses that registry. It adds no DLL file, PE-loading substitute, guest patch, new header generator, API or handler. It does not reinterpret any old image-base alias as OLEAUT32.

Actual paths inspected/exercised: LoadLibraryA normalizes the name, checks mapped modules/files and reaches the static registry; GetProcAddress's pinned body reaches resolve_static_module_ordinal, identifies the module, calls resolve_import_ordinal, then the existing WAT system_ordinal_api_id. That WAT path returns VariantInit before host fallback. Host ordinal8 is separately exercised with a full DLL name. Adding only the host map would leave the dynamic alias failure intact. Existing static ordinal8 remains unchanged.

## Actual dynamic difference and handler behavior

Same final test harness, canonical full source closure/compiler, Node v24.18.1 on SAME bx_32262dnp. The Calc fixture is SHA256 recorded in fixture-transfer.json; its preferred image base differs from the original game's. Full-module test compilation adds only the exported test wrappers in test/test-oleaut32-ordinals.js. These are **instrumented test modules**, not canonical release builds.

| Observation | Baseline source | Candidate source |
|---|---|---|
| Fixture EXE image | 0x1000000 | 0x1000000 |
| LoadLibraryA OLEAUT32.dll | 0x1000000 (EXE alias) | 0x1017884 (distinct registry identity) |
| GetProcAddress(handle,8) | NULL | 0x81004a8 (API thunk) |
| Instrumented module SHA256 | 28de613a008129f4d4b8d6d0b3a05494cef7c4bd59d9bea192799b3fc580dc50 | 7fdda15444bf4fc1b5047375865662224f45b585eee51e35b2a67c9a21949d87 |

The candidate invokes the returned pointer through run(1), which enters the actual thunk dispatcher/VariantInit handler and restores the saved guest continuation. The fixture supplies a garbage VT_UNKNOWN with invalid interface pointer 0xdeadbeef: VariantInit clears all 16 VARIANT bytes, including VT_EMPTY, without releasing it; eight neighboring canary bytes remain intact. ESP advances exactly 8 bytes (return+one argument), the caller's next stack word remains unchanged, and EIP becomes saved return 0x402000. The continuation is observed as the returned EIP, not claimed executed afterward.

Negative checks: three unsupported ordinals (0,151,65535) return NULL; five unrelated handles/aliases (EXE, KERNEL32, missing bare DLL alias, OLE32, invalid handle) return NULL; COMCTL32's same numeric ordinal does not inherit the OLEAUT32 pointer. Three spelling/path variants agree with GetModuleHandleA. Static ordinal8 and existing BSTR149/150/unknown151 checks pass. The COMCTL32 test deliberately asserts isolation rather than introducing support for another export; its existing stem-to-host-fallback limitation is outside this task.

## Validation and stopping condition

Final unique candidate test files: **5 passed / 1 failed**.

- PASS test-oleaut32-ordinals.js: dynamic identity, actual thunk/handler/ESP/return, negative controls and static/BSTR ordinal preservation.
- PASS existing test-directx-ordinals.js and test-directsound-ordinals.js.
- PASS existing test-bstr-byte-length.js and test-bstr-reallocation.js (retained runner dependencies through NODE_PATH).
- FAIL existing test-getprocaddress-sparse-name.js, line147: “real named export resolves”, actual0 / expected2105344 (0x202000). **Same exact failure on unchanged baseline**, independently rerun. Logs raw/test-getprocaddress-sparse-name.log and raw/baseline-sparse-regression.log, baseline receipt command cmd_x0fotelxhj6g.

Twelve focused source checks pass, recorded in source-gates.json: manifest, fragment balance, ANSI/Wide census, duplicate census, raw-region ratchet, region-map freshness, ordinal data strings, append-only API table, handler ESP, both JS syntax checks and git diff whitespace. These do not constitute the full build gates.

The existing sparse GetProcAddress regression is the concrete blocker. Owner: coordinator/reviewer for a separately bounded regression assessment or repair. Resume condition: resolve/qualify that baseline failure before canonical candidate build admission. Remaining planned dynamic-module/system-path/kernel-image regressions were not run after the blocker. Canonical build attempts: **0**. No gate/census/baseline was changed or bypassed; no independent review was supplied or claimed. Original-game runs: **0**, failed original-game startups: **0**.

## Failures and limitations

Seven failed Node test processes occurred: one missing Calc fixture before guest load; three development assertions in the new test harness (old hardcoded guest address incompatible with the fixture image base; an overstrong COMCTL32 export expectation outside scope; direct dispatch does not itself restore EIP, corrected to the real run-loop route); one missing NODE_PATH for pngjs (corrected to the existing retained runner path, no install); and the candidate/baseline pair of the existing sparse regression above. Full logs/receipts are retained; the pngjs failure is in validation-receipt.json because its log was replaced by the successful dependency-corrected rerun.

Other preparation failures: one initial evidence staging refusal outside the sparse definition (corrected using explicit git add --sparse; tested source commit was already pushed), one transient transport-repacking allocation breach, one rejected over-allocation calculation before checkout, one SSH/scp transfer403 (API key cannot perform ssh), and two local Python formatting failures after successful Calc part uploads. API exec remained independently authorized/working; no SSH retries, credential changes or denied lifecycle actions. The verified API part-transfer recipe is transfer.py. Nonmatching exploratory searches/missing optional inspection paths are not counted as test executions.

All 373 original runtime/installed pins match before and after validation and at final collection; historical module, runner and game assets are unchanged. ShadowMan was untouched. No supporting source repair or successor missing-export/game task was attempted.

## Reproduce and recover

In a source tree at the recorded task commit, retain the standard Calc fixture with the hash in fixture-transfer.json, Node v24.18.1 and the project's existing dependencies. Run:

```sh
node test/test-oleaut32-ordinals.js
NODE_PATH=/home/user/aoe3-original-oct22/runner/node_modules node test/test-bstr-byte-length.js
NODE_PATH=/home/user/aoe3-original-oct22/runner/node_modules node test/test-bstr-reallocation.js
NODE_PATH=/home/user/aoe3-original-oct22/runner/node_modules node test/test-getprocaddress-sparse-name.js
python3 scratch/runs/20261022-aoe3-oleaut-ordinal-repair/verify.py
```

For matching baseline comparison, use the final test with lib/host-imports.js and src/01-header.wat from exact base63d563df, restoring both after the test; see run-validation.py and compare-sparse-baseline.py. `--expect-baseline` explicitly asserts the original alias/NULL, while the normal invocation requires the repaired behavior. compile-src uses the canonical source closure/compiler and appends the test wrappers; the source identity and instrumented module hashes distinguish this route from release build and from historical diagnosis.

Remote candidate/evidence directory: `/home/user/aoe3-oleaut-repair-oct22`. Its source snapshot can be reconstructed from source-manifest.json using base Git blobs plus the three changed source/test files; source hashes must match each manifest row. Original inputs stay at `/home/user/aoe3-original-oct22`. A local clone uses a borrowed donor object store: the remotely pushed task ref is the independent recovery anchor. Evidence files are explicitly committed despite scratch being ignored. No result.json is attached to an unrelated candidate: this app has no matching entry in the inspected candidate-corpus manifest.

## Runtime handback

SAME bx_32262dnp left RUNNING (API state idle), health ok, stop null. Expiry2026-10-22T12:53:29.069Z. Coordinator owns lifecycle/shutdown checkpoint12:35; handback is before12:25. At final collection no task/game/diagnostic Node process remains, ports8123/8124 return ECONNREFUSED111. Available bytes44042563584. No new compute/resume/stop/fork/public host action. Exact final state receipt is box-state.json; HANDOFF.json and repository messageboard record the verified pushed commit/ref.
