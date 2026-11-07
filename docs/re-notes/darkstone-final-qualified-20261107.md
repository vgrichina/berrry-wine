# Darkstone final qualification: disk floor prevents launch

Loot pickup, inventory consequence and native save/reload remain unproved.
This successor to [bbbee0389](darkstone-loot-save-20261107.md) stopped before
Chromium or box allocation: `/home` had **1,910,308,864 free bytes** during
the pin check, below the required **2,000,000,000-byte** floor. A second
measurement at **2026-11-07T11:41:03.064384Z** found **1,909,334,016 bytes**.
The remaining startup/capture/exact-ACK qualification was therefore not run.

Evidence is in ignored `scratch/runs/20261107-darkstone-final-qualified/` (R).
R/pin-reuse.json verifies SHA-256 and size of all **469** predecessor pins,
including the original registered demo paths and current runtime. All match;
R/relevant-tracked.patch is empty. The predecessor browser and preflight helpers
were read only, with their hashes recorded alongside the prior passing release,
identity and ACK-control evidence. Completed controls were not repeated.

No browser, guest, input command, profile, listener or remote box was created.
R/cleanup-local.json records this empty lifecycle; box ID, state, expiry and
archived-state verification are not applicable. No old box was resumed, and
there is no custody to hand back. No guest code, configuration, save, memory
or clock was edited. No emulator mismatch was demonstrated and no code changed.

R/checkout-head.txt, R/source-recovery.json and the predecessor's owned-helper
patch identify source recovery. Git remains the source archive; no source or
media archive was made. R/evidence-inventory.json hashes this run's artifacts,
and R/result.json is written last after publication.

Next: restore sustained free disk above 2 GB, finish the unchanged pinned actual
guest/legacy-WebGL startup, personally reviewed capture and exact-ACK sequence,
then use one fresh UUID-idempotent 40-minute box with an immutable 25-minute
browser deadline for the original loot/inventory route and native save if
reachable. The [accepted November 4 skeleton victory](darkstone-webgl-ardyl-combat-20261104.md)
remains the latest reviewed gameplay consequence.
