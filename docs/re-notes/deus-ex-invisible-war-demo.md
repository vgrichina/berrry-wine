# Deus Ex: Invisible War demo

Original media: `test/binaries/win98-games-a-d/DeusEx Invisible War-D3D`.
All 16 local files (236357810 bytes) were hashed and transferred unchanged to
`bx_hx8msa33:/home/user/deusex-iw-media-20261010`. Source identity inventory:
`scratch/deusex-iw-20261010/selection.json` and the self-contained first run
`scratch/runs/20261010T1527Z-deusex-iw-startup/selection.json`.

InstallShield version 7 cabinets are readable by `tools/is-cab.js`.
Extraction verified MD5 and lengths for 816 entries. Descriptor 31,
`setup.skin`, failed verification: do not report a complete installer.
Conflicting setup resource filenames were preserved separately under
`.conflicting-entries/<index>/`; identical duplicates share a canonical file.
The receipt records every entry, conflict and failure. No installer or licence
dialog was answered.

The game executable `DX2.exe` is 6090752 bytes, SHA256
`da394a4b5eb6254d9bee648b4bb1bee557b516cca61bb24b55020d29bab72f46`.
Its direct imports are DInput8, D3D8, DSound and Windows APIs; no original
non-system DLL appears in its direct import list. Extracted files remain on
the boat at `/home/user/deusex-iw-extracted-20261010`. There is no local corpus
registration or public deployment.

## Reconstructed virtual layout

The archive directory tree is not the installed tree. The original
`Default.ini` refers to `..\Content\DX2`; EXE strings refer to
`..\System\Shaders`. Use `C:\System\DX2.exe`, working directory
`C:\System`, and these tested mounts:

- `DX2/*` -> `C:\Content\DX2\*`
- `Data/*` -> `C:\Data\*`
- Remaining canonical files -> `C:\System\*`

This is an investigation mapping, not proof of every install destination.
The startup probe mounts 808 canonical files eagerly; a required/lazy policy
is not yet qualified. Keep original config and executable bytes unchanged.

## Startup evidence, 2026-10-10

Browser: headless Chrome 151, default WebGL/guest Worker, 1000x800, no inputs.
Source `cedee9b54`; module SHA256
`c43dd314eb864e55c395c0617cfc89e51a018613e8ae3aba7f2c45fde58ea5e6`.

- `20261010T1527Z-deusex-iw-startup`: flat archive mounts reach a game window,
  then the generic “Flesh failed to initialize” message.
- `20261010T1530Z-deusex-iw-layout`: System/Content reconstruction reads the
  original configuration and many content files. File tracing identifies the
  missing `C:\Data\Normalize.dds`; it had been mounted under System/Data.
- `20261010T1532Z-deusex-iw-data-root`: corrected Data mount reads the entire
  original texture (1572992 bytes), then immediately shows the same error.
  Browser closed normally at 15:34:19Z.

`Data/normalize.dds` SHA256 is
`d2a3eec5d57593fe5ee5bd840d71cca958826f4813908689e7ea5e0bb708f27d`.
Its DDS header reports 256x256, 32-bit RGB, caps `0x1008`, caps2 `0xFE00`
(cubemap/all faces), and no mip count. The failed texture lookup is resolved;
do not repeat downloads or infer a missing texture from the generic message.
No menu, player-controlled gameplay, audio or FPS is qualified.

## Cubemap format negotiation identified

`20261010T1539Z-deusex-iw-d3d-trace` uses the same source, module and original
files, with the existing D3D API and filesystem traces enabled. It closes
normally at 15:40:49Z with no browser errors. After reading Normalize.dds,
the guest calls GetDirect3D, GetDeviceCaps and GetDisplayMode, then makes
43 CheckDeviceFormat calls: adapter 0, HAL, adapter format 22, usage 0,
resource type 5 (CUBETEXTURE), with candidate formats including 21 and 22.
Every call has guest return address `0x007fd881`. The trace's `ret=` field
is the caller address, **not an HRESULT**.

The exact tested `handle_IDirect3D8_CheckDeviceFormat` only accepts ordinary
textures (type 3) and supported target/depth surfaces (type 1). Therefore
all these type-5 queries return D3DERR_NOTAVAILABLE (`0x8876086a`). This is
established by the handler and captured arguments, not a dynamic HRESULT
capture. The guest releases IDirect3D8 at return address `0x007fd8ce` and
shows the initialization error. It never calls CreateCubeTexture.

The current rejection is honest: Device8_CreateCubeTexture is fail-fast,
and the D3D8 caps deliberately omit cubemaps. The next implementation must
provide the real D3D8 cube interface and storage before advertising support.
D3D9 already has cube allocation, face/mip storage and sampling, but its
vtable cannot be reused directly: D3D8's base texture omits three D3D9
methods, and its surface descriptor layout differs. Cover the D3D8 ABI,
face/level locks and surfaces, lifetime, format/create agreement, and a
rendered cube sample; then repeat this original startup route. Do not patch
the guest, change the DDS, or return success just to bypass negotiation.

## D3D8 cube implementation validation

The candidate adds a separate 19-slot CubeTexture8 interface over the shared
cube storage. It adapts surface descriptors, preserves Cube8 identity through
QueryInterface/GetContainer, and exposes cube formats and mip/filter caps.
Unsupported private-data methods retain the existing fail-fast behavior.
ABI references: [Wine's D3D8 interface declarations](https://raw.githubusercontent.com/wine-mirror/wine/master/include/d3d8.h)
and [D3D8 capability definitions](https://raw.githubusercontent.com/wine-mirror/wine/master/include/d3d8caps.h).

`test/test-d3d8-cube-texture.js` fails on the baseline's cube-format rejection.
The candidate passes calls through actual generated COM slots, exact stdcall
cleanup, all six faces and three levels for ARGB/XRGB/DXT1/DXT5, descriptor
sizes, shared surface locks, interface identity, and retained parent lifetime.
Existing D3D9 cube and D3D8 16-bit regressions and the full build pass too.
The shared sampler's separate WebGL1/2 test passes 48 face/stage/vertex-linkage
cases; this is renderer coverage, not evidence of Invisible War gameplay.
Validation logs are retained with the candidate's browser run.

`20261010T1552Z-deusex-iw-cube` proves the original game advances past the
format rejection: it creates a 256x256 XRGB cube, obtains each of its six
surfaces, calls GetDesc/LockRect/UnlockRect/Release for every face, loads the
next 2D texture, and sets both texture priorities. The same generic dialog
then appears after GetDeviceCaps returns to `0x004b7496`. Browser closure
is normal at 15:54:03Z; the final screenshot still shows the startup error.

Disassembly retained in `next-caps-disassembly.txt` shows the next checks:
TextureCaps bits `0x800` and `0x400`, then PixelShaderVersion at caps+`0xcc`
must be at least `0xffff0101` (ps_1_1). The candidate supplies the texture
bits but truthfully reports zero for D3D8 programmable pixel shaders.
Implement the real D3D8 shader handle/create/bind/delete/constants path
before changing that capability; do not fake the version to skip this check.
This is progress through initialization, not a playable-game claim.

## Pixel-shader handle adapter

The candidate uses a device-owned handle table over the shared shader objects,
with an internal reference for each live handle. Creating a handle does not
leave a COM reference retaining the device. GetPixelShader returns the DWORD
without AddRef; DeletePixelShader invalidates the handle and unbinds it when
current. Captured state blocks retain the bytecode independently. Tombstone
identities survive until device destruction so restoring captured state can
report the old handle without making that handle valid again for Set/Delete.
The final device release retires undeleted handles as well as ordinary binds.
These semantics follow [Wine's D3D8 device implementation](https://raw.githubusercontent.com/wine-mirror/wine/master/dlls/d3d8/device.c).

The implementation delegates bytecode validation, retained IR, constants and
execution to the shared backend, including main's `eaf7d0316` create/draw
validation repair. D3D8 now reports ps_1_4 and MaxPixelShaderValue 8, backed by
the real create/bind/delete/function/constant paths, rather than just changing
the capability check. Vertex shader support is still not advertised.

The baseline traps at CreatePixelShader in the new handle regression. The
candidate passes invalid/deleted/foreign handles, immutable bytecode, constant
round-trips, Get without retaining, captured-state restoration and final
device cleanup. D3D8-created/bound retained IR renders 16 expected-color
frames across ps_1_1..1_4 and WebGL1/2. Shared shader lifetime and cube tests
pass, as do 15 PS1.4 software/WebGL differential frames and the full build.
The quiet-handler ratchet removes only the old SetPixelShader constant-return
handler (242 -> 241); no new quiet handler is introduced.

`20261010T1611Z-deusex-iw-pixel` reaches the Eidos intro and then the game's
branded loading screen using original files and no inputs. The reviewed final
capture is a loading screen, not a menu or gameplay. Chrome exits normally
at 16:13:15Z, with no page errors. The trace records 54 CreatePixelShader calls
before its 12000-line cap fills during Bink video reads; it cannot establish
what happens later. Follow up with a longer ordinary-input route and narrower
tracing. The actual browser source is `eaf7d0316` plus the retained candidate
patch, not the later merged source. Audio and FPS remain unqualified.

## Loading exit on merged source

Three further routes use exactly `dc2e0d410`, the unchanged original files and
the reconstructed mounts above:

- `20261010T1616Z-deusex-iw-menu`: ordinary focus/Escape at 35 and 50 seconds;
  reviewed branded loading screen, then no game window by 120 seconds.
  Browser closed normally at 16:21:49Z.
- `20261010T1622Z-deusex-iw-no-input`: no input, same exit before 120 seconds.
  Narrow tracing logs no ExitProcess, TerminateProcess or DestroyWindow call.
  Browser closed normally at 16:24:45Z. Escape is not required to reproduce.
- `20261010T1625Z-deusex-iw-boundary`: a harness wrapper snapshots the actual
  worker response and register exports before host teardown. Browser closed
  normally at 16:28:23Z. The worker reports EIP zero, previous block
  `0x0069a3d3`, previous previous block `0x0041f820`, ESP `0x074fd884`, and
  EDI/ECX/EAX zero. The UI's exit summary prints all zeros despite the
  nonzero worker snapshot; use `boundary.json`, not that summary.

The original block reads `[edi]` and calls its virtual method at +`0xa8`
(`0x0069a3e4`). The caller obtains this object through `0x00699660`, whose
factory virtual call returns at `0x00699680`; its result is copied into EDI.
The null producer still needs dynamic tracing. Original disassembly and
controller are retained in the boundary run directory.

The trace also records CreateVertexShader calls with a non-null function
pointer. The current D3D8 adapter supports declaration-only calls and rejects
these with D3DERR_INVALIDCALL. That is a real unsupported path, but its causal
connection to this null object has not been established. Do not infer a
vertex-shader fix from temporal proximity alone or advertise unsupported caps.
There is still no verified menu, ordinary gameplay, audio or FPS.

## Missing UI configuration and per-thread image identity

Runs `20261010T1630Z-deusex-iw-factory` and
`20261010T1640Z-deusex-iw-ini-focused` narrow the null producer to the
GeneralHUD class lookup: `0x698f90` calls configuration helper `0x416b40`,
which returns AL=0 at `0x698fe5` after two failed opens of `C:\DX2UI.INI`.
The resulting class ID is -1. The original `DX2UI.ini` contains
`Type=GeneralHUDWindow`; no shader change is justified by this failure.

Original cabinet file-group descriptors establish the installation layout:
`NewComponent1` (46..1355) targets `<TARGETDIR>\Content`, `NewComponent2`
(1356..1513) targets `<TARGETDIR>\System`, and `UserIni` (1517) targets
`<TARGETDIR>`. DX2.exe (1364), DX2UI.ini (1376), and Data/normalize.dds
(1407) are all in the System group. The earlier root Data mount was a
diagnostic workaround, not the installer layout.

The original path helper reads REG_SZ `ION_ROOT_PC_DEMO` in
`HKLM\SOFTWARE\Ion Storm\Deus Ex - Invisible War Demo`. Seeding it with
`C:\` selects the expected Documents directory but does not cure the root
fallback. The System-directory value is incorrect: the isolated comparison
`20261010T1704Z-deusex-iw-registry-only` looks for the logo under
`C:\System\content\dx2\VideoTextures`, whereas the installer puts Content
under TARGETDIR. That run ends at a blank desktop, not gameplay.

`20261010T1709Z-deusex-iw-path-helper` captures the main thread returning the
correct `C:\System\DX2.exe` from GetModuleFileName at `0x4130fe`, and the
correct System directory from helper `0x4130b0` at `0x413c46`. A separate
two-instance control on the same build proves that a new thread reports only
`C:\System\` (length 10). Its instance-local image-name length remains the
default seven. A regression that instantiates the child *after* setting the
name additionally exposes the active-data initializer overwriting the old
0x120 name buffer with `app.exe`.

The candidate fix publishes name bytes, pointer, length and drive in a
process-owned region without an active data initializer. `init_thread`
inherits the metadata; the launch setters keep their existing interface.
The focused dynamic-module-filename test now checks both the main and a newly
created instance with a nested executable path on drive D. It fails on the
old implementation and passes with the candidate. Full build gates and the inherited-global regression pass. In the original
game comparison `20261010T1717Z-deusex-iw-process-image`, guest thread 1 now
opens and reads all 56593 bytes of `C:\System\DX2UI.INI`. The reviewed
60-second and final 180-second frames remain on the loading screen. Chrome
closed normally at 17:20:10Z, with no page errors. The config failure is fixed;
the remaining loading stall needs its own thread/render boundary diagnosis.
There is still no menu, ordinary gameplay, FPS or audio qualification.

## Longer loading control after the image-path fix

`20261010T1723Z-deusex-iw-loading-threads` on exact `6bc406dc5` shows
main-thread EIP changing across snapshots. A render wait at 90 seconds has
cleared by 120 seconds; secondary thread 1 waits at `0x41fb2f`. Do not call
that a fixed renderer deadlock.

The no-input `20261010T1726Z-deusex-iw-loading-long` runs 600 seconds. Its
reviewed final frame still shows loading. Render commands submitted/consumed/
completed all equal 21804, with zero inflight bytes and no queue error. The
main API count advances to 8940564. The trace is still reading the original
`Content\DX2\VideoTextures\intro.bik` late in the run. Chrome closes cleanly
at 17:36:46Z. Neither a menu nor gameplay has been established.

`20261010T1738Z-deusex-iw-intro-input` sends ordinary focus clicks and Escape
at 35/70/110 seconds, then a two-second Escape hold at 17:42:03Z on the same
browser. The final reviewed 240-second frame still shows loading; cleanup
is normal at 17:42:59Z. The keyboard queue records hwnd=0, which is the
intentional Worker routing convention, not proof of a focus bug.

The original `Intro.bik` is only 204 bytes. Local ffprobe on the boat reports
Bink video, 320x240, 30 fps, duration 0.033333 seconds. Thus repeated reads
are not evidence of a long cinematic progressing normally. Next trace the
guest video completion/menu transition; do not patch files or assume the
known unsupported vertex-shader path causes this loop.

## D3D8 vertex programs and original shader corpus (2026-10-10)

The passive Bink completion probes observed four completions, including both
startup-logo consumers. Repeated intro reads alone do not establish an endless
Bink wait. The subsequent D3D8 control exposed a separate missing adapter:
identical VS1.1 bytecode succeeded through D3D9 and failed through D3D8.

The adapter now retains a device-owned program/declaration pair, original
declaration tokens and source bytecode, and explicit input-register mapping.
The real game declaration at VA 0x9b49c4 uses registers v0..v4 with FLOAT3,
D3DCOLOR, FLOAT2, D3DCOLOR, D3DCOLOR. Sparse v0/v7 controls verify that shader
inputs are not inferred from fixed-function semantics. Tests cover queries,
constants, stale/foreign handles, state blocks and device cleanup.

The extracted Shaders directory contains 44 vertex programs: 41 have version
0xfffe0100 and three have 0xfffe0101. Merely enabling the VS1.1 adapter accepts
only the latter three. The legacy version must remain intact through native
validation, retained bytecode, IR projection and software/GL compilation.
Wine's d3d8 test_validate_vs explicitly accepts a VS1.0 version word.

Twelve original VS1.0 programs also encode m3x3 with a default xyzw destination
mask (first instance at DWORD27, opcode0x17). Legacy normalization emits only
the instruction's row count, preserving the remaining destination components,
matching Wine shader_glsl_mnxn. The explicit-mask requirement remains for
VS1.1, and arbitrary partial masks still fail. This is implementation-reference
evidence, not a native Windows conformance measurement.

Evidence: runs/20261010T1830Z-deusex-iw-vertex-corpus records the initial refusals;
runs/20261010T1834Z-d3d8-legacy-vertex accepts32/44 unchanged programs;
runs/20261010T1839Z-d3d8-legacy-matrix accepts44/44 unchanged programs. The
five-matrix regression fails before normalization and passes afterward, including
untouched components; the real host/software/WebGL1/WebGL2 pixel checks pass.
Full candidate build passes. The VS1.0-only 180-second original run still shows
loading; the full-matrix 180-second comparison also remains at loading (reviewed
runs/20261010T1839Z-deusex-iw-matrix, cleanup18:42:48Z). It now paints the
v1.1 label above the loading graphic, but no menu/input/playability is proved.
Shader acceptance is not gameplay qualification.

References: https://github.com/wine-mirror/wine/blob/master/dlls/d3d8/tests/device.c
and https://github.com/wine-mirror/wine/blob/master/dlls/wined3d/glsl_shader.c .

## Single-level cube sampler refusal (2026-10-10 18:54Z)

On merged4b2494187, passive uploadTexture instrumentation captures the next
refusal: stage1 is a64x64 cube with one mip level, min=mag=LINEAR, mip=LINEAR,
LOD bias=-1 and MAXMIPLEVEL=0 (runs/20261010T1847Z-deusex-iw-sampler-refusal).
The host snapshot uses the same level count for every cube face.

Every LOD clamps to the sole level. With equal min/mag filters, both texture
selection and filtering are independent of bias/clamp. Permit this neutral
case while retaining explicit rejection for genuinely unsupported multi-level
and unequal-filter cases. Validate finite float bias and uint32 mip clamp
before taking the neutral path. No guest sampler values are patched.

The regression fails on main, passes288 WebGL1/2 face/stage/filter/bias/clamp
cases on the candidate, and keeps invalid/multi-level/mixed-filter cases
refused (runs/20261010T1850Z-d3d9-single-level-cube). Original180s comparison
now reaches the3D menu scene (runs/20261010T1851Z-deusex-iw-cube-lod, reviewed
final.png); the loading graphic is gone. Text and textures are visibly wrong
(magenta panels, missing labels), and no player-controlled gameplay is proved.
The1842-entry console has no D3D draw refusals; missing comctl32.dll is still
reported. errors.json covers page/harness exceptions only, so inspect the
console separately before claiming no renderer failures. Next investigate
menu text/texture correctness and ordinary menu input on the merged fix.

## Shader handles lost across Reset (10 October, 19:25 UTC)

The menu now accepts ordinary Enter and reaches character setup, but its
geometry is white and the portrait/button label are absent. A bounded probe
using the existing guest EIP breakpoint facility captured actual API returns
at 0x004b56b3 (SetVertexShader) and 0x004b56df (SetPixelShader). Nonzero
handles returned D3DERR_INVALIDCALL (0x8876086c); both handle-list heads in
the live device program state were zero. Fixed-function selections succeeded.
The earlier API trace's ret= field is a caller address, not an HRESULT.
Evidence: scratch/runs/20261010T1922Z-deusex-iw-binding-return.

The shared Reset transaction allocated replacement program state but did not
transfer D3D8's vertex/pixel handle registries or monotonic pixel handle counter.
Preserving those device-owned fields retains programs and deleted-handle
tombstones while the normal Reset path still clears current bindings.
Wine's [D3D8 test_reset](https://github.com/wine-mirror/wine/blob/master/dlls/d3d8/tests/device.c)
creates a vertex shader, resets, then successfully deletes the same handle.
This is reference-test evidence, not a new Windows reference run.

The regression exercises failed and repeated successful Reset, rebind/query,
dead handles, counter uniqueness and device destruction with direct and worker
software rendering. The unchanged-source control fails on the first post-reset
vertex rebind. Original-game browser run
`scratch/runs/20261010T1930Z-deusex-iw-reset-handles` now shows the blue
setup panels, portrait and readable done button after ordinary Enter. The
before/after pictures were reviewed. This verifies the setup rendering fix;
player-controlled gameplay, audio and FPS remain unqualified.

## Ion Launcher handoff chain (10-11 October)

(Recovered from branch commit 149a3547b, Oct 2026. The host/WAT fixes named
here are on main: process aliases `0x00E6xxxx` in `09a0-handlers-base.wat`,
`lib/process-send-broker.js`, D3D8/D3D9 `GetAdapterMonitor`.)

Start Game makes DX2 hand the level to `C:\System\Ion Launcher.exe` and exit.
Each link that broke, in order:

1. **ShellExecuteExA** at DX2 `0x402704` (60-byte SHELLEXECUTEINFO, mask
   `0x440`, nShow 5); timeout termination at `0x402850`. The old handler
   faked success without launching and wrote 33 into nShow (+28) instead of
   hInstApp (+32). Needs a real child and hProcess for NOCLOSEPROCESS.
2. **Launcher args.** DX2 builds them with format `0x904738`
   `%s %s "%s" %s %s` (`0x904754` = `dummy`, the third field); field two is
   MONITORINFOEXA.szDevice from `GetCreationParameters` (`0x4020b5`) →
   `GetDirect3D` → `GetAdapterMonitor` (`0x4020db`) → `GetMonitorInfoA`
   (`0x402104`). D3D8/D3D9 returned NULL for every adapter, the empty field
   shifted the launcher's strtok parse, and it restarted DX2 with empty args.
   Fix: adapter 0 → USER32 primary monitor `0x10000`, absent adapters NULL.
   Good child command: `-display \\.\DISPLAY1 640x480 M1_Seattle_MercDistrict_Sak.gmp?-LoadTravel`.
3. **Launcher WinMain** `0x4038b0` creates two *events* named `Ion Launcher
   Mutex` (`0x40a278`) / `Ion Game Mutex` (`0x40a268`); `GetLastError == 183`
   at `0x40390c` sets BL; BL selects the fresh-launch path at `0x403a7f`.
   With BL zero, `0x403830` registers the class and `0x403690` creates the
   window; a zero result also falls to the empty-args restart at `0x403aa0`,
   so an empty child command cannot distinguish the two. Named events must be
   shared across processes (the browser namespace confirmed both open with
   alreadyExists=true).
4. **FindWindowA** at DX2 `0x4027ba` (filter at `0x904728`) must see the other
   process's windows: a desktop query precedes the local WND walk.
5. **Child lifetime.** Browser `process_spawn` installed `_stopChildren` and
   every `stop()` ran it, so DX2's deliberate `TerminateProcess(-1,-1)` killed
   its live launcher. Windows ancestry has no such contract; cascade removed.
6. **DuplicateHandle** at `0x4027f0`/`0x402806`: DX2 duplicates its
   GetCurrentProcess pseudo handle into the launcher (SAME_ACCESS) and sends it
   as lParam of message `0x400` via **SendMessageA** (IAT `0x904478`, call
   `0x402818` — not PostMessage). Launcher handler `0x40377a` stores lParam at
   `0x40c048`; its wait `0x4033a0` starts that at -1 and pumps up to 120000 ms
   (timeout returns 1 at `0x403439`). Copying -1 unchanged hit exactly the
   sentinel; now target-owned process aliases `0x00E60000|n` reference a shared
   process object that keeps the exit DWORD after teardown. CLI children are
   separate OS processes and return ERROR_NOT_SUPPORTED for this.
7. **GetExitCodeProcess** read process_ctl's -1 as invalid handle, but
   0xFFFFFFFF is DX2's real exit code; op 2 now checks validity only for -1.
8. **Cross-process SendMessageA** — see the next section; it cut parent exit →
   level spawn from 122587 ms to 3822 ms.

Launcher statics: `0x4032c0` builds its own SHELLEXECUTEINFO, calls
ShellExecuteExA at `0x403352`, stores hProcess at `0x40c04c`.

## Synchronous launcher handoff: receiver admission prerequisite (11 October)

The held investigation branch records the original process-alias run in
`scratch/runs/20261011T1116Z-iw-process-alias-original`. DuplicateHandle returns
a real target-owned alias, but the launcher still waits 122587 ms. Original
IAT 0x904478 is **SendMessageA**, not PostMessageA; its foreign-process delivery
is absent. See diagnosis commit 149a3547b for the two-memory reproduction.

Independent process schedulers introduce a check/dispatch race: reading the
receiver's yield on the page and dispatching afterward lets an ordinary slice
run between those commands. Worker `dispatchThreadSend` now accepts an opt-in
`requireMessagePoint` request. It checks admission on the receiver itself,
before saving a callback frame or changing registers. Mid-code returns
`deferred: true` and arms the next incoming-send message point. Exited or
EIP-zero receivers return `unavailable: true`. Neither response fabricates an
LRESULT. At yields 7, 10, 15 or 17, the existing callback machinery runs and
restores the receiver state. Existing unguarded same-process dispatch is unchanged.

This is only the admission primitive, **not a cross-process transport**.
The future broker must retain deferred requests, retry at a message point,
handle disappearance, preserve synchronous replies and nested sends, and
release its incoming-send reservation when finished. It must serialize
independent callback owners; the admission check alone does not do that.
Cooperative fallback and inter-process pointer-message marshalling also need
explicit treatment. Do not wire an unavailable/deferred result into the
existing resume path as a successful zero return.

Evidence: `scratch/runs/20261011T1134Z-worker-send-admission`. Actual Worker
tests verify deferral, every admitted yield, context restoration and receiver
exit; existing nested-send/wait and timing tests pass (23 + 9 checks).
Reverting the Worker guard makes three new checks fail. Tests ran on the
retained original-game source plus the candidate, not a fresh full-main build.
No original-game rerun or new gameplay qualification accompanies this primitive.

### Broker request ownership (held component)

`lib/process-send-broker.js` retains deferred synchronous requests until the
receiver scheduler notifies progress. It does not poll. Endpoint identity
includes the registration object, so reusing a PID cannot resurrect requests
to the previous process. Exit rejects pending sends explicitly; a sender exit
does not prematurely release an executing receiver callback's frame.
Zero remains a valid completed LRESULT, distinct from deferral or retirement.

Nested requests carry an active request context and ancestry. A descendant
can reenter its ancestor's receiver; independent requests and same-chain
siblings wait until the receiver frame is released. Readiness epochs preserve
a notification racing an in-flight deferred reply. Invalid replies and stale
contexts fail rather than masquerading as successful sends.

Evidence `scratch/runs/20261011T1142Z-process-send-broker`: ownership tests plus
26 actual-Worker/send checks pass, including a broker-retained request that
enters the actual x86 callback only after scheduler notification. Disabling
receiver ownership fails the independent-send overlap test. The broker test
has a wall-clock deadline so a stranded promise cannot pass through Node exit.

This component is **not loaded or wired into the browser yet**. Remaining:
map foreign HWND ownership to process/thread endpoints; suspend and complete
the sender's real WAT SendMessage frame; drive blocked and nested receiver
callbacks through the owner backend; notify readiness from actual scheduling;
retire endpoints on process shutdown; handle independent cyclic send chains,
cooperative mode, and pointer-message marshalling without silent success.
The current tests do not establish those integration contracts or gameplay.

### Worker process-send runtime candidate (2026-10-11, held)

The next candidate wires foreign HWND ownership to registered Worker process
endpoints. SendMessageA preserves its real stdcall continuation while the
receiver executes its WndProc; nested sends carry broker ancestry. Shutdown
retires endpoints. System messages requiring marshalling and cooperative
processes explicitly return ERROR_NOT_SUPPORTED (50).

`test/test-process-send-runtime.js` runs separate actual Worker/WASM memories
through the browser host adapter: scalar WM_USER delivery and LRESULT/stack
restoration, nested A -> B -> A replies, and unsupported-route rejection pass.
Disabling the resolver makes the receiver-delivery assertion fail. The retained
boat source passed the full build, broker tests, 26 Worker/send checks and nine
timing checks. Runtime regression and test-tier evidence is in
`scratch/runs/20261011T1154Z-process-send-runtime`.

Original browser run `20261011T1157Z-iw-send-runtime-original` confirms
WM_USER with real process alias 0xe60001 returns 1 in 121 ms. Parent exit to
level-process spawn is 3822 ms, versus 122587 ms in the alias-only control.
The final 420-second screenshot still shows LOADING with a full bar. No
player-controlled gameplay, FPS or audio qualification. The exact retained
source hashes are recorded; this is not current main. Missing resource:
`test/binaries/tlbs/stdole2.tlb` (HTTP 404).

Keep this candidate held for integration/correctness review: independent cyclic
send chains can deadlock; process-wide ownership serializes different receiver
threads; existing callback-driver failure paths can collapse failures to zero.
General system-message marshalling and cooperative transport remain absent.
The successful launcher route does not establish general Win32 compatibility.
Next game investigation is level-load completion, with a longer bounded run
and thread samples if loading persists. CMR3 remains the second selected lane.

### Foreign callback failure follow-up

The follow-up stops treating receiver traps, broken transport and callback
driver failures as valid zero LRESULTs. Foreign failures propagate to the run
loop; nested receiver frames are unwound once, retaining the fault location
for the receiver scheduler. Only explicit unsupported transport and retired
receiver errors map to Win32 errors 50/1400. Reporting those errors also needed
a real `set_last_error` export: the previous catch silently hid its absence.

The actual two-Worker regression now runs UD2 in the receiver, checks rejection,
retained fault EIP, balanced callback frame and uncompleted sender; it also
checks transport rejection and error 1400 after window disappearance. Existing
successful scalar/nested replies remain covered. Evidence:
`scratch/runs/20261011T1216Z-process-send-failures`. Full retained-source build,
broker tests and 26 cross-thread checks pass. Independent cyclic ownership is
still a correctness hold, and there is no new browser gameplay result.

## Additional dated branch findings

These historical observations supplement the current facts above; they do not establish a new current-main runtime result.

### 600-second original route: level execution samples

Run `20261011T1222Z-iw-level-samples` used the retained source plus the held
failure-propagation candidate. It repeats the successful launcher handoff,
then still shows LOADING at 600 seconds; browser cleanup exits zero and the
harness reports no errors. No gameplay, ordinary movement, FPS or audio claim.

Eleven 30-second-spaced samples from the spawned DX2 level process have eleven
different main EIPs, all yield zero. The secondary thread consistently waits
at 0x41fb2f, yield one. The earlier single sample at 0x7e15b2 does not establish
a stuck pointer scan: original disassembly increments its array cursor, and
the new samples reach other code. Late samples at 0x4b5309/0x4b537e and
0x4ebcb6 surround indirect calls through the object at 0x9e1210, with slots
0xfc/0xf4 and texture-stage-shaped arguments. Final main EIP is 0x4db80d.
This narrows the next probe toward rendering/state submission, without proving
that loading completed or that a frame is presented.

Next: bounded API/render-call census after level launch, recording Present,
draw submission and loading-state transitions; avoid another uninstrumented
long wait. The sampler's additional DevTools connection used its default
viewport, so intermediate frames show an 800px shell before the final 1000px
capture. Treat this as diagnostic evidence, not a controlled timing benchmark.
The missing stdole2.tlb HTTP404 remains recorded, with no demonstrated causal
connection to the loading screen. Source hashes, samples and disassembly are
preserved in the run folder.

### Rendering census: persistent shader-link failure behind loading image

Run `20261011T1239Z-iw-render-census` on bx_p3756882 adds per-process counts
around the existing host graphics bridge. The initial detached attempt did
not start a browser: fork snapshots omitted node_modules and the build.
After `npm ci` with browser download disabled and a successful full rebuild,
the actual original-route capture started at 12:44:35Z. No guest patch or
approval response was supplied by the capture.

At 300 seconds, the spawned level process had 2284 draw and 571 Present calls.
At 400 seconds it had 210741 draw and 994 Present calls, but 208350 draws,
2120 clears and 423 Presents returned the bridge's error value -1. Values
below -1 are asynchronous request tokens, not the same error category.
The actual device queue reports:

`FRAGMENT varying d3d_color0 does not match any VERTEX varying`

There is one visible window, HWND 196609, owned by the level process 1002.
Its GPU layer stays at writeSeq 571. A direct capture of that layer shows
the loading image itself: this is not an old parent window covering a newly
presented scene. The game continues issuing work against the failed queue.
The harness's empty page-error array does not imply a healthy rendering queue.

Three subsequent draw shader IR/source pairs were captured after failure.
They are context, **not an identification of the first failing pair**.
Next: capture the vertex/fragment sources and native IR at the first link
failure, reproduce it with an isolated WebGL link test, and compare intended
D3D shader linkage before changing missing outputs. Do not paper over the
error by inventing a color value or clearing the failed queue. The latest
run still does not qualify gameplay, input response, FPS or audio.

### First failing pair: colorless stencil pass

Run `20261011T1305Z-iw-first-shader-pair` captures the actual first failed
`createProgram` call, then rethrows the original error and closes the browser.
The VS1.1 program writes position only. The fixed-function pixel program
selects texture-factor RGB but retains `d3d_color0.a` as its output alpha.
There is no vertex color output to link against.

The recorded draw has `colorWriteMask=0`, alpha test disabled, stencil enabled
(z-fail operation 4), depth testing enabled and depth writes disabled. This is
a colorless stencil pass, not a request to display an invented diffuse color.
An isolated WebGL test reproduces the exact link error; replacing only the
fragment source with a constant output links successfully. That control does
not yet verify stencil results or constitute an emulator fix.

Next: specialize safe colorless fixed-function passes without removing any
discard, depth or stencil effects; test stencil behavior and repeat the game
route. Sources, 2336-byte native vertex IR, render state, diagnostic served
backend, screenshots and cleanup are preserved in the run folder. Browser
closed at 13:10:34Z, exit 0; the isolated browser also closed. No gameplay claim.

### Colorless-pass candidate: isolated success, game still blocked

Candidate `7b89c446c` is on `codex/iw-colorless-stencil-20261011`, separate
from the held transport branch. After normal fixed-function validation it
removes the pixel color dependency only for colorWriteMask=0 draws without
alpha test, color key, fog, outlines or a programmed pixel shader.
WebGL1/2 regressions preserve stencil fail/zfail/pass operations and unchanged
color; visible draws still reject missing color. Alpha-test/key exclusion
guards pass. The unfixed negative control fails the original link error.

The original 600-second game rerun `20261011T1320Z-iw-stencil-game` nevertheless
ends at LOADING with the same error text and writeSeq571. Its recorded backend
hash matches the candidate. This is **not** a gameplay fix or main-ready result.
The follow-up first-failure capture includes fog state and primitive identity
to distinguish a different pair from a specialization exclusion.

`20261011T1329Z-iw-next-shader-pair` resolves that ambiguity: the first
failure **after** the candidate is a different program, writing position and
tex0/tex1/tex2. Its fixed pixel stage computes texture times factor RGB but
retains diffuse alpha. This draw has colorWriteMask=7 (RGB only), no alpha
test/fog/stencil, and blending enabled with SRC=9 (DESTCOLOR), DST=3
(SRCCOLOR). Thus the stencil specialization did remove the earlier failure;
the next failure happens before another completed Present.

Next investigate dead output-alpha elimination when alpha writes are masked
and neither blend factors nor discard use source alpha. Do not substitute a
default diffuse color globally: RGB operations or source-alpha blending can
make that value observable. Both first-pair artifacts are retained for controls.

### Level rendering restored with independent RGB-stage alpha elimination

`1d5243e23` extends the separate rendering branch. It recognizes one active
fixed stage selecting texture/factor/constant RGB independently, with alpha
operation disabled and output alpha masked. It removes the initial diffuse
read only when no source-alpha blend factor, alpha test, fog, outline or
post-specular operation can make that value observable. Ordinary GLSL
dead-code elimination alone did not remove the link dependency in WebGL.

Full retained-source build and the expanded WebGL1/2 regression pass: RGB
values, destination alpha preservation, the game's DESTCOLOR/SRCCOLOR blend,
source-alpha exclusions, live diffuse/current RGB exclusions, and keyed
fragment discard preserving stencil. The prior stencil-only commit fails
the new RGB test with the original link error.

Run `20261011T1345Z-iw-rgb-game` reaches the actual corridor and HUD, with no
render queue errors in the sampled state. A stationary five-second diagnostic
sample observed 9 published GPU frames, about 1.80 fps, on Chrome/SwiftShader;
this is not a controlled performance benchmark. The first W input targeted
HWND0 after launcher exit and did not visibly move the scene, so this run
qualifies the scene only, not player control. Audio remains unverified.
The focused-input follow-up uses an ordinary click on the new level window
before W; shipped user.ini confirms W is MoveForwardBackward 1.000000.

Run `20261011T1357Z-iw-focused-input` confirms ordinary player input: click
the level window, hold W, dismiss the game's "Using the Datavault" help with
Escape, then hold W for six seconds. Reviewed frames change from the corridor
to a close-up of the nearby grating/barrier, with the HUD retained. The first
hold also brings up the tutorial. Mouse events name HWND0x30001; key logs
still say HWND0, so that log field alone does **not** establish a broken
keyboard route (the game polls DirectInput). The earlier short input run was
unqualified, not proof of a focus-routing defect.

This establishes a gameplay scene and visible response to ordinary movement
on the held combined runtime. It does not establish acceptable performance,
audio, combat, candidate registration or production readiness. Render commits
7b89c446c/1d5243e23 are independent review candidates; process-send cycle
ownership remains a separate main-integration hold. Both captures ended
cleanly and their artifacts are copied locally.
