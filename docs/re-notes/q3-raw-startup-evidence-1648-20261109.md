# Q3 raw startup evidence, 1648

The missing native evidence is recovered: request 6 returned a valid reply on
the correct page session **7 ms after its unchanged 20-second deadline**, after
the Browser.close reply. The authenticated production composition records that
late reply before routing discards it. Chromium's internal delay cause remains
UNKNOWN; no startup-policy repair is justified. Arena movement/firing remain
unverified.

Evidence: `scratch/runs/20261109-q3-raw-startup-evidence-1648/`.
Git is the source archive: exact base plus `owned.patch`; run-specific Python
inputs have retained references, SHA/size and small patches. No source tree or
media archive is created.

`tools/q3-current-module.cjs` supplies an assertion-anchored transform applied
by `tools/q3-current-foreign-closure-v1.cjs` to the authenticated generated
consumer. It records exact outbound/inbound JSON, request ID, method, reply and
request session IDs, protocol error/result, pending-match status, whether an ID
was previously sent, and target ID/type/URL/`waitingForDebugger`. Inbound frames
are recorded before parsing/routing, including unmatched, duplicate and late
responses. Separate timeout, send-error and transport events retain their
request/session context. Logging ends after a successful navigation reply;
a terminal startup continues recording through cleanup. Existing routing,
first-failure propagation, startup policy, debugger policy, CPU/provider
authentication and deadlines remain unchanged. A peer's waiting flag does not
model a paused Chromium renderer and is not used to infer one.

The production peer regression now uses fresh native-lifecycle preparation,
the actual generated relative-import entry, and the native cause/input-wire
hooks. Ten cases exercise single and duplicate page sessions, event ordering,
waiting flags, protocol error, socket closure, an unchanged 20-second timeout,
late reply, and duplicate/unmatched replies. Every inbound/outbound envelope
is checked against the peer's exact transcript; late and duplicate replies
remain unmatched without reviving setup. The real stand-in browser and caller
actually wait with separate stdout/stderr EOF. No local Chrome, navigation,
guest input or capture runs in these controls.

The full lifecycle check caught an initial diagnostic insertion breaking the
input-wire hook's literal transport seam. The insertion now preserves that
seam; both generated lifecycle paths and all ten peer cases pass. Initial
invalid test assertions (plain versus compressed log name, a duplicate-reply
case accidentally classified as a timeout) and an early stale-manifest failure
from editing the provider while a test ran are retained as failed controls.
They are not native evidence. An integration invocation without its required
foreign selector and a concurrent negative-control test's 20-second timeout
are also retained; production deadlines were not extended.

Fresh own 942-provider preparation independently hashes manifest
`af96d84fbb3b1483fe06e0ffd752c9b957d93db9140d6931e42d3f6989f3d368`.
The actual own provision body verifies all upload bytes and generated remote
prelaunch syntax offline. Both actual own generated launch paths execute the
prelaunch/custody/staged consumer with Git unavailable and the existing
DRIVER_PREFLIGHT exit before Chrome. Kernel reaps and distinct outer/runtime
parent waits with separate EOF pass. The production controller regression
executes the actual fresh generated caller's retained original branch and
preserves first failure with successful and failed read-only joins; later
capture remains unrequested. The current foreign-closure suite passes all
27 refusal controls. The locked build passes.

The final peer regression also reproduces the native ordering: Browser.close
ACK, then request 6's valid late ACK. Setup stays terminal and the late frame
retains its original request method/session with `matched:false`.

Both Q2-reviewed1638 and Redline-validation1648 published RELEASE STOP before
allocation. Their unique retained artifacts were independently checked for
compressed and decoded SHA/size and gzip CRC, physical drain, exact API archived
box/normal unforced stop, and actual watchdog join with separate EOF. Neither
had started a native runtime: their kernel and runtime parent waits are
NOT_CREATED. Redline's separate runtime/writer lock predicates were not present
in its retained census and remain UNKNOWN, alongside its historical browser
EOF; no inference replaces those missing predicates.

The one own box was `bx_882xv5qc`, UUID
`2a330650-f9b4-46e0-8e8b-2782b940e48e`. Its independently observed immutable
25-minute watchdog was armed before allocation; initial expiry was
`2026-11-09T17:28:03.235Z`. All 942 production provider uploads and both actual
remote prelaunch import checks passed. An offline-only upload journal was
moved into the offline evidence directory before allocation to preserve the
native writer's fresh write-once path. No production path or provider pin was
changed to accommodate that isolation.

The single diagnostic cancellation fixture reached native Chrome
`151.0.7922.108` and failed before readiness. The raw stream establishes:

| UTC time | Native observation |
| --- | --- |
| 17:04:17.595 | Root request 3 auto-attach replied successfully. |
| 17:04:17.597 | Manual request 5 attached the about:blank page and returned session `5DBBEBD190A971BE915FA3D4AC74FA1E`. |
| 17:04:17.598 | Page-session request 6 sent Target.setAutoAttach on that same session. |
| 17:04:37.598 | Its unchanged 20-second deadline removed the pending request. |
| 17:04:37.599 | First browser failure recorded CDP UNKNOWN; no replay. |
| 17:04:37.600 | Cleanup sent Browser.close (7), which replied successfully. |
| 17:04:37.605 | Request 6 returned `{result:{}}` on the correct session, recorded as a known but unmatched late reply. |

There are four native attachment events: two sessions on the same about:blank
page, and two `browser_ui` omnibox-popup targets. All four report
`waitingForDebugger:false`. This is actual browser evidence, not the earlier
peer's invented target reconstruction. Actual renderer pause state remains
UNKNOWN. Browser UI target-info events arrived during the outstanding request,
so inbound event delivery continued. No protocol error or wrong-session reply
explains this run's request 6 failure. Its valid result arrived after the
pending deadline, rather than being permanently absent. The ordering after
Browser.close does not prove that shutdown released a Chromium dependency.
The internal service-delay cause remains UNKNOWN; changing debugger policy,
adopting another session or extending the deadline would be speculative.

The owning observer cancelled on the first browser failure. The caller exits
1 after its read-only joins and preserves that first error. No Page.enable,
navigation, guest input, screenshot, original arena, retry, second box or
deadline extension followed. The new fixture closes the raw-reply evidence gap
but does not establish a safe causal startup repair or gameplay qualification.

Kernel custody records 120/120 actual reaps, complete with no failure or
unreaped identities. Three distinct generated-parent, prelaunch-child and
runtime-parent waits have separate stdout/stderr EOF. Independent physical
drain verifies ports 36063/39625 closed, profile absent, no runtime FD holders
or input writer lock, and runtime lock drained. Normal browser-close EOF and
nonleader/untraced-clone auditing remain UNKNOWN. The empty native command log
is retained and is not used as EOF proof.

All 43 unique retrieved artifacts were independently reread for compressed and
decoded SHA/size and gzip CRC **before** delegated normal shutdown. The exact
final API box state is ARCHIVED, archiveAfter null, expiresAt NOT_RETURNED,
normal unforced `stop_6fd590a9e08ece24` completed
`2026-11-09T17:05:35.055Z`. The independent watchdog actually joined 0 with
separate stdout/stderr EOF; its configuration hash stayed unchanged and its
lifecycle parent returned 0 and released the local lock. No inherited box was
mutated, deleted or resumed. No local Chrome, workers/agents or deployment ran.

Next work is offline Chromium service-delay diagnosis against these exact
raw frames. This task makes no further runtime attempt and ends with final
published RELEASE STOP.
