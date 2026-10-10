# Reflexive corpus compatibility probe

2026-09-29: sampled five titles from https://github.com/banteg/reflexive.
The project supplies downloads and static installer/executable extraction;
its unwrap coverage is not Wine-Assembly compatibility coverage.
Upstream master observed at `615d946772e344e54ee3a7444d5f0010b68b79ac`.

Local tests compiled the current shared source through `test/run.js`, with
HEAD `8f9f66a8` plus existing worktree changes. No emulator code was changed.
These are CLI startup probes, not browser or performance certification.

## Acquisition

Scratch root: `/private/tmp/reflexive-probe`. Tool source and venv are under
`reflexive-master/`; original installers, extracted trees, wrapper-free games,
logs, and screenshots are retained there. Every downloaded installer passed
the upstream manifest size and SHA-256 validation (`reflexive download`
reported `already_present` after curl downloads).

For each installer, use:

```sh
reflexive download RicochetSetup.exe /private/tmp/reflexive-probe/RicochetSetup.exe
reflexive extract /private/tmp/reflexive-probe/RicochetSetup.exe \
  /private/tmp/reflexive-probe/extracted/Ricochet --unwrap --keep-extracted \
  --unwrapped-root /private/tmp/reflexive-probe/games/Ricochet
```

Other filenames: `ZumaDeluxeSetup.exe`, `CrimsonlandSetup.exe`,
`CollapseCrunchSetup.exe`, `AlienShooterSetup.exe`. All five extracted and
unwrapped successfully. There was no need to run their installers in the guest.

All five are now installed in the local candidate corpus under
`test/binaries/candidates/reflexive-{ricochet-xtreme,zuma-deluxe,crimsonland,collapse-crunch,alien-shooter}/`.
Each fixture has a complete `game/` tree, its original installer in `sources/`,
and `.candidate-source.json` recording the installer SHA-256, upstream tool
commit, and every copied game's file size and SHA-256. All copied game files
were verified against the scratch originals. Manifest entries are manual
because the generic corpus fetcher does not implement Reflexive unwrapping.
For the launch commands below, the corresponding fixture's `game/` directory
can replace the scratch game directory. DLL seeds and full asset mounts are
also recorded in the candidate manifest; the corpus survey does not currently
forward custom screen or input settings.

## Observations

| Title | Furthest observed / blocker |
| --- | --- |
| Ricochet Xtreme | CLI and browser Worker/WebGL Round 1-1 gameplay verified: paddle movement, ball launch, brick destruction and score. Requires bundled IFC22.dll. Earlier splash captures ended during active asset decompression; a longer run reaches the menu without runtime changes. Local fixture includes 351 verified guest-generated cache files. See [Ricochet notes](ricochet-xtreme.md). |
| Zuma Deluxe 1.0 | 2026-10-06: the `QueueUserAPC` error was bass.dll queueing an APC from main to its mixer thread (alertable `SleepEx` loop); fixed by real cross-thread APCs (`92ada66a`, api 4164). Zuma uses a D3D7 device. It now draws the title/loading screen (`scratch/runs/20261006T0540Z-zuma_deluxe-queueuserapc`) but the loading bar stays empty: main runs the PopCap paced update loop (0x4687d0: `timeGetTime`, virtual update `[edx+0x14]`, `Sleep(2)` at 0x468843); T1 (0x430140) is an idle job runner (`WaitForSingleObject(ev,1000)`, run `[esi+0xc]`, `SetEvent([esi+8])`) and never gets a job; T4 polls `[esi+0x2f1]` with `Sleep(10)` after `call 0x450550` (0x464e80..0x464eea). **Those leads were wrong** (T4's `[esi+0x2f1]` is the shutdown flag, set by 0x464580; normal): the real blocker was the loader thread T5 (CRT start 0x4e252a, `CreateThread` with stack size 0) dying in `_alloca_probe` (0x4e2130..0x4e2166) right after reading `fonts/arial12bold.txt` — its frame is larger than the 64KB stack we gave every thread, the probe walked off the bottom and it returned to 0. Windows gives such a thread the EXE's SizeOfStackReserve (Zuma: 1MB); fixed in `lib/thread-manager.js` `_threadStackReserve`. The loader now opens 1235 files, the bar fills and **CLICK HERE TO PLAY!** appears (`scratch/runs/20261006T0555Z-zuma_deluxe-thread-stack`, end.png). The headless click on that text **does register** (WM_LBUTTONDOWN/UP reach the wndproc at 0x4688xx's pump; the game plays a sound, restarts a DirectSound buffer and `QueueUserAPC`s bass's mixer thread), but the captured frame then stops changing. Do not read the main thread's API log as "the game stopped drawing": in steady state main only pumps WM_TIMER and `Sleep(2)`s, and its whole run shows 2 `Flip` / 5 `EndScene` — the drawing is on another guest thread (likely T4, 0x464e80..0x464eea), which `--trace-api` does not see. WebGL in the browser: the loading bar fills (`scratch/runs/20261006T0630Z-zuma_deluxe-webgl`); click-to-play there not yet run. **The post-click freeze was PopCap's screen-saver gate, not a thread** (claude:65967384, 2026-10-06): DrawDirtyStuff (0x46dc10) returns early while the byte `[0x57ef14]` is set, and 0x464670 (called once a second from it) sets that byte when `SystemParametersInfoA(SPI_GETSCREENSAVEACTIVE)` says a saver is active and the idle time exceeds `SPI_GETSCREENSAVETIMEOUT`. We failed both queries, so Zuma kept its presets -- active, 1 second -- and stopped drawing one second after the last input (main kept updating; T4 is only a GetCursorPos poller). Fixed by publishing a no-saver machine (active FALSE, timeout 900, running FALSE) in `$spi_core`. With it the default CLI clock goes click -> New User -> menu -> Adventure -> Instructions -> **Level 1-1 with the chain advancing and the frog firing** (`scratch/runs/20261006T0958Z-zuma_deluxe-w4-spi`, l1/l3/l5.png). Route (batches, default clock): click 320,450 @285000; keypress 87,52 @300000/301000; Enter @303000; Adventure 540,100 @315000; Play 600,460 @346000; Instructions OK 560,452 @380000; level by 400000. `dump-mem` lengths are decimal (a hex length silently becomes 256). Zuma.exe is packed: disassemble from `--input=B:dump-mem:` with `tools/disasm-dump.js`, not the file. |
| Crimsonland | Displays `DirectX8.1 or newer not detected`. Explicitly seeding grim/vorbis/vorbisfile/ogg DLLs does not resolve it. A per-run registry override of DirectX `Version` to `4.09.00.0904` also did not resolve it; the exact detection path remains untraced. Screenshot `crimsonland-dx9.png`. |
| Collapse! Crunch | Default 640×480 is rejected. `--screen=800x600` renders the game's loading screen and starts guest threads. Initial 35-second run reaches batch 310 without an API trap (`collapse-800.png`). A longer run then reports a guest call through NULL at batch 317, ends after 41.836 seconds, and captures a black client area (`collapse-long.png`). Scheduled input starts at batch 500 and never fires. No gameplay confirmed. |
| Alien Shooter | Main menu verified with native WebGL and software rendering after implementing DirectSoundCreate8 and fixing the backbuffer owner's device identity. Mission 01, character/camera movement and aiming verified in a fresh software CLI run with `--tick-ms-per-batch=5`. Combat and browser gameplay remain unverified. See [Alien Shooter notes](alien-shooter.md). |

Collapse performance follow-up: a real-GPU, headful browser with Threads enabled
presented 516 frames in 22.616 seconds on an active Crunch board (about 22.8/s),
but its final rolling rate fell to 1.08/s. Page cadence stayed at 60 FPS, with
zero long tasks. This establishes uneven guest presentation, not its cause;
host load was extreme during the investigation (one-minute load reached 196).
The static menu also legitimately presents rarely. Do not interpret the HUD's
thread phase share as CPU utilization. Evidence: `/private/tmp/reflexive-probe/`
`collapse-fps2.log`, `collapse-fps-board2.png`, `collapse-fps-end2.png`.

CPU/wait follow-up (2026-09-29): `collapse-cpu-game.log` and the raw profiles in
`/private/tmp/reflexive-probe/collapse-cpu-game/` cover an actual Crunch board
with browser Workers, hardware GPU and RPC census. The first `collapse-cpu`
run covered loading/menu instead and must not be called gameplay. Gameplay
route at the profiler's default viewport: `click:147:277@1,click:190:277@8`
after 20 seconds warmup; verify the final screenshot because startup varies.

Across the final 17.998 seconds of wait snapshots, the main Worker completed
116,880 slices (6,494/s) while every snapshot remained at GetMessage return
`0x42a54e`, yield 7, usually one retired block per slice. Its 20-second V8
profile attributes 2.220s to postMessage and 3.392s to handleMessage/send
wrappers, versus only 81ms directly in exported `run`. The page additionally
attributes 1.485s to worker.onmessage and 846ms to postMessage. These are
sampled durations under load, not OS thread CPU utilization. This is concrete
empty-slice/message overhead; inspect `host.js` `_workerParkMain`, the yield-7
branch and `ThreadManager.freeRunParkBound` before tuning the renderer.

The draw/update Worker has 10.861s sampled non-idle time, including 1.864s
(17.2%) in native GDI BitBlt, plus interpreter work and 564ms in synchronous
host-response waits. Function 10693 is the blitter in the captured artifact;
current combined.wat indices have shifted, so resolve against the captured
runtime rather than blindly naming the current index. Two auxiliary workers
spend 16.116s and 13.240s in waitStepEpoch/Atomics.wait: these are short sleeps,
not CPU burn. The profiler's generic "busy" total includes those waits.

No permanent block was observed. In the final snapshot interval the draw
thread advances 605 slices and issues 158 surface uploads; its sampled event
wait deadlines are 43–46ms. Background slot 4 wakes six times from a 3000ms
event wait. Draw-thread critical-section parks increase by only two, with no
bad leaves; the large cumulative count is mostly earlier contention. Loader
slot 3 has exited normally. Main-worker messages, multimedia SetEvent calls,
audio submissions and drawing continue. Host load 41 during this run prevents
claiming a clean throughput benchmark or a measured benefit from a fix.

The subsequent gameplay census identifies the expensive BitBlt shape:
50 declines in ten seconds, all for complex clips (reason 1), covering
24,000,000 pixels—exactly 50 full 800×600 transfers. The decline counters live
in shared memory; do not sum their identical readings across Workers.
Collapse's sole BitBlt call at `0x40a3e3` uses SRCCOPY, and its DIB constructor
at `0x403e3d` creates a top-down 32bpp bitmap. Evidence:
`/private/tmp/reflexive-probe/collapse-ab/before2/result.json`.

The generic raster loop now copies 32bpp SRCCOPY pixels directly after its
existing visibility and bounds checks, avoiding destination reads and repeated
color/ROP conversion. Other formats and ROPs retain their prior paths;
overlap traversal and reserved-byte clearing are unchanged. The existing
BitBlt widening regression includes 24 independent byte-oracle cases for clip
holes, source/destination bounds, row orientation, padding and overlap;
all 12 checks plus the 10 decline checks pass. An isolated, byte-identical
799×599 overlapping-copy benchmark measured mean process CPU of 559.6ms
before and 200.0ms after for 20 copies (64.3% reduction across two A/B/B/A
cycles). That synthetic result is not a gameplay FPS claim. Reproduce with
`node /private/tmp/reflexive-probe/bitblt-bench.js`; raw results are in
`/private/tmp/reflexive-probe/bitblt-bench.json`.

Follow-up BitBlt diagnosis (2026-09-30): the saved post-EMMS active-play
profile still spends 3.522s of 21.881s sampled time inside BitBlt (16.10%,
including callees): 2.533s in the raster loop itself, 500ms in region
membership, and the rest mostly in DC/window/clip lookups. These are sampled
durations, not an isolated CPU benchmark. Function names were resolved from
the captured EMMS source closure, not current function indices. The raster
fragment's executable WAT remains identical to that closure (comments differ).
The same run's draw-worker counters record 234 complex-clip declines spanning
112,320,000 requested pixels, exactly 234 full 800x600 rectangles. Do not sum
the shared decline histogram across workers.

A fresh frozen-runtime 12-click gameplay capture confirms 150 reason-1
declines / 72,000,000 requested pixels and 22 fast-path hits. The screenshot
shows active gameplay, score 94. High local host load makes its timing
unsuitable for speed claims. Between-call snapshots show no application clip
and a single full-window system clip: the expensive application region is
transient, so inspecting only the settled DC misses it.
Two subsequent probes armed guest breakpoints at the BitBlt import thunk and
the preceding guest block `0x40a3b4`, but neither snapshot stopped there;
both still observed the normal update-loop EIP. Their snapshots therefore
do not establish the transient region's rectangle count or visible area.

The remaining algorithmic cost is concrete: the fallback visits every pixel
in the requested rectangle, calls the general surface/bounds/address helper,
and checks cached row visibility. A row intersecting multiple clip intervals
sets cache state 2, which re-enters full DC/region membership per pixel. The
previous SRCCOPY optimization removed destination reads and RGB/ROP work but
kept that traversal. The next candidate is to intersect source/destination
bounds and canonical clip bands once, then copy only visible row spans with
incrementing pointers. Preserve overlap order and clear the reserved byte
(`source & 0x00ffffff`); unconditional `memory.copy` does not preserve that
existing output contract. No new raster optimization was made in this debug
pass. Artifacts: `/private/tmp/reflexive-probe/bitblt-profile-breakdown.json`,
`bitblt-debug-run/result.json`, and `bitblt-debug-run/end.png`.

The subsequent fix adds a second 32bpp SRCCOPY fast path after the
single-rectangle path declines. It intersects the application's canonical
region rectangles with USER's system clip and the DC target bounds, then
reuses the existing XRGB row loop for each nonempty intersection. Source and
destination surface clipping stays in that loop. Clip-edge arithmetic uses
i64 before clamping to the requested extent. Overlapping backing ranges,
including different base pointers into one allocation, retain the existing
generic traversal; reserved bytes are still cleared. Counter 10 of
`test_gdi_fast_count` counts band-path calls. Reason-1 declines continue to
describe the first fast path, while counter 9 now counts only pixels that
actually reach the final per-pixel fallback.

Validation: 13 BitBlt widening checks (including independent byte oracles for
24 clip/bounds/orientation/padding/overlap cases, explicit band-path coverage,
both clip operands, shifted DC origins, empty clips and large coordinates),
10 decline-counter checks and four bulk-blit checks pass. Fragment balance,
logical-AND and diff checks pass. A frozen-runtime 40-click real-browser
gameplay run ends at score 2808 with 549 blocks left, no crash. All 672
complex-clip copies use the band path; fallback pixel count stays zero.
The raster change is the only difference from the earlier EMMS runtime.

An isolated 800x600 copy with two disjoint 350x600 visible clip rectangles
compares matched before/after modules in two ABBA cycles, 30 copies per arm.
All destination bytes agree, including untouched holes and reserved bytes.
Mean process CPU falls from 362.092ms to 52.894ms (85.4% less, 6.85x).
This is a kernel benchmark, not a gameplay FPS gain; host load was high and
the actual game's transient clip geometry was not captured. Reproduce with
`/private/tmp/reflexive-probe/build-bands-bench.js` and `bands-bench.js`;
results are `bands-bench.json`, gameplay artifacts `bands-gameplay-after/`.

Remote follow-up (2026-10-01): `fast-near-9tb-1` was idle (load 0.00) before
four sequential ABBA 40-click runs and two separate profiling runs. These
use the same frozen host/runtime closure as above, changing only the band
path, with Node 24.15.0 and headless Chrome 152/SwiftShader. There is no
display server, so their present rate is not player-visible FPS. Software
GPU emulation accounts for most browser CPU; renderer-process CPU is
reported separately. Boards and animation loads are not pinned.

The unprofiled renderer CPU/present results are inconclusive: before
55.17/55.63ms, after 53.92/65.86ms; weighted means 55.40 versus 58.76ms.
The after runs rescue 748 and 446 complex-clipped copies and have zero
fallback pixels, versus 233.76M and 232.80M fallback pixels before. All four
routes survive. These results do not establish a whole-game speedup.

The separate matched profiles do establish that the targeted cost is gone:
BitBlt inclusive sampled draw-worker time is 3333ms / 30511ms before
(10.92%) versus 60ms / 30387ms after (0.20%). The latter completes 765
presents versus 500 before, rescues 643 band copies and scans zero fallback
pixels. This is diagnostic sampling across different boards, not a claim
that the whole game improved by the same ratio. Function indices were
resolved from each frozen build's source, not the current worktree.

Remaining draw-worker self-time leaders after the fix are `$uop_fast`
1716ms, `$branch_end_at` 831ms, `$th_load32_rop` 591ms, `$run` 531ms,
`$th_push_r` 463ms, `$win32_dispatch` 458ms, `$decode_block` 399ms and
`$th_store32_rop` 335ms. `waitForResponse` contributes 404ms and idle
18098ms; neither is evidence of CPU spinning. Main-worker idle is 29991ms
out of roughly 30 seconds. Helper workers mostly wait in `waitStepEpoch`.
No stuck scheduler was observed. Further optimization should measure guest
code on a fresh current-main build first: these intentionally frozen arms
predate later micro-op and host changes from other sessions.

Evidence: `/private/tmp/reflexive-probe/bands-remote-results/summary.json`,
`profiles.json`, the raw per-worker profiles and screenshots in the same
directory. Isolated remote artifacts remain in `/home/vg/collapse-bands-bench`;
all benchmark/browser processes were closed after capture.

The scheduler fix makes `freeRunParkBound` recognize unsatisfied helper waits
and their deadlines instead of treating them as runnable. Real browser windows
using identical WASM and otherwise frozen host scripts measured 4,823–4,912
main slices/second before versus 43–46 after (about 99% fewer). Presents stayed
near 9–11/second. Worker scheduler tests cover finite/infinite waits, timeout
expiry, consuming auto-reset signals exactly once, immediate signaled-worker
dispatch, runnable siblings and serial mode; all 51 checks pass, along with
existing browser parking/wakeup and ThreadManager tests.

Both fixes together reached and advanced the Crunch board in two further
windows (43–54 main slices/second, 8.5–16.9 presents/second). These runs were
under changing heavy host load and the raster candidate also uses a newer
shared source snapshot than the original baseline, so this is functional
acceptance, not a controlled whole-game FPS gain. Raw windows, process CPU
counters and screenshots are in `/private/tmp/reflexive-probe/collapse-ab/`;
`summary.json` records the rates. The independent raster microbenchmark is
the matched before/after evidence for the pixel-copy optimization.

Build validation: the full build passed the preceding ABI, API, layout and
browser cache/signature gates, then stopped at unrelated stale generated
toy-VM browser bundles. Those files were left to their owner. The canonical
WAT compiler is run separately to refresh native and compatibility artifacts;
this does not turn the failed full-build check into a pass.

Crash fix: the failing instruction is `40145f` (`call [eax]`) in a lock guard,
not a critical-section return. The shared object at `7ef083d0` lost its vtable
(`4883b4`); both rendering and background workers subsequently called through
freed/corrupted storage. Its AddRef/Release methods (`401270`/`401280`) call
InterlockedIncrement/Decrement **before** taking the object's lock. Those
emulator handlers used separate loads and stores, allowing lost reference
updates across real Workers. The same object corruption also reproduced with
the micro-op tier disabled, excluding an optimizer-specific failure.

The four DWORD Interlocked handlers now use atomic WASM read-modify-write
instructions on aligned guest pointers. Return values, stdcall cleanup,
code invalidation and page-watch notifications are preserved; unaligned and
discontiguous page-crossing compatibility paths retain their previous behavior.
`node test/test-wat-locks.js` passes all 19 checks, including new two-Worker
increment/decrement/compare-exchange/exchange races. Replacing only those
handlers with the old versions makes all four race checks fail.

Two fixed real-browser runs each survived 180 gameplay clicks with all live
workers intact and the object's vtable/reference count valid. The second
reached level 2, score 27,405. Artifacts are in
`/private/tmp/reflexive-probe/collapse-atomic-{fixed,final}/`; the matched
source closure and before/after modules are `interlocked-*` in the parent
directory. This is crash acceptance, not a claim of improved frame rate.
The matched old-handler browser control survived 120 clicks on this attempt;
the race is timing-dependent, so one surviving old run is not a negative
control for crash absence. The reproducible negative control is the four
concurrent API tests above; earlier old-build gameplay crashed with either
micro-op setting. Both fixed runs finished with the object's reference count
back at one, while this old control's final sample was four.

The runner warns that shell32.dll and ole32.dll are missing locally. Do not
confuse those environment warnings with the concrete blockers above.
Use `--no-close` for these probes; the runner otherwise injects WM_CLOSE on
some window-show paths (observed repeatedly in Alien Shooter's first run).

## Reproduction

```sh
node test/run.js \
  '--exe=/private/tmp/reflexive-probe/games/Ricochet/Ricochet Xtreme/Ricochet.exe' \
  --dll-seed=IFC22.dll '--vfs-include=**/*' --no-close --quiet-api \
  --max-batches=30000 --batch-size=20000 --max-seconds=35 \
  --png=/private/tmp/reflexive-probe/ricochet.png

node test/run.js \
  '--exe=/private/tmp/reflexive-probe/games/CollapseCrunch/Collapse! Crunch/Collapse3.exe' \
  '--vfs-include=**/*' --screen=800x600 --no-close --quiet-api \
  --max-batches=30000 --batch-size=20000 --max-seconds=90 \
  --input=500:keypress:13,1000:keypress:13,2000:keypress:13 \
  --png=/private/tmp/reflexive-probe/collapse-long.png

node test/run.js \
  '--exe=/private/tmp/reflexive-probe/games/AlienShooter/Alien Shooter/AlienShooter.exe' \
  '--vfs-include=**/*' --no-close --quiet-api --input=50:dlg-click:1 \
  --max-batches=30000 --batch-size=20000 --max-seconds=45
```

## Wrapper-free executable SHA-256

```text
Ricochet.exe     9f8c00daccb9dfff9806229fd1f427d85c22ce0581e94f7ca6939f0dc00e5bd8
Zuma.exe         60bf0df7695914e4f8238b5c99f665b8484d3c0dea9378389f95244c9712446c
crimsonland.exe  93cdcdc872c836e75122e3a1d41312c74761cf4736181d3541521e82f6cb2031
Collapse3.exe    7f581e685db736239993efa843b145d085372c90c2d094f9fa4f1a3772947edb
AlienShooter.exe aae2547ccec2e235344bc9cf6e5e9ef4c9923b13c9e8fbd1fe14c65b64252446
```

## Collapse performance: MMX islands and fusion experiments (merged from fe92af9a)

Restored 2026-10-06 from the laptop checkpoint `fe92af9a` (branch `checkpoint/local-before-box-sync-20261005`), where this work was written 2026-10-01..04 and never reached main. It is the measured background for MMX-PREDECODED-ISLAND-20261006. Paths under `/private/tmp` are that laptop's scratch and are not in the repo. The integer-expression sections of the same commit (its lines 1705-2071) are omitted here.

Current-port follow-up for low FPS: a separate headful Chrome against 8080,
with service-worker isolation established before launch, captured all guest
workers during 40 clicks. Artifacts:
`/private/tmp/reflexive-probe/collapse-current-workers/`. In 30.364 seconds,
599 presents gave 19.73 presents/s; interval median 33.57ms, p95 183.03ms.
Draw worker (profile filename thread-6, host thread slot5) sampled 23.427s idle,
6.622s WASM, 0.181s synchronous RPC wait, and 0.266s other: approximately
76.8% idle and 21.7% WASM. This route is not continuously CPU-saturated;
it does not rule out expensive individual animation frames. Its CS wait
counter rose only six, from 8328 to 8334; the separate helper rose 1422.
Both draw snapshots are at 42e00f with an event wait timeout of 69ms.
There were 526 band-copy hits and zero generic fallback pixels. Host present
work took 522.13ms across 605 flushes (0.863ms average, 3.22ms maximum).
Main page sampled 27.681s idle. Helper waitStepEpoch samples represent parked
wall time, not equivalent CPU burn. Do not assign WASM indices using the
current combined.wat: its timestamp differs from the served module and the
module has no name section. This capture supports investigating event/timer
wakeups and dirty-draw decisions for the long gaps; it does not establish
whether each gap is deliberate suppression, a late wakeup, or expensive
burst work. Earlier guest disassembly establishes a 36ms update target and
dirty/late draw suppression, not a universal 28 FPS presentation ceiling.

Follow-up gap traces resolve the long-gap question for this click route.
Scratch harness `/private/tmp/reflexive-probe/collapse-gap-trace.js` wraps
page-side event signals, wait resolution, draw-worker slice start/end and
presentation without enabling debug block counters (which disable fast paths).
`collapse-gap-trace/events.json` recorded 844 timer signals on event 917504:
interval median 35.955ms, p95 37.685ms, maximum 43.36ms. Signal-resolution to
slice-start latency was median 0.085ms, p95 0.18ms, maximum 4.88ms; all waits
completed signaled, none timed out. Even the longest 216.70ms presentation
gap contained six signals and completed worker iterations. Slice execution
was median 4.13ms, p95 6.70ms, maximum 15.07ms. This is not a 217ms scheduler
stall or one 217ms rendering operation.

`collapse-gap-state/` additionally reads the stable draw-loop frame while the
worker is parked: EBP-0x14 is the update count, EBP-0x18 the consecutive late
skip count, and EBP-0x24 the game object pointer. It recorded 845 updates in
30.396s (27.8/s), with zero late skips at all 845 completed waits. Object byte
+0x1d6 was clear at each sampled slice start/end. Disassembly at 42d6dc tests
that byte and exits at 42d761 when clear; +0x1d8 is the nonzero surface pointer
(the scratch JSON unfortunately labels that pointer `dirty`; the actual flag
is bits16..23 of its `flags` field). Long gaps still contained advancing update
counts, zero late skips and short completed slices.

An isolated diagnostic `--force=1` run (`collapse-gap-forced/`) sets the redraw
byte before each draw-worker slice. It produced 824 presents/30.323s = 27.17/s,
with no gaps over 100ms and maximum gap 84.26ms, versus 16 gaps over 100ms and
maximum 184.16ms in the preceding unmodified state trace (25.66 presents/s).
The forced run still performed approximately 27.8 updates/s and no late skips.
Together with the live counters and disassembly, this supports dirty-draw
suppression as the cause of these long presentation gaps. The two routes are
not deterministic identical boards and this is not an optimization benchmark.
Forcing redraw can merely resend unchanged imagery; it is not a gameplay speed
fix and is not retained in production. All diagnostic browsers closed; no
runtime, default, or build artifact was changed. Other particle-heavy scenes
may still be guest-CPU limited and need their own capture.

Dirty-flag producer clarification: update walkers at 42d25e and 42d76f call
each child object's vtable+0x3c method with the update counter and region
arguments. They test AL and set game+0x1d6 only for a nonzero return
(42d2d6, 42d365, 42d7e5), then merge the reported region. The explicit
invalidation path at 42dcf6 sets it at 42dd24 for a full invalidation or a
nonempty supplied region. Render paths clear it at 42d0c3 and 42daf3.
Thus an update tick alone does not request presentation: a child must report
visual damage or an explicit invalidation must occur. The previous trace
establishes the gate's effect, not correctness of every child's return value;
an emulation error in change detection remains possible if visible animation
is demonstrably missing. Forced redraw alone does not prove that the newly
presented frames contain different pixels.

Pixel comparison and plain Node/WASM follow-up (2026-10-01): scratch browser
capture `collapse-pixels-v2/` reads the actual attached top-level game canvas,
not hwnd10002's metadata-only child. The first `collapse-pixels/` attempt used
the wrong canvas and threw; exclude it. In the valid quiet forced-redraw
phase, 100 of 138 compared presentations were byte-identical to their immediate
predecessor. The other 38 changed. This demonstrates substantial duplicate
presentation, not proof that every potentially missed animation is correct.
Readback/comparison itself cost median 3.7–4.4ms per presentation, so this is
not an uninstrumented FPS benchmark. The initial group chooser also classified
some blue background as a tile; its claimed group sizes are not valid.

That run's phase named `settled-normal` unexpectedly captured a board-wide
particle effect, not a quiet scene: 83 updates/5.085s and 65 changing presents,
with 3.823s in draw-worker slices and repeated stops inside 4285e0..428900.
The following forced phase remained particle-heavy, so do not treat those two
phases as a quiet-board redraw A/B. A follow-up without pixel reads or forced
redraw (`collapse-timing/`) reached 289 updates and 282 presents in 10.407s of
clicks. Its nominal bomb/effects phase did not reproduce the heavy explosion;
it stayed at 392 updates/14.106s. Browser sessions ended; subsequent work uses
the Node/WASM runner directly, as requested, with no Chrome dependency.

The deterministic CLI route reaches ordinary gameplay (score15,616 blocks at
batch25000), the board-wide particle effect (screenshot at batch35000), then
the retry dialog by batch40000. Cooperative CLI scheduling differs from the
browser; these are CPU/guest-time measurements, not browser FPS. Reproduction:

```sh
node test/run.js --app=collapse_crunch --no-build --no-threads \
  --screen=1000x750 --quiet-api --no-close --stuck-after=0 \
  --tick-ms-per-batch=1 --batch-size=20000 --max-batches=50000 --max-seconds=90 \
  --input=6000:click:217:300,11000:click:134:100,12000:click:188:235,13000:click:269:180,14000:click:782:289,15000:click:674:532,35000:png:/private/tmp/reflexive-probe/collapse-node-late35.png \
  --cpu-window=30000:35000,35000:40000,40000:45000,45000:50000 \
  --cpu-prof-window=35000:45000:/private/tmp/reflexive-probe/collapse-node-late.cpuprofile \
  --png=/private/tmp/reflexive-probe/collapse-node-late-end.png
```

Disable the default stuck detector: it falsely stops on ordinary WaitMessage
at 429e45 after11 same-EIP batches. This route uses the existing artifact,
not an auto-build. `collapse-node-late.log` records user+system CPU of
4.877s for30000..35000,17.603s for35000..40000,2.237s for40000..45000,
and2.033s for45000..50000. Each is5s of configured guest batch-clock time;
these intervals contain different workloads. An earlier ordinary-board run
used2.984s CPU for20000..25000. No trap or unexpected process exit occurred.

The35000..45000 V8 profile covers20.782s sampled wall time,80.0% in WASM.
Leading self samples: actual-module function1306 ($uop_fast)55.6%,10820
($gdi_rgn_boolean_sweep)10.7%, JS_threadEntries6.2%, JSrunSlice4.4%, CLI main
3.6%;10757 ($gdi_raster_bitblt_fast32)0.6%. Current combined.wat indices
are not authoritative. `verify-profile-names.js` disassembles the actual
binary with WABT:10820/10757 match the known frozen band module's10781/10718
instruction-for-instruction after normalizing function/global reference
indices and type indices. Function1306 has the micro-op dispatcher structure,
with extra opcode arms relative to frozen1297. Keep raw profiles for exact
attribution; slice-end guest EIPs are not sampled CPU percentages.

`particle-current-node.js` separately executes the exact4287ef..428826 blend
body with a counted outer loop,200000 iterations, on the current artifact,
interpreter versus explicitly precompiled micro-ops. Four samples per arm
average44.70875ms and17.5165ms process CPU (2.55x); destination pixels, all
general/MMX registers, flags and x87 tags agree. The micro-op path compiles
without declines. This confirms existing acceleration and supplies a native
Node kernel benchmark; it is not a new optimization or a whole-frame result.
Remaining measured directions are micro-op/particle execution and region
combination work, rather than bulk BitBlt copying. No production defaults or
runtime sources were changed in this investigation.

Hot-loop attribution and disassembly (2026-10-01): an isolated copy of the
current binary wraps `$uop_run` and `$gdi_rgn_boolean_sweep`, preserving their
original bodies and routing timestamp markers through the existing log import.
`/private/tmp/reflexive-probe/make-hot-profile-binary.js` produces the module;
`hot-profile-preload.js` records calls during guest ticks35000..39000 into
`hot-attribution.json`. This is instrumented inclusive wall duration, not a
speed benchmark or per-instruction CPU measurement. The end PNG at batch40000
is byte-identical to the uninstrumented route's batch40000 PNG.

Of 11,137.17ms across 2,245,531 timed micro-op program calls:

| Guest program entry | Calls | Inclusive ms | Share of timed uop duration |
| --- | ---: | ---: | ---: |
| 4287ce | 839,487 | 5,438.35 | 48.8% |
| 4287b0 | 476,690 | 4,018.44 | 36.1% |
| 4095f2 | 20,378 | 464.45 | 4.2% |
| 428bac | 14,551 | 225.28 | 2.0% |
| 4095ba | 36,867 | 189.20 | 1.7% |

The first two entries execute portions of the same particle function4285e0;
their compiled programs include following instructions/branches, so the first
row does NOT mean the IMUL instruction alone consumes48.8%. Entries within
4285e0..428900 total9,783.14ms (87.8%). Full guest disassembly is retained in
`/private/tmp/reflexive-probe/collapse-code.txt`.

The renderer walks live particles and draws an8x8 patch for each. Its inner
loop looks up intensity, applies a table-selected shift and a life/opacity
scale, then chooses transparent, opaque or partial-alpha output:

```asm
4287b0  mov cl,[edx+0x498d88]       ; intensity shift
4287b6  mov eax,[0x498dc0+esi*4]    ; intensity
4287bd  sar eax,cl
        ; increment table indices, load opacity, compare against64
4287ce  imul eax,ecx
4287d1  sar eax,6
        ; opaque => direct pixel store; zero => skip
4287f4  movq mm2,[esp+0x50]        ; source channels
4287f9  movd mm7,[edi]             ; destination pixel
4287fc  pxor mm5,mm5
4287ff  punpcklbw mm7,mm5
428802  psubw mm2,mm7
        ; load alpha, halve it, replicate across word lanes
428814  pmullw mm2,mm3
428817  psraw mm2,7
42881b  paddw mm2,mm7
42881e  packuswb mm2,mm5
428821  movd [edi],mm2
428824  emms
        ; advance destination, decrement column count
428837  jnz 4287b0
        ; advance row, decrement row count
428850  jnz 428795
```

This is already compiled into micro-ops, and the MMX handlers already use
WASM SIMD arithmetic. Each operation still dispatches and accesses emulated
MMX register storage. A fused blend/loop could keep intermediates live across
operations; it must preserve16-bit multiply wrap, shifts, saturation, memory
effects and final architectural state. No new optimization variant or native
JIT capture was made here; native V8/SpiderMonkey disassembly is still needed
before attributing the cost specifically to host spills or register allocation.

The second hotspot is region algebra. The same instrumented window records
22,906 sweeps totaling2,413.36ms. Of these,22,869 have a one-rectangle RHS.
RGN_OR accounts for21,745 calls/2,253.96ms; RGN_AND for1,161/159.40ms.
`$gdi_rgn_boolean_sweep` repeatedly scans input rectangles for each next Y
edge, each X edge and containment query. This is rectangle bookkeeping, not
pixel copying; a band merge or single-rectangle union path is a distinct
optimization from BitBlt/memory.copy.

There is also a capacity issue:2,374 OR sweeps return-1. The fixed region limit
is208 rectangles; the [208,1,RGN_OR] bucket alone has2,117 calls,489.22ms and
1,967 failures. `$gdi_rgn_combine` returns failure and leaves the destination
unchanged. Guest helpers4041c0/404210 call CreateRectRgn, CombineRgn(OR), then
DeleteObject without checking CombineRgn's return (calls4041f4/404245).
Thus the game can lose region additions under this particle workload. This
does not establish that the earlier quiet-board redraw suppression has the
same cause. Region capacity/correctness deserves attention alongside its
algorithmic cost; merely making the current overflow path faster is inadequate.

Native MMX inspection (2026-10-01): parallel diagnostic work captured function
1306 from the same frozen module, SHA256
`65985dbecf428a305951d3ca1fe55fa951ae979907a791d437911ec79a8f4ff5`.
`/private/tmp/reflexive-mmx-native/report.txt` records commands, relative native
offsets and provenance; `v8.txt`/`ion.txt` and their `.bin` files retain the full
captures. Initial ARM64 engines: jsvu V8 15.4.49 TurboFan and SpiderMonkey155
Ion. A follow-up also captured the exact profiling runtime, Nodev24.21.0 /
V8 13.6.233.17-node.53, into `node1306.bin` and `node1306.txt`. All use the
same frozen WASM. TurboFan was forced with `--no-liftoff` and
`--no-wasm-lazy-compilation`; this verifies optimized code, not natural tier
residency at every instant of the gameplay profile. No x86 capture or new
optimization variant was made.

All three native outputs retain register-file loads/stores between MMX operations.
The `pmullw mm2,mm3; psraw mm2,7; paddw mm2,mm7` path has five64-bit
register-file loads, three64-bit stores and six indirect dispatches (main
micro-op plus MMX subop per instruction). This excludes accesses to the
micro-op operand stream, jump tables and instance metadata. The alpha
broadcast triplet also has five loads/three stores, including duplicate
source loads for self-unpack operations.

Representative d8 V8 15.4 PMULLW native code, relative to function1306:

```asm
+a04  dup v0.2d,x6
+a08  dup v1.2d,x4
+a0c  mul v0.8h,v0.8h,v1.8h
+a10  mov x4,v0.d[0]
+a14  b shared_store
      ; shared_store, also used after shift and add
+b3c  ldr w5,[x5,#8]      ; destination cell address from micro-op
+b40  str x4,[x3,x5]      ; final cell value
+b44  add w0,w0,#20
+b48  b main_dispatch
```

The common MXOP prefix loads both operands before dispatching on its subop.
Consequently, register MOVQ still loads the unused old destination, and
PXOR-self still loads the same cell twice and XORs the two values. Raw native
jump-table entries confirm both paths. The guest literal shift7 is data in
the micro-op stream, so native PSRAW still clamps a runtime count, constructs
a vector count and uses a variable shift. Ion additionally spills/reloads
the micro-op PC each iteration; V8 keeps it in w0. These observations do not
assign CPU percentages to individual instructions or imply cache misses.

A fused multiply/shift/add could use three input-cell loads, one final store
and one main dispatch while keeping SIMD intermediates live. A self-broadcast
fusion could use one input load and one store. These are candidate reductions,
not implemented or benchmarked speedups; aliasing and all guest-visible final
register values must remain correct.

Exact Node13.6 native offsets: MXOP+760..774 loads its two source values,
MXSHI+748..758 loads one, PMULLW+b4c..b5c is dup/dup/mul/extract/branch,
and shared+d38..d48 loads the destination-cell pointer, stores the value,
advances PC and dispatches again. The same five-load/three-store/six-dispatch
triplet count holds. Node's PUNPCKLWD uses ten native instructions including
shuffle-constant construction and TBL, versus five with ZIP1 in d8 15.4;
PACKUSWB uses twelve versus seven. These static path lengths include the
branch and are not cycle counts. Node also copies its micro-op PC to the
stack at each main dispatch, though the active PC remains in w0.

Dynamic MMX census (same frozen binary, parallel Node diagnostic):
`/private/tmp/reflexive-mmx-census/make.js` instruments actual opcode74/75
dispatches in function1306. A fresh local resets sequence state on the first
non-MMX dispatch after MMX; entry callbacks reset at each invocation. The
preload also requires consecutive20-byte micro-op addresses and resets on
guest tick/window changes. Counts are actual executed arithmetic micro-ops,
not static sequences multiplied by program entries. MOVD, memory operations,
address generation and EMMS break these conservative islands; interpreter
MMX execution is outside this census.

The strict run hit its240-second diagnostic limit at batch36056. The normal
window20000..25000 is complete; the requested35000..39000 particle window
is partial, ending at36056. Window selection uses observed host get_ticks,
so boundaries advance when the guest queries time. Final `end.png` is
byte-identical to a fresh uninstrumented `baseline36056.png`, with the same
12,637 API calls and matching final thread state. Instrumentation overhead
invalidates timing comparisons. Use `run-strict.log`, `census.json` and
`summary.json`; the earlier weaker run/artifacts are excluded.

| Executed sequence | Normal window | Partial particle window |
| --- | ---: | ---: |
| All arithmetic MMX micro-ops | 904,060 | 267,443,480 |
| PXOR-self | 90,406 | 26,744,348 |
| PMULLW / PSRAW / PADDW | 90,406 | 26,744,348 |
| PSRLW / PUNPCKLWD / PUNPCKLDQ | 0 | 26,701,701 |
| Seven-op broadcast-through-pack island | 0 | 26,701,701 |

The seven-op island is PSRLW / PUNPCKLWD / PUNPCKLDQ / PMULLW / PSRAW /
PADDW / PACKUSWB. The normal sprite renderer at40961b..409645 instead obtains
alpha with scalar `shr edx,25` before MOVD and has a six-op island beginning
with PUNPCKLWD. Thus multiply/shift/add is shared by normal sprite blending
and the particle effect. The measured alias form is `mul A=A,B; shift A=A,7;
add A=A,C`; broadcast is `shift A=A,1; unpack A=A,A; unpack A=A,A`.
Register MOVQ (arithmetic subop0) did not execute in either sampled window,
so its native redundant read is not a priority justified by this route.
The windows differ in duration/workload: these are counts, not FPS or a
cross-app prevalence claim. The measured first fusion candidate is the
multiply/shift/add chain, followed by the longer broadcast/blend island.

Cross-game census and isolated fusion trials (2026-10-01): extended the same
frozen-module investigation to Jazz2 startup multimedia and Unreal SE's SoftDrv
flyby. Scratch `/private/tmp/mmx-other-games/method.txt` records exact routes,
caps and validation. Jazz counted780,406 arithmetic micro-ops; Unreal stopped
counting at3,000,000. Both final PNGs match uninstrumented runs at the same
batch counts. Jazz's final canvas is black startup, not gameplay evidence;
Unreal's visibly shows the flyby. Interpreter MMX is outside the arithmetic
micro-op census. A Deus Ex logo run missed its requested counting window and
is excluded, rather than interpreted as zero MMX usage.

Neither positive cross-game sample executes Collapse's two triplets. Jazz has
59,938 PMULHW/PADDW pairs with independent register destinations. Unreal has
48,934 dependent `paddw A,A,B; psraw A,4; packuswb A,A` triplets, plus306,094
register MOVQs and125,486 self-XORs. The longest arithmetic islands are9 and12
operations respectively. Fusion should keep register operands configurable:
independent operations can still save dispatch, even when both output stores
remain necessary. Dependency determines potential traffic savings, not whether
the pair can be fused.

`/private/tmp/mmx-fusion-experiment/` contains reproducible binary-only
prototypes, modifying function1306 without changing production source/artifact:

| Arm | Register-parameterized pattern |
| --- | --- |
| A | PMULLW / PSRAW / PADDW |
| B | PSRLW / self-PUNPCKLWD / self-PUNPCKLDQ |
| AB | Both A and B |
| C | PADDW / PSRAW / PACKUSWB |
| D | PMULHW / PADDW, independent destinations also supported |

These use runtime pattern guards, not compiler-time peepholes. All aliases,
16-bit wrapping, saturating packs and shift extremes retain sequential
semantics. A/B/AB/C passed14,400 synthetic parity comparisons; D passed2,400.
Native Node13.6 TurboFan and SpiderMonkey155 Ion captures cover every arm,
including AB. A/B/C retain vector intermediates and reduce each successful
triplet to one outer dispatch. D preserves both live results: its independent
case retains four input loads/two stores, reducing four indirect dispatches
to one; dependent sources are forwarded. `report.txt` records module hashes,
native offsets, engine versions and commands. No x86 performance claim.

Kernel harness `/private/tmp/mmx-fusion-perf/kernel.js` uses normal Node tiering,
eight alternating rounds of2,000,000 iterations per arm after warmup. It checks
all integer/MMX registers, flags, x87 tags and destination pixels against the
control across32 input seeds and every timed sample. CPU is process user+system
time; medians below are milliseconds. The first kernel executes the authentic
Collapse blend body with a counted outer loop; the other two isolate the
observed instruction patterns and are synthetic, not whole-app measurements.

| Kernel | Control | Candidate | CPU change |
| --- | ---: | ---: | ---: |
| Collapse blend, A | 167.686 | 151.413 | -9.7% |
| Collapse blend, B | 167.686 | 148.177 | -11.6% |
| Collapse blend, AB | 167.686 | 140.049 | -16.5% |
| Unreal add/shift/self-pack, C | 40.559 | 18.578 | -54.2% |
| Independent multiply-high/add, D | 21.572 | 17.757 | -17.7% |

C does not match the Collapse kernel and makes it3.7% slower, illustrating
runtime-guard/code-layout overhead. Native captures force optimized tiers;
benchmarks use default tiering. They do not establish natural tier residency
throughout every timed run. Local load varied substantially, so whole-game
repeat spread is essential.

Whole-route paired trials use control/candidate/candidate/control in fresh Node
processes. No owned census or native compilation runs overlapped these timing
slots. The observed process-CPU windows, in seconds, are:

| Route/window | Control repeats | Candidate repeats |
| --- | --- | --- |
| Collapse normal,20000..25000 | 2.443 / 2.726 | AB:2.427 / 2.464 |
| Collapse particles,35000..36056 | 8.119 / 9.194 | AB:10.966 / 7.795 |
| Unreal flyby,900..1200 | 4.999 / 4.779 | C:5.154 / 4.881 |
| Jazz startup,0..900 | 0.556 / 0.510 | D:0.574 / 0.553 |

All three Collapse screenshots (ordinary board/effect/end) and final Unreal
and Jazz PNGs are byte-identical between arms; API totals match. Jazz also
matches its interpreter MMX counter. The short Jazz phase includes startup
and compilation work, and its black final image alone is weak validation;
the randomized full-register tests provide the arithmetic correctness evidence.
These first whole-app trials show no reliable improvement: Collapse's particle
results are especially variable, while Unreal/Jazz do not show a net win.
Do not promote the kernel savings to gameplay speedups. Runtime-guard
prototypes remain experimental; no production defaults or source were changed.
Raw timings, logs and hashes are in `/private/tmp/mmx-fusion-perf/`.

A second complete default-tier control/AB/AB/control Collapse trial, after
local load subsided, retained the same PNG/API parity. Particle-window CPU:
control8.175/8.271s versus AB7.769/8.010s, a4.06% reduction of the two-arm
means (individual adjacent-pair reductions4.97% and3.16%). Normal-board CPU
was neutral: control2.483/2.468s versus AB2.448/2.507s. Artifacts are
`game-r2.json` and its logs/screenshots. Keep the earlier noisy trial in the
record rather than silently dropping it. This supports a modest benefit for
the sampled headless particle workload, not16.5% whole-game speedup or a
browser-FPS claim. Neither cross-game prototype showed a net application win.

General MMX island trials (same investigation, separate subagent):
`/private/tmp/mmx-island-experiment/` holds two binary-only variants. Both
execute up to16 contiguous arithmetic micro-ops through an inner loop,
bypassing the outer micro-op dispatch. They accept arbitrary register
operands, forward the most recent destination to either matching source,
spill when the destination changes and flush at every boundary. Multiple
live outputs are preserved, but these prototypes cache only one destination.
They are runtime-cache experiments, not compiler-predecoded register dataflow.

The first retains an i64 value and reuses all54 supported MMX subops. The
second retains a v128 value for11 hot subops, falling back to the existing
core for the rest. Each passed3,000 randomized sequences over all54 subops,
eight registers, arbitrary aliases, lengths1..64, extreme shifts, memory
consumers, EMMS/END and16-op boundaries. Both also pass32-seed full-state
comparisons on the authentic Collapse blend and parity in timed samples.

| Kernel, eight alternating rounds | Control ms | i64 island ms | Vector island ms |
| --- | ---: | ---: | ---: |
| Authentic Collapse blend, first trial | 167.212 | 178.415 (+6.7%) | — |
| Authentic Collapse blend, second trial | 166.872 | — | 182.339 (+9.3%) |
| Synthetic Unreal add/shift/self-pack | 41.192 | 35.105 (-14.8%) | 32.321 (-21.5%) |
| Synthetic independent multiply-high/add | 21.359 | 21.622 (+1.2%) | 22.290 (+4.4%) |

Fixed-shape configurable-register fusions were faster in these same trials:
AB139.247/136.033ms on the respective Collapse trials; C19.014ms on the Unreal
shape; D17.691ms on the independent pair. The generic islands therefore are
not universally slower: their net benefit depends on the sequence. Kernel
results alone cannot settle whole-game performance.

Exact Node13.6 TurboFan and SpiderMonkey155 Ion ARM64 captures cover both
variants (`report.txt`, `native-island/`, `native-vector/`). Vector caching
removes the SIMD/GPR transfers around multiply/add/subtract, but dynamic
source matching, destination changes, boundary checks and register shuffles
remain. Ion spills the cached vector to its native stack on each inner
iteration. The ordinary micro-op engine already has resolved register-file
addresses and directly loads/stores them; it has no cache-ownership decisions
to perform. The island adds those decisions while trying to save memory
traffic and outer dispatch. This explains the tradeoff structurally, without
assigning measured CPU percentages to each native instruction.

A compiler-predecoded island could decide register bindings and forwarding
once, keeping execution free of these per-op pointer comparisons. That is a
different, unimplemented design; the negative Collapse runtime-cache result
does not refute it. Source-level v128 locals also do not guarantee native
register residency, as the Ion captures demonstrate.

Comparison with the existing x87 island: `src/07b-loop-match.wat`'s
`$x87_island_fast` also decodes records, dispatches per operation and maintains
stack/tag state. It caches the architecturally distinguished ST(0), TOP and
tag bytes in locals. Most arithmetic can refer directly to `$st0`; other
physical stack slots remain in memory. Push/pop, changes to TOP and generic
fallbacks publish/reload state. Its `x87i-get-rm` still selects between cached
ST(0) and a memory slot, so it is not free of routing or memory accesses.
The MMX prototype instead caches the last-written arbitrary destination and
checks both source addresses and destination ownership on every operation.
Thus the cache policies have different costs. x87 also replaces a more
expensive old handler path; an island can retain overhead and still yield a
net gain. The existing x87 predecode switch does not mean its runtime loop
has become fully compiled straight-line arithmetic.

The vector island was also tested on the actual Unreal flyby after the
positive synthetic result. An initial four-arm run is discarded because
`test/run.js` changed during measurement. The repeat loads a frozen snapshot
of that entrypoint with its original module filename/import resolution.
Control/vector/vector/control at batches900..1200 used4.772/4.708s CPU for
control and5.193/5.161s for the vector island: means4.740 versus5.177s,
an observed9.22% regression. All final PNGs match byte-for-byte, all arms
make4,425,320 API calls, and the frozen entrypoint hash stays unchanged.
See `unreal-frozen.json`, `unreal-frozen-summary.json` and `report.txt` under
`/private/tmp/mmx-island-experiment/`. Own benchmark jobs were serialized;
an unrelated agent's Chrome session overlapped this repeat, so this is not
a quiet-machine confidence interval. The control repeat spread is1.35%
and vector spread0.62%. The synthetic21.5% island gain does not translate
to the full flyby. No runtime island or targeted fusion has been enabled
in production; these measurements remain isolated experiments.

#### What the x87 helper reduction actually means

The old generic island calls `fpu_exec_reg` for each register operation.
For `FADD ST(0),ST(i)`, that handler calls `fpu_get(0)`, `fpu_get(i)`,
`fpu_arith` and `fpu_set(0)`. The getters map `(TOP+i)&7` and load a value;
the setter stores it, marks the slot valid and invalidates its exact-integer
shadow. The arithmetic helper selects the operation and handles relevant
exception status. The fast island directly adds into its cached ST0 and
updates local tag state instead. Other stack slots remain memory-backed,
and uncommon operations publish state, call canonical helpers and reload.
Thus the saving is repeated generic dispatch and state access, not a claim
that every helper is intrinsically expensive or that all helpers disappear.
See `src/06-fpu.wat` (`fpu_get`, `fpu_set`, `fpu_arith`, `fpu_exec_reg`) and
`src/07b-loop-match.wat` (`x87_island_generic`, `x87_island_fast`).

A narrowly scoped session-history check confirmed the original September28
implementation was investigated by a Claude agent, while another Codex
session produced the October1 native and combination reports. The original
cached island reduced measured H3/WC3 user CPU by5.8%/5.9%, with identical
frames; see `docs/uop-tier-design.md` section5. The newer work is in
`docs/fp-native-review.md` and `docs/fp-combinations.md`: precise operation
selection plus countdown bookkeeping improved a copied MW3 kernel by4.5%
on M1 and12.5% on Ryzen, without established whole-game gains. Those changes
do not add more FP-value caching. That other session is continuing direct
P/PC game benchmarks (`fp-pc-games` on the board), so this investigation
does not duplicate them. Static helper sizes/call-site counts are not
dynamic instructions or calls per guest operation. Native tier also matters:
one selector variant improved the normally tiered Skylake kernel by8.38%
but regressed forced eager compilation by6.45%.

#### Precomputed MMX register forwarding experiment

Scratch artifacts: `/private/tmp/mmx-precomputed/`. This variant patches the
same frozen control WASM, SHA256
`65985dbecf428a305951d3ca1fe55fa951ae979907a791d437911ec79a8f4ff5`.
Candidate SHA256
`a6622f8a3a8acfd073f199e1b6a2d7388f320c4a922147d037136b95c5e00789`,
1649318 bytes (+647). No production interpreter/compiler files changed.

The compiler-completion hook runs inside its existing lock, once per
successful compilation, before execution. An experimental JS planner scans
the exact encoded word count (excluding the constant pool) and annotates
unused high bits of existing MMX suboperation words. Metadata specifies
whether this result must be stored, whether each next operand comes from
the cached result, whether the next source is immediate, and whether the
island continues. Runs cover the same11 suboperations as the runtime-vector
prototype, with arbitrary register bindings and at most16 operations.
There is no per-execution JS call. This tests precomputed dataflow; a
production implementation would require native compiler integration and
consistent metadata handling in every executor/worker.

Every external/interior entry loads its initial operands normally. Every
chunk exit publishes its result. Other observable destination results are
stored before their cache slot is reused; flags only eliminate stores
overwritten by the next operation on the same destination. Unsupported
arithmetic and memory/control boundaries use the original engine. The
metadata occupies the compiled program itself, so ordinary recompilation
overwrites it without an external plan-cache lifetime problem.

Differential tests passed3000 randomized sequences across all54 original
suboperations, eight arbitrary registers/aliases, lengths1..64, extreme
shifts and memory/EMMS/end boundaries. Another4127 comparisons enter at
every interior position in the first200 sequences. Reused scratch arena,
idempotent annotation and actual compiled-kernel full-state comparisons
also pass. Independent review checked all86 opcode-width table entries,
including variable control forms and constant-pool exclusion.

Matched ARM64 native captures (`native-precomputed/`) use Node24.21.0
V8 13.6.233.17-node.53 forced TurboFan and SpiderMonkey155 Ion. Against the
earlier runtime-vector island, both remove pointer comparisons, the16-op
counter and next-opcode checks, replacing them with metadata bit tests.
The cached-vector stack traffic disappears in both engines. Node's frame
shrinks176 to128 bytes and the three-vector rotation disappears; Ion still
spills the program counter. Per-operation semantic dispatch and interrupt
checks remain. Function sizes are10656/12648 bytes for Node/Ion versus
10560/12496 for the runtime-vector variant. These forced-optimized captures
explain structural differences; timings use ordinary Node tiering.

Actual flush/recompile validation also passed24 rounds: the same guest
address and arena header110202880 were reused, all24 compiled descriptor
sets were distinct and matched the requested registers/shift counts, the
planner ran on every compilation, and full state matched control.
See `recompile-parity.json`.

Eight alternating rounds of2M kernel iterations, including a separately
instantiated identical-WASM null control, produced these median CPU times.
The shared machine was busy (load averages roughly5–11); retain the null
comparison and do not interpret small differences as established gains.

| Kernel | Control ms | Identical null ms | Runtime vector ms | Precomputed ms | Targeted fusion ms |
|---|---:|---:|---:|---:|---:|
| Authentic Collapse particle loop | 223.192 | 227.210 | 250.191 | 218.529 | 183.738 (AB) |
| Unreal-shaped add/shift/pack | 53.604 | 55.245 | 45.529 | 42.878 | 26.132 (C) |
| Independent multiply/add | 30.262 | 30.999 | 32.869 | 30.050 | 25.636 (D) |

Precomputed versus control is−2.09%,−20.01%,−0.70%; the identical null
differs by+1.80%,+3.06%,+2.44%. Thus the Unreal-shaped kernel has a clear
observed improvement; Collapse and the independent pair are near the
same-artifact variation. Precomputing improves on runtime routing, but
the targeted configurable-register fusions remain substantially faster
on all three kernels. Files: `kernel-{particle,unreal,independent}.json`
and matching `plan-*.json`. All seeded and timed full-state gates passed.

Actual games ran control/candidate/candidate/control with a frozen
`test/run.js` entrypoint (SHA256
`a3cdce1aa42039b30bb54ff71c54cec08ce173523e873020520b900ae9ea2da9`),
normal repository JS dependencies, and `--no-threads`. Every module
instance used the same selected WASM. This is cooperative-mode evidence,
not validation of real Workers sharing annotated code.

| Game/window | Control CPU seconds | Precomputed CPU seconds |
|---|---|---|
| Unreal flyby900..1200 | 6.259,4.824 | 4.761,5.288 |
| Collapse normal20000..25000 | 2.449,3.557 | 2.421,3.074 |
| Collapse particles35000..36056 | 8.374,10.906 | 9.065,8.843 |

All Unreal final PNGs match and all runs make4,425,320 API calls. All
three Collapse PNG stages match and all runs make12,637 API calls.
Control repeat spreads are25.9%,36.9%,26.3% respectively, larger than
the apparent mean improvements. **No reliable whole-game speedup is
established.** Do not select only the favorable pair or compare these
busy-machine values with earlier quieter runs. Planner-body wall time
totals23.6–26.5ms in Unreal and41.6–43.5ms in Collapse across the entire
route; these measurements exclude callback/statistics overhead. The full
game CPU windows include any preprocessing occurring inside those windows.
See `unreal.json`, `collapse.json`, `game-summary.json` and their PNG/log
artifacts. The scratch `game-bench.js` records the exact route arguments.

Conclusion: precomputing removes the intended runtime work and fixes
the cached-vector spill observed in the runtime island. It does not remove
per-op dispatch, and it has not demonstrated a whole-game win. Retain it
as an experiment; the earlier targeted-fusion results remain the stronger
production direction. No production defaults changed or commit made.

#### Stacking precomputed MMX islands with fusions

Follow-up experiment requested by the user: measure baseline, precomputed
island, predecoded ABCD fusions, and island plus those same fusions. Scratch
implementation is in `/private/tmp/mmx-stacked/`; root timing harnesses and
results are in `/private/tmp/mmx-stacked-bench/`. All variants derive from
the same frozen control used above. No production files are patched.

Both fusion arms recognize identical configurable-register sequences at
compile time and use the same arithmetic bodies. High descriptor bits mark
the fusion kind while retaining original low-byte operations for interior
entry. Matching is greedy left-to-right and nonoverlapping; a D pair can
consume an add that otherwise starts C. Both arms use that same policy.
Every consumed edge must remain inside the existing bounded island.

The fusion-only arm publishes the result and returns to the outer executor
after each fused group. The stacked arm executes fusion inside the island,
uses the last consumed descriptor's writeback/forwarding metadata, and
continues with cached operands. D still publishes its first destination
when distinct from the second. This measures actual shared execution, not
two toggles where one bypasses the other. Compared with previous runtime
lookahead AB/C/D experiments, both new fusion arms also predecode pattern
matching, so those older arms are additional references, not the clean
isolation of the island's incremental effect.

The kernel harness uses rotating arm order and its reverse, an independent
identical-WASM null instance, normal Node tiering, and full-state parity.
Game runs use the earlier frozen entrypoint and cooperative mode, with
matching PNG/API gates and forward/reverse arm order. Compare the stacked
arm directly with fusion-only to establish incremental benefit; gains
against the baseline alone cannot show that two optimizations compound.

Validation passed for both new arms: 3000 randomized sequences,1280
targeted embedded fusion cases,4127 random and4800 targeted interior
entries, and24 actual same-address flush/recompile rounds per arm.
Separate instrumented binaries counted executed A/B/C/D handlers
(480/480/480/566 each in both arms), avoiding vacuous fusion coverage.
The timing binaries contain no execution-counter imports. New hashes:
fusion-only `375b43046e679de934c86d9268d38b6c644bc705fb0a1f24c0a52641d6e28145`;
stacked `222ff3d8c1ce7e7e37a9978861034dc76706e8b68e2f78f6d24dc587df2524eb`.

Matched Node24.21.0/V8 13.6.233.17-node.53 forced-TurboFan and
SpiderMonkey155 Ion ARM64 captures confirm genuine compounding. Node's
stacked A performs multiply/shift/add at+0x1014/+0x1038/+0x1060 without
intermediate spills, then applies final-descriptor metadata and continues
with cached operands. Fusion-only stores and returns to outer dispatch.
Ion likewise retains vector intermediates but still spills its PC.
Function sizes are11072/13152 bytes for fusion-only and11168/13232 for
stacked (Node/Ion). Captures remain forced-optimized structural evidence;
all timing uses default tiering. No x86 timings or native claims are made.

Twelve balanced kernel rounds,2M iterations per sample, produced:

| Kernel | Baseline ms | Island ms | Fusion-only ms | Both ms | Prior runtime fusion ms |
|---|---:|---:|---:|---:|---:|
| Collapse particle loop | 169.460 | 167.721 | 154.228 | 140.358 | 139.558 (AB) |
| Unreal-shaped triplet | 41.381 | 29.922 | 19.016 | 19.212 | 19.118 (C) |
| Independent multiply/add | 21.573 | 20.410 | 18.776 | 19.249 | 17.793 (D) |

The identical-baseline null differs by+0.97%,−0.39%,−0.73% respectively.
Stacked versus fusion-only is−8.99%,+1.03%,+2.52%; median same-round
ratios are−9.77%,+0.26%,+1.26%. The long Collapse loop benefits from
keeping surrounding unfused arithmetic inside the island. Short kernels
already consumed by a single fusion gain nothing useful from the island.
Do not multiply standalone speedups: the saved work overlaps. Also do not
claim a new best Collapse kernel result: combined ABCD is essentially tied
with the earlier AB-only runtime fusion, despite beating the new ABCD
fusion-only arm. Kernel results and exact module hashes are in
`/private/tmp/mmx-stacked-bench/kernel-*.json`; `summary.json` records both
aggregate medians and paired ratios. All full-state gates passed.

Environment note for the game matrix: another session announced a headless
Chrome run on port8137 at03:40:02 PDT, during our serialized CLI runs.
We did not launch Chrome for this experiment. Use the repeated-arm spreads
to assess the resulting measurements; this shared laptop is not an
exclusive benchmark machine.

The completed eight-run Collapse matrix preserved all three PNG stages,
12,637 API calls and the frozen harness hash in every arm. CPU seconds:

| Arm | Normal window, two runs | Particle window, two runs |
|---|---|---|
| Baseline | 2.439,2.875 | 8.132,10.348 |
| Island | 2.495,2.879 | 8.460,9.625 |
| Fusion-only | 2.548,3.380 | 8.123,9.393 |
| Both | 3.102,2.940 | 9.266,9.324 |

The combined arm has no demonstrated gameplay gain: its particle mean is
6.13% above fusion-only, while baseline and fusion-only repeat spreads are
23.98% and14.50%. Normal-window timings also drift substantially. These
runs validate rendering and execution but cannot settle a small performance
effect. Keep every sample; neither choosing the favorable reverse pair
nor reporting the combined arm's tight self-repeat resolves control drift.

Native review found an avoidable final-metadata load in fusion-only: one
address calculation/load per fused group, retained by both engines even
though the value was discarded. A separate `fusion-clean.wasm` removes
only those four reloads, preserving the original measured artifacts.
SHA256 `f715b018ac1f36b299d8af8102276c896fc37af6fe56c11cf5a2c2cf8dccae6d`.
The full random/targeted/interior/recompile gates pass again. Matching
native captures shrink32 bytes in each engine, exactly four instruction
pairs, with arithmetic, stores and dispatch otherwise unchanged.

A second balanced kernel matrix checks whether that unnecessary work
explained the apparent incremental island gain:

| Kernel | Original fusion ms | Clean fusion ms | Both ms | Both versus clean |
|---|---:|---:|---:|---:|
| Collapse particles | 175.176 | 176.788 | 161.440 | −8.68% |
| Unreal-shaped triplet | 22.057 | 22.228 | 21.635 | −2.67% |
| Independent multiply/add | 22.396 | 21.777 | 22.809 | +4.74% |

Median same-round ratios are−9.84%,−0.95%,+4.00%; identical-baseline
null differences are−0.27%,+1.18%,+0.46%. Collapse's extra kernel benefit
survives the clean control. The short triplet remains approximately flat
in paired comparisons; the independent pair is worse when stacked.
The unused load was not the explanation for Collapse's gain. Do not
compare absolute milliseconds between matrices: baseline CPU moved from
169.460 to197.281ms. This second matrix's prior AB-only reference is164.272ms,
so the stacked candidate still has no large advantage over the older
specialized kernel result. Data: `kernel-clean-*.json`, `clean-summary.json`.

The Unreal flyby matrix uses the clean fusion-only control. Eight runs
again pass final-PNG, API-count and frozen-entrypoint hash gates. This
matrix makes4,425,314 API calls in every arm (do not mix its absolute times
with earlier runs making4,425,320; normal repository dependencies remain
unfrozen). Batches900..1200 CPU seconds:

| Arm | First run | Reverse run |
|---|---:|---:|
| Baseline | 5.475 | 4.732 |
| Island | 6.623 | 4.838 |
| Clean fusion-only | 5.536 | 5.604 |
| Both | 5.868 | 5.942 |

Combined versus clean fusion-only is+6.01% by mean, with each adjacent
pair showing approximately+6%. Fusion and combined repeat spreads are
1.22% and1.25%; baseline/island drift remains substantial, so this is an
observed shared-machine paired regression, not a quiet-box universal
effect size. It provides no evidence to enable the stack. Every final
frame hashes to the same earlier flyby image. Artifacts are
`game-unreal.json`, `game-collapse.json` and `summary.json` in the root
benchmark directory, with per-run logs, planner statistics and PNGs.

Conclusion: the combination is implemented and actually executes both
optimizations. It compounds on the long Collapse kernel (about9% over
matched fusion-only, including the cleaned control), but not on the short
isolated sequences or these game routes. It remains roughly level with
the best older AB-only Collapse kernel. Keep the combination experimental;
no production source/default changes or commit were made.

#### Profiling the combined-island Unreal regression

Follow-up uses a full frozen host snapshot at
`/private/tmp/mmx-profile-host`, including the earlier frozen runner,
host/library/source files, fonts, type libraries and Unreal fixture.
Modules remain the exact F-clean and stacked hashes above. Dynamic census
artifacts are in `/private/tmp/mmx-regression-census/`; normal-tier native
profiles/mapping are in `/private/tmp/mmx-regression-native/`.

The census gates exported WASM counters over batches900–1199, exactly the
CPU measurement window, without hot host callbacks. Instrumented execution
is never used as timing evidence. Both variants and an uninstrumented
frozen-host control reproduce4,425,314 API calls and the identical final
flyby PNG. Random/targeted/interior-entry parity, inactive-counter gates,
histogram totals and weighted logical-op identities pass.

| Executed work in timed window | F-clean | Stacked |
|---|---:|---:|
| Outer uop dispatches | 931,662,495 | 903,226,158 |
| Logical arithmetic MMX operations | 348,934,955 | 348,934,955 |
| Arithmetic MMX register operand loads | 622,875,675 | 611,498,712 |
| Arithmetic MMX register stores | 336,558,226 | 327,710,403 |

Both execute C5,215,486 times and D9,021,986 times, with no A/B executions.
The combined arm executes49,730,790 additional ordinary operations inside
islands. Its35,531,925 entries have logical lengths2/3/4/5 with counts
25,449,839 /8,058,949 /1,770,990 /252,147; none are longer. Thus71.62% are
only two operations. It saves3.052% of all outer dispatches,1.827% of
arithmetic-MMX register operand loads and2.629% of those stores. Loads here
exclude descriptor accesses and non-arithmetic MMX memory-transfer uops.
All non-MMX outer opcode counts match exactly. This establishes modest
traffic savings and short islands, not by itself their cycle cost.

Normal-tier ARM Inspector profiles of that exact window show92% WASM in
both arms. `$uop_fast` is46.8% versus47.4% of all sampled time;
`$x87_island_fast`5.9% versus6.0%; threaded32-bit loads/stores3.3%/2.4%
versus3.2%/2.3%. Raster-canvas `drawImage` is2.7% versus2.8%. Function
names were verified against decoded bodies of the exact frozen WASM,
not current build indices (`/private/tmp/mmx-profile-names/results.json`).
These profiler-instrumented runs are attribution, not clean timings.

Profiling caveat caught during validation: Inspector's CPU profiler pauses
V8 `--prof` tick logging while it runs. Combining both initially left only
three native-PC ticks inside the window despite thousands of Inspector
samples. Those missing ticks cannot support native-region percentages.
Use separate Inspector and tick runs; the latter needs exact batch markers
and an explicit clock bridge because Node hrtime and V8 TimeTicks differ
on macOS. Same-process JIT dumps identify the actual naturally tiered code;
forced-eager captures are not substituted for it.

The quiet x86 repeat uses fast-near-9tb-2 (Intel i5-13500), pinned to
performance-core CPU0, Node24.21.0 / V8 13.6, normal tiering. The box was
idle (load0.01–0.05); our CPU jobs were serialized. Its home filesystem
was full, so all runtime/host/results live privately under
`/tmp/mmx-regression-1001`, without removing existing files. Eight
uninstrumented runs in F/S/S/F/S/F/F/S order give:

| Variant | Window CPU seconds, chronological within variant | Mean |
|---|---|---:|
| Clean fusion-only | 3.328, 3.326, 3.328, 3.321 | 3.32575 |
| Combined | 3.351, 3.348, 3.347, 3.346 | 3.34800 |

Combined is **0.669% slower**, with adjacent-pair penalties0.57–0.75%.
CPU and wall differ by only1–2ms per run: waiting is not the explanation
for this fixed headless workload. All eight API counts and PNG hashes
match. This does not reproduce the earlier ARM/shared-machine6% effect;
do not transfer an effect size between architectures. Local evidence:
`/private/tmp/mmx-regression-native/x86-timing/`.

Separate ARM leaf-PC runs, clipped with calibrated batch markers, have
5,966/5,847 samples. All-sample shares for F-clean/combined are:
outer dispatch and interrupt poll21.71%/20.97%; MMX arithmetic including
fusion/island11.58%/13.65%; MMX guest-memory transfer4.44%/3.98%; other
uop handlers9.08%/8.83%. Their total `$uop_fast` share is46.82%/47.43%.
These statistical shares support work shifting into arithmetic/island
handling, but one profiled pair under local contention cannot isolate
its cycle cost or establish a clean timing delta. Both variants naturally
reached TurboFan before the window; exact handler sizes are11,040/11,168
bytes. The clock bridge uncertainty is ±726/533µs, and same-process
jitdump/log calibration spread is0µs across over5,400 records.

The independent x86 native-PC pair has3,188/3,239 window ticks; normal
TurboFan `$uop_fast` accounts for44.70%/44.12%, and `$x87_island_fast`
for6.34%/6.95%. Native handler sizes are14,912/15,104 bytes (Ion155
compile-only captures:12,143/12,375 bytes). The target was optimized well
before both windows. Jitdump/log calibration spread is3µs across5,433
matches; startup clock-bridge uncertainty is ±326/319µs. There are no
reported code moves. Ambiguous addresses119/126 and unmapped PCs59/65
remain explicitly unassigned, so percentages use all samples as their
denominator. A single profile pair cannot resolve the cause of a0.67%
whole-run difference from changes of this size. Artifacts:
`/private/tmp/mmx-regression-native/x86-pc/` and `x86-ion-box2/`.

Native spill review is bounded: inspected ARM actual-run TurboFan frames
remain128 bytes in both variants, and the cached-vector path has no
persistent vector stack spill (interrupt slow-path saves remain). The
main-PC stack copy exists in both. There is no demonstrated global spill
regression; an exhaustive unrelated-path allocation diff and x86
instruction-region/spill classification were not completed, so isolated
changes are not ruled out.

Decision: keep the combined implementation experimental. The most
supported explanation is modest savings on very short islands competing
with internal dispatch/metadata/forwarding bookkeeping, not a new wait
or a proven global register-spill regression. ARM region samples support
that explanation; they do not prove which instructions cause the small
quiet-x86 penalty. Next bounded experiment: retain fusion-only execution
for two-operation islands and compare against the existing combined arm
on the same Unreal route plus the long Collapse kernel/game route.
Production source/defaults remain unchanged. Documentation diff check
passes; no commit was made by this profiling task.

#### What terminates the hot MMX islands

The experimental planner accepts only subops6,7,9,11,15,17,19,33,37,133,137
of arithmetic uops74/75, with a16-operation cap. The emulator implements
many more MMX operations; these omissions are island coverage limits, not
unsupported guest instructions. In particular MOVQ0, PAND3, PUNPCKHDQ8,
PADDD34, PSUBSW45, PSLLQ131 and PSRLQ135 break the experimental island.
Integer operations, MMX memory transfers72/73 and GPR transfers76/77 also
break it. PXOR6 is already included.

Disassembly of the frozen Unreal SoftDrv binary is retained in
`/private/tmp/mmx-boundary-disasm/`. The previously identified hot texel
body at preferred VA0x1092475a interleaves pixel shading in mm0, texture
coordinates in mm1, light interpolation in mm4 and position in mm7.
Many of its consecutive guest instructions are MMX, but the whitelist
splits them at PSLLQ, PUNPCKHDQ, PSRLQ, PADDD and PAND. Merely allowing
integer instructions would leave those breaks in place.

The unrolled span body also supplies a concrete transfer-bridging case:

```asm
10923274  paddw    mm0,mm3
10923277  psraw    mm0,4
1092327b  movd     ecx,mm1
1092327e  packuswb mm0,mm0
```

The MOVD does not overwrite mm0, so a bridge could preserve its result
across the transfer and feed PACKUSWB. That is a potential optimization,
not a measured speedup. More generally, interleaved MMX destinations mean
longer islands alone do not ensure traffic savings: the current cache
holds only the latest result and forwards it only to the next operation.

The execution-weighted boundary census changes the priority suggested by
static disassembly. In the same frozen Unreal batches900–1199, all
35,531,925 existing island exits map to compile-time descriptor snapshots:

| Immediate next micro-op | Executed exits | Share |
|---|---:|---:|
| MMX memory load, LDX64 | 19,177,822 | 53.97% |
| MMX-to-integer transfer, MXTO32 | 13,836,289 | 38.94% |
| MMX arithmetic outside the island whitelist | 1,495,280 | 4.21% |
| Integer/other | 763,990 | 2.15% |
| Register MOVQ | 238,686 | 0.67% |
| GOTO | 19,858 | 0.056% |

These are micro-op boundaries: MXTO32 also participates in lowering a
MOVD to memory, so the whole transfer category does not imply a guest
register-destination MOVD. No16-operation cap endings occur. The excluded
arithmetic endings are PSUBSW1,223,183, PSLLW242,676 and PADDD29,421.
The larger whitelist omissions seen in static code also affect singleton
instructions, which this existing-island endpoint census does not count.

The one-MXTO32 gap before PACKUSWB occurs **4,878,929 times**,13.73% of all
exits. The prior cached result is unmodified and is both inputs to the
pack. This represents88.85% of the5,491,402 conservative last-result reuse
opportunities found before the next eligible MMX operation. This specific
gap has no memory access or branch, making it a better initial bridge
than arbitrary integer instructions. Straight-line gap analysis is static
lookahead weighted by actual exits; longer gaps containing memory/guards
are not proof that execution reached the candidate consumer.

A separate memory-operand opportunity dominates many of the load breaks.
Exactly13,231,925 exits have a single LDX64 before the next eligible MMX
operation. In every such descriptor pair the load writes MMX staging cell
116467776, and the following arithmetic reads that cell as source B:
PUNPCKLBW9,379,894; PMULHW3,511,655; PADDW340,376. These are compiler
load-plus-arithmetic splits. A guarded memory-source handler could avoid
the staging write/read and dispatch between them. Simply retaining the
previous island's latest value would help much less here:12,989,249 of
those gaps do not reuse it. Memory-window miss/deoptimization semantics
must remain correct; no speedup or implementation is claimed yet.

The hottest single endpoint grouped across recompiles is in compile head
runtime0x028bff70, at descriptor index15:1,637,758 exits. This run's loader
places SoftDrv at0x0289d000, **not** the older0x0289b000 mapping; its preferred
head is0x10922f70. The endpoint corresponds to PUNPCKLDQ mm1,mm1 followed
by the load for PMULHW mm7,[0x1095cf50]. That concrete example switches
register chains, explaining why a one-value cache misses the opportunity.
Other hot compile heads0x028c0255/0x028c0712 map to0x10923255/0x10923712,
the unrolled span renderer containing the useful MOVD bridges.

Artifacts: `/private/tmp/mmx-boundary-census/` contains the scratch build,
portable loader, full executed neighborhoods, report and summary. The
instrumented run reproduces4,425,314 API calls and the exact final PNG.
3,000 random cases,1,280 targeted cases and8,927 interior entries pass;
all11,166 synthetic endpoints map and agree with the existing entry
counter. Actual endpoint total also agrees exactly with the earlier
dynamic census. Instrumentation timing is not performance evidence.

Next experiments should therefore target the MOVD bridge and guarded
memory-source unpack/multiply handling, separately, before widening the
island into a general integer interpreter. Production remains unchanged.

#### Multi-register allocation corpus

Collected six authentic regions in `/private/tmp/mmx-regalloc/`:

| Region | Evidence and scope | Register structure |
|---|---|---|
| Collapse normal blend,0x40961b–0x409658 | Normal-board MMX census; partial-alpha path | mm2 pixel,mm3 alpha,mm5 zero,mm7 destination |
| Collapse particle blend,0x4287ef–0x428826 | Particle-window census and earlier hot-loop profile | Same four registers, with MMX alpha shift |
| Unreal lightmap,0x10922f2f–0x10922fc9 | Full43-instruction loop; hot compile-head endpoint counts | All eight MMX registers modified, three incoming values |
| Unreal unrolled span,0x10923255 onward |23-instruction pixel-pair region from hot span | Pixel, texture and lighting chains interleaved |
| Unreal shaded texel,0x10924747–0x1092478c |21-instruction shaded path from hot texel loop | Four modified MMX registers, six incoming values |
| Jazz2 nine-op sequence |2,435 observed executions across eight descriptor locations | Independent mm6 and mm3 chains, final mm0 copy |

Jazz2 is startup multimedia, not gameplay. Its guest code address and
backedge are unknown: the artifact retains actual uop addresses without
inventing a complete guest loop. Its operation order is:

```asm
punpckldq mm6,mm7
pmaddwd  mm6,mm3
paddw    mm3,mm4
psrad    mm6,15
paddw    mm3,mm4
packssdw mm6,mm6
pand     mm3,mm5
punpcklwd mm6,mm6
movq     mm0,mm6
```

Static allocation models (`allocate.py`, `optimal.py`) compare one, two,
four and eight cached results. Their cost is unique64-bit register-file
reads plus writes, equally weighted; operand temporaries are outside that
cache budget. They preserve all architectural outputs, recognize self-XOR
as input-independent and MOVQ as not reading its old destination. The
exact dynamic-programming model also permits writing an unrelated result
directly to the register file instead of evicting a useful cached value.
This is an optimum only under that explicit traffic model, not a native
cycle optimum or a replacement for generated-code inspection.

| Region | No cache |1 slot |2 slots |4 slots |8 slots |
|---|---:|---:|---:|---:|---:|
| Collapse normal |29|12|7|4|4|
| Collapse particles |28|11|7|4|4|
| Unreal lightmap |77|54|35|17|14|
| Unreal span |47|31|23|15|15|
| Unreal texel |30|21|16|16|16|
| Jazz2 sequence |23|14|10|10|10|

These counts allow carrying values through memory operations and publish
modified registers at the region end. A conservative mode additionally
publishes every dirty value before every guest memory access; four-slot
costs become5/6/33/24/18/10 respectively. This demonstrates that memory
exit/recovery policy materially changes predicted gains. It does not
license skipping architectural state materialization on a real fault.

Allocation policy matters independently of slot count. For Unreal
lightmap, a one-slot policy that always caches the newest result costs72
transfers, versus54 when it can bypass unrelated writes. Jazz2 falls20→14
under the same change; two slots can then retain its two result chains.
Collapse can retain all four produced values with four slots. Unreal's
eight live architectural values do not imply that an eight-slot host
cache wins: the additional routing and native register pressure need
measurement.3,840 randomized plan replays verify routing, all final
register values, conservative checkpoint visibility and transfer counts;
they are not arithmetic-opcode correctness tests.

The first executable multi-register prototype uses the complete Jazz2
nine-op sequence, identical opcode coverage in all arms, and the optimal
one/two/four-slot plans with direct-write bypass. It is a small descriptor
interpreter: both source routes and destination routes are selected at
runtime, so the benchmark includes that cost instead of substituting
fully unrolled, statically bound arithmetic. Two transient operands sit
outside the result cache. Four-slot capacity uses only two occupied slots
on this sequence, so it has no additional traffic advantage. These are
new isolated kernels, not patches to the production uop engine or a
comparison against the previous experimental one-value module.

Independent BigInt arithmetic-oracle validation passes1,920 comparisons
of all eight architectural registers across640 random/edge inputs and
register permutations, saturation values, shifts0/1/15/31/32/63/255/
0xffffffff and1–3 repetitions. The concrete one/two-slot plans exercise
final-MOVQ evictions of mm6/mm3 respectively; the four-slot plan bypasses
that final result. This is not general arbitrary-eviction-plan validation.

Local ARM timings varied by over2x and are not effect-size evidence. The
quiet i5-13500 repeat on fast-near-9tb-2, CPU0, Node24.21.0 /
V8 13.6.233.17-node.53 uses48 alternating samples, five million sequences
per sample,16 samples per arm. CPU time and wall time are nearly equal.
All timed final register files match across arms.

| Cache slots | Median wall ms | Range ms | Versus1 slot |
|---|---:|---:|---:|
|1|124.906|123.564–128.196|control|
|2|139.043|138.061–139.488|+11.32% slower|
|4|147.410|145.311–149.392|+18.02% slower|

All16 adjacent three-arm comparisons regress: two slots+8.18–12.49%,
four+14.11–20.18%. A separate normally tiered JIT-recording repetition
gives124.237/138.798/147.629ms and confirms each TurboFan function was
published before its first timed sample. Clean timing results and
same-run native code are in `x86-results/`, including
`remote-results.json`, `tier-verification.json` and `natural-*.bin/txt`.

Exact benchmark module hashes for1/2/4 slots:

```text
c51d149f79dda5665029cf2a73c74d2a75e0aac8d28ad4cb59c8683682ef18d8
8c52d605d3abc0100dfb422619dc46ea5b0cbf782090b285259c52e112687f38
f9bd553af17ff107fa2857152ab438f95992bf66d9655fd402431d926a8a574e
```

Native inspection covers V8 TurboFan and SpiderMonkey155 Ion on ARM64 and
x86-64 for those exact modules. ARM code sizes are736/832/1056 bytes for
V8 and632/744/936 for Ion; x86 sizes1024/1152/1344 and568/672/896.
Neither engine spills cached vectors in these kernels' hot loops on
either architecture. V8's vector stack saves are on interrupt slow paths;
Ion has no local spill frame. The larger cache keeps additional source
and destination selector comparisons plus vector moves at merges. In
x86 cache4 V8, source selectors are at0x96–0xb4 and0x106–0x124;
destination selection at0x370–0x38e feeds moves at0x3a7–0x3bf. Ion retains
the corresponding source/destination routing as well. Thus register
residence alone does not make this scheme faster. These small kernels do
not reproduce the full engine's register pressure or establish game FPS.

Capture validation caught an ambiguous SpiderMonkey prologue: one was
the checked entry, the other the function body. The x86 helper validates
a shared64-byte offset against both segment.begin and funcBodyBegin,
preserving the entire body and jump-table tail. It does not use the
multi-function offset-voting heuristic on a one-function module.

Conclusion: two/four slots reduce modeled register-file traffic for the
collected code, but the tested generic slot-selector implementation is
slower on the isolated Jazz sequence. The next candidate should reduce
operand routing cost (for example, specialize common planned slot
combinations) before adding more cache capacity. Production/defaults
remain unchanged; no whole-game multi-register speedup is claimed.

The normally tiered x86 repetition's hot code is byte-identical to the
inspected forced TurboFan captures through offsets0x317/0x37e/0x434 for
one/two/four slots. Differences start at out-of-line call relocations
and address tables. The selector and hot-loop spill findings therefore
apply to code actually emitted during the measured-tier repetition.

#### Specializing opcode and cached-slot combinations

The selected six-region allocation corpus supplies a static ranking,
not whole-game frequencies. With two cached results,20 of110 MMX-related
instructions use slot+register-file→same slot,14 self-pack/unpack,11
slot+immediate→same slot and5 two different cached slots→same slot. With
four slots the corresponding counts are14/16/14/15. Counts include the
regions' input/output moves; dynamic endpoint counts are deliberately not
multiplied by static region lengths. Ranking artifacts:
`/private/tmp/mmx-specialize/ranking/`.

The first bounded prototype specializes six exact cases from the complete
Jazz nine-operation sequence (C0/C1 are cached WASM locals, F is the MMX
register file, I is an immediate):

| Opcode | Fixed route |
|---|---|
| PMADDWD | C0,F→C0 |
| PSRAD | C0,I→C0 |
| PADDW | C1,F→C1 |
| PACKSSDW | C0,C0→C0 |
| PAND | C1,F→C1 |
| PUNPCKLWD | C0,C0→C0 |

The planner selects these only when opcode, source routes, destination
route and no-eviction condition match. Actual guest register addresses
and shift immediates remain descriptor parameters. Dispatch goes to these
arms **before** generic operand decoding. Each directly updates its fixed
cached local, then rejoins the common instruction advance. The remaining
three operations (two initializers and the final copying eviction) retain
generic handling. This is still a descriptor interpreter with an opcode
dispatch per operation, not an unrolled trace or multi-operation fusion.

The old generic one/two-slot WASM controls are byte-identical to the prior
experiment. New `special2.wasm` is738 bytes, SHA-256
`049cc941fd8e1935a39c10e179f7cbd4c6c9486966e4934ae9535765397b378a`.
All1,920 arithmetic/register-state oracle comparisons pass, as do24
neighboring source/destination/eviction cases that must select the generic
fallback. Register permutations confirm that no guest MMX register number
is baked into the specialized handlers.

Quiet x86 benchmark: same i5-13500 CPU0, Node24.21.0/V8 13.6, load0/0/0
before starting;48 alternating samples, five million sequences each.
Every timed final register file matches across arms; CPU≈wall.

| Variant | Median wall ms | Range ms |
|---|---:|---:|
| Generic one slot |125.306|122.307–131.462|
| Generic two slots |138.793|138.135–140.135|
| Two slots, six specialized routes |89.145|86.960–94.638|

Specialization is35.77% faster than the matching two-slot control and
28.86% faster than the one-slot control. All16 adjacent three-arm
comparisons agree:32.16–37.14% and24.68–31.27% faster respectively.
These are isolated Jazz sequence timings, not game FPS. Clean results:
`/private/tmp/mmx-specialize/x86-results/results.json`.

A separate normally tiered JIT-recording repetition gives medians
124.762/139.078/92.542ms. All three TurboFan functions appear before the
first timed sample. Its special-handler hot code is byte-identical to
the inspected optimized capture through0x4a2; the first difference is
at0x4bd in slow-path call relocation. See `tier-verification.json` and
`natural-1536.bin/txt` beside the timing artifacts.

Native review covers both V8 and SpiderMonkey155 on ARM64 and x86-64.
Special2 has1120/1120 native bytes on ARM (V8/Ion),1536/992 on x86,
versus generic2's832/744 and1152/672. No hot-loop vector spills appear;
V8's80-byte frame is unchanged. ARM's specialized branches also remove
the prior generic loop-back cache rotation. On x86 V8, specialized
dispatch at0x8d–0xa2 precedes generic decoding at0x1b0; direct arms occupy
0xb0–0x1a6. PAND/PADDW/PSRAD/PMADDWD at0xf2/0x142/0x17d/0x1a2 update
cached SIMD registers without slot-selector chains. Ion similarly puts
direct arms before generic decoding; some ordinary vector copies remain,
but source/destination slot selection is absent from the selected arms.
V8 vector stack saves are confined to interrupt slow paths from0x4a2.

This validates the specialization mechanism for these six routes. Their
exact opcode/slot bindings cover6/9 Jazz instructions but none of the28
selected Collapse instructions; do not extrapolate the measured gain to
the corpus. Next candidate families from the static ranking are cross-slot
PMULLW/PSUBW, then PADDW C0,F→C0, PSRAW C0,I→C0 and PACKUSWB/PUNPCKLBW
with distinct cached sources. Copy-with-eviction and guarded guest-memory
operations remain separate cases. Keep generic fallback rather than
generating the full opcode×source-slot×destination-slot product. No
production source/defaults changed and no commit was made.



### Expanded MMX island and F/G fusion experiment (2026-10-01)

Scratch implementation: `/private/tmp/mmx-more-fusions/`; gameplay harness
and route evidence: `/private/tmp/mmx-more-game/`. This extends the full
frozen emulator, not only an arithmetic kernel. New expression families:

- F: `PMULHW → PADDW → PSRAW → PACKUSWB`, a same-destination lighting chain.
- G: `PUNPCKLDQ → PMADDWD`, the frequent Jazz unpack/dot-product pair.

Operands remain register-selectable. Aliased inputs observe the same
intermediate values as the unfused instructions, including PMADDWD's
signed overflow corner. The longer interleaved Jazz coefficient-update
sequence was deliberately left separate. Island eligibility also adds
MOVQ, PAND, PACKSSDW, PMADDWD and PSRAD.

Controls B/F/I/C/S distinguish original execution, all fusions without
island continuation, expanded island without fusions, expanded island
with old ABCDE fusions, and expanded island with ABCDEFG respectively.
I/C/S use identical executor bytes and differ only in planner flags;
C versus S isolates new fusions from expanded opcode coverage.
Here **F as a control label** means fusion-only, while **family F** means
the four-instruction lighting expression.

Frozen module SHA-256:

| Control | SHA-256 |
|---|---|
| B | `65985dbecf428a305951d3ca1fe55fa951ae979907a791d437911ec79a8f4ff5` |
| F | `c4d6a3baebd5fc8f871654d1cbb8d03125afd7fc985ed5c3ddd84241dd7d1962` |
| I/C/S | `b3bb724e0ab563d4fd55606745f325c8776c759aa3a4e925fbb2b994871ccc1f` |

Validation passes random and targeted arithmetic, all eight architectural
registers, flags/tags, interior entries, 16-op boundaries, chained fusions,
and 24 actual compile/flush/recompile programs with changed bindings.
An independent BigInt oracle adds 1,734 full-register comparisons for each
timing binary (3,468 total), including shift saturation and operand aliases.
Exact reports and commands are in `report.txt`, `run-validation.sh`,
`provenance.json` and `/private/tmp/mmx-more-fusions-review/result-*.json`.

ARM64 Node24.21/V8 13.6 TurboFan and SpiderMonkey155 Ion captures confirm
both new expression arms keep vector intermediates in registers, without
SIMD stack spills. G lowers to unpack followed by signed multiplies and
pairwise addition; F keeps multiply-high/add/shift/pack in vectors. Alias
branches and dynamic shift handling remain. Ion still stores the updated
descriptor pointer to its frame. Forced native body sizes are F11,552 /
S11,712 bytes for TurboFan and F13,760 / S13,872 for Ion. These structural
observations alone do not establish a gameplay speedup.

#### Actual Jazz2 gameplay: no meaningful speedup

The replacement route reaches Darn Ratz via the normal menus, then walks
and jumps with ordinary keyboard input. All 50 frozen fixture files match
between local and remote hosts. The scheduled remote replay exactly matches
the interactive reference's five checkpoint PNG hashes and 199,820 API calls.
The measured window is batches17,370–19,370, after level loading, with
10,000 blocks/batch and a10ms guest clock. `jazz.json` records every input;
the route and reviewed reference evidence are also in `jazz2-demo.md`.

Twenty clean remote CPU0 runs use B/F/I/C/S/S/C/I/F/B twice, four samples
per arm, normally tiered Node24.21/V8 13.6. Results exclude startup time
and separately instrumented diagnostics. Checkpoint image capture is part
of the same fixed work in every arm.

| Control | Mean gameplay CPU s | Range s | Versus original |
|---|---:|---:|---:|
| B original | 1.41175 | 1.403–1.427 | — |
| F fusion-only | 1.40925 | 1.403–1.415 | −0.18% |
| I expanded island | 1.41250 | 1.399–1.430 | +0.05% |
| C island + ABCDE | 1.42600 | 1.402–1.459 | +1.01% |
| S island + ABCDEFG | 1.41225 | 1.395–1.429 | +0.04% |

All variants are effectively tied with the original on this route. S is
0.96% below C's mean, but C's first two samples are elevated and the ranges
overlap; this does not establish a repeatable new-fusion benefit.

Separate diagnostics match all19,371 per-batch EIP/GPR/flags/x87-tag/MMX
snapshots in B/F/I/C/S and counted-S, with normalized trace hash
`718d072c033e8c35a15f5d3c7552479cafbf927524d8e940f186ba66dba552b0`.
The measured gameplay window executes D1,925,000 times and **G914,148**
times; F and other families execute zero. Thus G is exercised in gameplay,
and the lack of an overall gain is not explained by zero dynamic coverage.
The separate interpreter-only MMX counter advances14,396,443 times and
does not include arithmetic-uop execution; it is not the denominator for
these fusion counts.

The counted run initially tripped a harness parsing assertion because its
JSON counter marker embedded the CPU-window text and an unanchored regex
matched it twice. The complete saved run was validated offline using
anchored records, preserving the successful guest execution and all parity
checks. Clean timings were unaffected; the parser is fixed for later runs.

Actual normally tiered diagnostic captures reach TurboFan before the
measurement window. All F/G hot bytes match the forced x86 captures.
Remaining differences are direct CALL rel32 relocations and372 absolute
br_table pointers whose code-relative targets match exactly; additive
`native-relocation-review.json` reports preserve the initial raw comparison.

Evidence: `/private/tmp/mmx-more-game/jazz-{results,diagnostics}/`,
`jazz-summary.json`, and reviewed `scratch/runs/` comparison bundles
`20261001T230448Z-...-mmx-more-b`, `230500Z-...-f`, `230513Z-...-i`,
`230525Z-...-c`, `230538Z-...-s`, with candidate ID
`jazz-jackrabbit-2-demo-installer`. The original interactive reference is
`20261001T225744Z-jazz-jackrabbit-2-demo-installer-headless-gameplay`.

#### Actual Unreal single-player gameplay: small incremental win, net regression

The stock command-line route
`--args=Nyleve.unr?game=UnrealI.SinglePlayer -window` reaches a first-person
level with weapon and HUD. The requested URL is recorded; the loaded map's
identity was not independently verified. A click fires a shot, forward
movement changes the view and picks up a flare, and right input turns the
view. This is actual controlled gameplay, not the intro flyby. Exact input
and capture schedule is in `unreal.json` and `unreal-family-demos.md`.

All20 clean B/F/I/C/S/S/C/I/F/B repeated twice runs match four checkpoint
PNGs and7,350,053 API calls. CPU0, frozen host, Node24.21/V8 13.6,
cooperative threads,200,000 blocks/batch,25ms branch clock, and pinned
calendar1790673326000 are shared. The measured window is1500–2100;
the route ends at2101. Maximum wall-minus-CPU is4ms, with observed load
average0.17–1.19 during the serialized runs.

| Control | Mean gameplay CPU s | Range s | Versus original |
|---|---:|---:|---:|
| B original | 8.75675 | 8.749–8.764 | — |
| F fusion-only | 9.08300 | 9.042–9.187 | +3.73% |
| I expanded island | 9.38125 | 9.368–9.401 | +7.13% |
| C island + ABCDE | 9.21950 | 9.218–9.221 | +5.28% |
| S island + ABCDEFG | 9.17300 | 9.163–9.187 | +4.75% |

New F/G improve the same expanded island with old fusions by0.50%:
all four S samples are below every C sample. This modest incremental win
does **not** overcome the broader experiment's regression versus original
execution. Fusion-only is also slower than original. Do not promote the
combined implementation based on the expression microbenchmarks.

Separate B/F/I/C/S/counted-S runs match every one of2101 EIP/GPR/flags/
x87-tag/MMX snapshots, normalized hash
`5d97249ee324cc3388d19ba916d9bed0cede369a8fff475deee6fa195bd58d2b`.
The gameplay window executes C25,535,621, D27,003,107, **F8,915,570** and
**G799,366** times. A/B/E execute zero. These are dynamic execution counts,
not numbers of statically recognized instruction sequences.

New x86 captures use matching Node24.21 TurboFan and SpiderMonkey155 Ion.
Function1306 sizes: fusion-only15,616/12,695 bytes, stacked15,872/12,935.
F/G keep SIMD intermediates in registers in both engines, but the
PMULHW implementation still lowers to low/high multiplies plus unpack and
shuffle, not a single native multiply-high. Ion additionally stores the
descriptor PC. This establishes remaining work, not its share of game CPU.
Normally tiered game captures and their relocation review are under
`unreal-diagnostics/`; diagnostic timings are excluded from the table.

Evidence: `/private/tmp/mmx-more-game/unreal-{results,diagnostics}/` and
`unreal-summary.json`. Reviewed comparison bundles use exact candidate
`unreal-special-edition` and IDs beginning `20261001T231455Z` (B),
`231513Z` (F), `231531Z` (I), `231550Z` (C), `231609Z` (S), each ending
`-unreal-special-edition-mmx-more-<arm>`. Separate reviewed pilot bundles
are `20261001T231251Z-unreal-special-edition-mmx-b-gameplay` and
`20261001T231309Z-unreal-special-edition-mmx-s-gameplay`.

Experimental sources, frozen binaries, oracle reports and native captures
are also archived under `scratch/mmx-more-fusions-20261001/` with a hash
manifest. No production interpreter source or default was changed.

#### Collapse regression check with the expanded variants

Ten clean B/F/I/C/S/S/C/I/F/B runs repeat the existing normal-gameplay and
particle-effect route, two samples per arm. All match three PNG hashes,
12,637 API calls and36,057 batches. Mean CPU seconds:

| Control | Normal window20000–25000 | Particles35000–36056 |
|---|---:|---:|
| B original | 1.9370 | 5.7525 |
| F fusion-only | 1.9395 | 5.3370 |
| I expanded island | 1.9410 | 5.8065 |
| C island + ABCDE | 1.9565 | 5.3470 |
| S island + ABCDEFG | 1.9545 | 5.3600 |

The particle benefit is retained, but do not quote the6.8% S/B mean as a
precise estimate: original samples span5.552–5.953s and island-only samples
span5.556–6.057s, substantially wider than the fused variants. Both S
samples (5.350/5.370s) beat both original samples. Normal gameplay remains
near the old timings. This is a bounded regression check, not a new claim
that F/G help Collapse: **both new families execute zero times**.

Counted-S confirms E90,205 in the normal window, and B26,506,683 plus
E26,548,994 in the particle window. Whole-route counts equal the previous
experiment's B32,816,718 and E34,187,805. Separate original/S/counted-S
diagnostics match all36,057 register snapshots, normalized hash
`0c28fc901b9bba36db3119b172b51d4a45a63af96f94bcf82c8f351ed7fcee8b`.
Actual TurboFan arrives before the first measurement window; S's hot bytes
match forced capture, with only validated call/jump-table relocations.

Evidence: `collapse-{results,diagnostics}/` and `collapse-summary.json` in
the experiment archive. Reviewed `scratch/runs/` bundles use candidate
`reflexive-collapse-crunch`, timestamps `20261001T232543Z`, `232609Z`,
`232635Z`, `232701Z`, `232727Z`, and suffixes `-mmx-more-b/f/i/c/s`.

Conclusion: F/G are correct on the tested arithmetic and real gameplay
routes. Their incremental Unreal gain is small; Jazz gameplay is flat;
the broader island/fusion combination still regresses Unreal. Keep these
variants experimental rather than enabling them globally. Native inspection
and counters establish surviving work and coverage; identifying the cost
responsible for the net regression requires a separate profile/control
experiment, not an inference from instruction counts alone.

### EMMS lowering and compile-time MMX forwarding (2026-10-10)

**The particle loop was never in the uop tier.** Collapse's blend loop
(head `0x4287b0`, MMX run `0x4287f4..0x428821`) ends its MMX run with `emms`,
and 07e had no lowering for `0F 77`, so the whole head declined
(`head-unsupported`) and ran threaded. 1de11330f lowers EMMS as 07d op 86
(`$fpu_tag = 0`, the one store `$th_emms` makes). On a quiet boat (Ryzen 9950X
fork, Node 24.18), the particle window 35000..36056, interleaved B E E B x2:
main 7.746 s user CPU [7.699 8.304 7.669 7.313] against 5.408 s
[5.627 5.557 5.436 5.012], **-30.2%**, beyond main's own 13% spread. The
normal-board window (2.17 vs 2.24 s) and the Unreal flyby 900..1200
(11.25 vs 11.19 s) are neutral. Every run: identical final PNG and API count.

**Compile-time forwarding (branch `claude/mmx-predecoded-fwd`, not merged).**
`--uop-mmx-fwd` decides at encode time which MXOP/MXSHI/MXTO32 operands are
the previous MMX op's result and reads them from 07d's `$q` (ops 86-90 there),
sends a store the next op overwrites to a dead cell, and fuses mm,mem ops
(91). On the particle thread it forwards 2513 operands and kills 1136 stores
per run. Measured on top of EMMS: Collapse particles 5.001 -> 4.890 s (-2.2%,
ranges overlap; an earlier batch was bimodal, 5.5 then 7.1 s), Unreal flyby
12.88 -> 12.27 s (-4.7% against a 7.7% spread). Neither clears the null band.
Native `$uop_fast` (x64): TurboFan keeps `$q` in a register (r9), but Ion
keeps it in a stack slot and spills `pc` on every MMX arm (frame-slot
references 238 -> 355), so on SpiderMonkey the "forwarded" operand is a stack
load instead of a cell load. Evidence:
`scratch/runs/20261010T0200Z-mmx-emms-fwd-ab/` (tables, driver, both
engines' disassembly for base / EMMS / forwarding).
