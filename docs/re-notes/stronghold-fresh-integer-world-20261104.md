# Corrected Stronghold move reaches native543292; strict hover blocks press

Original world/gameplay remains **unobserved**. This fresh run executed the corrected integer CSS move **(594,520)** and observed exactly the required queued native **(543,292)**, HWND 65537, WM_MOUSEMOVE 512, mask zero. Its complete 64-step ACK drained input at **step 10624**. The next capture failed the unchanged strict ChooseType recognizer, producing **`route changed before press` at 08:43:40.542Z**. No route press, preset, Zephyr, native Start, world or gameplay action followed. Chrome was closed normally; there was no retry or reload.

## Fresh preparation and preflight

Own namespace: `scratch/runs/20261104-stronghold-fresh-integer-world/`. Read predecessors [corrected preparation](stronghold-integer-route-native-20261104.md), published `7cc7c5767`, and [first native route failure](stronghold-preflight-first-crusader-20261104.md), published `bd7a87370`.

Copied only seven small runtime inputs: tested `successor-driver.cjs`, `route-driver.cjs`, `integer-route-point.cjs`, `menu-driver.cjs`, `presentation.cjs`, `cache-check.cjs`, and a new `runtime-release.json`. Other prerequisites remain referenced by retained path and SHA. Driver/route/integer helpers are byte-identical to the prepared predecessor. Expected native coordinates, strict recognizers, queue ownership, telemetry, ACK/drain, freshness and native Start guard were unchanged.

The new release records exact authorization `stronghold-game-crop-freshness user task`, assigned **bx_v34fdr58**, expiry **2026-11-04T09:18:46.794Z**, hard close **09:08Z**, recovery **09:13Z**, and `shutdownOwner: coordinator`. The launcher checks finite TTL/deadlines after the complete `preflight.py` subprocess with **check=True**, before detached execution. Driver entry retained its ten-minute TTL guard and 15-minute maximum Chrome duration. No old execution namespace or release was reused.

Before Chrome, the integer mapping regression, eight route negatives, actual successor **111 checks / 25 modes**, and five launch sequencing tests passed. ACKs/scenes in those suites are modeled. They were also rerun into own test logs after recovery. Full actual preflight passed at **08:40:46.773Z**:

- All **2415 historical pins**, source commit `1188e9bf57ef35bd3363fb88b7ca0da442ce696d`, matched.
- Own staged hashes and the actual corrected helper dependency graph matched.
- Actual Puppeteer CJS/dynamic ESM imports, helper imports and driver syntax passed.
- Actual cache graph passed: **98 page scripts / 12 worker scripts**.
- Five pinned HTTP responses passed SHA and COOP/COEP checks; the temporary preflight server closed.

Detached driver execution started **08:40:46.842Z**; only after actual `ready.json` was verified was the first observation queued. The small local operator was adapted to this namespace before launch. No staging/import defect was probed after opening Chrome.

## Personally reviewed actual route

Bounded observations at steps 2048, 4096 and 6144 showed original loading artwork/dialogs; step 8192 showed Firefly. At **10240**, I personally viewed the original Enter Your Title / Lord Crusader / Start Game dialog. Guarded balanced Enter completed and drained in 128 steps to the original main menu at **10368**. I reviewed its fresh capture and then the qualified Crusader hover at **10432**, showing the axe and skirmish description. Balanced native **304144** down/up reached ChooseType at **10560**.

The fresh route installation PNG **35ae1b677fa51a8b41f57623ef756120e48d78c9b7409763d084256dd25e46ee** showed “Choose type of Crusader game”, map left, towers right. I personally reviewed it. Initial route capture and pre-move recaptures matched that SHA and strict scene. The corrected physical move then queued **543292**, `lParam: 19137055`, with no foreign or stale event. One complete 64-step ACK consumed and drained it.

The post-move PNG **465c6a1aba5c3d44fd07e96759ecf11536a38fe6cf2b0a4e4a3d193d89818b25** was personally reviewed **offline after Chrome closed**. It visibly shows the same ChooseType dialog with “Custom Game / Customize your own Crusader game” hover text. This visual observation does not override the strict recognizer: it returns **unknown**. The first failure remained terminal before any route down/up.

## Offline diagnosis and limits

`offline-hover-analysis.json` compares the actual recovered pre/post-move PNGs. The title patch `[235,340,420,35]` remains the expected `1d414967…`. The tower/soldier patch `[460,420,260,180]` changes from expected **4e317df09785fd63a974c53dbf1576bf00d7dc3ed77f6b4017f8acd62aa2d439** to **2e27b9d86199d4556237dc6ecb371ac4b644b33bba03b862bad76e369de47e4f**. Across the game area 38135 pixels differ, bounding box x247–722 / y421–703. This is game content, not a taskbar-only freshness change. The changed image patch explains the strict recognition failure; the exact animation/rendering cause is not established here.

`actual-hover-boundary.test.cjs` replays those exact captured PNGs through the unchanged corrected route driver and production DOM/renderer/host fixture. It verifies one native543292 move, one modeled complete ACK, drained input, `route changed before press`, zero route presses and terminal rejection of a retry. Unknown remains unknown. No permissive signature, guard bypass or live correction was introduced. Further progress requires qualification of the actual hover boundary while preserving strict initial ChooseType and pre-press review/freshness/telemetry checks; this task's required unchanged recognizers do not admit that new image.

Reproduce offline:

```sh
node scratch/runs/20261104-stronghold-fresh-integer-world/actual-hover-boundary.test.cjs
node scratch/runs/20261104-stronghold-fresh-integer-world/offline-hover-analysis.cjs
python3 scratch/runs/20261104-stronghold-fresh-integer-world/check-evidence.py
python3 scratch/runs/20261104-stronghold-fresh-integer-world/launch.test.py
node scratch/runs/20261104-stronghold-fresh-integer-world/integer-route-point.test.cjs
node scratch/runs/20261104-stronghold-fresh-integer-world/route-dom.test.cjs
node scratch/runs/20261104-stronghold-fresh-integer-world/actual-successor.test.cjs
```

## Closed recovery and handoff

Evidence verification passed **166 complete ACKs / 10624 steps**, **1032 matching served-pin receipts**, balanced Crusader input, and the sole corrected route move. Final input queue, active/last input and mask are empty/zero. **228 closed logical files / 14475853 bytes** were recovered and full-SHA verified by **08:44Z**, before the 09:13 deadline; identical reviewed PNGs are referenced rather than downloaded twice.

Chrome **11746** exited normally, code zero, at **08:43:52.995Z**. Driver **11730** is absent, private HTTP **43691** is closed, and all 2415 historical pins still match. Assigned **bx_v34fdr58 is left RUNNING / API-idle**, healthy/hydrated at the final info check, expiry **09:18:46.794Z**. Custody returns to the coordinator, who owns shutdown. No lifecycle/source-box action, allocation, local browser/heavy run, second browser, forced guest operation, subworker/successor worker, Heroes II or public deployment occurred.

`exact-git-sha.txt` records preparation Git SHA; relevant tracked uncommitted hunks are in `relevant-uncommitted.patch`; own small helpers/tests/control scripts and this note are preserved as new-file patches. `artifact-manifest.json` seals closed own evidence. Git is the source archive: no source-tree archive or repeated module/media evidence copy was created. Only this note is committed; production code is unchanged, so no production build gate applies.

Next: offline strict qualification of this actual ChooseType hover boundary, followed only under separate authorization by a fresh namespace and preflight-first single-browser route. Preset67491, strict Zephyr, route handoff and unchanged nativeStart718569 remain unexecuted in this run.
