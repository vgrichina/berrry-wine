# Maelstrom head observer independent review — 2026-10-24

Outcome: BLOCKED before native execution and before publication. No acceptance or integration.

Candidate `8aebece6f8598d0018b621dbe4aa09753fa28193` is unchanged. Its observer, corrected native fixture and cheap controls match actual committed blobs (see ops/committed-input-verification.json). The historical runner, exports and retained module were independently hashed against all supplied pins. No canonical build, guest, game, acquisition, box or deployment occurred.

The candidate cheap suite passed. An independent 24-check suite passed for profile rejection, all three raw watch specifications before a memory sentinel, pending-yield inference rejecting changed PC/halt/reason/register/cache state, halt5 identity before instruction readback, exact transformed run/skip boundary preserving run count and state, and six-pair output/mutation bounds. Commands and limits are recorded in cheap-terminal.json and independent-terminal.json. New file: test/test-maelstrom-head-observer-independent.js (uncommitted WIP, copied into ops for recovery). No production repair was indicated by these checks.

Source review confirms set_bp preserves bp_skip_once; a previous head halt leaves the skip armed. The corrected final interior count of two follows from counting the first arrival and halting the second. The fixture uses disjoint OFF/ON counters, asserts zero starts, consumes OFF's final skip with pending yield before ON, and resets registers, stack and yield for ON. Actual OFF/ON equivalence, MOV/CALL/RET and yield transitions remain UNQUALIFIED because admission prevented native execution.

First actual native admission failed: available memory 2593873920 < 2684354560 bytes; disk passed (after projected3359993856 >=2982150144). No native child started, zero executions consumed, no unchanged retry. Historical producer native assertion failure remains FAIL (historical-producer-native-FAIL.json), and prior workers' disk/accounting failures remain historical FAIL; none is retroactively accepted.

Separate authorized review publication admission failed: free2819657728; projected peak51449856 plus other worker67108864 leaves2701099008 <2982150144. No commit/push/remote ref verification or shared integration attempted. Task branch exists only locally at the candidate revision; there is no new review commit. Main and root tracked files/index/refs were untouched.

Accounting uses pinned c683aa3a lstat/os.walk(followlinks=False) helper; owned metadata, full external session/launcher logs, positive SQLite highwater, future24MiB and reserve8MiB are charged. Read-only donor targets are inventoried separately in standing-inputs.json. Native guard holds the shared heavy-runtime lock before admission; rejected before child. The first failure is retained in first-failure.json; later publication admission is separately preserved.

Recovery requires an actual capacity change and fresh disk/memory admission under the existing limits, then the uncompleted native qualification and conditional shared-lock integration against latest remote main. Reuse unchanged passing cheap evidence. Do not retry unchanged rejection or mutate donors. The isolated checkout has explicit NONCONE paths and 72 deduplicated recursively flattened read-only alternate views; ops/recovery.json and prepare.py retain the reconstruction recipe. Standing inputs must remain present; no full clone/repack is needed.

All task artifacts: /tmp/maelstrom-head-observer-accounted-accept-oct24/ops. No assigned box; lifecycle remains coordinator-owned. Original game cause, EDI, errno and gameplay acceptance remain UNKNOWN.
