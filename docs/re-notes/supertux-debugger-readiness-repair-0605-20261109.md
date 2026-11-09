# SuperTux 0605: exact first-debugger boundary, repair not established

**No production repair is established.** The retained Super0542 evidence does
not prove an ordering, deadlock, or cancellation defect. Production code is
unchanged; there is no claimed old-FAIL/new-PASS repair. This is the concrete
remaining blocker, not acceptance of the requested repair.

Evidence: `scratch/runs/20261109-supertux-debugger-readiness-repair-0605/`.
Git base: **bfeec70e37794aa7cd6439c342ed8b40b01eecf6**, also recorded in
`git-base.txt`. Git plus the small owned
input/note patches supplies recovery; no source tree, media, or module archive
was made.

## Actual shipped path

Super0542's `launcher.cjs` reads its `composition-pins.json.gz`, invokes
`tools/supertux-native-driver-composition.cjs::compose`, installs the retained
JSON storage adapter, then compiles the returned source using Node's Module.
The base is
`scratch/runs/20261108-supertux-short-step-progression-2236/browser-fixed.cjs`;
the retained amendment is
`scratch/runs/20261108-supertux-native-pause-controller-2251/browser-integration.patch.gz`.
The composer adds the readiness latch, sticky terminal handling, physical input
drain, and CDP transport without changing the initial page debugger ordering.

All **34 composition providers** were checked against the actual Super0542 pins,
using their exact published Git blobs where specified. The reproduced composed
SHA-256 is **3793f2757d4189fed48a5f8ec898e25722cb9c9787429db1387d09345c03a48d**,
published composer **fddc9322aa42497bedeebfeef6447a47ff0df6e6**. Its startup awaits:

1. Browser endpoint and WebSocket connection; install the message handler.
2. `Browser.getVersion`, browser `Target.setDiscoverTargets`, browser
   `Target.setAutoAttach(waitForDebuggerOnStart=true, flatten=true)`.
3. `Target.getTargets`, assert one page, explicitly `Target.attachToTarget`.
4. Register that returned page session in `workers`; await
   **`Debugger.enable` on the explicitly attached page session**.
5. Construct `bound.createChain`, enable page child autoattachment, Page and
   Runtime, install native-input recording, navigate, run readiness, then capture
   startup and publish `ready.json`.

The initial debugger failure is at step 4. Worker attachment tasks catch and
record their own errors; the top-level first-browser-failure path awaits this
page request directly. `tools/browser-consumer-completion.cjs::observeConsumers`
is **not connected to this composition**. Its Runtime/Page/Debugger observer
setup is used by `tools/return-fire-body-driver.cjs`; changing it cannot repair
Super0542's first request. The actual capture observer is the retained
`bound-input.cjs` chain, constructed only after that request succeeds.

## What the retained evidence establishes

Reopened and SHA/size checked all **38 inventory entries / 37 unique retained
transports**, including nested original gzip streams. `retained-audit.json`
records the source references and checks without copying the artifacts.
The 59 remote regular-file total in the original task includes entries outside
this unique-content inventory; these counts are not substituted for each other.

Node PID **6829**, Chrome PID **6852**, browser version **151.0.7922.108**, endpoint,
and first failure **2026-11-09T05:55:52.741Z** are retained. Version completion is
browser-process evidence, not page-renderer readiness. The 20 seconds preceding
the failure contain **247 custody events**, including **57 new identities**,
58 fork-parent-release records and one actual reap. This interval is a nominal
timeout window; its beginning is **not an observed CDP dispatch timestamp**.
Process creation was progressing, but the records do not identify which renderer
owned the CDP session or when that renderer accepted/replied to the request.

Custody has **1,177 events, 133 owned identities and 133 actual reaps**, no
supervisor cancellation/failure, and complete drain with no unresolved lineage,
ptrace requests, remaining or unreaped identities. Normal Browser.close ACK,
exit 0 and stream drain took **19,025 ms within 30,000 ms**, without signals.
The later close success does not prove earlier renderer availability.

There is no retained per-request CDP wire journal, target/session mapping or
ordinary queued-CONT completion journal. `fork-parent-release` records precede
queued continuation; they are not actual CONT-completion receipts. Therefore
neither renderer latency nor a queued-resume starvation claim follows from
these timestamps. Historical missing waits/creator identities remain UNKNOWN.

## Offline controlled checks

`probe.cjs` executes the **entire exact composed startup and close**, retaining
the production transport's **20,000 ms** request timeout. It uses the actual
bound-chain implementation; only the external HTTP server, Chrome process and
CDP peer are controlled. Each peer is a real Node child; an independent parent
deadline is armed before launch. All five children actually closed 0 with
separate stdout/stderr EOF:

| Peer control | Observed composed result |
| --- | --- |
| Correct page debugger reply | Constructs the real bound chain and reaches the next page setup request; deliberate stop there |
| Explicit debugger rejection | Preserves that rejection; no chain/navigation/readiness |
| Disconnect during debugger wait | Rejects pending request as disconnected; no continuation |
| No debugger reply | Historical `CDP UNKNOWN Debugger.enable` at the unchanged timeout |
| Debugger reply at 21 seconds | Same first UNKNOWN; late reply is ignored during orderly close; no continuation |

No control navigates, sends input, captures a screenshot or publishes readiness.
An automatically attached page event uses a different session from the explicit
attachment; the requested explicit session and reply ID are recorded. The
controls do not assume that waiting-for-debugger prevents `Debugger.enable` ACK.

`inspector-control.cjs` additionally connects the production transport to a real
Node/V8 `--inspect-brk` child. Runtime and Debugger enable both ACK **before**
`Runtime.runIfWaitingForDebugger`; the child then resumes and actually exits 0
with both EOF. This rejects that dependency as a generic CDP assumption; Node is
**not** substituted as proof of historical Chrome behavior.

Fresh checks passed: exact **1,586-provider pinned preflight**, composition
transport/lifecycle suite, **13** composed startup-latch cases, menu diagnostics
(nine action cases plus helper ACK timeout), **129** consumer/collector cases,
and `flock /tmp/wine-build.lock bash tools/build.sh`. Existing tests' fixture
timeouts remain fixture-only. Their refreshed local test manifests are separate
from the exact historical pin verification. fddc causal diagnostics remain intact.

## Exact remaining boundary and next evidence

The unresolved handoff is **the first explicit page-session `Debugger.enable`
from the browser CDP connection into Chrome's page-renderer agent, and its reply
back to that connection, before navigation**. The same proven controller failure
can result from a silent peer or a reply after its immutable deadline; a fixture
that withholds that reply cannot establish which occurred historically.

To make a causal repair reviewable, recover any **already retained** trace with
the original `Target.attachedToTarget` parameters (including waiting flag and
session), explicit attach response, debugger request ID/session/dispatch time,
and corresponding result/error/connection close. Bind that to the renderer
PID/start and actual ptrace CONT results for the request interval. That evidence
would distinguish an unreleased autoattachment, renderer initialization held by
custody, a browser/renderer dispatch failure, or a late/lost reply. None of those
bindings is present in this inventory. They cannot be reconstructed by assuming
absence, by changing a timeout, or by testing a different peer policy.

Under the offline-only constraint, unavailable historical browser/renderer
handoff evidence is the concrete blocker. No runtime retry is scheduled. No
debugger requirement, qualification, deadline, input cap, lineage check,
timestamp, attestation or freshness check was changed. Q20600 reader6e18,
caller1473, custody4341 and CPUa320, and WC5ec810 pins/artifacts were untouched.
No peer artifact was edited. No agent, worker, box, Chrome, original game or
deployment was launched; box ID/state/expiry/stop receipt are **null / NOT_CREATED
/ null / null**. Free /home remained above 1.5 GB. Single task STOP.
