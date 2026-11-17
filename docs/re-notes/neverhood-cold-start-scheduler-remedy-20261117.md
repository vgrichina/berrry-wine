Neverhood cold child scheduling trial, 2026-11-17

Evidence: `scratch/runs/20261117-neverhood-cold-start-scheduler-remedy-room/result.json`.
Runtime unchanged. The earlier `9fc96756a` original nursery/wake consequence
remains valid; this finding does not replace it. Authored game-drawn Quit and
native exit proofs from `a853b016b` remain valid and were reverified by hash.
No fresh original was launched: the conditional remedy-proof gate was not met.

Five cold authored trials reconstruct the same sealed source pool
`1cc971fb2d223e0bba6e20c21b094d70f219d107a2ed0d516a7c250d9a35b471`
and retained module
`5a4178950559d4f677d86aa75403908abee343493805f01a0b8aae8f1df2429a`.
The installed shortcut uses the populated 65-record/58-file state. Only the
SETUP95 and NHC program records are replaced by authored programs; the other
56 installed files, registry and pending WININIT remain intact. Each child
freshly hashes all 651,438,080 CD bytes and joins the hash worker before media
adoption. Source, live provider, process/listener identity, one-use tickets,
authenticated desktop hello and USER readiness semantics are unchanged.

The candidate restricted only newly spawned native fixture processes and their
descendants to CPUs 1 and 2, selected once from a two-second per-CPU sample.
Normal affinity was CPUs 0-3. The sample order was baseline1, affinity1,
affinity2, baseline2, baseline3. Baselines 1 and 2 and affinity1 missed the
unchanged 3,000 ms aggregate readiness/capture deadline. Affinity1 published
ready at 3,050 ms; affinity2 published at 1,864 ms and completed actual native
child action, independent UP and Quit with native exit. Baseline2 published
ready at 3,510 ms; baseline3 at 3,021 ms. Baseline1 reached listen() after
3,111 ms of child bootstrap time, without an observed listening callback before
cleanup. Missing callbacks are not credited as completed binding/readiness.

The main-thread bootstrap-to-bind/call observations separate CPU execution,
runnable scheduler wait and off-runqueue time, in milliseconds:

| Trial | CPU | Runnable wait | Off-runqueue residual | Elapsed |
| --- | ---: | ---: | ---: | ---: |
| baseline1, through listen call | 530 | 1479 | 1103 | 3112 |
| affinity1, through binding | 430 | 1048 | 612 | 2090 |
| affinity2, through binding | 382 | 406 | 251 | 1038 |
| baseline2, through binding | 498 | 1885 | 302 | 2685 |
| baseline3, through binding | 547 | 802 | 421 | 1770 |

The fresh child CD scan used 445-537 ms CPU and 131-1483 ms runnable wait.
Its measured off-runqueue residual was approximately zero to 9 ms, including
sampling skew. Thus scan wall time is not evidence of equivalent physical-disk
blocking. The main thread's consumePreparation barrier lasted 193-1037 ms;
189-1007 ms was off-runqueue time while waiting for the worker. The trace
separately records actual source requires, WebAssembly compile/instantiate,
constructor validation, restore/adoption and listen callbacks. Require times
are inclusive/nested and are not added together. Per-thread counters cover the
native main, desktop transport and media workers. Residual time is monotonic
elapsed time minus schedstat execution and runnable wait; it includes blocked
asynchronous barriers and has small sampling skew. Passive overhead is retained.

All allowed CPUs were 97-99% busy in the selection sample. Recorded ancestor
cgroups had cpu.max=max and no throttling increments; CPU pressure was high.
No competing process or host policy is identified as the cause. Affinity
restriction did not provide a reliable deadline result: only one of two
restricted runs passed. The strong host-load variation and incomplete planned
sample prevent a causal improvement claim. No priority change, privileged
scheduling request, denied operation, competitor intervention or cgroup policy
write was attempted. No new redundant serial full scan was found; the existing
hash and desktop transport already overlap host construction. Removing their
required joins would change validation/readiness semantics and was rejected.

The driver stopped on its disk-floor assertion after baseline3 had completed
native cleanup and harness communicate(), before it persisted its own captured
stdout/stderr and returncode. Native, child, controller, release and watchdog
actual waits with both EOFs had already been written. The missing harness
returncode is explicitly unknown. The planned sixth trial never started.
Post-run space recovered above the floor; no foreign files were removed.
This interrupted sample is reported as such, not as six successful trials.

The completed records include 45 actual waits, all with both EOFs; recorded
owned PIDs are absent. All timed-out trials latch terminal UNKNOWN and attest
no later requests. Prior delay/cancel/wrong-port/foreign-listener/late-ready
and game-drawn Quit proofs are reused by exact hash; no broad replay or new
canonical build is claimed. Two selected whole authored dialog images were
personally reviewed. No original input, room action or original Quit is
claimed here, and the conditional one-original allowance remains unused.
No box, source archive, persistent media copy or cachelink change was made.

The remaining blocker is reliable completion under the fixed deadline with
host scheduler contention. This specific affinity candidate is insufficient;
a remedy needs repeatable matched success with the same full-byte validation
and actual native readiness before an original run is justified.
