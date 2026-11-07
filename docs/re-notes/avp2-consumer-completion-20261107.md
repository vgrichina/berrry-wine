# AVP2 actual-consumer completion contract, 7 November 2026

The production collector now has an **opt-in, request-specific application
completion contract**. Generated local Chromium controls demonstrate rejection
under the default cancellation policy and acceptance when the actual original
fetch consumer completes with the exact captured and pinned bytes. The original
registered Marine gameplay route has not been rerun. Its old cancellation is
not reclassified: the original request `7496.264` has no consumer receipt.

Evidence is in `scratch/runs/20261107-avp2-consumer-completion/` (ignored).
This assignment used generated HTML and binary bytes only: no original game,
remote box, public deployment, nested worker, media copy or source archive.

## Implementation and use

`tools/return-fire-body-driver.cjs` exports `attachPinned`, the production form
of the prior AVP2 actual adapter's pinned-body policy and paused-child lifecycle.
The sealed `compose` entry keeps its original default policy. Example:

```js
const {attachPinned} = require('./tools/return-fire-body-driver.cjs');
const bodies = await attachPinned({page, origin, pins, record, onFault,
  consumerCompletion: {urls: [origin + '/body.bin']}});
// Install before navigation and before application fetch aliases are captured.
// Run the real application, then await bodies.drain() before accepting evidence.
// Finally await bodies.close(), and close the owned browser/server normally.
```

`pins` maps decoded relative paths to `{bytes, sha256}`. `record(source, row)`
and `onFault(row)` preserve the adapter's audit/failure channel. `urls` is an
explicit set of required, absolute, canonical resource URLs; every entry must
have an observed bound application invocation. Omit `consumerCompletion` to
retain immediate cancellation rejection. Selecting a URL alone grants nothing.

`tools/browser-consumer-completion.cjs` observes the default page world's
original `fetch`, returned Response's `arrayBuffer`, and original body reader's
`read`/`cancel`. It never clones, tees, reads ahead, refetches, fulfills a
response, changes HTTP or guest bytes, or manufactures application success.
Read results and rejection objects return to the application. Copies of actual
returned chunks are hashed after `done:true`; arrayBuffer hashes only after the
original method resolves. Abort signals and cancellation remain effective.

A unique per-invocation function name appears in Chromium's native fetch
initiator stack. Runtime binding notifications identify the invocation and
execution context; Debugger script receipts verify that initiator script belongs
to that context. This binds the Network ID without adding request headers,
changing the URL, or relying on URL-only correlation. The completion contract
records session, target, Network ID, Fetch request ID, frame, numeric and unique
execution-context IDs, document URL/timeOrigin, invocation token, byte length
and SHA-256. The collector independently requires a unique, unredirected GET
Fetch request/HTTP200 response chain, one captured Fetch body, accepted pinned
policy and completed continuation. Consumer length/hash must equal that body.

Only that request's post-continuation `canceled:true, net::ERR_ABORTED` can wait
for its receipt. Pending completion keeps the snapshot incomplete and drain
waiting. Completion has a bounded deadline (the configured collector timeout).
Failure remains sticky; a later receipt cannot clear an unrelated error or a
missed deadline. Document/context loss and session detach invalidate contracts,
including replacement after completion but before acceptance. Default collector
behavior and the existing narrowly qualified optional404 Script rule remain.

The supported consumer is a page-owned GET using one default reader or one
arrayBuffer call. BYOB, alternative consumption methods, reader replacement,
missing/ambiguous initiator identity and selected resources fetched by child
owners fail closed. Other child collection retains the existing body transport;
no child cancellation exception was added. These are measured scope limits,
not permission to infer completion from body capture.

## Fail-before / pass-after and opposing controls

Chrome151.0.7922.108, Puppeteer25.7.0, local headless Linux, cache disabled,
same-origin HTTP. The generated 57,344-byte formula and SHA-256 are identical to
the predecessor control:
`509e350e05a572b1353fe40739100f48bec03145f1a5529d2a095ae051cd346e`.

- `baselinepair17-on-stream.json`: genuine original stream reads every correct
  byte and EOF, but the unchanged default collector rejects its real
  post-continuation ERR_ABORTED. Seventeen bounded paired samples were needed
  to encounter this intermittent event; this is not a rate estimate.
- `acceptance-pair7-on-stream.json`: genuine original consumer, exact initiator
  script/context binding and pinned bytes. The audit proves continuation before
  ERR_ABORTED before the application's completed-consumer receipt. Drain passes.
  Seven bounded paired samples encountered the event under the final contract.
- `acceptance-on-stream.json` and `acceptance-on-arrayBuffer.json`: both normal
  completion paths pass. The application independently verifies generated bytes
  and hashes; the adapter computes its own hash from actual returned bytes.
- Eleven real-browser opposing cases all fail: headers-only/missing EOF,
  ambiguous replacement reader, deadline followed by late completion, uncovered
  required URL, all bytes plus reader.cancel before EOF, real AbortController
  abort, wrong body, empty required body, truncated response, session detach,
  and document replacement. The all-bytes cancellation has the correct hash
  but explicitly has no EOF. Abort still throws the real AbortError.

`bound11-ordering.cjs` replays the retained generated transport IDs/order
(captured11, continued14, failed16, consumer18): old source FAIL, current default
FAIL, opt-in with a newly constructed test contract PASS. This is explicitly a
synthetic ordering regression, not a historical adapter receipt. Its frame/token
are labeled test-only because bound11 did not retain those contract fields.
Fresh Chromium above provides the actual full-identity acceptance. No retained
original evidence is changed. `audit.cjs` checks exact identity/order/hash,
negative acceptance, one body request per application invocation and cleanup.

## Validation, source and recovery

`test/test-browser-response-body-collector.js`: **PASS129**, including all prior
99 cases plus30 completion/identity/ownership/sticky-error cases. These unit
cases remain labeled synthetic CDP. Actual production `attachPinned` is tested
by the Chromium controls, rather than treating those unit cases as browser proof.

The legacy `test/test-return-fire-body-driver.js` fails both before and after
this change on its existing sealed system-data ledger: `lib/process-boot.js`
and `lib/browser-shell.js` differ from the historical pins. Full expected and
actual hashes/stack are in `baseline-adapter.log` and `after-adapter.log`.
No unrelated seal was refreshed. The new actual adapter's generated controls
pass independently of that historical fixture.

Locked build passes are retained in `build.log`, `verified-build.log` and
`final-build.log`. `acceptance-build.log` separately preserves an intervening
failure on another worker's in-progress `lib/host-audio.js` producer census;
its owner reviewed that change, and the final build reran the gates normally.
No AVP2 worker edit to that producer or its seal was made.

`source-base.txt`, `source-final.json`, `source-diff.patch`, and
`new-files.patch` recover relevant source through Git and exact binary patches;
no source/media archive exists. Run inputs and unique JSON/process logs remain
in the run directory. To reproduce from this checkout, preserve existing files
and choose fresh prefixes:

```sh
node test/test-browser-response-body-collector.js
PREFIX=new-order- node scratch/runs/20261107-avp2-consumer-completion/bound11-ordering.cjs
CONTRACT=1 PREFIX=new-controls- node scratch/runs/20261107-avp2-consumer-completion/chromium-controls.cjs
LABEL=new-positive- node scratch/runs/20261107-avp2-consumer-completion/paired-controls.cjs
BASELINE=1 LABEL=new-default- node scratch/runs/20261107-avp2-consumer-completion/paired-controls.cjs
flock /tmp/wine-build.lock bash tools/build.sh
node scratch/runs/20261107-avp2-consumer-completion/audit.cjs
```

The paired search is bounded at60 samples and fails explicitly if no natural
cancellation occurs. It sends no synthetic CDP failure. The audit checks the
retained acceptance filenames; new prefixes are additional evidence. Recovery
also requires local Puppeteer and `/usr/bin/google-chrome`, plus the retained
small `bound11-on-stream.json` generated ordering input from the predecessor.
No game media or remote environment is needed.

All owned browsers and fixture servers closed normally; audit confirms all
recorded fixture ports refused, no process referencing the owned Chrome profile,
and profile absent. The messageboard watcher is explicitly closed on release.
Free /home stayed above2GB at checks. No box was assigned or accessed: box
ID/state/expiry are not applicable; coordinator lifecycle ownership is unchanged.

## Exact remaining original prerequisite

A separately bounded, explicitly authorized registered original Marine session
must install this observer before the real page fetches, pin the real served
resources, and retain a fresh actual-consumer receipt for each required selected
request under its actual execution/document owner. It must preserve original
cancellation and coverage gates; page/child ownership must be measured, with an
unsupported owner stopping the attempt rather than broadening the exception.
The old AVP2.exe receipt cannot substitute for this. Retain actual instantiated
module identity as well as served bytes (the predecessor had only the latter),
then obtain the boot/menu/scene evidence and ordinary movement/fire observations
that the previous attempt never reached. This task makes no original gameplay,
emulator repair, frame-rate, audio or rendering claim.
