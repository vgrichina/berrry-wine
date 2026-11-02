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

## Ordinary browser gameplay verified, 2026-11-02

One original invocation of the registered `crusaders_mm_demo` app reached
controllable corridor gameplay in a visible, headful browser. The ordinary
`?candidates&app=crusaders_mm_demo&no-log` route used the unchanged installed
fixture, manifest and registered defaults. At the visible native “Use This
DLL?” prompt for `gfx_d3d.dll`, the focused **Yes** button was clicked. No
software-DLL prompt followed. Title click -> Play Game -> New Game, retaining
the default Knight difficulty, reached the stone corridor; the settled HUD
read health 50 / mana 25. This run selected the **D3D guest DLL**, with the
host's default WebGL renderer. The historical CLI software route above is a
separate observation; this run establishes no both-backend parity.

Personally reviewed full-page and present-canvas captures show the hero's
heading and corridor view changing during held Left, followed by held Up
movement toward the wall. A short Left alignment exposed the corridor's
arches, then another held Up moved the hero alongside the wall toward its
decorative panel. Before, held, released and later settled captures preserve
these changes. Native keydown-to-keyup durations were 977 ms Left, 2275 ms Up,
202 ms Left, and 1753 ms Up (requested 700/2000/200/1500 ms; held-capture
overhead accounts for the longer observed holds). All 20 browser input events
were trusted, with four balanced click pairs and four balanced key pairs.
Consumed key releases followed browser keyup by 10/39/51/15 ms. Final input
inspection found an empty queue, no active input, both physical/asynchronous
arrow states false, and zero mouse buttons; the later neutral capture retained
the final location.

The final camera is very close to the ornamented wall, with an overhang
obscuring the upper scene and a leaning/raised-knee pose persisting after
release. The bounded result proves menu access, turning and movement in this
corridor; it does not establish general rendering/animation correctness,
FPS, audio, combat or full-game completion. No guest files, registered
defaults, renderer settings, guest state or clocks were altered, and no
recovery download or second original invocation was used.

Evidence: `scratch/runs/20261102-crusaders-native-browser/`, particularly
`review.json`, `retrieved/native-input.json`, `retrieved/input-state.jsonl`,
`retrieved/09-corridor-before{,-canvas}.png`, the held/released/settled pairs
for `10-left-turn`, `11-forward-movement` and `13-corridor-forward`, and
`retrieved/14-final-neutral{,-canvas}.png`. All 53 PNGs passed chunk CRC checks;
777 served-file receipts matched immutable pins. The actual gameplay page's
Wasm response was SHA-256
`307168f9e0475fd3c10f87cbc5d98f05006c6d4494d2f564381a9a0ebe289fe6`
(2,071,475 bytes). All 3,936 accepted locked-build inputs were refreshed before
execution and checked afterward, along with exact source/compiler snapshots,
`src/api_table.json`, module, installed manifest and all 358 fixture files.
The coordinator's root observed-file hashes establish local identity, not
upstream provenance. This docs-only run reused the matching accepted locked
build; it made no production changes or new build.

Immutable transfer member checks and independent SHA verification of all 123
retrieved evidence files preceded explicitly delegated shutdown of boat
`bx_226wj2x7`. Its original expiry was `2026-11-02T19:30:06.449Z`, recorded
before use; STOPPED was confirmed at `2026-11-02T18:38:31.947Z`, with scoped
remote helpers/profile absent. Controller and Chrome exited 0. The local
launch wrapper and original messageboard watcher returned 143 without an
intentional stop or a saved wrapper terminal status; the cause and remote
supervisor's raw exit status remain unknown. This monitoring limitation is
preserved rather than inferred away. The independent live disk guard stayed
running throughout transfer/runtime/retrieval, with no observed floor breach.
