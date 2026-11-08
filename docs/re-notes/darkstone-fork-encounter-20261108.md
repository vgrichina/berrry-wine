# Darkstone: two Giant Wasp victories beyond the fork, 2026-11-08

One fresh original session reloaded the newly saved grassy fork, followed the
visible sandy route around the tree line, and reached a living **Giant Wasp**
encounter. Personally reviewed live counters advanced from **Victories 3+0 to
5+0**, with **LIFE 28/35 → 24/35**, **Gold 1532 unchanged**, MANA 25/25 and
Food 90 → 85. Native **Save a Game → New Save** preserved the earned result.
No pickup or area transition is claimed. Production code was unchanged; no new
concrete production defect was demonstrated.

Evidence is ignored `scratch/runs/20261108-darkstone-fork-encounter/` (R).
The predecessor is [the new-slot handoff](darkstone-new-slot-progress-20261108.md),
commit `12e1af819`. Its `recovered/original/native-vfs-saves.json` supplied the
untouched game-written inputs, checked before staging and again after execution:

| Input | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,092 | `dee39793c2f1a43bc5af205e428b9c604da1ba31d08e3e7f1fc4dddc9b6328ee` |
| `game641d_6af03b8e.sav` | 3,204,264 | `3ad043582acc9f02426ef5700693fd39331c9889cd732aeecd37b1bae0dfaa67` |

R/checkpoint-provenance.json records their source paths and original VFS paths.
Only these two files were appended through a run-local composed HTTP manifest;
registry and original media manifest were untouched. Ordinary manifest resolution,
merge/normalization, production `WineAssembly.loadFiles`, mounted hashes and native
`*.sav` enumeration passed locally before allocation. Original-session read-only
mounted recovery independently matched both hashes before native loading.

## Reviewed route and encounter

Native **Load a Game → sole selected onward slot → OK** restored Ardyl's grassy
fork beside a rock and trees. The selected preview was not counter proof.
R/review/restored-inventory-settled.png establishes actual live Gold 1532,
Victories 3+0, LIFE 28/35, MANA 25/25 and Food 90 after loading. Documented Space
closed the panel. Panels were never treated as pause.

Six individually reviewed native route holds, each at most 2,000 ms with UP
independently armed before DOWN, followed clear sandy ground around the trees.
Every next movement followed a personally reviewed settled view. The targets
were canvas `(0.82,0.36)`, `(0.83,0.72)`, `(0.25,0.74)`, `(0.32,0.79)`,
`(0.69,0.78)` and `(0.18,0.74)`. These selected visible route ground rather than
an unreviewed attack target. Before/action/settled PNGs and exact commands remain
in R/retrieval-verified.json's mapping.

A living winged insect appeared during traversal. The initially retrieved settled
frame showed a pale body, blood and recent damage; its appearance was initially
uncertain. Reviewing the retained action frames then established the **Giant Wasp**
caption, living insect and health bar in R/review/open-track-action.png.
R/review/encounter-inventory-settled.png showed actual **Victories 4+0,
LIFE 27/35, Food 87**. No targeted attack is claimed for this first encounter;
it arose during native movement/ordinary combat behavior between captures.

A second living wasp remained immediately above the warrior. LIFE fell to 26/35
while the panel was open, further demonstrating that it did not pause combat.
After closing the panel and retrieving a fresh world view, I personally reviewed
R/review/current-target-before.png. Only then was a bounded **1,000 ms native
left hold at canvas `(0.505,0.38)`** admitted against that visible wasp.
R/recovered/original/reviewed-wasp-action.png and
R/review/reviewed-wasp-settled.png show the Giant Wasp caption/health bar and combat.
Passive R/review/wasp-followthrough.png shows no remaining standing wasp/bar.
R/review/final-counters-settled.png establishes **Victories 5+0, LIFE 24/35,
Gold 1532, MANA 25/25, Food 85**. No healing, forced scene/clock/configuration,
guest-memory write, fabricated counter or input replay was used.

Selected media hashes (all paths relative to R):

| PNG | SHA-256 |
| --- | --- |
| `review/open-track-action.png` | `76ed12baba3988f75c6b0012eaa55951ac93fea0b0304d6ca4d9af41eaaf49b8` |
| `review/current-target-before.png` | `38adb62e0b010054ecc3a24e380ea622d657ab9d4a6bf8048e9448e3f7eab344` |
| `recovered/original/reviewed-wasp-action.png` | `0c0ffb51d3c57d9dd778927eef501f1f3875e985d356d3707532dc6173a71d58` |
| `review/wasp-followthrough.png` | `375cda6e487b5bc0a06b97a7ecfa8bfc3107604320410e9e6f79321051817279` |
| `review/final-counters-settled.png` | `e98c1171e188f5f4b7c593336c1452630b58a9230ebad91afe45001ab95d335b` |
| `review/saved-encounter-world.png` | `7d6c8ebddbb2fca36fa0e29d254e28ab7da86ef47de67f7420b9974c14df9a5c` |

## New native save and recovery

Native Escape, Save a Game and New Save wrote the following untouched outputs.
Read-only VFS recovery at **09:33:31.320 UTC** retained them before browser closure:

| Output | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,100 | `cad82ff5a0bfbd556db2d06fc078e2570ee1e3ae4d4efb884bd313e6550473bf` |
| `game641d_6af041d7.sav` | 3,204,264 | `d977d538fac58afd16d2fed4eff7e3fa1f50c2b1e14a74f9cf791309e6ad8372` |

R/recovered/original/native-vfs-saves.json maps native paths to hash-named `.bin`
artifacts in that directory. R/new-save-recovery.json gives exact local paths,
lengths, hashes and the recovery recipe. Verify both bytes, append them to the
run-local composed manifest at `c:\dsave\characters\characters.lpl` and
`c:\dsave\games\game641d_6af041d7.sav` with `loadMode:required` and
`httpRange:false`, then use ordinary HTTP/loadFiles, mounted-hash/wildcard checks,
and native Load a Game → the new slot → OK. Inspect actual counters after loading.
This newest slot has **not** been reloaded. The loaded onward `.sav` stayed
byte-identical. R/review/saved-encounter-inventory.png confirms 5+0/24/35/85 after
saving; R/review/saved-encounter-world.png shows the warrior beside the encounter.

## Runtime controls, evidence and shutdown

Runtime source was published main commit
`24913adc084472f8ac79b222520a0da4f2b45d81` (also recorded in
R/checkout-head.txt and R/runtime-pins.json). All **432 tracked runtime inputs**
matched that commit; peer WIP was excluded. All **527 staged input pins** matched
before and after execution. The executing guest/render module was
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`.
R/source-recovery.json records exact Git plus relevant binary diff and owned
helper patches; R/media-refs.json names existing media paths and hashes. No source
or media archive was made.

Current actual production guest/render Worker readiness, identity/staleness,
trusted native input and independently released delayed/rejected/pending ACK
controls passed under `/tmp/wine-runtime.lock`. Observed/unobserved actual x86
ExitProcess(37), distinct UD2 trap, registers/EIP/ESP/yield/blocks and renderer
retirement matched. Observer receiver/arguments/return/exception/once-only
transparency passed. Both local control browsers retired with exit 0 and profiles
removed. UNKNOWN remained sticky; no original input was replayed.

Two run-local preparation mistakes were caught before Chrome: an absolute helper
pin duplicated the root, then a predecessor composed-manifest hash was stale.
Both retained failures preceded the passing controls and sole original session.
The first immediate post-close custody assertion also failed without identifying
its predicate. A subsequent distinct read-only diagnostic and settled inventory
confirmed all owned PIDs/ports/profile/writer/input drained; its original failed
observation is retained, with no invented failure cause or guest replay.

The original had **37 exact successful ACKs**, **zero UNKNOWN commands**,
**18 independently released input pulses** and **47 trusted events** (11 balanced
mouse pairs, seven balanced key pairs and 11 moves). No original guest process
exit, trapped terminal slice, Runtime exception or target crash was observed.
Explicit finish-run requested ordinary Browser.close at **09:33:51.741 UTC**;
the registered app was still running immediately before closure. Chrome exited
**0 / no signal at 09:33:53.255**. This supplies no cause for any historical exit.

All **382 remote artifact references / 29,289,592 bytes**, comprising **308 unique
contents / 29,274,037 bytes**, were retrieved and independently SHA-256 verified
before normal stop. R/final-audit.json passes 37 PNG CRC/scanline decodes, exact
ACKs, trusted balanced events, input releases, save hashes, helper syntax and
owned containment. Darkstone remains unregistered in the candidate corpus;
R/investigation-result.json attaches to no unrelated candidate.

Sole box **bx_ppqd8ukq** was created **09:23:44 UTC**, initial expiry
**09:49:44.221**. Detached normal-stop and independent 25-minute watchdog children
were observable before allocation. Watchdog deadline was **09:48:44.381**, browser
deadline **09:46:43.962**. After verified retrieval and cleanup, normal stop
**stop_f0897dcd589f2a26** completed **09:35:45.820**, `forced:false`, error null.
Final state is **archived**, stopped **09:35:45.793**, expiry null; the final
completed receipt is R/stop-receipt.json. Both lifecycle children exited 0 and
the supervisor has no remaining children. No old box resume/delete, public
deployment or subworker was used. Disk stayed above the required 1.5 GB floor.

Only this note is committed. Next useful work is reloading the newly earned
5+0 slot and reviewing the next route/encounter. Full27, parity, audio and FPS
remain open.
