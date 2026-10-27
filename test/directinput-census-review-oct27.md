# Two producer lifetime review, 2026-10-27

Reviewed exact base 9923b8b786fbb26fa5e07ba8d9dc2c8e4e42e10e. No production
source or scanner change. This is a source inventory review, not invocation
ownership certification; both entries remain `ownership: pending` and the
independent nonlocal API/handler gate remains closed.

## Renderer

Old source: commit 0ebb852e339fe755f3c18a19f32f1dfe4da427b4, blob
d2fab5556291146f9b4fb6ccc586d4be9485d3cc, SHA-256
e7b59c046f63b504a0aba256b644a42c01f820fde9a0f9e5fee3961dae397f78.
Current blob a4778d19ee9ca0d7e8df919fd5393ba3c7a86f29, SHA-256
0778aad2d09ecf790e816011dff29ae20009aae8b53dac769dec0979f3fc6b5a.
Complete diff adds physical transition recording and the buffered-device ABI.

`createWindowHost` owns one `keyboardBuffers` Map per host closure; the renderer
registers only WeakRefs to those maps. The records retain integer key/time/sequence
data, a selected-key Set and bounded arrays, without guest callback/register
contexts. Dead maps are pruned during recording/acquisition; op1 deletes a device,
reacquisition replaces its buffer, and consume clears occupied event references.
The existing final COM Release and Unacquire paths call reset; an unreachable
host closure need not be kept alive by the renderer registration. WeakRef cleanup
is opportunistic, not a deterministic finalization or ownership guarantee.

Worker imports use guest-rpc's synchronous numeric import broker and generated
three-i32/i32 signature. Multiple RPCs are separate host turns: op8 creates an
inactive selection, op9 populates it, and op10 alone activates it; recording skips
inactive records. Failed activation resets the record before WAT marks acquired.
This distinction is essential: synchronous individual calls do not make the
whole acquisition atomic. Accepted OS Worker/Release/admission receipts are reused.

The new methods do not run guest exports, schedule promises/timers, retain a new
callback, or save/restore guest registers. Timestamp sampling uses the existing
renderer clock hook synchronously; exceptions propagate before a record append.
Allocation failures propagate rather than introducing a catch/resume continuation.
Unknown buffered operations throw. Keyboard entry owner restoration still precedes
physical updates; existing queue/modal dispatch, nested owner restoration and its
exception paths are byte-unchanged. No general reentrant-hook or nonlocal guarantee
is inferred from this review.

## Thread manager

Old source: commit 8b6d676ce0c8cd3d35db1f67fa6f21aaaaa2fb25, blob
c32dec0085065134a06761de4533139eb220f830, SHA-256
f0a2f006b0eb992bcdb904f10128167b06bfe143ac05661b82f9586d9755bf40.
Current blob 05fe82b2fd26dec80652c71698d90792acd04517, SHA-256
f4ba190b2dbf5e2cf2dac82398577bedfb13aa26d332fb7480b4d9d7e4ea2f78.
This current blob is already on main be0eb25f; it is not a DirectInput delta.

The entire diff is `isMainSleeping(observe)`. Omitted observer preserves the old
expression exactly. Enabled observation captures the same short-circuited clock
comparison once, then calls `observe` synchronously with a new scalar-only object.
No observer is stored on the manager, sent to a Worker or retained after return;
no timer, continuation, guest register mutation or ownership token is added.
The production CLI caller's optional scheduler observer appends the snapshot to
its own row. A nested observer call gets its own locals; an observer exception
propagates, with no newly acquired resource or restoration guard to release.
The returned comparison was captured before observation. Arbitrary user hooks
are not certified safe to mutate scheduler state. Existing parked-frame, nested
dispatch/finally, Worker completion, cancellation and teardown paths are unchanged.

## Verification scope

Run the unchanged `test/test-callback-ownership-census.js`: its real-manifest
mutations reject changed producer hashes, ownership claims and nonlocal
registration/handlers even with refreshed inventory. Run the unchanged scanner
CLI. Retain exact old/current blobs, complete diffs and command/resource receipts
under `/tmp/airstrike-directinput-census-build-recovery-oct27/ops`.
Canonical build remains a separate conditional acceptance gate.
