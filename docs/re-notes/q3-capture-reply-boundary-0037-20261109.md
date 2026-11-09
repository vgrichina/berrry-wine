# Q3 capture: observe owners while the reply is missing — 2026-11-09

Implemented the missing observation boundary in the actual composed Q3 capture
transport. This is an offline instrumentation change, not a claimed repair of
Chrome readback or proof of gameplay. Evidence:
`scratch/runs/20261109-q3-capture-reply-boundary-0037/`.

The retained0009 screenshot-completion log was reread and its stored/original
SHA256 and sizes verified. Screenshot343 was submitted on session
9794E37A7491B85C6E74869A4031BE8B, with no raw reply through its20s deadline.
The last page/guest/renderer identity replies were342/337/339, all before343.
There were no owner replies during that screenshot. PAGE344–347 returning
does not establish guest or render-worker progress. All four actual reviewed
frames remain menus. The4e414714 settled-duration correction remains intact;
it did not resolve this missing response.

The implementation explains the gap: retained `bound-input.cjs` capture awaits
`Page.captureScreenshot` between `binding.before/readLive` and
`binding.after/readLive`. The second owner read therefore cannot report while
the screenshot reply is absent. The independent5s page sampler is a different
expression. WebGL's renderer has `control:null`, so legacy transport counters
also cannot establish Q3 renderer progress.

After the actual screenshot `ws.send` returns, the completion helper now queues
one parallel batch of at most four existing successful reads: page identity,
guest instance, render owner and GL producer. These evaluate the same cached
expressions on the same sessions, with `returnByValue:true, awaitPromise:false`.
The producer read retains adapter/bridge/context/owner identity and completed
draw, presentation and write-sequence receipts even when legacy control is null.
It performs no draw, screenshot, guest call or GPU query. The composition pins
the existing producer provider and recognizes that exact expression separately.

Each probe records its real numbered request, send return, raw response before
routing, response session match, lifecycle generation, error or unchanged CDP
deadline, and bounded returned value. A probe deadline remains UNKNOWN after a
late raw response. Detach/context/frame replacement events invalidate cached
recipes; only a fresh successful ordinary read can rebind them. Late pre-event
reads cannot refresh a recipe. Missing events still do not prove continuity.
Storage is bounded by the existing screenshot capacity, four probes per shot,
four recipes and bounded pending owner-read metadata. No owner probe is awaited
by capture, and its rejection is handled without producing an ACK or replay.
The queued batch is suppressed if first UNKNOWN has already occurred.

The focused test executes the exact composed initializer, send and receive
functions over a real localhost WebSocket, plus the retained numbered consumer.
It distinguishes an unanswered screenshot with returning page/render/producers,
an unanswered guest probe, a routed screenshot, wrong-session raw response,
late raw responses, and renderer detach/rebinding to a new session/epoch.
The WebGL control-null case retains producer draws5 before and6 during the
unresolved screenshot; these are protocol fixture values, not gameplay evidence.
The numbered command still ends at sticky first UNKNOWN without ACK even when
its diagnostic probe returns. The real20s CDP deadline is exercised without
fake timers. Additional controls retain settled-duration attribution, bounded
storage, observer output failures, no probe submission after UNKNOWN and
independent probe rejection. Final focused tests and the required locked build
passed; socket/server closed, pending0/timers0, actual child waits/EOF recorded.

The initial extended test sent a replacement read before receiving the detach
event; conservative generation checking correctly refused that stale recipe.
Its failed log is retained. The corrected test waits for the actual event before
rebinding. Subsequent transport and GL-specific passes are also retained.
Unchanged accepted prelaunch/controller/composition controls were reused by
verified PATHHASH, without repeating their runtimes. Marker-clock source remains
byte-identical SHA256
1858eea7efb8875e44088ffe9f5ea434c3b22915444113204fb51673e4f5ac0d.
Screenshot options, work/CDP caps, input, physical-release and ACK rules are
unchanged. Historical143, untraced/nonleader and original343 cause remain UNKNOWN.

Next separately authorized gameplay verification must use this published
composition and a refreshed exact provider barrier. If the screenshot again has
no raw reply, inspect the concurrently delivered owner/producer receipts with
their sessions and identities. Stable producer advancement with no screenshot
response narrows investigation toward the browser capture/compositor boundary;
missing producer replies, changed identities or stalled counters require their
own investigation and do not alone prove GPU or emulator causation. Actual
movement, firing, in-world rendering and death remain UNVERIFIED.

No box, browser, original game, heavy local runtime, peer access or agent was
created. Box ID/state/expiry: none/not-created/null; stop receipt: not applicable.
Git SHA and small own patches retain source identity; no source/media/module
archives or peer/old deletion. Free home remained above1.5GB. Single task STOP.
