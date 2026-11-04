# Stronghold original Custom Game callback and scene request observed

**The single original native Custom Game press executed callback ID 2, took its original Custom Game branch and requested scene 20. The final ACK boundary also reports current scene 20. Rendered preset readiness and world progress remain unproved.** At step10880 the full screenshot still showed the ChooseType Custom Game hover, so the unchanged route guard failed and closed Chrome. No preset, Zephyr, Start or gameplay input followed.

Evidence: `scratch/runs/20261104-stronghold-live-observer-route/`. Predecessor: [game-output freshness and observer repair](stronghold-game-area-freshness-20261104.md), commit `9931de67074c534fd5535a4850abb0f54af24c0c`. No production defect was established or production file changed.

## Observer repair and preflight

The predecessor's run-only observer controller retires CDP-detached predecessor sessions while retaining their identity, recording-window status and missing-final-report limitation. Before launch I tightened two additional coverage cases in the owned copy: empty instance reports now reject sampling/stop as well as arming, and retirement during arming counts as recording coverage loss. The controller persists reports before throwing. Every live instance must remain present and armed; failed live sessions, read errors, dropped rows, empty coverage and recording-time retirement remain terminal. Callback-absence qualification stays explicitly false.

The original22 modeled CDP controls plus five additional sampling/arming controls pass: **27 total**. The **20 captured freshness controls** and **12 route modes** pass. Full screenshots remain preserved, and freshness still compares every pixel of the entire measured game output x10,y194,width860,height668, with exact ownership, session, Worker identity, tick and geometry. Native coordinates, readiness, input queue ownership, ACK/drain and personal review requirements remain intact.

Before Chrome, the actual retained normal WASM/original EXE executed argument3 negative and ID2/requested20 positive fixtures in the actual Worker/broker. The observer installed before instantiation, bound same-instance exports and used pure JS translation. Recovered `actual-worker-result.json` SHA is `d1b6663de794a8ae12505fa3536c6b3ab87cad03f52a926b3a04965c02276d8d`. These explicit offline fixtures are separate from the browser route; the browser used no forced guest call, memory write or scene substitution.

Preflight checked all **2415 retained source/module/media pins**, actual transitive helper dependencies, CommonJS/dynamic ESM/Puppeteer imports, syntax, the **98 page /12 Worker cache graph** and five pinned HTTP responses with isolation headers. Original instruction audit, observer negatives, successor/DOM/integer route tests, native Start negatives and launch sequencing also passed. The detached launcher completed normally beyond the external60-second command limit. Only small run-specific helpers were staged; media/modules were referenced in place.

## Original route and positive trace

I personally viewed the loading artwork/dialogs, original title, main menu, Crusader hover, strict ChooseType screen, exact Custom Game hover and final postpress screenshot. Balanced title Enter at10240 reached the main menu at10368. Native **304,144** Crusader input reached strict ChooseType at10560. Native **543,292** movement ACKed/drained and produced the reviewed Custom Game hover at10624.

Reviewed hover full-PNG SHA: `2296d1dd6ea86f58678746a87908588871a3b77f213fd9e900b2c9fde7ab7bbc`. It shows Choose type of Crusader game, left map, right bright towers, Custom Game and Customize your own Crusader game. Observer arming then succeeded on all **four live instances**, slots0–3, each2261 exports and installed before instantiation. Two predecessor sessions had retired before recording; their IDs and unavailable final reports are preserved in every observer report. There was no retirement during recording, no observer read error and no dropped row.

The one physical down/up pair produced exactly the owned native messages at HWND65537: down queues WM_NCHITTEST132 then WM_LBUTTONDOWN513 with mask1; release queues WM_LBUTTONUP514 with mask0. Callback execution happened during the down ACK. The smallest unchanged trace range is **0x430e10..0x430f15**, with DispatchMessage and pre/post ACK observation:

| Actual slot0 / thread1 row | Evidence |
| --- | --- |
| sequence3 | DispatchMessage entry: HWND65537, message513, wParam1, lParam19137055 (543,292) |
| sequence5 | Original callback at0x430e10; stack argument1 is **2**; current/requested scene55/55 |
| sequence6 | Original Custom Game branch at0x430e4f, EAX2 |
| sequence7 | After scene request at0x430e76; requested scene **20**, current scene55 |
| sequence14 | DispatchMessage entry for matching native release514, wParam0 |
| sequence16 | Final post-ACK boundary: current/requested scene **20/20** |

Ten persisted observer reports cover arming, four pre/post ACK pairs and terminal stop. They preserve cumulative per-instance rows, exact trace range and zero errors/drops. Positive callback/request evidence does not depend on an absence inference. Detached predecessor coverage limitations remain explicit.

## Terminal gap

At **2026-11-04T09:56:47.257Z**, route command8 failed with `first unexpected route scene: choose-type-custom-hover`. The actual postpress capture at10880, personally viewed after recovery, still visibly shows the ChooseType Custom Game hover. Full-PNG SHA: `e542d97f27bbeb0a8152d7d4a5f73c4e6421d8d8dd77bb1876b634f267ff82bf`. Scene20 state proves neither a rendered preset nor gameplay readiness. The evidence does not identify why the image had not transitioned by this boundary; no speculative production repair or scene-recognizer relaxation was made.

Chrome9973 closed normally, exit0 at **09:56:47.591Z**, immediately on the first failure. No second browser, reload, retry, preset67491, Zephyr selection, Start718569 or gameplay action occurred. Final queue is empty, active/last input null and mouse mask0. The next useful separately authorized investigation is bounded input-free observation of natural scene20 initialization/rendering after this proven request, retaining exact preset/readiness gates before any further input.

## Verification, recovery and custody

`actual-evidence-check.json` verifies **170 complete64-step ACKs /10880 steps**, **1032 matching served-pin records**, six paused-before-start Worker preloads, four live armed instances throughout recording, the actual callback/branch/request/message order and terminal cleanup. Eight mutations of the recovered proof reject wrong identity, drops, read errors, missing instances, recording retirement, incomplete coverage, argument3 and wrong requested scene. All **242 immutable closed files /17,093,971 bytes** were SHA-verified locally by09:56:55, including reuse of already recovered identical reviews. Unique Worker result, driver log and exact tested driver were recovered separately. Driver/Chrome are absent; actual private HTTP33127 is closed; all2415 runtime pins remain unchanged.

`exact-git-sha.txt`, relevant binary diff, owned new helper/note patches and artifact manifest preserve provenance. Git is the source archive; no source-tree snapshot/archive, scratch/docs/test-binary tarball or repeated media/module copies were made. Retained runtime source Git remains `1188e9bf57ef35bd3363fb88b7ca0da442ce696d`; original EXE SHA is `9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f`; normal/compat WASM SHAs remain `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee` / `580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3`. Existing path/SHA records are referenced in `retained-module-media-references.json`.

Only this note is committed. Tested run-helper repairs remain in ignored evidence with new-file patches; no production build claim applies to this documentation-only commit. Publication outcome is recorded separately in the run and final handoff; a local commit is not a publication claim.

Assigned **bx_g5fcu9qz remains RUNNING /API-idle, healthy and hydrated**, expiry **2026-11-04T10:31:12.262Z**. Custody returns to the coordinator, who owns shutdown. No lifecycle/allocation/sourcebox/local heavy browser/subworker/successor/HeroesII/deployment action occurred. This single assignment stops with the callback/request proved and the rendered-preset/world gap preserved.
