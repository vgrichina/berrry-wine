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

## Delphi helper fold on main (default on), 2026-11-25

Fold-bench arm D landed on its own as `src/10-helpers-delphi-fold.wat`: on by
default, `--no-delphi-fold` / `?no-delphi-fold` turns it off. Arms A–C stay on
branch `fold-bench`. Evidence is in `scratch/runs/20261125-delphi-fold-land/`.

- **Handler 395**, the retired SMACK_HUFF slot. Ids 502–511 are now
  `--sse-fast`, and a 513th entry would outgrow the 512×512 handler
  pair-histogram region, which the region map has no space to grow.
- **Code writes.** The page-index cover is still only the first instruction,
  so a guest body that resumes does not retire the HLE block. Every byte range
  the native form depends on is registered as well: the body, its included
  callees (`_FinalizeRecord`→`_FinalizeArray`→`_LStrClr`,
  `_CopyRecord`→`_LStrAsg`) and the FILD/FISTP `System.Move`. A guest store
  into any of them drops that group's pages (`$dfold_code_write`), and the next
  entry re-checks the signature. The SMC cases in `test/test-delphi-fold.js`
  fail with the hook removed: the stale native form runs, and memory and the
  block count differ.
- **Threads.** Refcount changes and the `_LStrAsg` slot exchange are atomic.
  A decrement is a CAS against the count the decision was made on, done before
  anything irreversible. A lost CAS undoes what it already moved and falls
  back (`cas_lost`).
- Typical counts at 20000 batches, `--branch-clock`: native 10082, partial
  5632, fallback 643, by id `LStrClr 8073/29`, `LStrAsg 1099/558`,
  `FinalizeRecord 584/43`, `FinalizeArray 40/10`, `CopyRecord 286/3`
  (native/fallback).
- **Parity, D on vs `--no-delphi-fold`, at a fixed `--max-batches`.** Under
  `--branch-clock` every row is identical: API count, batches, end-frame md5
  and the `--present-distinct` line. That covers Spelunky through the intro
  (23500 batches at `--batch-size=100000`, Enter at 20500: 2245487 API calls
  and 1332 presents in both arms), metrojd_gm7, tetravex, castle_gm5 and
  seiklus at 20000, the heroes2_demo and sol controls (no fold fires), and
  Spelunky with `--threads` (the guest thread at 0x405880 is System unit code
  in a worker, which inherits `set_delphi_fold`).
- **The default clock is not invariant under D.** It counts threaded block
  cuts, and D does not model them. Charging D's branch counts on that clock
  too was tried and is off by 1–2 per path. The default-clock rows match for
  metrojd, castle and sol and diverge for tetravex (34366 vs 34334 API calls,
  same frame), seiklus (150711 vs 150709), and Spelunky's intro (2254351 vs
  1739765 API calls, 1338 vs 1032 presents). They still diverge with
  `--no-uop`, so the cause is D's own block collapse. Any decode-time tier
  does the same, which is why tier A/Bs use `--branch-clock`.
- Not reproduced, as before: stores below ESP, the x87 scratch left by a
  FILD/FISTP Move, faults inside a helper, and a `--break` inside a matched
  body. Use `--no-delphi-fold` for those.

### Init and Move fold (ids 6–9), 2026-11-26

Evidence is in `scratch/runs/20261126-delphi-fold-init-move/`.

- **What is matched.**
  - `_InitializeRecord` 0x406418 (id 6) and `_InitializeArray` 0x406448
    (id 7) are matched as a mutually recursive pair: each body's signature,
    plus IA→IA, IA→IR and IR→IA rel32s.
  - `System.Move` is matched in two forms. Id 8 is the FILD/FISTP form at
    0x4030a8; its absolute jump table is checked against the entry. Id 9 is
    the REP MOVSD form that Game Maker 5/7 runners link (Metrojd 0x402a90).
  - `_CopyRecord`'s leading Move runs the same native copy, and only after
    that Move's whole body is checked.
- **Init.** `$di_plan` walks the RTTI before anything is written. It
  computes the branch count and declines in these cases: an unknown kind, a
  record with no fields, a walk deeper than the limit, and a walk whose RTTI
  reads fall inside the span being zeroed.
- **Move.** Move declines a FILD-form backward copy whose `dst-n` wraps, the
  REP form under DF=1, and any copy over 1 MB.
- **Exit state.** Init and Move leave the guest's exit EAX/ECX/EDX and lazy
  flags as the body would leave them.
- **Hit counts.** At gameplay 29600:32600, `--branch-clock`
  (native/fallback): IR 1628860/625, IA 495426/1033, Move-FILD 22835788/1145.
  `_CopyRecord` fallbacks drop from 554101 to 355099, because the REP-less
  Move check now passes for more sizes.
- **Attribution against main D.** Main D is 183.8 M weighted threaded
  instructions and 352 M uop blocks.
  - Init IR/IA falls from 1.2 % threaded + 12.7 % uop to 0.2 % + 0.0 %.
  - `System.Move` falls from 2.2 % threaded to 0.6 %.
  - `_CopyRecord`'s 3.8 % uop share is gone.
  - Total uop blocks are ×0.794 and threaded instructions ×0.960.
- **Fixed-dword collision.** `$dfold_at` now tries every id whose first
  dword matches (`$d_check`). Before, the first match won.

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
Node on the same machine. (Corrected below in "Browser vs Node gap": this CLI
window was the intro, and the browser gap is guest work per present.)
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

## Browser vs Node gap, 2026-11-25

Evidence: `scratch/runs/20261125-spelunky-browser-gap/`. Chrome 158.0.8127.37
headful, `?debug&perf`, dev server `--isolate`; Node v24.21.0; box load 2–3.

**Correction to the section above.** The CLI "title room" at 41–49 presents/s
was the DEREK YU PRESENTS intro (`cli/at24000.png`), not the title room.
Reaching the title room needs:
- with the batch clock, Enter at batches 21000 and 22020, and a window from
  23500;
- with `--real-ticks`, Enter at 21600 and 22150, and a window from 24000.

Same room on both hosts, 218 draws per present:

| Host | presents/s | blocks/present | Mblocks/s | wasm ms/present | other ms/present |
|---|---|---|---|---|---|
| CLI batch clock (`cli/h-*`) | 36.7 | 395 k | 14.5 | 21.1 | 7.4 |
| CLI `--real-ticks` (`cli/j-*`) | 44.1 | 442 k | 19.5 | 14.7 | 8.0 |
| browser coop, before (`coop-1`) | 27.3 | 864 k | 23.6 | 30.0 | 9.1 |
| browser coop, after fix (`coop-fix-1`) | 32.0 | 870 k | 27.8 | 28.5 | 4.8 |
| browser Threads, before (`threads-2`) | 40.6 | 858 k | 34.8 | 23.4 (Worker) | — |
| browser Threads, after (`threads-fix-1`) | 40.2 | 847 k | 34.1 | — | — |

**The engine is not slower; the guest does twice the work per present.**
- Per block, Chrome is as fast as Node or faster: about 33 ns/block on both
  in coop, and 34.8 Mblocks/s on the Threads Worker.
- The per-present gap is guest work, confirmed by two counters that agree:
  - `get_blocks_now`: 860 k vs 395–442 k per present.
  - Handler hist, threaded ops per present (`hist-compare.js`,
    `hist-coop-1` vs `cli/f-hist-title.json`): 1.02 M vs 478 k.
- The section above called blocks/present "not comparable across hosts".
  That was wrong: the same uop settings apply on both hosts
  (`test/runner-experiments.js` sets only the WAT defaults).
- Presents per GM step are 2.0 on both hosts (`count-coop-3`, `cli/g-count.log`).

**Where the extra work goes.** The extra work is not uniform:
- RTTI blocks `_FinalizeRecord` 0x4064e8 and `_FinalizeArray` 0x406534 run
  2.7× more.
- The collision event pass block 0x539df9 runs 2360 vs 28 per present (84×).
- Blocks 0x40661d (a `_FinalizeArray` arm) and 0x4aeead (nth-instance) run
  only in the browser.
- Nth-instance 0x4aee6d is equal on both hosts, so the instance count is
  about the same.

So the browser's title room fires collision events, and the GML that copies
values with them, that the CLI room does not. That is a game-state or
environment difference: player position, the held Enter key, screen size.
For comparison, headless Chrome measured 165 k blocks/present in the section
above. (Resolved below in "Browser vs CLI work per present": the CLI window
was the rope-descent phase of the title room; same phase, same work.) This is
not fixed. **Next:** dump the instance list and the player's x/y
in both hosts at the measuring point.

**Coop duty cycle** (`tools/page-probes/measure-host-duty.js`, `coop-1`):
- Time split: slices 84 %, step glue 12 %, gaps 4 %, 0 sleeps.
- Step p50 3.1 ms / p95 8.4 ms; gap p50 0.02 ms.
- The page thread never idles, so scheduling is not a lever.

**Fixed: per-present readback in the coop presenter.**
- The cause: `GpuStreamHost` `_place` (any frame with a non-zero dst, which
  is every windowed D3D frame) read `frame.pixels`. That is a lazy
  `gl.readPixels` (2.9 ms/present) plus a `putImageData`, 9 % of page CPU.
- The fix: `_place` now `drawImage`s the rect (`srcX`/`srcY`, set by
  `lib/gpu-stream-webgl.js`) straight from the WebGL canvas.
- Result: coop 27.3 → 32.0 presents/s (+17 %), non-wasm 9.1 → 4.8 ms/present.
- Threads already sends an ImageBitmap and is unchanged.

**Ruled out:**
- Small quanta: CLI `set-batch-size:2048` keeps `$branch_end_at` at
  0.28 ms/present.
- Tier-up: `--js-flags=--no-wasm-dynamic-tiering`
  (`web-input-probe --chrome-arg=`, run `coop-fix-notier`) is slower,
  25.6 presents/s.
- Config: the same uop/SSE settings apply on both hosts, and the app entry
  has no flags.

The browser `$branch_end_at` family is about 2.8 ms/present against 1.0 in
the CLI. It scales with the extra guest work, which reaches more distinct
branch targets.

`--names` in `cpuprof-top` and `func-index` mis-name this wasm. Build a named
copy with `node tools/build-compile-wat.js --out=X.wasm --names --no-facts`
and read the names with `wasm-objdump -x -j name`. `prof-compare.js` takes that
listing.

## Browser vs CLI work per present: a title-room phase, 2026-11-25

Evidence: `scratch/runs/20261125-spelunky-browser-cli-state/` (scripts
`cli*.sh`, `br-*.sh`, probes in `probes/`). Chrome headful coop, dev server
`--isolate`; Node v24; box load 6–21 from other agents, so timings there are
noise and the counts are the result.

**Not an emulator or environment difference.** The 2× was two different
phases of the title room:
- **Arrival:** the player climbs down the rope (instances 388 → 397).
  About 395 k blocks/present on both hosts.
- **Steady state:** after landing, about 855–870 k blocks/present on both
  hosts.

The CLI window `23500..25000` (Enter at 21000/22020) is the arrival. The
browser route measures after it. With the route that `--cpu-window` and the
earlier notes used:

| Window | CLI blocks/present | Browser blocks/present |
|---|---|---|
| arrival (CLI 23500–25000) | 396 k | 192 k → 349 k (first 12 s after one Enter, `br-series-1enter`) |
| steady (CLI 25000–31000, no input) | 855 k (`o-win-base-alone`) | 859–871 k (`br-series-1enter` windows 4–6) |
| steady, extra Enter in the title | 854 k (`p-win-enter3-alone`) | 865 k (2-Enter route, `br-rate-2enter`) |

**Guest-exact counters agree.** `--count` / `set_count` arm `$dbg_any`, so
every block dispatches and there is no uop tier. Per GM step in the steady
state, browser (`br-state`) vs CLI (`k-tut-base`):
- `_FinalizeRecord` 0x4064e8: 15.9 k vs 15.3 k.
- Var-lookup scan iterations 0x4a8a5b: 138 k vs 137 k.

In the CLI arrival window (`e-ctl`) the same counters are 6.8 k and 26 k.
API calls per present are identical in the two phases
(`api-diff-arrival-vs-steady.txt`):
- 218 draws, 1 `joyGetPosEx`, 2 `GetCursorPos`, 4 `IsIconic`.
- Only HeapAlloc/HeapFree differ, and only during the arrival.

So nothing the game reads from the host changes. The extra work is GML
(global variable reads and writes, value-record copies) in the landed
player's step. Presumably that is the full control/physics script, which
the scripted rope descent skips; this is inferred from the timing, not traced.

**The extra Enter.** The browser route's second Enter (1.5 s after the
first) lands in the title room:
- It skips the arrival straight to the steady state.
- It leaves one more instance: object 760 at (384,144), invisible, bbox
  13×16, field +0xc4 = 760.
- A CLI Enter at batch 23100 reproduces both, and its per-step counters match
  the browser's.
- Without the Enter the browser reaches the same 860 k/present about 20 s
  later, with no object 760. So object 760 is not the cost.

A real player is in the steady state as soon as the rope descent ends, so
**the user's play is always in the 860 k/present regime**. The CLI's 36–44
presents/s "title room" figures in the section above are arrival-phase
numbers.

**Hist artefacts in the section above.** With `$dbg_any` armed on both
hosts:
- The collision event-pass block 0x539df9 runs 2240 (browser) vs 2195 (CLI)
  per present, not 2360 vs 28. Its outer loop is the per-instance skip at
  0x539c3e. The 84× came from uop/chained execution hiding block entries in
  the CLI hist.
- 0x4aeead (the `nth instance` return tail) still shows as a block entry only
  in the browser. That is a decode boundary (the block was first entered at
  that jump target), not extra work: every nth call counts it there, and the
  call counts (0x4aee7c) are equal.

GM8 structures used by `probes/gm-state.js`:
- `[0x58f124]` is the global variable list: +4 rows, +8 count, 40-byte rows
  with the var id at +0. There are 285 globals on both hosts.
- `[[0x58fac4]]` is the instance manager: +0x78 per-object instance arrays,
  +0x7c per-object counts (Delphi dynarrays).
- In an instance, x is at +0x50 and y at +0x58 (doubles); +0x108 is the
  skip/deactivated byte the collision pass tests.
- Var lookup 0x4a8a30 scans that list backwards. Its callers are global get
  0x525b34 and global set (ret 0x525e18).

## GML interpreter: structures and census, 2026-11-26

Evidence: `scratch/runs/20261126-gml-re/` (branch `opt/gml-re`). Taken with the
new `--value-probe` (docs/tracing.md) in a `--control --frozen` session at the
tutorial level. Probes arm `$dbg_any`, so the uop tier is off: every number
below is a **guest-exact count or a guest-instruction share**, not CPU time.
The window is one run/jump/whip cycle of 168–169 GM steps.

Correction to the note above: the main caller of var lookup 0x4a8a30 is the
instance get 0x525de8 (ret 0x525e18, 89%); the global get 0x525b34 is 11%.

### Structure map

- **Value**: 24 bytes, RTTI 0x5436f0. +0 tag (0 real, 1 string), +8 f64, +0x10 LStr.
- **Node**: 0x38 bytes.
  - +0 kind, +4 id (var id / op / function index), +8 owner.
  - +0x10 constant value.
  - +0x28 child count, +0x2c → holder, `[holder]` = inline child array (stride 0x38).
  - +0x30 source position.
- **Expression eval** 0x52786c (eax ctx, edx node, ecx result) is a compare chain, not a vtable:

  | Kind | Meaning | Handler |
  |---|---|---|
  | 5 | constant | CopyRecord from +0x10 |
  | 6 | call | 0x526fc0 |
  | 8 | simple var | 0x527530 |
  | 7 | var with owner/index expressions | 0x527530 → 0x527280 |
  | 1010 | unary | 0x52777c → 0x52649c |
  | 1011 | binary | 0x5277c0 → 0x5265a4 |

  - Unary ops: 203 `!`, 210 `+`, 211 `-`, 220 `~`.
  - Binary ops: 201 `&&`, 202 `||`, 101/204..209 comparisons (also on strings), 210 `+` (also string concat), 211 `-`, 212 `*`, 213 `/`, 214 div/mod. 215..222 go through the jump table at 0x526633.
- **Statements** 0x5288ac (table 0x5288d0):

  | Kind | Meaning | Handler or return value |
  |---|---|---|
  | 13 | if | 0x527f28 |
  | 16 | while | |
  | 17 | do-until | |
  | 18 | for | 0x5281f8 |
  | 20 | repeat | |
  | 21 | exit | returns −2 |
  | 22 | break | returns −3 |
  | 23 | continue | returns −4 |
  | 24 | with | 0x528358; self/other swap at 0x52831c |
  | 25 | return | |
  | 26 | switch | 0x5286b4 |
  | 30 | var decl | |
  | 101 | assignment | 0x527920; child0 is the lvalue, op [+4]: 0x65 `=`, 0x66.. compound |
  | 1000 | block | |

- **ctx**: [+0] self, [+4] other, [+8] locals, [+0xc] code object.
- **Code execution** 0x528b3c (eax self, edx other, ecx code). code+4 kind: 3 constant, 2 expression, else statement. The root is at code+0x10 and is CopyRecord'd to the stack on every execution.
- **Variable read** 0x527530 switches on owner+7 (table 0x5275ac):

  | Owner | Meaning |
  |---|---|
  | −7 | local |
  | −6 | unqualified: a byte flag at `[0x6d2a6c][id-100000]` says global, else self |
  | −5 | global |
  | −2 | other |
  | −1 | self |
  | −3, or ≥ 0 | all / object / instance-id iteration, 0x525e74 |

- **Instance get** 0x525de8. An id below 10000 is a builtin variable and calls the Delphi getter `[0x6c8e1c+id*80]`. Otherwise it looks the id up in the instance list `[inst+0x104]` with 0x4a8a30.
- **Var list** 0x4a8a30 (eax list, edx id, ecx array index).
  - Rows are 40 bytes: +0 id, +8 value, +0x20 array.
  - Lookup is a **linear backward scan** over `[list+4]`, with `[list+8]` rows (loop 0x4a8a4c..0x4a8a5f).
  - The array index `i*32000+j` is split with two `idiv`.
  - Set 0x4a88d4.
- **Calls** 0x526fc0.
  - Arguments go into a stack array of **16 Values**: InitializeArray and FinalizeArray run for every call, whatever the argc.
  - id < 100000: builtin `[[0x58fbe8]]+id*80`, handler at +0x44.
  - 100000 ≤ id < 500000: **script** 0x5290fc. Its code object is `[[0x58f13c]+i*4]+8`. The call saves all 16 `argumentN` Values (16 CopyRecords), copies argc in, zeroes the rest, runs the code, then restores 16 more.
  - id ≥ 500000: extension 0x51da48.
- **Names**:
  - Builtin function: ShortString at `[[0x58fbe8]]+id*80`.
  - Builtin variable: ShortString at `0x6c8dd8+id*80`.
  - User variable: LStr at `[[0x58f134]+(id-100000)*4]`.
  - `scratch/runs/20261126-gml-re/gml-dump.js` reads all three.

### Census (per GM step, tutorial gameplay)

- 5,470 expression evals, 1,190 statements, 640 function calls (65% builtin, 35% script), 255 code executions (87% are script calls).
- **1,300 var-list lookups costing 161,000 scan iterations**, about 124 per lookup.
  - The player's instance list has 204 variables.
  - The hot ones are near the front, so the backward scan crosses almost all of them: `state` 167 rows, `ON_GROUND` 191.
  - The ALL-CAPS "constants" (`ON_GROUND`, `RUNNING`, …) are instance variables set in the create event.
  - The global list has 299 rows.
- **Node kinds**: var 37% (simple 35.8%, owner/index 1.2%), binary 28.7%, const 22.5% (92% real), call 9.9%, unary 2.0%.
- **Var reads**:
  - 91% are unqualified (owner −6), 5% `global.`, 4% `obj.`.
  - 56% user variables in an instance list, 34.5% builtin variables through Delphi getters (`x`, `y`, `sprite_index`, `room`).
  - 95% of results are reals.
- **Operators**: `&&` 21%, comparisons 32%, `||` 13%, `+`/`-` 20%, `!` 6%, `*` `/` 1%.
- **Statements**: if 48%, assignment 22%, return 16%, call 8%, block 5%, with 0.5%.
- **Numeric-only subtrees** (real constants, vars, arithmetic and comparisons, no call or string anywhere):
  - 70% of expression roots.
  - 72% of eval entries fall inside such a root.
- **Hottest calls**:
  - `room_get_name` plus script #211: 14.7k each, called together (a room-name test in a script).
  - `round` 13.4k, `collision_point` 6.6k, `instance_exists` 5.5k, script #56 5.3k, script #20 3.8k (the collision-bounds getter).
  - `collision_rectangle` 3.3k, `collision_line` 3.2k (counts are per window).
- **Concentration**: 84 distinct code objects ran.
  - Share of interpreter work: top 1 16%, top 5 51%, top 10 68%, top 20 84%.
  - Nesting stays under about 3 script levels (the ESP spread at 0x528b3c is ~1.8 KB).
- **RTL traffic**:
  - 11.5k CopyRecord per step: 62% script-call argument save and restore, 11% var-lookup copy-out, 11% constant eval.
  - 18k FinalizeRecord per step, 80% from FinalizeArray. Most of it is the 16-Value call/script argument arrays.
  - The Delphi fold runs FinalizeRecord and CopyRecord natively, but **FinalizeArray almost always falls back**: 4.3k native vs 3.96M fallback since boot.

### Guest-instruction shares (uop tier off, 169 steps, 882 M weighted insns)

`blocks.js setB/hist.json EXE --hle=<fold entries>` (fold HLE blocks weigh 1):

| Share | What |
|---|---|
| **21.6%** | var-list backward scan loop 0x4a8a4c/0x4a8a5b (27.2 M iterations) |
| ~13–15% | object instance table: nth 0x4aeee0 (2.63 M calls, each also calls DynArray length 0x406d64), 0x4aee7c, 0x4aee54 |
| ~14% | GML tree walk itself (eval 2.4, var-read node 2.5, binary node + op 3.7, call node 1.6, script call 2.2, statements/assign/code exec ~2.5) |
| ~6.5% | RTL record + LStr remaining after the Delphi fold |
| ~5.5% | collision: bbox test 0x4aceec 3.0 + scan 0x4e3ed0 2.5 (+ collision-event pass 0x539bb4 ~2) |
| rest | unlabelled runner pages 0x4b0000 (6.5%, hot 0x4b03c0), 0x4af000, 0x55c000, … |

On main, the uop tier runs the scan loop as a resident program (the 20261126 census shows 204 blocks per entry at 0x4a8a4c), so its CPU share there is below its 21.6% instruction share. The old attribute.js "uop%" column undercounted it at 1.8%.

### Recommendation: (c) targeted folds, not a GML evaluator

1. **Var-list lookup fold**: about 20% of guest instructions; the largest single lever and exact by construction.
   - Run the 0x4a8a30 scan natively, as a Delphi-fold-style HLE on the loop or on the whole lookup.
   - Optionally add a validated per-list index hint keyed by list, checked by `rows[i].id == id` with no later duplicate.
   - Exit state is esi/ebx/edi/ecx plus the last cmp's flags. Charge the branch clock per iteration, as the Init/Move folds do, so `--branch-clock` stays invariant.
   - A generic strided-search idiom in the loop matcher would also catch it.
2. **Instance-table fold**: about 10–13%. 0x4aeee0 / 0x4aee7c / 0x4aee54 are pure bounds-checked dynarray reads; fold them with DynArray length.
3. **FinalizeArray fold coverage**: a few %. Find why the 16-Value argument arrays fall back.
4. **(a) Native numeric GML evaluator**: it can remove at most the ~14% tree walk, and only the numeric 72% of it.
   - It still pays the var lookups (item 1).
   - It must reimplement or fall back on the builtin-variable getters (34.5% of reads), GM's real/string semantics and error paths.
   - Revisit only after items 1–2.
5. **(b) Partial evaluation**: no. Its targets are tree shape and constants, while the cost is in lookups and instance loops.

## GM fold (branch opt/gm-fold), 2026-11-26

Evidence: `scratch/runs/20261126-gm-fold/`. Items 1–3 of the recommendation
above, as extra paths of the Delphi fold's handler 395 under a separate
mask (`$gm_fold`, `--gm-fold=N`, default 7; `set_gm_fold` export). The
native code is `$gmf_run` (10-helpers-delphi-fold.wat), which writes no EIP;
the handler applies its result.

- **Matching.** By body signature, never by address: first dword, FNV-1a
  over the body with rel32 bytes masked, plus callee checks. The same bodies
  are in all 13 GM5/GM7/GM8 runner PEs in `test/binaries/candidates`
  (`node tools/delphi-detect.js DIR` prints `gm=`). Metrojd GM7 has them at
  0x4aa378 / 0x4b04f0 / 0x4b048c / 0x4b0464.

| Mask bit | Id | Spelunky VA | What |
|---|---|---|---|
| 1 | 10 | 0x4a8a4c | var-list backward scan loop (21 bytes, 40-byte rows); exit at +0x15 |
| 2 | 11 | 0x4aeee0 | 2-D instance read, fields +0x84 (counts) / +0x80 (rows) |
| 2 | 12 | 0x4aee7c | 2-D instance read, disp8 fields +0x7C / +0x78 |
| 2 | 13 | 0x4aee54 | 1-D instance read, +0x7C |
| — | 14 | 0x406d64 | DynArray length, the callee of 11–13 (checked, registered for SMC) |
| 4 | 4+0x400 | 0x406534 | `_FinalizeArray` kind 0x0E (records) whose only managed field is one AnsiString |

- **Why FinalizeArray fell back.** The id-4 native path took only `ecx == 1`
  with kind 0x0A (one AnsiString). The 16-Value GML argument arrays are kind
  0x0E (RValue records, string at +0x10) with n = 16, so every call fell
  back. The record path is gated at decode on `_FinalizeArray`'s record loop
  (+0xB0) calling the id-3 `_FinalizeRecord` that calls it back (+0x21).
  A last reference mid-array (a free) hands the element to the guest: the
  path rebuilds the record loop's state at its top (+0xA7) after k elements
  and resumes there; k = 0 falls back.
- **Branch clock.** Var scan: 2 per trip; it stops at the loop head after
  any whole trip, where the threaded loop stops when the budget runs out.
  Instance reads: 1 / 5 / 6 / 7 before the RET. Records: 6 + Σ(12 +
  `_LStrClr`'s own) + 1.
- **Latent bug fixed in id 1.** The released path of `_LStrClr` did not set
  CF = 0 (its TEST does), so a caller's CF = 1 leaked through.
- **Index hint: not done.** Checking a hint needs "no later duplicate", which
  is the scan of the rows above it anyway.
- **Exactness** (`--branch-clock`, fold vs `--gm-fold=0`):
  - Spelunky Classic, the sweep2 `spel` route (32700 batches, 6 gameplay
    cycles) on the box: every arm (control module twice, fold module mask
    0 and 7, the split module mask 0 and 7) gives 3413254 API calls, and
    the same digest of the 2 MB runner image hexdumped at 29000 and 32600.
  - Metrojd GM7 (`--d3d9-gps=null --batch-size=100000`, 4000 batches): masks
    7/0/1/2/4 give the same 4407516 API calls; 7 vs 0 give the same image
    dumps at 2000 and 4000.
  - A single headless-GL pair once differed by a diagonal line. Every rerun
    of the same mask matched mask 0, and the image dumps match, so this is
    attributed to headless GL rather than the fold.
  - `test/test-delphi-fold.js` covers var-scan hits, duplicates, misses and
    page-straddling rows; every instance-read branch; record arrays; SMC
    mid-loop, mid-body and callee writes; `set_gm_fold(0)`; and every
    budget.
- **Hit counts, Spelunky route (mask 7).**
  - Var scan: 452999 native / 430 fallback, 45.3 M trips (≈100 rows per
    lookup).
  - Instance reads 2-D wide / 2-D byte / 1-D: 9.65 M / 4.14 M / 6.69 M native.
  - Record arrays: 1.15 M native, 840 resumed.
  - uop blocks fall from 1.84 G to 1.60 G (fold entries leave uop programs).
- **First layout cost.** With the GM paths inline in `$th_delphi_rtti`,
  the handler grew from 9.8 KB to 13.7 KB of Ion code (V8: 20.6 KB to
  23.8 KB). The GM paths now run in `$gmf_run` (commit 7a8196ba6), so Ion
  is back to 10.5 KB. Single box runs had suggested the inline layout cost
  ~10%; the 6-rep lane put both layouts inside the box's noise.
- **Guest-instruction shares.** Method: `blocks.js` on one gameplay cycle
  (29000..29600, `--no-uop --handler-hist-*`, box); fold entries weigh 1.

| | control | fold (7a8196ba6) |
|---|---|---|
| threaded weighted insns / cycle | 111.7 M | 61.2 M (−45%) |
| var-list scan loop | 20.4% | 0.05% |
| object instance table | 16.9% | 1.35% |
| RTL record init/finalize/copy | 4.5% | 3.6% of the smaller total |
| top of the list now | — | collision bbox 0x4aceec 7.2%, collision scan 0x4e3ed0 7.0%, var-read node 4.5%, eval dispatch 4.3% |

- **Timing.** One box: Boat 4 vCPU AMD EPYC, node 24.22.1, x86-64.
  - Method: sweep2 harness, `--branch-clock`, whole-run `/usr/bin/time`
    user CPU, 6 interleaved reps.
  - Arms: n1/n2 are the control d4cb724ef built twice; ctl2/fold2 are
    7a8196ba6 at `--gm-fold=0` / default.
  - The box was noisy: per-arm spread was 8–33%.

| Workload | Measure | n1 median | null band (n2) | fold2 vs ctl2 | fold2 vs n1 |
|---|---|---|---|---|---|
| spel30 (30 gameplay cycles, 47100 batches) | whole run | 66.24 s | +0.52% | **−5.15%** (min −6.21%) | −4.72% |
| spel30 | window 29600:47000 (gameplay) | 16.53 s | +0.97% | **−18.66%** (min −16.19%) | −16.33% |
| spel30 | window 21000:29000 (title → tutorial) | 14.20 s | +0.13% | −11.95% | −12.26% |
| spel (6 cycles) | whole run | 54.95 s | −0.47% | −6.05% (min −3.60%) | −3.27% |
| heroes2_demo (non-GM control) | whole run | 5.06 s | −0.40% | +1.57% | −3.85% (inside the ±20% spread) |

- **Native code** (V8 and SpiderMonkey, arm64 laptop and x86-64 box).
  - The var-scan loop's fast path (same page) has no call.
  - V8 keeps most of the loop in registers; one stack reload per trip on
    x86-64.
  - Ion keeps every loop variable in stack slots, on both architectures.
    Moving the loop into its own small function did not change that (Ion,
    arm64; variant not landed). The likely cause is the cold `$g2w`/`$gl32`
    calls inside the loop: SpiderMonkey's wasm ABI has no callee-saved
    registers.
  - Next lever for Firefox: a call-free inner loop per guest page.

## Ruled out

- The crash labelled `UNIMPLEMENTED API: ... KERNEL32.DLL#18` during splash
  setup was a **mislabel**; the trace showed
  `WebBrowserOleObject_GetClientSite`.
- Slow loading is not an API storm and not the bundled DLLs.
- The post-init exit is not a crash, a failed Present, or input: no keyboard
  read occurs between config load and the end path; the Enter keyup from the
  sound box was consumed by the form before scripts ran.
