# MCM Worker-service prerequisite: current Boids protocol differs

No production latency repair was established, and no original MCM was launched.
The current small production Boids route uses **GPU stream v2 `d3dim-gps`**,
whereas the November 7 latency control used the retired legacy D3DIM WebGL
protocol. The old readiness field, `guestWorker.d3dStats.renderEndpointId`, is
absent even while the current guest and renderer make visible progress.
Changing that diagnostic readiness predicate is not a runtime fix or backend
credit. MCM remains a provisional historical27 D3DRM candidate; throttle,
combined turn at speed and ordinaryQuit remain unproved.

Evidence: `scratch/runs/20261120-mcm-worker-service-latency-quarry-control/`.
`analysis.json` correlates requester bounds with bounded read-only spans;
`current-gps/{capture,spans,evaluations,workers,roles}.json` (evaluations is
`.jsonl`) retain the raw observations. `current-gps/boids.png` was personally
reviewed: dark scene, thin blue wire outlines and one magenta triangular shape.
The earlier `startup.png` shows multiple colored shapes in the same Boids scene.
Neither is an MCM capture or an input consequence.

## Actual correlation

One current-protocol control completed full unchanged capture-chain validation.
Before-capture live validation took 278.37 ms; post-screenshot live validation
took **31.92 ms**. Its first renderer identity request lasted 184 ms by requester
wall bounds. Two natural exclusive renderer drains overlap about 182.6 ms of
that request: one finishing at 04:39:09.582Z, followed immediately by a 155.92-ms
drain ending at 04:39:09.739Z. In the guest, slice 25's `ex.run` lasted 184.83 ms,
including a **166.44-ms synchronous GPU doorbell wait** for ring 134006592. The
renderer drain completed immediately before that wait returned. This directly
locates a real service interval inside ordinary renderer work and a guest
completion wait, but does **not** explain the historical 3.5–5.4-second samples.

The guest observer retained 198 rows and the renderer 124, with zero drops.
There were 16 completed guest runs, 31 completed renderer drains, and no local
sleep/message-wait span during this short window. Publication fences had a
maximum observed duration of 0.255 ms. The observation covers only a short
startup window; it does not rule out later latency. There was no admission
callback, no input, no artificial busy task, no promise-flag comparison and no
freshness/deadline adjustment.

Instrumentation was confined to run-only HTTP transforms. It records bounded
start/end timestamps around the original calls, retaining their arguments,
receiver, return values, exceptions and existing async structure. It adds no
yield, guest call, GL synchronization or fence operation. The synchronous
`Atomics.wait` wrapper calls the original once. Instrumented scripts were syntax
checked before launch. No production source was edited or claimed for a causal
fix. Observer overhead was not separately measured, so these are attribution
receipts, not performance results.

There are two measurement limits: raw span times use browser
`performance.timeOrigin + performance.now`, while requester bounds use
millisecond `Date.now`, without a clock calibration claim. The optional drain
end read/write metadata is empty because those properties are unavailable on
the Ring object; exact `done_seq` and read/write positions were not captured.
Actual span completion and guest wait return are retained, not invented fence
sequence values. The old latency cause and any safe yield repair remain open.

## Identity and scope closure

The two actual Workers each exposed one executing module, recovered once per
incarnation, SHA-256
`fab7c60e39c079c2972458d30c3a36143c6afd68c80f76d97e9e4a0c2f789d92`
(2,420,759 bytes). It is not the old `e415` module. The full chain rechecked
live page/guest/renderer membership and identity. Only immutable recovered CDP
module bytes were reused. The renderer endpoint's actual options identify
`d3dim-gps` with requested backend `webgl`; actual GL renderer/executor identity
is **unknown**, so no exercised WebGL/D3D backend pair is credited.

The first scope ended after its obsolete readiness predicate timed out. A
bounded read-only diagnostic within that live scope had already captured the
working scene and advancing guest doorbell counters. That scope was closed
permanently. The second scope used the actual manager port's `d3dim-gps` option
for readiness and completed the observations above. Its actual identity and
module inventory are retained. Neither closed scope was resumed.

The requested parent `retained-timing-analysis.json` and
`comparison2/comparison.json` are missing from this checkout and were not found
by recursive filename search in scratch. The retained notes, `probe/probe.json`,
`comparison2.log` and `focused4/controls.json` were consulted unchanged. Their
availability/hashes are recorded in `retained-controls.json`; no missing JSON
was reconstructed or treated as present. The negative await comparison was not
repeated.

All three finite native supervisors report no leaks; direct browser, driver,
supervisor, watchdog and board-watcher waits include honest pipe EOF receipts.
The extra read-only page diagnostic had its own finite supervisor and direct
wait. Tracked PIDs are nonlive, and the short `/dev/shm/mcms20` TMPDIR/profile was
removed. No enclosing tool-pipe EOF is inferred. During the two runtime scopes,
independent 100-ms disk samples stayed above 1.5 GB; later sealing observed
1,498,259,456 bytes free, after both scopes closed. No further normal runtime or
build was launched. Only the task's identical duplicate recovered module was
removed after byte verification; its recovery reference points to the retained
unique module. No foreign cleanup occurred.

No production code changed, so no build or unchanged test campaign was run.
Run-local syntax, span pairing/correlation, module identity, disk, deduplication
and custody checks pass. Native Windows parity is unknown; no Wine was used.
No test box was created: box ID **null**, state **NOT_CREATED**, expiry **null**,
stop receipt **null**. No deployment or backend promotion occurred.
