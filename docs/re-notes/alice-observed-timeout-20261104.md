# Alice observed timeout — 2026-11-04

The original batch1681 ProcessDesktop timeout remains **unexplained**. One
changed diagnostic completed the formerly failing1666→1702 request and reached
ordinary native ground movement without reproducing the timeout. There is no
causal repair, scheduling-cause attribution, completed gnome dialogue, knife
acquisition or gameplay-completion claim. The original timed-out destructive
poll's outcome remains unknown; it was never retried or acknowledged.

Run: `scratch/runs/20261104-alice-observed-timeout/`.
Prior evidence: [original failure](alice-provisioned-dialogue-20261103.md) and
[participant observations](alice-desktop-phase-observation-20261104.md).

## Exact inputs and authorization

Baseline `625be68f9c2b685797a81f837992f4421d469f16` includes observation
`458625894d20887053d23227152abb5467bf78ae`. All385 tracked source/font/compile
inputs were read with `git show SHA:path`; foreign WIP and subsequent main
changes were excluded. `source-identity.json` and empty `relevant-tracked.patch`
identify that closure. Git is the source archive. `owned-helpers.patch` preserves
the small run helpers; `postlaunch-recovery-helper.patch` preserves the later
local-only recovery helper. No source/media archive was made.

All43 original dependency/media pins and the original manifest matched before
launch and after execution. Media was transferred directly into the runtime,
without copying it into evidence. The baseline uses accepted458625894
locked-build modules; its compile-source paths have no committed difference
from625be68f9. Both were recovered by full size/SHA256:

- Canonical,2143540 bytes:
  `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee`.
- Compatibility,2146153 bytes:
  `580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3`.

These differ from the original failure's065267ce/e7c59d3d modules, retained by
prior path/full-SHA references. This is an explicit diagnostic input difference,
not a controlled replay of the old modules. `baseline-module-provenance.json`
links the accepted build. PID8141's observer proves canonical compilation and
instantiation; compatibility was retained, not executed. Observer filenames
include PID/Node threadId to prevent worker preloads overwriting the main record.

Preparation used syntax and small fixtures only, with no box/build/browser/game.
Coordinator board01:18:55 explicitly released Alice after MDK2's verified normal
STOP01:18:38.420Z. This worker acknowledged before creating fresh `bx_u3jnuyts`,
TTL3600, expiry `2026-11-04T02:19:09.797Z`, shutdownOwner=coordinator. Identity
and expiry were recorded before use. No predecessor was resumed or worker spawned.

## External observation

The Python supervisor gates child execution on a pipe until its baseline is
saved. Thus external sampling began before Node PID8141 could create workers.
Sampling ran every nominal50ms with128 retained samples (nominal6.4s; actual
monotonic start/end and wall times expose gaps). Recent, prefix-checkpoint and
final windows retain task appearance/disappearance, stat/status/affinity/wchan,
schedstat/sched, process CPU, host CPU/load/pressure, resolved cgroup membership
and the mountinfo baseline. Per-thread on-CPU/run-queue/timeslice deltas and
host/process CPU deltas accompany raw files. Cgroup-v2 quota/statistics/pressure/
cpuset, v1 equivalents and visible ancestors include interval counter deltas.
Read failures retain errno. Task sampling caps at64, ancestor traversal at16,
history at128 samples and first-error trace capture at32 files.

Nine OS threads were observed, including all worker-written identities: main
TID8141, authority TID8148, bridge TID8149, Node v24.22.1. Checksummed participant
records retain correlated request phases and bounded preload identities. Frozen
prefix/final summaries contain no recorded first error or timeout. On cleanup,
retire1857868 completed before termination callbacks reported code1 for both
workers. Those close-time callbacks do not establish an original worker failure.

`last-successful-poll.json` correlates poll1857867 across main submission,
bridge/socket/authority receipt, handler completion, reply-write, bridge frame,
shared notification and main return. Limit256/local pending0, queue0→0,
returned0. There is no failed request phase or timeout response-word snapshot
in this run. The synthetic fixture exercises first-error capture; it is not an
Alice failure. The3000ms deadline, fail-closed/no-retry and unknown-outcome
handling were unchanged.

The sampler ran continuously through retirement, but rings are recent history,
not a complete audit. No actual3000ms failed wait occurred. Synchronous tracing
can perturb timing. `perf_event_paranoid=4` restricts scheduler event tracing;
samples cannot recover every short transition. Missing JS markers, absent error
records or aggregate CPU do not establish an OS scheduling cause. None is claimed.

## Native progress and bound

The normal local-entry route used software rendering, cooperative `--no-threads`,
frozen scheduling, batch size100000, `--trace-input`, canonical Wasm and
`--max-seconds=900`. No held-phase adapter, guest writes/injected calls,
configuration/game patch or cheat was used. Original payloads were segmented
for capture review without replay. The final small segment's SHA was recorded
before use. All124 sequential requests completed:103 step requests, max64,
total4926 batches. Fifteen native events contain seven balanced key down/up
pairs and one relative mouse movement; no input remained held.

Personally reviewed captures:

- `cap_27.png`,1600: New Game highlighted, full SHA
  `9055cada0ef7900c2667be3d1a7ed86f521fa48264d78dc9dee00fce1bb029c0`,
  exactly matching the original failure run's menu capture.
- `cap_32.png`,1702: Easy screen after the formerly failing36-credit request.
- `cap_77.png`,4104: Alice standing in the cave after ordinary Easy/load.
- `cap_106.png`,4326, and `cap_110.png`,4526: movement onto the wooden walkway.
  `cap_117.png`,4926: Alice there from the changed camera view. These do not
  establish completed gnome dialogue or knife acquisition.

Last gameplay command completed at847.401754s, within the15-minute segment.
The worker missed its early-quit checkpoint. The frozen idle runner did not
retire at its900s option; with no further gameplay input, an external
`ordinary-stop` caused supervised SIGTERM/CLI cleanup and exit0 at917.637017s.
Process lifetime therefore exceeded900s by17.637s, with70.235s idle after the
final command. This was not a normal control-quit receipt or a strict900s
process-bound pass. No pending command was retried.

The original IPC failure is the unresolved causal blocker: this changed run
did not reproduce it, so there is no tested repair. Native acceptance is limited
to the reviewed ground route. Planned dialogue waits do not prove that a dialogue
trigger or knife objective completed. No unchanged replay followed.

## Recovery and handoff

Recovered667 unique outputs,24836058 bytes, individually by full SHA256, plus
both modules. The exact remote output set was stable before/after recovery.
All458 sealed inputs and the provisioning manifest's own SHA remained unchanged.
Source/run inputs and media were not re-archived; the original-log symlink was
recorded without duplicating its target. `recovery-verification.json` maps all
remote outputs locally, including two raw launch records kept separately from
their differently structured local API-wrapper records.

Checks passed: helper Python/JS syntax; cgroup-v1/v2/subtree and short Python
process fixtures; launch gate/live task/delta collection/bounded ring/synthetic
first-error freeze; receipt interface/forbidden-command/large-step rejection;
124 terminal receipts/native input balance; canonical compile/instance identity;
full input/module hashes and stable exact output-set recovery. There was no
production code change, causal regression or build by this worker. The accepted
module build is explicitly referenced above; fixture success is not gameplay.

At handoff, `bx_u3jnuyts` was RUNNING/idle, expiry
`2026-11-04T02:19:09.797Z`, shutdown owner **coordinator**. Original PID8141 and
control8123 were absent/closed and driver output stable. The worker did not stop,
delete or resume the box. Coordinator verification/snapshot/normal STOP is next.
Publication details are retained in `publication.json` in the run. Single task
ends here, without a successor or deployment.
