# Q3 screenshot completion boundary — 2026-11-08

Published marker-clock implementation `7227918eb` is unchanged. No original
retry, replay, browser fixture, box, agent, game, GPU experiment or public
deployment was used for this task. The screenshot root cause is not reproduced.

Offline rereading of the hash-verified retained 2337 trace confirms request345
`Page.captureScreenshot` was submitted at23:44:41.098Z. Same-page evaluations346
and347 returned in2ms and4ms. The first command UNKNOWN was23:44:57.824Z, with
the screenshot pending16,726ms. Its independent20s CDP deadline fired at
23:45:01.099Z (20,001ms). Evaluation348 was also pending at those deadlines;
the earlier replies therefore do not establish continuous page responsiveness.
There is no screenshot completion, raw response-routing or frame/context
replacement record in that trace. Pending readback, compositor work, replacement
and transport routing remain unresolved; none is assigned as the cause.

`tools/q3-native-driver-composition.cjs` now pins and installs
`tools/q3-screenshot-completion.cjs` at the actual retained driver's screenshot
send, WebSocket receive-before-routing, and CDP deadline boundaries. Existing
trace snapshots also capture independent screenshot state at the command
deadline. Output is `screenshot-completion.jsonl.gz` in the unique consumer run
directory, compressed by the existing adapter from the first write.

The observer records exact request ID/session/options, send return or throw,
response session and pending-map match, CDP error code, encoded-data length/hash,
and late responses even when the retained handler discards them after timeout.
An observed late response cannot erase command UNKNOWN or CDP UNKNOWN. It also
retains bounded existing PAGE/WORKER/RENDER owner replies (identity and shared
control values, timestamps and hashes) and frame, loader, execution-context,
target detach/crash and socket close/error events. Memory rings are capped at32
records each, with explicit loss/error counters; individual owner values over8192
bytes retain only size/hash. It issues no extra protocol requests or probes.

These are separate boundaries: send return does not establish compositor entry;
owner counters do not establish screenshot readback; absence of lifecycle events
does not establish continuity. Only Node monotonic intervals are computed. There
is no timer/cap, screenshot option, timestamp, input, stale-capture, ACK or guest
consumption change. The existing numeric-ID response router is unchanged; a
wrong-session protocol control demonstrates that the observer exposes its
mismatch without claiming this occurred in2337.

Focused `tools/q3-screenshot-completion.test.cjs` passed six controls over a real
localhost TCP/WebSocket connection using the exact composed send and receive
functions, plus the actual retained numbered command consumer. Controls cover
successful screenshot routing, CDP error, wrong-session response, frame/context
replacement and render detach while page/render-owner reads return, late
completion after command UNKNOWN with no ACK/replay, and a real unchanged20s CDP
timeout followed by a discarded late response. Bounded storage and failing
diagnostic writes are checked too. These protocol fixtures supply no browser or
gameplay evidence. Socket/server closed, zero pending requests/timers, actual
Node wait0/EOF/PID absence. The locked build passed. Previously accepted unchanged
tests are referenced by verified PATH/SHA instead of rerun.

Evidence: `scratch/runs/20261108-q3-screenshot-completion-2353/`, including retained
trace selection with source hashes, exact protocol telemetry, focused/build
logs, Git SHA and small owned patches, and stored/original SHA/size/CRC inventory.
No source archives or media/module copies are retained. No box was created:
box/state/expiry/stop receipt are not applicable. Prior box `bx_bfn5frew` remains
archived per2337's retained receipt; this task did not access it. The optional
heavy slot was explicitly released on the messageboard.

Next gameplay method: regenerate the exact provider manifest with this
composition and its new helper, retain the existing composition-before-execution
preload order, and recover the new screenshot completion log on first UNKNOWN.
Use request/session routing and correlated frame/context/owner observations to
choose the next repair. Do not repeat the unchanged original method without
these diagnostics, extend its deadlines, or interpret a missing response as a
specific emulator/GPU failure. Gameplay remains unverified by this task.
