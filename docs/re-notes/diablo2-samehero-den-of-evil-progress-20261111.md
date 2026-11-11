# SAMEHERO accepts Den of Evil and retains a Blood Moor save

Run: `scratch/runs/20261111-diablo2-samehero-den-of-evil-progress-1155/`.
This continues the [native combat/save/load checkpoint](diablo2-same-character-combat-save-load-20261111.md).

The four authentic parent save files were hash-checked, served as ordinary
launcher `app.files` URL/VFS mounts, and selected through native Single Player
Load. The character panel confirmed SAMEHERO, level 1 Barbarian, XP 66,
life 46/66 before continuing. No save editing, generated save, guest memory
write, or guest script/state mutation was used.

Native conversation with Akara activated **Den of Evil**: “Look for the Den in
the wilderness outside the Rogues’ Camp.” Akara also healed SAMEHERO to 66/66.
`review/activequest.png` shows the accepted objective. Native Save & Exit and
normal Load retained the healed character stats (`review/retainedstats.png`).
`review/retainedquest.png` has the quest panel closed, so post-load quest-panel
verification remains pending. The quest checkpoint was
then exported, mounted in a fresh confirmed-exit relaunch, and loaded normally;
`review/thirdstats.png` again shows SAMEHERO, level 1 Barbarian, XP 66, life 66/66.

The next traversal reached **Entering The Blood Moor** (`review/bloodmoor.png`).
Following the rock boundary did not find a cave entrance or produce new combat
before the fixed lease required recovery. Native Save & Exit returned to the
title (`review/finalsaved.png`); the final read-only exporter recovered all four
game-written files. The final save was not loaded again. The earlier quest
checkpoint has both normal Load and fresh-launch restoration evidence.

## Retained saves and next route

Use `final-save-manifest.json` and the four files in `final-save/` in the run.
Their native VFS targets remain `c:\save\samehero.{d2s,key,map,ma0}`. The final
813-byte D2S SHA-256 is
`2594b7a4259f2f142dfe95d257cef53e95841064d772d58ee363cc20b2ed0e51`.
The MA0 grew from 106 to 5156 bytes during exploration. `quest-save/` and
`quest-save-manifest.json` retain the separately loaded quest checkpoint;
its D2S hash is `2bbad939cccd6b679c58b40d02eceaafa8f581f6dc5c0a8abf0d87369412ad20`.
All save bytes and raw exporter JSON remain outside Git.

Next: mount the final authentic files through the same ordinary launcher route,
native Load, verify SAMEHERO and the quest panel, leave camp for the Blood Moor,
and search the boundary for the Den. The waypoint enclosure and town's eastern
tents were detours; the successful exit followed the outer wall northwest.
Do not infer that world position survives Load: the verified earlier load
returned to camp. Use Tab for the shipped map and Q for the native quest panel.

## Controls, validation, and recovery

The runtime reused canonical `diablo2_demo` media, source
`0db20330ccd6761a705eea70c5dd9bfc7704c147`, and module SHA-256
`ce57f0ad80254b974a0d8bcd4e2c9cbf396d2357cbdc7874e6084e980e1e68e1`.
`reuse.json` records media paths/hashes; `source-identity.json`, Git binary
patches, and `owned-harness.patch` preserve source recovery without source-tree
archives. The reused locked build proof was rehashed (`build-rehash.json`).
There were no shared production changes and no new locked build.

The composed command/schema regression and native exporter regression passed
before runtime and again before relaunch. Every admitted input used a reviewed
full current image, finite input with actual release, and passive settling.
Stale inputs were refused before effects; no unknown command was replayed.
The initial provision missed `worker-observe.js`; startup exited with code 1
before gameplay, was independently confirmed absent, and the pinned observer
was supplied. A later clean relaunch increased only the scratch review-age
window from 12 to 45 seconds because capture/identity work caused frequent
pre-dispatch refusals. Gameplay screenshots still received individual review.

`evidence-audit.json` validates PNG CRC/IDAT and the final runtime's 30 command
ACKs, 24 reviewed admitted inputs, and 67 balanced trusted events.
`checkpoint-input-audit.json` validates the earlier runtime's 84 ACKs,
53 reviewed admitted inputs, and 138 balanced trusted events. No hardware GPU
claim: the browser used WebGL2 through ANGLE SwiftShader.

Before stopping, all 1202 remote file references (55,671,419 logical bytes)
were retrieved, locally SHA-checked, and independently remotely rehashed;
`recovery-map.json` is the lossless path/hash map. No runtime pins changed.
Both successful browser/controller sessions exited normally, with actual
parent wait and stdout/stderr EOF; final recovery found no remaining browser
processes. The independent prearmed watchdog exited unfired, code 0, with
actual parent wait/EOF.

Private box `bx_jwnhtwxx` was normally stopped at **12:33:09Z**, before its
**12:36:40Z** expiry. Stop `stop_bdf31993fd7eeaa0` completed, forced false,
error null. Independent GET confirmed **archived**, expiry null
(`normal-archived.json`). No box remains running for this task.
