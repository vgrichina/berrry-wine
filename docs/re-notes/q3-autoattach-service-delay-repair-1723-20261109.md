# Q3 auto-attach service-delay investigation, 1723

No causal production defect is established, so there is no production repair
or old-fail/new-pass claim. The exact missing observation is request 6's
transport submission/ingress and browser-side dispatch/completion dependency.
The existing first-error, cleanup, routing and 20-second timeout stay intact.
No further arena attempt is justified by these offline controls.

Evidence: `scratch/runs/20261109-q3-autoattach-service-delay-repair-1723/`.
Source recovery uses `gitbase.txt` and `owned.patch`; Git holds the source.
`causal-audit.json` records retained compressed/decoded hashes and sizes.
No source/media archive, Chrome, game, box, agent or worker was created.
Box ID/state/expiry/stop receipt: NOT_CREATED / not applicable.

## Actual caller and scheduling

The starting evidence is
[`q3-raw-startup-evidence-1648-20261109.md`](q3-raw-startup-evidence-1648-20261109.md).
The recovered startup stream is the exact gzip with SHA-256
`939c96e8dd687c6541b5876e3e798af94b8032108a1795668b4f31bee1e16e5a`;
its decoded SHA-256 is
`8b3a6c9826416951b5e73c696f2b720fc146c7056cdb7bfa9649c2d5fcec646e`.
Both hashes and gzip CRC were checked again. The retained await trace is
`cancellation/recovered/5ce8e69344fd3c32eb8c9b4be6a8aa6b734c123ea2c409ea4486d5c746ce5538.gz`
under that predecessor run; its hash and decoded reference are in the audit.

The actual generated entry calls `q3-current-foreign-closure-v1.runCaller`,
which authenticates providers and installs the composed consumer, native
cause/input-wire hooks and execution-boundary WebSocket wrapper. The owning
generated cancellation runtime explicitly enables both diagnostic hooks.
The controller observes the browser failure and cancels/joins; it does not
service CDP events or supply a missing startup continuation.

Inspection of the composed consumer and installed hooks establishes:

- `send` puts the request in `pending` before calling `ws.send`. The generated
  handler resolves/rejects matching IDs directly. Event handling is invoked
  separately with a rejection observer; no event promise is awaited by the
  message dispatcher.
- Only `worker` attachment events start Debugger/Runtime setup commands.
  All four retained attachments are `page`, `browser_ui`, `browser_ui`, `page`.
  No such worker setup runs in this transcript. Target-info changes have no
  command-producing branch. These events cannot create the hypothesized
  recursive auto-attach sequence in this caller.
- The manual attach request names the about:blank page. Request 5's returned
  session is exactly request 6's outbound session and its eventual reply
  session. There is no scope substitution in this run. General routing is
  keyed by ID, but no wrong-session response caused this failure.
- The deadline snapshot has only the enclosing `cdp` span and request 6's
  `cdp.request` span active. The raw stream has exactly seven outgoing
  commands, including cleanup's Browser.close. No Debugger, Runtime, Page or
  Input command is hidden behind an event continuation.
- The execution wrapper only rewrites selected Runtime.evaluate expressions;
  none was sent. Its propagation suppression requires its own nonce-bearing
  Runtime.consoleAPICalled marker. It does not suppress this Target reply.
  Input-wire observation adds no commands. Screenshot probe work requires a
  screenshot, which was never requested.

These are local code/trace findings, not proof that Chromium serviced request
6 promptly. Target-info events received about 11.6 seconds into the wait and
the on-time deadline rule out a continuously blocked Node handler throughout
the whole interval; they do not exclude shorter stalls or transport buffering.

## Discriminating offline controls

`tools/q3-page-session-startup.test.cjs` retains all ten original cases and
adds three exact-native-frame cases. Each checks the first six outgoing JSON
envelopes byte-for-byte against the retained stream, replays the actual four
attachments and intervening target-info events, and preserves their native
IDs, target types, sessions and waiting flags.

Synchronous ACK delivery and next-event-loop-task ACK delivery both settle
request 6 and reach the intentional pre-navigation protocol refusal. Delivering
the same ACK only after the unchanged 20-second timeout and Browser.close ACK
keeps setup terminal: it is known/unmatched and never triggers Page.enable,
navigation, input or capture. Cleanup's child exits normally, the caller exits
1 with its first error, and separate stdout/stderr EOF and profile removal
are checked. No timer, routing or debugger policy is relaxed.

The original peer suite had a coverage gap: it selected the native phase but
did not explicitly set `Q3_NATIVE_INPUT_CAUSE=1` and `Q3_INPUT_WIRE=1`, and it
replaced `createChain` with an empty object. The test now enables those exact
runtime flags, asserts both hooks in the actually compiled consumer, records
its hash without copying source, and delegates to the actual transformed
`createChain` initializer. This is a test-coverage correction, not the cause
of the production delay. An initial 13-case pass before this correction is
retained separately as `peer/`; the final `peer-native-hooks/` pass is the
reported coverage.

The peer still replaces browser/transport service and the static server;
the real generated consumer, native diagnostic hooks and child lifecycle run.
ACK timing is an explicit controlled input. Success demonstrates that these
Node paths can consume the reply; withheld/late ACK failure reproduces the
symptom only. Neither is a repaired Chromium implementation or native arena
qualification.

Validation: all 13 final peer cases; actual generated owning caller integration
including first-failure propagation and read-only joins; both actual generated
prelaunch/custody/staged lifecycle paths at DRIVER_PREFLIGHT before Chrome;
current foreign closure with 27 refusal controls; locked `tools/build.sh`.

## Exact remaining causal observation

The startup outbound record is written **before** `WebSocket.send`; the await
trace measures caller settlement, not a socket write or browser receipt.
There is no request-6 send-return timestamp, kernel/socket ingress timestamp,
or browser handler/dependency trace. The valid result was observed after
cleanup, but neither its browser production time nor its residence in a
transport queue is retained. Browser.close releasing a dependency is unproven.

To distinguish these alternatives requires correlated request-6/session
transport entry/return and ingress timestamps, Node scheduling observations,
and browser-side command dispatch/completion or the pending dependency that
holds completion. Renderer/debugger state would need its own direct evidence;
`waitingForDebugger:false` is not that evidence. This task authorizes no live
attempt to collect it. Stop with this missing observation rather than remove
auto-attach, adopt another session, resume an invented paused target, extend
the timeout, or declare a peer pass a production fix.
