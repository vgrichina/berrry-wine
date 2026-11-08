# Darkstone quit: validate timeout before publication

The exact [2025 consumer](darkstone-current-bat-20261108.md) supplied
100,000 ms to an ACK client with a 55,000 ms maximum. The client rejected
before writing anything. Its wrapper then incorrectly treated that known
prepublication error as uncertain publication and persisted a closed transport.

`tools/gltron-logical-fps-local.cjs` now exports its existing timeout validator
and uses it in `commandAck`; its bounds and publication behavior are unchanged.
`tools/darkstone-command-transport.cjs` adapts the exact selected transport
SHA **0e804950876a8e7b8e6f0fa399b3e0d4cce38861b21c771b7aa131db1d22ab85**.
It invokes that same validator before acquiring the writer lock, reserving an
ID, or publishing. Its default quit timeout is a legal **55,000 ms**; the
non-quit default remains 1,000 ms. An explicit invalid timeout is refused,
never silently clamped. Changed source is refused before loading.

The actual client's invalid-timeout semantics leave a fresh transport usable:
there are no filesystem effects. Tests establish this directly, reproduce the
historical wrapper's sticky mistake, and show the repaired wrapper can use the
same ID for a subsequent legal request. This exception applies only to timeout
validation before the ACK call. Every exception after entering `commandAck`
still persists sticky closure, even when a rename succeeded immediately before
an exception. Lost/late ACK, wrong ACK ID, existing UNKNOWN, missing prior ACK,
duplicate ID, cleanup, and consumer failure remain closed. No historical
transport is reopened and no published command is replayed.

Evidence is in `scratch/runs/20261108-darkstone-quit-admission-repair-2054/`.
Its small `consumer.cjs` preserves the exact 2025 browser adapter's source guard,
gzip logging, stream-drain ordering and module-reference behavior, and wires
both request and consumer to the repaired transport. `request.cjs` passes an
omitted timeout through to the legal quit default. The browser source is built
for offline integration tests; this task did not execute its runtime launcher.
A future fresh run must stage its own runtime inputs and output destination.

Validation passed:

- **25 focused tests**: real ACK client, exact transport consumer, legal quit
  queued/executed once, invalid timeout publishes nothing, lost/late ACK and
  post-rename exception stay UNKNOWN without replay; existing close/logger tests.
- The actual owned consumer's repaired close/execute functions run with real
  Node children and inherited stdout/stderr writers. Only CDP/page observations
  are substituted. ACK and profile removal wait for terminal drain and log EOF.
  Reduced test-only drain caps and injected log-EOF failure retain the profile,
  suppress cleanup/quit ACK and close transport. Production caps are unchanged.
- **81 existing GLTron checks**, including ACK-client regression and offline
  compiled branch fixtures; no Chrome or game launch.
- `flock /tmp/wine-build.lock bash tools/build.sh` passed; canonical wasm
  2,184,500 bytes, compat 2,187,146 bytes. Peer source changes were not edited,
  staged or included in this commit's recovery patch.

The first focused invocation had three fixture failures: nested JavaScript
newline escaping caused the inherited writer to exit early, and cleanup hooks
removed its temporary directory before logger finalization. Those tests were
fixed; the initial failure log is retained separately from both passing runs.

The related-consumer survey records 78 same-call wrappers, including 35 with
the exact selected bytes. Those 35 can use this guarded adapter without any
historical-file rewrite. Other revisions require review. Exact Q2 2025 and TR2
2027 consumers already validate their timeout budget before entering the sticky
ACK catch; they are not affected by this invalid-timeout admission error and
were not changed. Active peer paths were not edited.

Recovery uses the recorded Git SHA plus `relevant-uncommitted.patch.gz` for the
small owned tracked changes, and `owned-source.patch.gz` for this run's new
consumer/request/transport/audit inputs. Both are reverse-apply checked against
the tested files. Historical source dependencies are referenced by existing
path, SHA and retained predecessor recovery patch; no source archive or
media/module copies were made. Every regular evidence file is inventoried
without an extension filter, with the manifest's own row explicitly unhashed.
Gzip artifacts are independently decompressed twice and original size/SHA/CRC
are compared; logger producer receipts are checked against recovered bytes.

No Chrome, game, box, remote allocation, guest write, configuration change,
deployment, worker, old-run deletion or UNKNOWN replay occurred. Box **NONE**,
state **NOT_CREATED**, expiry **null**, stop receipt **N/A**. Local test/build
commands had independent `timeout` deadlines; no remote watchdog was needed.
Sampled `/home` free space stayed above 1,500,000,000 bytes; no RAM gate.

The canonical new pair remains **characters.lpl**, 1,342,324 bytes, SHA-256
**2c78a17064029385dee4206c9314673debb4de05205ae63d2ff144b9e6081546**
and **game641d_6af0de53.sav**, 3,204,341 bytes, SHA-256
**cb2ca8093b2ffe45133cda87e3eea9ceafad66fd82246684ec40dd97306e66fc**.
35/35 remains the last numeric reading, without post-reload qualification.
Historical shutdown limits and retained-profile status stand. A separately
authorized fresh original may qualify normal quit using this repair and the
current native save; this task did not launch it. Full27/parity/audio/FPS remain
open. RELEASE and STOP.
