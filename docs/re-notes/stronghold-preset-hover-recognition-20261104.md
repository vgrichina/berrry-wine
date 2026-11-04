# Stronghold preset1 hover recognition: offline physical-route repair

The run-owned physical route now recognizes the exact preset1 hover demonstrated by command17 of [current-request native replay](stronghold-current-request-native-20261104.md), commit `aabe0e753`. Recognition validates every RGBA pixel in the complete measured game rectangle. MOVE, a separate fresh capture-bound personal hover review, and balanced preset press are separate dependent commands. Offline tests exercise the actual repaired driver, production input queue, actual wrapper review/deadline functions and unchanged current-request fetch/ACK helpers. They establish the press boundary in fixtures; they establish no live preset selection, native Start, world or gameplay.

Evidence and replacement helpers are in `scratch/runs/20261104-stronghold-preset-hover-recognition/`. Only this note is committed. The repair is confined to run-owned helpers; no production source, module, media, browser, heavy CLI, box API, lifecycle or subworker is used by this task. There is no full-build claim. The exact predecessors are [current-review publication](stronghold-current-review-publication-20261104.md), `7e58e56fa`, [split gesture reviews](stronghold-split-gesture-reviews-20261104.md), `70b17e57b`, and [bounded route continuation](stronghold-bounded-route-continuation-20261104.md), `03131dd67`.

The positive inputs are the recovered immutable command16 setup and command17 MOVE-only PNGs, not generated images. Their PNG SHA-256 identities are `a4680bc7e74ab8e3d267757f6c65edb77be84b6512c3b77781af376b765cdaba` and `c8d32e98128dc9cd6934ac56c3e53244c9a168645ee48a0868c7be4c8902ece7`. Required original RGBA files were restored from adjacent `.rgba.gz`, retaining the compressed originals and verifying both the coordinator's roundtrip manifest and the original native-run seal. Full RGBA SHA-256 remains setup `484dc73c43260d83295259e207d5f8b03b59b906fa1c63338eb7e46bb1341e42`, hover `7460381d49ec5ce34158095fce4334bb4e3ff7e955ff878806a0f96ec9102c93`. Both original PNGs decode to those exact bytes. The retained hover image was personally inspected offline for this diagnosis; that inspection grants no live input permission.

`hover-layout.json` pins the complete hover rectangle digest `cee938f27d78daa6d2260bad96d60852ac92d4289730a46cc4a21d3697b4c0ac`, the exact hover-region pixels, the unchanged surrounding pixels, and independent column-major hashes. All11678 changed pixels lie inside inclusive x26–147/y678–796. The measured rectangle remains x10–869/y194–861. The primary recognizer requires the full rectangle hash, exact artwork inside those bounds, and unchanged setup pixels everywhere else. The independent recognizer uses the predecessor's separate column traversal over every RGBA pixel, including the hover artwork. No pixels in the game rectangle are masked or tolerated. The setup, earlier and intermediate identities remain unchanged. Browser chrome remains outside the original measured game rectangle.

The driver's stable-setup prerequisite is unchanged: arrival at most3072 cumulative steps, then three further256-step stability captures, then `route-review` with fresh personal setup review. `route-next` now checks that reviewed setup's presentation identity, emits only the original physical MOVE to native(67,491), client(84,733), drains it with the existing exact telemetry, and requires `actual-scene20-preset1-hover` from both recognizers. It returns `preset-hover-review`; it neither requests review nor presses.

`route-review-preset-hover` is the separate review command. It requires the same recognized hover and presentation identity, publishes the actual wrapper's new request bound to this command index, unique request ID, full PNG SHA, frozen steps and timestamp, and waits for a separate personal VIEW/ACK. After the review, the driver recaptures and checks freshness before returning `preset-press`. `route-press-preset` requires that completed phase, captures again, checks the reviewed presentation identity and exact hover, then emits only balanced down/up at the same projected point. It contains no review wait. It checks the resulting scene normally; unexpected results latch failure. An exact recognized hover alone grants no press permission.

The repaired wrapper supplies its existing `commandLive` function to this driver. The driver checks it before/after capture, around review, and immediately before each normal physical event. Expiry during a capture therefore rejects before down. Failure cleanup can release only its own held press, without further stepping or retry. The wrapper's original command/review deadline, browser deadline and operator latch remain authoritative. `operate.py` changes only its action list to admit the two new command names. `operator-state.py` is byte-identical to the predecessor. The publication helpers are reused unchanged from `20261104-stronghold-current-review-publication/`; fetch still grants no ACK and an older retained request still grants no permission.

One actual `PhysicalRoute`, one immutable evidence queue, the nonblocking exclusive operator lock, cumulative4096 route steps,64 per ACK,16384 navigation steps,360000ms browser duration, original absolute40-second command deadlines including reply inspection, six-minute launch window, ten-minute TTL and five-minute expiry reserve are preserved. The first failure remains terminal, and only quit NEXT is admitted after failure. Counters, review phases and deadlines are never reset to recover permission.

Focused results are in `driver-controls.json`, `transport-driver-result.json`, `layout-hover-controls.json`, `operator-entry-controls.json` and their logs. Twenty-five actual-driver cases include stable setup → exact MOVE → recognized hover → separate wrapper review → press, early press, missing setup review, stale setup, wrong/missing hover or foreign layout, unexpected changes inside or outside the hover region, missing/late/stale/unviewed review, wrong request/command/steps/capture/scene, operator latch, output/tick changes during review or before press, and deadline expiry during press capture. No negative issues a preset down. The positive fixture asserts client(84,733), native(67,491), separate review, exact event order, balanced controls and all cumulative64-step ACKs. Its existing Zephyr image is an offline post-press fixture, not new route evidence.

The filesystem transport integration runs the actual repaired driver and actual wrapper's `personalReview`, then calls the unchanged `fetch` and `acknowledge` functions separately. Fetch leaves the review directory empty. Four events (Custom Game move/down/up plus preset MOVE) remain unchanged while review is pending and after its timely successful reply is inspected. Only the next press command adds preset down/up, ending with six events and1280 cumulative fixture route steps. Twenty-five focused layout negatives include region-edge changes, altered hover artwork, half-highlight, exact hover transplanted onto an earlier layout, opacity and geometry failures. Generated negative pixels exist only as in-memory test mutations; no new positive image is introduced.

Exact predecessor controls are reused with output redirected into this run:18 operator, six actual-wrapper personal-review, four transport cap/deadline/latch, six split-phase, nine bounded-route, and three positive/48 negative layout controls. The new driver and recognizers are injected into the retained route/layout tests; their synchronous old fixtures supply a test-only no-op deadline callback. The focused new driver tests use the actual wrapper deadline function. Actual-wrapper top-level setup and the complete36-file relative helper closure pass without calling `main` or importing/launching a browser. Ten unchanged publication controls pass, including delayed old/missing request, wrong binding/capture, replacement, inspection/ACK deadline, no early input and never-published rejection after40.240 seconds. The actual nonblocking lock, late successful reply rejection, first terminal latch and quit NEXT are also checked.

All three predecessor seals verify unchanged: native444 files/42616379 bytes, publication234 files/170021 bytes, split323 files/14995403 bytes. Their seal SHA identities are retained in `predecessor-seals-verified.json`. Provenance records the initial and final test Git SHAs, relevant `git diff --binary`, owned new-file patches, narrow predecessor helper deltas and the final artifact seal. Git remains the source archive; no source tree archive or copied production module/media is created.

The offline controls are runnable from the checkout, with results written only to this run:

```bash
node scratch/runs/20261104-stronghold-preset-hover-recognition/layout-hover.test.cjs
node scratch/runs/20261104-stronghold-preset-hover-recognition/driver-controls.test.cjs
python3 scratch/runs/20261104-stronghold-preset-hover-recognition/transport-driver.test.py
python3 scratch/runs/20261104-stronghold-preset-hover-recognition/retained.test.py
python3 scratch/runs/20261104-stronghold-preset-hover-recognition/publication-controls.test.py
python3 scratch/runs/20261104-stronghold-preset-hover-recognition/operator-entry.test.py
node scratch/runs/20261104-stronghold-preset-hover-recognition/wrapper-setup.test.cjs
python3 scratch/runs/20261104-stronghold-preset-hover-recognition/verify-evidence.py
```

The next native replay is **PREPARED ONLY**. The coordinator must check launch gates immediately before dispatch and assign a fresh runtime, expiry, close/recovery schedule and authorized transport. Do not resume `bx_3gvchvrj`: the coordinator reports it stopped normally at **2026-11-04T12:28:46.786Z**, historical expiry **12:56:17.203Z**. This worker has no assigned box and returns no runtime custody; coordinator lifecycle ownership is unchanged.

For that separate assignment, stage the nine replacement runtime files from this run: `successor-driver.cjs`, `route-driver.cjs`, `navigation.cjs`, `actual-layout.cjs`, `independent-layout.cjs`, `freshness.cjs`, `presentation.cjs`, `integer-route-point.cjs`, and `hover-layout.json`; also stage this run's `operate.py` and unchanged `operator-state.py`. Stage unchanged publication `review_publication.py`, `review-request.py`, `ack-review.py` beside that assignment's newly authorized `runtime_io.py`. Resolve and SHA-check every file in `complete-helper-closure.json`, retaining the explicit predecessor sibling paths. Do not blindly reuse the old `prepare.py` equality check or its JSON extension list: the new hover JSON is required, and these replacement helpers intentionally differ. Supply a fresh release with the wrapper's retained compatibility authorization label plus the actual new assignment/box/deadlines. Recheck complete dynamic inputs, original2415 runtime pins, original module/media path hashes, actual wrapper/Puppeteer CJS/ESM/executable prerequisites, isolation/cache/HTTP and launch-order checks before the sole Chrome. No new runtime or launch qualification is claimed here.

Reach original ChooseType through the unchanged reviewed physical title/menu route; separately inspect each command's successful reply before submitting its dependent successor. Retain one route instance through `route-review-choose`, `route-review-hover`, `route-gesture`, bounded arrival, three stability commands and separate `route-review`. Use current-request fetch → personal VIEW → separate ACK for every review. At the preset boundary the runnable command sequence is:

```bash
# STRONGHOLD_REPLAY is the separately authorized fresh local run directory.
set -e
python3 "$STRONGHOLD_REPLAY/operate.py" route-next
# Require its timely inspected success: continuation preset-hover-review.
python3 "$STRONGHOLD_REPLAY/operate.py" route-review-preset-hover > "$STRONGHOLD_REPLAY/preset-hover-review.log" 2>&1 &
stronghold_hover_operator_pid=$!
python3 "$STRONGHOLD_REPLAY/review-request.py"
```

Stop here and personally VIEW the exact returned local capture during this pending command. Set `STRONGHOLD_HOVER_OBSERVATION` from that fresh inspection only. Then invoke ACK separately, wait for the operator's own reply inspection and only continue after success:

```bash
python3 "$STRONGHOLD_REPLAY/ack-review.py" "$STRONGHOLD_HOVER_OBSERVATION"
wait "$stronghold_hover_operator_pid"
# Require successful operator inspection before its original deadline,
# continuation preset-press, and no terminal latch before this next command.
python3 "$STRONGHOLD_REPLAY/operate.py" route-press-preset
```

This sequence is conditional on each preceding success; a failed fetch, VIEW/ACK, reply or deadline requires quit NEXT after the exclusive lock releases, with no press, retry or deadline extension. A successful preset command still requires fresh Zephyr recognition and the unchanged separate handoff/native-Start guards. Offline results supply no Start or gameplay permission. This single task ends after the explicit-path note commit and one strict pull/push publication.
