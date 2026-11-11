# Heretic II courtyard pickups and vestibule gate activation, 2026-11-11

The next follow-up **activated the vestibule wall panel and raised the inner
timber gate** using the shipped Space/Action control. The decisive difference
was reaching the panel face, releasing the approach keys, and making a fresh
Action press. Passing through the raised gate and completing an objective
remain unproved.

Run: `scratch/runs/20261111-heretic2-vestibule-device-onward-1240/` (ignored).
The final fresh original Game → Easy attempt used the same canonical media,
accepted source `0db20330ccd6761a705eea70c5dd9bfc7704c147` and module
`ce57f0ad80254b974a0d8bcd4e2c9cbf396d2357cbdc7874e6084e980e1e68e1`.
No shared code, guest, map, script, save or configuration edits were made.

## Confirmed inner gate activation

All three decisive full images are under the follow-up run's `software2/`:

| Capture | Established result |
| --- | --- |
| `fresh-vestibule-after.png` | Corvus reaches the panel face beyond the second opening; native caption: “Press ACTION to use buttons and levers.” The inner gate still extends to the floor. |
| `fresh-device-action-after.png` | After release of the approach keys, a fresh 1,500 ms Space hold raises the gate. Its pointed lower edge is now visibly above the floor, leaving an opening beneath it. A pursuer partly obscures Corvus and the panel. |
| `fresh-gate-turn-after.png` | The subsequent right-turn/attack ends at the native Load Game menu, showing “ENTERING” and “Silverspring Docks.” No crossing of the inner gate is established. This menu entry was neither loaded nor exported. |

The successful fresh route uses the starting crate/jump approach to the dry
timber corner, a right turn to follow the wall, then a left turn through the low
passage. Forward movement with Flying-fist fire reaches the courtyard. From
left of the blocking barrel, turn right toward the second opening; six seconds
of forward + attack + jump + Action reaches the panel. **Release, then press
Space again at the panel.** Exact finite holds and full-image reviews are in
the run's numbered requests and `*-long-review.json` files. The earlier run's
courtyard pickups are not prerequisites established by this attempt: they were
not repeated on the successful fresh launch.

Earlier attempts in this run ended in combat deaths. A later native Easy
restart exited the guest before its next input; the controller then closed on
its isolated-app identity check. All evidence was retained, and process/profile/
port absence plus actual parent waits were confirmed before the fresh launch.
An initial pre-game Chrome permission failure was also preserved; provisioning
verification subsequently set the executable permissions before launch.

The matching locked-build proof was rehashed; eight balanced-key helper checks,
all 3,377 provisioned file pins and both postgame checks of 2,461 runtime pins
passed. Recovery preserves 674 final artifact references / 524 unique contents,
with raw size/SHA verification before stop and independent rechecks afterward.
Validation passes 73 unique PNG CRC/IDAT checks, 63 image bindings, 62 exact
numbered ACKs and 34 finite balanced direct holds. Git, relevant patches,
run-input patches and original media path/SHA references preserve recovery
without a source-tree or repeated-media archive.

Final browser/controller and parent wrappers exited zero with actual waits and
both EOFs; independent checks find their PIDs, profile and port absent. Private
box `bx_naz2px8k` had a fixed 45-minute deadline of 13:22 UTC with an independent
watchdog prearmed. Normal stop `stop_1331aff73ff76431` completed at
13:03:42.061 UTC, forced=false, error=null. A separate GET confirms archived,
completed stop and expiry null; the watchdog exited zero, unfired, with actual
wait and both EOFs.

Next: repeat the fresh panel press, manage the pursuers, and cross beneath the
raised gate. Gate activation is established; onward traversal, objective
completion and a retained progress save are not.

The remainder records the preceding pickup and courtyard-route runs.

The follow-up run **collected both courtyard stack items** and entered the
stone vestibule beyond the second opening. Native captions identify the items
as **“Defensive mana, small.”** and **“HEALTH VIAL.”** Both disappear from the
stack after collection. These captions, rather than an inferred health-meter
value, establish the pickups. The original boarded arch remains unpassed.

Follow-up run:
`scratch/runs/20261111-heretic2-bonfire-courtyard-pickup-onward-1205/` (ignored).

## Confirmed pickups and second opening

The fresh original `heretic2_demo` Game → Easy route repeats the starting
crate approach, lands at the dry timber corner, then follows the wall to the
low passage. Strafing along the blood-marked timber wall centers that passage;
forward holds reach the bonfire courtyard. The stacked crates are on the left
when approaching the fire through the passage.

The shipped `Readme.htm` explicitly describes moving/jumping to a ledge and
using Action. `Base/default.cfg` binds `a` to jump and Space to Action.
The useful maneuver is **forward + `a` + Space from the center of the lower
crate face**, with actual releases and a new full view afterward. Approaching
the left edge earlier carried Corvus past the stack without collecting it.

Decisive follow-up full captures, all under `software2/`:

| Capture | Established result |
| --- | --- |
| `flask-face-after.png` | Blue flask and green ring still present above the stack; the earlier jump did not collect them. |
| `hop-landed.png`, `close-defense-after.png` | Ground approach and improved alignment at the lower crate face. Two sickle pursuers remain active. |
| `centered-grab-after.png` | Four-second forward + `a` + Space leaves Corvus on the upper crate; native “Defensive mana, small.” caption, green ring collected. |
| `top-flask-step-after.png` | A 700 ms forward step collects the blue flask; native “HEALTH VIAL.” caption, vial absent. |
| `game-save-inspect.png` | In-session Game menu exposes difficulty, maps, objectives and credits, with no Save/Load entry. No native save was exposed or retained. |
| `second-arch-landed.png` | Close view of the second opening reveals timber rails on either side and a central gap. |
| `second-arch-use-after.png`, `vestibule-device-after.png` | Forward + Action passes through that central gap into a lit stone vestibule, with a red circular-symbol wall device and another timber barrier. |
| `device-action-after.png`, `objective-ready.png` | Device Action causes no visible gate movement; pursuers follow into the vestibule. No objective completion is established. |

The rails remain intact. Passage through their existing central gap is
established by the interior views; breaking boards, crossing a roof, opening
the inner gate and completing a campaign objective are not claimed.

The follow-up reused source `0db20330ccd6761a705eea70c5dd9bfc7704c147` and
module `ce57f0ad80254b974a0d8bcd4e2c9cbf396d2357cbdc7874e6084e980e1e68e1`.
The matching locked-build proof was rehashed, eight balanced-key checks passed,
all 3,377 provisioned files passed size/SHA verification, and all 2,461 runtime
pins matched after gameplay. No shared code repair or new build was needed.

All 621 artifact references / 481 unique contents were recovered and verified
before stop, independently rehashed, and verified again after stop. Validation
passes 74 unique PNG CRC/IDAT checks, 68 image/owner/module bindings,
68 numbered ACKs and 46 finite balanced direct holds. Full current images were
reviewed before inputs. Git and retained patches, original media path/SHA
references, and lossless recovery maps preserve the tested inputs without
another source or media archive. Initial provisioning hit an upload timeout;
a remote hash inventory allowed continuation before any game launch. Early
startup reads and an early process-absence check preceded completion; later
checks establish startup and actual normal exit, without input replay.

Browser/controller and parent wrappers exited zero with actual waits and both
EOFs. Independent checks find their PIDs, browser profile and server port
absent. Private box `bx_39h3ezvt` had a fixed 45-minute lease with an observable
independent watchdog prearmed for 12:48:18 UTC. Delegated normal stop
`stop_759609b3337b90d9` completed at 12:32:27.626 UTC, forced=false,
error=null. An independent GET confirms archived/completed with expiry null;
the watchdog exited zero, unfired, with actual wait and EOFs.

Next: investigate the vestibule's circular-symbol wall device and inner timber
barrier. The pickups and central-gap passage are established; gate activation,
objective completion and a native save remain unproved.

The remainder below preserves the parent run's route and recovery record.

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

The follow-up above supersedes this parent run's next-step recommendation.
The original arch boards remain closed, and no objective completion is implied
by the tutorial text.
