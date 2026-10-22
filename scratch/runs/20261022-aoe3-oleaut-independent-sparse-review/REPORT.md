# Independent OLEAUT32 source acceptance and sparse regression disposition

**ACCEPT source delta `24220bf65a04f665c847fc4037a732f8e82db87c` for focused correctness.** The sparse GetProcAddress failure is a demonstrably obsolete test fixture, corrected separately in `2977ba3bd08e5bde5bab5e5323a5de71a14d6b49`. All planned focused and remaining DLL regressions pass. This is not canonical-build, original-game, deployment, or gameplay qualification. No main merge.

Task: NEW-GAME-AOE3-DEMO-20261010. Review branch: `task/aoe3-oleaut-independent-sparse-review-oct22`, based on evidence tip `cef99b250f668da830c8d9679c40327c782e9994`. Actual canonical HTTPS refs were reconciled: main `63d563df7a2b901d222a311ceaf55a0823a22261`, repair branch `cef99b250f668da830c8d9679c40327c782e9994`. The old root HEAD was deliberately not used as source. Native-cause evidence `07037a8a` establishes original MSXML's OLEAUT32 ordinal8 NULL -> native exception `c06d007f`; diagnostic acceptance alone did not establish this source repair.

## Source review

The production delta is two additions, with no handler/API renumbering:

- `src/01-header.wat`: append `oleaut32` after all ten existing names and before the terminating empty string. Existing module indices and the four-entry DirectX range remain stable. Eleven entries fit the existing 64-cell process-shared image registry. The names occupy 80 bytes at RESERVED_PAGE_STRINGS+0x280, ending at +0x2d0 (exclusive); no new allocation or overlapping segment was introduced. The existing name matcher handles case, basename and optional DLL suffix. The existing lock-protected registry allocates native module headers and publishes one identity per name after initialization. Real mapped DLL lookup retains precedence.
- `lib/host-imports.js`: `OLEAUT32.DLL#8` maps to existing `VariantInit`, consistent with the existing WAT system ordinal resolver and retained pinned Wine `oleaut32.spec`. Static ordinal8 was already correct. The dynamic resolver uses WAT's ordinal route before host fallback; merely adding a host-map assertion would not prove this repair.

Unknown ordinal and wrong-module behavior is preserved by the existing module-identity guard. The repair does not reinterpret old EXE aliases as OLEAUT32. The existing named global API fallback, COMCTL32 stem/fallback limitation, and full native OLEAUT32 export surface are not newly qualified by this review.

## Independent actual execution

On assigned bx_32262dnp, Node v24.18.1, separately named `/home/user/aoe3-independent-review-oct22/{baseline,candidate}`, the original candidate/source/dependency directories were read in place. Scratch trees initially hardlinked source files for space efficiency; every mutation unlinks its destination first, then writes a private file, and restores in finally. No retained candidate or original tree was edited. Baseline differs only in the two exact production files restored from baseline-inputs; Git confirms these are the entire production delta from main.

`original-receipt.json` / command `cmd_hpkcvl4vndi6` records independently replayed actual resolver/thunk tests:

| Test source | LoadLibraryA OLEAUT32 | GetProcAddress #8 | Exit |
|---|---:|---:|---:|
| exact baseline, `--expect-baseline` | EXE alias 0x1000000 | NULL | 0 |
| candidate | distinct identity 0x1017884 | thunk 0x81004a8 | 0 |

Instrumented full-closure module hashes match the prior evidence: baseline `28de613a008129f4d4b8d6d0b3a05494cef7c4bd59d9bea192799b3fc580dc50`, candidate `7fdda15444bf4fc1b5047375865662224f45b585eee51e35b2a67c9a21949d87`. These are test modules, not canonical artifacts.

The candidate test invokes the returned pointer via `run(1)`, reaching the actual thunk and VariantInit handler. It checks saved EIP 0x402000, ESP advance of exactly eight bytes, the following stack word, VT_EMPTY and sixteen cleared VARIANT bytes, and eight surrounding canaries. An invalid VT_UNKNOWN pointer makes an accidental releasing handler unsafe. Equivalent name/path spellings and GetModuleHandle identity agree. Ordinals 0/151/65535 and EXE/KERNEL32/missing-DLL/OLE32/invalid handles do not inherit OLEAUT32's ordinal8. COMCTL32's same ordinal is isolated. Static8 and existing BSTR149/150/unknown151 expectations pass.

Oracle quality: this executes the production path rather than only checking maps. Independent mutations in the scratch candidate make VariantInit clear zero bytes, clear seventeen bytes, or pop twelve instead of eight bytes; all three are rejected at the corresponding content/canary/ESP assertions (`handler-receipt.json`, `cmd_8ma798tayvze`, raw handler-control logs). The test observes return EIP, not subsequent execution of that continuation; it does not establish arbitrary guest callbacks, concurrency, or original MSXML success. Full-union clearing is the existing implementation's stronger behavior, not a new universal Windows requirement. The baseline diagnostic switch is explicit; ordinary execution still requires the repair.

## Sparse failure: exact boundary and correction

Original `test/test-getprocaddress-sparse-name.js:147` injects a DLL_TABLE record and shared count but never publishes its separate DLL_LIFECYCLE_TABLE row. Zero means FREE. This is not a current loaded module.

Current producer contract is in `src/08b-dll-loader.wat`: mapping initializes a separate lifecycle row, advances generation, records roots/pins, and publishes INITIALIZING; `complete_dll_initialize` publishes LIVE on success/no entry point. Both ordinary resolvers reject FREE rows. More immediately, `dll_pin_module` rejects FREE/FAILED; `src/09a0-handlers-base.wat`'s GetProcAddress wrapper returns NULL/ERROR_INVALID_HANDLE6 when a non-EXE/non-static module cannot be pinned. Thus the original fixture never reaches name-export resolution. A nonzero DLL_TABLE row or high-water count alone is deliberately insufficient.

Concrete unmodified baseline AND candidate replay, same command `node test/test-getprocaddress-sparse-name.js`, both exit1, both `real named export resolves`, `0 !== 2105344`; raw logs and `original-receipt.json` preserve the commands/cwds/exits. This equality was evidence to diagnose, not grounds for a waiver.

The isolated fixture correction initializes a fresh generation1 lifecycle row with one explicit root, writes its existing export metadata unchanged, publishes LIVE, then shared count. This models a completed synthetic module without invoking DllMain. It does not change production code or relax export assertions. It adds a FREE->LIVE round trip: both name and ordinal must return NULL/invalid-handle6 with no fake thunk while FREE, then resolve the original address again while LIVE. Missing malloc/calloc/free/GetTickCount/unknown exports still require NULL/ERROR_PROC_NOT_FOUND127 and no thunk; a genuinely present malloc export still resolves.

`fixed-receipt.json`, command `cmd_tuy0mwbrxpkw`, demonstrates corrected baseline and candidate exit0 and three rejecting controls (all exit1):

1. Publish FREE instead of LIVE: original positive named-export assertion fails, 0 != 0x202000.
2. Remove the actual export address: the same assertion fails, proving the correction cannot hide missing exports.
3. Bypass both module-pin FREE guard and both locked resolver FREE guards: the new FREE-row assertion fails, 0x202000 != 0.

One initial control attempt removed only the two inner resolver guards and still passed, because the outer pin guard correctly remained effective. Its orchestrator stopped on that unexpected PASS before remaining regressions. `fixed-attempt1-receipt.json` preserves it. The final control includes all three relevant guards and rejects the incorrect boundary. No gate was waived and no permissive production mutation remains.

## Remaining regression results

After successful corrected baseline/candidate and rejecting controls, these seven existing candidate files ran in order and all exited0 (`raw/fixed-results.json`): DirectX ordinals, DirectSound ordinals, BSTR byte length, BSTR reallocation, dynamic module filename, LoadLibrary system path, and kernel32 image. With focused OLEAUT32 and corrected sparse test, **nine unique candidate test files pass**. Kernel32 covers 470 EAT/GetProcAddress exports plus holes, foreign names, shared identity, references, paths and real mapped precedence. No new concrete production blocker was found.

The original four tests, initial five-process control attempt, final twelve-process corrected/control/regression pass and three handler controls total24 Node invocations. Expected original failures and deliberate mutation failures are retained; the only development-control surprise was the incomplete guard bypass described above. No missing dependency, fixture, timeout or runtime admission failure occurred in this review. Existing dependency paths were reused; no installation, transport archive, packaging, broad trace, canonical build or original-game run.

## Integrity, allocation and handback

Final collection `collection-receipt.json` independently hashes both the retained candidate and review candidate: all1078 production/test-closure files match fingerprint `ce23f23ed7fcd525e2e4b4b1afa4d8eeacdb344fc7ca25903e3f78b45eaa9305`. The corrected sparse test is separately hashed and matches the committed local test. Original373 pins pass before/after the regression sequence and final collection. ShadowMan was untouched. Root HEAD/index/config/TODOS/STATUS seals match admission; no donor checkout/config/shared ref was mutated. Fresh worker PID406890 launch flags show wine-worker, gpt-6.1-sol, medium,200000 TOTAL automatic compaction; no children/delegation/other worker launches.

Before materialization a one-file manifest and8MiB allowance were measured under the64MiB task cap, with free7661973504 bytes above mandatory2982150144. Only that focused test and review evidence were checked out; donor source/evidence were read in place. Final measured usage is in HANDOFF.json, including own git/checkouts, launcher output, watcher and temporary setup script. No archive was produced, so no double-archive transient. The prior implementation's allocation breach is retained in its report and not repeated here.

Box bx_32262dnp remains RUNNING (API state idle), healthy, stop null, expiry **2026-10-22T12:53:29.069Z**. Final process inspection has no Node/Chrome runtime processes; ports8123/8124 both ECONNREFUSED111. Available remote bytes44038508544. Source, dependencies, fixtures, baseline/candidate scratch, raw evidence and all original pins remain recoverable. Coordinator owns lifecycle and checkpoint12:35; this review returns ownership before12:30. No stop/resume/fork/new compute/public hosting.

## Unfinished prerequisites and recovery

Coordinator must separately decide integration, complete enforced canonical build gates, preserve artifact/source identity, and authorize an original-game retest. Only that future run can determine whether the original MSXML parseURL exception is resolved and what subsequent blocker appears. Localization, dialog text, gameplay, audio and performance remain unqualified. There were zero canonical build attempts and zero original-game runs in this review.

Recover source from the pushed repair/review refs; the isolated local Git store borrows donor objects and is not the sole recovery anchor. `setup.py`, `run-original.py`, `run-fixed.py`, `check-handler-oracle.py` and `collect.py` preserve exact Boat API execution recipes and mutation/restore logic. `setup.py` expects a fresh scratch destination; use a new named directory for repeat evidence. Reuse existing NODE_PATH `/home/user/aoe3-original-oct22/runner/node_modules` and Calc fixture. For offline evidence checks run `python3 scratch/runs/20261022-aoe3-oleaut-independent-sparse-review/verify.py`. Report/evidence is a separate commit from the fixture correction. The final pushed report commit and verified remote ref are recorded on the append-only repository board and in worker handoff.
