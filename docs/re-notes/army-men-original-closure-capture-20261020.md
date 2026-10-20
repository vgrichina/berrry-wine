# Army Men original closure and actual Boot Camp capture

One execution on `bx_6czhvg6m`, 2026-10-20 12:24:43–12:25:03 UTC.
Original asset closure is restored and actual Boot Camp images were captured.
**Paired-scroll acceptance remains blocked:** the existing observer reads five
arguments from API metadata, but its Army adapter requires six. No pixel pairs
were accepted. No second launch or source/renderer/EXE patch was made.

## Complete inventory reconciliation

Read all 433 historical `state/vfs/` records from the retained verified source
`/home/user/army-men-local-stage-v14-20261019`. Each record matched both its
transfer manifest and the prior scroll-entry pins, and every source byte
matched size and SHA-256. Remote staging initially held 168 matching files,
with 265 absent, zero mismatches and zero extra files.

The historical snapshot is not exclusively original game media: 14 entries
are generated system placeholders. Their hashes exactly match the existing
runtime's six DirectX/OpenGL and eight Win16 module generators. They were
**not extracted into staging**. Replaying those as ordinary DLLs would also
discard their `staticModule` distinction. Exact excluded paths, relative to
`windows/system/`, are:

```text
commdlg.dll d3d8.dll d3drm.dll ddraw.dll dplayx.dll dsound.dll
gdi.exe keyboard.drv krnl386.exe mmsystem.dll opengl32.dll
shell.dll sound.drv user.exe
```

The other 251 missing historical files were staged with their relative paths
intact. This includes original CPU DLLs, source-media/installer remnants,
installed state and historical supporting files. All 419 non-placeholder
files passed hashes before and after execution. No missing original path
remains in this inventory. The initial in-memory transfer archive contains
all 265 absent historical entries; extraction explicitly selects only the
251 non-placeholder paths. No synthetic file was introduced into the VFS.
The unchanged runtime's built-in module behavior remains in use.

`cpuinf32.dll` SHA-256 is
`5e7f97ecbb834822a9913124f181c1e82ffbda6a7c13f2deb1f963c09383f31e`;
`cpuinfo.dll` is
`9049c886ec2496e67dcf1c0b10e42a0a44f1ff29f203e7b60e54375c9802602c`.
The actual `findVfsDllBytes` helper resolved both system-path bytes and PE
inspection verified their nonzero `wincpuid` and `cpunormspeed` exports.
The original five-PE startup dependency graph resolved without missing
dependencies. Renderer construction and PNG encoding passed.

All 6,415 canonical source blobs matched
`8f6dcc71c7d3685e764da945e6c379ecca30fa49`. The prebuilt WASM SHA-256 stayed
`6642ceea29e035531819fafe795f949ad0d343460fa73af5d23ee3b2f2a968e2`.
No rebuild occurred. Runtime Node was v24.18.1; remote free space was about
49 GB. Local free space remained above 2 GiB; no local bulk asset copy/build.

## Actual outcome and new causal blocker

Reused the unchanged paired BltFast observer and prior ordinary input schedule:
Boot Camp click at batch279, Numpad6 down674/up706, screenshots at
200/450/670/713 and exit; 200,000-block batches, 750-batch/90-second bounds,
cooperative `--no-threads` mode. Exact arguments are in `recovered/launch.json`.

Visual review:

- `menu.png`: real Game Start menu with Boot Camp option.
- `bootcamp.png` and `turn-before.png`: identical “Welcome to Bootcamp!”
  overlay above terrain and HUD.
- `turn-after.png` and `final.png`: identical unobscured terrain, soldier,
  instructions sign, fence, rocks, trees and HUD. These are not black/menu
  frames. They establish Boot Camp reached, not general playability.

The adapter retained eight calls at the original return address `0x407506`,
all with raw exit EAX0, but rejected each with `incomplete arguments`.
The underlying observer retained 24 records and dropped 663 due to its
existing per-API cap. Its owner is pinned, pending depth0, no observer errors.
This is a deterministic metadata mismatch:

- Pinned `src/api_table.json` ID1008 (`IDirectDrawSurface_BltFast`) has nargs5.
- `jig-owning-api-observer.js` reads exactly `meta.nargs` stack arguments and
  expects `4*(nargs+1)` stack cleanup: 24 bytes.
- The Army adapter explicitly requires six arguments before reading surfaces.
- Actual records have five arguments, stack delta28, same entry/exit EIP,
  yieldReason0 and EAX0. The pinned WAT handler also explicitly cleans28.

Thus raw returns and partial arguments exist, but surface dimensions,
pitch/backing metadata and pre/post samples are absent. The observer marks
the records incomplete, so EAX0 is not presented as a validated paired
success. Saved-source analysis identifies the capture blocker; it does not
establish pixel-copy correctness or terrain-stripe causality. No fix or
relaunch was attempted under this bounded assignment.

A second capture limitation is retained: broad BltFast tracing hit the
controller's 8 MiB storage cap. The child emitted138,722,163 bytes, of which
8,361,103 were saved; controller reason is `log cap`, code0/signalnull.
SIGTERM did not prevent the later scheduled images and normal exit. Later
input acknowledgements/final runner log are unavailable. Do not treat exit0
as full acceptance. A future authorized capture needs bounded trace output
as well as correct six-argument observer metadata.

## Preservation and recovery

Self-contained evidence:
`scratch/runs/20261020-army-original-closure-capture/`.
`recovery.json` verifies archive SHA-256 and all25 recovered artifacts.
Snapshots retain the source-pinned observer, adapter, API table and loader;
the full source manifest, controller, provisioning/recovery JS, registry,
complete asset inventory, screenshots and raw failure records are included.
`node scratch/runs/20261020-army-original-closure-capture/verify-evidence.js`
replays the saved-evidence assertions without another runtime launch.
No local candidate ID exists; this uses an investigation receipt rather than
attaching evidence to an unrelated dashboard candidate.

Remote evidence remains `/home/user/army-original-evidence` and
`/home/user/army-original-evidence.tar.gz`; original retained assets plus the
manifest and `reconcile.js`/`provision.js` provide the recovery recipe.
Ignored assets/artifacts are not Git backups. Only this report is committed
on the isolated task branch. Earlier Army/ICM artifacts remain intact.
Postflight process inventory has no guest/controller survivor.
Runtime lease released at12:26:13 UTC, box left running for coordinator use.
No shared HEAD/index change, main merge, worker launch or public deployment.
