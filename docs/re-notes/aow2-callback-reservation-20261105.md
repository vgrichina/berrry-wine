# Age of Wonders II: callback reservation diagnosis, 2026-11-05

Task: `AOW2-RENDERING-COVERAGE-20261009`. Evidence directory:
`scratch/runs/20261105-aow2-callback-reservation/`.

## Established boundary

The predecessor `20261105-aow2-current-browser-gameplay` recorded one owning
Worker 0 `callExport clear_yield` rejection at `2026-11-05T19:30:52.660Z`:
`Callback wait reservation fences export clear_yield`. Two copies of the
console message/details do not establish two requests. The owning stack ends
at `ThreadSendWaits.checkExport` and `guest-worker.handleMessage`; it lacks
the issuing host call site, request sequence, endpoint identity, reservation
frame token and epoch. Those fields cannot be recovered from the retained
snapshot. The original module was standard SHA-256
`78a9e8d7563c94b1e002a688c5e65d4269946ab8dd9eb68aa3edf271f4cb1c24`,
at Git `d7731080d044023b2d6977b6fc2c7119d074b3f6`.

`initial.json` (19:30:15), `scenario.json` (19:31:00), and
`terminal-state.json` (19:31:26) all show `running=true` and main completed
yield 7. The main completed sequence increases after the error. The earlier
worker stopped the investigation before Single/Start; a fatal emulator stop
is not established by these logs. Earlier Miles thread exits/late slices
belong to different endpoint slots and are not a demonstrated cause.

## Source trace and attribution limit

`WorkerLink.callExport` posts an unscoped `{t:'callExport', name, args}` through
`_ask`, which assigns a request sequence. `_onMessage` correlates error replies
with that pending request. Worker command handling serializes commands on
`commandQueue` and invokes `checkExport` before calling any requested export.
The guard fences all mutating exports while a root send, callback wait, nested
send, scoped yield, or retained loader state owns the context. Pure audited
reads remain available. This contract is correct and must remain intact.

`releaseMainMessagePoint` is a candidate: it reads yield 17, clears
`incoming_send_pending`, then clears the yield in three awaited requests.
A callback can enter between requests; the existing best-effort catch can
swallow the guarded rejection. Host main-loop I/O/render/spin/COM/suspend
continuations and ThreadManager ordinary-yield paths also issue clears.
The predecessor has no per-request host trace to choose between them.
No production scheduling repair is justified from that evidence alone.

Endpoint retirement fences new requests and rejects pending ordinary requests
before its scoped-loader handshake/Worker termination. A late reply is logged
as such; it is not evidence that another endpoint's old slice caused this
rejection. Reservation epochs belong to the receiving endpoint's wait manager;
callback frame tokens belong to that WorkerLink lifetime. They cannot be
joined across endpoints using only a thread number or a nearby timestamp.

## Delivered diagnostics

Fenced export errors now carry a copied `callbackReservation`: the requested
export, wait-manager epoch high-water mark, optional root-send token and each
callback frame's token, exact wait/send/scope epoch, kind, phase and loader
fault/count metadata. The manager high-water mark is not a substitute for the
owning frame's epoch. Completion payloads and guest memory are excluded. The
snapshot uses existing JS metadata only and never calls a guest export.

The existing Worker error serializer preserves that record and adds its
`commandContext` (endpoint identity, actual Worker slot, request sequence,
command/export and Worker retirement flag). `WorkerLink` joins the matching
pending request with its host endpoint/sequence, host retirement/stopped flags
and `clear_yield` issuer stack. Both the rejected Error and existing error log
retain this joined record, including when the caller swallows rejection.
A missing pending request is explicit; its unavailable issuer is null rather
than inferred from a different endpoint. Only clear-yield requests retain a
host Error for call-site capture; stack formatting occurs on rejection. No
success log, guest export call, additional command or scheduler history is
introduced. Host allocation overhead has not been benchmarked.

The export guard, callback ownership, reservation operations, scoped yields,
resume acknowledgements and endpoint retirement ordering are unchanged.
`releaseMainMessagePoint` still uses its existing transport sequence. The
three exact census hashes/review reasons are updated with ownership remaining
`pending`; this is not a general invocation-ownership qualification.

## Regression and validation

`test-thread-send-wait-reservation.js` now runs production
`GuestThreadHost.releaseMainMessagePoint` on actual shipped `guest-worker.js`
Worker **slot 0**, as well as the local endpoint. A deterministic transport
barrier admits a real callback after `set_incoming_send_pending(0)` completes
and before the host's unscoped clear. This reproduces a possible stale
continuation ordering through the production method, **not the original game's
unidentified issuer**. The tiny existing Wasm fixture gains the real flag
setter, and the existing context helper gains an optional slot (default 3
unchanged).

Before the diagnostics, this probe reaches the unchanged fence and fails
`fenced export must retain owning reservation metadata`
(`reservation-before-corrected.log`). Afterward it verifies the joined issuer
and receiving identity even though the production method catches the error.
The recorded Worker witness is endpoint 1, slot 0, request 10, frame 801,
wait epoch 1, kind 1/idle; its issuer stack includes
`GuestThreadHost.releaseMainMessagePoint`. These are fixture identities and
must not be substituted for the original run's unknown identities.

The probe also checks register/wait preservation, a reserved outer wait with
a nested scoped vblank yield, stale epoch rejection, normal scoped completion
and owned resume/acknowledgement, immutable earlier snapshots, ordinary
message-point release after restoration, a separately fenced root outgoing
send, and owner-retired rejection remaining distinct from reservation failure.
Existing lost/duplicate acknowledgements, real synchronization resources,
delayed I/O/render, stale frames, nested callbacks and retirement tests pass.

Passed, sequentially on Node v24.18.1:

- `node test/test-thread-send-wait-reservation.js`
- `node test/test-thread-send-scoped-yields.js`
- `node test/test-thread-send-frame-ownership.js`
- `node tools/repro-thread-send-wait-retirement.js`
- `node tools/callback-ownership-census.js`
- `flock /tmp/wine-build.lock bash tools/build.sh`

The focused commands used the run-owned `record-fixture.cjs` preload to retain
compiler output identity only; exact arguments/PIDs/exit codes are in
`*-command.json`. Actual fixture: 1,372 bytes, SHA-256
`4e3e7a797017fda64615819b6f7160ef7a3aea0f197726f76e9dd6838f8036c2`.
Its bytes are retained once and every test's actual compilation is recorded in
`actual-fixtures.jsonl`. This tests the production JS protocol with synthetic
Wasm, not original x86 gameplay.

The required full build passed all gates and produced:

- Standard, 2,174,134 bytes:
  `b6c36db2aa538aa8c6e411d1cbe421d7898f791d65003b5ed54b8564495289d2`.
- Compat, 2,176,780 bytes:
  `533f3227abc6acbcbc33006bd1ef8e9d8865d45615c451637142be6be9fbcbf0`.

These full interpreter modules were built/validated, not loaded by the focused
protocol tests. Their identities match the already retained predecessor build;
no repeated module/media copy is needed. Recovery is the recorded Git commit
plus relevant binary diff and existing build recipe. Exact relevant file hashes,
Git SHAs, tracked binary diffs and new-file patches are in the before/tested/final
source records. Git remains the source archive. No source-tree snapshots or
media archives were made.

One initial recorder invocation failed before testing due to an incorrect
relative compiler path; it was corrected in the run-owned helper and its log
is retained as `reservation-before.log`. A generated census patch was rejected
by the patch parser before editing because its hunk header used unified-diff
line numbers; its corrected application and subsequent census/build passed.
Neither was a platform flag. No platform rejection occurred.

## Gate, cleanup and next boundary

All shared edits/tests/builds waited for exact ordered final releases:
AoE3native1900 19:46:30Z, legacyframebuffer1925 20:01:42Z,
Conanplayer1930 20:26:55Z. Independent actual cleanup passed for 425 PIDs,
183 ports, 57 profiles, four locks and zero heavy runtime before ownership
started at 20:27:21Z; deadline 21:12Z. Final owned command/watcher absence,
free locks, zero heavy runtime and disk are checked in `cleanup.json`.

No original game, browser, box, subworker, deployment or Heroes II session was
launched. Box ID/state/expiry: N/A; no box lifecycle action was taken.
The prior Scenario-only result and accepted native gameplay evidence remain
unchanged. **The original issuer/cause remains unestablished; no original-game
causal or scheduling fix is claimed.** Next evidence must identify the actual
host continuation and receiving token/epoch from the joined rejection record
in a separately authorized observation before any causal scheduling repair.
