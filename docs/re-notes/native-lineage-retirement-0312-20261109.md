# Native cancellation lineage barrier — 9 November 2026

Implemented a future capture repair in `tools/native_kernel_custody.py`.
Cancellation now uses the queued resume barrier introduced by accepted
`dec33253ced7f76b850c63f7ad1137c7f214b1ef`. Previously cancellation bypassed
that queue: consuming one creator's fork/clone stop immediately resumed it,
even when another creator already had a pending kernel message. The resumed
creator could call exit_group, or a resumed fatal signal-delivery stop could
terminate the group, replacing the other message before capture.

All reversible resumes, including cancellation-time signal delivery, now queue
for the next priority scan. After that scan finds no pending creator message,
cancellation signalling precedes the queued resume. Irreversible EXIT retirement
still proceeds directly and still requires its real kernel message and terminal
wait. PID/start validation, WNOWAIT witnesses, ESRCH obligations, per-record
durable journal flushing, fixed deadlines and escalation timing are preserved.
No completeness predicate was weakened and cancellation never becomes normal.

Evidence: `scratch/runs/20261109-native-lineage-retirement-0312/`.
Source recovery uses the exact Git base in `source-head.txt`, the relevant
binary diff and the new note patch; Git holds source. No source tree, media,
module, or executable archive was made.

## Native controls

Three new paired controls run tiny compiled pthread/syscall programs under the
exact accepted predecessor and the repaired implementation. The harness chooses
legal kernel observation order, waits for actual pending messages, latches a real
SIGTERM to the supervisor, and delays after CONT so native group termination can
overtake observation. It never fabricates a ptrace event or wait status.

| Native ordering | Accepted predecessor | Repaired |
| --- | --- | --- |
| Two nonleader clone creators; first resumes into exit_group | All five tasks waited; one unresolved lineage; incomplete | Both creator messages captured before resume/signalling; five tasks waited; complete |
| Two nonleader raw-fork creators; first resumes into exit_group | All five tasks waited; one unresolved lineage; incomplete | Both messages captured; five tasks waited; complete |
| Fatal SIGTERM delivery stop; sibling's clone becomes pending before cancellation | All four tasks waited with status 15; one unresolved lineage; incomplete | Clone captured before fatal delivery/signalling; four actual status-15 waits; complete |

Raw SYS_fork deliberately avoids libc's fork serialization, allowing two real
concurrent pending fork events. Every paired supervisor returns failure (wait 1),
including repaired runs whose root happens to exit 0. Complete means custody
and lineage evidence drained; it does not mean ordinary shutdown. The tests
verify retained pre-consumption identities and terminal statuses, journal and
command gzip hashes/lengths/closure, actual command read-zero EOF, empty pending
obligations and missing watchdog firing. The outer fixture process has separately
captured stdout/stderr EOF via communicate; the command log remains its existing
merged pipe and makes no claim about separate Chrome streams.

A new real nonleader exec control also verifies refusal: a pthread execs
`/bin/true`, and the unsupported TID-to-TGID transition leaves complete=false
with explicit unreaped obligations. The isolated subreaper retains the remaining
actual waits after supervisor failure/EXITKILL. Nonleader exec support was not
invented or relaxed. Independent PID/start checked watchdogs are observably armed
before opening each supervisor launch gate; all were stopped and waited -15.

The initial fixture setup failures are retained: the first barrier allowed one
creator to remain queued, and libc fork serialization prevented two simultaneous
fork stops. They are not causal successes. The corrected clone regression failed
against unchanged custody before the production edit. Final paired controls
verify the exact accepted predecessor still fails and repaired source passes.

Validation: `python3 -m unittest tools.native_kernel_custody_test -v` passed all
37 tests, including the new pairs and real exec refusal. Required
`flock /tmp/wine-build.lock bash tools/build.sh` passed. Final logs are
`custody-suite.log` and `build.log`; `control-summary.json` identifies final runs.

## Historical boundary and next action

Warcraft0244's retained identities 6750/start12391, 6756/start12468 and
6763/start12707 still have only unlinked irreversible EXIT retirements and real
terminal waits. Their surviving evidence supplies no creator messages. The
original drain remains complete=false; historical lineage and missing Chrome
terminal/pipe observations remain UNKNOWN. `historical-observation.json` pins
the original journal/drain paths, hashes and relevant observations without
rewriting or duplicating those artifacts.

That journal records no supervisor cancellation. These controls establish a
concrete future cancellation capture defect and repair, not the historical cause
of those three lost messages or an accepted Chrome cleanup repair. External
signals and concurrently running tasks can still supersede unobserved kernel
events; genuinely missing evidence remains unresolved. No parentage comes from
process absence, TGID membership or successful forced termination.

Q2upstream0301 was notified on the board before custody source mutation; its
active staged remote source was untouched. No shared driver or shutdown helper
was edited. This task was entirely offline: no browser, original, box, agent,
worker, public deployment or runtime allocation. Box ID/state/expiry/stop receipt:
NOT_CREATED / not applicable. Disk remained above 1.5 GB.

Next: a separately authorized fresh runtime can consume the published custody
repair with pinned source and unchanged caps. It must independently prove actual
terminal waits, creator lineage and separate EOF; historical UNKNOWN stays UNKNOWN.
This single-task worker stops after authenticated publication.
