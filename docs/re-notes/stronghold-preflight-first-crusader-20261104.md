# Preflight-first Stronghold reaches ChooseType; first route move rejects

The fresh original run completed the corrected preflight **before its sole Chrome launch**, passed the qualified game-crop freshness guard across a taskbar minute change, and delivered the balanced native **(304,144)** Crusader activation. It reached a drained, strictly recognized **ChooseType at step 14720**. I personally reviewed the fresh PNG showing “Choose type of Crusader game”, the map on the left and two towers on the right. Its full SHA-256 is **104433c048c51ad6a9ce7db28dcde5413d6c43b90d8028c0d6629b90a047ec4a**.

The first `route-next` then rejected **`foreign or stale input`** after its mouse move, before any route press or additional guest ACK. The exact original route remains at ChooseType. Zephyr, native Start, world entry and ordinary gameplay were not executed or proved. Browser work stopped at that first runtime failure; there was no retry or reload.

Evidence and recovery helpers: `scratch/runs/20261104-stronghold-preflight-first-crusader/`. Preparation Git SHA is `exact-git-sha.txt`; the retained source commit is **1188e9bf57ef35bd3363fb88b7ca0da442ce696d**. The executed crop driver/menu/presentation were copied unchanged from the qualified predecessor at published **b5a55fb55b22063aab61eb1698d5fa344c9e7a89**, itself using the **d1e2b122ab630357ec1e5e350aedc3922cadc66b** crop driver. Predecessor files were read-only. Only this note is committed; run-owned helpers and tests are recovered through `owned-new-helpers.patch`. No production file changed and no production-code build gate applies.

## Complete preflight before launch

The fresh release uses the exact authorization `stronghold-game-crop-freshness user task`, `shutdownOwner: coordinator`, assigned **bx_pu5e3qkn**, expiry **2026-11-04T08:39:09.954Z**, and fresh `closeBy: 2026-11-04T08:25:00.000Z`. Stage and launch paths use this run's namespace beneath `/home/user/stronghold-corrected-native-start-runtime`.

`launch.py` invokes the copied corrected `preflight.py` using `subprocess.run(..., check=True)` before its sole detached driver launch. It queues no observation. Five offline sequencing checks passed before launch. The run-owned preflight also verifies every retained source/module/media pin before staging the small byte-identical cache validator. Actual results:

- All **2415 retained pins** matched; own staged helper/release SHA checks and the actual helper dependency graph passed.
- The staged `cache-check.cjs` validated the **actual retained** cache graph: **98 page scripts / 12 worker scripts**. The predecessor's local 13-worker result described its local graph; this fresh result is the retained runtime's graph.
- Actual Puppeteer CJS and dynamic ESM imports passed, as did helper imports and browser-driver syntax.
- Five pinned HTTP responses passed SHA and COOP/COEP isolation checks.

The complete remote preflight finished **08:10:51.564Z**; driver launch followed at **08:10:51.632Z**. Chrome identity was recorded **08:11:09.550Z**. The first observation was issued only after actual `ready.json` was confirmed. No missing cache checker was probed after Chrome.

Before Chrome, the actual mailbox/DOM crop tests passed **111 checks / 25 modes**, title transport **20 checks**, route DOM **eight negatives**, and the unchanged native Start suite passed. ACKs and scene transitions in these offline suites are modeled; they are not gameplay evidence.

## Actual recognized sequence and first failure

Personally reviewed startup captures at 2048, 4096, 6144, 8192 and 10240 showed loading artwork/dialogs. Step 12288 showed Gathering of Developers. Step **14336** showed the original Enter Your Title / Lord Crusader / Start Game dialog. Loading took more frozen steps than the predecessor; no historical startup checkpoint was substituted for a fresh capture.

The guarded title Enter pair completed and drained with **192 steps**, reaching the personally reviewed main menu at **14528**. The qualified Crusader move completed at **14592**. I reviewed its axe hover and skirmish description. The recapture crossed the taskbar minute change: **53 full-image pixels changed and zero game-crop pixels changed**. `actual-hover-diff.json` verifies the recovered pair; the unchanged qualified identity accepted it. Balanced down/up then reached ChooseType at **14720**, with complete ACKs and drained input. The route installation separately recognized and reviewed ChooseType.

The first route move projected native **(543,292)** to CSS **(594.2625,519.65)**. Actual `transport-events.jsonl` records its queued WM_MOUSEMOVE as native **(543,291)**, `lParam: 19071519`, HWND **65537**, mask zero, with null active/last input and that single pending queue entry. The strict route telemetry rejected this mismatch immediately. There was no route down/up, execution/drain of that move, or attempt to change its expected native coordinate. Only orderly quit followed. Final state retains that unconsumed move; the final screenshot is the previously reviewed ChooseType checkpoint, not a drained post-route checkpoint.

## Offline correction and reproducible limits

The run-owned `integer-route-point.cjs` finds an **integer CSS event location** that preserves the requested native pixel through both production coordinate floors, rejecting when no candidate is available. The owned copy of `route-driver.cjs` retains the existing route plan/projection check, exact event telemetry, queue ownership, per-event ACK/drain, recognizers, full-image route freshness and cleanup. It uses the integer point only for physical transport. At the demonstrated boundary it selects **(594,520)**, which maps exactly to native **(543,292)**. The native Start helper and its installed guard are unchanged.

`integer-route-point.test.cjs` uses the actual captured geometry and real production mapping. Modeled client-coordinate truncation reproduces the old native543291 move and rejection before any ACK. The corrected helper completes the existing modeled right-towers and preset route and Zephyr handoff with zero native Start executions. This establishes an offline correction for the demonstrated mismatch; it does **not** prove the browser's precise event quantization mechanism, nor any corrected live route.

The corrected route passes all eight existing negative cases. `successor-driver.cjs` is an offline candidate using the owned corrected route helper; `actual-successor.test.cjs` passes the same **111 checks / 25 modes**. The executed `browser-driver.cjs` is preserved unchanged. Reproduce:

```sh
python3 scratch/runs/20261104-stronghold-preflight-first-crusader/launch.test.py
node scratch/runs/20261104-stronghold-preflight-first-crusader/integer-route-point.test.cjs
node scratch/runs/20261104-stronghold-preflight-first-crusader/route-dom.test.cjs
node scratch/runs/20261104-stronghold-preflight-first-crusader/actual-successor.test.cjs
```

A separately authorized fresh run must copy the corrected candidate and its two owned route dependencies into a new namespace, stage/hash their actual graph, update its complete preflight imports to check that graph, obtain a fresh bounded release and use the preflight-first launcher. This used namespace/browser evidence cannot be reused. Retain existing source/module/media by path and SHA; no source archive or repeated media/module copy is required. Preserve strict ChooseType, native543292, native67491 preset, routeDispatch's boundary queue, strict Zephyr and unchanged native718569 Start.

## Closed evidence and handoff

Verification confirms **230 complete ACKs / 14720 steps**, **1032 matching served-pin receipts**, one balanced Crusader mouse press/release, its preceding move, and the sole rejected route move. The title DOM key pair is separately recorded in title evidence. All **300 closed logical files / 16133716 bytes** were recovered and full-SHA verified before **08:17Z**, well before the 08:30 recovery deadline. The recovery map reuses identical already recovered review PNGs; it does not duplicate them.

Chrome **15746** exited normally at **08:16:31.887Z**, exit zero. Driver **15470** is absent, private HTTP **38241** is closed, and all **2415 retained pins** still match. Assigned **bx_pu5e3qkn remains RUNNING / API-idle**, healthy/hydrated, expiry **2026-11-04T08:39:09.954Z**. Runtime custody returns to the coordinator, who owns shutdown. No allocation/resume/stop, source-box access, second browser, forced scene, guest call/write, local heavy/browser run, subworker, successor launch, Heroes II or deployment occurred.

Git SHA, relevant binary diff, small owned new-file patches, dependency hashes and the final artifact manifest preserve recovery without a source snapshot. The completed result is live qualified Crusader/ChooseType plus a tested offline route transport correction. Original world/gameplay remains unobserved. This single-task worker publishes this note and stops.
