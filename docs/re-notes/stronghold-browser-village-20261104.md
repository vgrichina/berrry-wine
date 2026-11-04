# Stronghold Crusader UK v1.1 — browser village control

Reviewed ordinary browser gameplay now places both a **Hovel and Woodcutter** in the offline **Zephyr — Very Easy (1/10)** skirmish. Both remain after switching construction categories and moving the pointer away. Population/housing changes from **3/10** on village entry to **18/18**; the Woodcutter costs three wood and the displayed available wood falls from **94 to 91**. These are browser captures, separate from the accepted CLI first-hovel evidence. Persistence means continued presence in this running village; save/reload persistence and harvested-wood delivery were not tested.

Evidence is `scratch/runs/20261104-stronghold-browser-village/`. The baseline game note `stronghold-crusader-demo.md` was read without modification. No production source or guest files were changed, and no causal production repair was needed. No campaign, battle completion, multiplayer, FPS, audio or corpus-wide result is claimed.

## Exact inputs and browser/backend

Browser source is committed main `1188e9bf57ef35bd3363fb88b7ca0da442ce696d`, staged as individual Git blobs into the authorized fresh snapshot-derived runtime. `runtime-pins.json` records source blob IDs/full SHA-256 and media/module identities; `relevant-source.patch` records the binary working diff against that source (empty). Foreign shared-tree WIP was excluded. Git is the source archive; no source tree, scratch/docs tree or game media was archived into evidence.

The original executable remains `test/binaries/candidates/stronghold-crusader-demo/installed/App_Executables/Stronghold Crusader multiplayer demo.exe`, SHA-256 **`9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f`**. The accepted inventory of 1,856 original installed files and their existing paths/full hashes is retained in `scratch/runs/20261103-stronghold-crusader-original/installed-pin.json`. The browser loads the EXE plus 1,853 companion entries from the existing manifest, SHA-256 `d51be8d9ab1038b7dc2b3242f3a4ebed382f1fbf33d558211a80bd36ab112b21`; the optional GameSpy/hardware-checker executables are excluded as before. Original adjacent Miles/Bink DLLs load. All sealed runtime inputs remained unchanged, and every served-file receipt matched its pin.

| Preserved actual runtime module | Bytes | SHA-256 |
| --- | ---: | --- |
| Canonical, selected/compiled/instantiated | 2,143,540 | `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee` |
| Compatibility, retained but not selected | 2,146,153 | `580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3` |

Both modules were recovered from this box into `recovered-modules/` and verified by full SHA-256. They reuse the accepted built modules; this documentation-only task did not rebuild. The page observer links canonical compilation, instantiation and transfer to guest Worker slot 0; the preloaded Worker observer records receipt and instantiation. Chrome **151.0.7922.108**, Node **24.22.1**, cross-origin isolation, ordinary registered selector `stronghold_crusader_demo` and the actual Launch button were used at a 1200×900 viewport. URL: local `index.html?debug&candidates&frozen`. The game window is 800×600, nearest-fit presented in the browser.

The actual backend is **guest Workers with Canvas 2D/DirectDraw presentation**. Workers increase during menus and return to four in gameplay. The toolbar's GPU selector says WebGL, but no page/Worker WebGL context was observed; it does not establish accelerated Stronghold rendering. This differs from the accepted cooperative CLI execution. Ordinary trusted browser mouse/key events feed the production input path; frozen steps use the existing diagnostic control without guest-state edits.

## Reviewed route and captures

All named images below are under `recovered/browser/`, with paired state JSON and screenshot SHA-256:

1. `selector-before-launch.png`, `startup320.png`, `load7248.png`: registered picker/Launch, original loading art, then original title prompt. `crusader-menu.png` shows **Demo V1.1**.
2. `choose-type-again.png`, `custom-skirmish.png`, `zephyr-ready.png`: Crusader → **right-hand towers** → numbered scenario 1 → Zephyr Very Easy, Normal Game/Human Advantage against The Rat. In this browser execution the left-hand map opens the unavailable trail; that exploratory screen and return are preserved. This corrects the prior note's written left/right route for this execution, without editing the baseline note. An extra held press opened the ordinary character picker; its checkmark closed it before starting.
3. `village-entry.png`: initial keep, construction controls and **3/10** population/housing. Town Buildings → Hovel → ordinary preview beside the keep: `hovel-preview.png`, six-wood cost, 100 available. `industry-menu.png` shows the placed hovel remaining after category switch, **16/18** housing, and live villagers.
4. The first Industry icon is Stockpile; it did not select a Woodcutter. The **second icon** selects Woodcutter: `industry-second-preview.png` shows its ordinary preview near the trees, **3 (94)** wood. Place it, switch to Castle Buildings and move the pointer away: `village-persistent.png` shows the hovel, Woodcutter and **18/18** housing together.
5. Reselect the Woodcutter tool without another world placement: `wood-remaining91.png` shows **3 (91)**, the three-wood debit. Return to Castle Buildings and move away: `final-village.png`, frozen step **20000**, shows both persistent buildings, no placement preview, and **18/18** population/housing.

The notebook contains **435 sequential completed requests**, including **317 step requests**, maximum **64 batches per request**, exactly **20000** steps and **77** ordinary input commands. All held keys/buttons balance; no request remains pending. `verification.json` checks the receipts, screenshot hashes, module/Worker linkage, matching HTTP inputs and orderly close. It does not infer gameplay success from those checks; the screenshots above were personally inspected.

## Preserved helper failures and lifecycle

The first preparation helper referenced the accepted input manifest at the wrong local path; `prepare.log` preserves that FileNotFoundError, and `prepare-2.log` records the corrected staging. This did not launch a guest.

A run-only Puppeteer diagnostic connection initially used its default viewport, temporarily resizing the live page to 800×600. The first Start click therefore mapped to guest (781,481), rather than the intended approximately (400,274). `main-menu.json` and the timestamped diagnostics preserve the mismatch. `diagnose-viewport-fault.cjs` retains the faulty helper; the corrected connection uses `defaultViewport: null`, and `--restore-viewport` restored 1200×900. `restored-title.png` and `title-started.json` record the corrected browser click. The same game continued; there was no guest patch, relaunch or production-input repair. Short presses sometimes produced hover without selection; longer held browser presses and reviewed outcomes were used, with all releases retained.

Fresh box **`bx_6j758ddr`**, derived with `boat new --from stronghold-first-hovel-20261104 --ttl 3600`, was recorded before use. Expiry **2026-11-04T02:46:52.316Z**, shutdown owner **coordinator**. Browser runtime was **01:48:17.963–01:59:41.247Z**, **683.284 seconds**, below the 25-minute bound with recovery reserve intact. Chrome PID 8177 exited normally with code 0; browser/helpers closed and the loopback server closed before recovery. No stop/delete/resume was performed. The box was handed back **RUNNING/idle** for coordinator snapshot/shutdown.

`remote-recovery-manifest.json` and `local-recovery-verified.json` verify **1,370 recovered files including both modules**, with full hashes, original inputs unchanged and Chrome absent. `recovered/` contains unique controls, states, served-file receipts, logs and captures; media stays at the original installed paths. The Chrome profile was excluded. Focused checks: `verify.py` and `node test/test-app-files-policy.js` passed. No code changed, so no new production build/regression was required. The next useful bounded task is ordinary browser food production or save/reload persistence; neither is claimed here.

The evidence checker reports no containment or missing-artifact problem for this run. Stronghold has no candidate-manifest row, so this remains investigation evidence under its registered app ID; the checker explicitly flags missing `candidateId`. Its global failure also includes pre-existing foreign evidence problems, recorded without modifying those runs.
