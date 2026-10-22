# Canonical qualification: blocked at callback ownership census

**BLOCKED_CANONICAL_CALLBACK_CENSUS** for exact candidate `7a21579f9adb208164312961c249a0aa9080a8b7`. One ordinary `bash tools/build.sh` exited **1** after **5.0370205 s** on fresh assigned Boat `bx_f3gs8qm2`. First failed command is `node tools/callback-ownership-census.js` at candidate `tools/build.sh:24`. The build stopped before memory-map checks, compilation or module emission. No second build, source/generator/census/baseline repair or fallback was attempted.

Exact diagnostic, preserved in `remote-evidence/canonical-build.log`:

```text
changed producer lib/process-boot.js:host-file (sha256); review its lifetime
changed producer lib/storage.js:host-file (sha256); review its lifetime
```

These are candidate source/retained review-lock mismatches, not a missing staging input. `blocker-details-api.json` preserves both baseline entries and exact candidate producer hashes. No claim that a lifetime bug exists follows from a whole-file SHA mismatch; the normal gate requires review and failed as designed. My first progress update called this the memory-map gate; inspection of the exact candidate build script corrected it to the preceding callback ownership census. The root checkout has a different build script and was not used for qualification.

## Identity, inventory and complete staging

Actual canonical HTTPS refs were read-only reconciled locally and remotely: main `89f1e9d2c67aa94d56d2319115589d07204d42e0`, candidate `7a21579f9adb208164312961c249a0aa9080a8b7`, independent acceptance `4d7c40955935ec466b9e30b44c520b60048335a6`. Candidate's actual parent is that main. The test checkout remained detached at the candidate throughout; the evidence branch is separate and must not be substituted for tested HEAD.

The local inventory found six conventional checkout `build/*.wasm` files and no exact candidate canonical-module provenance. Four have the excluded historical SHA-256 `f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7`; the two web artifacts are also not candidate-qualified. Fresh remote source directory had no wasm. Inventory paths/hashes are in `module-inventory.json`. No historical module was reused.

Derived the exact candidate's conservative complete `src/`, `lib/`, `tools/`, `test/`, `fonts/`, root JS/package metadata and both committed toyVM bundle closure: **3,426 files / 84,995,127 bytes**. This is not the historical c7fae5ac manifest. It includes `fonts/Terminal.fon` and `tools/toyvm/emit-decoder.js`. `remote-evidence/build-inputs.json` records each actual candidate path, Git blob ID, SHA-256, mode and byte length. Every selected blob's Git SHA-1 was checked; each materialized file's SHA-256, size and mode were checked and scanned-directory membership was reconciled before build. All selected tracked input hashes were rechecked after build and unchanged.

Remote fetch was restricted to exact candidate and actual main, blob-filtered, two real generations, followed by one explicit batch request for only selected closure/history blobs. Three real commit objects are present, with truthful shallow boundary `324cc4f9580755a4fcc97eea0a5e4070ea7a0df9`; no fabricated/unrelated history or fake unshallowing. HEAD, HEAD^ and the actual parent/main API-table and silent-stub-tool inputs were verified. See `remote-evidence/history-inputs.json`, `staging-identity.json`, fetch logs and `stage_remote.py`. This history covers the actual normal build's comparisons; no index-only API fallback was accepted.

The historical build-closure recipe supplied directory/path guidance only. Local full closure was never materialized, and no donor/root Git metadata, source, index or alternates were modified. No corpus/media/archive was imported.

## Commands and scope

Remote cwd for all build work: `/home/user/shadow-man-dsetup-canonical-qualification-oct22`.

| Actual command | Exit | Evidence / scope |
| --- | --- | --- |
| `node tools/check-api-table.js --base=89f1e9d2c67aa94d56d2319115589d07204d42e0` | 0 | 4,594 entries, id equals index, append-only against actual main; no fallback |
| `bash tools/build.sh` | 1 | Exactly one attempt; CLAUDE size, 127-file WAT manifest and 127-fragment balance passed, then two callback census mismatches |
| All requested default tests and relevant PE lifecycle/import tests | NOT RUN | Canonical build failed; no module to qualify |

Exact command/environment/cwd/timestamps/exits, log hash and output inventory are in `remote-evidence/build-attempt.json`. `NODE_OPTIONS`, `NODE_PATH`, `WINE_REGION_MAP`, `WINE_REGION_SHAKE`, `WINE_WAT_NAMES`, and `WINE_WAT_COMPILER` were unset; `GIT_NO_LAZY_FETCH=1`. All ordinary build gates remained intact. Node **v24.18.1**, Git **2.43.0**, Bash **5.2.21** on Linux x86-64. Node executable SHA-256 is `f3432a45b03b2da0d270095fdd8813dc34cbea73f5fc8b18c7a384b7cf9b333a`. No external package installation or nonstandard binary was necessary for the reached builtin-only build path. Later test dependency resolution remains untested.

Module identity is **NULL: no output produced**. Full-module assertions, native calls, PE initializations and game launches from this task are all **0**. Early gates report their counts; a total internal assertion count is not emitted and remains unknown.

The requested tests remain outstanding: `test/test-file-version-info.js`, `test/test-ne-file-version.js`, `test/test-static-dx-version.js`, `test/test-directx-setup.js`, `test/test-directx-ordinals.js`, `test/test-dsetup-loading.js`. Existing relevant files located include `test/test-dll-lifecycle-real-pe.js`, `test/test-dll-import-graph-lifecycle.js`, `test/test-dll-import-no-ilt.js`, `test/test-dll-lifecycle-races.js` and `test/test-scoped-dll-lifecycle.js`.

Loader inspection in `inspection.txt` establishes why command names alone cannot qualify a canonical module: file VERSION and NE defaults compile full source with extra query exports; static DX compiles full source; DirectXSetup uses render-helper with an added export. DirectX ordinals is JS host resolution only; DSETUP loading instantiates `compileBindingFixture()`, an extracted-source fixture, and explicitly executes no x86. The real PE lifecycle/import-graph tests use `test/run.js --no-build --wasm=...` (default `build/wine-assembly.wasm`, overridable with `WA_TEST_WASM`) and synthetic guest PEs. **None actually instantiated a fresh full module here**, and no source fixture is being represented as full-module acceptance.

Reused the accepted candidate 23-command/four semantic rejecting-control receipts and five independent source-check receipts by hash (`reused-acceptance.json`); no broad source acceptance was repeated. Original readonly DSETUP/DSETUP32/DSETUP16/config sizes and SHA-256 were checked before and after against the coordinator receipt. None was staged remotely because the canonical gate failed before tests needed originals. No original binaries are committed.

Full native `IAT 0x409024 -> 0x100018b0`, `DirectXSetupGetVersion` two optional DWORD outputs and native stdcall `ret 8` / ESP+12 remain **UNKNOWN at full-module execution scope**. Prior scoped source evidence survives unchanged. Actual installed registry branch/output is **UNKNOWN**. No successful version is invented. Windows equivalence, browser behavior, affected-game prerequisites (AoE2/NFSII/Crimsonland/TA), installation and gameplay remain unqualified. The stopped installed snapshot `bx_m4xrrj5a` was untouched.

## Resources, preservation and handoff

Local prewrite projection: **37,011,456 bytes**, conservatively including the entire readonly donor, shared original inputs, launcher, own Git/evidence allowances and 8 MiB reserve, within 64 MiB; host free **6,592,237,568 bytes** at initial inspection, above mandatory **2,982,150,144**. Focused evidence checkout only; no obsolete 16 MiB sublimit. Final measured allocation and metadata/input seals are in `verification.json` and the own checkout's `scratch/final-publication.json`.

Remote admission was measured before transfers and expansion. Staging allocated **117,727,232 bytes**; sampled build peak **117,751,808 bytes**. Evidence handback allocation **117,833,728 bytes**, plus **67,108,864** reserved bytes, below the **1,073,741,824** task ceiling; host free **48,965,955,584 bytes**, above 2 GiB floor. Final tiny blocker detail addition is bounded by a 1 MiB handoff allowance. No deps, originals, module or other outputs enlarge the task. Logical source bytes and actual allocated bytes are distinguished in the receipts; sampled peak is not claimed as exact high water.

`bx_f3gs8qm2` is left **RUNNING**, API state **idle**, health **ok**, stop **null**, expiry **2026-10-22T23:20:32.491Z**. Build subprocess was waited/reaped; no build/test child remains. The only later API commands collected evidence/read-only details. Retained remote source/Git/evidence root: `/home/user/shadow-man-dsetup-canonical-qualification-oct22`; local evidence is independently preserved here. Coordinator owns shutdown/checkpoint 22:25 UTC. Handoff is well before 22:20. No box creation/fork/resume/stop/delete was performed by this worker.

Report and evidence are committed/pushed only to `task/shadow-man-dsetup-canonical-qualification-oct22`; publication receipt and append-only board record actual remote SHA. No main merge, deployment, laptop, producer/integration repair, new instrumentation or follow-up task. This bounded task stops at the first real gate blocker.

Offline evidence verification passed; the existing ops containment checker reported zero errors/missing/invalid and zero run records. Shadow Man has no registered candidate entry in the prior acceptance, so no unrelated dashboard candidate or gameplay `result.json` was invented. Staged whitespace checking passed with the raw `git-init.log` excluded: its three literal `hint: ` lines retain Git's original trailing spaces. A credential-signature scan of owned evidence passed. These are evidence checks, not additional source acceptance or full-module tests.
