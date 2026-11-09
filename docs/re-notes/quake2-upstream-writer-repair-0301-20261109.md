# Quake II upstream writer investigation, 0301

The repair remains unproved. Unchanged production passed on the authorized
small Chrome fixture, including the old observer control, so this run has no
causal failing-before/passing-after pair. No production fix is published.
Both rejected Q2close0244 patches remain rejected and untouched. The improved
fixture helper remains uncommitted WIP.

Evidence: `scratch/runs/20261109-quake2-upstream-writer-repair-0301/`.
Git SHA, staged provider hashes and small input patches identify the tested
source; no source tree, media or module archive was created. The four0300
relay controls were referenced by SHA/size without rerunning them.

## Actual Chrome observations

All three runs used the real composed spawn, CDP callbacks, numbered quit,
close helper and compressed stream logging. The original game was replaced
with a small page and two Workers compiling an eight-byte Wasm module.
Production shutdown, phase budgets, durability and success rules were unchanged.

| Case | Close elapsed | Result |
| --- | ---: | --- |
| Boundary observer baseline | 237 ms | normal=true, exit0, no signals, both EOFs |
| Inherited 250 ms observer control | 207 ms | normal=true, exit0, no signals, both EOFs |
| Real upstream writer retained for 1,500 ms | 1,569 ms | normal=true only after both EOFs |

The baseline maps Chrome PID5737/start5287 stdout/stderr to pipes23531/23533.
Cat PID5755/start5304 reads pipe23531 and writes outer socket28400; cat
PID5756/start5305 reads pipe23533 and writes outer socket28402. The maps also
retain exact PID/start/FD/access identities for crashpad, zygote, GPU, utility
and renderer writers. They do not establish the historical writers' identities.

In the delayed case Chrome PID8853 exited at 03:14:31.104Z. Holder
PID9010/start33074 exited at 03:14:32.506Z, with the two stream end events
recorded independently. Terminal wait and pipe EOF are separate evidence.
All twelve later capture/key/combo/quit requests were rejected without adding
another command file.

The boundary scans took 9–18 ms; the legacy scans took 4–7 ms on this box.
Baseline journal writes totaled 616 ms across 1,273 writes (maximum 5.05 ms).
The historical baseline's 421 records during its fifteen-second close suggest
a measurement question, not a measured fsync cause. Neither observer overhead
nor slow journal storage was established as the historical cause here.

One initial observer control mistakenly used the baseline's manifest and
refused before Chrome. Its exit, complete kernel drain and readiness timeout
are retained. A fresh corrected control produced the reported 207 ms pass.

## Verification and lifecycle

All eleven focused composed cases passed, including forced exit-zero
rejection, terminal timeout, delayed EOF timeout, later-command rejection and
the independent 30-second cleanup cap. The locked build passed. Results are
recorded in `offline.log` and `build.log`. They do not convert these unchanged-production
passes into repair acceptance. Historical shutdown failures remain unresolved.

Both exact predecessor releases were checked: Warcraft0244 at 03:03:57Z and
Super0300 at 03:09:17Z. One box, **bx_m6w3a76f**, had an independent prearmed
25-minute watchdog, immutable UUID `a9d9318f-2ee5-45e2-b4c3-e5da77257e6c`,
finite TTL1496 and initial expiry **03:34:33.727Z**. The watchdog tool session
returned zero; a separately persisted parent wait/pipe-EOF receipt for that
local watchdog is unavailable.

Before delegated normal archive, 107 artifact rows / 88 unique contents
(149,832 stored bytes) were recovered and reopened with exact SHA/size and
GNU gzip CRC checks. All four kernel drains were complete, covering 415
registered identities with terminal wait receipts; command EOFs were true,
remaining/unreaped sets empty, recorded identities absent and ports closed.
Absence was not used to manufacture EOF or terminal receipts.

The box is **ARCHIVED**, stopped **03:15:46.946Z**, receipt
**stop_c41c040c0474c08a**, completed **03:15:46.963Z**, forced=false,
error=null. Final archiveAfter=null; expiresAt was not returned. Runtime was
released promptly. No original, local Chrome, peer box, agent or public
deployment was used.

The concrete acceptance blocker is the missing reproducible production
failure under the permitted fixture conditions. Further work needs evidence
that distinguishes the historical failing environment from this passing one;
changing shutdown code on these results would be speculative. Single-task STOP.
