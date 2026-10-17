# Held send dispatch frame ownership prerequisite

Based on held `cb828e2dad56d8f7d30ceae2c542f69023c350a1`; retains the
`e4510f1a9` foreign-failure propagation fix. No main integration or cycle fix.

The host now assigns a monotonically increasing safe-integer token per link
before sending dispatch. The Worker records it with the interpreter snapshot,
returns it on accepted dispatch/resume replies, and checks it before resume or
abort changes guest state. A missing/stale token or an outer token while a
newer frame is active returns `ownershipMismatch`; it cannot complete the wrong
SendMessage or pop a middle frame. Duplicate admission tokens are rejected.
The host drive loop propagates the original token through resume and every
cleanup path, including its outer foreign-failure catch and a lost dispatch
reply. Mismatch fails explicitly; it is not converted into LRESULT zero.

Local main dispatch has the same guards. Its `_localLink`, frame stack and last
accepted token are created only in the `GuestThreadHost` constructor; there is
no independent recreation/reset path. A new host/link owns a fresh namespace.
Tokens must not be reset or links replaced against a surviving interpreter
stack. Tokens are ownership identities inside one trusted link, not security
capabilities or PID/TID identities.

## Validation

`node test/test-thread-send-frame-ownership.js` passes using the actual
`guest-worker.js` in a real Node Worker, the actual `WorkerLink` transport,
and a small stateful Wasm fixture compiled by the existing JS compiler. The
same controls run against the real local host dispatch implementation. No
Worker handler or export is silently stubbed. The fixture implements register
state, callback depth, completion and a real `unreachable` trap; this checks
JS frame bookkeeping, not x86/WAT callback semantics. Tests include missing,
stale and duplicate tokens; nested restoration; zero result; trap cleanup with
and without restoration; foreign failure with a newer frame active; normal
foreign failure unwind; and accepted dispatch followed by a lost reply. The newer-frame failure test
manually unwinds the inner and then remaining outer frame: automatic deferred
unwind is deliberately not claimed.

A disposable copy of `guest-worker.js` with only both
`if (!ownsThreadSendFrame(msg.frameToken))` guards disabled fails the new test.
A second negative run suppresses only the expected mismatch-reply assertions
so the state comparison is reached: it fails `stale command mutated current
frame`, showing ESP 81 instead of 61 and callback depth 0 instead of 2. The
production files were unchanged and disposable copies removed; the original
test passes again.

`node test/test-process-send-broker.js` passes unchanged. Production and changed
test JS syntax and `git diff --check` pass. Full-tree caller inventory found
only `test-cross-thread-send.js` direct dispatch and
`test-process-send-runtime.js` direct abort outside the host driver; both now
supply tokens. Those full-VM tests were syntax checked, **not executed** under
the source-only task restriction. New test has automatic UNIT tier membership.

## Remaining holds

This is a rejection guard, not a scheduler: an outer operation that arrives
while a newer frame is active fails and leaves the outer frame pending. There
is no wait-until-top queue, delayed outer-result delivery or retirement unwind.
The existing broker admission restriction remains necessary and unchanged.
Generic `completeWait`, `completeThreadSend`, message-wait resume, `callExport`
and yield-resolver side effects still lack frame/epoch ownership. Destination
thread/link generations, outbound wait state and sender identity also remain
missing. Do not relax independent-chain admission on this patch. The prior
independent-cycle/two-thread reproducer remains intentionally failing. No full
VM, canonical build, browser, Boat, game or GPU execution occurred.
