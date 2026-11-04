# Deus Ex demo: closer launch reaches the floor metal crate

One ordinary jump from a measured closer launch reached genuine supported
footing on `CrateUnbreakableSmall1`. A new native **count8/time01:11:54** save
preserves it. This is the first small step of the existing count7 layout;
it does not establish upper-stack access, the exit, the ladder or FPS.

Evidence: `scratch/runs/20261104-deusex-closer-support/`. The shared
`deus-ex-demo.md` was left untouched. No production source changed or build ran.

## Exact runtime and preservation

The fresh leased box was created with
`boat --no-update --json new --from deusex-supported-stack-20261104 --ttl 3600`.
This reused the accepted immutable staging without rebuilding it. Runtime input
verification checked the retained 458-entry provision manifest, excluding its
run-helper entries, with no changed source/media/checkpoint/module inputs.
Current checkout WIP was not staged. Runtime remains the accepted historical
Git base `a504fa248caaecbbb042b65e9ae5384a340ade26` plus the recorded nine-file
binary patch in the preceding supported-stack run. Its accepted recovery
manifests remain authoritative; current main is not substituted into that closure.

Actual executed and recovered canonical module SHA256:
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`.
The historical closure supplies no second compatibility-module identity and no
second module was present or executed. Both-module recovery cannot be claimed.
Original SoftDrv/default guestWorker/three guest workers and 1024×768 captures
were retained. Chrome reports `151.0.7922.108`.

The first controller launch failed before browser/game startup with
`Cannot find module 'puppeteer-core'`: moving the inherited evidence directory
also moved its `node_modules`. `first-launch-failure.json` and the recovered
failure log retain the diagnostic. Pointing `NODE_PATH` at the retained
`prior-evidence/node_modules` repaired that concrete dependency, retaining the
original fixed 20-minute deadline. No guest route had run before this repair.

Both original accepted save pairs were read only and remain full-SHA256
identical (`immutable-saves-after.json`, four files). Only checkpoint copies
were mounted in runtime. No guest memory writes, teleport, cheats, game/config
edits, checkpatch, crate pickup/drop or earlier route replay occurred.

## Measured approach and landing

`03-load-dialog.png` displays count7/time01:09:32. Native Enter restores it;
`04-count7-crosscheck-observer.json` independently matches the unique named
player at `(7058.32031,-1773.35107,15.90000)`, yaw184635, Physics1, height43,
zero velocity. Inspected `05-restored-scene.png` shows gameplay, not LOADING.

The observer retains the original owning slot0/thread1, named Core exports,
typed object array, checked actor offsets and JS/Wasm return-boundary reads.
Its new `geometry` action reads named crate instances/class identities from
that object array, without a raw memory scan. Live small1 geometry matches the
saved transform: center `(7061.31006,-1701.65759,-13.14719)`, radius22.5,
height15.25, nominal top2.10281. Small0 remains at
`(6997.22461,-1707.74158,49.35019)`. Both small crates remain stationary and
unchanged through the landing and save.

Native X is consumed on the ground. C1400ms then C330ms produces measured
yaw212591, facing the floor crate directly. Up300ms and Up200ms, with releases
and stationary checks between them, approach to
`(7059.29785,-1748.11621,-11.10000)`, Physics1, height16, zero velocity.
`14-launch-geometry-observer.json` measures player-to-crate XY distance46.50217,
compared with the prior failed jump's roughly55-unit distance on descent.

Space+Up220ms, release Space, retain Up500ms, then release Up is the sole new
jump. `jump-trajectory.json` retains150 surrounding samples, including22
airborne samples with height16, maximum sampled Vz216.40186 and sampled
center apex36.12799. The first sampled collision-cylinder overlap is at
`(7059.51611,-1742.45874,36.12799)`, with feet20.12799 and Vz−16.33443.
**Overlap before the apex is not demonstrated:** the sampled overlap is already
descending, but remains18.02518 units above the measured crate top. The decisive
result is the subsequent native support, rather than a prediction from radii.

`18-landing-geometry-observer.json` and `20-stable-geometry-observer.json`,
1348ms apart, show identical crouched location
`(7060.70508,-1711.76660,20.07167)`, Physics1, zero velocity. Releasing X yields
standing height43, centerZ47.07167, with unchanged feetZ4.07167. The roughly
1.97-unit gap above the nominal crate top is recorded, not assumed to be zero.
Inspected `25-support-underfoot.png` and `26-support-still.png` show the metal
crate directly underfoot and the adjacent wooden surface. Final `32` and `33`
retain the same footing. `16-closer-flight.png` alone is not landing evidence.

## Genuine native save

Ordinary Escape → Save Game → Enter writes the new save. `28` shows the Save
dialog; `29` returns to the same underfoot view. Whole native VFS output bytes
were read without modification into `recovered/native-save-export/0.bin` and
`1.bin`, with their original destinations in `manifest.json`. These files and
the manifest are read-only. No repeated copy of game media was made.

| Native file | Size | SHA256 |
| --- | ---: | --- |
| saveinfo.dxs | 34576 | `72a62f197b8b6a8a1ef86cb51f8ed532668d38b110cdd45f4b0c72ba0918de25` |
| 00_training.dxs | 3232631 | `8bb21936b5170a280c9508a4232b07052a1ba00d33cb10a8828add576cf47559` |

Read-only original-format decoding records MyDeusExSaveInfo count8/saveTime4314
(01:11:54), and the unique JCDentonMale0 has the exact standing location above,
Physics1, height43, and **Base=CrateUnbreakableSmall1**. This independently
establishes actual support. Both small-crate transforms match the live check.
This count8 is distinct from the existing immutable 14:50 count8/time01:22:17.

Fresh reload of this new save was not tested. The optional final Load-dialog
capture `31` is a transient blank frame and proves no dialog identity or reload;
`32` returns to gameplay. No additional gameplay followed.

## Checks and handoff

`check.py` passes111 recovered unique files/full SHA256, the actual tested
module, original observer positive/five rejection fixtures, new named-crate
geometry/invalid-radius fixtures, count7 native crosscheck, closer launch,
trajectory/landing, saved Base/count/time, four unchanged original save files,
48 trusted balanced native events,14 sequential terminal receipts (maximum14
steps, bound64), and21 PNG dimensions. Relevant images were inspected directly.

The entire segment, including failed controller setup and successful cleanup,
lasted331.172 seconds. Browser closed at2026-11-04T01:30:16.806Z, inputs empty,
port8123 closed. Box `bx_fh3pdq9m` was handed back **RUNNING/idle**,
expiry2026-11-04T02:23:55.716Z, **shutdownOwner=coordinator**. No worker
stop/delete/resume action occurred. The coordinator owns snapshot/normal STOP.

Next gameplay work can start from the new small-crate footing; reaching the
low wood and upper support remains separate unobserved work in this segment.
This worker stops after publishing this note, with no successor or acceptance task.

Subsequent coordinator board entry01:34:05Z records independently verified
111-file recovery, inspected underfoot evidence, named snapshot
`deusex-closer-support-20261104` verified01:33:31.396Z, and actual normal
STOPPED01:33:52.741Z (forcedfalse/errornull). This occurred after the worker's
RUNNING/idle handback; the worker performed no lifecycle mutation. The original
expiry is now inactive. The global evidence checker reported existing unrelated
run errors; this run has no containment, missing-artifact or schema errors.
