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

## 2026-10-31: native lock-picking and traversal into the next room

**Passed: collect the exposed Lockpick, pick the exercise door, open it and
walk through into the next room.** Fresh replay evidence is in
`scratch/runs/20261031T0648Z-deusex-lockpick/`. I personally inspected the
original visible Training menu, first-door opening, desk NanoKey pickup
("Trainer Door added to Nano Key Ring"), slot0/LeftMouse unlock receipt and
RightMouse opening, then replayed the corridor and crowbar/crate exercise.
Recorded turn durations varied enough to require visible navigation corrections;
the command log preserves missed pickup/attack attempts as well as successes.

`object-target-before.png` identifies the exposed object as **Lockpick** above
the remaining lower wooden crate. Native RightMouse180ms collected it:
`lockpick-receipt.png` reads "You found a Lockpick" and shows belt slot2.
Original F1 inventory, then native selection of the item, produced
`lockpick-description.png`: **Lockpick, Uses: 1**. No item or slot was assumed.
`locked-door-before.png` shows **Locked, Lock Str: 5%, 1 pick, Door Str: INF**.
Native2 equipped the observed belt slot; native LeftMouse180ms began use.
`lockpick-in-progress.png` reads **Picking the lock...**, with strength reduced
to2%. `lockpick-door-after-use.png` shows **Unlocked** and slot2 empty. These
world/inventory changes establish success beyond elapsed time.

Native RightMouse180ms opened the picked door (`picked-door-open.png`), and
ArrowUp1200ms crossed it. `corridor-south-view.png` looks back through the
doorway into the red crate room. Following the blue corridor east reached a
distinct room with a wall map, desk item and observation window, personally
inspected in `next-scene-after-lockpick.png` and `final-next-room-view.png`.
That desk item was not identified or collected; no next exercise interaction
or Training completion is claimed. F2 displayed no listed goals, which is not
completion evidence.

Module SHA-256 remains
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`,
with matching292-file source manifest SHA-256
`9dee97b3f74481ba14d6808ecce1d4b665099d8b03c58235e0b02812b234e379`.
The retained ReVolt0403 source/build pair supplied the runtime, independently
of observed checkout HEAD939ff7db0. Before/after checks passed131 original and
support files,292 saved source files and105 served responses; the19-native-DLL
closure and mount-time SoftDrv/fullscreen INI remain unchanged. Default
guestWorker/three workers, guest640×480 and browser1024×768 were observed.
No source/build change, asset/INI/state/clock patch, cheat, input bypass,
resolution/FPS/audio diversion or deployment occurred. `gameplay-check.json`
records212 trusted native events, eight interaction deltas and32 personally
inspected frames.

Preparation began06:47UTC; the browser lock was acquired06:49:19UTC and the
browser closed07:06:13UTC. Chrome1685329 exited0. Controller1685276,
holder1683955, wrapper1683945, all tracked descendants/crashpads and owned
watcher1684069 are absent; HTTP36975/CDP41383 are closed, profile removed and
no keys held. The outer tool session returned143 despite browser exit0;
this is retained in cleanup evidence without attributing a cause. Cleanup
verified2.42GiB free disk. No Boat allocated: ID/state/expiry N/A. Recovery,
native commands, source/build identities and focused checks are retained in
the run directory. Stopped on the demonstrated bounded outcome; no successor.

## 2026-10-31: DataCube code, security keypad and next multitool room

**Passed: identify/read the desk DataCube, enter its code at the security
keypad, and traverse the opened door into the next exercise.** Evidence:
`scratch/runs/20261031T0713Z-deusex-lockpick/`. This fresh original Training
launch replayed the visible menu, NanoKey pickup/unlock, crowbar/crate and
native lockpick route. Receipts and world changes were personally inspected;
turn durations required fresh corrections. The first crate attacks and first
lockpick use missed; successful later actions are preserved separately.

`desk-item-identified.png` labels the item **DataCube** and shows Jaime's
instructions: right-click the cube, read its contents, type the code into the
keypad, and activate the keypad with the right mouse button.
`desk-item-close-view.png` says the door code is stored in that cube. Native
RightMouse180ms produced `datacube-contents.png`: **Note Received — Check
DataVault For Details**, with Jaime's message giving code **0012**. This item
is read in place; no belt slot or inventory pickup was assumed.

`keypad-label.png` identifies **Security Keypad, Bypass Str: 20%, 2 tools**.
Native RightMouse180ms opened its interface. Four ordinary keyboard presses,
0/0/1/2, populated the masked display (`keypad-first-digit.png`,
`keypad-second-digit.png`, `keypad-third-digit.png`); `keypad-two.png` shows
green **GRANTED**. The interface then closed automatically. The later
`keypad-code-result.png` notification “It's secure” does not negate the
captured GRANTED or subsequent open door. `code-door-after-granted.png`
shows the automatically opened passage and a different closed door beyond.
Native strafe corrections and forward movement crossed the open passage.
`next-exercise-arrival.png`, `next-exercise-instructions.png` and
`next-exercise-room.png` show the next room and Jaime's new transmission
about disposable multitools, finite resources and hacking devices.
`code-door-behind.png` looks back through the open door at the DataCube desk.
These are distinct visible progression states. **The multitool exercise was
not performed, and Training completion is not claimed.**

Runtime SHA-256 remains
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`;
the exact292-file saved-source manifest remains
`9dee97b3f74481ba14d6808ecce1d4b665099d8b03c58235e0b02812b234e379`.
All131 original/support files and292 saved source files passed before/after
verification. The105 served snapshots exactly match the predecessor's
URL/hash closure; current-host/old-module mixing was not used. Original
19-DLL closure, mount-time SoftDrv/fullscreen INI, default guestWorker with
three workers, guest640×480 and browser1024×768 are preserved. Observed
checkout HEADdf174b3cf is metadata, not the runtime build identity. No source
repair/build, asset/INI/state/clock patch, cheat, input bypass, resolution/FPS/
audio diversion or public deployment occurred. Focused checks passed224
trusted native events, ten interaction deltas, four keypad digits,196 PNG
signatures and35 personally inspected captures.

Preparation began07:12UTC; the browser lock was acquired07:13:06UTC and
cleanup completed07:24:00UTC. Chrome1713772 exited0; controller1713762,
holder1713750, all tracked children/crashpads, own quit wrapper1725079 and
watcher1713955 are absent. HTTP42491/CDP32957 are closed, profile removed,
no keys held, and2.26GiB remained free. Full browser lifetime and shutdown
were under `/tmp/wine-browser.lock`; the post-lock live-process gate passed.
The quit helper waited30 seconds for an acknowledgement that the controller
does not emit on quit, then exited normally; this was not a runtime failure.
`RECOVERY.md`, identity, gameplay, verification and cleanup records are
retained. No Boat allocated: ID/state/expiry N/A. The next work, if assigned,
is the visible multitool exercise; no successor was launched.

## 2026-10-31: Multitool bypass and next cadet exercise

**Passed: identify and collect the multitools, bypass the intended keypad,
traverse into the next exercise, and interact with its unconscious cadet.**
Fresh evidence: `scratch/runs/20261031T0736Z-deusex-multitool/`. A new original
Training launch replayed the visible menu, NanoKey, crowbar/crate, lockpick,
DataCube0012 and keypad route. Labels and world changes guided corrections;
missed menu presses, attacks, aiming, pickups and door activations remain in
the evidence. The fresh `keypad-granted.png` filename describes the intended
checkpoint but captures four masked dots, not GRANTED. The subsequent open
door and crossing into the multitool room prove code progression; the prior
0713Z run retains the actual green GRANTED capture.

`multitool-room-view.png` and `multitool-target-instructions.png` show Jaime
instructing use of the table's disposable multitools on the keypad ahead,
explaining finite resources and reduced requirements at higher skill levels.
`multitool-label.png` identifies the yellow table object as **Multitool**.
Three individually targeted native right-click pickups remove the three
devices; `multitool-belt-one.png`, `multitool-belt-two.png` and
`multitool-stack-three.png` show the receipt and growing stack. F1, then an
ordinary mouse selection, produced `multitool-description-confirmed.png`:
**Multitool, Count:3, Uses:3**, inventory top row/third column after the
two-column crowbar, and **belt slot2**. Its description identifies an
electronics tool for code locks and other security systems. The used-up
lockpick's earlier slot was observed empty before collecting these tools.

`hack-keypad-label-confirmed.png` identifies the actual target as **Security
Keypad, Bypass Str:5%, 1 tool**, distinct from the preceding code keypad's
20%/2 tools. Native **2**180ms, wait1000ms, then **LeftMouse180ms** starts the
hack. `native-hacking-progress.png` shows **Bypassing the device...**, a red
scan and strength2%. After4000ms, `native-hack-result.png` shows **You bypassed
the device**, **Security Keypad: Bypassed**, and belt **Uses:2**. The door has
opened automatically; `hacked-door-open.png` shows its blue corridor.

Native movement crosses the passage. `next-door-before.png` shows a UNATCO
troop collecting equipment and the belt cleared except for the NanoKey ring.
Opening the next door and crossing produces Jaime's new cadet transmission
(`next-exercise-world.png`) and a different observation room with a body.
`cadet-label.png` labels that body **Unconscious**. Native RightMouse180ms
produces `cadet-interaction-result.png`: **Medical Room added to Nano Key
Ring**, **You found:** and **Received: NANO**. This proves next-exercise
interaction as well as traversal. Body carrying, medical-room unlocking,
healing and **Training completion are not demonstrated**. No unresolved
runtime/control dependency blocked the assigned multitool outcome.

Runtime SHA-256 remains
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`,
paired with exact292-file saved-source manifest
`9dee97b3f74481ba14d6808ecce1d4b665099d8b03c58235e0b02812b234e379`.
Before/after checks pass131 original/support files,292 saved source files
and105 served snapshots matching the prior URL/hash closure exactly. The
19-native-DLL mount closure, original SoftDrv/fullscreen configuration,
default guestWorker/three workers, guest640×480 and browser1024×768 remain
preserved. Checkout HEAD501f52cf1 at startup is metadata, not the runtime
build identity. No source/build change, asset/INI/state/clock patch, cheat,
input bypass, FPS/resolution/audio diversion or deployment occurred. Focused
checks pass366 trusted native events,13 interaction deltas, four code digits,
291 PNG signatures/dimensions and40 personally inspected captures.

Preparation began07:36UTC; the browser lock was acquired07:36:27UTC and the
browser closed08:00:17UTC. Chrome1738864 exited0; controller1738854,
holder1738845, all tracked descendants/crashpads and own watcher1739217 are
absent (19 recorded PIDs including watcher wrapper). HTTP33489/CDP40745 are
closed, profile removed and no keys held. The full browser/controller lifetime
used `/tmp/wine-browser.lock`, with a post-lock foreign-runtime gate; cleanup
left2.07GiB free. Helpers, commands, recovery, identities and focused evidence
checks are retained in the fresh run; prior evidence was read-only. No Boat
allocated: ID/state/expiry N/A. Next work, if assigned, is the Medical Room
NanoKey/cadet exercise. No successor was launched.

## 2026-10-31: Medical Room attempt stopped before replay completion

**Medical Room progression was not demonstrated.** The accepted multitool/
cadet result above remains the furthest proved state. Fresh evidence is
`scratch/runs/20261031T0817Z-deusex-medical/`, with a separate `retry/`.
Both attempts launched original Training afresh; neither restored prior state.

The first replay confirmed the Trainer Door NanoKey receipt, collected the
crowbar, broke crates to expose a lockpick, and used the lockpick on the
labelled5%/1pick door. Personally inspected `lock-door-five-percent.png`,
`native-picking-progress.png` and `native-picked-result.png` show5%, then2%,
then **Unlocked**, with slot2 emptied. Native LeftMouse input precedes the
progress; the final transition completes while waiting. `datacube-contents.png`
shows code **0012**, and `code-keypad-identified.png` labels the next target
**Security Keypad, Bypass Str:20%, 2 tools**. No code digits, multitool pickup,
cadet search or Medical Room action occurred in this fresh replay. Several
intended-checkpoint filenames capture misses; the inspected labels and actual
receipts, not filenames, determine these claims.

The first precise failure was in the local harness: controller1782534 and
lock holder1782532 disappeared after the last capture at08:32:29UTC, leaving
own Chrome1782571 orphaned. The cause is unproved; no guest/runtime defect is
inferred. Consequently this attempt does **not** qualify as a continuously
locked browser lifetime. A recovery helper reacquired the lock, checked the
exact own profile, captured the unchanged keypad, and closed only that browser
at08:34:03UTC. A second fresh launch used a detached lock/controller lifetime
from08:34:58UTC. It confirmed the NanoKey route and reached the crowbar/crate
area, then stopped at08:43:36UTC to release the shared lane. Its final capture
shows the crowbar equipped against the wall beside the crate area; the
lockpick had not been collected. No Medical Room control dependency was
isolated, because the fresh route never reached that exercise.

Read-only examination of original `system/deusexcontext.u`, included in the
131-file hash closure, identifies the cadet instruction at byte2908993:
search the unconscious cadet for the Medical Room key, then pick up his body
and place it on the medical table so an aide can revive him after the
exercise. A separate line at byte2905684 acknowledges Private Winslow and
directs the player onward. These are static original-text findings, not
observed trigger order or fresh gameplay proof. `original-training-instructions.json`
retains offsets and text. Body pickup, key use on the medical door, table
placement, any medical-device interaction and traversal onward remain untested.

Both attempts used retained runtime SHA-256
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`
with exact292-file saved-source manifest
`9dee97b3f74481ba14d6808ecce1d4b665099d8b03c58235e0b02812b234e379`.
Before/after checks pass all131 original/support files and292 saved source
files. Each105-response URL/hash closure matches the accepted predecessor;
19-DLL mount lists match, with only those DLL URLs changed from the saved
registry. Saved sources were served with their matched module, never current
host sources. Original SoftDrv/default guestWorker/three workers,
guest640×480 and browser1024×768 were retained. There were no source/build,
asset/INI/state/clock changes, cheats or input bypasses, FPS/audio diversion,
or public deployment. Focused checks pass326+118 trusted native input events,
empty held-input sets and90+29 PNG signatures/dimensions. Historical runs
were read-only; duplicate served bytes refer to verified predecessor copies.

Own browser/controller/holder and tracked descendants are absent; both HTTP
ports35169/45489 and CDP ports36395/39095 are closed. Profiles are removed,
retry Chrome exited0, and cleanup left more than2GB free. The first profile's
small post-close files were removed after another live-profile check.
`focused-checks.json`, `inspected-proof.json`, recovery helpers and commands
preserve the evidence and limitations. No Boat was allocated: ID/state/expiry
N/A. No worker or successor was launched. The next dependency is a durable,
continuously locked fresh replay reaching the already accepted cadet state,
then native key/body/table interaction with personally inspected final proof.


## 2026-10-31 0849Z — MedicalRoom onward to light exercise; native save restored

Run `scratch/runs/20261031T0849Z-deusex-medical-durable/` extends the accepted
`e8e86b767` cadet NanoKey receipt with personally inspected native gameplay.
A fresh original Training replay reached the cadet, searched him for the
Medical Room key (`96-medical-key-receipt.png`) and picked up his body
(`97-native-body-carry.png`: held cadet, cleared floor, “You found a body”).
After temporarily putting him down, the equipped keyring's native left-click
unlocked the signed MedicalRoom door: `119-medical-key-receipt.png` shows
“Your NanoKey Ring unlocked it” and “Unlocked.” The cadet was retrieved and
carried through the open door (`124`, `130`) to the medical table (`131`).

Native right-click toward the table cleared the held cadet and started an
incoming transmission (`132-table-placement.png`). No retained frame shows
a body resting on the table, and no readable Winslow acknowledgement or
healing is claimed. Table acceptance is inferred from that trigger, the
opened onward route, and the next distinct exercise. `144`–`146` personally
show Jaime's instruction to use the light augmentation with F12 and find the
exit from a dark room; `147-light-exercise.png` shows “Light activated.”
The next gameplay is that light/dark-room exit exercise.

At the first new body-carrying progress, F6 proved to be an empty augmentation
slot. The ordinary Escape → Save Game → Enter UI then wrote actual native
save bytes. `first-native-checkpoint/` preserves the completed first export:
`c:\save\save0001\saveinfo.dxs` (34,576 bytes) and
`c:\save\save0001\00_training.dxs` (3,227,383 bytes), with guest paths and
SHA-256 in its manifest. `light-native-checkpoint/` separately preserves the
later save count 2 light-room checkpoint (34,577 and 3,229,336 bytes).
No save bytes were fabricated or edited. Same-application native Load Game
restored it, then a page reload created a fresh native application in the
same continuously locked browser. Only the two exact exported save files
were added through the normal file loader. `163-fresh-save-list.png` recognizes
save count 2; native Enter loads it; `165-fresh-load-result.png` restores the
lit room; `167-fresh-native-light-response.png` shows native F12 “Light
deactivated.” Early teal/loading frames were transient, not guest failures.
`RECOVERY.md`, `make-restore.py` (prepares a fresh bounded run without launching),
`fresh-load.cjs`, both checkpoint manifests and `inspected-proof.json` retain
recovery steps, hashes, observations and limits. The earlier cadet checkpoint's
fresh load was not separately tested; the later checkpoint's was.

Exact retained WASM SHA-256
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`
and 292-file saved-source manifest
`9dee97b3f74481ba14d6808ecce1d4b665099d8b03c58235e0b02812b234e379`
were used throughout, never current host sources with an old module.
Before/after 292-source and 131-original/support hashes pass; all 105 served
source URL/hash pairs and 19 DLL paths match the accepted predecessor.
Duplicate response bytes reference verified 0736Z canonical snapshots.
The restore adds only two authentic user-save data responses to the 97
original native data files. SoftDrv/default guestWorker/three workers,
guest 640×480/browser 1024×768 remain the original configuration. There were
no production-source, asset/INI/clock, guest-memory or executable changes,
cheats, input bypasses, FPS/audio diversion or public deployment.

The detached setsid wrapper, controller and independent cleanup monitor kept
fd9 on `/tmp/wine-browser.lock` across the entire runtime; proof at 09:25Z
shows all three alive after 35min. This resolves the prior 15min harness-lifetime
failure without treating it as guest behavior. The process/profile orphan
gate passed before launch. Final checks pass 598 trusted native input events,
empty held inputs, 167 valid 1024×768 PNGs, both save hashes and fresh-restore
registry scope. All 19 tracked owned PIDs are absent, HTTP 34127/CDP 38929 closed,
profile removed, browser exit 0, wrapper lifetime exit 0 and monitor ended.
The lock was verified available and the lane explicitly released at 09:30Z;
free disk stayed above 2GB. No Boat: ID/state/expiry N/A. No worker or successor
was launched. `focused-checks.json` and `check.py` retain the exact checks.

## 2026-10-31 0940Z — Native checkpoint to dark-room exit and repair-bot briefing

**Passed: restore the accepted light checkpoint, exit the dark storage room,
and reach the next distinct exercise.** New evidence:
`scratch/runs/20261031T0940Z-deusex-light-exit/`. Only the two unedited
`5781cc8cf` light checkpoint files were added through ordinary
`app.files`/`vfsPaths`; native Load Game recognized save count 2 and restored
the world. No Training replay occurred. `12-native-light-response.png` and
`13-room-view.png` show native F12 deactivation/activation receipts.

The original inspected controls use arrows for movement/strafe, Z/C for
turning, Space for jumping and right mouse for interaction. Navigation
included backtracking and missed crate routes. `40-north-perimeter-end.png`
labels the final door **Unlocked**; native RightMouse180ms opens it in `41`.
`42` crosses into a distinct red-lit passage and grated ramp. Personally
inspected `44-next-instructions.png` shows Jaime explaining that repair bots
can recharge bioelectric energy spent crossing the dark area. The later
`57-native-quicksave-result.png` also contains his readable security-camera
and security-grid alarm briefing. **Repair-bot use/recharge, camera interaction
and Training completion are not demonstrated.** No previous-table healing or
resting-body claim is added.

Save Game could not be activated while the transmissions were active:
keyboard navigation skipped it, mouse clicks did nothing, and the inspected
keypad-plus QuickSave binding left exported hashes unchanged. These are
retained failed save attempts, not new checkpoints. After speech ended, the
same normal mouse control opened Save Game (`61`); Enter180ms and a six-second
wait wrote actual new bytes. The native save replaced slot 1 in this new
guest VFS; frozen predecessor files remain unchanged.
`repair-native-checkpoint/` preserves immutable indexed copies and a manifest:

- `c:\save\save0001\saveinfo.dxs`: 34,576 bytes, SHA-256
  `4736503e333b3a5072df30ec278fba07ad9b808b18d53d481728be48976c8775`.
- `c:\save\save0001\00_training.dxs`: 3,231,218 bytes, SHA-256
  `ba261fca2dea36bb9ccabad868a04df239bcfc2bf94e3fd0aebe50b552fd8c6c`.

A fresh native application, created by page reload in the same continuously
locked browser, mounted only those two new save files. `66-fresh-load-state.png`
recognizes save count 3 and the ramp preview; native Enter loads it;
`67-fresh-repair-load-result.png` restores the ramp boundary; `69` shows native
F12 **Light deactivated**. `RECOVERY.md`, `make-restore.py`, `fresh-load.cjs`,
`inspected-proof.json` and manifests retain recovery and the exact limits.
The next gameplay boundary is the repair-bot/camera exercise beyond the ramp.

Runtime remains exact retained WASM
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`
with 292-source manifest
`9dee97b3f74481ba14d6808ecce1d4b665099d8b03c58235e0b02812b234e379`.
Before/after checks pass 292 sources and 131 original/support files; all 105
served source URL/hash pairs match verified canonical snapshots, and the
original 19 DLL paths match. There is no retained-module/current-host mix.
SoftDrv/default guestWorker/three workers, guest640×480/browser1024×768 remain
unchanged. No production-source, asset/INI/clock, save-byte or guest-memory
edits, cheats, input bypasses, FPS/audio diversion or public deployment.
Focused checks pass 196 trusted events, empty held inputs and 69 valid PNGs.

One detached browser lifetime ran09:39:43–09:56:23UTC, within the18min bound;
cleanup ended09:56:29. Wrapper1870426, controller1870429 and monitor1870428
held the same fd9 flock throughout, with initial/final proofs. The live
process gate and bounded profile matcher handle collapsed Chrome cmdlines.
Crashpads used a global configuration directory, so they were additionally
identified through the own Chrome handler-PID reference and matching launch
start identities, then stopped under the full flock before browser shutdown.
All20 owned runtime PID/start identities are absent, HTTP/CDP ports closed,
profile removed, browser/lifetime exit0 and monitor ended; full flock release
was verified before lane handoff. Free disk stayed above2GB. No Boat:
ID/state/expiry N/A. No worker/subagent/successor was launched. `check.py`,
`focused-checks.json` and `cleanup-audit.json` retain the checks.

## 2026-10-31 1007Z — RepairBot recharge and fresh native checkpoint validation

**Passed: native RepairBot recharge from 0% to 75%, actual native save export,
and fresh-application native Load Game validation.** Evidence is in
`scratch/runs/20261031T1007Z-deusex-repair-camera/`. The accepted `173d88a99`
repair checkpoint was mounted only as its two immutable, unedited files through
ordinary `app.files`/`vfsPaths`. Native Load Game recognized count3 (`18`),
restored the ramp (`20`), and F12 produced “Light deactivated” (`22`). There
was no Training replay.

The Repair Bot is in the red-lit alcove beside the ramp. Navigation included
backtracking, missed alignment and travel beneath the raised walkway. The
inspected original controls also bind PageDown to LookDown and F to CenterView.
`57-target-bot.png` labels the bot; native right mouse opens its actual
interface in `63-bot-ui.png`, showing **Bio Energy 0%** and **Ready**. A mouse
click on Recharge did not change that state (`65`). Native Enter then produced
**Bio Energy 75%** and **Recharging: 58 seconds** (`67-energy-result.png`).
This is an inspected recharge result, beyond approach or instructions.

Escape → Save Game → Enter wrote actual new bytes, overwriting slot1 only in
this new guest VFS. `recharge-native-checkpoint/` preserves immutable indexed
copies, guest paths and a manifest:

- `c:\save\save0001\saveinfo.dxs`: 34,577 bytes, SHA-256
  `f316e13876c9ec4986a9e95f76c09e9078bc447f8d885be463a7d590f30d707a`.
- `c:\save\save0001\00_training.dxs`: 3,231,626 bytes, SHA-256
  `e938b055c8c87d6d78220cb68919aaef941dd0824658e3e23481faacc611714a`.

A page reload created a fresh native application in the same locked browser,
mounting only these two exported files. `126-fresh-list.png` recognizes
**save count4** and the bot preview. Native Enter restores the bot (`128`);
native right mouse opens its interface with **75% Bio Energy** (`130`).
`RECOVERY.md`, `make-restore.py`, `fresh-load.cjs`, `inspected-proof.json` and
the checkpoint manifest preserve recovery and the exact boundary.

The camera corridor beyond the ramp was approached (`163-camera-area.png`),
including a native jump attempt. Subsequent frames show movement **below the
raised walkway**, with a green camera visible (`168`). There is no inspected
camera activation/detection, alarm receipt, camera-exercise completion or next
distinct instruction/area. The first unresolved gameplay dependency is
navigating the raised camera route and obtaining an actual camera response or
onward trigger. No Training completion, healing or resting-body claim is added.
Transient teal captures recovered without a restart. Console evidence includes
caught native C++ throws during menus and blocked optional `/build-info.js`
requests; no page error was recorded.

Exact retained WASM remains
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`, with
292-source manifest
`9dee97b3f74481ba14d6808ecce1d4b665099d8b03c58235e0b02812b234e379`.
Before/after checks pass all292 saved sources and131 original/support files;
105 served source URL/hash pairs match the verified canonical closure, and
the19 original DLL paths match. SoftDrv/default guestWorker/three workers,
guest640×480/browser1024×768 remain unchanged. No production, asset/INI/clock,
save-byte or memory edits, cheats, input bypass, FPS/audio diversion or public
deployment occurred. Frozen predecessor evidence stayed read-only.

Pirates explicitly released the lane at10:11:20UTC. This single detached
wrapper/controller/monitor lifetime acquired the full browser flock and passed
the actual live-process gate before launch at10:12:16; browser exit was
10:26:57, cleanup10:27:03, within the18/19min bounds. Initial/final fd9 proofs
cover all three holders. Both global-database crashpads were identified through
own profile Chrome child handler references; the secondary started one tick
after the primary. Their exact PID/start identities were recorded and stopped
under the full flock before browser closure. No foreign process was signalled.
All21 owned runtime PID/start identities are absent; HTTP34857/CDP36113 closed,
profile removed, browser/lifetime exit0, monitor ended and full flock release
verified before explicit lane handoff. Focused checks pass266 trusted events,
empty held inputs and106 PNGs. Free disk stayed above2GB. No Boat:
ID/state/expiry N/A. No worker/subagent/successor was launched.

## 2026-10-31 1034Z — Raised-route geometry, native recovery stairs, unresolved camera boundary

**Camera detection/alarm and the next distinct instruction/area remain
unproven.** Evidence: `scratch/runs/20261031T1034Z-deusex-camera-route/`.
Only the accepted `f13fa567a` recharge checkpoint's two immutable, unedited
files were mounted through ordinary `app.files`/`vfsPaths`. Native Load Game
recognized count4 (`33-save-list.png`) and restored beside the bot (`36`).
No Training replay or repeat recharge validation occurred.

Short movements and inspected PageDown/F views established the grated ramp,
upper bend, overhead pipe and separate raised platforms. The original
`user.ini` also binds **X= Duck** and **Delete= LookUp**; both produced native
view changes. X+Up passed the first pipe (`128`, `133`, `136`). The first
concrete failure is the first inter-platform gap: `142-near-edge.png` shows
the near platform and the next platform's supports; ordinary Up500ms (`143`),
without a jump, leads to the lower-floor view (`145`). The subsequent jump
does not establish a stable landing on the next platform; `152` explicitly
shows its underside. This is a navigation failure, **not an established
emulator geometry/input defect**.

The lower floor has a native recovery stairway: `187-rungs-near.png` shows
actual steps, `191` shows ascent and `197` shows the upper landing. A further
side fall and stair recovery are retained. Later centered pipe/gap attempts
(`246`–`270`) end with grating below the view and another pipe ahead, but do
not establish which gap was crossed or an onward trigger. The camera remains
green/visible; visibility alone is not camera interaction success. There is no
alarm receipt, Training completion or healing claim. A colored HUD bar was
initially mistaken for leg injury during live narration; injury is unproven.

Native Save Game (`305`) then Enter (`306`) wrote changed bytes. Immutable
`route-native-checkpoint/` exports contain:

- `c:\save\save0001\saveinfo.dxs`: 34,576 bytes, SHA-256
  `7f7aa22ff7bef06b85f08999fd85e1a5718a2fa11ce11d367917c8c63a5601fd`.
- `c:\save\save0001\00_training.dxs`: 3,231,700 bytes, SHA-256
  `c60cb54438623f7cdcebc68caf581d3833957d0271de36c3ee96f3917c9c13a4`.

Menu navigation accidentally opened exit/new-game setup dialogs; they were
backed out without starting a new world. A page reload mounted only the two
new exported files in a fresh native application. Startup reached the title
menu (`317`) before the fixed deadline. **Fresh native Load Game validation
and the new save count are not established.** The exported route checkpoint
is experimental; the predecessor's count4 remains the validated recovery
source. `RECOVERY.md`, manifests, `inspected-proof.json` and `check.py` preserve
these limits. No second browser attempt was made.

Exact retained module remains
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`, with
292-source manifest
`9dee97b3f74481ba14d6808ecce1d4b665099d8b03c58235e0b02812b234e379`.
Before/after closure passes292 sources and131 original/support files;
105 served source URL/hash pairs and19 DLL paths match the accepted closure.
SoftDrv/default guestWorker/three workers, guest640×480/browser1024×768 remain
unchanged. Focused checks pass288 trusted events, empty held inputs and96 PNGs.
No production, assets/INI/clock, save-byte or memory edits, cheats, input bypass,
FPS/audio diversion or public deployment occurred. Frozen evidence stayed
read-only; disk remained above2GB.

One detached wrapper/controller/monitor lifetime acquired the full browser
flock at10:35:17UTC after the previous explicit release and a clear actual
Chrome/crashpad process gate. All three fd9 holders have initial/final proofs.
The18min command deadline ended at10:53:17; browser close finished10:53:20,
monitor10:53:26, within the19min cleanup bound. Both global-config crashpad
PID/start identities were recorded through own profile child references and
matching launch identities. All20 unique runtime identities and3 remaining
owned helper/watcher identities are absent, HTTP36805/CDP43479 closed, profile
removed, held inputs empty, browser/lifetime exit0, and actual full flock
release verified before explicit handoff at10:54:06. No foreign process was
signalled. No Boat: ID/state/expiry N/A; no subagent, worker or successor.

## 2026-10-31 1103Z — Route save count5 validated; native controls respond, gap still unresolved

**The immutable route checkpoint now passes fresh native Load Game validation.
Stable gap landing and camera detection/alarm/onward instruction remain
unproven.** Evidence: `scratch/runs/20261031T1103Z-deusex-gap-jump/`.
No production change or emulator defect finding resulted.

Static prep preceded browser use. Original `system/user.ini` binds Space=Jump,
X=Duck, Up=MoveForward, Shift=Walking and CapsLock=ToggleWalk, with
`bAlwaysRun=True`. Jump aliases `Jump | Axis aUp Speed=+300.0`; Duck aliases
`Button bDuck | Axis aUp Speed=-300.0`. The predecessor's seven Space-down
events all occurred with X released. Its first142→145 fall used Up500ms
without Space; a stuck browser Duck key does not explain the later attempts.
Trusted browser events establish delivery to the page, not successful guest
physics or landing. No applicable existing route-map parser was found in
tools/lib; no map, INI or memory was changed.

Only the predecessor's two authentic immutable `route-native-checkpoint/`
files were mounted through ordinary `app.files`/`vfsPaths`. Their sizes and
hashes remain exactly those recorded in the1034Z section. A fresh application
listed **Save Count5**, pipe-corridor preview and play time00:53:38
(`23-load-dialog.png`). Native Enter restored the corridor (`26`) matching
the predecessor's270 view. Native LookDown and stationary captures inspected
the near rim, grating and lower floor (`29`, `31`, `33`). This validates the
existing export; no new save was written. The older count4 recharge save
remains an unchanged validated fallback. No Training or recharge replay ran.

Space alone120ms produced a brief upward viewpoint excursion (`35`→`36`)
and returned after1000ms (`38`). On a backed-away platform position, X350ms
lowered the viewpoint (`80`→`81`); native release plus1000ms returned the
standing view (`83`). Space150ms again raised the view (`84`). These are
visible native control responses; they do not establish jump height/range
or rule out a gameplay/timing constraint.

| Native comparison | Inspected result |
| --- | --- |
| Initial Space+Up450ms, stop and inspect; then1200ms from that changed position | No landing proved; longer attempt reaches below the grating (`45`, `47`). |
| Count5 reload, back away, inspect grating, short approach, Space+Up850ms | Still on the near side after1500ms (`75`, `77`); no next-platform footing. |
| Explicit Duck press/release, inspected edge, Space+Up120ms tap then Up900ms | Intermediate grating view (`92`) becomes an underside view after1800ms (`94`): actual fall. |
| Exact count5 reload, uninterrupted Space+Up1200ms | After2000ms, grating overhead (`108`); LookDown confirms lower floor (`110`). |

The concrete remaining dependency is a grounded launch position/trajectory
that reaches the next raised grate and remains there after release and a
stationary wait. The inspected inputs above did not achieve it. No camera
detection, alarm receipt or next instruction was observed; green camera
visibility proves none of these. No new checkpoint was created to preserve
a failed landing. `inspected-proof.json`, `controls-analysis.json`, native
input and command logs retain the comparisons and limits.

The matched module remains
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`,
292-source manifest
`9dee97b3f74481ba14d6808ecce1d4b665099d8b03c58235e0b02812b234e379`.
Before/after292 sources,131 original/support files,105 served source URL/hash
pairs and19 DLL mounts are checked. Original SoftDrv/default guestWorker,
three workers, guest640×480/browser1024×768 were retained. No asset/INI/clock,
save-byte or memory edits, cheats, input bypass, FPS/audio diversion or public
deployment occurred; frozen evidence and protected laptop assets stayed
untouched.

Focused checks pass110 trusted events with empty held inputs, seven current
Space presses with Duck released,45 PNGs, unchanged two-file save identity,
and run-local evidence containment/completeness. Documentation diffcheck
passes; no full build is needed for this documentation-only change.

Pirates'11:08:52 explicit FULLRELEASE preceded the actual process gate and
full-lifetime flock acquisition at11:09:53. Wrapper1960914, controller1960917
and monitor1960916 each retained fd9; browser1960934 and both global crashpads
1960950/1960952 were tracked by PID/start. Native commands stopped early;
browser cleanup finished11:18:09 and monitor11:18:15. All19 tracked runtime/
helper identities were absent, HTTP39795/CDP32987 closed, profile removed,
held inputs empty and actual full flock release verified before11:18:40
handoff. Later documentation-watcher cleanup is recorded separately. Disk
stayed above2GB. No foreign kills, Boat (ID/state/expiry N/A), subagents,
additional guest launch or successor.

### 2026-10-31 11:34Z — first gap resolved with grounded running launch

Run `scratch/runs/20261031T1134Z-deusex-grounded/` resolves the first raised
grate-to-grate jump. This is actual stable footing, not camera visibility.
The remaining pipe, farther gap and next instruction were not tested. No
new save was created; the two immutable1034Z count5 files remain recovery.

Read-only analysis preceded the single native session. Scratch `decode.py`
parses original UE1 v68 package tables, state headers and tagged properties;
`geometry.py` follows compiled Model36 BSP references through its exact
object end. Bounds, names, object references, compact-index cases and
truncation rejection are checked. Original map and saved Model36 both have
16184 points,9376 nodes and5300 surfaces. Selected corridor faces place the
near platform end at Y=-274.0007 and next platform beginning at Y=-429.9999:
a **156-unit gap**. The next grate interior is Z=-36. The lower floor is
Z=-192; the pipe ahead spans approximately Y=-630..-666, Z=16..52. The
farther gap is about178 units, Y=-830..-1008. These measurements describe
compiled faces, not a full collision simulator; some original faces are
nonplanar, so no global zero-residual claim is made.

Saved JCDentonMale0 is PlayerWalking/Physics1 at
(6953.8433,-272.4012,16.9320), yaw114962, radius20 and standing height43:
its center starts only1.60 units from the near edge. Structurally decoded
class defaults give JumpZ300, GroundSpeed320 and Human AccelRate1000.
Original `DeusExPlayer.DoJump` requires Walking and sets vertical velocity
before switching to Falling; it supplies no forward velocity. This made a
running launch from a backed-away grounded position a distinct test, rather
than another guessed simultaneous Space/Up duration from the saved edge.
It does not retrospectively assign every earlier failed comparison a cause.

A narrow scratch observer established state mapping before movement. It
uses original Core exports' GObjObjects/FName arrays, enumerates only that
declared object array, and requires unique JCDentonMale0/class identity.
Original native disassembly supplies Physics+0x30, Location+0x114,
Rotation+0x120, Velocity+0x144, Acceleration+0x150 and cylinder+0x1d4/+0x1d8.
The initial values independently match the immutable save's exact position,
rotation, Physics1, radius20 and height43, with zero velocity. Reads run in
the owning slot0/thread1 worker's timer callbacks after JS/Wasm returns;
there are no guest writes or guest gameplay calls. Wrong position, physics,
array capacity, duplicate actor and radius fixtures are rejected. An initial
FName-count ceiling rejected the real74583-name array; the recorded rejection
was resolved with a bounded200000 ceiling before gameplay. The initial
URL-only worker selector also refused the three-worker ambiguity; explicit
slot/thread identification resolved it.

Native Load Game showed count5/time00:53:38 (`12-count5-dialog.png`) and
restored the original corridor (`15-restored-world.png`). Only the two
immutable files were mounted through `app.files`/`vfsPaths`. Native Back
moved to a stationary grounded run-up at Y=-164.9484. Up then accelerated
along the original grate. The Space-down gate required Physics1, correct corridor X and measured
forward speed; standing height43 was observed at launch.

| Observed boundary | Native state / inspected evidence |
| --- | --- |
| Grounded launch (`22-grounded-launch.json`) | (6953.1431,-245.6348,16.9320), Physics1, velocity(8.3388,-319.8913,0), height43. |
| Airborne (`helper-jump-observer-final.json`) | Physics2, first observed upward velocity226.85; peak observed center Z63.9063. Up remained held across the gap. |
| Release and stationary wait (`25`–`28`) | (6959.7808,-500.5729,15.8000), Physics1, velocity/acceleration zero, height43. |
| Inspected feet (`26-landing-feet.png`, `27-landing-feet-still.png`) | Next platform's grate fills the view beneath the player and remains unchanged after an additional2-second wait. `28` shows the pipe ahead. |

All38 browser events were trusted and balanced, with exactly one Space-down
while Up was held and Duck released. The observer confirms trajectory and
stable contact; screenshots independently confirm raised grate underfoot.
No emulator defect is established.

Original map **and save** mark all four SecurityCamera actors `bNoAlarm=True`,
including UN_obst_jump. Original bundled `SecurityCamera.uc` gates its normal
visibility/detection block on `!bNoAlarm`. Thus green camera visibility here
cannot establish an alarm milestone, and a normal camera alarm is not an
appropriate acceptance condition for these actors. Original Mission00
script provides no jump-camera gate; the later dl_cratestack trigger lies
near (7063.58,-1632.38,8.1). Reaching that instruction remains unproven.

The retained module8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676,
292-source manifest9dee97b3f74481ba14d6808ecce1d4b665099d8b03c58235e0b02812b234e379,
131 original/support hashes,105 canonical served sources and19 DLL mounts
pass before/after checks. Original SoftDrv/default guestWorker/three workers
and guest640×480 were retained. A helper's initial Puppeteer connection
briefly set browser800×600 (`20`/`21`); this was corrected to1024×768 before
the jump. All launch/trajectory/landing captures use1024×768. Reused `17`/`18`
filenames show the backed-away run-up after that correction, not the exact
initial save. No claim of uninterrupted browser viewport identity is made.

Pirates'11:40:16 explicit FULLRELEASE and the actual global Chrome/crashpad
gate preceded the11:43:52 launch. Wrapper1997135, controller1997138 and
monitor1997137 held the full-lifetime lock. At11:48:56 the disk guard closed
the browser successfully at1989124096 free bytes, below the2GB floor, after
the landing proof. A later pipe helper could not attach and sent no inputs;
there was no second launch or onward test. No fresh save/Load validation was
attempted. Cache was disabled; the guard acted as required, but continuous
free space above2GB was not maintained.

Cleanup verified25 owned runtime/helper/watcher PID/start identities absent,
both global crashpads gone, HTTP34907/CDP35571 closed, profile removed, held
inputs empty, actual whole browser gate clear and full flock released before
11:50:27 FULLRELEASE. No foreign signals or Boat (ID/state/expiry N/A).
Focused identity/save/input/observer/decoder/landing/cleanup checks and doc
diffcheck pass. No production edits, full build, Training/recharge replay,
asset/INI/clock/save-byte/memory mutation, cheats, input bypass, FPS/audio
diversion, public deployment, subagent or successor.

### 2026-10-31 12:05Z — pipes, farther gap and crate instruction reached

**The onward obstacle passage passed, and a genuine count6 save passed fresh
native Load Game.** Run `scratch/runs/20261031T1205Z-deusex-pipe/` reused the
accepted original package/geometry/control analysis and restored only the two
immutable1034Z count5 files through `app.files`/`vfsPaths` and native Load Game.
No Training or recharge replay occurred. I inspected the platform footing,
crate-room transmission and fresh restored world captures.

The original X binding is Duck; original `bToggleCrouch=False` makes release
restore standing when clear. Original player code lowers collision height
43→16 while crouching, lowering the center27 units. The scratch pipe guard
therefore permits the expected centerZ=-11.2 while requiring Walking contact;
it does not mistake crouching on the grate for a fall. The farther jump uses
its own grounded launch gate before the measured178-unit gap, Y=-830..-1008.
The narrow observer retains the checked original exports, actor offsets,
unique actor/class, owning slot0/thread1 and JS/Wasm return-boundary reads.
Its corridor envelope alone extends fromY=-1600 to-1800 to include the already
decoded crate trigger; fresh validation changes only the expected position to
the newly decoded save. There are no guest writes or gameplay calls.

| Native passage | Observed stable result / evidence |
| --- | --- |
| Reproduce first gap | Grounded launchY=-251.29, velocityY=-319.89, height43; Physics2 then stationary Physics1 atY=-506.78 (`22`, `25`–`28`). |
| X+Up under pipeY=-630..-666 | Height16 throughout movement; release restores43 atY=-718.68, Z15.8, zero velocity (`29`–`31`). |
| Running Space across178-unit gap | Grounded launchY=-816.80, velocityY=-319.89, height43; Physics2 peak observedZ62.99, then stationary Physics1 atY=-1055.49 (`32`–`37`). Feet captures two seconds apart show the farther grate. |
| Last pipe nearY=-1090 | Native X+Up and release reach standing Physics1 atY=-1145.18 (`38`–`40`). |
| Door and crate room | Native Up reaches the unlocked door; a bounded attempt stops there. Original RightMouse opens it (`43`), then Up reaches stationary(7003.7866,-1550.2075,15.8). |
| Next instruction | `instruction2-centered`, `44` and `46` show Jaime Reyes explaining that the wooden crates are too large/heavy and metal crates should build steps; RightMouse picks up and Tab drops. This is the reached `dl_cratestack` instruction, not completion of crate stacking. |

The save used the ordinary Escape → Save Game → Enter path (`49`–`58`).
Only the newly written `save0001/saveinfo.dxs` and `00_training.dxs` were copied
to immutable `progress-native-checkpoint/0.bin` and `1.bin`, with hashes and
VFS destinations in its manifest. Original count5 recovery remains unchanged.
Original-format decoding gives count6/time00:55:58 and the crate-room actor
position above. A fresh page/game instance mounted only those two count6 files,
then ordinary native Load Game displayed count6/time00:55:58 (`70`) and restored
the room (`73`). The observer independently matched the saved position,
rotation, Physics1, radius20, height43 and zero velocity. Inspected feet frames
`75`/`76`, separated by2200ms, remain stable; `77` restores the forward view.
This validates recovery beyond both gaps. Crate manipulation remains next.

The matched module remains
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`,
292-source manifest
`9dee97b3f74481ba14d6808ecce1d4b665099d8b03c58235e0b02812b234e379`.
Before/after292 sources,131 original/support files,105 canonical served
URL/hash pairs and19 DLL mounts pass. Original SoftDrv/default guestWorker,
three workers, guest640×480 and browser1024×768 were retained. All49 PNGs
are1024×768. All102 native events are trusted and balanced, including two
Space presses with Up held/Duck released and two Duck holds. Observer positive,
five rejection fixtures, process-identity guards and focused checks pass.
`RECOVERY.md` gives the restore recipe; `check.py` reproduces the checks.
No production edit or full build was needed.

Pirates'12:07:47 FULLRELEASE and12:08:00 cleanup correction preceded the actual
whole Chrome/crashpad process gate and full-lifetime flock. The sole browser
session ran12:08:09–12:13:15 UTC, about305 seconds, including the fresh page
restore. Cache was disabled and console evidence capped; prelaunch free disk
exceeded2.3GB and the one-second monitor never reached its2.1GB stop threshold.
Wrapper2022756/controller2022759/monitor2022758 retained fd9; browser2022769
closed with exit0. Cleanup checked30 owned PID/start identities absent,
both global crashpads gone, HTTP42785/CDP37541 closed, profile removed,
empty held inputs, actual global gate clear and full flock release before
12:13:43 FULLRELEASE. No foreign signals, Boat (ID/state/expiry N/A), subagents,
successor, additional browser, heavy CLI, build, old-module/current-host mix,
asset/INI/clock/save-byte/memory mutation, cheats, input bypass, FPS/audio
diversion or public deployment. Camera alarm remains an unsuitable milestone
because the original Training cameras have `bNoAlarm=True`.

### 2026-10-31 12:20Z — native crate manipulation and recoverable placed steps

**Pickup, drop, stacking and climbing passed; the blocked exit remains
untraversed.** Run `scratch/runs/20261031T1220Z-deusex-crates/` restored only
the immutable count6/time00:55:58 two-file checkpoint from1205Z through
`app.files`/`vfsPaths` and ordinary native Load Game. The original actor observer
matched (7003.7866,-1550.2075,15.8), rotation114962 and standing Physics1 before
movement. No Training, pipe or recharge replay occurred.

Cheap original-package analysis preceded the browser. Original small metal
crate defaults have mass40, below the player's default lift limit50; the
medium crate has mass80. `MaxFrobDistance=112` explains why several distant
aims did not highlight. Original `DropDecoration` places a carried object on
a highlighted target; without one it throws it. Original bindings are
RightMouse pickup, Tab drop, C/Z turn, arrows move/strafe, PageDown look down
and F center view. The wooden barricade is original BSP geometry, with low
topZ32, adjacent topZ96 and taller topZ160 surfaces. It cannot be highlighted
as a decoration for the target-placement branch.

| Inspected ordinary manipulation | Result |
| --- | --- |
| Small crate pickup (`33`) | RightMouse produces the translucent carried crate. |
| Targeted Tab drop (`40`,`42`) | Small metal crate rests on the medium metal crate; it is then picked up again. |
| Relocation (`57`,`77`) | The crate is dropped near the barricade and a continuous native run/Space sequence lands on it at standing Z47.57. |
| Second small crate (`98`,`110`) | Pickup succeeds. The attempted two-small stack lands beside the first crate; `110-two-small-stack.png` is a label, not a successful stack. |
| Useful steps (`127`,`130`,`135`,`140`) | A level Tab throw places one small crate on the low wooden crate. JC climbs the floor crate, low wooden crate and upper metal crate, reaching stationary Physics1 at Z47.23,79.8 and109.73. |
| Upper jumps (`142`,`173`) | Both return to the floor. No doorway crossing or next exercise is claimed. |

The final upper jump peaks at centerZ156.913. Its last sampled descending
center above143.8 is (7026.23,-1749.40,147.58), still short of the topZ96
wooden surface beginning nearY=-1808. It finishes stationary on the floor at
(7058.3203,-1773.3511,15.9). The concrete next dependency is a closer upper
crate placement/run-up that reaches that surface at sufficient height.
This attempt does not establish an emulator defect. Timed turns vary enough
that screenshots and observed state are needed between approaches.

Ordinary Escape → Save Game → Enter created a genuine **count7/time01:09:32**
checkpoint (`181-native-save`). Whole native output bytes were exported to
immutable `progress-native-checkpoint/0.bin` and `1.bin`; its manifest records
the two VFS paths, sizes and SHA256 hashes. Count6 remains immutable and intact.
Original-format decoding records the new player position above and relocated
small crates at (7061.3101,-1701.6576,-13.1472) and
(6997.2246,-1707.7416,49.3502). The medium crate remains in its original place.

A fresh page/game instance mounted only those two count7 files. Native Load
Game showed count7/time01:09:32 (`208`) and restored the world. The owning
slot0/thread1 observer independently matched decoded location, rotation184635,
Physics1, height43, radius20 and zero velocity. Feet frames two seconds apart
remain stable. The copied helper retained `75/76-fresh-count6-*` filenames;
these files actually depict count7. Inspected `214`/`216`, separated by2200ms,
show the restored upper metal crate still resting on the low wooden crate.
`RECOVERY.md` supplies the exact restore recipe and focused checks.

The exact module remains
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`,
with292-source manifest
`9dee97b3f74481ba14d6808ecce1d4b665099d8b03c58235e0b02812b234e379`.
Before/after292 sources,131 original/support hashes,105 canonical served
responses and19 DLL mounts match. Original SoftDrv/default guestWorker,
three workers, guest640×480 and browser1024×768 were retained. All68 PNGs are
1024×768. All294 native events are trusted and balanced, including seven
RightMouse presses, four Tab presses and16 Space presses. The accepted
read-only observer changes only its route envelope toX<=7450,Y>=-2500,
justified by decoded room actors/geometry; exact initial save crosschecks,
original exports/offsets, unique actor/class and return-boundary reads remain.
The observer positive case and five rejection fixtures pass.

Harness limits are preserved: the first fresh-load command reloaded before
the checkpoint manifest existed and rejected ENOENT before guest launch.
After the manifest was prepared, fresh restore succeeded in the same browser.
The second reload overwrote `pre-fresh-native-input.json`; complete first-page
events survive in `183-after-save.json`, combined with the fresh page's final
log by `check.py`. The controller's final observer-stop sees the detached old
worker; the initial observer had already stopped before reload and the fresh
helper separately stopped its observer. No guest failure is inferred.

Prior Deus/Pirates explicit FULLRELEASE and the actual global process gate
preceded the sole12:22:10–12:38:45 browser session (994.9 seconds). The durable
wrapper/controller/monitor held fd9 for the browser lock. Cache was disabled;
prelaunch free disk exceeded2.3GB and the one-second2.1GB guard never fired.
Cleanup verified42 tracked PID/start identities absent, including all helpers,
watcher and both global crashpads; both ports closed, profile removed, inputs
released and full flock available before12:39:18 FULLRELEASE. Browser exit0
and controller wait0 are recorded. The wrapper's raw exit code was unavailable
after its process disappeared; no raw wrapper-exit0 claim is made.
No foreign signals, production edits, full build, arbitrary memory scans or
writes, asset/INI/clock/save-byte edits, cheats, input bypass, guestWorker
disable, public deployment, Boat (ID/state/expiry N/A), subagents or successor.

### 2026-10-31 crate exit: repositioned launch reaches a transient wood contact; exit remains blocked

Run `20261031T1301Z-deusex-exit` restored only the immutable count7/time01:09:32
two-file manifest through app.files/vfsPaths and ordinary native Load Game.
The accepted observer matched player (7058.3203,-1773.3511,15.9),yaw184635,
Physics1,height43,radius20 and zero velocity before movement. Count6 and count7
files remain unchanged. Training, pipes and recharge were not replayed.

Original BSP analysis identifies the intended lower wood at X7024–7088,
Y−1872–−1808,topZ96. The adjacent tall wood at X6960–7024,Y−1856–−1792,
topZ160 intercepts an approach from the left. The actual next exercise is the
original `dl_ladder` trigger near (6991.97,−2362.70,5.55), beyond the crate-room
doors near Y−2000. Neither those doors nor that exercise was reached.

Ordinary climbs again reached the floor small crate, low wood and upper metal.
Attempts with insufficient running speed fell short; longer approaches could
leave the upper crate before Space took effect. RightMouse then lifted the
upper crate (`63`/`65`); ordinary movement while carrying and a downward-aimed
Tab drop repositioned it (`69`/`74`). Subsequent stable standing centerZ111.427
is recorded. Carrying mass40 prevents jumping in the original DoJump script;
the crate was dropped before every subsequent jump.

The repositioned diagonal jump `78` reached centerZ158.77, but its forward
velocity collapsed near (7019.78,−1770.71,157.87). Original geometry explains
this as contact with the front of the topZ160 wood, before the player cleared
its right edge. A more easterly ordinary running jump (`90`:Up220ms,then
Space650ms,then both released) cleared that obstruction. Its read-only trace
records Physics1 and zero vertical velocity at
(7102.9736,−1797.7441,143.4226), consistent with brief contact at the topZ96
wood's east edge. Horizontal velocity was still (206.73,−106.78). This contact
lasted only two observer samples,25ms apart; no image captured that instant.
The player continued into the east floor area, where the inspected final
image shows no new exercise. This is **not a stable landing or exit traversal**.

The precise remaining dependency is to retain the topZ96 landing after
clearing the topZ160 wood, then cross its far edge toward the actual doors.
Releasing Up earlier is the next control hypothesis, not a verified solution.
The attempted repeat failed to regain the same launch state. Native save
decoding later showed that contact had shifted the floor small crate north
to (7061.5371,−1666.8571,−13.1472), and the repositioned upper crate to
(6968.7236,−1743.5118,51.05). Reusing earlier approach coordinates was therefore
unreliable. No emulator defect is established.

An ordinary native save produced count8/time01:24:25. Whole immutable files
are retained in this run's `progress-native-checkpoint/`:
saveinfo34576B,SHA256`ba471693be27576e9dd30a4b901415ad00b916a2d828a8443eb37d7f46e7dc68`;
Training3232653B,SHA256`b25220987668c04f8346f21cb925d8151d1e55d286b6787f1e618331abb4bd4b`.
A reserved fresh page mounted only those two files, showed native count8 in
the Load dialog (`141`), and ordinary native Load restored the decoded player
(6948.3442,−1755.5117,111.427),yaw335104,Physics1,BaseCrateUnbreakableSmall0.
The observer independently matched location/rotation and zero velocity, then
remained stable2908ms. **The final screenshot (`145`) still shows LOADING**:
restored gameplay rendering/layout was not visually validated before the
bounded deadline. A requested second capture was never executed. Count8 is
a diagnostic save with this explicit limit; accepted count7 remains preferred.

Exact module8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676,
292-source manifest9dee97b3f74481ba14d6808ecce1d4b665099d8b03c58235e0b02812b234e379,
131 original/support hashes,105 canonical served sources and19 DLL mounts
pass before/after checks. Frozen0403Z source/module and0736 canonical support,
SoftDrv/default guestWorker,three workers,guest640×480,browser1024×768 remain.
All528 native events are trusted and balanced, including30 Space,one
RightMouse and one Tab; all58 PNGs are1024×768. The initial observer is byte
identical to the accepted count7 observer; the fresh observer changes only
decoded-save initial location/yaw. Positive and five negative fixtures pass.

Fresh Pirates FULLRELEASE13:09:15 and the actual process gate preceded the
single bounded session. Controller start13:09:32.735 to cleanup13:26:34.562
was1021.827s. A detached durable supervisor retained actual Popen wait results:
wrapper0,controller0,monitor0; browser exit0. Full-lifetime fd9 history covers
wrapper/controller/monitor while the profile existed. Disk started>=2.3GB,
minimum2227294208B; the2.1GB early stop did not fire. The timed final wait
crossed the17-minute controller deadline by less than one second; browser
cleanup still finished before18 minutes,all cleanup before19 minutes.
Historical audit verifies21 runtime PID/start identities absent,including
both global crashpads,two ports closed,profile absent,held inputs empty and
full flock available. The board watcher was separately qualified/terminated;
the pending capture helper timed out and exited. FULLRELEASE was announced
13:27:50 after actual absence checks. No further browser was launched; no
global gate is rerun during the next worker's session. No foreign signals,
production edits,build,asset/INI/clock/save-byte/memory edits,cheats,input
bypass,guestWorker disable,public deployment,Boat or subagents.

## 2026-10-31 13:40 UTC: corrected bearing and earlier release, takeoff dependency

Run `scratch/runs/20261031T1340Z-deusex-wood/` restored accepted count7 through
app.files/vfsPaths and ordinary native Load. The count7/time01:09:32 dialog
(`13`), actual restored crate room (`17`), and original owning-worker observer
save crosscheck were inspected. Stable small-crate/wood/upper-crate climbs
reached centers Z47.23/79.8/109.73. **No stable Z96 landing, exit traversal or
ladder exercise was reached; no new save was created.** Count7 remains preferred,
count6 untouched, and count8's previous LOADING limitation remains unresolved.

Cheap original analysis first reread the accepted recovery and trajectory90,
original decoded BSP nodes8270/8276 and original DoJump. Radius20 puts the prior
7102.9736,−1797.7441 contact18.1492 units from lowerwood's southeast corner;
it lies outside both face bounds. A conservative full-footprint target is
X7044..7068,Y−1852..−1828, not a demonstrated reachable landing. The prior
trace also retains substantial airborne velocity after acceleration becomes
zero. Releasing Up cannot be assumed to stop airborne motion immediately.

The original collision remains authoritative. The rotated top32 base's actual
BSP top is a diamond centered near6992,−1684, with vertices extending to
X6946.75..7037.25 andY−1729.26..−1638.75. Crates drift during native collisions;
visual layout and observed footing must be checked after each approach.
Native RightMouse pickup succeeded. Forward Tab drops first returned "Can't
drop that here"; a backward offset allowed a drop to the floor, then ordinary
count7 Load restored the accepted layout. There was no Training/pipes replay.

| Checked attempt | Actual result |
| --- | --- |
| `97`: target yaw52500, Up190ms then Space190ms, release | Physics changed to falling125ms into the trace, before Space; no upward velocity. Player walked off the upper crate. |
| `127`: back to7015.20,−1691.53,109.58; target yaw52500; Up220ms then Space220ms, release | Actual jump, first observed upward velocity236.4. Tallwood collision reduced northward speed near7041.92,−1768.63,155.96; after early release, northward velocity fell to about−10.3. Fell to floor. |
| `143`: back to7013.73,−1692.47,109.73; target yaw53500; Up220ms then Space240ms, release | Wider bearing, but support lost before Space. No upward jump or landing. |
| `161`: upper footing7012.53,−1693.83,109.60; target yaw53500; Up140ms then Space500ms, release | Support was already lost93ms into the trace; no upward jump. Final inspected gameplay (`162`) is still the crate room floor. |

The first dependency is **grounded takeoff before the moving upper crate loses
support**, followed by sufficient east clearance of tallwood. Earlier Up release
and a corrected bearing have now been tried together, but these attempts do
not establish whether they retain a Z96 landing after a valid clear jump.
A stationary Space-first takeoff from rechecked footing is untested; its
horizontal range must be measured, not assumed. No emulator defect established.

Prelaunch initially stopped at2.130GB free, below required2.3GB. The coordinator
reclaimed released historical diagnostics; this worker deleted no foreign files.
Pirates13:40:11 FULLRELEASE and a fresh actual whole Chrome/global-crashpad gate
preceded sole browser launch13:42:36. New deadlines were generated, not reused.
Original frozen module8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676,
292-source manifest,131 original/support hashes before/after, original SoftDrv,
default guestWorker,three workers,guest640/browser1024 were retained.

`check.py` passes identity, accepted observer byte equality, positive plus five
rejection fixtures, native save crosscheck,540 trusted balanced input events,
54 PNG dimensions, actual trajectory classifications, and cleanup. One repeated
observer install after native reload returned "observer already installed";
the original observer continued sampling its checked actor. The final quit
command deliberately exits the controller before command acknowledgement;
its sender timed out and was confirmed absent. Neither is a guest failure.

Actual browser cleanup13:56:56 completed858.995s after controller start, within
18min; raw browser/controller/wrapper/monitor exits0/0/0/0 are retained by the
durable Python supervisor. All1002 active-profile monitor samples show wrapper,
controller and monitor holding inherited fd9; minimum free disk2228436992B.
Historical cleanup audit confirms22 owned PID/start identities absent, including
global crashpads and the final command helper, both ports closed, profile gone,
held inputs empty and full flock available. Monitor used no signals. FULLRELEASE
was announced after actual absence. No further browser, production edits, build,
heavy CLI, asset/INI/clock/save-byte/memory edits, cheats, input bypass, guestWorker
disable, public deployment, Boat(ID/state/expiry N/A), agents or successor.
