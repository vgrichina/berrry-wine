# Quake II custody retirement service repair, 0844

The production custody provider now batches irreversible EXIT/terminal-wait
records in an ordered buffer capped at **1 MiB and 4096 records**. Saturation
flushes synchronously before accepting another record; an oversized individual
record bypasses the buffer after flushing its prefix. There is no worker,
thread, unbounded queue, dropped record, synthetic wait or grace increase.

Registration, creation/lineage and EXEC admission retain synchronous durability.
Every queued executable CONT explicitly flushes the ordered prefix first.
Only a peeked real terminal status or kernel EXIT stop selects deferred service;
the consumed status still controls retirement, GETEVENTMSG, EXEC transfer and
resumption. EXIT CONT can finish irreversible death without per-record disk
service. Every terminal receipt still comes from actual waitpid after WNOWAIT.
Existing fork/CONT selection fairness, identity checks, nonleader EXEC binding,
kernel lineage requirements and separate command EOF checks are retained.

Final close flushes all pending evidence, writes the gzip footer and fsyncs.
Success still requires that close and command-log durability succeed. Journal
write/fsync errors latch permanently; an error while logging failure cannot
prevent identity-checked containment. Initial registration now sits inside that
containment scope. Abrupt death can leave a durable prefix with an unwritten
retirement suffix: missing final durability/drain remains explicitly incomplete,
as tested by the existing hard-kill controls. This does not claim durable
per-retirement records before each wait. Admission durability remains required.
Bounded saturation/storage stalls may still block; arbitrary storage failure
does not acquire a successful quit classification.

Evidence: `scratch/runs/20261109-quake2-custody-retirement-repair-0844/`.
`composed-final/` uses the actual composed Quake II driver, Python Caller,
numbered transport, close helper and production ptrace supervisor with an inert
110-thread Python browser substitute. The old provider is recovered directly
from Git blob `c604ccf084212eaeeff2d0fd92c65fbd535360ab`, without copying sources.
At identical test-only 50 ms journal-service delay after ordinary close starts:

| Provider | Service writes after close | Close elapsed | Result |
| --- | ---: | ---: | --- |
| Old production | 270 | 11767 ms | TERM, exit0, EOF, normal:false; quit rejected |
| Repaired production | 3 | 72 ms | No signals, exit0, EOF, normal:true; numbered quit ACK |

Both controls record **122 owned / 122 actual reaps**, complete custody and
command EOF. The repaired unpaced control also accepts ordinary quit. Journals
have contiguous sequence numbers, valid gzip CRC/footer and matching original
byte counts/SHA256. Supervisor, caller children and independent prearmed
watchdogs are actually waited with separate EOF; watchdogs do not fire. No
guest CDP occurs after Browser.close. Runtime/ACK/deadline caps, signal-normal
classification and staged-root/startup gates are unchanged.

Validation: 46 custody tests pass, including byte/record saturation, oversized
record ordering, durable executable-CONT prefixes, admission/saturation/final
service failures, footer-sync refusal, cancellation, fork lineage, EXIT/CONT
fairness, EXEC transfer/rejection, adoption and missing waits/EOF. All 21 actual
caller composition scenarios and 10 close-helper tests pass, retaining TERM,
KILL, ACK-stall, inherited EOF delay and cancellation rejection controls.
`flock /tmp/wine-build.lock bash tools/build.sh` passes; CPU remains 2185596
bytes, SHA256 `a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`.
Initial test failures exposed disk-only scheduling probes and a fixture file
publication race; their logs are retained and excluded from final acceptance.
Probes now observe recorded EXIT events without forcing service, while checking
durable registration and admission separately.

Historical 0820 ACK-to-TERM still has 393 records, 94 EXIT stops and 93 actual
reaps. Historical per-syscall latency remains UNKNOWN; this controlled service
dependency repair does not establish an exclusive historical fsync cause.
No Chrome, guest, original, box, agent/worker, deployment, host.js, WAT,
HeroesII or Claude work occurred. Git base plus small owned patch and gzip
logs provide recovery; source/media/module archives were not made. Existing
source-matched proofs are referenced by Git rather than copied. Free /home
remained above 1.5 GB. Box ID/state/expiry/stop: NULL / NOT_CREATED / NULL / NULL.

Next: a separately authorized fresh integration/native run with current provider
pins; this offline result makes no gameplay or native qualification claim.
Single-task STOP after publication.
