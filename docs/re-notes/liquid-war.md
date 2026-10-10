# Liquid War 5.6.2

Binary: `test/binaries/candidates/liquid-war/LW5/lwwin.exe`, image base
`0x00400000`.

## DirectDraw startup across guest threads

Liquid War creates its only window (`hwnd 0x18001` cooperatively, `0x20001`
with real Workers) on Allegro thread T1. Video-mode selection later runs on the
main guest thread. Allegro bridges the two with a synchronous private window
message:

- `0x00445f60` calls `SendMessageA(hwnd, 0x004bbfa4, callback, 0)`.
- Its callback at `0x0045d470` invokes `IDirectDraw2::SetCooperativeLevel` and
  the mode-selection operations on the HWND owner thread.
- `0x0045d390` treats a zero/failed callback result as an unavailable mode, so
  all fullscreen and windowed candidates eventually become “Unable to
  initialize graphics.”

Before cross-thread `SendMessageA` routing, the callback happened to execute on
the caller's WebAssembly instance. Correct owner-thread routing exposed that
DirectDraw's display width, height, depth, selected-mode flag, cooperative HWND,
exclusive flag, and primary palette were mutable WebAssembly globals. Each guest
thread has a separate instance, so T1 successfully selected 640x480x8 while the
main thread still observed its private 640x480x16 defaults and rejected the
driver.

Those fields now live in the atomic shared-memory `DX_PROCESS_STATE` record.
The window callback therefore retains Win32 thread affinity while subsequent
DirectDraw calls and `GetSystemMetrics` see the same process device state.
`test/test-cross-thread-send.js` writes the record from a real owner Worker and
asserts that a peer instance reads every field.

Acceptance on 2026-08-26:

- `test/test-liquid-war-candidate.js`: 640x480 textured menu, 63 colors, packed
  data/custom assets loaded, and fullscreen `DirectDraw accel` mode succeeds.
- Node `--threads`: three guest threads in Workers, live 640x480x8 primary with
  59 sampled colors, and the same textured menu.
- Isolated Chrome Worker backend: status reports `3 threads in workers`; the
  visible `Liquid War 5.6.2` window reaches the textured Play/Map/Options menu
  without compatibility errors. Diagnostic screenshot:
  `/private/tmp/lw-browser-worker-fixed.png`.

Acceptance update on 2026-09-01:

- `__p___initenv` is now an MSVCRT cdecl alias for the same narrow environment
  vector as `__p__environ`; the original server no longer stops during CRT
  startup.
- `strncat` is implemented as a bounded cdecl append helper; the original
  client no longer stops after the network connect path starts.
- `test/test-liquid-war-candidate.js` now drives the highlighted Play item with
  Enter and captures a single-player arena frame at batch 65000. The current
  proof frame is 640x480 with the expected red/yellow teams, blue map, white
  walls, and timer. Ad-hoc screenshot:
  `/private/tmp/lw-single3-65000.png`.

## Network startup

- The executable imports MSVCRT `_beginthread` through IAT VA `0x0046e114`.
  `node tools/xrefs.js .../lwwin.exe 0x46e114 --code` finds its five call sites.
- MSVCRT's runtime `CreateThread` entry is always its wrapper. In the on-disk
  `test/binaries/dlls/msvcrt.dll`, original VA `0x7800b93e` calls the real
  routine stored at private-block offset `+0x48` with the argument at `+0x4c`.
  This was obtained with `tools/disasm_fn.js` after translating the traced
  runtime VA by the DLL load delta.
- The network retry worker's real entry is `0x00414d40`. It calls
  `0x00419090`, which creates a TCP socket, binds it, connects it, applies
  socket options, and enables `FIONBIO`. Its argument structure contains the
  server address inline at `+0x04` and the port at `+0x14`.
- `0x00414c50` allocates that structure, starts the worker through
  `0x0041aeb0`, waits on status at `+0x18`, and reads the result at `+0x24`.

## Single-player control A/B and frame counter (2026-10-10)

At `--batch-size=100000 --tick-ms-per-batch=20 --thread-slices=4` the main menu
(Play highlighted) is up by batch 1760. Enter at 1761 (`keydown:13`, then
`di-keyup:13` + `keyup:13`) gives the arena by 1963. Capture it with
`png-pixels`: the default `--png` shows the empty desktop for this app.

**Steering is proven by A/B, not by a before/after pair.** The arena simulates
on its own, so a single capture pair cannot tell input from autonomy (the
2026-10-03 limit). Two runs of one command differ only in a held Right
(`keydown:39` + `di-keydown:205`, batches 2000-2250):
- with the hold, the red cursor goes from about (125,120) to (215,100) and the
  red army stretches after it;
- without it, the cursor stays put.

Menu and arena captures are byte-identical between the runs, and the
difference grows only while the key is held.

**Frame counter.** One frame is one `Lock` (returns to `0x45d5d2`) / `Unlock`
(returns to `0x45d7cf`) of surface `0x08011038`. That gives 186 over batches
2000-2400, and present-distinct (slot 7) counts the same 186, which is
**23.3 frames per guest-second**. At a 10 ms tick with the same guest-time
schedule: 183 over 7.85 guest-s, 23.2/s. So the rate is the game's own pace.
Evidence: `scratch/runs/20261010T0610Z-liquid_war-control-frames`.

## Ruled out

The short-lived thread stream seen after entering Net game is not a thread
scheduler failure. It is Liquid War retrying `127.0.0.1:8035` after a queued
Enter remains logically down across the transition to the network-settings
menu and activates Start game there too. Loopback is deliberately local to one
emulator process, so that address cannot reach the separate server process.

For headless input, a one-batch `keydown` followed by `di-keyup` releases the
DirectInput state without leaving a delayed `WM_KEYUP`. This reaches the
settings screen, where the room host address can be entered before Start game —
`10.0.0.1`, or the short form `10.1`, which `$vsock_parse_ipv4` widens the same
way real Winsock does, so there is less to type into a guest menu. The fixed
reproduction is encoded in `test/test-vlan-match.js`.

The current two-process path reaches the waiting room with the player listed,
and the server accepts and exchanges protocol bytes. It has not yet been
promoted to a gameplay test because the lobby's "Start now"/"Play" activation
still needs a reliable headless route.
