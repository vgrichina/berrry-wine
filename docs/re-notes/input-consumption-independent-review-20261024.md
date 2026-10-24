# Input consumption timing independent review — 2026-10-24

Verdict: **REJECT** candidate `01da39b4471d7f2827be043804b755aa9bb6b141`.
Its parent and the observed remote main are
`adb2852f0ad9944625d809fd9b73c50dc3d4514e`. This review branch starts from
that accepted parent and publishes review evidence only. It does not integrate
the rejected implementation or change main.

The trace labels raw batch-clock state as `lastGuestTick`, despite the production
startup clock mapping guest-visible ticks. In `test/run.js:4422`, the startup
wrapper maps the return of `batchClock.getTicks()` through startup dilation.
The raw clock still writes its unmapped value to `tickState.lastTick`.
The new snapshot at `test/run.js:4473` emits that raw value as `lastGuestTick`.
The candidate documentation explicitly describes this field as the last tick
read by the main guest. It is a different clock domain in this supported mode.

The source-only reproducer executes the exact production startup wrapper and
trace setup, using the real batch, startup, guest-clock and trace implementations.
With factor `0.01`, `maxMs=30000`, batch step `200`, batch `7`, and one guest
tick read, the guest receives **14**. The observation says:

```text
[input-schedule] scheduledBatch=2 action=keydown correlation=unavailable batch=7 guestMs=14 clock=batch lastGuestTick=1400
```

The raw `1400` is not a stale guest return: the only guest read returned `14`.
This is a timing correctness defect, not formatting. The registered Comanche
Gold startup configuration uses this factor; the CLI also supports explicit
startup-clock configuration. Recording an actual guest-visible last return, or
making its unavailability/raw domain explicit, needs a bounded producer repair
and a regression for the production wrapper before reconsideration. This review
does not modify the candidate to make its oracle pass.

## Controls and scope

The candidate's `test/test-cli-tick-ms-input.js --source-only`,
`test/test-batch-clock.js`, and `test/test-guest-clock-source.js` pass. The first
executes production schedule/enqueue/poll/route/DispatchMessage hook bodies with
real clocks and controlled MSG memory; it covers schedule batch 2, dequeue batch
7, and dispatch batch 11, rather than only mocking the trace helper.

The adjacent `input-consumption-independent-20261024/independent-controls.js`
adds independent controls. Its normal invocation exits 0 after confirming the
defect; `--assert-correct-last-tick` exits 1 on `1400 !== 14`. Both receipts are
retained. Other independent controls pass:

- The full production renderer input module is installed and its actual
  `takeInput`/`checkInput` methods retain the raw event object, so WeakMap enqueue
  identities survive dequeue. Identical balanced key and mouse events retain
  distinct observation IDs, FIFO order, and full message fields. The producer's
  simpler renderer queue test alone did not establish this identity property.
- Real scaled/mapped publish observations spend no guest tick probes. Batch
  snapshots do not change clock state. Ordinary tracing enabled/disabled returns,
  routes, legacy logs, FIFO and batch state agree.
- Duplicate DispatchMessageA/W tuples at a later batch carry
  `correlation=unavailable`, with no inferred enqueue/dequeue identity.
- Mixed record types produce 1000 records and one notice, with exactly 1000
  snapshot calls. No further clock samples occur after the cap.
- Empty polls add no observation; a route request before any dequeue has no
  timing identity. After a consumed event, the existing last-event state remains
  available by design. The inspected WAT call sites invoke routing only after
  nonzero `host_check_input`; calling route after an empty poll is not evidence
  of another input consumption. Existing focus/explicit-hwnd behavior is preserved.

The cap bounds output and snapshot calls, not every operation: enqueue identity
bookkeeping and dispatch MSG decoding still occur after suppression. The identity
map uses weak keys and is not an independently retained event queue. No correctness
failure was established in that behavior.

## Reproduction and evidence

Run with a source tree at the exact candidate (no build or guest needed):

```sh
node --max-old-space-size=256 docs/re-notes/input-consumption-independent-20261024/independent-controls.js /path/to/candidate-source
node --max-old-space-size=256 docs/re-notes/input-consumption-independent-20261024/independent-controls.js /path/to/candidate-source --assert-correct-last-tick
```

The complete renderer-input module runs in a Node VM context, without browser,
canvas, Wasm or guest construction. Unused renderer region metadata is supplied
as a minimal placeholder; the tested FIFO/key-state path uses no guest memory.
Production API hook bodies use a controlled 1 KiB MSG buffer.

Adjacent receipts include candidate Git blob IDs, SHA-256 identities, exact test
commands, memory admission, output hashes, elapsed times and outputs. Producer
`tests.json`, `publication.json`, and `cleanup.json` were read from immutable
`/tmp/input-consumption-timing-oct24/` and their evidence is not elevated to native
or gameplay qualification.

External artifact root: `/tmp/input-consumption-independent-integrate-oct24/`.
`candidate-source/` retains the verified tested source files for direct replay;
`source-identities.json`, `tests.json`, `control-*.log`, `admission.json`,
`publication.json`, `resource-final.json`, and `cleanup.json` record the task.
No compiler, VM, guest, browser process, packages, downloads, deployment or box
operation was used. No boxes were assigned: box ID/state/expiry are N/A, all
unused, and lifecycle ownership stays with the coordinator. No native or
gameplay acceptance is claimed. The worker stops after publishing this rejection.
