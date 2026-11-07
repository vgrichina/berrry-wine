# AVP2 generated collector control, 7 November 2026

The required cancellation ordering reproduces in local Chromium **even when a
real fetch stream consumer receives every correct byte and observes EOF**.
It also reproduces for actual cancellation without EOF. Browser cancellation
alone therefore cannot establish loss of the application's bytes. The existing
collector rejects both. No safe source fix is justified by these indistinguishable
collector-side observations without adding a consumer completion contract. This
run preserves the discriminator and stops; it does **not** clear the original
Marine gameplay prerequisite or establish historical AVP2 consumption.

Evidence: `scratch/runs/20261107-avp2-collector-control/` (ignored). No guest,
disassembly, original replay, third-party browser internals, held-risk retry,
remote box, nested worker, or public deployment was used.

## Exact consumed-byte witness

`bound11-on-stream.json` is the decisive real-browser trace. The unmodified
`tools/browser-response-body-collector.cjs` and the retained predecessor's
`body-adapter.cjs` served only generated HTML and a generated binary body.
Chrome **151.0.7922.108**, Puppeteer **25.7.0**, headless local Linux, same-origin
HTTP, cache disabled, no service worker, no WASM or game media.

The fixture is 57,344 bytes, each byte generated as
`(i * 73 + (i >> 8) * 19) % 256`; its SHA-256 is
`509e350e05a572b1353fe40739100f48bec03145f1a5529d2a095ae051cd346e`.
The consumer reads the genuine `Response.body` reader until `done:true`, checks
every byte against that formula, concatenates the actual returned chunks, and
hashes them with browser Web Crypto. It reports 57,344 bytes, zero mismatches,
the exact fixture hash, and EOF. There is no synthetic network event or callback.

For that one request the recorded order is:

| Sequence | Actual observation |
| --- | --- |
| 11 | HTTP200 response-stage body captured, full fixture hash |
| 13 | predecessor adapter policy verifies full body |
| 14 | `Fetch.continueResponse` completes; collector records `continued` |
| 15 | `Network.responseReceived`, HTTP200, type Fetch |
| 16 | `Network.loadingFailed`, canceled true, `net::ERR_ABORTED` |
| 17 | sticky collector `network-loading-failed` fault |
| 18 | real consumer returns all correct bytes and EOF |

Owning session `BFF544CC2460A132AD67EE2F318B56CB`, target
`2655EBF2D47E857AD49DC592AF437CB7`, network `1740771.2`, Fetch request
`interception-job-2.0`. The independent consumer runs through `Runtime.evaluate`
on that exact session in default execution context3, unique ID
`4832376845733028637.-2883291388823441718`. Before/after target and document
identity match: `http://127.0.0.1:42957/index.html`, timeOrigin1794039815794.8.
The audit asserts matching target/session/network IDs throughout capture,
verification, continuation and cancellation, and matching consumer identity/hash.
Fetch's paused resource type is XHR while Network's request/response type is
Fetch, exactly as in the retained original failure.

Twelve paired controls using this bound consumer all read the correct bytes and
EOF: 12 interception-off and 12 interception-on. One intercepted pair produced
`ERR_ABORTED`; eleven did not. The earlier page-evaluate stream controls also
preserve two such cancellations among four intercepted runs. The samples show
intermittence, not a cancellation-rate or browser-internals explanation. The
initial arrayBuffer pair succeeds with interception on and off. Worker consumers
were unnecessary to reproduce this page-owned prerequisite and were not tested.

## First concrete error and preserved negatives

The first incorrect inference would be treating the collector's sticky
`network-loading-failed` as proof that the fetch consumer did not receive its
body. Its loadingFailed handler faults after the narrow optional404 Script
exception; required200 has no consumer completion path. The adapter proves only
captured bytes and forwards this fault. `drain()` then prevents later capture.
The collector correctly reports the real CDP event; this experiment does not
justify deleting its cancellation guard.

`bound-negative-*.json` preserves the important counterexamples:

- Explicit AbortController abort: genuine AbortError, no completion, collector
  rejects `ERR_ABORTED`.
- Read all57,344 correct bytes, then `reader.cancel()` before a `done:true`
  read: same hash and `ERR_ABORTED`, **no EOF**, rejected. A hash alone is not
  an adequate completion discriminator.
- Wrong body, empty/missing required body, and a truncated socket response:
  required-body policy rejects; no successful consumer completion is recorded.
  In the truncated case Chromium exposes a partial paused body, rejected by
  size/hash before continuation; the waiting consumer reaches its deadline.
- Detach the owning CDP session or replace its document after headers but
  before reading: no completion witness. The generated acceptance gate rejects
  both even though capture-only collector drain passes. Neither is retroactively
  called consumed.
- `on-headers-only.json`: collector snapshot complete:true, consumer completion
  false. Collector completeness is a body-capture property, not consumer proof.

Every negative remains a failed acceptance in the generated controls. No
production cancellation, body coverage, identity, or timeout policy changed.
A comparison replacing the actual continuation command with
`Fetch.continueRequest` still produced the full-consumption cancellation. The
three small supplementary direct-protocol continuation controls happened to
succeed; they do not justify switching or replaying/fulfilling responses.

## Concrete next step before original Marine gameplay

The missing prerequisite is an adapter receipt for **actual consumer bytes plus
EOF bound to the exact request, session and document**. Retained original logs
have none, so they cannot be reclassified using this generated result.

A follow-up must first add and test an opt-in consumer receipt contract: bind
one real application fetch to its Network request identity; observe its actual
reader/arrayBuffer completion without a second fetch; verify the resulting
byte length/hash against the captured pinned body; verify unchanged execution
context/document/session. A completion deadline, ambiguity, owner replacement,
missing EOF, body mismatch, real abort or uncovered required body must remain
failure. Only the matching completed consumer may distinguish its own
post-continuation cancellation. The old default must still reject unexplained
cancellation. The exact `bound11` control is the old-failing regression; the
preserved negatives are the required opposing cases. Captured bytes, server
finish, continued state, URL alone or an application running flag are insufficient.

Only after that contract passes real Chromium controls, focused tests and a
locked build should a separately authorized original registered Marine session
be considered. This run launches none and makes no gameplay or emulator claim.

## Reproduction, source, tests and lifecycle

Run from repository root:

```sh
PREFIX=fresh- STREAM_ONLY=1 node scratch/runs/20261107-avp2-collector-control/discriminators.cjs
PREFIX=fresh-neg- node scratch/runs/20261107-avp2-collector-control/discriminators.cjs
node scratch/runs/20261107-avp2-collector-control/audit.cjs
```

Use new prefixes; the first command is intermittent. The audit reads the retained
successful discriminator, checks exact identities/order and the consumer bytes,
and verifies rejection of the retained negative controls. It passes. Initial
controls and direct-protocol comparisons are also retained as small generated
inputs and logs. Source base is `e83eb9fd315c24d525c1dd32b1f4181d974c33b1`;
source receipts pin the actual collector, adapter, tests and generated controls.
No source tree or media was archived.

`node test/test-browser-response-body-collector.js`: **PASS99** synthetic CDP
lifecycle cases with real local HTTP bytes; these are explicitly not Chromium
acceptance. `node test/test-return-fire-body-driver.js`: **FAIL** its preexisting
sealed ledger comparison for `lib/browser-shell.js` (expected
`b7380c6dc115ab89794b491164fba0107788647314fdfe1a9276a1d7ae6624e9`, actual
`7d885b1b5a102493bc2f8f4fe9167ba62c271c09c5e09e87cfc787c67cebd5f1`).
The exact failure is retained; no ledger or unrelated file was changed. No
collector/adapter/test source changed, and no new locked-build claim is made.
This is a documentation-only publication.

All generated local browsers and HTTP servers closed normally, their temporary
profiles were removed, and no remote lifecycle is owned. Historical
`bx_z4d6hnmp` was not accessed, resumed, stopped or deleted. Source changes to
`tools/mcm-bound-input.cjs` were avoided. Free disk stayed above2GB at checks;
the run uses approximately1MB. Artifacts precede `result.json`, written last.
