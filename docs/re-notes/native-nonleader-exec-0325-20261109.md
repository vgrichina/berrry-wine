# Native nonleader exec custody — 9 November 2026

`tools/native_kernel_custody.py` now supports the observable Linux nonleader
exec transition. A consumed `PTRACE_EVENT_EXEC` and its `GETEVENTMSG` former TID
bind an already linked thread to its already owned TGID. The original leader
must have a recorded EXIT stop, both registrations must be unreaped, group
identities must agree, and the leader's PID/start identity must remain unchanged.
An observable former-TID reuse also refuses binding. Missing registrations,
lineage, kernel messages, or successor identity remain unsupported/incomplete.

The durable `exec-identity-transfer` record links both PID/start registrations,
the leader EXIT stop, the pre-consumption witness, the consumed raw EXEC wait
status and former-TID message. It records any transferred ESRCH/resume obligation
before retiring the obsolete TID from active operations. The successor resumes
through the existing creator barrier. Other siblings retain their EXIT and
terminal wait obligations; no group-wide retirement comes from exec or absence.

`owned` retains both registrations. `reaped` contains only actual terminal
waits. The new `execTransfers` drain field explains why a former TID has no
separate wait: its obligation closes only when the bound TGID has an actual
PID/start terminal receipt. The journal records that reconciliation too. Without
that receipt, both identities remain in `unreaped` and complete stays false.
An unexpected subsequent wait for a transferred TID refuses completion.
Per-record fsync, journal/command gzip finalization, actual command read-zero EOF,
creator barriers, fixed deadlines, cancellation escalation and normal-exit
requirements remain enforced. Cancellation can drain custody but cannot succeed
as ordinary shutdown.

Evidence: `scratch/runs/20261109-native-nonleader-exec-0325/`, with final control
paths in `control-summary.json`. Git base plus `source.patch` and `note.patch`
recover the source. No source tree, media or executable archive was made.

## Tiny native controls

The pthread fixture starts two nonleader threads; one execs `/bin/true` while
the other and the original leader retire. The predecessor is exact published
`0cde26d0bc27794ce04408be3500d9e661a273e4`, custody SHA-256
`c7264650beb466176d4c5169aa50666805d7c53bc43b7a0404d93c462c72568b`.

| Case | Result |
| --- | --- |
| Exact predecessor, real nonleader exec | Fails closed; retained unresolved leader/former-TID obligations; isolated subreaper retains subsequent actual waits |
| Repaired, same native program | Complete; three owned identities, two actual terminal receipts, one explicit transfer |
| Repaired, supervisor SIGTERM latched at consumed nonleader EXEC | Complete custody; cancellation remains failure; actual terminal receipts retained |
| Repaired, sibling forks a separate child before exec | Complete; four identities, three actual terminal receipts, one transfer; independent child's exit 7 retained |
| Observed former-TID or leader start reuse | Refuses binding, incomplete |
| Former-TID message names an unowned identity | Refuses binding, incomplete |
| Successor terminal wait kept unconsumed | Fixed cleanup deadline fires; transfer alone cannot settle either obligation |

Positive events, messages and wait statuses are actual kernel observations.
The cancellation case delivers real SIGTERM to the supervisor at the consumed
EXEC stop. Reuse and unowned-message negatives explicitly inject observations;
they do not claim to force real PID reuse. The missing-wait negative leaves the
real kernel wait unconsumed. The test observes the durable transfer record before
CONT, verifies every actual wait's preceding identity witness, checks journal
and command original hashes/lengths and gzip footers, and requires command EOF.
The outer process separately captures stdout/stderr to EOF with communicate.

Each native fixture independently arms an observable PID/start-checked watchdog
before releasing its supervisor launch gate. All watchdogs were stopped and
waited with -15; none fired. Failed negative-test harness attempts are retained
in the initial logs: the injection originally also matched clone messages;
the corrected shim selects only a consumed EXEC stop. Those attempts are not
acceptance evidence.

Validation: all 38 custody tests passed in `custody-suite.log`; after the final
raw-status assertion and evidence additions, the three affected tests passed
in `exec-final.log`. Required locked build passed in `build.log`.

## Historical boundary

`reused-evidence.json` verifies earlier native0312 evidence and Warcraft0244's
original drain/journal by existing path, byte length and SHA-256. Those files
are reused without copies or reinterpretation. Warcraft identities
6750/start12391, 6756/start12468 and 6763/start12707 still lack creator lineage;
their historical complete=false and UNKNOWN remain unchanged. No historical
exec or cancellation cause is inferred from this future transition support.

Game workers were notified before source mutation and pinned published stable
custody bytes; no remote snapshot was mutated. This task used no browser,
Chrome, original game, box, agent, worker or deployment. Box ID/state/expiry/stop
receipt: NOT_CREATED / not applicable. Disk remained above 1.5 GB.

Next is separately authorized runtime validation using pinned published bytes
and unchanged caps, with actual terminal waits and separate EOF evidence.
This single-task worker stops after authenticated publication.
