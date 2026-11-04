# Stronghold corrected native start: integrated; menu route stopped

The corrected scenario guard from `6004e338eeecbdac153284cd363d499843bc68a4` is integrated into the immutable driver from `eef09d6881329f916577eb6ac78e93e36f398d6d`. The single browser attempt stopped at an earlier menu dependency: pressing **Custom Scenarios** left the main menu visible with input fully drained. **The scenario Start gesture was never attempted. World entry, recruitment and combat were not reached.**

Evidence: `scratch/runs/20261104-stronghold-corrected-native-start/`. The small run-only `browser-driver.cjs`, `integration.test.cjs`, `navigation-plan.cjs` and `navigation-plan.test.cjs` are committed alongside this note. Remaining helper recovery is recorded in `owned-new-helpers.patch`; dependencies are the unchanged durable [native-start guard](stronghold-native-start-boundary-20261104.cjs) and [immutable boundary](stronghold-stable-recovery-combat-20261104.cjs), staged as `native-start-boundary.cjs` and `evidence-boundary.cjs`. No production file changed or production defect was established; no full build was required.

## Integrated boundary and its limits

`install-native` installs `NativeStartDriver` and `guardNativeCommands` inside the existing `EvidenceBoundary` command queue. `native-start` returns its result in the final command receipt. Startup geometry, exact scenario/world pixel checks, guest `(718,569)` projection, per-guest step ACKs, one activation, input drainage and terminal failure remain unchanged. The helper is copied exactly, rather than weakening its predicates.

Personal review writes a pending request and waits for a separate operator acknowledgement containing the exact PNG SHA-256, scene, explicit `personallyViewed:true` and a written observation. It never echoes a request automatically. Fresh capture review precedes activation; the original guard recaptures to reject stale review. No such request was reached in this browser because the run stopped before installing the scenario guard.

After installation, individual raw key/mouse commands are rejected. A queued ordinary `gesture` first requires the guarded world capture, awaits separate personal review and recaptures before balanced movement/press/release. It checks complete ACKs while draining each phase under a finite execution budget. It preserves the original exact world recognizer; no later scene generalization was made. These paths have offline integration coverage, but **were not exercised in this browser**. Positive ordinary gameplay remains unproven.

## First unexpected menu state

I personally reviewed fresh `review/startup2048.png`, `loaded6144.png`, `title.png`, `main-menu.png` and `custom-menu.png` before dependent navigation. Startup showed loading artwork, then the Firefly splash. Escape opened the title dialogue, and Start Game opened the original Demo V1.1 main menu.

I then followed the predecessor's misleading `custom-menu` name and pressed **Custom Scenarios** at browser `(361,658)`. The deciding picture remained the main menu. At step **7936**, `first-unexpected-state.json` proves `inputQueue:[]`, `activeInput:null`, `lastInput:null`, mouse mask zero, and the visible original 800×600 window. This was not input still awaiting delivery. No more stepping or game input followed; only state, snapshots and quit.

After closure I personally reviewed the predecessor's `custom-menu.png` and `choose-type.png`. Its purported custom menu is also the main menu. Only its following **Crusader** press reaches “Choose type of Crusader game.” The [original route](stronghold-crusader-demo.md) independently names Crusader at guest `(304,144)`. A disabled or unavailable Custom Scenarios control is consistent with the pictures; its internal guest handler was not established. I should have inspected that intermediate predecessor picture before treating its filename as a route instruction.

The offline `navigation-plan.cjs` now identifies the main menu and Crusader-type dialogue using exact reviewed RGB label patches. It proposes **Crusader**, native `(304,144)`, projected to browser `(337.3375,360.4433333333333)` under the supported geometry. It rejects both historical and current unchanged “custom-menu” pictures as a successful transition. This correction was tested offline after the browser closed and is **not a newly demonstrated native transition**. No second browser, reload or substitute gesture was used.

## Validation and evidence custody

Before browser launch, all **2415 local and remote runtime pins**, locked Puppeteer **25.7.0** actual CommonJS/dynamic imports, five real loopback HTTP responses with COOP/COEP and exact hashes, the original native-start model suite and immutable snapshot suite passed. Modified-driver fixtures passed locally and remotely: actual queue serialization, snapshot/close ordering, balanced controls, capture publication, incomplete ACK rejection, locked world controls, terminal failure and a review that remains pending until explicit fixture acknowledgement.

The later navigation regression accepts the reviewed Crusader-type picture, rejects unchanged menus and a corrupt pixel, and rejects unsupported geometry. Its initial candidate native `(302,144)` failed the existing inverse's round-trip check; the final plan uses the original documented `(304,144)`, which passes. Startup `(718,569)` and its guard were unchanged. An earlier integration assertion expected the old “locked” error after adding a stricter balanced-gesture prohibition; the updated fixture separately verifies both prohibitions. Initial failure logs are preserved. Neither was an additional runtime attempt.

Useful checks, from the repository root:

```sh
node docs/re-notes/stronghold-native-start-boundary-20261104.test.cjs
node docs/re-notes/stronghold-stable-recovery-combat-20261104.test.cjs
node scratch/runs/20261104-stronghold-corrected-native-start/integration.test.cjs
node scratch/runs/20261104-stronghold-corrected-native-start/navigation-plan.test.cjs
python3 scratch/runs/20261104-stronghold-corrected-native-start/verify.py
```

Atomic immutable snapshots round-tripped by full SHA-256 and length: **live-a 79**, **final-live 296**, **closed 301** logical files, reusing matching retained bytes. Live downloads used published immutable manifests, never active log manifests. `verify.py` checks all recovered hashes, **141 sequential successful command replies**, **124 step requests**, maximum **64**, total **7936 steps**, all **1033 served-file pins**, capture hashes, final input drainage and absence of gameplay after the deciding capture. Chrome **8597** ran **05:40:32.238–05:42:41.152Z**, **128.914 seconds**, exit zero, within the single twelve-minute bound.

Fresh minimal runtime staging used the predecessor's exact Git/blob reconstruction recipe, original installed-media path/hash references and retained canonical modules: `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee` and `580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3`. Runtime source remains `1188e9bf57ef35bd3363fb88b7ca0da442ce696d` plus the recorded nonexecuted census delta; original EXE remains `9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f`. Original media was staged once onto the fresh assigned box, with no media or module copies in this run evidence. Source custody uses Git SHA, relevant binary diffs and owned new-file patches, without source archives.

Actual exec **05:43:39.640731Z** proves Chrome/driver absent, private HTTP port **34289** closed and all **2415 pins unchanged**. Independent API inspection reports **bx_c5e39n22 RUNNING/API-idle, healthy and hydrated**, expiry **2026-11-04T06:21:54.275Z**. Recovery finished before **06:11Z**. The box is left running; shutdown ownership returns to the coordinator. No allocation/resume/stop/delete, local heavy runtime, subworker, successor, public deployment, guest write, cheat, SaveLoad or game-check change occurred.

Next authorized native work should take the directly observed Crusader route, verify each resulting menu, then exercise the integrated single scenario Start. This task stops at the diagnosed menu-route dependency; it supplies no new world or combat claim.
