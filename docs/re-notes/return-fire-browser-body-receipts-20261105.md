# Return Fire browser body receipts, 2026-11-05

The collector repair and offline validation passed. Browser response bytes are
captured while the response remains paused in its owning CDP session, before
unchanged continuation. No Chrome, game, audio or original retry ran. The old
Chrome missing-content trigger cannot be proved from the retained evidence;
the repair removes the collector's dependency on a later Network body lookup.

The immutable predecessor is published `6910202949bf56e9b3488587fdd0b96893e07922`,
documented in `return-fire-system-data-audio-20261105.md`. Its exact
`scratch/runs/20261105-return-fire-system-data-audio/used-composed-driver.cjs`
subscribes to page responses, calls `r.buffer()` and rejects lookup errors.
At 03:28:15.851Z, HTTP 200 for `ART/1PSCREEN.~CR` failed with
`Network.getResponseBody: No data found for resource with given identifier`.
Expected bytes are 308280, SHA-256
`6594b50825cea56d6b2d2591a4737b26757a0ee2e9c51fd76efb76f66fd9ab39`.
Historical driver, first failure and final artifacts remain immutable.

Installed Puppeteer 25.7.0 `HTTPResponse.content()` already waits on its
body-loaded deferred before `Network.getResponseBody`, using the associated
request's CDP session. `NetworkManager` resolves that deferred at loading
completion/failure and can adopt the event's session. It enables Network with
default parameters. The used driver records neither request/session identities,
loading events, buffer configuration nor detach events. The deferred also
resolves after loading failure, so HTTP 200 does not prove a completed transfer.
Retained evidence establishes a post-loading-signal Network body lookup failure,
but cannot identify the missing-content cause or distinguish transfer failure,
session adoption or target lifetime. The server's correct file
does not establish browser consumption. An added sleep or error acceptance is
not a justified remedy.

The implemented collection boundary is CDP Fetch response-stage interception in
each owning page/attached Worker session before navigation/resume. Read the
actual paused response using that session's Fetch request ID before continuing
it unchanged. Record session, target, Fetch/network IDs, method, URL, redirect
identity and capture/continuation states. Body lookup errors, unfinished target detach,
timeout and cancellation remain failures. Existing pinned size/hash and exact
system-data/font-fallback policy remains the acceptance authority.

CDP documents that `Fetch.getResponseBody` requires a paused response and that
continuation/disable during retrieval has undefined behavior; redirected bodies
are unavailable. See [Fetch protocol](https://chromedevtools.github.io/devtools-protocol/tot/Fetch/).
The collector avoids post-completion Network retention and does not refetch,
fulfill requests, change browser body bytes or use static-server bytes as proof.
It changes request timing; actual browser behavior remains untested here.
Every transport fixture and its final collector artifact is labeled synthetic.

The composition helper checks the exact historical driver SHA before
applying named amendments and forbids a non-mock entry in this assignment.
It preserves the existing system-data discovery/ledger, five-font fallback,
pin/hash/size checks, readiness/controls, immutable first-failure setter and
normal close/final artifact path. Receipt completeness also requires completed
collector continuations and coverage for observed owning-session HTTP 200s.
Raw Network loading failures fail immediately. Completed body receipts survive
a natural target exit; unfinished capture/continuation does not. Identity
adoption without matching owning-session evidence fails closed, rather than
matching another target's body by URL.

The exact error text matters: published Chromium implementations distinguish
unknown resource IDs and explicit inspector-cache eviction from the branch
where a resource exists but no content or usable cached body is available.
That supports a missing-content diagnosis rather than proof of a wrong ID or
eviction. It does not identify this installed Chrome's internal trigger. See
[Chromium Network agent](https://chromium.googlesource.com/chromium/src/+/6c5f5ee0b475b53a51865f72dc2fdc40d3d3605f/third_party/blink/renderer/core/inspector/inspector_network_agent.cc).

Implementation is in `tools/browser-response-body-collector.cjs` and
`tools/return-fire-body-driver.cjs`. The collector imports only crypto/assert;
it has no filesystem reader, HTTP client, refetch, fulfillment or alternate body
source. `Fetch.getResponseBody` must settle before `Fetch.continueResponse`.
The latter receives only the original request ID, without replacement headers,
status or body. Unsupported commands fail closed. The default command/body
deadline is 2000 ms and the bounded body limit is 64 MiB; pinned size/hash
verification remains mandatory regardless of those transport limits.

The parent page and recursively attached Workers install collection before
navigation or paused Worker resume. A missing child session is a first failure.
Puppeteer's actual Symbol disconnect event cancels unfinished work. A completed
capture plus continuation survives natural target exit. Close cancels and
settles pending work before normal owner close, without disabling Fetch or
continuing a request whose body lookup is still pending. Late body results
cannot create receipts. The existing synchronous exclusive first-failure file,
deep freeze and terminal/result/final-pin path are preserved. Final artifacts
include both body-capture lifecycle and policy receipts; partial collection
cannot report complete. A bundle 404 continues before waiting for fallback
completion, allowing the browser to initiate all five individual font requests.

All dependency gates preceded shared edits and executable tests at 04:22:50Z:
MDK0320 `68423e88b33f67b0094155c92aa635f4fd614b27`, D3D70330
`f1d62b136d7e3b7d7bb1a108774f5c804533e483`, Stronghold0340
`89caed5d1deeec73ea1c8538e8eb50f996b29496`, each FINAL runtime AND file RELEASE
ALLBUILDSFINISHED. `release-gate.json` records fresh independent commit ancestry,
normal exact PID/startticks absence, refused ports, absent profiles, free locks,
no competing compiler/browser/focused tests and the owner disk floor.

`node test/test-browser-response-body-collector.js` passed 27 synthetic CDP
lifecycle cases with real local filesystem/HTTP bytes. Cases cover out-of-order
identical URLs, identical request IDs in different sessions, delayed availability,
capture-before-continue, rejection, malformed base64/types, timeout, cancellation,
late results, unfinished/completed target exit, duplicate identity, redirect,
method/origin checks, missing HTTP-200 receipt, cross-session borrowing rejection,
loading failure, continuation rejection/timeout and the body-size limit.

`node test/test-return-fire-body-driver.js` passed 22 cases through the actual
sealed composed entry and current reusable helper. There were 33,927 real
filesystem-backed HTTP sends across the suite, including pin preflight sends;
these sends are fixture inputs and never substituted for runtime browser proof.
The positive synthetic transport case completed twelve policy receipts, including
the actual declared 15088-byte TLB, a genuine favicon 404, the actual host class's
bundle-404/five-font fallback, and three simultaneous exact 308280-byte art
bodies through page, Worker and nested Worker sessions. Every art receipt has
the predecessor's expected SHA. Worker collection precedes resume. Preload
compilation and audio event fixtures do not execute a guest or prove audio.

The other composed cases require exact expected failure boundaries for wrong
hash/size, missing/wrong pins, existing-file 404, lookup rejection/timeout,
cancellation/detach, method/redirect/query, missing system-data receipt despite
real HTTP 200, corrupt/omitted/rejected/unresolved font fallback, malformed bundle
query, unknown 404 and missing child session. First failure exists before mock
close and agrees with terminal/result artifacts. A synthetic absent-declaration
policy fixture uses a genuinely missing path and real HTTP 404; it never removes
or reclassifies the real TLB. Both plain Puppeteer launch and its native spawn
boundary are intercepted before spawning (one guarded attempt each); zero Chrome
launches occur. The fixture refuses a non-mock driver entry. Default viewport,
audio, readiness/input behavior and original caps remain unchanged.

The required `flock /tmp/wine-build.lock bash tools/build.sh` passed. The current
existing module paths remain canonical SHA-256
`3859c274df0233659eb10fe4d2784fff7d1553242b4ae2b3bf653e5d2ebdd95b`
and compat `9f042b70d7e43d3947415e1de01e7a540b3c7f7fa6c7fbefabdbea17e9633e95`.
These are the released D3D70330 outputs, not modules changed by this repair.

Evidence is in `scratch/runs/20261105-return-fire-browser-body-receipts/`, notably
`collector-attempt1.log`, `composed-attempt1.log`, `test-hq5Px6/summary.json`,
per-case driver amendment patches and terminal artifacts, `full-build.log`,
`source-analysis.json` and `source-reuse-audit.json`. The latter explicitly
names all eight old/new source/module amendments from released predecessors;
1522 historical pins match. The exact used driver SHA remains
`90f4d8f6d182b28aefe07744148452d5deb8590aaf12801a0313e137ca13b008`,
and historical first-failure SHA remains
`36714e00ab3f73679e6b1932f665cea6a71c4166353d3d76d94b676b523f9e48`.
All 1077 baselined predecessor artifacts are preserved. Recovery uses Git SHA
plus relevant binary diffs/new-file patches and existing module/media path hashes;
there are no source-tree archives or media/module copies.

The next authorized runtime must first establish actual Fetch support and
page/Worker session coverage, successful body capture and unchanged continuation
within the existing caps. Session adoption without matching evidence remains a
fault. This task does not establish browser, Play, gameplay, audio or guest-body
consumption success, and does not authorize an original retry. Box ID/state/expiry
N/A; coordinator retains shutdown ownership.
