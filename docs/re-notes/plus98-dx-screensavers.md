# Plus! 98 Direct3D screensavers (ARCHITEC, FALLINGL, GEOMETRY, JAZZ, OASAVER, ROCKROLL, SCIFI)

`--app=scr_architec` and its six siblings, from `binaries/screensavers/`. All
seven pass `/s` (screensaver mode, not the config dialog) and all seven name an
identical family set — ddraw + d3drm + d3dim — so
`tools/gfx-app-census.js --list` shows them as one row shape and they are worth
treating as **one cluster**: seven of the 27 apps in the OpenGL/Direct3D target
set.

They run the *real* Microsoft `d3drm.dll` as guest code, so what we provide is
DirectDraw and Direct3D Immediate Mode underneath it. That makes them a good
test of the D3DIM surface: d3drm is unmodified and will simply decline to
render if it does not like what it is given.

## Status 2026-10-06 (software D3DIM arm, main 80dfe68e)

All seven render. Reviewed runs: `scratch/runs/20261006T0250Z-<app>-w4-software/`
(architec, fallingl, geometry, oasaver, rockroll, scifi; jazz is in
claude:1863d2b5's `20261006T02*-scr_jazz-gld3d-sw`). The command is

```
node test/run.js --app=scr_rockroll --quiet-api --no-close --max-batches=120000 \
  --tick-ms-per-batch=2 --dx-surfaces --png=out.png
```

**Use `--tick-ms-per-batch=2` (or 1-5).** At the default 200 ms/batch one
software-rasterized frame costs minutes of guest time, every form's display
timer has expired by the time it flips, and Organic Art tears the whole D3DRM
device down after *every* frame (the app's own log says `SwitcherSetScene ...
Forcing device recreation` right after the first `Flipping buffers`).
rockroll then shows 5 Flips and 6 `IDirect3D2_CreateDevice` in 120000 batches and
the capture is a freshly cleared target; at tick 2 it is 579 Flips and 3
devices. Even at tick 2 an exit capture can land on a form change, so take
mid-run `--input=N:png:` captures (geometry and oasaver need this).

**Each device rebuild used to leak the flip chain's back buffer** (one 640x480
surface per form change, out of the 63 MB DIB arena). The final Release of the
front never released the implicit attachment; fixed in 80dfe68e with
`test/test-ddraw-complex-surface-release.js`. The leak also hid the rebuild:
`--png=` would pick a stale leaked back buffer that still held the previous
form's last frame, which is how oasaver looked "rendered" in some older
captures that were really at a form change.

**fallingl's solid black leaves are d3drm's shadow pass, not a rasterizer
fault.** Each gold 3D leaf has a black twin offset below it. `--trace-dx`
shows the pass: `STIPPLEDALPHA` (rs 33) on, texture off, the
`D3DSTATE_OVERRIDE_BIAS` (+256) locks on TEXTUREHANDLE/ALPHABLENDENABLE/
SPECULARENABLE/COLORKEYENABLE (the `rs257/283/285/297` lines), then 156
untextured triangles whose vertex colour d3drm itself wrote as `0xff000000` —
opaque black. Stippled alpha with alpha 0xff is solid, so we draw what we are
given.

**Corrected 2026-10-10 (SCR-FALLINGL-BLACK-LEAVES): d3drm does not give us
0xff.** The shadow vertices come out of *our* PROCESSVERTICES lighting, and the
shadow pass binds its own material: diffuse 0,0,0 with **diffuse alpha 0.50**
(`--trace-dx` Lights line now prints `diffuseA`). Alpha blending stays on and
locked (SRCALPHA/INVSRCALPHA). `$d3dim_vertex_lit_color` packed a constant
`0xFF000000`, discarding the material alpha, so a 50% shadow became opaque.
Lit alpha is now the material's diffuse alpha (the
[FFP rule](https://gamedev.net/blogs/entry/2250151-direct3d9-ffp-lighting)).
Falling Leaves' shadows draw translucent; scr_scifi's creature shadow on the
dune too; architec/geometry/rockroll captures are byte-identical.
`test/test-d3dim-lit-alpha.js`. The STIPPLEDALPHA/ALPHA*STIPPLED caps were a
red herring: clearing them does not change d3drm's shadow pass. Not checked against real hardware; if a real Win98 capture shows
translucent shadows, the alpha has to come from somewhere other than the TL
vertex (we report every `ALPHA*STIPPLED` shade cap, and neither arm implements
`STIPPLEDALPHA` at all).

WebGL arm: not re-checked on this build (no `@node-3d` headless GL on the ops
box; needs a browser run). Last browser verification was 2026-09-23
(`3aa3db04`, all seven on `?d3dim-gpu`).

## It renders. Everything below about "where it stops" was a budget artifact

**`scr_architec` draws its scene correctly.** At 120000 batches the primary
surface comes back `640x480 bpp=16 colors=259 nonZero=1845/1850` and the capture
is a textured, lit, perspective-correct 3D interior — marble columns, stairs,
the green growth forms the screensaver is named for. Nothing in the emulator
needed fixing for that.

Every earlier verdict on this cluster — "blocked on assets", "D3DRM black
output", "stops at GetCaps and never submits geometry" — came from captures at
**4000 to 8000 batches**, and this app is still loading then. The `--trace-api`
census reproduced below is real, but it is a census of the *loader*, not of a
renderer that declined to run: the `CreateDevice` / `GetCaps` / `Release` triple
that looked like a device being rejected is `D3DTexture.cpp` probing texture
size limits (the app logs it as `Hardware driver reports min/max texture size as
%dx%d-%dx%d`), and it releases that device because it was only ever asking a
question.

There were in fact **two** independent measurement faults stacked on each other,
and the second is the sneakier. An earlier 200000-batch capture of `scr_jazz`
exists and is a uniform `#f8fcf8` field — that is where the "the render target
is not black, it is *uniform*" line below came from. But that capture picked a
**cleared offscreen surface**, not the primary: the same app at 120000 batches,
captured with `--dx-surfaces` in the command, reports `Wrote ... (dx slot 3)`
and shows real geometry, while its slot 5 is exactly the `colors=1
nonZero=1850/1850` uniform field. So a longer budget alone would not have
rescued it — a bare `--png` can photograph the wrong surface, and a uniform
picture is as likely to mean "you photographed the wrong buffer" as "nothing
drew". **Always run `--dx-surfaces` alongside `--png` on a DirectX app** and
check which slot the capture named against the one carrying content.

The general lesson, which is why the wrong version is left standing above the
right one: **a capture is a sample, not a verdict**, and an app that loads for
tens of thousands of batches looks exactly like an app that renders nothing.
The three things that would have caught it sooner, in increasing order of cost:
a second, much larger budget (`--max-batches=120000`); `--dx-surfaces`, which
distinguishes a primary that was cleared and never written from one carrying a
scene; and the app's own diagnostics — see the next section, which is the part
of this file worth keeping.

## The real open bug: lit geometry shades to black

Re-measured at 120000 batches, the cluster splits, and the split is about
*shading*, not about whether anything draws:

| app | captured surface | reading |
|---|---|---|
| `scr_architec` | 259 colours, 1845/1850 | draws — textured lit interior |
| `scr_fallingl` | 196 colours, 1814/1850 | draws — but a subset of leaves are solid black silhouettes |
| `scr_geometry` | 83 colours, 1473/1850 | draws — yellow frame correct, the small octahedra are black |
| `scr_oasaver` | 148 colours, 197/1850 | draws — correct-looking forms, plus a stray white box bottom-right |
| `scr_rockroll` | 119 colours, 1849/1850 | draws — lit form on a sunset gradient, small black patches |
| `scr_scifi` | 119 colours, 1843/1850 | draws — red sky over dunes; **two creatures lit orange, two identical ones solid black** |
| `scr_jazz` | 13 colours, **14/1850** | geometry is right, *everything* shades to near-black |

All seven draw. The split is about *shading*, and `scr_scifi` is the sharpest
statement of it: four creatures of the same mesh in the same scene, two shaded
correctly orange-and-yellow and two rendered as flat black silhouettes against
a correctly lit dune. Nothing about the rasterizer, the texture path or the
geometry can produce that — only a per-object material or light lookup that
sometimes resolves to zero.

`scr_jazz` is the degenerate end of the same thing: the five shapes are in the
right places with the right silhouettes, rendered as sparse white speckle on
black — a 16bpp dithered near-zero colour, not an absence of triangles. The
same failure appears partially in `fallingl` (black leaves beside correctly
textured ones), `geometry` (black octahedra beside a correctly lit frame) and
`rockroll` (small black patches). So one bug spans the cluster and it is in the
lighting/material path, not the rasterizer.

One capture note for `scr_scifi` specifically: its `flags=0x1` primary is
`colors=1 nonZero=0/1850` — empty — and the scene lives in its two back buffers
(slots 6 and 34). It flips rather than blitting to the primary, so on this app
the primary is the *wrong* surface to judge by, which is the mirror image of
the `scr_jazz` trap above.

### Found it: the back faces were never culled

The lighting was never wrong. `--trace-dx` kind 19 reports healthy state —
`n=2 ambient=0x33333333 light0=DIRECTIONAL col=1.00,1.00,1.00
material=diffuse=0.80,0.80,0.80` — and the new kind-28 `ExecTri` line shows the
per-vertex colours coming out correctly shaded, greys from `0xff282828` (which
is exactly the 0.2 ambient × 0.8 material floor the formula predicts) up to
`0xfff0f0f0`, with `fill=SOLID` and `frontVerts=3/3`.

What was wrong is that **execute-buffer triangles were never back-face culled**,
and a back face shades to black *by construction*: N·L ≤ 0 for every light, so
`$d3dim_vertex_lit_color` returns the ambient term alone. Two things in
`src/09ab-handlers-d3dim-core.wat` combined:

- `$d3dim_cull_tri` read CULLMODE from `state+344` (rs=22) and returned "do not
  cull" when it was 0. D3D's documented default is `D3DCULL_CCW`, and D3DRM
  relies on that default: FALLINGL issues **seven** `SetRenderState` calls in
  20000 batches and none of them is rs=22.
- `$d3dim_draw_tl_triangle` passed `honor_cull=0` outright, so those triangles
  were unculled at any CULLMODE.

`$d3dim_draw_tri_culled` then gives each triangle one **flat** Z — the mean of
its three vertices — so the black back faces won the depth test on roughly half
the covered pixels. Correct geometry, correct silhouettes, black interiors.

The tell that names this without any tracing is a black region that is *half* an
object: FALLINGL's leaves were gold on one side and black on the other, and one
gold leaf had a black right half. That is a back face, not a material.

**Check culling before lighting on any "right shape, wrong colour" 3D report.**
An app that never sets CULLMODE at all is the second tell.

`scr_jazz` is *not* this bug — culling made it marginally worse (13 → 9
colours) and it still renders as sparse speckle. See below; every cause the
instruments can see has now been ruled out for it.

### `scr_jazz`: every visible cause ruled out, and it is still sparse

**Superseded 2026-09-23: jazz renders correctly.** It is white musical notes
(quarter/eighth notes, lit, a few large ones in front) swirling over black.
"Sparse speckle" was small distant notes seen at a low budget — the form is
genuinely sparse. Everything below is the record of how that looked from inside.

On WebGL (`?d3dim-gpu`, commit 3aa3db04) the savers' execute buffers go to the GPU:
execute buffers are batched into one DRAW per Execute, and fences are lazy. A 40 s
browser probe gives architec 37,608 GPU draws, fallingl 34,463 and jazz 140,050,
each with the correct picture. Before that commit the savers were entirely
software, even with the flag on. Jazz was the degenerate case: every
`Viewport::Clear` turned into a GPU clear plus a readback, so 28 of its 30 s went
to fences. `lib/d3dim-gpu.js` now declines clears on targets it has never drawn.

The primary shows a clearly structured radial flower, six-fold symmetric,
drawn in small bright fragments over black. Everything measurable about its
input is healthy. A kind-28 census over 1500 batches:

```
 236 fill=SOLID tris=224 col=0xff282828
  67 fill=SOLID tris=124 col=0xffffffff
  41 fill=SOLID tris=224 col=0xffffffff
   9 fill=SOLID tris=224 col=0xffdbdbdb   … and a long tail of shaded greys
```

All `frontVerts=3/3`, all SOLID, 224 or 124 triangles a buffer, vertex colours
spanning the whole lit range from the `0xff282828` ambient floor to white. So
fill mode, eye-side, triangle count and lighting are all correct, which is the
entire set of causes the instrument was built to separate.

Depth is ruled out too, by the same `zbuf = 0` probe as GEOMETRY above: jazz
went 9 → 16 colours and 15 → 17 of 1850 non-zero samples, and the picture stayed
the same scattered fragments. Culling is ruled out by the fact that turning it
on *reduced* the colour count rather than changing the shape.

Its surfaces are worth recording, since they are not the usual arrangement:
slot 3 primary (the speckle), slot 4 back buffer **empty at 0/1850**, slot 5
offscreen uniformly one non-zero value across all 1850 samples. A back buffer
that is never written while the primary is, is the thing to explain next — the
scene is reaching the primary directly and whatever the back buffer is for, it
is not receiving this geometry.

Not ruled out, and the remaining candidates in order: the transform collapsing
the form (the first vertices of one frame's four buffers sit inside a 40-pixel
box near screen centre), or the form genuinely being this sparse at the point
the capture is taken — these are growth animations and 120000 batches may still
be early. Settle the second one first, by capturing the same run at two widely
separated budgets; it is much cheaper than reading the transform.

### After the fix (`8b227b5c`), 120000 batches, captured DX surface

| app | colours before → after | what the capture shows now |
|---|---|---|
| `scr_architec` | 259 → **348** | rich textured marble interior |
| `scr_fallingl` | 196 → **213** | leaves fully gold or teal; no half-black leaf |
| `scr_oasaver` | 148 → — | butterflies over a cloud sky, stray white box gone |
| `scr_scifi` | 119 → 118 | red sky, lit dunes, **five orange creatures** |
| `scr_rockroll` | 119 → 107 | neutral |
| `scr_geometry` | 83 → 82 | near octahedra lit yellow, distant ones still black |
| `scr_jazz` | 13 → 9 | unchanged sparse speckle — separate cause |

`dx_globe` is the control: it is a D3DRM sample outside this cluster that drew
correctly before the change and still draws its lit textured sphere after. Its
`--dx-surfaces` line reads `colors=29 nonZero=38/1850`, which looks alarming and
is not — the sampler is a fixed 1850-point grid over the whole 640x480 surface
and the sphere is small, so only 38 samples land on it. **Read the picture, not
the sample count, on any app whose subject does not fill the frame.**

Two readings that are *not* remaining bugs:

- **`scr_scifi`'s three black shapes are shadows.** They sit flat on the dune
  below the lit creatures and are squashed copies of their silhouettes. This is
  also what the ExecTri census was saying before the fix and I misread as
  corruption: the perfect odd-lit / even-black alternation is one lit pass and
  one black shadow pass per creature, not identical objects shaded differently.
- **`scr_oasaver` captures on slot 6**, not the primary; its slot 38 primary is
  `colors=1 nonZero=0/1850`. Which surface holds the scene is per-app and the
  `--dx-slot=N` flag is how you check rather than guess.

### `scr_geometry`: the black outlines are the app's own, the missing fill is ours

Still open, but narrowed. The distant octahedra draw as black *outlines* with
the blue background showing through, while the near ones are solid lit yellow.
The kind-28 trace says the outline is intended:

```
[dx] ExecTri fill=SOLID tris=96 v0=291.4,301.6 col=0xff676700 frontVerts=3/3
[dx] ExecTri fill=SOLID tris=96 v0=264.0,275.8 col=0xff333300 frontVerts=3/3
[dx] ExecTri fill=WIRE  tris=96 v0=265.6,259.1 col=0xff000000 frontVerts=3/3
```

Every object gets **both** passes and always `tris=96`: two or three SOLID
buffers whose vertex colours are properly shaded yellows (`0xff333300`, the
ambient floor, through `0xfffefe00`), then one `fill=WIRE` buffer whose colour
is flat `0xff000000`. So GEOMETRY draws each octahedron lit and then outlines it
in black, and the near ones — yellow bodies with black edges — are *correct*.

The distant ones keep the outline and lose the fill, and the obvious suspect —
that the SOLID pass fails a depth test the WIRE pass skips — is **falsified**.
`$d3dim_draw_tri_culled` gives a triangle one flat Z (the mean of its three
vertices, `09ab:4747`), which is least accurate on exactly these objects, so a
probe forced `zbuf = 0` there, making every triangle take the no-depth path, and
rebuilt. The distant octahedra came back **still wire-only**. Depth rejects
nothing here.

What that leaves is the reading the trace already supported and I was slow to
accept: GEOMETRY draws distant objects **wire-only on purpose**. The census
counts roughly three SOLID buffers per WIRE one while the frame holds about six
near objects and twenty distant ones, so the solid passes belong to the near
cluster and the far field never gets one. A level-of-detail style, not a defect.
`scr_geometry` is very likely rendering correctly.

**Two cautions this cost.** The screensaver cycles scenes, so two runs at the
same batch count photograph *different content* — one run listed a single 640x480
surface, the next listed seven including two 512x512 textures. Never diff
captures of this app across runs without checking the surface list first. And a
picture that looks like a rendering failure can be an art direction; the probe
that settles it is worth more than another hour of reading the rasterizer.

### The lighting code, for reference

`src/09ab-handlers-d3dim-core.wat` has the real implementation to interrogate:
`$d3dim_vertex_lit_color` (emissive + ambient·mat.ambient + Σ light·mat.diffuse·N·L)
and, above it, `$d3dim_vertex_shade_fallback`, which is what runs when
`$d3dim_light_n` is 0 — it shades from `$d3dim_current_material_color`, so a
material whose colour resolves to 0 renders black by construction. The
instrument already exists: `--trace-dx` emits

```
[dx] Lights  n=<count> ambient=<D3DCOLOR> light0=<type col= pos= dir=> material=<diffuse= ambient= emissive=>
```

once per change (kind 19), and its comment says exactly why it was added —
"white geometry" and "no material bound" render the same and cannot be told
apart from the API trace. Window it with `--trace-from`/`--trace-to` around a
frame late enough to be past loading.

## Reading the app's own log without a log file

These are Computer Artworks *Organic Art*, and they are unusually talkative.
`--trace-reg` shows the knobs: `TraceLevel`, `DisableLogFile`,
`FlushLogAggressively`, `DisableHardware`, `ForceRGB`, `DefaultD3DDevice`,
`DisableAllTextures`, `RenderMode`, `DeviceRenderQuality` and about forty more,
all under `HKCU\Software\Computer Artworks\Organic Art\Plus`. Seeding them with
`--reg-import` works (`TraceLevel` reads back), but no log file is ever opened —
the run makes no `WriteFile` call at all — so the knob alone does not get you
the log.

The text is still reachable, because the binary keeps its whole vocabulary as
literals and funnels them through one printf-style trace function at
`exe+0x68d60`, called as `trace(level, fmt, ...)`:

```
node test/run.js --app=scr_architec --quiet-api --no-close \
  --max-batches=8000 --trace-at=0x74468d60
```

`--trace-at` prints `[esp+0]`…`[esp+20]` on every hit, so `[esp+8]` is the
format-string pointer; resolve the collected pointers with `tools/dump_va.js`
and the app narrates itself — `Loading %s as mesh`, `Making texture [%#08x]
conformant to device caps`, `Hardware reports D3DPTEXTURECAPS_POW2`, `Scene
SetBackdrop("%s")`, `Viewport Dirtied`. 607 such calls in 8000 batches, and all
of them are loading. That sequence is what says "still working" rather than
"stuck", and it is available for any app that logs through one formatter.

The assertion strings are just as useful and are matched by
`"<the failing C++ expression>" failed`, e.g.
`"D3DMgr::GetD3DRM()->CreateDeviceFromD3D(GetD3D(), GetD3DDevice(), &pD3DRMDevice)" failed`.
`tools/find_string.js` locates one, `tools/find_bytes.js --push=0xVA` finds the
site that pushes it, and `--count` says whether that path was taken — but
**`--count` only fires on basic-block entries**, and an assert's `push` is in
the middle of its block. Counting the push site returns 0 whether the assert
fired or not. Count the branch target instead (`tools/find_fn.js` and a short
`disasm_fn.js` around the `test`/`jge` pair give it); a zero from the push
address means nothing at all, and it cost this investigation an hour.

## Two stale diagnoses, both retired 2026-09-22

**"Blocked on Plus! 98 assets."** Not any more. `--trace-fs` shows the scene
loading cleanly: `FindFirstFile(".\*.scn") → "architec.scn"`, then
`ar_textu.gif` read in full, then `ar_mesh.x` opened. The directory probes that
look alarming — `.\Backdrop`, `.\Informs`, `.\Textures`, `.\Scenes` all
returning INVALID — are the app's search-path fallback doing its job; the
assets sit flat beside the exe and it finds them there. `--dx-surfaces`
confirms the decode end to end: two 256x256 8bpp texture surfaces with 233
colours and real palettes, plus an 800x678 backdrop with 160.

**"D3DRM black output."** The right shape, the wrong word. The offscreen render
target is not black, it is *uniform*: `slot=7 640x480 flags=0x4 colors=1
nonZero=1850/1850` — every pixel written, one colour, and the capture comes out
100% `#f8fcf8`. Something clears the target and nothing draws into it. A colour
count cannot tell those apart from a correct dark scene, which is how one
phrase came to cover several different bugs in the older notes.

Both were also masked by a third thing until 2026-09-22: `d3dxof`'s DllMain was
being abandoned half-way, which is the subject of
`docs/re-notes/dx-sdk-d3drm-samples.md`. Fixing that is what let these get far
enough to fail interestingly.

## Where it actually stops

An `--trace-api` census over 6000 batches, filtered to the COM interfaces, is
the whole story — note what is present and what is absent:

```
 41 IDirectDrawSurface_Release      7 IDirectDraw_CreateSurface
 20 IDirectDrawSurface_QueryInterface   5 IDirectDrawSurface_Blt
  4 IDirect3D2_Release              2 IDirect3DTexture2_Release
```

There is **no `Execute`, no `BeginScene`, no `DrawPrimitive`, nothing that
submits geometry.** The sequence d3drm actually performs is:

1. `IDirect3D_QueryInterface(IID_IDirect3D2)` → S_OK, then
   `IDirect3D2_EnumDevices`, then it releases D3D and DirectDraw and walks away
   (`#5713`-`#5754`). This one is a capability probe, and it also reads
   `HKCU`/`HKLM` registry values in the middle of it.
2. Later, `IDirect3D2_CreateDevice` **succeeds**, `IDirect3DDevice2_GetCaps` is
   read, and the device is released again — then a texture is QI'd and released
   (`#11920`-`#12039`). That whole block repeats verbatim later at `#21931`.

So a device is obtainable and d3drm asks for one, inspects its caps, and hands
it back without ever rendering. The next step is therefore **what
`IDirect3DDevice2_GetCaps` reports**, not the rasterizer: d3drm is choosing not
to use the device it just made. `$handle_IDirect3D2_EnumDevices`
(`src/09aa-handlers-d3dim.wat:222`) does invoke the callback through
`$d3d_enum_devices_invoke`, so "no devices enumerated" is already ruled out.

Compare `dx_globe`, which *does* render a lit textured sphere through the same
d3drm — so the D3DIM path is not wholly broken, and the difference between
these two is the lead worth pulling.

## Baseline, 2026-09-22

4000 batches, one capture each, after the DllMain fix. All seven exit 0 and
none puts up a message box:

| app | API calls | colours |
|---|---|---|
| `scr_architec` | 25643 | 1 |
| `scr_fallingl` | 24708 | 1 |
| `scr_geometry` | 20132 | 44 |
| `scr_jazz` | 72992 | 55 |
| `scr_oasaver` | 23538 | 1 |
| `scr_rockroll` | 23976 | 1 |
| `scr_scifi` | 20713 | 1 |

`scr_geometry` gave 1 colour at 8000 batches and 44 at 4000, so these are
animating and a single capture is a sample, not a verdict — take several
budgets before reading anything into one number.
