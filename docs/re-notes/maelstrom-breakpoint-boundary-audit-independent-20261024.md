# Maelstrom breakpoint-boundary independent review — REJECT

Candidate `73cdec846a1153651d7c28b9fd33937166bcdfea` on
`task/maelstrom-breakpoint-boundary-audit-oct24` is rejected for an incorrect
halt classification. Main is unchanged by this task. No repair or runtime replay
was attempted. This branch contains only this independent review and evidence.

The pinned historical `src/13-exports.wat` tests a changed WASM watchpoint at
lines 172–179, before the EIP breakpoint at lines 183–195. **Both branches write
`last_run_halt = 5`.** The adapter nevertheless labels every raw 5 as
`eip-breakpoint`. Its configuration checks do not exclude watchpoints; the
historical runner supports arming them alongside `--trace-at`.

The unchanged adapter accepts a source-proven watchpoint halt with EIP
`0x7a3366` and correct `get_bp_addr()` readback, emits a target record labelled
`eip-breakpoint`, reads 16 bytes, and concludes `target-observed`. At a different
EIP the same watchpoint halt is still incorrectly labelled `eip-breakpoint`,
although memory observation is correctly withheld. Arming/readback proves the
breakpoint is installed; it does not distinguish the earlier watchpoint branch.
The historical no-watch recipe does not demonstrate this collision occurred in
the retained capture. The defect is in the adapter's accepted configurations
and positive causal label, not evidence of a new historical guest failure.

An acceptable revision must either establish the exclusive halt cause or
reject conflicting configurations and use a source-supported halt label.
This review deliberately leaves that implementation to a new assignment.

## Reproducer and controls

The adjacent `reproduce.cjs` hashes the unmodified candidate adapter and pinned
runner/exports, transforms the actual runner, and executes exact transformed
watch arming, audit initialization, breakpoint arming, main-run and finish
fragments. Mock exports supply the two **source-proven** halt causes; this is
an offline fragment integration test, not WAT execution or a runtime replay.
The `run` call remains 1000 blocks. Real breakpoint control: 16 reads and one
target. Wrong-halt control (8 at target): zero reads and unresolved summary.
Watchpoint collision: 16 reads and the false positive label. Its explicit
acceptance oracle fails with the retained assertion, exit 1.

From this repository checkout, using the retained candidate checkout (or a
checkout of the exact published candidate with its focused files):

```sh
node --max-old-space-size=256 docs/re-notes/maelstrom-breakpoint-boundary-audit-independent-20261024/reproduce.cjs /tmp/maelstrom-breakpoint-boundary-audit-oct24/repo
node --max-old-space-size=256 docs/re-notes/maelstrom-breakpoint-boundary-audit-independent-20261024/reproduce.cjs /tmp/maelstrom-breakpoint-boundary-audit-oct24/repo --acceptance-oracle
```

The first command exits 0 when the defect is reproduced; the second must exit 1
with `watchpoint halt must not be positively classified as an EIP-breakpoint halt`.
Commands, bounded output, fresh memory measurements and CPU/wall results are
retained adjacent. Tests ran under heap 256 MiB, CPU/wall 60 s, capture 1 MiB;
MemAvailable exceeded 805306368 bytes. No WASM/native instantiation occurred.

## Checks that passed

All 15 candidate working files match their exact Git blobs. The full retained
runner (685960 bytes, SHA256
`4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`)
and exports (344898 bytes, SHA256
`739397dc54a77e93b367334fd4ca96c921180f57a7558913a3301f1de4520b86`)
match the true historical Git source at
`d8cd8c54c8d63c107696f1e4ef7a1e229dcadc1e`, checked in memory. Export
excerpt bytes/hashes match; transformed fragment hashes are retained.

The full 7725-byte adapter and 11818-byte test were reviewed. The main snapshot
hook is immediately after the existing run and before host/render/scheduler
work. Actual main arming/readback is tested; the disabled transformation is
byte-identical. Input injection, batch size 1000, pacing and maximum budgets
are unchanged. Optional guards/counters have explicit unavailable values.

The original candidate test passed unchanged: seven rejecting mutations,
ten missing/duplicate anchor rejections, seven missing-export rejections,
finite 10000-batch no-hit result and bounded output. This oracle misses the
shared halt-code case. Exact 25 primary and 23 recovery seals were reverified
against standing published evidence; the prior nine-control receipt is reused.
No packaging, acquisition, build, guest/browser, box action or deployment was
performed. Runtime reachability and historical zero-record cause remain UNKNOWN.

## Recovery and publication

Resource admission is retained adjacent: projected initial peak 42695138 bytes
inside 64 MiB including full session/events, positive SQLite/history growth,
future allowance and 8 MiB reserve. Per-file cap is 24 MiB and host free-space
floor is 2982150144 bytes after growth. Standing tools and donors are separate;
all new checkout/Git/temporary/evidence copies are charged. Task-root accounting
retains subsequent measurements, corrections and original diagnostics.

Task branch: `task/maelstrom-boundary-audit-independent-oct24`. The task-root
`publication.json` records commit and actual remote SHA; `final-review.patch`,
`cleanup.json`, resource receipts and `ops/result.json` (written last) preserve
the final disposition. No main integration was attempted, so the shared
integration lock was not acquired. No box was assigned; lifecycle ownership
remains with the coordinator.
