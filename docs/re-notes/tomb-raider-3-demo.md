# Tomb Raider III demo (India / Jungle)

Core Design's 1998 Windows playable demo, `tr3_demo_01.exe` from
tombraiderchronicles.com. The installer archive is extracted statically
(7z for the WinZip SFX, then `unshield -O` on `data1.cab`); provenance, URLs
and hashes are in `test/binaries/candidates/tomb-raider-3-demo/provenance.json`.
Registry id `tomb_raider_3_demo` (localhost-only).

- `tomb3.exe` 920,064 bytes, sha256 `8c7b2546...7814`, image base `0x400000`.
  Nine companion files under `data\` and `pix\`; the
  game opens them relative to its own directory, so the registry entry mounts
  them at `c:\data\...` and `c:\pix\...` (a plain string entry would land at
  `c:\<name>` and the game stops at "GameMain: could not load script file").
- Imports DDRAW (DirectDraw2 + IDirect3D2 by QueryInterface), DINPUT, DSOUND,
  WINMM, MSACM32. No Glide.

## Route (headless, default 200 ms/batch clock)

```
node test/run.js --app=tomb_raider_3_demo --quiet-api --quiet-blocks \
  --max-seconds=90 --max-batches=68001 --stuck-after=0 --no-close \
  --input=8:dlg-cmd:1,40:dlg-cmd:1,18000:keydown:13,18100:keyup:13,\
19000:keydown:13,19100:keyup:13,62000:keydown:38,67000:keyup:38,68000:png:out.png
```

| batch | screen |
|---|---|
| ~5 | dialog 110, "Welcome to the playable demo" (OK = 1) |
| ~35 | dialog 115, setup: Direct3D HAL, 640x480x16, ZBuffer (OK = 1) |
| ~6000 | Title.bmp. Batches 6000-17000 are CPU-bound bitmap conversion (the loop at `0x4a3536`), not a wait. |
| ~17000-22000 | title ring, passport selected ("Game"). Enter opens it on "New Game"; Enter again starts. |
| ~23000 | left idle, the ring times out into the `jungle.DEM` attract demo. Any key there aborts back to the title. That is why a key pressed "in game" looked like it reset the run. |
| ~25000 | INDIA.BMP loading screen |
| ~45000 | Jungle start, with a Controls overlay that any key dismisses |
| 62000+ | VK_UP runs Lara forward down the path |

## Emulator gaps fixed (commit c0081348)

- `0x4808d1`: `mov eax, cr4` (`0F 20 E0`) in the CPUID probe at `0x480840`.
  It tests CR4.PCE (bit 8) and, when CPUID says TSC, CR4.TSD (bit 2). Win9x
  emulates the ring-3 read; NT faults (the known TR3 "privileged instruction"
  crash on 2000/XP). Decoded as `mov r32, imm32` with fixed Win98 values.
- `acmDriverEnum` from `0x46f930`: the callback at `0x46fb70` calls
  `acmDriverDetailsA` and compares `szShortName` with `"MS-ADPCM"`
  (`0x4b8fb4`). Without a match it returns false and the caller at
  `0x4a3b47` ignores it, so the game runs with no ADPCM decode path. Since dc7e8454d
  the ACM lists MS-ADPCM, and the game finds it and calls `acmDriverOpen` on
  it at startup. No ADPCM stream was opened through the passport route
  (26000 batches, 2026-10-11), so where TR3 decodes with it is still unknown.
- ZENABLE. TR3 never sets `D3DRENDERSTATE_ZENABLE`; it relies on the
  DirectX default (TRUE when a depth surface is attached to the render target
  at CreateDevice). With our old FALSE default every room drew without a depth
  test and most of each frame stayed at the black Z-only clear (the per-frame
  Viewport2::Clear is `D3DCLEAR_ZBUFFER` only).

Draw shape for reference: about 16 `DrawPrimitive(TRIANGLELIST, TLVERTEX)`
calls per frame, one per texture page (`SetRenderState(TEXTUREHANDLE)`), with
TL `sz` in 0.97-0.99, `rhw` 0.2-2.6 and specular 0.

## Open, not blocking gameplay

- The INDIA loading picture is cross-faded over the first seconds of the
  level, and stays visible longer when input dismisses the Controls overlay
  early. Not yet compared with real hardware.
- Passport pages on the title ring draw as untextured pastel gradients.
- FPS not measured; browser not tried.

Evidence: `scratch/runs/20261005T222600Z-tomb-raider-3-demo-claude202b4b39-jungle`
(dirty tree) and `...-jungle-c0081348` (committed build, byte-identical PNGs).

## Parked follow-ups (2026-10-06)

Partly investigated, not fixed:

- **Passport pages untextured.** The open passport is a TRIANGLELIST under
  `TEXTUREHANDLE` 0x18. TR3 creates 32 video-memory textures up front
  (`GetHandle` returns handles 0x0-0x1f, DX slots 16-47) and by the passport
  has made only 14 `IDirect3DTexture2_Load` calls. Slots 16-24 (handles
  0-8) have content; slots 25-47 (handles 9-0x1f), including handle 0x18's,
  are all zero (`--dx-surfaces`, batch 18500). Open question: are those Loads
  failing or skipped in our D3DIM, or does the game fill that page some other
  way, for example by Lock/Unlock on the video surface?
- **INDIA loading picture over gameplay.** The loading BMP fades out over the
  first seconds of the level, and stays longer when input dismisses the
  Controls overlay early. Not compared with hardware.
- **Audio.** The MS-ADPCM codec is found and opened (dc7e8454d); no stream
  use seen yet on the passport route.

Repro for the passport: `--app=tomb_raider_3_demo --input=8:dlg-cmd:1,40:dlg-cmd:1,18000:keydown:13,18100:keyup:13,18500:png:out.png --dx-surfaces`.

## Page route (claude:202b4b39, 2026-10-06)

The page reaches Jungle gameplay on WebGL; an earlier "title only" result was
route timing, not input (scratch/runs/20261006T2030Z-tr3-web-title-input).
With `web-input-probe --gpu`: OK both startup dialogs, then the title ring is
up ~28 s later and, left idle, times out into the `jungle.DEM` attract demo
by ~60 s (any key there returns to the title). Press Enter (hold ~300 ms)
while the ring is up to open the passport on New Game, wait ~6 s for the
passport to finish opening (a press 3 s in is swallowed by the animation),
Enter again, and Jungle loads with its Controls overlay; one key dismisses
it and Up runs Lara forward.

## Performance (2026-11-14)

Same root cause as TR2 (see `tomb-raider-2-demo.md`, "Performance"): on the
WebGL path the per-primitive `_storeNative16` pass in `lib/d3dim-gpu.js`
costs whole-run `drawMs` 7.1 s vs 2.1 s without it (title ring, attract
demo and INDIA load, 30000 batches, `scratch/runs/20261114-tr-perf/t3-*.log`).
Jungle gameplay (batch ~45000+) was not profiled: it is past the 60 s run limit.
