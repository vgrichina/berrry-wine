# Jedi controller: explicitly reviewed neutral reference

The source-only prerequisite is repaired in retained helper
`scratch/runs/20261103-jedi-controller-neutral-reference/neutral_reference.py`
and adapter `bounded_reviewed.py`. No game campaign was run. A future campaign
requires separate coordinator dispatch and integration using the retained
`RECOVERY.md`; the historical neutral image cannot authorize live input.

The actual predecessor `step.py` reads `previous-state.json` and passes its
location into `bounded.run`, ignoring the later neutral state returned by the
controller. Replaying the byte-exact retained controller reproduces its real
`western-corner` stop before a fifth keydown:

| Memory boundary, UTC 2026-11-03 | Batch | X | Fresh distance |
| --- | ---: | ---: | ---: |
| Immediate post-release 13:39:30.286 |457411|−1.798464060|0.121526241|
| Earlier reviewed capture state 13:39:30.341 |457414|−1.834322810|**0.085667491**|
| Later neutral state 13:39:30.475 |457610|−1.901736736|**0.018253565**|
| Next fresh precontrol 13:39:46.966 |490865|−1.919990301|0|

Y/Z and yaw are unchanged at those boundaries; world20553048 and player29414172
remain the same, health/shield100. The original limit remains **0.08 world units
and 4° yaw**. The small neutral comparison is justified only with explicit review
of the neutral image and matching state; it is not permission to substitute a
later unreviewed state. I inspected the retained earlier, neutral and blocker
PNGs: stone western lane, pistol and HUD100; no positively identified armed
hostile. `diagnosis.json` retains full precision, image SHA256 and review notes.

The actual sequence is post memory → capture memory → registry read → PNG →
short neutral memory → neutral PNG → human review delay → fresh precontrol.
The earlier image was reviewed13:39:44.817313Z; the neutral image has no original
explicit review entry. Exact historical PNG request/completion times and a
post-neutral-PNG memory sample are absent. Memory precedes PNG, and the game
continues during review. The neutral-to-fresh interval is16.491 host seconds;
this does not identify physical key hold time, engine consumption time or an
engine defect. Four original down/up delivery pairs remain the accepted input
evidence; no fifth keydown or new guest delivery is claimed.

The helper creates a new **memory → PNG → memory** neutral pair with request
boundary times and hashes, then requires explicit review naming the exact PNG
and paired JSON digests. Both bracket states constrain the fresh precontrol
sample. It rejects stale pairs, pending/unreviewed captures, superseded reviews,
changed bytes, null states, damage/death, changed world/player identity and
position/yaw drift. Brackets are bounded to1 host second, review age to60 seconds,
and fresh precontrol age to1 second. These additional bounds do not make capture
atomic. Approval permits one operation; the next needs a new pair and review.
The adapter preserves release timers/finally release, post/neutral damage checks,
input limits, original observer code and the visible-armed-target fire restriction.
Rejected review/control stops without steering; no automatic rebaseline or retry.

Validation: **11 host unittest methods**, including actual old rejection and
meaningful negative controls; the byte-exact original **four controller tests**;
and **five unchanged source-only input/clock tests**, including **five clock
mutation rejections**, all pass. Tests replay retained records using synthetic
clocks/transport; synthetic pair receipts are explicitly labeled. The original
observer/control files and input/clock assertions are preserved and hashed.
No production change or heavy build was needed for this documentation/evidence
scope. Accepted input723e390a4 and coordinator-jedi-preflighted-review/review.json
were reused without repeating packaging audits.

Executable helper/tests, selected original records, `controller.patch`, logs,
`fullsha.json`, `recovery-payload.tgz`, `RECOVERY.md`, `FINAL.md` and `result.json`
are retained in the assigned ignored run directory. No concrete engine runtime
defect was found. No browser, boat, guest launch, deployment, predecessor lifecycle
operation, cleanup of foreign files or subworker was used. No box was assigned;
coordinator retains lifecycle ownership. Next: separately dispatched campaign
using fresh reviewed neutral pairs, with ordinary first-blocker stopping.
