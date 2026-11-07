# Half-Life Uplink demo

## Package and installed layout

The local-only installer is
`test/binaries/candidates/half-life-uplink-installer/hluplink.exe` (50,872,079
bytes). It is a Win9x InstallShield package. The tested installed tree is staged
under the same candidate directory at `installed/`; its playable entry is
`hldemo.exe`.

The two large launch pins are:

- `hldemo.exe`: 737,280 bytes, SHA-256
  `e459ef7d19bc0690d2e2d6dca9af1d773b49f8172096e49a694f897119bc4dc1`
- `valve/pak0.pak`: 79,150,544 bytes, SHA-256
  `c9eac1391845d6fabd93d7a1cc48281275410d35e01b74bd7f02325c65c99a42`

The runtime also needs `hw.dll`, `sw.dll`, `hl_res.dll`, `a3dapi.dll`,
`valve/dlls/hl.dll`, `valve/cl_dlls/client.dll`, and the remaining Valve/media
data beside the executable.

## Installer path

Use dialog titles, not an early `wait-dlg-control:3`: the setup creates a
different control with that ID before Welcome. The deterministic path is:

1. Welcome: click ID 3.
2. End User License Agreement: click ID 5 (`I Agree`).
3. Read Me File: click ID 3.
4. Choose Destination Location: click ID 3.
5. Start Installation: click ID 3.

The installer then requires Win9x VERSION.DLL behavior:

- `VerFindFileA` chooses the current/destination directories and reports
  NUL-inclusive buffer capacities and `VFF_*` flags.
- `VerInstallFileA` moves InstallShield's generated temporary payload into the
  selected destination and returns a `VIF_*` mask.

Use a small guest batch for the large PAK. With `--batch-size=20000`, the whole
75+ MB decompression stays inside one chained batch, so `--max-seconds` cannot
take effect until after extraction and may stop before the following rename.
`--batch-size=500` lets setup finalize `valve/pak0.pak` and emit the later DLL,
WAD, CFG, and media files.

The completed local run used `--save-vfs` and `--reg-export`. Its installer
snapshot is `hlu-installer-registry-complete.json`; the exported
tree was `half-lifeuplink` before it
was staged under the candidate directory.

## Registry delta

The game-specific installer record is:

```text
HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Half-Life Uplink
  DisplayName = "Half-Life Uplink"
  UninstallString = "C:\sierra\half-lifeuplink\unwise.exe C:\sierra\half-lifeuplink\INSTALL.LOG"
```

These are uninstall bookkeeping, not launch prerequisites. The installed game
reaches its menu with or without importing them; keep them out of a minimal
`startupRegistry` manifest unless reproducing the installed Windows state is
the goal.

## Installed-game launch

Use the registered app to mount the installed directory, including its runtime
DLLs. Do not seed those DLLs: permanent EXE roots prevent renderer-restart
unloading (see the 2026-10-25 findings below).

```sh
/opt/homebrew/bin/timeout -s KILL 90 node test/run.js \
  --app=halflife_uplink \
  --no-build --max-seconds=70 --max-batches=10000000 --batch-size=1000
```

`WSAStartup` must fill the complete 400-byte Win32 `WSADATA`, including the
provider's real 64-slot socket capacity in `iMaxSockets` at offset 390. The
engine then creates DirectDraw, opens the intro AVI as MCI alias `sierravideo`,
resolves that alias with `mciGetDeviceIDA`, closes it, creates the 640x480
Half-Life child window, and renders the complete menu.

The warning was not cosmetic. `hldemo.exe` at VA `0x41068c` passes a WSADATA
at `ebp-0x22c` to `AfxSocketInit`. After the successful call, VA `0x4106a5`
reads the WORD at structure offset `0x186` (390); the check at `0x4106b5`
loads warning resource ID 22 unless the reported capacity is greater than 12.
The MFC helper at VA `0x466524` also verifies negotiated WinSock 1.1. The
virtual provider has `VSOCK_MAX=64`, so publishing 64 is both sufficient and
truthful; `iMaxUdpDg` stays zero because the virtual LAN exposes no UDP, and
`lpVendorInfo` is NULL.

`mciGetDeviceIDA` must query the same host-owned alias map populated by
`mciSendStringA`. Returning a fabricated ID or zero either breaks subsequent
MCI commands or skips the video path. The focused host regression verifies
case-insensitive lookup and alias removal on close.

Acceptance screenshot: `hlu-game-mci-final.png`. The main menu
shows New game, Hazard course, Configure, Load game, View readme, Previews, and
Quit; the 70-second run ended normally with no unimplemented API or crash.

## Browser dropdown

The localhost-only dropdown keeps the original installer entry and adds
`halflife_uplink` for the installer-produced game. Its manifest pins the six
runtime DLLs and 58 data files (65 local paths including the EXE) and mounts
the PAK, WAD, configuration, AVI, and order-page assets at their runtime
`C:\` paths.

Uplink performs a relatively long renderer probe before publishing its main
window. The normal browser lifecycle grace remains 750 ms; this app opts into
60 seconds so last-window cleanup does not mistake that startup transition for
process exit. Its eventual 640x480 Half-Life menu uses a dialog-style top-level
window, which the focused browser acceptance allows explicitly before checking
rendered pixels.

The final real-Chrome run rendered 91 colors and changed 8,406 sampled pixels.
Screenshot:
`/var/folders/dz/1fqkk_jd4350qkm91pm9_q3c0000gp/T/hlu-web-mu3xoc/halflife_uplink-after.png`.

The stronger no-dismiss run confirms that the socket warning is gone. Normal
renderer pointer input at guest `(148,193)` hits the measured New Game button
(live control ID 1016, rectangle `70,180 156x26`) and reaches the Easy / Medium
/ Difficult selector. Best progress screenshot:
`halflife_uplink-new-game-click.png`.
This is not yet a first-person frame; do not treat the current browser smoke as
full gameplay acceptance.

## Difficulty selection and current gameplay boundary

The difficulty dialog exposed a separate native-dialog delivery bug. A WAT
BUTTON sent its custom `WM_COMMAND` synchronously to the parent. Uplink's New
Game handler enters another modal dialog, so the bounded recursive interpreter
eventually logged
`[sync] ABANDONED wndproc msg=0x111 at 0x00459554 after 64 rounds`; clicking
Easy after that resumed a discarded x86 continuation and crashed. Custom
commands to a parent with a retained DLGPROC are now posted through the guest
message queue. `IDOK`, `IDCANCEL`, and non-dialog parents remain synchronous.
The focused regression also subclasses the dialog WNDPROC, matching Uplink's
MFC dialog rather than relying on the visible `WNDPROC_DIALOG` marker.

With that fix, normal renderer input reaches the live Easy control (ID 26) and
creates the next 640x480 Half-Life window without abandoning a continuation or
exiting the app. The post-click evidence is under
``; `halflife_uplink-easy-loaded.png` is the
furthest frame, but it is a uniform light-grey client area, not gameplay.

The grey frame is not an active presentation or an unresponsive browser:

- `hl.dll` loads from `c:\valve\dlls\hl.dll`, `client.dll` loads from
  `c:/valve/cl_dlls\client.dll`, and passive entry counters record one call
  each to `GetEntityAPI` and `GiveFnptrsToDll`.
- The main thread repeatedly returns to VA `0x459554`, the instruction after
  MFC's `PeekMessageA` call, with a stable stack and no synchronous-abandonment
  log. This is the live top-level modal pump, not a discarded recursive frame.
- The only long-lived worker is the renderer queue waiting normally. The other
  observed worker starts at runtime VA `0x15a7e42`, which maps to
  `comctl32.dll` RVA `0x20e42`; its function returns zero at RVA `0x20e8c`, so
  its later `EIP=0` exit is normal COMCTL32 worker completion, not a failed
  Half-Life game thread.
- DirectDraw is configured only for the hidden menu HWND `0x10002`: the trace
  contains `SetCooperativeLevel(0x10002, DDSCL_EXCLUSIVE|DDSCL_FULLSCREEN)` and
  640x480x16 `SetDisplayMode`, but no later cooperative-level or display-mode
  call for the new visible HWND `0x1001d`. That new window's canonical surface
  remains untouched (`uploaded=false`, version 1) and it has no DirectDraw
  layer.

Therefore the queued-dialog fix advances the real dropdown path through Easy,
but first-person acceptance remains blocked after game-DLL initialization and
before the engine re-enters video/presentation setup. Do not paper over this by
transferring DirectDraw ownership in the host: the guest has not issued a
second `SetCooperativeLevel`, and there is not yet generic evidence that such a
host-side handoff matches Windows behavior.

### Engine frame activation

The grey window was one step downstream of an ordinary USER activation gap,
not a DirectDraw ownership handoff. Uplink selects `sw.dll` at runtime. The
post-Easy launcher bridge adds the exact `skill 1\nmap hldemo1\n` text to
`sw.dll`'s `Cbuf_AddText` once, but `Host_Frame` remains at zero. Its caller is
reached continuously and reports engine state 1, then returns because all
three run guards are zero. The primary guard at `0x484808` is written by three
MFC `WM_ACTIVATEAPP` handlers; none of those handlers executed during the menu
startup in the failing run.

The window chronology identifies why. An unseen utility HWND consumes the
first handle, then the real parent/owner-zero UI is created as dialog HWND
`0x10002` and shown. `ShowWindow` already knows how to deliver the synchronous
`WM_ACTIVATEAPP -> WM_ACTIVATE -> WM_SETFOCUS -> WM_SIZE` chain through a
retained DLGPROC, but the preceding hidden-helper promotion accepted only a
direct guest WNDPROC. It rejected USER's `WNDPROC_DIALOG` marker, left
`main_hwnd` on the invisible utility HWND, and made the correct dialog branch
unreachable.

The generic fix resolves `WNDPROC_DIALOG` to its retained application DLGPROC
for that promotion decision. It still requires a shown, unowned top-level,
an invisible old main HWND, and an unconsumed first-activation gate. Owned
popups, child dialogs, built-in procedures, and subsequent same-application
window changes keep their previous behavior. The focused regression builds
exactly this hidden-utility/retained-dialog shape and proves the real dialog is
promoted and synchronously receives all four startup messages in order. The
existing SkiFree startup sequence, custom dialog dispatch, queued custom-button
command, and installed Uplink menu gates remain green.

A normal post-fix Chrome run clicks New Game and creates the live
Easy/Medium/Difficult dialog and all four buttons. The disposable diagnostic's
old control-ID walk
does not recognize those dynamically retitled controls after main-window
promotion, so that run was not used to claim a new Easy-to-first-person pass.
The earlier guest-only counterfactual (`0x484808 = 1` immediately after Easy)
does prove the next stacked compatibility boundary: the engine immediately
enters deep `sw.dll` code and stops at unimplemented `CompareFileTime`
(`sw.dll` runtime EIP `0x0104b407`). `CompareFileTime` is a separate generic
KERNEL32 API task; first-person rendering remains unproven until it and any
later engine dependencies are implemented and the real dropdown path is
rerun.

## Browser DLL thread-attach stack translation

Safari 26.4 can advance through New Game and click Easy with a 1,000-block host
slice, but repeatedly traps while entering tiny MFC epilogue blocks. A failure
at `0x00464e4e` (`mov eax,edi; pop edi; pop esi; ret 4`) left EAX unchanged from
before the block and ESP still named the valid words `0x00459610, 0x074febc0,
0x00463aaa, 0x0043fd74`. An earlier run failed on the same shape at the `ret 4`
at `0x00456cc0`. The intact state rules out a corrupt MFC object or guest
return stack, but does not identify where the browser exception originates.

Neither disabling cross-basic-block tail calls nor preserving retired decoded
page chunks fixed the failure. A local Chrome drive with the second diagnostic
build reproduced the exact `0x00464e4e` report and finally supplied the browser
exception stack: `DataView.setUint32` at `dll-loader.js:callDllMain`, called by
`ThreadManager.spawnPending` while delivering `DLL_THREAD_ATTACH`. The sampled
EIP is the suspended main thread's current address; the exception happens in
host-side initialization of a newly created cooperative thread, before that
thread's start routine runs. That also explains the earlier worker diagnostics
which reported `Length out of range of buffer` during `initGuestThread`.

`callDllMain` translated its temporary stack pushes with the legacy contiguous
formula `guest - imageBase + GUEST_BASE`. New thread stacks are allocated in a
sparse high guest range and already have a real mapping in the virtual map, so
that formula produces an offset beyond the `DataView`. ThreadManager's normal
stack initialization was previously corrected to use `guest_to_wasm`, but the
loader-notification path retained the obsolete formula.

DllMain stack pushes and the saved SEH word now use the interpreter's exported
`guest_to_wasm` mapper when it is available, retaining the old formula only for
loader mocks and older embedders. The focused regression delivers
`DLL_THREAD_ATTACH` on a synthetic stack at guest `0x07500000`, whose real WASM
backing is `0x00050000`; this address would be far outside linear memory under
the old arithmetic. No decoded-cache policy is changed.

The post-fix Chrome browser drive reached the live Easy control, created the
next Half-Life window, and remained in the MFC pump through 269,000 reported
slices with no `ERROR` or trap. It stops the acceptance only at the
already documented two-colour/grey first-person boundary (`colors=2` against
the test's `minColors=24`), so the stack-translation fix does not reintroduce
the pre-difficulty stall.

## OpenGL renderer and gameplay throughput

The software renderer can reach the first-person corridor, but its full-frame
CPU rasterization is a poor browser path: Safari measured about 1.2 fps with
broken streamed audio. Uplink's renderer registry uses `EngineType=2` for
OpenGL and resolves `EngineGLDriver=Default` through `gldrv\\drvmap.txt` to the
system `opengl32.dll`, the same generic WGL bridge already used by Quake II.
These values now ship as the app's startup registry instead of selecting the
bundled 3Dfx mini-driver or software renderer.

The first OpenGL run entered `hw.dll` and then appeared to exit at EIP zero.
The return address `0x006522d7` was still on the guest stack. Disassembly of
`hw.dll` RVA `0x8c2d1` showed an indirect call through `0x1068a274`; renderer
initialization fills that slot with `GetProcAddress("glColor4ub")`. The bridge
implemented `glColor4ubv` but not the scalar form, so the resolved pointer was
zero and GoldSrc called it. `glColor4ub` is appended as command-stream opcode
56 to preserve the existing GL/WGL opcode ABI, normalizes its four byte
components, and folds into immediate-mode vertex colour state without a host
round trip.

GoldSrc's z-trick also calls `glDepthRange(1, 0)`. Desktop OpenGL permits that,
whereas WebGL reports `INVALID_OPERATION` when near is greater than far. The
frontend now sends WebGL the legal sorted range and negates clip-space Z in the
projection matrix; this is algebraically equivalent to the desktop mapping.

Finally, the browser's app-specific 1,000-block slice underfed both rendering
and audio. The cooperative OpenGL path now uses 10,000 blocks, matching the
responsive Quake II scale. A fresh SwiftShader browser acceptance loaded
`hw.dll`, clicked New Game -> Easy, remained active for a 90-second gameplay
settle, issued 940 `gpuPresent` calls, and captured a textured corridor plus
HUD with 4,905 sampled colours and no trap or GL bridge error:
`halflife_uplink-easy-loaded-gpu.png`.

### Owner-drawn dialog background

Uplink's menu resources name the registered `HalfLifeLauncher` dialog class.
The resource loader previously skipped that `OrdOrString` field, so the HWND
lost its class slot, cursor, brush, and `CS_OWNDC` state. Two later synchronous
resize helpers then treated it as a stock `#32770` dialog and erased the full
640x480 client with `COLOR_BTNFACE` after GoldSrc had painted its textured
background. The built-in erase trace identified the overwrite exactly as
`hwnd=0x10002 brush=0x10 client=640x480`.

Named DLGTEMPLATE classes now inherit the same registered-class state as
CreateWindowEx windows. MoveWindow and SetWindowPos retain the legacy
BTNFACE initialization for classless dialogs, but do not overwrite a custom
class's owner-drawn client. The focused test covers both halves. A rebuilt
real-browser capture shows the black textured menu with all labels and no
grey slab:
`halflife_uplink-before.png`.

### Threads-mode menu publication

The launcher animates its logo by alternately hiding two 640x100 child
windows. Hiding either child used to restore its saved parent pixels and then
invalidate the complete 640x480 top-level window twice: once in WAT and again
in the browser renderer. In Worker mode those operations are separated by
broker hand-backs, so the compositor frequently published the parent after
the full erase but before all menu controls had repainted. The visible result
was a blinking grey/black menu body even though the guest eventually drew the
right pixels.

Child uncover now invalidates only the rectangle formerly occupied by that
child. When a saved parent snapshot already repaired the exposed pixels, the
browser does not widen the invalidation back to the complete window. Direct
repaint requests also obey the Worker slice publication boundary, and a
BeginPaint/EndPaint transaction remains private even when a cooperative slice
ends between the pair. Twelve 250ms real-Worker captures keep the menu body and
badge stable while the logo animates: the changed-pixel box shrank from
`640x324` before the fix to the intended `616x88` band at y=74..161.

### In-process renderer switching

One scheduler quantum is not suitable for both GoldSrc backends. OpenGL needs
10,000 blocks per cooperative turn to feed geometry and streamed audio, while
Software's CPU rasterizer needs the earlier 1,000-block quantum to preserve
browser input and paint responsiveness. GoldSrc also retains its WGL context
while Software is active, so context existence is not an honest mode signal.

Storage now publishes successful registry writes to the owning process. The
Half-Life browser policy watches its exact `HKCU\\Software\\Valve\\HLDemo\\Settings`
`EngineType` value: `2` selects the 10,000-block OpenGL quantum immediately.
A Software selection deliberately stays at 10,000 while GoldSrc tears down the
old renderer and rebuilds its setup dialogs; the first actual DirectDraw frame
then selects the 1,000-block CPU-renderer quantum. Switching at the earlier
registry write made the mode-change UI rebuild at one tenth the throughput,
published visibly incomplete dialogs, and encouraged several clicks to queue
against the same restart. This applies while the guest is running; the emulator
process is not restarted. A direct real-Worker OpenGL -> Software -> OpenGL
cycle completed both restarts without `Z_Free` and returned the quantum to
10,000 after OpenGL was selected again.

The Software leg of the same-process acceptance reached a textured Lambda
Complex corridor and HUD after a 90-second settle:
`halflife_uplink-software-gameplay.png`.
The test then opened the live pause menu, selected OpenGL, observed the quantum
return to 10,000, confirmed replacement of the active game, and captured the
same corridor through the GPU layer after another 90-second settle. That leg
issued 569 `gpuPresent` calls, loaded 1,863 textures, remained active with no
GL error or trap, and produced 34,101 sampled colours:
`halflife_uplink-opengl-gameplay-after-switch-gpu.png`.

## First-run keyboard bindings and movement GL calls

Browser input focus was not the reason keyboard movement failed. A focused
gameplay probe saw physical W become `0x8000`, consumed the queued key message,
and entered GoldSrc's relocated `Key_Event`; the engine's key-down byte also
became one. The key's binding pointer was null, however. Uplink's shipped
`valve.rc` comments out `exec default.cfg`, always executes `autoexec.cfg`, and
the extracted payload contains no autoexec file. The browser install now also
seeds `valve/default.cfg` at `c:\valve\autoexec.cfg`, preserving the original
file while using GoldSrc's native first-run startup path. The resulting live
bindings are `w +forward` and mouse button 1 `+attack`.

Actually executing `+forward` exposed two previously dormant OpenGL 1.1
imports. `hw.dll` resolved `glPolygonOffset` into its slot at original address
`0x10689dc8` and `glColor3ubv` into `0x10689ad4`; both were null. They are now
append-only command-stream opcodes 57 and 58. Polygon offset reaches WebGL with
both float arguments and supports `GL_POLYGON_OFFSET_FILL`; the three-byte
colour vector is normalized into packed immediate-mode RGBA state without a
Worker round trip.

A fresh browser acceptance reached the rendered corridor, held W for 500 ms,
released it, and remained active with no trap. `Key_Event` advanced from 256
to 258, the key-down state transitioned zero -> one, and `Host_Frame` continued
from 839 to 848. Visual comparison confirms forward camera displacement: the
right-wall panels and overhead opening move toward and past the camera. The
before/held captures differ at 305,732 of 459,360 pixels (66.56%):
`halflife_uplink-movement-before.png` and
`halflife_uplink-movement-w-held.png`.

## The Direct3D renderer: `CoCreateInstance(CLSID_DirectDraw)`, not `DirectDrawCreate`

GoldSrc has a third renderer beside software and OpenGL, and reaching it is two
separate switches. `-D3D` on the command line only sets a `COM_CheckParm` global
at `0x00429b2d`; what actually selects the renderer is
`HKCU\Software\Valve\HLDemo\Settings\EngineType`, read at `0x00411191` and
clamped to 1..3 at `0x00411196`-`0x004111a0` (1 = software, 2 = OpenGL,
**3 = D3D**). Passing `--args='-D3D'` alone leaves `EngineType` at 2 and the
engine never loads a D3D anything.

Seeding the value is awkward on purpose: `test/run.js` imports `--reg-import`
at line 4707 and then applies the app manifest's `startupRegistry`
**unconditionally** at 4752, so an import cannot override a key the manifest
seeds — and `halflife_uplink` seeds `EngineType = 2`. A bare `--exe` run leaves
`APP_ENTRY` null and skips `startupRegistry` entirely, which is the route that
works without touching `lib/apps.js`:

```
node test/run.js \
  --exe=test/binaries/candidates/half-life-uplink-installer/installed/hldemo.exe \
  --args='-D3D' --vfs-include='**/*' --reg-import=hl-d3d-reg.json \
  --quiet-api --quiet-api-fast --stuck-after=1000000 \
  --max-seconds=170 --max-batches=99999999 --no-close --dx-surfaces
```

with `hl-d3d-reg.json` holding one entry, the store's own shape:

```json
{"reg:HKCU\\Software\\Valve\\HLDemo\\Settings":
 "{\"values\":{\"EngineType\":{\"type\":4,\"data\":3}}}"}
```

With that, the engine boots and draws its own menus, and clicking `New game`
at (113,192) produces **"The selected D3D mode is not supported by your video
card."** — string 429 in `hl_res.dll`'s table, the D3D twin of the OpenGL 428
this note's earlier sections hit.

**The message is not about a mode and not about D3D.** Searching the binaries
for it is a dead end (it is a UTF-16 resource string, invisible to a plain
`strings`/`grep`; use `find_string.js --utf16` on `hl_res.dll`), and there is no
`push 0x1ad` to xref — the four `imm32=0x1ad` hits in `hldemo.exe` are all
`rel32` displacements. The answer came from a full `--trace-api` log instead,
reading the last calls `hw.dll` makes before the engine unloads it:

```
CoInitialize(NULL)
LoadLibraryA("ddraw.dll")                        => ok
GetProcAddress("DirectDrawEnumerateExA")         => ok
CoCreateInstance(0x0067b348, NULL, 1, 0x0067b368, ppv)   <- no success return
CoUninitialize()
...
FreeLibrary(mod=h:0x005c6000)                    <- hw.dll unloaded
```

`hw.dll` is loaded at `0x5c6000` over origBase `0x10000000`, so those two GUID
pointers are `hw+0x100b5348` and `hw+0x100b5368`; `tools/dump_va.js` names them
**CLSID_DirectDraw {D7B70EE0-4340-11CF-B063-0020AFC2CD35}** and
**IID_IDirectDraw {6C14DB80-A733-11CE-A521-0020AF0BE560}**. So the hardware
renderer does not call `DirectDrawCreate` at all on this path — it activates
DirectDraw as a COM class and then calls `IDirectDraw::Initialize`. Our
`$handle_CoCreateInstance` knew eight local classes and not that one, the
activation failed, and `hw.dll` correctly concluded it had no video hardware.

Two traps worth keeping: `--trace-api=<names>` with a name the table does not
recognize does **not** filter — it falls back to printing generic `[N] EIP=...`
lines, which look like a stack walk and are not one, so `--trace-stack` and
`--break-api` on such a name both produce the same useless dump. And the
earlier D3D probe in `hldemo.exe` at `0x403b00`-`0x403d4e` (QI IDirectDraw2,
then `IDirectDrawSurface3`, then `IDirectDrawSurface4`, storing `0x500` and
then `0x600`) is only a DirectX *version* detector that tops out at DX6 by
construction — it succeeds, and it is not where the decision is made.

### After the fix: textures upload, the primary stays empty

`$handle_CoCreateInstance` now classifies `CLSID_DirectDraw` as a local class and
manufactures the same object `DirectDrawCreate` does, with
`$ddraw_cocreate_query_wa` (in `09a8-handlers-directx.wat`) handing back the
IDirectDraw/2/4/7 wrapper for the requested IID. It refuses the Direct3D kinds
deliberately: D3D comes from a QI on an already-initialized object, so
manufacturing one over a device that has not had `Initialize` called would be a
lie the caller can act on. `IDirectDraw::Initialize` was already a DD_OK no-op,
so nothing else was needed.

The same command line now runs with **no message box at all** and
`--dx-surfaces` reports ten live surfaces where it reported zero:

```
slot=6  640x480 bpp=16 flags=0x1 (primary)     colors=1  nonZero=0/1850
slot=7  640x480 bpp=16 flags=0x2 (back buffer) colors=1  nonZero=0/1850
slot=8  640x480 bpp=16 flags=0x4               colors=1  nonZero=0/1850
slot=13 256x256 bpp=16 flags=0x4               colors=540 nonZero=1797/1849
slot=14 256x256 … 15 256x256 … 16 128x128 … 17 64x64 … 18 8x8 … 20 16x16
```

Throughput moved with it — 106 batches/s before, **28,039 batches/s** after, on
the same 150-second budget, because the engine is no longer spinning after a
failed renderer init.

So `hw.dll` initializes, creates a primary/back-buffer flip chain and uploads
real texture content (slot 13 carries 540 distinct colours). What it does not do
is put anything on the primary: all three 640x480 surfaces are `nonZero=0`, and
the only thing in the capture is the engine's menu text. **The remaining work is
the D3D7 immediate-mode draw path, not DirectDraw activation** — read the
texture slots as proof the renderer is live, and the `nonZero=0` primary as the
open bug.

## The D3D7 draw path: three gaps, and where gameplay stops now

The "open bug" above turned out to be three separate gaps, each hidden behind
the one before it. Reaching them needs the registry seed and the bare `--exe`
form from the previous section; the clicks below drive the menu:

```
node test/run.js --exe=test/binaries/candidates/half-life-uplink-installer/installed/hldemo.exe \
  --args='-D3D' --reg-import=/path/to/hl-d3d-reg.json --quiet-api --no-build \
  --max-batches=300000 --max-seconds=540 --no-close --dx-surfaces \
  --input='3200:mousedown:110:192,3230:mouseup:110:192,4500:mousedown:70:152,4530:mouseup:70:152' \
  --png=hl.png
```

(110,192) is **New game** on the main menu and (70,152) is **Easy** on the
difficulty menu. Both need a real `mousedown`/`mouseup` pair — `click` is
invisible to the engine's per-frame button sampler.

**1. Mipmap chains did not exist.** `hw.dll` creates a mipmapped texture and
then walks it with `GetAttachedSurface(DDSCAPS_TEXTURE|DDSCAPS_MIPMAP)`,
**ignoring the HRESULT** — on real hardware the chain always exists. Our
`CreateSurface` only billed the pyramid against video memory and never built the
levels, so the walk got a NULL that `hw.dll` then called `Lock` through. The
crash lands in `$g2w`, nowhere near the `CreateSurface` that caused it; the tell
is `[eip-zero] … dbg_prev_eip=0x005f7502` (`hw+0x10031531`, `call [ebx+0x64]`,
slot 25 = `Lock`). `$dx_create_mip_chain` now builds the levels at creation.
Levels bill **zero** video memory on purpose: level 0 already books the whole
4/3 pyramid estimate, and moving that would shift the `GetAvailableVidMem`
deltas apps calibrate texture budgets against. `GetAttachedSurface` also zeroes
`*ppv` when it fails now, so a caller that ignores the HRESULT gets a NULL
rather than whatever it left in that variable.

**2. `IDirect3DVertexBuffer::ProcessVertices` was a fail-fast stub.** GoldSrc
batches every frame through it: source vertices in, transformed and lit vertices
into the buffer it then draws from. The maths already existed for untransformed
`DrawPrimitive`, so `$d3dim_vb_process_vertices` reuses it — pack the source FVF
into the canonical 32-byte vertex, run `$d3dim_prepare_draw_vertex`, unpack into
the destination's own FVF. The three arguments past `arg4` (`dwSrcIndex`,
`lpD3DDevice`, `dwFlags`) come off the guest stack at ESP+24/+28/+32 and the
handler pops 36.

**3. The canonical `D3DLVERTEX` was packed two dwords short.** This is the one
that mattered for the picture. `D3DLVERTEX` is `{x,y,z, dwReserved, dcColor,
dcSpecular, tu, tv}` — the reserved DWORD at +12 puts colour at +16 and the
texture coordinates at +24/+28, which is where `$d3dim_prepare_draw_vertex` and
every other consumer read them. `$d3dim_pack_fvf_vertices`'s type-2 branch wrote
colour at +12, specular at +16 and UV at +20/+24, so the transform was fed a
zero colour and **the wrong pair of dwords as texture coordinates**. Nothing
asserted, nothing crashed; the frame just came out white. A pre-existing bug
that no test covered — any FVF-sourced `D3DLVERTEX` draw was affected, not only
Half-Life.

With all three in, the same command line reaches **gameplay**: the D3D menu
draws in full (logo, items, PC Gamer badge), New game → Easy loads, the real
Half-Life loading screen renders through D3D, and the frame at ~70,000 batches
carries the HUD (health 100, suit, ammo) over the Lambda Complex intro text.
Throughput went 130 batches/s where the pre-fix route managed 33.

**Still open:** the world itself is not drawn. The HUD's 2D `TLVERTEX` sprites
and the level text composite correctly onto the primary and back buffer
(`nonZero=429/1850`, 210 colours), but the 3D geometry behind them is black, and
the background carries a tiled repeat of the loading screen in the top-left
quadrant. Read that quadrant as the next lead: content confined to a 320x240
corner with a vertical repeat is a pitch/stride disagreement, not a missing
draw. `--dump-ddraw-surfaces=DIR` plus the `640x480` names in the census is the
fastest way to see which surface holds what.

### Where the world geometry actually goes (2026-09-21)

The "pitch/stride disagreement in a blit" lead recorded above is **wrong**, and
the measurement that kills it is cheap enough to repeat: dump the surfaces
(`--dump-ddraw-surfaces=DIR`) and count colours per quadrant of the back
buffer.

```
BACK BUFFER (slot 7, 640x480, pitch 1280) at gameplay
  top-left     2672 colours   loading-screen tile, HUD, location text
  top-right       1 colour    black
  bottom-left   286 colours   real world geometry: textured, very dark
  bottom-right    1 colour    black
```

Two things follow. First, **the geometry is being drawn** — the bottom-left
quadrant holds a textured surface with 286 colours, not a missing draw. Second,
everything lands at **x < 320 while y uses the full 0..480**: the horizontal
axis alone is wrong, so this is not a uniform half-scale render and not "the
engine thinks the screen is 320x240" either.

Three facts rule out our own raster and present path:

- **`dx_boids` (DX SDK, same D3DIM rasterizer, same 640x480 16bpp flip chain)
  fills all four quadrants.** A blit-stride or rasterizer-width bug would hit it
  too.
- **Only three 640x480 surfaces exist in the whole run** (primary, back buffer,
  one offscreen); every other one of the 474 is a 4x4..256x256 texture. There is
  no 320-wide surface for the frame to have been rendered into.
- **The main menu draws correctly across the full 640 pixels**, and it is the
  game's own art through the same device. So the engine's idea of the screen is
  right at menu time and becomes 320 wide somewhere in level load.

So the remaining question is what HL reads during level start that comes back
half width — not what we do with the vertices afterwards. `--trace-dx` prints
the `DPVtx` screen coordinates per vertex, which answers it directly; use the
new `--trace-from=N`/`--trace-to=N` window, because the route is ~70,000
batches and an unwindowed trace spends the whole wall clock on boot output.

**The batch-scheduled click route is load-fragile.** The same command line
reached gameplay at 225 batches/s on a quiet box and was still sitting on the
main menu at batch 29,941 on a box at load 23 — the clicks at batch 3200/4500
landed before the menu was up. Check `uptime` first, or drive the clicks from
state over `--control-stdin` rather than from batch numbers.

### CORRECTION: look at the canvas, not the DIB (2026-09-21)

Everything above about "geometry confined to the left half / a 320x240 corner"
was read out of `--png` captures, and **`--png` has been photographing the wrong
surface for this app.** Measured on one run, capturing both at the same instant:

| capture | flag | what it shows |
|---|---|---|
| composited screen | `--input=N:png:PATH` | the game at full 640x480 |
| DirectDraw surface DIB | `--png=PATH` | the same image at half size in the top-left quadrant, black elsewhere |

`canvas(2x, 2y)` matches `dib(x, y)` at every probe — `(200,300)=63514a` vs
`(100,150)=605048`, `(400,120)=4a2808` vs `(200,60)=482808`,
`(120,440)=735142` vs `(60,220)=705040`. Every DIB channel value is a multiple
of 8 (RGB565) and the canvas ones are not, so the DIB is a **half-size 565
requantization** of the presented frame, not the frame. `chooseDxPresentationSurface`
picks it because it is 640x480 and nonzero. So on this app, judge with
`--input=N:png:` and treat `--png`/`--dump-ddraw-surfaces` as a lead only.

**What the canvas actually shows at gameplay** (batches 70k/80k/90k, `-D3D`):

- The route reaches gameplay. The HUD is correct and full-scale: health `100`,
  armor `0`, suit icon, and the live "CURRENT LOCATION: LAMBDA REACTOR COMPLEX /
  CONTAINMENT FAILURE" text, whose contents differ between the 70k and 80k
  frames, so the engine is running rather than parked.
- **The world geometry is absent.** Behind the HUD is the *loading screen*,
  tiled three times vertically with a scale break around x=200 — stale pixels
  that nothing overwrote.

So the 2D overlay path (HUD, text) is correct at full resolution and the 3D
world draw produces nothing at all. That is a different bug from "the geometry
lands in the wrong corner", and it rules out the viewport/vertex-scale theories
above: a wrongly scaled transform would still put *something* on the screen.

`IDirectDraw_SetDisplayMode(0x280, 0x1e0, 0x10)` — 640x480x16 — is the only mode
call in boot, so the guest asks for the right mode and our half-size DIB is
downstream of that, not a cause.

### All three renderers fail identically (2026-09-21)

Same click route (New Game -> Easy, repeated), same batch budget, canvas
captures at 50k/70k/90k:

| leg | args | EngineType | result | HUD | world |
|---|---|---|---|---|---|
| software | `-soft` | 0 | reaches gameplay | correct | **black** |
| opengl | `-gl` | 2 | reaches gameplay, 92k batches in 80s | correct | **black** |
| direct3d | `-D3D` | 3 | reaches gameplay | correct | **stale pixels** |

No crash in any leg; T2 exits normally in all three. The D3D leg's leftover
loading screen and the other two legs' black are the same condition seen
through different buffer-clear behaviour, not two bugs.

**So this is not a D3DIM bug** — three independent backends cannot share a
rasterizer fault, and the HUD proves each renderer is alive and drawing through
the same pipe that shows nothing else. Every earlier D3D-specific theory in this
file is therefore dead: the vertex path, the viewport transform, the render
target, `SetDisplayMode`. Do not re-investigate them.

**The level loads.** `--trace-fs` over the whole route:

- `c:/valve/maps/hldemo1.bsp` misses as a loose file, which is normal — HL probes
  loose first and then the PAK — and `maps/hldemo1.bsp` **is** in `pak0.pak`.
- 1193 `pak0.pak` reads; 769 loose-file misses, all of them assets that live in
  the PAK (sprites, sounds, `pldecal.wad`).
- Zero engine errors: no `Host_Error`, no "couldn't load", no message box.

And the engine is clearly simulating: the level-start title card
("CURRENT LOCATION: LAMBDA REACTOR COMPLEX", "STATUS: EVALUATION IN PROGRESS")
is driven from `titles.txt` by a map trigger, so entities are ticking, and the
player holds 100 health rather than falling out of a broken world.

So: geometry data present, level running, 2D correct, world pass produces
nothing in every backend. The next question is what all three renderers share
upstream — the most likely candidate is the engine's 3D viewport rect
(`r_refdef.vrect` / `vid` dimensions): an empty vrect makes every renderer draw
2D only, which is exactly this picture. Confirm by counting what the GL leg
issues during a gameplay frame; zero world triangles points at the refdef, a
normal triangle count points at the surface they land on.

### The clock was the cause, and the three legs then diverge (2026-09-21)

**`--tick-ms-per-batch=200` (the default) renders no world at all, in any
renderer.** At 200ms of guest time per batch the engine's simulation step is so
coarse that the world pass produces nothing; the HUD and the level-start title
card still draw, which is what made this look like a renderer bug for a whole
session. This is the headless-clock trap in CLAUDE.md, and on this app it is
total rather than merely slow.

**Always pass `--tick-ms-per-batch=16` to Half-Life Uplink headless.** The route
then needs roughly twice the batches, since boot and menu take more of them:

```
IN='6000:mousedown:110:192,6030:mouseup:110:192,12000:…,24000:…,
    30000:mousedown:70:152,…,48000:…,130000:png:OUT.png'
node test/run.js --exe=…/hldemo.exe --args='-soft' --reg-import=SEED.json \
  --no-build --quiet-api --tick-ms-per-batch=16 \
  --max-batches=175000 --max-seconds=900 --no-close --input="$IN"
```

With that fixed, the three renderers stop agreeing, and the software one is now
the reference:

| leg | at 200ms/batch | at 16ms/batch |
|---|---|---|
| software (`-soft`, EngineType 0) | nothing | **correct** — corridor, floor tiles, ceiling, stairs, wall panels, signage |
| opengl (`-gl`, EngineType 2) | nothing | scattered lit polygons on black; static across 130k/170k |
| direct3d (`-D3D`, EngineType 3) | nothing | some geometry (gold fan-shaped streaks) over an **uncleared** loading screen |

So there are two real remaining bugs, and they are renderer-specific after all —
just not the ones hypothesised above:

1. **OpenGL draws only part of the world.** Software proves the BSP, the PVS and
   the camera are right, so this is in the GL leg. Note the software leg's frame
   moves (92.0% of pixels differ between 130k and 170k) while the GL leg's is
   byte-identical at both, so GL is not merely mis-drawing — it is drawing the
   same dead frame.
2. **Direct3D never clears the colour buffer**, so each frame composites over
   the previous loading screen, and what geometry it does draw is wrong.

Use the software leg as the oracle for both: same route, same tick, `png-diff`
against `t16soft-*.png`.

### OpenGL: the backend silently drops `glDepthRange`, which kills `gl_ztrick` (2026-09-21)

**Before any of this: `--headless-gl` needs `caffeinate -u`.** When the Mac's
display is asleep GLFW's display list goes empty, `glfwInit()` still succeeds,
and Half-Life reports "The selected OpenGL mode is not supported by your video
card." — which reads exactly like a renderer bug and is not one. `caffeinate -d`
is not enough: it only *prevents* sleep and cannot wake a display that is
already asleep. `-u` asserts user activity and does. The diagnostic is already
printed, so read it before theorising:
`[gl] --headless-gl requested but UNUSABLE: headless GL loaded but GLFW sees ZERO displays`.
Several runs and a whole texture/lightmap investigation were spent on phantom
bugs behind this line.

**The GL leg's root cause was `glDepthRange`, and the symptom named it.**
GoldSrc's `gl_ztrick` (on by default) **never clears the depth buffer**. Instead
it alternates, every frame:

```
even frames:  glDepthFunc(GL_LEQUAL)  glDepthRange(0, 0.5)
odd  frames:  glDepthFunc(GL_GEQUAL)  glDepthRange(1, 0.5)
```

so each frame's depth values beat the previous frame's leftovers by
construction. Verified in one run: 216 calls of each range and **zero
`glClear` calls**.

`@node-3d/webgl` (the `--headless-gl` backend) rejects *every* non-default
depth range with `GL_INVALID_OPERATION` (1282) — including the perfectly legal
`glDepthRange(0, 0.5)` — and silently leaves the range at `[0,1]`. Both z-trick
phases then wrote the full range and fought each other's leftovers, so **both**
rendered partially: the scattered-lit-polygons-on-black frame recorded in the
table above.

**The shape of the symptom is the diagnostic, and it is worth keeping.** A
missing depth *clear* breaks only the GEQUAL phase and gives alternating
good/bad frames. A dropped depth *range* breaks both phases and gives a stable
half-drawn scene — which is why the GL frame was byte-identical at 130k and
170k. That "it's drawing the same dead frame" observation was the real clue.

**Fix (in `lib/gl-compat.js`): fold the range into the projection matrix.**
Depth range is just an affine map on clip-space z —
`d = ((f-n)/2)*z_ndc + (n+f)/2` — so against a driver stuck at `[0,1]`
(`d = 0.5*z' + 0.5`) pre-transforming clip z as

```
z' = (f-n)*z + (n+f-1)*w
```

reproduces `d` exactly. It handles the reversed `f < n` case with no separate
negation, and `z'` stays inside `[-1,1]` for any `0<=n,f<=1`, so nothing is
clipped that would not have been. A one-time probe in the `FixedFunctionGL`
constructor (`_probeDepthRange`) sets `depthRangeEmulated` only when the
backend actually refuses a range, so browsers — where `depthRange` works — stay
on the original path, including the pre-existing reversed-range negation.
`test/test-opengl-depth-range-fold.js` pins the arithmetic against real GL's
mapping at five depths and pins that an honouring backend is left alone.

**Result: the GL leg renders the corridor correctly with stock `gl_ztrick 1`.**
No cvar workaround is needed and none should be added.

#### GL is not "slow", and the command stream already buffers

Measured with `tools/gl-stats-preload.js` on the gameplay route, per frame:

```
calls=7.3  batches=7.3  enq=592.7  draws=91.8  verts=5238  spans/draw=6.46
```

592.7 enqueued spans collapse into **7.3 host crossings**. The GL path already
does what D3D does — batch the command stream in WAT and submit it in bulk — so
transport is not a bottleneck and "buffer the calls like D3D" is already the
implementation. Do not re-open this.

#### GL hypotheses eliminated with evidence — do not re-investigate

- **Paletted textures** — not advertised, and HL checks before using them.
- **Hardware gamma** — HL has a `gamma` cvar but `hw.dll` has no `GammaRamp`
  import; `SetDeviceGammaRamp` is never called.
- **Multitexture / all-zero `texcoord1`** — expected, not a bug. `hw.dll` checks
  for `GL_SGIS_multitexture`, **not** the `GL_ARB_multitexture` we advertise, so
  it prints "NO Multitexture extensions found" and takes the single-texture
  two-pass path where `texcoord1` is legitimately unused.
- **Lightmap uploads** — 143 `SUB 128x128` RGBA uploads, none blank, maxByte 255.
- **Span merging across texture binds** — `enqueuePacked`'s mode-only merge is
  correct: `_call` already flushes pending geometry before every non-packed GL
  command (`lib/gl-compat.js`, the flush inside the dispatcher).
- **Blend state / `preserveDrawingBuffer` / depth persistence** — ruled out by an
  alternation test that captured five consecutive frames and found them
  identical.

Two traps in the *instrumentation* that produced false readings first: a
`_call` wrapper must record state **after** `origCall.apply`, because `_call`
flushes pending geometry inside it (recording before credits every draw to the
state that came after it, which made the lightmap pass look like it never
blends); and `glDepthRange` takes `GLclampd`, so a census must read it with
`_f64(stack,0)`/`_f64(stack,2)` — misread as floats it prints `0.000..0.000`
and `0.000..1.875` (the high dword of double 1.0, `0x3FF00000`, is float
1.875). `lib/gl-compat.js` itself was always correct on both counts.
`tools/gl-texture-census.js` is the corrected census, a `-r` preload needing no
source edit or rebuild.

### D3D: `D3DCLEAR_ZBUFFER` alone is deliberate (2026-09-21)

The earlier reading that "Direct3D never clears the colour buffer" is a
**misattribution**. HL calls

```
IDirect3DViewport3_Clear2(..., dwFlags=0x00000002, ...)
```

which is `D3DCLEAR_ZBUFFER` only, deliberately, relying on its own full-screen
world geometry to cover the colour buffer. Our `Clear2` honours the mask it is
handed and is correctly wired; a stale-looking backdrop under a D3D scene is a
**coverage bug in the draw path**, never a missing clear here. The stale comment
on `$d3dim_viewport_clear_full` in `src/09ab-handlers-d3dim-core.wat` that
claimed the 09a8 handlers return S_OK without painting is wrong and has been
corrected.

### D3D: `MultiplyTransform` had its operands the wrong way round — FIXED (2026-09-21)

**All three renderers now draw the Uplink corridor.** The D3D capture at 170k
batches matches the software oracle geometrically: walls, floor tiles, ceiling,
the wall panels, the stairs at the far end, HUD at 100 health.

The bug was one line in `$d3dim_multiply_transform`
(`src/09ab-handlers-d3dim-core.wat`): it computed `current × supplied` when D3D
requires the supplied matrix on the **left**. D3D transforms row vectors
(`v * World * View * Proj`), so the factor a `MultiplyTransform` appends has to
end up leftmost to be the one applied to the vertex *first* — which is what
makes a run of these calls behave like OpenGL's matrix stack, where
`glMultMatrix` post-multiplies a column-vector matrix. The two conventions are
transposes and `(M*A)^T = A^T * M^T`. Sealed by
`test/test-d3dim-multiply-transform-order.js`, which fails on the old order with
exactly the reversed translation row.

**Why it took a while to see.** The wrong product is still a proper rotation
(det +1), so nothing about the matrix looked malformed — it was a *valid camera
rolled 180°*, with the world upside down and 130 of 178 transformed vertices
behind the eye. Every cheaper hypothesis looked plausible and was wrong. Do not
re-investigate these:

- **The projection is not the problem.** HL uploads
  `[1 0 0 0 | 0 1.333 0 0 | 0 0 -1.002 -1 | 0 0 -8.008 0]`, which is exactly
  `glFrustum(near=4, far=4004)` — GL depth convention, `z_ndc ∈ [-1,1]`, which
  our D3D-convention clipper would halve. It is **also** a valid right-handed
  D3D projection with near ≈ 7.99, far 4004, and the two readings are
  indistinguishable from the matrix alone. Under the D3D reading it clips only
  closer than ~8 units, which is harmless. Handing raw GL column-major arrays
  to `SetTransform` is likewise *correct*, not a bug: row-vector × the
  row-major read of a column-major array equals column-vector × the original.
- **The near/far clipper is correct.** `$d3dim_tl_clip_distance` reconstructs
  clip z as `z_ndc/rhw` and `w - z` as `(1-z_ndc)/rhw`, and
  `$d3dim_interp_tl_clip_vertex` un-projects to clip space, interpolates there
  and re-projects. Behind-eye vertices are recoverable from a TL vertex exactly,
  because `rhw = 1/w` keeps w's sign.
- **No double transform, no FVF or stride mismatch.** ProcessVertices reports
  `srcFVF=0x242 stride=32 → dstFVF=0x1c4 stride=32` and the VB draw sees
  `vtxType=TLVERTEX`.
- **The scratch "aliasing" at state+3200 is deliberate and safe** — the three
  vertices are memcpy'd to `+3744` before the clip buffer reuses it.
- **`$d3dim_multiply_transform`'s multiply direction and `$d3dim_get_transform`'s
  copy direction** were both read and are correct; only the operand order was
  wrong.

**What the real path is.** HL's D3D world geometry is
`VB Lock → ProcessVertices → Unlock → IDirect3DDevice3_DrawIndexedPrimitiveVB`,
~164× per frame — *not* `DrawPrimitive`, which is why the `DPBlend`/`DPVtx`
records show nothing. A one-frame API census reads: 632 `SetRenderState`,
491 `DrawIndexedPrimitiveVB`, 457 `SetTexture`, **221 `MultiplyTransform`**,
106 `SetTransform`, 100 `GetTransform`. That Multiply/Get/Set mix is a GL
matrix stack (`glPushMatrix` → Get, `glPopMatrix` → Set, `glMultMatrix`/
`glRotatef`/`glTranslatef` → Multiply), and the sequence is Quake's `R_SetupGL`
verbatim: rotate −90 about x, rotate 90 about z, roll, pitch, yaw, then
translate by −`vieworg`.

**The tell, for next time.** The composite's translation row. Under the correct
order the translate is leftmost, so the rotations that follow rotate its offset;
under the reversed order it is last and its operand survives *verbatim*. Seeing
the raw `glTranslatef` argument sitting in the composite is the whole diagnosis.
HL confirms it independently: it also caches its own modelview and pushes it
through `SetTransform(WORLD)` 102×/frame with translation
`(-2047.969, -64.031, -744.031)` — the **rotated** origin, which is what the
corrected accumulation produces; the old order produced the unrotated
`(2047.969, -744.031, -64.031)`.

Two diagnostics were added for this and are worth reaching for again
(`--trace-dx`, and window them — a 60-batch window at gameplay contains *no*
frame, since HL runs 400–667 batches per frame):

| record | says |
|---|---|
| `[dx] Xform Set/Mul WORLD\|VIEW\|PROJECTION [matrix]` | every raw matrix the guest supplies, before composition — the sequence, which is the only thing that explains a composite |
| `[dx] PVout n=… v0 screen=…,… rhw=… BEHIND-EYE` | the first vertex ProcessVertices produced, flagged when `rhw <= 0`. The **share** is the signal: 2% is normal, 73% is a broken camera |
| `[dx] SetMtx handle=0xC0FFEE […]` | the composite world×view×proj actually used for a transform |
| `[dx] PVtx` / `[dx] DrawVB` | the VB path's layouts and vertex counts (change-gated, so they fire once per transition) |

Also fixed alongside: `IDirect3DDevice3_SetTransform` was a third hand-written
copy of the same memcpy and now aliases the canonical Device2 handler through
`api_table.json`'s `handler` field, as the Device7 slot already did. The copy had
drifted — it never unbound the execute-buffer matrix handle for the slot it
overwrote (so a later `$d3dim_refresh_bound_matrix` could put the handle's
matrix back over an explicit `SetTransform`), and it emitted no trace, so a run
whose census counted 106 `SetTransform` calls produced not one `Xform` record
and the transform sequence read as pure `MultiplyTransform` accumulation with no
reset anywhere in it. That missing reset was itself a red herring for an hour.

And one efficiency bug found on the way: `DrawIndexedPrimitiveVB` has no vertex
count in its signature — the whole buffer is the pool and the indices choose —
so the callers pass `count = -1` and the capacity clamp turned that into the
buffer's *capacity*. HL's is 32768 vertices, so every draw packed 1 MB and did
32768 conversions to rasterize the handful of vertices the indices named,
~164 draws a frame. Worse than slow: a failed 1 MB `heap_alloc` drops the draw
in silence. Now clamped to `max(index)+1` (`verts=32768` → `verts=4`). It was
*not* the visual bug — fixing it moved the frame 3.29% — but it is why that path
looked like it might be dropping geometry.

**Previous state, for the record**: before the fix the capture at 170k batches
showed the loading screen — "CURRENT LOCATION: LAMBDA … COMPLEX", "STATUS: …
EVALUATION IN PROGRESS" with overlapping/doubled text, a brown crate texture
tiled vertically, yellow streaked fan geometry down the left edge, and a correct
HUD. The HUD was right because it supplies TLVERTEX and never touches a matrix,
which is precisely why the matrices were only observable from inside
ProcessVertices.

### Confirmed again at a camera that is not level (2026-09-21)

The first confirmation of the operand order was made at a frame whose pitch and
roll were **exactly zero**, which is the weakest possible test of a matrix
*order*: with the middle rotations identity there are fewer non-commuting pairs
left to disagree about. So the route was extended to mouse-look. Deliver the
look with `relmousemove`, spread over batches — the docs' warning is real, a
single lump is a delta no hand could produce:

```
IN="$IN,171000:relmousemove:0:-160:40"   # up
IN="$IN,177000:relmousemove:0:320:40"    # back down, past level
```

At batch ~175k the `Xform` records show six `Mul WORLD` calls in this order —
`R_SetupGL` with **pitch 5.3° and roll zero** (GoldSrc omits the roll rotation
when the view has no punch, so there are four rotations, not five):

| # | supplied matrix | what it is |
|---|---|---|
| 1 | `[1 0 0 / 0 0 -1 / 0 1 0]` | `glRotatef(-90,1,0,0)` |
| 2 | `[0 1 0 / -1 0 0 / 0 0 1]` | `glRotatef(90,0,0,1)` |
| 3 | `[0.996 0 -0.092 / 0 1 0 / 0.092 0 0.996]` | **pitch, −5.3°** |
| 4 | `[0 1 0 / -1 0 0 / 0 0 1]` | yaw, −90° |
| 5 | `[… / 2047.969 -744.031 -64.031 1]` | `glTranslatef(-vieworg)` |

Appending each on the left gives rotation `[-1 0 0 / 0 0.092 0.996 /
0 0.996 -0.092]` and translation `(-2047.969, -132.2, -735.1)`. HL's own cached
modelview, pushed through `SetTransform(WORLD)` 90× in the same window, reads
`[-1 0 0 / 0 0.092 0.996 / 0 0.996 -0.092 / -2047.969 -132.228 -734.982]` —
**agreement to three decimals on a pitched basis**, computed two independent
ways. Under the reversed order the translation row would still be the raw
`glTranslatef` operand, so the two orders are genuinely discriminated here.

The composite (`SetMtx handle=0xC0FFEE`) is that world times the projection and
checks out arithmetically against it, `BEHIND-EYE` is 3 of 522 `PVout` records
(0.6%), and the three captures — `look-170-level.png`, `look-176-up.png`,
`look-182-down.png`, 93%/95% different from each other — all show the corridor
upright with the horizon pitching, walls vertical, floor below and ceiling
above. Nothing streaks or inverts at any pitch.

`test/test-d3dim-multiply-transform-order.js` now also drives the whole
`R_SetupGL` sequence with pitch 23.5°, yaw 137.25° **and** roll 11.75°, asserts
the device reproduces the hand-computed left-appending composite word for word,
and asserts the reversed product's rotation block differs from it by more than
rounding — so the test proves it discriminates the orders rather than merely
passing. It also asserts the composite's rotation rows stay unit length, which
records *why* the reversed matrix never looked malformed.

### The D3D-vs-software "lighting difference" does not exist (2026-09-21)

Worth recording because it was on the next-steps list twice. The D3D corridor
*looked* darker than the software oracle with flatter wall-sign detail. It is
not: `node tools/png-inspect.js stats FILE` now prints mean RGB and Rec.601
luma, and the two captures of the same scene come out at **54.18** (D3D) and
**56.44** (software) — a 4% difference, which is 16bpp quantization and
dithering, not a missing pass. A dropped `MODULATE2X` or an unrendered lightmap
halves the mean; nothing here is halved. The top-colour histograms overlap too
(`#3a4921` 1.86% vs 1.93%, `#424d29` 1.63% vs 1.75%).

The impression came from comparing two captures taken at slightly *different
camera positions*, where more or less of a dark ceiling is in frame. Measure the
mean before believing a brightness difference.

Two hypotheses died on the way, both by measurement rather than argument:

- **Missing `D3DTOP_MODULATE2X`.** Real gap — `$d3dim_texture_stage_combine`
  implements only `SELECTARG1` (2), `SELECTARG2` (3) and `MODULATE` (4), and
  `lib/d3dim-gpu.js` collapses everything else to 4 with
  `const op = v => (v === 2 || v === 3 ? v : 4)`, while `lib/d3d9-fixed.js:295`
  has the full table. But Half-Life never uses it: a census over one gameplay
  frame has `COLOROP` ∈ {2, 4} and `ALPHAOP` ∈ {1, 3, 4} and nothing else. The
  gap is real and worth closing for *some other* app; it is not this symptom.
- **Missing 2x framebuffer blend.** GoldSrc's overbright pass sets
  `SRCBLEND=D3DBLEND_DESTCOLOR (9)` with `DESTBLEND=D3DBLEND_SRCCOLOR (3)`,
  which is `src*dst + dst*src` = 2x modulate. `$d3dim_blend_channel` already
  implements both factors. The rest of the frame's render states are
  `ALPHABLENDENABLE` (202 toggles), `ZWRITEENABLE` (162), `SHADEMODE` (84),
  `ALPHATESTENABLE` (40), `ZFUNC`, `CULLMODE`, `ALPHAREF`/`ALPHAFUNC` — all
  covered.

Census command, for anyone re-opening this:

```
--trace-api=IDirect3DDevice3_SetTextureStageState,IDirect3DDevice3_SetRenderState \
--trace-from=168600 --trace-to=170000
```

### The launcher menu is renderer-independent (2026-09-22)

Captured at batch 5000 through all three registry seeds — `-D3D`, software and
`-gl` with `--headless-gl` — the menu PNG is **byte-identical** in every case
(md5 `3467bf3489b9d683b92396c084d54580`). Half-Life draws that screen in 2D
before the 3D device engages, so `EngineType` has not taken effect yet.

Two consequences. A menu screenshot proves nothing about which renderer is
selected, so do not use one as evidence a renderer works — the earliest honest
check is the first world frame. And a renderer comparison only has one leg
worth capturing: gameplay. The matched set is `look-170-level.png` (D3D),
`t16soft-170.png` (software) and `awake-170.png` (OpenGL), all at batch 170000
on the same input route, with mean luma 54.18 / 56.44 / 58.48 — an 8% spread
across three rasterizers at 16bpp, which is dithering and quantization.

### The in-game renderer switch: the route works, the restart does not (2026-09-22)

The guest can change renderer from its own UI, and the route is worth writing
down because none of it is guessable from disk:

    main menu            Configuration   click (110,250)
      -> Video           click (110,216)
      -> Video modes     click (110,184)      dialog 0x10032
    tab strip at y=154   Software x=290, OpenGL x=371, Direct3D x=423
    Ok #1                dismisses the driver-advice prompt (dialog 0x10045)
    Ok #2                commits the mode dialog (0x10032)

**Both Oks are mandatory.** The advice prompt owns control id **1**, the same id
as the mode dialog's "&Ok", so a single `dlg-click:1` looks clean, crashes
nothing, and never switches. The dumps name the dialog each click reached, so
use them rather than assuming: `after-tab: dlg=0x10045`, `after-ok1:
dlg=0x10032`.

Also undocumented: merely *opening* Video modes writes `EngineType = 1` twice
by itself. So a `[reg] set` line is not evidence of a switch — only the value
after the second Ok is.

Measured with `hl-chain.sh A gl d3d soft` (software seed, `--headless-gl`,
`--tick-ms-per-batch=16`): the first leg writes `EngineType = 2`, so
**software -> OpenGL does switch**. The second and third legs never reach a
mode dialog at all (every dump reports `dlg=0x1002b`, then `0x10048`) and write
nothing.

### CORRECTION to the D3D teardown claim (2026-09-22)

An earlier session attributed the post-switch corruption to Direct3D's
teardown, on the evidence of one capture taken after a switch *to* D3D. That
attribution was wrong. The OpenGL leg above does exactly the same thing:
`chain-A-gl.png` is 85.4% `#c0c0c0` with 11% black -- Win98 dialog grey, not the
game menu -- and the settled dump says `dlg=0x1002b`, i.e. the mode dialog
closed and the Video config dialog is what owns the screen, with no re-rendered
menu behind it. Two renderers, one symptom: the fault is in the **restart
path**, not in either rasterizer.

That has a direct consequence for any automated switch test. Every click after
the first switch is scheduled against a window layout that no longer exists, so
**a blind batch-scheduled chain cannot cross a renderer restart**. A test must
either re-derive the route from a `dlg-dump` after each switch, or be N separate
single-switch runs seeded from each starting renderer.

### It is terminal: the app never comes back (2026-09-22)

Measured with `hl-recover.sh` — software seed, switch to OpenGL, then a capture
*and* a `dlg-dump` every 3000 batches for 30000 batches after the second Ok
(~8 minutes of guest time at `--tick-ms-per-batch=16`):

    c273227718fa6808f57f166c55f85f67  rec-0.png .. rec-10.png   (all 11)
    dlg-dump:t0 .. t10:  dlg=0x1002b modal=none                 (all 11)

**One md5 across the whole series.** Eleven captures spanning 30000 batches are
byte-identical, and the same dialog owns the screen at every one of them. The
app is not slow, not mid-teardown and not waiting on a frame it will eventually
draw — after an in-game renderer switch it stops making progress entirely.

So the switch route works (`EngineType = 2` is written, confirmed again here)
and the restart that should follow it never happens. Note the dumps report
`modal=none`, so this is not the usual "blocked on a message box" shape that a
single hash normally indicates; whatever holds the app is not a modal we are
failing to dismiss.

Next measurement, not yet done: where the guest is actually parked. `--trace-sched`
across the switch, and an API census either side of batch 17000, would say
whether it is spinning in a pump, blocked in a wait, or looping inside the
engine's own restart. Until that is known, no fix should be attempted — and no
automated multi-switch test can pass, because one switch per process is all the
app currently survives.

### "D3D does not fill the screen" is a page bug, not an emulator one (2026-09-22)

Reported from the browser: Half-Life under `-D3D` renders correctly but sits in
the top-left corner of a large page. The guest was cleared first — `hl5.log`
shows its last `IDirectDraw_SetDisplayMode` is `640x480x16` with **no**
`RestoreDisplayMode` anywhere, so a mode is in effect and the app is not
asking for a window the size of the page.

That leaves one difference between the working CLI capture and the broken
browser one: the size of the screen the frame is composited onto. Running the
identical D3D route at `--screen=1600x1000` **does not reproduce it** — the
menu fills all 1600x1000 (`menu-big-8k.png`, 307 distinct colours, the Half-Life
banner spanning the full width). So the emulator's own compositor scales a
640x480 guest surface to whatever screen it is given, and the fault is above
the emulator, in the page.

Two things about how to measure this, because the first attempt wasted 25
minutes. **The question is where the frame lands, not what is in it**, so the
main menu answers it exactly as well as gameplay and arrives before batch 6000
instead of after 120000: `hl-bigmenu.sh` is 9000 batches and 38s of wall clock
against `hl-bigscreen.sh`'s 170000, which died on its 1500s guard at batch
67398 having captured nothing. And the throughput difference is not noise —
the same build runs **235 batches/s at the menu and 45 in gameplay**, so a
batch budget calibrated on one is off by 5x on the other.

Not yet known: whether the page sizes the canvas wrongly, or sizes it right and
fails to scale into it. That is a `lib/browser-shell.js` / `host.js` question
and needs a browser, not a CLI run.

## 2026-09-22: gameplay on the WAT software GL path

With the registry's default `EngineType = 2` (OpenGL) and the WAT rasterizer
in place of WebGL, the corridor draws textured, lit and with the HUD — no
display, no `caffeinate`, since nothing here touches GLFW:

```
node test/run.js --app=halflife_uplink --no-build --gl-renderer=software \
  --tick-ms-per-batch=16 --quiet-api --quiet-blocks --stuck-after=1000000 \
  --max-batches=99999999 --max-seconds=280 --no-close --gl-census \
  --input='3200:mousedown:110:192,3230:mouseup:110:192,4500:mousedown:70:152,4530:mouseup:70:152' \
  --png=out.png
```

319,586 batches in 280s; census: 2,054,590 triangles, 32,462 dropped at the
eye plane, 57,496 culled, 755 presents, 471 texture uploads, none refused.

## 2026-09-23: gameplay on the WebGL D3DIM path (`--d3dim-gpu`)

The Direct3D leg also plays on the GPU executor. It uses the same route as above, plus `--headless-gl --d3dim-gpu` (with `caffeinate -d -u` running) and `--tick-ms-per-batch=16`:

```
[d3dim-gpu] draws=197673 triangles=5104439 clears=1426 fallbacks=0 errors=0 fences=3027
```

That was 741,285 batches in 280s, with zero fallbacks to the software rasterizer. The capture shows the corridor with its floor tiles, the ceiling, the wall panels and signage, and the HUD (`100`/`0`). That is the same picture as the software reference. It is the top-left quadrant of the `--png` DIB, which is the half-size copy described under "look at the canvas, not the DIB". So all four legs now reach a rendered world: software, OpenGL on WebGL, OpenGL on WAT software GL, and Direct3D on both the software D3DIM rasterizer and WebGL.

## Call-form census (2026-09-29)

**Route.** Box2 ran `--gl-renderer=software --tick-ms-per-batch=16`, driven
over `--control --frozen` with `tools/ctl.js`:

| step | batch |
|---|---|
| menu | 6000 |
| New Game, Easy | 7530 |
| loading | 27560 |
| title card | 57560 |
| corridor | 87560 |

A batch-scheduled `--input` click route is fragile: the clicks land before the
menu exists.

**Census over 100k..160k**, holding W with mouse turns
(docs/uop-tier-design.md §15.1):

- **uop share:** 71-87%.
- **Guest indirect:** 0.09-0.26%.
- **Declined for call-indirect:** 2.3-5.6% of entries sit in loops the tier
  declined for this reason. They are the per-vertex immediate-mode loops at
  `hw.dll+0x1000a8f1/a85d/a869`, which make three `call [qgl slot]` calls per
  vertex into GetProcAddress-filled GL pointers. These are host API calls, not
  guest ones.

## Desktop release candidate (2026-10-25)

Prepared from main `5406777ec` in `release/2026-10-23-uplink`. The existing
`halflife_uplink` entry moves from localhost candidates to the desktop as
**Half-Life: Uplink Demo**. The original installer remains local-only. Deployment
allows only its installed demo directory, not other Half-Life packages. The
65 distinct required files total 93,140,232 bytes, including the original
readme; the 79,150,544-byte PAK is published as eight hosting-size parts.
No renderer, input implementation, game files or launch settings changed.

Full build passes. Candidate WASM SHA-256:
`0570658b178d0ba4a77787f328ebc3407dd9e16953d1ecf4832dd9d71a9b7da3`;
layout `9a3bc9149d58209c`. All 1,304 registry-derived deployment assets exist.
The complete deployment dry run considers 2,592 files, without missing assets.
Build-output coverage, retail exclusion and existing Quake III asset checks
pass. This is preparation only; no public deployment or production membership
snapshot update has happened.

Current real Chrome gameplay evidence: `20261025-uplink-gameplay`. Launch the
desktop app, wait for the menu's gold badge and another five seconds, click
New Game at guest `(110,193)`, then Easy at `(110,152)`, allow 90 seconds for
loading, and hold W for three seconds. Reviewed captures show the first-person
corridor with HUD followed by the stairs after movement. The actual fetched
WASM matches the candidate, no browser page errors were recorded, and one app
remains running. This run is cooperative (`crossOriginIsolated=false`). It does
not qualify sound, Safari/mobile, sustained FPS, or completion of the demo.

Retained unsuccessful attempts are important: the first fixture server refused
external asset symlinks (HTTP 403); an explicit shared-corpus allowlist fixed
that fixture. Two legacy smoke attempts failed to find difficulty control 26.
A fixed-time real-input attempt clicked during the intro; the visual checkpoint
fixed menu timing. The subsequent Easy click at `(70,152)` did not activate
the button; clicking inside it at `(110,152)` reached gameplay. These are input
route/fixture findings, not evidence that the guest crashed. Temporary changes
to the old smoke test were reverted; its failure remains recorded.

Artifacts and package identities: `20261023-uplink-release`,
`20261023-uplink-release-retry`, `20261023-uplink-release-gameplay`,
`20261024-uplink-interactive`, `20261024-uplink-menu-ready`, and
`20261025-uplink-gameplay`. The root worktree's pending brightness changes are
excluded from the candidate.

Final Worker check: `20261025-uplink-worker` asserts cross-origin isolation
before launch, records `guestWorker=true`, and logs guest main execution in a
Worker. Reviewed corridor and post-W stairs captures pass with no page errors
and the same fetched WASM hash. `20261025-uplink-isolated` is an earlier
cooperative repeat despite its name: the fixture option was initially wrong;
its recorded `crossOriginIsolated=false` is preserved. Only the final Worker
run qualifies the threaded route. The isolated preview is served on
`http://127.0.0.1:52670/index.html` while the release checkout is retained.

## Menu repaint, cursor policy and renderer restart (2026-10-25/26)

The reported gray Video submenu reproduces in cooperative Chrome after applying
a resolution. Both MoveWindow and SetWindowPos had a direct COLOR_BTNFACE fill
for classless dialogs, outside the application's erase/paint handling. Removing
those fills preserves the custom menu background. Default DefDlgProc erasure,
subclass erasure, parent/child paint ordering and Win16 positioning regressions
pass. Removing the forced relativeMouse flag lets gameplay recentering request
capture while menus expose the Windows cursor again; observed cursor display
counts are negative in gameplay and positive in menus.

The exact `Z_Free: freed a pointer without ZONEID` error reproduced after
OpenGL 800×600 → 1024×768 → Resume. In hw.dll, the Cvar_Set caller at original
VA `0x100721b7` freed the `model` cvar's stale string. Z_Free at `0x10043f30`
expected magic `0x1d4a11` at pointer minus 16, but the allocation had become a
zone header after restart. The six seeded DLLs were permanent EXE_ROOT modules,
so their globals survived the renderer teardown. Mounting them as ordinary
files lets LoadLibrary/FreeLibrary own their lifetime. The repeated resolution
transition then resumed actual 1024×768 gameplay, with reloaded DLL generation
2 and EXE_ROOT zero. No bypass of Z_Free or allocator checks was introduced.

Final tested WASM: `493649ad48b23092e038fa43d224e6b540bc1aa84831fd297f5b9064680a4bed`.
Evidence: `20261025-uplink-gl-final`; preceding failed/intermediate runs are
`20261025-uplink-gray-trace2` and `20261025-uplink-gray-after`.

Software and OpenGL were compared at 640×480 using the same F6 quicksave,
reloaded with F7 after changing renderer. Reviewed `compare-save-3.png`
(Software) and `compare-gl-resume-4.png` (OpenGL) show matching stairs, railings,
wall/ceiling geometry, signs, light fixtures and HUD. Software has dithered
shading and unfiltered texels; OpenGL smooths them. No missing objects were
visible in this scene. This does not qualify water, combat effects or completion
of the demo. The accompanying comparison.html displays both captures together.

Direct3D is **not yet qualified**: the subsequent in-game switch returned to the
desktop with ExitProcess(255), captured in `compare-d3d-resume-3.json/png`.
It must not be reported as passing merely because the mode dialog accepted it.

`20261026-uplink-worker-fresh` reached a correctly rendered OpenGL corridor,
then later showed corrupt menu pixels and Out of memory after returning from
gameplay. The logged refused allocation was `0xa6de3600` bytes (reason 5,
oversized/overflowing request), not exhaustion of the ordinary memory pool.
Worker mode therefore remains unqualified for this candidate. Earlier browser
navigation/reconnect failures are preserved separately as harness errors.

## Concurrent GDI menu corruption (2026-10-27)

The oversized allocation originates in hldemo.exe bitmap-copy routine
`0x411870`: GetObjectA at `0x4118e6` returns zero, but the caller uses the
untouched stack BITMAP anyway. Garbage width/height produce a `0xa6de35f8`
allocation, plus eight allocator bytes. The bitmap had just been created;
the API history contains no intervening DeleteObject. Two OS threads allocating
200 bitmaps reproduced only 145 unique handles and 179 distinct storage blocks.
Shared object/DC scan-and-claim and DIB page reservations now use a short mutex.
Rendering imports and image clearing occur after releasing it.

That fixes disappearing bitmaps but is insufficient for menu pixels: the
allocation-only build still copied the animated banner into unrelated menu
rows. GDI surface descriptors, bitmap plans and conversion buffers were shared
between instances. Each guest instance now has private GDI scratch storage;
the browser's host shadow has its own partition even though it initializes
using a guest slot number. This also keeps synchronous host calls from exposing
another thread's in-progress descriptors.

`test/test-gdi-allocation-workers.js` checks 6,000 concurrent bitmap/DC
allocations, non-overlapping storage, live records and concurrent release/reuse.
A barrier forces two threads to prepare descriptors before either consumes
them; both output images must match their own source. The control with private
scratch disabled fails this pixel check; the fixed implementation passes.
Temporary API-history and OOM diagnostics have been removed from guest-rpc.js.
Investigation evidence: `20261027-uplink-menu-query-failure`,
`20261027-uplink-menu-lifetime`, `20261027-uplink-gdi-lock`,
`20261027-uplink-menu-locked` (allocation fix only, still corrupt), and
`20261027-uplink-menu-private` (initial menu clean; intermediate settled capture
incomplete, not used for qualification). Final-build gameplay qualification is
recorded separately in `20261027-uplink-final`.

Final module `8694abe3aaa87e876234fff0329f17669f23a6b0e3dde3fe7ccef2968e1d8197`,
layout `a23715cdaba2f34b`: fresh Worker main menu and Configuration → Video →
back remain clean after 45 seconds. OpenGL gameplay, movement, pause and
640×480 → 800×600 → resume pass; renderer DLL generation advances to 2.
The Video Modes screen is complete on re-entry. Switching to Software 640×480
also resumes gameplay and movement without the prior oversized allocation.

The **Software pause menu remains broken**: after 15 seconds the screen still
shows the game image plus animated banner. `software-gdi.png` proves menu
labels exist in `_exclusiveGdiChildCanvas`, while the compositor retains the
DirectDraw primary. The exclusive HWND is the main menu HWND (`0x10001`), so
ordinary top-level GDI uploads are retained only as child overlays and hidden.
`software-menu-settle-0.png` records the visible failure. This is a separate
presentation/ownership issue, not a passing menu check; Direct3D also remains
unqualified. The earlier Software/OpenGL scene comparison remains the parity
evidence; this run's movement captures are not a matched-camera comparison.

## Software controls and Direct3D managed textures (2026-10-28)

Software's missing pause buttons were a compositor enumeration bug. Native
BUTTON/STATIC children exist only in the canonical WAT window tree; the
exclusive shared-surface overlay walked JavaScript window mirrors, which
contained only the animated banner. `_exclusiveSharedChildRegions` now walks
visible canonical descendants, clips to ancestors, and retains the existing
upload-versus-primary ordering. The regression includes WAT-only controls,
hidden ancestors, newer primary frames and both postprocessing routes.
Fresh Worker run `20261028-uplink-software-final` verifies gameplay, movement,
pause, Configuration/Video, resume and another settled pause. The Video screen
has its full background and descriptions. Loaded WASM remains `8694abe3`;
this is a host-renderer change.

Direct3D's ExitProcess(255) was the EXE's exception body at `0x442481`, not a
renderer-selection failure. The existing CPU-fault trace captured integer
divide-by-zero (`0xc0000094`) in hw.dll block `0x1003865a`, at the
`idiv [ebx+0xc]` instruction `0x10038669`. Texture record 423 had no dimensions.
Its preceding CreateSurface requested DDSCAPS2 `0x14` (TEXTUREMANAGE and
HINTDYNAMIC), which the native Surface4/7 ABI implementation rejected with
E_NOTIMPL. The wrapper reports a debugger string, leaves the record unset,
then divides by its width in a later texture update. Evidence:
`20261028-uplink-d3d-cause/cpu-faults-final.json`.

CreateSurface now accepts texture management and dynamic/static hints; it
rejects non-texture use, conflicting hints, and unsupported extended storage
such as cube maps. Existing CPU backing and dirty GPU uploads provide the
managed copy. Caps persist in the surface-owned extra state, round-trip through
GetCaps/GetSurfaceDesc/Lock, propagate to mip levels and participate in
GetAttachedSurface matching. Final retirement frees the extra state alongside
its existing VB pen state. No guest exception or division is bypassed.
The native Surface4/7 test exercises repeated pixel updates, mip inheritance,
caps matching and invalid requests. Mip-chain, texture release/arena and VB
surface-blit regressions pass. Capability semantics follow Microsoft's
[DDSCAPS2 reference](https://learn.microsoft.com/en-us/windows/win32/api/ddraw/ns-ddraw-ddscaps2).

Build `1951f588c7818b86d3bc0aea61be08d1811e62699d976946b3f90c0bac2fd900`
retains layout `a23715cdaba2f34b`. In `20261028-uplink-d3d-managed`, cooperative
Chrome reaches textured corridor gameplay, movement and a complete pause menu
with no recorded CPU fault. The introductory black fade is not a rendering
failure; the later movement capture shows walls, stairs, railings, signs,
lights and HUD. This is not a matched-camera comparison or demo-completion test.
The same run applies 800×600, reloads the renderer DLL (generation 2), resumes
textured gameplay and returns to the menu without Z_Free or a CPU fault.
Fresh `20261028-uplink-d3d-worker` verifies the same final module with a guest
Worker: textured corridor, W movement and complete pause menu. The menu has
cursor display count 0, CSS cursor `default`, no hidden-cursor class and no
pointer lock. No page errors, Z_Free, oversized allocation or process exit
occurred. This run presents gameplay in a desktop-sized window; fullscreen
Worker presentation, Safari/mobile, audio quality and completion remain outside
this qualification.

## Release integration and Direct3D device-window handoff (2026-10-29)

Release fixes `8dffce834` were merged with main `ac4fdeb31` in `aa708f852`.
The integrated module `e8e3ec59056a084984f0a80a6156281b6bade7fe993264fc248c7329cc2417ef`
passes fresh Worker Software/OpenGL gameplay and pause-menu checks. The D3D
windowed run records 121.2 seconds of audio: all 121 analysis windows are
audible, with no detected stuck ring. This is an output/loop check, not a
listening-quality or demo-completion qualification. Safari is skipped at the
user's request. Evidence: `20261028-uplink-release-{gl,d3d,d3d-mode}` and
`20261029-uplink-release-software`.

The D3D fullscreen check uncovered a real owner loss. In
`20261029-uplink-d3d-display-trace`, hw.dll first calls
`SetCooperativeLevel(object, gameHwnd, 0x80)` (SETFOCUSWINDOW), then
`SetCooperativeLevel(sameObject, NULL, 0x211)`
(CREATEDEVICEWINDOW | EXCLUSIVE | FULLSCREEN). The previous handler stored
the second NULL as the process presentation HWND, so the renderer-side instance
reported no exclusive window. This explains the small default 320x240 image
and the taskbar remaining visible even after selecting 640x480.

Focus is now retained per DirectDraw object in its shared record. A focus-only
call does not change another object's presentation mode. A managed device's
primary presents through that object's registered focus window in our virtual
display; there is no separate native OS display window. Missing/stale focus
returns DDERR_NOFOCUSWINDOW, and conflicting SETFOCUSWINDOW/SETDEVICEWINDOW
flags fail before mutation. The regression drives the real handler across two
instances sharing memory, checks two independent objects, failure preservation,
and returning to NORMAL. Flag roles follow the
[DirectDraw cooperative-level documentation](https://learn.microsoft.com/nl-be/windows/win32/api/ddraw/nf-ddraw-idirectdraw7-setcooperativelevel);
the error code is defined in [Wine's ddraw.h](https://github.com/wine-mirror/wine/blob/master/include/ddraw.h).

## Additional dated branch findings

These historical observations supplement the current facts above; they do not establish a new current-main runtime result.

Final runtime integration through `a5bc63b1f` builds module
`3d4b51591ebb7a5684ddc673383aebd648c3043a677b461a8f1a7a81bad557d9`
with the same layout. Sequential fresh Worker runs
`20261029-uplink-final-{software,gl,d3d}` all reach textured gameplay and
movement. D3D's final harness explicitly seeds the 640x480 mode values observed
from the game's own UI; an unconfigured direct-D3D launch instead requests a
320x240 viewport inside a 640x480 primary. The normal public launch is OpenGL.

**Correction to the earlier Software menu qualification:** all labels were
visible, but the game remained between them where the textured menu background
belonged. `20261029-uplink-software-background-before/gdi-source.png` shows the
complete correct background in the canonical GDI surface; the simultaneous
displayed capture omits it. The visible root is a borderless guest dialog with
a real dialog proc and newer upload regions than the paused DirectDraw frame.
The exclusive overlay now includes those fresh dialog background regions,
while captioned windows retain child-only overlays. A later primary still
covers old GDI pixels; a partial control upload cannot revive an old full
background. Regression coverage exercises direct and postprocessing composition,
captioned-window exclusion and both ordering cases.

`20261029-uplink-software-background-fixed` verifies a complete textured pause
background, resume plus movement, another pause, Configuration/Video and an
eight-second settled Video screen. No previous menu background remains over
the resumed world. The WASM stays `3d4b51591ebb`; this final fix is compositor-only.

## Original native-input exploration (2026-10-30)

Run `20261030T2234Z-uplink-progression` makes a bounded local Chrome attempt
through the registered original app, New Game → Easy. Personally inspected
captures show the opening corridor, a security guard beside blue panels,
the green-lit passage under the stairs, climbing the stairs, and the upper
control room and balcony overlooking the red-lit door. This extends inspected
movement beyond the opening corridor within the starting area. Combat,
objective completion and a map transition were **not verified**. Health remains
100; the passage door did not visibly open after native Tab/Use. Navigation and
route finding remain the boundary, without a reproduced emulator fault.

The actual backend is `hw.dll` generation 1 through `WebGLBackend` WebGL 1;
`sw.dll` is absent, `gl_sw_enabled=0`, software triangles remain zero, and
GPU frame sequence advances 13305 → 21035 with GL error zero. Chrome reports
ANGLE/Mesa Intel UHD 620 despite the controller's inherited SwiftShader launch
flags; the observed renderer identity is recorded in the capture JSON. This is
cooperative gameplay, not Worker, software-renderer or cross-backend parity
qualification. Captures retain the actual 320×240 GPU drawable.

The exact loaded module is
`7e8d3194fd189a8e0089b41ee5972b08b67fd5650d6dfbe2a2fbb9d3c323a327`,
retained from `20261030T2230Z-gltron-browser`. Its prior compile evidence in
`20261030T2210Z-gltron-render-after` identifies base commit `e83de2a04141`
plus source delta SHA-256
`0885b41b740ea9626601f5ca3f060623b460c5cfc0ba11d22f368473be9d6a8c`.
This run preserves that delta and the launch source hashes; it does not prove
a fresh current-main compilation. The older Uplink controller directories
named above are absent from this checkout, so a retained local browser
controller was adapted instead.

`assets.json` hashes all 65 distinct registered installed files before play;
all remain unchanged afterward. The 22 originals fetched over HTTP match those
hashes; the other 43 were not observed fetched. EXE and PAK match the established
pins above. The original installer is absent, so no new installer comparison
is claimed. The existing registry defaults and default.cfg→autoexec.cfg manifest
mapping were used unchanged. No asset edits, guest state writes or console
commands supplied progress. `actions.jsonl` plus capture/final-runtime JSON
record trusted browser clicks and 49 paired native key presses, including
W/S/A/D, arrows, Tab and final Escape to a complete pause menu.

The first launch exited with code 0 after Escape during the intro; restarting
and allowing the intro to finish reached the normal menu. This alone is not
classified as an emulator defect. No repair or code change was required.
`result.json` indexes inspected captures and `verification.json` records module,
assets, input, backend and cleanup checks. Browser PID 1047280 and ports
18694/18695/41397 are gone, the owned profile was removed, and over 9 GB remained
free. No Boat box was used (ID/state/expiry: N/A). Next useful work is native
interaction with the starting-room guard/controls to find the exit and reach
the first objective or combat encounter.

## First elevator transition with native E (2026-10-30)

Run `20261030T2242Z-uplink-objective` reaches the first elevator load and
arrival beyond the initial guard/control room in one bounded local Chrome
attempt. New Game → Easy, the approach to the guard and scientist, and the
scientist leaving the conversation position for the console were personally
inspected. After allowing the original sequence to finish, the red-lit elevator
opened and the player entered it. An aimed, trusted **E** press at its small
interior button produced an amber button and **LOADING…**. Subsequent captures
show a different red-lit arrival room with wooden crates, followed by movement
through the elevator doorway. Health stays 100. Combat and completion of the
satellite objective remain unverified.

The live Configuration → Controls screen shows **Use item (buttons,
scientists, …) = E**. This corrects the earlier assumption that the loose
`default.cfg` binding of Tab established the active gameplay binding. Tab
attempts at the elevator button produced no visible progress; E produced the
load. Controls were inspected without changing a binding. Native key timing
and aim remain relevant; no input-emulator defect was reproduced.

Read-only extraction of the original PAK's `hldemo1.bsp` entity lump records
the `startdometalk_mm` conversation, scientist console/unlock sequence, and
`startele1` doors. Their `eledoordelaymm` target invokes
`changetohldemo2`, whose destination is `hldemo2`. The loading and changed
arrival scene verify the first transition visually; the destination name is
identified from that original trigger chain, rather than an independent runtime
map-name query. No console commands, guest memory writes, asset edits or
script/trigger changes supplied progress. The next gap is proceeding from this
arrival room toward the satellite objective and a verified combat encounter.

The exact loaded WASM remains
`7e8d3194fd189a8e0089b41ee5972b08b67fd5650d6dfbe2a2fbb9d3c323a327`.
The run retains the prior module and compile delta with the same base/delta
provenance described above; this is not a fresh current-main build claim.
`source-identity.json` records launch source hashes, and `served.jsonl` records
actual HTTP response hashes. The backend is `hw.dll` generation 1 through
`WebGLBackend` WebGL 1, ANGLE/Mesa Intel UHD 620, with `gl_sw_enabled=0`,
zero software triangles and GL error zero. All 65 installed-file hashes remain
unchanged and fetched original files match their pins. The installer remains
absent. This is cooperative gameplay, without a cross-backend or audio-quality
claim.

Key inspected evidence includes `guard-use.png`, `scientist-use.png`,
`red-door-tab.png`, `elevator-enter.png`, `cab-control-e.png` (LOADING),
`controls-scrolled.png` (active E binding), `destination-view.png`,
`next-map-exit.png` and `arrival-overview.png`. `result.json` indexes the
captures, `actions.jsonl` records the native route, and `verification.json`
checks module, assets, paired trusted input and cleanup. The installed-payload
menu test passes. No emulator code changed or full build was required.
Browser PID 1061424 and ports 18702/18703/34249 are gone, the owned profile
is removed, and over 9 GB remained free. No Boat box was used
(ID/state/expiry: N/A); there is no assigned runtime to shut down or hand back.

## Arrival weapons, headcrab combat and tripmines (2026-10-30)

Run `20261030T2256Z-uplink-satellite` repeats original New Game → Easy,
the scientist/control-room sequence, outside elevator button and aimed interior
**E** activation. The amber button and LOADING screen are inspected again.
Beyond the red-lit arrival, native movement reaches the adjacent supply room
and picks up a crowbar. Crowbar attacks break wooden crates and open the route
into the next corridor. Headcrabs attack: inspected captures show a close live
attacker, red damage indicators and health falling from 100 through 90/75 to
65. Subsequent crowbar attacks leave two motionless headcrab bodies in view.
This verifies an actual combat encounter beyond the arrival area.

The next guard and security office are reached with native E interaction.
Original pickups provide a pistol, 17/34 ammunition and health 80. Further crate
breaking reaches a room with dead scientists, headcrabs, green supply crates
and a DANGER canister. A native firing attempt there ends at health zero and
LOADING; the precise cause of death was not isolated. The game reloads normally
and movement/combat continue. The final inspected route reaches a red-lit
doorway crossed by blue tripmine beams, with health 35. The satellite objective
and crossing this hazard remain unverified. No emulator defect was reproduced;
there is no source repair or full-build claim.

Useful inspected captures are `breakroom-route.png` (crowbar pickup),
`corner-route.png` (nearby attacker), `headcrab-live.png`,
`headcrab-melee.png`, `guard-room-two.png`, `office-supplies.png` (pistol and
ammunition), `storage-exit.png` (later scientist/headcrab room),
`pistol-fired.png` (health zero/loading), `post-death.png` (normal reload), and
`tripmine-doorway.png` (next hazard). `actions.jsonl`, per-capture proof JSON,
`final-runtime.json` and `verification.json` retain the native route, 136 paired
trusted key presses and mouse attacks. Two ordinary F6 saves were requested
through gameplay; no preexisting installed save was available. No console
commands, guest-memory writes or original-asset edits supplied progress.

The loaded module is again
`7e8d3194fd189a8e0089b41ee5972b08b67fd5650d6dfbe2a2fbb9d3c323a327`.
The run preserves the exact retained module and compile delta
`0885b41b740ea9626601f5ca3f060623b460c5cfc0ba11d22f368473be9d6a8c`,
with the earlier base `e83de2a04141` provenance described above.
`source-identity.json` preserves the prior manifest;
`launch-source-identity.json` separately hashes this launch's host/source files.
This is not a fresh current-main compilation. Actual HTTP response hashes are
in `served.jsonl`. All 65 original installed files remain unchanged and all 22
fetched originals match their pins. The installed-menu regression passes.

The observed backend remains hw.dll generation 1, `WebGLBackend` WebGL 1,
ANGLE/Mesa Intel UHD 620, software disabled, zero software triangles and GL
error zero; frame sequence advances 16307 → 35071. No page exception is
recorded. This is cooperative gameplay without an audio-quality, cross-backend
or completed-demo claim. Browser PID 1079200 is gone, dynamic ports
38277/42053/45893 are closed, and the private profile is removed. About 9 GB
remains free. No Boat was used; box ID/state/expiry are N/A and no assigned
runtime requires handoff. Next: safely clear the tripmine doorway and continue
toward the satellite objective using ordinary gameplay.

## Tripmine detonation and interrupted continuation (2026-10-31)

Runs `20261030T2310Z-uplink-tripmine` and
`20261030T2337Z-uplink-save-continuation` do **not** verify crossing the blue
tripmine doorway or reaching the satellite objective. The first repeats Easy,
aimed elevator E, crowbar pickup, crate breaking, headcrab damage/death and a
normal reload. Its native F6 arrival save was exported read-only. The second
mounts those nine unchanged game-generated save files, loads the arrival
quicksave with native F7, collects the crowbar, reaches the guard, uses the
office door with E, and collects the pistol and health (45 health, 17 loaded
rounds). Native F6 office saves and F7 reloads work during this session.

An aimed pistol shot detonates an original mine at the blue-beam doorway:
`mine-target-shot.png` shows the explosion with health 15. The following
`mine-chain-settled.png` shows health zero; the chain reaction was not survived.
Further office-save retries die to headcrabs. This proves mine detonation,
not safe clearance. `tripmine-distance-run.png`, `mine-aim-up.png`,
`mine-death-reload.png` and their full-browser companions retain the approach,
aim, death and normal recovery. All named screenshots were personally inspected.

The final execution blocker is an unexpected runtime stop after a native
Escape pause/resume sequence. `last-settled-pause-page.png` shows Resume game;
`execution-blocker-page.png` subsequently shows the idle shell. At
00:18:00 UTC two page exceptions report `Cannot resume a context that has been
closed`; final runtime inspection finds `running=false`, with no memory or
instance. Causality is not isolated and this is not a reproduced emulator
source-defect claim. No repair was made. The newer office VFS save could not be
exported after the stop; the earlier arrival save remains externally retained.

Both launches load exact retained WASM
`7e8d3194fd189a8e0089b41ee5972b08b67fd5650d6dfbe2a2fbb9d3c323a327`,
with the prior base/compile-delta provenance above, not a current-main build.
Launch manifests and actual served hashes are retained separately. Observed
hw.dll/WebGLBackend WebGL 1 uses ANGLE/Mesa Intel UHD 620, software disabled,
zero software triangles and GL error zero. The continuation has 126 GPU proof
captures, frame sequence 10731–39797, 192 trusted paired key presses, and two
extra trusted Enter keyups from native select controls; all physical keys are
released. All 65 original files, 22 fetched originals and nine mounted normal
save files match their pins. Read-only angle checks guide native arrow turns;
no guest-memory writes, original-asset edits or console commands supply progress.

Each run's `result.json` and `verification.json` index evidence and limitations.
The installed-payload seven-label menu regression passes. This docs-only
closeout requires no full build. Both owned browsers are gone, all six ports
are closed, profiles and watchers are removed, and over 7.9 GB remains free.
No Boat was used (box ID/state/expiry N/A). Next: reproduce the pause/resume
stop separately, then continue the retained arrival save, preserve an exported
office checkpoint, and trigger the mine chain from farther back while retreating.

## Pause/resume input repair (2026-10-31)

Run `20261031T0030Z-uplink-safe` isolates the earlier Escape stop: the
browser intercepts a guest modeless dialog's Escape and calls
`dialog_handle_key`, synthesizing IDCANCEL outside the game's own message
loop. Native Resume works. The renderer now leaves modeless dialogs with a
guest DLGPROC on their own raw-key path, while native pseudo-procedures and
modal dialog pumps retain browser traversal. The focused regression fails
against the retained pre-repair renderer and passes with the repair; it also
covers Tab/Enter/Space/arrows, key release, built-in dialogs and cooperative
and Worker modal Escape. The retained browser was refreshed by the prior
worker to load the corrected renderer, and `fixed-pause-page.png` /
`fixed-resume-page.png` retain the native Escape pause/resume result.

The WASM remains exact retained
`7e8d3194fd189a8e0089b41ee5972b08b67fd5650d6dfbe2a2fbb9d3c323a327`,
not the newly built main module. The previous source/compile-delta limits
still apply. All runtime changes for this repair are in the JavaScript input
router. The adjacent untracked worker-menu regression fails identically on
both pre-repair and corrected renderer at its initial owner-menu isolation
assertion; this preexisting failure is retained separately from the focused
modeless regression. Gameplay continuation and final lifecycle evidence are
recorded below.

Validation before publication: modeless routing, renderer modal input,
renderer dialog-button queue and modal key-posting tests pass, and
`flock /tmp/wine-build.lock bash tools/build.sh` passes (retry log; the first
verification build was terminated). Current-main build validation is separate
from the retained gameplay module.

The inherited live browser was preserved for the finishing continuation
00:43:56–00:47:25 UTC, after repair commit `49340601e` was pushed to main.
Native S/W/A/D, arrows, E, F6/F7 and Escape route the player through the red
corridor and maintenance breakroom, then reload the first exported F6
checkpoint and inspect the metal alcove beside the crates. Health remains
100; the office, pistol, tripmine crossing and satellite objective are **not**
reached. This is bounded navigation progress, not completion of the demo.
`inherited-east.png`, `maintenance-enter.png`, `inside-breakroom.png`,
`white-opposite.png` and their page companions show the inspected route.
`fixed-pause-page.png` visibly shows Resume game and `fixed-resume-page.png`
shows gameplay. Further native Escape pairs resume successfully at the end;
their pause captures catch the menu fade before its text appears.

`continuation-save/` and `final-native-save/` contain all nine read-only
exported game-generated save files per checkpoint; the original two crowbar
exports remain. `native-save-pins.json` records all 36 file hashes and
`recovery.txt` describes ordinary mounting. F7 reload of the first continuation
F6 checkpoint was inspected in-session; final export was not remounted in a
fresh browser. No guest writes, console commands or modified original assets
supply gameplay. The final-page log has 101 trusted keydown/up pairs, 250
trusted events total and no held keys or buttons. Earlier pre-refresh input
logs remain separately preserved.

`verification.json` checks all 65 original files and 66 original responses
across the three prior launches/refreshes; all 619 served responses retain
hashes and the source check accounts for both exact renderer variants.
The final inspected backend is hw.dll generation 1 / WebGLBackend WebGL 1,
ANGLE/Mesa Intel UHD 620, software disabled and GL error zero, frame sequence
49048. The runtime was running, with memory present and no stop events since
the corrected refresh, immediately before requested cleanup. The installed
seven-label menu test also passes against the newly built main module.
The browser PID1202823 and controller PID1202807 are absent, ports
45617/45519/45481 closed, profile removed and inherited watcher stopped;
over 7.5 GB remains free. No Boat was used; box ID/state/expiry are N/A.
Next: use the retained health100 save to navigate toward the office, preserve
that checkpoint outside the browser, then try the mine from greater distance.

## Office checkpoint and bounded mine approach (2026-10-31)

Run `20261031T0052Z-uplink-office` reaches the office, collects its medkit and
pistol, and exports a native F6 checkpoint with **health70 and 17 rounds**.
`office-pistol-save/` holds all nine unchanged game-generated save files;
`native-save-pins.json` pins their bytes alongside the earlier guard and office
threshold exports. Native F7 restores the office checkpoint in-session:
`office-reload-ready.png` visibly shows health70 / pistol17. A fresh browser
remount of this export remains unverified. `recovery.txt` describes ordinary
mounting without guest writes or console commands.

The single browser attempt lasts 00:51:03–01:10:16 UTC (under 20 minutes).
Initial headcrab deaths are followed by a successful health90 guard-room save,
office entry at health55 and desk pickups. The office exit resists repeated
native E attempts. The game's Controls menu visibly assigns Use item to E;
remapping it to G through that menu opens the door (`native-use-g.png`,
`g-use-test.png`). The external installed `default.cfg` says Tab, differing
from the live menu. This is an unresolved input/configuration observation,
not an isolated emulator defect; no source repair was made. The save export
does not include that configuration change.

The player leaves the office and bypasses storage crates, reaching a
Danger-marked area at health65 (`storage-bypass.png`). Subsequent headcrab
attacks cause death (`danger-approach.png`) before an aimed mine shot.
**No distant mine shot, detonation, survived clearance or satellite progress
is verified.** The bounded attempt ends with the office F7 recovery above.
All named captures were personally inspected. Next: recover the office save,
clear pursuing headcrabs promptly, save nearer the danger area, then attempt
the mine from cover with retreat.

The exact retained WASM remains
`7e8d3194fd189a8e0089b41ee5972b08b67fd5650d6dfbe2a2fbb9d3c323a327`,
with inherited `source-identity.json` / compile-delta provenance limits;
this is not a current-main compilation. `launch-identity.json` records the
launch revision, and `served-source/` plus `served.jsonl` pin the actual host
responses, including the already-published Escape repair. All 65 original
installed files remain unchanged, all 23 original responses match pins and
all 171 responses have hashes. All 624 input events are trusted, with 262
paired key presses and no held keys/buttons at cleanup. Final runtime is
running with memory present and no stop events. The inspected backend is
hw.dll / WebGLBackend WebGL 1, software disabled and GL error zero; detailed
renderer identity and frame evidence are in `result.json`.

Browser PID1242476 and the controller are absent, ports37189/39667/39007
are closed, and the private profile is removed; over 7.5 GB remains free.
No Boat or test box was used (ID/state/expiry N/A); ownership is handed back.
This documentation-only continuation requires no new build.
The installed-payload regression also passes against the available main build,
rendering all seven launcher menu labels; this is separate from the retained
WASM used for gameplay.

## Fresh office recovery and Danger checkpoint (2026-10-31)

Run `20261031T0114Z-uplink-mine` verifies the earlier office export in a fresh
browser: all nine unchanged files are mounted through the ordinary launcher
VFS mechanism, and native Load Game/F7 reaches **health70 / pistol17**
(`retry/load-settled.png`, `retry/office-level.png`). A local copy remains in
`office-pistol-save/`, matching all nine prior save pins. `recovery.txt` and
the reused driver preserve the tested recipe. The safer office save remains
the recommended recovery point.

Native Controls remapping visibly sets Use to G. After leveling the view and
holding forward+G at the centered door, the player exits the office and
bypasses the green and wooden crates. `retry/use-hold.png` and
`retry/danger-route.png` show that route. An initial Controls attempt also
accidentally changes mouse bindings; subsequent attacks use native Enter.
No configuration export is claimed. No guest-memory writes, console commands,
cheats or original-asset changes supply progress.

Headcrab attacks reduce health. Native F6 near Danger produces ten exported
files in `retry/danger-save/`; F7 restores **health30 / pistol14**, personally
inspected in `retry/checkpoint-ready.png`. This is an unsafe checkpoint with
an active attacker. Downward pistol shots then appear to kill the close
headcrab: `retry/crab-result.png` shows its flattened body. Health holds at10
afterward, and another native F6 export in `retry/crab-save/` preserves
**health10 / pistol9**. That later export was not reloaded or externally
remounted. A further headcrab remains and kills the player during the next
approach (`retry/mine-hall.png`). **Full headcrab clearance, an actual mine
shot, detonation, survived clearance and satellite progress are unverified.**
All named screenshots were personally inspected.

Two Chrome processes disappear unexpectedly: PID1275645 at the main menu,
then retry PID1278250 after the Danger death. CDP reports detached frames;
the sender and cause are unknown. Final runtime and stop snapshots are
unavailable. This is a concrete browser/controller blocker, not an isolated
emulator-defect claim. No source repair or new build was made. The bounded
attempt and cleanup finish within20 minutes; next use the healthier office
export, clear both pursuing headcrabs promptly, then save before the mine
shot and retreat.

Both launches load exact retained WASM
`7e8d3194fd189a8e0089b41ee5972b08b67fd5650d6dfbe2a2fbb9d3c323a327`;
the inherited source-manifest/compile-delta limitations remain, and this is
not a current-main build claim. Verification passes for all65 original files,
38 original responses, all329 served responses and29 retained save files.
The last successful capture records301 trusted events,124 paired key presses
and no held keys/buttons; it is not a final snapshot after browser loss.
Observed rendering is WebGLBackend WebGL1, software disabled, GL error zero.
Both owned controllers and browsers are absent, all six HTTP/CDP ports are
closed, both profiles are removed and over6GB remains free. No Boat/test box
was used (ID/state/expiry N/A); ownership is handed back. Evidence is indexed
by `result.json`, `verification.json` and `native-save-pins.json` in this run.

## Health60 headcrab-clear checkpoint and distant shot (2026-10-31)

Run `20261031T0131Z-uplink-clear` freshly mounts the safer nine-file office
save and verifies **health70 / pistol17** (`office-settled.png`). Native Tab
opens the office door despite the Controls menu displaying the new Use=G
binding; that menu/startup binding mismatch remains unresolved. A new native
F6 corridor export preserves health70 / pistol12. A second browser ordinarily
mounts all nine files and native Load Game/F7 restores that state
(`retry/corridor-restored.png`). The old unsafe health10 save is never mounted.

The first attempt flattens a close headcrab with pistol fire but loses health
to20 before an unexplained browser disappearance. The retry initially dies to
the second crab beside the Danger equipment: **one observed death** this run.
F7 restores the healthier corridor save. On the final attempt, holding the
crowbar downward at the room entrance gibs the first attacker at health65
(`retry/wait-crab-swing.png`). After advancing slightly and turning right while
attacking, the second is flattened near the guard. Health holds at60 during a
six-second observation (`retry/crab-clear-stable.png`). The guard is nearby,
so this establishes clearance of the two active pursuers without claiming
both kills were solely the player's.

Native F6 exports ten unchanged files to `retry/crab-clear-save/`; native F7
restores **health60 / pistol12**, personally inspected in
`retry/crab-save-reloaded.png`. This is the recommended newer checkpoint.
Its fresh-browser remount remains unverified; `recovery.txt` gives the ordinary
VFS mounting recipe. The earlier office70/17 and corridor70/12 exports remain
available. All progress uses native controls; no cheats, console commands,
guest-memory writes or original-asset edits supply it.

The player then equips the pistol, aims toward the blue-beam doorway from
farther back and fires once (`retry/mine-target.png`, `retry/distant-shot.png`).
Ammo falls12→11; immediate backward retreat is survived at health60
(`retry/distant-retreat.png`). **No explosion is observed: a mine hit,
detonation and mine clearance remain unverified.** The second Chrome process
disappears before the attempted post-retreat F6 can be verified or exported.
The retained final save is the earlier health60 / pistol12 crab-clear state,
not a post-shot save. Both browser losses have unknown sender/cause; detached
CDP frames prevent final runtime inspection. No isolated emulator defect or
source repair is claimed. All named screenshots were personally inspected.

Both launches load retained WASM
`7e8d3194fd189a8e0089b41ee5972b08b67fd5650d6dfbe2a2fbb9d3c323a327`;
the inherited source-manifest/compile-delta limits still apply, and this is
not a current-main compilation. Verification passes65 original asset pins,
45 original responses, all341 served response hashes and28 retained save
files. Last successful retry capture records191 trusted events,87 paired key
presses and no held keys/buttons. Rendering is WebGLBackend, software disabled,
GL error zero. Evidence is indexed by `result.json`, `verification.json` and
`native-save-pins.json`; this documentation-only change needs no new build.
Both owned browsers/controllers are absent, six ports are closed, profiles
and the owned watcher are removed; over6GB remains free. No Boat/test box
was used (ID/state/expiry N/A); ownership is handed back. Next: freshly mount
the healthier crab-clear save, identify the exact mine body and correct the
distant aim, retreat after firing, then export a survived native save.

## Mine doorway safely crossed, native recovery verified (2026-10-31)

Run `20261031T0151Z-uplink-aim` freshly mounts all ten unchanged files from
`20261031T0131Z-uplink-clear/retry/crab-clear-save/`. Native Load Game/F7 and
pistol selection verify **health60 / pistol12** (`checkpoint.png`,
`pistol-verified.png`); both pursuing headcrab bodies remain beside the guard.
Two initial distant shots leave the beams visible. The first retreat survives
at60/11; native F6 exports ten files to `retreat-save/`, and F7 restores them
in-session (`retreat-reloaded.png`). A second fresh browser mounts this export
unchanged and verifies60/11 in `retry/fresh-retreat-settled.png`.

After a native gameplay click activates mouse aiming (and consumes one round),
small native pointer movements center the pistol crosshair on the upper
mine body. `retry/upper-body-crosshair.png` and `retry/precise-shot.png` show
that aim and the10→9 shot. Immediate backward retreat preserves health60.
`retry/precise-retreat.png`, `retry/explosion-settled.png` and
`retry/cleared-approach.png` show the beams gone and debris. No flame frame
was captured, so detonation is inferred from the shot, disappearance and
subsequent safe passage, rather than directly pictured as an explosion.

Native movement crosses the cleared doorway into its passage toward the
railed area (`retry/opening-align.png`, `retry/cross-doorway.png`). Health
remains60 with nine loaded rounds. Native F6 exports all ten unchanged files
to `retry/beyond-mine-save/`; native F7 eventually settles at the same passage
with **health60 / pistol9**, personally inspected in `retry/final-settled.png`.
This verifies safe mine-doorway passage and in-session native recovery, not
satellite-objective completion. The final export has not been freshly remounted;
the earlier post-retreat60/11 export has. `recovery.txt` retains both recipes.

There are **zero observed deaths and zero unexplained browser disappearances**.
One runtime stop occurs during a native Video-menu attempt after the initial
two shots: the menu selected/switched a software-renderer path while being
backed out, and `runtime-stop.json` records `running=false`, memory absent and
a stop from the host step loop. `main-return.png` shows the idle shell. This
is not an isolated source-defect claim. The previously exported60/11 save
allows the successful fresh retry. No renderer setting or configuration
export from that menu attempt is claimed.

All gameplay uses native keys, clicks and pointer movements. Read-only angle
observations guide turns; no guest-memory writes, cheats, console commands or
original-asset edits supply progress. The exact retained module remains
`7e8d3194fd189a8e0089b41ee5972b08b67fd5650d6dfbe2a2fbb9d3c323a327`;
inherited `source-identity.json` and `compile-source-delta.patch` retain the
full-source-identity limits. This is not a current-main compilation claim.
`verification.json` passes65 original pins,44 original responses,342 served
response hashes,40 save-file pins and167 trusted input events, including60
paired key presses with no held keys/buttons. `artifact-pins.json` additionally
hashes input logs, drivers, captures and module receipts. The final observed
backend is hw.dll / WebGLBackend WebGL1, ANGLE/Mesa Intel UHD620, software
disabled, zero software triangles and GL error zero, frame5965. No source
change or new build was required for this documentation-only continuation.

Both owned browsers/controllers are closed, six ports are closed and private
profiles removed; lifecycle evidence records remaining free disk. Other
agents' processes were preserved. No Boat/test box was used (ID/state/expiry
N/A); ownership is handed back. Next: recover `retry/beyond-mine-save/`, freshly
verify that final export, and continue through the railed area toward the
satellite objective.

## Fresh beyond-mine recovery and storage-room catwalk (2026-10-31)

Run `20261031T0210Z-uplink-satellite` ordinarily mounts all ten unchanged files
from `20261031T0151Z-uplink-aim/retry/beyond-mine-save/` with the retained
original assets and module. The first native Load Game row selects an older
60/11 state; native F7 then restores the correct cleared passage at
**health60 / pistol9** (`f7-recovery.png`). Thus the prior final export now
has fresh-browser recovery evidence. The initial menu lists quicksaves with
elapsed times13:32 and20:00; selecting the first row alone is insufficient.

Native movement enters the railed storage room (`room-threshold.png`) and
follows its left catwalk toward the red crate stack (`catwalk-check.png`).
These are new route milestones beyond the cleared doorway. Native F6 exports
two ten-file checkpoints: `room-entry-save/` and `catwalk-save/`, both captured
at60/9. The latter is exposed to active gunfire: F7 restores its position,
but the first settled capture already shows57 health (`catwalk-recovery.png`).
It is a hazardous alternative, not the recommended recovery point.

A second fresh browser mounts `room-entry-save/` unchanged. Native Load Game
selects the20:07 quicksave and restores **health60 / pistol9** in
`retry/fresh-room-settled.png`. This is the recommended new recoverable export.
`retry/recovered-stable.png` confirms60/9 after another eight seconds.
The native rightward inspection finds a wall/end of the platform
(`retry/room-right.png`), rather than an onward exit. `recovery.txt` records
the mounts and input recipe. Satellite-objective completion is unverified.

There is **one observed death** during a crossing attempt beside the left
crate stack (`left-crate-passage.png`); native recovery and F7 return to the
retained checkpoint. Further jump/duck/strafe attempts lose health under fire
without establishing a cleared railing or onward exit. Shots toward the
hanging yellow fixture do not establish an enemy kill; inspection suggests
the crane hoist. The actual firing enemy remains unidentified. This is a
concrete gameplay/navigation blocker, not an isolated emulator-defect claim.
There are no observed unexplained browser disappearances. Loading can retain
an old scene beneath its loading overlay; wait for a settled HUD before
judging recovery. Native Escape pauses also need time to reach the menu.

All progress uses native keys, clicks and pointer movement. Read-only angle
observations guide turns. No cheats, game commands, save edits, guest-memory
writes or original-asset changes are used. Both launches load exact module
`7e8d3194fd189a8e0089b41ee5972b08b67fd5650d6dfbe2a2fbb9d3c323a327`.
Inherited `source-identity.json` and `compile-source-delta.patch` preserve its
incomplete source identity; this is not a current-main build claim. Served
host files, native inputs, module bytes, saves and captures are separately
pinned in this run. Verification checks all65 original files and the ten
mounted prior save files. This documentation-only continuation changes no
emulator code and requires no new build.

Only this worker's local browsers, controllers, profiles and board watcher
are closed; other agents are preserved. No Boat/test box is used
(ID/state/expiry N/A), and ownership is handed back. Next: recover the safe
room-entry60/9 export, identify the gun firing across the storage room, and
establish cover or a route past the red crates before another exposed crossing.
The first controller exits143 after its requested browser close (sender
unknown); the retry exits0. Both browsers are absent, all six ports closed
and private profiles removed. Verification passes342 served response hashes,
44 original responses,20 exported save pins and211 trusted input events,
including95 paired key presses with no keys or buttons held.

## Covered floor route, soldiers identified, fresh native recovery (2026-10-31)

Run `20261031T0222Z-uplink-cover` freshly mounts the ten unchanged
`20261031T0210Z-uplink-satellite/room-entry-save/` files. Native Load Game
selects20:07 and restores **health60 / pistol9** (`room-restored-page.png`).
An initial leftward peek identifies two armed figures on the warehouse floor;
`attacker-inspect-page.png` shows the right-hand muzzle flash. The later
`pinned/aimed-gap-burst-page.png` and `pinned/soldier-head-burst-page.png`
clearly show a human soldier. Read-only extraction of the original PAK's BSP
entities corroborates human grunts. This identifies actual attackers before
spending ammunition; no shots target the hanging yellow crane fixture.

After native F7 resets the initial peek, a different route avoids the left
catwalk: from the room-entry view near yaw354, hold forward+Space300ms,
then forward+Ctrl2500ms. This drops directly behind the green crates beneath
the entry platform (`direct-floor-route-page.png`). Its immediate HUD still
shows60; the settled HUD falls to **44**, consistent with delayed fall damage.
Health then holds44 over another six seconds (`floor-cover-settled-page.png`).
This is a new covered floor traversal milestone, not proof of a cleared room
or a safe onward exit. All timings are real controller holds, not guest-time
guarantees.

Native F6 exports ten unchanged game-generated files to `floor-cover-save/`.
A fresh browser ordinarily mounts all ten and native Load Game selects20:36,
restoring **health44 / pistol9** (`pinned/fresh-floor-restored-page.png`).
Native movement inspects beneath the catwalk and a gap between crates. A
soldier moves across that gap; four pistol rounds reduce9→5 without a
confirmed kill, while incoming fire reduces44→20. The player then restores
the saved44/9 state with native F7 and waits six seconds
(`pinned/final-recovered-page.png`). The verified export remains the covered
floor state, not the later damaged combat state. There are zero observed
deaths. Enemy defeat, room clearance and satellite completion remain unverified.
Next: use this floor checkpoint, establish cover that blocks the crate-gap
firing lane, and engage the mobile soldiers before advancing north.

Fresh recovery also exposed an exact build limitation. The shared host mirror
changed after the successful first launch: `fresh/startup.png` records the
retained WASM's layout `54a33f1054df7c3f` conflicting with the current mirror's
`b77d93777a0f7d95`. The final `pinned/driver.cjs` serves the first launch's
unchanged captured host files from `served-source/`, together with the same
retained WASM. This restores launch and native-save recovery; it is an evidence
harness adjustment, not a production repair or a current-main build claim.
An intervening retry is abandoned before native loading because its save-size
metadata predates the final export; the successful pinned mount has exact
final sizes and unchanged bytes. All four launches and failures are retained.

The loaded module is exactly
`7e8d3194fd189a8e0089b41ee5972b08b67fd5650d6dfbe2a2fbb9d3c323a327`.
Inherited `source-identity.json` and `compile-source-delta.patch` preserve its
incomplete compiled-source provenance; actual served host files are pinned
separately. No cheats, game commands, guest-memory writes, save edits or
original-asset changes are used. Read-only angles and a camera-region dump
guide observation. Verification passes65 original files, ten prior mount
pins, ten exported save pins,623 served response hashes,44 original responses
and259 trusted input events, including112 paired key presses with no held
keys/buttons. Input logs, drivers, captures and module receipts are hashed in
`artifact-pins.json`. This documentation-only change requires no new build.

Only owned resources are closed: all four browser PIDs are absent, twelve
HTTP/control/CDP ports closed, and four profiles removed. Controllers exit
143/0/0/143 after requested closes; the143 sender is unknown, so clean normal
controller exit is not claimed. There are no unexplained browser losses.
Other agents are preserved. No Boat/test box was used (ID/state/expiry N/A);
ownership is handed back. Recovery instructions and evidence are retained in
this run's `recovery.txt`, `verification.json` and `result.json`.

## West-wall passage explored; exposed far end and browser loss (2026-10-31)

Run `20261031T0236Z-uplink-onward` uses the prior `pinned/driver.cjs`,
captured `served-source/` host snapshot, retained module and all ten unchanged
`floor-cover-save/` files. Native Load Game selects20:36; `settled-page.png`
personally confirms **health44 / pistol9**. The south/east perimeter exposes
a human soldier firing directly ahead (`east-perimeter-page.png`), reducing
health to26. Native F7 restores44/9. No pistol rounds are spent in this run.

The west wall offers a different route behind the crate stacks. From the
floor checkpoint, turn to yaw approximately89, strafe left about1000ms, then
advance north with W. Short native steps reach behind the first red stack
with **44/9** (`west-gap-run-page.png`). Continuing north crosses another
firing lane: `west-far-stack-page.png` shows35 health and
`north-wall-page.png` shows29 beside the far stack, with sky and a fence
visible through an opening. Waiting five seconds there reduces health to14
(`far-stack-stable-page.png`): this is **not safe cover or a verified onward
exit**. An earlier crouched west-lane attempt ends in one observed death,
followed by automatic native recovery. Soldiers can fire along this route;
no enemy defeat, cleared warehouse or satellite progress is established.

Native F6 is attempted at the far stack, but the browser disappears before
the read-only VFS export completes. No new save export is retained or claimed.
A second fresh browser again mounts the original ten unchanged floor files;
the native menu selects20:36, but this browser disappears while the loading
image remains visible (`retry/fresh-floor-page.png`), before a settled HUD.
Thus there are **two unexplained browser losses**, with no proven source
cause. Controllers remain reachable and report closed-target errors; browser
PIDs are already absent before explicit controller cleanup. These runtime
interruptions and the exposed far end are the concrete blockers. The original
verified44/9 export remains unchanged and is the recommended recovery point.

Verification passes65 original asset pins, ten mounted save pins,342 served
response hashes and44 original response hashes. Both loaded modules hash to
`7e8d3194fd189a8e0089b41ee5972b08b67fd5650d6dfbe2a2fbb9d3c323a327`.
The126 retained native input events are trusted, with51 paired key presses
and no held inputs in the available snapshots. The first browser's final
input tail after `far-stack-stable-page.png` is unavailable; action requests
are retained, but a complete final trusted-event audit is not claimed.
All observation and progress use native inputs and read-only inspection:
no guest/save edits, original-asset changes, cheats or game commands.

The inherited `source-identity.json` and `compile-source-delta.patch` retain
the incomplete compiled-source provenance. The pinned host snapshot avoids
the previously documented module54a33f/current-mirrorb77d layout mismatch;
this is not a current-main build or a production repair. No source fix or
new build is claimed for this documentation-only continuation. Evidence and
recovery details are in this run's `verification.json`, `lifecycle.json`,
`recovery.txt` and `result.json`.

Only owned resources are closed: both browsers absent, six ports closed, two
private profiles removed and the board watcher stopped. Both controllers
exit0 after explicit cleanup; that does not explain the earlier browser
losses. Other agents are preserved. No Boat/test box was used (ID/state/expiry
N/A); ownership is handed back. Next: recover the original44/9 floor export,
establish a firing position before the west-wall gap, and investigate browser
exit signals if native loading or export is interrupted again.

## Native recovery interrupted by recorded SIGKILL (2026-10-31)

Run `20261031T0250Z-uplink-covered-attempt` makes one bounded continuation
attempt using the same ten unchanged `floor-cover-save/` files, retained
module and prior captured host snapshot. Before native play, its controller
attaches browser-disconnect, process-exit/close, page-error and stderr
listeners. Native input events also stream to disk as they arrive, preserving
the input tail independently of later screenshots.

The inspected `load-ready.png` shows the expected native20:36 quicksave
selected. A native click on Load Game at02:49:21 UTC begins loading, but the
browser exits before a settled gameplay HUD or fresh44/9 confirmation.
`lifecycle-events.jsonl` records **process-exit SIGKILL** at
02:49:44.460 UTC, browser-disconnected at02:49:44.479, and process-close with
the same signal. The controller remains reachable and later exits0 after
explicit cleanup. This identifies the termination signal for this run;
the sender and cause remain unknown. Browser stderr contains two deprecated
registration-endpoint errors without a causal crash diagnosis. Kernel logs
are inaccessible and cgroup memory-event files are unavailable in the
inspected mount (`system-diagnostics.json`), so an OOM cause is unproven.

This runtime interruption ends the attempt below its15-minute ceiling.
There is no new gameplay milestone, shot, observed player death, soldier
defeat, safe onward passage or save export. No exposed west-gap burst is
repeated. The preserved44/9 checkpoint remains the recommended recovery
source; this run does not freshly verify its playable restoration.

Verification passes65 unchanged original assets, ten unchanged mounted save
files,171 served response hashes and22 original responses. All15 recorded
native events are trusted; both key presses have releases, and no keys or
buttons remain held. No cheats, console commands, guest-memory writes,
save edits or original-asset changes are used. The exact loaded module is
`7e8d3194fd189a8e0089b41ee5972b08b67fd5650d6dfbe2a2fbb9d3c323a327`.
Inherited `source-identity.json` and `compile-source-delta.patch` preserve
the incomplete compiled-source identity. The pinned prior host avoids the
documented module54a33f/current-mirrorb77d layout mismatch; no current-main
build, proven production defect or source repair is claimed. This is a
documentation-only change; no new build is required.

The owned browser PID is absent, all three owned ports are closed and the
private profile and board watcher are removed/stopped. Other agents are
preserved. No Boat/test box is used (ID/state/expiry N/A); ownership is handed
back. Evidence, unchanged recovery recipe and limits are retained in this
run's `verification.json`, `lifecycle.json`, `recovery.txt` and `result.json`.
Next: diagnose the SIGKILL sender or external browser lifecycle before another
native floor recovery; covered-route gameplay remains pending.
## Headed renderer profiling (2026-10-30)

Visible Chrome 156, release base `14b05c8d8`, threads enabled, same saved
640x480 staircase: two 60-second presentation-rate samples give OpenGL
22.75/30.46, Direct3D 6.67/7.43, and game Software 4.33/4.63 per second.
Evidence: `20261030-uplink-headed-{gl,d3d,software-640}`. Count only `gpu:-1`,
`directdraw:6`, and `directdraw:3`, respectively; generic DirectDraw events
duplicate surface notifications. This is stationary animated gameplay, not
combat or unique-frame proof. Software mode index 0 is 640x480; hardware uses
index 3. The initial Software index-3 run is excluded (1152x864).

Four 30-second profiles use the same save in visible Chrome:
`20261030-uplink-{d3d-profile,gl-webgl-profile,gl-wat-profile,d3d-wat-profile}`.
The last two force our software rasterizer, distinct from game Software.
All show textured staircase geometry and HUD. GPU runs confirm WebGL through
ANGLE/Metal on Apple M1; D3D has zero software fallbacks. Profiled rates include
instrumentation overhead and are not clean FPS benchmarks.

D3D's guest spends 13.22 seconds in heap_alloc via ProcessVertices FVF packing.
Renderer replay totals 1.72 seconds, including 0.39 seconds of readback sync;
the renderer is roughly 93% idle. ProcessVertices-only reuse moves allocation
to DrawIndexedPrimitiveVB (11.39 seconds): `20261030-uplink-d3d-pv-reuse` is
superseded. The complete candidate reuses growable per-instance FVF storage
across ProcessVertices and both VB draw paths. Whole-source packing preserves
overlapping VBs; queued draws copy into owned packets before returning.
Other allocating callers retain their contract.

`20261030-uplink-d3d-fvf-reuse` samples only 0.298 ms in heap_alloc over 30 s.
WASM: `ff157b84e37bc99ce8e1839026b8a4030f398276dd255ec0b861656325129f52`.
Its profiled presentation rate is 8.40/s, but heavy competing Safari load was
observed during candidate measurements: a clean FPS improvement is unverified.

Approximate simultaneous CPU activity, guest execution versus render worker:

| Baseline API/backend | Guest active | Renderer active | Overlap | Share of renderer activity |
| --- | ---: | ---: | ---: | ---: |
| OpenGL/WebGL | 15.16 s | 2.20 s | 1.07 s | 48.8% |
| Direct3D/WebGL | 20.13 s | 2.04 s | 0.90 s | 44.1% |
| OpenGL/our software | 8.79 s | 21.99 s | 4.70 s | 21.4% |
| Direct3D/our software | 13.04 s | 11.90 s | 4.54 s | 38.2% |

Each interval is about 30 s. Exclude idle, unattributed samples and recognized
blocking waits. Reconstruct and sort CDP timestamps (negative deltas occur),
and map functions against each saved combined.wat. This is sampled CPU overlap,
not GPU execution timing. Do not count entire Atomics.wait tasks as active.
Baseline D3D has no saved timeline, only CPU profiles. Candidate overlap is
0.36 s, with 5.04 s guest and 2.33 s renderer active; contention and changed
bottlenecks prevent calling this a regression.

Next lead: browser-shell classifies DirectDraw presents as software, setting
runSlice=1000 even with D3D/WebGL, versus GL's 10000. This remains unchanged;
the candidate guest profile is largely idle and warrants a scheduling test.

Validation passes: ProcessVertices growth/reuse/alias, v3 VB draws, fog,
camera-position texgen, worker parity with queued indexed draws, neutral
command-stream ownership, and native/compat builds. Intro offset, menu cursor,
reported Safari white gameplay, and repeated-switch menu issues remain open.
No newer main was merged, no release deployed, and this work is uncommitted.

### Direct3D Worker slice experiment

`20261030-uplink-slice-sweep` keeps the FVF-reuse module above and alternates
1k/10k/10k/1k blocks in one visible Chrome session. Each round reloads the
same save, settles for 30 seconds and measures for 60 seconds. Correct
surface-specific presentation rates are 8.08, 10.91, 15.68, and 6.21/s.
Weighted means: 7.14/s at 1k, 13.29/s at 10k (1.86x observed). The page stays
visible throughout all four samples. Competing Safari, screen recording,
audio and other system activity varies, so the exact gain is not a quiet-box
estimate; both 10k samples nevertheless exceed both 1k samples.

The app policy now distinguishes Direct3D's EngineType=3 from Software's
EngineType=1 even though both present through DirectDraw. A confirmed guest
Worker uses the measured 10k D3D budget; cooperative D3D and game Software
retain their existing 1k policy. Successful registry writes track in-process
switches, and initial selection includes restored registry state. Selecting
Software still defers the smaller budget until presentation so setup dialogs
are not throttled. Explicit slice dropdown choices remain authoritative.
Callback tests cover these transitions and restored D3D selection.

Separate 30-second CPU profiles, without full timeline tracing, estimate
guest/render overlap at 2.01 s (53.2% of renderer active time) for 1k versus
4.30 s (66.3%) for 10k. Guest active samples are 18.76/23.92 s; renderer
active samples are 3.78/6.48 s. Profiled presentation rates are 5.54/7.63/s
and are excluded from the unprofiled FPS comparison. These remain sampled
CPU estimates under variable load, not GPU timing or scheduling proof.

`20261030-uplink-d3d-slice-policy` validates the final browser policy in a
fresh visible Chrome launch without runtime slice overrides: actual budget
10000, 596 surface presents in 60.03 seconds (9.93/s), no visibility changes
or page errors. Reviewed captures show textured staircase/HUD, complete pause
menu and resumed gameplay. The single fresh-run rate is a functional check
under current load, not a replacement for the paired comparison. Callback
regressions, installed-payload main-menu test, JS syntax/diff checks and browser
cache-version self-test pass. The WASM is unchanged from the FVF candidate;
source hashes and runtime patch are archived with this run. Work remains
uncommitted on `fix/uplink-startup-20261030`; dev server 52671 serves it.

### Idle submission experiment after c98d17dd6

`20261030-uplink-idle-batch-sweep` adds submission-reason counters to the
legacy Encoder without changing its default behavior. In one visible Chrome
session, the guest remains at 10k blocks. The experiment overrides only the
idle submission decision to require 1/4/4/1 commands, reloading the same save
and settling 30 seconds before each 60-second sample. Capacity, presentation,
fence, clear and publication barriers retain their immediate flush behavior.

Immediate-mode samples: 12.66 and 10.80 presents/s; four-command samples:
12.00 and 12.46. Weighted means are 11.73 versus 12.23 (+4.3% observed), smaller
than baseline drift under competing system load. This does not establish a
repeatable FPS gain, so the production idle-submission rule remains unchanged.

Counters identify the cause conclusively: 99.3-99.4% of baseline submissions
come from the idle-consumer rule, not capacity or synchronization. Batches
average 1.91 commands and about 87 submissions/frame. Requiring four commands
raises the mean to 4.29 and reduces submissions to about 39/frame, without a
convincing throughput benefit. The counters and shared submission-decision
helper remain for diagnosis; the four-command override exists only in the
scratch benchmark. This legacy path's capacity is 2 MiB and its size threshold
does not fire in this scene; increasing that capacity cannot remove these
idle-triggered submissions.

Separate CPU profiles show 4.12 s guest/render overlap over 31.03 s with
immediate submission (67.8% of renderer active time), versus 3.53 s over
30.56 s with four-command batching (63.8%). Profiled rates are 10.91/11.11/s.
These approximate CPU sampling results exclude recognized waits and are not
GPU timings; neither FPS nor overlap supports changing the default. Reviewed
captures retain the textured staircase/HUD in both conditions, with no page
errors. Counters/helper and these notes are uncommitted; no release was made.

Next measured target: `$d3dim_lights_refresh` takes 1.54 seconds of self
samples in the 31-second immediate-submit profile (~4.9%). It scans
DX_OBJECTS up to DX_MAX=16384 until four initialized lights are found, on
each refresh. Investigate a correctly invalidated shared light index or a
safe scan bound; do not cache pointers per Worker without accounting for
light creation, mutation and release by other instances. No light-scan
optimization has been implemented by this experiment.

Validation of the retained counters/helper: neutral command-stream ordering,
OpenGL command-stream barriers, real software-GL producer/Worker bitmap pixel
parity and synchronous visibility, browser cache-version self-test, JS syntax
and diff checks pass. All six browser samples used actual slice10000, remained
visible, and reported no page errors.

### Shared light scan bound (2026-10-30)

`$dx_alloc` now publishes a monotonic exclusive upper bound for slots ever
allocated as legacy light objects, under LOCK_DX in shared memory. Refresh
atomically reads that bound and retains the existing type/buffer/dwSize checks,
slot ordering and four-light limit. It does not cache guest pointers across
refreshes. Releases never lower the bound; both initial allocation and recycled
allocation update it. A scene with no legacy lights skips the table scan.
The bound can still reach DX_MAX in a long-lived process; this is a safe scan
reduction, not a full live-light index.

Evidence: `20261030-uplink-light-bound-baseline` and
`20261030-uplink-light-bound-candidate`. Visible Chrome, threads, WebGL-backed
Direct3D, 640x480, automatic 10k budget, same saved staircase checkpoint,
30-second settling before each of two 60-second samples, then a separate
30-second CPU profile without full timeline tracing. Baseline rates are
14.73/16.07 presents/s (mean 15.40); candidate 22.31/21.17 (mean 21.74).
These sequential runs are subject to variable background load: the observed
41% difference is not an isolated estimate of this optimization's FPS gain.

The targeted CPU result is clear: light refresh self samples fall from
1776.976 ms / 30171.804 ms (5.89%) to 5.974 ms / 30136.601 ms (0.020%).
A live read before timing confirmed the candidate light bound was zero.
Sampled guest/render overlap is 4.475/4.459 seconds, 69.0/64.6% of renderer
active time; this is not GPU execution timing and shows no overlap improvement.
Reviewed captures retain textured geometry and the HUD; all samples remain
visible, use slice10000 and report no page errors. No combat/traversal claim.

Loaded WASM: baseline ff157b84e37bc99ce8e1839026b8a4030f398276dd255ec0b861656325129f52;
candidate df83d2d4939e2409687c02162544f07609049ff93dd9535c0ed25ab2b6e0ccf0,
layout 84cbc24fabc77b4b. Both runs retain the preexisting desktop-query change
and JS submission diagnostics. Native/compat builds pass. ProcessVertices
regression covers another WASM instance allocating, initializing, changing,
retiring and reusing lights, four-light cap, and fallback recycling into the
last table slot. Viewport ownership, D3D7 lighting, fog and queued Worker pixel
parity pass. The prior scheduling commit's two stale callback-census hashes
were reconciled after reviewing closure lifetimes; ownership remains pending.
Changes remain uncommitted; dev server 52671 serves the candidate.

## Cursor ownership and fresh-launch menu investigation (2026-11-01)

The light-bound changes above are committed as `0e36a8d0d` (not pushed).
Cursor follow-up is still uncommitted. In a real Worker menu, the owning guest
thread reports ShowCursor count 1 while the page-shadow instance reports 0.
The older qualification based on page count/CSS alone did not establish the
guest cursor state. Cursor handle and signed count now live in shared,
per-guest-thread slots (IDs 1..16, with slot 0 reserved). Browser visibility
reads the hit window's owning thread, and thread retirement resets that slot.
Cross-instance NULL cursor, hide/show, thread isolation and reuse tests pass;
renderer cursor tests pass 21/21. Native and compatibility builds pass, layout
`624d2388f3d5dc0b`; actual browser-loaded module SHA-256 is
`7625ed243bbcb54a7c5ac7c3bfe7d5004eb4c5829c0ce680bf81778d9c92875b`.

Evidence in `20261031-uplink-ui-before`, `20261031-uplink-ui-cursor`,
`20261031-uplink-ui-bitmap` and `20261031-uplink-ui-dib` remains diagnostic.
The first run includes the normal intro; later runs use `-nosierra -console`
only to shorten investigation, not as a shipping default. Native cursor
screencapture attempts caught Terminal, so they are not cursor verification.
Page screenshots omit the OS pointer. The custom CUR decoded to 32x32 with
104 opaque pixels in the initial run, but visible native cursor verification
and gameplay/menu transitions are still open.

Fresh launch also lacks the textured background in the canonical menu GDI
surface, before exclusive composition. The original splash.bmp in pak0.pak
is a valid 640x480 4-bpp image with 11 palette entries and visible texture.
Configuration and Video labels animate on black; Video Modes also shows
untranslated IDS_VIDMODE_* checkbox labels. This is not yet resolved, and
these runs do not qualify repeated renderer switching. Intro positioning
remains offset: its 320x240 movie centers on the virtual desktop while the
black backing window remains 640x480. No pre-intro mode change was observed.
The independent GetDisplayMode desktop-metrics regression passes, but does
not resolve that intro positioning. Safari remains intentionally untested.

`20261031-uplink-ui-coop` narrows the startup issue: cooperative mode also
starts with a black menu. New Game -> Easy reaches the introduction with a
legible HUD; Escape then restores the textured pause background. The signed
cursor count changes 1 -> -1 -> 1 and CSS changes custom CUR -> none -> custom
CUR. This verifies the cooperative visibility transition, not native pointer
pixels or the corresponding Worker gameplay transition. Background decoding
therefore works after engine initialization; do not classify the startup
failure as a general 4-bpp decoder failure or a Worker-only race.

## Initial-show ordering and presentation queries (2026-11-02)

The fresh-launch black background is now fixed in the isolated release
worktree. A nested child creation returned through CACA0001 while the main
WM_CREATE was still outstanding and consumed the main implicit-show latch.
Only the main invocation may now consume it. Its initial WM_SHOWWINDOW runs
before activation, on an owned guest-stack continuation so resource-loading
yields cannot abandon the callback. The saved HWND survives nested creation;
destroying that HWND returns NULL and releases the frame. The regression
checks ordering, nested child latch preservation, nested main replacement and
destruction cleanup. ShowWindowAsync and failed creation regressions pass.

Evidence `20261101-uplink-main-show` reviews a fresh Worker menu with a complete
textured background, then Configuration, Video and Video Modes. The two earlier
diagnostic variants, `20261101-uplink-show-fixed` and
`20261101-uplink-show-ordered`, still fail startup and are published as such.
Video Modes temporarily displays template checkbox labels while its driver
information dialog is open; after dismissal initialization finishes and those
controls disappear on the OpenGL page. The run uses `-nosierra -console` only
for diagnosis. Loaded WASM is
`a9b1c2b749ce023d7b01d97e7514911f439be2c00e625b1ded4f792aae52569f`,
layout `624d2388f3d5dc0b`; native and compatibility builds pass. Native pointer
captures still do not establish the cursor over the game canvas and are not
published as cursor proof. Intro geometry and repeated renderer switching
still need qualification; Safari remains excluded.

D3D presentation was calling getExtension and getParameter for the renderer
name on every frame. This identity is now cached per WebGL context with a
WeakMap. Missing contexts are retried and replacement contexts get their own
query. The real adapter test checks 100 presents produce one query and a
replacement produces another. Shared-render and OpenGL worker protocol tests
pass. The prior D3D profile spent 232 ms / 30.14 s (0.77%) in getParameter;
this is a small optimization, not a claim of a material FPS gain. Remaining
large guest costs are interpreted execution and response waits; no further
allocation hotspot comparable to the previously fixed ProcessVertices buffer
allocation was established.

Startup/cursor/display changes are committed as `de71e7c07`; presentation
query caching and moving the unused argument view/closure off the GPU path
are committed as `33704ddf5`. Neither commit is pushed. The allocation cleanup
also passes the shared-render adapter test, but was added after the benchmark
page loaded and is excluded from its timing claim.

`20261102-uplink-d3d-query-cache` reviews headed Chrome Worker gameplay at the
same 640x480 stationary staircase save, textured pause menu, then resumed
gameplay, with no page errors. After settling, two unprofiled 60-second samples
are 10.05/10.32 presents/s. The separate 30-second profile has zero
getParameter samples. Guest execution remains dominated by uop dispatch
(9.47%), response waits (6.03%), branch-end handling (5.29%) and x87 islands
(4.05%); render-worker readPixels is 2.46% and writeback 1.43%. The render
worker is idle 79.84% of its sampled interval. This does not measure GPU
execution or establish that more batching would improve throughput.

The much older 21.74 presents/s average is not reproduced today:
`20261102-uplink-baseline-recheck` replays its saved `df83d2d...` WASM and
region map with renderer-input/D3D adapter from `0e36a8d0d`, through a separate
local proxy without replacing dev-server artifacts. That unprofiled 60-second
sample is 4.77 presents/s, with the same textured save reviewed. Sequential
runs under variable load are insufficient to attribute the candidate's higher
rate to the query cache or to estimate a regression against the older day.
The narrow demonstrated optimization is removal of repeated context queries.

`20261102-uplink-normal-intro` verifies the normal launch, without
`-nosierra`, reaches the corrected menu. A native macOS screenshot with the
pointer explicitly placed over the game canvas now shows the white menu
cursor; the owning Worker reports display count 1, with no pointer lock or
hidden-cursor CSS. This closes the earlier native-pointer verification gap.
The intro geometry issue persists: its backdrop is 578x431 during this run,
while the 320x240 movie is explicitly positioned at desktop-centered
(370,248). The later menu becomes 640x480. This is still a failed intro
qualification, not a fully qualified release; the launch arguments were not
changed to suppress it.

The same normal-launch run then reaches textured default OpenGL gameplay
with a legible HUD at 320x240, and returns to the textured pause menu. The
owning Worker cursor count/CSS changes 1/visible -> -1/none -> 1/custom CUR.
Native cursor pixels were reviewed at 16:44; a later capture overwrote that
artifact with unrelated foreground content, so native screenshots are omitted
from the published bundle rather than presenting the replacement as proof.
Gameplay/pause screenshots and shared-state readbacks are retained. Repeated
renderer switching was not requalified in this pass. Automated test browsers
are closed; local dev server 52671 still serves the committed fixes.

## Hidden intro window and explicit show ordering (2026-11-04)

The intro backdrop is a hidden indirect-template root (style 0x80000840),
initially 578x431. Half-Life clears its DC before showing the separate 320x240
movie, which it explicitly centers on the virtual desktop. Our unconditional
force-show of hidden top-level indirect templates exposed this unfinished root.
Removing that workaround restores the template visibility contract. Hidden
dialogs must also not arm the implicit-main activation continuation.

The first candidate (`3f7e0afd...`, `20261103-uplink-intro-hidden`) removes the
stray backdrop but exposes a second ordering error: explicit ShowWindow posted
WM_SHOWWINDOW, allowing activation/painting before Half-Life initialized its
menu background. The next candidate sends that notification using a guest-stack
continuation that retains the HWND, resolved show command, placement return
convention and original visibility. Completion revalidates the HWND before
changing visibility; built-in controls stay on native dispatch. Creation,
explicit callback/destruction, ShowWindowAsync, secondary sizing, modal show
ordering and Paint Attributes regressions pass, as do native/compat builds.
Final candidate `13e7c0acf67521ac91fb8462896c80b1cdfc3ac98c527398272a4186e9a08650`
in `20261104-uplink-final-intro` shows the centered movie without the stray
backdrop, a complete main menu, textured Hazard Course gameplay and a complete
pause menu. However, repeated switching is NOT qualified: dismissing the
driver-advice popup returns to Video instead of exposing the mode controls.
The final run is therefore failed release qualification. Keep the startup/
ShowWindow changes uncommitted pending diagnosis; only the independent empty
nonclient-paint optimization is ready to commit. Safari remains excluded.

`20261103-uplink-switch-review` completed OpenGL -> Software -> OpenGL ->
Direct3D -> Software at 640x480 in one headed Chrome Worker session. Each
restart reached textured Hazard Course elevator gameplay and a textured pause
menu, without Z_Free or runtime errors. This is the prior committed module
`a9b1c2b7...`, not the new explicit-show candidate; camera positions vary and
the run is not an FPS comparison. Safari remains intentionally excluded.

Four SEO-only main commits were cherry-picked onto the release branch:
e3467a0bc, 332e567d3, b52c9193f and 337621c88, now 9cd701049, 7462d9282,
4a48b4385 and 003a6e730. Game descriptions, screenshots, FAQs and Space Cadet
title changes are included, along with the correction preserving existing
demoscene pages. Generated game pages pass screenshot, JSON-LD and indexability
checks. Unrelated main runtime changes were excluded; nothing was deployed.

## Resolution-dependent OpenGL readback (2026-11-04)

Headed Chrome/ANGLE Metal on Apple M1, Worker gameplay, the saved staircase
view, 30-second settling and two 60-second samples per resolution:
`20261104-uplink-resolution-640-repeat` gives 39.98/39.93 presents/s;
`20261104-uplink-resolution-1024-repeat` gives 34.51/34.55. Both load module
`b70e10ee645f5660065fe5e98257b7b6fac191fce3a9ad893c87ea3d0df1c507`.
These are guest presentations, not independently verified unique display
frames. Screenshots show the same textured view/HUD. Earlier single samples
17.12/8.36, in the runs without `-repeat`, are not reliable controls: the same
640 build subsequently runs at 40/s. Those first samples also did not trigger
the readback path; retain them rather than generalizing their zero counters.

The repeat profile establishes the unnecessary work precisely:
`DefWindowProcA -> defwndproc_do_ncpaint -> defwndproc_ncpaint ->
gdi_surface_descriptor -> gpu_gl_call(0x10002)`. The frame painter resolves
GPU-owned pixels before a fill that is entirely excluded by its NC clip.
The game repeatedly shows its already-visible borderless game window; its
client covers the whole window, so no nonclient pixels need painting.

Each repeat frame triggers getImageData, RGBA-to-canonical conversion and a
subsequent canonical-to-RGBA upload. At 640x480, readback traffic is ~49 MB/s
and merge time ~1.18 ms/frame. At 1024x768, it is ~109 MB/s and ~2.96 ms/frame.
The 1024 page profile spends 7.29% in writeRgbaRect, 3.17% in rgbaRect and
2.90% in getImageData; the guest spends 21.04% in brokerCall. The render Worker
is idle ~93% of its sampled interval; this is not a GPU-utilization reading.

The fix checks whether the positive client rectangle covers the complete
window before NC DC allocation/pixel access, in both frame-painter entry
paths. It follows geometry rather than a game-name or style-only exception.
The regression retains GPU ownership for an empty NC clip and still resolves
a one-pixel nonclient band. Caption states, WinMine dialog frames, borderless
dialog menus and real deferred OpenGL/GDI ordering regressions pass.

`20261104-uplink-empty-nc-1024`, module
`43610ae3be08103e3e66c7fee10a8eba82131f669c510b2d6af54f947e687120`,
has zero readbacks/merges in both 60-second samples and the separate 30-second
profile. Textured gameplay, full pause background and resumed gameplay were
reviewed. The pixel-copy hotspot disappears. Its 7.72/8.62 presents/s cannot
establish a gain or regression: contemporaneous process snapshots show heavy
Safari/WebKit/WindowServer load, unlike the earlier repeat. Do not advertise
an FPS gain until a quiet paired rerun. The proven improvement is removal of
the unnecessary per-frame copy/fence, not resolution-independent rendering.
The later show-callback return-value correction is outside this timing run.

## Uniform preparation and presentation reuse (2026-11-05)

The GL frontend previously built every uniform value (including four flattened
eight-light arrays and a folded projection) whenever any uniform was dirty.
It now resolves only dirty names. The shared GPU backend compares caller values
against its owned snapshot before allocating, and reuses snapshot storage on
changes of the same shape. In-place matrix/integer changes, signed zero and
NaN comparisons are covered; values are never cached by caller-array identity.

The GL Worker presentation bridge now resizes its canvas only when a dimension
changes. Bitmap frames use copy compositing to replace transparent pixels as
well as opaque pixels; raw frames still use putImageData. The protocol regression
covers stable dimensions, resizing, raw frames and bitmap retirement.

Fixed-function, GPU resource/cache, Worker protocol, depth-range folding,
multitexture, stencil and color-mask tests pass. Browser cache-version and diff
checks pass. These are JS changes; the loaded WASM stays
`13e7c0acf67521ac91fb8462896c80b1cdfc3ac98c527398272a4186e9a08650`.
The unrelated dirty ShowWindow candidate remains present in both measurements
and is still not release-qualified.

Headed Chrome Worker runs `20261105-uplink-uniform-baseline` and
`20261105-uplink-uniform-candidate` use the same 1024x768 staircase save,
settling, two 60-second samples and a separate 30-second CPU profile. Baseline
samples are 9.54/12.03 presentations/s; candidate samples are 14.56/7.73.
The large within-run variation prevents a defensible overall FPS gain claim.
Both runs preserve the actual three JS sources, loaded WASM hash, source patch,
profiles, process-load snapshots and harnesses.

Render-Worker profiles attribute 260.963 + 56.822 ms of self time to uniform
preparation/cache calls over 284 baseline presentations, versus 4.793 + 7.321 ms
over 224 candidate presentations: about 1.119 -> 0.054 ms per presentation.
This is sampled CPU attribution under variable host load, not an isolated
end-to-end speedup. Total sampled Worker GC rose from 44.005 to 93.701 ms;
do not claim reduced overall GC from these runs. No page errors were reported,
and textured gameplay/HUD captures were reviewed at the same saved position.

The additional real Chrome pixel probe passes opaque-to-translucent replacement
without stale pixels, same-size canvas reuse, resizing to transparent content,
and a subsequent raw-pixel frame. Probe output and source are preserved in the
candidate run. No interpreter/JIT optimization is involved.

## Aggregate CPU bottleneck profile (2026-11-05)

`20261105-uplink-cpu-breakdown` rechecks the bottleneck after c84edcd8d,
using the same loaded WASM/dirty startup candidate. One visible Chrome game,
1024x768 OpenGL/WebGL Worker mode, saved staircase viewpoint; HUD and runtime
logging disabled before measurement. A settled 60-second unprofiled window
records 10.90 guest presentations/s; a separately settled 60-second profile
records 9.61/s. These are not clean profiler-overhead or peak-FPS measurements:
process snapshots show Safari/WebKit/WindowServer contention. Screenshots
retain textures and HUD, and no page errors are reported.

The analyzer resolves WASM indices against saved combined.wat and groups
mutually exclusive leaf/self sample counts by source subsystem. Guest Worker
has 32,678 samples, of which 29,478 are non-idle. Their distribution is CPU
core/instruction execution/guest memory 76.03%, OS APIs 5.32%, graphics APIs
4.93%, synchronization stacks 3.48%, message submission 2.65%, and other
JS/runtime/helpers/GC 7.59%. CPU-core attribution includes memory helpers
called by APIs; it does not mean all of that work is removable overhead.

Within that same non-idle denominator: ALU/instruction handlers 27.00%, uop
engine 10.78%, core handlers 9.17%, FPU 8.58%, loop matchers 7.80%, cache/branch
machinery 5.81%, and register/memory helpers 4.28%. Largest individual core
functions by all guest samples are uop_fast 7.90%, x87_island_fast 5.14%, and
branch_end_at 4.96%. The dominant measured workload is CPU emulation, not
uniform preparation or buffer allocation. The previous shortlist was a list
of small local candidates, not a ranking of the main bottlenecks.

The page is 87.29% profiler-idle and the render Worker 92.96%; neither is GPU
utilization. Thread percentages are not added. Counts avoid assigning long
sampling gaps to whichever function happened to be sampled; 1,318 guest
intervals exceed 5 ms. Synchronization samples can include blocked time and
are not pure CPU usage. This capture does not measure GPU execution duration
or distinguish necessary game math from avoidable emulator dispatch cost.

Next investigation: identify the guest blocks behind the instruction/x87
workload and measure fast-path coverage before proposing an interpreter
variant. Any such variant still needs the required V8/SpiderMonkey native
disassembly and matched A/B measurements. No runtime change was made here.

## Guest hot-block diagnosis (2026-11-05)

Evidence: `20261105-uplink-hot-loops`, headed Chrome, same saved staircase,
1024x768 OpenGL/WebGL Workers, HUD/logging off. Three 15-second handler/block
histograms, restoring the save between windows; a separate uninstrumented
20-second counter interval precedes them. Loaded WASM SHA-256 remains
`13e7c0acf67521ac91fb8462896c80b1cdfc3ac98c527398272a4186e9a08650`.
Reviewed all three captures: textured scene and HUD intact, no page errors.

Stable regions below are percentages of recorded threaded block entries,
**not CPU time**. Grouping joins nearby addresses; a region is not necessarily
one control-flow loop. Addresses are preferred full VAs in hw.dll:

| Region | Three-window range | Disassembly finding |
| --- | --- | --- |
| 1000a27a–1000a96f | 15.2–15.8% | Contains per-vertex texture-coordinate, color and vertex submission loop; repeated indirect GL calls and x87 preparation |
| 10007130–100074b2 | 14.2–15.7% | Floating-point dot-product/clamp/table-lookup calculations and vector helpers, consistent with lighting preparation |
| 100a5920–100a5ddd | 11.1–11.4% | Math-runtime region, including sin/cos/tan, floating-point control/status handling and conversions |
| 1000e198–1000f145 | 8.4–8.6% | Contains another immediate-mode polygon submission loop |

The tight loop at 1000a875 ends with the backward branch at 1000a932;
calls through GL slots split its execution repeatedly. The scalar routine
at 100071c0 calls the float-to-integer helper at 1009e920, which saves the
x87 control word, selects truncation, converts and restores it. These are
concrete candidates for reducing generic instruction/call overhead; block
counts alone do not establish their individual CPU costs or expected FPS wins.
The saved live-byte disassembly avoids relying only on unrelocated disk code.

The uop tier remained enabled. Diagnostic uop block share was 35.9%, 34.6%,
35.5% using uopBlocks/(uopBlocks+threadedBlockHits). Do **not** call this normal
coverage: histogram mode changes chaining and compilation behavior; new
declines occurred during collection. Block-histogram collision counts were
860302/142407/91057, so some entries are lost. The original module-base probe
returned empty; attributed copies use recorded route runtime bases plus PE
preferred bases, preserving original raw artifacts.

Without the histogram, 20 seconds recorded 21,852,837 uop blocks across
2,351,723 entries, 6,548,835 x87-island runs and 2,641,163 pipeline runs.
There were no new installs, kills or guard failures: recompilation churn is
not supported as the steady-state cause. There were 1,072,083 memory-window
re-guards proving 17,153,328 pages, another measurable candidate, but its CPU
cost is not ranked by these counters. Experimental block-exec is disabled;
that alone does not establish it would improve this workload.

Priority: measure CPU cost within the stable x87/vertex regions, then test a
generic fast path for repeated FP conversion or call-boundary overhead, with
matched native-code inspection and A/B runs. Do not infer that changing GL
queue batching or enabling an experimental tier will help from this census.
No interpreter variant or runtime changes were made in this investigation.

### Follow-up: conversion is already folded; arithmetic-dispatch experiment

The 1009e920 conversion body matches `$ftol_body_at` exactly. The third
histogram recorded 374,888 H500 (`$th_ftol_native`) executions; a hot guest
entry does not mean its body is still interpreted. In the prior uninstrumented
CPU profile, H500 has only 54 self samples (0.18% of non-idle guest samples).
Do not prioritize adding another conversion fast path here.

Tested one isolated variant in `$x87_island_fast`: replace the eight arithmetic
operation comparisons with a br_table, leaving the actual arithmetic,
exception checks, memory helpers and state updates unchanged. Differential
test passes 400 randomized sequences / 7,178 operations against both generic
and unfused execution, including FPU state and exception traces. Candidate
module SHA-256 is
`931c87e29d970ddce738cc0094e51b23f48de5334b8ecbe1a96603180015036a`.
Control sources were compared against saved combined.wat and match exactly
apart from this variant. Canonical compiler builds tail-call and compatibility
artifacts; the local dev server keeps serving the control module. Candidate
Chrome uses request interception for its WASM only.

ARM64 native captures: V8 shell 15.4.49 TurboFan and SpiderMonkey C155 Ion,
both control and candidate, using tools/wasm-native.js. V8 handler size grows
23,328 -> 23,360 bytes; Ion 9,136 -> 9,296. Both emit a table-indexed indirect
branch. V8 keeps its 0x2a0 frame and spills; Ion keeps its 0x70 frame and FP
state loads/stores. Memory helper and exception call paths are unchanged.
These shell versions are not the Chrome 156 engine; no x86-64 measurement
was performed. Eight alternating synthetic arithmetic pairs vary from
152 to 601 ms per million islands and do not establish a stable speedup.

Headed Chrome evidence: `20261105-uplink-x87-dispatch-control` and
`20261105-uplink-x87-dispatch-candidate`. Both restore the same staircase
save, settle, then capture a 60-second unprofiled window and a separate
60-second CPU-profile window with HUD/logging off. Reviewed textures/HUD,
no page errors. The control's first window overlaps compilation and is
excluded as clean FPS evidence (10.02 presents/s versus candidate 8.97).
The separate profile windows report 8.58 versus 8.81 presents/s. x87-island
self sample share is 5.89% versus 5.67% of non-idle guest samples. Sample
counts differ substantially (10,272 versus 14,211 total, with 2,050 versus
2,821 gaps over 5ms), so raw samples/present cannot be compared as CPU time.
Safari/WebKit/WindowServer contention is recorded in load files. No reliable
speedup or regression established; the variant was reverted, with its patch,
modules, native disassembly and profiles retained in evidence. Dev server
still serves the original control. FP state spilling/helper boundaries remain
an untested candidate; this profile does not establish a benefit from changing
them. A quieter paired dispatch benchmark can also resolve the uncertain result.

### Arithmetic-dispatch microbenchmark details and decision

The saved `uplink-x87-micro.cjs` and `micro.json` in both dispatch evidence
directories reproduce the synthetic test. Node v24.21.0 uses V8
13.6.233.17-node.53 on ARM64, a third engine version distinct from the native
capture shell and Chrome. The harness instantiates the complete control and
candidate modules, runs 100,000 warmup islands each, then eight alternating
AB/BA pairs of 1,000,000 islands. Each island loads 3.25, multiplies by 2,
adds and subtracts 1, divides by 2, and stores 3.25. It checks the final value
and exact island-run count. Uop execution and competing specialized FP folds
are disabled to isolate H451; this is deliberately not the gameplay operation
mix or its usual tier configuration.

Candidate wins 6/8 pairs. The median of the eight paired time reductions,
`100 * (1 - candidate_ms/control_ms)`, is **4.685%**. Separately pooling each
variant's times gives medians of 196.414 ms control and 199.844 ms candidate,
or **1.746% slower** for the candidate. These summarize different things and
must not be substituted for one another. The full 152–601 ms range and
contradictory direction of the summaries leave the result inconclusive;
no confidence interval or stable speedup was established.

The revert keeps the release candidate on the previously tested execution
shape while measurements remain uncertain. It is not evidence that the change
is incorrect or slower. A jump table removes comparisons but can introduce
an indexed indirect branch and enlarge code; it is not strictly less work on
every engine. Correctness passed, and the preserved candidate remains suitable
for further measurement. The current evidence does not justify claiming a
gameplay FPS improvement. The separately requested wasm3 measurement below
also does not establish an interpreter improvement.

### wasm3 arithmetic-dispatch microbenchmark (2026-11-05)

Evidence: `20261105-uplink-wasm3`, Homebrew wasm3 0.5.0 on ARM64. Loading the
complete emulator fails with `unknown value_type`; this is not a demonstration
of full Wine-Assembly compatibility with wasm3. The benchmark instead extracts
the exact control/candidate `$x87_island_fast` bodies with `fpu_mul`, `gl64`,
`gs64`, `page_watch_cell`, `page_watch_write_one` and the required macros.
`control-scope.json` and `candidate-scope.json` record kernel hashes and scope.

The standalone kernel uses 256 KiB unshared memory and synthetic addresses;
the direct-window bound becomes that memory size. Atomic reads become ordinary
reads for the empty, single-thread observer table. Uncalled helpers trap so an
unexpected path cannot silently produce a result. A direct island loop omits
the guest x86 decoding and loop-control overhead present in the Node benchmark.
It uses the same six operations and 3.25 result. Node and wasm3 checks pass for
the result, x87 top/tags and island count. These adaptations limit the result
to this exercised arithmetic path, not general FP semantics or gameplay.

Eight alternating AB/BA pairs run 3,000,000 islands each (18,000,000 x87
operations per timed process), following 100,000-island warmup runs per arm.
`/usr/bin/time -p` measures whole-process wall and user/system time, including
startup, at 0.01-second precision. CPU time is user plus system time. The raw
rows and summaries are retained in `timings.json`:

| Metric | Control pooled median | Candidate pooled median | Median paired time reduction | Candidate wins |
| --- | --- | --- | --- | --- |
| CPU time | 3.585 s | 3.555 s | -0.569% (slower) | 4/8 |
| Wall time | 5.995 s | 5.510 s | +0.040% (faster) | 4/8 |

The pooled CPU medians suggest a 0.84% reduction, but the paired summary has
the opposite direction. Similarly, the pooled wall medians must not become
an 8% speedup claim: their paired median is almost unchanged. This run finds
no reliable interpreter gain and no established regression. The dispatch
variant remains reverted; no runtime source changes result from this test.

### Evidence and release handoff (2026-11-05)

All run IDs below refer to repository-root `scratch/runs/`; the implementation
worktree's scratch directory is not the evidence root. Keep the saved source
patch, module hash, harness and environment alongside the result: recent
gameplay profiles include the dirty startup candidate, so they are not proof
that an otherwise clean release build has been tested.

| Evidence runs | Supported finding | Limit |
| --- | --- | --- |
| `20261104-uplink-resolution-{640,1024}-repeat` | Same-view resolution dependence and unnecessary NC readback identified | Guest presents/s, not unique displayed frames |
| `20261104-uplink-empty-nc-1024` | Per-frame readback/merge removed; fix committed in f6a667094 | Host load prevents a matched FPS claim |
| `20261105-uplink-uniform-{baseline,candidate}` | Uniform preparation self time/present reduced; JS fix committed in c84edcd8d | No stable aggregate FPS or GC reduction |
| `20261105-uplink-cpu-breakdown` | CPU emulation dominates sampled guest work | Self samples, not GPU timings or removable-overhead estimate |
| `20261105-uplink-hot-loops` | Stable guest regions and active FP/uop fast paths identified | Histogram changes execution; block shares are not CPU shares |
| `20261105-uplink-x87-dispatch-{control,candidate}` | Correct dispatch variant; native code and synthetic/gameplay comparisons retained | Variant reverted; performance unresolved |
| `20261105-uplink-wasm3` | Restricted exact-body arithmetic kernel passes checks; eight interpreter timing pairs retained | Full emulator cannot load; no reliable dispatch speedup |

Release preparation must preserve the outstanding distinction: the prior
committed module passed the renderer-switch sequence, while the later dirty
startup/ShowWindow candidate failed Video Modes navigation after the driver
advice popup. Do not silently include those unqualified edits or describe this
as a fully qualified release. Safari is intentionally excluded by the user.

### 2026-11-06: Android live gameplay CPU profile

Run `20261106-uplink-android-adb` controls the user's attached A142 Android
phone through ADB/Chrome CDP. Production build `422eba5a4+ 2026-11-06 04:57`,
native WASM SHA-256 `999a42bfe60981e6e40cb1f41d7f1b9676229eeb5552849fc7d58e521cd57e22`
was verified by fetching the page's exact versioned resource. Chrome
156.0.8078.79 / V8 15.6.75.27, OpenGL EngineType 2, 1024x768, WebGL host,
cross-origin-isolated Worker mode. New Game/Easy reached a textured corridor
and shaped HUD. A separate 27.76-second gameplay counter interval averaged
8.14 presents/s; scene/player movement was not fixed for this diagnostic.

`node scratch/android-profile-puppeteer.cjs` captured the page and three
Workers simultaneously at 1ms sampling for approximately 30 seconds. Direct
Target.attachToTarget Worker requests timed out; Puppeteer's existing Worker
clients succeeded. No game code or resolution was changed for profiling.

Main guest Worker sampled 17.93s in WASM, 2.49s in guest-rpc.js, 1.76s in
other code, 0.04s GC, and 7.98s idle. Leading WASM self samples mapped against
the matching release combined.wat: uop_fast 3.09s, branch_end_at 1.02s,
x87_island_fast 0.89s, win32_dispatch_inner 0.64s, th_load32_rop 0.52s,
run 0.43s, th_uop_enter 0.40s, th_fpu_mem_ro 0.38s, and
gl_finish_immediate 0.32s. RPC waitForResponse alone accounts for 1.18s;
sampled waits are not equivalent to CPU execution time.

Render Worker: 23.91s idle, 6.24s non-idle; flushPendingDraw self 1.78s,
bufferData 0.72s, command-stream replay 0.53s. Only 0.007s WASM was sampled
there, inconsistent with a dominant software-rasterization fallback. Page:
20.86s idle, 9.44s non-idle, including messaging and the enabled diagnostic
HUD. Secondary guest Worker was effectively entirely idle. CPU sampling does
not measure GPU execution, and non-idle samples may include native waits;
do not present these as GPU utilization or summed physical CPU percentages.
The strongest observed optimization target is guest instruction execution,
followed by RPC overhead and draw preparation; allocation/GC is minor here.

### 2026-11-06: repeated ShowWindow caller, Android and desktop

Live Android stack/byte capture identifies hldemo.exe 0x40b0bb calling
ShowWindow(gameplay HWND, SW_SHOW), returning to 0x40b0c1. It next calls
wrapper 0x45a54a with SW_HIDE; the wrapper calls ShowWindow at 0x45a558,
returning to 0x45a55e. The hide result reaches 0x40b0cc, which immediately
calls 0x40afd0 and tests that function's result, not either ShowWindow result.
Thus this pair is not a retry caused by an incorrect ShowWindow BOOL.
The emulator's show_window_result returns prior WS_VISIBLE for ordinary
ShowWindow; host_show_window's packed client size is an internal result.

Confirmed with headed local Chrome/Puppeteer, release 422eba5a4, isolated
guest Workers and OpenGL: 386 presents in 10.002 seconds, with exactly 386
SW_SHOW calls on the already-visible gameplay window and 386 SW_HIDE calls
on the already-hidden menu window. Caller return addresses match Android.
The menu also repeats a visibility pair (202 show-normal and 202 hide in
10 seconds), with the window roles reversed. Screenshot reviewed at the
textured initial corridor with HUD. Evidence:
scratch/runs/20261106-uplink-showwindow-local-isolated. The first nonisolated
run's fixed delays mislabeled intro/menu as menu/gameplay; exclude it from
gameplay claims. No runtime optimization applied by this investigation.

### Redundant ShowWindow host-call fix and frame-cost limits

The subsequent fix elides host_show_window for SW_HIDE with prior visibility
false, and SW_SHOW on an established active, visible, non-minimized top-level
window that does not replace a utility main. It does not return early from the guest handler: visibility bookkeeping,
paint, activation and prior-visibility BOOL paths remain. First show, other
windows and restoration retain the host call. Focused tests assert both elision
and preserved startup/restoration/activation/return behavior.

The Android RPC sample has a simultaneous denominator: 294 presents over
30.021545 seconds, or 102.114 ms/frame. Average blocking waits per frame:
render batches 4.906 ms; window rectangles 2.047; ShowWindow 1.930; mouse
0.994; network peek 0.788; control paint trace 0.386; invalidate 0.239;
foreground query 0.166; window info 0.159; audio 0.021. These sum to about
11.64 ms/frame. The remaining 90.48 ms is not all guest CPU: it includes
execution, scheduling, pacing and unmeasured waits. Render-worker work can
overlap these intervals; do not add its CPU samples to the frame wall time.

The separate earlier CPU profile had no simultaneous frame counter, so it
cannot provide exact CPU milliseconds per frame. Main guest samples were
59.4% WASM, 8.2% RPC JavaScript, 26.4% idle and roughly 6% other/GC; render
worker non-idle was 20.7% of its sampled interval. WASM includes API/graphics
handlers as well as x86 execution. GPU time was not captured. A fresh combined
Android profile/frame-count attempt was blocked by the phone disconnecting;
do not report a measured Android FPS improvement from this fix yet.

Final candidate local evidence: scratch/runs/20261106-uplink-showwindow-fixed-final,
headed Chrome, isolated Workers, integration 457f25f30 plus this patch, native
WASM e49dbb3241327a0fcf74da39af963355c3bc3379bba24796c02572303dfcf4ab.
Reviewed corridor/HUD screenshot; zero show_window host calls in 56 presents
over 10.000315 seconds. Six regression scripts pass (created-dialog/main
promotion including redundant-call cases, active-window, owned-form activation,
child size, secondary top-level size, and ShowWindowAsync); native/compat build
and gates pass. Removed the async test's duplicate test_get_last_error export;
the same helper already exists in src/13-exports.wat.

The profiled local integration run is much slower than the earlier release
run, so these are not matched performance A/B results. Its 178.58 ms/frame
sample-normalized main guest breakdown is approximately 40.2 ms WASM,
120.7 ms RPC JS (predominantly waitForResponse, including blocked time),
13.5 ms other JS/native and 4.2 ms idle. Render Worker non-idle corresponds
to about 83.1 ms/frame and page non-idle to 71.6 ms/frame, overlapping the
guest interval; neither may be added to it. Profiles slightly bracket the
frame-counter window, so these are sampled estimates, not exact timings.
Do not attribute the integration/release performance difference to this patch
without a matched control. Investigation of integration RPC/render scheduling
is a follow-up; this commit proves redundant call elimination, not an FPS gain.

### 2026-11-07: Android matched release-source ShowWindow comparison

ADB reconnected to A142, Chrome 157.0.8103.46 / V8 15.7.112.23. To avoid
confounding integration rendering changes, compiled two modules from release
422eba5a4 with test/compile-src.js: unchanged control e7135cb1dfd54a4bf1144a716265d3f10caab66355d302dd1f5e26713414fe1b,
and only the committed ShowWindow guard inserted, fixed fc9fa56ccc385e12015785e9c031c448541c8ff1c4f33e616d78d7e80cd1cb59.
Puppeteer served the selected module through request interception; all other
files were identical at localhost:52675 via adb reverse, isolated Workers,
OpenGL 1024x768. The old background production game was stopped before timing.
Reviewed screenshots show the same fresh-game corridor/camera and HUD.
Diagnostic graph remained enabled in all runs (start({draw:false}) alone did
not hide an already-running graph). Loading was excluded; 60-second samples:

| Run order | Presents | FPS | ShowWindow host calls/frame |
|---|---:|---:|---:|
| Control | 612 | 10.200 | 2 |
| Fixed | 555 | 9.250 | 0 |
| Control repeat | 541 | 9.016 | 2 |

Battery temperature rose from 35C before testing to 41C by the end of the
first control, and remained 41C at subsequent checks. Control drift exceeds
the expected small optimization benefit: no reliable FPS gain or regression
is established. The zero redundant host-call result is confirmed on Android.
An initial diagnostic timed out because its 30-second CDP timeout was shorter
than the 60-second sample; discarded, then remeasured the loaded control with
a 120-second timeout. This gave the first control additional warmup time.

A separate fixed-build CPU profile included simultaneous counters: 257 frames
in 30.011945 seconds (116.77 ms/frame, profiler enabled). Sample-normalized
main guest: 66.13 ms WASM, 9.21 ms RPC JS including waits, 7.04 ms other JS/native,
0.13 ms GC, 34.26 ms idle. Render Worker non-idle about 19.42 ms/frame, page
non-idle 39.24 ms/frame; these overlap guest time and must not be added to it.
GPU time is unknown. Native idle/wait samples are not physical CPU usage.
Evidence scratch/runs/20261107-uplink-android-showwindow includes both modules,
three run JSONs/screenshots and profile/window.json with the frame denominator.
Phone returned to fixed module after testing; production unchanged.

Proposed follow-up diagnostic: a null render backend behind the existing render
endpoint. Keep command generation, transport, queue ordering and completion
fences, omit draw/present execution. Readbacks and queries require explicit
semantics rather than arbitrary zero results. It measures the no-rendering
ceiling; it has not been implemented by this investigation.
