# Deus Ex demo: count12 fresh reload and one jump toward Z96 wood

Ordinary fresh Load verified immutable **count12/time01:15:48** from published
`7e9ced57554dea0a9a18e038a0b6b88ab8d1083a`. The exact Small0 edge support
survives reload and an ordinary native resave. One measured original-control
jump advances **16.3215 horizontal units**, then lands on Small0 again. The
farther Z96 wood was **not reached**. Native count14/time01:17:23 preserves the
result. No exit, ladder, completion or FPS result is claimed.

Evidence: `scratch/runs/20261104-deusex-small0-reload-onward/`. This follows
`deusex-low-wood-reload-20261104.md`; prior evidence and checkpoints are unchanged.
No production source changed, no build ran, and no second jump was attempted.

## Fresh historical runtime

Created fresh `bx_2t2b9xah` with
`boat --no-update --json new --from deusex-small0-footing-20261104 --ttl 3600`.
ID, expiry and shutdownOwner=coordinator were recorded on the board before use.
Old `bx_ctxfuux7` was already stopped and was never resumed.

The historical runtime remains Git
`a504fa248caaecbbb042b65e9ae5384a340ade26` plus the recorded nine-file
`scratch/runs/20261104-deusex-supported-stack/historical-source.patch`, SHA256
`9415aea6dbced13143b9dcdceb9d2d3594219a467263f7b3cf2bb623da36c796`.
All451 inherited non-helper/non-checkpoint runtime inputs matched their manifest;
the replaced checkpoint copies were separately checked. Final recovery found
no changed runtime inputs. Current-main WIP was excluded.

Actual canonical module executed and recovered: SHA256
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`,
1,898,260 bytes. The historical second compatibility module is absent; none was
substituted or rebuilt. Chrome151.0.7922.108, original SoftDrv/default
guestWorker, three original guest workers and1024×768 captures were retained.
Existing game media remain referenced by the inherited manifest's paths and
hashes. No media or source tree was archived.

## Immutable count12 reload and native support crosscheck

Mounted copies of the preceding run's read-only native pair at recorded
`c:\save\save0001\saveinfo.dxs` and `c:\save\save0001\00_training.dxs`:

| File | Bytes | SHA256 |
| --- | ---: | --- |
| saveinfo.dxs |34577|`dca8e03431727afc6b4babc5f503f5ec77a5fe6faa9acbd807fcfe3090749670`|
| 00_training.dxs |3232653|`466b1eca531a613d8a2fc37a1e16ae52422ce338e37a6236549e61a00adfb312`|

Personally inspected `03-count12-load-dialog.png` displays count12/time01:15:48.
Ordinary Enter restores unique named JCDentonMale0 at
`(7019.3388671875,-1693.322998046875,109.59093475341797)`, yaw231664,
Physics1, height43 and zero velocity. Inspected05 and08 contain gameplay.

Before traversal, ordinary Escape → Save Game → Enter produced **count13**.
Whole unedited native VFS outputs are preserved read-only in
`recovered/reload-save-export/`. Read-only package decoding independently gives
the same location, standing height, Physics1 and **Base=CrateUnbreakableSmall0**.
This verifies fresh restored support, beyond decoding the original input save.
The observer reads the typed Core object array only at owning-worker JS/Wasm
return boundaries. Its expected checkpoint position/yaw and fixtures were
updated; positive/rejection and crate-geometry fixtures passed remotely.

The supported position remains an edge/cylinder contact, not a full footprint
on the nominal crate top. Both small-crate transforms remain unchanged.

## Exactly one measured onward jump

The inherited read-only BSP evidence identifies the farther cargo01 wood face
atZ96: X7024–7088, Y-1872–-1808. The player starts114.677 units from its
near Y edge before accounting for the radius20 collision cylinder.

| Original control action | Measured result |
| --- | --- |
| F CenterView; C1000ms, release | Stationary at original support; yaw250640 toward the farther wood. Native C hold1003ms. |
| Space+Up550ms, release both | Sole jump. Native Space hold553ms and Up552ms;31 airborne samples, maximum sampled positive Vz242.05060. No screenshot or remote roundtrip extended the hold. |
| Settle1800ms, then1600ms plus capture overhead | Identical `(7026.70458984375,-1707.887939453125,109.60284423828125)`, Physics1,height43,zero velocity; geometry samples1736ms apart. |
| V900ms, release; ordinary Save | Inspected21 and22 show the metal crate below the player. Native count14 records BaseSmall0. |

Maximum sampled centerZ156.77322 gives feetZ113.77322, but maximum sampled
horizontal speed is only36.30554. The action advanced16.3215 horizontal units.
Its settled collision cylinder remains about80.112 units short of the wood's
near edge. These measurements establish a short jump and return to Small0;
they do not establish the cause of the limited horizontal speed. No unchanged
retry, extra jump, floor/crate route replay, pickup/drop or further traversal ran.

All14 PNGs were personally inspected. 01 is startup;02,03,07 are menus.
05,08,12,16,21,22 contain gameplay. **10,14,18 and20 are transient teal frames
and prove nothing**;20 therefore does not prove a save-dialog view. The prior
run's blank10/12/20/23/26 are also excluded from all claims here.
No guest-memory writes, injected game calls, cheats, teleport or game/config
edits ran. Ordinary native Save is the only game-file write used.

## Preserved result and handoff

`new-save-native-decoded.json` records final standing Physics1 and
**Base=CrateUnbreakableSmall0**, count14/time01:17:23. Whole unedited outputs and
original destinations remain read-only in
`recovered/native-save-export/{0.bin,1.bin,manifest.json}`:

| File | Bytes | SHA256 |
| --- | ---: | --- |
| saveinfo.dxs |34558|`4cfa57f28a079c1b0bcc0f4a002b24f845005122adf3d5ed39f04cd2fc2ba2a6`|
| 00_training.dxs |3232633|`ab8b1fa27157a6dc6f6e9a000acab0082f02be3c7478a7f982c27eab2759a730`|

Count14 has not been fresh-reload tested. The verified immutable count12 remains
the established reload baseline; any later traversal needs a separate task.

`check.py` passes83 recovered unique files/full SHA256, actual canonical module,
observer fixtures, fresh count12/native-resave crosscheck,31 airborne samples,
stable post-jump support/native Base,14 unchanged prior checkpoint files,
36 trusted balanced native events, seven sequential completed requests
(maximum17 steps, bound64),14 PNG dimensions and cleanup. Browser runtime lasted
151.869 seconds. No runtime failure or emulator repair occurred.

Browser closed at2026-11-04T02:06:06.937Z; held inputs empty, driver7634 and
browser7642 absent, port8123 closed. Handed back `bx_2t2b9xah` **RUNNING/API-idle**,
expiry2026-11-04T03:02:57.823Z, **shutdownOwner=coordinator**. Worker performed
no stop/delete/resume. Exact observed Git commits, historical source/module
identity and relevant binary patches are recorded in `source-record.json` and
`owned-new-files.patch`. Git remains the source archive. This worker stops after
publication, with no successor.
