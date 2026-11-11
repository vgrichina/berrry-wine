# Heretic II native progress save and gate-crossing attempt, 2026-11-11

The shipped engine can write a genuine named progress save using **`save
gate1315`** in its native console. This run preserved unedited game-written
checkpoints at the starting dock and the dry timber corner beyond the starting
crate. It also reached the courtyard and vestibule threshold again, but did
not cross the inner gate or complete an onward objective. Repeated pursuing
humanoid combat deaths prevented the crossing before the private lease cutoff.

Run: `scratch/runs/20261111-heretic2-raised-gate-crossing-1315/` (ignored).
The established parent gate activation remains documented in
[the courtyard handoff](heretic2-current-bonfire-courtyard-20261111.md).

## Native save and byte recovery

`Base/default.cfg` binds backquote to `toggleconsole`; opening the console
displays the native **Paused** banner. The engine's embedded usage string says
`savegame <directory>`, but its registered command is **`save`**. The initial
`savegame gate1315` trial was unrecognized. `save gate1315` then produced
**“Saving game...” / “Done.”** at both the dock and the dry corner.

Decisive full captures are under the run's `software2/`:

| Capture | Observation |
| --- | --- |
| `save-correct-execute.png` | Native dock save command and completion, console paused. |
| `corner-console-after.png` | Alive at the dry timber corner, console paused, pursuing humanoid immediately behind. |
| `corner-save.png` | Native save completion at that actual progress position. |
| `named-resume.png`, `named-move-check-after.png` | Dock named load returns an alive character, but subsequent finite forward input animates without establishing displacement. |
| `vestibule-approach-after.png` | Later live attempt reaches the vestibule threshold with red panel left and inner timber gate ahead. |
| `panel-close-after.png` | That approach ends at native Load Game before panel activation. |
| `last-status.png` | Final attempt ends with Corvus dead beside the courtyard bonfire. |

The named slot contains four native files at
`c:\user\save\gate1315\`: `server.ssv`, `game.ssv`, `demodocks.sav`, and
`demodocks.sv2`. The local `dock-named-save-manifest.json` and
`corner-save-manifest.json` retain exact guest paths, byte counts and SHA-256
values; their corresponding `native-saves-dock-save/` and
`native-saves-corner/` numbered files contain the exported original bytes.
The exports only read resident VFS file entries; they did not generate,
rewrite, patch or inject save data. Separate snapshots retain each version
even though the game reused the same slot name.

Recovery must preserve all four files together, their manifest paths and
their exact hashes. Use the same canonical media and tested source/module;
an original-byte VFS restore must map them to the recorded guest directory.
The native load command is `load gate1315`. This run observed loading text,
then an alive dock view after opening/closing the menu, but **did not prove
working restored movement**: forward holds changed animation without moving
from the dock, including after a native Pause toggle. Treat that as a retained
reproduction issue, not a reliable restart recipe. Native menu loading of the
original `ENTERING — Silverspring Docks` entry did restart playable sessions.
The dry-corner named checkpoint was preserved without loading it.

## Route and scope

Run/jump reaches the dry timber corner from the starting crate. Facing the
first close pursuer and using Sword-staff attack produced a visible corpse
with substantially more health retained than the earlier Flying-fist trial.
The low passage needs alignment away from its right wall; a finite diagonal
forward/left strafe cleared that obstruction. Staff attack and forward
movement reached the courtyard, with a corpse visible at Corvus's feet.
Pursuers still followed to the second opening and killed Corvus before a
fresh close-panel activation and crossing could be performed.

The run-local helper briefly typed a new run-chord label literally instead
of dispatching its keys. That opened chat at the safe dock; Escape cancelled
it, the helper was corrected, and subsequent event records establish actual
balanced key holds. This error and the unrecognized savegame command are
retained separately from successful native save evidence.

Accepted source remains `0db20330ccd6761a705eea70c5dd9bfc7704c147`, module
`ce57f0ad80254b974a0d8bcd4e2c9cbf396d2357cbdc7874e6084e980e1e68e1`.
The matching retained locked-build log was rehashed; eight key-helper checks
passed, all 3,377 provision pins were verified, and all 2,461 runtime pins
matched after gameplay. No shared emulator code, guest memory, game script,
map, configuration or cheat changes were made. No workers or public hosting
were used. Git commit identity, relevant patches, run-input patches and
original media references preserve recovery without a source-tree archive.

Recovery retained 1,131 artifact references as 873 unique contents with a
lossless map. Independent pre-stop and post-stop validation passed 161 PNG
checks, 113 image/owner/module bindings, 113 exact numbered acknowledgments,
and 70 finite, balanced direct key holds. The controller/browser exited with
actual parent wait and both output streams at EOF; independent checks found
their processes, profile and server port absent. Private box `bx_79pteyuc`
was normally archived at `2026-11-11T13:52:10.121Z`, stop
`stop_7783f61ae307a9a4` completed, nonforced, error-free. A separate GET
confirmed archived state and null expiry. Its prearmed deadline watchdog
exited unfired with actual parent wait and both streams at EOF.

Next: resolve the named-load movement issue or retain a higher-health native
checkpoint nearer the panel, then repeat the proven fresh Action activation
and cross immediately. Gate crossing and onward completion remain open.
