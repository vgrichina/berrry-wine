# Dethkarz demo (Beam Software / Melbourne House, Infogrames 1998, Direct3D)

App id `dethkarz_demo`, candidate `dethkarz-demo` (registered 2026-10-11, w5).
Evidence: `scratch/runs/20261011T0750Z-dethkarz_demo-race-w5/`.

## Source and licence

- archive.org item `DETHKARZ`, `DETHKARZ.zip`: 17,402,067 bytes, SHA-1
  `b43457dfe3d18a25822c5048b735d4570ea476ac`.
- The zip holds an InstallShield 5 setup. `unshield` extracts three groups:
  - "Dethkarz Main Files": `Dethkarz.exe`, `IFORCE2.DLL`, the `.ifr` force
    profiles and `Device Libraries\`;
  - "Data";
  - "GOB File": `Dethkarz.zip`, the game archive (GOB).
- **No licence grant.** `City Demo Readme.txt` gives only the story and
  controls. The exe and setup state no redistribution terms. The candidate is
  `localOnly`.

## Layout the game needs

- **`Install Path`.** `HKLM\Software\Melbourne House\Dethkarz` must hold
  `Install Path`. The game opens `<drive>:\Data\Dethkarz.zip` from it.
  - Unset, it fails with `Failed to load GOB @:\Data\Dethkarz.zip`.
  - The registration writes `C:\Dethkarz`, and the GOB goes in
    `installed/dethkarz/Data`.
- **Renderer DLLs.** Renderers are found with
  `FindFirstFileA(".\Device Libraries\*.dll")`.
  - The folder name has a space. `unshield` writes it as `Device_Libraries`,
    so the candidate copies it back as `Device Libraries`.
  - With only `Device_Libraries`, the game fails with MessageBox `002 - No
    valid graphics drivers were found`.
  - The folder holds `Vertigo Direct3D.dll` and
    `Vertigo 3Dfx (Glide 2).dll`.

## Startup driver dialog

- `DialogBoxIndirectParamA` (DlgProc `0x402be0`) offers "3Dfx Voodoo Native
  Driver" first and "Microsoft Direct3D Hardware Driver" second.
  - Picking Direct3D shows a "Direct3D Device" combo: Primary Display Driver.
  - The mode is 640x480x16.
- **Glide is the default, and it dies.** OK on the default crashes in
  `_grTexDetailControl@16` (unimplemented in `09a8h-glide.wat`), called with
  tmu 0, lodBias 4, detailScale 6 and detailMax 1.0.
  - Detail-texture combine factors are an explicit backend limitation there.
  - Pick Direct3D. In the browser, that means choosing it in the dropdown.
- **Main wndproc `0x49e0c0`.** Its WM_SIZE arm (around `0x49e1d8`) maps
  wParam onto ShowWindow:
  - SIZE_RESTORED → SW_RESTORE;
  - SIZE_MINIMIZED → SW_MINIMIZE;
  - SIZE_MAXIMIZED → SW_SHOWMAXIMIZED.
  
  It then calls `InvalidateRect` and `UpdateWindow`.
  - Before this registration, our ShowWindow(SW_SHOWMAXIMIZED) on an
    already-maximized main window re-posted WM_MOVE/WM_SIZE (and an extra
    WM_SHOWWINDOW). That made an endless loop.
  - The post queue drains before host input, so the modal dialog never saw
    another click. The dropdown opened but no item could be picked
    (`before-fix-dropdown-stuck.png`).
  - Fixed in `$handle_ShowWindow`: WM_SHOWWINDOW is sent only on a visibility
    change, and an already-visible zoomed window gets no resize pair.

## Headless route (CLI, `--batch-size=200000`)

1. Pick Direct3D with mouse down and up:
   - combo arrow at (494,198), batches 300/303;
   - "Microsoft Direct3D" item at (300,236), batches 320/323;
   - OK at (243,288), batches 340/343.
2. Title "PRESS ENTER" by batch 1000. Send Enter (keydown plus
   `di-keydown:13`) at batches 1000, 1150, 1300, 1450, 1600 and 1750:
   - Game Select → Arcade;
   - Car Select (Hyperon Alpha "Arrow"; Begin Race);
   - Metro City (Medium) loading;
   - grid.
3. Camera flyby until "GO" at about batch 3200.
4. Up (`di-keydown:38` plus keydown) held from before GO does nothing. Release
   it and press it again after GO (batches 3240/3250).
   - The car reaches 111 km/h in gear 2 by batch 3400.
   - It reaches 219 km/h in gear 3 and position 19/20 by batch 3700.

Route script: `route.sh` in the evidence folder. With threads off the run is
about 36 s of wall time for 3900 batches.

## Phone route (WebKit, iPhone 15 landscape, Threads on)

- The driver dialog is drawn zoomed to the phone width. Real taps work on it:
  the combo arrow, then "Microsoft Direct3D Hardware Driver", then OK.
- The menus read Enter through `GetDeviceState`, not through messages. An
  overlay Enter whose keydown and keyup came in one JS turn was never seen;
  6d595095a holds every overlay key for at least 100 ms.
- The overlay's Esc/Enter (top left) sit under the "swipe up here for more
  screen" gutter until Safari's bars collapse (MOBILE-GUTTER-COVERS-TL-CONTROLS).
- Race: Gas held 113 km/h, stick steers, Brake, Esc pauses. Evidence:
  `scratch/runs/20261011T1330Z-dethkarz_demo-mobile-webkit-w5`.

## Native Shift firing response (2026-11-01)

Evidence: `scratch/runs/20261101-dethkarz-native-fire-control/` (including
`run2/`). **Visible firing is confirmed with ordinary Shift input in the
original local Direct3D Arcade race.** The requested narrower claim of
DirectInput **keyboard** consumption is not established: the observed Shift
reader is `GetAsyncKeyState`, while the traced DirectInput state reads are
for the mouse.

- The installed `City Demo Readme.txt` says `FIRE GUN - Shift`,
  `CHARGE GUN - Hold Shift`, and `REAR VIEW - Ctrl`. Ctrl was historical
  speculation, not an alternate fire key. Car Select shows the stock
  Hyperon Alpha "Arrow", automatic transmission, and **Pulse Laser**.
  No pickup, ammo/state write, configuration fabrication, or controller
  remapping was needed.
- Selected **Microsoft Direct3D Hardware Driver / Primary Display Driver /
  640 x 480 x 16** in the stock dialog (`direct3d-selected.png`). Used the
  registered install registry and original manifest. Four ordinary Enter
  press/release pairs at batches 1000, 1150, 1300 and 1450 reached Arcade,
  Course Select, Car Select and Begin Race; the race was active by 3350.
  No accelerator or steering input was sent in these runs.
- First original: `race-before.png` at 3350 has no player muzzle effect and
  a blue weapon bar. Shift down (`keydown:16` plus `di-keydown:16`) followed
  by ten batches gives `shift-held10.png`: a bright white/yellow flash and
  blue/green bolt immediately ahead of the player car, with the weapon bar
  emptied. At 3400 the effect has moved down the road; after ordinary Shift
  release, `shift-released16.png` at 3416 has no near-car flash. Other cars
  and the lap timer continue animating, so frame differences alone are not
  the evidence. The player-aligned effect and weapon-bar response are.
- Second and final original tested the concrete input-path hypothesis:
  keyboard firing polls `GetAsyncKeyState`, rather than a DirectInput
  keyboard buffer. The first run's short `GetDeviceState` API filter matched
  no records, so this run used exact API names and paused tracing outside
  the short trials. `run2/control-before.png` (3360),
  `di-shift-held10.png` (3370), and `di-shift-released20.png` (3390) show the
  same firing effect with **state-only** `di-keydown:16`/`di-keyup:16`, and
  unchanged WM counters. That harness action feeds the shared keyboard
  polling state; its name is not proof that the guest used DirectInput.
- The ordinary combined WM/state trial is paired in `run2/wm-before.png`
  (3590), `wm-shift-held10.png` (3600), `wm-shift-released20.png` (3620), and
  `wm-settled60.png` (3660). Reviewed images show a new flash/bolt beside the
  player and a blue weapon-bar reduction, then the bolt farther ahead and
  finally no visible bolt. The car remains in neutral at 2–3 km/h; no
  throttle was held. This establishes firing response, not a hit or damage.
- `input-consumption.json`, `state-*.json`, the NDJSON command/response
  records, and streamed `runtime.log.gz` preserve actual consumption.
  Combined-trial dequeue/route/DispatchMessage counters progress
  **11/11/8 → 12/12/9 → 13/13/10**. Last records are Shift
  `WM_KEYDOWN`/`WM_KEYUP` (`0x100`/`0x101`, wParam `0x10`) delivered to HWND
  `0x10001`; known input queues are empty after release. The first run also
  records both edges; its one-batch release capture still had WM_KEYUP
  pending, which was consumed by the later capture.
- Actual `GetAsyncKeyState(0x10)` calls return to original VA `0x4a819d`:
  **0 → 0x8001 → 0x8000 → 0** across the state-only trial, and
  **0x8001 → 0x8000 → 0** across the combined trial. These are guest API
  calls and return values, not merely injected or queued events. Twenty
  traced `IDirectInputDevice_GetDeviceState` calls instead request 16 bytes
  at `0x074fee3c`, returning to `0x4a8c22` (mouse path). There are no traced
  keyboard `GetDeviceState`/`GetDeviceData` records in those windows, and
  the renderer's keyboard-buffer client set was absent. Thus the precise
  limitation on the requested Shift DirectInput proof is the observed
  original keyboard API path, not a swallowed Shift or absent weapon.

Identity and bounds: predecessor MDK2's fresh terminal artifacts and explicit
09:57:24 UTC runtime/source/build release were verified before the 09:58:14
gate; actual baseline `f0eda338f29a84929075fc90d26c4b4465ee2356`.
Original `Dethkarz.exe` SHA-256
`2a18a5cff1807b457a6e043e0c4e18368c66a598819927bc6f54ba5e18b8de41`,
manifest SHA-256
`94b221e38cf7022177ebc514628186462d8fe15baa4e16a091c6d9225f3d248d`;
all 15 files in the original candidate tree and 4444 source/build identity
entries matched before/after. Reused accepted module
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`:
4392 accepted inputs and 141 retained actual build reads matched, with no
rebuild or tracked code/helper/configuration change. Each original recorded
128 actual file-read identities, all matching local bytes, including the
EXE, manifest, GOB, Direct3D DLL and sound archive. Discovery also read the
Glide DLL; the selected renderer was Direct3D, not the Glide detail path.

Retained observer helpers passed actual synchronous and asynchronous WASM
execution with whole 512 MB shared-memory hashes unchanged, host/native clock
identity unchanged, and emitted late event 10001 retained in a 64-event tail.
Observation covers synchronous whole-file reads and completed descriptor
reads up to 24 MiB; async/stream/mmap and loader-internal reads are not covered.
Read records flush at process exit. A WASM compilation/hash observation does
not prove compiler source reads. Input-state still reports guest-post-queue
and button-count coverage as unknown and has no exact event correlation.

Both originals exited 0 after 192.197 s and 80.305 s; minimum free disk was
2,216,583,168 and 2,159,755,264 bytes respectively. Local native only;
box ID/state/expiry N/A. No impact, damage, combat outcome, charged-shot
mechanics, FPS, audio, browser/GPU, or broader playability qualification is
claimed.

## Open

- Glide path: `grTexDetailControl` and the detail combine factor.
- DirectInput keyboard-specific Shift consumption remains unproved; visible
  Shift firing and consumed WM/`GetAsyncKeyState` polling are confirmed above.
- `ole32.dll` is reported as "loaded as a real PE but is not on disk" on a
  fresh checkout. That is harmless here.
