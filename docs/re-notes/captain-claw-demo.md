# Captain Claw Demo

## Original installer

The local fixture starts with the unchanged 11,275,313-byte `claw_demo.exe`
self-extractor linked from `sources.md`. Wine-Assembly runs its original
InstallShield extraction, Win16 bootstrap, and 32-bit setup engine. The app
manifest launches `clawdemo.exe`, `clawdemo.rez`, and `mss32.dll` copied by that
wizard to `C:\\GAMES\\CLAWDEMO`; it does not use a host-extracted substitute.

## Frozen gameplay route

`test/test-captain-claw-gameplay.js` checks the recorded SHA-256 hashes of all
three installer-produced runtime files, then launches the registered
`captain_claw_demo` app through one headless CLI process. Frozen stdio control
and the CLI's internal `--max-seconds=90` guard drive:

```text
main menu -> Single Player -> Demo Level #1: La Roca -> move right
```

The test captures the initial room, holds the real DirectInput right-arrow
state, and captures the scrolled scene. Its visual gate requires the 640x480
game surface, substantial rendered level content, treasure/HUD colors,
Claw/water colors, and more than 30,000 changed pixels after movement. Explicit
paths retain both screenshots:

```bash
CLAW_BEFORE_SCREENSHOT=/private/tmp/claw-before.png \
CLAW_SCREENSHOT=/private/tmp/claw-after.png \
  node test/test-captain-claw-gameplay.js
```

## Weapon consequence (2026-11-27)

Run `20261127-claw-combat-consequence-root` inspected the current La Roca
scene in one original registered-app CLI process (47.527 seconds, finite
`native-supervise.cjs`, exit 0, no leaked processes). After approaching the
blue floor object, DirectInput Alt (VK 18) held for 12 batches fired the
pistol: the visible ammunition HUD changed from **10 to 09**, remaining 09
after release and 30 further batches. Health stayed 60 during that attack.
This establishes an attack-caused ammunition consequence; enemy damage or
removal was not established. Rightward movement is prior accepted behavior.

The run retains inspected `target.png`, `weapon-shot.png`, `after-shot.png`,
an enlarged HUD comparison, exact input/reply logs, Git/diff identity, and the
exact tested module (`d4e95883e44848490831d279a8231cc51a36315bab60462e4fa28b3721fc3615`).
All three installer-produced media hashes matched the gameplay test pins.
No emulator change or guest-memory state modification was needed.

## Static La Roca enemy approach (2026-11-27)

Run `20261127-claw-object-route-root` decoded the existing installed REZ,
without executing the game. `/LEVEL1/WORLDS/DEMO.WWD` is the Level1 map:
archive offset **7076709**, length **12982**, SHA-256
`6def736462f45ad2519734177248c33c544fe6e05f93d5c4bc89f3b37f7b91de`.
Its 1524-byte header supplies **startX=588, startY=4723** at offsets
720/724. There is no `PlayerStart` object; the start is a header property.

The compressed body expands to 358771 bytes. Its main `Action` plane has
384×96 tiles of 64×64 pixels and **561 placed object records**, beginning
at decoded WWD offset **163302** and ending exactly at the tile-description
section, **340843**. Each object has 284 fixed bytes followed by its four
declared string lengths. Record index 63 (zero based), **ID 3429**, occupies
**[183318,183622)**: logic `Officer`, image set `LEVEL_OFFICER`, position
**(1556,4732)**, minX/maxX **1160/1622**. The next Officers are ID 3431 at
(1916,4412) and ID 3432 at (2364,4540), on higher terrain. Serialized
objectType/hitTypeFlags are zero; do not interpret that as absence of enemies.
The original EXE registers `Officer` (string VA `0x510d30`) to handler
`0x460e20` at `0x40120b`; classification is through the logic initializer.

The first Officer is **968 pixels right of the start on the same lower
corridor**. Action row 74, columns 9–25 (x=576–1663), uses tile 404 followed
by tile 304. Both specify clear outside/solid inside rect (0,55,63,63),
giving continuous floor at **y=4791**, without a pit. The space
x=576–1663, y=4550–4790 has only clear/climb attributes; a ladder at x≈1408
does not require climbing to reach this Officer. Solid terrain closes the
right end near x=1704. No upper-platform route is needed.

Concrete ordinary approach: move **Right** from (588,4723) along this floor.
Near x≈900, use **Jump+Right** to pass the PowderKeg at **(986,4725)**;
continue Right, using jumps over/onto the crate objects around **x=1101,
1207 and 1399**, toward **x≈1250–1450** in the Officer's corridor. Stop on
landing and face the actual Officer: Right while it is ahead, Left if it
passed underneath during a jump. Its authored horizontal limits are
1160–1622. Do not continue into the kegs at x=1622/1666 or the right wall
to find this target. Treat the Officer sprite as the target, not the blue
floor object from the ammunition-only run.

This is a **static geometric route**, not an executed input schedule or proof
of an enemy consequence. Dynamic keg/crate collision boxes, stack expansion,
jump timing/range, AI position at arrival, projectile obstruction and health
effects were not established. Tile geometry requires no jump; the suggested
jumps address placed objects conservatively and need ordinary visual control,
not frozen batch counts. The prior ammunition-only captures do not identify
this Officer or establish its removal.

Format layout was checked against primary parser source
[`libwap/WwdFile.cpp`](https://github.com/pjasicek/OpenClaw/blob/5ee5740ca98377c76b13b50c84f610b0066a4717/libwap/WwdFile.cpp),
`RezArchiveFile.cpp` and `libwap.h` at that same commit. The scratch probe
validates both real demo maps (561/715 objects), every section boundary and
tile ID, direct byte anchors for four real records, floor geometry, and nine
malformed inputs: **13 checks PASS**. This is a scratch decoder for these
installed records, not a general WWD library. Recovery uses the pinned local
REZ plus `probe.cjs`/`validate.cjs`; no extracted media or source snapshots
are retained.

## Visible Officer encounter (2026-11-27)

Run `20261127-claw-placed-officer-root` reached the actual purple, plumed
Officer in the lower corridor beside the crate and paired kegs, using ordinary
Right/Left and Space jump input. `jump-check.png` identifies that Officer below
Claw before any attack input; `officer-before-attack.png` shows close contact
with health **90**. Ordinary DirectInput Ctrl (VK 17), held for four batches,
is followed by `officer-attack.png` at health **80** and
`officer-after-attack.png` at health **70**, with the Officer still beside
Claw and a visible impact on Claw. Ammunition stays **10**. This establishes
a player-health consequence in an identified Officer encounter; Officer
damage or removal is not established.

The initial approach also lost health 100→60 and then respawned, consuming a
life before reaching the identified Officer. That earlier loss is not credited
to the Officer. The complete attempt used one original registered-app runtime,
**61.126 seconds**, under finite `native-supervise.cjs`, exit 0, no leaked
processes. No second runtime, game patch, guest-memory manipulation or emulator
repair was used. Exact module/source/host/media pins were prepared before
launch; the tested module SHA-256 is
`88874dad968765cadfa2a9d355716483dd5378b135c5f62cefa9517265addfe3`.
The run retains selected before/after screenshots, the module and exact
timestamped production-input/reply logs. These adaptive inputs are evidence
of this encounter, not a reusable frozen route or a no-damage traversal.
