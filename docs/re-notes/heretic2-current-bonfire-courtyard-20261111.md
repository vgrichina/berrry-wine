# Heretic II onward bonfire courtyard, 2026-11-11

Corvus now reaches a dry courtyard beyond the starting crate approach using
the original demo's movement and jump controls. The final settled view shows
him standing alive at **84 health** beside a bonfire and roasting spit, with
timber windows, red banners and another boarded stone opening ahead. This is
distinct from the furnished room and its flooded return loop documented in
[the canal exit handoff](heretic2-current-canal-exit-20261111.md).

Run: `scratch/runs/20261111-heretic2-native-crate-arch-onward-1140/` (ignored).
No production, guest, configuration, script, map or save edits were made.
No campaign objective completion or progress save is claimed.

## Route and decisive full images

Start through registered `heretic2_demo`, Game → Easy. Finish the intro with
native Space, then face the original lit arch across the pier. The retained
numbered captures and `*-long-review.json` / `*-long-result.json` files record
the complete sequence, including turns and actual trusted key releases.

All capture names below are in the run's `software2/` directory:

| Capture | Consequence |
| --- | --- |
| `pier-after.png`, `crate-close-after.png` | Two six-second forward holds reach the exterior crate before the original arch. |
| `crate-jump-after.png`, `crate-landed.png` | Six seconds forward + shipped `a` / moveup produces an elevated view. This view alone does **not** prove roof traversal. |
| `roof-forward-after.png`, `roof-ridge-after.png`, `ridge-settle.png` | Six seconds forward, then six seconds forward + `a`, followed by passive settling, leave Corvus on dry cobbles facing a timber wall. The capture labels retain the initial camera interpretation; they are not proof of a roof route. |
| `beyond-face-after.png`, `staff-return.png` | Turns reveal sickle humanoids; the latter full image shows two simultaneously. |
| `arch-combat-after.png` | One humanoid lies on the cobbles; another remains standing. |
| `arch-retreat-after.png` | A six-second backward hold leaves the closed boarded arch through a low timber passage. Native text says to walk into low ledges to climb them automatically. |
| `corridor-combat-after.png` | The standing pursuer is no longer visible; native caption: “My brethren are insane with bloodlust!” |
| `room-face-after.png` | Right turns of two and 3.5 seconds expose the dry courtyard's barrel, stacked crates and floating blue flask. |
| `doorway-face-after.png` | The wider view exposes the bonfire, red banners and second boarded opening. |
| `onward-landed.png` | After clearing small debris with forward + `a` and passively settling, Corvus stands beside the bonfire, alive at 84 health. |

The route bypasses the original crate approach without entering the known
water route. It does not establish passage through the wooden boards:
close Sword-staff attacks, Space/action and Flying Fist left those boards
intact. The early apparent rooftop images and the first gore burst were
insufficient to prove roof passage or defeat of every pursuer. Later full
views, rather than those initial interpretations, establish the courtyard.

The shipped `Base/default.cfg` supplies Ctrl/attack, `1`/Sword-staff,
`2`/Flying-fist, `a`/moveup and Space/action. The run-local controller also
admits the shipped semicolon/quickturn; its short trial did not visibly
establish a turn. Every input followed review of the current full image.
Longer holds were finite, released, and followed by a new full capture.

## Recovery and verification

Accepted source remains `0db20330ccd6761a705eea70c5dd9bfc7704c147`, with the
retained relevant binary patches. The recovered live guest and owning
software-renderer module is SHA-256
`ce57f0ad80254b974a0d8bcd4e2c9cbf396d2357cbdc7874e6084e980e1e68e1`
(2,189,363 bytes). Git plus patches preserves source; existing media paths
and SHA references preserve the canonical media without another source or
media archive. Small run-specific controller inputs have their own patch.

All 3,377 provisioned files passed remote size/SHA verification, and all
2,461 runtime pins still matched after gameplay. The matching existing
locked-build log was rehashed; eight balanced-key regression checks passed.
No new build or emulator repair is claimed. One provisioning continuation
corrected a changed run-local Python controller pin before launch; an early
read-only capture retrieval found startup not yet written. Neither failure
dispatched gameplay input or required an original relaunch.

All 426 artifact references / 336 unique contents were recovered and raw
size/SHA checked before box shutdown, independently rechecked, and verified
again after shutdown. Validation passes 61 unique PNG CRC/IDAT checks,
44 image/owner/module bindings, 44 numbered ACKs and 29 finite balanced direct
holds. `final-recovery-local-map.json` restores remote paths from the gzip
content store; local metadata compaction has a separate lossless map.

Browser, controller and parent wrappers exited zero with actual parent waits
and both EOFs. Independent checks find controller/Chrome PIDs, profile and
server port absent. Box `bx_r8dbqpb8` had a private fixed 45-minute lease,
with independent watchdog prearmed for 12:23:06 UTC. Normal stop
`stop_14b2eebc387069fa` completed at 11:57:38.258 UTC, forced=false,
error=null. A separate GET confirms archived, completed stop and expiry null.
The watchdog exited zero, unfired, with actual wait and EOFs.

Next: use this dry bonfire courtyard as the new checkpoint; investigate its
second boarded opening and stacked-crate pickup. The original arch boards
remain closed, and no objective completion is implied by the tutorial text.
