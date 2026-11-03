# Alice bounded dialogue investigation — 2026-11-03

Run: `scratch/runs/20261103-alice-bounded-dialogue-investigation/`.
The smaller-step planner passes offline. Native dialogue progression remains
unverified: the fresh base runtime had neither a checkout nor Alice media,
and this task's explicit no-media-copies instruction prevented transferring
the missing inputs without clarification. No original game was launched,
and no game control request was dispatched. This is an input-admission
blocker, not a new guest or dialogue failure.

## Verified plan and retained failure

The predecessor's unmodified `test-bounded-steps.py` passes locally with
bytecode writes disabled. An additional check reproduces its exact prepared
207-command route: maximum step64, total6956 credits, unchanged ordinary
input order and total credits. Step400 becomes six requests of64 plus16.
Collision, command-budget, malformed capture-path, pending/error writer,
retained failure and exited-original rejection pass. The failed predecessor
is explicitly refused. These are offline checks, not native retests.

The original first failure remains at
`scratch/runs/20261103-alice-timber-knife-attack/first-error.json`, full SHA256
`e050d2401f15d8ad59e56a893b3ee6389c0ff48e2b0d1d0833e6bc98aff87a09`.
Request110, second-dialogue step400 from batch6156, exceeded180.125505s.
The original then exited0 at batch6452; that does not establish completed
dialogue, knife acquisition, attack, or timber clearance. No predecessor
file was edited and no pending command was duplicated.

## Inputs and recovery

Tested input revision: `277f9a32c984562ef33b2d32a5c13df949b5f87a`.
Both modules were recovered locally from the predecessor archive's per-member
audit and its retained gzip references, then checked by full size and SHA256:

- Canonical: 2125777 bytes,
  `065267ce7c208cb369b1fa930425627b3a238c9e184e5aa46d8ef16143b8b5b8`.
- Compatibility: 2128390 bytes,
  `e7c59d3d39d937f5bef162b9f052259075ff1040d49f5b1be40e8534c5e9fdfe`.

All43 original dependency/media paths match their local full SHA256 pins.
`original43-path-sha-references.json` records paths and hashes; no media was
copied. `module-recovery.json` records both retained recovery references.
The removed predecessor `evidence.tar.gz` was neither required nor recreated;
its `.replaced.json` and per-member audit were used directly. Git remains the
source archive, with source identity and this owned new note's binary diff
recorded in the run. No source-tree tarball was made.

## Fresh runtime and release

The dispatch's MDK2 release and8GB decimal disk target were checked before
creation; available space was8101318656 bytes. `ops/COORDINATOR.md` was reread:
cap TWO, this task the sole admitted runtime lane. No subworker or foreign
runtime operation occurred, and predecessor `bx_8v8hjp4x` was not resumed.

Fresh identity `bx_v3tfhnfx`, TTL3600, original expiry
`2026-11-04T00:16:28.890Z`, and this worker's original-dispatch shutdown
delegation were recorded before use. The only remote execution listed the
fresh home and checked checkout/module/media paths. Its complete output was
recovered locally; there are no game logs, captures, or loaded-module receipts
from this attempt. A runtime-only transfer clarification was requested; no
permission had arrived when shutdown was requested. At23:19:44Z the
coordinator's messageboard entry clarified that necessary hash-pinned runtime
media provisioning is authorized, while evidence duplication remains prohibited.
That entry also released the runtime lane to queued MDK2 work; this task did
not create another allocation after releasing its box.

Local recovery of the execution receipt and both full-SHA modules preceded
the named snapshot `alice-bounded-dialogue-investigation-20261103`.
A local guard assertion saw an automatic snapshot still in progress, but
the shell incorrectly continued to the normal STOP command. This sequencing
error is retained in `lifecycle-verification.json`; it is not a successful
guard check. The server's STOP response independently shows the snapshot
completed and verified at23:18:30.781Z, before STOP was requested at23:18:38.910Z.
Actual state is **STOPPED**, nonforced/errornull, completed
`2026-11-03T23:18:41.431Z`; final snapshot completed and verified at23:18:41.359Z.

## Bounded next action

The coordinator's later clarification resolves runtime-only input provisioning;
the remaining prerequisite is a new serialized Alice runtime allocation.
A separately dispatched fresh original can then use the verified step<=64 plan, inspect completed
request and held-input receipts after every bounded step, and stop at the
first failure. Do not resume or restart the failed original, duplicate pending
requests, or increase step size. This task makes no native dialogue or route
progress claim. No production repair or full build was performed; publication
changes only this note. Files and runtime are released; no successor launched.
