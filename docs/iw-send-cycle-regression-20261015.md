# Held process-send broker: independent cycles and thread ownership

Source baseline: `e4510f1a9256036967e9c391c57d3f0df6bcc61a`, including
`7973eee2a4502f9d639d90b3d6f1d0ea3bd61c69` broker ownership and
`db7a1a57e61eb10b69037ed8a69e41f5f18ae87a` transport wiring. These remain
held, outside main. This change adds a failing reproducer and specifies the
missing interface; it makes no production correction or integration claim.

## Reproduction

From this held branch, with Node and no dependencies or guest module:

```sh
node tools/repro-process-send-cycle.js
# Expected exit 1: both progress assertions fail on the held broker.
node test/test-process-send-broker.js
# Expected exit 0: existing ownership/deferral/nesting/retirement controls.
```

The reproducer invokes the actual `ProcessSendBroker` and uses two actual Node
Workers as callback endpoints. Their root callbacks acknowledge entry and park
awaiting a reply. Only after both acknowledgements does the host initiate the
two nested sends using the actual contexts of those independent root callbacks.
They are not descendants of each other. Both leaf callbacks return 41; both
outer callbacks would return 42 if reached. No result is synthesized by the
broker adapter. The second case parks one callback on receiver thread 1 and
routes a second request to a separate Worker representing thread 2 in that same
process. It must complete without releasing thread 1.

Observed on 15 October: cycle endpoints each have one active callback, one
queued request, `deferred:false`, and a different chain from their owner;
neither leaf dispatch occurs. The threads case has one active callback and one
queued request on PID 200; the second Worker receives no invocation. Explicit
`notifyReady` does not change either result. Both bounded progress assertions
fail after 150 ms. This is not just a slow Worker timeout: acknowledgements
precede the probe, and the recorded queue predicates rule out admission with
no future event able to release the waiting frames. A separate five-second
setup deadline catches infrastructure stalls; all Workers are terminated in
cleanup. The existing broker suite passes unchanged, including independent
same-receiver exclusion, same-chain sibling exclusion, nested return values,
readiness races, stale contexts, retirement, PID reuse and invalid replies.

These are broker/Node-Worker results, **not** execution of `guest-worker.js`,
WAT frame restoration, or a game. Existing held failure-propagation work is
retained, not rerun or replaced. No VM, canonical build, browser or Boat runs.

## Documented semantics and precise source gaps

Microsoft's [SendMessage reference](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendmessage)
states that cross-thread calls execute on the window's owning thread, with
incoming nonqueued messages processed by the sending thread while it waits.
`SendMessageTimeout` with `SMTO_BLOCK` disables that processing. Thus unrelated
send chains cannot categorically be excluded from a waiting thread. Ordinary
code is not made reentrant at arbitrary instructions. The documentation also
requires custom marshalling for interprocess messages at or above WM_USER;
these scalar callback probes establish no pointer-message support.

Concrete held-source gaps:

* `ProcessSendBroker.register(pid, adapter)` allocates one queue/stack per PID.
  `_pump` admits only descendants of the owning chain. It knows neither the
  thread owning an HWND nor whether its active frame is in a reentrant send
  wait. A process-wide queue blocks unrelated receiver threads.
* `host.js::_installProcessSendBroker` resolves `get_window_thread` and
  `linkForWin32Tid` only **inside** the already-admitted callback. Window token
  validation is present, but thread identity is unavailable to broker admission.
* `GuestThreadHost._resolveProcessSend(senderLink, request, context)` receives
  the caller's Worker link, then calls `processSendResolver(request, context)`
  without it. At the broker boundary an independent outgoing send carries no
  thread identity or current wait-frame token. `targetTid < 0` denotes PID,
  not destination TID.
* `guest-worker.js` checks `requireMessagePoint` atomically before snapshotting,
  accepting yields 7/10/15/17. That necessary admission safeguard already
  exists; yield 10 alone does not tell the broker who owns the suspended frame.
  `resumeThreadSendDispatch`/`abortThreadSendDispatch` operate on the current
  frame without a command-carried frame token. A newly admitted unrelated chain
  must not let an older asynchronous drive loop resume or abort its top frame.
* `hasIncomingProcessSends()` and existing host/thread-manager scheduling gates
  are process-wide. Thread admission alone would not demonstrate independent
  scheduler progress; these consumers also need a per-link audit.

## Minimum interface before relaxing admission

1. Resolve the destination to an opaque `(process generation, thread/link
   generation)` endpoint before queue ownership, retaining/revalidating HWND
   identity at actual Worker entry. Retire queued and active requests by exact
   generation; PID/TID reuse cannot resurrect them. Sender endpoint identity
   must accompany `processSendResolver` and be bound to its active context.
2. Publish explicit per-thread frame and wait state: an opaque current-frame
   token, the outbound request being awaited, and whether this wait permits
   sent-message reentry. Do not infer this from an unresolved JavaScript Promise
   or merely a process having a pending request. Enter/leave wait notifications
   must be paired even on failure/retirement and scoped to that exact frame.
3. Queue per receiver thread. Admit unrelated incoming sends only when that
   thread's top frame is at a permitted message point or a reentrant send wait;
   keep ordinary independent callbacks and same-chain siblings serialized.
   A chain remains useful for causality, but is not exclusive thread ownership.
4. Have Worker admission return a frame token and require it on resume/complete/
   abort. Suspend an outer drive loop while a newer frame occupies that thread.
   If its outbound result arrives early, retain it until the nested frame has
   unwound; never complete the wrong saved SendMessage or remove a middle frame
   and resume its caller. Check wait epoch/frame atomically with snapshotting.
5. Preserve deferred readiness epochs, valid zero LRESULT, explicit unavailable
   targets and the existing `e4510f1a9` failure propagation. Sender retirement
   rejects its request without stealing the still-running receiver frame.
   Exercise callback failures and retirement while an unrelated reentrant
   frame is active, and independent thread scheduling, in actual guest Workers
   before making a runtime correctness claim.

Simply deleting the chain test would permit concurrent access to a thread's
saved interpreter stack and violate the already-passing exclusion controls.
The current interface is insufficient for a bounded broker-only fix; no such
change was made. Cooperative transport, general marshalling, held lookup/
alias/lifetime integration and game qualification remain separate holds.
