# Tomb Raider II demo (Venice)

Core Design's 1998 Windows playable demo, `tr2_demo_02.exe` from
tombraiderchronicles.com, a WinZip SFX opened with 7z without running it.
Provenance and hashes: `test/binaries/candidates/tomb-raider-2-demo/provenance.json`.
Registry id `tomb_raider_2_demo` (localhost-only).

- `game/TOMB2.EXE` 909,824 bytes, sha256 `0811efa8...33aa`, entry `0x459630`.
- Data: `DATA\DEMOPC.DAT` (script) and `DATA\BOAT.TR2` (the Venice level),
  mounted at `c:\DATA\...`. `readme.txt` and `Settings.lnk` are not needed.
- Imports DDRAW (DirectDraw2 + IDirect3D2), DINPUT, DSOUND, WINMM and
  COMCTL32, which it uses for its options property sheet. The real
  comctl32.dll from `test/binaries/dlls` loads through `lib/dll-registry.js`.
  Without it (a fresh worktree is missing the gitignored DLLs) the sheet
  falls back to WAT stubs and looks like a wizard.

## Route (headless, default 200 ms/batch clock)

```
node test/run.js --app=tomb_raider_2_demo --quiet-api --quiet-blocks \
  --max-seconds=60 --max-batches=26001 --stuck-after=0 --no-close \
  --input=700:mousedown:379:398,720:mouseup:379:398,\
21000:keydown:37,22500:keyup:37,22600:keydown:38,26000:keyup:38,26000:png:out.png
```

| batch | screen |
|---|---|
| ~10 | options property sheet (Graphics tab: Hardware 3D Acceleration, 640x480 High Color, Z Buffer) |
| 700 | **mouse** click on OK at (379,398). `--input=N:dlg-cmd:1` reaches the sheet's hwnd but does not close comctl32's own property sheet. |
| ~6000 | Venice alley, Lara idle. No title menu in this demo. |
| 21000+ | Left turns her round to face the camera; Up then runs her down the other alley, where a doberman attacks and the health bar appears |

No emulator change was needed: it ran on origin/main 9c9dc59d, which already
had the TR3 fixes (MOV r32,CRn, the ACM driver enumeration, the D3D ZENABLE
default). Holding Up from the start position moves her only a step and then
she stops facing the slope ahead (not investigated); turning first and then
running is the clean movement check.

## Not evaluated

Audio, FPS, browser.

Evidence: `scratch/runs/20261005T224500Z-tomb-raider-2-demo-claude202b4b39-venice-fcf8f2f1`.

## Performance: why it is slow, and which settings help (2026-11-14)

Evidence: `scratch/runs/20261114-tr-perf/` (commit 522ab4035, canonical wasm
sha256 `e017b4a4...`, profiled with a `--names` build of the same source,
`wa.named.wasm`). Headless M1, laptop at load ~10-12, so only same-run ratios
and large effects below are trusted. Fixed work = batches 7000..10000 of the
route above with `--tick-ms-per-batch=2` (Lara idle in the alley, 91 frame
ends in every 640x480 arm). `--cpu-window` user+sys CPU; never fps.

**Settings live in `HKCU\Software\Core Design\Tomb Raider II\System`**
(written by the options sheet on OK; nothing in lib/apps.js seeds them):
`RenderMode` (2 = Hardware 3D Acceleration, 1 = Software 256 Colour),
`PerspectiveCorrect`, `Dither`, `ZBuffer`, `BilinearFiltering`,
`TripleBuffering`, `FullScreen`, `FullScreenWidth/Height/BPP`, `WindowWidth/Height`,
`DontSortPrimitives`, `TexelAdjustMode`, `Disable16BitTextures`, `FlipBroken`.
Defaults after OK: HAL, 640x480x16, Z, dither, bilinear, perspective all on.
`--reg-import` of an edited `--reg-export` applies them (generator
`reg-variant.js` in the run folder). The sheet's mode list is ours
(`$handle_IDirectDraw_EnumDisplayModes`): 320x200 8-bit and 640x480 and up,
each listed twice; there is **no 16-bit mode below 640x480**. Forcing
`FullScreenWidth/Height` to 320x240 or 512x384 in the registry still runs
640x480 and draws every texture with wrong colours (m-320.png / m-512.png):
an unlisted mode is not a usable setting.

| Arm (CLI) | CPU, 3000-batch window | per frame | Note |
|---|---|---|---|
| WAT software raster (CLI default), defaults | 2.46-3.3 s | ~29-36 ms | raster ~62% of CPU |
| same, bilinear/perspective/dither off (`lowq`) | | | raster -15% (profile ratio); single toggles within noise |
| game Software 256 Colour renderer (`RenderMode=1`) | 1.18 s for **8** frames | ~147 ms | game's own x86 rasterizer, 5x worse |
| `--d3dim-gpu --headless-gl` (browser default WebGL path) | 6.0-6.3 s | ~67 ms | `_storeNative16` dominates |
| same, native16 storage skipped (experiment patch) | 2.2-2.4 s | ~25 ms | picture identical by eye |

Where the time goes:

- **WebGL (browser default):** `lib/d3dim-gpu.js` `_submitImmediate` on a
  16-bit target (since 23e0990db, 2026-11-06) draws every primitive alone
  (blended, or a draw of <32 primitives) or in groups of 32, and after each
  runs `_storeNative16`: `copyTexSubImage2D` of the target plus a quantizing
  full-target quad, with a `gl.getError()` per submission. TR2 issues ~116
  draws / ~480 triangles per frame, so that is hundreds of copy+quad passes
  and ~116 sync `getError`s per frame. Whole-run `drawMs` 15.0 s with it, 4.1 s
  without (TR3 title/attract: 7.1 s vs 2.1 s); window CPU 2.7x. In Chrome each
  `getError` is a GPU-process round trip, so the browser cost is worse than
  this native-GL measurement. The 2026-11-07 browser run's 65 flips in 42.7 s
  (`tr2-webgl-gameplay-20261107.md`) is consistent with it. Every Flip also
  reads the frame back to the DIB and the next Clear uploads ~250 rows back.
- **Software raster** (`?d3d-renderer=software`): `$viewport_draw_textured_span`
  (src/09ab-handlers-d3dim-core.wat) is 46% of all samples / ~95% of raster time:
  a generic per-pixel loop with two `f32.div` per pixel, and calls per pixel
  for combine, depth compare, stencil/stipple and blend.
- **Guest x86** is small: th_ handlers + uop + x87 folds ~12-15% of CPU. The
  interpreter is not the bottleneck in either renderer.

Candidate fixes, by expected gain: (1) native16 only where it is observable:
quantize once before a blended draw that reads unquantized pixels, and at
fence/readback, and check `getError` once per fence (expected: the WebGL path
back to ~the no-native16 arm, ~2.7x less CPU per frame); (2) a specialised
span for TR's common state (16-bit RT, 16-bit texture, modulate, Z LE,
no stencil/stipple) with perspective divides every 8-16 pixels; (3) enumerate
512x384 and 320x240 16-bit modes so a lower render size becomes a real
option (software raster is per-pixel bound). In-game quality toggles are
worth ~15% at most on the software raster and nothing on WebGL; do not use the
game's Software 256 Colour renderer.

### Fix: full colour on the GPU (2026-11-14)

`lib/d3dim-gpu.js` now keeps RGBA8 on the GPU for 16bpp targets and reduces to
native bits only at readback; the per-primitive native store survives only for
destination-alpha blends on A1R5G5B5/A4R4G4B4 (and `exactNative16: true`, used
by the bit-exact contract tests). Same route, same 91 frames, same load:
old 5.45 s CPU / 6.36 s wall, new 2.10 s / 2.05 s; `FullScreenBPP=32`
(true colour) 2.03 s / 1.94 s. Frames look identical by eye.
Evidence `scratch/runs/20261114-tr2-full-colour/` (hw16, hw32, old16 logs+PNGs).
