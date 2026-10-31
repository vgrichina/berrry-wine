# Deus Ex demo — local candidate

The official 1.002f demo installer is pinned in
`test/candidate-corpus/manifest.json` from Archive item `DeusExDemo`. Its
bundled license permits private/domestic use but does not grant redistribution,
so the installer and installed fixture stay ignored and must not be deployed or
rehosted.

Fetch and test:

```sh
node tools/fetch-candidate-corpus.js --id=deus-ex-demo
node test/test-deus-ex-demo.js
```

The fetcher retains `DeusExDemo.exe` as the original distribution. Wine
Assembly runs that self-extractor, captures the `Setup.exe` it launches, and
resumes setup from the captured guest VFS. The wizard installs to
`C:\DeusExDemo`. The frozen driver exports the VFS after the complete game
payload is written and before setup chains into its obsolete bundled DirectX
updater; Wine Assembly already provides that runtime. No host archive or
cabinet extractor prepares the playable tree.

The test uses the prepared installed tree, verifies the software-renderer INI,
and launches the same app manifest as the browser. It requires native UE1 DLLs,
live audio, and a rendered animated intro without spending the normal suite's
time budget on a full map load. A separate frozen controlled acceptance loaded
the Training map, rendered its 3D HUD and transmission sequence, and moved JC
through the world with ordinary Win32 keyboard input.

Historical browser result (superseded by the 2026-10-31 browser acceptance below):
the browser's experimental Worker backend is functional but substantially
slower during UE1 startup. An exact isolated Chrome run stayed live (changing
main-thread EIPs, no trapped Worker), created its third Worker and 648x508 game
window after roughly 45 seconds, and progressed from the gray allocation frame
through the animated Deus Ex title. It was still in that title sequence around
90–110 seconds. Keyboard events were routed with `hwnd=0` in this mode even
after a scripted viewport click, so the interactive acceptance remains the
cooperative backend; leave Threads off for the responsive demo path.

## Headless route to Training, uop tier on (2026-09-29)

With the uop tier on (the default) and 553db124 (never enter a freed uop
program), the demo runs from boot through the main menu into the Training map
and walks. Nothing else needed fixing. Driven frozen, one step at a time:

```sh
node test/run.js --app=deus_ex_demo --quiet-api --quiet-blocks --no-close \
  --control --frozen --max-seconds=3000 --max-batches=100000 \
  --batch-size=200000 --tick-ms-per-batch=25
# then with tools/ctl.js (screen coordinates; the window's client centre is 345,284):
step 3000                     # rotating 3D logo (the menu's background level)
key VK_ESCAPE; step 200       # "Welcome to DEUS EX" main menu
cmd mousemove:502:396; step 30     # cursor onto Training (see mouse notes)
cmd mousedown:345:284; step 40; cmd mouseup:345:284; step 100   # LOADING
step 400                      # UNATCO Training Facilities, HUD, Jaime Reyes transmission
cmd keydown:38; step 150; cmd keyup:38   # JC walks to the first door
```

About 7 minutes of wall clock to the logo on an idle bench box (cooperative
threads). Every capture above was checked by eye.

**The mouse is relative, not absolute.** Once the viewport captures the mouse,
WinDrv's WM_MOUSEMOVE handler (`windrv+0x1110ad8f`) takes `lParam` minus the
client centre as a delta, feeds `MouseDelta`/`IK_MouseX/Y` and recentres the
cursor with `SetCursorPos` (`windrv+0x1110af82`). So an absolute `mousemove:X:Y`
moves the game's own cursor by about **2 x (X,Y - 345,284)**, and a move up or
left of centre from the start position (top-left corner) is clamped and looks
like nothing happened. `click` alone does not press a menu button: the button
only takes focus from a *move* event over it, and the press must span game
frames — mousemove onto the button, then `mousedown`, `step 40`, `mouseup`.
WinDrv's button handlers (`0x1110b4a4` down, `0x1110b302` up) were confirmed
to fire with `--count`; the earlier "click does nothing" was only the missing
hover move, not an input bug.

Compatibility work required for this route:

- root-clamped VFS `..` normalization for UE1 sibling asset wildcards;
- extensionless absolute DLL lookup (`C:\Core` matching `Core.dll`);
- `GetProcessWorkingSetSize` and `IsProcessorFeaturePresent` startup behavior.

## Call-form census (2026-09-29)

**Route.** Box1 ran `--app=deus_ex_demo --batch-size=200000
--tick-ms-per-batch=25 --repaint-every=10`.

- It renders the in-engine 3D Eidos logo at batches ~450-800 and the ION
  Storm logo at 1050.
- **At batch 1174 it crashes on a guest call through NULL**
  (`dbg_prev_eip=0x1212c2b7`). It never reaches the cinematic.

**Census over 450..800** (docs/uop-tier-design.md §15.1):

- **Guest indirect:** 2.5-3.0% of block entries, vtable/reg calls 0.7%.
- **`call [IAT]` into core.dll:** 1.4-1.9%. The largest part is five
  monomorphic FVector-operator calls in the `render.dll+0x10b0baff` loop.
  Each lands on a core.dll incremental-link `jmp rel32` thunk.
- **Where the entries go:** 60% of the entries the tier did not take are
  SoftDrv MMX blocks refused as `head-unsupported`. `softdrv+0x10d3ed70`, a
  `movq [edi],mm0` fill loop, alone is 24.6% of all entries.

## MMX qword-fill fold (2026-09-29)

The fill loop is the SoftDrv frame clear:
`movq [edi],mm0; add edi,8; dec ecx; jnz`. It is at `softdrv+0x10d3ed70`, and
a 16-bit-path copy sits at `+0x10d3eec0`. Its first entry falls through from
`shr ecx,1; nop` at `+0x10d3ed6d`. It is now one H419 `0x80000005` super-op
(docs/loop-idiom-superops-design.md §23; gate `--no-mmx-fill-superops`).

**Box1 run.** Route: `--app=deus_ex_demo --batch-size=200000
--tick-ms-per-batch=25 --repaint-every=10 --branch-clock
--wall-clock-ms=1790673326000 --max-batches=800`.

- **Block entries, window 450..800:** down 17-24%, and the fill block leaves
  the hot list. There were 214,909 fold runs filling 68.7M qwords.
- **MMX instructions retired:** identical in both arms.
- **Frames:** md5-identical at 450/560/680/790/end. Batches 450 and 790 are
  black at this pacing.
- **User CPU for 800 batches:** off 55.30/55.65 s, on 53.15/53.02 s, so
  **−4.3%** against a 0.6% null band.

**Next hottest.** All SoftDrv compute, declined `head-unsupported` by the uop
tier:

- `+0x10d2aea5`, bilinear lightmap fetch: 7.5-11.0% of threaded entries.
- `+0x10d2b0be` / `+0x10d2b584`, span setup, which loads ESP as a GPR from
  `[0x10d7d39c]`.
- `+0x10d2b180` / `+0x10d2b640`, 8-texel palette-lookup span bodies.
- `+0x10d05dbb`, a `jb` self-loop texel.

**Covered (2026-09-29, docs/uop-tier-design.md §16).** The uop tier now lowers
MMX, and it retries a scan-limit head with a halved span. Every head above is
`live`. `+0x10d2b180`/`+0x10d2b640` run 86 blocks per entry, at 276
instructions each. `+0x10d05dbb` is reached inside another program. Threaded
block entries over batches 450..800 went from 177.5M to 100.4M. User CPU for
800 batches went from 55.83/55.94 s to **27.69/27.75 s (−50.4%)**, and all five
frames are md5-identical. What remains hot is x87 triangle setup:
`+0x10d2759d`/`+0x10d27656` are `fld` heads, 4% each.
## 2026-09-29: the uop tier ran a freed program (call through NULL in the 3D intro)

**Symptom.** With the uop tier on (the default since 2026-09-28), the 3D logo
intro died around batch 1163–1174 on a guest call through NULL: EIP 0x10000,
then an AV. A pinned calendar makes it deterministic. It crashes at batch 1163
on every run:

```sh
node test/run.js --app=deus_ex_demo --batch-size=200000 --tick-ms-per-batch=25 \
  --repaint-every=10 --wall-clock-ms=1790673326000 --uop-census --quiet-api \
  --no-close --max-batches=1200 --max-seconds=1400
```

This is a heavy route (about 5 min for 3000 batches), so run it on a bench box,
not the Mac.

**Cause.** This is not a slot-indexing bug and not a Deus Ex bug. The tier
entered a program the arena had already freed:

- `$uop_flush` bumps `$uop_gen` and rewinds the bump allocator. It does not
  retire threaded `uop_enter` ops.
- `$th_uop_enter` and the map ways checked that a program was still alive by
  reading only two words at the program's old address: the gen word (+0) must
  equal `$uop_gen`, and the head word (+4) must equal the EIP.
- After a rewind, those two words hold whatever the next program writes there.
  This can be code, a const-pool word, or the never-written alignment padding
  before the window slots.

The census (instrumented run, box 4) shows the exact coincidence:

- Program H (head `0x1152a39d`) was installed at arena `0x69da530` in gen 2
  and retired as poor in gen 2.
- In gen 3, program X (head `0x1169606e`) was placed at `0x69d9820`:
  - X's code and const pool ran 0xd14 bytes and ended with the word `4`
    exactly at H's old gen word.
  - The padding after it still held H's stale head and window-count words.
  - X's slot 0 overlaid H+16.
- The flush from gen 3 to gen 4 made that `4` equal the current generation.
  H's surviving threaded enter op then passed both checks. It ran X's window
  slots as a program and exited to EIP 0x10000.

**Fix** (`src/07d-uop-engine.wat`). Each arena now keeps a program-starts
bitmap, one bit per 16-byte granule of code bytes:

- `$uop_install` sets the program's bit.
- `$uop_flush` clears the whole bitmap.
- `$uop_live` (used by `$th_uop_enter`, `$uop_way_live`, `$uop_map_get` and the
  census dump) requires the gen word **and** the bit.

A freed header's bit stays clear until something is installed at that exact
address, so no leftover arena bytes can make it look live again. Space for the
bitmap came from shrinking the per-arena code tail to 0x22000.

Regression test: the `stale-enter` case in `test/test-uop-compiler.js`. It
forges a freed header with a current gen word and a matching head, then
enters it:

- Without the bitmap check, the stale enter op runs the forged program 8 times.
- With it, the enter is refused and the threaded loop runs.

**After the fix.** The same pinned run reaches batch 3000 without the crash.
The capture shows the rotating 3D Deus Ex logo intro rendering in software.

## 2026-10-06: renderers, fullscreen and the mouse

The demo ships SoftDrv, D3DDrv, GlideDrv, OpenGlDrv (plus MetalDrv/SGLDrv).
The installer and Default.ini select SoftDrv. `lib/apps.js` now edits
DeusEx.ini at mount time (`iniSet`, applied by both hosts through
`lib/app-files.js applyIniSet`): renderer keys and `StartupFullscreen=True`.
To try another renderer, change `deusExRenderer` there; on the CLI an ad-hoc
`INI=<file>` argument plus `--vfs-include=<file>` works too (UE1 Core parses
`INI=`; there is no command-line renderer override, and a map name on the
command line is ignored -- the demo always boots DX.dx).

Renderer status:

- **SoftDrv** (default): fullscreen menu 10.2 PRESENT/s, Training 10.3.
  Windowed it was 5.1 at the menu: the "slow menu" was the windowed
  presentation path, not the software rasterizer.
- **D3DDrv**: works after three emulator fixes -- DDCAPS2_CANRENDERWINDOWED
  in the driver caps (without it: "D3D Device: Fullscreen only" and
  `Assertion failed: RenDev`), `IDirect3DDevice7::Load` popping 6 dwords
  and copying the mip chain (it popped 7: SetTexture's epilogue restored a
  garbage EBX and the next SetTexture asserted `Pool` in MakeNew,
  d3ddrv+0x10008bfc), and a desktop-sized windowed primary (Blt to the client
  rect in screen coordinates was cut at 640x480). Fullscreen: menu 11.2,
  Training 5.8 PRESENT/s; WebGL readback blocks ~19% of each step. Darker than
  SoftDrv: D3DDrv logs "Gamma control not available" (we store a gamma ramp
  but do not apply it to presentation, so DDCAPS2_PRIMARYGAMMA stays off).
  Precache uses texture pools keyed by size; a NULL pool means the caller's
  state is corrupt, not a pool miss.
- **GlideDrv**: needs fullscreen (UE1's Glide driver refuses a window: it
  reads a WinDrv.int message and shuts Glide down). Needed six Glide 2 entry
  points (guColorCombineFunction, guAlphaSource, guTexCombineFunction,
  grDrawPlanarPolygonVertexList, grTexDownloadMipMapLevel[Partial]) and
  grSstWinOpen answering FXFALSE for three colour buffers (it asks for 3,
  then retries with 2). Reaches the 3D Eidos intro on the CLI; in the page
  the app exits back to the desktop with no presents (open).
- **OpenGlDrv**: resolves every GL 1.1 entry point through GetProcAddress
  and gives up when any is missing; 263 names do not resolve (248 core,
  15 extensions; `scratch/runs/20261006-dx-renderers/gl-unresolved.txt`).

**Mouse.** WinDrv reads WM_MOUSEMOVE as an offset from the client centre and
re-centres with SetCursorPos (windrv+0x1110af82). Pointer lock only engages
under exclusive presentation, so with `-windowed` the page fed absolute
positions into that relative protocol -- the erratic mouse. Fullscreen fixes
it; a CLI `relmousemove 40,30` arrives as exactly (+40,+30) from (320,240).
Pointer-lock counts now reach the guest 1:1 (cc69ac8e) instead of being
scaled by the picture stretch (~46% at 640 wide on a 1380-px page).

**Keyboard menu route** (browser, where the relative mouse makes clicks
awkward): Esc after ~250 presents, then Down x3 and Enter reaches Training;
use 0.1 s key holds -- 0.4 s auto-repeats and lands on Credits.

Evidence: scratch/runs/20261006T1115Z-deusex-renderer-bench (windowed),
20261006T1215Z-deusex-fullscreen-bench (fullscreen), 20261006T1100Z-deusex-d3d-cli
and 20261006T1110Z-deusex-soft-cli (CLI routes).

## Additional dated branch findings

These historical observations supplement the current facts above; they do not establish a new current-main runtime result.

## 2026-10-22: Training runtime blocked by incomplete support staging

**Verdict: BLOCKED before menu; gameplay acceptance remains open.** The bounded
run used accepted main `c26252c4a95babe583ade1d1c6e2da0c050be45c` and the exact
previously qualified shipping module, SHA-256
`f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7`.
No build, engine change, source-gate bypass, or main merge occurred.

Evidence is in `scratch/runs/20261022-deus-ex-training-runtime/`, especially
`run.log`, `first-run.log`, `source-mapping.json`, `assets.json`,
`missing-native-support.json`, `input-log.jsonl`, and `RECOVERY.md`.
The original remote logs/exit files/timestamps/identity manifests are also
preserved in `evidence-artifacts.tar.gz` (SHA-256
`6f4928e32bb6421e6f24b709cea0c12dda292796dce8b4fc96063bd4dbb12cfd`).

The registered app's **current** 112 paths were individually hashed locally
and after remote staging: 233,696,463 bytes, including the original 253,952-byte
EXE. EXE/Core/Entry match the three pins in `test/test-deus-ex-demo.js`; every
declared registry file size and the prepared INI settings pass. This verifies
the game's declared asset closure, but the staging omitted native system DLLs
outside that list. Original files remained unchanged. The app's existing
mount-time INI transformation selects SoftDrv and fullscreen.

At 01:54:16 UTC the first launch exited 1 before guest execution because
`src/api_table.json` was absent from the sparse staging list. The unchanged
accepted-main file was added, and all 192 selected source/support files and
112 assets were reverified. The single controlled retest at 01:54:47 UTC
also exited 1, within that same second, during native DLL initialization.
`run.log` warns that `msvcrt.dll`, `comctl32.dll`, `shell32.dll`, and `ole32.dll`
were unavailable on disk and their imports fell back to WAT stubs.
Render.dll initialization (`module=0x11652000`, DllMain `0x1167997a`) then
hit `UNIMPLEMENTED API: _vsnwprintf` at EIP `0x10bed970`, trapped with
`unreachable`, and startup rollback also failed while detaching D3DDrv.
This is an observed failure with an incomplete support closure; it does not
establish a regression in the accepted engine or the cause of the native
code's formatting call.

Node was v24.18.1. `launch.sh` records the complete command: registered
`deus_ex_demo`, exact pinned Wasm, explicit `--no-threads`, frozen control,
200,000-block batches and 25 ms per batch, with a 3,000-second wall limit.
Both control snapshot requests failed to connect because startup had already
exited. No key/mouse input reached the guest. There are **no game frames to
review**, no intro/menu observation, no Training world/HUD, no before/after
movement evidence, and no successful bounded live interval. Historical
screenshots were not substituted. Windows parity, browser/FPS/audio quality,
and overall game completion remain unqualified.

## 2026-10-31: original Training and native movement verified locally

**Training and ordinary forward/backward movement passed.** The registered
1.002f demo reached the readable UNATCO Training Facilities corridor, HUD,
unlocked door, and Jaime Reyes transmission. I personally inspected the
before/after captures: Up-arrow moved JC from the corridor to the door;
Down-arrow moved him back, with the door and corridor visibly receding.
No game assets, guest state, cheats, or engine sources were changed.

Evidence: `scratch/runs/20261031T0416Z-deusex-training/`:

- `07-training.png`: batch1485, initial corridor, HUD and readable location.
- `08-walk-forward.png`: batch1640, at the unlocked door, Jaime transmission.
- `09-walk-back.png`: batch1745, back in the corridor, door visibly farther away.
- `03-after-escape.png`, `05-training-hover.png`, `06-training-load.png`:
  ordinary Escape/menu/click route, then loading. These establish navigation,
  not gameplay by themselves.
- `input-log.jsonl`, `forward-step.log`, `backward-step.log`, `runtime.log`,
  `identity-before.json`, `module-provenance.json`, `verification-after.json`,
  `cleanup.json` and `RECOVERY.md` preserve commands, identities and cleanup.

Preparation began on shared main `59a615fc5`. No runtime overlapped the live
Diablo II browser: PID1493231 was absent before launch at04:21:55Z, and
`/tmp/wine-browser.lock` was held for the full CLI/controller lifetime.
The run quit normally at04:23:56Z, exit0, 1745 batches/120.254 seconds reported
by the harness. No browser or test box was launched; ID/state/expiry N/A.
Runtime/controller/watcher are absent, localhost18126 is closed, the lock is
released, and cleanup recorded4.93GB free disk.

The retained module was SHA-256
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`,
byte-identical to Re-Volt's recorded locked after-build module at
`scratch/runs/20261031T0403Z-revolt-backbuffer/after.wasm`. Its source identity
is that run's saved dirty source-after snapshot/manifest, including concurrent
font changes; it is not inferred from checkout HEAD. All files in that manifest
matched this checkout during preflight. This task did not rebuild.

**Support closure matters.** The original112 registered paths and EXE/Core/Entry
pins passed. The native graph contains19 DLLs and no missing native files when
using the exact existing support fixtures. Static checks resolved all named
imports over48 native edges and all62 native ordinal imports. The extra native
system files include existing comctl32/msvcrt and these Explorer fixtures:

| File | Microsoft version resource | SHA-256 |
| --- | --- | --- |
| shell32.dll | 4.72.3612.1700 | `533c5809a9b6bdb236cce17a14c03ff251c4ca4d00790ea8e8034ee5d14d7f61` |
| ole32.dll | 4.71.2900 | `bb487eb6c5ade54d5ae0352f75cec84b4f1cbbb8d9fca5b3718d813b4a0c938d` |

`shlwapi.dll`5.00.2614.3500 is also required transitively by shell32; its exact
hash and version are in the identity/version evidence. These are the already
recorded Microsoft fixtures used by the repository's recovery notes, verified
against PE version resources and prior hashes. An independent chain back to
original Windows media was unavailable. They were supplied with an explicit
`--dlls` list generated by the existing dependency walker, using their existing
paths under `test/binaries/explorer98/dlls/`; nothing was copied or linked into
the game tree or shared system directory. Every native DllMain returned1.
The log contains live44100Hz stereo waveOut opening and no missing-on-disk,
unimplemented-API, unhandled-exception, or critical-error messages. All131
before/after asset/native hash checks passed, and the pinned module stayed
unchanged. Live waveOut opening does not establish audible playback quality.

The CLI used the registered app's existing SoftDrv/fullscreen INI transform,
cooperative threads, frozen control on localhost18126, 200000 blocks/batch,
25ms/batch, repaint10 and a600-second guard. The launch arguments are recorded
in `launch.json`; `dll-args.txt` contains the exact19-file list. After Escape,
a relative mouse move hovered Training, followed by mouse-down/20 batches/
mouse-up/100 batches and another400 to the initial world capture. Up-arrow
(VK38) was held for150 batches and released for5; Down-arrow (VK40) for100
and released for5. The input log records the earlier overlapping step request
that was rejected; subsequent menu and movement commands were sequential.

The previously observed Thread1 NULL exit still appears, at
`prev_eip=0x10901a29`, while the main engine renders, accepts input, loads
Training and walks. Its cause is unestablished, and it did not prevent this
acceptance. The earlier incomplete remote support failure is not evidence of
a current source regression. The coordinator's unchanged long smoke was not
repeated. Browser/default-worker gameplay, Liberty Island, sustained play,
audio quality and game completion remain unverified by this CLI result.
Next useful check is the same ordinary Training movement route on a separate
idle test host with the complete recorded support closure; no new task or
worker was launched here.

## 2026-10-31: default guestWorker browser Training and first-door traversal

**Passed: original Training world/HUD, ordinary movement, door opening and
traversal in Chrome's default guestWorker transport.** Evidence is in
`scratch/runs/20261031T0447Z-deusex-browser/`. I personally inspected the
location text, corridor, health silhouette, compass, inventory belt, Jaime
Reyes transmissions, closed unlocked door, open doorway and red-floored room
beyond it. This supersedes the older browser-input limitation above for this
specific retained baseline; it does not qualify current HEAD or completion.

The private local page used Chrome151.0.7922.108, a fixed1024×768 viewport,
`index.html?debug&no-log`, default Threads checked and actual
`wine.guestWorker === true`. Read-only telemetry identifies three
`lib/guest-worker.js` instances, main slot0/thread1, main HWND65539, and
increasing presentation counters. No cooperative fallback, clock/state patch,
renderer switch, source repair, build or public deployment was used. The
game's registered mount-time INI selected `SoftDrv.SoftwareRenderDevice` and
fullscreen. The page's GPU selector read WebGL; that does not change the
game's SoftDrv selection or establish a renderer throughput result.

The module remains SHA-256
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`.
The browser server supplied the matching saved292-file ReVolt source snapshot,
whose manifest hash is
`9dee97b3f74481ba14d6808ecce1d4b665099d8b03c58235e0b02812b234e379`.
Every source byte was checked against that manifest before serving; requested
runtime bytes are retained by hash in `served-snapshots/` and mapped in
`snapshots.json`. Checkout HEAD was observed separately and is not claimed as
the compiled source. The optional `/build-info.js` request returned404 because
it was absent from the saved source; launch and gameplay proceeded. Font
substitutions used the separately retained prior browser response.

The registered app and mount-time transform were reused, with only the launch
configuration's DLL URL list replaced by the exact19 existing native paths
from the successful CLI recovery. The original112 registered inputs and all
131 asset/support hash checks passed before and after. Named and ordinal
closure evidence is preserved; no original asset or support DLL was altered.

Native browser input is recorded with trusted key/button events in
`native-input.json` and commands in `commands.jsonl`. Escape opened the visible
menu. Initial short Down presses did not establish a usable selection, so the
actual game cursor was moved onto the visible Training button, inspected in
`hover-training-settled.png`, then pressed for180ms. Loading led to
`training-world-first.png`, showing UNATCO Training Facilities and the HUD.
Up-arrow1800ms approached the door (`forward-settled.png`); Down-arrow900ms
retreated (`retreat-settled.png`). Up-arrow3200ms reached the closed door with
its “Unlocked” indicator (`door-before-interact.png`). The shipped User.ini
binds RightMouse to ParseRightClick: a native180ms right-button press opened
it (`door-after-right-click.png`). Up-arrow2100ms then crossed into the
red-floored room (`beyond-first-door.png`); the next Jaime transmission
described the key on the desk. `mouse-look-settled.png` also shows that room,
wall panel and plants. Later captures named `look-back-turn*` were attempts:
Left is actually StrafeLeft in the shipped bindings, and those captures do
not prove a view back through the doorway.

The controller ran04:47:38–04:51:16UTC, well inside the25-minute investigation
bound. It acquired `/tmp/wine-browser.lock` after triage's GLTron CLI closed,
checked processes before launching and held the lock through browser/server
cleanup. Chrome1551364 exited0; controller1551290 and lock holder1551289 are
absent, HTTP38133/CDP41333 are closed, the profile is removed and the board
watcher is stopped. Cleanup and focused evidence/helper checks are retained.
No Boat/test box was allocated; ID/state/expiry are N/A. Audio quality,
sustained play, collecting the key, opening the next locked door, Liberty
Island and Training/game completion remain unverified. The next narrow
gameplay check is the visible desk key and next locked door, if requested;
this single-task assignment ends here.

## 2026-10-31: desk NanoKey and next locked door traversed

**Passed: collect the desk key, unlock the next door, open it and walk through.**
Evidence: `scratch/runs/20261031T0606Z-deusex-key-door/`. I personally inspected
`key-center-before.png` showing the targeted **NanoKey** on the desk and
`key-after-pickup.png` showing the empty desktop and “Trainer Door added to
Nano Key Ring”. `locked-door-target.png` shows **Locked**, and ordinary
right-click produces “It's locked” in `locked-door-interaction.png`. Slot0
equips the ring (`key-ring-equipped.png`); a180ms native left-button press
produces “Your NanoKey Ring unlocked it” and **Unlocked** in
`door-after-key-use.png`. A180ms right-button press opens the doorway
(`next-door-open.png`), and Up1000ms crosses into the gray corridor
(`beyond-next-locked-door.png`). `doorway-behind.png`, viewed from that corridor,
shows the red-floored desk room through the doorway and the next Jaime
transmission about goals/notes. This establishes passage beyond the locked
door, not Training completion.

The unchanged original User.ini binds Z/C to TurnLeft/TurnRight, arrows to
movement/strafe, PageDown/Delete to LookDown/LookUp, End to CenterView,
RightMouse to ParseRightClick, 0 to ActivateBelt0 and LeftMouse to
ParseLeftClick|Fire. Native C700ms revealed the desk after replaying the first
door. Further native turns/movement/look and small mouse deltas targeted the
visible key; RightMouse180ms collected it. Commands and74 trusted native
key/button records are retained. Short menu/aim attempts are recorded as
attempts; successful actions are identified by the inspected captures above.

The private Chrome151.0.7922.108 page used a1024×768 browser viewport, default Threads checked,
actual `guestWorker === true`, three guest workers and registered mount-time
SoftDrv/fullscreen INI. Module SHA-256 remains
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`;
the exact292-file saved source manifest remains
`9dee97b3f74481ba14d6808ecce1d4b665099d8b03c58235e0b02812b234e379`.
The server supplied matching saved source bytes, not the separately observed
checkout HEAD. All131 original/support pins,292 saved source hashes and105
served runtime snapshots passed, with the original19-DLL closure preserved.
The launch registry differs only in its explicit existing native DLL URLs.
No build, source repair, asset change, guest memory/state/clock patch, cheat,
input bypass or public deployment occurred. No FPS or audio-quality claim is
made. **Resolution limitation:** the preserved INI requests640×480 and the
runtime console records `canvas 684x570 -> 640x480`. Thus1024×768 describes
the browser capture, not the guest render resolution; this run did not meet
the requested1024×768 guest-render qualification. The runtime was already
closed when this distinction was checked; no second startup was run.

Preparation started06:06UTC; the browser/controller ran06:07:16–06:12:14UTC,
within the30-minute assignment. The full-lifetime `/tmp/wine-browser.lock`
and process/profile gate serialized execution after Forsaken. Chrome1639004
exited0; controller1638968, holder1638050, watcher1638049, tracked children and
crashpads1639020/1639022 are absent. HTTP41963/CDP40803 are closed and the
profile is removed; cleanup verified4.00GB free disk. No Boat allocated:
ID/state/expiry N/A. `RECOVERY.md`, `verification.json`, `gameplay-check.json`
and `cleanup-verification.json` record recovery and focused checks. The next
bounded gameplay check, if assigned, is to follow the corridor into the next
Training exercise with ordinary native input. This assignment stops here.

## 2026-10-31: next Training exercise — crowbar and crate breaking

**Passed: follow the corridor beyond the NanoKey door, collect/equip the
crowbar and break a wooden supply crate with native attacks.** Evidence is in
`scratch/runs/20261031T0617Z-deusex-next-exercise/`. This was a fresh launch,
replaying the accepted first-door/key/unlock route rather than restoring old
guest state. I personally inspected `door-unlocked.png` ("Your NanoKey Ring
unlocked it"), `next-door-open.png` and `beyond-locked-door.png`, then followed
the corridor into the next red-floored exercise room. `next-exercise-instructions.png`
shows Jaime's request to pick up a weapon and break open the crates.

`crowbar-before-pickup.png` shows the targeted **Crowbar** on the striped
bench. RightMouse180ms collected it: `crowbar-collected.png` shows its
absence, "You found a Crowbar" and belt slot1. Native1 equipped it.
`crate-target-before.png` shows the intact upper **General Supply Crate**
within crowbar range. Native LeftMouse180ms, then LeftMouse1800ms broke that
crate. `crate-after-strikes.png` shows the upper crate gone;
`crate-broken-result.png` and `exercise-completed-view.png` show the lower
wooden crate and adjacent metal crate still present, with an exposed item
above the lower crate. `exercise-response.png` shows Jaime's follow-up
lock-picking instructions. The exposed item was not collected or identified by
interaction. This demonstrates the requested next exercise interaction;
lock-picking, subsequent progression and full Training completion remain open.

The replay preserves module SHA-256
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`
and the matching saved292-source manifest SHA-256
`9dee97b3f74481ba14d6808ecce1d4b665099d8b03c58235e0b02812b234e379`.
All131 original/support pins,292 saved source files and105 retained runtime
responses passed verification. The original19-native-DLL route and registered
SoftDrv/fullscreen mount-time INI are unchanged; only the explicit DLL URLs
are supplied as in the predecessor. Chrome151.0.7922.108 used default
`guestWorker === true` with three workers. The browser captures are1024×768;
the preserved guest canvas is640×480, confirmed by this run's resize log.
No resolution change, build, engine/source repair, asset/state/clock patch,
cheat, input bypass, FPS qualification or public deployment occurred.
Commands and102 trusted native key/button records are retained. Input timings
are scene-dependent: inspect the fresh view rather than blindly replaying
turn durations.

The browser/controller ran06:17:07–06:24:02UTC under the full-lifetime
`/tmp/wine-browser.lock` after the live-process/profile gate passed.
Chrome1649556 exited0; controller1649529, holder1649528, all tracked children
and crashpads1649572/1649574 are absent. HTTP35159/CDP35299 are closed, the
profile is removed, all held keys were released and no watcher was started.
Cleanup verified3.58GiB free disk. No Boat allocated: ID/state/expiry N/A.
`RECOVERY.md`, `verification.json`, `gameplay-check.json` and
`cleanup-verification.json` preserve recovery and focused checks. Gameplay
stopped on demonstrated progression; no successor was launched.
