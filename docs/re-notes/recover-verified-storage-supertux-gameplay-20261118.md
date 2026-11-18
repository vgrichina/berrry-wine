# Verified storage recovery and SuperTux, 2026-11-18

Recovered **184,131,584 allocated bytes** by converting 22 inactive, reviewed
project evidence text files to durable gzip archives. Each conversion checked
SHA-256 and length after reading the archive from disk, stable input identity,
and no open descriptor across `/proc` as root. Both a durable proof and an
adjacent recovery note existed before unlinking the original. The final audit
decompressed all 22 archives again and verified every original hash and size.
Recovery is `gzip -dk ORIGINAL.gz`; the individual paths and recipes are in
the two recovery summaries. This is the allocation difference for converted
files, including their adjacent notes, rather than an attribution of concurrent
filesystem activity. Evidence/proof overhead is additional.

Evidence: `scratch/runs/20261118-recover-verified-storage-supertux-gameplay/`.
Initial actual `/home` free space was 1,498,390,528 bytes, below the owner's
1,500,000,000-byte floor. After the first batch it was 1,634,557,952 bytes;
after the second, 1,657,376,768 bytes. These are observations, not a sustained
capacity guarantee. No histories, databases, caches, media, source WIP,
credentials, holds, Ariana files or foreign processes were altered. No new
hardlink recovery was needed. No larger historical writer attribution or
project storage-cause fix is claimed.

The native SDL input qualification passed positive and refusal cases with
actual wait 0 and both output EOFs. All 789 original SuperTux media/settings
pins matched. The retained module is recovered from
`20261118-lmarbles-connected-send-freshness-repair-puzzle8/tested.wasm.gz`:
SHA-256 `0d383140f6d4207d18860e3cb22fc8fcc47a5d260b8d5f2443222396b245fdd5`.
Its 251 runtime source pins matched before launch. The two requested November
14 route notes and the previous current-manual-platform-course refusal were
read; none of their outcomes is added to this task's counters.

The first original exited 1 before creating a usable scene: the shared native
supervisor had sealed the LMarbles manifest but omitted SuperTux's manifest.
That scope closed with zero DOWN and was never reopened. Commit `786dae2f8`
adds registered app manifests to the supervisor's source inventory. The
focused test executes a real sealed SuperTux manifest read and retains the
existing resolution/refusal controls. It and the required locked full build
passed; strict pull and push both returned 0. The build reproduced the retained
module; no new emulator-physics fix or changed game input was introduced.

The materially repaired `original-fixed/` used a new 1200-second runtime,
independently prearmed watchdog, real ticks and a 180-second Quit reserve.
Its inventory contains 252 inputs including the actual SuperTux manifest.
Early complete captures were black; after an actual startup wait, the
personally viewed `startup120.png` (126.151 seconds after launch) showed the ordinary title menu with Start
Game highlighted. The attempted native-scene bind returned an explicit
`reviewed native paint changed` refusal, `timedOut:false`. No input owner,
DOWN, movement or jump was created. A further title capture occurred before
the permanent local closure; **zero endpoint requests followed that closure**.
There was no bind retry, weakened guard, route replay or further original.

Cancellation is distinct from ordinary Quit. The repaired original's native,
watchdog and supervisor-child waits are 0 with both EOFs. The enclosing tool
returned 143; its additional outer wait and containment receipt are missing
and remain UNKNOWN. The module-holder finalizer and continuous disk sample
record are also absent; no completion or disk-compliance receipt is invented.
The recorded runtime PIDs were checked locally after shutdown without any
further endpoint request. Ordinary Quit, early-platform/pit crossing,
checkpoint and course progress are **unproved**.

The remaining gameplay blocker is native-scene admission of the personally
reviewed animated title, not insufficient disk at launch or a proved physics
defect. Storage still needs external capacity expansion or an owner-selected,
verified off-device archive if concurrent growth consumes this recovered
margin. The current root filesystem already spans the 75 GB virtual disk;
there is no in-guest partition expansion left to perform. No external action
was performed in this task.

The sealed runtime inventory is exact. Operational controller helpers were
live shared files; a relevant binary diff was captured before binding, but
their exact loaded bytes at the bind call were not fingerprinted. That
operational provenance limit is retained separately from the sealed guest
inventory, and no input-path qualification is inferred from the refused bind.

No workers, boxes, Python, Wine or deployment were used. Box ID null, state
`NOT_CREATED`, expiry null, stop receipt null. The worker releases ownership
and stops after sealing `result.json` last.
