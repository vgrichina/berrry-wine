# Stronghold actual preset layout: offline audit, live stability remains unqualified

**No Chrome was launched and no preset was selected.** The retained actual image differs materially from the historical shell reference. Offline controls reproduce that difference and show why deleting its text anchor does not qualify the actual layout. The required new stability and freshness proof could not be prepared within the remaining launch window, so this assignment took the explicitly authorized offline path. No revised recognizer or production change was installed.

Evidence: `scratch/runs/20261104-stronghold-actual-preset-layout/`. Predecessor: [natural scene20 rendering](stronghold-scene20-natural-render-20261104.md), commit `38238efd5b786b6a00b594ec5a6f775a3ce90787`.

## Personally inspected retained images

I viewed the predecessor's full `recovered/closed/route-native-boundary-6.png`, SHA `d5988593af17dbc13e0a4ed3cb2c79460d991fbef7830e162d7d1834edc22bba`. It shows numbered buttons 1/2/3, “Not available in the demo”, Human/Lord Crusader, Deathmatch Game, gold values and the player list over the sword background. Several panels appear dim compared with the older Zephyr-hover image. This is a historical capture at11136 steps, **not a fresh capture from this assignment**.

I separately viewed the village `review/custom-skirmish.png`: its unavailable label and numbered buttons appear without those panels. The village `review/zephyr-veryeasy.png` has similar setup panels plus a map and Zephyr hover wording. This supports the existence of such panels in an earlier original-game execution, but neither image independently proves the actual11136 layout is complete or stable. The Zephyr hover remains an incomplete Deathmatch setup, not strict Zephyr readiness.

`layout-controls.json` reproduces the exact numbered-button-region match (`825ef27c…`) and **16,830 differing RGB bytes** in the old text/background region. The unchanged classifier accepts the historical shell positive and rejects the actual image. Three different historical states reject as shell. Five mutations, covering the old text region and Human, Deathmatch, player and gold panels, remain accepted by a hypothetical button-only predicate. This predicate is only an offline diagnostic; it was never installed as a recognizer. These controls demonstrate incomplete coverage, not a production rendering defect or authorization to select.

## Original scene code

`audit.py` verifies the original EXE SHA `9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f` and exact ID2/request instructions. Scene-table entry `0x5e3ae0` pairs scene20 with object `0x692f48`. Constructor `0x4259d0` supplies descriptor `0x5ba528` to initializer `0x4e9280`; the relative call target is calculated from original bytes. Bounded original disassembly is retained. The descriptor contains callback pointer `0x4ea9e0`; its bounded disassembly is supporting context only.

The ID2 callback requests20 at `0x430e71`, then calls `0x429100` and further setup routines before returning. The scene request alone therefore does not establish completion of initialization or rendering. This static audit does not prove which drawing calls produced the extra panels, a fade mechanism, or a missing repaint. No forced call, guest write, repaint or changed trace range was used.

## Verification and precise gap

The **exact retained revisions** of27 observer controls,20 freshness controls and12 route modes passed again. Test SHA values and output logs are retained; the sole test result write was redirected to this owned run. Their captured-image/model distinctions are preserved. They are not new actual-scene stability positives.

At10:19:02Z, fewer than12m11s remained before box expiry. The unchanged launch guard requires600s remaining TTL, giving a latest admissible launch of **10:21:12.262Z**, earlier than the10:26Z hard close. The scene investigation, new independent actual-layout positive, stability sampling policy and complete actual Worker/broker/CJS/ESM/HTTP preflight could not be finished in that setup window. The offline decision was made before that guard expired. No guard or TTL policy was weakened.

Read-only remote inspection at **10:21:54–10:21:56Z** rehashed all **2415 runtime pins**, with zero mismatches; Chrome/driver processes were absent and actual predecessor HTTP35421 was closed. Runtime source commit remains `1188e9bf57ef35bd3363fb88b7ca0da442ce696d`. A new actual Worker/broker execution and CJS/ESM/HTTP launch preflight were **not** performed or claimed. Historical passes remain in the predecessor evidence.

Missing proof: a newly authorized original execution yielding successive input-free actual scene20 captures with complete ACK/observer/current/request/identity/input evidence, independent positive and wrong-scene/mutation controls for the actual layout, then personal viewing followed by a separately authored truthful review and fresh comparison. Only after those pass may a run-owned recognizer authorize one balanced ordinary preset gesture and inspection of its result. Start/world still require their original readiness and personal-review guards.

## Custody and provenance

Only this note is committed; no code/full-build claim applies. Exact Git SHA, relevant binary diff, new owned helper/note patches, input hashes and an artifact seal preserve this investigation without source archives, media copies or module copies. Existing captures are referenced by path and SHA, not copied.

**bx_g5fcu9qz is left RUNNING /API state `idle`, healthy and hydrated**, expiry **2026-11-04T10:31:12.262Z**. Coordinator owns shutdown and receives custody. No lifecycle, allocation, local heavy browser, subworker, successor, HeroesII or deployment action occurred. No new runtime artifacts require recovery. This assignment stops with the precise stability gap preserved.
