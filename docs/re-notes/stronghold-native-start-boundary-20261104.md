# Stronghold original: native scenario start boundary

The run-only [driver guard](stronghold-native-start-boundary-20261104.cjs) corrects the start target and distinguishes host startup, delivered input and actual world entry. Its [focused tests](stronghold-native-start-boundary-20261104.test.cjs) pass against retained captures, command receipts and the historical renderer/input source. This is an offline correction ready to integrate into a later authorized native attempt. No new game, browser, recruitment or combat result is claimed.

Evidence: `scratch/runs/20261104-stronghold-native-start-boundary/`. Source is exact Git SHA plus relevant binary diffs, including new-file patches. Existing captures, logs, modules and media are referenced by path and full SHA-256, without copies or source archives.

## What actually started the original scenario

I personally inspected `scenario-confirmed.png` and `world-drained.png` from [eef09d688](stronghold-stable-recovery-combat-20261104.md), and `scenario-confirmed.png`, `opening-world.png`, `launch-transition.png`, `launch-drained.png`, `granary-panel.png` and `recruited-three.png` from [f5f75afb3](stronghold-browser-dependency-combat-20261104.md). The former run's final picture remains Zephyr / Very Easy (1/10), Normal Game / Human Advantage, Rat / Duc de Puce, 8000 versus 2000 gold. The latter's `opening-world` and `launch-transition` are also scenario pictures. Its `launch-drained` actually shows the keep, terrain, world construction panel, minimap and advisor; Granary and recruitment are later genuine world pictures. Filenames and changing whole-page hashes are insufficient scene evidence.

The two runs differ **before** the press at `(777,748)`:

| Retained request | Successful original run | Unchanged-scene run |
| --- | --- | --- |
| 195: mouse move | browser `(782,818)` → guest `(718,569)` | browser `(777,748)` → guest `(713,504)` |
| 198: left down | guest `(718,569)`, mask 1 | guest `(713,504)`, mask 1 |
| 203: left up | guest `(718,569)`, mask 0 | guest `(713,504)`, mask 0 |
| Following capture | 208, misleadingly named `opening-world`: still menu, release queued | 208 `launch-transition`: still menu, queue drained |
| Later activity | 209–221: another gesture at `(777,748)` queued behind the first release | 209–240: no-input stepping |
| Deciding picture | 255 `launch-drained`, step 13824: actual world, queue drained | 241 `world-drained`, step 13184: menu, queue drained |

In the successful run, `input-198.json` records the first down at `(718,569)` and `input-203.json` has only its release outstanding. That release remains queued in `opening-world.json` and ahead of **all** events of the second gesture in `launch-transition.json`. The second gesture therefore does not isolate or prove another launch target. The original independently recorded route in [stronghold-crusader-demo.md](stronghold-crusader-demo.md) identifies the bottom-right hand near guest `(717,568)` as Start. The corrected target `(718,569)` is within that hand. The higher green downward marker over the list is not interchangeable with it; assigning a specific guest handler to that marker is outside this evidence.

## Geometry from actual source

Both old runs used Git **1188e9bf57ef35bd3363fb88b7ca0da442ce696d**, original EXE SHA-256 `9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f`, and canonical module `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee`. Their retained console streams record the logical canvas resizing **860×702 → 800×600** after guest display-mode creation. Screenshot state records the CSS rectangle `(10,194,860,668)`. CSS size is not backing size.

The test reads these actual source methods directly from that Git commit, without launching the emulator:

- `index.html`, `screenCanvasSize` / `resizeCanvas`: guest display-mode size determines the logical canvas; the presentation canvas uses physical output dimensions.
- `lib/renderer.js`, `_computeExclusiveTransform` / `_computeExclusivePresentationViewport`: 800×600 native window, nearest fit into 860×668 output → destination `(0,11,860,645)`.
- `lib/browser-input.js`, `eventPointFromClient`: browser coordinates are floored into logical canvas coordinates first.
- `lib/renderer-input.js`, `_mapExclusiveInputPoint`: logical coordinates pass through physical output and the native viewport, then floor again.

Applying both floors reproduces the **actual recorded** `(782,818) → (718,569)` and `(777,748) → (713,504)`. The new inverse chooses a logical pixel that survives both floors, then its browser-space centre: **`(782.3875,818.0233333333333) → (718,569)`**. A naive inverse native-pixel centre can land one guest pixel too high; the initial focused geometry assertion exposed that mistake before any runtime use. The completed regression tests the actual historical mapping methods and receipts, not just an inverse copied into its own test.

## Readiness and activation contract

The old `ready.json` is explicitly **host launched**, not native input readiness: `running:true`, `guestWorker:true`, `hosts:1`, but `steps:0`, no guest windows, hidden presentation canvas with a zero rectangle. `host.js` registers the frozen host when execution starts. `WineFrozen.step` proves retired slices and settles presentation; it does not assert that a menu is actionable or that a scenario loaded. Its aggregate `ran` is a maximum over guests, so the new checker also validates the sole per-guest ACK, running/frozen flags, tick policy, exact step progression and absence of timeout/error.

The guard requires the visible original 800×600 `Crusader Demo` window, nonzero acknowledged execution, one frozen Worker host, browser isolation, the known geometry, and explicit empty queue / null active and last event / expected mouse mask. Missing fields fail. Foreign held keys/buttons fail. `renderer-input.takeInput` separately holds presses after movement and releases after presses until an empty poll and the normal input-clock floor. A successful browser event, released mouse mask or completed 64 slices does not bypass that queue. The guard does not change the clock, hold floor, queue, game state or guest memory.

At the reviewed Zephyr checkpoint it performs exactly one ordinary gesture:

1. Capture and require both exact scenario RGB patches (Zephyr description and Normal Game/gold panel); await explicit personal review, then recapture to reject stale review.
2. Project guest `(718,569)` through the actual native viewport, verify the browser hit target is `screen`, move, and require the expected queued native coordinates/hwnd/message. Advance acknowledged execution until move drainage; require the scenario still visible.
3. Press left, require native down `(718,569)` / mask 1, advance until drained while held; release and similarly verify native up / mask 0 and drainage. Every phase requires execution after its input.
4. Advance **no-input** acknowledged batches only, checking fresh drained captures each time. There is no fixed sleep or second activation. A finite cumulative execution budget bounds failure; it is not a readiness delay.
5. Unlock only when **all three** exact RGB world patches match: terrain, minimap and advisor hood, with scenario patches absent, followed by personal review and a fresh unchanged capture. These are hashes of actual reviewed world pixels, independent of page chrome, logging, guest-time text, filenames or caller-provided labels.

Failure is terminal. A held left button owned by this guard is released for cleanup, without further steps or gameplay. Unchanged menu/loading, missing presentation, wrong target, incomplete ACK, stale capture/review or exhausted execution budget never becomes world-ready. Unknown scenes remain locked. This conservative exact-pixel gate intentionally supports only the retained viewport, DPR 1, nearest fit, original Zephyr opening camera and the two observed advisor-hood variants. Other scales, camera positions, filters or new artwork require separately reviewed evidence; there is no fuzzy fallback.

## Integration for the later native attempt

Keep the predecessor's `EvidenceBoundary` serialization, full hash verification, native input restrictions, fresh/atomic capture publication, observer and lifecycle limits. Import this helper into the run driver. At scenario selection, create `pageAdapter(page,state,shot,controls)` and `NativeStartDriver(io,{maxSteps:4096,review})`, then install `guardNativeCommands(driver,command)` in the existing queue. `controls()` reads the existing driver's held key/button sets; the guard tracks its own left press separately. `shot(name)` must save a fresh PNG plus state atomically and return `{png,state}`; `review(cap)` must wait for the operator to personally inspect that exact capture and acknowledge `{sha256:cap.sha256,scene:cap.scene}`. Do not implement review as an automatic echo in the real driver.

Dispatch `native-start` through `EvidenceBoundary.run`, and preserve its return value in a command receipt. After this installation all ordinary mouse/key command paths must go through the guarded dispatcher; they call `requireWorld()` before delegation. Before entry, while starting, or after failure they remain locked. Step/state/capture/snapshot/quit retain their original queue and logging semantics; after a native failure only read-only evidence and quit are allowed. No raw parallel command stream may bypass this queue. The tests wire the real page adapter and guarded dispatcher to a clearly labeled model; integration has not been exercised in a new browser.

`requireWorld()` conservatively rechecks the original-camera world patches. This helper establishes and protects the initial world entry boundary; it is not a general combat scene recognizer. Preserve ordinary personal capture review for later camera changes and gameplay. A separately authorized native attempt is needed to demonstrate the corrected gesture and readiness contract live before pursuing recruitment or combat.

## Validation and custody

```sh
node docs/re-notes/stronghold-native-start-boundary-20261104.test.cjs
node docs/re-notes/stronghold-stable-recovery-combat-20261104.test.cjs
```

The focused suite checks nine retained full-SHA PNG/receipt pairs, actual historical geometry/input methods, exact original/failed command coordinates, both premature startup receipts, queued input in the original misleading transition, strict real step ACKs and per-guest negative controls. Modeled dispatch tests exercise move/down/up ordering and drainage, one activation, unchanged/blank scene budget failure, wrong native coordinates, partial/corrupt world patches, toolbar changes, foreign held controls, explicit/stale review, crossed execution capture, concurrent start, failure while held with balanced cleanup, occluded canvas, actual adapter wiring and dispatcher world-control lock. Model transition counts are test results, not game progress. Mutation controls remove the world/ready/per-guest gates in memory and must make the suite fail. The existing immutable-recovery suite remains unchanged and passes.

Initial test-only failures are retained: transparent synthetic black image correctly rejected; the first geometry model incorrectly treated CSS size as backing size and failed the real receipt assertion. The final model uses opaque loading pixels and the backing dimensions from the retained console/source. An intermediate loading fixture unnecessarily re-encoded its synthetic image repeatedly; the final fixture creates that image once. None was a game attempt or runtime failure.

The first readiness mutation survived because the startup fixtures also lacked a valid window, so their rejection did not isolate the host-readiness gate. Added tests independently change running, Worker ownership, isolation, host count, frozen state, execution count and tick policy on an otherwise valid retained world receipt. The readiness mutation is now rejected alongside the world-scene and per-guest-ACK mutations; the initial mutation output is preserved.

Only this note and its `.cjs` / `.test.cjs` changed. No production defect was established; no production code or full build was needed. No runtime, browser, box allocation/resume/stop, lifecycle tool, subworker, successor, deployment, guest write/cheat, SaveLoad, game-check change or unrelated game occurred. No box was assigned. The coordinator's board reports **bx_285595gz STOPPED at 2026-11-04T05:23:13.018Z**; its historical expiry was **05:33:35.510Z**. I did not re-query or resume it; lifecycle ownership remains with the coordinator.
