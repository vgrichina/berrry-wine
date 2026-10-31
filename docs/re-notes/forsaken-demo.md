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
