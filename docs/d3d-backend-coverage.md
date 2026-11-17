# D3D backend coverage: what actually draws on each backend, 2026-09-20

First pass at the D3D backlog item "gameplay captured on both rendering
backends". Its job is *coverage*, not agreement: which apps put a 3D frame on
the screen when the GPU path draws, which do it on the software path, and which
do neither — with the picture as the oracle, not a draw counter.

All headless CLI, no browser. Captures in `build/d3d-backend-coverage/`
(gitignored), named `<app>-<mode>-canvas.png` (the composited screen, what a
user sees) and `<app>-<mode>-surface.png` (the DirectX surface `--png` prefers).

## The two backends, and what "gpu" and "software" mean here

Two unrelated control surfaces, unified in `index.html`'s `D3D_MODES` into one
dropdown (`webgl`, `webgl-all`, `software`):

| family | browser knob | CLI, gpu arm | CLI, software arm |
|---|---|---|---|
| DX2-7 (D3DIM), `lib/d3dim-gpu.js` | `window.WINE_D3DIM_GPU` | `--headless-gl --d3dim-gpu` | *(no flags)* |
| D3D8/9, GPU stream v2 (`src/09akg-d3d9-gps.wat` → `lib/gpu-stream-host.js`) | `window.WineD3D.renderer` / `?d3d9-gps=` → `ctx.d3d9GpsBackend` | `--headless-gl` (or `--d3d9-gps=webgl`) | `--d3d9-gps=software` (`--d3d9-renderer=software` is an alias) |

Since d3d9-retire S4 (2026-11-17) the old JS D3D8/9 path (`lib/d3d9-host.js`)
is deleted; `--d3d9-gps=none` runs with no executor and `--no-d3d9-gps` /
`--d3d9-gps=off` are errors. `--headless-gl` is how the CLI reaches the WebGL
executor.

**`--headless-gl` needs a live display.** `caffeinate -u` alone is not enough —
two runs in this sweep died with `No suitable display found for a new GLFW
Window` → `*** CRASH: WebGL is unavailable` from `D3DIMGpu._target`. Hold the
display with `nohup caffeinate -d -u -t 2400 &` and re-run; both then passed.
A GPU-arm crash inside `d3dim-gpu.js` is this environment failure until the
`[gl] ... GLFW sees ZERO displays` line is ruled out.

## Results

`gameplay` = a live 3D scene reached through an input route. `menu` = a real
screen but not gameplay. `blank` = the window draws no geometry at all.

| app | family | gpu | software | note |
|---|---|---|---|---|
| **mw3** (MechWarrior 3 demo) | D3DIM | **gameplay** | **gameplay** | both reach the cockpit; terrain hue differs (see below) |
| **gta2_demo** | D3DIM | **gameplay** | **gameplay** | Wild Demo playfield on both; GPU arm is visibly smoother |
| **mcm** (Motocross Madness trial) | D3DIM | **gameplay** | **gameplay** | live race on both; GPU arm filters the terrain texture |
| **pawn** (Pawn 3 chess) | D3D9 | **gameplay** | **CRASH** | see the Pawn row below |
| dx_boids | D3DIM | blank | blank | 84,869 GPU draws / 5.7M triangles and the frame is **one colour** |
| dx_flip3dtl | D3DIM | blank | blank | 115,686 GPU draws; frame is black + a yellow text overlay |
| dx_twist | D3DIM | blank | blank | draws=0 both arms; black + fps text |
| dx_tunnel | D3DIM | blank | blank | draws=0 both arms; black + fps text |
| dx_globe | D3DIM | blocked | blocked | modal `Failed to load sphere3.x / D3DRMERR_BADFILE`, then STUCK |
| dx_viewer | D3DIM | blocked | blocked | modal `Failed to load camera.x / D3DRMERR_BADFILE`, then STUCK |

### Differences between the backends, measured

Pixel-diff percentages at tolerance 0 are meaningless on a textured 3D scene —
every 565 rounding step counts. Each row below is quoted at `--tolerance=32`
beside that app's own null band (the same arm run twice), which is the only
scale that makes the number readable.

| app | backend diff (tol=32) | null band (tol=32) | what changed |
|---|---|---|---|
| mw3 | **4.07%** | 0.026% | terrain is **green** on software, **brown/tan** on GPU; sky and HUD agree |
| gta2_demo | **1.59%** | **0.000%** (bit-identical rerun) | glyph and sprite edges; GPU arm smoother |
| mcm | **1.39%** | not measured (see below) | terrain texture filtering: blocky/dithered on software, smooth on GPU |

For MCM the null band was not run (the route is ~185,000 batches), but the two
arms' batch-60000 loading-screen captures are **bit-identical** (0 of 307200
pixels differ), which is strong evidence the route itself is deterministic and
the 1.39% at batch 185000 is the backends disagreeing.

MW3's is the one that looks like a bug rather than a filtering choice: the same
terrain texture comes out a different hue, not a different sharpness.

### Pawn: the D3D9 software backend crashes

Pawn plays on the GPU arm — the e-pawn drag lands, the engine replies, and the
yellow last-move outline is in the capture. On `--d3d9-renderer=software` it
gets a device, clears, presents once, and then:

```
[API] IDirect3DSurface9_GetDC
[1658] EIP=0x075030d8 EAX=0x8876086c ...
[API] IDirect3DSurface9_GetDC
[eip-zero] guest called through NULL at batch 1764
  dbg_prev_eip=0x0041c100
```

`EAX=0x8876086c` is `D3DERR_INVALIDCALL`: the second
`IDirect3DSurface9::GetDC` on the back buffer fails, Pawn calls through the
NULL HDC it gets back, and the guest dies at `0x0041c100`. The window is left
showing its caption and menu over an empty grey client area
(`pawn-software-canvas.png`). Adding `--d3d9-programmable` changes nothing.
Pawn draws its whole board through that `GetDC`, so this is the one call that
has to work for it.

## Repro commands

Every run: `--no-build`, `--quiet-api`, `--no-close`, an explicit
`--max-seconds`. GPU arms need `nohup caffeinate -d -u -t 2400 &` first.
`O=build/d3d-backend-coverage`.

**mw3** — route copied from `test/test-mw3-gameplay.js` (abbreviated `$ROUTE`
below; it is the 33-event list in that file plus `950:png:$O/mw3-<mode>-canvas.png`):

```bash
node test/run.js --app=mw3 --no-build --no-threads --copy-superops \
  --quiet-api --quiet-blocks --batch-size=200000 --max-batches=1020 \
  --max-seconds=220 --no-close --dx-slot=5 \
  [--headless-gl --d3dim-gpu] \
  --png=$O/mw3-<mode>-surface.png --input="$ROUTE"
```

**gta2_demo**

```bash
node test/run.js --app=gta2_demo --no-build --quiet-api --quiet-blocks --no-close \
  --max-batches=4500 --batch-size=1000 --max-seconds=180 --dx-slot=7 \
  [--headless-gl --d3dim-gpu] \
  --input=3000:di-keydown:13,3100:di-keyup:13,4400:png:$O/gta2_demo-<mode>-canvas.png \
  --png=$O/gta2_demo-<mode>-surface.png
```

**mcm** — route from `docs/re-notes/motocross-madness-demo.md`:

```bash
node test/run.js --app=mcm --no-build --quiet-api --quiet-blocks --no-close \
  --max-batches=200000 --max-seconds=300 --stuck-after=100000000 --dx-surfaces \
  [--headless-gl --d3dim-gpu] --png=$O/mcm-<mode>-surface.png \
  --input='200:dlg-cmd:1,10000:keydown:65,10005:keypress:65,10010:keyup:65,10400:mousedown:221:236,10440:mouseup:221:236,12000:mousedown:445:45,12040:mouseup:445:45,14000:mousedown:445:45,14040:mouseup:445:45,24000:mousedown:338:442,24040:mouseup:338:442,26000:mousedown:338:442,26040:mouseup:338:442,28000:mousedown:338:442,28040:mouseup:338:442,60000:png:'$O'/mcm-<mode>-early.png,185000:png:'$O'/mcm-<mode>-canvas.png'
```

**pawn** — route from `test/test-pawn-directinput7-gameplay.js`:

```bash
# gpu
node test/run.js --app=pawn --no-build --headless-gl --screen=1024x768 \
  --max-batches=9000 --max-seconds=120 --quiet-api --no-close \
  --png=$O/pawn-gpu-surface.png \
  --input='800:mousemove:552:409,1000:mousedown:552:409,1200:mousemove:552:365,1400:mousemove:552:321,1600:mouseup:552:321,1800:mousemove:900:600,8800:png:'$O'/pawn-gpu-canvas.png'
# software (crashes at batch 1764)
node test/run.js --app=pawn --no-build --d3d9-renderer=software --screen=1024x768 \
  --max-batches=9000 --max-seconds=120 --quiet-api --no-close \
  --png=$O/pawn-software-surface.png --input=<same>
```

**DX SDK samples** (`dx_boids`, `dx_twist`, `dx_tunnel`, `dx_globe`,
`dx_flip3dtl`, `dx_viewer`)

```bash
node test/run.js --app=<id> --no-build --quiet-api --quiet-blocks --no-close \
  --max-batches=3000 --batch-size=100000 --max-seconds=60 \
  [--headless-gl --d3dim-gpu] --dx-surfaces \
  --png=$O/<id>-<mode>-surface.png --input=2900:png:$O/<id>-<mode>-canvas.png
```

## What this contradicts in the 2026-09-19 sweep

[docs/d3dim-gl-sweep-2026-09-19.md](d3dim-gl-sweep-2026-09-19.md) is not wrong
about its own arms; it is measuring something narrower than its table reads as.

1. **"dx_boids / dx_flip3dtl IDENTICAL, 0% diff" is two blank screens agreeing.**
   Measured here with `tools/png-inspect.js stats`: dx_boids' composited frame
   is **one distinct colour** (`#000c18`, 307200 px) on *both* backends, while
   the GPU executor reports 84,869 draws and 5,760,818 triangles. dx_flip3dtl is
   two colours — black plus its yellow text overlay — with 115,686 GPU draws.
   The triangles are being drawn and never reach anything the user sees. An
   IDENTICAL verdict on a one-colour frame is not evidence of agreement, and
   this is the largest thing the sweep's diff-only method cannot see.
2. **"mcm NODRAW" was a modal, not an absence of 3D.** MCM greets a fresh
   profile with a "we must now test your video memory" MessageBox; a startup
   slice never gets past it. `200:dlg-cmd:1` plus the re-note's route reaches a
   **live race on both backends**. Same for `mw3`, which the sweep scored
   IDENTICAL from a menu and which actually disagrees by 4.07% at gameplay.
3. **"eleven of sixteen never drew a triangle" is the right headline but the
   wrong diagnosis for at least two of them.** dx_globe and dx_viewer do not
   fail to draw — they die on a modal `D3DRMERR_BADFILE` (`sphere3.x`,
   `camera.x`) and then STUCK in a thunk. That is the known `.x` file loader
   asset gap, not a renderer question, and no budget or route fixes it.
4. **The sweep's headline number for GTA2 was menu text; at gameplay it is
   1.59% at tol=32 against a bit-identical null band.** Both arms show the Wild
   Demo playfield, so this is a fidelity difference, not a coverage one.

## Addendum 2026-09-22: three "blocked/blank" rows are stale

The **software** arm only (no `--headless-gl`), 120000 batches, `--dx-surfaces`
to pick the surface, after `8b227b5c` made execute-buffer triangles back-face
culled. The GPU arm of each is *not* re-measured here.

| app | this doc's row | software arm today |
|---|---|---|
| `dx_flip3dtl` | blank, black + yellow text overlay | **draws** — the textured flipping Win95 95/blue panels, HUD reads `FPS 00 Frame 16889 (HAL)` |
| `dx_globe` | blocked, `D3DRMERR_BADFILE` modal then STUCK | **draws** — lit textured sphere, no modal |
| `dx_viewer` | blocked, `D3DRMERR_BADFILE` modal then STUCK | **draws** — two lit quads, no modal |

The `.x` loader gap those two were blocked on has since been closed (see
`docs/re-notes/dx-sdk-d3drm-samples.md`), so item 3 under "What the sweep got
wrong" is itself now out of date.

`dx_flip3dtl` is the interesting one, because this doc had already narrowed it
correctly — "the executor *is* drawing, so the loss is between the render target
and the primary". It was neither: the triangles reached the primary all along
and were **black**, because a back face shades to black by construction and
nothing culled it. A one-colour frame and a two-colour frame both read as "no
geometry arrives", which is exactly the blind spot item 1 warns about.

Read `colors=` from `--dx-surfaces` with care on these: it samples a fixed
1850-point grid over the whole surface, so `dx_globe`'s healthy lit sphere
reports `colors=29 nonZero=38/1850` purely because the sphere is small.

## Blocked, and why

- **dx_globe, dx_viewer** — `D3DRMERR_BADFILE` on `sphere3.x` / `camera.x`.
  Asset/`.x`-loader gap (see the `dx_viewer` note in the DX re-notes), identical
  on both backends. Not a backend question until the loader lands.
- **dx_boids, dx_flip3dtl, dx_twist, dx_tunnel** — no geometry reaches the
  composited frame on either backend, so there is nothing to compare. Worth
  chasing on its own: for boids and flip3dtl the executor *is* drawing, so the
  loss is between the render target and the primary, not in either rasterizer.
- **pawn on software** — crashes (above). The GPU arm is the only D3D9 gameplay
  capture in this sweep.
- **black_white_2_demo** — the only other D3D9 title in the registry. Not
  attempted: `docs/re-notes/black-white-2.md` already records that it does not
  reach gameplay, so it cannot produce a gameplay row on either backend yet.
- **darkstone_demo, heroes3_demo, jazz2_demo, aoe2, captain_claw_demo, spider,
  pocket_tanks, halflife_uplink, deus_ex_demo** — not covered here. Each needs
  either a multi-minute `--control-stdin` route (darkstone) or is a 2D
  DirectDraw title whose D3DIM draw count was already zero; both are a second
  pass, not a budget increase. deus_ex_demo ships configured for
  `SoftDrv.SoftwareRenderDevice`, so it is not a D3D backend comparison at all.

## Method notes worth keeping

- `--png` prefers a DirectX surface over the composited desktop and will show a
  perfect 3D frame while the window is empty grey (that is exactly Pawn's old
  failure mode). The `N:png:FILE` **input action** always captures the
  composited screen, so one run yields both: `--png=…-surface.png` plus
  `--input=N:png:…-canvas.png`. Where the two differ, the canvas is the honest
  one. In this sweep they agreed for every app that drew.
- Judge "did it draw" with `node tools/png-inspect.js stats <png>` — distinct
  colour count — before reading any diff percentage. `--dx-surfaces`'s
  `colors=` column is *sampled* and reported 1 for frames that turned out to be
  genuinely uniform, but it is a sample, not a census.
- Diff a textured 3D frame at `--tolerance=32` and always alongside that app's
  own null band. At tolerance 0, MW3's software arm differs from *itself* by
  33%.

## Addendum 2026-09-22 (late): Pawn plays on software; the GL rows

- **pawn on `--d3d9-renderer=software` no longer crashes.** The repro above
  (same `--input` route, `--max-batches=20000`) makes the e2-e4 drag, the
  engine answers e7-e5, and both moves carry the yellow last-move outline —
  the same picture the GPU arm gave. A capture at batch 8800 can catch the
  reply mid-animation, with a black block over e7/e6; by 12000 it has landed.
  The row is **gameplay / gameplay**.
- The OpenGL half now has a software arm too (`--gl-renderer=software`,
  `src/09a8g-gl-raster.wat`). Gameplay on it, measured this date: Half-Life
  Uplink (corridor), Quake II `demo1`, SimGolf (course + clubhouse), plus the
  Warcraft III menu and PTCT's scene. Commands are in each app's re-notes.
- UT2004 on the software D3D9 arm could not be judged on this laptop: at load
  14 it managed 154k batches in 330s and had drawn nothing yet. The splash
  result in `docs/re-notes/unreal-family-demos.md` came from the quiet bench box.

## Addendum 2026-09-23: the last three "blank" SDK rows

Each was a separate D3DIM bug. None of them involved the render target or the
primary, which is where the "Blocked, and why" list above had guessed.

| app | cause | fix |
|---|---|---|
| `dx_twist` | `D3DOP_MATRIXMULTIPLY` names handles, so `dest` can also be a source. Twist accumulates `dest = dest * step`, and `$mat4_mul` stored rows while it was still reading them, so the rotation shrank each frame until the object was a one-pixel sliver | `ede28ab8` |
| `dx_boids` | the same aliased multiply | `ede28ab8` |
| `dx_tunnel` | (a) execute-buffer triangles crossing the eye plane were clipped in screen space, which turns the walls into stretched shards. (b) d3dapp releases any texture whose surface does not report `DDSCAPS_VIDEOMEMORY`, and an unplaced surface never reported it, so the walls drew untextured | (a) `bdd20a78`, homogeneous `$d3dim_clip_tl_polygon`. (b) a `CreateSurface` caps change in `09a8`, landing after the `gdi_native_*` rename |

`test/test-d3dim-sdk-twist-tunnel.js` guards all three on the composited canvas.
It checks the lit-pixel count for Twist, and the colour count plus the yellow
hazard-stripe count for Tunnel. Measured on Tunnel: textured and clipped gives
95 colours / 5393 yellow, screen-space shards 20 / 99, texture dropped 5 / 0.
The execute-buffer path is WAT and shared by both arms, so each fix applies to
software and GPU alike.

Also fixed on the software D3D9 arm (`321a6193`): a lit draw whose declaration
has no `NORMAL` was refused with "lighting requires one FLOAT3/4 NORMAL".
D3D9, and our WebGL arm, read the missing normal as zero, so only ambient and
emissive remain. Morrowind issued 41,194 such draws on its route, and its
canvas stayed on the first loading frame. With the fix it draws the loading
screens through "Loading Interior". The world was not re-measured, because the
route runs for many minutes.
