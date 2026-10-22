# Canonical qualification stopped at enforced census

Task NEW-GAME-AOE3-DEMO-20261010. Exactly one canonical build attempted; zero original-game startups or Accept actions. Localization remains unqualified. No candidate module was generated: compilation was never reached. No gate waiver, census edit, source repair, second build, integration or deployment occurred.

Exact reviewed candidate: `854f3bdd3d73434b048ee0e6070c00914628d8f4`, source repair `24220bf65a04f665c847fc4037a732f8e82db87c`, separate fixture `2977ba3bd08e5bde5bab5e5323a5de71a14d6b49`. Actual HTTPS remote candidate and main `63d563df7a2b901d222a311ceaf55a0823a22261` verified before and after build. Root checkout HEAD/index/config/TODOS/STATUS were sealed and unchanged.

## Actual build result

Boat API command `cmd_vq1trdjjkuie`, 2026-10-22 12:24:32–12:24:34 UTC. Cwd `/home/user/aoe3-oleaut-repair-oct22`, exact command `bash tools/build.sh`, Node v24.18.1. Existing `NODE_PATH=/home/user/aoe3-original-oct22/runner/node_modules`; no install, compiler override, export instrumentation or gate bypass. Full selected environment, exit and log hash are in `build-result.json`. The outer inspection Python exited zero; the actual canonical bash command exited **1**.

Passed CLAUDE size (22221/32768), WAT manifest (127 fragments) and fragment balance. First concrete blocker:

```
changed producer lib/host-imports.js:host-file (sha256); review its lifetime
```

This is `node tools/callback-ownership-census.js`, an enforced build gate before compilation. Actual host-imports SHA256 `1bc869ea2d7645e2a9e09a10f2611cd5e6cd8eb7c27e660eb4d02310a25c5e60`; census expects `0ae88785667424c12cd3092a1ac113d71afe93842f2a76a9c58d9675f1af7868`. The gate pins the whole host file. Prior focused source acceptance does not replace this gate. Later gates and compilation were not run; no module SHA can honestly be assigned to this attempt. Historical instrumented candidate `7fdda154...` was never substituted.

## Mapping and original inputs

Read-only inventory compared 4541 tracked blobs from the exact reviewed Git tip with retained remote files: 1331 were absent, predominantly unrelated ops material and test fixtures; the only differing present blob was the obsolete sparse test. Only that test was replaced, from the exact reviewed Git blob, with the former bytes retained in remote evidence. No broad missing-file copy was performed. No missing-file failure occurred before the enforced census stop; completeness of later gates remains untested. All 1078 accepted production/targeted-test closure files match fingerprint `ce23f23ed7fcd525e2e4b4b1afa4d8eeacdb344fc7ca25903e3f78b45eaa9305`, with per-file SHA256 rows in `source-manifest.json`. Corrected sparse fixture SHA256 `6c887c8b7e9da0605cd799c90f36611c5c762623f43a28d8b9fec6a9e1f2c5ec`.

All 373 original runtime/installed pins passed immediately before and after the build. Original runtime runner `/home/user/aoe3-original-oct22/runtime/test/run.js` SHA256 `1b4d1a43fc6167ed51328b1cb13c66d5114e35955f505d935279f1ec8cf49799`, historical module `runtime/build/wine-assembly.wasm` SHA256 `f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7`; neither was modified or executed. `retained-original-identities.json` retains runtime pins and the prior diagnostic handoff. Two initially guessed paths under `runner/` were absent; those null inspection results are retained, and the actual paths above come from verified runtime pins. Original native MSXML ordinal8 resolution, parseURL, primary load and post-Accept labels were **not observed in this task**. No screenshot exists because zero guests ran. No inference from prior unit tests is made.

## Recovery and handback

Full remote build log, source manifest, start/result JSON and old fixture are retained at `/home/user/aoe3-oleaut-repair-oct22/evidence/canonical-qualification-20261022T1226Z/` (directory label differs from actual execution time; result timestamps are authoritative). Local decisive evidence includes the full 309-byte log, untruncated Boat receipt, manifests and collection scripts. Source recovery uses the exact pushed reviewed ref; no ignored module is claimed as a backup. Source acceptance was not rerun.

Two local preparation commands hit E2BIG before any remote execution; batched 400-row compressed manifest transport resolved this. No remote preparation/test admission failure, dependency installation, archive or local cap breach. Git status emitted inherited alternate-store nesting warnings; this did not change donor/shared refs. Failure ledger preserves attempt counts. The local evidence checkout borrows donor objects and checks out no production files; actual allocation and mandatory free space are recorded in HANDOFF.json.

Box `bx_32262dnp` left RUNNING (API idle), healthy, stop null, expiry **2026-10-22T12:53:29.069Z**. No Node/Chrome runtime processes, ports8123/8124 both connect-ex111. No guest/controller processes were created. Coordinator owns lifecycle/checkpoint12:47; handback is before12:43. ShadowMan and all original inputs remain untouched. No stop/resume/fork/new compute/SSH retry/child/delegation/refill. Coordinator decides census review, any later qualification task, integration and snapshot-stop.
