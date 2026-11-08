# Darkstone: beyond the wasps to the birch clearing and Skeleton, 2026-11-08

One fresh original session restored the earned **5+0** save, followed nine
individually reviewed native route moves to a round birch clearing and its
western forest-edge junction, and fought a visible **Skeleton**. Actual live
counters advanced to **Victories 6+0**, with **LIFE 24/35**, **Gold 1532** and
**MANA 25/25** unchanged; Food fell **85 → 82**. Native **New Save** preserved
the result. No NPC, pickup or area transition is claimed. Production code was
unchanged.

Evidence is ignored `scratch/runs/20261108-darkstone-onward-route/` (R).
The predecessor is [the two-wasp encounter](darkstone-fork-encounter-20261108.md),
commit `f720f9526`.

## Exact native restore

Read the predecessor's note, `new-save-recovery.json` and
`recovered/original/native-vfs-saves.json`. These untouched game-written inputs
passed length/hash checks before allocation and remained unchanged afterward:

| Input | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,100 | `cad82ff5a0bfbd556db2d06fc078e2570ee1e3ae4d4efb884bd313e6550473bf` |
| `game641d_6af041d7.sav` | 3,204,264 | `d977d538fac58afd16d2fed4eff7e3fa1f50c2b1e14a74f9cf791309e6ad8372` |

Run-local manifest composition appended only these two files at their original
`c:\dsave` paths, with `loadMode:required` and `httpRange:false`. Ordinary HTTP
resolution, production manifest merge/normalization, `WineAssembly.loadFiles`,
mounted hashes and native `*.sav` enumeration passed before allocation.
Read-only mounted recovery in the original independently matched both hashes.
No registry or original media manifest was changed.

Native **Load a Game → selected sole slot → OK** restored the wasp location.
R/review/earned-counters-settled.png proves actual **5+0 / LIFE 24/35 /
Gold 1532 / MANA 25/25 / Food 85** after loading; the slot preview was not proof.

One inspection key was issued before loading visibly finished. Its review text
incorrectly described the predecessor world while its actual referenced image
still showed the loading screen. R/review-correction.json explicitly corrects
that record and retains the original command. No movement or attack was issued
against that image. A fresh settled world was personally reviewed before the
distinct live-counter inspection and all subsequent movement. No UNKNOWN input
was retried.

## Reviewed onward consequence

After closing the nonpausing inventory panel with Space, nine native ground
holds followed the sandy route around the trees. Each next target followed
personal inspection of the retained current PNG. Holds were 1,800 ms for the
first move and 2,000 ms for the remaining eight, with UP armed independently
before DOWN. Canvas targets, in order, were `(0.43,0.31)`, `(0.48,0.28)`,
`(0.32,0.24)`, `(0.26,0.25)`, `(0.63,0.32)`, `(0.15,0.72)`, `(0.12,0.65)`,
`(0.08,0.62)` and `(0.12,0.39)`.

The old wasp site disappeared from view. A broad sandy bend led to a junction
and a round sandy clearing enclosed by trees, with a thin pale/yellow-leaved
birch. The tree wall ended that spur; the reviewed lower/western sandy edge
continued to another forest corner. Passive settling captures account for
delayed visible movement; no panel was treated as pause.

R/review/western-corner-after.png shows a standing skeletal humanoid immediately
left of the warrior. Only after reviewing it was a native 1,200 ms left hold
admitted against that visible target. The next view showed it lower-right;
a separately reviewed 1,600 ms hold targeted its current position. No hit is
inferred for the first click. R/review/skeleton-current-target-after.png shows
the native **Skeleton** caption, standing combatant and health bar.
R/review/skeleton-followthrough.png shows no remaining standing skeleton/bar.
R/review/onward-counters.png and R/review/saved-onward-counters.png establish
actual **6+0 / LIFE 24/35 / Gold 1532 / MANA 25/25 / Food 82**.

R/onward-review.json records reviewed landmarks, counters and screenshot hashes.
Selected evidence (relative to R):

| PNG | SHA-256 |
| --- | --- |
| `review/earned-counters-settled.png` | `88ee78ff257af7d0926371f8cbf7471cecc8ce109f9d83f5e4bea229dd70535e` |
| `review/clearing-edge-settled.png` | `262b62f47abe7874992183963b460def0fa4d2e62752f588160d94e8fe3cc737` |
| `review/skeleton-current-target-after.png` | `51356d3469f8c82ff8e5d83b53cc3d0d3195992479befacd9b5fe8bbbac2a742` |
| `review/saved-onward-counters.png` | `3c1ec3d683ff2838b31db374405462e001a7448fc4a013d22f7f21119ad8d272` |

## Preserved new save and recovery

Native **Escape → Save a Game → New Save** returned to the western forest
junction. Read-only VFS recovery at **10:12:48.487 UTC** retained:

| Output | Bytes | SHA-256 |
| --- | ---: | --- |
| `characters.lpl` | 1,342,108 | `831e55267057ae86a6a912f4b3d0cdf13acbc3043c7bb6a8143345d30c3a8897` |
| `game641d_6af04b03.sav` | 3,204,264 | `813fe884e6cb27d9065fb28cb48945fbf78494d9d366c298b3df598cc5850bdc` |

R/new-save-recovery.json gives exact local artifact paths, sizes, native paths,
hashes and the recovery recipe. R/recovered/original/native-vfs-saves.json maps
them to hash-named `.bin` files. Verify both outputs, append them through the
ordinary composed manifest/HTTP/loadFiles/VFS path above, then native Load a
Game → new slot → OK and inspect actual counters. This newest slot has **not**
been reloaded. The loaded five-victory `.sav` stayed byte-identical.

## Runtime identity, validation and shutdown

Runtime source was published main
`0ae13bf34462d2a0f6ee5f08b2e7c3158e113269`. All **432 tracked runtime inputs**
matched that commit; all **527 staged pins** matched before and after execution.
Peer WIP was excluded. The executing guest/render module was
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`.
R/source-recovery.json records exact Git, relevant binary diff and small owned
helper patches. R/media-refs.json names **16 existing media paths/hashes**.
No source tree or media archive was made.

The reused current production actual-Worker readiness, exact identity/staleness,
trusted native input, sticky UNKNOWN and independent release controls passed
locally under `/tmp/wine-runtime.lock`. Observed/unobserved actual x86
ExitProcess(37), distinct UD2 trap, registers/EIP/ESP/yield/blocks and renderer
retirement matched. Observer transparency passed. Both local control browsers
exited 0, profiles/PIDs drained and the runtime lock released before remote
execution. Allocation waited while a peer held the local lock; no peer process
or file was changed. Run-local preparation path/pin corrections were completed
before Chrome/allocation and are recorded in R/preflight-corrections.json.

The original had **31 exact successful ACKs**, **zero UNKNOWN commands**,
**22 independently released pulses** and **59 trusted events**: 15 balanced
mouse pairs, seven balanced key pairs and 15 moves. No original guest-process
exit, trapped terminal slice, Runtime exception or target crash was observed.
Explicit finish-run requested ordinary Browser.close; Chrome exited
**0 / no signal at 10:13:20.976 UTC**. No historical exit cause is inferred.

All **346 remote references / 26,942,500 bytes**, comprising **284 unique
contents / 26,927,387 bytes**, were retrieved and independently SHA-256 verified
before stop. Own PIDs, ports, browser profile, writer and held inputs drained.
R/final-audit.json passes 31 PNG CRC/scanline decodes, exact ACKs, trusted balanced
events, releases, save preservation and helper syntax. Own artifact containment
passes; the global checker retains seven unrelated preexisting containment
errors. Darkstone is unregistered in the candidate corpus, so
R/investigation-result.json attaches to no unrelated candidate.

Sole fresh UUID-idempotent box **bx_vs46ym54** was created **10:01:21 UTC**,
original expiry **10:27:21.179**. Observable detached normal-stop and independent
25-minute watchdog children were armed before allocation; watchdog deadline
was **10:26:21.316**, browser deadline **10:24:21.016**.
After verified retrieval and drain, normal stop **stop_367d99aada456388**
completed **10:14:24.516**, `forced:false`, error null. Final state is
**archived**, stopped **10:14:24.496**, expiry null. R/stop-receipt.json retains
the receipt. Both lifecycle children exited 0 and the supervisor has no children.
No old box resume/delete, public deployment, subworker or guest-memory write
was used. Launch disk exceeded 5 GB and stayed above the required floor.

Only this note is committed. Next useful work is restoring the new six-victory
slot and following the western junction toward a further named destination.
Full27, parity, audio and FPS remain open.
