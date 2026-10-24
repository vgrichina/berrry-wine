# Maelstrom head observer independent review, 2026-10-24

Status: BLOCKED before cheap/native execution; no acceptance or integration.

Candidate `8aebece6f8598d0018b621dbe4aa09753fa28193` and base
`010bb7c2176d0f783b56657cff1b2848ebd102d2` resolved in a new explicit
NONCONE sparse checkout using 72 recursively flattened read-only object views.
Candidate observer, corrected native fixture and cheap tests independently match
the coordinator pins. Original runner SHA256 `4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`,
exports SHA256 `739397dc54a77e93b367334fd4ca96c921180f57a7558913a3301f1de4520b86`,
and retained module SHA256 `8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686`
(1879746 bytes) were verified locally before the attempted test admission.

Static review: pinned exports lines 180–195 implement breakpoint skip-once;
line 2581 set_bp updates bp_addr and bp_first_caller but does not clear the skip.
Thus the corrected fixture's final interior count two is consistent with the
original implementation. OFF uses disjoint 0x7a3c62/66 counters; ON uses
0x7a3362/66, both reject nonzero starting counts. OFF cleanup consumes the final
skip under pending yield before ON begins; ON resets yield, EIP, registers and
stack. These assertions remain unqualified by execution in this task.

The observer instruments the existing arm/run-or-skip boundary with getter-only
state capture, checks halt5/EIP/breakpoint/instruction identity, and rejects raw
watch configuration at parsing before guest memory. Counter counts alone do not
establish MOV/CALL execution. Independent rejecting controls were NOT executed;
no correctness acceptance is inferred from this static inspection.

The first attempted cheap admission failed before child launch: the reused
supervisor followed symlinks inside alternate views and charged standing donor
payload as owned data (owned 300183552, peak 334319616 > 67108864 bytes).
Original rejection and charges are retained in adjacent cheap-admission.json.
Dependent execution stopped. ZERO cheap test executions, ZERO native attempts.
The initial checkout admission passed (projected 42475520 bytes). Publication
alone received separate fresh admission with non-following accounting, preserving
all limits and the first failure; this did not authorize a test retry.

Historical native OFF failure remains FAIL at
/tmp/maelstrom-head-yield-observer-oct24/ops/first-native-failure.json;
ON was not run there. Historical disk rejection remains at
/tmp/maelstrom-head-observer-independent-closeout-oct24/ops/first-resource-rejection.json.
Neither is retroactively accepted. Corrected fixture SHA256 is
938458b147c43f72a0792a6fd1bf625a4fb8c67e472b3079dda00e7c3deb9a5b.

Only this report and focused resource/recovery evidence are added. Production
code remains byte-identical to candidate. No main merge, game guest, build,
acquisition, box, deployment, or gameplay/original-game-causality claim.
No mount argv exists (intended mounted files empty); conditional guest mount
parser checkpoint does not apply. Strict trusted Git SSH configuration retained.
Coordinator owns lifecycle; no box assigned or touched.

Resume requires a fresh bounded assignment with corrected alternate accounting
and new resource admission; native still requires 2684354560 available bytes,
fixed 512MiB arena and shared heavy lock. Evidence in task ops was written before
result.json. Publication refs and actual committed blob seals are in ops/publication.json.
