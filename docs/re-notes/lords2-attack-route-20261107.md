# Lords II: sustainable force reaches the battle decision

The unchanged installed demo reached **“A Battle is to be fought”** in Ambleshire, Winter 1271. The inspected decision screen lists Player1's **13 peasants, 50 swordsmen, 50 pikemen and 50 archers**, versus **319 peasants**. This verifies an ordinary battle encounter beyond movement and the envoy. **Tactical combat, battle resolution and conquest remain unverified. No emulator discrepancy was demonstrated or emulator implementation changed.**

Evidence: `scratch/runs/20261107-lords2-attack-route/`. Command 78 (`invader-select.png`) has a completed receipt and matching read-only state. Command 79 clicked the visible left “take the field” gauntlet. Its log records the balanced click and the following 3000 ms wait, but the bounded harness deadline fired before the remaining wait, capture and terminal receipt. Its result is **UNKNOWN**, it was never replayed, and no second original run was launched. Chrome exited normally, code 0, signal null, at **2026-11-07T06:11:13.979Z**. The next ordinary prerequisite is to choose and verify “take the field” on that battle decision, then inspect the tactical controls; the absent command-79 outcome prevents claiming tactical gameplay.

## Queue and lifecycle preflight

The predecessor consumer loop was `seq < 48`; its command publisher separately required `seq < 80`. Only this run's retained helpers were changed to **240** in both places. The 1,200,000 ms queue deadline, 16-step limit, coordinate/key/text restrictions, fresh capture-path checks, total wait bounds, and bounded Chrome close remain intact. No production source guard was removed or changed. The 1260-second external deadline helper was inspected; it checks terminal status before attempting ordinary quit. The original run ended through the inner deadline, not command capacity.

Before allocating the original box, a cheap generated rendered button exercised the exact extracted run-local queue generator, validator and close function. Commands 0–51 used trusted clicks and matched their count state individually; command 48's personally opened PNG displays 49. Deliberate quit 52 wrote its terminal receipt and Chrome exited 0 without a signal. `queue-regression.cjs` rejects a restored 48-command consumer (48 yields and count-limit error), while the current consumer completes 52 steps and quit. The production validator's positive/negative controls also passed. Actual local and remote smoke versions: **Chrome 151.0.7922.108, Puppeteer 25.7.0**; remote Node **v24.22.1**. The real original subsequently completed commands 48 through 78 with matching states and inspected captures.

A provisioning attempt initially tried Git recovery for four changed run-local helpers because their old hashes were retained. Those local lookups failed before upload; no access/risk refusal occurred. A read-only remote inventory identified exactly four missing/mismatched helper files, their run-local identities were corrected, and only those four were uploaded. Full 638-pin preflight then passed. No runtime source tree/archive was staged locally.

## Ordinary route and sustainable recruitment

Installation used the normal Sierra installer, default `C:\SIERRA\L2Demo`, and the real installed desktop shortcut. Introductory Player1 versus the Knight was retained. Every input was followed by a terminal receipt, personally opened capture and matching state before the next gameplay input, except the explicitly unresolved final command 79. Command 33's capture and terminal receipt completed, but its first read-only snapshot timed out; a separate bounded read-only snapshot recovered matching running state before command 34. Nothing was replayed.

Gametips recommends roughly 150 men after growing toward 700 people. The run used normal seasons, zero tax, normal rations and farming allocation to grow from **172 people / happiness 56** in Winter 1268. A normal plague event interrupted growth in Winter 1269; it was dismissed and the population recovered. An early draft preview at population 382 showed an unacceptable happiness drop and was cancelled without creating an army. Adjacent fallow fields were inspected and converted to cattle through the real field menu. At population **494 / happiness 100** in Autumn 1270, a **163-person draft** left **331 civilians / happiness 63**. All 150 available weapons were assigned through their weapon panels; 13 peasants remained. After creation the cattle forecast was **+7**, and after the next season it was **+22** with **343 civilians / happiness 69** and a normal cow-birth event. This supplies observed food and happiness support for the force; it does not assume that the earlier 51-man army could conquer.

| Command / capture | Inspected result |
| --- | --- |
| 48 `second-cattle-field.png` | Original command beyond old queue cutoff, matching state. |
| 53 `draft-force.png` | 163 recruits, 331 civilians, happiness 63 preview. |
| 56 / 59 / 62 | Weapon panels confirm 50 swordsmen / pikemen / archers. |
| 64 `army-created.png` | Army created; county happiness 63 and cattle +7. |
| 67 `north-road-preview.png` | Numbered route along northern road. |
| 68 `march-north.png` | Army moved to upper road. |
| separate `north-map.png` | Bounded trusted top-edge hover reveals immediate northern town and boundary. |
| 70 `gold-town-preview.png` | Gold target over town; remaining numbered markers end before it. |
| 71 `north-town-order.png` | Army moves to boundary; no battle claim. |
| 72–74 | End Turn, transition settles, Winter 1271 cow event dismissed. |
| 76 `winter-attack-order.png` | Ordinary gold-target order crosses county; Ambleshire envoy warning. |
| 77 `envoy-dismiss.png` | Warning dismissed, army inside county. |
| 78 `invader-select.png` | Battle decision: player 163 mixed troops versus 319 peasants. |
| 79, no capture/receipt | “Take the field” click logged; deadline during wait; outcome UNKNOWN. |

## Exact runtime and limits

Fresh UUID Idempotency-Key box **bx_ddx3nv2j**, created **05:49:38.749Z**, original expiry **07:19:38.606Z**. One heavy original runtime only. Exact runtime recovery is predecessor Git **2472ef81ac266b5a500153998577c266473286cc**, retained relevant tracked diff and untracked `lib/wininit-boot.js` patch, plus this run's `runtime-pins.json` and `harness-only.patch`. All **638 pins**, including **181 original media files**, passed before launch. Media is referenced at existing paths and SHA-256, not copied into run evidence. Exact standard WASM **e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467**, compatibility **04acbb89f66ad9814836b5e2c34de659b518f4e1994f50c4ee8069c991f02f72**; modules remain recoverable from `20261107-lords2-winexec-search/tested-standard.wasm` and `tested-compat.wasm`. This is the pinned predecessor runtime, not concurrent main's build.

Presentation was ordinary production browser presentation, 1000×800, `?debug&no-threads`, cooperative execution. Actual served response hashes and instantiated module/installed EXE/DLL identities are retained. No guest edits, forced state, configuration/assets substitution, unknown input replay, archive or nested worker was used. Selective observers are not a complete CPU/API trace. Audio and whole-game behavior are unverified. Documentation-only publication requires no emulator regression or locked build; the run-local queue smoke and rejecting regression cover the demonstrated harness capacity error.

Evidence validation checked **275 retrieved files** by size/SHA-256 and **70 installed-game snapshots** for unchanged EXE/DLL identities, the actual pinned instantiated WASM, running true, stopped false and no recorded far fault. All 638 dependency pins and 181 media files passed again after execution. The complete original/gameplay evidence was retrieved before the delegated stop. Harness 6778, server 6777, guard 6779 and Chrome 6799 were absent; ports 36939/40087 closed, owned profile processes absent and `/tmp/wine-assembly-input-s8hDnQ` removed. Box **bx_ddx3nv2j archived at 06:13:45.807Z**, stop completed **forced:false**, no active expiry. Local watcher absent and free `/home` restored above 2 GB after a recorded shared-disk transient dip; no unique evidence was deleted. No runtime remains to hand back.
