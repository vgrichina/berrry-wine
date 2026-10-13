# Motocross Madness demo

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
