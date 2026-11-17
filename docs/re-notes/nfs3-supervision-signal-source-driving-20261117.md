# NFS3 supervision and original input timing, 2026-11-17

The fresh original survived supervision and produced new released driving
evidence: 0 MPH initially, 1 MPH during acceleration, a turned wheel during
Up+Left, then 16 MPH with the car off the road. Pause expired before handler
application. Its measured blocking span is now known: one synchronous
`gpu_stream_kick` lasted 2,916.589 ms across the entire 800 ms intention.
Pause, Continue and native Quit remain open. No production change or second
original was made.

Evidence: `scratch/runs/20261117-nfs3-supervision-signal-source-driving/`.
This follows [the passive observer handoff](nfs3-original-public-ingress-render-attribution-20261117.md).
The earlier 35.5-second SIGTERM sender remains UNKNOWN. This run does not
reinterpret that termination as normal shutdown or invalidate the retained
`c9ff55052` driving evidence.

## Public supervision controls

The inherited launcher forwards TERM/INT to its supervisor; the supervisor
signals its native process group and waits it while draining both pipes. The
independent watchdog checks its supervisor identity, finite deadline and free
disk. Public process/signal-only `strace` records exec/parent/wait events and
kernel `si_code`, sender PID and UID. It does not trace request bodies, memory,
render records or proprietary instructions. Source bodies remain in the
inherited sealed memfd, with no source archive on disk.

The first orderly native control ran about 40 seconds. The final authored
Device2 RGB565+D16 control ran 53.3 seconds through the same launcher, native
host, final observer, interactive guard and custody chain. Both retain the
390-second host limit and prearmed 420-second watchdog. Escape was consumed at
the native return boundary with its unchanged 800 ms intention, the authored
PAUSED caption was reviewed, independent release observed physical UP, and
orderly close completed native/supervisor/watchdog/launcher waits and both EOFs.
This grey caption fixture proves its own handler, not game rendering geometry.

An absent authored-fixture path exercises the host error return (native host
exit 1, watchdog 0, complete parent waits/EOF). A deliberate controller-side
TERM exercises native cleanup with known signal provenance: controller
2004663 → launcher 2004677 → supervisor 2004729 → native 2004731, UID 1000.
Killing supervisor 2004075 is a separate parent-death control. Watchdog 2004076
detects the lost parent and sends native 2004078 TERM; the enclosing subreaper
actually waits the adopted native (0) and watchdog (2), retaining both read
ends and observing each pipe EOF. The launcher actually waits its killed
supervisor (-9); tracer exit 247 is preserved. PID absence is only a separate
postflight observation.

No unexpected TERM or 35-second timeout reproduced. The observed bootstrap
timeouts precede the native chain; the inherited runtime deadlines are 390/420
seconds. There is no proved accidental lifecycle timeout to correct. Two early
local preparation errors occurred before supervisor/native launch and are
recorded separately. The initial board watcher separately returned 143.

## One authorized original

Runtime source remains `013d916c64632243ff0aa768debbbc39870f04d5`, module
SHA-256 `cf674e8d1780249498a3b9797142d5d9f01e9daedcf2089c8fc880f515c753c0`.
All 4,681 sealed source pins matched. The only observation overlay is final
published `976156b26b5e5e916ab032a111cbfabe5babfd32`, SHA-256
`affbb745adecbaa558f120f8fc5cbab8427662c013c663f57df609ad0568a18c`.
It adds no ownership snapshot, input, timer or yield. Its focused on/off,
snapshot-count and bounded-ring checks pass again. The prior canonical locked
build is reused; this documentation-only task makes no new build claim.

The genuine accepted chooser export remains SHA-256
`c08b656b3718682a3a1f4324a08ab689c9444c1daf868c40f4a991cb9f1b9108`.
All 135 media pins matched before and after. Foreign WIP was excluded by the
sealed inventory. No guest clock, configuration, save, media or state changed.
The original naturally reached its rainy Hot Pursuit cockpit. The first gas
hold showed no speed increase; the next held image shows 1 MPH. The steering
hold shows a turned wheel, and the subsequent whole image shows 16 MPH and
trees directly ahead after leaving the road. Transmission remains unverified;
this is driving progress, not sustained speed or a completed race.

Action/release functions match the tested predecessor by AST. Driving retains
6,000 ms; Escape retains 800 ms. Each release helper was independently armed
before DOWN. There are four consumed arrow DOWNs (three Up and one Left),
followed by one unconsumed Escape.
The table separates request authorship from server entry and the native receipt.

| Intention | Intent → HTTP authorship | HTTP authorship → entry | Native consumption |
| --- | ---: | ---: | --- |
| First Up | 74.003 ms | 890.603 ms | consumed, 7 ms after application |
| Race Up | 73.654 ms | 841.103 ms | consumed, 11 ms after application |
| Steering Up | 65.292 ms | 22.867 ms | consumed, 4 ms after application |
| Steering Left | 100.923 ms | 3.236 ms | consumed, 649 ms after application |
| Race Escape | 259.798 ms | 2,463.302 ms | none; handler not applied |

Escape intention began at `1794959320873.900` ms and expired at
`1794959321673.901` ms. The synchronous render span began at
`1794959320599` ms, lasting 2,916.589 ms. HTTP entry was
`1794959323597` ms; preparation began a millisecond later and took 0.432 ms.
There was no application span and no native input receipt for Escape. This
directly identifies the synchronous render span blocking this original request;
it is not an inference from the unused legacy D3D worker's waits.

Physical UP is separate evidence, not assumed from a release ACK. The observer
records every arrow/Escape zero and an empty queue at each existing release.
Observed release lateness was 139.606, 51.758, 495.159 and 1,938.099 ms,
respectively. In particular, Pause's physical release was late because the same
host was blocked; no strict on-deadline UP claim is made. The observer retained
669 of 2,048 available samples with no drops. Its 601 synchronous render calls
totaled 115,817.805 ms; the 2,916.589 ms Pause overlap was the maximum.

The Escape cancellation permanently closed the endpoint. No later query,
capture, rebind, input or replay followed; only the already armed release ran.
Owned shutdown then records kernel sender 2010293 → launcher 2005571 →
supervisor 2005647 → native 2005650, UID 1000. Native exit 0, watchdog exit 0,
and supervisor/launcher waits have both pipe EOF receipts. The outer tracer has
actual tool completion 0; the tool merges its output, so separate outer-tracer
stdout/stderr EOF records are unavailable. The original
ran about 191 seconds, with no watchdog firing or spontaneous TERM. This is
owned shutdown after UNKNOWN, not native Quit.

## Concrete repair boundary

The failure now has an original public timing cause, but no tested scheduling
repair. The measured interval is a complete synchronous GPU drain, not an
individual draw/record measurement. The published GPU-stream contract requires
SYNC/CLOSE kicks to finish all published records, with producer checks and
pixel-readback fences. Returning early or inserting a batch-loop yield cannot
preempt this already-running import safely. Moving execution or making that
boundary resumable needs an authored native counterexample and negatives for
drain/fence/readback/close ordering before it can be a focused repair. No such
repair was established here, so the conditional affected-original allowance
was not used. A further original requires new authorization or a proved,
tested and published repair under that conditional allowance.

Exact Git identities, relevant binary diffs, small run-input patches, selected
named whole PNGs and artifact hashes preserve the evidence. No workers, boxes,
archives, source snapshots, media copies, frame series or deployments were
created. Home free space stayed above 1.5 GB; no RAM gate was used. Box ID null,
state NOT_CREATED, expiry null, stop receipt N/A. Foreign WIP and other owners'
work were preserved. This task releases and stops with the sender of the old
TERM still unknown and the synchronous original rendering boundary documented.
