# MDK2: why startup3584 did not reproduce pre-GC admission

Published original report `cd4b2e74174231b62ab3aa0affc2d1b1bb077efd`
stopped correctly: command65 reached the exact-PC assertion in
`createTraceDriver.begin()` with native thread1 at `0x4641c7`, rather than
`0x47d9c8`. The earlier implementation treated a checkpoint observed in one
original as reproducible at a fixed host-step count. The new retained original
disproves that reproducibility assumption. Its stack also fails every one of
the seven required saved-return positions. Accepting this PC would require a
new native safety argument; changing the literal alone is unjustified.

The immediate cause is established. The exact native cause of the divergent
execution paths, and a safe ordinary route from the new state to pre-GC
observation, remain unresolved by retained evidence. No runtime change or
retry was made for this diagnosis.

Inputs are the [continuous original report](mdk2-continuous-original-medium-20261105.md),
the [earlier attachment analysis](mdk2-earlier-gc-attachment-cause-20261105.md),
and the actual retained runs
`scratch/runs/20261105-mdk2-continuous-original-medium/` (NEW) and
`scratch/runs/20261105-mdk2-post-medium-timer-onward/` (OLD).
Diagnostic evidence is in
`scratch/runs/20261105-mdk2-reachable-checkpoint-cause/` (RUN).
RUN/audit.py reads actual retained JSON, checks identities and hashes, and
records its inputs in audit.json. It does not import or execute the game,
driver, Worker or module. Git is the source archive; RUN records the audit Git
SHA, relevant binary diff and new-file patches. Existing executable/media/module
paths and hashes remain references, without copies.

## Recorded controls and native states

Removing only timestamps, OLD and NEW `browser/commands.jsonl` agree exactly
through command65. The startup prefix contains 56 ordinary step64 commands
and eight startup captures including startup0 and startup3584. They reach3584 steps before
command63 captures startup3584, command64 reads native selector state, and
command65 requests the ordinary observe16. There is no New Game input in that
prefix. Both startup3584 native selections have startscreen, selected0,
command62 phase/raw/previous/active0, empty input queue, null active input and
mouse mask0. These predicates support menu readiness, not a native call history.

| Frozen steps | OLD actual PC / ESP | NEW actual PC / ESP |
| --- | --- | --- |
| 0 | 4800a5 / 074ffffc | 4800a5 / 074ffffc |
| 512 | 4515cd / 074ffd40 | 4515cd / 074ffd40 |
| 1024 | 4515cd / 074ffdb4 | 4515cd / 074ffb2c |
| 1536 | 4515cd / 074ffd3c | 4515cd / 074ffd3c |
| 2048 | 45bd9e / 074ffb88 | 443494 / 074ffd24 |
| 2560 | 4515cd / 074ff8b4 | 4515cd / 074ff8b4 |
| 3072 | 44fc40 / 074ffd0c | 47cef1 / 074ffc88 |
| 3584 | 47d9c8 / 074ffcd8 | 4641c7 / 074ffbe8 |

These are `startup-N-native-main.json` readbacks, not PCs inferred from pixels
or the outer step result's `eip:0x00000000`. Divergence is already visible in
ESP at1024; the sampled states sometimes coincide again. They cannot determine
which run is globally ahead. Both advance512×16ms between captures, but OLD
guestMs exceeds NEW by88ms at every sampled checkpoint, including startup0
(924 versus836). Thus freezing16ms does not equate startup clock epochs either.
This offset is observed; its causal contribution is unknown.

NEW's `bounded-trace-ownership-before.json` and `-after.json` are identical at
3584. `reply-65.json` preserves the unsupported-checkpoint assertion at
03:04:29.676Z. The matching terminal slot0 report binds module
`e620f3adfc2850580004e204bc1fea495844e942806866f8ada24c215212e412`
and says `started:false`, `traced:false`, `observer:null`, `traceEnd:null`.
Its last native slice had budget6000, ordinal3323, completed=true,
ranBlocks6000. This is one completed slice, not cumulative native boundaries
or a history of budgets. The assertion precedes Worker `invoke('start')`, its
initial sample and the dependent `WineFrozen.step(16)`. No command66, New Game
or Medium input followed. This failure was neither GC execution nor a native
guest crash; the native admission fence stopped the command.

## What ordinary pre-GC reachability actually establishes

OLD genuinely reached47d9c8 without injected New Game input. Its bounded stack
positions6/14/22/39/42/45/47 contain
47ca7e/47a928/47b393/47c012/47c626/451546/402176. The original main-loop bytes
show CALL451540 at402171 returning402176; main then increments/tests the
periodic counter, conditionally PUSHes at402186 and CALLs443070 at402187,
returning40218c. This saved maintenance chain supports admission before that
invocation's subsequent conditional collector call. It does not prove the
counter value, how soon that call will happen, or that no earlier collection
has occurred during startup.

OLD command65 actually advanced16 steps to3600. Its ordinary New Game Enter
down68/step69(16)/up71/step72(32) established full rest at3648, followed by a
freshly reviewed difficulty dialog. Its first observer start was command77,
after Medium keydown76. At that point actual PC449096 already had saved
44308f and40218c in the bounded stack. The observer started with zero observed
boundaries and a sample; the subsequent `gc return history missing` fault at
40218c establishes missing entry history, not a newly observed collector entry.
Medium's queued press was acknowledged, but native consumption and full rest
were not established. This is why continuous observation was moved earlier.

The intended route is therefore: authenticate the original owning Module before
instantiation; keep instrumentation dormant through ordinary startup; at an
actually qualified native pre-GC checkpoint, start once before the existing
observe16; checkpoint/resume the same observer across New Game press/release/full
rest and fresh Medium press/release/full rest. Real entry443070 with
`[ESP]=40218c` must precede its matching return at entryESP+4. Saved stack
words never create those events. The published implementation tests this route
with explicit synthetic producer/native fixtures. OLD proves the unobserved
ordinary prefix reached its particular seam; neither original proves the
continuous route completed or had sufficient50M/360s/512-record headroom.

NEW's4641c7 has none of the required seven stack-position values. Narrow
original disassembly shows `push 5` there, followed by an indirect call through
5c5794. That instruction is not the decoder output checkpoint. Static bytes
describe possible next instructions; they do not prove that NEW executed them,
returned to maintenance, or would next reach an admissible checkpoint. The
192-byte stack has no established maintenance chain equivalent to OLD's.

## Cause boundary and smallest justified recommendation

The pinned runtime is Git1329b1ba6eb00144ff77d4cd92a8513d4fc953ad,
not today's host.js. Its host adapts native work per slice using
`round((ranBlocks * 12 / ranMs) / 1000) * 1000`, clamped between1000 and the
configured ceiling, after sufficiently spent non-input-burst slices. Host
steps therefore count scheduling opportunities, not a fixed native instruction
prefix. Wall-time costs, yields and other Worker progress can change which
guest instruction a given step reaches. The dormant wrapper forwards the
original import and records run metadata; it has not activated the observer's
per-boundary checks before this failure. Blaming active observer overhead for
NEW's startup divergence would contradict that terminal report.

This mechanism explains why a step-indexed seam lacks a reproducibility
guarantee. It does not identify the actual paired budget/timing sequence that
produced these two PCs. Retained evidence lacks that sequence, cumulative
native boundary history before admission, and the complete live stack/heap/
decoder state needed to replay either startup. The last NEW6000-boundary slice
cannot fill those gaps. Matching controls, modules, screenshots or selected
counters cannot supply the missing execution witness.

Keep the current rejection. The smallest justified next implementation work is
bounded read-only provenance for ordinary startup slices and candidate native
maintenance checkpoints, retaining budget, blocks, timing/yield, owner/epoch,
registers and sufficient caller context. Qualify an actually reached seam
before proposing any admission change. Any new route must prove that relevant
tracked calls are not already pending, then witness GC entry/return continuously
with one fixed contract. Do not add4641c7 to an allowlist, discard stack guards,
silently run past the first failure to hunt for47d9c8, seed frames from saved
returns, restart observation, reset deadlines or enlarge caps. Current evidence
does not justify a production acceptance patch or another original attempt.

Validation: retained-data/source audit PASS; all seven relevant source/test
files match exact repair71985c4506f6dd6caa374357e5812350cf1ced1d bytes.
Reused logs are SHA/size-verified:178 integration tests,45 runtime tests,
17 focused tests and full locked build. No executable suite was rerun;
docs-only `git diff --check` is sufficient here. No production code, runtime
semantics, modules, shared files or queue locks were changed; no browser,
game/module execution, heavy test or build was used. Menu captures and
synthetic fixtures are not gameplay proof. Box ID/state/expiry:NA; no box was
assigned or changed; coordinator owns shutdown.
