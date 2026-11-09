# Q3 page-session attach diagnosis, 1638

No causal stall repair is established. Movement and firing remain unverified.
The concrete blocker is missing browser-side request/session evidence: the
retained native recording does not contain request 6's raw response stream or
the attached targets' type, URL and `waitingForDebugger` values. An offline peer
can exercise Node routing, but cannot supply those missing Chromium facts.
No native verification is justified by this change.

Evidence: `scratch/runs/20261109-q3-page-attach-stall-repair-1638/`.
Recovery is the exact recorded Git base plus `owned.patch`; no source tree,
media, binary or module archive was created. Referenced native artifacts were
independently checked against their retrieval manifest for compressed SHA/size,
decoded SHA/size and gzip CRC before examining their contents.

`tools/q3-page-session-startup.test.cjs` adds a deterministic CDP peer around
the actual fresh, authenticated, versioned generated runtime caller. Each case
uses production preparation, independently hashes the manifest, checks staged
files and executes the generated relative-import caller. The entire consumer
body runs unchanged, including its production request timers, WebSocket routing,
error handler and browser cleanup. Only browser spawning, HTTP serving and the
CDP endpoint are inert. The stand-in is a real Node child with actual parent
wait and separate stdout/stderr EOF. Successful setup is deliberately refused
at `Page.addScriptToEvaluateOnNewDocument`, before navigation, guest execution,
input or capture. This refusal is a test boundary, not a native failure.

All nine cases preserve the production prefix:

1. Root `Browser.getVersion` (request 1).
2. Root `Target.setDiscoverTargets` (2).
3. Root `Target.setAutoAttach` (3).
4. Root `Target.getTargets` (4).
5. Root `Target.attachToTarget` (5).
6. Manual page-session `Target.setAutoAttach` (6).

Both auto-attach calls retain `autoAttach:true`,
`waitForDebuggerOnStart:true`, `flatten:true`. The manual session from request
5 remains the chain's page session regardless of the earlier auto-attach event.

Single-session and duplicate-page controls reach page and runtime enablement.
Duplicate events before/after the root reply and after the manual reply do not
break Node request routing. A page event marked `waitingForDebugger:true` also
does not itself change Node routing. That peer flag does **not** model an
actually paused renderer; it neither proves nor excludes a Chromium pause cause.

An explicit page protocol error and socket closure stop subsequent setup.
Withholding request 6's reply produces its actual unchanged 20-second timeout.
Delivering the reply only after that timeout does not revive page enablement,
navigation, input or capture. Both withheld-reply controls use real production
timers, without acceleration or deadline extension. Each caller exits 1 and
the stand-in browser exits 0 with separate output EOF; physical profiles are
removed after cleanup.

These results reproduce the known client-side ordering and timeout symptom.
Withholding a reply is an injected condition, not a diagnosis of why the native
browser failed to reply. Two sessions alone are not causal proof. The native
snapshot also omits types for its other targets, so the peer's declared page
events are explicit fixtures rather than a reconstruction of unknown fields.

The retained native trace independently confirms root request 3 and manual
attach request 5 completed, then page request 6 reached `CDP UNKNOWN` after
20,002 ms. Its context snapshot records four attachments, including two
sessions on one target. It does not record the raw result/error/session fields
needed to distinguish browser nonresponse, an unseen late/malformed reply or
client receipt/routing failure. No speculative session adoption, debugger
resume, auto-attach policy change or provider repin was made.

The generated-caller integration passes seven actual checkpoint cases and
versioned prelaunch refusal checks. The current generated caller also passes
the real controller CLI regression with successful read-only join and with a
secondary join failure: first failure exits nonzero and a queued later capture
is never requested. Production `tools/q3-current-module.cjs`, including
`a8aea2338` first-failure propagation, remains unchanged. The locked build passes;
primary CPU `3e491c08` and compat `ecb45716` remain selected.

The initial peer supervisor invocation cached the intended CLI module during
preload, so its main guard never ran. Its exit recorder then tried to read a
nonexistent browser-failure file. This is preserved as an invalid initial
test, not evidence of production failure. The corrected test invokes the
actual generated relative-import entry. A subsequent refinement ensures the
single-session control also emits the manual attachment event; final results
are under `final-peer/`.

Runtime was queued after Redline-1634 and Q2-reviewed-1638. No box was allocated,
no inherited box was touched and no local Chrome, native fixture, original
arena, input/capture, agents/workers or deployment ran. Box ID/state:
`NOT_CREATED`; expiry and stop receipt: `NOT_APPLICABLE`. No runtime watchdog
was armed because no native allocation was justified. Offline test watchdogs
and child waits are recorded separately and do not prove native custody.

Next work needs browser-side raw startup context and request 6 receipt/service
evidence sufficient to distinguish a concrete cause. An unchanged native retry
is not authorized by these results. Native cause, historical browser EOF and
arena consequences remain UNKNOWN. This task ends with published RELEASE STOP.
