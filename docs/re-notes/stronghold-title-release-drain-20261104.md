# Original Stronghold title transport repaired; menu freshness guard stopped the run

The actual run-specific browser driver now completes and drains each half of the original title Enter pair before observing the transition. The one original browser reached a **drained, strictly recognized and personally reviewed main menu at step 10368**. It then moved to the internally projected Crusader control, drained at step 10432 and presented the correct hover. The unchanged full-PNG freshness check rejected **`stale hover review` before any mouse-down**. ChooseType, route installation, Zephyr, native Start, world entry and ordinary gameplay remain unexecuted.

Evidence: `scratch/runs/20261104-stronghold-title-release-drain/`. Only this note is committed. The finished run-specific driver, title transport, tests and operator helpers are recoverable from `owned-new-helpers.patch`; no production file changed. Full build is therefore not required. There was no second browser, reload, retry, guessed gesture, forced scene, guest write/call, Deathmatch fallback, source-box access, local heavy runtime, subworker, successor or deployment.

## Implemented boundary and offline validation

`browser-driver.cjs` reuses the predecessor's tested balanced `MenuDriver`, NCHITTEST-aware route helper and original queue. Its new single-attempt `title-enter` mailbox action owns one `EvidenceBoundary.run` operation. It requires explicit constructor-backed idle telemetry, supported geometry, an exact original title-dialog capture, personal review and a fresh identical recapture before input.

The driver delivers physical Enter down, observes exactly ordered WM_KEYDOWN/WM_CHAR for Enter, requires a complete 64-step per-guest ACK, then checks and drains only the owned key events. Only after explicit null active input, null last input, empty queue and zero mouse mask does it deliver Enter up. The release must be exactly WM_KEYUP13, with the original key lParam, and independently complete its ACK and drain. Renderer/host queue, active event, masks and getter must agree; missing telemetry and foreign input reject. A failure while physically held releases only its owned Enter without additional execution.

One aggregate **4096-step** title budget bounds drainage and transition observation, alongside the existing navigation aggregate and browser deadline. Fresh transition captures are personally reviewed. The existing strict main-menu recognizer remains unchanged. An exact RGB patch from the retained parchment-only picture labels **`title-intermediate`**, separately from main menu; only that exact intermediate can receive another bounded observation. Other pixels reject. Neither native Start guards nor any existing scene recognizer changed.

`title.test.cjs` executes the **changed actual browser driver's mailbox, state, capture and queue closures**, the complete production browser DOM keyboard bridge, real renderer handlers and real host `check_input` import. Its **20 checks** include release consumption delayed until the third ACK, two fresh intermediate observations before main menu, permanently unconsumed release exhausting the finite budget, bad ACK, unknown transition rejection, balanced cleanup and single-attempt enforcement. ACK execution and scene timing are modeled; this is not a local guest/game run. The separate changed-driver integration passes **17 checks** through the actual menu/route/native installation dispatch, with zero Start calls. Predecessor DOM route tests pass all **eight negatives**, and the unchanged strict native suite passes.

Reproduce the focused checks with:

```sh
node scratch/runs/20261104-stronghold-title-release-drain/title.test.cjs
node scratch/runs/20261104-stronghold-title-release-drain/actual-driver.test.cjs
node scratch/runs/20261104-stronghold-balanced-menu-route/route-dom.test.cjs
node docs/re-notes/stronghold-native-start-boundary-20261104.test.cjs
```

`focused-final.log` preserves the passing output. These helpers use existing predecessor files in place; their notes and new-file patches retain those dependencies.

## Actual browser and first missing boundary

Preparation Git SHA: **9bf19ff52d4f25ed5bfdbe6166389074efc8b373**. The retained runtime source remains **1188e9bf57ef35bd3363fb88b7ca0da442ce696d**, with the previously repaired renderer constructor. All **2415 retained pins** matched before and after. Original EXE SHA-256 remains **9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f**; canonical module **cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee**, companion **580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3**. Existing media/module paths are referenced in retained pins, without copies. The actual staged changed driver/helpers matched individual SHA-256 values. Actual Puppeteer CommonJS/dynamic ESM imports and five pinned HTTP responses with COOP/COEP passed before Chrome.

Chrome **47587** opened by **07:23:01.177Z**, closed normally at **07:25:20.024Z**, exit zero; driver **47571** also exited. One registered original launch used Chrome 151.0.7922.71, Workers, frozen 16ms clock and original Canvas/DirectDraw presentation. Startup captures at 2048/4096/6144 showed artwork/loading; 8192 showed Firefly Studios; 10240 showed Enter Your Title / Lord Crusader / Start Game. An initially incorrect prose description of 8192 was immediately corrected append-only in the personal review log.

The title command's two complete ACKs advanced **10240 → 10304 → 10368**. Both input halves drained; the first post-pair fresh capture was already the real main menu, personally reviewed. **The live run did not need extra drainage steps or encounter the intermediate picture**; delayed consumption and bounded intermediate observation are validated offline, not claimed live.

Menu transport computed browser **(337.3375,360.4433333333333)** internally for native **(304,144)**. Its physical move and complete ACK drained at **10432**. The personally reviewed hover capture shows the axe beside Crusader and its skirmish description. Review spanned the minute change from 07:24 to 07:25. The fresh recapture differed in exactly **53 pixels**, bounded by **(1161,883)–(1168,890)**, entirely in the desktop taskbar clock. **Zero game-area pixels changed.** `hover-capture-diff.json` and both full recovered captures establish this; both telemetry snapshots remain drained. The unchanged full-image hash guard correctly applied its existing contract and stopped before the press.

The first missing boundary is therefore a freshness identity scoped to the qualified game presentation while preserving geometry, telemetry, scene and personal-review requirements. This is a diagnosed next change, not a bypass applied to this run. No extra input or execution followed the rejection; only quit/recovery occurred. No runtime game defect is established by this failure.

## Closed evidence and handoff

`verify.cjs` / `verification.json` confirm eight sequential replies, the expected sole rejection at command 6, **163 complete ACKs / 10432 steps**, **1032 served-file pin receipts**, one in-game mouse move, zero in-game mouse presses, drained reviewed main, and normal browser cleanup. The launch button's page-level click is separately visible before the game runs. `recovery-closed-verified.json` maps and fully verifies **213 closed logical files / 9618055 bytes**, recovered by **07:25:28Z**, reusing identical already recovered captures.

Actual exec at 07:25:28Z confirms Chrome/driver absent and private HTTP **46441** closed. Assigned **bx_87cqdcba** remains **RUNNING / API-idle**, healthy/hydrated, expiry **2026-11-04T07:43:10.325Z**. The coordinator retains shutdown ownership. No lifecycle action was performed. Git SHA, relevant binary diff, owned new-file patches, staged hashes and final artifact seal provide recovery without source snapshots, archives or media/module copies.

The title repair is finished and tested. Further original gameplay remains blocked at the unchanged menu hover freshness boundary; this single-task worker stops after publishing the diagnosis and closed evidence.
