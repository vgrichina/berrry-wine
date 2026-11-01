# Motocross Madness demo

## Scene-list crash and Backspace, 2026-10-13

The next Safari worker report on localhost:8081 failed in `ini_get_string`
with saved EIP `0x407df6`. The original code at `0x407dd0` formats a scene
path, then calls GetPrivateProfileString at `0x407e17` for
`[SceneInfo] SceneName`. Both trial `.SCN` files are INI text. Mark these two
manifest entries eager; `.SCN` in other games need not be the same format.
Chromium worker mode then reaches Select Stunt Quarry with the T-rific preview.
Race startup subsequently hit the same pending-read exception on
`SBIKE\\BIKE.MCF` (2,400 bytes). BIKE, RIDER and WINNER `.MCF` files are INI
animation descriptors and now load eagerly too.
With both classes eager, a fresh Chromium worker profile reaches the rendered
quarry race after a 60-second wait following Start: rider, terrain and HUD
are visible. Evidence is in `scratch/runs/20261013-mcm-worker-startup-after/`.
This is a race-entry smoke test, not a completed event or Safari validation.

The custom Enter Name field also needs `WM_CHAR 8` for Backspace. The browser
deliberately sends only its keydown/up because native EDIT already deletes
on keydown. TranslateMessage now supplies that missing character for non-EDIT
targets, preserving HWND and lParam; native EDIT retains one deletion per key.
The worker browser check types `Testabc`, presses Backspace twice, and visibly
shows `Testa`. TranslateMessage queue/metadata checks and the 12 Notepad editing
checks pass. These browser observations are Chromium, not a Safari rerun.

The video-memory prompt is controlled by the trial registry's
`DriverInfo\\{00000000-0000-0000-0000-000000000000}` cache. The EXE at
`0x465600` reads Driver, Version, Description and DeviceID and compares them
against current enumeration. After testing it writes NumberOfModes, Modes
(28 records of seven DWORDs in the observed run) and TextureSizes (16 DWORDs).
The captured modes include a viewport-derived 936x704 mode, so copying that
snapshot into universal defaults would freeze environment-specific results.
These values already persist in browser localStorage. KVDD's `OmitDriverCheck`
under the *non-Trial* key is a separate driver check; it is not evidence that
setting that value suppresses this texture-memory dialog. No default was
changed based only on the setting's name.

## Controller-profile lazy mount crash, 2026-10-13

The Safari report at 21:56Z on dashboard build `d19c10b7` fails in
`GetPrivateProfileInt` at guest EIP `0x004704a2`: `UI\\CONTROL.CTL` was an
async-only VFS entry. Both `CONTROL.CTL` and `PRESET.CTL` are 2,108-byte INI
files, beginning with `[Setup]` and `CurrentInputDevice=4`. The shared
app-file policy streamed this extension even though the profile APIs cannot
park on an async read. Keep `.ctl` controller profiles eager, like `.ini`;
other media remains streamed.

Chromium 155 on macOS, cooperative route `?debug&mm-thread=0`, 1280x900:
launch the registered `mcm`, press Enter on the video-memory prompt, wait
30 seconds. The control reproduces the same fatal dialog and guest EIP.
The candidate reaches the rendered Enter Name screen without that error.
Evidence: `scratch/runs/20261013-mcm-controller-profile-{before,after}/`.
This validates the reported startup failure only; it is not a fresh race,
Safari, audio, or performance qualification. App-file policy and MCM manifest
checks pass. No guest executable or configuration bytes were changed.

## Test route

The browser build can reach a live race without Wine. With a persisted profile,
the reliable 640x480 guest-coordinate route is:

1. `(310,441)` captures the mouse over the existing-profile screen.
2. `(445,45)` twice enters the main menu and Single Player Event.
3. `(350,442)` advances through track selection, rider selection, and Start.

The CLI-driven Puppeteer probe used during the 2026-08-30 investigation waited
45 seconds after Start in cooperative mode and 60 seconds in true browser
Worker mode. Both reached UI id 104 and rendered the quarry, rider, HUD, and
attached 16-bit Z surface. The Worker run was served with COOP/COEP isolation
and reported `hasWorker:true`; its loading phase is substantially slower but is
not stuck.

### Headless route (CLI, 2026-09-18)

A fresh profile reaches the race in the CLI with no browser. Batch numbers are
at the default `--batch-size`/`--tick-ms-per-batch`:

1. `200:dlg-cmd:1` answers the "test your video memory" MessageBox (it
   appears near batch 57; a `dlg-cmd` sent earlier finds no dialog).
2. The Enter Name box is up by batch 10000. Type with `keydown` + `keypress` +
   `keyup` per character. `keydown` alone types nothing: `TranslateMessage`
   does not synthesize `WM_CHAR` (the browser queues it from the keypress
   event), and MCM's edit field reads only `WM_CHAR`.
3. OK `(221,236)`, then Single Player Event `(445,45)`, pressed twice. Event
   Options is up by batch 22000.
4. Next `(338,442)` shows Select Stunt Quarry ("T-rific"), Next again shows
   rider/bike, then Start `(338,442)`.
5. Loading takes about 150000 batches: `quarry01.trn` (6.3 MB) is decoded in
   4 KB reads, then a terrain-grid visibility pass at `0x48c290` runs for about
   30000 batches with no file I/O. The race renders by batch 180000. Holding
   Up (`keydown:38` + `di-keydown:38`) drives the bike.

Use mousedown/mouseup a few dozen batches apart, and `--stuck-after` large:
the app parks in blocking waits that the default detector reads as a hang.
`--control=PORT --frozen` with `tools/ctl.js step N` / `png` drives it
without re-running the long boot for every click.

## File layout (why the manifest looks like this)

MCM opens media two ways: relative to the working directory (`ui\cursor.tga`,
`sbike\*.vub`, `ui\profile\*.*`) and rooted at the registry's
`HardDriveRootPath` (`<root>\ui\global.dat`, `<root>\audio\*.wav`). A real
install keeps the working directory and that root in one `Program Files`
directory. The registry entry therefore mounts every asset under
`C:\Program Files\Microsoft Games\Motocross Madness Trial\` and sets
`workingDirectory` to that directory. `run.js` takes the same default when
`--cwd` is absent.

- The media must not also appear under `C:\`. The scene list probes the CD
  root too, and with no CD that root is `""`, so the probe is
  `\teraform\quarries\Quarry01.scn`, which resolves against `C:\`. A hit in
  both places makes MCM's duplicate filter drop the only quarry, and Select
  Stunt Quarry comes up empty and black.
- Until 0d8d1727 (2026-09-04) the old split layout, with media at `C:\` and
  only `.SCN` files under the root, worked only because `createFile`'s basename
  fallback also applied to `C:` paths. Once that fallback correctly stopped
  doing so, MCM exited with code 1 right after the video-memory box, when it
  failed to open `<root>\ui\global.dat`.
- The remaining misses are real: the trial media has no `click01.wav`,
  `rand0N.wav`, `oh_01.wav`, `bonus.wav`, `ui\video\*.avi`, `unart.tga` or
  `quarry01.aid`.

## Rendering findings

- MCM submits legacy `D3DLVERTEX` records with the documented eight-DWORD,
  32-byte layout: XYZ, reserved, diffuse, specular, U, V. Treating the record as
  28 bytes shifts every vertex after the first and reads the reserved DWORD as
  diffuse colour.
- Direct `DrawPrimitive` receives projected vertices that can straddle the near
  plane. Drawing those triangles without reconstructing and clipping their
  homogeneous coordinates leaves camera-near holes containing old menu pixels.
  Clipping at `z=0`, then reprojecting the generated vertices, produces
  continuous terrain from the horizon to the rider. A positive reciprocal W
  does not make a vertex near-plane-visible: MCM also produces vertices with
  `rhw > 0` but `z/w < 0`. Classifying only by RHW sends those triangles to the
  raw rasterizer and creates giant landscape wedges and repeated billboard
  labels. The first correction classified those vertices correctly but still
  intersected every rejected edge with `z=0`. That is also insufficient: when
  a negative-RHW endpoint retains positive clip-z, the edge enters through the
  far plane `z=w`, and a forced near intersection collapses the visible part
  into a fan. The direct path now clips a bounded convex polygon against both
  homogeneous depth inequalities, `z>=0` and `z<=w`; together they imply a
  positive W. Pre-transformed UI records with `rhw=0` retain the raw path
  because their original homogeneous coordinates cannot be reconstructed.
- MCM enables `D3DRENDERSTATE_COLORKEYENABLE` and uses packed 16-bit source
  colour keys. A keyed sample is discarded before both colour and Z writes.
- MCM owns both a 640x480 race viewport and a 128x128 texture viewport on the
  same Direct3D device. `SetViewport` configures the addressed viewport object;
  it must not replace the device's cached transform rectangle when that object
  is inactive. Doing so changes the projection scale from `(320,240)` to
  `(64,64)` and compresses the rider and terrain toward the upper-left while
  long camera-near polygons fan across the rest of the frame. Selecting a
  viewport with `SetCurrentViewport` now restores that object's saved rectangle.
- The HUD uses paired system/video-memory surfaces. For example, the traced
  64x64 gauge source and destination were slots 406 and 407 with identical
  pixels. `IDirect3DTexture::Load` must copy the source-key flag and packed key
  to the destination, converting the key when the surface formats differ.
  Pixel-only loads leave the destination texture's `0xf81f` magenta background
  visible even though the renderer implements colour-key discard correctly.
- DirectDraw `Blt` must apply `DDBLT_KEYSRC` to nearest-neighbour stretches as
  well as equal-size copies. MCM exercises that path for scaled 2D art.

### Both D3DIM backends reach the race (2026-09-20)

The headless route above works verbatim on the WebGL D3DIM executor too — add
`--headless-gl --d3dim-gpu` (and hold the display awake with
`nohup caffeinate -d -u -t 2400 &`, or GLFW reports zero displays and
`D3DIMGpu._target` throws "WebGL is unavailable"). Both arms race; the
batch-60000 loading screen is **bit-identical** between them, and the batch-185000
race frames differ by 1.39% of pixels at `--tolerance=32` — the software arm's
terrain texture is blocky and dithered where the GPU arm's is filtered.

This corrects the `mcm NODRAW` row in
[docs/d3dim-gl-sweep-2026-09-19.md](../d3dim-gl-sweep-2026-09-19.md): MCM was
not failing to draw, it was parked behind the video-memory MessageBox that a
startup slice never answers. Captures and the full command are in
[docs/d3d-backend-coverage.md](../d3d-backend-coverage.md).

The focused coverage is in `test/test-d3dim-indexed-texture.js` and
`test/test-directdraw-cursor-background-restore.js`. The verified final race
screenshots from the investigation were
`/private/tmp/mcm-fixed-coop2-final-wait-45000.png` and
`/private/tmp/mcm-fixed-worker-final-wait-60000.png`.

### Original browser practice driving (2026-10-30)

Run `scratch/runs/20261030T2356Z-mcm-browser-race/investigation.json`
reached T-rific practice through the original profile and event menus with
trusted browser input. Inspected captures show the rider and textured terrain,
then motorcycle/camera movement under ArrowUp and a direction change after
ArrowUp+ArrowRight. The player score remained zero; scored stunts and event
completion were not tested. No guest code or original asset was patched.

The loaded retained canonical module was SHA-256
`d83e413fbc38ca5aa5447a7be62d10010783fd5490c98ec07c076553897950e5`
(source fix `de2e338c4`, not a build of current HEAD). The browser used D3DIM
WebGL with guest threads disabled, Chrome 151 and ANGLE SwiftShader launch
flags; the actual vendor string was not queried. GPU counters reported zero
errors and fallbacks. All 311 registered inputs remained unchanged, and
served-response hashes were verified in `verification.json`. A resource 404
was logged without an identified request, but did not prevent this checkpoint.
The browser and both local servers were verified closed and its private profile
removed. This adds a current short-driving observation, not full gameplay or
software/WebGL parity acceptance.

### Native scored-stunt attempt: launch disk blocker (2026-11-01)

Run `scratch/runs/20261101-motocross-scored-stunt/` stopped before launching
an original. After Incoming's fresh final/result and 10:20:11 UTC explicit
runtime/source/build release, the identity gate at 10:21:30 pinned main
`16f6dd8868f12a5818aab1af649bee8cfddf03f9`. The native launch preflight at
10:22:00 measured **2,139,860,992 available bytes on /home**, below the
required 2,200,000,000-byte startup minimum by **60,139,008 bytes**. It refused
launch before process creation. The worker's earlier 10:07 startup measurement
was 2,201,370,624 bytes; that earlier pass does not establish sufficient disk
at native launch. The continuous 2 GB floor was still met. No foreign cleanup,
retry, source repair, configuration edit or asset modification was attempted.

Before/after SHA-256 inventories match for all 311 original-tree files plus
the registration manifest `lib/apps.js`; the eight original CTL/INI/SCN/MCF
configuration files are also retained byte-for-byte. `MCM.EXE` is 1,029,632
bytes, SHA-256
`f0370d1d526be46eaf6ea5f941f185a393a8432baec695e1529f8672a314a71b`;
the manifest SHA-256 is
`cb645b1043738ac611d34d11679dce01afc54bf4e7bb86eeb2e9162ef4e0d857`.
All 4,444 inventoried source/build files match before/after. The accepted
build's 4,392 source pins and 141 prior actual-read hashes match current files,
including canonical module SHA-256
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
This is a build-reuse identity check, **not a native game execution observation**.
The October 30 browser evidence remains attributable only to its older
`d83e413f` module.

The retained observer passed actual synchronous/asynchronous scratch-Wasm
execution, whole shared 512 MB memory immutability, host/native clock identity,
and emitted late-event retention after 10,001 events. Its coverage excludes
async file reads, streams, mmap and loader-internal reads; descriptor hashing
requires complete reads of files at most 24 MiB. No actual native game module
or runtime file reads exist for this attempt. No WM/keyboard/DirectInput input
was consumed, and there are no new gameplay PNGs, scored stunts or event
progress. Shipped `HELP/HELP.HTM` documents airborne Z+W as Heel Clicker and
X+W as Bar Hop; these controls were read, not exercised. The scratch watcher
was terminated and no game PID/group or new temporary directory was created;
local box ID/state/expiry are N/A. Evidence is in `launch-preflight.json`,
`gate.json`, `verification.json`, `observer-validation.log`, and `cleanup.json`.
The next prerequisite is restoring the native startup disk margin before a
fresh bounded ordinary-control attempt; this result adds no playability,
audio, FPS, GPU, full-event or full-corpus claim.

### Native Single Event results; scored stunt remains open (2026-11-01)

Run `scratch/runs/20261101-motocross-scored-stunt-owner-floor/` launched two
originals after Incoming helicopter worker `01a196a2` supplied fresh terminal
files and its 10:26:31 UTC explicit runtime/source/build release. The actual
gate at 10:27:27 UTC pinned main `5adc9e915` (after baseline `3cddaa00c`).
The owner's >1.5 GB disk rule superseded the earlier 2.2 GB startup refusal;
no foreign cleanup or RAM gate was used. Both runtime minima also exceeded
2 GB: **2,097,991,680** and **2,069,643,264 bytes**. Logs were gzip bounded
at 32 MiB. Both runs used the unchanged registered `mcm`, stock working
directory and local CLI software renderer; no browser or GPU run occurred.

The second original used the Enter Name/menu route, then clicked the Event
Options right arrow at `(366,82)` to change **Practice → Single Event**.
`scored-event-selected.png` records that selection. `before-event.png`
records the quarry with opponent scores 5,500/2,000 and player A at zero;
`event-results.png` at batch 37,900 records **Race Results: GLENN 5,500,
ALBERTO 7,500, A 0**. Continue returned to the event menu. This is fresh
native event progression beyond the October 30 practice checkpoint, **not a
player-scored stunt**. The timer already displayed 00 in that first quarry
capture: it does not establish a normally paced four-minute event.

The first original was stopped cleanly after 128.552 seconds: the retained
route's 10,000 startup batches were mistakenly issued at 100,000 blocks per
batch, 100 times the documented default. The concrete second hypothesis
restored 1,000 blocks per batch for that route; loading/gameplay subsequently
used the existing `set-batch-size:100000` control. The second original ran
417.045 seconds and exited 0. Within that same process, another Single Event
was entered after changing the existing harness tick cadence from 200 to 2 ms,
then 10 ms. `timed-live.png` retains the starting countdown with zero scores.
Up, S (lean back), and shipped Z+W (Heel Clicker) were exercised through normal
WM/keyboard/DI controls. The later ramp/air/stunt/release captures are retained,
but `air-heel2.png` and `air-land.png` show a crash with rider and bike
separated; `settled-score.png` still shows player A at zero. No clean stunt
landing or points are inferred from those poses or filenames.

Actual consumption is recorded in `runtime.log.gz` and
`manual-controls.ndjson`. Before the first throttle, WM dequeue/route/dispatch
counters were 24/24/17; after throttle they were 25/25/18, after Z+W
27/27/20, and at final release 57/57/45 with empty input queues. Actual
keyboard `GetDeviceState` calls used device `0x08221180`, length 256, return
site `0x451132`; `GetDeviceData` returned success at `0x45119c`/`0x4511ec`.
The active keyboard buffer's sequence/head advanced to 11/11 after the later
Z+W and ended sequence 20, head 5, empty, without overflow. Up/S/W/Z physical
and asynchronous key states were all false on final release. These observations
establish consumption; they do not establish a successful stunt.

The EXE and manifest hashes remain respectively
`f0370d1d526be46eaf6ea5f941f185a393a8432baec695e1529f8672a314a71b` and
`cb645b1043738ac611d34d11679dce01afc54bf4e7bb86eeb2e9162ef4e0d857`.
All 311 original-tree files plus the manifest, and all 4,444 inventoried
source/build files, match before/after. Full original/config trees are retained
in SHA-verified `original-before.tar.gz` and `original-after.tar.gz`. Reuse of
the accepted build matched its 4,392 source pins and 141 prior reads. Both
actual runtime compile observations identify canonical module
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`;
134/302 actual runtime file-read records also match. The observer covers
synchronous reads and complete descriptor reads up to 24 MiB, excluding async
reads, streams, mmap and loader-internal reads. Its scratch execution,
whole-512-MB immutability, clock identity and late-event retention checks pass.

`test-mcm-manifest-paths.js` passes. Two unchanged input fixtures fail because
their extracted contexts lack `mainSchedulerObserver` and `hasFlag`; exact
failures are retained in `test-results.json` and associated logs. No tracked
source/helper/test/config/registration/backend change or rebuild was made.
Both game PIDs, drivers and process groups are absent; no watcher was created
and no new `wa-child-*` temporary directory remains. Local box ID/state/expiry
are N/A. A scored stunt still requires a controlled takeoff and clean landing;
this result adds no full-playthrough, audio, FPS or full-corpus claim.
