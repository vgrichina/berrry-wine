# Q3 terminal cleanup and screenshot service — 2026-11-09

The Q3 generated consumer now closes admission to **all** CDP methods after
its first runtime failure, including automatic `Browser.close`. Cleanup still
uses the unchanged shared lifecycle helper to contain the browser and await
exit and separate stream EOF. Ordinary completion and explicit owning-parent
cancellation retain their normal close path. Cancellation cannot reclassify
an earlier runtime failure. The outer generated rejection handler latches its
failure before invoking cleanup, including protocol refusal and CDP timeout.
Shared providers, Nox, Redline, input hold guards and runtime deadlines are
unchanged.

Code is published on main at `c3db439b87f63f65eac8bc2c3457b2c8804bd509`.
Both locked builds passed, including the final build after the test adjustment.

Evidence: `scratch/runs/20261109-q3-terminal-cleanup-capture-repair-2145/`.
Git is the source archive: `gitbase.txt`, `code.patch`, `new-test.patch` and
the final runtime commit identify the candidate. No source/media archive.

## Actual caller controls

`q3-terminal-cleanup.test.cjs` runs sealed generated callers under the actual
Q3 ptrace supervisor with real Node browser stand-ins and a held screenshot
peer. The baseline installs published `c367007f7` composition and reproduces
the automatic post-terminal close. Candidate work deadline, CDP deadline and
explicit screenshot refusal admit zero subsequent CDP requests. Direct later
input, capture, Browser.close and capture-function attempts reject. Actual late
raw screenshot replies do not create an image or successful command ACK.
Ordinary success and planned cancellation each send one close and exit normally.
All six controls drain every owned task: 115/115 actual reaps, separate stdout
and stderr EOF. Failure controls use the existing kernel SIGTERM escalation;
their close receipt remains UNKNOWN rather than a successful protocol ACK.

`q3-capture-boundary.test.cjs` also exercises the real public WebSocket boundary,
delayed and large returned messages, the unchanged 20s absent-reply timer,
bounded observations and the whole sealed generated consumer. Its stand-in
child lifetime now covers the existing kernel cleanup grace period. An initial
35s stand-in cap exited9 ahead of cleanup; both that failure and the corrected
test are retained. Staging tests pass both actual prelaunch phases, five
independently staged manifests and five mutation refusals. Actual controller
pipe/EOF/SIGPIPE tests pass. The legacy unversioned current-module test still
rejects the already published foreign prelaunch generation before its expected
tamper assertion; this is an obsolete route expectation, not a candidate pin
substitution. The supported versioned route is exercised by the above tests.

## Retained actual screenshot boundary

The previous original's unique screenshot log was independently SHA/size and
gzip-CRC reread through its retrieval index. Request388 sent `{format:'png'}`
to the exact page session. Its bounded one-shot owner probes all returned with
matching pending/session routing: page10.250ms, renderer1708.174ms,
producer1713.794ms, guest1724.983ms after screenshot request. The renderer
reported `failed:false` and producer counters including presented1044. This
establishes service of those owner reads while the screenshot was unresolved;
it does not establish compositor entry/readback completion or continued guest
progress through the later deadline. The diagnostic snapshot retained
18,031.164ms pending, zero drops/errors; the separately retained transport
interval is about18.037s. There is no returned third image. Guest death, blank
presentation and arena entry remain unestablished. The structured excerpts and
summary are `retained-screenshot-boundary.json` and
`retained-boundary-summary.json` in this run. No guard extension or replay was
used to obtain this discrimination.

## Native outcome and lifecycle

The final candidate was tested, committed and immediately strict-SSH
pulled/pushed before sealing. Manifest raw SHA256:
`65b408fabe64f502bbe6c0330ea454f38d3f82b8c4a6ee426d73e6f81efe78ff`.
All 944 pins in each of five staged manifests were independently SHA/size reread
before allocation; both actual local phase prelaunch checks passed. No sealed
candidate was changed after allocation.

The sole box was `bx_ht7xe78h`, UUID
`971f623d-9029-4734-89f9-7069c52ebaf8`. Before creation its independent immutable
25min watchdog was observably armed with PID/start identity, fresh heartbeat
and read-only config hash. Initial expiry was **2026-11-09T22:14:08.025Z**;
watchdog deadline epoch1794262448.7367518 (**22:14:08.737Z**).

**First failure: provisioning HTTPS provider-upload write timeout**, inside
the existing 90s `urllib.request.urlopen` call. The uploader returned exit 1;
590 ordered successful upload receipts are retained. No native phase launch
claim exists. The read-only remote evidence inventory found eight task files,
all exact pinned providers, zero unique runtime artifacts and zero native
runtime output. No fixture, original, local/remote Chrome, CDP, guest input,
capture, retry or guard relaxation followed this failure. The upload failure
does not establish anything about screenshot service or the guest. Arena,
fire and displacement are untested in this fresh attempt.

Before shutdown, a separate verifier independently reread 771 evidence files
and 221 completed gzip streams, with exactly one expected malformed gzip in
the staging corruption negative control. The remote inventory's eight pinned
providers were independently matched to the seal; there was no unique remote
artifact requiring download. Exactly one delegated normal stop followed:
`stop_f796a6a578fc9b77`, completed **unforced 2026-11-09T21:52:45.930Z**.
Separate API/CLI reads confirmed **archived**, archiveAfter=null; no replacement
expiry was returned. Actual watchdog PID2831388 waited0 with separate stdout
and stderr EOF; its immutable config hash remained unchanged. The allocator
session also actually joined0. No owned live box remains.

The concrete result is the tested causal cleanup repair plus the retained
actual screenshot discrimination above. Fresh native gameplay was blocked
before launch by upload service, and was not retried. Any future native task
must separately address provisioning and retain terminal admission and unchanged
guards. This single-task worker releases STOP.
