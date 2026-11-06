# Enigma 1.01 (SDL 1.2 + embedded Lua)

App summary. The dated `enigma-*-2026102x.md` files beside this one hold the
full investigations and their evidence. Enigma is **not registered** in
`lib/apps.js`. Every run below is a diagnostic route on a historical module,
not a current-main or gameplay claim.

## Binaries and route

- The shipped Windows build packs all ten PE modules with UPX. Authentic
  `upx -d` output recovers 849 imports over 40 module edges. The packed tables
  show only 81. See `enigma-authentic-static-unpack-20261024.md`. The working
  route runs those unpacked diagnostic modules, never the packed originals.
- Asset tree: 2460 files. Mount it with one `--vfs-tree`. Per-file comma mounts
  are wrong for this tree.
- Use the native providers, listed with `--dlls`, in dependency order:
  `msvcrt, zlib1, libpng12-0, SDL, SDL_image, SDL_mixer, libfreetype-6, SDL_ttf`.
  With `--dlls=msvcrt.dll` alone, SDL is never preloaded. The first SDL import
  then hits the built-in stub (`SDL_getenv("SDL_STDIO_REDIRECT")`, EIP
  `0x5de8e0`, IAT `0x9ef7bc`). That is a configuration error, not a missing
  emulator API. `--dlls` replaces automatic `resolveDllGraph`.
- `jpeg.dll`, `mikmod.dll` and `loadall.dll` are optional or conditional. None
  is proven necessary.
- Lua C-module loading is `package.loadlib` and the cpath searchers. Its
  `LoadLibraryA` call is at `0x5ab960`, in the function at `0x5ab8f0`. The
  default cpath is `.\?.dll;!\?.dll;!\loadall.dll`. See
  `enigma-register-load-cause-20261024.md`.

## Startup progression (Oct 24–26)

(Recovered from unmerged branches `task/enigma-*-oct26`, Oct 2026.)

- With the eight providers, startup passes SDL init. It creates the `SDL_app`
  window and reads `compat.lua`, `startup.lua`, `enigma_conf.lua` and model
  scripts. No crash, unimplemented API or Lua error appeared.
- `data/enigma_conf.lua` is a **zero-byte** file. A staging step that skips
  empty files breaks the tree.
- Filesystem logging is very verbose. A 131072-byte output guard hit while the
  game was still reading `data/gfx32/*.png`. That was a harness limit, not a
  guest fault.
- At batch 30000, a lossless 640x480 frame showed the title, logo, marble
  background and **"Loading Enigma levels"**. That run reached batch 97160
  (4.19M API calls) in 55 s with no trap.
- The **Main Menu** (Start Game, Level Pack, Options, Credits, Quit) appears by
  about batch 120000–130000. A single frozen 100000-batch control step took
  longer than a 45 s response wait. Small steps of 256 batches or fewer were
  reliable. At about 20.5k batches the game was still loading assets.

## Start Game click does not transition (open)

- A click at screen (344,212), batch 120833, was delivered by the host. The
  trace shows `check_input` returning WM_NCHITTEST (0x84), WM_LBUTTONDOWN
  (0x201) and WM_LBUTTONUP (0x202) to HWND `0x10001`. Down/up lParam was
  `0x00a90141`, client (321,169).
- The screen-to-client offset is (23,43). That matches the decorated SDL window
  (style `0xca0000`). The client point still falls inside the Start Game item,
  so no coordinate bug is shown.
- Five seconds after the click, the frame was **byte-identical** to the menu.
  No gameplay was reached. Cause unknown.
- Hypothesis, unproven: `test/run.js` sets `renderer._buttonHoldFloorMs = -1`,
  so an ordinary `click` delivers down and up in the same batch. SDL apps that
  sample mouse state each frame (`SDL_GetMouseState`) rather than the event
  queue can miss such a press. Next steps:
  - Use separate `mousedown` and `mouseup` events with a gap of a few batches.
  - Add `--trace-input-dispatch --trace-mouse-state` to see whether SDL
    dequeues and dispatches the message.
