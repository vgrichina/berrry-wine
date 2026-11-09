# Warcraft startup/drain repair, 0545

Fixed a demonstrated production custody defect: cancellation broadcast signals
and synchronously persisted every signal record before consuming an already
observed kernel wait. A fatal group signal makes sibling EXIT stops pending;
the broadcast withheld their consumption, terminal waits and pipe closure until
the immutable cleanup deadline could expire. Cancellation now consumes observed
waits first and issues at most one signal per loop, then rechecks kernel stops
and deadlines. Durability and actual before-reap/waitpid requirements remain.

Evidence: `scratch/runs/20261109-warcraft-startup-drain-repair-0545/`.
Exact starting Git SHA is in `git-base.txt`; the small relevant patch is
`relevant.patch`. No source tree, media or module archive was made.

## Actual composed regression

`tools/warcraft3-prologue/startup-drain.test.py` runs the actual Warcraft
production composition through its existing Node-only startup fixture. Only
the launched peer is replaced with a Python pipe writer with 40 real native
threads and no endpoint. The existing short no-endpoint fixture enters actual
production close, then an external SIGTERM cancels the actual ptrace supervisor.
Both versions use identical immutable supervisor deadlines, the existing
five-second cleanup extension, and a controlled 200 ms delay after each
actual durable cancellation record. Kernel waitid, waitpid, ptrace, signals,
identities and EOF are real; no synthetic wait status or disappearance receipt
is used. An independently armed deadline watchdog is actually waited and both
of its pipes drained in each completed comparison.

`final-composed-verified.log` and its `old/` and `new/` directories retain:

| Actual result | Published 4341 before | Repaired |
| --- | ---: | ---: |
| Owned identities | 48 | 48 |
| Recorded actual terminal waits | 0 | 48 |
| Command pipe EOF | false | true |
| Custody complete | false | true |
| Cancellation-to-final receipt | 10.295 s | 1.348 s |
| Independent watchdog fired | false | false |

The old version durably broadcasts 48 TERM records without consuming a wait,
then fails the cleanup deadline. The new version interleaves real stops and
waits with six signal records, drains command EOF, and retains cancellation as
abnormal. Its controller is actually SIGKILLed by supervisor cancellation
(exit -9); a missing browser-observer receipt remains missing. Kernel command
EOF and terminal waits do **not** supply that separate browser receipt.
`outer-waits.json` retains the actual supervisor/watchdog waits, separate captured
pipe EOF, and external adopted waits after the deliberately failing old tracer.
Those adopted waits are not substituted into its failed custody receipt.

The repeated `final-composed/` comparison also passes. Preliminary offline
fixture failures are retained: an omitted driver deadline was corrected, an
initial watchdog window was insufficient for the deliberately stalled broadcast,
and an overly strong browser-receipt assertion was corrected to require only
the actual kernel evidence produced. `old-fail/` also retains the unchanged
implementation failing the new complete-drain assertion before the repair.
The preliminary `old-controls/old/custody.ndjson.gz` lacks its gzip trailer
after watchdog KILL; its stored hash is retained as incomplete evidence. Both
final comparisons have fully verified gzip streams.
No Chrome, original game, box or heavy runtime was started.

## Retained WC0535 evidence and limits

Read the 0535 note and its actual custody, terminal and stderr evidence.
`retained-evidence-analysis.json` records the original hashes and sequence
mapping. Original sequences 574–641 are 68 consecutive cancellation-sent
records, all KILL, spanning 1.929 seconds and crossing the cleanup deadline
1794202703.682. No wait is consumed in this broadcast. The last recorded actual
terminal wait is sequence 276. The controlled regression demonstrates this
same production scheduling defect, not the timing of those historical missing
waits or the full cause of the earlier unsuccessful browser close.

The original 60-second startup timeout and unsuccessful 18-second browser
close still stand. Untimed stderr does not establish endpoint readiness before
the deadline. The historical 68 missing waits, WC0445's 53 missing waits,
WC0410 creator identities and WC0512 creator10418/start99598 remain UNKNOWN.
Physical absence is not actual-wait evidence. No claim is made that this fix
alone would have delivered the original endpoint or passed that browser close.

## Scope and validation

Warcraft preparation now pins the repaired custody source by exact SHA-256
`5ec810c4d4704ff86afc367b38f7335edf1214e3450ebb98a62ce3df6386b5fe`, retaining
4341 as the published baseline for the other custody providers. The fresh
626-provider closure, staging omission/SHA/path/duplicate/symlink negatives and
actual composed offline `DRIVER_PREFLIGHT=1` pass. Existing Q2/Super prepared
providers and runtime artifacts were not edited or repinned.

All 40 existing custody tests pass. The 13 existing composed Node startup/race
cases plus five direct terminal/EOF/cancellation controls pass. Qualification
composition negatives, 38 renderer controls and contracts pass.
`flock /tmp/wine-build.lock bash tools/build.sh` passes. CPU remains SHA-256
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`.
Production 838d4 qualification, 16c cancellation checks, strict lineage,
lifetime, immutable deadlines, all caps, pre-CPU/pre-DLL-main zero entry and
14/16/18-second work/ACK close schedules are unchanged.

Next: startup endpoint availability and browser-observer close failure remain
unresolved; this task authorizes no runtime retry. The concrete downstream
custody wait-loss repair is complete. Box ID/state/expiry/stop receipt:
none / NOT_CREATED / null / null. No agents, workers or deployment.
Free `/home` remained above 1.5 GB. Single task STOP.
