# SuperTux compound key context, 2026-11-18

Evidence: `scratch/runs/20261118-supertux-compound-key-context-course-progress/`.
Code: `d6c398cf6` (strict pull/push succeeded).

The predecessor scope remains permanently closed. Its run-local pair helper
sent Right and Space as two independently nonced `guarded-input` requests,
each carrying the same all-keys-up snapshot. `controlSnapshot().physicalUp`
is false whenever any renderer physical key or mouse button is held.
`nativeScene.context()` includes that value; `contextFailures()` both requires
physical UP and compares the complete context. A consumed physical Right
therefore suffices to refuse Space. This is an input-contract/helper mismatch,
not a changing image hash. The old original did not retain every post-Right
context operand, so additional changes in that particular original remain
unknown; no endpoint was contacted to reconstruct them.

An actual animated SDL/HTTP fixture reproduces the isolated cause: the only
context operand difference is `physicalUp: true -> false`; its failures are
`input.physicalUp` and `context.unchanged`. Right has an actual native USER
return receipt and Space is cancelled before its physical handler.

The new `guarded-key-chord` endpoint accepts a bounded, declared sequence of
distinct nonmodifier DOWNs under one nonce and immutable deadline. The broker
retains each ticket in-process and advances only after actual native consumption.
Only its exact consumed, unreleased prefix can explain held input at the next
edge. The renderer must hold exactly those keys and no mouse button. Only then
is `physicalUp` normalized for the original complete native scene comparison.
Owner, actor, module, queue, window generation, focus, modal, capture and
delivery-context checks remain active. Release/expiry/cancellation invalidates
prefix authority. The root nonce is tombstoned even after partial failure;
transport cancellation stops the remaining sequence. No partial replay or
replacement authority is acquired.

The production controller now sends a native directional jump as one chord,
retains every edge receipt, requires the complete reply inside its existing
500 ms bound and schedules independent UP from the first consumed edge.
The fixed release cap, 1750 ms release check, 3000 ms operation, five-second
game freshness and sticky terminal rules remain unchanged.

Focused native cases passed: compound success, old-helper isolated refusal,
focus loss, actual guest MessageBox, actual public USER mouse capture,
process identity change, queue replacement, foreign physical key, early
release and delayed reply. Genuine modal/capture cases allow the authored
guest to execute its public API before attempting the second edge. They prove
first consumption followed by second-edge refusal, with independent UP and
individual actual native/watchdog/outer/tool waits. Native single-key success,
focus-loss release and delayed-reply cases also passed. The actual CLI guard
test (including compound release, cancellation and owner changes), 19 connected
send tests, receipt unit test, media manifest check and locked build passed.
The build reproduced module
`0d383140f6d4207d18860e3cb22fc8fcc47a5d260b8d5f2443222396b245fdd5`.

Qualification failures are retained: an initial modeless color-dialog fixture
did not create a modal; the next guest-API fixture attempted the second edge
before SDL had entered its modal. Corrected fixtures explicitly wait for the
authored guest's real API effect. The older controller-settle suite still
intercepts queued `png:` commands although native capture now uses
`native-scene-capture`; its four failed assertions/fault injections are retained,
not counted as passes. An invocation without its required holder failed before
launch. No production context check was weakened to accommodate these fixtures.

The affected original uses the coherent prior exact-image receipt graph with
only `lib/cli-guarded-input.js` and `test/run.js` changed in its sealed runtime
source manifest. All 789 media/settings pins matched. Runtime growth stayed in
owned tmpfs with an independent finite watchdog and disk-floor cancellation.

The affected original visibly reached the title, bound the whole issued image,
and consumed a personally selected Start Game Enter. A later personally
inspected whole frame shows Slot 1 Free selected. Startup/draw-phase black
captures authorized no input. A run-local duplicate review-record write failed
before DOWN; a new complete capture/review preceded the actual Start Game input.

The Slot 1 Enter body was sent 9 ms after dispatch, but no response headers or
reply arrived before the 500 ms timeout (error returned at 517 ms). Native
consumption/effects of this Enter remain UNKNOWN. Independent UP acknowledged
at 1762 ms after dispatch, exceeding the 1750 ms check by 12 ms; its actual
release-child wait was 0/both EOFs. The scope permanently closed, with no later
endpoint request. A subsequent capture invocation stopped at the local sticky
closure check before sending. No unchanged retry or partial gesture replay ran.
The original therefore did not reach gameplay or exercise the compound jump.
No landing, course progress/completion, life-loss observation or ordinary Quit
is claimed for this scope.

Closure was host cancellation: the native exit recorder retained
`.cancelled/SIGTERM`, not an ordinary native Quit. Native, watchdog, outer-child,
outer, driver-child and holder actual waits all returned 0/both EOFs; the finite
supervision receipt reports no leak. All recorded runtime and supervision PIDs
were absent. The detached driver's self-completion is retained, but its invoker
did not record a parent wait; no such actual wait is invented. The messageboard
watcher ended 143 separately from the native runtime.

The 119 original disk samples stayed above the floor (minimum 1,524,203,520
bytes). Shared disk capacity crossed below 1.5 GB during finalization after
runtime closure; task-wide continuous compliance is false. Only this worker's
closed evidence was compacted: 52 larger JSON/patch files have lossless gzip
recipes, and 854 small qualification JSON records have a verified JSONL gzip
archive with per-record SHA/length and original paths. Recovery instructions
were durable before unlink. Selected original PNGs and unique authored inputs
were retrieved and verified before tmpfs removal. Shared peer recovery restored
capacity; no foreign evidence, media, history, DB or security hold was changed.

The remaining original barrier is the recorded no-reply confirmation timeout;
without contacting the closed scope, the internal ticket outcome cannot be
distinguished further. The proved two-key contract fix is published and native
tested, while the requested manual landing/progress/Quit remains unmet.
No boxes, workers, Wine, Python or deployment were used. Final box ID null,
state NOT_CREATED, expiry null, stop receipt null.
