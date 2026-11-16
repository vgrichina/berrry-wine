# LMarbles threaded desktop startup repair, 2026-11-16

**The actual startup failure is fixed. The single changed-code original reached
Normal / Original / Tier 1 Puzzle 8, but did not clear it.** The new terminal
blocker was an independent UP acknowledgement 69 ms beyond the immutable
operation deadline. No later endpoint request, rebind, replay or original launch
was made. Ordinary native Quit, tally and Puzzle9 were not achieved.

Evidence is `scratch/runs/20261116-lmarbles-threaded-desktop-startup-repair/result.json`.
The previous original and its endpoint were never relaunched or contacted.

## Causal comparison

All native comparisons used published Git
`6f6289091fdfeab5de8868b9d2d60506386a6af1`, owned overlays, and the independently
compiled canonical module
`61a7d750c83c62ecbbe6e2388136d6a34d152f5782cb58b0338aea2a8528cc2b`.
Compilation used `compileClosure(watxSourceClosure(), {tailCalls:true})` and the
canonical region-layout section in an owned sealed memfd. No shared build output
was read for these runs. Git and binary patches are the recovery archive; no
source tree, media copy or module archive was persisted.

A finite native Solitaire launch with `--threads`, real ticks and the same full
frozen Git source pool reproduced the constructor `hello` ETIMEDOUT. Authority
readiness returned at about1951 ms. The client was created at1952 ms and had not
reached its first passive trace identity when the fixed3000 ms receive expired.
Native actually waited1 with both pipe EOFs. This was a fixture, not another
original launch.

The source pool was about288 MB of JSON/base64, containing8569 Git files before
owned overlays and runtime package additions. The old preloader read, parsed,
decoded and SHA-verified the whole pool in each Node Worker, including files the
Worker never used. A separate finite ProcessDesktop reference took122 ms without
the preloader versus5280 ms with the full pool; that latter run passed, with
Worker startup taking about2330/1376 ms. That comparison alone did not prove a
failure. The native failure plus the matched fixed native run establish a
material contribution from repeated full-pool initialization. They do not
separate JSON parsing, base64 decoding, hashing, GC and scheduling costs.

The supervisor now verifies the complete source inventory once before sealing
an indexed container. Every Worker verifies the pinned index and independently
SHA-verifies every source body it actually reads, using positional reads and a
local cache. Module bytes are verified when requested. All source entries remain
available; no Worker or runtime dependency is omitted. Missing source fails
closed. The transport timeout, guards and source isolation are not relaxed.

With the same source inventory and module, the finite threaded native Solitaire
run exited0. Passive authority/client identities appeared at about187/364 ms.
An independently generated finite PE then created two actual guest Workers,
served brokered imports, completed public Sleep/wait/return paths and exited0.
Its real native window was titled `Finite threaded desktop startup fixture`.
`dependency-closure.json` records each source path/hash read by all five Node
contexts for that fixture and the original, checked against their complete
frozen inventories. These source access logs contain no guest board state.

This worker made no change to `lib/process-desktop.js`; the existing readiness
predicate loop was preserved. A coordinator's later constructor cleanup WIP was
excluded from the frozen native runtimes.

## Qualification and changed original

Three cold real authority/client handshakes passed. Negative controls reject a
missing source, tampered source body, bad index pin and tampered module, including
sync, async, promise and stream source reads. The native first-selection test
continues to use authentic SDL and the exact original86-file SHA verifier, with
seven manifest corruption controls. Its strict controller fixture now launches
with `--threads`; it passed finite DOWN, independent UP, irreversible300-second
Quit reserve and actual native/watchdog/supervisor waits. Eleven historical
reserve/lifecycle tests and five completion-budget tests passed.

The single new original used its own port45931, immutable descriptors and PIDs.
The supervisor recorded3600 native seconds,3620 independent watchdog seconds and
300 Quit-reserve seconds before launch. Confirmation500 ms, physical UP1750 ms,
observation3000 ms and whole-scene freshness5 seconds in game/30 seconds in menus
were retained. Real ticks and both guest Workers were observed. The native
module was unchanged; source startup code was materially changed.

The whole fresh main menu, Normal/Original setup, chapter1 level8 confirmation
and Puzzle8 Moves96 scene were personally reviewed. All intentions were selected
manually from visible scenes. No solver, OCR, tile map, private board state,
guest clock inspection, configuration/save/EXE edit, imported route or reset was
used. The last observed completed board showed Moves89. Several stale reviews
were rejected as NOT_SENT before arm/DOWN; each subsequent attempt used a new
capture and new intention, with no endpoint replay.

The final `sg1` selection was consumed at1794825595.682. Independent physical UP
was acknowledged at1794825595.8724313, about190 ms later, but its operation
deadline was1794825595.8038123. The review-freshness cap had left insufficient
remaining operation time. The controller permanently latched
`independent UP not acknowledged in window`. No post-UP observation or further
endpoint request followed. This is a distinct controller admission/deadline
blocker, not a recurrence of desktop startup failure. A local cancellation file
requested owned host shutdown. Native exit0 under that cleanup is not an
ordinary game Quit claim.

## Evidence limitations and closure

One budget-test run found a real endpoint-publication race: file existence was
observed before its JSON write finished. The test now polls for complete JSON.
The failed run's temporary directory cleanup lost parent waits; its40-second
native fixture self-limit and later owned orphan-watchdog TERM are recorded
without inventing actual waits. All four known failed-chain PIDs were checked
absent. A fresh corrected budget fixture passed with complete actual waits.

The first two source/module holders closed normally and their invoking tools
waited0. The final holder's invoking tool returned143 and there is no normal
holder-close receipt; its PID/descriptors are absent. Native launch inputs had
already been copied, verified and resealed into their own descriptors before
that holder disappeared. Native, watchdog and supervisor waits for the original
are complete with both EOFs. This holder limitation is retained separately.

The original86 media mappings and authentic CRT were verified again after the
run; source/module pins and owned new-file patches are in evidence. Only named
selected whole-scene images are retained. No box was created: ID null, state
NOT_CREATED, expiry null, stop receipt N/A.

The required canonical full-flock build passed; actual waits and both EOFs are
recorded in `build/`. It covers the
shared tree; unrelated WIP is not adopted into this repair or its frozen native
runtime. Next work would need a separate authorization and a controller
admission repair that reserves enough of the unchanged freshness window before
DOWN. This endpoint remains permanently closed.
