# Stronghold original — browser dependency fixed; combat unreached

**The missing Puppeteer dependency is fixed and native recruitment was demonstrated. No hostile engagement, damage or defeat is established.** The attempt ended on a live-evidence recovery race, preserved as the first live-recovery failure. It does not extend the predecessor's recruitment/movement result into a combat claim. Evidence: `scratch/runs/20261104-stronghold-browser-dependency-combat/`.

The intact `/home/user/stronghold-native-hostile-engagement-runtime` on **bx_285595gz** was reused. Independent API inspection found idle/healthy/hydrated; actual exec proved RUNNING at **04:44:50Z**, followed by an append-only ACK. No source or media was restaged. The [blocked predecessor](stronghold-native-hostile-engagement-20261104.md), commit `be46bdc0b`, and [successful spear predecessor](stronghold-spear-delivery-recruit-20261104.md), commit `a0522f78ac7b550f905ae3bc00d46d4b7ad92df4`, retain the full original reconstruction recipe and hashes.

## Reproducible dependency repair

The successful predecessor's 2415-file runtime manifest already pins `package.json` and `package-lock.json` to Git **1188e9bf57ef35bd3363fb88b7ca0da442ce696d**. Its lock specifies **puppeteer 25.7.0**, **puppeteer-core 25.7.0**, and **@puppeteer/browsers 3.2.0**. The existing runtime lock SHA-256 is **0057c3be43c6b6dac68158f84a8c1b7831ccc44c8a92bd3d263df5fbc6425eef**; it remained unchanged after installation. The exact command, also saved in `dependency-install-command.txt`, was:

```sh
cd /home/user/stronghold-native-hostile-engagement-runtime && PUPPETEER_SKIP_DOWNLOAD=true PUPPETEER_SKIP_CHROME_DOWNLOAD=true PUPPETEER_SKIP_CHROME_HEADLESS_SHELL_DOWNLOAD=true npm ci --ignore-scripts --omit=optional --no-audit --no-fund
```

This installed 40 packages in 831 ms, exit 0, with no install scripts or browser download. Node was **v24.22.1**. Both `require.resolve('puppeteer')` and actual CommonJS `require`/dynamic `import` passed; `launch` was a function. The installed dependency tree and generated installed lock are retained as `installed-dependency-tree.json` and `installed-package-lock.json`; the latter SHA-256 is **4967995d0b33ff61159b08fd50ba4c379bfbe972417b16fcabc3d000c5466813**. The driver used existing **/usr/bin/google-chrome**, Chrome **151.0.7922.108**.

Before Chrome, all **2415 original runtime pins** passed. Helper syntax/import checks passed. Driver fixtures accepted 64-step ACKs and rejected invalid counts, incomplete/timed-out ACKs, absent capture references and unmatched releases. A separate fixture checked fresh capture names, PNG hashes, atomic JSON publication, balanced close-time releases, browser/server closure and leaving the box running. Actual loopback HTTP verified status 200, COOP/COEP and pinned bytes for the index, app registry, both modules and original-media manifest. Live recovery concurrency was not covered by that fixture; its later failure limits this result.

Canonical **cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee** and companion **580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3** remained unchanged. The canonical module was compiled, instantiated and transferred to guest Worker 0; the companion was pinned but not selected. Original EXE remains **9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f**. Source provenance is Git SHA plus the predecessor's relevant census binary diff and owned helper patches, without source snapshots or media copies.

## Personally inspected native evidence

Deciding captures were personally viewed in separate completed tool calls before dependent native controls. Files below are in `recovered/browser/`:

- `scenario-confirmed.png`: **Zephyr — Very Easy (1/10)**, Normal Game/Human Advantage, Rat/Duc de Puce opponent, 8000 versus 2000 gold.
- `granary-placed.png` and `granary-panel.png`: native Granary placement, **59 food**, **full rations**, population **10/10**. Popularity subsequently recovered from 86 to **100**. Sustained food production was not tested.
- `woodcutter-placed.png`: native Woodcutter and three-wood debit, **95 → 92**. `mercenary-placed.png` records the Mercenary Post and ten-wood debit, **92 → 82**. No fresh wood delivery measurement is claimed.
- `recruited-one.png`, `recruited-two.png`, `recruited-three.png`: three deliberate balanced 64-step recruitment presses, gold **8000 → 7900 → 7800 → 7700**. The native panel identifies **Firethrower, Cost 100**. An earlier exploratory filename `swordsman-cost.png` was only a guess; it does not identify the unit.
- `selected-group.png` and `selected-firethrowers.png`, step **29248**: three selected units with full green health bars; native tooltip **Select/De-select Arabic Fire Thrower**, count **3**.
- `hostile-before.png`, step **31936**: the orange-clad wall defender's hover identifies **Rat, Duc de Puce**. `hostile-inspected.png` preserves its full health bar. `arrival.png` and `final-partial.png`, step **37184**, show the hostile castle/defender, without an established health decrease or defeat.

The first minimap click while the three Firethrowers were selected issued a movement order; it did not move the camera. They were then deselected and the camera inspected the far bank. The group's arrival at the hostile or a traversable attack route was not established. No attack was issued. Early selector clicks also accumulated native input; bounded no-input stepping drained the queue before further world controls. Exploratory filenames such as `opening-world.png`, `launch-transition.png` and `marching-firethrowers.png` are not proof of their presumed events.

## Failure, validation and handback

Live recovery began while commands continued. Its hash assertion correctly failed because append-only **browser/commands.jsonl** changed between manifest creation and download: expected **51997 bytes**, observed **52895 bytes**. `first-failure.json` preserves both full hashes; `live-first-failure-commands-expected.jsonl` and `live-first-failure-commands-observed.jsonl` preserve the exact byte states, reconstructed and SHA-verified as prefixes of the final append-only log. Game input stopped when this failure was observed. Only a final capture and quit followed. Stable recovery after normal browser close is a separate recovery phase, not a second gameplay attempt. No browser retry or reload occurred.

One earlier setup-script error is separately preserved in `setup-helper-failure.json`: broad replacement of a `RUN` placeholder damaged the literal `RUNNING`, causing a Python syntax error. It was corrected before pin checking or Chrome. A later local inspection convenience lacked Pillow; `pngjs` produced the inspected minimap crops. Neither changed the runtime or game state.

`verify.py` passes **738 sequential matching ACKs**, **581 step requests**, maximum **64**, **37184** total steps, **109 input commands**, **74 trusted observed input events**, balanced controls, empty final input queue and zero mouse mask. All **1060 served-file receipts** match their pins; capture hashes pass. Execution was guest Workers with Canvas 2D/DirectDraw; the toolbar is not evidence of WebGL. `node test/test-app-files-policy.js` passed. The evidence checker found no missing or escaping references for this run; it flags its null candidate ID because Stronghold has no candidate-manifest row. This remains investigation evidence, without attachment to an unrelated candidate. Foreign run errors were left untouched. No production change or build was required.

Chrome **12143** ran **04:46:02.957–05:02:38.285Z**, **995.328 seconds**, and exited normally with code 0. Stable recovery full-SHA verified **2283 files**, including both actual modules, and all **2415 runtime pins** unchanged. Closure at **05:03:48Z** proved Chrome and driver **12127** absent and HTTP port **41717** closed. Recovery completed well before **05:23Z**, retaining over five minutes of reserve. The owned board watcher was closed before handback.

**bx_285595gz remains RUNNING/API-idle, healthy and hydrated; expiry 2026-11-04T05:33:35.510Z. Shutdown ownership returns to the coordinator.** No lifecycle actions, other box, local runtime, subworker, successor, guest write, cheat, game-check edit, Save/Load retry, public deployment or Heroes II occurred. Next work requires a stable live-recovery boundary (or a paused command stream during recovery) and a separately authorized combat attempt. This single task stops with dependency repair proven and combat unreached.
