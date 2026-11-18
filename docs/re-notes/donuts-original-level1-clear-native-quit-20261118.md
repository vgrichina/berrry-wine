# Donuts LEVEL001 continuation and native Quit attempt, 18 November 2026

The single authorized original reached its title, accepted ordinary native
Enter, displayed **LEVEL 001**, and continued in a live arena. First-level
clear/LEVEL002 and ordinary native Quit remain **unproved**. The concrete
blocker was the selected controller's immutable five-second gameplay review
window: reviewed Right, Space and Escape attempts were all refused **before
DOWN/prearm** at ages 10.966, 7.277 and 5.477 seconds. No movement or fire key
was delivered in this run. No guard was relaxed, original relaunched, or
endpoint used after host cancellation.

Evidence: `scratch/runs/20261118-donuts-original-level1-clear-native-quit/`.
This is a controller/operator freshness limitation, not a reproduced emulator
crash or evidence that Donuts cannot clear the level. The earlier accepted
turn/thrust/fire and score100 evidence, and the version-3 DirectInput Device2
repair, remain as described in
`graphics-donuts-current-crash-20261107.md`. No runtime or API fix was made.

## Personally reviewed whole frames

Five original 1024×712 PNGs were reviewed, with hashes and observations in
`visual-review.json`:

- `title.png`: Space Donuts, explicitly a Direct Draw Sample Application.
  Enter begins play; ESC/F12 exits; arrows turn/thrust; Space fires.
- `enter.png`: LEVEL 001. Enter 100 ms has actual native consumption and
  independently prearmed, acknowledged UP; receipts identify USER return.
- `arena.png`: score00000000, upright centered ship, red ring upper right.
- `aim.png`: score00000000, upright centered ship, ring directly above it.
  The preceding Right attempt was NOT_SENT; ring motion was uncontrolled.
- `quitview.png`: score00000080, colorful fragments and no visible ship.
  Right and Space had never been delivered. This score increase cannot be
  attributed to a shot. Collision/respawn/ambient mechanisms were not isolated.

The red top HUD reads 99 in arena frames; its meaning is not certified here.
Neither fragments nor increasing score establish a level clear. After
reviewing the last frame, ordinary Escape was attempted using the title's
documented exit route, but refused at 5.477 seconds before any DOWN. The
controller had already entered its irreversible Quit phase. Host cancellation
then closed the scope. Native process exit0 under SIGTERM handling is cleanup,
**not native Quit**. No fixed macro, guest/save/score/level edit, cheat,
collision attribution, projectile trajectory or FPS claim is made.

## Prepared identity and authored native controls

Runtime source is published main
`585235294ac4fa98220dbb8cb39a94922e9bd95c`. Sources were read as exact Git
blobs into transient sealed descriptors before the original clock; dirty
shared-tree changes were excluded. `relevant-worktree.patch` records those
excluded relevant differences for audit. `module-build.json` records the
published-source compilation and source hashes. The one retained module is
`runtime.wasm`, SHA-256
`eb2395e1c115980dd78dbb646a26f755a4119a2a1e086942e715240e07c34bc6`.
`module-source-load-verification.json` verifies all 126 observed source/module
loads against the sealed inventory, across threads 0–2. Git is the source
archive; no source tree, media copy or capture bundle was retained.

The unchanged registered `dx_donuts` has `presentCap:60`, its original EXE and
37 data files. All 38 hashes and sizes match the accepted November 7 pins
before dispatch and after cleanup (`accepted-media-match.json`,
`media-before.json`, `media-dispatch.json`, `media-after.json`). Launch uses
normal guest Workers, real ticks, no-build and a finite 600-second CLI limit.
The title and native Win98Renderer/raster Canvas2D output are DirectDraw
evidence, not GL backend proof. No D3D corpus membership or historical27
completion is claimed. No fresh active-D3D counter was requested.

Production `blood2-reviewed-input.cjs`, the immutable preparation helper,
sealed-source loader and common native transport were reused byte-for-byte
from the published base. The controller permits the relevant ordinary Enter,
arrows, Space and Escape gestures; its `open-menu` route name was used for
the documented Escape exit attempt. No input helper semantics changed.
Donuts-only orchestration is retained as run-local JavaScript and patches.

Before the original, the **same** sealed-source launcher ran two independently
authored native USER windows. Actual full 1024×712 PNG construction passed on
the main thread and in a Worker with the PNG codec included. The first native
scope checked actual Right/Up/Space consumption, release child armed before
DOWN, independently acknowledged UP, stale-review rejection and terminal
no-further-endpoint behavior. The second deliberately discarded a real
native-consumption ACK: independent UP still ACKed, the controller closed,
and a later attempted capture made zero endpoint calls. Both scopes were
cleaned and actually waited before the original. The whole authored binding
desktop was also personally reviewed. These are input/preparation controls,
not original-game movement/fire evidence. No tracked code changed; no runtime
old-fail/new-pass or new locked-build claim is made.

## Closure and recovery

Original PID2161408 ran from 01:15:03.083Z to 01:16:47.885Z. Its sole admitted
input was the balanced Enter gesture. Host cancellation requested orderly
shutdown; actual native exit0, both output EOFs and an empty drain-error list
are retained. The independently armed finite/disk watchdog exited0 after
seeing that actual native wait, with its own actual wait and both EOFs.
`native-supervise.cjs` records pdeathsig containment, exit0, no deadline fire
and `leaked:false`. Both authored scopes have equivalent native/watchdog/
containment receipts. All tracked native PIDs are absent or dead, and the
control listener is closed. Sampled original free space stayed at or above
2,411,900,928 bytes; no RAM gate was used.

The board watcher was signalled with SIGTERM and its final absence/dead state
checked. It had no retained parent wait owner, so its actual wait is explicitly
unknown, not fabricated. The run retained seven selected whole PNGs, the
unique module and authored PE inputs, receipts, JSON and logs. Redundant
authored PNGs and duplicate module hardlinks were removed. Recover runtime
source from the exact Git base; recover pngjs via the package-lock integrity;
recover the unique compiled module from the retained run root. The run-local
helpers and note are also preserved as new-file patches. `result.json` is
written last after publishing this note.

No test box was created: box ID **null**, state **NOT_CREATED**, expiry **null**,
stop receipt **null**. No agents/workers, Wine, Python, public deployment,
foreign source changes or subsequent original replay were used. Ownership is
released at task closure; no investigation remains held.
