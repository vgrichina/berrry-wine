# Re-Volt demo (Acclaim / Iguana London, 1999)

App id `re_volt_demo`; candidate `re-volt-demo` in
`test/candidate-corpus/manifest.json`. Direct3D 6 (`IDirect3DDevice3`) R/C
racer, PC Gamer cover-disc build (`cars/pcgamer`), one track.

## Licence

**Not redistributable.** The game's own startup legal screen says the demo "is
intended for personal use only and may not be lent, copied, sold, published,
duplicated onto CD, etc, without prior written approval from Acclaim". Neither
the archive.org item nor `readme.txt` says otherwise. It is registered strictly
as a `localOnly` fixture: fetched by `tools/fetch-candidate-corpus.js
--id=re-volt-demo`, never shipped or deployed.

## Install layout

`Re-voltDemo.zip` (archive.org `Re-Volt`, SHA-1 in the manifest) holds an
InstallShield 5 setup. `data1.cab` is unpacked with `unshield` per file group
(`game`, `cars`, `gfx`, `levels`, `models`, `wavs`), and the groups are copied
into `installed/` with `game` at the root. That gives 443 files: `revolt.exe` at
the root and `Mss32.dll` beside it, loaded as a real PE. Fetching on a fresh
boat needs `unshield` from apt.

## Startup sequence (headless, `--batch-size=50000 --tick-ms-per-batch=1000`)

1. `IDirectPlayLobby3_RegisterApplication`. It writes
   `HKLM\Software\Microsoft\DirectPlay\Applications\Revolt`
   (Guid `{6BB78285-71DF-11D2-B46C-0C780CC10840}`, File `revolt.exe`,
   Path/CurrentDirectory `C:\`). Before 2026-10-11 this returned E_NOTIMPL, and
   the game stopped with the MessageBox "DDERR_UNSUPPORTED: Can't register for
   lobby support".
2. It reads settings from `HKLM\software\Acclaim\Re-Volt Demo\1.0` (all values
   are absent on a fresh run, so the game uses its defaults).
3. **CRC32 integrity pass**, about 150 batches of 50000 blocks with a black
   screen. This is the bitwise CRC loop at `0x444581`–`0x44459e` (polynomial
   `0x04C11DB7`), called from `0x444562`. The cost is real interpreter work and
   it is not a hang.
4. The **legal screen**, then the Acclaim logo, both drawn every frame by
   `IDirectDrawSurface_GetDC` + `StretchBlt` of a 640×480 bitmap followed by
   `Flip`. One 50000-block batch runs hundreds of these frames, and the screen
   is timed on guest time. Headless, this is the slowest wall-clock phase
   (~12 s per batch); a larger `--tick-ms-per-batch` gets through it sooner.
5. The "RE-VOLT loading" screen, captioned with the file being loaded
   (`levels\frontend\frontend.inf`, then `C:\WINDOWS\TEMP\revolt.log`). During
   it the game bubble-sorts model polygons at `0x44bc2a`–`0x44bc56`. That is
   finite but O(n²), and it holds one unchanged frame from batch ~196 to
   ~300.
6. The 3D **main menu** (shop-counter scene; Start Race / Best Times /
   Options / Quit; `V0.01pcgamer` in the corner) by batch ~312, about 7 minutes
   of wall time on a 4-vCPU boat. Pressing Enter at batches 170 and 175
   (`keydown:13`/`keyup:13`) skips the legal screen.

## Route to a race (reviewed 2026-10-11)

Run `scratch/runs/20261011T0038Z-re_volt_demo-race-claude1863` (`route.sh`
there). From the menu, Enter every 15 batches from 330 to 510 takes these
defaults: Start Race → Single Race (b345) → car select → "Toys in the Hood
1" (b400) → loading `levels\NHood1` (b445). The track load is slow; while it
runs the game places 64 objects by rejection sampling at `0x45a7c0` (CRT
`rand` at `0x482c69`, outer `cmp esi, 0x40` at `0x45aa65`). The race starts
around b674. Holding Up (VK 38) from b670 drives the buggy. The run reaches
b810 in about 16 minutes.

## Texture loading and the colour fix (2026-10-11)

Texture pages are 256×256 **A1R5G5B5**: the DDSD pixel format is flags 0x41
with masks 0x7C00/0x03E0/0x001F/0x8000, copied from the format the game picked
at `0x726c78`. The creation loop near `0x46cea0` makes a system-memory page and
the video-memory pages, then `Texture2::Load`s each one. A BMP (24-bit,
`levels\nhood1\nhood1a.bmp`...) gets into a page through `LoadImageA` and
`CreateCompatibleDC`, then `GetDC` on the system-memory page, `StretchBlt`,
`Lock` and `Load` (GetDC returns at `0x46d67f`, Lock at `0x46d71d`). The only
GDI imports are LoadImageA, CreateCompatibleDC, SelectObject and StretchBlt.

Until 2026-10-11, GDI on a 16bpp DirectDraw surface always wrote RGB565
(`$gdi_dx_dc_bind` and `$gdi_raster_channel_mask`). Both D3DIM arms then read
those texels as 1555. The result was a grey road drawn purple, the wooden fence
green, the grey manhole yellow-green, and rainbow speckle wherever green's low
bits vary. This was not mip aliasing and not a sampler bug: the software and
WebGL frames matched. GDI now uses each surface's own layout. Before/after on
both arms, plus the source BMPs: run
`scratch/runs/20261011T0150Z-re_volt_demo-edge-speckle-claude1863`.

## API profile (legal screen, 60 s)

`IDirect3DDevice3_SetRenderState` 22.5k, `IDirectInputDevice_Acquire` +
`GetDeviceState` 7.6k each, `SetTextureStageState` 5.4k,
`IDirect3DViewport3_SetViewport2` 5.4k, and Flip/BeginScene/EndScene 3.9k each.
Every frame also does the GDI sequence `GetDC`, `CreateCompatibleDC`,
`SelectObject`, `StretchBlt`, `DeleteDC` and `ReleaseDC`. Input is DirectInput
keyboard polling (`GetDeviceState`), so `--input=B:keydown:VK` reaches it.
Command: `--trace-api-counts`.

## Browser loading-stall report (2026-10-13)

User report `TG60-REVOLT-LOADING-20261013` shows loading
`models\\sphere.ncp`, EIP near `0x45a8xx` / `0x482c69`, and repeated ESI
`0x3f`. Original EXE SHA-256
`58ba4835e6607eae62be4e023ef989172cb519c78f34811acba547e9e0e3581a`
confirms the placement routine above: rejected separation branches at
`0x45aa17`; acceptance increments ESI at `0x45aa5a` and compares with 64
at `0x45aa65`. ESI 63 is consistent with the last object. Changing EIP or
random state alone does **not** prove that object will ever be accepted.
CRT `rand` at `0x482c69` updates its original state at guest `0x49bb88`.

Run `scratch/runs/20261013T2305Z-revolt-original-browser` used exact clean
source `a116a574c7411671b1042013b641ac0765471ef5`, an independent canonical
build (WASM SHA-256
`46c1e23aabca26de5e459f21463d3e1167f3a71d95e573ffedecefe7b31765f7`),
and all 443 original installed files plus the browser manifest verified by
hash. Registered browser route was
`index.html?app=re_volt_demo&debug&no-threads&d3d-renderer=webgl` on
`bx_yqnspudj`. Live controls confirmed WebGL, RLE/x87/uop enabled, Lazy Sync
enabled, and Threads unchecked, matching the report. Five-second samples
read registers and the random state; they did not write guest memory, change
the clock, restore a snapshot, or change random state/configuration.

Launch was 23:04:49 UTC; reviewed main menu was 23:06:18 (89 seconds).
Ordinary Enter selected Start Race, Single Race, default player name,
RC Bandit, Toys in the Hood 1, then the summary at 23:08:17. The log sampled
placement at 23:09:03, EIP `0x45aa1d`, ESI 62. It then passed that routine
and reached the reviewed starting grid at 23:09:24, about 67 seconds after
the summary confirmation and 276 seconds after launch. No sustained ESI 63
was observed in this run. `loading-003.png` is the starting grid;
`race-001.png` and `race-002.png` show later race timers 21.799 and 39.762
seconds after ordinary Up input, with the latter showing 8 mph. Up without
steering took the car off the intended route into a dark tunnel/wall area;
this is limited evidence of movement and input response, not a completed
lap or a separate physics/rendering diagnosis. Browser closed normally at
23:10:19; supervisor/driver/Chrome PIDs and groups were absent at 23:10:50.

The reported prolonged stall was **not reproduced**, and no emulator fix is
claimed. The user's exact loaded module, elapsed stall duration and random
state are unknown; a successful independent run does not establish that all
placements terminate. If it recurs, preserve the exact module and elapsed
ESI/random-state series before changing any optimization settings.

## Loading-time profile (2026-10-13, TG62)

Run `scratch/runs/20261013T2327Z-revolt-loading-profile` used the same original
443 installed files plus manifest, clean `a116a574`, canonical module
`46c1e23aabca26de5e459f21463d3e1167f3a71d95e573ffedecefe7b31765f7`, Chrome
151.0.7922.108, WebGL selected, and cooperative guest threads. No game state,
random seed, clock, or settings were changed. The added diagnostics were the
existing performance HUD, 2 ms CDP sampling, CDP network timestamps, and
read-only provider-fill/main-IO-poll wrappers. Startup and track profiles each
had a 120 s cap, inside a 420 s driver and independent 440 s group supervisor.

The earlier **275.572 s launch-to-grid** observation includes **118.819 s of
menu navigation and review**. Its final confirmation-to-grid capture was
**67.432 s**; calling the whole 4.5 minutes loading is incorrect. Captures bound
screen availability rather than marking exact transitions.

The new profiles identify substantial **software rendering on a cooperative
guest thread**, despite the WebGL selection. To exclude time spent reviewing
menus and the grid, `analysis.json` crops the full profiles to the console's
thread-2 spawn/exit timestamps. The thread starts at guest `0x444800`; a live
read-only thread snapshot confirms it was active during track loading alongside
the Miles audio thread at `0x8624b0`. The software-draw profile call chain is
`step → runBudgeted → runSlice → DrawPrimitive → rasterize_triangle_textured →
viewport_draw_textured_span`. The function map comes from the exact build;
WASM function 6821's body starts at byte 939163, matching its profile position.

| Loading-thread window | Window | Textured spans | Rectangle clears | Depth clears |
| --- | ---: | ---: | ---: | ---: |
| Frontend | 62.526 s | 40.756 s | 5.928 s | 5.618 s |
| Track | 71.553 s | 45.420 s | 6.811 s | 6.295 s |

Those three functions account for approximately **84% and 82% of sampled
elapsed time**, respectively. These are sampling-based time attributions,
not hardware CPU-utilization measurements. The full startup profile also
contains 18.6 s attributed to the WebGL `fence` method, predominantly outside
the loading-thread window; synchronous GPU readback can block there. It must
not be presented as the loading bottleneck from this profile.

During the track window, 152 provider fills took a median **244.7 ms**, while
156 HTTP range requests took a median **6.75 ms**. The union of network-request
intervals was **1.136 s**, compared with **40.855 s** for provider-fill intervals
and **41.020 s** for main-thread IO parking. These intervals overlap and must
not be added. The large gap is consistent with browser-thread contention
delaying provider completion while the cooperative thread renders; the
loopback network transfer itself does not explain the observed loading time.
Guest sorting and rejection placement still execute, but sampling main EIP
alone misses this secondary-thread rendering cost. This run sampled ESI 63 in
placement and subsequently reached the grid; it did not reproduce a lasting
placement hang.

Source explains the backend mismatch: `host.js::_startD3DIMGpu` explicitly
binds the executor and `d3dim_gpu_enable(1)` to the main instance. Cooperative
threads receive separate instances in `ThreadManager.spawnPending`; their
per-instance `$d3dim_gpu_on` starts at zero, and the manager has no corresponding
GPU-enable/executor setup. The host bridge deliberately retains synchronous
software fallback when no consumer is attached. Identifying thread `0x444800`
as the loading-screen drawing thread is supported by its lifetime, disassembly,
live identity and the cooperative drawing call chain; the profiler does not
directly label individual guest thread IDs.

The next generic fix to investigate is GPU routing for cooperative secondary
threads, with the **calling instance's exports/state** and shared surface
ownership preserved. Merely enabling the flag or reusing an executor whose
`getExports` is bound to the main instance is insufficient. Validation should
cover a secondary-thread Direct3D draw, cross-thread clear/draw/lock ordering,
software fallback, and an original-game before/after profile. No such fix or
speedup has been tested here. Profiling overhead is unknown; these instrumented
times are not a speed comparison against the earlier uninstrumented route.

**Update 2026-11-05 — cooperative GPU routing landed (unit-validated only).**
Ported from `fix/revolt-cooperative-d3dim`: `host.js` gives each cooperative
thread's imports a `d3dCommands` that calls the one in-page `D3DIMGpu` via
`callForExports(<that instance's exports>, …)`, and `ThreadManager.spawnPending`
calls `__initializeCooperative` after WASM/stack/TLS init, which runs
`attachCooperative` → each instance's new `d3dim_gpu_cooperative_enable`
export (sets `$d3dim_gpu_on` and `$d3dim_gpu_cooperative`). With
`$d3dim_gpu_cooperative` set, `$d3dim_worker_fence` / `$d3dim_surface_fence`
query the shared owner even when this instance has no pending draw of its own,
since a sibling may own the dirty pixels. The first attach retires the main
instance's owed async-Flip present and switches the owner to synchronous Flip,
because that obligation lives in one instance's globals and a sibling could
swap the chain under the in-flight readback. `test/test-d3dim-cooperative-routing.js`
covers a secondary-instance draw described with its own exports, cross-instance
draw/clear/Lock ordering, scratch reuse, page-lease release through a sibling,
async-Flip retirement at attach, and WebGL-unavailable software fallback
(`--negative-barrier` / `--negative-caller` fail as intended). **Not yet done:**
an original-game before/after browser profile on the loading thread — the
CLI has no WebGL, so the speedup is unmeasured. Limits: a cooperative thread
spawned before `_startD3DIMGpu` keeps software D3DIM, and Worker-backed
threads are unchanged (they use the render Worker path).

All 56 transferred original artifacts passed SHA-256 checks. Chrome and driver
exited normally; the supervisor recorded all 16 discovered child PIDs and both
owned groups absent at 23:32:57.113 UTC. Independent checks also found the
supervisor and all recorded PIDs/groups absent. No further run was needed for
packaging or analysis.

## Default-worker browser attempt (2026-10-31)

Run `scratch/runs/20261031T0358Z-revolt-race` stopped at an inspected startup
dialog, **`DDERR_NOTFOUND: Can't attach back buffer!`**, before the legal
screen, menu or race. The console records the dialog at 03:59:14.917 UTC;
`backbuffer-error.png` and its JSON capture confirm it at 03:59:19.530.
No steering, checkpoint or lap was reached. This is a precise execution
blocker for this runtime, not a reproduced loading stall or an established
current-main regression. No loading profiling or production fix was attempted.

The fresh Chrome 151.0.7922.108 browser used an isolated local server, explicit WebGL
selection, default enabled guest workers, and a stable 1024×768 viewport.
Two guest-worker instances were observed; the error capture records
`guestWorker: true` and renderer `webgl`. This differs from the cooperative
thread mode used in the October 13 runs. Only the trusted launch-button click
was sent; no guest memory/state, clock, random seed, settings, original assets
or executable were changed.

The retained module SHA-256 was
`8333a35b1efa694462033e87f62ce4a3f5497941d1423540b39a590c9d31134a`.
Its compilation source revision is **unknown**: the observed checkout HEAD
is not build provenance. The run copied and verified 106 retained runtime
snapshots from `20261031T0256Z-daikatana-webgl`, including host, worker,
renderer, registration and region-map files. `served.jsonl` also records
live supplementary resources, including the API table and fonts; 41 such
responses were preserved by hash in `extra-snapshots.json`. The mixed retained
runtime cannot establish behavior of a clean current-source build.

All 443 installed original files plus the browser manifest passed SHA-256
checks before and after execution (444 checks each). The original EXE hash
remained `58ba4835e6607eae62be4e023ef989172cb519c78f34811acba547e9e0e3581a`.
Evidence contains the original manifests, exact served snapshots, console,
screenshots, recovery instructions and process checks. Browser exit was zero;
all 13 recorded controller/browser PIDs were absent, port 37183 was closed,
and the owned profile was removed. No Boat or test boxes were used.

Next: reproduce this attachment failure with a known-source canonical build
and the same default-worker route before attributing a cause or attempting
the documented menu-to-grid driving route. Recovery commands and the retained
runtime limitation are recorded in the run's `RECOVERY.md`.

## Known-source attachment repair and native race (2026-10-31)

Run `scratch/runs/20261031T0403Z-revolt-backbuffer` reproduces the dialog
with a locked canonical build, SHA-256
`44aa997662d60841f292b1ad00e315f5c6b757f96172739b74675ea997e71836`.
It therefore establishes a current-source failure independently of retained
`8333a35`. The build includes concurrent uncommitted font work: the exact
source inventory, source bytes, dirty patch, combined WAT and served runtime
snapshots are retained; neither build is claimed to be a clean commit build.
The captured source inventories had no drift through their respective builds.

The original call at `0x423b83` requests BACKBUFFER through Surface4. Its
stack capability words at `0x074ffa80` are `{4, 0, 1, 31}`: only dwCaps is
initialized by the call site. Read-only inspection finds primary slot 13,
caps `0x6238`, owning live back buffers in slots 14/15, with first-child caps
`0x601c`; owner slot+1 is 6 for all three. The attachment exists and satisfies
BACKBUFFER. GetAttachedSurface instead rejected the unused extension words.
[Wine's implementation](https://github.com/wine-mirror/wine/blob/master/dlls/ddraw/surface.c)
ignores extension capability words for allocations created before DirectDraw 7.
The generic repair applies that allocation-version rule, including a legacy
allocation queried through a Surface7 view. DX7 allocation constraints and
the live-object, requested dwCaps and reference-ownership checks remain active.

The repaired locked build, SHA-256
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`,
reaches the inspected main menu and starting grid using the original EXE and
assets, explicit WebGL, default guest workers and stable 1024×768 viewport.
The render endpoint reports backend `webgl`. Native Enter selects Single Race,
default player, RC Bandit, Toys in the Hood 1 and the summary. Native Up drives
the car; later Up+Right and Down produce changed position/orientation and
speed. Reviewed frames show race times 2.942, 15.582 and 22.302 seconds and
speeds 1, 8 and 3 mph. The car leaves the road and overturns: this demonstrates
race execution and input response, **not a checkpoint, completed lap or win**.
The final Escape capture still shows the race; its filename is not evidence
that a pause menu opened.

The expanded native Surface4/7 guest-COM regression fails on the saved
pre-fix DirectDraw source and passes after repair in both tail-call and
compatibility dispatch modes. It checks legacy extension garbage through
Surface4/7 views, required dwCaps matching, DX7 rejection and ordinary acquired
reference release. Explicit AddAttachedSurface lookup also passes. Two older
synthetic tests (`test-directdraw-surface-caps.js` and
`test-directdraw-getcaps-allocation.js`) fail identically before/after while
creating/querying their fixtures, before exercising this repair; their logs
are retained, and they are not reported as passing. Both locked builds pass.

Both sessions verify all 443 original files plus manifest before and after.
Browsers exit zero, recorded browser/controller PIDs are absent, all four
HTTP/CDP ports are closed and both profiles are removed. The after controller
session reports exit 143 after its successful finally cleanup; no cause is
attributed. No Boat, delegated workers or test boxes were used. Recovery,
module identity, tests and cleanup details are in the run's `RECOVERY.md`.
Next useful gameplay work is native car recovery and a controlled lap from
the starting grid; no further startup repair is indicated by this run.
