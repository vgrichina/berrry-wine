# Alice provisioned bounded dialogue — 2026-11-03

Run: `scratch/runs/20261103-alice-provisioned-dialogue/`.
The pinned original demo launched and rendered the New Game menu, but failed
before Easy selection, gnome dialogue or timber-route progress. At batch1681,
the original log records `Process desktop: ETIMEDOUT` in the host desktop bridge.
The pending36-credit request then lost its connection; the original exited1.
The failed original was not restarted and no later input was submitted.

## Original and exact first failure

Original PID44063, session `9e04027b-16dc-4f77-89b6-71ceaf6fac6a`, ran the
ordinary pinned CLI with software rendering, frozen cooperative scheduling,
batch size100000 and `--trace-input`. A process-local app entry selected the
unchanged original media. No held-phase adapter, guest writes, injected calls,
game/config patches, cheats or public deployment were used.

The existing207-command/6956-credit bounded plan was reused. Additional read-only
captures made the proposed route225 requests; the unchanged planner coverage
was not rerun or presented as native evidence. The new driver's host-only
admission checks, negative cases and syntax passed. It caps every step at64,
claims receipt labels exclusively, checks completed terminal responses before
dependent commands, verifies requested/completed step counts, and retains the
first error. Pending commands are never retried.

Only34 requests were submitted. The first33 completed; the last completed step
ended at1666. Ordinary Enter-down at1600, step2 and Enter-up at1602 were queued
and the original input log confirms their dispatch to the game window. Request34,
`replay_route_difficulty_wait_part2`, requested36 credits from1666 toward1702 at
`2026-11-04T00:09:33.044975Z`. It did not complete.

`native/original.log` records the earlier host crash at1681:

```
Process desktop: ETIMEDOUT
receive (lib/process-desktop.js:29)
ProcessDesktop.call (lib/process-desktop.js:179)
ProcessDesktop.poll (lib/process-desktop.js:263)
```

The pinned `receive` waits up to3000ms for the desktop worker response. The
retained stack establishes this timeout path; it does not establish why the
worker failed to answer. Guest EIP at the reported failure was `0x0046c288`;
this host exception is not evidence of an unsupported x86 instruction.
Request34 retained `RemoteDisconnected('Remote end closed connection without
response')` at00:09:44.260Z. The supervisor records exit1 at
`2026-11-04T00:09:44.289059Z`, elapsed199.987146s. The request failure receipt's
SHA256 is `fb8975a512e3168938da8d10b7cdaa9940fa3dcc88aa7aaf28ec4cedea1508ae`.
The driver's secondary error is retained separately; it did not replace the
first receipt. No timeout/normal-exit gameplay claim is made.

Personally reviewed `cap_27.png` shows the original main menu at1600, with
New Game highlighted. SHA256:
`9055cada0ef7900c2667be3d1a7ed86f521fa48264d78dc9dee00fce1bb029c0`.
There is no completed difficulty-screen capture or evidence of Easy selection,
gnome progression, timber clearance, knife acquisition or attack in this run.

## Pinned provisioning and recovery

Tested Git commit: `277f9a32c984562ef33b2d32a5c13df949b5f87a`.
All385 required tracked host/CLI, static dependency, font and compile-input blobs
were read from that commit and matched the predecessor's full-SHA references.
Git remains the source archive; `source-identity.json`, the empty production
`relevant-tracked.patch` and `owned-helpers.patch` preserve the reconstruction
recipe and new host helpers. No source-tree snapshot or tarball was created.

All43 original dependency/media files and the original local manifest were
verified locally, provisioned directly into the test runtime and fully hashed
there before launch. `original43-path-sha-references.json` references existing
paths; media was not copied into evidence or staging archives. All453 sealed
runtime inputs remained unchanged at recovery.

Both modules were provisioned and recovered locally by full size/SHA256:

- Canonical:2125777 bytes,
  `065267ce7c208cb369b1fa930425627b3a238c9e184e5aa46d8ef16143b8b5b8`.
- Compatibility:2128390 bytes,
  `e7c59d3d39d937f5bef162b9f052259075ff1040d49f5b1be40e8534c5e9fdfe`.

The module observer verifies compilation and instantiation of the canonical
module in original PID44063. Compatibility was retained, not executed.
Node was v24.22.1. All212 unique run files were recovered individually and
checked against the remote exact file set and full SHA256 manifest, alongside
both modules. This includes the original log, capture, request ledger,
pending/completed/error receipts and source/helper identity records.

## Serialized runtime and handoff

`CLAUDE.md`, the board and `ops/COORDINATOR.md` capTWO were read before work.
Preparation performed no native execution. The coordinator released Alice after
legacy `bx_5jkb55xs` actually stopped at23:59:07.011Z. Board23:59:33 and queued
release `01a1a3da-950f-76a2-a7a1-f210d0c6f054` were acknowledged before allocation.
The queued release was read from this worker's queue without modifying it.

Fresh `bx_cg8j9amj`, TTL3600, expiry `2026-11-04T01:04:31.021Z`, and shutdown
ownership were recorded before use. Neither stopped predecessor was resumed.
SSH returned `api_key_action_forbidden` before transferring any data and was
not retried. The permitted execution and signed file APIs provisioned454 files
directly and recovered the unique evidence; no alternate credentials were used.

The queued update assigned shutdown to the coordinator. At00:10:51Z the worker
handed back the still-running/idle box with complete local recovery. Original
game, supervisor and driver PIDs were absent and control8123 was closed.
The coordinator verified all212 recovered files and both modules, saved named
snapshot `alice-dialogue-timeout-20261104`, verified its completion, then
performed normal STOP. Independently read final state is **STOPPED**,
nonforced/errornull, completed `2026-11-04T00:11:55.853Z`; final snapshot
completed and verified at00:11:55.798Z. The coordinator released the runtime
lane at00:12:03Z. `runtime-release.json` and the coordinator's copied lifecycle
receipts preserve the actual state; this worker did not issue STOP.

The bounded next action is to investigate the pinned desktop authority/client
response path and worker scheduling using this retained first failure, then add
a focused regression before any production repair. This run supplies no cause
or repair proof. No production code changed, no full build was required, and no
successor or subworker was launched.
