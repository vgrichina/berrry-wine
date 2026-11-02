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

## Luna arrival attempt blocked before launch, 2026-11-02

`scratch/runs/20261102-tachyon-luna-arrival-next/` preserves this attempt's
preparation and measured launch blocker. No original session or boat was
started, and no new arrival, completed jump or objective progress is claimed.
The accepted Insert transition and range 22.1/22.51 with “Jumps: 2 / Head to
Luna” remain the previous checkpoint; gate animation alone remains insufficient.

The worker stayed scratch-only until fresh GL query worker35014 and Nox item
worker76354 each had actual terminal exit 0, `turn.completed`, result/final,
exact AUTHOR RELEASE and scoped helper cleanup. Their releases were
13:31:13 and 14:03:02 UTC; named Nox helper PIDs and both local helper scopes
were independently checked absent. After both gates cleared, the first launch
check at 14:03:58 UTC measured **2,376,925,184 bytes** free on `/home`, below
the task's requirement of strictly more than 2,400,000,000 bytes by
23,074,817 bytes. The owned scratch directory used only 962,560 allocated
bytes, so removing it could not restore the margin. The worker stopped at
this first concrete causal blocker, preserving foreign evidence and the
owner's 2 GB floor. `admission.json` and `gate.json` record these checks.

All 15 original/manifest identities matched the accepted pins (92,143,006
bytes). The shipped readme and both prior native keychart pages were reviewed:
Enter selects a target, T cycles targets, arrows turn, Backspace sets full
throttle, 0 sets zero throttle and Tab activates afterburners. No separate
jump key was shown. Prepared, unexecuted controls center the native cursor at
(320,240) after Launch and retain before/held/released/settled captures plus
matched neutral intervals and input-state observations. They are preparation,
not input-consumption or flight evidence.

A preliminary comparison matched all 7,228 inputs of the newly accepted GL
build, whose retrieved module SHA-256 is
`d6e20ba99816b54b75d2423983ab7c80a0bf9bb1776b570a46d244f881b3291d`.
It was not loaded or reused here; the older Nov01 module was not assumed
current. No build, runtime tests, guest/configuration changes, downloads or
subworkers ran. A future authorized attempt needs restored launch headroom,
fresh dispatch and module/input checks, then one finite-TTL boat recorded
before use. The gameplay requirement remains a visibly completed Luna
arrival/jump or changed objective under ordinary controls.


## Recovered Luna approach, 2026-11-02

One original session in `scratch/runs/20261102-tachyon-luna-arrival-recovered/`
reached a new reviewed **Luna range 4.58**, but did **not** establish arrival,
a completed jump or a new objective. The last controlled capture at batch 6092
still reads “Destination: Venus - Training Sector”, “Jumps: 2”, “Head to Luna”.
The requested arrival goal remains incomplete. This attempt ended at the
controller's 1,260-second outer deadline; the original then exited 0 after quit,
at 1,261.187 seconds. No concrete game/runtime defect was established, and the
timeout must not be presented as a game blocker or justification for a repair.
There was no second invocation or replay after exit.

Both prescribed gates cleared before shared edits, tests, boat or runtime:
GL pixel-map worker6843 and Die by the Sword worker39566 each had launcher
exit 0, `turn.completed`, result/final files, exact AUTHOR RELEASE and
independently absent named/scoped helpers. The latter had stopped before its
original launch because its own mutable transfer input changed. Tachyon's fresh
boat was `bx_wur5nmgf`, finite TTL 3,600 seconds, with original expiry
`2026-11-02T15:31:27.538Z` recorded before use. Local launch free space was
2,500,419,584 bytes; the guard's recorded minimum through retrieval was
2,418,479,104 bytes, above the owner's 2 GB floor.

All 15 original/manifest identities (92,143,006 bytes) matched before launch,
on the boat and after exit. The established registered `tachyon_demo` arguments
and configuration mapping were retained. The accepted GL module was reused as
SHA-256 `bdbe80167ac6970208664c1bb3241b667eabb4f7e25c6e18fbcdaedb8255cb5c`.
Of its 7,230 recorded source-file identities, 7,229 were byte-identical; the sole
difference was the predecessor's newly published Die by the Sword findings note.
Every compiler/runtime input matched. Transfer verified 4,873 fixed file hashes;
post-run checks matched those inputs and all 124 observed actual file reads.
The observer's initial synthetic check lacked the existing local `calc.exe`
fixture; copying and hash-checking that fixture corrected the preparation before
Tachyon started. Sync/async actual emitted-callback, whole shared 512 MB memory,
guest-clock read-only and bounded retention checks then passed on the boat.
No game, emulator, configuration or guest-memory patch was made.

The shipped readme and both accepted native keychart pages were reviewed. The
first Launch release and immediate cursor-centering shared a dispatch batch and
left the game in the ship bay. A separate ordinary Launch hold/release, followed
by settled release before centering, opened the training briefing; its next
neutral interval reached the cockpit. This establishes successful input pacing,
not a general mouse defect. The previous Insert checkpoint was traversed, not
counted as the result. Bracket `]` visibly selected Luna, then Heliopause; `[`
returned to Luna. T, a native-character T sequence, X and Enter did not visibly
select Luna in their tested views. X changed the weapon display and is not
qualified here as a targeting control.

Centered-cursor neutral intervals at zero throttle showed a stable view and
Luna range near 37.1. Ordinary arrow holds changed the view; before/neutral/held/
released/settled captures preserve the differing responses. Short fixed-batch
holds did not give uniform fine corrections. In one consumption-paced left tap,
the keydown was dispatched only after three stepped batches (5647), followed by
keyup at 5648. These observations do not isolate a clock, input or physics bug.
Small cursor offsets were tested with matched centered intervals, then restored
to (320,240); they did not establish useful fine steering. The earlier cursor
confound is therefore not promoted to a proven navigation cause.

Full throttle and short arrow corrections produced the following reviewed
approach, with Luna selected and the objective unchanged throughout:

| Capture | Batch | Visible Luna range |
|---|---:|---:|
| `approach-right-trim-settled.png` | 5634 | 34.08 |
| `consumed-left-settled.png` | 5658 | 32.48 |
| `luna-approach-neutral200.png` | 5898 | 17.34 |
| `near-luna-forward100.png` | 6015 | 8.84 |
| `final-luna-forward60.png` | 6092 | 4.58 |

The last control snapshot has empty scheduled, pending, cross-thread and renderer
queues, and all sampled movement keys have physical/async down state false.
Pressed-since-query latches remain set for some released keys; they are not held
key evidence. Guest post-queue and SDL consumption remain unknown. All 27 actual
key down/up pairs and six mouse down/up pairs balance in the dispatch trace.
A later requested 40-batch step found the original stdin already absent, so it
executed no further game input. The exit PNG omits the objective overlay and is
not substituted for the final controlled objective capture. No gate animation
is counted as arrival. No audio, frame-rate, mission-completion or broader demo
claim is made.

All 139 PNGs passed CRC/deflate/dimension checks. The 25,628,677-byte archive
SHA-256 `91f3ce07187cf8d7ef09b0f7782e441920d27bee3578bdda59a40c32598cc6e2`
and all 310 evidence-file identities were verified locally before delegated
shutdown. The boat was confirmed STOPPED at `2026-11-02T14:58:36.936Z`; remote
runtime/controller and scoped helpers were absent beforehand, and local helpers
are absent at closeout. The local guard's shell reported SIGTERM/143 without a
final-file write; its last sample follows game exit and retrieval, and the
signal source is unestablished. `cleanup.json` preserves this limitation.
`result.json`, `final.txt` and `RECOVERY.md` retain the exact outcome and recovery
instructions. A future authorized attempt should retain the successful Launch
release boundary, select Luna with brackets early and spend the bounded session
on its final approach; it must independently establish arrival/objective change.
Do not resume this worker, automatically replay its scripts or repair generic
code without separately establishing a cause and bounding that implementation.
