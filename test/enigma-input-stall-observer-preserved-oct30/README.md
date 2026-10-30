# Enigma stopped-input observation bridge

Task-only instrumentation of retained runner SHA-256
`96aa1313dabaf59a55875830b35fdd32ec3410fea2e3b2458828a9f49ccbe4b2`.
`identity.json` pins archived source, exact producer recipe, extracted fixture and
transformed output. Pinned source commit is
`425755ee5ee9be0734c7aca187521100f5487674`; its runner blob equals the archived
base blob `96564821da3e401b79985804f9d689439799edf0`. This equality was measured,
not assumed from the source commit name.

`transform.transform(text)` accepts only that retained runner. Copy
`enigma-stall-observer.js` beside its transformed `test/run.js`. It adds an
`input-stall` control action, enabled only with existing `--trace-input-poll`.
The controller sends `{"action":"input-stall"}` to the existing `/ctl` endpoint
and compares successive responses around the unchanged input reproducer.
No eval adapter or invented ctx getter is used. Runtime deployment/replay is
separate and was **not executed** in this task (provider HTTP 525).

Bindings are the actual enclosing `instance`, `threadManager`, `tickState`,
`guestPollTrace`, and `guestPollState`. The bridge is initialized immediately
before the original `handleControlCommand` declaration, after instance/thread
setup and before all three original main `instance.exports.run(BATCH_SIZE)`
sites. Each site gets task-only entered/completed counters; no scheduler method,
input poll, wait resolver, continuation or guest callback is called by sampling.
Original init and dispatch ordering remains intact. Source-verified pure exports
`get_eip`, `get_api_calls`, `get_current_thread_id`, `get_yield_flag` and
`get_yield_reason` read WASM globals (src/13-exports.wat and 09b-dispatch.wat).
Thread records use original `threads`, `tid`, `state`, `suspendCount`, `instance`;
accessor properties are not invoked. Saved PC/yield is continuation evidence,
not an observed resume callback. Main counters do not claim worker execution.

Results distinguish input progress, completed main slices without polling,
observed yield/wait, and main dispatch absence. A stationary PC may be a busy
loop; completed slices without polls alone do not prove one. Dispatch absence
cannot establish scheduler starvation without host-parking and worker-slice
instrumentation. Current API *name*, unknown exports, inaccessible thread records
and in-flight synchronous execution explicitly report unavailable. Control HTTP
runs between synchronous slices: observing an unreturned slice requires a
separate in-loop/worker heartbeat boundary. At most 32 thread records are emitted;
truncation is explicit. No memory writes, queue drains or callback probes occur.

Verification: `python3 -B accept.py` recovers only the exact runner and recipe in
RAM from the retained archives, verifies their hashes, transforms the production
text first, then writes compact extracted declarations to `exact-boundary.js.inc`.
`node --max-old-space-size=256 test.js` executes those declarations, original
poll wrapper and transformed command/run boundary with isolated test imports.
It covers flat poll18569, guest slice completion, wait, dispatch absence, missing
state, queue/memory/callback noninterference, and rejects lexical-binding and
wrong-PC-reader mutants with assertion failures. These are boundary tests,
**not guest gameplay/replay**. A changed-byte runner identity mutant is rejected.

Recovery/publication uses new trees for this directory, parent `test`, and root,
reusing every unrelated parent tree entry; no full index or read-tree is needed.
Coordinator receives the adjacent completion receipt and messageboard note:
shared board is over the 12 MiB generated-file limit and is coordinator-owned.
The assigned box bx_6qfkmrgj was not contacted or changed; coordinator retains
lifecycle ownership. State/expiry were not independently queried by this worker.
Next gate: coordinator qualifies provider access and preservation, validates
actual filename-bearing mounts with the canonical parser, deploys these pinned
bytes to the retained runner and replays the original keyboard/mouse sequence.
Compare samples across the historical flat poll18569 / batches94150..95227 /
queue2→7 interval. No production bug or gameplay claim follows from unit tests.
