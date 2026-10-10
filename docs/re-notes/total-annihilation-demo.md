# Total Annihilation Demo

## Original installer

The local fixture is the unchanged 21,540,864-byte `Total Annihilation.exe`
self-extractor linked from `sources.md`. Wine-Assembly runs that executable
directly. Its numeric `ADD` resources produce `TADemo.exe`, `TADemo.hpi`, and
the readme; the browser/CLI app launches those installer-produced files rather
than a host-extracted substitute. The installer and installed payload remain
local and gitignored.

## Frozen gameplay route

`test/test-total-annihilation-gameplay.js` launches the registered
`total_annihilation_demo` app through the headless CLI with frozen stdio
control at **20,000-block batches and a 16 ms guest tick**, the candidate
route's settings (`total-annihilation.md`). It clicks **Single**, **New
Campaign**, the default Arm campaign on Medium, and the briefing's **Start**
(batches 1600-4600), then plays: a left-click on the Stumpy tank at (212,228)
selects it (orders panel down the left, "Stumpy / Standby" bar), and a
left-click on open ground at (430,390) orders a move (TA's default interface;
right-click and a ground click with nothing selected deselect). The tank drives
there and reports Standby about 800 batches later. The test asserts terrain,
minimap, HUD, the panel opening, the tank leaving its start and arriving.

**Do not run TA at 1,000-block / 200 ms batches.** The battlefield renders,
but a TA frame costs more than such a batch and the simulation paces off the
guest clock: no unit moves, the economy never ticks, and a pointer move only
changes the cursor. The previous version of this test did exactly that and its
"pointer response" was the cursor sprite.

## Frame counter

TA draws its 8bpp primary with Lock/Unlock and never calls Flip, Blt or
BltFast. Over a gameplay window the main thread does exactly one primary
`Lock` (returns to `0x47c211`) and `Unlock` (returns to `0x47c34a`) of one
surface per frame, and `dx_present` on presentation slot 1 fires once per
Unlock, so `--present-distinct`/`--frame-stats` count frames 1:1. From batch
4700 to 6100 (22.3 guest-s, covering the move): 321 frames, 291 changing the
picture, 14.3 frames per guest-second, interval p50 4 / p99 10 batches,
identical across runs. `--frame-stats-out=FILE` writes the raw intervals.
Evidence: `scratch/runs/20261010T0250Z-total_annihilation_demo-control-frames`.
Browser FPS is not measured.
