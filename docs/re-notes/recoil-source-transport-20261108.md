# Recoil uncached source transport, 2026-11-08

The production driver synchronously fsyncs complete source envelopes and source
proof records on its CDP event loop. Those disk waits delay delivery of other
already requested source responses. A controlled remote Chrome comparison
isolated and repaired this transport contribution. **Actual Recoil Software
qualification remains open:** durable evidence completion still exceeds 250 ms.
No original, Resume, M, gameplay input or replay was launched for this task.

Evidence R: `scratch/runs/20261108-recoil-source-transport-1728/`.
Starting Git SHA: `f123e073f0ecca088f581c61c9b12cedb3ed8664`.
The actual preceding generation is the immutable 1,066-provider manifest at
`20261108-recoil-original-1702/position-runtime-pins.json` (SHA-256
`a520a909a0df912875d130a50a70085c559fa57aa7cde7095c0af161782656a8`).
The task's `runtime-pins.json` spelling did not exist; `reference-pins.json`
records the physical manifest and exact relevant rows. Historical original851,
kernel2486507db, producer68ea2f56 and endpoint11683651 remain unchanged.

The original failure's 442 ms is a driver-observation interval, not a measurement
of Chrome alone. In `browser-position.cjs`, WebSocket onmessage parses JSON and
resolves a pending command. The native Software adapter then clones and retains
the complete response before returning it. Both the source retention callback
and the subsequent proof-record callback use writeSync/fsyncSync. While either
callback waits on disk, the same event loop cannot receive the other CDP lanes.
The response envelope's responseAt precedes that envelope's own retention, but
can include earlier lanes' synchronous retention and proof writes.

The first local Chrome fixture used the actual kernel and parent custody code.
It did not reproduce production storage latency: concurrent reads completed in
87–129 ms through retention/hash; switching native WebSocket to ws had no
consistent benefit. No WebSocket replacement was made. The initial local
fixture used the checkout's newer JS; it is only a preliminary control. The
remote comparisons use the exact accepted JS recovered from complete original
responses57/58, independently hash-checked: decoder204938/f468ffce and
compositor227919/cb21daaf; WASM2182663/6cf120d0 is read from the existing retained
module path. No game media or source-tree archive was copied.

One newly leased box ran finite transport fixtures under the unchanged ptrace
kernel and production parent census/subreaper code. The parent wrapper adapts
only the nested fixture directory and uses the normal runtime lock. The
independent persistent challenged clock producer starts before Chrome. Every
source response comes from a fresh actual Debugger.getScriptSource request;
allSettled drains each three-lane group. Exact source strings were compiled in
an isolated fixture page and the real WASM module was compiled without running
it. This exercises CDP transport and evidence IO, not actual guest instances,
Software pipeline owners, or game qualification.

The final remote-d comparison alternates synchronous and asynchronous sinks
twice in the same Chrome, box, storage and custody path. Each round has one
guest-only control followed by two complete three-source reads. All28 complete
response envelopes and all28 proof rows are retained and independently audited.
The decisive measured results are in `causal-transport-regression.json`:

| Stage | Synchronous sinks | Asynchronous sinks |
| --- | --- | --- |
| Concurrent WASM request to message handler, four reads | 162–238 ms; median212 | 92–102 ms; median99 |
| Source-envelope fsync | 28–84 ms | 49–185 ms, off event loop |
| Proof-record fsync | 16–63 ms | 21–114 ms, off event loop |
| All source/proof durable completions | 58–346 ms | 162–369 ms |

JSON parsing across final source responses was 0.21–1.86 ms; envelope stringify
was at most5.75 ms and proof stringify at most0.05 ms. Parent census cycles in
the source interval were55.3–58.9 ms, median57.4, including the fixed50 ms sleep;
31 process identities were in those parent snapshots. Three kernel events were
observed in the measured interval and are retained verbatim. These observations
do not establish exhaustive kernel lineage or separate every Chrome scheduling
cost. The transport repair is supported by the alternating comparison and
measured synchronous disk stalls, without removing either custodian.

`tools/native-source-retention.cjs` provides asynchronous complete envelope
write/fsync/close and an ordered asynchronous proof journal. Both are awaited;
exclusive source creation prevents overwrite, and a proof-journal failure
poisons its queue. `native-software-gate.cjs` accepts explicit
`responseDirectory` to select these sinks. Existing callback callers continue
to work. The accepted original driver is deliberately immutable; the exact
two-callback replacement is supplied as `next-driver-retention.patch` for the
next normal relocated generation, not silently applied to the old manifest.

`selected-helper-runtime-pins.json` explicitly selects the changed native adapter
and adds the new sink:1,067 providers. The original851 and every other existing
row are unchanged. All1,067 providers were resolved and hash-checked, and the
ordinary physical helper closure passed. This is a preparatory helper selection;
the next relocated driver must apply the supplied patch and be freshly pinned
before launch. No original was launched with these helpers.

Focused tests passed: six Node test entries, including complete two-read/six
response retention, Unicode and full WASM-sized envelopes, exclusive creation,
durable failure propagation, ordered proof appends and poisoned-queue refusal.
Existing native13, strict Software46 and owner28 negative controls passed,
including allSettled, context/instance retirement, delayed sinks, PNG decoding,
sticky UNKNOWN and no replay. The final locked full build passed. The six
uncached responses, original proof timestamps, independently fresh challenged
census, actual owner checks, final PNG through decode/save <=250 ms and immutable
five-second compound window are unchanged.

This fixes event-loop transport interference, not the storage service time.
The asynchronous durable completion range itself forbids a qualification claim.
The concrete next implementation is a probe-scoped durable journal transaction:
retain immutable complete envelopes and proof rows for both fresh reads, then
perform one bounded durable flush before the certificate can return or any
input can be admitted. It must retain every original request/response timestamp,
await all failed lanes and writer drain, reject incomplete six-response groups,
and run the existing final ownership/retirement/freshness checks after the flush.
Failure or timeout must remain sticky UNKNOWN. That changes the current
per-response durability barrier and therefore needs its own fail-closed gate
tests before use; it was not smuggled into this transport-only patch. No claim
is made that batching will meet250 ms without measuring it.

Operational failures are retained. Remote-a's90-second runtime/110-second outer
fixture cap killed its kernel supervisor during shutdown; EXITKILL retired its
tracees. It is not a normal kernel drain. Independent checks found all158
recorded task identities absent before the next fixture. Its leftover owned
Chrome profile was removed only after independent PID/start, endpoint and FD
writer checks; the initial profile-absence refusal is retained. Remote-b stopped
on a fixture-only sequence filename collision; its partial timings are not the
accepted regression. That collision was corrected before complete remote-c/d.
Remote-b/c/d kernel drains are exit0, respectively154/156/156 owned tasks reaped.
Remote-c retains two unresolved autoattach lineages; final remote-d is lineage
complete. CLONE_UNTRACED remains unaudited. Outer launcher start ticks were not
recorded; their PID-only disappearance is not represented as an identity proof.

All249 unique remote outputs /188,746,303 bytes were retrieved and independently
reopened/hash-verified before normal API stop. Final independent census checked
628 task/supervisor PID/start identities absent; eight ports closed, all owned
profiles absent, no runtime FD writers, runtime lock free, no input sent.
Box **bx_2qvsxyyn** is **ARCHIVED**, expiryNULL; initial expiry
**2026-11-08T17:58:12.388Z**. Normal stop **stop_6d70e1f754f84c70** completed
**17:43:36.900Z**, forcedFALSE/errorNULL. The observable25-minute lifecycle was
prearmed before the persisted UUID-idempotent create; ID/expiry preceded runtime.
All local lifecycle roles exited0 and the supervisor recorded no children.
Exact Git SHA, relevant binary diff, small owned patches and existing binary
path/hash references are retained without source archives or repeated accepted
logs. No old box resume/delete, deployment, private guest writes, clock/seed
change or subworkers were used. Full27, parity, audio and FPS remain open.
