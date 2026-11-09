# Q3 transport boundary observations, 1731

Diagnostic instrumentation only. No causal production repair, native startup
success, or browser-internal timing is claimed. First-failure, ordinary cleanup,
ID routing, debugger state, auto-attach and the 20-second request deadline stay
unchanged. No Chrome, game, box, other agent, worker or deployment was started.
Box ID/state/expiry/stop receipt: NOT_CREATED / not applicable.

Evidence: `scratch/runs/20261109-q3-transport-boundary-observation-1731/`.
Recover source from `gitbase.txt` plus `owned.patch`; `published.txt` identifies
the published commit. Git is the source archive. Small existing Python test
inputs are staged individually; no source/media archive is created.

`q3-current-foreign-closure-v1.runCaller` installs the transport observer before
the existing execution-boundary wrapper. The actual generated relative caller
therefore observes the bytes passed through to the base WebSocket API after
any expression transformation. Its output is the execution-boundary output
name with `-transport.jsonl.gz` replacing `.jsonl.gz`, opened exclusively with
mode 0600. The sealed manifest authenticates the two changed owning providers;
there is no separate unpinned preload or alternate consumer.

The transport stream records pre-send, synchronous send-return or send-throw,
an existing caller-supplied callback's success/error, public raw-message entry,
transport error/close, consumer inbound/outbound, deadline and resolve/reject
settlement. WHATWG WebSocket has no send callback; this route supplies none.
`send-return` means the API returned, never socket flush or browser acceptance.
Callback wrappers preserve arguments, receiver, return and thrown exceptions.
The consumer wraps its original resolve/reject functions without adding a
promise continuation or changing dispatch. Cleanup/cancellation rejections
and late unmatched replies retain request identity.

All timestamps use the same Node `hrtime.bigint` clock, serialized as decimal
nanoseconds. Public message entry is stamped before hashing/parsing. Each
transport row has an increasing sequence. Exact UTF-8 byte length and SHA-256
correlate consumer envelopes and base transport bytes; IDs, sessions, method
and numeric protocol error code provide bounded metadata. No raw JSON, params,
results, URL, expression, error text or secret payload is recorded by these
diagnostics. Existing unrelated logging is outside this change.

Bounds: 512 rows per socket (last row marks the limit), 512 startup consumer
rows, 64 request and target metadata entries, 256-character tokens (longer
tokens become SHA-256 identities), and protocol metadata parsing only up to
64 KiB. Unsupported raw data types report unavailable; large messages retain
byte identity with parsing explicitly skipped. Recording stops at successful
navigation settlement or socket-close invocation; stopped transport paths
forward directly without further hashing/parsing. Observer writes cannot
replace protocol failures. There are at most 96 unref'ed 250 ms scheduling
timers, armed on first send, with armed time, expected delay and observed excess
delay. These are bounded Node timer observations, not a continuous stall trace.

Validation on the final code:

- `node tools/q3-page-session-startup.test.cjs .../final-peer`: all 16 full
  generated-runtime peer cases plus transport controls. Actual compiled
  consumer, native input/cause hooks and real transformed createChain run.
  Exact retained native envelopes are checked against byte hashes. Delayed
  inbound and a controlled Node stall are distinguished; synchronous replies
  settle before send return. Throw and error events preserve first error;
  late ACK stays unmatched after the unchanged deadline and close ACK. Each
  child closes normally with separate stdout/stderr EOF and profile removal.
  Callback success/error/throw identity, post-expression-transform bytes,
  scheduling exhaustion, record exhaustion and failed observer writes pass.
- `node tools/q3-current-foreign-closure.test.cjs .../foreign-final`:
  actual staged relative caller and Git-free composed consumer, 27 refusal
  controls.
- `python3 -B tools/q3-checkpoint-caller-integration.test.py .../caller
  --foreign-closure`: actual generated owning caller, first-error propagation,
  read-only joins and independent watchdog join.
- `python3 -B tools/q3-versioned-native-lifecycle.test.py .../lifecycle-final`:
  both actual generated prelaunch/custody/staged paths stop at DRIVER_PREFLIGHT
  before Chrome; independent watchdog joins.
- `flock /tmp/wine-build.lock bash tools/build.sh`: pass (`build-final.log`).

Earlier `peer`, `peer-final`, `validated-peer` and `acceptance-peer` iterations
are superseded by `final-peer`. The first iteration crossed an output
filename change; later iterations exposed a test scheduling mistake: a stall
relative to request 6 could fall entirely between sampling ticks because real
createChain initialization takes time. The corrected test overlaps the next
tick relative to the first send. Production timing/policy was not changed to
satisfy that test. The final rerun also covers direct forwarding after recording
has stopped, so later traffic incurs no diagnostic hashing/parsing work.

Observation limits: the earliest supported public WebSocket message event is
after implementation buffering/decoding and Node event dispatch. This is not
kernel TCP ingress, a frame parser tap, browser receipt, command dispatch or
browser completion time. The existing expression wrapper can also consume its
own diagnostic messages before ordinary routing; the lower transport observer
still sees them. Hashes preserve byte identity, not recoverable payloads.
Scheduling samples cannot exclude stalls between samples or beyond their
budget; diagnostic hashing/writing adds bounded observation work. No clock is
subtracted across processes. A separately authorized runtime observation can
use these boundaries to narrow a delay; establishing Chromium's internal
cause still requires direct browser-side dispatch/dependency evidence.
