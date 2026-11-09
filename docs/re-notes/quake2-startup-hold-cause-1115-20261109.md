# Q2 startup hold boundary observation, 1115

Q21100's cause remains UNKNOWN. The retained first terminal is
`input delivery exceeded physical hold` at 10:58:54.398Z. Reconstructing the
actual health-integrated generated source maps stack line 156 to the five-key
50 ms preflight on `about:blank`, before app selection. The failing key's index,
actual helper start time, request/session IDs, socket submission times, UP reply,
and pending requests were not retained. DevTools readiness took 503 ms; this is
endpoint readiness, not app readiness. There was no READY or numbered command.

The assertion follows a successful DOWN promise resolution after the helper's
independent release timer has fired. The helper attempts UP independently of
that DOWN reply and joins release before throwing. The retained error does not
establish socket-send return timing, browser service time, application timing,
or successful UP acknowledgment. No causal runtime fix is justified by these
missing boundaries.

Added an opt-in Q2 observer, reusing the unchanged Q3 bounded recorder. It
records Node monotonic socket entry/return/throw, direction/key/request/session,
raw matching replies before pending discard, protocol errors, unattributed
socket errors, the first terminal's pending method/session list, startup stage,
and actual helper receipts with their bound origins and independent releases.
Provider hashes identify the generated consumer, composition, helper and both
observers. Browser service/application times remain explicitly UNKNOWN.
Deferred sinks retain sticky failures and bounded loss counts. Observation
does not settle pending requests, replay input, or extend any bound.

Enable in a separately authorized fresh run by adding both observer references
from `references()` to authenticated pins and loading
`tools/quake2-input-wire-observation.cjs` after the production composition
preload, with `Q2_INPUT_WIRE=1` and `QUAKE2_NATIVE_COMPOSITION=1`. The authored
native-fixture preload must retain that outer compile hook. The tests exercise
the actual opt-in loader and reject missing/changed observer pins before launch.

Evidence: `scratch/runs/20261109-quake2-startup-hold-cause-1115/`.
Eight paired runs execute the actual generated keyboard/type/combo preflight,
actual helper, send/reply handler, command transport, terminal and joined close,
with inert process/server/CDP seams. Old runs lack boundary observations; new
runs retain them with identical input order and exit outcomes. Controls cover
success, synchronous throw, protocol failure, socket error, delayed DOWN,
stalled DOWN, raw late replies/session mismatch, and failed UP. A ninth observed
run injects diagnostic sink failure and still completes ordinary joined quit.
Three actual preload/provider preflights pass. Delayed DOWN reproduces the
assertion with UP submitted within the unchanged 50 ms interval; this is a
possible failure mechanism, not attribution of the native incident.

Existing Q2 composition tests pass for normal quit, combo, partial input,
pending capture, and held UNKNOWN with UP failure, including budget and helper
controls. The locked build passes. Thirty-five unchanged historical proof
references are reused by path/hash/size with gzip CRC verification. The fixed
explicit `waitMs: 0` producer, eager HEALTH_PROVIDER before actual-main ROOT
rebind, and passive health history/first-HP-loss terminal remain unchanged.
Initial test attempts exposed fixture setup errors; only the final passing
controls are claimed. Recovery is exact Git base plus the small owned patch;
no source archive or media/module copy was made.

No box, browser, guest, worker, agent, or deployment was created. Q21100
`bx_eck676y4`, UUID `da11875e-ab1c-4959-95cc-85f22b7578fc`, remains retained
ARCHIVED / PHYSICAL_DRAINED, normal stop `stop_ab746b75b57021ae`, initial expiry
11:22:34.765Z; no new API contact. No new stop receipt is applicable.

Next requires separate authorization: fresh authenticated pins and the whole
actual observed native fixture before any original launch. First HP loss stays
terminal. Native REVOKED; all-writers/edict ABA UNKNOWN; inert controls support
no native gameplay claim. SingleTaskSTOP.
