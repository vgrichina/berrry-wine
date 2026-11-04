# Stronghold Crusader UK v1.1 — native Save/Load unavailable

**Native save/reload persistence remains unproved.** In the original registered browser game's **Zephyr — Very Easy (1/10)** skirmish, Escape opens Game Options with **Save and Load visibly greyed out**. An ordinary held click on Save leaves that menu in place, with no save dialog. Read-only VFS inspection before and after the attempt finds no native save entries. This is the concrete blocker for this bounded task; it does not establish the cause of the unavailable controls or make a claim about other Stronghold editions.

Evidence: `scratch/runs/20261104-stronghold-native-save-load/`. The preceding food note (`stronghold-browser-food-20261104.md`, commit `d6b48b1527`) establishes a constructed Granary and Dairy Farm, cheese delivery, and consumption of two food types in a running village. It makes no native persistence claim. This attempt checked Save availability before repeating that construction/production work and stopped at the blocker. **No native save was created/exported, no fresh Load was performed, and no granary/dairy/cheese persistence is claimed.** No net food gain, FPS, native game exit, battle completion, or full-game result is inferred.

## Inspected ordinary route

All captures below are under `recovered/browser/`, with paired state JSON and full screenshot hashes. They were personally inspected.

- `startup320.png`, `load6464.png`, `title.png`: registered `stronghold_crusader_demo` selector and Launch, original loading art, publisher splash, then the original title prompt. Ordinary Escape skips the splash; Start Game accepts the existing Lord Crusader title.
- `main-menu.png`, `choose-type.png`, `custom-skirmish.png`: Crusader → right-hand towers → numbered scenario 1. The initial custom screen says “Not available in the demo”; scenario 1 selects the available Zephyr route. This is not the Save blocker.
- `zephyr-selected.png`, `zephyr-ready.png`, `village-entry.png`: close the ordinary character picker, then start Zephyr Very Easy, Normal Game/Human Advantage versus The Rat. The keep and live village HUD appear.
- `native-menu.png`, step **13,632**: ordinary Escape opens Game Options. Save and Load have grey labels; Options, Help, Restart Mission, Quit Mission, Exit Crusader, and Resume Game have brighter labels.
- `save-attempt.png`, step **14,144**: move to browser **(440,365)** on Save, hold the ordinary left button over four separately acknowledged 64-step requests, release, and advance another four 64-step requests. Game Options remains visible with Save/Load grey and no dialog. All input is released.

The read-only `save-export.cjs` helper inspects the live page VFS and exports resident files matching save-directory/native-save suffix patterns when present. Both baseline and post-attempt inspections enumerate **1,922 entries** and select **zero** save entries. Full entry inventories are recovered under `recovered/native-export/`; `native-save-baseline.json` and `native-save-after-attempt.json` retain execution results. Empty export selection supports the observed failed Save attempt; it is not proof that every possible save filename format has been ruled out.

## Exact runtime and preserved failures

Runtime source remains **`1188e9bf57ef35bd3363fb88b7ca0da442ce696d`** at the existing `/home/user/stronghold-registered-skirmish-runtime` path. All **2,415 runtime pins** match before use and after close; all **1,055 served-file receipts** match. `source-reference.json`, `runtime-pins.json`, and empty `relevant-source.patch` record that identity. Concurrent shared-main changes were not used. Git is the source archive; no source tree, source tarball, repeated media copy, or Chrome profile was recovered into evidence.

The original inventory reference remains `scratch/runs/20261103-stronghold-crusader-original/installed-pin.json` (**1,856 files**). This snapshot has **1,854 present and matching**, with zero changed files. The two already excluded auxiliary executables, `ArcadeInstallSTRONGHOLDCD111.EXE` and `pcchk_cmdemo.exe`, are absent; they were not restored or run. The original game EXE remains `test/binaries/candidates/stronghold-crusader-demo/installed/App_Executables/Stronghold Crusader multiplayer demo.exe`, SHA-256 **`9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f`**. The 1,853-companion manifest pin remains **`d51be8d9ab1038b7dc2b3242f3a4ebed382f1fbf33d558211a80bd36ab112b21`**. No mounted game file, game configuration, executable, check, guest memory, or production source was edited.

| Recovered module | Bytes | SHA-256 |
| --- | ---: | --- |
| Canonical, actually compiled/instantiated and sent to guest Worker 0 | 2,143,540 | `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee` |
| Compatibility, retained but not selected | 2,146,153 | `580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3` |

The actual backend is **guest Workers, Canvas 2D/DirectDraw presentation**. Page and Worker observers show no WebGL context; the toolbar's WebGL selection is not a backend claim. Chrome **151.0.7922.108**, Node **24.22.1**, Puppeteer **24.31.0**, cross-origin isolation, 1200×900 viewport, original 800×600 game canvas, local `index.html?debug&candidates&frozen`. Diagnostic/export connections use `defaultViewport: null`.

Before Chrome, the runtime pins, dependency imports, static-server entry point, Chrome/Node availability, Python helper compilation, JavaScript syntax, and save-selection self-test were checked. No asset/media/dependency restoration was needed: the generic `assets` directory is absent, but all sealed required paths are present. That exploratory missing-directory diagnostic is not an application failure.

The first live read-only export inspection failed because it accessed `.data` on every VFS entry to obtain sizes, triggering an async-only media getter on the original readme. `remote-commands.jsonl` preserves the exact `VfsPendingError`; `save-export-first-failure.cjs` preserves that helper version. The corrected helper reads resident size through an own-property descriptor, without invoking unrelated lazy getters. It then completed both inspections. No game restart, viewport repair, guest write, or production repair followed this helper failure. Prelaunch syntax/self-tests did not catch this live dependency issue.

## Validation and coordinator handback

`verify.py` passes **260 sequential completed requests**, **221 step requests**, maximum **64 batches each**, exactly **14,144 steps**, and **25 ordinary input commands**. All held keys/buttons balance, all **20 observed input events are trusted**, the final input queue is empty, and the mouse-button mask is zero. Screenshot hashes, canonical page/Worker linkage, matching HTTP pins, and normal browser close pass. These checks support control/evidence integrity, not native persistence.

Fresh **`bx_e94v5mct`** was allocated from named **`stronghold-browser-food-20261104`**, finite TTL **3,600 seconds**, and recorded healthy **RUNNING/API-idle** before use. Expiry **2026-11-04T03:35:44.549Z**, shutdown owner **coordinator**. The old stopped **`bx_6j758ddr`** was untouched. Browser interval **02:36:53.961–02:40:15.377Z**, **201.416 seconds**, below the 25-minute segment bound. `browser.close()` exited Chrome PID **7949** with code **0**; driver PID **7937** and Chrome are absent, and loopback port **35263** is closed. This is browser/helper cleanup, not a tested native Exit Crusader route.

Recovery completed before **02:41Z**: **817 files including both actual modules**, verified by full SHA-256. The box was handed back healthy **RUNNING/API-idle** with the same expiry and coordinator shutdown ownership. This worker did not stop, delete, resume, deploy, or launch another worker. Focused checks: `verify.py` and `node test/test-app-files-policy.js` pass. No production code changed, so no production build was needed. Evidence-checker output is retained; Stronghold has no candidate-manifest entry, so this remains investigation evidence under its registered app rather than being attached to an unrelated candidate.

The task ends at this precise blocker. A persistence proof needs an authorized original route/build with an enabled native Save control; then it must preserve actual native save bytes, start a fresh browser, Load through ordinary controls, and inspect granary, dairy, and cheese state. The prior delivery evidence remains valid and separate.
