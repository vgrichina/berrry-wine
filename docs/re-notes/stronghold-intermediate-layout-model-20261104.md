# Stronghold: bounded waiting for the11200 intermediate layout

The run-owned controller now recognizes the exact captured11200 bright panels/map **with “Not available in the demo”** as an input-free waiting state. It remains distinct from dim11136 and bright11392 without that wording. Unknown output still terminates the route. This is an offline controller repair; later-state runtime stability, preset selection, Start and gameplay remain unqualified.

Input: commit `55750f1ca362ea511ede813a014501dd3160f35d`, [later-layout observation](stronghold-later-layout-stability-20261104.md) and its retained evidence. New implementation, tests, logs and patches: `scratch/runs/20261104-stronghold-intermediate-layout-model/`. Only this note is committed. No production code changed and no production full build was needed or run.

## Identity and controller

`actual-layout.cjs` hashes every RGBA byte in the measured game rectangle `[10,194,860,668]`, requiring1200×900 geometry and opaque output. The three identities are:

| State | Capture PNG SHA-256 | Complete-output SHA-256 |
| --- | --- | --- |
| Earlier11136 | `b5adb615b443746c40f3a92625e563701a168cb81856ebcf22511fccc170096c` | `ef9494702084b55824328cd484a347f0eac79f7f32e106e821c36eb84153f768` |
| Intermediate11200 | `fc39f8676ac2c1739c53f3b294485ac950fb2699861781865ada84620c434b7c` | `820a52df229e09525333e254dd3b00b91c63a66c4166ca6183b0ae27acd4de91` |
| Later11392 | `085a70c1d54fb61cda112692db2c7ee17e6b2bd2003626759f547abce2e10bbc` | `f156657d1308d2e3af2b59793a1184cb4c12619cfc1aebec2acd195914135e0c` |

I personally viewed all three retained PNGs before writing the historical review record. Earlier11136 has dim panels and unavailable wording; intermediate11200 has bright panels and the upper-right map while retaining that wording; later11392 has the bright panels/map without it. These historical reviews do not authorize future runtime input.

`independent-layout.cjs` implements a separate column-major recognizer:20 columns of43 pixels, hashing all668 rows and all four channels. Its pinned manifest is grounded in the three SHA-checked captures. It does not call the primary digest or share its row-major extraction. Both implementations cover the whole rectangle, including map, panels, text, presets, background and edges; browser toolbar/log output lies outside this rectangle.

`navigation.cjs` admits the new exact identity only to the post-Custom-Game continuation. `route-driver.cjs` validates its initial capture, then permits at most12 groups of256 input-free steps while a known hover, earlier or intermediate identity persists. Both whole-layout recognizers must agree on every recognized setup capture. An immediate later candidate is handled directly rather than discarded. The candidate must be followed by **three further successive later-state captures**, each after256 input-free steps, before a separate capture-bound personal review. Any changed later sample, regression, unknown output or independent disagreement is terminal. There is no stability reset, retry or generic unknown bypass.

The actual review callback must return `personallyViewed:true`, nonempty observation, exact PNG SHA and exact scene. The later observation alone does not send a preset. A future preset still goes through the existing fresh capture, presentation identity, personal review, hover/press/release and input drainage checks. Existing historical-shell route behavior is preserved; a shell cannot satisfy actual scene20 arrival.

Budgets are unchanged:64 steps per complete per-guest ACK;3072 arrival steps;768 held-out stability steps;4096 aggregate route steps, including original input and drainage;16384 outer navigation cap. The retained runtime wrapper still has its360000ms browser limit,600000ms minimum remaining TTL and300000ms expiry reserve. This helper adds no deadline, clock adjustment or budget. Runtime wrapper installation remains a future prerequisite, not something executed here.

## Offline validation

All test commands run from the checkout root, with the following paths beneath the new run directory:

- `node …/layout.test.cjs`: three actual retained positives and48 negative controls across both recognizers, including five wrong scenes;13 map/text/panel/preset/background/edge mutations on each state; opacity and geometry rejection. Full navigation classification also rejects all39 pixel mutations.
- `node …/controller.test.cjs`:28 modeled cases cover immediate/delayed/earlier→intermediate→later arrival, intermediate as first capture, final permitted arrival, stuck hover/earlier/intermediate, initial and subsequent unknown, changed/regressed later samples, unviewed/wrong-SHA/wrong-scene/empty review, foreign queue/input/held controls, stale hover, wrong point, partial/timed-out ACK, fault, independent rejection at initial/stability/review gates and shared-budget exhaustion. Modeled ACKs use the existing production renderer/host input fixture; no WASM or guest execution occurs. Successful observation cases issue only the original three Custom Game events. The final-arrival case uses exactly4096 total steps; stuck states stop after3072 waiting steps plus256 original event/drain steps, without a later review.
- `node …/retained-test.cjs route`:12 route controls exercise the repaired driver. Its positive fixture uses the retained later capture, including during preset hover, then the historical scenario fixture. Simulated input tests verify exact543/292 Custom Game and67/491 preset coordinates; they are not runtime input evidence.
- `node …/retained-test.cjs observer` and `… freshness`: unchanged27 observer and20 freshness controls, including live-instance loss, read/drop errors, immutable boundary coverage, output/session/worker/geometry changes and stale review.
- `python3 …/history.test.py`: all20 actual retained observer reports pass the predecessor's exact validator, plus16 rejecting identity/range/history/sequence/callbackID2/request20/down-release/current-scene/retirement/storage mutations. Original report SHA and lengths are checked against the recovered receipt. No callback absence or new execution is inferred.
- `node …/guards.test.cjs`:33 checks cover exact ACK fields, guest execution faults/timeouts, invalid quantum, shared budget exhaustion and unchanged wrapper limits/pre/post-ACK sampling/fault latch.

Detailed results are retained in `*-controls.json` and test logs. Initial fixture-only failures are retained: the reused historical positive expected the rejected shell, then its second-gesture hover needed the same later image. Those fixture inputs were corrected without relaxing controller recognition. An initial accounting assertion omitted one64-step drainage ACK; the final assertions count all256 original gesture/drain steps. No runtime behavior was modified to satisfy these fixtures.

## Evidence and next prerequisite

Provenance records the exact tested checkout Git SHA, relevant `git diff --binary`, owned new-file patches and SHA manifests. Captures and predecessor helpers remain at existing paths with hash references; neighboring compressed evidence is read losslessly and checked without wholesale restoration. No source archive, media/module copy, credential/config change, production edit, browser, heavy CLI, WASM runtime, API, remote execution, allocation or lifecycle operation occurred.

Next requires a **fresh coordinator-authorized runtime**, its current dependency/cache/pin closure and unchanged expiry/deadline gates, plus installation of these run-owned helpers into the existing single-attempt wrapper with observer history/range and pre/post-ACK sampling intact. Observe the exact admitted states within the existing budgets; collect three successive input-free later observations and independently recognize each; then personally VIEW the final fresh capture in a separate call and write its exact capture-bound review before any preset. Preserve first-failure stop, fresh hover/input guards and separate native Start/world gates. No current stability or gameplay claim is made.

No box was assigned to this offline task. `bx_jret53j4` was untouched: the coordinator board reports normal stop completed `2026-11-04T10:55:59.817Z`; its historical expiry was `2026-11-04T11:05:35.153Z`. There was no status API query, resume, shutdown or custody takeover here. Lifecycle remains coordinator-owned. This single assignment stops after its tested note is committed and publication is attempted once.
