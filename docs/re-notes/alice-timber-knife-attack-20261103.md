# Alice timber passage and knife — 2026-11-03

Run: `scratch/runs/20261103-alice-timber-knife-attack/` (ignored evidence).
This bounded task inherited the original live game after its first worker and
launcher exited 143. Recovery preserved the existing process and input sequence;
no replacement game, replay restart, new boat or subworker was launched.
The first remaining failure was a 400-credit second-dialogue request exceeding
its 180-second transport timeout. Knife acquisition, first attack and new timber
clearance remain unverified. Full local recovery passed before normal STOP.

## Original identity and takeover

Task boat `bx_8v8hjp4x`, original expiry `2026-11-03T22:56:01.103Z`, was
recorded before use. The explicit takeover assignment delegated normal shutdown
only after full local recovery, both modules, and a completed verified snapshot.
The boat was checked first and was live/healthy, with no stop record.
Original PID6651, supervisor6646, session
`16fa86ca-a0dd-4c5e-a011-834b2642dce5`, and replay PID6683 remained present.
The original game's immutable deadline was `2026-11-03T22:26:51.103Z`.

At takeover, completed receipts and the pending difficulty-screen step were
inspected before any further controls. The existing replay continued. Its
requests were never resubmitted. The initial empty module-observer receipt was
preserved as pending; a later host timer write recorded both compilation and
instantiation of the exact module in the same PID/session. This was delayed
evidence, not a changed module or another launch.

Runtime input `277f9a32c984562ef33b2d32a5c13df949b5f87a`; canonical module
2,125,777 bytes, SHA256
`065267ce7c208cb369b1fa930425627b3a238c9e184e5aa46d8ef16143b8b5b8`.
The inherited archive SHA256
`9794e67a79ee6db80e7726b7a051f8de14d60fcf034d3912269cff1107c44009`
and all 7,224 payloads were verified before original staging. All 43 original
game/dependency pins and the unchanged compile-input proof were retained.
Shared MDK2/Jedi WIP was excluded. No emulator/game source changed or build ran.

The original run uses software rendering, frozen cooperative scheduling and
batch size 100000. No guest writes, injected calls, cheats, save/config edits,
compilation-container download or public deployment. `input-state` remains
prohibited without `--trace-input-dispatch`. Capture requests require valid
absolute PNG paths before dispatch; exclusive labels and completed receipts
guard dependent reads. MDK2 stayed static until this task's explicit runtime release.

## Tests and limits

Takeover reran the task-local control-plan, recovery, module-receipt and pending
dependency tests. Valid controls/receipts pass; malformed paths, changed payloads,
duplicate/traversal archive members, wrong module/PID, and pending/error receipts
are rejected. These offline checks do not establish gameplay.

The accepted wind crossing is a route prerequisite. No repeated wind acceptance
or wind-force claim is made. The predecessor's missing-PNG-path terminal failure
and its repaired guards remain in custody. The original map/script route goes
east through the timber opening, then south to the knife altar
`(-3978,4326,-168)`. Cinematic `fakeplayer` attachment alone cannot establish
controllable knife ownership or an attack.

## Exact remaining failure and bounded repair

The existing replay completed its ordinary controls through batch6156. Its
command 110, `replay_route_second_dialogue1`, requested 400 credits at
`2026-11-03T22:11:10.717Z`. No terminal receipt arrived before the 180-second
request timeout. `first-error.json` records `TimeoutError('timed out')` at
`22:14:10.843Z`, elapsed 180.125505s. The stop-on-first-failure supervisor then
quit the original process cleanly, exit 0 at `22:14:12.576Z`; its terminal stats
report 6452 batches. Thus the 400-credit request was not proved complete. The
second 400-credit dialogue request and all onward plans were never dispatched.

Before that timeout, a read-only `/proc` sample showed the main thread waiting
in `futex_wait_queue` and two active WorkerThreads. Kernel stacks were denied.
The short perf diagnostic ran after the process exited and returned “No such
process”; it supplies no stack evidence. These observations do not identify a
guest fault or prove a renderer defect. Final native fault status, guest state
at the timeout, and the cause of the slower segment remain unknown. There are
no new inspected gameplay images or held Player samples from this attempt.

The separate ignored `bounded_steps.py` planner limits future step requests to
64 credits: 400 becomes six 64-credit requests plus 16. It preserves ordinary
input order and total credits, checks label collisions and the command budget,
and refuses admission after a retained error/exit or while a writer is pending.
The prepared future route has 207 commands; it was not dispatched. Positive and
negative tests pass locally and offline in the same boat, including refusal of
this actual failed original. This reduces request size; native success and a
performance bound have not been demonstrated. All predecessor helpers/plans
remain unchanged. A generated staging-snippet quoting error was retained,
confirmed to have executed no writes, corrected and syntax-checked before the
successful offline staging/test. It did not alter the original game failure.

## Complete recovery and lifecycle

All 6,094 sealed source/input files still matched remotely. The retained local
archive `evidence.tar.gz` is 129,306,532 bytes, SHA256
`51d97d838c3517cfeb9afd28eea12994854f3effb7c6babc8d67531dff467f7d`.
Every one of its 6,681 payloads was streamed locally for full size/SHA and exact
member-set verification before STOP. All 43 inherited game/dependency pins match.
Both canonical and compatibility modules are fully recoverable; compatibility
is 2,128,390 bytes, SHA256
`e7c59d3d39d937f5bef162b9f052259075ff1040d49f5b1be40e8534c5e9fdfe`.
The original inherited 7,224-payload archive and predecessor files remain intact.
`RECOVERY.md` records restoration without resuming any boat. First-error SHA256
is `e050d2401f15d8ad59e56a893b3ee6389c0ff48e2b0d1d0833e6bc98aff87a09`.

Original PID6651, supervisor6646 and replay6683 were absent, with control8123
closed. The named snapshot `alice-timber-knife-attack-20261103` was saved. A
subsequent snapshot initially reported in progress, so STOP waited; completed
and verified snapshot timestamps `22:17:10.858Z` postdate archive creation.
Only then was the explicitly delegated normal stop requested. Actual state is
**STOPPED**, nonforced/no error, completed `2026-11-03T22:17:34.627Z`, with final
completed/verified snapshot `22:17:34.573Z`. Original expiry remained
`22:56:01.103Z` until stop. Runtime was explicitly released on the messageboard;
local free disk remained above 2GB (2,463,891,456 bytes at verification).

This is documentation-only publication; no tracked source changed and no full
build was needed. A future separately authorized attempt can use the smaller
credit plan and inspect the slow second-dialogue segment before proceeding to
the timber jamb and knife. No successor was spawned by this task.
