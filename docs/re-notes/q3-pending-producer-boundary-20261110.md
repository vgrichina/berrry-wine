# Q3 startup producer predicate retention

Evidence: `scratch/runs/20261110-q3-pending-producer-cause-1448/`.
Offline only; no original retry, browser, box, guest writes or deadline change.

The retained 1422 run has 48 settled producer requests across startup and
command observation, plus two screenshot-time producer response payloads.
The first payload has endpoint 1, WebGL backend, owner 0, a current context,
hwnd 65543, completed 4949, presented/writeSeq 9, draws 4233 and vertices
32196. The later payload advances these counters. These are screenshot-time
observations, not recovered early startup responses.

The failed 1435 run has 32 settled requests but no producer response payloads.
The retained selector source is identical between runs. It requires one
matching GL endpoint/backend/current owner/context/window, positive completed,
presented and writeSeq, then backend-specific draw/transport predicates.
For WebGL these include non-software context, WebGL availability, positive
draws/vertices and the page renderEndpoint matching the GL endpoint.
No retained value identifies which predicate rejected 1435. Guest slice
progress and startup expiry establish neither a crash nor a causal guest defect.

The concrete diagnostic gap was an opt-in dependency: the existing reply lane
was disabled without Q3_READINESS_WIRE=1, while screenshot probes only retain
producer values after readiness succeeds. The production TransportSocket now
always enables a narrow producer/page reply lane. Verbose startup/console
observation remains opt-in. The page query is recognized both directly and
with the exact retained GL observation wrapper used on the actual send route.
Each lane retains at most 64 existing responses, independently of other wire
traffic. Existing bounded copies explicitly report truncation; request ID,
expression SHA, target, request/response sessions and pending/session-match
status accompany every response. No new protocol request, timer, guest action,
readiness decision or promise settlement is introduced.

Focused tests execute the actual generated send/evaluate/delivery functions
through the production socket wrapper with the verbose flag absent. Page and
producer selector inputs survive; isolated zero/missing predicate controls,
independent caps, no extra requests and unchanged successful screenshot result
delivery pass. Existing ready/pending, sink/error/truncation, actual GL adapter
setup-only, and generated full-caller delayed/error/missing-reply controls pass.
The stale readiness fixture's renderer manifest now names the current CPU
bytes it actually returns; retained evidence provenance is checked separately.
The locked build passes. The standalone screenshot regression now uses the
supported fixed foreign composition and includes its actual startup helper
prelude. All nine real localhost WebSocket/numbered transport controls pass,
including successful capture, unchanged real 20-second deadlines, late replies,
no replay, closed socket/server, zero pending requests and zero remaining timers.
Historical providers remain unchanged.

Next separately authorized bounded attempt: prepare a fresh sealed route;
recover execution-boundary-transport.jsonl.gz. Join page-owner-reply and
producer-reply by their request sequence, renderer session/target and page
owner, then apply the unchanged selector to reply.value.result.value and the
configured backend. If a cap, truncation, mismatch or missing response prevents
that join, retain UNKNOWN. Successful capture review/input rules are unchanged.
