# Spelunky Classic HD 1.1.7 (yancharkin, 2021; GameMaker:Studio 1.4)

App id `spelunky_classic_hd` (local-only, `lib/apps.js`), route
`?app=spelunky_classic_hd` on a localhost dev server. Download, hashes and
licence terms: `test/binaries/SOURCES.md`, sections "Spelunky Classic HD
1.1.7" and "DirectX End-User Runtimes, June 2010". Evidence:
`scratch/runs/20261124-spelunky-hd/` (`final2/` is the run on the committed
build).

## What the binary is

- `SpelunkyClassicHD.exe` (4,382,208 bytes) is the **GameMaker:Studio 1.4 C++
  runner**; the game is `data.win` (77 MB) beside it. It is yancharkin's
  unofficial HD remake of Derek Yu's Spelunky Classic, not the Game Maker 8
  original (that is `spelunky_classic`, `docs/re-notes/spelunky-classic.md`).
- Rendering is **Direct3D 9** through `d3dx9_43.dll`, which the zip ships
  (byte-identical to the June 2010 redist). `D3DCompiler_43.dll` is added from
  the redist; the manifest mounts both beside the exe.
- Static imports: kernel32, user32, gdi32, advapi32, shell32, ole32, oleaut32,
  comctl32, comdlg32, version, winmm, ws2_32, wininet, dbghelp, gdiplus,
  d3dx9_43. d3d9 itself comes in through D3DX. At startup the runner
  `LoadLibraryW`s `xinput1_3.dll`, `xinput1_4.dll` and `dinput8.dll`.
- The code uses SSE2 throughout (MSVC `/arch:SSE2`): packed and scalar double,
  PSHUFD, 64-bit integer lanes, PMOVMSKB.

## Load bases (headless)

| Module | Runtime base | Original base |
|---|---|---|
| SpelunkyClassicHD.exe | `0x00400000` (entry `0x006b8609`) | same |
| d3dx9_43.dll | `0x00b88000` | `0x10000000` |
| msvcrt.dll | `0x00e87000` | |
| comctl32.dll | `0x00fcb000` | |
| oleaut32.dll | `0x01157000` | |

shell32 and ole32 are not on disk; the WAT stubs answer them.

## Threads

- **Main**: GameMaker's step/draw loop. It paces each frame with a waitable
  timer: `CreateWaitableTimerW(NULL, TRUE, NULL)`, then `SetWaitableTimer`
  (relative due time, period 0) and `WaitForSingleObject(INFINITE)`, called
  from `0x004bf3e8`/`0x004bf3fe`/`0x004bf407`.
- **T1** (`CreateThread` start `0x006a87b0`, param `0x01697784`), created
  before the first window: the **audio mixer**. Its loop at `0x00493834` is a
  float multiply-accumulate, and `0x00493d6e`–`0x00493dcb` clamps floats to
  int16 into `[ecx+eax*2]` with `esi` as the sample count (`0xc80`, `0x1180`
  seen). It makes no API calls and holds critical section `0x012a8594`
  (recursion 2) while it mixes.
- **T2** is the emulator's winmm timer thread (start in the thunk zone), which
  signals the waitable timer.

## Route (headless)

```
node test/run.js --app=spelunky_classic_hd --headless-gl --quiet-api \
  --screen=1024x768 --tick-ms-per-batch=5 --max-batches=181000 --no-close \
  --input=112000:keydown:13,112060:keyup:13,131000:keydown:37,166100:keyup:37,166200:keydown:38,166600:keyup:38,180000:png:out.png
```

- `--screen=1024x768`: the runner asks for an 808x628 window.
- Loading takes about 50k batches; the first `Present` is near batch 51k. The
  story text and the beach scene follow. Enter skips them, and the title room
  (TUTORIAL / START / SCORES doors and the QUIT sign) is up by about batch
  100k.
- Enter at 112000 drops the spelunker down the rope. Holding Left from 131000
  walks him past START to the TUTORIAL door by about 166000, and Up enters
  it. The **tutorial level** is drawn with its HUD (4 hearts, 0 bombs, 2
  ropes, $0) by batch 180000. To start a real game instead, release Left
  around batch 160000, in front of the START door.
- At `--tick-ms-per-batch=20`, frames collapse to about 2 per 5,000 batches
  once the title's player spawns. At 5 ms/batch they keep coming (about 1 per
  80–140 batches). This is not a deadlock. The main thread's
  EnterCriticalSection parks behind T1's mixer section, and how often main
  gets the section depends on how much guest time each batch covers.

## Fixed gaps (in order of appearance)

1. **SSE2 XMM forms** (decoder gate `src/07-decoder.wat`, `$sse2_form` /
   `$sse2_exec` in `src/06c-mmx.wat`): the subops are listed in the table
   comment there; `test/test-sse2-xmm-forms.js`.
2. **ExpandEnvironmentStringsW**: A and W now share `$env_expand`.
3. **GetConsoleWindow**: returns NULL for this GUI process.
4. **EnumDisplaySettingsW used DEVMODEA offsets.** DEVMODEW doubles
   `dmDeviceName` and `dmFormName`, so its fields are 64 bytes later
   (dmBitsPerPel 168, dmPelsWidth 172, dmPelsHeight 176, dmDisplayFrequency
   184; full size 220). The runner read the bit depth from the wrong field
   and stopped with the MessageBox "requires 16-bit or 32-bit mode". Also
   added: EnumDisplaySettingsExW, ChangeDisplaySettingsW (same offsets) and
   GetMonitorInfoW (MONITORINFOEXW, 104 bytes).
5. **IDirect3DDevice9::QueryInterface / IDirect3D9::QueryInterface.** D3DX9_43
   (at `d3dx+0xc8d64`) asks the device for IID_IDirect3DDevice9Ex before
   creating a texture. These now answer IUnknown plus their own IID; the Ex
   IIDs get E_NOINTERFACE. The crash first showed as `<ord> KERNEL32#18`.
6. **Waitable timers** (CreateWaitableTimerW / SetWaitableTimer /
   CancelWaitableTimer; CloseHandle disarms). These reuse the
   multimedia-timer slots with flag `0x40`, signalling the timer's event
   through the winmm timer thread. A completion routine (an APC) still
   crashes as unimplemented.
7. **WebGL present into a too-small canvas** (`lib/gpu-stream-webgl.js`). The
   canvas was sized from the first RT the ring created: a 604x453 offscreen
   RT the size of the window's first client area. The 640x460 back buffer
   then failed every present. A whole-RT present now resizes the canvas to
   that RT. Growing it only was tried and is wrong: after a larger whole-RT
   present, the tutorial's 640x460 frames sat in a stale black margin
   (`final/tutorial-level.png`).

Tests: `test/test-sse2-xmm-forms.js`, `test/test-spelunky-hd-win32-gaps.js`,
plus updated DEVMODEW offsets in the four display tests.

## Imports that would still trap

WININET (HttpEndRequestW, InternetWriteFile, HttpQueryInfoA,
InternetCrackUrlA, InternetCanonicalizeUrlA, InternetGetConnectedState),
dbghelp (MiniDumpWriteDump, SymInitialize, SymFromAddr), ws2_32
(getaddrinfo, WSAAddressToStringA, freeaddrinfo), RtlCaptureStackBackTrace,
GetRawInputDeviceInfoA, GetRawInputDeviceList. None was reached on the route
above. D3DX also imports GetFileSizeEx and some msvcrt entries.

## Hypotheses ruled out

- "`KERNEL32#18` is a missing ordinal export": it was the unimplemented
  device QueryInterface reached through D3DX's vtable call.
- "The 8-bit desktop is real": it was the DEVMODEA layout written into a
  DEVMODEW.
- "The title stall is a DirectSound deadlock": no DirectSound, waveOut or
  dsound.dll load appears in batches 46k–48.5k, and T1 makes no API calls at
  all. T1 is busy mixing, not blocked. Which output the mixer feeds is still
  unidentified.
- "It depends on the Worker backend": `--threads` shows the same present-rate
  dip around the title.

## Open

- Identify the audio output and why T1 mixes thousands of samples per turn
  under the section main needs. That is the cost behind the slow title at
  coarse ticks.
- Play a real level from the START door.
