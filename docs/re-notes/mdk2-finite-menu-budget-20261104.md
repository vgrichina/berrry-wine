# MDK2 finite menu command allowance, 2026-11-04

The run-only menu controller now supports an explicit **113-command maximum**, with **64 still the default**. Offline regression reproduces the demonstrated **57+9 >64** rejection and completes the same Medium command envelope under a fresh supported contract. No browser, game runtime, allocation or lifecycle operation occurred. No production defect or production change was needed.

This follows [corrected staging and the native menu boundary](mdk2-corrected-staging-native-scene-20261104.md), commit `2488b55b1cfe108fde7b53355e7386bf374aa865`. New owned helpers and evidence are in `scratch/runs/20261104-mdk2-finite-menu-budget/` (RUN). Predecessor files remain unchanged.

## Finite contract

The supported upper bound is conservative and derived from the existing menu envelopes:

| Component | Bounded command cost |
| --- | --- |
| Shared execution envelope | 512 slices /16 =32 minimum execution quanta |
| Observation/poll commands | At most three commands per quantum: state, step, capture; native step/state pairs cost only two |
| Three one-shot input envelopes | At most five additional commands each: before-state, tick, keydown, keyup, final capture |
| Inspected comic acceptance | Two commands: state and capture |
| Explicit command ceiling | **32×3 +3×5 +2 =113** |

The three input envelopes are title Escape, New Game Enter and Medium Enter. Their original minimum reservation remains nine commands /48 slices; observations reserve three /16 and acceptance reserves two /zero. A 32-slice release costs one step/state pair, so this formula deliberately overcounts. Additional native polling consumes the same aggregate slice and command budgets. Repeated observations, fade observations or repeated acceptance calls receive no new allowance; even misuse that consumes no slices still hits the finite command cap. This is execution credit, never permission to infer readiness or replay an input.

`select(dir, review, phase, {maxCommands:113})` explicitly chooses the allowance **on the first menu call in a fresh namespace**. The API accepts positive safe integers through113. It writes `commandLimit` into the same persistent menu ledger before submitting the first command. Later calls inherit the stored limit; an explicitly repeated value must match. A legacy ledger without this field retains64 and cannot be upgraded in place. Invalid, fractional, nonfinite, overflowing or above113 values fail before submission and latch the first error.

The shared **240,000ms elapsed cap, 512 slices, individual step bound64, first-error latch, reservation-before-input and per-command write-before-submit accounting** remain. The spool still takes the minimum of its existing deadline, menu start+240seconds and recovery reserve. No ledger, elapsed clock, phase flag, ACK or error latch is reset. Native consumption, callback effects and release checks, original selection/readiness checks, personally inspected capture hashes, input balance/history, exclusive lock, contiguous command/ACK validation and no-retry behavior are unchanged.

## Offline verification

`menu-tests.tap`: **90/90** tests against the actual candidate `select`/`Spool` implementation and independent command peer. Coverage includes:

- Original helper replay from the recovered historical ledger:304 slices,57 commands, New Game done, Medium pending; nine-command Medium reservation rejects before any submission and remains latched even if a larger limit is requested.
- A separate modeled fresh contract with those counters and explicit113: Medium completes its exact nine-command sequence, ending at66 commands /352 slices. The historical deadline is never revived; only a new fixture clock is used.
- Full modeled title Escape →13 individually captured opening observations →New Game reaches the actual57/304 boundary, then Medium reaches66/352 using one ledger across separate calls.
- Command113 succeeds exactly; the next reservation fails before any command and preserves accounting. Malformed/overflow options and persisted limits, invalid counters, immutable legacy allowance, shared elapsed/slice caps and irreversible fault latch all reject as required.
- Existing native delayed-poll/release, missing callback, held input, untrusted events, stale review, partial step and failed/missing/wrong/late ACK cases remain covered.

`existing-suites.tap`: **177/177** predecessor native/controller tests pass unchanged. `candidate-existing-suites.tap`: the same **177/177** tests pass with the small offline `candidate-suite.cjs` preload routing existing controller imports to the actual new helper. This exercises the existing construction, comic/post-cancel, opening, inspection, native readiness/observer, original PE/script, scene and recovery suites without editing predecessor consumers. Tests are sequential to respect their existing short ACK deadlines. These are offline protocol/native-memory tests, not fresh game execution.

Reproduce from repository root:

```bash
node --test --test-concurrency=1 scratch/runs/20261104-mdk2-finite-menu-budget/test-native-menu.cjs
node --require ./scratch/runs/20261104-mdk2-finite-menu-budget/candidate-suite.cjs --test --test-concurrency=1 scratch/runs/20261104-mdk2-corrected-staging-native-scene/test-*.cjs
```

Only six necessary small predecessor helpers/tests were copied: native-menu, its test, native-readiness, native-opening, opening-boundary and memory-fixture. Four support helpers retain identical bytes; menu implementation/test contain the owned changes. A small candidate-suite preload is new. No source tree, module, media or dependency tree was copied. No tracked `src/`, `lib/`, `tools/` or `ops/` change was made, so the production build gate does not apply. `provenance.json`, `relevant.diff`, helper delta and owned new-file patches record exact Git SHA and SHA-256 identities; `artifact-hashes.json` seals the small run inputs, logs and patches. Git remains the source archive.

## Exact recipe for a separately authorized fresh runtime

1. Create a **new run and browser namespace**; retain the predecessor's original execution source/module/media pins and corrected small-file staging recipe. Do not reuse its closed browser, commands, ledger or latch. Reconstruct these seven small owned files from RUN's new-file patches if needed and verify their recorded SHA-256 values. Stage the candidate `native-menu.cjs` beside its unchanged native-readiness/opening-boundary dependencies. Ensure the driver and every controller resolve that same candidate file. Keep all other driver, inspection, native, construction, comic, scene and deadline helpers unchanged.
2. Re-run the above candidate tests and the corrected prebrowser checks before Chrome: pinned bytes, CJS/ESM dependency imports, registered MDK2/WebGL selectors, isolated HTTP and corrected absolute staging paths. Generate fresh staged/served pins including the new helper. Existing missing retained test-only source/capture prerequisites must be resolved or explicitly accounted for as in the predecessor; do not silently omit a failing check. Launch only under separately granted runtime authorization and its close/recovery deadlines.
3. Use the original bounded input-free startup route. Personally view and approve the latest fresh title capture. At the **first menu call**, approve the capture through the unchanged inspection guard, then choose113 explicitly. For example, with `R` the fresh staged run, `B` its fresh browser directory and `REVIEW` the actual latest personally inspected title review:

   ```bash
   node "$R/inspection-guard.cjs" "$B" "$REVIEW"
   node "$R/native-menu.cjs" open "$B" "$REVIEW" 113
   ```

   `open` is valid only if the existing original-title guards authorize it; this command is not a generic startup action. If the first authorized menu phase is instead an input-free `observe`, pass113 there. Never pre-create or edit the ledger to enable the allowance.
4. Retrieve and personally inspect each resulting PNG and its matching state/hash. For each permitted subsequent phase, approve its own latest capture through the inspection guard and call `node "$R/native-menu.cjs" PHASE "$B" "$REVIEW" 113`. Use `observe` only for the original identified opening/fade, `newgame` only for native-ready highlighted New Game, and `medium` only for native-ready highlighted Medium. The ledger must preserve its original startedAt/counters/113 limit across calls. Observation caps never establish readiness. Native Enter polling/release still uses the unchanged callback witnesses. Do not repeat the prior erroneous opening classification after New Game is already visible and native-ready.
5. Continue to construction/comic/post-cancel only when their unchanged reviews/native prerequisites authorize it. This allowance changes no downstream consumption, cancellation witness, scene, readiness or ACK contract. Stop immediately on the first failure, deadline or cap; preserve the latch, close/recover under the authorized driver protocol, and hand runtime custody back to the coordinator. No restart, reset, second browser or increased cap is implied.

This task claims a supported, tested finite offline contract only. Medium/comic/playable-scene behavior remains unobserved in a fresh runtime. No box was assigned or accessed here; the predecessor's box was `bx_wm47edh3`, original expiry `2026-11-04T08:33:42.970Z`. The coordinator subsequently reported **STOPPED**, snapshot verified `2026-11-04T08:22:50.376Z`; that state was not independently queried by this offline worker. Lifecycle custody remains with the coordinator. No successor, subworker, HeroesII or public deployment was started.
