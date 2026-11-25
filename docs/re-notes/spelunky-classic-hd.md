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

## Gameplay route: level 1-1 via START (headless, deterministic)

Run `scratch/runs/20261125-spelunky-hd-gameplay-profile/route/route.sh`. It
drives `run.js --control --frozen` with `tools/ctl.js`. Its `gen-input.js`
emits the same events as one `--input=` string. Both produce byte-identical
PNGs at every checkpoint (ctl and three `--input` replays matched).

Flags: `--screen=1024x768 --tick-ms-per-batch=5 --stuck-after=0 --headless-gl`.

| Batch | Event |
|---|---|
| 112000 | Enter, held 60 batches |
| 131000–160000 | Hold Left; he stops at TUTORIAL |
| 160200–162700 | Right |
| 163200–163900 | Right |
| 164300 | Up, held 400 batches; enters START |
| ~205000 | Level 1-1 is generated |
| 213550 | Player at the entrance door; HUD shows 4 hearts, 4 bombs, 4 ropes, $0 |

- Inside the level, one 6000-batch cycle (`route/cycle.sh`) is:
  - Left 800, then Z (jump) 700 while still holding Left, then a 300 gap.
  - X (whip) 500.
  - The same to the right.
- Keys must be held for at least 400 batches. Shorter presses fall between
  frames.
- Gameplay runs at about 247 batches per present. Presents are counted with
  `ctl eval instance.exports.d3d9_gps_stat(4)`:
  - 1414 at batch 213550.
  - 2021 after 25 cycles, at 363550: 607 gameplay frames, about 20 s at 30 fps.

Browser: Enter twice, about 30 frames apart, skips the intro straight to the
title room by about frame 70. Two attempts with `--guest-script` frame
pacing and wall-clock key holds left the player at the START door without
entering it. The script's hold times are wall seconds, not frames.

## Gameplay profile (2026-11-25, worktree a0bc18145)

Window: batches 225000–345000, 485 presents, inside level 1-1. Load average
was 4–15 throughout, so read the shares, not the times. Evidence is in
`scratch/runs/20261125-spelunky-hd-gameplay-profile/`.

**Headless (run C, V8 cpuprofile).** Wasm is only 37% of samples. The rest
splits into:
- 31%: `run.js` main closure. Self time is reported on its last line (13604)
  and on its `await` lines; more below.
- 25%: `lib/process-desktop.js` `receive`/`rows`/`publish`. `poll()` runs
  every batch; it is CLI only.

Rerunning with `node --no-turbo-inline-js-wasm-calls` (run D) leaves both
buckets the same. So inlined JS-to-wasm calls are not what hides there.

The main closure is one async function about 11,800 lines long. Each batch
crosses about 15 `await`s (nativeFault.wait, mainExecutionSuspended,
mainOwner.run/call, serviceMain*Wait, comInterfaces.drain,
pumpWaveCallbacks, …), and most of them await a value that is already
settled. That is about 0.57 ms of JS per batch. The likely reason, not
verified, is that a function this size is never optimized: its own
bytecode, plus the async resume and suspend V8 reports at the
function-end position, runs as that closure's self time. The browser's
`host.js` `step` is 0.4%.

Inside wasm (gameplay, all shares are % of wasm self time):

| Group | % of wasm |
|---|---|
| Threaded handlers | 38 |
| SSE handlers | 26 |
| Uop tier (`uop_fast` alone is 14) | 18 |
| Memory access (`gs32`, `g2w_slow`) | 5 |
| x87 | 3 |
| Dispatch | 3 |
| D3D9/GPS in wasm | 0.1 (presents go through the GL stream) |

`th_sse_rr` alone is 18% of wasm. It is 11.9% of threaded ops but 40% of
handler self time, at about 231 ns per op against a mean of 68 ns. Next by
self time are `th_push_r` (115 ns), `th_load32_rop`, `th_test_jcc` (134 ns),
`movss_load_ro` and `movss_store_ro` (about 93 ns).

**Guest side (run B).** Threaded counts come from `--handler-hist`, and the
SSE shares from `insn-mix.js` (threaded EXE blocks only).

- Uop blocks are 63% of block executions: 289M uop blocks against 170M
  threaded entries.
- Census:
  - 1544 installs over 950 heads.
  - 100 programs retired as poor.
  - 27.9M enters, which is 10.4 blocks per enter.
- Threaded entries the tier did not take:

  | Reason | Share of threaded entries |
  |---|---|
  | No-backedge | 29 |
  | No verdict | 27 |
  | Live | 17 |
  | Head-unsupported | 10 |
  | Poor | 6 |
  | Call-indirect | 5 |

- SSE is 11.8% of threaded guest instructions. Each SSE row is that
  mnemonic's share of the SSE instructions:

  | Mnemonic | % of SSE |
  |---|---|
  | movss | 24 |
  | cvtps2pd | 15 |
  | cvtss2sd | 13 |
  | comisd | 8 |
  | movq | 8 |
  | cvtsi2ss | 7 |
  | movsd | 4 |
  | addsd, subsd, mulsd | about 7 together |

  This is GML's double-based runtime converting to and from floats.
- x87 is 1%.
- The uop compiler declines most often (forms are weighted by the block
  entries at each head):
  - `ret` and `call`: the runner is call-heavy C++.
  - `rep 0f 10` (movss): 12.2M.
  - `pfx64` (`fs:` SEH prologue and epilogue movs): 6.9M.
  - `rep ret` (the `/GS` cookie check at 0x6aa085): 3.4M.
  - cvtsi2ss: 3.0M.
  - xorps and pxor: 3.9M.

Hot guest code:
- `0x564c40` is the GML bytecode loop. Its per-instruction `call [ebp-0x20]`
  at 0x564c87 is about 7% of threaded entries (0x564c7e, 0x564c8a, 0x564c69).
  It is declined as call-indirect.
- `0x4695c5` walks the instance list through `+0x17c`. It calls 0x453720
  (event-exists: per-object table at `[esi+ebx*8+0x4c/0x50]`) and then
  0x41d620 (perform event).
- `0x4a6dc0` is the instance-id-valid check.
- `0x56a9b0` is the large VM execute frame (0x874 bytes of stack, `/GS`).
- `0x43f830` is a C++ method with SEH and `/GS`.
- `0x6aa07d` is `__security_check_cookie`.

**Browser** (`profile-web-frames.js --headful`, real GPU): the level was not
reached, so the title room was profiled while the player ran, jumped and
whipped. Wasm is 85% of the page with Threads off and 96% of the guest
Worker with Threads on.
- Uop is 28–37% and threaded handlers 33–36%. `th_sse_rr` is only about 3%
  here, because the title room does little GML double math.
- Host costs: WebGL `getError` is 2.5–5.4% of the page with Threads off;
  `_audioSchedulerNow` 1.4%.
- Headless Chrome without a GPU falls back to the WAT software D3D9 shader
  VM (`d3d_shader_vm_run`, `d3d_software_step`): about 85% of the page and
  2 presents/s. That number says nothing about the real game.

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
- A browser route into level 1-1 (frame-paced holds are needed, not wall
  seconds).
- Gameplay levers, ranked in the run's report:
  - Dedicated threaded handlers for the hot scalar SSE/SSE2 forms, so they
    leave `th_sse_rr`.
  - Uop support for `fs:` movs, `rep ret` and the scalar SSE moves and
    conversions.
  - Measure `--uop-icall` on the bytecode loop.
