# LTris recovered-original gameplay, 2026-11-14

The requested consequence remains **unproved**. One registered `ltris_128` process showed a personally reviewed cyan J rotation and a red square settling after manual leftward movement. No native line disappeared; the observed lines and score remained zero. Native Quit was not reached. Ordinary host shutdown returned 0 after 842.108 seconds. This is a failed bounded gameplay attempt, not an acceptance of line clear or native Quit.

The immutable predecessor report at `52602f5296286b4fc84726edd843f9020f96a31e` was read, and its 13 evidence artifacts were hash checked without alteration or reuse as new proof. The accepted 2026-10-18 lateral-movement proof and registration/source documents remain unchanged.

## Authorized recovery

Exactly one normal HTTPS fetch chain acquired `https://downloads.sourceforge.net/project/lgames/ltris/ltris-1.2.8-win32.zip`, with one ordinary official redirect to `master.dl.sourceforge.net`, inherited proxy, certificate verification, no retries, 20-second connect and 90-second total bounds, and a 2,379,795-byte size cap. There was no alternate provider, mirror selection, credential change, denial retry, or bypass.

The ZIP is retained outside evidence at `test/binaries/media/ltris-original-20261114/ltris-1.2.8-win32.zip`: **2,379,795 bytes**, SHA-256 `b64a817fd4031e5f3e0b31bad546b0876ac62ef6c6384eae396b2de127718622`. Its exact original tree is the sibling `ltris-1.2.8/`. Before extraction, every archive path was checked for containment, traversal, duplicates, special files and symlinks. ZIP CRC and byte-for-byte extracted member comparisons passed for all **40 files / 7,361,674 bytes**. The published sorted inventory digest matched `3478f9e208874423e61983d0a90df02d1cde36ca85ea2ef9628c79fe68181149`.

`tools/verify-ltris-128.js` verified the original, prepared a fresh `test/binaries/candidates/ltris-128`, and verified its executable plus 39 companions and authentic CRT. The CRT SHA-256 is `887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`. Post-run original and fixture verification also passed. The original README, COPYING, windowed launcher, documented controls and native player bindings were read before play. Recovery can be reproduced from the pinned ZIP using the published verifier's `--original` and `--prepare` modes; the run records their exact arguments and inventory. No media or source archive was copied into evidence.

## Reviewed play and missing consequence

The entire native window was visible within a 1024×768 canvas. The full initial scene was submitted and reviewed before the first permanent guarded bind. The original registered launch retained `-w`, its cwd, original files and CRT; it used real ticks, default batch size 1000, one fixed 1200-second process deadline, an independently observable prearmed watchdog, and an immutable final 180-second Quit reserve. Heavy work followed SuperTux terminal/release and GTA2's recorded terminal software failure plus explicit withholding of its WebGL arm; no second GTA2 execution or second EOF was invented.

Within that single process, two human Normal boards and one human Training board were started through native UI. These were board restarts, not process/deadline restarts. No CPU or demo mode was started. No config, board, piece, clock or score bytes were edited; no solver, autoplay or capture-selected delivery was used.

Selected personally reviewed images under `scratch/runs/20261114-ltris-recovered-line-clear/original/` establish the following:

- `b1.png`, `b3.png`, `b5.png`: the second Normal board's red square moved from its starting column to the left edge following a manually chosen Left pulse, then settled at bottom left; Pieces Placed advanced from 0 to 1. An End pulse occurred, but these pixels do not distinguish hard drop from natural gravity.
- `b5.png` and `b7.png`: the same cyan J changed from horizontal with a right-hand foot to a vertical stem after the separately reviewed Up pulse. Pieces Placed remained 1, establishing a non-square rotation despite the intervening gravity movement. A later stale Left intent was refused; cyan placement is not claimed from its ACK or from the refused move.
- `q1.png` and `b21.png`: the two Normal boards reached native Game Over at 11 and 16 pieces respectively, with lines 0 and score 0.
- `mode-seven.png`: native Training was selected manually; its native help describes disabling gravity. An End pulse was attempted, but disabling gravity was not established. `tr13.png` shows Training Game Over with lines 0 and score 0.
- `quit-back-selected.png` and `final.png`: Back was selected in native New Game. This is not the native Quit item.

Native Pause was visibly reached during the first board; no guest-clock pause or force-render was used. No square rotation, completed line or score increase is inferred from input receipts.

Quit became irreversible 760.266 seconds after launch, before the 1020-second gameplay cutoff. The frozen controller allowed menu navigation but omitted an Enter-on-Back route. Its Enter routes required an actually reviewed Quit item. With Back visibly selected, I recorded this own-controller policy omission instead of falsely labeling Back as Quit, modifying the frozen policy, rebinding or bypassing it. Gameplay remained closed. Ordinary host shutdown then ended the process. This is an incomplete helper policy, not a reproduced public emulator/input/render bug.

## Validation and lifecycle

Eight policy tests, twelve refusal/terminal tests and eight production transport tests passed. Production tests exercised real CLI delivery, late/dropped ACK closure, slow fsync, pipe EOF, parent kill, an independent 1750 ms fallback and the 1500 ms maximum pulse. The locked full build passed before original play. These checks did **not** cover the missing Enter-on-Back Quit route; their success does not establish controller completeness.

The gameplay audit records 38 consumed finite gestures, nine `NOT_SENT` refusals, unique nonces, acknowledged independent releases and actual release-child waits with both EOFs. Maximum consumed scene age was 4.903 seconds for play and 23.242 seconds for menu/Quit. All partial, mixed and UNKNOWN transport states remained closed under tested policy. No intent was replayed.

The tested source base was `3115c772587003b3d34f5b065838ba26b1247a42`; exact relevant uncommitted hunks and owned new files are preserved as Git patches. All 1,652 tested file pins were unchanged at postflight. The launched module was 2,200,987 bytes, SHA-256 `c94ccf1b179f18bd4b47867445afed8cef2f1393b19aabfd259c7f3b94a7be09`. Shared released Quake2, Forsaken and Airstrike helpers were read only. No public runtime source fix is asserted.

Native PID 3867128, watchdog 3867127, supervisor child 3867111 and outer 3867110 each had actual exit-0 waits and both output EOFs. The watchdog exited because of the actual native wait and did not fire. The heavy lock was released, port 8577 closed, and recorded processes disappeared. Postflight free space on `/home` exceeded 12 GB. No box was created: ID none, state `NOT_CREATED`, expiry none, stop receipt not applicable. No deployment occurred.

`result.json` names the 15 retained PNGs and supporting evidence. Unselected captures were removed; there is no frame series, media copy, module copy or source archive in the run. Artifact hashes and PNG CRC/inflate checks are recorded. The repository-wide evidence checker returned 1 with 25 errors, 2,635 missing references and 437 invalid records in other runs. This run had zero errors, missing references or invalid fields; foreign evidence was untouched.

Only this report is committed. The tested own controller, guard and tests remain uncommitted WIP with exact evidence patches; the missing Quit route prevents treating that helper closure as ready for reuse. A future separately authorized attempt needs a complete reviewed Quit route and better personally chosen placements. No further original run was started or scheduled by this worker. No full-27, browser, audio or FPS claim is made.
