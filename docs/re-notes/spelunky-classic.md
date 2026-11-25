# Spelunky Classic v1.1 (Derek Yu, 2008/2009 freeware)

App id `spelunky_classic` (local-only, `lib/apps.js`). Download, hashes and
licence terms: `test/binaries/SOURCES.md`, section "Spelunky Classic v1.1".
Evidence: `scratch/runs/20261124-spelunky/` and
`scratch/runs/20261124-spelunky-route/` (title → level 1).

## What the binary is

- `Spelunky.exe` is the **Game Maker 8 runner** (Delphi VCL) with the game data
  appended to the image. Rendering is **Direct3D 8** (`d3d8.dll`); textures and
  render-target surfaces go through a D3DX-style helper DLL the runner loads at
  run time (`DllMain` at runtime `0x010200d9`, CheckDeviceFormat callers at
  `0x0102410b`).
- Sound: `supersound.dll` (GM extension, DirectSound via `DSOUND.DLL`) for the
  game's own `.ogg`/`.wav` files, plus GM's built-in sound, which asks for a
  DirectMusic `IDirectMusicPerformance8`.
- Imports: oleaut32, advapi32, user32, kernel32, msimg32, gdi32, version, mpr,
  ole32, comctl32, shell32, winspool.drv, comdlg32, winmm, d3d8, ddraw, wsock32.

## Load bases (headless, `--trace-api`)

| Module | Runtime base | Preferred |
|---|---|---|
| Spelunky.exe | `0x00400000` | same |
| supersound.dll | `0x00862000` | `0x10000000` |
| msvcrt | `0x00994000` | |
| oleaut32 | `0x00ad8000` | |
| comctl32 | `0x00c6a000` | |
| D3DX-style helper | `~0x01020000` | |

## Startup sequence and what each step needed

1. **TSplashForm** carries a `TWebBrowser` ActiveX (`SplashWeb`).
   `CoCreateInstance(CLSID_WebBrowser {8856F961-340A-11D0-A96B-00C04FD705A2})`.
   Delphi's `TOleControl` then runs GetMiscStatus, SetClientSite, QI, GetExtent;
   `TOleControl.SetParent` (`0x0050f7a4`) calls `GetClientSite` and
   `IOleControl::OnAmbientPropertyChange(DISPID_UNKNOWN)`.
   Provided by `src/09a7l-webbrowser.wat` (blank control; navigation is
   `crash_unimplemented`).
2. **RichEdit 1.0** `EM_EXGETSEL`/`EM_EXSETSEL`/`EM_EXLIMITTEXT` on class 24
   (Delphi `TRichEditStrings.Insert`); without them the runner raised an
   `EReadError` while streaming its form. Fixed in `09c3-wndprocs5-edit.wat`.
3. **Loading splash**: ~170 s of wall time headless (≈ batch 19 842 at
   `--batch-size=100000`). This is per-byte stream decoding of the appended
   game data in guest code, *not* API-bound (`--trace-api-counts`).
4. **"No sound device detected. Sounds might not play."** message box. The
   check at `~0x004852cf` calls the `CoCreateInstance` thunk at `0x00409054`
   with the IID at `0x004853c0` (`IDirectMusicPerformance8`,
   `{679C4137-C62E-4147-B2B4-9D569ACB254C}`); message text at `0x004853d8`.
   Fixed 2026-11-24 by `09a7m-directmusic.wat` (DirectMusic 8 Performance /
   Loader / Segment / AudioPath / SegmentState, Standard MIDI Files sequenced
   in WAT onto the host MIDI-out device): both CoCreateInstance calls return
   S_OK, `InitAudio(NULL, NULL, hwnd, DMUS_APATH_DYNAMIC_STEREO, 64,
   DMUS_AUDIOF_ALL, NULL)` returns S_OK, and no box appears.
   The GM8 sound unit (`0x00485100..0x00486500`): probe `0x00485280`;
   add-sound `0x00485110` (one CreateStandardAudioPath per sound, kind 2 =
   3D gets type 6); load-from-file `0x00485530` (LoadObjectFromFile, then
   SetParam(GUID_StandardMIDIFile), Download); load-from-memory `0x00485684`
   (GetObject with DMUS_OBJ_CLASS|DMUS_OBJ_MEMORY); delete `0x00485820`;
   master volume `0x004858e0` / tempo `0x0048594c` (SetGlobalParam);
   play `0x004859bc` (SetRepeats, PlaySegmentEx DEFAULT for background music
   or SECONDARY, 10 stack dwords); stop `0x00485bfc`; IsPlaying
   `0x00485c90`; volume `0x00485d2c` (AudioPath SetVolume); pan
   `0x00485d8c+` (AudioPath GetObjectInPath for an IDirectSoundBuffer8 —
   still a crash stub). **Spelunky itself never adds a GM built-in sound**
   (`0x00485110` hit count 0): all its music and effects are `.ogg`/`.wav`
   through supersound/DirectSound, so after the probe it only calls master
   volume. MIDI events reach the host only for GM games that use built-in
   MIDI sounds.
5. **Direct3D 8 init**. Without `--headless-gl` the runner shows "Failed to
   initialize drawing surfaces"; with it the device, textures and LockRect all
   succeed and the first frame is presented.
6. **Game scripts**: load all `sound/*.ogg|wav` through supersound (63
   DirectSound buffers), read `settings.cfg`, `keys.cfg`, `gamepad.cfg`, poll
   `joyGetPos(0)`/`(1)` (both `JOYERR_UNPLUGGED`, fine).
7. **Render-target surfaces**: the D3DX helper walks
   `IDirect3D8::CheckDeviceFormat(usage=D3DUSAGE_RENDERTARGET, rtype=TEXTURE)`
   over 29 formats, three times. Until 2026-11-24 the D3D8 handler answered
   `D3DERR_NOTAVAILABLE` for every one, although `CreateTexture` does make
   render-target textures. With no surface the game ran its own end path:
   stop all sound buffers, `DeleteFileA`+write `stats.txt`, destroy every
   form, `PostQuitMessage(0)`, `ExitProcess(0)` (ret `0x00405851`) — a clean
   exit with no dialog, so it reads like the game choosing to quit.
   Fix: `$d3d9_render_target_texture_format` (09ae) is the one rule both
   `CreateTexture` and D3D8 `CheckDeviceFormat` read
   (`test/test-d3d8-render-target-texture-format.js`).
8. **Title**: with the fix the intro and title room render (run 15: 5180
   presents, 1.2M draws, no exit by the 280 s limit; `title-intro.png`).
   Input reaches the title room (`title-room-after-input.png`).
9. **Window scale and Present rects** (fixed 2026-11-24). `CreateDevice` is
   windowed with an explicit **640x480** X8R8G8B8 back buffer. `settings.cfg`
   (`0,1,0,1,3,15,15`; the `3` is the window scale) then resizes the window to
   966x747 (client 960x720). The runner tries `SetViewport(0,0,960,720)`,
   which returns `D3DERR_INVALIDCALL` (0x8876086c). That is correct: d3d8 and
   Wine validate the viewport against the render target, and the game keeps
   going. Every frame is then `Present(src=(0,0,960,720),
   dst=(0,0,960,720), hwnd=0x10005)`. Windows clips the source to the back
   buffer (640x480) and stretches it onto the 960x720 destination. The ring
   path ignored both rects, so the picture filled only the top-left 640x480 of
   the window with black around it. `$d9g_present` (09akg) now clips the
   source rect, takes the destination rect (or the client area when the rect
   is NULL), and stretches through a GPU COPY (LINEAR) into a present target
   (stats 88/89). The WebGL executor's RT→RT COPY is now a shader draw instead
   of readPixels + a JS resample, so the per-frame stretch never leaves the
   GPU (`test/test-d3d9-gps-present-stretch.js`, `--webgl` compares
   executors).
10. **Into a level** (2026-11-24): a 640x480 screen clamps the 966x747
   window, which reads as a cropped frame (Win98 does the same at that
   resolution), so drive the route with `--screen=1024x768`.

## Title → level 1 route (control mode)

```sh
caffeinate -u -t 2
node test/run.js --app=spelunky_classic --headless-gl --quiet-api --screen=1024x768 \
  --max-seconds=3000 --max-batches=10000000 --batch-size=100000 --stuck-after=0 \
  --no-close --control=8241 --frozen
# then, with c(){ node tools/ctl.js --port=8241 "$@"; }
```

| Step | Batches (approx.) | Keys | Result |
|---|---|---|---|
| loading + intro text | `step 21000` | none | "PUTTING THE FADED PHOTO IN MY POCKET" |
| skip intro | `step 1000` between | Enter (13) down/20/up, twice | desert intro, then the title room |
| title room | `step 2400` + 600 | none | the player climbs down the rope and lands at the right |
| walk to START | `step 2500` | hold Left (37) | the player at the START door (x≈235 of 1024) |
| enter | `step 60` | Up (38) | through the door; 900 batches later the tutorial level |
| play | 300 / 15 / 8 | Right (39), Z (90) jump, X (88) whip | HUD 4 hearts, 0 bombs, 2 ropes, $0; "PRESS Z TO JUMP." |

If the player overshoots the door, tap Right (about 80 batches) before Up.
Evidence: `scratch/runs/20261124-spelunky-route/` (`s3-*.png` after the fix;
`s2-*.png` before it, picture in the top-left 640x480).

## Gameplay profile (tutorial level), 2026-11-25

Evidence: `scratch/runs/20261125-spelunky-classic-gameplay-profile/`
(`route/`, `headless/`, `browser/`, `native/`).

**Replayable route.** The first START goes to the **tutorial**; Mines 1-1
needs the tutorial finished. After the title, the route runs six cycles of
run, jump and whip, 600 batches each. Each cycle presents about 208 frames,
about 2.9 batches per present at `--batch-size=100000` and the default
200 ms/batch clock.
- `route/gen-input.js` prints the `--input=` string (`route/input-string.txt`):
  - Enter at 21000 and 22020.
  - Left from 25040 to 27440.
  - Up from 27740 to 27800, which reaches the tutorial at about 29000.
  - Cycles start at 29000.
- That string replays md5-identical PNGs to the ctl run (`route/route.sh`).
- Press Up only after the slide stops. An Up pressed mid-slide misses the door.
- Profile window: batches 29600–32600, 1046 presents (about 35 s of game at
  30 fps).

**Where the time goes**, from the headless cpuprofile (`headless/run-c/buckets.txt`):

| Bucket | Share of all samples |
|---|---|
| wasm | 76.9 % |
| uop tier | 37.8 % (`uop_fast` alone is 33 %) |
| threaded handlers | 16.3 % |
| x87 | 10.5 % |
| mem translate | 4.4 % |
| SSE | 0 % |
| D3D9/GPS wasm | ~0 % |

- **Harness, not the app:**
  - `process-desktop` `receive` is 11.5 %, almost all of it in
    `Atomics.wait` at line 141.
  - The `run.js:1758` closure is 1.2 %.
- **Headless GL:** 5 % (`getIndexedParameter` 2.6 %).
- **Block executions:** 67 % run in the uop tier. Threaded ops total 1.21 G,
  at a mean of 26.8 ns/op.
- **Unsupported uop forms, by weight:**
  - `ret` 141 M, `call` 80 M, `sahf` 20 M, `ret imm` 12 M.
  - `xchg r/m` 6.8 M (`_LStrAsg`).
  - `lock dec`/`inc`/`cmpxchg` about 1.6 M combined.
- **Declines:** threaded entries the tier did not take are 55 %
  `no-backedge`.
- **Compile churn:** 68 % of compiles are repeats from verdict-map aliasing.
  0x4abf8d was compiled 471 times.

**Guest code.** Weights are threaded instructions, then uop live blocks (`headless/run-b/attribute.txt`).

| Share (threaded / uop) | Code |
|---|---|
| 33 % / 27 % | Delphi record RTTI: `_FinalizeRecord` 0x4064e8, `_FinalizeArray` 0x406534, `_CopyRecord` 0x40674c, `_InitializeRecord` 0x406448 |
| 22 % / 22 % | GM instance core: var lookup 0x4a8a30, set x/y 0x4abf7c, per-object nth instance 0x4aee7c/0x4aeee0, depth check 0x4aef24 |
| 18 % / 28 % | GML tree interpreter 0x520000–0x52a000: node eval 0x527530, call-arg copy 0x52919a |
| 13 % / 12 % | Collision: bbox test 0x4aceec, scan 0x4e3ed0, event pass 0x539bb2, bbox recompute 0x4aa958 |
| 4 % / 2 % | `Move` 0x4030a5 |
| 3.6 % / 1.7 % | LStr (`_LStrClr` 0x405934 and `_LStrAsg` 0x405988 use `lock dec`/`inc` and `xchg`) |
| 0.7 % | FastMM |

- A GM value is a 24-byte record holding a string (TypeInfo 0x5436f0). Every
  copy is `_CopyRecord` and every temporary is `_FinalizeRecord`, so about a
  third of the guest work is RTTI walks.
- Loading-time hot spots (LStrCmp, FastMM) do not matter in gameplay.

**Browser.** Cooperative only:
- The intro text runs at 4.8 GPU presents/s.
- The title room, which is a playable lobby, with run/jump/whip keys runs at
  28 presents/s; uop is 36 % and threaded 26 % of non-idle time.
- A Threads-on profile hung in `profile-web-frames` and was killed.

## Reproduction

```sh
caffeinate -u -t 2
node test/run.js --app=spelunky_classic --headless-gl --quiet-api \
  --max-seconds=280 --max-batches=1000000 --batch-size=100000 --stuck-after=0 \
  --no-close --input=20500:keydown:13,20510:keyup:13 --png=OUT.png
```

- `--stuck-after=0`: before 2026-11-24 the stuck detector otherwise ended
  the run during the modal sound message box; with DirectMusic there is no
  box and the Enter input is no longer needed.
- Browser: dev server, `?app=spelunky_classic`.

A fresh worktree lacks the gitignored `test/binaries/dlls/` (`ole32.dll`,
`shell32.dll`), and the loader says so; copy them in before chasing an
`<ord>` crash.

## Browser Threads (guest main in a Worker), 2026-11-24

Reported as "hangs on the splash with Threads on, plays the intro by 50 s with
Threads off". **It does not hang**; it is still loading. Evidence:
`scratch/runs/20261124-spelunky-threads/`.

- The splash phase is ~2.06 G retired blocks (`get_blocks_now`; the CLI's
  ~20 557 batches at `--batch-size=100000`) in both modes, with the main
  thread `runnable` and no wait, CS or parked state the whole time (Thread
  state: `T1 run`, `S1/T2` = the GM runner's `CreateThread(flags=4)` thread at
  `0x405880`, which stays suspended in cooperative mode and headless too).
- On this M1 at load 7–20, the Worker retires 15–25 % fewer blocks per second
  than the cooperative page thread: CPU profiles of the two are the same
  functions in the same proportions (worker 92.5 % wasm, ~5 % idle in the
  slice round trip), but fewer blocks per wasm-millisecond, which is how a
  Worker thread is scheduled against the page's main thread on a busy box.
  Raising the Worker slice to 2 M steps (`wine.stepsPerSlice`) did not make
  slices longer: they still returned after 0.2–0.5 M blocks (5–13 ms), so
  that is not a lever.
- Measured with the same probe on the release server: cooperative crossed
  2.06 G blocks at ~70 s of page time and showed intro line 2 at ~80 s;
  Threads crossed it at ~80 s and showed "WITH THE DESERT STRETCHING BEHIND
  ME." at ~83 s (`after-threads-rel-intro.png`, `rel-threads8-c.png`).
- The original captures were at 50 s *after* the probe's `ready`, i.e. still
  mid-load in the slower mode. `tools/web-input-probe.js` also used to spend
  15 s polling for a LAN lobby after every launch, which the step clock did
  not count; it now stops as soon as a non-LAN app is running.

Watching it: `evalfile:` with `get_blocks_now` through
`wine.guestWorker.callExport` (Threads) or `wine.instance.exports`
(cooperative) gives progress against the 2.06 G target; `--ready=0` and a
single long `wait:` fit the splash into a 90 s probe only on a quiet box.

**Mouse-move crash, 2026-11-25.** Once "WARNING: GM8.0 RELEASE CANDIDATE" and
the forms after it exist, the first mouse move over the window calls comctl32
`_TrackMouseEvent` (thunk `0x4258ac`, IAT `0x70d2b0`; caller ret `0x458a31`).
The call comes from the VCL's mouse-enter tracking, with `TME_LEAVE` on hwnd
`0x10005`. It trapped on the fail-fast stub in both modes, and is now real:
`$tme_track` in `09a5`. Evidence is in `scratch/runs/20261125-track-mouse-event/`.

## Input latency and browser frame rate, 2026-11-25

Reported as "super laggy, a delay after you press a key", and about 12 fps in
the browser against a 30 fps room speed. Evidence:
`scratch/runs/20261125-spelunky-input-latency/`. Desktop Chrome headful, dev
server `--isolate`, box load 6–9.

**Two Presents per GM step.** The GM8 loop (0x53e8aa) calls step+draw
(0x53e53c), Presents from 0x4a2708/0x4a27ae, then runs ProcessMessages once
(PeekMessage, ret 0x470d89). A second Present (ret 0x4a2864 from 0x4a27cc,
after IsIconic + GetClientRect) comes from the GML builtin at 0x553180 and
from 0x49c546. That is guest behaviour, so **presents/s ÷ 2 = GM fps**. The
perf HUD's PRESENT/s counts both. In the browser timelines the present
interval is p50 18 ms / p95 105–125 ms: pairs of presents, then one GM step.

**Key → pixels**, measured with `tools/page-probes/arm-key-latency.js` +
`read-key-latency.js`, summarised by `tools/key-latency-report.js`. All
values are ms from the DOM event timestamp.

| Run | GM fps | enq | deq (guest took WM_KEYDOWN) | moved (frame shows it) | paint | frame→paint |
|---|---|---|---|---|---|---|
| title, coop (`base-coop-3`) | 10.2 | 6 | 55 | 159 | 162 | 4.2 |
| title, Threads (`base-threads-1`) | 8.8 | 0.4 | 59 | 163 | 177 | 15.7 |
| tutorial, coop (`game-coop-4`) | 8.2 | 5 | 63 | 193 | 199 | 3.7 |

- The host side is cheap: enqueue under 10 ms, composite 4 ms (coop) or
  about 15 ms (Threads; the renderer holds publication until the Worker
  slice ends, `_workerPublicationHeld`).
- Keys arrive as WM_KEYDOWN through PeekMessage once per GM step (GetKeyState
  only for modifiers), so `deq` is half a GM step on average. The frame that
  shows the key is about 3 presents (1.5 GM steps) after `deq`.
- **So the lag is the GM step rate.** At 8–10 GM fps, a key costs about
  half a step plus 1.5 steps: 160–200 ms. At 30 GM fps the same pipeline
  would be about 55–65 ms. No input-path fix changes this.
- Spin parking, peek-spin, present pacing and logical-frame counters were all
  0 in the browser title room: nothing in our timing paths is sleeping.
- Headful synthetic keyups on window blur come from
  `lib/browser-input.js` `releaseDeliveredKeys`, a focus-loss test artefact.

**Headless "30 fps" is guest-clock fps, not wall fps.** The gameplay profile
above counts presents against the 200 ms/batch clock. Wall-clock in the CLI
on the same box, title room (`headless/title-batchclock-blocks.log`,
`title-realticks.log`): 49 presents/s with the batch clock (24.5 GM fps),
41 with `--real-ticks` (20.5 GM fps). The browser runs the same room at
17.5–25 presents/s, so the browser executes GM steps about 2× slower than
Node on the same machine.
- `get_blocks_now` per present is not a comparable unit across hosts (uop
  tier installs change what a block is): 312 k in the CLI, 0.87–1.04 M in
  headful Chrome, 165 k in headless Chrome. Do not use it as "work".
- A mouse over the window is **not** the cause: a CLI run with
  `22100:mousemove:480:400` ran the same window as fast as one without
  (`headless/title-mouse2.log`); an earlier slow mouse run was box load.
- The browser presenter reads back and re-uploads every frame:
  `readPixels` 8.2 % of page CPU and `putImageData` of the full frame per
  present (`prof-coop-1`). This is a few percent, not 2×.

**Remaining levers**, from the gameplay profile above (wall-clock gains
unmeasured in the browser): Delphi record RTTI (`_CopyRecord` /
`_FinalizeRecord`, about a third of guest work), uop no-backedge declines
(55 % of threaded entries) and call/ret support, verdict-map aliasing (68 %
of compiles are repeats), `fnstsw`/`sahf`. The browser/Node gap itself is
not yet explained; profile it with `tools/profile-web-frames.js` once
headful Chrome stays up (it closed 3–29 s into most runs on 2026-11-25).

**Routes** (scripts in the evidence folder):
- `latency-run.sh OUTDIR [--threads]`: load to 2.15 G blocks, Enter twice,
  wait for ≥20 presents/s, 5× Left/Right taps.
- `gameplay-run.sh OUTDIR 118 [--threads]`: as above, then hold Left for
  118 presents (110 stops right of the tutorial door, 125 left of it),
  wait 60, Up for 20, wait 300: "PRESS Z TO JUMP". Then 3× run/jump/whip.
- `rate-run.sh OUTDIR [--threads]`: `tools/page-probes/measure-guest-rate.js`
  over 8 s idle and with Left held.
- CLI `--cpu-window=A:B` now prints `draws` and `blocks` too.

## Ruled out

- The crash labelled `UNIMPLEMENTED API: ... KERNEL32.DLL#18` during splash
  setup was a **mislabel**; the trace showed
  `WebBrowserOleObject_GetClientSite`.
- Slow loading is not an API storm and not the bundled DLLs.
- The post-init exit is not a crash, a failed Present, or input: no keyboard
  read occurs between config load and the end path; the Enter keyup from the
  sound box was consumed by the form before scripts ran.
