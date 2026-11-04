# Stronghold original route: offline physical adapter

The run-specific adapter now connects the proven ChooseType **right towers / button 2 → demo preset 1 → strictly recognized Zephyr** policy to the predecessor's physical-input transport and immutable command queue. This is offline integration evidence, **not a new gameplay result**. No Start, browser, game, heavy CLI, box access, allocation, resume, lifecycle action, download, deployment or worker launch occurred.

Run: `scratch/runs/20261104-stronghold-route-adapter/`. Requested starting main `6766463d4` includes route note `5747079c8`; `source-reference.json` records the exact tested Git SHA and individual dependency hashes. Concurrent unrelated changes are excluded. No production files changed, so no full build was required. Only this note is committed; ignored helpers are recoverable from `owned-new-helpers.patch`, with `relevant-source.patch` and SHA/size seals. No source archive or media copy is retained.

## Adapter and actual transport

`driver.cjs` exports `createRouteDriver({page,state,shot,controls,review,boundary,maxSteps})`. It constructs the **actual predecessor `pageAdapter`**, a `NativeStartDriver` subclass that retains its constructor, capture/control/execution-boundary guard and bounded `step()`/ACK checks, and the actual source-grounded `RouteController`. `wireRouteCommands(options, predecessorDispatch)` replaces the mailbox dispatcher and permits only state/shot/snapshot/quit to reach the predecessor dispatcher; raw input, step/observe, install-native and native-start reject terminally. Route commands execute through the supplied predecessor `EvidenceBoundary.run` queue. No second route policy or caller-supplied scene label decides recognition. `navigation.cjs` is the predecessor's small policy with only its broken `../../../docs/...` import corrected to the retained explicit-idle native boundary module; its route, pixels and qualification are unchanged.

The only route commands are `route-next` (exactly one recognized transition) and `route-handoff` (fresh reviewed Zephyr receipt). The adapter exposes no Start or ordinary/raw-input command. Install it at a freshly captured, personally reviewed original ChooseType checkpoint. Preserve the outer driver's shutdown deadline, first-failure handling and explicit state collector. Use `wireRouteCommands` as the mailbox dispatch after installation; it locks raw click/key/move/down/up, observation/step and retry paths. Call the wrapper directly because **its dispatch already owns the queue**. Do not nest it inside another `boundary.run` operation.

The two gestures use retained actual native receipts **(543,292)** and **(67,491)** and unchanged `projectNative` fractional projection through qualified geometry. Each gesture recaptures the reviewed scene before moving and again before pressing. It observes exactly the expected owned event after each physical operation, verifies native coordinates, message, HWND, button mask, wParam and lParam, requires a complete **64-step per-guest ACK**, then drains before the next event. Aggregate route budget defaults to **4096** steps across both gestures. A failed held press gets only its own release; no further step or retry follows.

Raw field presence, explicit idle null/null/zero, empty queue, renderer/host identity, host-renderer queue/active/mask agreement and getter agreement are required. Transient input may contain only the currently expected owned event. Missing fields, stale events, foreign queue entries, nonzero idle masks, changed geometry, unsupported screenshots, stale review, incomplete ACK or unexpected transitions permanently stop the route. Arrival/unavailable, picker, default Deathmatch and unknown scenes reject. The exact **demo-selection-unavailable** shell remains selection-only: its single permitted action is preset 1; it never qualifies Start. The handoff rechecks actual strict Zephyr pixels, personal review and fresh capture; a hash receipt cannot substitute for pixels or telemetry.

## Focused offline validation

Exact invocations from `/home/user/wine-assembly` (also collected, fail-fast, by `bash scratch/runs/20261104-stronghold-route-adapter/run-tests.sh`):

```sh
node scratch/runs/20261104-stronghold-route-adapter/adapter.test.cjs
node scratch/runs/20261104-stronghold-route-adapter/input-qualification.test.cjs
node test/test-renderer-initial-input-state.js
node docs/re-notes/stronghold-native-start-boundary-20261104.test.cjs
```

The adapter suite passes **203 checks** and uses real `Win98Renderer` and `WineAssembly` construction, the production fractional browser point conversion and renderer native mapping, production queueMouseInput/takeInput and host check_input imports. Only page/step responses and explicit fixture review acknowledgements are simulated. Retained pictures supply scene evidence; no simulated state is claimed as live telemetry. It also evaluates the **actual predecessor browser-driver** without its main/launcher call, then drives its real `state`, `freshShot`, `personalReview`, held-control census and `EvidenceBoundary` constructor through the new adapter. Two concurrent route requests serialize correctly. Fresh route captures use `route-native-boundary-*` names, leaving `native-boundary-*` available for a separate Start installation.

Success emits precisely move/down/up at each source-grounded native point: **six events, two balanced gestures, six complete 64-step ACKs, 384 modeled steps**. Negative tests cover first/second wrong transition, stale and absent personal review, hover changes, missing constructor fields, missing raw telemetry and event fields, active/stale/foreign input, mismatched host renderer, occlusion, ACK counter/guest/timeout failures, bounded non-drainage, failure after a press with cleanup, premature handoff and native-start command rejection. The separate unchanged NativeStartDriver is constructed and freshly captures the scenario with zero steps and no Start call; the existing strict native suite separately retains its historical transition/negative qualification.

The documented copied fixture error is fixed **explicitly in this run's `input-qualification.test.cjs`**: its historical missing-field case now reads `../20261104-stronghold-progress-aware-startup/review/startup10240.json`, instead of the repaired explicit-idle capture at `./review/startup10240.json`. It still asserts that all three raw fields are absent, getter zero is insufficient, qualification rejects missing telemetry, and explicit fixture-only restoration is necessary. Neither historical capture nor production guard was edited. The real constructor regression and current adapter negatives independently reject removal of each repaired field.

## Small staging recipe and separately assigned gameplay handoff

No remote staging was performed. `stage-inputs.json` lists only the two new runtime helpers and three small predecessor modules with full SHA-256/size, plus existing media **path/hash references**. `stage-files.txt` is suitable for a later authorized worker's file transfer preserving relative paths, for example:

```sh
# REMOTE_CHECKOUT and REMOTE_SSH must belong to the separately assigned runtime.
# First reconcile that existing checkout to source-reference.json's Git SHA and
# relevant-source.patch; verify retained modules and existing media hashes.
rsync -R --files-from=scratch/runs/20261104-stronghold-route-adapter/stage-files.txt \
  ./ "$REMOTE_SSH:$REMOTE_CHECKOUT/"
```

Transfer no source tree, scratch tree, archive, retained PNG corpus, game media or node_modules. Reuse existing installed game media and qualified module paths; if a pin is unavailable, stop. New ignored helpers can be restored locally from `owned-new-helpers.patch`; do not reapply patches over files owned by peers. Constructor/native focused tests above run on the source checkout; the remote runtime separately needs the predecessor's actual Puppeteer CommonJS/dynamic import, HTTP/isolation, served-file pin and ACK/transport preflights before any browser.

The later assigned driver must supply its **existing** `page`, `state`, `freshShot`, `held`, `mouseHeld`, `personalReview` and `boundary` closures. Replace the mailbox dispatch with the following expression, tested against those predecessor closures and their actual dispatcher:

```js
const {wireRouteCommands} = require('./driver.cjs');
const routeDispatch = wireRouteCommands({page, state, shot: freshShot,
  controls: () => ({keys: [...held], buttons: [...mouseHeld]}),
  review: personalReview, boundary, maxSteps: 4096}, dispatch);
// The mailbox must use routeDispatch for ALL requests after installation.
// Await each final reply; these are the only authorized route actions:
await routeDispatch({action: 'route-next'});    // right towers -> selection shell
await routeDispatch({action: 'route-next'});    // preset 1 -> strict Zephyr
const handoff = await routeDispatch({action: 'route-handoff'});
```

This snippet names the concrete hook; it does not authorize running it now. The outer driver's integration must preserve one launch, sequential mailbox ACKs, immutable recovery boundaries, a finite browser/review deadline and no input/step bypass after installation. Begin at genuine original startup/menu navigation, require explicit constructor-backed idle telemetry before every gesture and personally view each fresh route capture. On the first unexpected picture or failed prerequisite, stop input/execution and recover unique evidence; no Arrival fallback, picker dismissal, extra preset click or guessed input is permitted.

After this route completes, a separately authorized gameplay assignment must **separately** install unchanged `NativeStartDriver(pageAdapter(...), {review: personalReview, maxSteps:4096})` and `guardNativeCommands` on the same queue, invoke the original strict input qualification, obtain its own fresh scenario review and qualify native **(718,569)**. It must require actual reviewed world entry before ordinary gameplay controls. A route handoff is not world entry or Start qualification. This task did not invoke that action.

`bx_c5e39n22` remains **owner-reported STOPPED**, last supplied verification 2026-11-04 06:16:04Z; no state or expiry query was made. No box is allocated or assigned here, no runtime ownership changed, and lifecycle custody remains with the coordinator. The adapter is tested offline; the bounded original gameplay attempt remains separately assigned. Stop here.
