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

## Ion Launcher handoff (10 October, candidate investigation)

On baseline `072a9c2c3`, ordinary character setup and Start Game reaches level
loading, then exits after waiting for Ion Launcher. The API-entry capture in
`scratch/runs/20261010T2020Z-deusex-iw-shell-candidate/request-decoded.json`
proves a 60-byte SHELLEXECUTEINFO with mask `0x440`, file
`C:\\System\\Ion Launcher.exe`, parameters
`DX2.exe  "dummy" M1_Seattle_MercDistrict_Sak.gmp?-LoadTravel ` and nShow 5.
The game calls ShellExecuteExA at 0x402704 and reaches its timeout termination
at 0x402850. The former handler returned success without launching and wrote
33 into nShow (+28), rather than hInstApp (+32).

The tracked-launch draft supplies a real host child process and hProcess for
SEE_MASK_NOCLOSEPROCESS. Full build and five focused regressions pass in
`scratch/runs/20261010T2033Z-shell-execute-ex-tracked`. The original browser
run `scratch/runs/20261010T2033Z-deusex-iw-tracked-launcher` shows Ion Launcher
starting and then launching another DX2 process by 240 seconds. The reviewed
240-second screenshot shows the child's Eidos startup logo, not gameplay.
That is a successful launch attempt, not proof of the full handoff.

Static launcher disassembly: function 0x4032c0 builds another 60-byte
SHELLEXECUTEINFO with mask 0x440; ShellExecuteExA is called at 0x403352,
and its returned hProcess is stored at 0x40c04c. Function 0x4033a0 sets an
event and pumps messages for up to 120000 milliseconds, awaiting a change
to 0x40c048 from -1. Its timeout returns 1 at 0x403439. These are static
paths; the precise cause of the observed launcher exit still needs tracing.

Potential integration gaps remain: FindWindow currently scans a process-local
window table, named synchronization lookup is per ThreadManager, and the host
stops tracked children when their parent stops. Do not fabricate a window,
event, or process handle to satisfy the game. Capture the next actual failure
before changing these contracts. No gameplay or release qualification yet.
