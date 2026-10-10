# Arcanum demo

Registry id is `arcanum_demo`. The exe is `test/binaries/candidates/arcanum-demo/installed/arcanum.exe`, installed by the demo's own MSI. Load is slow because of the guest's own work. Text files are read byte by byte through `fgetc`, and every byte costs a full zlib `inflate()`. A 280s run reaches only about 23k batches at `--batch-size=50000`.

## It is a Direct3D 7 app by default (2026-09-23)

`tools/gfx-app-census.js` lists only `d3dim(name)`. A traced boot confirms that the default configuration uses it: `DirectDrawCreateEx`, then `IDirectDraw_QueryInterface`, then `IDirect3D7_CreateDevice`, `GetCaps`, `EnumTextureFormats`, and a set of `SetRenderState` and `SetTextureStageState` calls. The command-line switches `-no3d` and `-3dref` exist. The strings `3D: ...` are the log of its hardware renderer.

The main menu is the first screen that draws through D3D. It makes 260 `IDirect3DDevice7_DrawPrimitive(D3DPT_TRIANGLEFAN, FVF 0x1c4 = XYZRHW|DIFFUSE|SPECULAR|TEX1, 4 verts)` calls in batches ~16095-16104 at `--batch-size=50000`. These are textured quads, with no clicks needed:

```
node test/run.js --app=arcanum_demo --quiet-api --batch-size=50000 \
  --max-batches=16106 --max-seconds=280 --no-close --input="16105:png:OUT.png"
# WebGL arm: add --headless-gl --d3dim-gpu, and run under `caffeinate -d -u`
# (without it: "WebGL is unavailable" from lib/gpu-backend.js at the first draw)
```

Both arms give a **pixel-identical** main menu (`tools/png-diff.js`: 0 of 307200 differ). The WebGL arm reports `draws=260 triangles=520 fallbacks=0 errors=0`.

The gameplay route (crash site, gnome dialogue, HUD) needs about 41k batches of clicks driven over `--frozen --control-stdin`. See memory `project-arcanum-gameplay`. It was not re-run on the WebGL arm here, because at ~75 batches/s it is a long run.

## Call-form census (2026-09-29)

**Route.** Box2 ran `--batch-size=50000`, driven over `--control --frozen`
with `relmousemove` and `di-mousedown`/`di-mouseup` for clicks, and
`di-keydown:27` for Esc:

| step | batch |
|---|---|
| menu | 16100 |
| Next arrow | 18514 |
| Esc skips the quest movie | 20022 |
| Continue | 23627 |
| gnome dialogue | 25135 |
| free roam at the crash site | 28152 |

**Census over 45k..54k** (idle NPCs, fire; docs/uop-tier-design.md §15.1):

- **uop share:** 58-59%.
- **Guest indirect:** 0.23-0.28%, all low-polymorphic.
- **`jmp [tbl+r*4]` switches:** 1.3% of entries. The largest is the CRT
  `_output` state machine at `exe+0x5789a2`, at 0.37%.
- **The remainder:** `declined:no-backedge` is 16.5%. It is call/ret-heavy
  straight-line code.

## Registered browser gameplay qualification (2026-10-08)

Fresh original `arcanum_demo` runs on software and WebGL both reached the
crash site, completed the gnome dialogue and demonstrated player movement
west of the corpse and wreck through ordinary relative mouse input and a
ground click. Screenshots were personally reviewed. This reconciles the
retained **28152-batch free roam** and **45k..54k gameplay census** above;
Arcanum is an earlier-qualified title, not a never-qualified new game.
The historical pixel-identical menu sweep remains menu evidence only.

Both new arms use source `7e4ce05ce33b8689ffb6d96184cc319c3353de8a`,
2953 verified source/fixture pins, and module
`d8d4096f957ed51cecab589b5a1ec7bf402336f13959ce0710faf2f7d3c68960`.
Chrome 151.0.7922.108 on a fresh no-env Linux boat, Ryzen 9 9950X,
cooperative execution, native 800×600 game displayed at 560×420.
The route is the registered original launch, Single Player, New Game,
Pick Character, Next, Escape through the quest movie, Continue, three
gnome responses, then free roam. No guest state was forced.

WebGL idle crash-site measurement after movement records **434 actual
visible game presentations / 20.127145 s = 21.5629 presentations/s**.
Raw one-second samples and all 434 copy events are retained. The observer
follows the selected DirectDraw layer through Canvas/OffscreenCanvas
copies into a visible sink after successful `presentationFilter.present`.
It excludes overwritten uploads, repeated composites, hidden desktop
copies, no-op presentation, raw Flip/API calls and page RAF. This is an
instrumented compositor submission rate, not physical scanout or unique
pixel content. Live WebGL execution reports zero fallbacks/errors.

**Software FPS remains unqualified.** Its initial DOM-only observer missed
the distinct OffscreenCanvas prototype: write sequences advanced but no
attributable sink events were observed. The raw zero is rejected, not
reported as 0 FPS. The corrected observer passed focused contracts and
the WebGL scene; no software rerun fit the remaining immutable browser
budget. Both gameplay qualifications stand independently of this gap.
Combat, mission progression, save/load and audio remain unqualified.

Contained evidence: `scratch/runs/20261008T1431Z-arcanum-gameplay-qualified`;
historical reconciliation:
`scratch/runs/20261008T1349Z-arcanum-retained-gameplay-audit`.
See [the execution and cleanup handoff](../../ops/handoffs/arcanum-gameplay-20261008.md).

## Control route and qualified frame counter (2026-10-10)

**Fixture on a fresh boat.** `fetch-candidate-corpus --id=arcanum-demo`
needs `unar` for the RAR, since p7zip exits 2. Even then it fails, because
`installed/` comes from running the MSI. To rebuild it:

1. Copy the RAR's admin tree `Sierra/Arcanum Preview/`.
2. Overlay `msiextract Setup.msi` (msitools), which unpacks `Setup1.cab`
   into `SOURCEDIR/Sierra/Arcanum Preview/`.
3. Delete `data/proto/` (the installer's `removeprotos.exe` does) and the
   stray `msiexec.exe`.
4. Add `data/art/missing.dat` (328 bytes) and lowercase every name.
5. Copy the fixture's `.wine-assembly-browser.json`.

The result is sha256-identical to the local 36-file tree.

**Route.** `--batch-size=50000 --control --frozen`, driven with ctl
`cmd`s and steps. The cursor starts on Exit Game.

| batch | input | result |
|---|---|---|
| 16100 | `relmousemove:0:-117`, click | Single Player |
| +200 | click | New Game |
| +600 | click | Pick Character |
| +1000 | `relmousemove:243:295`, click | Next arrow; the quest movie starts |
| 19422 | `di-keydown:27` | skips the movie |
| 23026 | `relmousemove:-240:-130`, click | Continue |
| 24534 | `relmousemove:-75:-20`, click, then two more clicks | gnome dialogue |
| 25848 | `relmousemove:-80:34`, click | `[Exit]` |
| 26256 | | free roam |

At free roam, `relmousemove:-120:-80` and a click walk the player about
145px west of the corpse. An `--input` replay of the same batch numbers
diverged and the game exited at 19467, so step the ctl session; do not
replay.

**What a present is.** Each game frame is one `BeginScene`/`EndScene`: two
`Blt` clears and two `Lock`/`Unlock` pairs on the 3D surfaces, return
`0x519554` and `0x51949b`. Then come exactly **4 dirty-rect `BltFast`**
calls onto the primary from return `0x513bed`, and each one is a
`dx_present`. Idle free roam had 268 presents = 268 BltFast = 4 x 67
EndScene, so frames = presents / 4. That makes about 224k guest blocks per
frame, idle. The ratio was only verified idle, so count `EndScene` for any
other scene. Evidence: `scratch/runs/20261010T0810-arcanum-control-frames`.
