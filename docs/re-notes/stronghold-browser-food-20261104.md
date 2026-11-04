# Stronghold Crusader UK v1.1 — browser dairy delivery

Ordinary browser gameplay in **Zephyr — Very Easy (1/10)** now demonstrates a **Dairy Farm producing cheese and delivering it to a Granary**. The native farm panel progresses through “Going to workplace,” “Waiting,” “Working,” and **“Taking Cheese to store.”** The granary subsequently changes from **1 food type eaten** to **2 food types eaten, +1**, with a new cheese stack visible. This extends the preceding village-placement evidence; it does not infer delivery from placement alone.

Full rations remained active. The closely spaced granary captures show **40 total food / 1 type** at step 37952, then **39 / 2 types** at 38208, and **38 / 2 types** at 39232. Consumption overlaps delivery, so this is evidence of cheese arriving and entering consumption, **not a net total-food increase**. The exact number of cheese units delivered was not measured. No save/reload persistence, sustainable food balance, FPS, audio, battle completion or multiplayer claim is made.

Evidence: `scratch/runs/20261104-stronghold-browser-food/`. Read baselines: `stronghold-browser-village-20261104.md` (published `296b1173c5769b5e27932a8adb399c456cfb2df2`) and `stronghold-crusader-demo.md`; neither was edited. No production source, guest memory, configuration, executable, media or game checks were patched. No code repair or production rebuild was needed.

## Ordinary route and inspected evidence

There was no actual saved game found in the reused staging (`native-save-search.json`); the predecessor had closed Chrome. A filesystem snapshot was not treated as a gameplay save. This was one fresh ordinary browser route: registered `stronghold_crusader_demo` selector and Launch → original title → Crusader → **right-hand towers** → scenario **1** → Zephyr Very Easy, Normal Game/Human Advantage against The Rat. The character-picker checkmark closed the picker that appeared during the held scenario selection. No predecessor hovel/woodcutter construction was repeated.

The original farm menu exposes **Dairy Farm, 10 wood**. Food Processing exposes **Granary, 5 wood**. The selected chain was dairy → cheese → granary. Native construction controls and the existing minimap were used; a held right-click returns from building panels to construction controls. The dairy panel replaces the minimap with its workshop illustration, so one attempted map click there did not pan; the ordinary right-click restored the real minimap.

All images named below are in `recovered/browser/`, with paired state JSON and screenshot hashes:

- `farm-menu.png`, `apple-tooltip.png`: original farm menu and actual **Dairy Farm 10 (100)** label. The exploratory filename “apple-tooltip” is a helper label, not evidence that an orchard was available. Other greyed menu slots were not used.
- `dairy-preview.png`, `food-processing.png`: a translucent dairy preview on scrub near the keep did **not** remain after category switch. Wood was not debited for this attempt. This terrain-placement dependency was overcome using ordinary camera movement; it was not diagnosed as an emulator defect.
- `granary-preview.png`, `granary-baseline.png`: placed granary beside the keep; its native panel initially shows **59 food, 36 months, 1 food type eaten**. Its five-wood debit leaves 95 available.
- `dairy-green-preview.png`: minimap position approximately **(650,816)** reaches a broad green riverbank; the solid dairy preview at browser **(680,520)** is usable. Earlier scrub and dense riverbank previews are retained. `dairy-green-persistent.png` and `dairy-early.png` show the farm remaining after switching to Castle Buildings and moving the pointer away.
- `dairy-panel.png` (27200): **Going to workplace**. `dairy-worker1.png` (29248): **Waiting**. `dairy-worker2.png` (31296): two visible cows. `dairy-worker3.png` (33344): three cows and **Working**. `dairy-worker4.png` (35392): **Going to store**. `return-granary.png` (35904): **Taking Cheese to store**.
- `granary-pre-delivery.png` (37952): **40 food, 1 type**. Despite its helper filename, `granary-cheese-before.png` (38208) already shows the **post-delivery** state: **39 food, 2 types eaten +1**, and the added yellow cheese stack. `granary-delivery1.png` (39232) and `food-delivered-final.png` (39488) retain the two-type state and show **38 food**. These captures were personally inspected.

## Exact source, media, modules and backend

The assigned box's existing staging was reused unchanged: `/home/user/stronghold-registered-skirmish-runtime`. Runtime source is **`1188e9bf57ef35bd3363fb88b7ca0da442ce696d`**, not concurrent shared-tree WIP. `runtime-pins.json` preserves all **2,415** input identities; every pin remained unchanged and all 1,078 served-file receipts matched. `relevant-source.patch` is empty because the runtime source was unchanged. Git is the source archive; no source/media archive was created. Small run helpers and their hashes are recovered separately.

The existing 1,856-file installed inventory remains `scratch/runs/20261103-stronghold-crusader-original/installed-pin.json`. The original EXE path remains `test/binaries/candidates/stronghold-crusader-demo/installed/App_Executables/Stronghold Crusader multiplayer demo.exe`, SHA-256 **`9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f`**. The 1,853-companion manifest remains SHA-256 **`d51be8d9ab1038b7dc2b3242f3a4ebed382f1fbf33d558211a80bd36ab112b21`**. Media was referenced in place, not recopied.

| Recovered actual module | Bytes | SHA-256 |
| --- | ---: | --- |
| Canonical, actually compiled/instantiated | 2,143,540 | `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee` |
| Compatibility, retained but not selected | 2,146,153 | `580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3` |

Both are recovered in `recovered-modules/` and full-SHA verified. The page observer links canonical compilation, instantiation and module transfer to guest Worker slot 0; the Worker observer confirms receipt/instantiation. The observed backend is **guest Workers with Canvas 2D/DirectDraw presentation**. No page or Worker WebGL context was observed; the WebGL toolbar selection does not establish an accelerated rendering backend. Chrome 151.0.7922.108, Node 24.22.1, cross-origin isolation, 1200×900 viewport, original 800×600 game canvas, local `index.html?debug&candidates&frozen`.

The run-only diagnostic uses **`defaultViewport: null`**, corrected before its first attachment. Its final read-only attachment retained the 1200×900 viewport, empty input queue and zero held-button mask. No viewport repair or guest restart occurred.

## Validation, recovery and handoff

`verify.py` passes **786 sequential completed requests**, including **617 step requests**, maximum **64 batches each**, exactly **39,488** total steps, **111 ordinary input commands**, balanced releases and no pending request. The observer records **68 trusted mouse/key events**, all trusted. Screenshot hashes, canonical page/Worker linkage, input pins, HTTP receipts and ordinary close pass. The frozen channel only advances existing diagnostic steps; controls use trusted browser input.

`recover.py` recovered **2,436 files including both modules**, all verified by full SHA-256. This includes unique controls, logs, states and captures; the Chrome profile was excluded. `node test/test-app-files-policy.js` passed. No code changed, so no full build was required. `ops/check-run-evidence.js` reports are retained; this app has no candidate-manifest entry, so this remains investigation evidence rather than attachment to an unrelated candidate. Two local inspection-helper errors (missing Pillow for an optional crop; an image read before its transfer finished) did not alter or restart the game; the original full captures were inspected instead.

Prepared **`bx_6j758ddr`** was verified healthy **RUNNING/API-idle** and ACKed on the board before use. Expiry **2026-11-04T02:46:52.316Z**, shutdown owner **coordinator**. Browser interval **02:08:47.219–02:23:30.903Z**, **883.684 seconds**, below the 20-minute bound. Normal `browser.close()` exited Chrome PID 23653 with code 0; driver PID 23614 was absent and loopback port 38967 closed. Recovery completed before 02:25Z, ahead of the 02:35Z deadline. The box was handed back **RUNNING/API-idle**; this worker did not stop, delete, resume or allocate a box.

The bounded food-delivery task is complete. A later task could measure sustained food balance or make and reload an actual native save; neither is established here.
