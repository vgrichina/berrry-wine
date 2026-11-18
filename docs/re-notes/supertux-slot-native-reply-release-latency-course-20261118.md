# SuperTux native reply/release latency, 2026-11-18

The release-budget defect is repaired and published in `09d56288b`. The native
reply latency remains unresolved. Manual play reached the Antarctica overworld;
no platform landing, Welcome to Antarctica course progress, or ordinary Quit
was achieved. Both original scopes are permanently closed.

Evidence: `scratch/runs/20261118-supertux-slot-native-reply-release-latency-course/`.
Its retrieval manifests, causal-findings, source-and-process verification,
recovery recipe and final result distinguish measured facts from hypotheses.
The predecessor slot-Enter UNKNOWN was never retried or contacted.

## Proved release repair

The strict independent-release fallback previously started at 1,650 ms while
the release bound was 1,750 ms, leaving only 100 ms for a request allowed 500 ms.
`tools/lmarbles-controller.cjs` now starts it at 1,250 ms, reserving the full
500 ms. Confirmation remains 500 ms and release remains 1,750 ms. Native USER
consumption is still required; handler application is not acceptance. UNKNOWN
still closes a scope without replay.

The actual animated SDL regression deliberately delays DOWN response 650 ms
and UP response 350 ms. Before repair, release ACK took 1,826 ms and failed;
after repair it took 1,533 ms and passed. The delayed DOWN is a true UNKNOWN.
Its prearmed independent UP is the only subsequent permitted request.

Focused native transition, compound positive, and compound-focus refusal tests
passed after repair. The transition fixture performs 900 ms of real guest
loading after native USER Enter consumption before changing its SDL caption;
it is not a host handler simulation. Connected-send tests passed 19/19.
`flock /tmp/wine-build.lock bash tools/build.sh` passed and reproduced module
`0d383140f6d4207d18860e3cb22fc8fcc47a5d260b8d5f2443222396b245fdd5`.
Code commit and immediate strict pull/push both succeeded.

## Actual original timing

Both new scopes used the reproduced module, verified 789 media/settings files,
the coherent finite server-owned chord/whole-image receipt controller, and
identical sealed 253-file runtime source graphs. Existing native input/control
traces were enabled. Bounded run-local batch and event-loop diagnostics were
added without changing guest state or input-consumption rules.

In the first scope, title Start Enter was consumed in 219 ms, slot Enter in
66 ms, and story Enter succeeded. Personal whole-frame review reached the
overworld. A manually selected Down toward the first node then became UNKNOWN.
Relative to dispatch, request body finished at 7 ms, server arrival was 10 ms,
and native delivery became pending at about 33 ms. The next native owner USER
poll dequeued it at about 499 ms; actual native consumption occurred at about
505 ms. Promise/response work followed at 509–511 ms. The client timed out at
503 ms without headers. The native queue therefore waited roughly 466 ms.

No event-loop lag over 30 ms was recorded during that pending interval. This
scope establishes owner USER polling delay, rather than HTTP arrival or
response serialization, as its immediate cause. It does not establish the
historical slot-Enter cause, nor separate guest computation, guest sleep and
scheduler cost. Offline late-consumption evidence does not reopen UNKNOWN.
The independent UP acknowledged at 1,175 ms, within the unchanged bound.

A materially changed second scope used main quantum 10,000 instead of 1,000,
holding thread quantum at 1,000 and adding bounded scheduler observations.
Title, slot and story Enter succeeded, but this is insufficient evidence of
a polling repair. The independent disk watchdog stopped it while leaving the
story screen. Shared `/home` crossed below 1.5 GB despite owned growth being
on tmpfs. Continuous floor compliance is false; no further runtime was started.

## Closure and remaining work

The first scope was cancelled after UNKNOWN. Its native, watchdog, holder and
nested parent/child waits reached exit and EOF, but the top tool invoker exited
143 and its driver-parent wait receipt is unavailable; sender is UNKNOWN.
The second has a genuine top parent exit-0/EOF receipt, plus individual nested
waits. Both native exits were host SIGTERM, not game Quit. Browser and display
were null. Recorded native/outer/driver process identities are now absent.
No remote box was created: ID, expiry and stop receipt are null.

Selected whole screenshots, unique authored EXEs, traces, logs, source manifests,
binary diffs and task-script creation patches were retrieved and verified by
SHA256/size and gzip round-trip before owned tmpfs removal. Foreign WIP,
security holds and unassigned processes were preserved.

Remaining work is to explain and repair the native owner's USER polling cadence
with an actual native positive/refusal/release test, then use a materially new
scope for manual landing, course progress and ordinary Quit. Raising bounds,
accepting handler application, replaying UNKNOWN, or calling host cancellation
Quit would not resolve this task.
