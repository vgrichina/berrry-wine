# SuperTux menu failure cause and setup timing, 0415

Evidence: `scratch/runs/20261109-supertux-menu-failure-cause-0415/`.
Offline production repair; no browser, game, box, agent, worker or deployment.
Git base: `bc6e3fc2ed7ce9cb573097569b5077d98b83d8a0`.
Source recovery uses that commit plus `owned.patch`, including the new test;
there are no source, media or module archives.

Super0400's historical map-down cause remains **UNKNOWN**. Its source was
12,109 ms old, beyond the unchanged 12,000 ms cap, but the original exception
was not retained. This repair demonstrates the loss with a new offline causal
reproduction; it does not recover or prove the historical exception.

The actual composed menu action retained an in-memory `Error.cause`, then the
retained numbered consumer serialized only `String(error)`. The failed reply
also contained only that string, and the helper reduced it to “command failed”.
The new consumer atomically publishes `terminal-failure.json`, adds the same
structured detail to `first-failure.json` and the negative numbered reply,
then the actual `requestReady` sender retains it on its thrown error and in
`transport-closed.json`. The first terminal record prevents another consume
from replacing the original cause. A failed notification preserves the original
exception. If diagnostic storage itself fails, sender diagnostics do not replace
the actual sender error.

Records preserve names, exact messages, codes, nested causes, CDP methods, pulse
receipts and stages. Positive exception evidence distinguishes stale refusal,
helper ACK timeout, storage error and browser error; other causes stay unknown.
Input CDP rejections also survive the accepted pulse's string-only receipt via
an observing wrapper. This wrapper adds no timer or retry, and retains the
original pending operations and independently scheduled UP.

Each composed execute records command admission, original capture production
and completion times, review-storage read start, input admission, stage entry
times and observation time/source age. Here `commandAdmittedAt` means entry to
driver execution, and `captureReadAt` means the driver's review-storage read
start; it does not claim to time the human image inspection or the helper's
earlier metadata read. Capture timestamps retain the binding's conservative
pre-screenshot timestamp. Successful commands publish `command-ID-timing.json`;
the helper publishes `request-ID-timing.json` with helper start, readiness,
submission and ACK-read times. Failures retain their corresponding timing.
These records expose capture-validation, decision/submission, input and
post-input delays without making old pixels younger.

The 12-second cap, 8-second aim, runtime/startup/ACK/hold caps, identity checks
and immutable deadlines remain unchanged. The outer UNKNOWN wrapper deliberately
does **not** acquire the inner stale code: generic transport must never convert
this session's failure into a refreshable success ACK. No later input/capture,
automatic route, replay or retimestamp is authorized. Inspection found no setup
operation proven unnecessary, so no validation or setup work was removed.

`tools/supertux-menu-diagnostics.test.cjs` invokes the actual composed execute,
real numbered transport, real bound identity/freshness chain and accepted pulse.
A separate Node setup helper reads the exact capture and writes the review
before calling production `requestReady`. Only CDP pixels/identity effects are
offline fixtures. The chain's clock supplies stale controls without changing
the captured timestamp. Old production from the Git base fails because its
terminal record is absent (`old-proof.log`); its original first-failure/reply
and the actual sender wait/stdout/stderr EOF remain in `old-proof/stale/`.
New production passes (`acceptance.log`):

- Fresh ArrowDown and delayed successful DOWN, with balanced independent UP.
- Stale at first check and expiry during asynchronous identity validation.
- Missing review storage, actual numbered CDP error and disconnected CDP.
- DOWN ACK timeout while the real delayed reply remains pending; UP completes
  first, and the physical promise drains without replay.
- Rejected DOWN retaining its exact browser exception, followed by independent UP.
- Actual helper command-ACK timeout, sticky later sender/consumer refusal,
  unchanged first failure, no refresh/success ACK and no later capture.

Regression checks pass: menu failure, numbered composition/lifecycle, complete
startup latch, 30 Pause-controller Node children, and the review-client suite
with actual HTTP/CLI/numbered callers and real wall-clock stale negatives.
`flock /tmp/wine-build.lock bash tools/build.sh` passes (`build-accepted.log`).
The isolated review-client execute fixture now supplies its lexical `latest`
and production-style `save` dependency. Initial fixture failures and a run
started against an outdated composition pin were retained; they are not
production acceptance. An existing menu test now expects terminal re-entry
to refuse before calling another consumer.

Composed driver SHA-256:
`3793f2757d4189fed48a5f8ec898e25722cb9c9787429db1387d09345c03a48d`.
Provider hashes in the run manifest additionally bind the helper implementation;
the generated source references those helpers rather than inlining them.
Final test and build logs plus the small source patch are hashed in the run.
Free /home remains above 1.5 GB. No Q2, Warcraft or shared-custody files changed.
Box ID/state/expiry/stop receipt: **NOT_CREATED / null / null / null**.

Next, only under separate authorization, a fresh original can use these timings
to choose setup actions promptly and retain the exact cause of any refusal.
This task provides no new gameplay acceptance. Single task stops after publish.
