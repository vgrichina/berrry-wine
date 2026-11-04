# Stronghold scene20: fresh input-free samples reject stability

**The dim actual layout is not stable across the next 256 input-free steps.** The sole Chrome reproduced it at11136 steps, then showed brighter setup panels, an upper-right map and no unavailable text at11392. The complete-output stability guard rejected that second image and immediately closed Chrome. No preset press, Start or world input followed. This establishes an original rendered transition, not a rendering defect, a fade mechanism or strict scenario readiness.

Evidence: `scratch/runs/20261104-stronghold-fresh-layout-stability/`. Predecessors: [actual-layout audit](stronghold-actual-preset-layout-20261104.md), commit `94d89d795cd095014aeb6a48dff993f24b9c6464`, and [natural scene20 rendering](stronghold-scene20-natural-render-20261104.md), commit `38238efd5b786b6a00b594ec5a6f775a3ce90787`.

## Personally viewed fresh captures

I personally viewed both recovered original captures in a separate tool call before writing their hash/step/observation reviews in `personal-stability-review.json`:

- At11136, `route-native-boundary-6.png`, SHA `b5adb615b443746c40f3a92625e563701a168cb81856ebcf22511fccc170096c`: buttons1/2/3, “Not available in the demo”, dim Human/Lord Crusader, Deathmatch, gold and player panels; no upper-right map.
- At11392, `route-native-boundary-7.png`, SHA `085a70c1d54fb61cda112692db2c7ee17e6b2bd2003626759f547abce2e10bbc`: brighter, sharply bordered panels; readable Human/Lord Crusader and Deathmatch, gold10000/10000, Crusader Demo player and an upper-right map. The unavailable wording has gone.

Four complete64-step ACKs separate these images. Input telemetry is drained at both; there are zero transport events in the interval. The numbered-button rectangle remains byte-identical while the complete game rectangle changes **1,129,717 RGBA bytes**. This independently demonstrates why button-only acceptance is insufficient.

## Observation policy and first failure

The run-owned candidate identity hashes every RGBA pixel of the measured game-output rectangle `[10,194,860,668]`, including all panels, controls, text and background. Its retained-reference hash is `ef9494702084b55824328cd484a347f0eac79f7f32e106e821c36eb84153f768`; the fresh11136 image matches exactly. It is explicitly an observation identity, not input authorization from one image. The next sample hashes to `f156657d1308d2e3af2b59793a1184cb4c12619cfc1aebec2acd195914135e0c`.

After the original balanced Custom Game gesture, only the already recognized hover is allowed while awaiting the candidate, within the inherited4096-step route budget. Either an immediate or delayed candidate starts a planned three additional256-step input-free sampling groups. Existing identity, presentation, ACK, input, observer and fault guards apply throughout. The first such group rejected its changed output, so later groups and final personal-review authorization were never reached. No recognizer was changed after that failure.

First failure: **10:32:53.909Z**, `first unexpected actual stability scene: unknown`. Chrome12100 closed at **10:32:54.409Z**, exit0. No second browser, reload, forced guest call, guest write, repaint or additional trace range was used. The later map image is retained as an unqualified new state; no Zephyr/Start/world claim is made.

## Tests and preflight

Before Chrome, the exact unchanged **27 observer,20 freshness and12 route controls** passed, alongside original instruction/native-route tests and actual retained WASM/original-EXE non-ID2-negative and ID2/request20-positive execution in the actual Worker/broker fixture. The fixture's intentional instruction execution belongs only to isolated preflight, not the original browser route.

Actual CJS/dynamic ESM/Puppeteer imports, syntax, complete helper hashes, **2415 retained runtime pins**, the98-page/12-Worker cache graph and five pinned HTTP/isolation responses passed before launch. The assigned expiry was verified through the API. The600000ms TTL guard and inherited300000ms expiry reserve were retained, exceeding the required180000ms recovery reserve; Chrome was bounded to six minutes. Allocation/deadlines were appended before launch. No runtime touched the stopped predecessor box.

Candidate controls reject five retained wrong scenes and nine panel/text/button/background/edge mutations. Four modeled sampling cases passed before launch: delayed arrival, stuck hover, unexpected waiting image and changed actual sample. An initial test caught an immediate-arrival sampling bypass; it was fixed and retested before launch. Post-recovery independent fresh11136 positive and the same nine mutations pass; the fresh11392 transition rejects. These are candidate-identity controls, not a stability positive. Offline fixture-path and transport-count audit corrections are retained explicitly.

`actual-evidence-check.json` verifies **178 complete ACKs /11392 steps**,1052 served-pin matches, six paused-before-start Worker preloads, four live armed instances,26 observer reports, two explicitly pre-recording retirements, zero observer errors/drops and eight rejecting proof mutations. Original callbackID2/branch/request20/down/release ordering is proved; final current/requested scene remains20/20. Callback absence remains unqualified.

## Recovery and custody

All **262 immutable closed files /19,489,587 bytes** were recovered and SHA-verified by10:33:10Z, with the unique actual-Worker result, exact executed driver and driver log recovered separately. Post-close checks find Chrome/driver absent, actual HTTP44145 closed and all2415 pins unchanged. The last API observation at10:34Z shows **bx_jret53j4 RUNNING /API-idle, healthy and hydrated**, expiry **2026-11-04T11:05:35.153Z**. Coordinator owns shutdown and receives custody; no lifecycle action was taken.

Runtime source remains `1188e9bf57ef35bd3363fb88b7ca0da442ce696d`, normal WASM `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee`. Exact checkout Git SHA, relevant binary diff, owned-new-file patches, small-input hashes and artifact seals preserve provenance. No source archives, module/media copies, production code, authentication/configuration changes, local heavy runtime, subworkers, successors or deployment were introduced. Only this note is committed; no production full-build claim applies.

The remaining gap is successive input-free stability and complete independent recognition of the later11392 state before any preset gesture can be authorized. This single assignment stops at its required first failure.
