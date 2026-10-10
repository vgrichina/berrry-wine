# Crusaders of Might and Magic (demo)

3DO, 1999. Fixture: `test/binaries/win98-games-a-d/Crusaders MM demo-D3D`,
installed tree at `installed/` (`crusaders demo.exe`, `gfx_d3d.dll`,
`gfx_sw.dll`, `uz.dll` = Info-ZIP UnZip32 5.4, Miles `mss32.dll`;
data in `caps\`, `meshes\`, `models\`, `script\`, `textures\textures.zip`).
Image base `0x400000`, no relocations needed.

Registered as `crusaders_mm_demo`: exe `crusaders demo.exe`, the install
dir's `localFileManifest`, workingDirectory/exeGuestPath
`c:\program files\3do\crusaders of might and magic demo`. The manifest
predates a `tools/gen-win98-games-a-d-manifests.js` entry; adding one needs
a regenerate, which that tool refuses below 2 GiB of free disk.

## Route

At boot it asks "Use This DLL?" for `gfx_d3d.dll`, then `gfx_sw.dll`
(`MessageBoxA` MB_YESNO). `--input=20000:dlg-cmd:7,40000:dlg-cmd:6` picks the
software renderer. Title (any click) -> main menu (Play Game 132,175) ->
Play Game screen (New Game 158,115). Title and both menus render correctly
in software DirectDraw with its own drawn cursor.

New Game loads the level (~240k batches at the defaults) to the hero in a
stone corridor with HUD health 50 / mana 25. Held arrow keys play: Left turns
him (`keydown:37`, ~6000 batches, `keyup:37`), Up walks. Driven as a
frozen `--control` session with `tools/ctl.js` (step / click / cmd
keydown / png). Evidence: `scratch/runs/20261010T0145Z-crusaders_mm_demo-prototype-w6`.

## Fixed on the way (commit with this note)

- `VerQueryValueA` returned every ANSI string in one scratch slot. The game
  keeps `FileVersion`, queries `CompanyName`, then compares the first against
  "5.4" (`0x4cbf01`), so it read "Info-ZIP" and refused `uz.dll` ("has the
  wrong version number"). Each string now gets its own slot at half its
  UTF-16 offset.
- A fixed-address `MEM_RESERVE` past the image window (guest `0x04000000+`
  with image base `0x400000`) used to "succeed" with the literal address --
  which `$g2w` translates onto emulator tables (`$TITLE_TABLE` for
  `0x04000000`) -- or fail by accident. It now fails with
  `ERROR_INVALID_ADDRESS`, as Windows does for a range it cannot place.

## The fixed pools, and why the memory map has holes for them

`0x450ea0` reserves three pools at fixed addresses: `0x04000000` (512 KB),
`0x06000000` (0xEE1000) and `0x08000000` (1 MB), storing the results at
`[obj+0/0xc/0x18]`, then (`0x450fc0`) reserves AND commits a fourth,
`0x29040` bytes at `0x05000000` into `[esi+0x24]`, and exits(-1) quietly
if that one fails. They are not hints. The level files (`caps\CaDEMOa.cap`,
`meshes\CaDEMOa.msh`) are memory images whose embedded pointers are already
relocated to those bases: with the pools relocated into the sparse arena, the
command list at `0x58ca48` holds records like `0x0609c0e2` (= pool base
`0x06000000` + `0x9c0e2`), the texture-register caller at `0x4783ff` passes
records with a NULL name 49 times (`0x4c34f0` builds `"Textures\" + name`),
and the interpreter switch around `0x4787ae`-`0x478bac` finally calls
through a NULL vtable at `0x4cb57a` (record `0x0800e37d`, a pointer into the
`0x08000000` pool), batch ~435150 on the route above.

Guest `0x04000000`-`0x08100000` is inside the direct window, which used to
translate those four ranges onto emulator tables (window tables, the thread
cache, DX/GL tables). The fix is four `region.declare-derived`
`$GUEST_FIXED_POOL_*` holes at `(g2w 0x04000000/0x05000000/0x06000000/0x08000000)`
in `src/00-regions.wat`, so those addresses are plain guest memory through the
existing one-compare `g2w` fast path, and `VirtualAlloc` returns a fixed
request wholly inside a hole (`$guest_fixed_pool_of`). Room came from pinning
`$THREAD_CACHE_BASE` at `0x1A000000`, in a tail carved from the sparse pool
(316 -> 288 MB for every app). A 42-app coop/threads crash sweep found no
regression: `scratch/runs/20261010T0155Z-crusaders-pool-sweep-w6`. Rejected:
an app-scoped mutable `g2w-fast` bound (a global load in every translation for
every app, plus Crusaders' heap/stack on the slow path). None of the pools
overlaps the heap (`0x04100000`), stack (`0x07400000`) or thunks (`0x07500000`).

Unrelated noise seen: `\\.\ramlockC.vxd` CreateFile fails (it falls back);
loose `Textures\*.tga` misses are normal, it then reads `textures.zip`.
