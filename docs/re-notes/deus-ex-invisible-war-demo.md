# Deus Ex: Invisible War demo

Original media: `test/binaries/win98-games-a-d/DeusEx Invisible War-D3D`.
All 16 local files (236357810 bytes) were hashed and transferred unchanged to
`bx_hx8msa33:/home/user/deusex-iw-media-20261010`. Source identity inventory:
`scratch/deusex-iw-20261010/selection.json` and the self-contained first run
`scratch/runs/20261010T1527Z-deusex-iw-startup/selection.json`.

InstallShield version 7 cabinets are readable by `tools/is-cab.js`.
Extraction verified MD5 and lengths for 816 entries. Descriptor 31,
`setup.skin`, failed verification: do not report a complete installer.
Conflicting setup resource filenames were preserved separately under
`.conflicting-entries/<index>/`; identical duplicates share a canonical file.
The receipt records every entry, conflict and failure. No installer or licence
dialog was answered.

The game executable `DX2.exe` is 6090752 bytes, SHA256
`da394a4b5eb6254d9bee648b4bb1bee557b516cca61bb24b55020d29bab72f46`.
Its direct imports are DInput8, D3D8, DSound and Windows APIs; no original
non-system DLL appears in its direct import list. Extracted files remain on
the boat at `/home/user/deusex-iw-extracted-20261010`. There is no local corpus
registration or public deployment.

## Reconstructed virtual layout

The archive directory tree is not the installed tree. The original
`Default.ini` refers to `..\Content\DX2`; EXE strings refer to
`..\System\Shaders`. Use `C:\System\DX2.exe`, working directory
`C:\System`, and these tested mounts:

- `DX2/*` -> `C:\Content\DX2\*`
- `Data/*` -> `C:\Data\*`
- Remaining canonical files -> `C:\System\*`

This is an investigation mapping, not proof of every install destination.
The startup probe mounts 808 canonical files eagerly; a required/lazy policy
is not yet qualified. Keep original config and executable bytes unchanged.

## Startup evidence, 2026-10-10

Browser: headless Chrome 151, default WebGL/guest Worker, 1000x800, no inputs.
Source `cedee9b54`; module SHA256
`c43dd314eb864e55c395c0617cfc89e51a018613e8ae3aba7f2c45fde58ea5e6`.

- `20261010T1527Z-deusex-iw-startup`: flat archive mounts reach a game window,
  then the generic “Flesh failed to initialize” message.
- `20261010T1530Z-deusex-iw-layout`: System/Content reconstruction reads the
  original configuration and many content files. File tracing identifies the
  missing `C:\Data\Normalize.dds`; it had been mounted under System/Data.
- `20261010T1532Z-deusex-iw-data-root`: corrected Data mount reads the entire
  original texture (1572992 bytes), then immediately shows the same error.
  Browser closed normally at 15:34:19Z.

`Data/normalize.dds` SHA256 is
`d2a3eec5d57593fe5ee5bd840d71cca958826f4813908689e7ea5e0bb708f27d`.
Its DDS header reports 256x256, 32-bit RGB, caps `0x1008`, caps2 `0xFE00`
(cubemap/all faces), and no mip count. The failed texture lookup is resolved;
do not repeat downloads or infer a missing texture from the generic message.
No menu, player-controlled gameplay, audio or FPS is qualified.

## Cubemap format negotiation identified

`20261010T1539Z-deusex-iw-d3d-trace` uses the same source, module and original
files, with the existing D3D API and filesystem traces enabled. It closes
normally at 15:40:49Z with no browser errors. After reading Normalize.dds,
the guest calls GetDirect3D, GetDeviceCaps and GetDisplayMode, then makes
43 CheckDeviceFormat calls: adapter 0, HAL, adapter format 22, usage 0,
resource type 5 (CUBETEXTURE), with candidate formats including 21 and 22.
Every call has guest return address `0x007fd881`. The trace's `ret=` field
is the caller address, **not an HRESULT**.

The exact tested `handle_IDirect3D8_CheckDeviceFormat` only accepts ordinary
textures (type 3) and supported target/depth surfaces (type 1). Therefore
all these type-5 queries return D3DERR_NOTAVAILABLE (`0x8876086a`). This is
established by the handler and captured arguments, not a dynamic HRESULT
capture. The guest releases IDirect3D8 at return address `0x007fd8ce` and
shows the initialization error. It never calls CreateCubeTexture.

The current rejection is honest: Device8_CreateCubeTexture is fail-fast,
and the D3D8 caps deliberately omit cubemaps. The next implementation must
provide the real D3D8 cube interface and storage before advertising support.
D3D9 already has cube allocation, face/mip storage and sampling, but its
vtable cannot be reused directly: D3D8's base texture omits three D3D9
methods, and its surface descriptor layout differs. Cover the D3D8 ABI,
face/level locks and surfaces, lifetime, format/create agreement, and a
rendered cube sample; then repeat this original startup route. Do not patch
the guest, change the DDS, or return success just to bypass negotiation.

## D3D8 cube implementation validation

The candidate adds a separate 19-slot CubeTexture8 interface over the shared
cube storage. It adapts surface descriptors, preserves Cube8 identity through
QueryInterface/GetContainer, and exposes cube formats and mip/filter caps.
Unsupported private-data methods retain the existing fail-fast behavior.
ABI references: [Wine's D3D8 interface declarations](https://raw.githubusercontent.com/wine-mirror/wine/master/include/d3d8.h)
and [D3D8 capability definitions](https://raw.githubusercontent.com/wine-mirror/wine/master/include/d3d8caps.h).

`test/test-d3d8-cube-texture.js` fails on the baseline's cube-format rejection.
The candidate passes calls through actual generated COM slots, exact stdcall
cleanup, all six faces and three levels for ARGB/XRGB/DXT1/DXT5, descriptor
sizes, shared surface locks, interface identity, and retained parent lifetime.
Existing D3D9 cube and D3D8 16-bit regressions and the full build pass too.
The shared sampler's separate WebGL1/2 test passes 48 face/stage/vertex-linkage
cases; this is renderer coverage, not evidence of Invisible War gameplay.
Validation logs are retained with the candidate's browser run.

`20261010T1552Z-deusex-iw-cube` proves the original game advances past the
format rejection: it creates a 256x256 XRGB cube, obtains each of its six
surfaces, calls GetDesc/LockRect/UnlockRect/Release for every face, loads the
next 2D texture, and sets both texture priorities. The same generic dialog
then appears after GetDeviceCaps returns to `0x004b7496`. Browser closure
is normal at 15:54:03Z; the final screenshot still shows the startup error.

Disassembly retained in `next-caps-disassembly.txt` shows the next checks:
TextureCaps bits `0x800` and `0x400`, then PixelShaderVersion at caps+`0xcc`
must be at least `0xffff0101` (ps_1_1). The candidate supplies the texture
bits but truthfully reports zero for D3D8 programmable pixel shaders.
Implement the real D3D8 shader handle/create/bind/delete/constants path
before changing that capability; do not fake the version to skip this check.
This is progress through initialization, not a playable-game claim.

## Pixel-shader handle adapter

The candidate uses a device-owned handle table over the shared shader objects,
with an internal reference for each live handle. Creating a handle does not
leave a COM reference retaining the device. GetPixelShader returns the DWORD
without AddRef; DeletePixelShader invalidates the handle and unbinds it when
current. Captured state blocks retain the bytecode independently. Tombstone
identities survive until device destruction so restoring captured state can
report the old handle without making that handle valid again for Set/Delete.
The final device release retires undeleted handles as well as ordinary binds.
These semantics follow [Wine's D3D8 device implementation](https://raw.githubusercontent.com/wine-mirror/wine/master/dlls/d3d8/device.c).

The implementation delegates bytecode validation, retained IR, constants and
execution to the shared backend, including main's `eaf7d0316` create/draw
validation repair. D3D8 now reports ps_1_4 and MaxPixelShaderValue 8, backed by
the real create/bind/delete/function/constant paths, rather than just changing
the capability check. Vertex shader support is still not advertised.

The baseline traps at CreatePixelShader in the new handle regression. The
candidate passes invalid/deleted/foreign handles, immutable bytecode, constant
round-trips, Get without retaining, captured-state restoration and final
device cleanup. D3D8-created/bound retained IR renders 16 expected-color
frames across ps_1_1..1_4 and WebGL1/2. Shared shader lifetime and cube tests
pass, as do 15 PS1.4 software/WebGL differential frames and the full build.
The quiet-handler ratchet removes only the old SetPixelShader constant-return
handler (242 -> 241); no new quiet handler is introduced.

`20261010T1611Z-deusex-iw-pixel` reaches the Eidos intro and then the game's
branded loading screen using original files and no inputs. The reviewed final
capture is a loading screen, not a menu or gameplay. Chrome exits normally
at 16:13:15Z, with no page errors. The trace records 54 CreatePixelShader calls
before its 12000-line cap fills during Bink video reads; it cannot establish
what happens later. Follow up with a longer ordinary-input route and narrower
tracing. The actual browser source is `eaf7d0316` plus the retained candidate
patch, not the later merged source. Audio and FPS remain unqualified.
