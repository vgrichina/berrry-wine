# Browser page renderer identity — 9 November 2026

Production implementation: `tools/warcraft3-prologue/renderer-identity.js`.
Evidence: `scratch/runs/20261109-browser-renderer-target-identity/`.
No Warcraft original is authorized or executed here. The historical Warcraft
page ↔ PID11520 association and original exit cause remain unknown.

The opt-in `--renderer-identity` browser integration qualifies the committed
main page before accepting reviewed commands, installs its check in the actual
lifecycle, and retains synchronous, fsynced identity/event records. Ordinary
runs without that flag retain their existing lifecycle. The prepared harness
includes the helper and unchanged `native-clock-process-proof.cjs` dependency.
This guard does not certify loading before qualification, guest progress,
subframe/Worker PIDs, or game cause. It fails closed if the page cannot qualify.

The concrete mechanism is a short, bounded, page-session CDP trace using
`disabled-by-default-devtools.timeline`. Chromium's
[TracingHandler::EmitFrameTree](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/content/browser/devtools/protocol/tracing_handler.cc)
uses the attached WebContents to emit `TracingStartedInBrowser` frame records;
`FillFrameData` supplies the DevTools frame token and renderer OS process ID.
A browser-target tracing session has no page WebContents for that enumeration.
This is a source-supported explanation for the prior attempt's missing frame
metadata, not a retroactive identity or cause claim for its original.

Qualification requires exactly one trace record matching the exact page
session's committed main frame and URL, an unchanged loader/frame tree and
Target identity, a live renderer in browser SystemInfo before and after trace,
and an unchanged Linux PID/start-ticks/boot/namespaces/executable/argv identity
across collection. Chrome and renderer must share boot, namespaces and
executable, and the OS renderer must carry the exact `--type=renderer` argument.
Trace stream EOF, byte limit and no reported data loss are required. Missing,
duplicate, stale, changed, reused or detached identities retain the first UNKNOWN.
No last-observed CPU leader, null control, or subsequent absence fills a gap.

A navigation, main-frame load/detach, Target destruction/detach, Inspector
crash/detach, session disconnect or immutable deadline retires that guard.
Each later guarded use rechecks Linux start identity. A new lifetime requires
new sessions/guard and a fresh qualification; the old guard stays invalid.
Tracing ends before normal observed activity. Collection is capped at eight
seconds and four MiB by default, with a one MiB native trace buffer request.
There is no ongoing tracing during gameplay. Ordinary quit remains available after identity loss; operational commands are
refused. Successful ordinary cleanup explicitly disposes the guard before detaching its diagnostic sessions.

`attributeTerminal` joins only a proof that was valid at the first actual crash,
both exact Target and scoped Inspector crash events, and an independent kernel
terminal wait with the same PID/start/boot. It keeps CDP termination status and
OS wait status separate. It never treats process absence as a terminal wait.
The small browser fixture uses the unchanged ptrace custodian to retain
before-consumption identities and actual waits independently of CDP.

Offline controls execute the actual helper and lifecycle, including loss,
ambiguity, stale URL/frame/loader, PID reuse, namespaces, missing renderer,
deadlines, durable-sink failure, late trace-start cleanup, target replacement,
sticky UNKNOWN and cleanup after guard failure. All 38 controls pass:
`node tools/warcraft3-prologue/renderer-identity.test.js`. The existing harness
contracts and `flock /tmp/wine-build.lock bash tools/build.sh` also pass.

The exact SuperTux0124 `RUNTIME_RELEASE ... ARCHIVED PHYSICAL_DRAINED` arrived
at 02:02:58Z, after Q20105. Only then was one separately leased small fixture
box created. Chrome/151.0.7922.108 (protocol 1.3; reported revision all zeros)
ran a tiny local HTML page using the production helper and lifecycle. Normal
qualification and evaluation passed. Ordinary navigation invalidated the old
proof permanently. A replacement target qualified and actual target closure
invalidated that proof. A third fresh target qualified before deliberate
`Page.crash`, with these exact records:

| Observation | Value |
| --- | --- |
| Exact target and main frame | `F284B2591F9D34FA627B437E81F12940` |
| Renderer PID / Linux start ticks | `12123` / `60179` |
| Boot ID | `5524ac9f-4c39-4f17-a66d-b16221a09873` |
| Durable qualification | 2026-11-09T02:12:49.328Z |
| Fault request recorded | 2026-11-09T02:12:49.385Z |
| Independent actual kernel terminal wait | 2026-11-09T02:12:53.816073Z |
| Scoped Inspector crash | 2026-11-09T02:12:53.850Z |
| Exact Target crash | 2026-11-09T02:12:53.934Z, crashed / errorCode 134 |
| Independently joined OS status | signal 6, core-dumped flag true |

The retained raw trace hashes match the qualified normal, replacement and crash
proofs. Offline revalidation calls the actual production `attributeTerminal`
on the recovered CDP and independent kernel receipts. The terminal wait is
not inferred from process absence or Chrome's status 134.

Five bounded iterations used this same box. Earlier startup, CDP setup and
page-readiness timeouts remain recorded. The fourth iteration qualified the
normal page, rejected its stale proof after navigation, then correctly refused
a fresh trace containing two primary-frame records with the same frame token
and PID but cached/current URLs. No duplicate-row selection was invented:
requalification after such navigation may require a fresh target. The final
iteration accepts either a uniquely provable navigated lifetime or that exact
ambiguity refusal, and separately proves replacement and crash on fresh
qualified targets. No earlier iteration requested Page.crash. The post-run
join reader initially expected a receipt linkage field on the raw wait row;
that reader was corrected to validate the actual drain receipt and its two raw
kernel events. This correction required no browser replay. The first failures
and their evidence remain retained.

The final run has 168/168 recorded identities with actual terminal waits;
all five iterations total 720/720. Custodian and command waits, stdout/stderr
EOF, pre-consumption identity records and independent terminal statuses are
retained. Separate postflight checks found recorded identities absent, closed
HTTP/DevTools ports, no profile or profile FDs. The fixture sent no game input
and acquired no input/runtime locks. These absence checks do not substitute
for historical waits. Browser shutdown returned exit 0.

Recovery retained 89 unique logs (302,347 stored bytes), checked against remote
SHA-256 and sizes, original decoded SHA-256/sizes and gzip CRC, then independently
checked with sha256sum and GNU gzip. Evidence contains exact Git SHAs, small own
patches and accepted unchanged PATHHASH references; no source tree, media or
module archives. Relevant receipts are `live-verified.json`,
`recovery-verified.json`, `stop-receipt.json`, and `watchdog-exit.json` under the
run directory above.

The independent immutable UUID watchdog was armed at 02:03:20.965Z, before
creation, with deadline 02:28:20.965Z. UUID:
`2dd3c6df-e1bd-4563-8998-80388b2fb543`. Box `bx_9g93pmg4` had TTL 1490 seconds
and initial expiry 02:28:21.163Z. After unique evidence recovery and verification,
delegated normal stop `stop_c0e8fedf15936474` completed at 02:14:43.321Z,
forced=false, error=null. Native API state is **stopped**, with completed
snapshot available and final archiveAfter=null (the workflow's ARCHIVED label).
The independent watchdog observed that receipt and actually exited 0; the box
was physically released before publication. No peer box or original Warcraft
runtime was used. Home free space was checked above 1.5 GB before allocation
and publication; no RAM gate was applied.

This closes the concrete pre-fault mapping gap for uniquely qualified live page
lifetimes. It does not resolve the historical Warcraft renderer association or
cause. A future separately authorized original must qualify its own lifetime
and retain independent terminal diagnostics; this fixture's proof cannot be
reused for it.
