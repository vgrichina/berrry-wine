# Dark Earth (demo)

Kalisto / MicroProse, 1997. Registered as `dark_earth_demo`.

## Fixture and install (headless)

- `test/binaries/win98-games-a-d/Dark_Earth_demo-NeedMountedCD-SW`: a
  MODE1/2048 BIN + cue of the demo CD (label DARKEARTH). The cue names the
  image in upper case; `dark-earth.cue` beside it matches the file and is
  what the registry entry mounts.
- `run.js --iso=<bin> --iso-exe='DKEDEMO\SETUP.EXE' --tick-ms-per-batch=5
  --capture-launch=cap`: the 16-bit InstallShield 3 launcher WinExecs
  `_ins0432._mp -fD:\DKEDEMO\SETUP.INS -z1 -cx -xC:\WINDOWS\TEMP\`. Keep only
  the captured `windows/temp` (the capture also copies the whole CD).
- Run the engine with `--iso=<bin>` still mounted, `--exe-guest-path`,
  `--vfs-tree=<temp tree>`, `--args=...`, `--cwd=D:\DKEDEMO`, frozen
  `--control`; Next x3, step to "Setup is complete". `C:\DARKDEMO`
  (dkedemo.exe + per-level DLLs, 778 files, 26 MB) is kept at `installed/`.
  The game data stays on the CD: without D: it stops with "Fatal error 4".

## What it needed (2026-10-06)

- `ValidateRgn` (54b72963): not an API before.

## Route

Boot shows the controls page; it waits on a WM_CHAR key queue
(`exe+0x4862a0` fills it from the wndproc's WM_CHAR case,
`exe+0x47cd30` waits on it), so on the CLI use `keypress` (keydown alone is
not translated to WM_CHAR here: the host sends WM_CHAR itself, as the
browser's keypress does). Space -> monitor settings; Enter -> main menu;
click NEW (150,62) -> Arkhan in his room; hold Up -> he walks out to the
domed hall (fixed-camera cut). Evidence: `scratch/runs/20261006-dark-earth-demo-walk`.

## Browser movement (2026-11-02, private/local only)

Run `scratch/runs/20261102-dark-earth-native-browser/` demonstrates ordinary
browser movement in **one original invocation**, separately from the historical
CLI route above. `dark_earth_demo` remains a local candidate, absent from public
`DESKTOP_APPS`; no public deployment or registry promotion was made.

Reviewed fullpage and canvas captures show the controls page, Space to monitor
settings, Enter to the main menu, and a native left click on NEW. In
`06-room-before` Arkhan stands by his bed. Holding Up produces the fixed-camera
cut into the domed hall (`07-up-movement-held`); released, settled, and later
neutral captures retain the hall and his new position at the doorway. This is
player movement evidence, not a title/menu/CLI qualification.

The nine native events were trusted and formed four balanced input pairs:
Space, Enter, left click, Up. Space/Enter produced consumed WM_CHAR messages.
Up was requested for 3000 ms and actually held 3728 ms including captures;
key-up was consumed 7 ms after release. The immediate release snapshot still
had that key-up queued; settled and later neutral states had empty queues,
no active event, all physical/async keys up, and no mouse button held.

### Data-disc contract and identities

The `cdAudio` registry field includes this **data** disc. The normal browser
shell parses its non-audio MODE1/2048 CUE track, opens `HttpRangeProvider`
(HEAD when track sizes are absent), and calls
`mediaImport.analyzeCueBundle(..., {drive: 'D'}).mount(vfs)` before `loadExe`.
The private loopback server's HEAD returned 200, zero body bytes, and the real
126435328-byte image length. A 2048-byte range at offset 32768 returned 206,
the exact Content-Range, and the pinned ISO volume-descriptor bytes.

Before invoking the guest, the same browser mount APIs on a fresh VFS exposed
1288 files, volume `DARKEARTH`, read-only D:, and readable
`D:\DKEDEMO\SETUP.EXE` (MZ, 47616 bytes). The actual game VFS independently
exposed the same 1288 D: files and volume. No mount/runtime code change was
needed.

All 781 local fixture files (151190874 bytes), including all 777 manifest
entries with matching declared sizes, matched the coordinator's **locally
observed** pins. These are not upstream provenance:

- `installed/dkedemo.exe`, 992256 bytes:
  `6a1fbb1f9142f7e2dc4384158b04656da640427069d9f2159e38df2c9678cd34`
- Installed browser manifest:
  `e0f4dd371d7df53e6d64875330701e973040b27ddb82c7b396a0eb73d581403b`
- Actual mounted BIN, 126435328 bytes:
  `4d3fe64b6d79281fe1e14f8d6d0bc4eaf18611b83d509e646b8dd5c50767d11d`

Source snapshot `59d4addec4ca0cdff8de13c1e0d372c9cc042661`, clean runtime
patch; 1401 source/compiler baseline entries matched. The coherent accepted
locked-build module was reused, 2069384 bytes, SHA-256
`6d9563ff4a1c089c9d0ac4153748411990dc3c92f3a50e2509bbe9ffaaca30a7`.
Chrome 151.0.7922.108 ran headful at 1024x768 with normal shared guest workers,
threads, and the default WebGL host setting. No renderer override, guest patch,
injected game state, clock override, download, subworker, or original replay.

### Evidence and limits

The explicit immutable transfer included `src/api_table.json`; all 3646 file
members plus the manifest matched exact archive bytes and extracted hashes.
All 459 served-file records were pinned; 44 PNG integrity checks passed.
The 95-file evidence archive and all extracted members were SHA-verified
locally before task-delegated shutdown of the sole owned boat. Controller,
Chrome, and supervisor exited 0; natural guest exit is unknown because the
browser was closed after review. See `result.json`, `movement-review.json`,
`RECOVERY.txt`, and `cleanup.json` in the run for captures, identities, exact
exits, original boat expiry, and cleanup receipts.

**Preparation limitation:** the owner disk floor was violated before the
browser/game ran: the first guard recorded 1999273984 bytes free and then
failed writing a remote abort marker whose parent directory was not yet
extracted; a later sample was 1261654016 bytes. The worker terminated its
transfer, preserved the failure, and deleted no foreign/service files. Space
recovered without deletion; the cause remains unknown despite observing active
service snapshot staging. SSH fallback was denied by the API key. A repaired
guard and per-chunk checks covered the byte-identical resumed transfer and
subsequent gameplay; this does not erase the earlier violation. That guard and
the board watcher later exited 143 for an unknown reason. The last guard sample
was 2158026752 bytes at 17:00:33Z, after gameplay closed but before retrieval
verification at 17:00:55Z. Continuous retrieval/closeout monitoring is therefore
unproven. Details are in `disk-incident.json`, `monitoring-limit.json`, and the
guard/transfer records.

Optional `stdole2.tlb`, unrelated desktop assets, and deployment/auth/bundle
URLs returned 404 on the scoped private server; fonts loaded individually and
no target fixture request failed. No observed guest/runtime blocker on this
route. Audio, combat, FPS, completion, and sustained play remain untested.
