# Redline closure validation: measured custody stall repaired

The 1634 generated launch's 120-second timeout was caused by durable diagnostic
work in syscall custody. It was not a CPU compilation or provider hash failure.
The preserved caller spent its final 101.448 seconds between
`closure-validation-begin` and cancellation. Its observer filled after another
0.322 seconds, at `dashboard.html`, but custody still made **7,572 syscall
resumes after the observation cap**, with no capacity to observe those calls.
The capped trace correctly remained incomplete.

Evidence: `scratch/runs/20261109-redline-validation-delay-repair-1648/`.
`preserved-analysis.json` derives these counts from the original archived
journal. `diagnose.py` uses the exact published collector and observer against
128 real provider paths, hashes and sizes, without copying providers. The
original observed path hit its fixed 45-second bound; 44.183 seconds were
measured inside `fsync` (735 observer and 733 custody calls). Ordinary custody
verified all 128 in 0.267 seconds. A labelled cap-only control also timed out:
returning to CONT at exhaustion alone did not address pre-cap durability cost.
The repaired control verified all 128 in 8.399 seconds, with 35 observer and
37 custody fsyncs. These bounded controls used independent armed watchdogs,
actual waits and separate stdout/stderr EOF. They did not run Chrome.

`tools/redline-bounded-custody.py` is a narrow explicit adapter over the exact
published launcher, observer and collector. It buffers syscall diagnostics for
already admitted tasks in bounded batches and returns to ordinary fork/exit
custody when observation fills. Every ownership admission still persists its
complete custody prefix before release. Observer batches are limited to 64 KiB
and 256 records, flushed at ownership barriers and close. The original custody
journal's bounded backpressure remains. Durability failures propagate; capped
observation remains incomplete, and retrieval still uses the published snapshot
validator. No new task is discovered or retired by inference.

The current publication route authenticates this additional provider in its
closure and selects the adapter explicitly. Existing published provider pins,
closure hashing, HTTP checks, admission algorithm, physical input/capture
custody, deadlines and CPU bytes remain unchanged. Primary CPU is
`3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`;
compatibility CPU is
`ecb45716b1ee7fc5218b1670dd270b19c7664ee30d000b3360a12786a1c21eaf`.

The fresh actual generated provision passed offline, including byte-checked
uploads, media assembly and the real startup barrier. The fresh actual generated
launch passed at its original 120-second deadline: closure validation of all
904 providers / 149,109,355 bytes took **234.674 ms**. DRIVER_PREFLIGHT then
intentionally exited zero before server/Chrome; the controller correctly
reported missing ACK and exited one. All seven owned tasks were actually reaped;
generated parent, outer parent and independent watchdog waits retained separate
EOF. This proves the repaired offline gate, not native readiness.

Focused checks passed: six bounded-custody tests (record cap, minimum cap,
byte cap, late fork/exec, cancellation, digest/sequence validation, bounded
buffer and failed fsync); generated caller corruption checks for host, both
CPU modules and the new adapter; actual staged caller HTTP failure preserving
root/custody/controller exit one with 16 missing/changed-provider controls and
forged-repin refusal; complete current startup/admission suite; direct generated
caller import audit with no outside dependency; and
`flock /tmp/wine-build.lock bash tools/build.sh`. Initial regression mistakes
(expecting a separate lineage record when vfork was registered directly, and
reusing a PID's write-once phase files in a test) are retained with corrected
passing runs. An initial startup invocation omitted its required environment
variable and refused before execution.

Runtime followed Q2-reviewed1638's final published RELEASE STOP at main
`1beaf26d20b056c306057994e956b340d696326c`. Independent rereads verified its
unique census SHA/size/gzip CRC, physical drain, immutable watchdog join and
exact API ARCHIVED normal stop. Its runtime kernel/parent waits were
NOT_CREATED and browser EOF remained UNKNOWN.

One observable independent immutable 25-minute UUID watchdog was prearmed
before the sole box allocation: **bx_y2mt6zju**, UUID
**5f1b9750-d477-4aa6-b921-d8f213e13034**, initial
`archiveAfter=2026-11-09T17:21:47.659Z`. The actual generated provision uploaded
all providers and completed its remote barrier (ordinary transport parent
actual wait zero, separate EOF). It then failed locally with EEXIST while
persisting `remote-barrier.json.gz`: the offline provision had already used
that write-once evidence label. This worker introduced that harness collision.
The remaining seal/plan uploads were not reached, so this was not a completed
provision gate. The first failure ended runtime. No fixture, original game,
later input/capture, retry or deadline extension followed.

Read-only recovery independently verified a unique compressed census before
delegated normal stop: 904/904 exact providers, no missing/changed provider,
no runtime argv/FD holder or profile, and physical drain. Runtime kernel and
parent waits were NOT_CREATED; ports were NOT_CREATED with no connect proof;
browser EOF remains UNKNOWN. Recovery initially refused an out-of-scope `/tmp`
upload locally; the corrected read-only census used the owned run path.
This was evidence recovery, not another runtime attempt.

Final exact API state: **ARCHIVED**; normal unforced stop
**stop_35784f4489ea758a** completed **2026-11-09T16:58:10.532Z**, without error.
Final `archiveAfter=null`; `expiresAt` was NOT_RETURNED. The actual watchdog
joined zero with separate EOF and its immutable configuration hash unchanged.
The box was not resumed or deleted. No box remains billing idle.

Git base plus small relevant patches identify sources; no source/media archive
was made. Unique evidence is SHA/size checked, including gzip CRC and decoded
identities. Empty/invalid artifacts remain invalid. Free `/home` stayed above
1.5 GB. No local Chrome, agent, worker or public deployment was started.

Outcome: **causal offline repair tested; gameplay screenshot UNVERIFIED**.
Future authorized runtime must isolate offline provision's evidence directory
from native provision labels before a new fixture/original attempt. This task
makes no further runtime attempt and ends with final published RELEASE STOP.
