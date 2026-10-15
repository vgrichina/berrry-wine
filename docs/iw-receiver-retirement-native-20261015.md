# Receiver retirement: independent review and native preparation

Production reviewed: `66f953b98e634105c806452d05f26b411928f705` against
`f8598b086475fd28250726607bafea4fa2a9ffe8`. Only
`lib/process-send-broker.js` and `lib/guest-thread-host.js` change production
behavior. No blocking correctness finding in this bounded independent review.

The broker subscribes to the exact receiver link before queuing. Synchronous
retirement during subscription removes the subscription, and settlement removes
queued requests while readiness scans use a snapshot. An executing adapter
retains stack ownership; if its receipt is deferred after retirement, the new
check settles receiver-gone rather than requeueing permanently. Active native
callback unwind remains owned by the host adapter.

Worker transport failure rejects each pending RPC through the existing wrapper,
which clears its timer, and refuses later RPC admission. Normal stop sets
`_stopped` before terminating the Worker, so its expected exit does not become
an unexpected transport failure. Unexpected error followed by exit is harmless
for empty pending/listener collections. Raw transport failure never creates a
scoped-loader retirement receipt or clears loader pins. If scoped loading was
used and no receipt exists, later stop rejects and ownership remains retained;
this is intentionally not successful native loader cleanup. Browser error
delivery was inspected in source only.

## Prepared native control (not executed)

`test/test-receiver-retirement-native.js` preserves all prior native admission
cases, then adds actual native-PE deferred receiver stop, raw process exit and
uncaught Worker error. Deferred admission is observed from the real broker
queue while the real native receiver is in ordinary code. No readiness signal
or fake dispatch result is supplied. Raw failures also reject an unanswered RPC
and leave no pending host request. Normal stop must not record transport failure.
Additional native SendMessageA callbacks stop/exit/error while their external
reply is held: stack/depth must remain owned until release and adapter unwind.
These cases assert empty loader gate, no fabricated retirement receipt, empty
queue/listeners and completed Worker termination. They do not load a DLL or
claim native raw-failure recovery of retained DLL pins.

The Worker wrapper only adds explicit process-exit/uncaught-error messages;
it requires the actual production guest Worker. The existing scoped endpoint
context gains an optional Worker URL argument; existing callers are unchanged.
Temporary wrapper bytes are removed after cleanup. Each new context closes
its Workers and retires its broker endpoint before another context starts.

`tools/run-receiver-retirement-native.js` runs candidate/old/restored serially,
with 60-second inner and 90-second external guards plus five-second kill grace
per arm. Candidate production is pinned to 66f953b; old replaces both changed
production files with f859 bytes. Old must first pass every prior admission
case, then exit 1 with `RECEIVER_RETIREMENT_DID_NOT_SETTLE` at the first deferred
receiver stop, without printing its success marker. It is not enough for an
unrelated test to fail. Positive/restored must exit 0. Every arm verifies
physical host/src/lib and fixture bytes, donor bytes, canonical module, and
empty process inventory. Exact original production bytes are durably saved
in the evidence directory before any swap, restored in finally, and checked.

The canonical module stays read-only at
`/home/user/wa-iw-native-validation/build/wine-assembly.wasm`, SHA-256
`a948a826f71c1935c4d00f7054decdaf4d1e8115314d8779727b7e30069f5b48`.
No module build is required. Source parses and whitespace checks pass; no
native/runtime/build/browser/remote action has been performed for this change.

After explicit root review and sole-lane grant, stage a fresh committed checkout
through Boat APIs with all tracked host/src/lib files and the controller's four
fixture files. Do not mutate the donor. Run:

```
WA_RECEIVER_EVIDENCE=/home/user/iw-receiver-evidence-UNIQUE node tools/run-receiver-retirement-native.js
```

Use an outer 300-second bound. Independently verify final source/module hashes
and empty process inventory before lane release; archive and recover evidence
through Boat APIs. If an outer kill bypasses finally, restore both `.original`
files to their matching `lib/` paths and verify against 66f953b before release.
Existing native admission evidence remains separate and predates this fix.
No original Invisible War, browser, pointer-marshalling, full-chain integration,
or deployment claim follows from this source preparation.
