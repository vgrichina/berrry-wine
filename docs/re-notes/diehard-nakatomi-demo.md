# Die Hard: Nakatomi Plaza demo (Piranha Games / Fox Interactive / Sierra, 2001)

LithTech Talon, Direct3D 8 (`lithtech.exe` imports `d3d8.dll`), DirectInput,
Miles. Fixture: `test/binaries/win98-games-a-d/Diehard nacatomi demoD3D.exe`
(Wise installer, 88 MB). The installed tree lives beside it in
`Diehard-nakatomi-demo-installed/program files/fox/die hard nakatomi plaza demo`
(183 MB) -- the directory above `program files` is the `C:\` root, so
`--vfs-tree=Diehard-nakatomi-demo-installed` mounts it at its guest path.
Registered as `diehard_nakatomi_demo` (fea60cb9). It reaches player-controlled
in-level gameplay on the CLI: accepted 2026-10-07, and confirmed on main
2026-10-10 with mouse look (the last two sections).

## Install (headless)

`run.js --exe='.../Diehard nacatomi demoD3D.exe' --tick-ms-per-batch=5
--control=PORT --frozen --save-vfs=inst --save-vfs-prefix='c:\program files'`,
then held clicks (mousedown, ~200 batches, mouseup): Next (378,395) on
Welcome, Yes (378,395) to "DirectX 8.0a installed?", Yes (358,395) on the
license, Next through Readme, Destination, keyboard layout (English default)
and Start Installation; ~300k batches of copying; Finish.

- The Destination page loads `C:\WINDOWS\SYSTEM\kernel32.dll` by full path to
  ask for free disk space. Before 03e2f5f3 that LoadLibrary failed ("Could not
  load the DLL library ... kernel32.dll") and setup could not continue.
- 7-Zip cannot open the installer; it has to run.
- The install leaves an `unwise.exe ` directory holding a file `u ` -- the
  uninstall string's `/u` argument read into a path. Deleted from the fixture;
  harmless, not investigated.
- Registry: `HKLM\SOFTWARE\Fox Interactive\DIE HARD : NAKATOMI PLAZA\1.0`
  (launcher switches: Disable Sound/Music/Movies/Fog/Joystick/TripBuf/Cursor/
  Loadscreen = 0, Language = English).

## Running it

- `nakatomi.exe` is the launcher; it runs `LITHTECH.EXE ... -rez nakatomi.rez`.
  Run the engine directly: `--exe=.../lithtech.exe --cwd='c:\program files\fox\
  die hard nakatomi plaza demo' --args='-rez engine.rez -rez nakatomi.rez'`.
- Load `msvcp60.dll`, `mss32.dll` and the real `test/binaries/dlls/msvcrt.dll`
  as PEs: the built-in MSVCRT lacks C++ exports it needs
  (`?_set_new_handler@@...` was the first).
- The engine extracts `cshell.dll`, `cres.dll` and `cresl.dll` from the rez into
  `C:\WINDOWS\TEMP` and loads them; `--save-vfs=DIR --save-vfs-prefix=
  'c:\windows\temp'` writes them out for disassembly.
- `autoexec.cfg` is as installed (`"bitdepth" "16"`): since 0dbe4ab6 the 16-bit
  mode exists, and the engine's default and fallback modes are both 16-bit.
- `soundmax.dll` (the game's sound DLL, imported by `cshell.dll` by ordinal)
  must load as a real PE too; the failure read "UNIMPLEMENTED KERNEL32.#00030"
  because the ordinal stub is labelled with the wrong module.
- Rendering on the CLI needs `--d3d9-renderer=software` (D3D8 draws through
  the D3D9 backend); without it every frame is black.

Emulator fixes found on the way: 03e2f5f3 (LoadLibrary by system-directory
path), 33e4ff16 (the dispatcher's nonvolatile restore undid `_EH_prolog`'s EBP,
so the engine returned into NULL 23 batches in), b15fa588 (`__p___argv`,
`__p___argc`).

## Fixed: the 16-bit display mode (0dbe4ab6)

The renderer initialized with 640x480x32, then `cshell` asked for its own
render mode and the engine never found it:

- `cshell.dll` `0x1002137c`: SetRenderMode(saved mode) through the engine
  interface (`[0x10072088]+0x78`); on failure it logs "Couldn't set render
  mode!" and retries a hard-coded **640x480x16** (`0x100213e4..0x100213f2`),
  then the same with hardware TnL off ("Couldn't set D3D Emulation mode").
- `lithtech.exe` `0x48e924`: the mode matcher. Walks the device's mode list
  (16-byte entries width, height, ?, D3DFORMAT) for width == `[0x508be0]`,
  height == `[0x508bdc]`, and for 16 bpp format R5G6B5 (0x17) or X1R5G5B5
  (0x18), for 24/32 bpp X8R8G8B8 (0x16) or R8G8B8 (0x14).
- After a successful CreateDevice the engine probes texture formats with
  CheckDeviceFormat and treats a 16-bit mode without A1R5G5B5 (25) as unusable;
  it then resets the device (BackBufferCount 2 -- triple buffering unless the
  launcher's "Disable TripBuf" is set) and CopyRects its managed X1R5G5B5
  textures.

0dbe4ab6 gave D3D8 a 640x480 R5G6B5 mode with a 16-bit view over the 32 bpp
back buffer, Reset, CopyRects, and A1R5G5B5/X1R5G5B5 textures. With
`--count`, the matcher went from 1 success / 5 misses to all hits.

Traps met on the way, worth knowing for the next LithTech title:
- `--trace-at` on these engine addresses does not fire with the micro-op tier
  on; add `--no-uop` (the flow then differs a little: 3 matcher calls, not 6).
- A memory dump of a value inside a hot loop lands mid-update; `--watch-log`
  tells a stuck value from a busy one.

## State (2026-10-06): the main menu, drawn black

What looked like an endless load is the **main menu**. The animated emblem is
`Interface\menu\sprites\logo.spr` (a string in `cshell.dll`), and the
"repeating" nakatomi.rez reads are its sprite frames. Keys and clicks change
nothing visible because nothing else is visible. Pass `--tick-ms-per-batch=2`:
at the default 200 ms the guest clock runs ~15 guest hours per 275k batches.

- Fixed (this commit): `CreateImageSurface(320x480, R5G6B5)` failed, because
  the backend colour surfaces took only formats 21/22. The engine then retried
  its 9 menu-background surfaces every frame
  (`exe 0x49e202` -> device `+0x6c`). A 16-bit image surface is now a 32-bit
  backend surface behind the 16-bit lock view, so `CopyRects` into the
  back buffer (`exe 0x49e478`) is a same-format copy. With the fix the menu
  draws about 118 `DrawPrimitiveUP` quads a frame.
- Still black: each frame is pretransformed quads (FVF 0x1c4 = XYZRHW |
  DIFFUSE | SPECULAR | TEX1, triangle fan) over 64x64 A1R5G5B5 tiles, with
  ALPHABLEND, SRCALPHA/INVSRCALPHA, point filtering, clamp addressing, and Z
  off. A `dump-mem` of two tile textures at batch 100004 shows real texels
  with the alpha bit set (`0x8xxx`), so the textures are fine.
- Next: dump one draw's vertices (the `DrawPrimitiveUP` stream pointer is on
  the stack, `0x074ff928`, stride 32) and check the diffuse alpha and RHW. If
  those are sane, check the software rasterizer's handling of XYZRHW + TEX1
  with SRCALPHA blending on a 16-bit device, e.g. by drawing one such quad in
  `test/test-d3d8-16bit-mode.js`.

## 2026-10-07: host texture admission rejects supported 16-bit formats

A bounded150-second CLI run on module
`8eb283c1b595afe336c3e2407f722e19d47aad0739784de4864ba699c8b5712f`
(runtime sources equivalent between3b8189f5 and8de5d0b3) repeatedly reported
`invalid texture resource stage=0 ... kind=3 levels=1 lod=0 format=25`.
The final640x480 image remained black apart from the lower-left gold emblem.
No gameplay or independent menu-state qualification follows from that image.

The bridge's admission list omitted24/25 although its existing decoder already
implemented X1R5G5B5 and A1R5G5B5. Admit exactly these two formats; no WAT or
decoder change. The expanded real-WASM16-bit test uploads native managed
textures and draws an XYZRHW/diffuse/specular/TEX1 fan through the production
Bridge/software backend. It verifies opaque X1 with bit15clear, opaque A1,
transparent A1 preserving the blue target, and untouched outside pixels.
The original host fails the real draw with D3DERR_INVALIDCALL; the candidate
and existing D3D8 unavailable/ABI probe pass. Ordinary game validation is next.

Retained evidence: `scratch/wt-diehard-20261007/scratch/menu-contract/`,
`attempt2/final.png`, `attempt2/capture.json`, and
`contract2/{before,candidate,unavailable}.log`. The107,442,011-byte production
log is retained losslessly as `attempt2-driver.log.gz`; its decompressed SHA256
is `11e974a0dcd602f523a6498fd1d855d982cb26d22c6f16b441a49fc969fdd9c1`.
The late draw gate did not arm because rejected draws never reached it;
there are no captured vertex alpha/RHW conclusions. Earlier attempt1 lacked
sparse bundled fonts and is a harness error despite the runner's exit0.

### Ordinary menu validation and local registration

With the texture-admission repair, a150-second ordinary CLI run rendered the
Floor Directory main menu. A normal held mouse press at230,130 opened the
Easy/Medium/Hard New Game menu. Easy was highlighted after pointer movement
and a held press at347,115, but the run ended on that menu: no level or
player-controlled gameplay is claimed. Evidence is in
`scratch/wt-diehard-20261007/scratch/ordinary-menu/attempt1/` (review and validation
JSON, input log, screenshots and clean process/port receipt).

The local experimental route `diehard_nakatomi_demo` launches the original
`lithtech.exe` with both original REZ arguments, the installed working directory,
and explicit real MSVCRT/MSVCP60/MSS32/SoundMax DLLs. It is a Shooters corpus
candidate and local selector entry, not a production desktop or release-ready
game. Generate its metadata only, without rewriting other games:

`node tools/gen-win98-games-a-d-manifests.js --only=diehard_nakatomi_demo`

The manifest lists40 unchanged assets beside the separately loaded executable.
No fixture bytes are copied or rewritten. Empty/unknown selectors fail before
any manifest writes; without a selector the existing all-games behavior remains.

### 2026-10-07: Easy activation completes; no level yet

The registered ordinary route now reaches the readable difficulty screen. In
`scratch/wt-diehard-20261007/scratch/difficulty-activation/attempt1`, session43302
ran09:35:29.560–09:38:33.663Z, then normal quit returned0; PID2449993 disappeared,
port8137 was free and output streams drained. Held Easy click and normal Enter
left the difficulty image visible; no world, gameplay or FPS qualification.
`difficulty.png` is an early capture still showing the main menu;
`newgame-later.png` is the actual difficulty gate.

The retained native cshell.dll SHA256 is
`fae70d13f2fe9ffb2416306e524294ddf508737a9fd3bfa310edeed036aef37e`.
Its original base10000000 relocated to actual00f5f000 (head.log:372).
Numeric counters armed before guest threads; shared HIT_COUNT_BASE and inherited
per-instance count configuration include subsequent executing instances. Counts
aggregate threads, not owning-thread identities. Original VA → count:

- 10008ded menu-control constructor:477 (positive control).
- 100113ea dispatcher:2; 10011668 Easy branch:1.
- 10010f54 start:1; 10024517 load setup:1; 10010f8e return landing:1.

This rules out missing Easy activation as the sole explanation. It does not prove
successful loading. Static10010f54 passes `39-1`, `GameStartPoint0`, difficulty0
and flag1 to10024517, but does not test its returned EAX. Inside10024517,
100246a4 calls the engine function at `[global100720d0]+0x20` with a stack request;
the next branch tests the original flag in EBX, not that result. The function
continues through10025d41 and returns16bytes at10024798. Next source work must
identify this engine target/request and the downstream state/error transition,
not repeat menu inputs or invent a successful-load return contract.

The full1,449,149-byte log is retained (SHA256
`bc49fe7b3b6925b0ca7a4d2cb12cca441fbb911077bc107a600df764b9b971eb`).
No literal39-1/GameStartPoint0 appeared in FS lines: archive reads expose REZ
paths/offsets, so this is not missing-member evidence. Review/cleanup/source pins
and19 artifact hashes are in attempt1; validation.json SHA256
`ed9fd8a8ca039cc45a26f9a899b7da56b6c6e9b5f7ef6567ca40798338dad41a`.
Module remains prior reviewed8eb283c1 (1,719,085bytes), with the fixed JS bridge
and local registration; no rebuild or claim of latest-main module. Counter
instrumentation changes debug/chaining behavior even without --no-uop; this was
an activation diagnostic, never a performance measurement.

### Deferred engine load contract (source-only, same original binaries)

Original lithtech.exe SHA256
`e2e236582ee26d81ace32017c366abc380ca3a4b9b0e45c0d3338d9966295e24`
(1,114,170bytes) has preferred base400000; the diagnostic's actual PE entry
4bda68 agrees. Engine table initialization406b6c stores4071c6 at offset20.
4071c6 sets the object at global4fe3e4's first DWORD to1, copies0x47e DWORDs
(0x11f8bytes) from its sole caller-cleaned request argument into object+4, and
returns EAX0. This is enqueueing, not successful world initialization. The live
indirect target still needs a positive entry observation; static assignment is
not a captured target value.

The cshell request constructor10024440 initializes type4.10024620–100246a4
builds world name `worlds/39-1` at offset4 (prefix at1006a0f8); offsets11e8/11ec
hold game-data pointer/length0x98, and11f0/11f4 hold `GameStartPoint0` pointer
and16bytes including its terminator. The request is copied before returning,
so the native engine does not retain this particular stack structure.

Update40d5a2 checks the queued flag at40d964 and invokes40cdfb at40d96e.
The consumer clears the flag at40ce16; session setup40fcd5 has a nonzero failure
path40cf31. A nonempty world name reaches46aaaa at40cf6e. Its nonzero result
takes40cf77, gathers an error string, reports code31, and reaches40cfa9.
The original diagnostic strings are `error loading world`, `LT_SERVERERROR`,
and `CClientMgr::StartShell`. The alternate path40d193 installs the session;
40d22a explicitly produces return0. Those branches have not yet been observed
in the game. No missing asset or emulator repair follows from static code alone.

Fresh source-only diagnostic READY is
`scratch/wt-diehard-20261007/scratch/engine-load-diagnostic/READY.json`.
Launcher08df07e9 uses12 counters (supported maximum16), same registered app,
unchanged8eb module and ordinary route; no observer or guest writes. Positive
menu constructor, queue entry and matching fresh EXE/cshell relocation are
required before interpreting later zeros. Targets distinguish an unconsumed
queue, session rejection, world-load rejection and committed-session transition.
Normal quit290s, TERM300s, KILL315s and bounded head/tail logs remain; no runtime
has been launched for this next plan. Source/pin/guard validation passed.

### 2026-10-07: engine queue consumed; phase attribution still needed

The12-counter diagnostic ran session52046/PID2472917 from09:51:59.902 to
09:54:23.735Z, stopped by ordinary quit, exit0/streams drained/PID absent/8137
free. Actual EXE entry4bda68 and cshell basef5f000 matched the source plan.
Counts: menu constructor477; cshell load setup1; native enqueue4071c6=2;
update40d5a2=290; consumer40cdfb=2; selected setup failure40cf31=0;
post-setup40cf51=1; world-load46aaaa=1; selected world-error40cf77/40cfa9=0;
session commit40d193=1; explicit success return40d22a=1.

Those totals prove queue consumption and one success path somewhere in this
run, but two requests and only one selected success mean startup versus Easy
attribution is unresolved. Do not label Easy's load successful or infer the
other request's error from zeros. The final personally reviewed image remains
the difficulty screen, without world/control qualification. menu.png is an
initial black frame; menu-ready.png is main menu, difficulty.png still main
menu, difficulty-ready.png is the actual difficulty screen.

Evidence root is `scratch/wt-diehard-20261007/scratch/engine-load-diagnostic/attempt1`;
19 artifact hashes in validation.json, SHA256
`89c7081c19dbc1ad52ccfc296f7473b58d69f262b452f94d75bc558865060ad9`.
The full1,491,771-byte log was retained, SHA256
`44cac5bbb0420c5e98f9078198d07eaab551fb8c4746697629bdead7d9d4dc57`.
Same8eb module/counter debug-tier caveat; no performance claim.

Existing CLI controlEval at test/run.js:6790 exposes actual `exports` and
`tickState`; `exports.get_count(i)` is a read of shared counter memory, not a
CPU-register/shadow query or guest callback. Next preparation can take12
read-only counter snapshots at the reviewed main menu, immediately before Easy,
and after Easy/Enter to attribute increments without clearing counters or
writing guest state. This capability is source-verified, not yet exercised in
this diagnostic. No further runtime is authorized by these findings.

### Phase snapshots attribute the success to startup, not Easy

Read-only control `exports.get_count` snapshots in session65541/PID2482337
(09:59:50.128–10:01:53.210Z, normal quit0, streams drained/PID absent/port free)
resolve the aggregate ambiguity. Menu baseline batch74177 already had queue1,
consumer1, world1, commit1, success1. Immediately before Easy at81363 those
counts were unchanged. After Easy86242, cshell setup became1 and queue2 while
consumer remained1; by after-Enter154690 consumer became2. Settled274402 retained
the same counts. The main-update entry stayed233 across those last snapshots.
No selected post-setup/world/commit/success/error counter advanced after Easy.
Thus the successful selected world path belongs to startup. Easy is enqueued
and eventually enters the consumer, but the next boundary remains inside early
consumer work, not a demonstrated missing-world rejection. Enter attribution
is temporal only: the queued consumer may run independently of that key.

The screen remained the difficulty menu. Evidence is
`scratch/wt-diehard-20261007/scratch/engine-load-phases/attempt1`;
23 artifact hashes manifest SHA256
`932e7ffa41c0eff5cf4c5e9ed0a011953086dbde5002e0e82782ddd8197e5118`.
Full1,485,330-byte log SHA256
`be7026abf9676adbcd551a035d1a40255a3a97914fda975e2d02b702f04545a7`.
Snapshots retain exact expression/raw responses/batch. No resets, guest writes,
shadow-register reads, performance or gameplay claims.

Source lead, not established cause: consumer40cdfb calls40d233 at40ce3b before
new-session allocation.40d233 tests previous session at object+248c, invokes
its slot0 destructor with flag1 at40d244 and clears the pointer only at40d246.
A source-backed next probe should distinguish that destructor's entry/return
from later allocation/setup, preserving existing wait/thread evidence; no
engine change is justified yet.

### Easy stalls inside the previous session's nested-object destructor

Session8587/PID2497891 ran10:11:37.780–10:13:39.480Z, normal quit0, streams
drained/PID absent/8137 free.16-counter phase deltas after Easy establish entry
to40d233,410c74,40fbe7 and the return landings40fbfb and40fc25. Return40fc40
and all later destructor returns stayed0, including settled batch309010.
The interval contains a slot0 call at40fc3e on session+40, after the previous
manager-detach and451953 calls returned. Final personally reviewed image is
still difficulty, not gameplay. Evidence root:
`scratch/wt-diehard-20261007/scratch/early-consumer-diagnostic/attempt1`;
23 artifact hashes manifest SHA256
`4c690da96db1288974be402ea65ce007aba508d34b9d2b86918c27ad985e8b24`.
Full1,470,003-byte log SHA256
`e159b80b1773b2b6d9a327fb3035979c4f563cfe7bb44ff247d533214609bcc8`.
Same module/debug instrumentation limitations apply.

Source identity:40fe44 creates the session+40 object via468e2a; its final
vtable4dfbcc has slot0=46c054, which invokes46c070→469303. This is static
identity, not yet a live pointer capture.46931d calls440dc5 early in teardown.
440dc5 conditionally SetEvent(object+bc), calls virtual offset1c, then closes
the event handle. The native IAT identifies4dd0a4=SetEvent,
4dd0ac=WaitForMultipleObjects,4dd0b0=CloseHandle.

Final existing thread summary reports T1 at440df9 and T5 at440e2a, both yield1
and waitH2. Native440e2a calls WaitForMultipleObjects(2, stack array containing
object+bc and object+6c, FALSE, INFINITE). Thus2 is a handle count, not evidence
of invalid handle2. The next causal question is stop-event identity/signaling
and the virtual1c join ownership; current counters alone do not prove a lost
signal, wrong wait result or thread-manager defect. Preserve this boundary and
obtain bounded actual event/wait evidence before changing engine behavior.

### Authenticated loader stop-event snapshot (Oct 7)

Session72625/PID2517648 ran10:29:36.145–10:32:07.789Z, normal quit0,
PID absent/8137 free/streams drained. Fixed read-only guest identities matched:
provider506d50/vtable4df6d0/getter463f96, loader506d54/vtable4dfc8c,
join slot1c=442d7d. Actual thread handle e1005, stop e0008, queue e0002.
The actual exported synchronization table was07b10000; matching stop and queue
rows were type1/manual-reset1/state0 at menu, before Easy, after Easy, after
Enter and settled. Sparse guest fields were read bytewise; no guest calls,
register reads or writes. The table snapshots are not atomic transition history.

The same teardown interval stopped between40fc25 and40fc40. Final standard
per-instance report again has T1 EIP440df9/wait-count2 and T5 EIP440e2a/count2.
Disassembly separates these from the join:440dc5 ends with ret4 at440df6;
440df9 starts a DIFFERENT function, the work-loop whose WaitForMultipleObjects
call is440e2a. Authenticated join442d7d instead calls WaitForSingleObject on
loader+24 at442d82. Thus the observed T1 location is not proof of being inside
the join, and state0 is not proof that a SetEvent signal was lost. Source call
46931d does target440dc5; its alive probe440ecb checks thread wait result102
before SetEvent440dda. Actual execution through these branches remains unproven.
Next evidence must authenticate that call/return and actual wait caller/stack,
not repeat aggregate early teardown counters or patch event consumption.

Evidence: scratch/wt-diehard-20261007/scratch/stop-event-diagnostic/attempt1;
22-artifact manifest SHA256
3e4f5e0678b21cf9498404e2aa7d5a2bde836f8af2fe48b71e246b2912b9dd59.
Full1569808-byte log SHA256
2afb1b8d598417d7016b72187d2e6779cc1a49346a00ea3544c82b3d69a37f56.
Read-state synthetic tests/source layout receipt: sibling validation.json.
Personally reviewed settled screenshot remains Easy/Medium/Hard, not gameplay;
same8eb283c1 module and debug-counter timing limitations remain.

Thread-label correction: ThreadManager stores main separately as tid0/win32Tid1
(lib/thread-manager.js:49). The final report iterates created threads, so T1
is the first created worker, NOT the main guest. T5 is the authenticated loader
handle e1005. Similar work-loop waits in two workers can be normal; this run did
not capture the main instance PC/stack. A next bounded read-only main snapshot
is legitimate for locating MAIN teardown only, never a substitute for either
worker's registers. Earlier conversational wording calling T1 main was wrong.

### Zero-timeout fix advances to the rendered opening level

Ordinary confirmation55241/PID2533830 used the same8eb283c1 WASM, with only
ThreadManager236e8be9's live/pending thread zero-timeout poll correction; no
counters or API/FS tracing. Actual before regression returned65535 rather than
WAIT_TIMEOUT258;8 focused contracts and existing ThreadManager tests pass.
Game execution ran10:42:57.331–10:47:48.227Z; scheduled ordinary quit at290s
completed normally, exit0/streams drained/PID absent/8137 free.

Personally reviewed normal New Game and held Easy now advance to loading and
then textured 3D narrated opening scenes. Authenticated loader changed from
thread e1005/stop e0008 to e1006/stop0e000000, preserving queue e0002. This
confirms lifecycle progress; the sampling did not observe transient SetEvent.
Actual main-only PC/ESP/EBP/wait/8-DWORD stack snapshots are explicitly labelled
and are not worker register substitutes. One ordinary Escape did not end the
reviewed opening cutscene. Final image is a bomb countdown, not player-controlled
gameplay. No movement/FPS/audio/full-level claim. Next ordinary route needs
time for opening completion and a reviewed player-view/input gate; no further
engine fix is justified by this bounded run.

Evidence: scratch/wt-diehard-20261007/scratch/thread-poll-confirmation/attempt1.
28-artifact manifest SHA256 a9cca0b2083547c919e3415e19276b51dca4a463f76350bf3a3ea33685f90cf3.
Full68086-byte log SHA256
fe5c9d023331f01acdc1ef9cef4e7925a235274cf9f5703e45c5b793c95e95df.

### Narrow ordinary player movement accepted

Fresh600s ordinary session73508/PID2551328 ran10:58:22.131–11:06:33.714Z,
early normal quit0, streams drained/PID absent/8137 free. Same pinned8eb WASM
and patched ThreadManager236e8; no counters, API/FS trace or custom observer.
Normal New Game/Easy completed loading and narrated intro into full player HUD,
crosshair and weapons. Original autoexec.cfg scan17 Forward/scan31 Reverse
supported ordinary W/S. W800ms changed camera perspective toward ropes/wall;
S800ms partially reversed it. Both key releases were recorded. Immediate500ms
post-input PNGs were stale; later separately captured settled images provide
the reviewed response. Final reverse-settled and5s idle-settled PNGs are identical
SHA25692385758bd5c087d16d5282b1454306257790bfafa5a151445dd88ccbd415269.
Root personally reviewed and accepted narrow player movement, not FPS/audio,
sustained level, full game or exact return to starting position.

Published run: scratch/runs/20261007-diehard-nakatomi-player-control.
result.json SHA2568c6ab63667ef96a5314a4fae57619be0dc2c41fe02d5cbee0b33b7fc9fdeea2d;
34-artifact validation.json SHA256beb17d626da495e0fa323d995b2c4cb0ad906cee745e5cf48b162b048434576c.
Live8098 reader recognizes all4 gameplay images; at publication its older corpus
view warns candidate not in corpus despite committed local registration. No
backend restart or public desktop promotion was performed by this lane.

### 2026-10-10: current-main confirmation, plus mouse look

On main `dcbc6080a` (wasm SHA256 `527004d9…d363`), an ordinary CLI run with
`--d3d9-renderer=software --tick-ms-per-batch=2` goes through the main menu
(~80k batches), the New Game page (click 230,130), Easy (350,115), the
loading screen, the narrated intro camera (~220k) and in-level control by
~225k. Holding Up and W from batch 225100 to 229000 walks the player to the
elevator cage, and two mouse moves at 229200/229400 turn the view to the right
wall; each capture differs (MD5). The HUD is live: radio, Zippo,
health/stamina/mental, MP5 30/64, Beretta 17/64.

After the menu appears, every draw parks on the software render worker
(`render park: main waited on 2062 software D3D requests`), so headless runs
crawl at 300-400 batches/s. Budget about 10 minutes of wall clock to reach
the level. Run: `scratch/runs/20261010T0230Z-diehard_nakatomi_demo-gameplay`
(command.txt has the exact inputs). FPS, audio and the browser route are not
qualified.
