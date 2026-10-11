# Monster Truck Madness 2 Trial (Terminal Reality / Microsoft, 1998)

Candidate `monster-truck-madness2-trial` (not yet registered: it does not
reach gameplay). `Monsterx.exe` is a statically linked MFC 4.0 MDI app
(`AfxFrameOrView40s`, `AfxMDIFrame40s` classes). Its UI frames are
`CMDIChildWnd`s whose views are `CFormView`s, created as dialogs.

## Licence

`eula.txt` in the package is the Microsoft trial EULA. It allows
non-commercial redistribution of complete copies, with the EULA attached; the
grant is the same as Midtown Madness Trial's.

## Install layout

archive.org `MonsterTruckMadness2_1020`, `MtM2trial.zip` (SHA-1 `d12c783a…`).
It holds `MtM2trial.EXE`, a self-extractor that `7z x` unpacks directly into
`Monsterx.exe`, the `.pod` archives, `Monsterx.ini`, `eula.txt`, the help
files and four renderer DLLs:

| DLL | Renderer | Imports |
|---|---|---|
| `Trid3d.dll` | Direct3D | DDRAW (static import of the exe) |
| `Triglide.dll` | 3dfx Glide | glide2x.dll |
| `Trirend.dll` | Rendition Vérité | redline.dll, verite.dll |
| `Trinec.dll` | PowerVR | sgl.dll |

`Monsterx.ini` `[Graphics]` defaults to `useDirect3D=0` and
`rendererDLLPath=C:\METAL2X\triglide.dll`, which selects the software
renderer.

## Startup sequence (headless, `--batch-size=50000`)

1. A MessageBox-style dialog says the display has "more than 256 colors". OK
   continues (`keydown:13` at batch 40); Cancel exits.
2. The frame `0x10001` and the MDI client open, then MDI child 1 `0x10003`
   with form view `0x10004`. After OK, child 2 `0x1000b` gets form view
   `0x1000c`.
3. The shell screen ("Trial Version", menus Race/View/Options/Help) appears
   by about b120. It is magenta-tinted under our 32-bit desktop (palette,
   not investigated). It auto-starts "Farm Road 29": "Loading terrain
   database" at about b540.
4. **Software renderer:** after "Loading additional graphics", the game
   calls `CreateWindowExA(class="DisplayDibWindow", 640x480)`. That class is
   registered system-wide by Win98's `DISPDIB.DLL`, and the game never loads
   that DLL itself. We have no such class, so it shows "Error! Unable to start
   DisplayDIB Mode! Program is aborting." **Open: needs a WAT-native
   DisplayDibWindow class** (the `DDM_SETFMT` / `DDM_DRAW` / `DDM_BEGIN` /
   `DDM_END` / `DDM_CLOSE` messages of the Win32 `dispdib.h`).
5. **Options → Graphics…** (Alt+O, R) probes the renderer DLLs. `Trirend.dll`
   loads even though `redline.dll` is missing, and its `VL_OpenVerite` import
   hits a fail-fast stub. On Windows that `LoadLibrary` fails instead. **Open:
   LoadLibrary should fail when a non-emulated dependency is absent.**

## The empty view list (fixed 2026-10-11, f54d8df3d)

The crash right after the 256-colour prompt was `CObject::IsKindOf(NULL)`
(`0x5d7a12`, called from `0x545080`). `0x545080` walks the views of the
document stored at `[app+0xc0]` (app object `0x749a38`):

- the document is `0x01056314`, vtable `0x60c310`;
- `GetFirstViewPosition` is `+0x64` → `0x5e22bc`, which reads the view list
  head at `+0x2c`;
- `GetNextView` is `+0x68` → `0x5e22c0`.

The views never registered because our CreateDialog CBT path skipped
`WM_CREATE`, and `CFormView::OnCreate` is where `AddView` happens.

Other addresses:

- `CMDIChildWnd::Create` returns from `WM_MDICREATE` at `0x5f176d`.
- The view `CCreateContext` is at `0x074ffe34`: view class `0x644a78`,
  document `0x01056314`, template `0x010408cc`.
- `[app+0xc0]` is stored at `0x542713` in InitInstance, called through
  `0x42cac6`.

Breakpoints after an indirect call (for example `0x5450af`) do not fire,
because they are not block entries. Use `--count` on branch targets and
`--watch` with `--watch-start-batch`.
