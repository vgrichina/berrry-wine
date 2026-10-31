# Forsaken demo (Acclaim/Probe, 1998, Direct3D 5)

App id `forsaken_demo`, candidate `forsaken-demo` (registered 2026-10-11, w5).

## Source and licence

- archive.org item `FORSAKEN_201610`, `FORSAKEN.zip`: 42,762,069 bytes, SHA-1
  `2b8083248a8772710a0ae446e3442ca2b1ac5aab`.
- The zip is the CD's installer: InstallShield 3 (`SETUP.EXE`, `_INST32I.EX_`)
  with the game in `DATA.Z` (37 MB), plus `DIRECTX5/` redistributables and
  `CHKINST.EXE`/`INSTALL.BAT`.
- **No licence text anywhere.** `readme.txt` (revised 1.27.98), `readme.rtf`,
  `release.txt` ("Forsaken Shareware Demo, Version 1.0") and the exe's strings
  carry no EULA or redistribution terms. Without an explicit grant the
  candidate is `localOnly`.

## Layout

`tools/is3-extract.js` unpacks `DATA.Z` (873 files). The fetch tool's
`is3Extract` post-extract step runs it. `7z` and `unshield` both refuse this
format. The extracted root holds `ForsakenDemo.exe` (3.7 MB), `a3d.dll`,
`biodome.dmo`, `forsaken.scg`, `data/` (levels `volcano`, `subway`) and `opt/`.
The installer's default path is `C:\Program Files\Acclaim\Forsaken Demo`.
The game also runs from `C:\`, which is how the manifest mounts it. Static
imports are system DLLs only: DDRAW, DINPUT, DPLAYX, WINMM, WSOCK32,
AVIFIL32/MSVFW32, ole32 and the core four. No registry seeding is needed.

## Route (headless, `--batch-size=200000`)

- Boot: a 3D attract flythrough, then the in-3D menu. The first frames are
  white before the menu draws.
- Enter at batches 300, 450, 600 and 750 selects Single Player Game, Start
  (level Volcano), and the level briefing with its loading bar.
- By batch 1050 the player is in the Volcano level, with the HUD showing
  LIVES 5, SHLD/HULL 128, POWER 1, PULS 2000, MUG 5 and the message "The
  volcano could erupt any minute, get outta here".
- Ctrl (VK 17) fires the pulsar: two green bolts, and PULS drops to 1998.
  Up (VK 38) changes the view. 'A' did nothing.

```
node test/run.js --app=forsaken_demo --no-build --quiet-api --quiet-blocks \
  --batch-size=200000 --max-batches=1260 --stuck-after=100000000 \
  --input=300:keydown:13,301:keyup:13,450:keydown:13,451:keyup:13,600:keydown:13,601:keyup:13,750:keydown:13,751:keyup:13,1050:png:ingame.png,1180:keydown:17,1182:keyup:17,1188:png:fire.png
```

## The bug it found

The level load creates about 300 execute buffers after many other DirectX
objects. Our execute-buffer cache table (`$D3DIM_EB_CACHE_PTRS`) was keyed by
`DX_OBJECTS` slot but held only 512 entries (out of `$DX_MAX` 8192). Every
buffer in a slot of 512 or above got E_OUTOFMEMORY from `SetExecuteData`. The
game reported "Mload : SetExecuteData Failed", then "RenderScene failed". The
fix gives the table its own `$DX_MAX`-sized region, and
`test/test-d3dim-execute-buffer-slots.js` covers it.

## Open

- The attract and menu frames look heavily over-exposed (additive blending
  saturates to white). The in-game frames look right. This has not been
  compared with real hardware.
- Movement keys beyond Up were not mapped. Forsaken's default controls are in
  `readme.txt` §VI.

Evidence: `scratch/runs/20261011T0420Z-forsaken_demo-gameplay-w5`.

## Browser Volcano movement/combat, 2026-10-31

Evidence: `scratch/runs/20261031T0401Z-forsaken-play/`, including the
`explicit/` retry. Personally inspected actual gameplay beyond the briefing;
readable sustained play is blocked by severe rendering corruption. No production
repair, enemy kill, or level exit is claimed.

- First execution: 03:59:39–04:02:44 UTC. The textured starting room showed
  lives 5, SHLD/HULL 128 and PULS 2000. Ctrl produced visible green bolts and
  PULS 1998. A thrust changed the corridor view; impacts reduced shields to
  95, followed by death/respawn and lives 4. The native pause menu also drew.
  See `level-wait.png`, `primary-fire.png`, `through-door.png`,
  `combat-fire.png`, and `pause-held.png`.
- Explicit retry: 04:03:26–04:05:54 UTC, same retained runtime bytes,
  `/index.html?threads&debug&no-log&d3d-renderer=webgl`. Enter advanced
  the original logos → Single Player → Start Volcano → briefing. Waiting
  after the full loading bar and continuing reached the room. Ctrl 500 ms,
  A 500 ms, Right 300 ms, A+Ctrl 1500/1200 ms and A 2500 ms exercised native
  firing, rotation and thrust. PULS reached 1970; shields/hull fell under
  incoming fire; the final death frame reads “ENEMY KILLED YOU.”
  See `explicit/move-settled.png`, `advance-fire.png`, `forward-combat.png`,
  `corridor-progress.png`, and `combat-final.png` within that subdirectory.
- The first URL used `gl-renderer=webgl`, which is not the Direct3D selector;
  live WebGL selection was verified, but the explicit retry removes that
  ambiguity. Both used default guestWorker, Threads enabled, Chrome
  151.0.7922.108 headless, stable 1024×768 viewport, original assets, and
  trusted browser keyboard/mouse events. No cheats, state patches or asset
  changes. These are functional captures, not headful performance evidence.
- `explicit/live-backend.json` and `combat-backend.json` record the actual
  renderer: ANGLE, Intel UHD Graphics 620 (KBL GT2), Mesa 23.2.1 / OpenGL
  4.6 Core. Despite launch flags requesting SwiftShader, the measured driver
  was Intel. The live legacy endpoint requested WebGL, completed GPU draws,
  and reported zero software fallback draws and zero GPU errors.
- Concrete visual blocker: frames alternate between the complete room and
  retained Volcano briefing fragments with only part of the world updated;
  combat then becomes heavily red/white and over-bright. The explicit retry
  reproduces it, including fragments before combat. Source cause is unknown;
  screenshot completion and zero API errors do not establish correct rendering.

Both executions loaded module SHA-256
`7f9da4e9da5183e9f7f061d2356cd34626fe74bdbaf7da0345f6693dd81152be`;
compiled source/commit remains **unknown**. Observed checkout HEADs in
`started.json` are not module provenance. EXE SHA-256
`366ec5d0943daca839836296f9fb52724e94dc155630c6b0c30d7181106b5e24`,
local manifest SHA-256
`587ce145ab73a3fed2c7136425bb6a7bcf28def312d430c8bf7d1be802b2260b`.
The 107 fetched runtime snapshots are retained by hash; original inputs and
served bytes have before/after checks. Exact wall-clock inputs, launch flags,
backend reports, verification and recovery instructions are in the bundle.

Current default controls, confirmed against the original readme §VI: A/Z
forward/reverse, arrows rotate, Ctrl primary, Space secondary, Alt strafe,
Escape pause. This supersedes the older “A did nothing” observation as a
control mapping. Both owned browser/controller processes exited, profiles and
HTTP/CDP ports were removed/closed. No Boat/test box allocated (ID/state/expiry
not applicable); ownership returned. Next investigate the WebGL transition /
frame-clear or presentation boundary with this retained module and originals;
those are investigation targets, not established causes.

## Known-source WebGL frame investigation, 2026-10-31

Evidence: `scratch/runs/20261031T0427Z-forsaken-frame/`. This bounded
investigation made **no production repair**. It reproduced the rendering
blocker on known source and separated GPU target contents from page display.

Source identity is module SHA-256
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`,
the retained ReVolt `20261031T0403Z-revolt-backbuffer/after.wasm` from its
successful locked canonical build. All 292 entries of that run's
`source-after-manifest.json` matched the checkout before this execution.
The browser served those retained source bytes and module, with fetched
runtime snapshots retained again in this bundle. This identifies an exact
saved source tree, including the then-concurrent font work; it is not a
clean-commit build claim. The previous `7f9…` module remains source-unknown,
and its old images are not current regression evidence. Other workers began
source edits during wrap-up; the retained pins identify this run independently.

The runtime waited for UT2004 to close, acquired `/tmp/wine-browser.lock`
at 04:37:13 UTC, checked the process list, and held the lock for its entire
lifetime. One original Enter route reached Start Volcano, the briefing and
the room. Default guestWorker, Threads, explicit `d3d-renderer=webgl`, and
1024×768 stayed enabled. Native Ctrl 500 ms, A 500 ms, Right 300 ms,
A+Ctrl 1200 ms, A 1800 ms, and Escape exercised firing, movement/rotation
and the native pause menu. PULS fell from 2000 to 1994 and then 1978.
Personally inspected `briefing-continue.png` and `primary-fire.png` show a
readable room and green projectiles. `thrust-short.png`, `rotate-short.png`,
`corridor-move.png` and `pause.png` show retained briefing/world fragments;
`advance-fire.png` and `settled-no-fire.png` show saturated projectile areas.
Sustained readable movement, an enemy kill and level completion are unproved.

The observation wrappers delegate the original renderer methods unchanged;
they record clear arguments, draw states, uploads and completed readbacks.
The built-in owning-draw trace omits clears and initial color/depth/CPU
writes, so it cannot alone answer this question. Full-target `readPixels`
samples were also taken without flushing or changing render state. Their
bottom-up RGBA bytes are retained and converted losslessly to PNGs.

- `thrust-short-gpu.png` contains the actual Volcano title, briefing text,
  loading bar, partial room and projectiles **inside the GPU color target**.
  Its metadata records no deferred draw pending. Thus the stale fragments
  are not solely a page compositor/presentation artifact, or merely a
  lighting interpretation of an otherwise complete room.
- `primary-fire-gpu.png` contains the full room on DIB `472317952`;
  `thrust-short-gpu.png`, `rotate-short-gpu.png` and `advance-fire-gpu.png`
  contain fragments on DIB `471678976`, for the same render target
  `131805408`. Logs show alternating DIB uploads. These are this module's
  observed addresses, not an ABI. GPU samples and page screenshots are
  sequential observations, not synchronized identical-frame pairs.
- The retained gameplay trace windows request flags **2**, depth only,
  over `(0,0,640,480)`, with Z=1 and successful GPU clear results. A sampled
  completed readback updates only `[340,206,582,288]`; subsequent samples
  likewise show bounded partial updates. Source review confirms that the
  clear path forwards the requested flags. This does not justify inventing
  a color clear when the game asks to preserve color.
- Bright projectile areas also appear in the full GPU samples. Additive
  draw states occur, but their presence does not establish incorrect blend
  factors, accumulation across complete frames, or incorrect game lighting.
  Zero GPU errors/fallbacks likewise does not establish correct pixels.

**First unresolved blocker:** why full world coverage is absent while the
flip-chain backing still contains briefing/projectile pixels. The sampled
render states/readbacks do not preserve a complete frame's initial
color/depth, owning draw/resource inputs and intervening CPU writes. They
cannot assign the fault to execute-buffer/front-end coverage, backing
synchronization, or GPU rasterization. No speculative clear/blend/lighting
change, guest state/clock patch, cheat, asset edit or validation bypass was
made. A repair requires identifying the first missing/ineffective world draw
across that boundary; no successor task was launched.

Original input hashes pass before/after (873 files). All 107 runtime pins
verify, and 26 recorded native events are trusted.
The measured live legacy/WebGL endpoint uses ANGLE on Intel UHD 620 / Mesa
23.2.1, despite launch flags requesting SwiftShader, with zero GPU errors,
fallbacks and completed software draws.
Existing pure-JS mock
tests for GPU batching/clear ordering, depthless Z, and async Flip pass.
`test-d3dim-gpu-fallback-counters.js` fails on unchanged source at
`fallbackDrawTexture` (expected 1, actual 0); this is recorded, not claimed
as the game cause or repaired. No new build or new source regression is
claimed for this docs-only investigation. Helper syntax and evidence checks
are retained in the bundle.

Browser PID `1536530` exited 0; controller `1536494`, lock holder `1527163`
and watcher `1528360` are absent. HTTP `35875` and CDP `34131` are closed,
the profile is removed, and no keys remain held. The controller tool returned
143 after its finally completed; that exit's cause is unknown. No Boat/test
box was allocated (ID/state/expiry N/A); delegated local shutdown is complete.

## Complete renderer boundary: world vertices already degenerate (2026-10-31)

Run `scratch/runs/20261031T0552Z-forsaken-boundary/` advances the 0427Z
partial-window observation. One native Volcano run captured two complete
clear-entry-to-next-clear-entry intervals, each containing exactly one original
Flip. Frame 1 spans epoch milliseconds
`1793426468823.48–1793426469383.7852`. This identifies the first ineffective
world draw in that frame; the first historical corrupting operation remains
unproved. No production repair was made.

The retained module is SHA256
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`,
with the exact matching **292-source** ReVolt0403Z snapshot. Its manifest is
`9dee97b3f74481ba14d6808ecce1d4b665099d8b03c58235e0b02812b234e379`.
All 107 runtime response pins and original 873 inputs verify; current host
sources were not substituted. Default guestWorker, Threads, explicit WebGL
and 1024×768 were measured live. The actual legacy endpoint uses ANGLE on
Intel UHD 620 / Mesa 23.2.1. Native Enter reached Single Player/Start Volcano;
the synchronized capture used trusted A for 500 ms. No game state, asset,
clock or validation edits were used.

`boundary-trace.json` retains initial/end GPU color, framebuffer/depth
attachment identities, CPU backing/object snapshots at renderer handoffs,
uploads, clear arguments, owning command/state bytes, texture bytes, all
actual submissions, per-draw before/after GPU pixels and readback. The
initial depth renderbuffer contents cannot be read directly; the first
successful full `(0,0,640,480)` flags **2**, Z=1 clear defines the depth used
by every captured draw. CPU snapshots do not record every individual guest
instruction store. The separate original Execute/TRIANGLE/Flip trace has
no overflow and brackets the same complete intervals.

- Frame 1 begins with a full room in the GPU color target. The incoming CPU
  backing already contains Volcano briefing fragments. A full 480-row upload
  of those bytes exactly reproduces the post-clear GPU color, including the
  briefing; the depth-only clear preserves it. Target `131805408` and observed
  alternating backings `471678976`/`472317952` are evidence addresses, not an
  ABI. The upload observer's old `t.dib` label precedes `_prepare` updating
  that field; its retained bytes and live backing pointer identify the upload.
- The first world draw is endpoint **1**, sequence **33070**, ordinal **0**:
  76 triangles from execute buffer `22496756`, TRIANGLE offset **5232**,
  following PROCESSVERTICES offset **5196** (TRANSFORM, start/destination 0,
  count 96). Every referenced vertex already has identical XYZW at Execute
  entry: approximately `(580.0194,285.7600,0.9982571,0.000130648)`.
  After PROCESSVERTICES they all equal
  `(580.9359131,285.9217529,0.9982455969,0.000131108522)`.
- The six world draws contain **76/60/102/106/238/88 = 670 triangles**.
  Each has one unique position and changes **zero actual GPU pixels**.
  Indexed Execute expansion matches every owning transport vertex byte;
  actual submit/raster inputs match after the expected BGRA-to-RGBA color
  conversion. The world geometry is therefore already ineffective before
  GPU rasterization. Later object draws of 8 and 6 triangles have distinct
  positions and change 18 and 1,890 pixels. Readback is bounded to
  `[340,205,583,288]`.
- Frame 2 also has 670 collapsed world triangles and zero world pixel
  changes, but its incoming backing already contains a full room. Personally
  inspected synchronized `boundary-f1-start.png`, `boundary-f1-end.png` and
  `boundary-f2-end.png` show full room → briefing fragments → full room.
  Full-looking color can thus be inherited from a backing even when the
  current world draws do no work. This does not require a color clear or
  implicate blending/lighting. Zero GPU errors are not used as pixel proof.

**Precise missing capture dependency:** the first native initialization of
these world buffers, first source-cache creation, subsequent Lock/Unlock and
vertex writes, and source-cache/matrix/viewport inputs immediately before the
first divergent PROCESSVERTICES. The successful guest trace began after all
referenced world positions were already collapsed. Later correctly decoded
`world-caches.json` also contains collapsed screen-like coordinates. Retained
`09ab-handlers-d3dim-core.wat` reads the source cache and writes transformed
TL vertices into the live execute buffer; `09aa-handlers-d3dim.wat` Unlock
refreshes the whole source cache from that buffer. Feedback through that
refresh is a candidate mechanism, not an established first cause. This run
cannot distinguish it from original game writes or another earlier front-end
operation. No speculative cache, clear, blend or lighting change is justified.

Replay the focused evidence check with
`python3 scratch/runs/20261031T0552Z-forsaken-boundary/check-boundary.py`.
It passes both complete intervals, all 16 Execute/transport/submit matches,
1,340 degenerate world triangles with zero changed pixels, four effective
object draws, exact 565 upload/color reconstruction, and all input/source/
runtime hashes. This is an observation check, not an old-source-rejecting
repair regression. No new build is claimed for this docs-only change.

Capture limitations are preserved in `late-observation-limit.json`: the
startup instantiate hook missed its instance; the successful observer used
an always-false conditional breakpoint in the original `dx_trace` import.
The initial cache decoder assumed 8192 slots/64 bytes; actual retained layout
is **16384 slots/32 bytes**, so its half-index slot and `cacheGuest:0`
metadata are invalid. Raw Execute bytes are independently validated against
the transport. A subsequent Ctrl 500 ms screenshot failed; a later live
observation found no guest workers, cause unknown. No new primary-fire image
contrast is claimed. A late empty-page capture overwrote `boundary.png`;
exclude it and use only the synchronized GPU PNGs above.

Own Chrome `1630186` exited 0; controller `1630169`, holder `1630168`,
tracked children/crashpads are absent. HTTP `41779` and CDP `44313` are closed,
profile removed and keys released. The browser lock covered the entire
runtime, including the process/profile gate; another worker's orphan was
left to its owner to close before launch. No Boat was allocated
(ID/state/expiry N/A); delegated local cleanup is verified. Evidence and
replay instructions are retained in the run's `RECOVERY.md`; no successor.

### 2026-10-31: first native source-cache feedback captured

Run `scratch/runs/20261031T0617Z-forsaken-first-mutation/` retains the
predecessor's exact `8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`
module, matching 292-source manifest
`9dee97b3f74481ba14d6808ecce1d4b665099d8b03c58235e0b02812b234e379`,
107 pinned runtime responses and 873 original inputs. No current runtime was
substituted into that retained build. Original input checks passed before and
after the native run. Default guest workers, Threads and explicit WebGL ran at
640×480 inside the 1024×768 page; no guest state, clock, asset or DLL changes.

A CDP auto-attach observer pauses each guest worker immediately before
`WebAssembly.instantiate`, wraps the actual host imports, and removes the
breakpoint. `startup-observer.json` records installation with no instance;
the first DX observation finds no execute buffers in the actual 16384-slot,
32-byte table. This fixes the predecessor's startup installation race.

The authoritative `after-native-a-worker-2.json` segment has no overflow or
observer errors. Slot 1352, buffer size 6784, is observed from creation (event
415), first Lock (417), 876 initialization byte-delta observations, first
Unlock (1294/1295), cache population and first Execute. Replaying every delta
reconstructs Unlock-entry bytes exactly. Changes are sampled at original
block boundaries and API boundaries; this is not an instruction write barrier.
The original color loop is retained and disassembled: `0x43a445 mov [edi],eax`,
with 32-byte source/destination strides. Addresses identify this run only.

The causal chain is now established for this original native buffer:

- First PROCESSVERTICES (1377) reads original source XYZ
  `(6.8727074,-767.9973145,2658.7331543)`. Its output mutates the live vertex
  bytes, while the source cache keeps original XYZ through Execute return.
- The next Lock returns exactly that engine-written live payload. Original
  guest code changes 29 bytes, all at offset 16 modulo 32 (diffuse color).
  All observed deltas reconstruct Unlock entry (1416); XYZ/RHW are unchanged.
- Unlock (1417) replaces the source-cache payload with the live payload.
  The next PROCESSVERTICES (1420) therefore reads the preceding engine output
  `(352.1822510,202.0121155,0.9938518,0.0003065896)` as input XYZ.
  This is engine output fed back by Unlock, rather than original game XYZ
  stores. `check-mutation.py` asserts the full chain, including byte identity.

Both first and first-divergent PROCESSVERTICES include the 4096-byte device
state, WORLD/VIEW/PROJ/previous composite and canonical viewport descriptor;
`first-pv-state.json` decodes these. The trace occurs before composite
recomputation, so the retained composite is explicitly the previous value.

This buffer's instruction offset/counts differ from the predecessor's six
Volcano world draws: offset 5408, PROCESSVERTICES groups 40/21/108. Personally
inspected startup/room/copyright screenshots do **not** establish the Volcano
briefing route. Do not relabel this startup/attract-room observation as the
predecessor's exact first Volcano world buffer. It proves the generic mutation
mechanism; that exact route identity remains a separate observation dependency.
Earlier unfiltered initialization segments hit the observer's event bound and
are excluded from the causal claim. A TextDecoder SharedArrayBuffer issue in
the initial observer was corrected before the authoritative segment; retained
secondary-worker errors and earlier saturated segments are not hidden.

The generic repair keeps application source and processed TL output in separate
regions within one owned cache block. Unlock refreshes source; transforms
write output, and triangles/points/lines/Pick read output after processing.
Before processing, direct TL buffers retain their live-buffer path. Release
frees both streams together. Allocation failure must not transform live source.
The sparse-vertex regression now asserts source preservation, stable positions
and updated colors after a color-only Unlock; the instruction regression reads
COPY/viewport results from driver output and separately checks unchanged source.

The fresh repaired native candidate is
`41f5c4c737ce7b428455aaa9dfe0c5045cd1ead7b00b96070feebb8368d4a2a4`,
with matching 295-source/7-compiler snapshots in `repaired/`, identical source
and compiler manifests before/after the locked build, 106 pinned runtime
responses and 873 unchanged originals. Personally inspected `enter2.png`,
`single-player.png`, `start.png`, `native-enter-volcano.png` establish the
native menu → single player → START → VOLCANO → briefing route.
`world-frame.png` shows a complete room and HUD; `native-response.png` shows
the view pitched downward and pulse ammunition **2000 → 1998** after trusted
ArrowUp+Control for 500 ms. All 18 retained browser events are trusted.

`repaired/check-source.py` verifies the matching original Volcano instruction
layout, offset **5184**, first PROCESSVERTICES **5196**, slot 536 in this run.
All **162 original XYZ vertices stay unchanged across 12 Execute cycles**;
24 pre-PROCESSVERTICES observations retain source/live equality, separate TL
output, device state and viewport. Thus the repaired source cannot accumulate
the proven feedback from the earlier native trace.

`repaired/check-redraw.py` verifies two complete depth-only-clear intervals
(flags **2**, unchanged valid semantics). Each has six world draws totaling
**642 triangles**, followed by two object draws. Every world draw has distinct
positions and changes actual GPU pixels. Frame 1 world changes per draw are
**166618 / 126250 / 5938 / 1058 / 4181 / 3056**; frame 2 is likewise effective.
Summed pixel-change events are **307101 / 307489** (overdraw counts repeatedly;
these are not unique frame pixels). This proves current world rasterization,
rather than relying on a full-looking inherited backing. The visible native
view differs from the predecessor's 670-triangle view; no identical-camera
pixel comparison, sustained play, performance or completion claim is made.

Focused old-source rejection fails specifically on preserving Lock-visible
source. The repaired reproducer passes 32 color-only cycles. Focused sparse,
cache replacement/OOM, lifetime, descriptor, instruction/branch, 2470 vertex
pixel comparisons and viewport checks pass, as does the locked build.
A final review corrected an allocation-failure guard after this native capture;
its final build/identity and focused allocation-failure check remain pending.
The captured native normal path always had separate output; the guard concerns
only missing output storage. Native candidate and final build closures remain
separately pinned, without substituting current runtime into either module.

A later optional screenshot capture stalled after the demonstrated input.
An external connection captured `final-live.png` while changing its viewport
to Puppeteer's default 800×600, then closed our browser. Exclude that teal
cleanup frame and the failed `native-after` capture from visual validation.
The controller's finalizer closed the server and removed its profile; its
`browserExit:null` is **not** an exit-0 receipt. Independent cleanup verifies
all 17 recorded owned PIDs absent, HTTP **44385** and CDP **37021** closed,
profile/process match absent, no held keys and original 873 inputs unchanged.
No foreign processes were touched. Browser/heavy checks held the browser lock
for their entire lifetime. No Boat was allocated (ID/state/expiry N/A).

At the bounded stop the repair remains **uncommitted WIP** in
`src/09aa-handlers-d3dim.wat`, `src/09ab-handlers-d3dim-core.wat`,
`test/test-d3dim-execute-vertices-sparse.js` and
`test/test-d3dim-execute-instructions-sparse.js`. Final review changed only the
allocation-failure guard after the tested native candidate; that final change
needs its focused failure/retry regression and locked build. The other worker
still owned the browser/heavy-CLI lane at the stop, so our queued check PIDs
1687827/1687832 were canceled and verified absent. No source changes are
committed, no final-guard build is claimed, and no successor is launched.
The native-tested candidate, exact closure, screenshots and pixel proof above
are complete; `normal-native-to-final-guard.json` checks the exact one-condition
difference. Next required work is the final guard regression/build before any
scoped source commit.

### 2026-10-31: final separate-output repair verified

Fresh run `scratch/runs/20261031T0658Z-forsaken-output-land/` completes the
released repair's final checks. The final module is SHA256
`d2c1df73d975daa4e7425152fb900274ebd9552c5a689249415084cfe8ac026b`
(1,898,571 bytes). Its exact 295-source manifest is SHA256
`4d8c8330e34c5230fb9e17855b3f7db9394857d2ed49de0789e3d98d2f33b132`;
all source, seven compiler inputs and two changed test files match before/after
verification. `final.wasm`, manifests, snapshots, patch and
`final-build-identity.json` retain the tested dirty-source closure based on
`f992c7fa84b2804aa877697377ac5044f9ebca20`.

The generic repair owns source and processed output in one cache allocation.
Unlock refreshes only source; PROCESSVERTICES writes driver output, which is
consumed by triangles, lines, points and Pick. Direct TL buffers keep their
live-buffer path until processing begins. Replacement allocation preserves the
old owner until success, and release frees both streams together. The final
guard normalizes the COM-pointer condition and skips processing when output
still aliases live application storage after allocation failure.

Cheap syntax, manifest, fragment, logical-operand and whitespace prerequisites
passed before heavy work. Under the full-lifetime browser lock and a clean live
process/profile gate, the released reproducer rejects old source on Lock-visible
source corruption and rejects the native candidate's guard specifically on OOM
source corruption. Final source passes 32 color-only cycles, allocation failure
without source mutation, and successful retry with matching projected positions
and color. The checked-in sparse regression now runs 32 cycles across all three
PROCESSVERTICES modes and owned/sparse cache cases, preserving all source bytes
outside application color edits. All six focused scripts pass: vertices-sparse,
cache, buffer-lifetime, buffer-oom, data-sparse and instructions-sparse. Coverage
includes replacement/retry/release ownership, 16 buffer allocation failures,
descriptor/status transactions, 2,470 vertex pixel comparisons and viewport
behavior. `flock /tmp/wine-build.lock bash tools/build.sh` also passed.

The native-tested candidate remains the historical **41f5c4c7…** module above.
Read-only verification of its 295 source and seven compiler snapshots proves
that final runtime source differs only by the failure guard; compiler inputs
are unchanged. Replaying its 24 native pre-PROCESSVERTICES observations confirms
matching cache allocations, separate output and unchanged original XYZ for 162
vertices across 12 Executes. Both guards continue on every captured normal-path
observation. **The final d2c1df73… build received no fresh native retest**;
Volcano redraw, pitch and ammunition evidence belongs to the prior candidate.
No further normal-path engine change was made during this final verification.

Historical evidence and native-candidate snapshots were preserved; the old
`checks.sh` was not rerun. Fresh `RECOVERY.md` documents safe replay into the new
run. No browser, runtime, ports, profile or test box was started by this worker;
no Boat was allocated (ID/state/expiry N/A). The foreign Deus runtime was left
untouched and all heavy work waited for its lane release. Disk stayed above
2 GiB. No public deployment or successor is part of this task.

### 2026-10-31: landed final build, further native Volcano play

Run `scratch/runs/20261031T0713Z-forsaken-repaired-gameplay/` gives the landed
**d2c1df73… final build its own native gameplay evidence**. It serves the exact
retained `20261031T0658Z-forsaken-output-land/final.wasm` and matching
`after/source` closure, never the historical 41f5 candidate or current host
files. All 295 runtime files match the landed `df174b3cf` git objects; all seven
compiler inputs and the final module hash verify. No source repair or rebuild
was needed for this gameplay task; the locked build/six focused regressions
remain the landing run's evidence.

Personally inspected native menu captures establish Single Player → Start →
Level Volcano → loading/briefing → game. Default guestWorker, Threads, explicit
`d3d-renderer=webgl` and 1024×768 stayed enabled. The original readme controls
were used through trusted browser keyboard/mouse events: A thrust, arrow look,
Ctrl primary, Space secondary, Alt+arrow strafe and Escape pause/resume.
No game state, clock, INI, asset, cheat or input-queue edits were made.

- `level-ready.png` shows the full teal starting room, doorway and readable
  HUD: lives **5**, SHLD/HULL **128**, PULS **2000**, MUG **5**.
  `forward-door.png` shows translation up to the doorway.
- `through-door-fire.png` shows entry into the metal corridor with readable
  geometry/HUD and visible projectiles/impact effects: PULS **1978**, SHLD **0**,
  HULL **76**. This exceeds the prior brief pitch/ammo-two response.
- Following a death/respawn, `look-right.png`, `corridor-push.png`,
  `corridor-deeper.png` and `turn-corridor.png` show another corridor advance
  and changed look/bank beside its wall. PULS **1976 → 1954 → 1952**, MUG **0**,
  and SHLD/HULL changes establish repeated combat responses within that life.
- `post-resume-thrust.png` shows a readable far corridor wall/right recess
  and the original instruction **“DESTROY ALL ENEMIES TO OPEN THE HIDDEN
  DOOR.”** It does **not** establish that any enemy died or the door opened.
  Later captures show another respawn/near-wall view, lives **1**, and PULS
  **1990 → 1960**; they do not prove a new-room traversal.

Readable gameplay captures span **07:26:21–07:29:47 UTC**, including several
movement/look/firing sequences, deaths and pauses rather than uninterrupted
survival. Lives fell **5 → 1**; ammunition resets on respawn, so the entire run
is not a monotonic ammunition sequence. Bright combat effects remain. Pause/
resume captures also contain white menu/background frames. In particular,
`beyond-corridor.png` and `sustained-thrust-fire.png` are command labels whose
images show the pause menu, **not movement proof**. `route-pause.png` shows a
death transition. Subsequent native thrust restored the readable far-corridor
view above. These limitations are retained in `visual-review.json`; correct
pixels on every intervening frame are not claimed. No enemy kill, hidden-door
opening, level completion, FPS or audio claim is made.

The strict server initially omitted five required launcher fonts and stopped
before game startup. That failed attempt is preserved under
`startup-font-rejection/` and closed cleanly. The retry adds 18 pinned ancillary
static assets, all matching historical response hashes; no font file was
edited. All successful responses are retained by hash; fixed-body optional
404 responses are separately recorded. Fresh checks pass for **873** original
files before/after, **609** successful responses (**555** distinct URLs),
**95** trusted native events, balanced keys and **41** intact 1024×768 PNGs.
Read-only runtime telemetry confirms the default guestWorker/selected WebGL
route and live D3D draw/flip counters; zero errors/fallbacks are not pixel proof.
Recovery and replay checks are in this run's `RECOVERY.md` and `verify.py`.

The browser lane lock covered startup, gameplay and cleanup, after waiting for
the Deus worker and passing the actual live-process gate. Browser **1726273**
exited **0**; controller **1726264**, holder **1726255** and all **59** recorded
owned PIDs (controller/descendants, including transient helpers/crashpads) are absent. HTTP
**37653** and CDP **40157** are closed; profile removed and no keys held.
The failed startup's owned processes/ports are independently checked too.
The final outer runtime tool returned **143**, cause unknown, despite the
browser exit-0 receipt and verified cleanup; controller exit 0 is not claimed.
No watcher, Boat/test box, public deployment or successor was started
(ID/state/expiry N/A). Next gameplay work can continue toward the hidden-door
objective; its enemy/door conditions are still unproved.
