# Midtown Madness Trial (Angel Studios / Microsoft, 1999)

App id `midtown_madness_trial`; candidate `midtown-madness-trial` in
`test/candidate-corpus/manifest.json`. Direct3D (IDirect3D3/Device3) city
racer, trial build with one Chicago race.

## Licence

The Microsoft trial EULA (`EULA.RTF`, inside the package) allows
non-commercial redistribution of complete copies, with notices and the EULA
attached. It is still registered `localOnly` until someone decides on
deployment.

## Install layout

`MMDemo.zip` (archive.org `MidtownMadness_1020`) holds `MMDemo.exe`, a
self-extractor whose `.rsrc/CABFILE` is an MSZIP/LZX CAB. `7z x MMDemo.exe`
unpacks it directly into `MIDTRIAL.EXE`, `MIDTRIAL.AR` (85 MB data archive),
`EULA.RTF`, the DirectX setup DLLs and `UNINSTAL.EXE`. The manifest's single
`extractArchive` step does exactly that. The game reads the registry key
`Software\Microsoft\Microsoft Games\Midtown Madness\1.0` but runs without it.

## Startup route (headless, `--batch-size=50000`, default 200 ms/batch clock)

1. First-run MessageBox "Click OK to have Midtown Madness detect the presence
   of a hardware accelerator card": `keydown:13` at batch 20.
2. Device probe: three 640×480 windows, then `IDirect3D3::EnumDevices`. The
   callback at `0x517010` keeps the device whose **name** matches the string
   that `[obj+0x1c]` selects (bits 0x400/0x800/0x1000/0x2000 → "Ramp
   Emulation"/"RGB Emulation"/"Direct3D HAL"/"MMX Emulation"; detection picks
   HAL here, `0x1032`). With no match the UI never starts: "FATAL ERROR:
   Can't start UI, this should never happen." (check at `0x40190b`). Fixed
   2026-10-11 by enumerating the Windows names and descriptions.
3. Main menu by ~b260. It is keyboard- and mouse-driven: Enter at b280 takes
   Quick Race to the Vehicles screen (Ford Mustang GT).
4. The menu cursor comes from an **absolute-axis** DirectInput mouse
   (`SetProperty(DIPROP_AXISMODE, DIPROPAXISMODE_ABS=0)`, GetDeviceState
   16 bytes into `0x713af0`). `relmousemove` moves it 1:1 from about
   (330,250). "Go Drive!" is reached with `relmousemove:240:175:8` and then
   `di-mousedown:1`/`di-mouseup:1`.
5. Loading screen with a progress bar (reading `MIDTRIAL.AR`); the countdown
   and race start at ~b1400.
6. **The default controller is the Mouse**: Throttle = left button, Brakes =
   right button, steer with mouse X (Options → Control Options). Holding
   `di-mousedown:1` from b1420 drives; checkpoint 1 is reached by ~b1640.
   Keyboard keys are camera/HUD keys (W = wide angle, C = camera, Tab = map).

## Emulator fixes this app needed (2026-10-11)

- D3D1-7 `EnumDevices` passed names "hal"/"rgb"/"ramp" with short
  descriptions. Windows passes "Direct3D HAL"/"RGB Emulation"/"Ramp
  Emulation" with "Microsoft Direct3D ..." descriptions.
- `DIPROP_AXISMODE` was stored inverted, and absolute mode was ignored.
  Absolute mice now report accumulated position in GetDeviceState and in
  buffered X/Y events.
- `IDirectInput::CreateDevice` succeeded with an inert device for any GUID.
  The game creates a "joystick" from an EnumDevices buffer that nothing
  filled, so unknown GUIDs now return `DIERR_DEVICENOTREG`.
- `Acquire` required `SetCooperativeLevel`. The game never sets one on its
  keyboard, so the keyboard was never acquired. The default level is
  background non-exclusive.

The keyboard table poll is at `0x545610` (it returns `0x713b00`). Its retry
path re-acquires the mouse device `[0x713c54]`, not the keyboard
`[0x713c58]`.
