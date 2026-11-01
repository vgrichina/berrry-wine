# Tachyon: The Fringe (demo)

NovaLogic, 2000 (copyright screen says 1999). Space combat, first five
single-player missions. Candidate `tachyon-demo`, app `tachyon_demo`, local
only.

## Source and layout

- archive.org `TachyonTheFringe`, `TachyonDemo.zip` (61,461,980 bytes,
  sha1 6a51db79d5d29c0e6f036b9dd29c2ddfd0a42e70). An InstallShield 5 package;
  `tools/is5-extract.js` unpacks `DATA1.CAB` (14 files, 92 MB) to
  `installed/tachyon` (guest `c:\tachyon`).
- `LICENSE.TXT` (NovaLogic): personal use of one copy, no reproduction or
  transfer without written permission. So `localOnly`, never deployed.
- `Front.exe` is the setup front end (Play / Video Setup / Control Setup /
  Update); `Front.cfg` says it runs `tachyon.exe` and writes `tachyon.cfg`.
  The registry launches `Tachyon.exe` directly.
- Data: `Space.pff` (68 MB), `Menubgs.sbf`, `Exile.sbf`. Renderers:
  `Hw_d3d.dll` (Direct3D, loads at 0x6e8000 relocated from 0x10000000) and
  `Hw_3dfx.dll` (Glide 2, wants `glide2x.dll`).

## Renderer configuration

`tachyon.cfg` `[VIDEO]`, read by the game itself with `_lopen`/ReadFile (not
the profile API, so `startupIni` cannot change it):

- `USE_HARDWARE=0` (shipped): software renderer, no hw DLL.
- `USE_HARDWARE=1`, `HW_TYPE=0`: `hw_d3d.dll` (IDirectDraw4 + IDirect3D3).
- `USE_HARDWARE=1`, `HW_TYPE=1`: `hw_3dfx.dll` -> `glide2x.dll`.
- `RES=1` (shipped): under D3D the game sets 640x480x16, then 800x600x32 on a
  second DirectDraw interface, but its menu still draws into 640x480 buffers.
  Our input then scales the page's 640x480 canvas to 800x600 (a click at
  320,226 arrives as WM_MOUSEMOVE 400,282) and every menu click misses
  (`d3d-res1-800x600-click-miss-b1899.png`). Not fixed; open question
  whether the canvas should follow the second mode.
- `RES=0`: stays 640x480 and clicks land.

The registry mounts `Tachyon.cfg` with `iniSet` `USE_HARDWARE=1`, `HW_TYPE=0`,
`RES=0`. That needed dbc778344: a registry file now replaces the generated
local manifest's file at the same guest path.

## Fixes it needed

- dd75c48d3: `IDirectDrawSurface::GetDDInterface` returned the v1
  IDirectDraw. hw_d3d.dll creates its chain on IDirectDraw4, asks the back
  buffer for its DirectDraw (RVA 0x3a7e area) and calls slot 27
  (GetDeviceIdentifier, vendor compared with 0x12d2); on the v1 table it
  hit something else and the game posted WM_CLOSE at batch 6.

## Input

- Menus are WM_MOUSE* driven (DirectInput is created only to enumerate
  joysticks, then released).
- The pilot-name field reads WM_KEYDOWN together with WM_CHAR: CLI
  `keydown` alone or `keypress` alone types nothing; `keydown` + `keypress`
  + `keyup` per letter works (only one of three fast letters stuck; a name
  of one letter enables Play). A real keyboard sends all three.
- Flight keys (readme keychart): arrows pitch/yaw, Space fire, Tab
  afterburner, Backspace full throttle, 0 zero throttle, +/- throttle,
  comma/period roll, 1/2 weapons, ? in-game key chart, Esc exit.

## Route (headless, `--batch-size=100000`, D3D registry config)

Guest 640x480 coordinates.

| batch | input | result |
|---|---|---|
| ~150 | - | main menu (Single Player / Multiplayer / Exit) |
| 200-210 | click 320,226 | pilot slots |
| 320-330 | click 320,63 | slot 1 selected, caret from ~500 |
| 470-494 | keydown+keypress+keyup A, C, E | name "C" |
| 520 | Enter | name accepted |
| 580-590 | click Play 235,365 | intro cutscene (~700) |
| ~2000 | - | starbase interior |
| 2100-2130 | click the "01" door 233,240 | Ship Bay (Pegasus; Configure / Launch / Lobby) |
| 2300-2310 | click Launch 320,440 | launch |
| ~3300 | - | cockpit, training objectives (throttle, roll, ?) |
| ~3700 | - | jump gate |
| ~4800 | - | "Destination: Venus - Training Sector, head to Luna" |

The right-hand console (470,300) opens the news terminal.

Evidence: scratch/runs/20261011T2025Z-tachyon-demo-claude1863.

## Local flight controls reviewed 2026-11-01

One local original CLI invocation reached the training cockpit and demonstrated
ordinary throttle, direction and fire input. Evidence is in the ignored directory
`scratch/runs/20261101-tachyon-flight-gated/`; `review.json` identifies the
visually inspected pairs and `commands.ndjson` / `responses.json` preserve the
actual input sequence. This qualifies these observed controls only, not mission
completion, audio, frame rate or the rest of the demo.

The prior offline review was reused after verifying all 15 original/manifest
hashes (92,143,006 bytes), the note and registry. It found no later accepted
paired controls evidence; the Oct11 capture directory is locally absent.
The existing candidate licence record authorizes personal local use; the owner
task authorized this invocation. No new EULA was accepted. The original licence
text and installer archive are absent locally, so licence authority remains the
recorded candidate provenance, not a newly inspected licence document.

The run waited for Redline's fresh final/result and 06:31:31 UTC explicit
runtime/source/build release. Gate-open source baseline was main `e06fe9784`.
Full comparison against the accepted `149286afd` source found the subsequent
capture-chooser repair and its regression test, so a new locked build was run
and passed. The actual loaded module was
`330b120d64cfd4aebdd945c99a95022dbd97db7ee6962d7ec534c24da466011b`;
source, module, mirror and original identities were checked again after exit.
Before invocation, synthetic sync/async checks exercised actual emitted
`dx_trace` callbacks, verified the whole shared 512 MB memory and guest clock
remained unchanged by observation, and checked bounded retention after 10,001
late events. No source, test or renderer changes were needed for Tachyon.

The registered `tachyon_demo` route and its established `iniSet` mapping above
were used without new overrides. Shipped configuration and originals remained
byte-identical. Each mouse/key press was released and allowed to dispatch.
Same-batch `click` only highlighted Single Player; holding the mouse down across
batches opened it. Pilot `A` used keydown + WM_CHAR + keyup, then Enter and Play.
Reviewed progress was main menu (150), pilot list (540), accepted name (680),
starbase interior (2230), Ship Bay/Pegasus (2410), training briefing (3220), and
cockpit (3370). These are observed batch numbers with batch size 100,000, not
timing guarantees.

| Control | Reviewed before / after PNG | Observed response |
|---|---|---|
| Zero throttle, `0` down at 3450, up at 3453 | `baseline-3450.png` / `throttle-zero-3488.png` | HUD thrust 300 → 0; speed 410 → 2. |
| Full throttle, Backspace down at 3488, up at 3491 | `throttle-zero-3488.png` / `throttle-full-3526.png` | HUD thrust 0 → 300; speed 2 → 288. |
| Right arrow down at 3526, up at 3541 | `throttle-full-3526.png` / `right-held-3541.png` | Star/asteroid view changes and cockpit banks; release captured at 3546. The two held/release captures are identical, so they do not independently establish when turning ceased. |
| Space down at 3546, up at 3561 | `right-released-3546.png` / `fire-held-3561.png` / `fire-released-3581.png` | Blue laser bolts appear around the reticle while held and are absent after release. |

The last controlled capture's objective text reads “Destination: Venus - Training
Sector”, “Jumps: 2”, “Head to Luna”. The separate exit PNG omits that text;
the paired observations above use the controlled captures. Input trace records
the ordinary down/up messages; the final
Space keyup was dispatched and the scheduled/pending/renderer queues were empty.
One rejected read-only `input-state` request included unsupported key arguments;
the corrected request succeeded. The run quit through the CLI at batch 3581,
outer exit 0 after 206.987 seconds, within the recorded 850/900-second inner/outer
limits. No second original invocation, remote box, browser or GPU was used.

## Training onward attempt, 2026-11-01

`scratch/runs/20261101-tachyon-training-onward/` records an attempt to continue
with ordinary Insert slide input and the next displayed objective toward Luna.
It did not invoke the original: the first launch blocker was free disk below
the task's required 2,300,000,000 bytes. At the first pre-launch recheck there
were 2,299,285,504 bytes available (714,496 bytes short), then 2,299,256,832
(743,168 short). The entire owned scratch directory was only about 269 KB;
removing it could not recover admission. Foreign artifacts were preserved.
No new captures, Insert consumption, slide response or Luna progress are claimed.

The worker waited scratch-only for Redline worker
`01a195da-2b40-7ff0-ad0b-c710dc6a5349`'s fresh final/result and its 06:54:25 UTC
explicit runtime/source/build release. The gate opened at 06:55:12 UTC, with
2,300,731,392 bytes free. Gate-open main was `574a35dc415c9788208798d900e57b8af345d89d`.
All 4,390 source inputs, 122 prior actual loaded inputs, the module and region
mirror matched the accepted Tachyon locked build, so no rebuild was needed.
The canonical module SHA-256 remained
`330b120d64cfd4aebdd945c99a95022dbd97db7ee6962d7ec534c24da466011b`;
it was pinned directly, avoiding a duplicate module on the nearly full disk.
Synthetic sync/async validation passed actual emitted `dx_trace` callbacks,
whole shared 512 MB memory and guest-clock read-only checks, and bounded
retention after 10,001 late events. These were observer checks, not game runs.

All 15 original/manifest files were pinned and unchanged, including the actual
`installed/tachyon/Tachyon.exe`; no compilation-container identity was used.
The existing recorded local-use licence authority and established registry
configuration were retained without a new EULA acceptance or config override.
The full note, prior driver, keychart and prior controlled captures were read.
The prepared scratch route deliberately stops before repeating the prior
throttle/turn/fire checks. The next prerequisite is sufficient launch disk
headroom; ordinary Insert input and the current displayed instruction remain
unverified by this attempt.

## Native Insert and Luna approach, 2026-11-01

One original invocation in `scratch/runs/20261101-tachyon-training-margin/`
advanced the observed route beyond the earlier controls checkpoint. The reviewed
baseline at batch 3450 displayed “HOLD DOWN THE INSERT KEY TO SLIDE”. Ordinary
Insert (VK 45) was held at 3450–3480 and 3490–3590, with releases after each hold.
Actual `DispatchMessageA` traces record down/up at 3451/3482 and 3490/3591;
before/held/released input-state snapshots show empty scheduled, pending,
cross-thread and renderer queues. The 3590 held and 3610 released captures display
“Destination: Venus - Training Sector”, “Jumps: 2”, “Head to Luna”. This proves
native input consumption and the displayed transition during the hold; it does
not isolate slide physics or prove that Insert caused the timed objective change.

The native `?` keychart was reviewed, then targeting and arrow inputs followed
the Luna objective. Luna is visibly selected by batch 3738. A gate-opening
animation appears at 3761/3781, but the cockpit at 3981 still says “Jumps: 2 / Head
to Luna”, so that animation is not evidence of a completed jump. Later reviewed
approach captures show Luna range decreasing from about 27.9 at 4080 to 22.1 at
4257. The final controlled capture at 4277 shows range 22.51 and the same objective.
Luna arrival and mission completion remain unverified. `review.json` names the
reviewed pairs; raw commands, responses, dispatch traces and PNGs are retained.

The Launch cursor had remained at (320,440). Neutral intervals continued to
change heading; moving the native cursor to (320,240) at 4147 produced more
stable paired views. This is a navigation confound, not a proven emulator defect.
Three intermediate input-state snapshots still had renderer messages pending;
later steps consumed them. Every requested keydown has a matching actual
dispatched keyup, and the final observed queues are empty. Physical Insert/arrow
key-state fields and the guest post queue were not independently sampled.

The initial gate stayed scratch-only until Redline worker
`01a195ed-24ef-7f61-a7ba-05ddac7b9401` had fresh final/result files and its
07:14:16 UTC explicit runtime/source/build release. Gate-open main was
`0f9825de5abb2ce9c06f78380662da975be6b072`. All 4,390 source inputs, 122 prior
loaded inputs, the module and region mirror matched the accepted locked build;
no rebuild was required. Actual loaded module SHA-256 was
`330b120d64cfd4aebdd945c99a95022dbd97db7ee6962d7ec534c24da466011b`.
Observer validation passed actual sync/async emitted callbacks, whole shared
512 MB memory and guest-clock read-only checks, and bounded late-10,001 retention
before runtime diagnostics. Source, actual loaded inputs and all 15 original/
manifest identities were rechecked after exit. Existing recorded licence
authority and registry configuration were retained; no new EULA or file/config
changes were made. The original exited 0 after 415.898 seconds at batch 4277,
within the 850/900-second inner/outer limits. No second invocation, runtime
repair, remote box, browser or GPU was used. No audio, FPS or broader demo claims.
