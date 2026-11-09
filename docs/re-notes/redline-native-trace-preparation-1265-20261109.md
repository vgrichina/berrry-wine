# Redline bounded keyboard trace preparation, 1265

Implemented and tested **offline only**. The concrete experiment is ready for one separately authorized fixture: existing startup/preflight, first comma600, its ordinary capture ACK on success, then ordinary joined quit. Failure retains the existing independent UP, sticky first failure and no-input cleanup, with no period, original, retry or later capture. Native remains REVOKED; allwriters UNKNOWN; edictABA UNKNOWN; SingleTaskSTOP.

Evidence: `scratch/runs/20261109-redline-native-trace-preparation-1265/`. No box, browser, guest, native attempt, local Chrome, worker, agent or deployment was created. Test browser services are inert Node processes. No shared CDP client, custody code, Q2/Q3, host, WAT, Heroes II or CLAUDE file was edited.

## Concrete implementation

`tools/redline-native-trace.cjs` composes the **actual 1235 generated caller**, requiring its SHA-256 `326b2a6fa946c3a5c4a3650285278f742c4ae44e5e1e5190fcedbf633ff8edbc`. It does not introduce another client or replace the caller's pending-map settlement. It reuses `q3-input-wire-observation.cjs` as the single bounded wire recorder, attaching bounded raw frame batches to that recorder's sink. Send and receive records retain request IDs, actual and expected sessions, protocol errors, unmatched/late replies, raw frame bytes and Node monotonic times. Receive time is sampled before JSON parsing. Session mismatch remains observational: the existing consumer still settles by ID alone. No session-policy repair is implied.

Default bounds are 64 tracked input requests, 512 recorder events, 512 raw frames and 8192 bytes per raw frame. Truncation, dropped events and sink failures are explicit; no diagnostic failure settles requests or relaxes a guard. The existing deferred flush is observation work, not a periodic sampler. The log retains Node performance/unix/time-origin/hrtime anchors. These are clock references, not proof that an arbitrary Chrome trace clock maps to Node.

At the actual existing `cp.spawn` site the helper adds:

```
--trace-startup=input,latencyInfo,devtools.timeline,toplevel,disabled-by-default-devtools.timeline
--trace-startup-duration=10
--trace-startup-format=json
--trace-startup-file=<task run>/native-fixture/native-startup-trace.json
```

The executable remains `/usr/bin/google-chrome`. Launch and spawn receipts retain the actual executable, argv, output path, configured duration, monotonic/wall/hrtime references and spawn-call elapsed time. The existing `chrome-startup.json` retains actual endpoint-publication elapsed time; spawn-call elapsed time is not Chrome readiness. All original startup, immutable deadline and caller/CDP/hold limits remain unchanged.

Retrieval runs at the existing cleanup finalizer after actual browser wait and separate stream EOF. It performs filesystem reads only, never `Tracing.end`, input, capture or guest reads. It records file size/SHA-256, parses bounded JSON (64 MiB maximum), preserves EventDispatch keydown/keyup timestamps/durations/pid/tid/args and clock-sync records, and counts input-latency/task events. Missing, malformed, oversized or unflushed files and missing dispatch pairs leave the experiment invalid/UNKNOWN. The full trace remains the evidence artifact. Keyboard pairs may be startup preflight: **comma attribution still requires target, clock and latency-flow correlation**. No automated cause classification is manufactured.

A startup trace can finish before fixture input. That outcome leaves the cause UNKNOWN; it does not authorize a longer trace, retry, new observer or changed input schedule. No second DOM handler, extra sampler, heartbeat or polling loop was added. The original input observer is referenced at its pinned existing path; it is not copied or augmented. The complete `execute` input/admission/capture implementation is byte-identical before and after composition.

## Prepared inputs and future entry

`ready-inputs/experiment-plan.json` contains concrete argv, output path, immutable-deadline requirement and the one-comma plan. `ready-inputs/runtime-pins.json` verifies 893 provider identities. Its six small CommonJS wrappers reference retained providers; no source tree, game media or module is copied. The actual composed caller passed `DRIVER_PREFLIGHT=1`, verifying all pins with `chromiumStarted:false` and `originalStarted:false`.

Preparation can be regenerated in a **fresh owned path**:

```
node tools/redline-native-trace.cjs --prepare <fresh-task-run>
node tools/redline-native-trace.cjs --check
```

The future controller entry is `node tools/redline-native-trace.cjs --fixture` with `REDLINE_NATIVE_TRACE=1`, `REDLINE_RUN=<prepared run>` and a separately assigned finite `BROWSER_DEADLINE`. This note grants no runtime authorization. Existing custody/readiness gates, the external runtime deadline watchdog, and the controller's prearmed independent process-group watchdog remain required. The controller waits for actual caller/watchdog exits and separate stdout/stderr EOF before disarming. The caller entry additionally requires fixture mode. Provider pin failure is terminal before Chrome launch.

After that future fixture, retrieve wire/trace/launch/startup/delivery/shutdown/ACK and process-join artifacts using existing no-input collection; verify SHA-256 and sizes before normal shutdown of the specifically owned runtime. A valid trace must be checked for the actual comma boundary, not merely any startup keyboard event. A long callback still needs stack attribution before naming a handler defect.

## Offline validation

`tools/redline-native-trace.test.cjs` executes exact generated send/receiver code. The old actual1235 consumer has no retained raw boundary (**old FAIL**); the composed version retains it (**new PASS**). Inert normal, reverse-order, late, unmatched, session-refusal, sink-failure and capacity controls pass, preserving ID settlement, 20s CDP timeout, terminal no-send and sticky first failure.

The existing whole controller/service fixture is compiled in memory with the actual generated caller and exact new single-comma controller. Six cases pass: normal, close without ACK, wrong live module, delayed DOWN reply, delayed DOWN service and failed release. The original assertions check pre-CPU/pre-DLL admission, authenticated capture ACK, ordinary joined quit, independent UP and no post-terminal input/capture or period. Real inert process waits, separate pipe EOF and watchdog joins are verified. Actual launch-site receipts prove executable/argv/output/duration configuration without starting Chrome. Joined cleanup invokes retrieval even on terminal cases; inert trace-file controls prove SHA, valid JSON and duration checks plus missing/malformed/oversize/no-key refusal.

Fresh final results are in `final-tests/` and `final-tests.log`. The existing startup suite runs under the fresh `startup-controls/` path. Both focused tests and `flock /tmp/wine-build.lock bash tools/build.sh` pass; negative controls deliberately print refusal errors. `caller-preflight.log` records the no-launch preflight. All evidence paths are owned and fresh. The inherited-writer containment negative control intentionally leaves a ten-byte incomplete `chrome-stderr.gz`; integrity metadata records its CRC/EOF error rather than claiming a completed stream or rewriting it.

`git-base.txt`, `owned-source.patch`, `owned-inputs.patch` and integrity metadata provide exact Git-plus-small-patch recovery. Git is the source archive. No archives, media or module copies were made. Free `/home` remains above 1.5 GB. No new box ID/state/expiry or stop receipt exists. Prior 1235 `bx_qh4wn3gk` / UUID `88f7621f-cd2c-4a06-b9c2-49bf6c513897` was not contacted; its retained receipt reports ARCHIVED/PHYSICAL_DRAINED, unforced stop `stop_204911fc8ca471a8` completed 2026-11-09T11:54:35.927Z, initial archiveAfter 2026-11-09T12:17:45.374Z, final archiveAfter null, expiresAt not returned.
