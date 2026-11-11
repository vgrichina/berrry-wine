# Heretic II: native ascent and the boat chamber's west-door route

The route investigation reached the elevated platform and its wall opening
from genuine gate1640 using native controls. Native `showcoords` printed
`Player Location: (1705, 357, 234)` after the climb, and native
`save upper1730` completed. All four original engine-written files were
exported and SHA-256 verified. This establishes ascent, but **upper1730 is
not a recommended resume point**: one exposed reload died, and a second
reload with native Pause assistance showed standing Corvus before ordinary
backward input opened Load Game; the console then confirmed another death.
No successful ordinary movement from that save is claimed.

Read-only shipped `demodocks.bsp` inspection identifies a platform at height
128, the Ring of Repulsion at `(1664,296,144)`, and a button/Action trigger
at its southern end. The target chain is `ash -> kelson -> patty`, controlling
the west double door at x1240–1248, y288–448. Ground-level health items lie north of the platform at `(1664,432,32)` and
`(1664,464,32)`, with another full-health item in the room west of that door.
These are shipped entity locations and links, not proof that an item was
collected or the switch was operated. The map's sole `obj_rope` is far away
at `(-532,-388,454)`; the chamber's two `obj_ropechain` entities match the
floor coils. No hanging-rope attachment is established.

Corvus crossed the chamber to the west door with bounded native running and
Action. The door stayed shut at the threshold. Native `save gate1730`
retained that position; read-only inspection of its original player record
places it at approximately `(1262.03,377.90,34.03)`. Its subsequent normal
reload ended in native-confirmed death. The door arrival is a concrete route
finding, not a safe checkpoint or chamber exit.

The successful ascent used Sword-staff, a position clear of the platform's
western underside, and native Forward+Run+Jump+Action. A short
Forward+Action continuation maintained the raised-arm pose. A further
Forward+Jump+Action continuation raised Corvus above the beam; subsequent
Forward reached the higher wall opening. The earlier raised-arm frame alone
was insufficient evidence. Backing too far from that opening later carried
Corvus off the platform; the apparent landing frame was corrected after the
next view showed him below it. No pickup, defense use, switch activation,
confirmed threat defeat or onward chamber exit was proved.

Evidence is in ignored run
`scratch/runs/20261111-heretic2-sheltered-route-health-1730/`. Start with
`RESULT.md`, `RECOVERY.md`, `shipped-map-entities.json`,
`local-brush-models.json`, `upperfirst-checkpoint-manifest.json`,
`door-checkpoint-manifest.json` and `final-recovery-local-map.json`.
`software2/staffvault.png`, `pullup.png`, `vaultfollow.png`, `platformland.png`
and `uppercoords.png` record the ascent and native altitude. The failed
reloads and their console consequences are retained separately.

Exploration used native Pause assistance, actual key releases and separate
full-image inspection before dependent input. Host hold times are not guest
simulation durations. Read-only native `showcoords` supplied location/facing;
`toggleinventory` produced no visible inventory overlay. Original guest code,
map, configuration and save contents were not edited. Native engine saves
were written only through the game's own commands. The tested module remains
`ce57f0ad80254b974a0d8bcd4e2c9cbf396d2357cbdc7874e6084e980e1e68e1`,
from source pin `0db20330ccd6761a705eea70c5dd9bfc7704c147` with the retained,
hash-verified matching locked-build proof. No shared emulator repair was made.

Continue from gate1640 under roof cover. The new boundary is obtaining a
platform pickup or activating its southern button while staying mobile,
rather than finding an assumed hanging rope or treating either new save as
safe. Consult the run result for final fallback verification and lifecycle.
