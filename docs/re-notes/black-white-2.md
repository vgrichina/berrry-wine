# Black & White 2 demo

## Input and extraction (2026-09-09)

`test/binaries/win98-games-a-d/Black and White 2-DX9-D3D.exe` is the
647,216,200-byte Black & White **2 demo** InstallShield 11 self-extractor.
It is not the original Black & White game.

The outer payload starts at file offset `0x1c200`. Each entry is four
NUL-terminated ASCII fields (basename, `Disk1\\...` path, version, decimal
byte length), immediately followed by exactly that many uncompressed bytes.
Walking nine entries ends exactly at EOF. Measured with `xxd` and a bounded
field walker against the input, not guessed from cabinet signatures:

| Entry | Data offset | Bytes |
|---|---:|---:|
| data1.cab | 115243 | 36286822 |
| data1.hdr | 36402105 | 58374 |
| data2.cab | 36460523 | 609467787 |
| engine32.cab | 645928357 | 543481 |
| layout.bin | 646471878 | 559 |
| setup.exe | 646472483 | 121064 |
| setup.ibt | 646593588 | 395955 |
| setup.ini | 646989581 | 480 |
| setup.inx | 646990102 | 226098 |

`unshield l data1.cab` lists 416 files when its matching header is beside it.
Extraction also needs **data2.cab**. Earlier `/private/tmp/black-white-seed2`
emulator overlay contains data1.cab/hdr but **omits data2.cab**; it is therefore
not a complete installation source. `7z` cannot open the outer EXE.

The game EXE is `MainApp/BW2Demo.exe`, 20,656,128 bytes. The largest asset is
`MainApp/Data/Everything.stuff`, 432,577,472 bytes. Other file groups provide
English speech/text, splash textures, credits and the readme. DirectX support
includes `Apr2005_d3dx9_25_x86.cab`. Inspect actual imports with:

```
node tools/pe-imports.js PATH/MainApp/BW2Demo.exe --all
```

## Installer investigation

The direct extracted setup needs all three runner arguments:

```
--exe=PATH/setup.exe
--exe-guest-path=c:\windows\temp\byep1.tmp\disk1\setup.exe
--cwd=c:\windows\temp\byep1.tmp\disk1
--args=-deleter
```

Use `--quiet-api --quiet-blocks`. Positional EXE arguments are ignored by the
runner; omitting the guest path searches for engine32.cab in the wrong place.
Dialog control sequence: wait 710, click 1; wait 1000, click 1000 and 1;
wait 718, click 1; wait 711, click 1 (Install).

Loading `isprobe.tlb` imports stdole2. Registering and mounting its raw MSFT
type-library data removes the measured `TYPE_E_CANTLOADLIBRARY 0x80029C4A`.
This does **not** establish installer success. The following failure jumps
through zero at iuser original VA `0x10001d7c`: an AddRef indirect call where
EDI points to ASCII GUID-path data, not an object. Runtime iuser base in these
runs is `0x01d2f000`, original base `0x10000000`.

`iuser+0x10003391` receives the pointer and forwards it via `0x100010cb` to
the AddRef helper `0x10001d6f`. Cause is still unproved: argument marshalling,
pointer lifetime and unsupported COM behavior remain possibilities. Earlier
claims that the Win98 OLEAUT library lacks these standard automation helpers
were speculative and must not be used as evidence for native overrides.

## Direct executable startup

The complete extraction is currently `/private/tmp/black-white-full.ntZDCF`.
`unshield -d extracted x data1.cab` succeeded for all 416 files. The DirectX
cabinet's `d3dx9_25.dll` was extracted beside `MainApp/BW2Demo.exe` with `7z e`.
Game launches use `--vfs-include='**/*'` and explicit `--dll-seed=` paths for
d3dx9_25.dll, binkw32.dll and dbghelp.dll; the ordinary DLL graph supplies CRT
dependencies. English supplemental groups have provisionally been copied
into MainApp's Data, Audio and Data/Art/Textures folders (verify filesystem
traces before treating these destinations as established).

The executable enters real startup code. CPU gaps observed, in sequence:

- `0x00b65de8`: **F3** 0F59, MULSS (not MULPS).
- `0x0040b656`: UCOMISS followed by LAHF and parity tests.
- `0x006013e0`: scalar division during startup object construction.

The runner's crash EIP can point **after an instruction prefix**. Always
disassemble from a known preceding instruction/function entry: disassembling
at reported EIP `0x00b65de9` falsely labels the opcode MULPS. ADDPS/MULPS were
already implemented in dc7bc157. Scalar arithmetic and UCOMISS are being added
with `test/test-sse-scalar.js`; no SSE feature bit is advertised yet.

The stale region-owner anchors were resolved by the shared integration lane.
Use paired current artifacts: `tools/build-compile-wat.js --out=...
--compat-out=...`, then `--no-build --wasm=...`; do not mistake an older
build/wine-assembly.wasm for current sources. No gameplay has been verified.

## Programmable renderer implementation

The direct game reaches a fatal pixel-shader 1.1 capability check after
creating its LIONHEAD window in the default profile. The experimental
`?d3d9-programmable` profile enables real shader/texture/buffer rendering after
a GPU pixel probe. No game patch or capability-only bypass is used.
See `apps/direct3d9.md` for the extension to the existing graphics design.

Real WAT shader objects/constants, guest texture mip storage/level surfaces,
vertex/index buffers, locking/binding/lifetime and programmable UP/buffer
draws now lower through the shared GPU backend. `test-d3d9-pipeline-web.js`
checks completed canonical BGRA frames, INDEX16 rebasing, INDEX32 above65535,
signed base-vertex offsets and locked/range rejection. These synthetic
rendering passes do not establish game menu or gameplay compatibility.

The genuine browser run with that profile gets past the shader check and
traps at `0x009343b4`: the following call at `0x009343c4` is
`[device-vtable+0xf4]`, **EndStateBlock** (slot61). Return address is
`0x009343ca`; device pointer `0x07f07030` in the measured run. The immediately
preceding sequence records render states via slot57 (`+0xe4`). Logs label
these COM thunks `<ord>`; disassemble the caller to identify the actual slot.
Selective render-state block recording/Capture/Apply is now implemented and
unit-tested; other recording categories fail explicitly until implemented.

Subsequent genuine browser runs advanced through these measured gaps:

- `0x0093459e`, slot69 `+0x114`: SetSamplerState during recording.
- `0x00934664`, slot65 `+0x104`: SetTexture during recording (initial null bindings).
- `0x0093468f`, slot44 `+0xb0`: SetTransform, texture matrices16..23.
- `0x00936a09`, slot22 `+0x58`: GetGammaRamp for implicit chain0.

Selective sampler, internally retained texture bindings and immutable matrix
copies now Capture/Apply without changing live state during recording. Tests
cover replacement/release, caller-memory reuse and independent matrix slots.
Gamma has copied per-device API data, with display capability still disabled.
The initial WORD ramp is0..255 per Microsoft's "Using gamma correction" note,
not0..65535; the game's following loop multiplies each WORD by255.
No menu or gameplay has yet been reached. Probe logs live under
`/private/tmp/black-white-*-probe.log`; the probe uses the genuine extracted
assets and only the opt-in real GPU capability profile.

Native D3DX then records vertex declarations at original`0x0051b0a1`
(`+0x15c`,slot87) and vertex float constants at`0x005121be`
(`+0x178`,slot94). Measured DLL base`0x02528000`, original`0x00400000`;
runtime failures`0x02643099`/`0x0263a1ac`. Declaration/shader references and
per-register float constant state blocks now have lifetime/overlap tests.

The next real failure was ReadFileEx at`0x00b532be`. It reads175104 bytes
from Everything.stuff offset102306304 into`0x4c550000`; OVERLAPPED at
`0x4fda0300`, callback`0x00b53100`. The callback uses hEvent as a private
context pointer, which must remain untouched. Positional VFS reads now preserve
the shared file cursor and queue completion on the calling WAT instance for
SleepEx/WaitForSingleObjectEx alertable delivery. Lazy residency currently parks
submission through existing IO_WAIT before queueing; this is not fully
asynchronous provider scheduling. Other APC/cancellation APIs remain unsupported.

First integration hung at`0x00938963` in the texture-loader polling loop.
Passive callback count stayed0 despite SleepEx(0,TRUE) and completed bytes.
Cause: inline CALL-reg dispatch overwrites redirected EIP unless steps=0;
handler_set_eip only protects the outer thunk-zone path. The APC continuation
now sets both, and test-read-file-ex includes an actual x86 CALL-reg regression
(the original direct-handler callback test did not exercise that path).

WIP checkpoint: the genuine browser run now advances beyond that callback to
native D3DX at runtime `0x025f6e12` (original `0x004cee12`), with `EDX=0x31545844`
(`DXT1`). This next texture-loading failure is not yet diagnosed. No menu or
gameplay has been verified.

Continuation: disassembly identifies that call as device slot6 GetDirect3D
(`call [eax+0x18]`), not a DXT decoder failure. Parent identity/AddRef and
device-owned lifetime now have compiled tests, along with the subsequent
GetDisplayMode/GetCreationParameters queries. Genuine browser execution passes
this point and reaches D3DX original `0x0051b59e`, runtime `0x0264359e`, whose
`call [ecx+0x10c]` is slot67 SetTextureStageState during state-block recording.
Eight stage rows and selective recording/restoration are being implemented;
fixed-function visual conformance remains unverified.

Stage recording now passes compiled tests and genuine D3DX execution. The next
CPU trap was `F3 0F 2A C0` at `0x00a6bb7f` (CVTSI2SS xmm0,eax). Both GPR and
memory-source forms now convert signed i32 with default nearest-even rounding
and preserve the upper96 XMM bits; 80-case scalar SSE suite passes. MXCSR
rounding/exception state is still not modeled by this SSE subset.

Next D3DX original `0x00429fc1`, runtime `0x02551fc1`, calls device slot38
GetRenderTarget (`+0x98`) then surface slot12 GetDesc (`+0x30`). The getter now
returns the existing render target through its stable Surface9 wrapper with a
caller reference; GetDesc reports the canonical surface dimensions/format.
Compiled identity/reference-count/output-boundary tests pass.

The genuine run passes those queries, then a native DLL at `0x037bca25`
requests ConvertDefaultLocale(LOCALE_USER_DEFAULT=0x400). API3355 now converts
the user/system aliases to the existing emulated en-US locale and preserves
other identifiers and LastError. Thread-locale regression verifies this is
independent of the caller's SetThreadLocale setting.

Further startup continuation (2026-09-09):

- D3DX original `0x0042c58d` requests GetFontLanguageInfo. The API now derives
  legacy kerning/codepage flags from the selected font's actual tables;
  stock bitmap fonts report no shaping flags. Public GDI regression passes.
- Game `0x00937040` requests CreateQuery(EVENT=8). A retained Query9 object now
  implements identity, lifetime, Issue(END) and GetData. Issue uses a real
  synchronous GPU completion barrier; no asynchronous polling performance is
  claimed. Unsupported query kinds return NOTAVAILABLE. Compiled API tests and
  the genuine browser GPU pipeline test verify the barrier and rendered pixels.
- An apparent normal exit was actually a null indirect call at `0x0051f024`:
  GetProcAddress(AddFontMemResourceEx) had returned zero. The game decrypts an
  embedded font into temporary memory, registers it, then frees that buffer.
  Memory font APIs now copy single-face glyf TrueType data into the existing
  face cache, select it privately without enumeration, and unregister by a
  validated handle. Removed faces remain in the existing bounded process cache
  for live realizations; cache eviction, TTC and CFF are not implemented.
  Tests overwrite the source and rasterize the retained copy.
- Next apparent exit was a missing suffix in LoadLibrary's lookup of
  `.\\PlugIns\\ScriptLibraryR`. The supplied DLL already exists in the asset
  manifest. WAT now appends `.dll` when the basename has no extension, and
  honors trailing-dot suppression. The real DLL loads at `0x03801000` and its
  script exports resolve; no script-engine substitute is used.
- Next CPU trap `0x005fdde2` is the prefixed instruction starting at
  `0x005fdde1`: `F3 0F 2D C1`, CVTSS2SI eax,xmm1. Register and four-byte memory
  forms now implement default nearest-even conversion with the x86 indefinite
  integer for invalid/overflow values. The scalar suite passes104 cases.
  Non-default MXCSR modes remain outside the current SSE subset.

Diagnostic logs: `/private/tmp/black-white-exit-trace.log`,
`black-white-memory-font.log`, `black-white-script-library.log` and
`black-white-cvtss2si.log`. All use the genuine extracted files and the explicit
programmable-GPU profile. Menu and gameplay are still **not verified**.

The local Microsoft `binaries/explorer98/dlls/ole32.dll` (4.71.2900) identifies
CoFileTimeToDosDateTime as ordinal23, VA`0x7ff8b556`. Disassembly validates an
8-byte source and two 2-byte output pointers, then calls KERNEL32's
FileTimeToDosDateTime via IAT`0x7ff213a8`. BW2 imports this **by name**; hint25
is not its ordinal. The new wrapper follows that delegation, with compiled
date-range/leap-day/output-boundary/invalid-pointer tests. Genuine startup now
passes `0x0091ee3c`, starts its worker threads and loads additional resources.

Next missing import is GetKeyNameTextW at`0x0064b860`. The bounded UTF-16 wrapper
shares the existing ANSI US scan-code names and has truncation/terminator/ESP
coverage. It inherits that mapper's incomplete extended-key/localization scope;
this is not a complete keyboard-layout implementation. Current diagnostic logs
are `/private/tmp/black-white-co-filetime.log` and `black-white-key-names.log`.

The key-name run passes that initialization and reaches D3DX runtime
`0x025fa277`, original`0x004d2277`. The call at original`0x004d2294` is
`call [esi+0x64]`: device slot25 **CreateCubeTexture**, not another 2D texture
getter. Measured size128, levels1, format21 (A8R8G8B8). Cube resources and cube
sampling are not implemented: the shader compiler currently declares only
sampler2D, and the shared GPU texture interface only uploads TEXTURE_2D.
Next work must cover six face/mip stores, CubeTexture9 identity and surface
aliases, plus cube sampling through the shared backend with pixel tests.
Do not alias a cube to one 2D face or advertise cube support before that works.

Cube continuation (2026-09-09): APIs3369..3390 now implement the 22-slot
CubeTexture9 interface (private-data/autogen operations still fail loudly).
Six independent face/mip stores share locks with retained Surface9 aliases.
The shared GPU backend supports cube upload/binding; shader TEX specialization
uses the bound resource type. Compiled storage/identity/lock/lifetime tests and
actual browser pixels pass for all six faces, lower LOD, return to 2D, and
mixed 2D/cube samplers in both orders. Default shader capabilities are unchanged.

The genuine run now passes cube creation and finishes Greek model preloading.
It then stops at EIP0, without ExitProcess: captured stack return0052679a
identifies game00526795 calling0091ec50, whose tail jump reads a null file
object at +4 then its vtable slot12. The preceding file-open operation requests
data/art/textures/logo.png, which exists in the extracted MainApp tree.
Its open/allocation failure is not yet diagnosed. The trace also contains many
DXT1 (31545844) and DXT5 (35545844) CreateTexture requests; those formats remain
unimplemented and are rejected, not silently accepted. A late ReadFileEx has a
null destination, suggesting allocation pressure, but that is not yet a proven
cause of the logo failure. Logs: /private/tmp/black-white-cube.log and
black-white-cube-stop.log. No menu or gameplay has been verified.

The focused file-loader trace resolves that failure: CreateFileA returns
700000bc and GetFileSize returns00060af6 for logo.png. CreateFileMappingA
returns fb000078, but MapViewOfFile returns0 at00925086. At exit the live map
count is410 and backing cursor1bffa000 is only24KiB below its1c000000 limit.
That is backing exhaustion, not a missing path or DLL export.

Mapping lifetime audit found UnmapViewOfFile deleting JS view metadata without
releasing its guest allocation; failed async provider fills leaked unpublished
allocations too. The matching guest_map_free export now releases those sparse
views (not HeapFree), and invalid/double unmaps fail. Non-top virtual releases
leave holes, so the commit allocator now searches live backing extents for a
non-overlapping gap only when the bump cursor cannot satisfy a request.
It preserves live addresses and the high-water cursor and zeroes reused bytes.
Tests cover1100 real map/release cycles, non-top gap reuse, retained live bytes,
consecutive non-overlap, writeback, async failure cleanup and cross-instance
reservations. The fixed512MiB total /320MiB backing layout is unchanged.

Diagnostic caveat: black-white-unmap.log and black-white-map-reuse.log still
used the preceding compiled browser artifact; they are not post-fix acceptance.
The canonical rebuilt pair is1072381/1072841 bytes; the follow-up run is
/private/tmp/black-white-map-reuse-built.log.

The rebuilt run **passes** the logo map:00925086 returns385a0000, then native
D3DX processes PNG data. At the next stop there are130 live mappings totaling
169906176 bytes (about162MiB); no memory-layout expansion was needed.
New stop00526cf0/return00526d1d is call [ecx+0xc0] at00526d17,
device slot48 GetViewport. Viewport now has real24-byte Get/Set state,
initial full-target dimensions, bounds/depth validation, and immutable GPU draw
snapshot lowering. The browser pipeline verifies default values, preserved
state after an invalid setter, cropped rendering, and untouched outside pixels.
Viewport state-block recording remains explicitly unsupported.

Viewport continuation reaches D3DX original0042aa4a (runtime02552a4a):
device slot79 SetNPatchMode(0) while recording the sprite state block.
The old recording guard trapped even on disabled mode; the old getter also
incorrectly returned its FLOAT in EAX. The linear-only backend now accepts
disabled mode (+0/-0), including recording, rejects every nonzero/NaN request
with NOTAVAILABLE, and returns GetNPatchMode through x87 ST(0). This does not
implement or advertise N-patch tessellation. State-block and FLOAT/ABI tests
pass. Diagnostic log: /private/tmp/black-white-npatch.log.

The next sprite-recording calls are SetIndices(NULL) at D3DX0042ac53 and
SetStreamSource(0,NULL,0,0) at0042ac63. Both now use real selective state-block
buffer capture rather than the previous recording guard: last write wins,
stream offset/stride are copied, retained buffer references transfer and
release correctly, and invalid writes preserve prior recorded state.
Compiled tests cover non-null replacement, Capture/Apply and release lifetime;
this is not a NULL-only bypass. Build1073008/1073468 passes canonical gates.

The subsequent black-window loop actually calls SetVertexShader(NULL) and
SetPixelShader(NULL), followed by DrawPrimitive and DrawIndexedPrimitiveUP.
Those were rejected before GPU submission. The new bounded fixed-function
compiler consumes real state snapshots through the shared GPU backend; no
failed guest shader is replaced. WAT-to-browser tests verify world translation,
textured diffuse modulation, POSITIONT coverage and alpha rejection. Build
1072939/1073399 passes the canonical gates; state-block regressions also pass.
The first run (/private/tmp/black-white-fixed.log) still has a black final frame,
with missing-texture and incomplete-mip-chain errors. Two follow-up corrections
implement documented null-COLORARG1-texture cascade termination and one-level
LOD clamping (non-mip filtering, not generated texture data). Pipeline tests pass.
Fresh follow-up log: /private/tmp/black-white-fixed2.log. Gameplay is unverified.

The error-free follow-up remains black. Observational draw snapshots identify
a raster bug: TL/TR/BL POSITIONT strips (white diffuse, valid viewport, z0,
cull3) write zero colored pixels. The backend selected GL_CCW as its front
face, discarding the clockwise sprites D3DCULL_CCW must keep. It now selects
GL_CW; browser regressions explicitly verify both culling modes on the same
screen-space triangle. Genuine follow-up: /private/tmp/black-white-culling.log;
indexed-sprite snapshots are being checked too. No menu acceptance yet.

Corrected-culling snapshots confirm480000 colored pixels in800x600 after
the loading strip, and later indexed sprites write pixels too. Completed
presentation canvases also contain480000 colored pixels while the whole-window
screenshot is black (/private/tmp/black-white-presentation.log). Renderer
exclusive composition skips windows with no _backCanvas; this GPU-only client
does not request a GDI canvas. D3D9 bridge initialization now asks the existing
renderer.getWindowCanvas owner to create that normal backing once. It does not
create another compositor or reuse the live GPU context as a window surface.
Pipeline regression verifies that acquisition; genuine follow-up is
/private/tmp/black-white-compositor.log.

That backing acquisition alone does not fix display. The remaining concrete
notification bug is D3D9 Present assigning renderer.needsRepaint, which no
renderer code reads. Present now calls renderer.scheduleRepaint, preserving
the normal deferred/Worker-safe publication path. Pipeline tests assert exactly
one compositor scheduling request per completed Present. Fresh window probe:
/private/tmp/black-white-repaint.log. The earlier backing-only explanation was
incomplete; neither a colored GPU buffer nor a Present count proves display.

The corrected repaint run visibly renders the genuine Lionhead Studios particle
intro. Screenshot personally inspected:
/private/var/folders/dz/1fqkk_jd4350qkm91pm9_q3c0000gp/T/black-white-browser-DqPoHR/frame-3.png.
This is the first verified visible game-rendered scene, not gameplay or a menu.
The probe now accepts explicit timed browser key/click inputs (BW2_INPUTS);
the next run sends Escape at50/70 seconds to attempt normal intro skipping.
Log /private/tmp/black-white-menu.log; no guest-state patching.

Escape/Space and a real browser click do not skip the intro in180-second probes;
the particle animation is still visibly advancing (npCxjk/final.png). Keyboard
events log hwnd0 whereas mouse events target10001, so skip-key delivery is not
yet proven. Do not classify an animating slow intro as an infinite loop merely
from elapsed wall time. DXT1/DXT5 are now real compressed sampled resources:
block-row allocation/pitches/locks and small mip tails stay compressed, while
the upload snapshot decodes RGB565 and alpha selectors. CPU/compiled tests and
WAT-to-GPU pixels pass. A concurrent authorized main merge preserved the dirty
work and changed the base layout; canonical build now1073704/1074165,
layoute5ea7699f58899e4,source306. Fresh420-second run:
/private/tmp/black-white-dxt.log. No menu/gameplay claim.

The intro loop is005260e0, per-frame simulation/render00526cf0. It increments
object+20 once per frame; object+0 becomes636 in the observed run. At00528141
the fade starts only after frame > target+350, then object+28 rises until >255;
00529421 sets object+24 = currentFrame+500, and0052943b returns completion only
after that frame. Escape is not tested by this loop; mouse and arrow keys alter
its particle interaction instead. This is a frame-count animation, so a few FPS
means many minutes. Read-only BW2_INTRO_TRACE captures the object from ESI at
00526d93, avoiding a hard-coded guest stack allocation.

However,420-second runs stop submitting frames at1000 (DXT run) or953
(counter run, introFrame918, target636, finishFrame-1, completion0). CPU still
executes00868xxx/008c6xxx animation evaluator code. That is not evidence that
the intro returned; the earlier beyond-intro inference from EIP alone was
premature. A600-second follow-up includes calling-stack observations:
/private/tmp/black-white-intro-stack.log. No runtime clock or game state patched.

The600-second stack run stops at introFrame655. Actual saved return addresses
0052618d and00526198 put execution in the100ms catch-up loop, not intro teardown.
GetSystemTimeAsFileTime was multiplying ticks by10000 and adding the epoch using
i32 arithmetic, then writing a constant high DWORD. Consequently its reported
time jumps backwards whenever the low DWORD wraps (~429.497 seconds); the game's
unsigned elapsed-time loop then attempts an enormous number of updates. The API
now uses an unsigned tick extension and i64 multiply/add/store, preserving the
existing simulated epoch and clock source. test-system-filetime covers the exact
first carry boundary, subsequent carries, signed tick bit, one clock sample,
output bounds and stdcall. It passes, as does the corrected real-device NULL
shader test. No guest clock scaling, animation counter or binary patch is used.

BW2_INTRO_TRACE also counts catch-up iterations00526185 vs render-loop0052619d
and samples the game's elapsed milliseconds0177cb18. This can distinguish normal
slow animation from a new enormous-delta catch-up. Keyboard hwnd0 is the renderer's
normal key-event route, not evidence of an input-routing fault; this intro does
not check Escape. A fresh long run is needed to establish progression after the
FILETIME fix; no menu/gameplay acceptance yet.

## Software-worker launch integration (2026-09-10)

The first current-source software CLI probes use all MainApp assets and the
three explicit DLL seeds above, `--d3d9-renderer=software --d3d9-programmable`,
`--batch-size=200000 --real-ticks --max-seconds=45`. Diagnostic artifacts are
`/private/tmp/bw-software-integration.DqstAK/wine.wasm` and its compat pair
(1098688/1099156 bytes, layout f73bfdc3f7f38137). They compile current sources;
the full canonical build still stops at unrelated stale toy-VM browser bundles.

Both ordinary and trace-yield probes stop after 288 batches with `STUCK` at
thunk07503488, return00a4da46. Disassembly confirms call00a4da40 is device
slot81 DrawPrimitive (`+0x144`), triangle strip5, start0, count2. The CLI stuck
detector lacks an exemption for outstanding render waits, although it exempts
controlled sessions; consequently the passing controlled worker smoke does not
prove ordinary launch behavior. A scheduler correction and uncontrolled test
are in progress. This observation does not prove a worker deadlock or gameplay.
Logs are `run.log` and `scheduler.log` in that diagnostic directory. A bounded
follow-up raises only the diagnostic `--stuck-after` threshold to1000000;
`extended-wait.log` will distinguish a false stop from actual renderer errors.

The raised-threshold follow-up does continue submitting real draws. It reports
`D3D9 software: only bounded triangle lists are implemented`, followed by
`D3D9 software: blending is not implemented`. These are explicit renderer
implementation gaps, not a silent successful rendering path. Strip/fan
normalization is now the next adapter task; native blending remains required.
This progression supports the false-stop diagnosis, but no visible gameplay
has been verified.

Strip/fan and native blending integration follow-up:
`/private/tmp/bw-blend-integration.FJ1QzJ/wine.wasm` (1100883 bytes) and its
1101351-byte compat pair compile the new native blend stage and defaults.
`run.log` no longer reports the strip/blend rejections, but the personally
inspected 800x600 `frame.png` is solid white. That run reaches its100000-batch
limit; its CLI summary prints the configured60-second budget as elapsed time,
so the summary must not be used as a performance measurement.

`timed.log` instead uses100000000 max batches and a45-second wall guard, plus
the diagnostic raised stuck threshold. Its more precise backend error is
`fixed-function features are not implemented: alphaTest` (14 occurrences),
not lighting/fog/specular. It starts five guest worker threads. `timed.png` is
byte-identical to the inspected white frame. Alpha testing is the next native
pipeline task; this is not menu/gameplay acceptance. Software triangle, blend
and worker unit results alone did not predict this real-game blocker.

Alpha-test integration follow-up: current-source diagnostic pair
`/private/tmp/bw-alpha-integration.jT7BVd/wine.wasm` and `.compat.wasm` are
1101235/1101703 bytes. The45-second wall-guard run ends at309117 batches with
no renderer error lines. Both programmed and NULL-shader draws now receive
native alpha-test state; a low8 reference and comparison are copied before
execution and applied before color/blend/depth writes. The personally inspected
800x600 `frame.png` is predominantly white with one faint yellow spot near the
lower center, rather than the preceding completely white frame. This proves
changed rendered output, not recognizable intro completion, menu or gameplay.
The same five guest workers are present. Logs remain in that directory.

Ordinary CLI wait follow-up: `normal-wait.log` in the alpha-integration directory
uses the same assets/build and no `--stuck-after` override. After the live render
request exemption, it reaches the20-second wall guard at312228 batches without
STUCK. Stats now reports measured execution20.009s rather than a configured
deadline. `test-cli-elapsed-time.js` independently checks the timing correction.
No image was captured in this run; it establishes continued execution, not
visual progress or gameplay. A separate production-worker strip benchmark found
most default draw wall time spent waiting between256-quad timer callbacks;
bounded scheduling improvements are in progress before the next game capture.

Bounded worker batching follow-up: `/private/tmp/bw-slice-integration.4NVoSq/`
contains current diagnostic1101707/1102175-byte Wasm artifacts, `run.log` and
`frame.png`. The ordinary run uses unchanged256-quad native steps grouped into
4ms/64-step worker callbacks, no stuck override and a45-second wall guard. It
ends at22872 batches in measured45.007s and now reports repeated unsupported
single-level2D texture and primitive topology errors. This is additional failing
draw coverage, not evidence that batches/s measures game speed. The inspected
640x480 capture is still white with a faint yellow spot; no gameplay. Capture
the failing texture and primitive descriptors next before selecting mip/cube or
point/line implementation work. The matching synthetic worker benchmark has
identical output before/after batching, but does not establish real-game parity.

Parameter diagnostic follow-up: the old topology error was misleading. The
actual rejected draw is triangle LIST4 with2950 primitives, exceeding the
adapter's256-primitive limit; it is not a new primitive topology. The rejected
texture is stage0,1024x1024,11 mip levels,0 cube faces. `parameters60.log` records
these values after enriching the existing errors; the preceding30-second run
ended before reaching this phase. Next work is ordered large-draw batching and
real mip-chain sampling, not a point/line or cube workaround. The software
adapter regression now distinguishes capacity failures from topology failures
and checks texture diagnostic fields while preserving allocation ownership.

Large-draw plus mip integration run: `/private/tmp/bw-mip-integration.nWAYwR/`
contains diagnostic1104018/1104486-byte Wasm pair and `run.log`/`frame.png`.
The ordinary60-second launch ends at24379 batches in measured60.019s, with no
renderer errors or STUCK report. The inspected800x600 frame remains white with
a faint yellow spot. Load average was9.16 at launch, so this is not a performance
comparison. No completed-draw/intro-counter capture was collected here; absence
of the previous errors alone does not prove equivalent game progression.
The exact1024x1024 eleven-level shape independently passes software implicit-LOD
pixel tests, and2950-triangle real x86 COM/worker tests pass. Next capture must
record completed draws and intro state alongside images. No gameplay acceptance.

Controlled software probe50895 provides stronger evidence. Artifacts are
`/var/folders/dz/1fqkk_jd4350qkm91pm9_q3c0000gp/T/bw-software-probe-65NV0y/`.
By60s of its observed attachment window it records168 completed draws and80
completed presents, zero submission failures, and one outstanding draw. At55s
the draw categories change from two loading strips per frame to textured lists
of2/2950/8 triangles using1024x1024 eleven-level textures. The inspected final
640x480 image visibly shows LIONHEAD STUDIOS with falling particles and reflection.
This establishes the software intro, not menu/gameplay or backend parity.

`tools/black-white-software-probe.js` uses the existing CLI control channel,
Bridge submission promises and EIP tracing without modifying guest state. Its
first run falsely reported traceHits0 because its address regex accepted at most
one leading zero; actual logs contain three00526d93 hits with ESI074d6bdc. The
parser is corrected; that observed stack address must not be hard-coded into
later probes. Frozen mode was rejected with real ticks, so the tool attaches to
an ordinarily running real-time guest and explicitly measures only that window.

Longer probe23014 (artifacts `bw-software-probe-pnliVq` under the same temp root)
exposes a lifetime failure after initial success. At75s introFrame1/target636 is
observed; by85s/frame5 native raster creation begins failing. Successful DRAW
completions stop at181 while Present and intro counters continue. At120s the
intro is frame62, but346 submissions have failed, including explicit native
allocation failures. This is not healthy progress toward gameplay.

Focused reproduction: `node test/test-d3d9-large-draw.js --stress-mips` repeats
2950 triangles with the1024x1024 eleven-level chain. Run8381 fails at iteration24;
adapter-owned bytes return to512 after each prior draw and all tracked native
contexts are freed, yet sparse heap reservations advance by roughly12MB per
iteration. Current heap allocation uses first-fit splitting and heap_free only
prepends blocks, without coalescing. Fragmentation is the next hypothesis to test
with native free-list inspection/coalescing; accounting returning to baseline is
not proof that the allocator can reuse the storage.

Follow-up: the primary leak was missing sparse inverse translation in `w2g`.
Native WASM-pointer frees therefore supplied an unrelated guest address and were
silently rejected by heap validation. Fixed and verified by actual sparse reuse
in `test-d3d-render-lifetime.js` (51141/20572). Stress93161 now completes32frames
with stable memory after warm-up. Disabling the idle coalescer (41282) passes32
frames but accumulates fragmented free blocks (494->6661), so both inverse
translation and coalescing are retained. These are allocator/render regressions,
not yet evidence that a fresh real-game run progresses through the intro.

Fresh post-fix probe62767 completed180s using diagnostic build
`/private/tmp/bw-native-reuse.5Xjp7I/wine.wasm`. Artifacts:
`/var/folders/dz/1fqkk_jd4350qkm91pm9_q3c0000gp/T/bw-software-probe-frxgg9`.
At the final sample: introframe43,414 completedDRAW,123 completedPRESENT,
zero submission failures, queue627/627 completed. The inspected final image
shows Lionhead logo, particles and reflection. Successful rendering continues
beyond the old frame5 allocation failure; no menu/gameplay yet. Initial load
average82.53 makes this unsuitable for performance comparisons. No guest intro
counter or clock patch was used.

Long-run probe20567 completed its1800-second observation window successfully.
Frozen native artifact: `/private/tmp/bw-long-native.IxWKnd/wine.wasm`;
artifacts: `/var/folders/dz/1fqkk_jd4350qkm91pm9_q3c0000gp/T/bw-software-probe-WjjGiJ`.
The final sample records introframe560/target636,3514 completed DRAW commands,
563 completed PRESENT commands and zero render failures. One draw remained
pending at sampling, before normal shutdown. This demonstrates sustained intro
rendering, not menu/gameplay. The helper now permits an explicit observation
window up to14400 seconds so later runs can reach beyond the full intro without
patching guest counters or clocks. New source requires a fresh matching native
artifact; this run does not validate subsequent shader/stencil/Reset changes.

The ongoing7200-second probe93079 uses the frozen
`/private/tmp/bw-stencil-native.LHj3DN/wine.wasm` artifact and
`bw-software-probe-pOr4aX` capture directory. At2665seconds it reaches
introframe692,4302 completedDRAW and771 completedPRESENT withzero failures.
Live control ping confirms the same process is running. Frame2163.png was
personally inspected: Lionhead particles/logo/reflection, not gameplay. Passing
the recorded target636 does not imply completion: the existing disassembly
above places fade onset after986, then requires the fade threshold and another
500frames. Do not restart or patch the healthy run merely for crossing636.

Later in the same live run, at3839seconds/frame1049, the fade/completion field
is53.54997 rather than zero, and the draw categories include10-triangle lists
instead of only8-triangle reflection draws. All9682 submitted commands have
completed withzero failures at that sample. A subsequent control ping confirms
the same process live atframe1052/fade56.09997. Frame3844.png was personally
inspected: the logo changes orientation and fades, but this remains the intro.
This confirms real progression beyond the documented fade threshold; no guest
animation state or clock has been patched.

Probe93079 is now terminal0 after its7200-second guard and graceful controlled
quit; do not treat it as live or send further input. Intro counter reached1787
against finishFrame1786. The final sample records45985 completedDRAW commands,
53558 completed queue commands andzero failures (one draw pending at sampling).
The final `bw-software-probe-pOr4aX/frame.png` was personally inspected: a
cloud-covered island backdrop with a central panel, empty-looking text fields,
up/down controls and bright polygon artifacts. This is visibly beyond the
Lionhead intro, but neither readable menu text nor interactive gameplay is
verified. New draw categories include1280x960,1024x1024 and256x256 textures.
The run still used frozen `bw-stencil-native.LHj3DN/wine.wasm` and startup-loaded
JS, predating the later POSITIONT precision/coverage correction, PSIZE and
multi-stage work. A fresh matched artifact is required before attributing the
panel corruption to current source. No guest counters or clocks were patched.

Follow-up probe33057 uses `/private/tmp/bw-cascade-native.Ca0YQN/wine.wasm`
with startup-loaded JS including the POSITIONT correction. At4553seconds its
intro reaches1787/finish1786 with16323 commands complete and no render failures.
At4660seconds new post-intro draw categories are active. Live controlled capture
`/private/tmp/bw-postintro-scene.png` was personally inspected: cloud-covered
island, central panel with unreadable text and bright polygons remain. Thus the
POSITIONT correction alone did not resolve this panel corruption. This frozen
artifact still predates later cascade operations, transforms and fog work;
the image is not evidence against all current source. Preserve the live run
for inspection; no guest counters or clocks were patched, gameplay unverified.

The same live run now has a bounded neutral-command capture, armed through its
existing eval control with `tools/d3d-command-capture.js`. Artifact:
`/var/folders/dz/1fqkk_jd4350qkm91pm9_q3c0000gp/T/d3d-command-capture-XfJrDb/frame.v8`.
One Present-to-Present interval contains17 DRAW commands plus PRESENT,
77,634,825 serialized command bytes. Capture restored the original submission
hook after completion. It preserves typed arrays/nonfinite values and copied
shared-memory inputs; completion means capture boundaries, not GPU fences.
It does not snapshot the initial color/depth buffers or earlier resource
commands, so replay equivalence must verify those dependencies explicitly.
Draws0–8 include POSITIONT textured strips; later XYZ triangle lists include
empty texture arrays despite stage0 MODULATE/TEXTURE state. This is observed
binding data, not yet proof of which draws are glyphs or why textures are absent.
The capture enables inspecting/replaying the actual panel submissions without
restarting the healthy guest or waiting through another intro.

Current WebGL2 replay32433 of that capture completed17 draws without GL errors.
Tool: `node tools/d3d-replay-web.js CAPTURE/frame.v8 OUTPUT.png`.
Output `/private/tmp/bw-replay-webgl.png` was personally inspected at its native
800x600 size: the same unreadable central panel and bright polygons occur.
This reproduces the defects with another executor using the captured inputs;
it points away from an exclusively software-rasterizer defect, not toward any
particular frontend cause yet. Replay starts with transparent color and no
prior depth history; it is not a pixel-identical whole-session comparison.
The host texture loop omits a stage only when its canonical bound pointer is
zero; invalid nonzero resources throw rather than silently disappearing. The
captured untextured XYZ lists use repeated quarter-atlas UV rectangles and
varying 3D positions, consistent with sprites/particles rather than proven
text glyphs. Determine their binding provenance separately from missing text.

Current software replay47696 completes the same17 draws. Comparing with WebGL
initially found479666 alpha differences but only1 RGB pixel beyond tolerance2.
Source inspection found WebGL ignored `state.colorWriteMask`; applying
COLORWRITEENABLE per draw fixes that independent compatibility bug. All16 masks
plus invalid-mask/no-pixel-change pass on WebGL1/2 in regression76707.
Replayed WebGL32402 versus `/private/tmp/bw-replay-software.png` now differs
beyond tolerance2 in just1/480000 RGBA pixels (max33, coordinate310,325).
Both still show the unreadable panel and bright particle polygons. This makes
the captured shared draw data/frontend path the next investigation, not a
software-only rasterization explanation. Exact pixel parity is not claimed.

Post-checkpoint investigation on the same live33057 process: the captured
1024x1024 UI atlas (draws2/8) was decoded and personally inspected. Its baked
promotional text is readable, and the panel rectangles are intentionally blank;
the thin divider lines in the menu are present in the source atlas, not damaged
glyphs. No separate glyph-texture draw appears in this captured17-draw interval.
Artifacts `/private/tmp/bw-texture-2.png` and `bw-texture-8.png` are diagnostic
extractions from the immutable capture, not native-Windows references.

Microsoft native `d3dx9_25.dll` disassembly identifies the font constructor at
original0042d202, vtable00401580, and DrawTextA/W entries0042f263/0042f29c.
Both call internal0042d8f7 (runtime025558f7). Existing live EIP tracing confirms
that internal routine executes repeatedly with font object4ed795cc; its common
exit0042ef76 is reached with EDI0 (success). The current process has two loaded
TrueType faces of34044 and134188 bytes. These observations do not prove glyph
generation or successful rendering.

Native global original006298d4/runtime027518d4 reads1, selecting the Uniscribe
branch in DrawText; original006298ac/runtime027518ac reads0. Therefore the
fallback GetCharacterPlacementA/W calls at0042e14e/0042e156 are not the first
path to investigate. Follow the native shaping results and glyph-cache/texture
submission boundary next. No Wine implementation source was used; the DLL
addresses come from the supplied Microsoft binary. Temporary EIP ranges were
restored to the original intro probe range00526d93–00526d97 afterward, without
changing guest animation state or restarting the healthy process.

The next inspection found valid shaped glyph IDs/positive advances, but the
first six cached glyph records reached through font+0x550 all start with
FFFFFFFF followed by zero geometry. Native D3DX0042d32c marks that sentinel
at0042d468 when its measured glyph advance is zero. On the Win9x branch it
uses MoveToEx, ExtTextOutA(options12hex, NULL rectangle, one WORD glyph index),
then MoveToEx to retrieve the updated current position. Our text compositor
rejected the NULL opaque rectangle and did not implement direct glyph indices.
This explains the observed empty-cache path; fresh corrected game rendering
is still required, and cached failures in the old live process are not patched.

Native Win98 oracle `gdi-exttextout-glyph` now covers32 A/W, character/glyph,
NULL/supplied rectangle and options0/2/4/6 combinations. With Arial height-16,
GCP maps A to glyph36; every case returns1, advances CP to(11,0), and draws28
nonblack pixels. Thus Win98 accepts NULL rectangles with OPAQUE/CLIPPED and
renders ANSI WORD glyph indices. This differs from the current Microsoft
[ExtTextOutA documentation](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-exttextouta)
describing ANSI glyph-index calls as a no-op; do not substitute that behavior
for the measured Win98 contract.

Reproduce with `node tools/v86-reference/capture.js --online --manifest
tools/v86-reference/glyph-apps.json --app gdi-exttextout-glyph --serial-output
/private/tmp/win98-exttextout-glyph.serial` (one command). Capture54317 exited0
at2026-09-11T00:46:45.542Z using the pinned v86 Win98 image. Probe EXE SHA256:
`d6cdcb6a24f744b80d743484f1133412932fe38ac443f43a07c744527a8c6c6c`.
Generated metadata is `screenshots/v86-reference/generated/gdi-exttextout-glyph.json`;
serial transcript has32 CASE lines and EXTTEXTOUT_GLYPH_DONE. Source probe and
isolated manifest are tracked candidates; no Windows binary is added.
Null-rectangle normalization and direct TrueType glyph-index rendering are
implemented using the existing native cache and shared text compositor.
The glyph regression covers A/W WORD inputs (including indices above255),
current-position advances, PDY, clipping, path recording and invalid indices.
Bitmap-font indexed output remains explicitly unsupported.

The standalone native D3DX integration probe now verifies the complete font
path, not just GDI: `node tools/d3dx-font-probe.js --dll=/path/to/d3dx9_25.dll
--wasm=/path/to/wine-assembly.wasm` (one command). It executes the supplied
Microsoft DLL's CreateFontA/DrawTextA, uploads its glyph texture, and checks the
software worker's canonical320x160 frame. Baseline75148 exited the guest
successfully but failed acceptance with zero white pixels and51200 blue pixels.
Corrected run12873 passed with863 white pixels and50337 blue pixels; its PNG
was personally inspected and shows readable white “Black & White 2” text.
The actual browser guest/WebGL2 probe31600 also passes with863 white pixels,
50337 blue pixels and GL error0; its PNG was personally inspected and shows
the same readable text. Reproduce using `node tools/d3dx-font-web-probe.js
--exe=/path/to/probe.exe --dll=/path/to/d3dx9_25.dll --wasm=/path/to/current.wasm`
(one command; the software probe builds the fixture EXE). The harness observes
the real backend's target at Present, before normal guest teardown. Initial
browser attempt2860 selected Notepad due to the global launch wrapper ignoring
arguments; corrected harness selects its explicit registry entry instead.
Full canonical/compat build15499 and repeated software font85829 pass after
concurrent main merges. These are focused native-DLL integration results, not
proof of fresh full-game menu/gameplay. No guest cache was patched.

Fresh current-artifact game run98750 was started after checkpointad3ba44b, using
`/private/tmp/bw-glyph-current.pohQXb/wine.wasm` (1141556 bytes). It is independent
of the preserved old33057 process whose native glyph cache already contains
failures. At587 seconds the new run reaches intro frame105, with785 completed
draws and zero reported renderer failures; menu/gameplay acceptance is pending.
Artifacts: `bw-software-probe-DLH67d` under the host temporary directory. This is
a progression observation, not a throughput benchmark (launch loadavg39).

Local Candidates now includes `black_white_2_demo` (Black & White 2 Demo).
The prepared MainApp tree is copied to the ignored local corpus directory
`test/binaries/win98-games-a-d/Black and White 2-DX9-D3D/installed/`;
`node tools/gen-win98-games-a-d-manifests.js` inventories its363 companions.
The entry seeds the same three native DLLs as the CLI probe and opts into the
experimental programmable profile for this app only; renderer selection stays
user-controlled (`?d3d9-renderer=software` for software, WebGL by default).
CLI: `node test/run.js --app=black_white_2_demo --d3d9-renderer=software`.
This registers the extracted game, not an installer-success or gameplay claim.

Progression update: current-font run98750 remains live, reaching intro frame1513
at5947 seconds with finishFrame1786 and zero reported renderer failures.
`frame-5941.png` was visually inspected: complete Lionhead logo/reflection, not
yet the menu. Older pre-font-fix run33057 is now authoritatively terminal with
exit0; its recorded final intro frame1787 and cached missing-glyph state are
historical evidence only. No restart or guest-state patch was used.

Current-font run98750 has now passed intro frame1786 and reached the profile
creation menu. Personally inspected `frame-7320.png` shows readable “Select
Profile”, “New Profile Name”, “Close”, and the main menu labels over the island
background. At7331 seconds the renderer reports20665 completed draws and zero
failures. This proves the glyph fix reaches the real game's menu, not just the
standalone font probe. Profile selection and changing gameplay remain unverified;
the frozen executable artifact predates lighting/cache/scissor checkpoints.

The same run98750 is now terminal (CLI exit1), not waiting for more input.
Holding Return was accepted at batch591383; at batch591475 the real profile-name
encoding loop called unimplemented `PathGetCharTypeW(0x50)` and trapped.
The call site is00857c90 (`push eax; call ebx`), return00857c93, then `test al,1`:
valid long-filename characters are copied directly; others take the formatting
branch at00857c9e. The preceding sample reports93956 completed draws and zero
renderer failures. Thus keyboard input reaches profile processing; this is not
evidence of gameplay or of a renderer failure. Earlier mouse motion550,400
mapped to native687,500 (640x480 presentation of800x600 window), drained its
queue, and did not visibly dismiss the profile dialog. No guest state was patched.

`PathGetCharTypeA/W` is now implemented from Microsoft's API contract and the
supplied native `test/binaries/explorer98/dlls/shlwapi.dll`, version5.00.2614.3500,
SHA256 `731b1ffdcb821a87e8ef1aa92fc956a0c385eaa6b8f4ad20c89db8b923f1aeae`.
Exports485/486 are70bdde1d/70bf16c2. Native disassembly classifies controls0–31,
quote, less/greater-than and pipe as0; space/comma/semicolon as1; star/question
as4; slash/colon/backslash as8; all remaining BYTE/WORD inputs as3. These are
character flags, not whole-filename validity; do not impose separate DOS name
rules on plus, equals, brackets, DEL or high Unicode values. A truncates toBYTE,
W toWORD, with no codepage conversion. `test/test-path-get-char-type.js` passes
both entry points over the entire65536-value domain, upper-bit truncation and
stdcall cleanup. This is a disassembly-derived fixture, not a native execution
oracle. A fresh game run with this implementation remains required. No Wine
implementation source was used.

Fresh frozen run24571 now verifies that progression: snapshot
`/private/tmp/bw-path-char.ly0IRU/wine.wasm` contains the PathGetCharType fix,
and `/private/tmp/bw-path-current-screen.png` shows the profile-creation dialog.
Normal Return down at batch224427 and up at224621 closes it without trapping;
`/private/tmp/bw-path-after-profile.png` shows the island main menu headed
“Player”. Renderer completions continue with zero reported failures. This is
successful profile creation, not gameplay. This frozen snapshot predates the
later backbuffer-lock/ownership and programmed-VS pixel-center checkpoints.

A synthetic click at155,445 was accepted at225653, but a later capture
`/private/tmp/bw-path-new-game.png` still shows the same main menu. A held mouse
down at those coordinates was delivered at226972 to distinguish short-click
polling from menu behavior; mouse-up was delivered at228211. A later settled
capture at229794 (`/private/tmp/bw-path-settled-new-game.png`) still shows the
main menu, so neither click variant proves New Game activation. No key or mouse
button is left held by these controls. The
live probe remains24571 with artifacts under `bw-software-probe-8o44XX` in the
system temporary directory. No guest state or instruction stream was patched.

Buffered-mouse investigation on the same frozen run24571: a temporary,
return-value-preserving wrapper around `renderer.getMouseButtons` counted8
polls with left held and8 after release (down237923/up238468). The wrapper was
restored. Its caller EIP009b0920 belongs to the game's GetDeviceData call at
009b0930 (`call [eax+28h]`, slot10), with20-byte DIDEVICEOBJECTDATA records;
this is not a GetDeviceState caller. The game's switch accepts offsets0/4/8
for axes and12/13/14 for buttons. `SetDataFormat` remains an implementation gap,
but these observed offsets do not establish a custom-layout mismatch.

After explicit movement155,445 ->156,445 ->155,445 and down243257, the native
trace proves real left-down dispatch:009b0a59 tests bit0x80;009b0a5e records
that bit set;009b0a67 passes the zero suppress/error byte at01d7a748;009b0a80
pushes event1 and009b0a84 calls009afe60, returning to009b0a89. The receiver
is01d733e8. A read-only snapshot also reports error byte0 and mode017792d4=1.
Mouse-up244432 is acknowledged and the later009b0a94 ->009afe60 path delivers
event4. Thus the native event dispatcher receives both edges; the next question
is relative-cursor/hit-test or downstream event handling, not whether a held
button ever reaches the guest. This does not yet prove New Game activation.
Native event1 target009aff41 copies the receiver's current coordinate words
at+c4/+c8 to+114/+118; event4 target009aff6f copies them to+12c/+130. These
provide a read-only seam to compare the game's click position with the host's
absolute pointer, without changing guest memory. Transient state is at+110,
with another dispatch state byte at+15c.

Diagnostic caution: `set_trace_eip_range` requires `(flag,lo,hi)`, three args.
A mistaken two-argument call enabled broad streaming trace and slowed batches.
The correct restoration `(1,0x526d93,0x526d97)` was queued after mouse-up; do not
infer completion of that control from its submission. Preserve the healthy
process while its current batch drains; no restart was used for this diagnosis.

The correct trace restoration is now acknowledged, followed by a confirmation
with host mask0/queue0. The native coordinate snapshot found all current/down/up
coordinates at(0,0), while the host pointer was(193,556). Sensitivity is1.0,
insets+100/+104 are0, and remapping+108 is1. A normal mousemove to(0,0) at
batch281124 moved the game's coordinates to(-1,-1); a later move to(156,446)
at285501 moved them to(194,556), verified before pressing. Down287458 and
up288497 at(156,446) recorded both guest edges at(194,556). The settled capture
at290202, `/private/tmp/bw-native-new-game-settled.png`, shows the four-panel
controls/tutorial screen with Continue. New Game activation is therefore
verified; changing in-world gameplay remains outstanding. No guest memory or
instruction stream was patched, and the frozen process was preserved.

Buffered-input sequencing matters here: motion is accumulated into+cc/+d0
during the FIFO loop and applied to current+c4/+c8 after that loop. A button
record encountered in the same poll snapshots the old current position. Move,
allow an actual input update, then press; absolute host pointer fields alone
are not sufficient evidence of the game's hit-test coordinates.

Continue was then targeted with mousemove(321,451) at292616; a separate native
read verified(400,562), followed by down293970/up294751. Run24571 is now
authoritatively terminal, exit1: batch294774 traps at00925197 decoding0f d0.
This is not yet evidence of a missing SSE instruction: the supplied EXE has
`mov eax,3` at00925195, so00925197 is inside its immediate and its runtime bytes
differ from disk. The enclosing00925120 reader copies from a virtual-method
buffer using `rep movsd` at00925178 / `rep movsb` at0092517f. Crash registers
include EBP=EDI=00a58780, ESI=00a5877f, EBX=33078b10; saved caller chain includes
009208a6,00920dca,009a81da. Investigate the copy arguments/corruption origin
before adding an opcode implementation. Last sampled renderer failures remain0.
All synthetic buttons were released before the trap. Gameplay remains unverified.

The saved stack identifies the immediate failure:00925120 is thiscall
`Read(dest,count,outRead)` with ret12. Return009208a6 at074fd034 places
dest=0 at074fd038, count=00a58780 at074fd03c, and outRead=074fd050 at074fd040.
Caller009a81d5 forwards an unchecked NULL from aligned allocator00adbcbf,
requested size00a58780/alignment64/offset0;00adbc2f requests00a587c3 bytes from
underlying00ad566e and propagates NULL. Copying count bytes into address zero
explains final EDI00a58780 and overwritten executable bytes. The reason for the
allocation failure still requires live allocator evidence; do not assume a leak
or enlarge memory solely from this stack. Effective source-1 is an inference
from final ESI/count, not a verified mapping snapshot.

`test/test-bw-rep-copy.js` executes the exact00925165..00925186 copy/cursor
sequence with valid heap buffers. All16 cold/cached size cases pass on both the
frozen failing-game WASM and current build, plus fresh source77739. It checks
EBP/EDX preservation, ECX0, DF0, final pointers, bytes, guards and cursor update.
No REP defect was reproduced and no instruction implementation was changed.
Both copies of BW2Demo.exe (probe MainApp and local candidate) have SHA256
65130510233cfc9e53758bab8480a3cfeeb6b1043de9774ab6e066191b2bb433.

Fresh reproduction21705 uses frozen current-build snapshot
`/private/tmp/bw-allocation-repro.J76xSx/wine.wasm`; artifacts are
`bw-software-probe-WjsJYY` in the system temporary directory. It is a new run
after confirmed exit of24571, not a replacement of a healthy process. Initial
samples report no renderer failures; menu/gameplay progression remains pending.

Read-only main-instance heap snapshots at batches27089 and43976 are identical:
9316 free blocks,7550264 total free bytes,3182896 largest block, no cycle or bad
header; low cursor/end71990848/71991296, sparse920016632/920059904, virtual
top1214742528. This bounds an intro interval, not the later failed allocation.
An isolated120-draw renderer audit likewise found stable live/cache bytes and
reuse, but renderer-private free blocks remain unavailable to the guest owner
until graceful handoff. Eager multi-batch scratch and owner high-water retention
remain pressure hypotheses. Ordinary Escape down22658/up23081 did not skip the
intro; the live run has no held key. Current source now reclaims replaced-arena
tails and rejects oversized low-heap reservations correctly;21705 predates that
change and must not be described as post-fix acceptance.

### Allocation-return diagnostic prepared on live run21705

Use breakpoint009a81c9, the aligned allocator's return block, rather than
009a81d5 inside that block. The native debugger checks dispatch boundaries;
the later unchecked-argument push is not itself a reliable breakpoint target.
At c9, EAX is the allocation result, EDI the requested byte count, ESI the
owning object and EBP the input stream. This allows inspection before the
subsequent copy corrupts instructions when EAX is zero.

The live CLI now has a one-shot, return-preserving run wrapper installed by
the ordinary eval channel. It shadows the instance's inherited exports getter
with a configurable property, invokes the original run exactly once, and on
the matching debug return copies registers, stack words and allocator cursors
into ctx.bwAllocCapture. It then clears the breakpoint and restores the original
property descriptor even if observation fails. ctx.bwAllocRestore cancels the
hook before a hit. Installation rejected a preexisting breakpoint; a tiny
independent Wasm test verified that shadowing/restoration is supported.
No guest instructions, registers or allocation state are patched.

The first oversized terminal input did not execute: canonical terminal input
overflowed, producing bell characters. Ctrl-U cleared the pending line;
allocation_capture_check2 confirmed breakpoint0 and no hook. Three short
hook_part commands then assembled the observer text, and hook_install returned
true. Keep future relayed commands short. At the last preceding sample the
intro had reached frame1098, completion95.2, and zero renderer failures. The
allocation has not yet been observed; this is diagnostic readiness, not proof
of either allocation failure or success on this preserved pre-fix build.

Run21705 subsequently completed the intro (frame1787, finishFrame1786) and
reached profile creation. Short Return694309/up694325 left the dialog visible;
held Return696323/up697061 closed it, with Player at the main menu in
/private/tmp/bw-profile-settled.png (batch697412). Normal movement698105 to0,0
then698149 to156,446 settled at native195,557. Down698787/up699231 reaches the
tutorial Continue screen in /private/tmp/bw-newgame-current.png (batch700341).
Move701673 to321,451 settled at native401,563; Continue down703542/up704168
reproduced the copy trap at batch704171, EIP00925197. All inputs were released.
The probe is terminal exit1, not a live wait. This was the pre-tail/pre-compaction
frozen build, not current-source acceptance.

The observer worked but matched an earlier call to the same allocation site:
batch704170, EAX844933376 (nonzero), EDI231184, ESI856098960, EBP856040276.
At that point the free list had9972 blocks totaling5389088 bytes, largest22368,
with no detected cycle/bad header/truncation. Low cursor/end71990848/71991296;
sparse cursor/end845164640/845676544; virtual top856096768. The full registers,
24 stack words and32 stream words are durable in run.log at BW-ALLOC-CAPTURE.
The setter logged synchronously before returning to guest execution, so this
evidence survives the subsequent crash. It proves fragmentation at this earlier
successful call, not the allocator's full state at the later10.3MiB failure.

The one-shot observer cleared itself after that successful call. Next use must
retain the breakpoint until EDI equals00a58780 (or explicitly capture every
matching return), rather than stop at the first use of the shared call site.
The terminal stack again contains destination0/count00a58780 at the copy call.
No new CPU opcode defect is demonstrated, and the exact allocation-pressure
cause remains open. Do not restart the old session handle21705; it has exited.

### Targeted post-compaction reproduction10715

`tools/black-white-software-probe.js --allocation-probe` now installs a reusable
observer that remains armed through earlier allocations and captures only
EDI00a58780 at009a81c9. Capture is logged synchronously and the exports property
and breakpoint are restored afterwards, including observation/logging failures.
The focused observer test verifies filtering, exactly one guest invocation per
call, unchanged return values/errors, cancellation, serialization and cleanup.

New run10715 is live on the frozen full-build41098 artifact:
/private/tmp/bw-compacted-repro.kyBDAg/wine.wasm,1158838 bytes,
SHA2567dee27a0cace008de26aa1cc5d4a1ec4d88ba7228ce589190182b5e30f655183.
This includes heap-tail reclamation, context compaction and the private VS2
foundation, but predates the later DirectInput lifecycle commit and matrix work.
Artifacts: /var/folders/dz/1fqkk_jd4350qkm91pm9_q3c0000gp/T/bw-software-probe-LJrjIm.
Launch uses --seconds=14400 --capture-every=60 --control-stdin --allocation-probe
and the frozen --wasm path. Observer installation returned armedtrue with
address10125769/request10848128. Startup samples through28.95s have no renderer
failures; neither gameplay nor the target allocation has yet been reached.

Run10715 subsequently completed the intro at frame1787 with no renderer
failures. Profile Return down218078/up219575 accepted the default Player name;
`/private/tmp/bw-compacted-profile-accepted.png` shows the main menu. Direct
movement to156,446 initially left native coordinates at0,0. Moving to0,0 first
established(-1,-1); then move224741 to156,446 settled at(194,556), verified before
pressing. New Game down226752/up228520 reaches the tutorial screen, verified by
`/private/tmp/bw-compacted-tutorial.png` at batch230088. All keys/buttons were
released after these inputs. The original frozen process remains in use, not a
latest-source or full-game acceptance run; the targeted allocation capture is
still pending before Continue.

Continue move232043 to321,451 settled at native(400,562), then down233778 and
up235764. All synthetic input was released before the failure. Run10715 is now
authoritatively terminal exit1: batch235768 traps at00925197, the same corrupted
copy site as the pre-fix run. Do not restart this terminated handle.

Unlike the earlier observer, the targeted capture caught the exact failing
allocation at batch235767: skipped1 earlier allocation, EIP009a81c9,
EDI10848128 (00a58780), EAX0. Heap ptr/end72007784/72011776; sparse ptr/end
852481608/853082112; free-list head877342288; virtual allocation top828637184.
The bounded walk found10248 free blocks, total5678096 bytes, largest44592,
with no bad header or truncation. Full registers/stack/stream are durable at
`[BW-ALLOC-CAPTURE]` in the run's existing run.log, line3048. The capture proves
NULL allocation precedes the unchecked copy, even with heap-tail reclamation
and shader-context compaction. It does not yet identify why obtaining another
large sparse arena failed: virtual allocation records/backing-space census
were not captured. No missing CPU opcode or new shader failure is demonstrated.

Allocator review: even perfect coalescing of the captured main-instance free
blocks cannot satisfy this request. A new sparse arena requires10878976 bytes
(166*64KiB), including aligned allocation/header overhead. The next failure
branches to distinguish are the shared guest reservation limit,2048 mapping
slots, contiguous physical backing/PTE publication, and1024 heap arena slots.
The recorded virtual_alloc_top is instance-local, not the authoritative shared
reservation cursor. Existing MEM_DECOMMIT/release/failed-reservation lifecycle
gaps were found during review, but none is established as this run's cause.

The observer now captures matching-layout VIRTUAL_MAP_STATE, all bounded map
records and heap arena records, active/free backing bytes and largest gap.
Optional section failures preserve return registers and other diagnostics.
Counts are capped by descriptors and2048 maps/1024 arenas; unpublished arena
records and best-effort consistency are explicit. The caller loads the same
RegionMap mirror after the CLI's WASM-layout check and adds --dump-virtual-maps
as a terminal backup. Focused tests and syntax/region-copy/diff gates pass.

New probe89033 is live on the identical frozen7dee27a0... wasm, whose layout
stamp was rechecked as9c6027bce1d500a1; this changes diagnostics, not the guest or
emulator under comparison. Same14400-second guard,60-second capture interval,
control stdin and allocation observer. Artifacts:
/var/folders/dz/1fqkk_jd4350qkm91pm9_q3c0000gp/T/bw-software-probe-w9Dofc.
Installation reported armedtrue, address10125769/request10848128. No input has
been sent. This is the instrumented follow-up to a terminal run, not a restart
caused by an observation timeout, and no allocator fix is claimed yet.

### Full backing census reproduction89033 (terminal, 2026-09-11)

The same frozen run completed intro1787 and accepted Player with Return
down212752/up213871. New Game at host156,446 (native195,557, checked before
pressing) down215469/up215908 reached the tutorial. Continue at321,451
(native401,563) down218934/up221373 triggered loading. All inputs were released.
The process then exited1: capture221408 immediately precedes crash221409 at the
same unchecked copy. Do not poll/restart handle89033 as though it were live.

Durable evidence is `[BW-ALLOC-CAPTURE]` at line2758 of
`/var/folders/dz/1fqkk_jd4350qkm91pm9_q3c0000gp/T/bw-software-probe-w9Dofc/run.log`.
EIP009a81c9, EDI10848128, EAX0, skipped1; main free-list census exactly matches
10715:10248 blocks,5678096 bytes, largest44592, no invalid/truncated records.
The new sections identify the previously missing backing constraint:

- 170 maps of2048;65 heap arenas of1024, no overflow or unpublished arena.
- Shared reservation top828637184, matching the local cursor in this capture.
- Backing base134217728, size331350016; cursor465559552 is exactly the pool end.
- Active backing234962944 bytes; free96387072 bytes, but largest gap10678272.
- Required new arena10878976 exceeds that gap by200704 bytes.
- No overlap; both bounded sections report stateChanged=false (best-effort
 consistency, not a globally locked snapshot).

This establishes insufficient contiguous backing space for the new arena
despite substantial total free space; map/arena slot exhaustion is not supported
by this capture. It does not prove relocation is safe: native renderer contexts
and host views can retain physical WASM addresses. Next allocator work must
preserve those leases or avoid their fragmentation at allocation time, with a
bounded reproduction before another hour-long game run. No shader/CPU-opcode fix
or gameplay success is demonstrated by this result.

### Preventive best-fit backing reuse (2026-09-11)

`virtual_map_commit_locked` now prefers the smallest fitting released extent
below the backing high-water mark before consuming untouched backing space.
The contiguous guest/physical extension fast path remains first. The bounded
unsorted-table scan allocates no scratch storage under the map lock and never
moves a live mapping, preserving renderer-held physical pointers. Zeroing,
protection, PTE publication and mapping-count publication order are unchanged.

Cross-instance fixture78684 first failed because bump-first consumed untouched
space instead of an available exact-size hole;18477 passes after the change.
The fixture leaves16 units, allocates4/guard1/2/guard1, releases the4 and2 holes,
then requests2 followed by7. Best-fit uses the2 hole and preserves the8-unit tail
for7. It checks released PTE invalidation, recycled-byte zeroing, unchanged live
physical addresses/guard data in the second instance, and failed-placement
count/cursor atomicity. Heap-tail11, partition6 and free-block validation71342
also pass; structural gates96114 pass. This prevents avoidable fragmentation;
it does not recover arbitrary already-fragmented maps or prove B&W gameplay.

Full build24371 passes1173262 canonical/1173730 compat bytes, layout
9c6027bce1d500a1 and233 nonoverlapping segments. The fresh comparison artifact is
`/private/tmp/bw-bestfit-repro.03hYhl/wine.wasm`, SHA256
`9fe637d0df8117dc9c85633f8fe7623c5ceac0397db5f1055a92cd7a95285b16`.
Unlike89033, this includes the intervening typed-constant and resumable-setup
checkpoint20d77477 as well as best-fit backing allocation; a gameplay difference
alone cannot isolate allocator effects from every intervening change. The
focused allocation fixture above is the controlled evidence for placement.

### Best-fit probe terminal and current controlled run (2026-09-11)

Frozen best-fit run78421 exited0 at its100000000-batch guard after12988.208s,
not a guest crash. Its final inspected frame12964.png shows SelectProfile /
NewProfileName over the menu. Intro reached1787 (finish1786); renderer failures
remained0 and lastError null. No input was sent, so this is not gameplay or
post-Continue allocator acceptance. Artifacts remain in
`/var/folders/dz/1fqkk_jd4350qkm91pm9_q3c0000gp/T/bw-software-probe-0mxUdH`.

The probe now accepts an explicit positive-safe-integer `--max-batches`, default
1000000000, while retaining its bounded wall-clock and shutdown guards. This
prevents the old batch ceiling ending a four-hour run early. Invalid0, negative,
fractional, NaN and unsafe-integer values were checked before guest launch.

New controlled run73697 uses full-build34288 frozen as
`/private/tmp/bw-current-controlled.1sR1mR/wine.wasm`, SHA256
`18df41dd31bfcee90facf716f961036ace4f919fa40f2a7385c1fadab224725d`.
It includes subsequent constant/vector/CALL implementation, not a pure allocator
A/B. Arguments: seconds14400, max-batches1000000000, capture-every60,
control-stdin, allocation-probe and the frozen wasm path. Observer installation
returned armedtrue/address10125769/request10848128. Artifacts are
`/var/folders/dz/1fqkk_jd4350qkm91pm9_q3c0000gp/T/bw-software-probe-1Fi3BW`.
Initial55s sample reaches intro19 with zero renderer failures and no input held.
The parent owns the terminal handle; subagent handles are not interchangeable.

### Split backing for a fragmented commit (2026-09-11, Claude)

The measured blocker was never a shader or a missing opcode: at Continue the
guest asks for a 10878976-byte heap arena (`$heap_sparse_alloc`, 166*64KiB
rounded), `virtual_map_commit_locked` could not find that many *contiguous*
bytes in the backing pool — largest gap 10678272, short by 200704 — and
returned NULL, which the guest copied into without checking. Total free
backing at that moment was 96387072 bytes. Best-fit reuse (earlier this day)
keeps the pool from fragmenting further; it cannot conjure a contiguous run
out of a pool that is already fragmented.

One guest commit does not actually need one backing extent. Guest addresses
translate per page through the page table, and every host-side bulk copy
already asks `g2wSpan` how far the current run reaches — precisely because
adjacent guest maps have unrelated backings. So `virtual_map_commit_locked`
now falls back, at the point where it used to return 0, to halving the
request and placing each half on its own extent (`$virtual_map_commit_split`).
Halving bottoms out at one 64KiB granule, so recursion is bounded by
log2(size/64KiB).

Two consequences had to be handled rather than assumed:

- `MEM_RELEASE` names only the base. Records after the first carry bit 31 in
  their AllocationProtect word (`$virtual_map_mark_continuations`), and
  `$virtual_map_release_locked` walks that chain, so a released split
  allocation gives back every chunk instead of leaking all but the first on
  each level reload. Bits 0..10 keep the PAGE_* value and the flag never
  reaches a PTE: publication is per chunk with the caller's unmodified
  protect, and the marking pass runs afterwards.
- A half that cannot be placed rolls its siblings back
  (`$virtual_map_release_range_locked`): a VirtualAlloc that returns NULL must
  leave no backing committed. The per-instance downward reservation cursor is
  put back on the allocation's own base, or the next VirtualAlloc(NULL) would
  carve out of a range this one already owns.

`test/test-virtual-map-split-commit.js` pins the contract on a pool left with
two four-unit holes and no wilderness: an eight-unit commit succeeds, lands
one chunk on each hole, moves no live mapping, translates and zeroes on every
page including across the seam, fails clean when the total does not fit, and
releases completely. Negative control: with the fallback disarmed in the same
build, that commit returns 0. Also PASS: virtual-map-cross-instance (its
"failed placement must not change map count or backing cursor" assertion still
holds — the rollback restores both), virtual-page-protection,
virtual-query-user-boundary, heap-partition, pointer-probes,
global-alloc-reuse, shell-malloc, bw-allocation-observer. Full build gates
pass; artifact `/private/tmp/bw-split-fix/wine.wasm`, 1191381 bytes, SHA256
`a1552d40b78739e5fa11bcba9a0ecace798d7bd8e3f81ad1605eeff8ba0c94b0`, layout
hash d417ce1f6829dade.

`test/test-bw-arena-commit-replay.js` then answers the same question against
the real fragmentation instead of a synthetic imitation, in 14 seconds. The
allocation observer's capture at batch 221408 holds all 170 sparse map
records as they stood when the guest asked for its arena and got NULL;
`test/fixtures/bw-alloc-capture-221408.json` is that table, and the fixture
seeds it into a fresh instance and asks for the same 10878976 bytes. It
re-derives the largest gap and the total free space from the seeded records
rather than trusting the recorded numbers, so it cannot quietly become
trivial, and it refuses to run if the backing pool's pinned base or size has
moved since the capture. The arena places across two extents, every one of
its 2656 pages translates to distinct zeroed storage, the seams read back
what was written to them, and release gives every chunk back. Disarming the
fallback in the same build returns 0, exactly as the game saw.

Reaching this state by playing costs hours of software rendering and ends in
a process that cannot be restarted, which is one fragile data point for the
cost of a session; the durable capture is worth more than the replay of its
history. That is why there is no gameplay-driving tool here.

Not established by any of the above: that the level loads. The allocation is
the next thing the guest would have crashed on, not a demonstration of
gameplay, and the status document's own open items — fixed-function
world-space clipping unimplemented and rejected by the software path, WebGL
clip planes rejected before GPU access — are still open.

### Ending the intro on demand (2026-09-11, Claude)

The opening sequence is in-engine, not a movie file — there is nothing to
remove from the install — and software-rasterizing its 1787 frames at the
measured ~0.5 frames/second put the main menu about an hour away. That hour
was the reason every question about what happens *after* the menu cost a
session to ask.

It can be ended instead. `0x00529433` is the intro tick's own exit test:

```
00529421  cmp dword [esi+0x24], 0x0      ; finishFrame, -1 while running
00529425  jge  0x529433
00529427  mov edx, [esi+0x20]            ; frame
0052942a  add edx, 0x1f4
00529430  mov [esi+0x24], edx            ; finishFrame = frame + 500
00529433  mov eax, [esi+0x24]
00529436  cmp eax, -1
00529439  jz   0x52944a
0052943b  cmp [esi+0x20], eax
0052943e  jle  0x52944a
00529440  mov al, 1                      ; finished
```

The arming above it is the engine's own: once the completion float at
`[esi+0x28]` passes its threshold it sets `finishFrame` to `frame + 500`, the
fade. So writing `finishFrame` below the current frame is not a synthetic
state — it is exactly the state the sequence ends in, reached without
rendering the frames in between. Nothing else is written.

`tools/black-white-software-probe.js --skip-intro` does it as soon as the
existing `0x00526d93` EIP trace names the object (`ESI`; `+0x20` frame,
`+0x24` finishFrame, `+0x28` completion). Measured: the frame counter froze
at 3 instead of climbing, and the capture thirty seconds later is the **main
menu** — the Select Profile / New Profile Name dialog over the land globe,
with the bottom button bar. Ninety-five seconds, against an hour.

Ruled out by measurement first, so nobody repeats it: Escape, Space, Return
and a click all leave the intro counter advancing unchanged.

A second, guest-legitimate route exists on paper and is *not* proven. The
demo parses `.\Scripts\MPDebug.txt` at `0x005fce85`, handing the parser at
`0x009b5000` the token table at `0x0170b280` and the dispatcher at
`0x00619f40`. That table is 28 entries of `{const char *name, char
signature[10]}`, where the signature spells each argument (`N` number, `A`
string); the token id is the table index and the dispatcher's jump table at
`0x0061a44c` is indexed by `id - 2`. The syntax is the one `Scripts/map.txt`
already uses, `TOKEN("string",123)`. Useful entries:

| id | token | args |
|---|---|---|
| 6 | `LOAD_FEATURE_SCRIPT` | A — splits the path and special-cases a leading `Land` |
| 7 | `SET_LAND_NUMBER` | N — stored at `[g+0x4e10d8]` |
| 8 | `PAUSE_GAME` | — |
| 17 | `LOAD_LANDSCAPE` | A |
| 18 | `LOAD_GAME_SCRIPT` | A |
| 25 | `SET_STARTUP` | A — `"AllowSkip"`, `"ForceIntro"`, `"Default"` |

`SET_STARTUP` clears bit 23 and sets bit 22 of `[g+0x10]` for `AllowSkip`,
the reverse for `ForceIntro`, and clears both for `Default`. But a
`--trace-fs` run with the file in place shows the demo never opens
`MPDebug.txt` in its first eighty seconds, so the route is unproven and the
readers of those two bits have not been found either; the poke above is what
actually works today.

### The frontend does not see window-message mouse input (2026-09-11, Claude)

With the menu up — the Select Profile dialog with a New Profile Name modal
over it — a full `mousemove` / `mousedown` / gap / `mouseup` on the
highlighted OK button at 640x480 coordinates 248,272 left the modal exactly
where it was, twice, and Return did nothing either. The button's yellow
diamond is an idle pulse, not a hover state: it is already lit in a capture
taken before any pointer event, and its phase changes on its own between
captures. So there was never evidence the cursor was tracked on that path,
and the game's own cursor sits pinned in the top-left corner of every frame.

The PE imports `DINPUT8.dll!DirectInput8Create`, and a run traced with
`--trace-api=DirectInput8Create,GetCursorPos,SetCursorPos,ShowCursor,ClipCursor`
shows it called once from `0x009afd9f` during startup, alongside four
`ClipCursor` calls, a `ShowCursor` and a `GetCursorPos` — all before the menu.
This is a DirectInput8 frontend with a software cursor, so the harness
primitives it needs are the DI ones, not the window-message ones:

- `relmousemove:DX:DY` → `renderer.handleRelativeMouseMove`, whose own comment
  says it exists because "software-cursor games keep their own position";
- `di-mousedown` / `di-mouseup` for the buttons;
- `renderer.setMousePosition` only feeds `GetCursorPos`, via
  `$host_get_mouse_position` in `$handle_GetCursorPos`.

One trap worth writing down, because it costs a whole run to find: over
`--control-stdin` these are input *entries*, so they must be sent as
`{action:"input", cmd:"di-mousedown"}`. A bare `{action:"di-mousedown"}` is
rejected with `need {cmd:"action:args"}` — `test/run.js` derives the entry
from `cmd.cmd` and only a plain-string control command falls back to the
action name.

### Driving the frontend through DirectInput (2026-09-11, Claude)

Confirmed by measurement: the DI path works and the window-message path does
not. Three captures from one run, `--skip-intro` plus relative moves:

- `01-menu` — the game's own cursor is drawn in the top-left corner, where it
  has sat since the first frame.
- `02-cursor-centre` — after `relmousemove:-2000:-2000` (slam to the origin,
  since the deltas are relative and the absolute position is the game's own)
  then `relmousemove:320:240`, the cursor is drawn at roughly 332,238. The
  frontend tracks the DirectInput deltas.
- `03-name-ok` — a `di-mousedown` / 2.5s / `di-mouseup` pair on the New
  Profile Name OK button at 248,272 dismissed *both* stacked dialogs and left
  the main menu up, titled `Player`, with the bottom bar live: Continue, New
  Game, Load Game, Change Profile, Options, Quit.

So the recipe for any B&W2 frontend click is: `relmousemove:-2000:-2000` to
re-origin, `relmousemove:X:Y` to the target, a gap, `di-mousedown`, a gap,
`di-mouseup`. The gaps matter for the same reason they matter everywhere else
in this repo — the game samples the button state per frame, and at software
rendering speed a frame is seconds of wall clock, so a press and release
inside one sample is invisible.

Bottom-bar button centres at 640x480, measured off `03-name-ok`: Continue 60,
New Game 155, Load Game 265, Change Profile 380, Options 480, Quit 590 — all
at y=443.

Two further results from the same run. Clicking New Game at 155,443 reaches
the mouse-controls tutorial — four panels with the good and evil advisors,
alpha-blended sprites and a Continue button at about 320,460 — so the
frontend renders and routes correctly past the profile screens. And the
split-backing fallback from 41022d0d does **not** fire anywhere up to that
point: a census of `VIRTUAL_MAP_TABLE` taken twice at the menu reports 162
records, zero of them continuation-marked. Whatever forces a split is later
than the frontend, so that path still needs a land to be proven in the real
game rather than only in `test/test-virtual-map-split-commit.js`.

### Clicking New Game crashes on rsqrtps (2026-09-11, Claude)

Fixed in 7881bf7e, recorded here because the shape of the failure is worth
recognising. Clicking Continue on the mouse-controls tutorial puts the engine
into its vertex work for the first time, and it dies immediately:

```
*** CRASH at batch 561082: unreachable      ($th_bad_opcode)
  EIP=0x00962cb6
  00962cb6  0f 52 c8     rsqrtps xmm1, xmm0
```

The enclosing function is `0x00962bb0`, a normalizer over an array of 16-byte
vectors: `movaps` the pair, `addps`/`subps` to get sum and difference, two
horizontal `shufps`+`addss` reductions for the squared lengths, `comiss` to
pick which of the two to keep, then `rsqrtps` plus two Newton-Raphson steps
(`mulps`/`mulps`/`subps` against constants at `0x1d6edb0` and `0x1d6edd0`).
Every form in that loop except `rsqrtps` was already decoded, which is why
nothing else in the game had tripped over it.

Adding the single opcode would only have moved the crash a few instructions,
so 7881bf7e added the rest of the SSE1 packed group at once — `0F 51/52/53`,
`0F 54/55/56`, `0F 5D/5F` and the three `F3`-prefixed scalar twins.

### Clicks need a long settle, not a long press (2026-09-11, Claude)

A DirectInput button event carries no position: the game clicks wherever *its*
cursor has got to. At software-rendering speed one frame is seconds of wall
clock, so a `relmousemove` followed three seconds later by a `di-mousedown`
presses at the position the game held *before* the move, and every click in a
run misses with no diagnostic at all — the dialog simply stays up. The run that
worked left about twenty-eight seconds between settling the cursor and pressing
it, by accident. Budget ~25s after the move and ~10s between down and up, and
photograph before each click while a sequence is still being calibrated.

### Land load nulls a texture pointer: DXT3 and A8L8 were missing (2026-09-11, Claude)

Clicking Continue on the tutorial loads a land (`Land3.ter`, 969 1024x1024
textures, real shaders) and then EIP goes to 0 on a white screen. The chain,
read back from the hit counters and the disassembly:

    [obj+0x1d0] ends at 2 (failed)
      -> 0x00938fc0 returns NULL
      -> caller 0x00a5553b does `mov edx,[edi]; call [edx+0x34]`
         (IDirect3DTexture9::GetLevelCount) on NULL
      -> $g2w absorbs the null read into NULL_SENTINEL, EIP := 0

`D3DXGetImageInfoFromFileInMemory` is **not** the failure point — it succeeds
all 262 times, and the asset named `data\landscape\dummy.bmp` is a cache key
for a CPU-filled splat texture, not a file anybody opens. A `--count` probe on
the loader's two arms measured the real split:

    0x00938c13 = 262   loads attempted
    0x00938cf6 = 100   failed
    0x00938f22 = 162   succeeded

and a format histogram over the 278 `IDirect3DDevice9_CreateTexture` calls in
the same run named the cause outright:

    133  0x31545844  DXT1
     97  0x33545844  DXT3      <- not implemented
     29  0x00000015  A8R8G8B8
     16  0x35545844  DXT5
      2  0x00000033  A8L8 (51) <- not implemented
      1  0x00000016  X8R8G8B8

`IDirect3D9::CheckDeviceFormat` answers S_OK to everything, so the game is
entitled to ask for both and only finds out at `CreateTexture`.

Both are implemented now. DXT3 is a 16-byte block: sixteen explicit 4-bit
alphas in bytes 0..7, low nibble first, replicated to 8 bits (`0xf` -> `0xff`,
not `0xf0`), and DXT5's colour half at byte 8 — always four interpolated
colours, never DXT1's `c0 <= c1` punch-through mode. A8L8 is two bytes per
texel, luminance low and alpha high, which is the first uncompressed format
here that is not four bytes wide: `$d3d9_texture_pitch` and the lock subrect's
x offset both had the 4 written in.

Files: `lib/d3d9-texture.js`, `lib/d3d9-host.js`,
`src/09ae-d3d9-resources.wat`, `test/test-d3d9-textures.js`.

### Land load now runs out of backing, not out of formats (2026-09-11, Claude)

With DXT3 and A8L8 in place the loader's failure arm stops firing entirely:

    0x00938cf6 = 0     (was 100)
    0x00938f22 = 270   (was 162)

The null-deref at `0x00a5553b` and the EIP-0 white screen are gone, the mouse
tutorial renders fully textured, and the land load runs on for another two
minutes before dying differently:

    [C++ throw] .?AVbad_alloc@std@@ at EIP 0x00ada813
    === UNHANDLED EXCEPTION: CXX_EXCEPTION 0xe06d7363 ===
    [Exit] code=-529697949

`tools/virtual-map-census.js` on that run's exit dump says this is capacity,
not fragmentation:

    records 299   pool 0x8000000..0x1bbf7000 (316.0 MB)
    live 315.3 MB (99.8%)   free in holes 0.7 MB   largest hole 0.1 MB
    split commits: 0

and the allocation capture taken earlier in the same load breaks the 248 MB
committed at that point into 167 MB of `$heap_alloc` arenas (161 MB of it
handed out, 97%) against 81 MB of direct `VirtualAlloc` commits, with only
7.9 MB on the heap free list. There is nothing to reclaim. Two things ruled
out along the way: the guest never asks for `MEM_DECOMMIT` (all ten
`push 0x4000` sites in `.text` are 16 KB `malloc` calls, not `VirtualFree`
flags), and `MEM_RESERVE` already costs no backing.

So B&W2's land simply needs more committed memory than `$VIRTUAL_BACKING_BASE`
has. The map is full: 180 allocated regions end at ~`0x07BC6000`, the pool runs
`0x08000000..0x1BC00000`, and `$GUEST_PAGE_TABLE`, `$DIB_BACKING_BASE` and
`$THREAD_RPC` fill the rest up to the 512 MB ceiling exactly.

## What the game asks about memory, and what we used to answer

Before raising the ceiling it is worth checking whether B&W2 sizes its load
from what we tell it. It does, through two calls, and both of our answers were
wrong in the direction that makes it over-commit:

    [API #140848] SetProcessWorkingSetSize(0xffffffff, 0x08000000, 0x1ce00000) [ret=0x00612cc3]
    [API #685967] IDirect3DDevice9_GetAvailableTextureMem(0x07f36030) [ret=0x00934a20]

The working-set pair is 128 MB / 462 MB, and 462 MB is exactly the 512 MB we
reported from `GlobalMemoryStatusEx` minus the 50 MB the game subtracts — so
the number came straight back out of our answer. It then asks D3D9 how much
texture memory there is, once, from `0x00934a20`, and stores the result at
`[ebp+0x460]`; that handler was a silent stub returning 0.

Neither answer was about the right pool. A guest commit can only ever come out
of `$VIRTUAL_BACKING_BASE` — everything else in the linear memory is
emulator-private — so the honest physical total is the pool's 316 MB and the
honest available figure is what its bump cursor has left. `$virtual_backing_available`
in `src/10-helpers.wat` computes that; `GlobalMemoryStatusEx` now reports it,
and `GetAvailableTextureMem` returns it rounded down to a whole megabyte the
way a real driver does.

## The land's texture slot array, and the formats it falls back through

After the extension backing window removed the memory wall, the land load died
one instruction past a texture getter:

    [eip-zero] guest called through NULL at batch 1772135
      dbg_prev_eip=0x00a21f27

`0x00938fc0` is that getter. It reads a state word at `[ecx+0x1d0]` (0 and 3
are ready, 1 means "a load is in flight", and `0x00938930` spins in
`SleepEx(0, TRUE)` until it leaves 1) and returns the D3D resource pointer at
`[ecx]`. Read it as "the getter returned NULL" and you chase the loader; the
`--count` arms say no load ever failed. It is the wrong reading. With `ecx`
NULL, `$g2w` absorbs *both* reads into `NULL_SENTINEL`, so a NULL `this` is
indistinguishable from a successful call returning NULL, and `--fault-null`
is the only thing that separates them:

    [fault] unmapped guest access 0x0 from eip=0x938fe5   ; mov eax,[esi], esi = 0
    [fault] unmapped guest access 0x0 from eip=0xa21f27   ; mov ecx,[eax]
    [fault] unmapped guest access 0x48 from eip=0xa21f27  ; call [ecx+0x48]

So the empty thing is the *caller's* slot array. `0x00a21ee0` blits a subrect of
`[esi+edi*4+0x1d0]`, and `0x00a20fe0` is what fills those two slots — sized from
`[esi+0x1d8]`/`[esi+0x1dc]`, which `0x00a23420` zeroes along with the slots:

    lea edi,[esi+0x1d0]; mov ebx,2          ; two slots
      call 0x933910(w,h,1,0,0x51,4)         ; D3DFMT_L16
      cmp [edi],0 / jnz done
      call 0x933910(w,h,1,0,0x32,4)         ; D3DFMT_L8
      test eax,eax / jnz done
      call 0x933910(w,h,1,0,0x14,0)         ; D3DFMT_R8G8B8
      mov [edi],eax                         ; stores NULL and carries on

Nothing bails out when all three fail. A format histogram over the whole land
load — `--trace-api=IDirect3DDevice9_CreateTexture`, argument 6 — names what it
actually asks for, and it is not only that chain:

| format | calls |
|---|---|
| DXT1 `0x31545844` | 136 |
| DXT3 `0x33545844` | 106 |
| DXT5 `0x35545844` | 16 |
| A8R8G8B8 (21) | 32 |
| **L8 (50)** | **4** |
| A8L8 (51) | 3 |
| **R8G8B8 (20)** | **2** |
| **R5G6B5 (23)** | **1** |
| X8R8G8B8 (22) | 1 |

L16 never appears: the game's own capability probe at `0x009371d0` skips it and
starts at L8. The three bolded rows are the ones we refused, so those slots
stayed NULL — and `IDirect3D9_CheckDeviceFormat` was a blanket `S_OK`, which is
what let the game believe all three were available in the first place. Every
CreateTexture call in the run returns through d3dx9_25 (`ret=0x025fa2e5`), never
from the exe directly, so a breakpoint on the exe side sees none of this.

## A -2000,-2000 mouse delta hangs the land-selection screen

**The land picker is not broken; the way we were driving it was.** With no
input at all it submits about thirteen draws a second for as long as you care
to watch (measured: 3409 → 4309 submissions over 65 seconds, EIP moving between
the IDirect3DDevice9 thunk and game code). Send it one
`relmousemove:-2000:-2000` — the "slam to the origin" that every earlier screen
in this file takes without complaint — and it stops presenting about ten
seconds later and never recovers.

The recipe that reaches the land picker uses that slam because a DirectInput
delta carries no position and there is no other way to know where the cursor
started. A 2D menu clamps it at the screen edge, which is why the three screens
before this one take clicks fine. This one is a 3D scene and feeds the raw
delta somewhere a huge value ruins.

### What the hang looks like, for recognizing it again

Three measurements, all from the drive that sent the slam:

- **D3D submissions flatline.** The allocation probe's series climbs 520
  (t=218s) → 3054 (323s) → 6346 (534s) → 6964 (604s) and then sits at **6973**
  for the remaining 800 seconds of the run. The land screen first appears at
  t≈619s, so presenting stops about twenty seconds after it is finished.
- **Every later input is ignored.** That drive tried five more: a click on the
  coloured thumbnail at (135,375), a click on the vignette at (320,180), Enter,
  a double click, and Space. All five captures are byte-identical, md5
  `817f4239cd047d69ab0fdcc8f8192926` — the game was already gone.
- **Nothing is allocated either.** The virtual-map census is frozen across all
  of them at `{count:351, extBytes:37654528, continuations:0}`.

The 5-second sampler shows the run stalling in two distinct places:

| window | what the sampler sees |
|---|---|
| t=655s → t=1042s | **one 387-second gap** — a single batch that did not return. The last sample before it is `eip=0x00adeda9`, CRT/heap territory. |
| t=1042s → end | 118 samples, five seconds apart, **every one** at `0x9e5272` or `0x9e5276`, exactly alternating. |

So the emulator is healthy in the second window — batches return on schedule —
and the guest is simply inside one loop.

### 0x009e5140 is a spatial-grid region query

`thiscall(&minPt, &maxPt, &outArray)`, `ret 0xc`. The `this` object is a
uniform grid over the map:

| offset | meaning |
|---|---|
| `+0x00`..`+0x0c` | world bounds `x0, y0, x1, y1` |
| `+0x10` | row stride, in cells |
| `+0x14` / `+0x18` | cell width / cell height — the `idiv` divisors at `0x9e5184`/`0x9e5193` |
| `+0x20` | base of the cell array, 12 bytes per cell (`+0x00` count, `+0x04` items) |

The body is three nested loops:

```
0x9e5250   for each cell row y0c..y1c            ; ebp walks 0xc per row
0x9e5260     for each cell in the row            ; esi = the output array
               for each object in the cell       ; ebx
0x9e5272         linear scan outArray for a dup  ; cmp [ecx],edi / jz 0x9e52e9
0x9e5281         not found -> append             ; grow via operator new[] 0xad425d,
                                                 ;   copy, operator delete 0xad671a
```

The output array is the usual `{capacity@+0, count@+4, data@+8}`. The dup scan
is linear in `count`, so the whole query costs
`cells × objectsPerCell × |out|` — quadratic in the size of the result set. A
query rectangle covering the whole map never finishes.

Callers: `0x9e46c0` and `0x9e4740`, both of which normalize their rect through
`0x9eeee0` (a min/max sort of `{x0,y0,x1,y1}`), expand it by one in each
direction, and write the result count back to `this+0xc8`. Those are reached
from `0x9d4cf2` and `0x9d4ff5`.

**One trap to be aware of before blaming the game.** If `operator new[]` ever
hands back NULL, `outArray.data` becomes unmapped, `$g2w`'s NULL_SENTINEL makes
every dup-scan read return 0, the item being inserted is never equal to 0, so
*every* object appends and `count` grows without bound — turning a finite
quadratic pass into a genuinely infinite one. `outArray.data` is therefore the
first thing to read when sampling this loop, not the last.

### Reaching the land picker headlessly

Roughly twenty minutes of wall clock on an unloaded box, all of it through
`tools/black-white-software-probe.js --control-stdin --skip-intro`:

| t (approx) | action |
|---|---|
| +180s | main menu |
| | click (248,272) — new profile |
| +50s | click (155,443) |
| +80s | click (320,460) — *Continue* on the mouse-controls tutorial |
| +60s | the land-selection screen |

The clicks are **DirectInput and relative**: `src/09a8-handlers-directx.wat`
keeps a delta pair and an event ring, which is what a DI8 game polls, so each
one is `relmousemove:-2000:-2000` (slam to the origin), 10s, `relmousemove:X:Y`,
25s, `di-mousedown`, 10s, `di-mouseup`. The long gaps are load-bearing: a DI
button event carries no position, so the game clicks wherever its own cursor has
got to, and at software-rendering speed one frame is seconds of wall clock. A
press three seconds after a move lands where the cursor was *before* the move.

Pin the build with `--wasm=` plus a saved `WINE_REGION_MAP` mirror. This is a
shared worktree and a drive that rebuilds picks up whatever half-finished edit
is on disk at spawn time.

### Drive this game by watching the screen, not by sleeping

Every recipe in this file that reads "+180s menu, click, +50s, click" was
measured on an idle box, and it is only valid on one. Drive 12 ran at load
average ~8 and each of its three menu clicks landed on a splash screen: at
t=180s the game was still showing the Black & White 2 title card, at t=300s
the Lionhead logo, at t=380s the ATI logo. The clicks themselves were fine.
The tags on the captures were fiction, and a capture tagged `03-profile-made`
showing a company logo reads as "the click did nothing" unless you open it.

Two shapes make that mistake cheap to spot and cheap to avoid:

- A splash-chain frame is *small*. The title card and the profile screen come
  out around 220-400 KB of PNG; the Lionhead logo is 36 KB and the ATI logo is
  11 KB, because they are a handful of flat colours. `ls -la` on the shot
  directory sorts splash from content before any image is opened. (Same signal
  as `tools/app-contact-sheet.js --pick=largest`, for the same reason.)
- Wait for the screen instead. Keep one reference frame per screen from a run
  that did reach it, capture every 15 s, and advance when
  `diffPng(capture, reference, {tolerance:24}).share` drops under 0.12. Two
  frames of one screen from different runs differ by ~1% here (the game
  animates — see the vignette note above), and any *other* screen differs by
  tens of percent, so the gap between "this screen" and "not this screen" is
  two orders of magnitude wide and needs no tuning. Log every reference's share
  on each poll: a run that never arrives then says which screen it is stuck on
  rather than just timing out.

The reference frames currently used are the `n12-0{1,2,3,4}-*` captures
(menu / profile-made / tutorial / land-select).

### CORRECTION: it is not the size of the delta — any mouse poll hangs the land picker

The section above blames a single `-2000,-2000` lump. That was measured, but
the conclusion drawn from it was too narrow. Drive 13 reached the land picker
(reference-matched, `land=0.0%`) and moved the cursor in **50-pixel steps
three seconds apart** — ordinary hand motion at this frame rate — and the
screen stopped presenting exactly the same way: EIP pinned at `0x9e5276`, the
software backend's submission counters flat at 1886, and every capture taken
afterwards **0.00%** different from the one before. Drive 8's lump and drive
13's sweep produce one symptom, so the delta size is not the variable.

What the variable is, from a live probe inside the loop:

| when | the grid cell record |
|---|---|
| before any input (`eip=0x878800`) | `{n: 0, items: 0}` |
| hung (`eip=0x7503488`, in the D3D thunk under the query) | `{n: 993082159, items: 993213234}` |

and the output array is not NULL at all — `{cap: 262144, count: 231616}`
climbing to `241304` five seconds later. So the earlier NULL_SENTINEL theory
for the grow path is wrong too: the array is real and the loop is genuinely
appending hundreds of thousands of entries, because the cell it is walking
claims ~993 million objects. `0x3B31E5EF` is not a count anybody wrote; it is
whatever bytes that address happens to hold.

So the bug is upstream of the loop: the spatial grid's cell pointer (or the
grid header it is derived from) is garbage by the time the first mouse poll
runs a pick against it. `0x009e5140` is the victim, not the culprit, and it
is reached on *every* mouse poll over this screen — which is why the screen
survives indefinitely with no input at all (drive 9) and dies on the first
motion of any size.

### The land picker's infinite loop is an unreported out-of-memory

Tracing the faulting block itself (`--trace-at=0x9e50e6` with `esi:12`, 307
hits) closes the chain. The cell is a 12-byte vector `{capacity, count, items}`
and the append is an ordinary `push_back`:

    0x9e50d7  mov edx,[esi]          ; count      (esi = cell+4)
    0x9e50d9  cmp edx,[esi-0x4]      ; == capacity?
    0x9e50df  jnz 0x9e50e6
    0x9e50e1  call 0x9e8200          ; grow
    0x9e50e6  mov eax,[esi]          ; count
    0x9e50e8  mov ecx,[esi+0x4]      ; items
    0x9e50eb  mov [ecx+eax*4],ebp    ; items[count] = object   <-- faults

and grow is a textbook doubling vector that **never checks its allocation**:

    0x9e8200  (cap ? cap*2 : 1) * 4 bytes
    0x9e821b  call 0xad425d          ; operator new[]
    0x9e8220  mov edi,eax            ; no test, no jz
    0x9e8230  ...copy old elements...
    0x9e8244  call 0xad671a          ; operator delete[] (old)
    0x9e824c  mov [esi+0x8],edi      ; items = whatever new[] returned

Of the 334 faulting stores in one run, **190 are to address 0x0 or 0x4** —
`items` is NULL — and every traced entry arrives with `prev_eip=0x009e8249`,
i.e. straight out of that grow. So `operator new[]` is returning NULL.

On real Windows this is a crash at `mov [ecx+eax*4],ebp`. Here `$g2w` maps the
null store onto `NULL_SENTINEL`: the write disappears, `count` is still
incremented, and the next dup-scan reads the same sentinel back as 0, matches
nothing, and appends again — forever. **The infinite loop is not the bug; it is
how an unchecked `operator new[]` failure presents when a null dereference is
survivable.** That also explains why no input at all is safe (drive 9): nothing
calls the pick, so nothing calls grow.

This is the same wall as the bad_alloc in "Land load now runs out of backing"
above, just reached from a path that does not check the result. The remaining
question is what the allocator has left at that moment, not what the loop does.

### CORRECTION: `operator new[]` never returns NULL, and the allocator is not the problem

Commit `8ed6886b` concluded that the land picker's infinite loop was an
unreported out-of-memory — that `0x9e8200`'s `call 0xad425d` returned NULL and
the grow routine stored it without checking. That is wrong on both halves:

- `0xad425d` → `jmp 0xad41b9` is MSVCRT `operator new`, which loops on `malloc`,
  calls `_callnewh` on failure, and **throws** when that returns 0. It has no
  path that returns NULL to its caller.
- Our allocator has capacity at the land picker — live probes of 64 B through
  1 MB all succeed — and it structurally cannot hand back the wild `items`
  values we see. `$heap_sparse_alloc` takes every chunk from
  `$virtual_reserve_down`, which refuses anything below `$VIRTUAL_ALLOC_MIN`
  (`0x10000000`) and commits each chunk before returning it. The observed
  `items` cluster `0xb7a77000..0xb7ac6000` is outside the VirtualAlloc arena
  entirely, so no allocation produced it.

A drive with `--trace-at=0x9e8220` (the call-return landing inside grow) across
a full walk to the picker plus the hanging nudge recorded **zero** hits, which
settles it: grow is not even on the faulting path. The cell records the loop
reads are garbage — the `n`/`items` words decode as ASCII fragments — so the
grid's cell-table pointer `[edi+0x20]` is pointing at unrelated data, and the
question is what left it that way, not what the allocator returned.

### The land load blits from a NULL `bmBits`, and that is ours

The 1054 faults at `0x9b7370` during the land load are the concrete defect
underneath. The block is a row blit, and the destination is checked:

```
009b72cd  push 0 ; call [0xc12054]      ; CreateCompatibleDC(NULL)
009b72dd  push edi ; push eax ; call [0xc12050]   ; SelectObject(hdc, hbmp)
009b72ed  lea eax,[esp+0x18] ; push eax ; push 0x18 ; push edi
          call [0xc1205c]               ; GetObjectA(hbmp, 24, &BITMAP)
009b7303  movzx eax,word [esp+0x2a]     ; bmBitsPixel
009b7326  call 0x8b1180                 ; allocate the destination
009b7331  jz   0x9b73a3                 ; ...and it IS checked
009b7370  mov edi,eax                   ; dest = the checked allocation
009b7379  mov esi,edx                   ; src  = derived from bmBits
009b737b  rep movsd
```

So the faulting reads are the **source**: `bmBits`, straight out of
`GetObjectA`. The bitmap comes from the call at `0x9b7279` —
`LoadImageA(NULL, path, IMAGE_BITMAP, 0, 0, 0x2010)`, i.e.
`LR_LOADFROMFILE | LR_CREATEDIBSECTION`.

`$load_image_bitmap_file` built a DDB for every caller, and a DDB's pixels are
device-private: `$gdi_bitmap_write_object` deliberately reports `bmBits = 0` for
one. That is right for a DDB and wrong here — the app asked for a section
precisely so it could read the bits. The fix threads the flag through
`$load_image_bitmap_file` and takes `$gdi_bitmap_create_owned` with the
DIB-section object flag, so the pixels land in `$dib_alloc` storage that has a
guest address. `test/test-loadimage-dibsection.js` covers both directions in
about two seconds: the section reports a non-NULL `bmBits` that addresses the
file's pixels, and plain `LR_LOADFROMFILE` still reports `bmBits = 0`.

### The NULL blit was a fake success handle, and it is gone

`0x009b71f0` is a media finder: it copies a path into a stack buffer and calls
`LoadImageA(NULL, name, IMAGE_BITMAP, 0, 0, LR_LOADFROMFILE|LR_CREATEDIBSECTION)`
through `[0xc1244c]`, then retries twice with `..\%s` and `%c:\%s` before
giving up with `mov eax,3`. `--trace-api=LoadImageA` catches all three:

```
[API #724053] LoadImageA(0x0, 0x074ff65c, 0x0, 0x0, 0x0, 0x00002010) [ret=0x009b7246]
[API #724054] LoadImageA(0x0, 0x074ff65c, 0x0, 0x0, 0x0, 0x00002010) [ret=0x009b727b]
[API #724055] LoadImageA(0x0, 0x074ff65c, 0x0, 0x0, 0x0, 0x00002010) [ret=0x009b72a6]
```

and `--trace-fs` names the files: `Data\Font0-0.bmp` and
`data\load_indicator.bmp`. Neither exists anywhere in the demo, so all three
candidate paths fail on real Windows too and the game's error return is the
correct outcome.

It never got there. `$handle_LoadImageA` answered a failed `LR_LOADFROMFILE`
load with a synthetic 32x32 compatible bitmap, which passed the caller's
`test edi,edi` at `0x9b7248` and sent it down the success path — where
`GetObjectA` reported `bmBits = 0` for that device-dependent stand-in and
`rep movsd` read from address 0. The stand-in is reasonable for a resource id
the walker cannot find; for a *file*, failure is the answer, and the caller is
branching on it.

Two changes, both in `$handle_LoadImageA`/`$load_image_bitmap_file`:
`LR_CREATEDIBSECTION` now builds a real DIB section whose bits have a guest
address, and a file that will not load returns NULL. Measured on a full walk to
the land picker, total `[fault]` lines went **1089 to 1**.

### CORRECTION: the picker is alive, and only a real click wedges it

Every earlier reading of "any mouse motion hangs the land picker" rested on the
screen being byte-identical after a nudge. That test is worthless here: nothing
on this screen hover-highlights, so an identical frame is the expected result
whether the guest is running or not.

Sampling EIP instead settles it. At the picker, before any click:

```
eip samples at the picker: b53580 b53543 a011c6 a01250 a51ac8 (distinct 5)
```

Five distinct addresses over 20 seconds — the guest is stepping and rendering.
A 5-pixel `relmousemove` leaves it that way. It is a **click** that wedges it,
and then EIP pins to `0x9e5272`/`0x9e5276` for eighteen minutes of polling with
the screen at 0.0%.

What the screen actually shows is worth recording: not a menu, but a rendered
3D scene — a burning village, correct geometry and lighting — with a filmstrip
of nine land thumbnails beneath it, the second one unlocked in colour at about
(133, 378). D3D9 is drawing real content here.

With the LoadImage fixes in, that wedge now happens with **zero** `[fault]`
lines, so it is a genuine infinite loop in the grid query at `0x9e521f`, not
something `NULL_SENTINEL` is hiding. The walk to the picker also dropped from
~3600s to 962s.

### CORRECTION: it is not an infinite loop. It is a billion-iteration scan
### over a vector whose header sits on top of an ASCII string

The section above calls the pick wedge "a genuine infinite loop in the grid
query". That is wrong, and the disassembly of the pinned addresses says so
directly. `0x9e5272`/`0x9e5276` are the two halves of a plain linear
duplicate scan:

```
0x9e5260  mov edx,[esi+4]      ; n
0x9e5265  test edx,edx
0x9e5267  jle 0x9e5281
0x9e5269  mov ecx,[ebp+4]
0x9e526c  mov edi,[ecx+ebx*4]  ; needle
0x9e526f  mov ecx,[esi+8]      ; items
0x9e5272  cmp [ecx],edi        ; <-- pinned
0x9e5274  jz  0x9e52e9         ; duplicate found, skip the append
0x9e5276  add eax,1            ; <-- pinned
0x9e5279  add ecx,4
0x9e527c  cmp eax,[esi+4]
0x9e527f  jl  0x9e5272
```

`esi` is a `std::vector`-shaped object: `[esi]` capacity, `[esi+4]` size,
`[esi+8]` items. The grow path below it (`0x9e5287`..`0x9e52a1`) doubles the
capacity and calls `operator new[]` at `0xad425d`, which is the ordinary
push_back-with-dup-check shape.

The loop has an exit; it is simply `[esi+4]` iterations away from it. A live
probe read the header as `{n: 993082159, items: 993213234}`, so the scan is
~1e9 iterations — at this interpreter's throughput, days. Nothing is stuck
and nothing needs a deadlock explanation; the loop is doing exactly what it
was told, with a count that is not a count.

What the two values are is the actual finding. Decoded as little-endian
bytes:

```
n     = 0x3B313B2F  ->  2F 3B 31 3B  =  "/;1;"
items = 0x3B333B32  ->  32 3B 33 3B  =  "2;3;"
```

Contiguously `"/;1;2;3;"` — a semicolon-delimited numeric list. The vector
header is not arithmetically corrupt, it is **overlapping a string buffer**.
No such literal exists in the image (`find_string.js` finds neither
`";1;2;3;"` nor `"0;1;2;3"`), so the text is built at runtime.

This retires the earlier "operator new[] returned NULL" theory for good, and
it reframes the question. It is no longer "why does the query loop forever"
but "why does the object at `esi` — the grid reached as `[object+0x74]` from
`0x9e46c0`'s `lea ecx,[esi+0x74]` — hold text". Either something wrote a
generated list over the object, or the object pointer used at the pick points
into a text buffer.

Caveat on provenance: the `{n, items}` pair is a single probe reading, and
everything above is built on it plus static disassembly. It should be
re-read live at the picker before any fix is designed against it.

### CORRECTION: the ASCII reading of the vector header is not the best one.
### The same bytes are two adjacent, increasing IEEE floats.

The entry above reads `n = 0x3B313B2F` and `items = 0x3B333B32` as little-endian
ASCII `"/;1;"` + `"2;3;"` = `"/;1;2;3;"` and concludes the vector header overlaps
a runtime-generated string buffer. That reading is possible but it is **not
supported**, and a competing reading of the identical bytes fits better:

| dword | u32 | **f32** | ascii |
|---|---|---|---|
| `0x3B313B2F` | 993082159 | **2.704333e-3** | `/;1;` |
| `0x3B333B32` | 993213234 | **2.734852e-3** | `2;3;` |

Two consecutive slots holding `0.0027043` and `0.0027349` — same magnitude,
monotonically increasing, delta `3.05e-5`. That is the shape of an ordinary
**float array** (a curve, a weight table, a heightfield row), and it needs no
coincidence to explain: any pair of small positive floats in `[2.4e-3, 3.0e-3)`
shares the exponent byte `0x3B`, and the `;` at both odd positions is that
shared exponent, not a separator. The digits `1`/`2`/`3` in the ASCII view are
just the mantissa creeping upward. **The "string" is an artifact of reading a
float array as text.**

What was checked, and came back negative for the string reading:

- No `"%d;"`, `";%d"`, `"%s;"`, `"0;1;2"` or `"1;2;3"` format/literal string
  exists anywhere in `BW2Demo.exe` (`tools/find_string.js --all`), so nothing in
  the image builds a semicolon-separated list of that form.
- No file under `installed/` contains `;1;2;3;` or `/;1;` (recursive `grep -rl`),
  so it is not loaded data either.
- The byte run `2f 3b 31 3b 32 3b 33 3b` does not occur in
  `Construction_deltas3.raw`, `Construction_heights.raw` or
  `BnWPoolingSetup.bin`, the three raw float blobs the demo ships.

So: **do not build a fix on the "header overlaps a string buffer" story.** What
is established is only the mechanical part, which both readings share and which
is what actually wedges the game — `[esi+4]` is read as a count and holds
993,082,159, so the duplicate scan at `0x9e5272`..`0x9e527f` runs about a
billion iterations with a working exit it will not reach in any plausible time.
The open question is unchanged and still needs the live re-read: **what is the
object at `[object+0x74]` reached from `0x9e46c0`, and why is a float array (or
whatever it really is) reaching this code as a `std::vector` header** — an
uninitialised pointer, a freed-and-reused allocation, or a wrong field offset.

Both the `{n, items}` pair and everything above it remain a single probe reading
plus static disassembly. Re-read it live at the picker before designing anything.

### What `0x9e5140` actually is: a spatial-grid rect query with a 12-byte cell

Fully decoded now, and it retires *both* earlier stories. It is
`thiscall Grid::Query(ecx=grid, arg1=rectMin*, arg2=rectMax*, arg3=out*)`
(`ret 0xc` at `0x9e532f` confirms three stack args).

Grid object (`ebx`):

| off | meaning |
|---|---|
| `+0x00`,`+0x04` | origin x, y |
| `+0x08`,`+0x0c` | max x, y (bounds-reject at `0x9e516b`/`0x9e5174`) |
| `+0x10` | row length (cells per row) |
| `+0x14`,`+0x18` | cell width, cell height (the `idiv` divisors) |
| `+0x20` | cell array base |

Cell addressing, `0x9e5214`..`0x9e5236`:

```
eax = [grid+0x10] * row          ; row length * row index
eax = eax * 3                    ; lea eax,[eax+eax*2]
eax = [grid+0x20] + eax*4        ; base + rowIndex*rowLen*12
ebp = eax + col*12 + 4           ; lea ebp,[eax+edx*4+4]
```

so **a cell is 12 bytes** and `ebp` deliberately points at *cell+4*, which is
why the body reads `[ebp+0]` as the cell's count and `[ebp+4]` as its items.

The output has the same three-dword shape, and this is the part that matters:

```
0x9e4701  lea edx,[esi+0xc4]   ; arg3  <-- LEA, not a load
0x9e4712  lea ecx,[esi+0x74]   ; the grid
0x9e4715  mov [esi+0xc8],edi   ; edi=0: zero the output count
0x9e471b  call 0x9e5140
0x9e4720  mov edx,[esi+0xc8]   ; read it back as the result count
```

The second call site (`0x9e479e`) is the same pattern one object over:
grid `esi+0x9c`, out `esi+0xd0`, count `esi+0xd4`, zeroed at `0x9e4798`.

**Therefore `[esi+4]` inside the loop is `[parent+0xC8]` — the output count —
and `[esi+8]` is `[parent+0xCC]`, the output items pointer.** It was never a
`std::vector` header, so it is neither a string (retracted above) nor a float
array: it is an output counter that the caller sets to 0 on the line before the
call. The inner scan at `0x9e5272` is an ordinary "is this candidate already in
the results" dedupe over the results collected so far, which is correct and
cheap when the count is sane.

Checked, so the compiler's stack reuse is not the culprit: `0x9e5245` writes the
*column count* into arg3's incoming slot `[esp+0x30]`, but `esi` is loaded from
that slot once at `0x9e520b`, the row-loop back edge at `0x9e5320` targets
`0x9e5210` (*after* that load) and the column-loop back edge at `0x9e530b`
targets `0x9e5250`. `esi` is never reloaded. The game's code is sound.

**So the open question is now precise:** `[parent+0xC8]` is zeroed immediately
before the call and reads 993,082,159 inside it. The candidates are (a) the
zeroing store did not land, (b) the parent `this` is not the object we think,
or (c) something wrote over it in between. Note the grid at `parent+0x74`
evidently *is* valid in the same call — the bounds compares passed, neither
`idiv` divided by zero, and the cell reached had a positive count — which
argues against a wholly wild `this`.

The live probe to run at the picker is therefore **not** `esi` alone but the
parent record around it: `esi-0xC4` for the object, `esi+0` / `+4` / `+8` for
the output triple, and whether `[esi+8]` is a mappable pointer.

### The land is chosen by a startup directive, not only by the picker

`BW2Demo.exe` reads two script files by name — `.\Scripts\Map.txt` and
`.\Scripts\MPDebug.txt` — and `Map.txt` as shipped is just two lines:

```
SET_LAND_NUMBER(3)
LOAD_FEATURE_SCRIPT(".\data\landscape\BW2\Land3.bwe")
```

`MPDebug.txt` as shipped holds `SET_STARTUP("AllowSkip")`. `SET_STARTUP`
accepts exactly four values, which sit together in `.rdata` at `0xc7edc4`:

| VA | string |
|---|---|
| `0xc7edc4` | `Default` |
| `0xc7edcc` | `ForceIntro` |
| `0xc7edd8` | `AllowSkip` |
| `0xc7ede4` | `Land` |

The `AllowSkip` arm (`0x61a24e`) is a pure flag flip: it takes the global at
`[0x19504a8]`, clears bit `0x800000` and sets bit `0x400000` in `+0x10`.

The `Land` arm is the interesting one. At `0x61a037` the code compares a
*prefix* of the argument against `"Land"`, and on a match passes the rest
through `0xad6678` (atoi-shaped) into `0x60e890`, which compares the result
against the land-number global at `[0x16a8e28]` and, when it differs, resets a
block of engine state (`0x198c6b0`, `0x198b4a8`, `0x198b488`) before switching.
So `SET_STARTUP("Land3")` names a land directly — the same thing the picker is
trying to produce, reached without the picker.

Two practical consequences:

1. **Our extracted game directory is missing `Scripts/MPDebug.txt`**, which the
   shipped `installed/` tree has. That is an extraction fidelity gap, not a
   guest bug, and it means the demo has been running without any startup
   directive at all.
2. It gives a way to exercise the engine past the picker while the picker's own
   defect is still open. Reaching gameplay this way would show the engine and
   renderer work; it would **not** fix or excuse the grid-query wedge, which
   stays a separate open bug.

## The picker wedge is an unbounded scan over a NULL array

`--fault-null=1` on the picker run produced the mechanism. **Read the faults out
of `<artifacts>/run.log`, not the driver's stdout** — `tools/black-white-software-probe.js`
spawns `run.js` with piped stdio and writes the child's output to that file, so
any driver filtering stdout by line prefix discards every fault line silently.
That mistake cost a session: a run with 617,784 faults in it was reported here
as "zero faults".

`run.log` from the session-36 picker run holds **617,784 faults across 15
distinct EIPs**, and two of them carry the whole story:

| EIP | n | address range | step |
|---|---|---|---|
| `0x9e5269` | 617,414 | `0x0` … `0x25af0c` | `+4`, 617,411 times |
| `0x9e50e6` | 334 | `0x0`, then `0xb7abdea0`–`0xb7ac59a0` | `0x1800` (60×), `±4` |

The reported EIP is `(global.get $eip)` from `src/03-registers.wat:249`, which in
threaded code is the **block entry**, not the faulting instruction — so each row
names a block, and the access has to be attributed by reading that block.

`0x9e5269` is the inner loop of the query at `0x9e5140`. In sync from the entry,
`ebp = cellBase + row*[grid+0x10]*12 + col*12 + 4`, the same `+4` convention the
insert uses, so `[ebp]` is the cell's count and `[ebp+4]` its items pointer; the
loop body is `mov ecx,[ebp+4]` / `mov edi,[ecx+ebx*4]`. An address walk of
`0x0, 0x4, 0x8, …` is therefore unambiguous: **`items` is NULL and `ebx` is
counting up**, with the loop bound `[ebp]` at 617k and still climbing when the
32MB log was cut. That loop *is* the wedge — the host census either side of it
shows `get_ticks` frozen at 339620 and `log_i32` frozen at 97531 while `log`
climbs by exactly 100000 per census report, i.e. a guest spinning in one loop
that calls nothing else.

Where the NULL comes from is the insert at `0x9e5060` and its grow path:

```
0x9e50d7  mov edx,[esi]        ; count      (cell = {capacity, count, items})
0x9e50d9  cmp edx,[esi-0x4]    ; == capacity?
0x9e50df  jnz 0x9e50e6
0x9e50e1  call 0x9e8200        ; GROW
0x9e50e6  mov eax,[esi]        ; count
0x9e50e8  mov ecx,[esi+0x4]    ; items
0x9e50eb  mov [ecx+eax*4],ebp  ; items[count] = value
0x9e50ee  add dword [esi],0x1  ; count++
```

and `0x9e8200` is:

```
0x9e8204  mov eax,[esi]        ; capacity
0x9e8213  lea eax,[ebx*4]      ; new byte count (ebx = capacity ? 2*capacity : 1)
0x9e821b  call 0xad425d        ; -> 0xad41b9, MSVCRT malloc
0x9e824c  mov [esi+0x8],edi    ; items = malloc result, UNCHECKED
0x9e8250  mov [esi],ebx        ; capacity = new capacity, unconditionally
```

**There is no NULL check.** A failed `malloc` stores 0 into `items`, doubles the
recorded capacity anyway, and returns; the caller then writes through the NULL
and increments the count. Every later insert sees `count != capacity`, skips the
grow, and increments again — so the count grows without bound while the array
stays NULL. The eventual query walks that count from address 0. That is a guest
bug in the sense that the game has no check, but it only fires because the
allocation failed, which is ours to explain.

`malloc` here is the MSVCRT retry loop at `0xad41b9`: `_heap_alloc` at
`0xad566e`, and on a zero result the new-handler at `0xadc1fe` then a retry.
Note this binary calls `_set_sbh_threshold(0)` at startup (it is in `run.log`),
so the small-block heap is disabled and every one of these goes to the main
heap.

The grid object itself, from the two routines' field use:

| Offset | Meaning |
|---|---|
| `+0x08`, `+0x0c` | bounds, compared with `jge` before any indexing |
| `+0x10` | cells per row (the `0x1800` = 512×12 fault stride says 512 here) |
| `+0x14`, `+0x18` | cell size X / Y — **`idiv` divisors**, so the indexing is integer, not float |
| `+0x20` | cell array base |
| `+0x24` | running max cell occupancy |

Two things that rules out. The indexing is integer division of world coordinates,
so no float→int conversion is involved and the
`no-plain-trunc-on-guest-floats` class of bug cannot be the cause. And the
`0x1800` stride at the insert site is exactly `512 * 12`, i.e. the row arithmetic
is coherent — what is wrong is the base `[grid+0x20]` itself, which reads `0`
on some calls and `0xb7ab_xxxx` on others. Both are unmapped.

What is *not* yet established: which allocation produced those bases, and
whether our heap returned NULL, returned an unmapped non-NULL pointer, or the
base was never written at all. `0xb7ac1020` is not an address any of our
regions hands out, which is the next thread to pull.

One correction to the record: the wedge is **not** triggered by the hover, as
an earlier board entry claimed. This log shows the picker surviving two complete
click cycles (mousedown 223972 / mouseup 232249, then 285656 / 292236) and the
spin beginning only after the second — and the first fault of the run lands
after cursor motion has already started, not on the first hover.

### The allocation never failed — measured, not assumed

The obvious reading of the unchecked grow is "our heap returned NULL". It did
not. `[heap] OOM` reporting now exists for exactly this question (five refusal
paths in `$heap_alloc`, logged unconditionally), and a full 600-second run —
647,150 batches, `--memory-mb=1024`, `--fault-null` armed — produced **zero OOM
lines and zero faults**. Our heap refused this game nothing.

The measured ceilings, for anyone sizing a memory-hungry guest: 8MB allocations
run out at **312MB** on the default 512MB host memory and **816MB** with
`--memory-mb=1024`, the difference being the extension backing window above
`$THREAD_RPC`'s end. Note that `$VIRTUAL_BACKING_EXT` appears only in a comment
in `01-header.wat` — the window is real and implemented as
`$virtual_backing_ext_take` in `10-helpers.wat`, but it is not a declared
region, so grepping the name finds nothing.

So the NULL `items` is not a failed allocation, which changes what the fault
pattern means. If `malloc` always succeeded, then an `items` that reads as zero
was not *stored* as zero — it was **read from the wrong place**. A `cellBase`
pointing into unrelated but mapped memory produces exactly the observed pair: a
large garbage value where the count belongs and a zero where the items pointer
belongs. The `0x0`/`0x4` and `0xb7ab_xxxx` faults are then the cases where that
same wrong base lands somewhere unmapped rather than somewhere mapped.

That run also reached only the Lionhead logo in 600 seconds (the particle
animation renders correctly), against session 35's menu at 471s — this box sits
at load 16-45 with several agents on it, so wall-clock progress is not
comparable between runs and batch numbers cannot be reused across
configurations for input scheduling.

### The grid is an embedded member at parent+0x74

At the query call site the receiver is formed as `lea ecx,[esi+0x74]`
(`0x9e4712`), so the grid is **inline in its parent**, not a pointer to a
separately allocated object. Its cell array is therefore `[parent+0x94]`, and
the output triple the caller zeroes and reads back is `parent+0xC4/0xC8/0xCC`,
consistent with the earlier decode of the two call sites.

This matters for the remaining question: an embedded grid is constructed with
its parent, so "the cell array pointer is wrong" is not a missing allocation of
the grid itself but either an `Init(w, h, cellSize)` that never ran or one that
ran with garbage inputs.

Two dead ends recorded so they are not retried. `tools/find_fn.js` puts the
insert's entry at `0x9e505c` and `0x9e50d6`; both are wrong (`xrefs` finds no
callers of `0x9e505c`), which is the documented caution about that tool. And
`find_field.js` on offsets `0x14`/`0x94` returns 2637 and 237 hits
respectively, nearly all misaligned `adc` decodes of data — the field offsets
here are too common for a static field search to be worth anything.

## The profile gate, and the input recipe that reaches the land picker

Every session before this one stopped at a screen that looked like a hang and
was not one. Two separate gates, both now known:

**The intro is an attract loop.** Title screen → Lionhead logo → repeat,
forever. Neither a click nor a keypress dismisses it, so a run that waits for it
to end never starts. `tools/black-white-software-probe.js --skip-intro` is
mandatory: it writes the intro object's finish-frame field directly, armed once
the EIP trace range `0x00526d93-0x00526d97` fires and names the object in ESI.
Runs `rt150k.png` (title) and `rt190k.png` (logo) are the proof of the loop —
two captures 40,000 batches apart showing the two halves of the cycle.

**The game will not start without a profile.** Past the intro it puts up a
profile dialog, and the main menu is behind it. The dialog is dismissed through
DirectInput, not the renderer's mouse path:

```
355000:relmousemove:-2000:-2000   # home the DirectInput cursor
365000:relmousemove:250:277       # the OK button
385000:di-mousedown:1
395000:di-mouseup:1
430000:keydown:13                 # Enter activates "New Game"
```

That sequence reaches the **land picker** — 3D preview plus the eight land
thumbnails — reproducibly. Batch numbers are for the probe's defaults
(`--batch-size=200000 --real-ticks`); `--real-ticks` is not optional, and a run
without it burns its whole budget inside the intro.

## The 4GB host OOM at the picker was `--fault-null`, not a leak

One full-chain run reached the picker and then died with

```
[22942:...] 1099020 ms: Mark-Compact 4095.6 (4097.3) -> 4094.8 (4100.6) MB ...
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

This was read as an emulator-side unbounded allocation. It is not. The fatal
stack names `node::inspector::InspectorConsoleCall` at frame 17 with
`Builtins_NewRestArgumentsElements` above it: **the 4GB was being allocated
inside `console.log`.** Node's `process.stdout` is asynchronous when it is a
pipe, so a `console.log` the reader cannot keep up with queues in the writer's
heap instead of blocking — and a guest scanning a NULL array outruns any reader.
The Mark-Compact above reclaimed 0.2MB of 4094.8MB, so all of it was live queue,
and the last line of that run's `run.log` is a truncated mid-write
`[fault] unmapped guest access 0x0 fr`.

D3D was ruled out from the same run rather than argued about: `samples.ndjson`
shows draws flat at 3296 with `pending=0` for the last 80 seconds of sampling
while the heap kept climbing, and `submitted == consumed == completed`, so the
command queue drains.

Fixed in `bf260ef4`: `--fault-null` prints at most 64 lines per EIP and counts
the rest, with a `[fault] census` at exit naming every EIP, its true count and
the address range it walked. The cap is per EIP, so a rare fault beside a
spinning one still prints in full. Unit-tested in
`test/test-fault-null-census.js` (0.1s).

**The general warning**, which applies to every diagnostic that prints per guest
event: under `tools/black-white-software-probe.js` the child's stdout is a pipe,
and an unbounded printer there does not merely produce a large log — it kills
the run, and kills it far enough from the guest bug that the log is useless.

## Two more NULL-object faults, distinct from the grid

The same run recorded 12,675 faults at EIPs that are **not** the grid query.
`0x9e17d0` (enclosing block entry `0x9e17b0`) dereferences a NULL `edx` six
times per iteration over roughly 2100 iterations:

```
009e17d0  mov eax, [edx+0x8]
009e17d3  mov ebx, [edx]
009e17d5  mov edi, [eax]
009e17d7  mov esi, [eax+0x4]
009e17da  mov ecx, [ebx+0x8]
009e17dd  mov edx, [ecx]
```

and `0x9d4a69` null-checks a register only *after* dereferencing three others:

```
009d4a70  mov ecx, [esi]
009d4a72  mov edx, [ecx+0x4]
009d4a75  mov ecx, [edx+0x10]
009d4a78  test ecx, ecx
009d4a7a  jz short 0x9d4a87
```

These are a different NULL-object bug from the picker grid and have not been
traced to their source yet.

### Scope correction on the picker wedge

The picker does **not** deterministically wedge. One run reached it with zero
faults and zero `[heap] OOM` lines. The earlier claim that the hover triggers
the wedge was already retracted — the log shows the picker surviving two
complete click cycles first — and the ruling-out of allocation failure holds
only up to the profile screen, since the zero-OOM runs never reached a land and
the probe's own source records that *the land* commits the whole 316MB pool.

## The real wedge: a linked-list walk from a NULL head (run 39)

With the `--fault-null` cap in place the full chain ran to completion instead of
aborting, and the exit census is unambiguous:

```
[fault] census: 4533196660 unmapped access(es) from 4 eip(s)
[fault]   eip=0x9e17d0 x4533196638 addresses 0x0-0x8
[fault]   eip=0x9d4a87 x14          addresses 0x0-0x8
[fault]   eip=0x9d4a69 x6           addresses 0x0-0x10
[fault]   eip=0x9d4abd x2           addresses 0x0-0x0
```

**4.53 billion faults from one EIP.** The 12,675 reported by the run that died
of the host OOM was simply how many had been flushed before it aborted, and the
617,784 from the earlier session was the same artefact at a different EIP. Six
faults per iteration over the addresses `{0x0, 0x4, 0x8}` puts the loop at
about 755 million iterations.

`0x9e17d0` is not a separate bug from `0x9e17b0` — it is the loop body inside
it. The back edge is at the bottom of the same function:

```
009e1820  test ecx, ecx
009e1822  mov edx, ebx          ; edx = node->next, read at 0x9e17d3
009e1824  setge al
009e1827  cmp [esp+0x20], edx   ; reached the end sentinel?
009e182b  jz short 0x9e1831
009e182d  test al, al
009e182f  jnz short 0x9e17d0    ; loop
```

So the function walks a linked list — `ebx = [edx]` at `0x9e17d3` is
`node->next`, `edx = ebx` at `0x9e1822` advances it — comparing two `{x, y}`
pairs reached through `[edx+0x8]` and `[edx]` with a 64-bit cross product
(`imul` at `0x9e17e7` and `0x9e17fa`, `setge` for the orientation). It is a
geometric ordering predicate over an edge or point list, and it stops when the
cursor reaches the sentinel held in `[esp+0x20]`.

**With a NULL head it cannot stop.** `ebx = [NULL]` reads 0 through our NULL
sentinel, so `edx` stays 0, never equals the sentinel, and the loop runs
forever. On real hardware that first `mov ebx,[edx]` is an access violation and
the game would crash or unwind; our `$g2w` miss returning zero converts a crash
into a hang. That is worth remembering generally: **a NULL-sentinel read turns
somebody else's segfault into our infinite loop**, and the symptom moves from a
crash dump to a batch that never returns.

### It is not our allocator

The same run reported **zero** `[heap] OOM` lines, so the earlier hypothesis
that a refused `malloc` leaves a NULL behind does not apply here. The list is
empty for a reason further upstream.

### One object, two vtable slots

Both faulting entries are slots of the same vtable at `.rdata:0xd0bc30`:

| slot | target | faulting EIPs |
|---|---|---|
| 7 | `0x9d4a30` | `0x9d4a69`, `0x9d4a87`, `0x9d4abd` |
| 8 | `0x9d47b0` | tail-jumps to `0x9e17b0` → `0x9e17d0` |

Slot 8 is a three-instruction thunk that dereferences twice before the tail
call, so the argument the walker receives is `**arg1`:

```
009d47b0  mov eax, [esp+0x4]
009d47b4  mov edx, [eax]
009d47b6  mov eax, [edx]
009d47b8  mov [esp+0x4], eax
009d47bc  mov ecx, [ecx+0xc]
009d47bf  jmp 0x9e17b0
```

The vtable is written by the constructor at `0x9d475e` (`mov dword [eax],
0xd0bc30`, then `mov [eax+8], edx` and a `rep movsd` of 0xc dwords). A sibling
vtable at `0xd0bc1c` is written at `0x9d3742` from a `push 0x30` allocation.
Neither has been confirmed to run yet — that is the next measurement.

## Where the NULL comes into the picker (run 40, `--fault-null=stop`)

Trapping on the first fault instead of the billionth costs one short run and
names the instruction and registers outright. It fired at batch 435392, just
after the Enter that opens the land picker:

```
*** CRASH at batch 435392: unreachable
  EIP=0x009d4a69 EAX=0x36120184 ECX=0x00000000 EDX=0x009e8249 EBX=0x2eccfc98
  ESP=0x074fcf7c EBP=0x36120188 ESI=0x00000000 EDI=0x00000000
  009d4a70  mov ecx, [esi]      <-- faults, ESI = 0
```

`ESI` is set at the entry of vtable slot 7:

```
009d4a38  mov ebx, [esp+0x1c]   ; arg1
009d4a3c  mov eax, [ebx]
009d4a45  mov edi, [eax]        ; edi = **arg1
009d4a62  mov esi, edi
```

so **`ESI = **arg1`**, the same double dereference slot 8's thunk performs. Only
the innermost load is zero: `EBX` (=`arg1`) is `0x2eccfc98` and the `mov
edi,[eax]` did not fault, so `[arg1]` is a valid object and it is that object's
**first field — the list head — that is NULL**.

The caller is a virtual dispatch, and the stack return address names it:

```
009c1b40  mov ecx, [ebx+0x8]     ; items of a {capacity, count, items} container
009c1b43  mov edi, [ecx+ebp*4]   ; edi = items[ebp]
009c1b5a  mov ecx, [esi+0x28]    ; receiver
009c1b5d  mov edx, [ecx]         ; vptr
009c1b62  call [edx+0x1c]        ; slot 7 = 0x9d4a30
```

So the picker loops over `items[ebp]` of a container and asks each element for
its geometry. `[ebx+0x8]` is the same `items` field the grow routine at
`0x9e8200` writes.

### The next suspect, and why the existing diagnostic cannot see it

`0x9e8200` stores `malloc`'s result into `items` **unchecked** at `0x9e824c` and
raises the recorded capacity anyway at `0x9e8250`, so a failed allocation leaves
`items` NULL behind a capacity that says otherwise. The zero `[heap] OOM` lines
do **not** rule that out here: `0x9e821b` calls `0xad425d` → `0xad41b9`, the
demo's own statically linked MSVCRT `malloc`, which suballocates memory it
already owns. `$host_heap_oom_trace` only covers our `$heap_alloc` and is blind
to a guest CRT running out inside its own arena.

`EDX` holding `0x009e8249` at the fault — an address inside that very routine —
is consistent with it having run recently on this stack, though a stale register
is weak evidence on its own.

`0x9e8220` is the call-return landing of that `malloc`, so `EAX` there is every
result the grow path receives. That is one `--trace-at` address (two or more
force `BATCH_SIZE=1` and the run never arrives), and it is the measurement that
decides whether the NULL is an allocation failure our diagnostics cannot see or
something the game never built.

### `--fault-null=stop` is a lottery on this app (run 41, negative)

Run 41 asked the grow-path question with `=stop` still set and never reached the
picker: it trapped at **batch 34226**, during startup, on a probe of address
`0x403` from `eip=0x9e8200`, with the trace-at at `0x9e8220` never firing once.

`=stop` traps on the first fault *anywhere*, and run 39's full census — four
EIPs, none of them `0x9e8200` — shows that startup probe does not even occur on
every run. These runs are not deterministic; `--real-ticks` paces them against
wall clock on a box whose load moves. **Run 40's clean landing on the picker
fault was luck, not method.**

Since the cap landed there is no reason to use `=stop` here at all: plain
`--fault-null` can no longer OOM the host, so the run goes all the way into the
wedge and the exit census gives the totals. Use `=stop` only when the first
fault is known to be the one you want.

## The grow path's malloc never fails (run 42) — hypothesis retired

Run 42 answered the question directly. `--trace-at=0x9e8220` captured every
result the grow routine's `malloc` returned:

```
--- grow-path mallocs: total, then how many returned NULL ---
330
0
```

**330 allocations, none of them NULL.** So the unchecked store at `0x9e824c`
never stores a NULL on this path, and the story that a failed `malloc` leaves
`items` NULL behind a lying capacity — carried since `55d3f714` — is **retired
for the picker**. It remains a real latent bug in the binary; it is simply not
what happens here. Together with the zero `[heap] OOM` lines, allocation failure
is now ruled out at both levels: ours and the guest CRT's.

Hit counts from the same run:

```
0x009e8200 = 1325     (grow routine)
0x009d4a30 = 10       (vtable slot 7)
0x009e17b0 = 303      (the walker)
0x009c1a90 = 1        (the picker loop that calls slot 7)
```

The picker loop runs **once**, and the walker is entered 303 times — 302 of
which return. The 303rd is the one that never does, and it alone accounts for
2,430,389,141 of the run's 2,430,395,741 faults.

### A second faulting site, with attribution caveats

`eip=0x9e8200` faulted 6578 times over `0x0-0xffffffff`, and the printed
samples repeat a short cycle:

```
0x403, 0x3ff, 0x4, 0x0, 0x4, 0x0, 0x4, 0x403, 0x3ff, 0x4, 0x0, ...
```

`0x3ff`/`0x403` are four apart, and `0x0`/`0x4` alternate — two-field reads from
a NULL base, and from a base of about `0x400`. Run 41's trap in the same routine
had `EBP=0x3ff` and `EDI=0x400`: **a small integer near 1024 is being used as a
pointer**, which reads like a count or size fetched from the wrong field.

Treat the 6578 with caution. The block entered at `0x9e8200` contains exactly
one memory read (`mov eax,[esi]` at `0x9e8204`), yet `--count` puts entries at
1325 — fewer than the faults attributed to it. The documented caveat applies:
the reported EIP is the block entry the threaded code last set, not the faulting
instruction, so some of these faults belong to later blocks in the same routine
(the copy loop at `0x9e8230` reads `[ecx+eax*4]` from the *old* items array).
The count/fault mismatch is unexplained and should not be reasoned from until
it is.

### Where the next session should start

The container is the thing to look at, and `0x9c1a90` running exactly once makes
it cheap to catch: `--trace-at=0x9c1a90` prints `EBX`/`ESI` at that single
entry, which gives the concrete container address, and a following
`--input=N:dump-mem:` of `[ebx]`, `[ebx+4]`, `[ebx+8]` says whether `items` is
NULL or whether `items` is valid and its *elements* are. Run 40's registers say
the latter — `arg1 = items[ebp] = 0x2eccfc98` was a valid pointer whose first
field was zero — so the likeliest remaining shape is a container of live objects
that were never initialized, not a container that was never allocated.

## The picker loop, and what the code actually is (runs 43-44)

### The loop

```
009c1ad6  xor ebp, ebp
009c1ad8  cmp [ebx+0xc], ebp        ; count
009c1adb  jle 0x9c1b31
009c1b40  mov ecx, [ebx+0x8]        ; items
009c1b43  mov edi, [ecx+ebp*4]      ; element = items[ebp]
009c1b62  call [edx+0x1c]           ; slot 7
009c1b87  add ebp, 0x1
009c1b8a  cmp ebp, [ebx+0xc]
009c1b8d  jl 0x9c1b40
```

A plain `ebp++` walk of `items[0 .. [ebx+0xc])`. Run 42 counted **10** entries
into slot 7, so elements 0-9 are processed and the **eleventh** is the one that
never returns. Run 43 caught the loop returning with `EBP` = 1, 5, 9 at batches
434575-434577 (`--trace-at` re-arms per batch, so it samples rather than logs
every iteration) and then stops: container `EBX=0x36120780`, receiver
`ESI=0x36120640`, elements at `0x2eccfca8`, `0x2eccfd48`, `0x2eccfda8`. Those
addresses recur across runs — run 40's stack held the same `0x36120xxx` values —
so they can be dumped directly.

### It is Qhull, inside RenderWare Physics

The binary carries

```
@@(#)$Id: //BW2/Libs/THIRDPARTY/Renderware/RWPhysics37.040623/Src/QHull/RwpQHullWrapper.c#3 $
qhull precision error: initial simplex is not convex. Distance=%.2g
qhull precision error: f%d is flipped (interior point is outside)
qhull internal error (qh_infiniteloop): potential infinite loop detected
```

So this whole family is **Qhull**, the convex-hull/Delaunay library, used for
physics hulls. That fits every structural reading so far: `0x9e17b0`'s 64-bit
cross products with a `setge` are an orientation predicate, and it walks a
linked list of facets or vertices to a sentinel. The `{capacity, count, items}`
container grown by doubling at `0x9e8200` has the shape of Qhull's `setT`.
(The specific function identities are inference from shape, not confirmed
against a reference build — the wrapper path and the error strings are the hard
evidence that it is Qhull at all.)

**Why this matters for us specifically: Qhull is precision-sensitive.** Its
whole error vocabulary is about coplanar, concave, flipped and non-convex
results from floating-point comparisons near zero. We emulate x87, so a
difference in precision or rounding is exactly the kind of thing that sends it
down a degenerate path the same input would not take on real hardware — and a
Qhull that bails leaves the sets it was building empty, which is the NULL head
the walker then cannot escape. That the library ships its own
`qh_infiniteloop` detector says the authors knew this failure mode.

No `qhull ... error` text appears in any run's log, but that is weak evidence:
Qhull writes diagnostics to its `qh ferr` stream and the RenderWare wrapper need
not point that anywhere.

**Next measurement:** `--trace-fpu` across the picker. Zero `[fpu]` lines would
say the complaint is not an x87 status read and send the search back to the
object graph; exceptions raised around the wedge would make precision the prime
suspect and give a concrete emulator-side lead.

## The empty list belongs to specific elements, not to the end of the array

Run 46 put one `--trace-at` on `0x9d4a69`, the block entry inside vtable slot 7
where `ESI` already holds `[[element]]` — the list head the walker spins on —
and `EBX` still holds the element itself:

| loop index | element | `[[element]]` |
|---|---|---|
| 1 | `0x2eccfca8` | **0** |
| 5 | `0x2eccfd48` | `0x2eb30300` |
| 9 | `0x2eccfda8` | `0x2eb30f6c` |

Run 40's trap named element `0x2eccfc98` — index 0, sixteen bytes before index
1 — so the first two elements are both empty and elements 5 and 9 are not.

**This retires the off-by-one reading.** The question recorded earlier was
whether the loop bound is larger than the array holds, so that the walk runs off
into uninitialized slots. It does not: the empty elements are at the *front*,
interleaved with populated ones, and the loop bound is never reached because the
wedge happens first. Some elements carry a list and some carry nothing.

`--trace-at` samples once per batch, so those three rows are three different
batches of the same loop; they are not the only elements visited.

**The run is deterministic once it is on this path.** Runs 42 and 46 returned
byte-identical hit counts — `0x9e8200 = 1325`, `0x9c1a90 = 1`, `0x9d4a30 = 10`,
`0x9e17b0 = 303` — and the same element addresses appear in runs 40, 43 and 46.
Only *reaching* the path is unreliable, which is a separate problem (below). So
these addresses can be dumped directly rather than hunted for again.

## Slot 7 dereferences the empty list too — it just survives it

`0x9d4a30` is a do-while: it loads `edi = [[arg1]]`, sets `esi = edi`, and runs
the body before `cmp edi, esi / jnz` can stop it. With an empty list both are
zero, so the loop body reads `[0]`, `[0+8]` and `[0+0x10]` once and then exits
because `edi == esi`. That is exactly the census's small change:

```
[fault]   eip=0x9d4a87 x14 addresses 0x0-0x8
[fault]   eip=0x9d4a69 x6  addresses 0x0-0x10
[fault]   eip=0x9d4abd x2  addresses 0x0-0x0
```

So the empty list is *not* a state this code tolerates by design — on real
hardware those reads are an access violation, not a cheap early exit. Slot 7
merely gets out after one pass, while slot 8's walker (`0x9e17b0`) has no
matching escape and spins. Both read the same field of the same object. The
divergence between a crash and a hang is ours: `$g2w`'s NULL sentinel turns the
faulting read into a zero, and a zero is a valid cursor.

That is worth stating plainly, because it means **the wedge is a symptom with a
one-line description: elements 0 and 1 should have a list and do not.** Nothing
about the walker, the container, the grow path or Qhull's precision needs to be
true for that to be the whole bug.

## Two measurement traps this cost a run each

**`dump-mem` at a pinned batch number cannot tell "not built yet" from
"empty".** Run 45 dumped the picker's container at batches 434570-434580 and got
four pages of zeros. The capture at the profile gate showed why: that run was
still sitting on the "New Profile Name" dialog, 434570 meant nothing in it, and
the container had never been allocated. Zeros from `dump-mem` are an honest
report of an unmapped address — `--dump-vmap` says so in as many words — so
they read exactly like a cleared structure. Every run that pins an input to a
batch number now photographs the gate at batch 400000 first; if the dialog is
still up there, nothing later in that run means anything.

**The click that dismisses the profile dialog is not reliable.** The identical
recipe reached the picker in runs 39, 42, 43 and 46 and stalled at the dialog in
run 45. These runs use `--real-ticks`, so batch numbers drift with host load,
and the box is regularly at load 11. Budget for a re-run rather than reading a
diverged run's output as data.

## The picker's elements decode, and the empty thing is one array slot

Dumping each element at the `0x9d4a69` trace hit (run 47) gives a flat 16-byte
record:

```
0x2eccfc98  08 00 c3 2e | 00 00 00 00 | 02 00 00 00 | 00 00 00 00   id 0   kind 2
0x2eccfca8  30 00 c3 2e | 01 00 00 00 | 02 00 00 00 | 00 00 00 00   id 1   kind 2
0x2eccfcb8  00 00 00 00 | 02 00 00 00 | 04 00 00 00 | 00 00 00 00   id 2   kind 4
0x2eccfd48  c0 01 c3 2e | 0b 00 00 00 | 02 00 00 00 | 00 00 00 00   id 11  kind 2
0x2eccfd58  00 00 00 00 | 0c 00 00 00 | 04 00 00 00 | 00 00 00 00   id 12  kind 4
```

So an element is `{record*, id, kind, 0}`. The pointers are not scattered
allocations: they are an array of **40-byte records at `0x2ec30008 + 0x28*id`**,
and id 11 lands on `0x2ec301c0` exactly. Kind 4 elements carry no record at all
(the pointer is NULL and nothing dereferences it — vtable slot 7 and slot 8 are
only reached for kind 2), which is why a NULL pointer there is not the bug.

That narrows the failure by one more level. The array exists. Record 0 and
record 1 exist and are addressable. Record 11 holds a real list head
(`0x2eb30300`, and id 9's is `0x2eb30f6c`). **Only the contents of records 0 and
1 are missing** — their head word is zero while their neighbours' are not.

Vtable slot 13 (`0x9d47a0`) reads `[[element]+0x24]`, the last dword of the same
40-byte record, so the record is a small fixed struct, not a class with a vptr.
Slot 10 (`0x9d47f0`) is `getVertex(obj, i)`: it walks `[record]` forward `i`
times and returns `[node+8]`. Slot 7 collects consecutive pairs of `[node+8]`
points into 20-byte `{x1,y1,x2,y2,_}` records, so the list is an **edge ring**
and `[record]` is its first node.

**The question is now narrow enough to answer with a watchpoint rather than a
disassembly:** was `0x2ec30008` ever written? Never written means whatever
builds these rings skipped the first two. Written and later cleared means a
lifetime bug, and `--watch-log` times it.

## The record array is a 7000-entry pool, and six of the first thirteen are blank

Dumping 512 bytes at `0x2ec30000` during the picker (run 48) decodes the whole
structure. `0x2ec30000` is the heap block header (`0x000445d8` bytes),
`0x2ec30004` is the entry count (`0x1b58` = 7000), and the records start at
`0x2ec30008` with a `0x28` stride — which is exactly the
`element->record = 0x2ec30008 + 0x28*id` arithmetic the elements show, so the
records are **indexed by element id, not allocated per element**.

`0x9d7690` builds these blocks: it calls `malloc(count*40 + 4)`, stores the
count at `+0`, takes the array at `+4`, appends the block to a vector of blocks,
and then links every record's first field to the next record `0x28` along,
terminating the last one with zero (`0x9d7708`). So the first field doubles as a
free-list `next` while a record is unused and as the edge-ring head once it is
in use, and **a zero there is also what the tail of the free list looks like**.

A filled record is `{listHead, 0, element*}`: record 11 at `0x2ec301c0` holds
head `0x2eb30300` and back-pointer `0x2eccfd48`, which is element id 11's own
address. Across ids 0..12:

| | ids |
|---|---|
| filled | 3, 4, 7, 9, 10, 11, 12 |
| empty | 0, 1, 2, 5, 6, 8 |

**Record 0 was never written as a record at all.** Its `+8` — the slot that
holds the element back-pointer in every filled record — is `0x44bb8000`, the
float `1500.0`, repeated across `+8`..`+0x1c`. That is not a cleared record;
it is a record that something else's data is sitting in.

So the earlier reading of run 48's watchpoint sequence
(`0 → 0x2ec30030 → 0x2eb30058 → … → 0x2eb30710 → 0`) as "built then cleared" is
wrong, and is retracted: `0x2ec30030` is `record0 + 0x28`, which is precisely
what `0x9d7690`'s initializer writes, and the later values are all in a second
pool block (`0x2eb3xxxx`). That is free-list churn passing through record 0's
`next` field, not an edge ring being pushed. The final zero is record 0 becoming
the free-list tail again.

**Elements 0 and 1 are the anomaly, and it is a straightforward one:** they are
kind 2, so slot 7 and slot 8 both dereference their record, and their record was
never filled. Kind 4 elements (ids 2 and 12) carry a NULL record pointer instead
and are never dereferenced at all, so the blank records at those ids are
expected.

**A caution on the watchpoint's EIP.** `--watch` reports the block the guest was
in when the change was observed, and that is only the writing block when the hit
ends the batch. Run 49 filtered to the write of zero and reported
`EIP=0x9e1804 ... EAX=0 ECX=0 EDX=0 EBX=0 EBP=0 ESI=0 EDI=0` — every register
zero, inside the walker, which is the wedge's own steady state. The walker's
only store is `mov [esp+0x14], eax` to a stack local, so it cannot have been the
writer. Read a watch EIP as "where execution was", and corroborate it against
what the named instruction actually writes before believing it.

## The walker has no entry guard, so an empty list cannot be the wedge

The reading above — "elements 0 and 1 are kind 2, their record was never
filled, slot 7 survives the empty list and slot 8 spins on it" — names the
right elements and the wrong mechanism, and the second half is retracted.
Disassembling the walker's prologue is enough to see why:

```
009e17b0  sub esp, 0xc
009e17b3  mov eax, [esp+0x14]      ; arg2
009e17b7  mov ecx, [eax+0x4]
009e17ba  mov eax, [eax]
009e17bc  mov edx, [esp+0x10]      ; arg1 -> edx, the cursor
009e17c0  push ebx / push ebp / push esi
009e17c3  mov [esp+0x20], ecx
009e17c7  mov [esp+0xc], eax
009e17cb  push edi
009e17cc  lea esp, [esp+0x0]       ; padding, falls straight through
009e17d0  mov eax, [edx+0x8]       ; <-- loop body, no test of edx first
...
009e1822  mov edx, ebx             ; ebx = [edx], the next link
009e1827  cmp [esp+0x20], edx
009e182f  jnz short 0x9e17d0
```

There is no `test edx,edx` anywhere between the entry and the loop body: the
prologue loads, pushes and falls through. So this is a do-while over a
**circular** list, and the terminator it compares against is the head it was
handed. Which settles the empty case: with head `0`, the first body pass reads
through the NULL sentinel, `ebx = [0] = 0`, `edx = 0`, and `cmp head, edx`
compares `0` with `0` — equal, so `jnz` is not taken and the walker *returns*.
An empty list exits immediately here, exactly as it does in slot 7.

**A spin therefore requires a non-zero head whose chain reaches zero** — a list
that is truncated rather than empty, whose last node's `next` was never pointed
back at the head. The run's own fault census agrees: `eip=0x9e17d0` faults at
addresses `0x0`-`0x8`, which is `[edx+8]`, `[edx]`, `[eax]`, `[eax+4]`, `[ebx+8]`
and `[ecx]` with `edx = 0`, i.e. the cursor is NULL *inside* the walk while the
head that terminates it is not.

That also explains why a NULL cursor is fatal here and harmless on real
hardware in the other direction: on a real CPU `mov eax,[edx+8]` with `edx = 0`
is an access violation and the game would crash, so the truncated list is a bug
the game never sees on Windows. Under `$g2w`'s NULL sentinel the read returns
`0`, the link stays `0`, and the exit test never matches the non-zero head —
[the sentinel converts an access violation into an infinite loop](#).

## --fault-null reports the block entry, not the faulting instruction

Three of the five EIPs in run 51's fault census look impossible until you know
this, and then they decode exactly. `0x9d4a69` is `mov eax, [esp+0x30]`, a
stack access that can never be unmapped — but it is the *entry* of the block
that continues into slot 7's loop head, and the addresses the census reports
for it are `0x0`, `0x4` and `0x10`:

```
009d4a70  mov ecx, [esi]           ; esi = 0   -> 0x0
009d4a72  mov edx, [ecx+0x4]       ; ecx = 0   -> 0x4
009d4a75  mov ecx, [edx+0x10]      ; edx = 0   -> 0x10
```

Three dereferences, three reported addresses, in order. Likewise `0x9e17d0`'s
`0x0`-`0x8` is the walker body with a NULL cursor. So read a `[fault]` EIP the
way you now read a `--watch` EIP: it names the block, and the instruction is
somewhere inside it. Counting the memory accesses in that block against the
fault count is worth doing — where the two disagree, the block is not the one
the linear disassembly suggests.

## The element↔record pairing is computed, and the build pass disagrees with it

Run 51 captured the whole element array and the whole head of the record pool
in the same `--trace-at` hit, so for the first time the two can be read against
each other instead of one at a time. Elements are 16 bytes at `0x2eccfc98`,
`{record*, id, kind, 0}`, with `id` simply ascending; pool records are `0x28`
apart from `0x2ec30008`.

The pairing is **arithmetic, not allocation**: every kind-2 element's `record*`
is exactly `0x2ec30008 + id*0x28`, checked on all seven of them. So "record
index == element id" is a fact here, not an inference, and a blank record is
not an unallocated one — the pool is preallocated at startup (7000 entries,
from the init at `0x9d79f0`), and the record for element *i* exists whether or
not anything ever filled it.

Reading the two arrays against each other splits the records almost perfectly
*against* the element kind:

| records | `+8` back-pointer | element kind | element's `record*` |
|---|---|---|---|
| 2, 3, 6, 7, 12 | set (built) | 4 | NULL — never read |
| 0, 1, 4, 14 | zero (never built) | 2 | points straight at the record |
| 9, 10, 11 | set (built) | 2 | points at it — consistent |

Two earlier readings die here:

- **"Kind 4 elements carry a NULL record pointer and are never dereferenced, so
  the blank records at those ids are expected"** is retracted. It has it
  backwards: the records that *were* built are mostly the ones belonging to
  kind-4 elements, which nothing will ever read, while the records that kind-2
  elements point at are mostly the blank ones.
- The filled/empty id list from the previous session (`filled 3,4,7,9,10,11,12`)
  was read off record heads alone and is right about the heads, but it was
  matched to the wrong elements. Record 4's head is set while its back-pointer
  is zero; record 2's back-pointer is set while its head is zero. Head and
  back-pointer are written by different things and must be read separately.

So the wedge is not one element being special. **The build pass and the read
pass disagree about which elements matter**, and the walker dies on a record
the build pass skipped. Whether record 1 was never written or was written and
then lost is the next thing to measure — and note that neither `--watch`'s EIP
nor `--fault-null`'s can answer *who*, so the question to ask of a run is when
a write lands, not where it came from.

## How far it actually gets, and what the wedge is not

Worth stating plainly, because "wedged in a geometry walker" undersells it: the
software-renderer probe now gets **past the main menu and into the
land-selection screen**. Run 51's gate capture at batch 400000 is the profile
menu with the world map drawn and "New Game" highlighted, and its final frame
is the land-selection screen — a rendered Greek village on fire with a
filmstrip of eight island thumbnails along the bottom. The renderer is not the
problem here.

That reframed the wedge as possibly a *hover* path: every run so far had parked
the cursor at (250,277), in the middle of the rendered scene, and the picker
(`0x9c1a90`) is the kind of query a mouse-over drives. If so, clicking a
filmstrip thumbnail instead would never run it, and would reach gameplay with
no source change — which matters, because a rebuild is not available while
other agents hold `src/` dirty and `--no-build` is mandatory.

**That is wrong, and run 53 settled it.** With Enter pressed 25000 batches
earlier and the cursor parked on the filmstrip rather than the scene, the hit
counts came back byte-identical to runs 42, 46, 47 and 51:

| probe | hits |
|---|---|
| `0x9e8200` vector grow | 1325 |
| `0x9c1a90` picker | 1 |
| `0x9d4a30` slot 7 | 10 |
| `0x9e17b0` walker | 303 |

The run never advanced far enough to write the capture scheduled 20000 batches
after the Enter, so the wedge happens on *entering* land selection, before any
click can be delivered. The picker runs exactly once, the walker 303 times, and
the guest stops — the same way, in the same place, whatever the cursor is doing.

So the sequence is fixed: entering land selection runs the build, the build
leaves a list the walker cannot terminate on, and no input schedule routes
around it. Reaching gameplay needs the underlying defect fixed, not avoided.

**One caution for whoever picks this up.** `--trace-at`'s register dump is
taken at the breakpoint, so it is contemporaneous with the hexdump beside it
(`test/run.js` takes both in the same block) — but the registers are whatever
the *paused* instruction sees, not what an earlier instruction loaded. At
`0x9d4a69` I read `EAX` as `element->record` from `mov eax,[ebx]` eight
instructions back and built a translation-divergence theory on it; `xor eax,eax`
clears it at `0x9d4a4a` and `call 0x9d6600` returns into it, so `EAX` there is
the resize's return value and the theory was about nothing. The register that
does survive is `EDI`, loaded once at `0x9d4a45` — and it confirms the dump
exactly: element 11's `EDI` is `0x2eb30300`, which is the head the hexdump
shows at `0x2ec301c0 = 0x2ec30008 + 11*0x28`, and element 1's is `0`, matching
its record. Check which instruction last wrote a register before reading
meaning into it.

## The walker returns 303 times; a spiral search calls it, and only the last call hangs

Tracing the walker's own entry (`0x9e17b0` is a function entry and so a legal
`--trace-at` point, and at entry the stack still holds the arguments) changed
the shape of this problem. The walker is not stuck inside one call for the
whole run. It is called, it returns, and it is called again:

```
#14 EAX=0x2eb30990 EDX=0x2ec30620 ESI=0x0177c660 EDI=0x00000001  [esp+4]=0x2eb30990
#15 EAX=0x2eb30990 EDX=0x2ec30620 ESI=0x0177c680 EDI=0x00000001  [esp+4]=0x2eb30990
#16 EAX=0x2eb30990 EDX=0x2ec30620 ESI=0x0177c660 EDI=0x00000002  [esp+4]=0x2eb30990
#17 EAX=0x2eb30990 EDX=0x2ec30620 ESI=0x0177c680 EDI=0x00000002  [esp+4]=0x2eb30990
```

Same list every time; `ESI` cycles a small table (`0x177c658`, `660`, `670`,
`680`, `690`) and `EDI` climbs in pairs. That is the spiral at `0x9c4f87`
(`mov esi, 0x177c658`) sweeping outward, calling slot 8 as a predicate — the
call site is `call [eax+0x20]` followed by `test al,al` — and getting false
back each time. Two heads dominate: `0x2eb30990` (38 of the traced calls) and
`0x2eb30ff8` (25).

So `0x9e17b0 = 303` is 303 completed predicate evaluations, not one long hang,
and **only the final call fails to return**. `--trace-at` re-arms once per
batch, so the last traced entry is the batch the guest never left, and it names
the offender exactly:

| | |
|---|---|
| head (arg1, after slot 8's thunk substitutes `[[arg1]]`) | `0x2eb30ff8` |
| record (`EDX`) | `0x2ec30ad0` |
| spiral counter `EDI` | `0xc` |

`0x2ec30ad0` is `(0x2ec30ad0 - 0x2ec30008) / 0x28` = **record 69**. That
retires blank records 0 and 1 as the story: the element array runs far past the
sixteen entries decoded above, and the wedge is nowhere near them. It also
explains the harmless part of the fault census — the walker is a do-while, so a
genuinely empty list executes the body once, faults on `[0]`/`[0+4]`/`[0+8]`,
then exits because `head == edx == 0`. Those single faults are the empty
records; the 937 billion are one call that cannot leave.

Why that one cannot leave follows from the loop shape already established: the
exit test is `cmp head, edx` after `edx = [edx]`, `head` is non-zero here, and
the census puts the faults at `edx = 0`. A zero cursor never equals a non-zero
head, so **the chain from `0x2eb30ff8` contains a node whose next pointer is 0**
— the ring does not close and the walk runs off the end.

Node layout, read off a healthy chain (element 11's, at `0x2eb30300`) at a
20-byte stride, which decodes cleanly and agrees with slot 10's
`mov eax,[eax]` / `mov eax,[eax+8]` idiom:

```
+0x00  next        +0x04  prev       +0x08  point*
+0x0c  ?           +0x10  owner record*   <- matches the record the head came from
```

## The ring is open, and that is only fatal when the answer is "inside"

The previous section predicted a node with `next == 0` in the chain from
`0x2eb30ff8`. Dumping the node pool (`--dump=0x2eb30000:32768`, which covers
every link address seen) and walking it by pointer confirms it, and the chain is
short:

```
0x2eb310c0 -> 0x2eb305a8 -> 0x2eb30ff8 -> 0x2eb307d8 -> NULL
point:      0x2ec747a8    0x2ec7479c    0x2ec74790    0x2ec74784
```

Four consecutive point objects 12 bytes apart — a quadrilateral whose last edge
is missing. The head the thunk hands the walker is the *third* of the four, so
the walk reaches the open end after two hops.

**Read only `+0x00` (next) and `+0x08` (point) as known.** The earlier guess of
`+0x04 prev` / `+0x10 owner` does not survive a pool-wide audit: forward chains
routinely walk far past the node count of the record at `+0x10` (39 hops for 7
nodes), and 548 nodes have `next->prev != self`. Those two offsets are
retracted. The walker itself only ever dereferences `+0` and `+8`, so those are
the only fields with ground truth behind them.

### Why an open ring is usually harmless

Disassembling the whole loop shows the walker is a **convex point-in-polygon
test**, not a plain list walk. Per edge it takes vertex `A = [[edx+8]]` and
`B = [[edx]+8]`, forms two cross products, and `setge al`. The bottom is:

```
009e1820  test ecx, ecx
009e1822  mov edx, ebx            ; edx = next
009e1824  setge al
009e1827  cmp [esp+0x20], edx     ; <- the HEAD, see the slot note below
009e182b  jz short 0x9e1831       ; wrapped: done
009e182d  test al, al
009e182f  jnz short 0x9e17d0      ; still inside: keep going
```

So there are **two** exits: the ring closed, or the point fell outside an edge.
A point that is outside leaves on the first failing edge and never reaches the
open end — which is exactly why 303 calls returned and only the 304th did not.
An open ring is a latent defect that fires only when the query answers "inside".

`[esp+0x20]` really is the head, and the arithmetic is worth writing down
because two different slots alias to `0x20` at different depths. After
`sub esp,0xc`, arg1 sits at `[esp+0x10]` and arg2 at `[esp+0x14]`. At
push-depth 3, `mov [esp+0x20],ecx` writes the **arg2** slot (stashing the
point's y). One more `push edi` later, at push-depth 4, `cmp [esp+0x20],edx`
reads one slot lower — the **arg1** slot, the original head. The same
arithmetic independently checks out on `[esp+0x24]` (= y) and `[esp+0x10]`
(= x) inside the body.

The caller's arg2 is `lea esi,[esp+0x18]`, a stack `{x,y}` pair, not a list
record — so there is no "end sentinel" reading available. The terminator is the
head and nothing else.

### Why this has to be our bug

With `edx == 0` every load returns the NULL sentinel's zero, so `ecx` ends at 0,
`setge` makes `al = 1`, and `cmp head, 0` is never equal. **Both** loop
conditions are permanently true. On real hardware the same open ring takes an
access violation at `[0+8]` instead, so the shipped game cannot be walking an
open ring here — a write that closes it is going missing on our side. The node
pool itself is mapped (we just dumped 32KB of it), so the store is not vanishing
into the sentinel at the node.

The walker has exactly one entry point — `xrefs` and `find-refs` both report a
single reference, the slot-8 thunk `0x9d47b0` — so `head = [[element]]` =
`record->head`, and `[record+0]` has one known writer (`0x9c1b04`,
`mov [edi],eax`) and one known eraser (`0x9c0c50`, `mov dword [ecx],0`).

### Retracted along the way

`0x9e8200` (the vector grow) faults 6578 times against 1325 entries, and
`1325 x 5` derefs `= 6625` is tempting — but the printed addresses refute
"every grow has an unmapped `this`". They are small structured integers
(`0x0, 0x4, 0x3ff, 0x403, 0x1b57, 0x1b5b, 0x1f3f, 0x1f43`) repeating in a
7-per-cycle pattern, not garbage pointers. Note `0x3ff`, `0x1b57`, `0x1f3f` are
`1024-1`, `7000-1`, `8000-1`, and 7000/8000 are two of the pool capacities from
`0x9d79f0` — capacity *values* being used as addresses. Only the first 64 faults
per EIP are printed, so this sample may be startup traffic unrelated to the
wedge. Unresolved, and deliberately not on the critical path.

## The nodes are half-edges, and the layout retraction above is itself retracted

`0x9de000` and `0x9de030` are the node constructors. Both take a node from the
30000-entry pool at `0x177c940` and zero all five fields; `0x9de030` then sets
`+8` to its argument:

```
009de030  mov ecx, 0x177c940
009de035  call 0x9de0a0          ; pool alloc
009de044  mov [eax], ecx         ; +0x00 = 0
009de046  mov [eax+0x4], ecx     ; +0x04 = 0
009de049  mov [eax+0x8], edx     ; +0x08 = the point argument
009de04c  mov [eax+0xc], ecx     ; +0x0c = 0
009de04f  mov [eax+0x10], ecx    ; +0x10 = 0
```

The pool's element size is confirmed by its constructor `0x9d77d0`:
`lea eax,[ebx+ebx*4]` then `lea ecx,[4+eax*4]` = `20*count + 4`, and the array
base is `malloc+4` (the header dword holds the count). Every node address seen
is `≡ 8 (mod 20)` from `0x2eb30000`, consistently.

`0x9e1670` is the builder — a half-edge mesh split. It allocates four nodes
(four `call 0x9de030` in a row) and wires them into a doubly-linked circular
list, then walks the ring to stamp the face pointer:

```
009e16f1  mov [ebp+0x0], edi      ; next
009e16f4  mov [edi], ebx          ; next
009e16f6  mov [ebp+0x4], edx      ; prev
009e1700  mov [ecx], eax
009e1702  mov [eax], esi
009e170b  mov [eax+0x4], edi      ; prev
...
009e1730  mov [eax+0x10], ebp     ; face
009e1733  mov eax, [eax]
009e1735  cmp eax, esi
009e1737  jnz short 0x9e1730
```

So the layout is `+0x00 next, +0x04 prev, +0x08 point*, +0x10 face*` after all.
**The retraction in the previous section was wrong and is withdrawn.** The
pool-wide audit that motivated it compared a ring's length against the nodes
carrying that face *within a 32KB dump of a 600KB pool*; rings whose other nodes
fall outside the window read as absent, which is what produced "39 hops for 7
nodes" and 548 apparent `next->prev != self`. A windowing artifact, not a layout
error.

### What that says about the open node

Note `0x9e1730`'s loop has the same shape as the walker and terminates *only* by
closing the ring — and it is what writes `+0x10`. The dead node `0x2eb307d8`
carries `+0x10 = 0x2ec30ad0`, the wedging face. So it was a member of a closed
ring when that stamp was written, and its `next` went to zero **afterwards**.

That rules out "the builder never finished" and points at a node being released
— or re-constructed — while still reachable from `0x2eb30ff8`. Its surviving
state fits a fresh constructor exactly: `+8` holds a point, `+0` and `+0xc` are
zero. The free path to examine is `0x9de220`, called twice at the tail of the
builder (`0x9e173d`, `0x9e1746`).

## The ring was built correctly, then broken one batch later

Watching the dead link itself (`--watch=0x2eb307d8 --watch-log`) gives its whole
life history, and it overturns the "never linked" reading:

| batch | old | new | note |
|---|---|---|---|
| 435416 | `0x00000000` | `0x2eb307ec` | pool ctor threading the free list — `ESI=0x177c940`, `EBX=0x7530`, `+20` stride |
| 435420 | `0x2eb307ec` | `0x2eb30fa8` | |
| 435421 | `0x2eb30fa8` | `0x2eb310c0` | **ring closed** — `0x2eb310c0` is the first node of run 57's walk |
| 435422 | `0x2eb310c0` | `0x00000000` | **broken** |

At batch 435421 the ring is complete and consistent with the walk:
`0x2eb307d8 -> 0x2eb310c0 -> 0x2eb305a8 -> 0x2eb30ff8 -> 0x2eb307d8`. One batch
later the closing link is zero. So this is not a build that stopped short — the
quadrilateral was correct and something unlinked it.

Two suspects die here. `0x9c0c50`, the reset that zeroes `[ecx]`, has a hit
count of **0** for the whole run. And re-construction is out: `0x9de000`/
`0x9de030` zero `+0x04` as well, but the dead node still carries
`+0x04 = 0x2eb30fe4` at exit. Something wrote **only** the next field.

### The watchpoint's EIP does not name the writer

Worth knowing before trusting any `--watch` output: `checkWatchpoint(batch)` is
called once per **batch** (`test/run.js:8890`), so the `EIP:`/`prev_eip:` it
prints is wherever the guest happened to sit at the batch boundary — not the
storing instruction. The comment at `test/run.js:4945` ("The writer's registers
name the source of a bad store") describes an intent the per-batch call site
does not deliver.

That is exactly how run 58 came to report `EIP=0x009e1811` with every register
zero for the fatal write. `0x9e1811` is inside the walker's null spin, and the
walker's only store targets its own stack frame — it cannot be the writer. The
reading is an artifact of sampling at a batch boundary.

The harness can be made to answer properly without touching WASM:
`--input=B:set-batch-size:1` (run.js:1736, 7822) makes a batch exactly one
block, so the check runs per block and `prev_eip` names the block that just
stored. The distortion has to be checked rather than assumed — the headless
clock is `batch * TICK_MS_PER_BATCH`, so guest time races ahead at one block per
batch — and the determinism fingerprint is the guard: every run from 42 onward
reports `0x9c1a90 = 1` and `0x9e17b0 = 303`.

### Correction: the watchpoint EIP *is* meaningful, and that makes it evidence

The previous section called the watchpoint's EIP a batch-boundary artifact. That
is wrong and is withdrawn. `--watch` is not JS sampling: `src/13-exports.wat`
lines 96-102 compare the watched location at **every block dispatch** and
`br $halt` the instant it differs, ending the batch right there. JS's once-per-
batch `checkWatchpoint` is precise enough precisely because the batch was cut
short. So `prev_eip` names the block that just ran and `EIP` the block about to
run.

Which turns the reading into a problem rather than an excuse. For the fatal
write the harness reports:

```
435422  0x2eb310c0 -> 0x00000000   EIP: 0x009e1811  prev_eip: 0x009e1804
```

`0x9e1804` is `cmp [esp+0x14],eax` / `jbe 0x9e1811` — a two-instruction block
inside the walker with **no store in it**, and the walker's only store in the
whole function (`mov [esp+0x14],eax` at `0x9e17e9`) targets its own stack frame
at `ESP=0x074fcee8`. The block that immediately preceded the change cannot have
written the node.

An unmapped-region explanation is available but does not survive the fault
census: if `0x2eb307d8` had stopped translating, the walker's own read of
`[edx]` would fault at `0x2eb307d8`, and the census for `eip=0x9e17d0` spans
only `0x0-0x8`. The address is mapped and the zero is a real value in memory.

So the change was not made by the block that preceded it. The open
possibilities are a write from another thread's slice, a host-side write, or a
remap — and the next probe should photograph the whole node immediately after
the change rather than reason further from the link alone.

## B&W2 is multithreaded, which resolves the no-store prev_eip

The contradiction above dissolves once the thread picture is read off the run
log: **B&W2 spawns five guest threads**, all still active at exit.

```
[ThreadManager] CreateThread handle=0xe1000..0xe1004 start=0x899ab0
[ThreadManager] Spawned thread 1..5 EIP=0x899ab0
Threads (final state):
  T1 h=0xe1000 state=active eip=0x881760 waitH=0xe0004 csPark/steal=0/0
  T2 h=0xe1001 state=active eip=0x881760 waitH=0xe0005 csPark/steal=0/0
  T3 h=0xe1002 state=active eip=0x89d1dc waitH=0x0   csPark/steal=2680/0
  T4 h=0xe1003 state=active eip=0x881760 waitH=0xe000c csPark/steal=0/0
  T5 h=0xe1004 state=active eip=0x881760 waitH=0xe0013 csPark/steal=0/0
```

So the walking thread is not the only writer in the machine. A store from
another thread's instance does not halt main's instance at the store; main
notices at its *next* block — which is the walker. That is exactly the shape of
`prev_eip = 0x9e1804`, a block with no store in it.

This is consistent with the structures being lock-protected by design: the node
pool allocator `0x9de0a0` opens with `call [0xc12178]` on section `0x1d90330`,
and `0x9c1400` takes one too. Rings that are mutated under a critical section
are rings more than one thread touches.

The log also carries a critical-section fault:

```
critical sections: 1 parked Enter(s) ABANDONED — the guest was dispatched
  elsewhere (last at 0x075005c8) with the call's frame still on the stack
critical sections: main parked 1x, stole 0, barged 0, released 0 it did not own
```

**Do not read that as the root cause yet.** The main thread is wedged inside the
walker and may well be holding that section, in which case T3's 2680 parks and
the abandoned `Enter` are a *consequence* of the wedge rather than its cause.
Establishing direction needs the abandonment placed before or after batch
435422, which the exit-time summary does not say.

`thread-manager.js:2527-2541` already surfaces a worker-side hit as
`[ThreadManager] T<n> WATCH ...` with that thread's own registers, and
`set_watchpoint` is in `INHERITED_WASM_GLOBALS` (`lib/worker-imports.js`), so
thread instances inherit the address when they spawn. Run 58 printed no such
line — but the threads spawn during startup, so arm-before-spawn ordering has to
be confirmed before that silence counts as evidence.

## `next == 0` is the signature of a FREED node, not a corrupted link

The node release `0x9de060` settles what a zero next pointer means here:

```
009de060  push esi
009de061  mov esi, ecx
009de063  test esi, esi / jz done
009de067  push 0x1d90330
009de06c  call [0xc12178]          ; EnterCriticalSection
009de072  mov eax, [0x177c94c]     ; free-list head
009de077  mov [esi], eax           ; node->next = free-list head
009de079  sub dword [0x177c950], 1 ; pool count--
009de085  mov [0x177c94c], esi     ; free head = node
009de08b  call [0xc1217c]          ; LeaveCriticalSection
```

Freeing a node **writes its `next`** to the old free-list head, which is `0`
when the free list is empty. So `next == 0` is not a broken link — it is what a
freed node looks like. And `0x9de1f0` is a whole-ring teardown built on it:

```
009de200  mov esi, [ecx]        ; save cur->next
009de202  call 0x9de060         ; release cur
009de207  cmp esi, edi
009de209  mov ecx, esi
009de20b  jnz short 0x9de200
009de20f  mov dword [ebx], 0x0  ; clear the head pointer
```

This reframes the whole wedge. The walker may not be walking a broken polygon at
all — it may be walking the **free list**, having been handed a head that was
already returned to the pool. A free list terminates at 0, which is exactly the
"ring that never closes". The very first write the watchpoint saw supports this:
`0 -> 0x2eb307ec` from the pool constructor at `0x9d7830`, a `+20` step, is
free-list threading.

It also explains, without special pleading, why `prev_eip` never named a storing
block in runs 58 and 60: the free happened well before the halt, so no block
adjacent to the change stored anything.

### Corrections this supersedes

- The cross-thread reading is **withdrawn**. Run 60 armed the watch before the
  threads spawn (`set_watchpoint` is in `INHERITED_WASM_GLOBALS`) and produced
  **no** `[ThreadManager] T<n> WATCH` line, and `--trace-sched` shows T1/T2/T4/T5
  parked on wait handles for the entire run with T3 pinned at `0x89d1dc`
  "unchanged for 50000 batches". No guest thread was mutating geometry.
- Attribution via `prev_eip` is **not reliable here** and the earlier claim that
  it names the storing block is withdrawn as applied to this case. None of the
  four recorded `prev_eip` blocks contains a store to the node — including
  hit #2, whose `EIP=0x9de220` store targets `ECX=0x2ec30468`, a face record,
  not the node.

### The test

Decidable offline from one dump: if the chain is the free list, then
`0x2eb310c0`, `0x2eb305a8`, `0x2eb30ff8` and `0x2eb307d8` are reachable by
following `+0` from the free-list head at `[0x177c94c]`. If they are not, the
free-list reading is wrong and the ring really was corrupted in place. The pool
object at `0x177c940` carries the free head at `+0xc` and the live count at
`+0x10`, so a 64-byte dump reads both directly.

Note the free path takes critical section `0x1d90330` — the same section behind
the "parked Enter ABANDONED" line — so if the free-list reading holds, that
abandonment becomes worth timing properly rather than dismissing.

## Refuted: the chain is not the free list

Dumping the pool object settles it. `0x177c940` reads:

```
+0x00 0x00000001   +0x04 0x00000001   +0x08 items 0x489d9f90
+0x0c FREE HEAD 0x2eb33168    +0x10 count 0x1c0 (448)    +0x14 max 0x7530 (30000)
```

(The `+0xc` free head and `+0x10` count match what `0x9de060` and `0x9de0a0`
address as `[0x177c94c]` and `[0x177c950]`, so the field reading is confirmed by
two independent uses.)

Walking that free list — run 61's head spliced into run 57's pool image, sound
because the path is deterministic and both runs report `0x9e17b0 = 303` /
`0x9c1a90 = 1`, but a cross-run splice and labelled as one — gives a clean
14-node list terminating at 0, and **none of `0x2eb310c0`, `0x2eb305a8`,
`0x2eb30ff8`, `0x2eb307d8` is on it**.

So the previous section's hypothesis is **withdrawn**. Supporting counts from
the same run: `0x9de1f0` (whole-ring teardown) ran **0** times, and `0x9de060`
(single-node release) ran 290 times. A node freed and left freed would be on
that list; ours is not.

### What that leaves

The dead node is "live" by the pool's own bookkeeping, and only its `+0x00`
is wrong. Its neighbours are intact and sensible — `+0x08 = 0x2ec74784` is a
point 12 bytes from the previous node's, `+0x10 = 0x2ec30ad0` is the wedging
face — which argues against a blind aliasing write (a stray `memcpy` would
rarely land one dword and stop). A single dword set to exactly zero, in exactly
the `next` slot, still looks like deliberate unlink code.

Every cheap suspect is now eliminated by a hit count or by the dump:

| suspect | verdict |
|---|---|
| `0x9c0c50` reset (`mov [ecx],0`) | 0 calls |
| `0x9de1f0` ring teardown | 0 calls |
| node free `0x9de060` | 290 calls, but node is not on the free list |
| re-construction `0x9de000`/`0x9de030` | would zero `+0x04`; it holds `0x2eb30fe4` |
| another guest thread | run 60: no per-thread watch hit, all others parked |
| the walker's own adjacent block | `0x9e1804` is `cmp`/`jbe`, no store |

One re-allocation path is *not* yet excluded and fits the evidence: freed while
the free list was empty (`next = 0`), then popped again (`head = node->next = 0`,
so the list empties cleanly and the node is live again), re-constructed, and
partially re-linked — while the stale ring node `0x2eb30ff8` still points at it.
That is a use-after-free of the ring, and it predicts `0x9de0a0`'s pop path runs
between the two events. Testing it needs the *sequence* of frees and allocations
around batch 435422, not another exit-time snapshot.

## One boot, many questions: the wedge is now interactive

Every finding above cost a fresh 800-second run, because the wedge lands around
guest batch 435420 and nothing survives the process. That is the wrong shape for
an investigation that asks one small memory question at a time.

It is also unnecessary. `tools/black-white-software-probe.js` already passes
`--control-stdin` down to `test/run.js`, and run.js's control loop has an `eval`
action (`test/run.js:5393`) whose body runs inside the host process with
`instance`, `exports`, `renderer`, `memory`, `g2w`, `tickState` and `ctx` in
scope. The guest wedges *inside a loop*, not inside a single WASM call — the
walker's block retires normally and the batch returns on budget — so control
commands keep being serviced while it spins.

So: boot to the wedge **once**, keep the process parked there, and read any
guest address in milliseconds for the rest of the session.

```
scratchpad/bw-live.sh   # the long-lived probe, stdin from a held-open fifo
scratchpad/ask.sh '<js expression>'   # one question, one [ctl] reply line
```

`ask.sh` blocks on `tail -f | grep -m1` rather than polling. The plumbing was
verified end to end against notepad (a few seconds to boot) before spending the
B&W2 boot on it: two independent questions came back against one live guest, the
second one reading `0x905a4d` — the `MZ` header — straight out of `memory` at
`g2w(0x400000)`.

What this does **not** do is answer questions about history. A write that
happened at batch 435422 is gone by the time the process parks, so the watch and
trace channels still have to be armed up front; the live session carries them
(`--watch=0x2eb307d8 --watch-log`, `--trace-at=0x9de060`) so it is a superset of
a one-shot run rather than a replacement for one.

## Refuted: the node was never freed, and the pool is not involved at all

Run 62 armed the two channels that between them cover the whole pool: a
`--trace-at=0x9de060` on the node release (`ECX` is the node being released, so
every free is named) and a `--watch=0x177c94c --watch-log` on the free-list head
itself (so every push and every pop is one timestamped event).

The answer is flat:

```
--- were any of the four ring nodes freed? ---
  0x2eb310c0: 0 free(s)
  0x2eb305a8: 0 free(s)
  0x2eb30ff8: 0 free(s)
  0x2eb307d8: 0 free(s)
```

290 frees, 145 of them logged with batch numbers, and not one of them is a node
of the wedging ring. The "freed while the free list was empty, then popped
again" story required `0x2eb307d8` to pass through `0x9de060`, and it never
does. Every pool suspect is now eliminated:

| suspect | verdict |
|---|---|
| `0x9c0c50` reset (`mov [ecx],0`) | 0 calls |
| `0x9de1f0` ring teardown | 0 calls |
| node free `0x9de060` | 290 calls, **none of them this node** |
| re-construction `0x9de000`/`0x9de030` | would zero `+0x04`; it holds `0x2eb30fe4` |
| another guest thread | run 60: no per-thread watch hit; all others parked |
| the walker's own adjacent block | `0x9e1804` is `cmp`/`jbe`, no store |
| blind aliasing write | neighbours `+0x04`/`+0x08`/`+0x10` all intact |

So the zero at `0x2eb307d8+0` did not come from the pool, from the ring's own
teardown, or from another thread. The list of things the *guest* could have done
is empty, which moves the weight decisively onto the remaining possibility: the
store that landed there is ours — a store whose effective address the emulator
computed wrongly. That also explains the finding we could not place, that none
of the four recorded `prev_eip` blocks contains a store to this node: if the
address is wrong, the block *does* have a store, and a disassembly of it points
somewhere else entirely.

### The wedge is at batch 435909, ~490 batches after the break

One of the 145 free-list changes is not like the others. Every push in the log
reports `EIP: 0x009de091 prev_eip: 0x009de072` — inside the release function.
The last one, at batch 435909, reports:

```
*** WATCHPOINT hit at batch 435909: [0x0177c94c] changed
  Old: 0x2eb33154  New: 0x2eb33168  EIP: 0x009e1820  prev_eip: 0x009e1817
```

`0x9e1820` (`test ecx,ecx`) and `0x9e1817` (`cmp eax,[esp+0x14]`) are both
inside the walker. The WASM watch notices a change at the *next* block
dispatch, so this is the ordinary free of `0x2eb33168` — the value matches
run 61's surviving free head exactly — observed from the first walker block that
ran after it. Which is to say: the guest went into the walker right there and
never came out.

That gives the whole sequence a clock:

| batch | event |
|---|---|
| 435416-435421 | the ring is built and closed |
| 435422 | `0x2eb307d8->next` is zeroed by something that is not the pool |
| 435423-435908 | ~490 batches of ordinary pool traffic, 303 walker calls returning |
| 435909 | the 304th call — a point that tests "inside" — never returns |

## The approach path: the profile dialog is the real blocker, and it takes no input

The wedge is not what keeps this game off the land. Run 62's captures show the
land-selection menu fully up and correctly drawn when the walker wedges, so the
menu is reached and rendered; the walker spins on something the scene behind it
queries. What actually stops a run from getting there is one screen earlier.

**Capture size identifies the screen** without opening it, which makes a sweep
cheap to read: ~220KB loading, ~340KB the "New Profile Name" dialog, ~415KB the
land menu.

### The dialog's auto-advance is flaky, and no flag separates the cases

The probe contains **no input automation at all**, so runs that reach the land
menu do it unattended. Twelve runs, same build, same box:

| outcome | runs | what they had in common |
|---|---|---|
| reached the land menu (~403s) | 6 | nothing that the stalled ones lacked |
| stalled on the dialog for the whole budget | 6 | nothing that the reached ones lacked |

Three mechanisms were proposed for the split and all three were measured and
refuted:

- **"The debug flags pace the clock."** Refuted: a run carrying run 62's exact
  flags stalls, and run 62's own script reruns green.
- **"The headless clock races ahead."** Refuted: `--tick-ms-per-batch=20` puts
  guest time at ~120 guest-seconds per wall second against the baseline's ~116 —
  equal pacing, same stall.
- **"`--input` changes the pacing."** Refuted, and backwards: a stalled run
  retires tiny blocks in a message pump, so its batch counter races, and
  batch-scheduled events therefore fire minutes early. The stall makes the
  schedule fire early, not the other way round.

A high batches/s reading is a **symptom** of a run sitting in a pump, never a
cause. `--control-stdin` is not a variable at all — the probe passes it on every
run.

### No input path reaches the dialog

The dialog is drawn by the game, not by Win98 controls, and
`_activeInputProfile` is null, so no DirectInput device has been acquired. All
of the following were delivered and none moved it, including sixty attempts
spread across ten batch points from 150000 to 600000 covering both the inner
dialog's OK at ~(250,275) and the outer one's at ~(250,338):

| path | result |
|---|---|
| `renderer.handleMouseDown/Up` (the `click` input action) | no effect |
| `WM_LBUTTONDOWN`/`WM_LBUTTONUP` posted to the main hwnd | queued, no effect |
| `VK_RETURN` pushed onto `renderer.inputQueue` | no effect |
| `di-mousedown`/`di-mouseup` (feeds `GetAsyncKeyState`) | no effect |
| `mousemove` first, so `GetCursorPos` agrees, then each of the above | no effect |
| `relmousemove` (DI relative delta) to position, then `di-mousedown`/`di-mouseup` | no effect |

The census has now answered which APIs the game polls, and it rules out the
first explanation that fit:

- **`DirectInput8Create` is called** — the game does use DI8. The earlier "no
  DirectInput device acquired" was inferred from `renderer._activeInputProfile`
  being null, which evidently does not track DI8.
- **`GetCursorPos` is called exactly once** in a whole 900s run, so every
  attempt that positioned the cursor with `mousemove` was writing a coordinate
  the game never reads.
- **`GetAsyncKeyState(VK_LBUTTON)` is polled from the input block at
  `0x526e8d` / `0x5293db`** — but only **8 times in 900 seconds**, in four
  pairs. That is the finding that matters: a press injected as a 2000-batch
  pulse has almost no chance of overlapping a poll, so "the button was ignored"
  and "the button was never sampled" are not distinguishable by these runs.

So the `relmousemove` + `di-mousedown/up` row above is a **weak** refutation,
not a strong one. The next run holds the button down for 20000 batches and
holds `VK_RETURN` through the DI keyboard path for the same span, and traces
the DI lifecycle (`IDirectInput_CreateDevice`, `SetDataFormat`, `Acquire`,
`GetDeviceState`, `GetDeviceData`) so that "the game never acquired a mouse
device" stops being an inference.

`$handle_IDirectInputDevice_GetDeviceState` (src/09a8-handlers-directx.wat:8102)
is fully wired for a mouse — `lX`/`lY` from `$di_mouse_delta_take_x/y`, which
`relmousemove` feeds, and `rgbButtons[0]` from `$host_get_mouse_buttons`, which
`di-mousedown` feeds — so if the game does acquire a device, the harness can
drive it.

### What the wedge actually blocks

Run 62 captured frames either side of the transition, and they correct a
standing assumption in these notes. At 404s it is on the profile dialog; at
800s, wedged, it is on the **land-selection menu** — the burning-village scene
with the row of land thumbnails along the bottom, rendered correctly. So the
walker is not what stops the menu from appearing. The menu is up and drawn, and
the wedge is in whatever the scene behind it queries.

## The front end is not blocked, it is rasterizing: 82% of the run is in DrawPrimitive

The eight `GetAsyncKeyState(VK_LBUTTON)` polls in 900 seconds are a symptom,
not the disease. The probe's own `samples.ndjson` records the guest EIP every
five seconds, and over a 900s run it reads:

| EIP | samples (of 180) |
|---|---|
| `0x7503488` | 148 |
| `0x7503490` | 11 |
| everything else | 21 |

`0x7503488` is in the thunk zone (`THUNK_BASE`, guest `0x07500000`), and a
thunk is 8 bytes of `[name_rva, api_id]` (src/09b-dispatch.wat:126). Read out
of a live instance over `--control-stdin`:

```
7503488 idx=1681 name_rva=0xcaca0010 api_id=2774
7503490 idx=1682 name_rva=0xcaca0010 api_id=2775
```

`api_table.json[2774]` is **`IDirect3DDevice9_DrawPrimitive`**, 2775 is
`DrawIndexedPrimitive`. So **the front end spends ~82% of its wall clock inside
one D3D9 draw call in the software backend**, and the run is not parked at all:
texture uploads keep climbing (`submitted 5:` goes 7 → 29 → 125 → 174 across
the same window) while the EIP sits in `DrawPrimitive`.

That explains every input result recorded above without needing a wrong input
path. The menu samples the mouse once per rendered frame, and it renders about
four frames in fifteen minutes, so a scripted press has to survive minutes of
wall clock to be seen at all — and a press pulsed over 2000 batches does not.
It also explains the 6/6 split on passing the profile dialog unattended: that
is a race against a clock nothing in the flag set controls.

**CORRECTION (same session, measured right after).** The share above is a
sampling artifact and the "82% of wall clock" reading of it is wrong.
`$handle_IDirect3DDevice9_DrawPrimitive` (src/09ad-handlers-d3d9.wat:1513)
calls `$d3d_render_park`, which sets `yield_reason 16` and leaves EIP on the
thunk so the call can be re-entered. Control commands are serviced *between*
batches, and a parked guest is exactly what ends a batch — so the sampled EIP
is at that thunk almost by construction. It says the guest parks there, not
that the wall clock is spent there.

What the wall clock is actually spent on, from `node --cpu-prof` over the
probe's own command line (120s, two profiles: main thread and the D3D render
worker):

| thread | idle | top self time |
|---|---|---|
| main | 12.9% | `$next` 2.4s+1.5s+1.3s, `$branch_end`, `$decode_block`, `$fpu_exec_mem` — the guest interpreter — plus `d3d9-texture.js decode` at 5.2% |
| render worker | **65%** | `$d3d_shader_vm_component` 9.8%, `$d3d_software_step` 8.8%, `$d3d_shader_vm_run`, `$d3d_shader_vm_texel`, `$d3d_shader_vm_sample_face_lod` |

The rasterizer worker is **idle two thirds of the time**; the main thread is
not. So the front end is **interpreter-bound**, not rasterizer-bound.

And the frame rate is not "four frames in fifteen minutes" either. Counted
directly off a 150s traced run:

| call | count in ~150s |
|---|---|
| `BeginScene` | 80 |
| `Present` | 162 lines |
| `DrawPrimitive` | 312 |
| `DrawIndexedPrimitive` | 0 |

**≈0.53 frames per second, about four `DrawPrimitive` calls per frame.** That
is slow but it is not a freeze, and it is fast enough to be clicked: a button
held for five wall seconds spans two or three frames of mouse sampling.

## The input path was right; the schedule unit was wrong

Tracing the DirectInput lifecycle settles the input question. The game:

```
IDirectInput_CreateDevice(0x07f4e018, 0x00d063a8, ...)   ret=0x009afdc3
IDirectInputDevice_SetDataFormat(0x07f4e020, 0x00d11b14) ret=0x009afdd7
IDirectInputDevice_SetCooperativeLevel(..., 0x00000006)  ret=0x009afdef
IDirectInputDevice_Acquire(0x07f4e020)                   ret=0x009afe3f
IDirectInputDevice_GetDeviceData(..., cb=0x14, ...)      ret=0x009b0933   (repeatedly)
```

The two `.rdata` pointers name the device exactly:

- `0x00d063a8` = `60 2b 1d 6f a0 d5 cf 11 bf c7 44 45 53 54 00 00` — the first
  dword is `0x6F1D2B60`, which is **`GUID_SysMouse`** (`…61` would be the
  keyboard).
- `0x00d11b14` = `dwSize=24, dwObjSize=16, dwFlags=2 (DIDF_RELAXIS),
  dwDataSize=16, dwNumObjs=7` — a **relative-axis** `DIMOUSESTATE`.

So the device is an acquired relative mouse read in **buffered** mode through
`GetDeviceData`, which is exactly the FIFO `relmousemove` and
`di-mousedown`/`di-mouseup` feed (`renderer._queueDirectInputMouseButton`,
test/run.js:7797). The harness has had the right path all along.

What was wrong is the **schedule unit**. `--input` fires on batch numbers, and
a guest that spins in a pump retires tiny batches — so in the hold run every
event booked for batches 250000–600000 fired between 04:07 and 04:08, within
the first minute of a 900-second run, hundreds of seconds before the profile
dialog is even on screen. All eight captures came back at ~340KB for that
reason alone. This is the same unit trap CLAUDE.md warns about for
`--batch-size`, arriving through `--input`.

At 0.53 fps the game samples the mouse about once every two seconds, so input
has to be driven on the **wall clock** and held for seconds, not scheduled on
batches and pulsed. `$S/bw-wallclick.sh` does that over `--control-stdin`:
photograph every 30s, and when the capture size says the dialog is up, park the
cursor with a large negative relative delta, walk it to the button, hold the
button 5s, release.

## The whole front end is navigable (2026-09-13)

Driving the acquired relative mouse on the wall clock walks the entire menu
chain for the first time. One boot, `--control-stdin`, a click = park with
`handleRelativeMouseMove(-3000,-3000)`, walk to the target, hold the button 5s,
release (`$S/bw-wallclick.sh` + `$S/clickat.sh`):

| t (wall s) | capture | screen |
|---|---|---|
| 30 | 2075 B | black |
| 60–90 | 220 KB | loading |
| 150 | 340 KB | **"New Profile Name"** over "Select Profile", name prefilled `Player`, OK/Cancel |
| 150 + click (250,275) | 339 KB | same dialog, cursor sprite now drawn on OK |
| 150 + second click | **397 KB** | **main menu** — title `Player`, bar reads Credits / New Game / Load Game / Change Profile / Options / Quit |
| + click (165,443) | 395 KB | **mouse-tutorial screen** (four panels, Continue button) |
| + click (320,461) | 394 KB | **land-selection menu** — burning village scene, eight land thumbnails |
| + click (75,380) / (140,378) | 415889 B | land menu, then the guest enters a long non-rendering load |

Two things this settles:

- **The capture-size discriminator gains two entries**: ~395–397 KB is the main
  menu / tutorial, and the old "415889 = land menu" still holds.
- **The cursor is unmistakably ours.** In the 340 KB capture the game's own
  cursor glow sits exactly on OK, where the relative walk put it, and in the
  next capture it has changed to the pressed sprite. The DirectInput mouse is
  wired end to end.

### After the land click: not a wedge, a long scan

The land click stops the repaint (captures stay byte-identical at 415889) and
pins EIP at `0x9e5272`. That is *not* the `0x9e17b0` wedge. Disassembled it is
an ordinary linear search:

```
9e5272  cmp [ecx], edi
9e5274  jz  0x9e52e9        ; hit
9e5276  add eax, 1
9e5279  add ecx, 4
9e527c  cmp eax, [esi+4]    ; count
9e527f  jl  0x9e5272
```

Read out of the live instance: `esi=0x35c51fb4`, count `[esi+4]=0xb351`
(45905), data `[esi+8]=0x2db5d884`, and `ecx` is exactly `data + eax*4`. `eax`
was 37756 on one sample and 47603 four seconds later — past the 45905 of the
first pass, so the *outer* loop is turning too. Nothing is unmapped and nothing
is stuck: this is an O(n·m) scan over a 45905-entry table, running at
interpreter speed, which is what land loading costs here.

So the sequence that reaches gameplay is now known and reproducible; what is
left between the land menu and the land is throughput, the same thing the
`--cpu-prof` split above points at.

### Why the land-load scan is not folded, and what folding it would take

The scan at `0x9e5272` is exactly the shape a superop wants, and
`tools/find-loops.js` does see it:

```
va 0x9e5272  n=6  .text  family=other
  skeleton: cmp m,r; jz r; add r,i; add r,i; cmp r,m; jl r
```

But `tools/match-loops.js` declines it, and the runtime matcher could not have
taken it either:

- **`SCAN_RUN` exists only in the static tool.** `src/07b-loop-match.wat` has
  no `SCAN` family at all — the runtime families are `COPY_RUN`, `FILL_RUN` and
  `LUT_RUN`.
- **The cycle spans two basic blocks.** The `jz 0x9e52e9` early exit terminates
  a block, so the loop is `[cmp/jz]` + `[add/add/cmp/jl]`. `$loop_match_block`
  only ever runs on a block that branches to *itself*, so this is invisible to
  it by construction — the same blind spot §19's notes describe, and the reason
  `multi-branch` is 1600 of BW2Demo.exe's 11724 declines (second only to
  `call`'s 5670).

Address-ordered runs (`$decode_run`, src/07-decoder.wat:5792) do lay the two
blocks out contiguously, so the fall-through is cheap — but they do not merge
the blocks, and a fold needs one block to rewrite.

So folding this is Design B work (a multi-block cycle), not a new Design A
predicate, and it should not be started on the strength of one app's load
screen. The measurement that would justify it is a `--handler-hist` /
`--hot-block-dump` census taken *during* the land load, which no run has yet
because the load is only reachable through the click chain above.

### CORRECTION (2026-09-13): the land load never finishes -- the scan reads a NULL vector

The section above is wrong where it calls `0x9e5272` "an O(n*m) scan at
interpreter speed". It is an unbounded loop over corrupt data, and no amount of
folding would make it terminate. The full shape, from the disassembly at
`0x9e521f`:

```
009e5250  33 db          xor ebx, ebx            ; inner index = 0
009e5252  39 5d 00       cmp [ebp+0x0], ebx      ; ebp = src vector: count@+0, data@+4
009e5260  8b 56 04       mov edx, [esi+0x4]      ; esi = dst vector: cap@+0, count@+4, data@+8
009e5269  8b 4d 04       mov ecx, [ebp+0x4]      ; ecx = src->data
009e526c  8b 3c 99       mov edi, [ecx+ebx*4]    ; edi = src->data[i]
009e526f  8b 4e 08       mov ecx, [esi+0x8]
009e5272  39 39          cmp [ecx], edi          ; linear_find(dst, edi)
009e5274  74 73          jz  0x9e52e9            ; already present -> next i
009e5276  83 c0 01       add eax, 1
009e5279  83 c1 04       add ecx, 4
009e527c  3b 46 04       cmp eax, [esi+0x4]
009e527f  7c f1          jl  0x9e5272
...                                              ; not found: grow (malloc at 0xad425d,
009e52e2  89 14 81       mov [ecx+eax*4], edx    ; capacity doubling) and push_back
009e52e5  83 46 04 01    add dword [esi+0x4], 1
009e52ec  3b 5d 00       cmp ebx, [ebp+0x0]      ; i < src->count
009e52fd  83 c5 0c       add ebp, 0xc            ; next src vector (12-byte records)
```

So it is `dst = union(dst, src[k])` for a list of source vectors, with
membership tested by linear search. Fine in principle. The problem is the
source record it is on. Sampled live from the running probe at two points 45 s
apart:

```
FRAME eip=9e5276 ebp=2e0f03e8 srcN=770376714 srcData=0 ebx=1268378 s30=3 dstN=92888 dstCap=131072
FRAME eip=9e5272 ebp=2e0f03e8 srcN=770376714 srcData=0 ebx=1276274 s30=3 dstN=96437 dstCap=131072
```

`srcData = 0`. The source vector's data pointer is **NULL** and its count is
`770376714` (`0x2DE9C64A`) -- a value in the same `0x2d`-`0x2f` range as every
live heap pointer in this process, so a pointer is sitting in the count slot.
A well-formed empty vector would read count 0; this record was never
initialized, or was written with the wrong layout.

The consequences follow mechanically. `mov ecx,[ebp+4]` makes `ecx` zero, so
`mov edi,[ecx+ebx*4]` reads guest address `ebx*4` -- around `0x4D9C88` at the
sampled index, which is *inside the mapped image*, so nothing faults and no
diagnostic fires. Each dword of the EXE's own bytes is then deduplicated into
`dst`, which grows without bound: 45905 entries when first sampled, 96437 an
hour later, capacity already doubled to 131072. The loop exits when
`ebx` reaches `770376714`, i.e. after ~770 million iterations whose inner scan
is itself hundreds of thousands of elements by then. At the measured
~8000 outer iterations per 40 s that is over 40 days, and the inner scan is
still lengthening.

**So: the land load does not complete, and it is not a throughput problem.**
The `--handler-hist` census named at the end of the previous section would have
measured a loop that should never have run. The open question is why the record
at `0x2e0f03e8` is garbage -- who fills that array of 12-byte vector records,
and what it read (or failed to read) beforehand. `s30=3` says three records
remain in the outer walk, so the earlier ones were processed without wedging;
this is one bad element, not a wholesale corruption.

This also re-frames the two long-standing NULL-deref counts in the fault census
(`eip=0x9e17d0` x937,819,405 at addresses `0x0`-`0x8`, and `0x9e8200`): the same
family of symptom -- structures that should have been filled reading back NULL.

## ANSWERED (2026-09-13): the garbage record came from our own heap free list

The record at `0x2e0f03e8` is not garbage the game wrote. It is a cell of a
spatial grid that the game never wrote at all, and that our `$heap_alloc`
handed over still holding the previous owner's bytes.

**The enclosing function `0x9e5140` is a grid query.** Its object's fields
decode as `+0x00..+0x0c` world bounds (min/max X/Y), `+0x10` cells per row,
`+0x14`/`+0x18` cell width and height, `+0x1c` rows, `+0x20` the cell-array
base. Live: bounds ±32768, 512 cells per row, 128x128 cell size, 16384 cells
x 12 bytes = 196608 bytes at guest `0x2e0d27e0`. Cell k is `base + k*12`, and
the union loop's `ebp` is `cell + 4` -- so the "source vector" is a cell's
`{count, data}` pair and the query is *union the contents of every cell the
query rectangle touches*. A second, coarser 32x32 grid (cell 2048) hangs off
`+0x28` of the same object with its array at `0x2e1d5f18`.

The cells are populated **lazily and never cleared**. Every cell the loader
does not put an object in has to read back `{0, NULL}`, which the game gets for
free on Windows because a large `HeapAlloc` comes off fresh committed pages.

**Where the bytes came from.** `probe-maps.sh` resolved the 1 MB record
containing the array (`g=0x2e040000+0x100000 @ w=0x18299000`) to a single
contiguous map entry matching `$heap_sparse_alloc`'s `0x00100000` minimum
chunk: this is our own HeapAlloc arena, not a guest `VirtualAlloc` region.
`$virtual_map_commit_locked` zeroes every fresh commit, so bump space is clean
and only *recycled* space can be dirty. The dirty-dword census of the 192 KB
array settles it:

```
PAT dirty=8350/49152 first=8,40,72,104,136,168,200,232,264,...
    mod32=363,254,6144,265,237,360,363,364
```

6144 dirty dwords at offset 8 mod 32 -- exactly one per 32-byte block across
the whole region, which is this allocator's own free-list `next` pointer at
`block+4` (the payload starts at `block+4`, so a link lands at payload offset
`8 mod 32` for 32-byte blocks). The coarse grid's array, served out of larger
recycled blocks, has only `3/3072` dirty dwords (value `0x1118`, spaced
`0x1118`) and exactly one bad cell.

**Proof, not inference.** In the live wedged process, setting `count = 0` on
every cell with `data == 0 && count != 0` (2208 cells across both grids),
emptying the poisoned `dst` vector and zeroing the stuck source count moved EIP
out of the loop within a minute:

```
REPAIR fixed=2208 dstWas=124429 srcNnow=0
eip 9e5272 -> 9ee2a7 -> 9ee4e3 -> 9ee2b5
```

**The fix** is `b81f8a54`: `$heap_alloc` zeroes a block's payload whenever it
serves it from the free list. Before it, the same `HeapAlloc` returned zeroed
memory early in a process (bump space) and stale memory later (recycled space)
-- a difference no guest is written to tolerate.

**Ruled out along the way, and worth recording because it is a real bug that
looked exactly like this one:** `VirtualFree(MEM_DECOMMIT)` was a no-op, so a
re-commit of the same addresses returned stale bytes where Windows guarantees
zero pages, and `BW2Demo.exe` does exactly that at `0x00ade6aa`
(`push 0x4000; push 0x8000; push ecx; call VirtualFree`). Fixed in `4a46d8a4`
with `test/test-virtual-decommit-zero.js`. It changed the B&W2 symptom by not
one byte -- the verification run reproduced the wedge at the same addresses
with the same values. The memory involved here never went through
`VirtualAlloc` at all.

One measurement caveat from this session: the `--watch`/`set_watchpoint`
facility's *silence* is not evidence. The run whose log was read for "nothing
ever stored to that cell" never printed `Watchpoint armed at batch`, so the
watch may never have been armed; tested separately it does track stores
correctly (`armed 35c51fb8 val=117104 -> 118124 -> 119118`). The live-repair
experiment is what settled the question.

## CORRECTION (2026-09-13): it was not the heap either -- the map aliased

The section above is right about *what* the bad record is -- a cell of the
lazily populated grid, holding a free-list link where an empty vector belongs
-- and wrong about where those bytes came from. `$heap_alloc` zeroing recycled
blocks (`b81f8a54`) is a real improvement and changed the symptom by nothing:
the run after it reproduced the wedge at the same `eip=0x9e5276`, the same
`ebp=0x2e0f03e8`, the same `srcN=770376714`, and the same dirty-dword census
(`dirty=8350/49152`, `mod32=363,254,6144,265,237,360,363,364`).

What finally named it was reading the guest bytes as *addresses*:

```
2e040000: 138818 9c40 2de00028 0 0 0 0 0 0 0 2de00048 0
2de00000: 138818 9c40 2de00028 0 0 0 0 0 0 0 2de00048 0
2df40000:  75318 9c40 2df40014 0 0 2df40020 0 0 2df4002c 0 0 2df40038
2e140000:  75318 9c40 2df40014 0 0 2df40020 0 0 2df4002c 0 0 2df40038
```

Two pairs of guest addresses 0x240000 and 0x200000 apart hold byte-identical
data, and in each pair the self-referential pointers name the *lower* address.
They are not copies. They are the same memory seen twice:

```
340: g=2e140000+100000 k=18199000     342: g=2df40000+100000 k=18199000
341: g=2e040000+100000 k=18299000     343: g=2de00000+140000 k=18299000
```

Two `VIRTUAL_MAP_TABLE` records, two unrelated guest ranges, one backing
extent. So the grid's cell array and the guest allocator's free list of
32-byte blocks were literally the same bytes, and every cell the loader had
not written read back whatever link the allocator had left at that offset --
which is exactly the `{count = pointer, data = NULL}` shape, and exactly why
the dirty dwords sat one per 32-byte block.

This also explains why the earlier evidence pointed everywhere. The array's
"stale" content is not stale at all: it is *live* memory belonging to someone
else, being rewritten while the loop reads it. Nothing was ever handed back
unzeroed, which is why neither `4a46d8a4` (MEM_DECOMMIT) nor `b81f8a54`
(recycled heap blocks) moved it, and why repairing the cells by hand worked --
it only had to hold until the query finished.

The fix is `bec0e26e`: the backing pool's bump cursor and its released-extent
list are claims *about* the record table, and when one goes stale the commit
succeeds silently. `$virtual_backing_conflicts` asks the table itself, and a
candidate extent that intersects a live record is treated like an exhausted
pool -- the placement scan that already avoids live records finds somewhere
else. `test/test-virtual-backing-no-alias.js` pins it.

**Method note worth keeping.** Three fixes in, the thing that separated this
from the previous two guesses was not a better hypothesis but a cheap
invariant: enumerate the record table and check every pair for overlapping
backing. That check costs one eval and would have named the bug on the first
day. When guest memory contains data no guest code should have written there,
ask whether it is the *same memory* as somewhere else before asking who wrote
it.

## The land load runs now, and dies further on: a texture that never loaded

First run on `bec0e26e` (no-alias), driven through the click chain by hand:
profile dialog -> OK -> New Game -> Continue -> tutorial -> Continue -> land
selection -> land 1. **The union loop at `0x9e5272` never appears.** The load
proceeds for ~1.5 million batches past the point the old build wedged at, and
then:

```
[eip-zero] guest called through NULL at batch 1952681
  dbg_prev_eip=0x0093907b
```

That is a texture accessor:

```
00939050  push esi / mov esi,ecx
00939053  mov eax,[esi+0x1d0]        ; texture load state
0093905b  jz 0x939075                ; 0 -> use it
00939060  jz 0x939075                ; 3 -> loaded, use it
00939065  jnz 0x939079               ; not 1 -> esi = NULL
00939067  call 0x938930              ; 1 -> poll until the async load finishes
0093906c  cmp [esi+0x1d0],3
00939073  jnz 0x939079               ; still not loaded -> esi = NULL
00939075  mov esi,[esi]
00939079  xor esi,esi
0093907b  ...
00939083  mov eax,[esi]              ; esi = 0 -> eax = 0
0093908f  call [eax+0x4c]            ; call through NULL
```

The state field is `+0x1d0`: **2 = requested/not loaded** (written at the entry
of the request path `0x9394e0` and at `0x9389b0`/`0x939200`), **1 = async load
in flight**, **3 = loaded**. `0x938930` is the poll: while the state is 1 it
calls `[0xc12314]` (a sleep) and prints `"Texture Asynchronous Load: Having to
poll for texture %s!!!"` at `0xd07bfc` through `[0xc12150]`.

So at the crash the texture was in state **2** -- the caller dereferenced a
texture whose load was never started or never completed, and the game has no
NULL check on that path. Nothing in `run.log` reports a failed file open, a
failed `CreateTexture`, or an unimplemented API, so the next question is who
was supposed to move that object from 2 to 1/3: the async loader is a guest
thread, and this run is the cooperative scheduler.

The screen at the crash is still the land-selection menu (415832 bytes), so the
load never got as far as drawing the world.

## The NULL texture was our format gate: D3DFMT_A4R4G4B4

Measured 2026-09-13 on a clean drive to the land with
`--trace-api=IDirect3DDevice9_CreateTexture,IDirect3DDevice9_CreateCubeTexture,IDirect3D9_CheckDeviceFormat`
plus `--count=0x938b6b,0x938b88,0x9389b0,0x9389d1`.

The last API call before `[eip-zero] guest called through NULL at batch 1933113`
is

```
IDirect3DDevice9_CreateTexture(dev=0x07f4e030, 0x20, 0x20, levels=1, usage=0,
  format=0x1a, pool=1, ppTexture=0x2e4fba90) [ret=0x00938af9]
```

`ret=0x00938af9` is the instruction after `call [edx+0x5c]` at `0x00938af6` --
the game's **own direct device call**, not D3DX -- and it is **not preceded by
any CheckDeviceFormat**, so a truthful "no" is not a fallback this path takes.

The object is built by `0x009389b0`, the create-from-memory constructor: it
writes state 2 into `[esi+0x1d0]` on entry, inline-copies the literal
`"<memory>"` (at `0x00d07c3c`, exactly one xref, `0x009389d1`) into `[esi+0x3c]`,
stores 32/32/1/26 into `+0x14/+0x18/+0x20/+0x4`, and on success sets state **3**
at `0x00938b6d` (block entry `0x00938b6b`); the failure arm is `0x00938b88`.
The live object at the crash reads `f0=0` (texture NULL), `f4=0x1a`, `fc=1`,
`f14=f18=0x20`, `f20=1`, `f1d0=2`, name `"<memory>"` -- and thirty instructions
later `0x0093907b` calls through the NULL.

Format census over the whole run to the land: DXT1 142, DXT3 107, A8R8G8B8 34,
DXT5 20, L8 7, A8L8 4, R5G6B5 2, X8R8G8B8 1, **A4R4G4B4 1**. A one-format gap.

Adding 26 to `$d3d9_texture_format_supported` and to the two-byte arm of
`$d3d9_texture_texel_bytes` in `src/09ae-d3d9-resources.wat` fixes it: the two
A4R4G4B4 creates (32x32 and 32x48) succeed, the hit counts come back
`0x00938b6b = 30` against `0x00938b88 = 1`, and the `[eip-zero]` is gone.
Fixture: `test/test-d3d9-texture-argb4444.js`.

## Then the land load runs out of memory, and that was ours too

Past the texture the run reaches batch 1979920 and dies differently:

```
[heap] OOM: 191365120 bytes (0xb680000) — sparse arena: no guest address space left to reserve
[heap] OOM: 191338520 bytes (0xb679818) — bump arena full, low reserve and sparse arena both refused
[C++ throw] .?AVbad_alloc@std@@ <- .?AVexception@@  obj 0x074fc980 at EIP 0x00ada813
=== UNHANDLED EXCEPTION: CXX_EXCEPTION 0xe06d7363 ===
```

`--dump-virtual-maps` at that point: **390 map records, backing_top 0x1bb27000**
(315 of the backing pool's 316 MB spent) and **reservation_top 0x164f0000** (923
MB of guest address space consumed below 0x50000000). The last thirteen records
are a 1.5x growth series carved contiguously downward --

```
0x100000 0x170000 0x220000 0x330000 0x4c0000 0x720000 0xab0000
0x1010000 0x1810000 0x2410000 0x3620000 0x5120000 0x79b0000
```

-- one container the land loader grows by `HeapReAlloc`, which does free the old
buffer. The leak is ours: a free block may not be merged with the one in the
arena next door, so every abandoned step stayed committed and the series cost
the *sum* of its members (~370 MB) for a container 121 MB long.

Fixed in df2f1f31: heap arena records count their live bytes, and a sparse
allocation that would fail first hands back every retired arena reading zero --
backing and address space both. Fixture: `test/test-heap-arena-release.js`.

## Three heap fixes later the wall is at 430 MB, and it is not a heap bug

`df2f1f31` was not enough on its own, and neither was the fix after it. Three
things had to be true before the land loader's growth series could run:

| commit | what was wrong |
|---|---|
| `df2f1f31` | abandoned steps stayed committed -- a free block is never merged with the one in the arena next door, so the series cost the sum of its members |
| `d75e178e` | the sparse reserve cursor only moves *down*, and the reclaim can only raise it to the lowest **live** range, so the surviving 121 MB buffer at `0x164f0000` made the ~800 MB above it unreachable |
| `bb910600` | backing released in the extension window (above `0x20000000`, only present at `--memory-mb=1024`) was never reused: `$virtual_hole_take` offered the extent and the caller then measured it against the **primary** pool's end and threw it away -- after the hole had already been removed from the list, so it was lost rather than deferred |

Measured at the point `bb910600` fixed: pool 305.7 MB of 316 used with a 4.0 MB
largest free extent, extension 151.5 MB of 512 used with a **243.8 MB free
extent at `0x221de000` that nothing could reach**.

With all three in, every step of the series is served and the run reaches
**430571520 bytes (0x19aa0000)** before anything is refused -- and that is the
*only* refused allocation in the whole run. State at the refusal:

```
virtual_maps: count=370 backing_top=0x30f54000 reservation_top=0x10a20000
pool: 344 records, used 304.5MB of 316MB, largest free extent 4.6MB
ext:   26 records, used 304.8MB of 512MB, largest free extent 206.1MB
live: 609.3MB in 370 records -- one 273.8MB record, then 32.1, 21.9, 19.8, ...
```

Growing 273.8 MB to 430 MB while both exist wants ~1019 MB against the 828 MB
of backing a `--memory-mb=1024` process has. So no further heap work reaches
this: the question is whether the request is legitimate, and it is not.

### CORRECTION: the growth series is not `HeapReAlloc`

The section above says the loader grows the container with `HeapReAlloc`. That
was inference from the record shape, not measurement. `--trace-api=HeapReAlloc`
across a full run to the land click logs **two calls in the entire process**,
both early and both small:

```
[API #55000] HeapReAlloc(0x02db2cc4, 0, 0x02e68fac, 0x000008f0) [ret=0x00ad9151]
[API #92521] HeapReAlloc(0x02db2cc4, 0, 0x02dbe2a4, 0x00001100) [ret=0x00ad9151]
```

So the container is grown the C++ way -- allocate, copy, free -- and the API
trace is not where to look for it.

### Who asks for the 430 MB: `0x009e35e0`, reached from the list walk at `0x009d5430`

A worktree-only diagnostic in `$heap_alloc` logged the marker, size, `eip`,
`dbg_prev_eip` and eight EBP frames on every refusal (`$host_log_i32`, so no
shared file had to be touched). Both refusals report the same stack:

```
0x0a11c0de  marker
0x19aa0000  size
0x00ad561b  eip      -- malloc / operator new
0x00ad561b  prev_eip
0x00ad5652  frame 1  -- CRT
0x009d5440  frame 2  -- game
0x24740308  (chain broken; 0x9e35e0 does `and esp,-8`)
```

`0x009d5440` is the return of `call 0x9e35e0` inside a linked-list walk:

```
009d5430  mov edx, [esi+0x8]
009d5433  mov eax, [esp+0x10]
009d5437  mov ecx, [eax+0xc]
009d543a  push edx
009d543b  call 0x9e35e0
009d5440  mov esi, [esi]        ; next node
009d5442  cmp esi, edi
009d5444  jnz short 0x9d5430
```

`0x9e35e0` is a graph traversal: it zeroes six dwords of a local container at
`[esp+0x74]`, hands that container to `0x9e22f0` for every node it reaches, and
walks a vector-shaped `[esi+8]`/`[esi+0xc]` pair whose element count it computes
as `([ecx+0xc] - [ecx+8]) >> 2`. A count derived by subtracting two pointers is
exactly the shape that turns one bad pointer into a 430 MB request.

### The dominant anomaly is a NULL spin: 23.9 million unmapped reads from one block

`--fault-null` across the same run:

```
[fault] census: 23917897 unmapped access(es) from 48 eip(s)
[fault]   eip=0x9e1e50 x23917314 addresses 0x0-0x4
[fault]   eip=0x9e35e0 x127      addresses 0x4-0x247c830b
[fault]   eip=0x9cef6f x84       addresses 0x48-0x78
[fault]   eip=0x9cf060 x56       addresses 0x4c-0x58
...
```

One block is 99.998% of it. `0x9e1e50` opens

```
009e1e50  push ebp / mov ebp,esp / and esp,-8 / sub esp,0x54
009e1e59  mov eax, [ebp+0x8]     ; arg 1
009e1e5e  mov ecx, [eax]         ; -> address 0x0
009e1e64  mov ecx, [eax+0x4]     ; -> address 0x4
```

so the census's `addresses 0x0-0x4` says arg 1 is **NULL**, 23.9 million times.
It has three call sites (`0x9e3108`, `0x9e311f`, `0x9e3a20`), all inside the
same `0x9e3xxx` family as the allocator above.

This is the same shape as the walker wedge recorded earlier in this file: on
real hardware those reads are an access violation, and here `$g2w`'s NULL
sentinel makes them a cheap zero, so a routine that should have died quietly
instead runs on garbage until it asks for 430 MB.

**Two things follow.** More memory would not have helped -- the request is a
symptom, not a requirement. And the next measurement is whether the garbage is
precision: these are the Qhull-family routines, `--trace-fpu` has still never
been run across the land load, and zero `[fpu]` lines would send the search back
to the object graph while exceptions around the traversal would make x87 the
prime suspect.

### The NULL is a record field, and the 430 MB is the same function's own container

`FAULT_WHO=0x9e1e50` (a worktree-only dump in `unmapped_trace`: registers, ten
dwords at ESP and an eight-deep EBP walk, the first N times one block faults)
answers both halves at once. Every fault reports the same frames:

```
[who] fault#1 addr=0x0 eip=0x9e1e50
[who]   eax=0x2e184fe8 ecx=0x0 edx=0x35c55010 ebx=0x0 esi=0x2e204464 edi=0x2e184fe8
[who]   frames 0x9e3a25 <- 0x9d5440
[who] fault#2 addr=0x4 ... esi=0x0
```

`eax` is a valid pointer, so argument 1 is fine and the faulting instructions
are not the ones that read it. They are

```
009e1e6c  mov ecx, [ebp+0xc]    ; argument 2
009e1e70  mov esi, [ecx]        ; ecx = 0  -> fault at 0x0
009e1e72  mov ecx, [ecx+0x4]    ;         -> fault at 0x4
```

and fault #2's `esi=0` is the zero the first read already returned. **Argument 2
is NULL.** Of the three call sites the hot one is `0x9e3a20`, which builds its
arguments out of a 24-byte record:

```
009e39e7  mov eax, [esp+0x20]   ; byte offset
009e39eb  mov edx, [esp+0x74]   ; array base
009e39ef  add edx, eax
009e39f1  mov esi, [edx]        ; +0x00
009e39f9  mov edi, [edx+0xc]    ; +0x0c -> argument 1, VALID
009e39fc  mov ebx, [edx+0x10]   ; +0x10 -> argument 2, NULL
009e3a06  push ebx
009e3a0f  push edi
009e3a20  call 0x9e1e50
```

So the record is **half filled**: `+0xc` is a good pointer and `+0x10` beside it
is zero. Not an unallocated record, not a wild pointer -- one field.

`0x9e3a20` is inside `0x9e35e0`, the same function the 430 MB allocation came
from, and `[esp+0x74]` is the local container `0x9e35e0` zeroes on entry
(`0x9e362f`-`0x9e3649`) and hands to `0x9e22f0` for every node it reaches.
`0x9e22f0` is a **linear scan over 24-byte records** --

```
009e2300  mov edx,[ecx+0x8] / sub edx,esi / imul 0x2aaaaaab / sar edx,2   ; (end-begin)/24
009e2320  cmp [esi], edi     ; key is field +0x00
009e2327  add esi, 0x18      ; next record
```

-- returning true when a record's `+0x00` matches, and `0x9e35e0` skips the node
when it does (`test al,al / jnz 0x9e37ee`). That is a visited set, and it is
also the container that reached 430 MB. **A visited set only grows without
bound when its lookup never hits**, so the 430 MB and the NULL field are two
symptoms of the same thing: the records being appended do not describe what the
traversal thinks they describe.

Next measurement: the dump now also resolves the array base and offset from the
frame (`base` at `ebp+0x84`, `offset` at `ebp+0x30`, since the caller's ESP
before its two pushes is `ebp+0x10`) and prints all six fields with the record's
guest address. That address is what a `--watch` can be pinned to, to catch the
write into `+0x10` -- or to prove there never was one.

## The NULL is an out-of-bounds array read, and the hang is a circular list that lost its circle

The 23.9M faults from `0x9e1e50` (and the 4.5 *billion* from `0x9e17d0` in the
runs before the heap fixes) are not a pointer the game checks and we corrupt.
They are a **circular linked-list walk that can never terminate**:

```
009e17d0  mov eax,[edx+0x8]     ; <- the reported fault eip (block entry)
009e17d3  mov ebx,[edx]         ; next
...                             ; 64-bit integer cross products, no FP at all
009e1822  mov edx,ebx
009e1827  cmp [esp+0x20],edx    ; back at the start node?
009e182b  jz  short 0x9e1831
009e182f  jnz 0x9e17d0          ; ... else keep walking
```

`edx = [edx]` until `edx` equals the node the walk started from. Hand it a node
whose `next` is NULL and `$g2w`'s NULL sentinel answers every load with 0, so
`edx` is 0 forever, the start comparison never holds, and the loop spins. That
is the whole "430 MB allocation" story: the walk is inside an algorithm that
allocates per visited node, so an endless walk is an endless allocation. **On
real hardware this is an access violation on the first iteration.** More memory
was never going to help, and neither is a bigger heap.

### Where the NULL comes from: `0x9e35e0` indexes a vertex star without a bounds check

`0x9e35e0` (one function, `0x9e35e0`-`0x9e3cbe`; the `ret 0x4` at `0x9e3855` is
an early return, not the end) walks a list of nodes and, for each, picks a pair
of adjacent edges out of that node's star -- a `std::vector<Edge*>` at
`[node+0x14]` / `[node+0x18]`:

```
009e36ef  call 0x9edb80         ; i = index of edge e in the star, or -1
009e36f4  mov ebx,eax
009e36f6  lea edi,[ebx-0x1]
009e36f9  test edi,edi
009e36fb  jl   short 0x9e3750   ; i == 0 (or i == -1): no left neighbour
009e36fd  mov ecx,[esi+0x14]
009e3703  mov eax,[ecx+edi*4]   ; arr[i-1]
009e3723  call 0x9ddf80         ; -> its two endpoint vertices
009e372c  ...                   ; does either equal the key vertex?
009e373a  jz   short 0x9e3755   ; yes: use the pair (i-1, i)
009e3750  mov edi,ebx           ; no:  use the pair (i, i+1)
009e3752  add ebx,0x1
009e3755  mov esi,[esi+0x14]
009e3758  mov eax,[esi+edi*4]   ; -> record +0x0c
009e375f  mov ebx,[esi+ebx*4]   ; -> record +0x10   <-- arr[i+1], unchecked
```

`0x9edb80` is a plain linear "index of" over that same vector and returns **-1**
when the edge is not in it. Neither index is clamped and neither wraps. So the
half-filled 24-byte record we measured -- `+0x0c` a valid vertex, `+0x10` NULL
-- is exactly the signature of `arr[i+1]` read one past the end: `[garbage]`
lands unmapped, `$g2w` answers 0, and `[0+8]` answers 0 again. The census
agrees, and names the two derefs that see it:

```
[fault]   eip=0x9e35e0 x127 addresses 0x4-0x247c830b   ; arr element is garbage
[fault]   eip=0x9ddf80 x35  addresses 0x0-0x8          ; this == NULL
[fault]   eip=0x9ddfb0 x7   addresses 0x8-0x8          ; `mov eax,[ecx+8]; ret`, ecx == 0
```

The record's six fields are written at `0x9e36eb`/`0x9e3766`/`0x9e375b`/
`0x9e378e`/`0x9e37b9`/`0x9e37cc` (offsets +0, +4, +8, +0xc, +0x10, +0x14), which
is why only one of the two vertex fields is ever the bad one.

### The comparisons are integer, so the precision story stays dead

`0x9c4152` is the segment-intersection predicate this subdivision runs on, and
it is an **integer-coordinate** routine: `mov ecx,[edx+4] / sub ecx,[eax+4] /
imul ecx,[edx]`, then `fild dword` -- the doubles only ever hold cross products
of integers. Its two outputs are rounded back to integers at `0x9c43ac` with the
control word switched to truncate (`fnstcw / or ah,0x0c / fldcw / fistp word /
fldcw`) after a +/-0.5 bias chosen by sign, and our `$fpu_to_i16` routes through
`$fpu_round`, which honours RC. The `ZE` raises `--trace-fpu` counted at
`0x009c4214` and `0x009c42a5` are the two `fdiv qword [ebp-0x8]` by a zero
determinant -- degenerate/parallel segments, masked, +/-Inf, and then compared
away. So the key equality tests at `0x9e36c1` and `0x9e3730` are exact integer
compares, not float compares, and no amount of x87 fidelity moves them.

What is left is *why* index `i` is the last element of the star (or the star is
too short). The measurement that answers it needs no new tooling:

```
--trace-at=0x9e3755 --trace-at-limit=300 --trace-at-mem=esi+0x14:4,esi+0x18:4
--count=0x9e3750,0x9e3755,0x9e17d0,0x9e1e50
```

`--trace-at` fires at the block entry, *before* `mov esi,[esi+0x14]` overwrites
`esi`, so `esi` is still the node and the two `--trace-at-mem` reads are the
vector's begin/end -- `(end-begin)/4` is the element count, to be read beside the
`EDI` and `EBX` the register dump already prints. `EBX >= count` is the
out-of-bounds read, confirmed.

## CORRECTION 2026-09-13: the NULL-star mechanism does not drive the hang

The section above ("the NULL is an out-of-bounds star read; the hang is a
circular walk") named `0x9e35e0`'s unchecked `arr[i+1]` as the source of a NULL
`next` that makes the walk at `0x9e17d0`/`0x9e1e50` spin forever. A measured run
refutes the first half of that.

Run: `bw-software-probe-4WdnWU`, worktree build carrying the A4R4G4B4 (format 26)
texture fix, driven to the land click, 460788 batches over 3908s. `--count` on
the four addresses:

```
0x009e3750 = 6            ; neighbour rejected -> pair (i, i+1)   <- the "bad" path
0x009e3755 = 2            ; neighbour accepted -> pair (i-1, i)
0x009e17d0 = 14741
0x009e1e50 = 11958660
```

The neighbour selection ran **eight times in the whole run**. Eight executions of
an out-of-bounds read cannot account for 11.9M iterations of the walk, so
`0x9e35e0` is not the driver of the hang, whatever else is true of its missing
bounds check.

The fault census kills the mechanism outright. With `--fault-null` armed this run
reported **510 faults total, 66 of them at `0x9e1e50`, against 11958660 entries
to that block** -- 0.0006%. The walk is reading mapped, non-sentinel pointers on
essentially every iteration. It is therefore NOT looping because a NULL `next`
reads as 0 and never matches the start node; that was the entire proposed
mechanism and it does not hold.

What the earlier 23.9M-fault census (`bw-software-probe-q3ArIc`) measured is a
different build: it predates the A4R4G4B4 fix. The working hypothesis for the
difference -- NOT yet confirmed -- is that the refused texture format left a
slot NULL and produced the fault storm, and that fixing it removed the storm
while leaving a second, independent defect underneath with the same outward
symptom. Two stacked bugs would explain why the OOM, the fault count and the
hang all looked like one thing.

Still true and still unexplained:
- The walk terminates only by returning to its start node, and it is not
  returning. With valid pointers, that means the list genuinely does not close.
- The first fault of the run is at `eip=0x9cef45`, where `ebx` (loaded from a
  local at `0x9cef4b`) is NULL and is then read at `[ebx+0x28]`, `[ebx+0x48]`
  and written at `[ebx+ecx*4+0x4c]`. This is upstream of everything above and is
  the next thing to chase.

Do not re-derive the float-precision hypothesis; §"integer predicate" above still
stands and is independent of this correction.

### ...and 11.9M is not even obviously a runaway

Rate matters more than the raw count and the earlier framing ignored it.
11958660 entries over 3908.070s is **~3060 entries per second**. The run retired
460788 batches; at the measured mean of several hundred blocks per batch that is
a few hundred million block entries total, so `0x9e1e50` is on the order of 3% of
all block entries. That is a *hot loop*, which is what a terrain/edge query in a
frame loop is supposed to look like. It is not by itself evidence of an unbounded
walk.

So the honest state is weaker than either previous claim: we have not shown the
game hangs in this code at all. This run did not hang -- it ended at 3908s on a
host-side d3d9 error (`QueueError: native render heap handoff rejected`,
`lib/d3d-command-stream.js:658`), with the guest still executing.

Before any more work on `0x9e17d0`/`0x9e1e50`, establish that there is something
to fix there: compare the per-second rate of that block against a run that makes
progress, rather than reading a large cumulative count as pathology.

### AMENDMENT 2026-09-13: the two corrections above retract too much

Both sections above were written before the crash was read properly, and they
are wrong about two things. Keep their measurements; discard their conclusions.

**1. The run does not end on a host d3d9 error.** `QueueError: native render
heap handoff rejected` is thrown inside `cancel()` in `lib/d3d-command-stream.js`
(the `_reclaimHeap` path, ~line 657), which only runs while the render worker is
already being torn down. It is a symptom of the exit, not its cause. The actual
ending, from the same log:

```
[fault] unmapped guest access 0x247c8307 from eip=0xad561b
[heap] OOM: 430571520 bytes (0x19aa0000) — sparse arena: no guest address space left to reserve
[C++ throw] .?AVbad_alloc@std@@ <- .?AVexception@@  obj 0x074fc980 at EIP 0x00ada813
=== UNHANDLED EXCEPTION: CXX_EXCEPTION 0xe06d7363 ===
[Exit] code=-529697949
```

`-529697949` is `0xE06D7363`, the MSVC C++ exception code. The guest asked for
430MB, the arena refused, the CRT threw `std::bad_alloc`, and nothing caught it.

**2. It is ONE allocation, not an accumulation.** 430,571,520 bytes in a single
request. Every earlier story of the form "allocates per visited node until the
heap refuses 430MB" is dead: nothing accumulates, one call computes an absurd
size. So the question is not "what loops forever" but "what computed this
number", and that is a much narrower question.

**`0x9e35e0` is implicated after all, and the `--count` argument that cleared it
was a misreading.** `--count` counts BASIC BLOCK entries, not function calls.
`0x9e3750`/`0x9e3755` are blocks *inside* `0x9e35e0` (which spans
`0x9e35e0`–`0x9e3cbe`), and `0x9e3755` only becomes a block entry when the `jz`
at `0x9e373a` is taken. The function's own entry was never counted, so "the
function ran 8 times" was never measured and should not have been written down.

The caller chain from the OOM frame dump — innermost first — is
`0x00ad561b` (CRT `malloc`) ← `0x00ad5652` (`operator new`) ← `0x009d5440`.
`0x009d5440` is the return address of `call 0x9e35e0`, inside an outer
circular-list walk:

```
009d5428  mov esi, [edi]        ; list head
009d542a  cmp esi, edi
009d542c  jz  short 0x9d5446    ; empty -> done
009d5430  mov edx, [esi+0x8]
009d5437  mov ecx, [eax+0xc]
009d543b  call 0x9e35e0         ; <-- the 430MB allocation happens under here
009d5440  mov esi, [esi]        ; next
009d5444  jnz short 0x9d5430
```

So the star function and the walk are one call chain, and `call 0x9e1e50` sits
at `0x9e3a20` *inside* `0x9e35e0`.

**Where to look next.** The size is computed inside `0x9e35e0` from a pointer
difference feeding a vector-growth helper. The candidate sites, each a
`end - begin` subtraction ahead of a growth call: `sub ecx,eax` at `0x9e3b1c`
and `0x9e3b51`, `sub ecx,edx` at `0x9e3b97`, `imul edx` at `0x9e3c11`, feeding
`call 0x9e62f0` (`0x9e3b0d`, `0x9e3b40`), `call 0x9e6340` (`0x9e3b38`,
`0x9e3b6b`) and `call 0x9e61a0` (`0x9e3be7`). `0x19aa0000` is the number to
work back from.

What survives unchanged from the corrections above: the NULL-sentinel spin is
still not the mechanism (`0x9e1e50` faulted 66 times against 11,958,660 block
entries, 0.0006%), ~3060 entries/s is a hot loop rather than a demonstrated
runaway, and the earliest fault — `eip=0x9cef45` with `ebx` NULL, loaded from a
local at `0x9cef4b` — is still upstream of everything here and still unexplained.

### CORRECTION 2026-09-13: `--skip-intro` writes to a stack local, not the intro object

The mechanism documented in "Ending the intro on demand" is right; the probe's
identification of the object it writes to is not. `tools/black-white-software-probe.js`
takes the object from `ESI` on a trace at `0x00526d93`, but the exit test the
section above disassembles is at `0x00529421`/`0x00529433`, and `ESI` at
`0x526d93` is not the same value. Measured, from the one trace hit in a run:

```
[EIP] 0x00526d93 ... ESP=0x074d69f0 EBP=0x074d6bc0 ESI=0x074d6bdc EDI=0x00000031
```

`ESI` is `EBP+0x1c` — inside the stack frame, in the guest stack region
(`0x07400000`–`0x07500000`). It is a local, not a heap-allocated sequence
object. Two independent corroborations that the fields read off it are garbage:

- `frame` stayed at **1** for the whole of a 560-second run, sampled every 5s.
  A running intro increments it; a finished one does not sit at 1.
- `target` reads **636**, against the 1787 frames this file documents.

The probe still prints `Intro skip: { frame: 1, finishFrame: 0 }`, so the write
*happens* — into `stack+0x24`. Nothing about the engine's intro state changes,
and the skip is a no-op at best. It is not obviously harmless: the address it
writes is a live stack slot.

So do not read "Intro skip:" in a log as evidence the intro was ended, and do
not use `--skip-intro` as the way to reach the menu until the object is taken
from `ESI` at `0x00529433` (the engine's own exit test) rather than `0x526d93`.
A run traced at `0x529433` for ten minutes took **zero** hits, so the intro tick
was not executing at all in that window — which is its own open question, and
means "the menu is an hour of intro away" is not established either.

**Do not time anything on this box without reading `uptime` first.** These runs
were made at load averages of 54, 208 and 394. The same build reached 249 d3d9
submissions in 304s at load 54 and 19 submissions in 616s at load 394 — a 20x
spread that is entirely the machine. Any "it stalls after N submissions"
conclusion drawn without that number beside it is unsafe.

### What the title card actually is (2026-09-13, Claude)

The app is not stuck *on* the title screen, and it is not deadlocked. Decoding
the probe's own command-stream counters with `OPCODES` from
`lib/d3d-command-stream.js` (`1 RESOURCE_CREATE, 5 DRAW, 6 CLEAR, 12 PRESENT`),
a run that has reached the title card reports:

```
submitted {"1":1,"5":162,"6":4,"12":80}
categories {"5/2/false/false/2048x1024:1":78, "5/2/false/false/64x64:1":78}
```

That is **80 presented frames** carrying ~2 draws each — one 2048x1024 surface
and one 64x64 — i.e. an ordinary render loop redrawing the title card. The
engine then *stops presenting* (the counters freeze, 249 total in that run) and
the guest disappears into `d3dx9_25` for the rest of the run.

Where it goes is measurable and is the same place every time: EIP samples land
in original VAs `0x004e7000`–`0x004ea000`, and `--host-census` shows the work
there is CRT-heavy allocation, not a blocking wait —
`TlsGetValue`/`GetLastError`/`SetLastError` in exact lockstep (the MSVC
per-call TLS/errno preamble, 6679 each per 30k trace lines) alongside
`HeapAlloc`/`HeapFree`/`HeapSize`. Disassembly around `0x004ea780` is float
math with `fnstcw`/`fldcw or 0xc00` (D3DX's float-to-int rounding idiom).

So the sequence is: render the title card for ~80 frames, then begin loading
the menu through D3DX in software, and that load is where the wall clock goes.
"It hangs at the title screen" is wrong; "it is still loading" is right.

Two things this rules out, so they are not worth re-deriving:
- Not the intro. The intro tick at `0x00529433` takes **zero** `--trace-at`
  hits across a ten-minute run, so the opening sequence is not executing and
  `--skip-intro` is irrelevant here (it is also broken -- see the correction
  above).
- Not a blocking API. No API is being waited on; the host census is dominated
  by `log`/`log_api_exit` pairs, which are the per-call trace hooks, with every
  non-CRT counter (`get_window_rect`, `gpu_gl_call`, `fs_*`) frozen.

`--time-scale=10` did not move it either, which by the flag's own contract means
this is not timing-bound. It is throughput: 2048x1024 surfaces filtered and
uploaded through the software path in an x86 interpreter.

**Measure this on a quiet box or not at all.** These runs spanned loadavg 54 to
485, and the same build reached 249 submissions in 304s at load 54 against 7 in
310s at load ~450.

### The 430MB request is a std::vector growth (2026-09-13, Claude)

Static, so it needs no run and no quiet box. Following the frame chain from the
amendment above (`malloc` <- `operator new` <- `0x009d5440`), the allocation is
under `0x9e32a0`, which `0x9e35e0` calls at `0x9e3606`-`0x9e360e`:

```
009d543b  e8 a0 e1 00 00   call 0x9e35e0      ; returns to 0x9d5440  [verified]
```

`0x9e35e0` is a large function, not a stub -- the `ret 0x4` at `0x9e361b` is an
early-exit path and the body continues at `0x9e361e`, branching as far as
`0x9e380a`. `0x9e32a0` is frame-pointer-omitted (`sub esp,0x60`, no `ebp`
frame), which is why the EBP walk skips from `operator new` straight to
`0x9d5440`.

`0x9e32a0` builds **three** vectors, each a `{begin,end,end_cap}` triple in its
frame (`esp+0x44/48/4c`, `esp+0x24/28/2c`, `esp+0x64/68/6c`), each with the
same MSVC push-back idiom: compare `(end-begin)>>2` against `(cap-begin)>>2`,
store and bump on the fast path, else call the growth helper `0x5e44d0`.

`0x5e44d0` is `std::vector<T>::_Insert_n` for a 4-byte `T`:

```
005e44ea  mov eax, [esi+0xc] / sub eax,edx / sar eax,2   ; capacity
005e4506  mov ecx, [esi+0x8] / sub ecx,edx / sar ecx,2   ; size
005e450f  mov ebx, 0x3fffffff                            ; max_size for 4-byte T
005e4514  sub ebx, ecx
005e4516  cmp ebx, edi                                   ; edi = count to insert
005e4518  jnb short 0x5e4528
005e451c  call 0x59c580                                  ; _Xlength_error
```

So the element size is 4, confirmed three ways (`sar 2` at the push-back sites,
`sar 2` here, and the `0x3fffffff` max_size constant). **`0x19aa0000` is
430,571,520 bytes = 107,642,880 elements**, and it is a *capacity* growth, not a
one-shot request for a known size.

That matters, because it partly walks back the "one allocation, not an
accumulation" line in the amendment above. The single refused allocation is
real, but a vector reaching 107.6M 4-byte elements got there by *accumulating*,
and by doubling — so earlier growths of ~215MB, ~107MB and so on **succeeded**
before this one was refused. Something pushes ~10^8 pointers into one of these
three vectors. An unbounded walk feeding a push_back is exactly that shape, so
the NULL-sentinel mechanism is back on the table as the *source* of the pushes
even though it is not itself the thing that allocates.

**Next probe, and it is cheap:** `--break=0x5e44d0` or
`--trace-at=0x5e44d0` with the `this` pointer in `ecx` — dump
`[ecx+4]/[ecx+8]/[ecx+0xc]` to get begin/end/cap, and `[esp+0x14]` for the
insert count. That names *which* of the three vectors runs away and what its
size was on the way up, without waiting for the 430MB refusal at the end.

### The 430MB crash may be harness-induced (2026-09-13, Claude)

Before spending more time treating the 430MB allocation as a guest defect,
check how the pointer was moved in the run that produced it.

`test/run.js`'s `relmousemove` documentation already records the hazard:

> A DirectInput game reads the whole delta accumulated since its last poll, and
> headless frames are seconds apart, so one of these arrives as a single lump no
> hand could produce. A 2D menu clamps it at the screen edge; a 3D scene feeds
> it to a camera or a terrain pick and a value like -2000 can send the game into
> an unbounded world query it never returns from.

The drive harness that produced the 430MB run parked the pointer with
`handleRelativeMouseMove(-3000, -3000)` before **every** click, to slam it into
a corner and establish a known origin. On the menus that is invisible, because a
2D menu clamps at the edge. The land picker is not a 2D menu, and the park ran
immediately before the land click -- the last thing the run did before the
allocation. An unbounded world query is exactly the shape that pushes ~10^8
pointers into one of the three vectors in `0x9e32a0` and then asks for
430,571,520 bytes.

So the causal chain to test first is **harness -> lump delta -> unbounded terrain
query -> vector growth -> bad_alloc**, not a spontaneous guest bug. That does not
clear the guest (a real program should not answer a large mouse delta with an
unbounded query, and the NULL sentinel may still be what makes the query
unbounded rather than merely large), but it does mean a run that reproduces the
crash while feeding -3000 deltas has not demonstrated anything about ordinary
gameplay.

Splitting the delta inside a single eval does **not** fix it: the guest polls
once per frame, so sub-frame pieces re-accumulate into the same lump. Pace the
steps on the wall clock, one control command per step, and let a frame pass in
between. The scratch drive script now parks in 11 steps of (-64,-48) and glides
to the target in 6, each its own control round trip.

### Driving to the menu: the procedure that works (2026-09-13, Claude)

Five harness bugs were fixed to get this right; the notes below are what each
one cost, so the next session does not re-find them.

**Identify screens by compressed PNG size, not by a canvas checksum.** The game
animates the scene behind every screen, so a whole-frame checksum changes about
once a second on its own -- "it changed" carries no information. And every one
of these screens is static for minutes, so "it settled" confirms whichever
screen you are already on. A checksum-based drive clicked at a title card for
ten minutes while reporting four successful screen advances. Size is crude but
it answers *which* screen. Measured windows, 640x480:

| screen | size window |
|---|---|
| title card | 210000-235000 |
| Select Profile / New Profile Name | 300000-390000 |
| main menu, tutorial | 385000-400000 |
| land menu | 408000-422000 |
| blank / not yet drawn | ~2000-3200 |

Require **two consecutive captures** inside the window and within 4000 bytes of
each other, so a frame caught mid-transition cannot confirm a screen alone.

**Take the byte count from the control reply, not from `stat`.** The `png`
command's reply carries `{"bytes":N}` after the encode; `stat` races it. That
race produced alternating `220353 / 0 / 0` readings which reset the
two-in-a-row test every other sample, so no screen could ever confirm.

**Never feed a large relative mouse delta** -- see the section above. Park and
move in small steps, each its own control command, paced on the wall clock.

**Do not expect `--skip-intro` to do anything** -- it writes to a stack local
(see the correction above), and in these runs the intro tick never executed at
all.

**Budget the D3DX phase, not the click.** The app presents ~20-80 frames of the
title card and then disappears into `d3dx9_25` loading the menu in software.
That phase, not the input, is the wall clock: it ran past four minutes at
loadavg 54 and had not finished.

**Check `uptime` first, and do not bother below a quiet box.** This machine has
8 cores. Runs this session spanned loadavg 54 to 486; at 486 that is ~60x
oversubscription, about 1.6% of a core per process, and the same build reached
249 command submissions in 304s at load 54 against 7 in 310s at load ~450.

## CORRECTION 2026-09-13: the PNG-size windows in "Driving to the menu" are ambiguous

The table committed in `30702b5f` classifies screens by compressed-PNG byte count.
Two of its windows match more than one screen, so a `waitfor` on them confirms
whichever screen the app is already on and the next click is aimed at nothing.

Sizes measured this session, software renderer, 640x480:

| screen | bytes |
|---|---|
| blank | 2061 - 3133 |
| BLACK & WHITE 2 logo title card | 220,352 |
| legal / DEMO splash | 320,251 |
| Select Profile + New Profile Name dialog | 339,904 - 339,972 |

So the old `dismiss` window `300000-390000` covers the legal splash **and** the
profile dialog, and the old `menu` window `385000-400000` matches neither - the
drive sat on it for 900s and timed out with the profile dialog on screen the
whole time. Do not trust a size window until a screenshot has been read at that
size; the classifier is a hint, the picture is the evidence.

## The button hold has to be a batch budget, not a wall-clock gap (2026-09-13)

This box regularly sits at load ~300 with 400+ node processes against 8 cores,
which leaves the probe about 2% of a core and ~3 batches/s. A 3-second
down->up gap is then ~9 batches, which can be less than one guest frame, and the
press is simply never polled - the run looks like "the click does nothing" and
is really "the guest never got a turn between press and release". Wait on the
`{"action":"ping"}` batch counter instead, so the hold means the same thing
whatever else the machine is doing.

Also: a hand-rolled press that sets `_mouseButtonsMask` and calls
`_queueDirectInputMouseButton` directly is **not** equivalent to
`renderer.handleMouseDown(x,y,0)`. It skips `_signalDirectInputDevice(2)` and
the whole window-routing path. Use the real handler.

## Why B&W2 is slow: 77% of guest ops are string-hashing a resource name (2026-09-13)

Measured on a 22s fixed window, software renderer, `--handler-hist
--handler-hist-thread=0 --hot-block-dump`. Two separate questions were tangled
together here and they have different answers.

### It is not the emulator, and it is not the rasterizer

| measurement | result |
|---|---|
| pure busy-loop control (no I/O, no yields) | 25% of one core |
| this run, 20s wall | 2.0-3.1s CPU (~13%) |
| blocks retired per second **of CPU** | ~5.3M (normal range) |
| why each batch stopped | `budget spent`, 100% of batches |

Every batch spends its whole block budget, so nothing is bailing early, and
throughput per CPU-second is normal. The box was at loadavg 416-475 against 8
cores (440+ node processes from other sessions), so wall-clock here is inflated
about 4-8x by the machine. Two things that looked like our bugs are not:
`--real-ticks` costs ~1.8x, and a 10x larger `--batch-size` made it slightly
*worse*, which rules out per-batch event-loop wakeup latency.

### What the guest actually spends its instructions on

Top six handlers, 59.9M ops in the window:

    H3  $th_add_r_i32        8578153 (14.33%)
    H19 $th_cmp_r_r          7663147 (12.80%)
    H149 $th_compute_ea_sib  7593165 (12.68%)
    H309 $th_jcc_b           7583990 (12.67%)
    H47 $th_alu_m32_r        7192798 (12.01%)
    H78 $th_movzx8           7190911 (12.01%)

That is 77% of all ops, and the counts are equal because they are one loop body
executed ~7.6M times. The hot blocks name it:

| VA | share of block entries | shape |
|---|---|---|
| `0x009a8780` | 10.5% | `mov cl,[eax] / add eax,1 / test cl,cl / jnz` - **strlen** |
| `0x009a87a2` | 10.5% | the copy that follows it |
| `0x009a8712` | 9.9% | `movsx ebx,[edx+edi] / shr ebp,24 / xor / shl eax,8 / xor eax,[ecx+ebx*4]` - **table-driven CRC32**, one byte per iteration |
| `0x00ad764b` + `52` + `57` + `5c` | 31.4% | `cmp cl,'a' / jl / cmp cl,'z' / jg / sub cl,0x20` - **uppercase in place**, one char per iteration |

`0x009a8770` is the enclosing function: strlen the name, alloca, copy, uppercase
it, CRC32 it. It is a **case-insensitive string-keyed resource lookup**, and
B&W2 calls it constantly. 63% of all block entries and 77% of all ops go into
hashing resource names character by character.

This is also why the app looks stuck rather than slow. Sitting on the profile
dialog it went **823 seconds presenting one frame and issuing 22 draws** - not a
deadlock and not a slow rasterizer, but the resource loader grinding through
these loops. The same loops dominate the boot window, which is why reaching the
profile dialog takes ~22 minutes of wall clock on this box.

### Why none of it is folded

`$loop_match_block` in `src/07b-loop-match.wat` only ever runs on a block that
branches to **itself**, so the uppercase loop is invisible to it by
construction: the two `jl`/`jg` sentinel branches split one character into four
basic blocks, and a character costs four block transfers. The strlen and CRC32
loops *are* single-block self-loops and so are visible - but there is no scan
fold in the matcher at all. `SCAN_RUN` exists as a predicate in
`tools/match-loops.js` and has no WAT handler behind it; only `LUT_RUN` is on
(`COPY_RUN` is off). Run counters for the window: `extended 3348 | blocks
chained 4674`, i.e. essentially nothing folded.

So the work list, in payoff order, is a scan/strlen fold, a byte-transform fold
that can see a multi-block diamond, and a CRC32 fold. Note `tools/match-loops.js`
cannot be run against this exe to confirm - it does not finish within 90s on a
20MB image.

**Caveat on units:** these are block entries and handler ops, both load-immune.
No wall-clock speedup is claimed here, and none should be quoted from this box
at loadavg 450. A fold collapses a loop into one dispatch, so block counts stop
being comparable across the change - measure progress in presents or in guest
API calls per CPU-second instead.

## CORRECTION 2026-09-13: the "77% of ops" profile above was measured wrong, twice

Two independent mistakes, both mine, and the conclusion does not survive either.

**1. The run was missing the seeded DLLs.** `tools/black-white-software-probe.js`
passes `--dll-seed=d3dx9_25.dll,binkw32.dll,dbghelp.dll`; I profiled without it.
Without those DLLs the guest calls our D3DX stubs, and `D3DXMatrixPerspectiveFovLH`
is a fail-fast stub, so the run dies at batch 190 with `=== UNIMPLEMENTED API ===`
instead of doing the app's real work. Any profile taken that way is of a
different program. Same 22s window, the two configurations:

| | no `--dll-seed` | with `--dll-seed` |
|---|---|---|
| batches | 54 | **1851** |
| handler ops | 59.9M | **807.2M** |
| API calls | 82,927 | 904,189 |

**2. `top blocks` silently drops most of its input.** `$hot_block_hist_record`
(`src/04-cache.wat:1000`) is a **4-way** bucket: after four probes it increments
`$hot_block_hist_collisions` and records nothing. That run reported
`distinct=19680 collisions=7216503` against ~3.78M recorded entries, i.e. **66%
of block entries never entered the list**, and the hottest loop was among the
lost ones. The printed top-blocks table is not a profile unless `collisions` is
small - check it before quoting it. The **SIB-consumer histogram in the same
output is trustworthy** (`collisions=1091` of 40M); it is what actually found the
hot loop.

### What the profile says once both are fixed

    H190 $th_fpu_mem_ro   184685100 (22.88%)
    H189 $th_fpu_reg       57341141  (7.10%)
    H188 $th_fpu_mem       39245653  (4.86%)

**x87 is ~35% of all ops** - the game's own geometry plus d3dx9_25's software
math. That is the steady-state cost and the thing worth attacking.

The one loop still worth folding is the byte checksum at `0x0085b210`:

    0085b210  movzx ecx, byte [eax+edi]
    0085b214  add  [0x1d5e148], ecx
    0085b21a  add  eax, 1
    0085b21d  cmp  eax, esi
    0085b21f  jb   0x85b210

It ran **20,656,128** times, which is exactly `BW2Demo.exe`'s file size - the app
byte-sums its own 20MB image as an anti-tamper self-check. That is a fixed
~124M-op startup tax (~15% of this window), it is a single-block self-loop, and
its accumulator is a fixed memory address re-read and rewritten every iteration,
so a fold can hold it in a local and write back once.

**Not stdlib.** `0x9a8780` (strlen) and `0xad764b` (uppercase) are inlined CRT,
but together they are only ~12% of ops; matching statically-linked CRT functions
would not have touched the dominant cost. `0x85b210` and the CRC32 at `0x9a8712`
are game code, not library code.

## Where the CPU actually goes, on an idle box (2026-09-13)

Earlier measurements on this app were all taken at loadavg 400+. With the box
idle (loadavg ~9) the emulator runs at **111% CPU** and still renders B&W2 at
**0.40 presents/s**. So the speed question is ours, not the machine's, and
`node --cpu-prof` over a 55s window answers it: **87.0% WASM / 13.0% JS**. The
software rasterizer is not the bottleneck.

Top self time (55,769ms total):

| cost | ms | share |
|---|---|---|
| `$next` (threaded dispatch) | 9167 | **16.4%** |
| `$fpu_exec_mem` | 4963 | 8.9% |
| `$branch_end` (block transfer) | 3894 | 7.0% |
| `$th_compute_ea_sib` | 1975 | 3.5% |
| `$set_reg` / `$get_reg` | 2759 | 4.9% |
| `$gs32`/`$gl32`/`$g2w`/`$guest_page_translate` | 5482 | 9.8% |
| `$th_fpu_mem_ro` | 1128 | 2.0% |

Grouped: **dispatch + block transfer is 23.4% of all CPU** - nearly a quarter
spent deciding what to run rather than running it, which matches the project's
own ~8ns/dispatch + ~9ns/transfer figures. x87 is 10.9%, address translation
9.8%. There is no single bug here; this is the shape of an interpreter, and B&W2
needs roughly 50-75M guest ops per frame.

### One free JS win, taken

`h.log` in `test/run.js` decoded the API name from guest memory on **every** API
call - 904,207 of them in 55s - allocating a `Uint8Array` view and concatenating
the string a character at a time, unconditionally, even under `--quiet-api`
where nothing reads it. It was the largest single JS cost at 1403ms (2.5%) plus
its share of 903ms of GC. Memoizing by guest pointer (the names are static
strings in the image, and the memory is created with `initial === maximum` so the
buffer is never detached) halved it to 697ms and took JS overhead from **13.0%
to 8.3%** of CPU. GC left the top-18 list entirely.

## `--skip-intro` is NOT a no-op - correcting the 2026-09-13 CORRECTION above

The earlier note said the flag writes to a stack local and does nothing. Running
both ways on an idle box shows it plainly does something, and the two failure
modes are different:

| | intro sample | presents | behaviour |
|---|---|---|---|
| without `--skip-intro` | `frame` climbing, `target: 20`, `finishFrame: 0xffffffff`, `completion` **151%** | 0.40/s | the Lionhead logo animation plays, correctly and fully - box fills with particles, tips over, resolves to the lion - but `completion` runs past 100% and `finishFrame` never clears, so it does not end on its own |
| with `--skip-intro` | `frame: 1`, `target: 636`, `finishFrame: 0`, `completion: 0` | stops | intro is marked finished and the app moves to the post-title phase |

So the write lands. What the earlier session read as "the flag does nothing" is
the *second* row's aftermath: with the intro skipped the app sits on the title
card and then enters a long compute phase, which at loadavg 400 looked like a
hang. It is not hung - measured on the idle box it is at **88% CPU** and 2.7
batches/s with a 200,000-block budget, i.e. ~370ms per batch. Blocks that long
mean few, very long basic blocks: this is d3dx9_25's software math preparing the
menu scene, not a wait.

The intro playing to 151% completion without finishing is a separate real bug
and is worth its own investigation; `--skip-intro` is the workaround.

## CPU by phase, and the correction that makes the earlier profiles readable

Two things were wrong in the 2026-09-13 profiling notes above, and they have the
same root: **one `node --cpu-prof` profile of one window was treated as a
profile of the program.**

**1. The D3D9 software rasterizer is WAT, not JS.** `lib/d3d9-software-backend.js`
is an 888-line *driver* - it sizes contexts, binds state and walks draws - and
every pixel is rasterized by `$d3d_software_step` in `src/09ah-d3d-software.wat`
(2x2 quad lanes, edge functions, the whole inner loop). The note that "all CLI
rasterization is the JS software backend" is wrong; `--d3d9-renderer=software`
selects a wasm rasterizer.

**2. `--cpu-prof` could not see it in any case.** `test/run.js:2047`
(`createD3DRenderWorker`) puts that rasterizer on a `worker_thread`, and a V8
profile - `--cpu-prof` or an `inspector.Session` - only ever samples the thread
it was opened on. So a main-thread profile reports the rasterizer at **0.0%** no
matter how much of the machine it is using, and "87% WASM / 13% JS" was a
statement about the interpreter thread alone.

Measured 2026-09-13 on an idle-ish box (loadavg 10-22), a name-section build
(`build-compile-wat.js --names`, so wasm frames carry WAT names), two 25s cold
runs and one 30s in-process profile of the live probe already in the rendering
phase. Read with `node tools/wasm-phase-profile.js`, which buckets self time by
subsystem, and `thread-cpu.sh`-style `ps -M` deltas for the thread split.

### Phase 1-2: boot, and the post-title `--skip-intro` grind

| subsystem | boot 25s | post-title grind 25s |
|---|---|---|
| interp dispatch (`$next`, `$branch_end`, decode, cache) | 24.0% | 24.1% |
| x87 (`$fpu_exec_mem`, `$th_fpu_mem_ro`, `$fpu_tag_phys`) | 23.0% | 20.5% |
| interp handlers (`$th_*`, `$do_*`) | 20.1% | 19.9% |
| JS | 11.2% | 11.4% |
| address translation (`$g2w`, `$gs32`, `$gl32`) | 8.2% | 8.6% |
| regs/flags | 7.1% | 6.6% |
| **D3D9 rasterizer** | **0.0%** | **0.0%** |
| GDI rasterizer | 0.1% | 0.2% |

These two phases are the same program: a pure x86 interpreter workload that is
**half dispatch-and-flags overhead and a quarter x87**, drawing nothing at all.
A 25s cold run never leaves this shape, which is why every short benchmark so
far has agreed with every other one and none of them described rendering.

### Phase 3: actually rendering (live probe, 0.7 presents/s, 16 draws/s)

Per-thread CPU over one 30s window, `ps -M` deltas (154% of one core total):

| thread | share of process | of a core |
|---|---|---|
| main (interpreter + the JS D3D driver) | 51.5% | 79.5% |
| render `WorkerThread` (the WAT rasterizer) | 33.0% | 50.9% |
| 4x V8 background compile/GC | 15.5% | ~24% |

and *within* the main thread, by self time: **JS 52.3% / wasm 47.7%** - nothing
like the 89/11 of the other phases. The JS half is the D3D9 driver
(`call [d3d9-host.js]` 7.7%, `drawImage` 1.9%, `decode [d3d9-texture.js]` 1.3%,
`gpu_gl_call` 1.4%) plus `main [run.js]` 11.4% and **12.8% idle**.

### Why it is slow is not "ops per frame"

The interpreter and the rasterizer **take turns**; neither saturates a core.
`$d3d_render_park` (`src/09ad-handlers-d3d9.wat:2303`) parks the *whole main
instance* on `yield_reason 16` until the worker finishes the token, and
`mainExecutionSuspended` (`test/run.js:5140`) holds it there across
`ctx.waitD3DRender(token)`. Live, that is visible directly: sampling the running
probe returns `yield: 16` with EIP in the thunk zone (`0x7503488`) in 5 of 6
samples, and **`get_last_run_blocks()` is 126-3496 against a 200,000-block
budget** - batches are ending on the render park, not on their budget.

So the earlier figure of "~50-75M guest ops per frame" was invalid twice over:
it divided a boot-phase op count (which includes the 20.6M-iteration
self-checksum) by an intro-phase present rate, and it attributed the whole frame
cost to guest instructions when a third of it is the rasterizer thread and a
quarter is the JS driver. **Do not quote batches/s in this phase either**: 3624
batches/s at ~126 blocks each is ~460K blocks/s, not the ~5.3M blocks/s the same
emulator does when a batch runs to budget - the per-batch host cost is being paid
~3600 times a second for 126 blocks of work.

The lever this points at is **overlap**, not interpreter throughput: while the
guest is parked on `yield_reason 16` the main thread does nothing, and while the
guest interprets, the render worker is idle half the time.

## The land-selection screen does not OOM -- it spins in a triangulation walk

Measured 2026-09-13 on a run driven to the land picker (`--skip-intro`, ENTER on
the profile dialog, click New Game at 170,444, then left alone for 25 minutes).

The screen paints the burning-village picture and the eight island thumbnails and
then **stops presenting entirely**: two frames 10 minutes apart differ by 0 of
307200 pixels. The process is not idle and not parked -- `get_last_run_blocks()`
returns the full 200,000 budget with `yield_reason` 0, i.e. every batch is spent
running guest code that never reaches a present.

Sampled EIP lands in one small family of functions, all in the exe:

| VA | what it is |
|---|---|
| `0x009c37f0` | integer 2D orientation predicate: sign of `(b.y-a.y)*(c.x-a.x)` vs `(c.y-a.y)*(b.x-a.x)`, compared as full 64-bit products (one-operand `imul`, high word in EDX, low compared unsigned) |
| `0x009c4c80` | three of those predicates = "is the query point inside this wedge" |
| `0x009ddfb0` | `mov eax,[ecx+8]; ret` -- a node's vertex pointer |
| `0x009e1950` | **the loop**: `do { esi = esi->next } while (!inside(q, esi))`, no iteration guard |
| `0x009e1b20`/`0x009e1b78` | one function: advance the walk, returns 0..3; its own `[esp+0x24]` list walk exits only on the end sentinel or an orientation flip |
| `0x009e1c30` | the driver: locate, then `call 0x9e1b20` / `cmp eax,3 / ja` back -- a line walk through a triangulation |

Live hit counters (`set_count` on a running instance, then `get_count`) put
`0x009e1b80` at **~115,000 iterations per second, forever** -- over 170 million
in one sitting. `0x009c37f0` runs at ~345,000/s. So this is a point-location /
line-walk over a 2D triangulation that never finds its target and never exits.

Two things this rules out:

* **Not the NULL sentinel.** The run carried `--fault-null` and logged **zero**
  unmapped accesses. The lists being walked are real mapped memory.
* **Not the `imul` high word.** `$th_imul32` / `$th_imul_m32` compute the signed
  64-bit product and place the high half in EDX correctly, and `$fpu_to_i32`
  already returns x87's `0x80000000` integer-indefinite on out-of-range rather
  than a clamp, so coordinates converted from floats have the right shape.

**The 430MB `operator new` from the earlier session is the same bug wearing a
different hat.** Its call site `0x009d5430` is a list walk in the same family
(it calls `0x009e35e0`, which opens with a circular-list walk, and `0x009d4080`
calls the same `0x009c4c80` predicate). 430,511,656 is 8 x 53,813,957 -- an odd
element count, which is what an unbounded `push_back` in a non-terminating walk
looks like, not a sized allocation. One run records the walk and explodes; one
run does not and spins.

What is still open is the input: whether the vertices being walked are sane and
our predicate disagrees with the hardware, or the structure itself is corrupt
before the walk begins. `$SCRATCH/bw-hullwalk.sh` dumps the node ring and the
query point off a live instance for exactly that question.

### The counter split that settles "infinite loop" vs "slow work"

Armed live on the running instance (`exports.set_count(slot, addr)`), sampled a
minute apart at the land-selection screen:

| slot | address | what | 18:18 | 18:19 | 18:21 |
|---|---|---|---|---|---|
| 0 | `0x009e1b80` | inner edge-ring walk | 3,206,893 | 12,813,130 | 30,485,086 |
| 1 | `0x009c37f0` | orientation predicate | 9,634,410 | 38,453,116 | 91,468,984 |
| 2 | `0x009e1c90` | line-walk driver loop head | **194** | **194** | **194** |
| 3 | `0x009d5430` | the 430MB list walk | **39** | **39** | **39** |

The driver stops dead at 194 while the ring underneath it climbs by ten million
a minute. That is one call that never returns -- not a triangulation doing a lot
of legitimate point locations, which would advance the driver too.

It is also **not** every visit to the land screen. A later run reached the same
screen and ran the same code 41 times, finished, and stayed responsive, so the
runaway depends on the data that particular load built, which fits the backing
aliasing this loader has already produced once (see the comment in
`$virtual_map_commit_locked` about guest `0x2e040000` and `0x2de00000` sharing
backing `0x18299000`).

### The 430MB allocation: found and fixed

`$virtual_map_commit_locked` opened with a size guard against the **primary**
sparse pool (`$VIRTUAL_BACKING_BASE_SIZE`, 316MB). B&W2 runs with `bigMemory`,
so this host also has a 512MB extension window above the declared map, and
`$virtual_backing_ext_take` exists to serve exactly a request the primary pool
cannot hold -- but the guard refused 430,511,656 before anything looked at the
window that fits it. Fixed by bounding against the largest window
(`$virtual_backing_max_extent`); `test/test-virtual-commit-over-pool-size.js`
pins the exact request.

### Practical note: this box kills the run

Two probes died mid-session with no guest error, no exit summary and
`PROBE EXIT=0` -- the host had ~64MB of free RAM at the time (several agent
sessions plus Chrome). A B&W2 probe holds a 1GB shared memory, so it is the
first thing to go. A run that stops without a diagnostic line is a host OOM
kill, not a guest crash; check `vm_stat` before reading anything into it.

### What actually triggers it: picking a land

Measured 2026-09-13 on the fixed build, with the counters armed at boot:

* **Arriving at the land picker is not the trigger.** Counters read `0,0,0` on
  arrival and the D3D op census keeps climbing (submitted op-5 2617 -> 2624,
  op-12 267 -> 270 over ten seconds), with EIP wandering `0x009ede00`-`0x009ee4d0`,
  the CRT at `0x00ad8ff9`, `0x00a78cd0` and the API thunk zone. The screen is
  static because the scene is static, not because the guest stopped.
* **Clicking a land thumbnail is the trigger.** Within a minute of the click the
  draw rate falls to **0.0 submissions per second** and stays there, and every
  sampled EIP is in the geometry family -- `0x009c37f0`, `0x009c4c80`,
  `0x009e1950`, `0x009e1b78`, `0x009ddfb0`. Nothing is presented again.

So the walk and the 430 MB allocation are the same event seen twice: selecting a
land runs a triangulation walk that does not terminate, and whether it shows up
as an allocation or as a spin depends on whether the caller is recording the
path it walks.

One consequence for driving: the land picker draws no cursor at all (an aim
there changes 0 of 8000 pixels, where the same aim on the menu and the tutorial
draws both cursor and hover highlight), so a click on that screen cannot be
verified optically the way every earlier click was.

## CORRECTION 2026-09-13: the land pick is a failed allocation, and the spin is its aftermath

"The walk and the 430 MB allocation are the same event seen twice" above has the
causality backwards, and the section title one level up -- "does not OOM" -- is
simply wrong. Picking a land **throws `std::bad_alloc` and ends the process**.
The triangulation spin is what the code does on the way there and afterwards,
not what kills the run.

The reason this took a whole session to see is worth writing down: **the crash
log is not in the probe's stdout.** `tools/black-white-software-probe.js` spawns
`test/run.js` with `stdio:['pipe','pipe','pipe']` and sends the child's stderr
to a `run.log` inside the artifacts directory it prints on its first line
(`Artifacts: /var/folders/.../bw-software-probe-XXXXXX`). Every `[heap]`,
`[C++ throw]` and `=== UNHANDLED EXCEPTION ===` line lands there. Read that file
before concluding anything about a probe run that "just stopped".

What it said:

```
[heap] OOM: 430571520 bytes (0x19aa0000) - sparse arena: no guest address space left to reserve
[heap] OOM: 430511656 bytes (0x19a91628) - bump arena full, low reserve and sparse arena both refused
  requested from eip=0x00ad561b frames=[0x00ad5652 <- 0x009d5440 <- 0x00000087]
[C++ throw] .?AVbad_alloc@std@@ <- .?AVexception@@  obj 0x074fc980 at EIP 0x00ada813
=== UNHANDLED EXCEPTION: CXX_EXCEPTION 0xe06d7363 ===
[Exit] code=-529697949
```

The reason codes are in `lib/host-imports.js` (1 = bump arena full, 2 = sparse
arena has no guest address space left, 3 = reserved range would not commit,
4 = map record table full, 5 = request refused as too large). This is reason 2:
a **guest address space** refusal, not a backing-memory one.

### Why the address space ran out: a floor that was not a fact

Measured at the picker, off the live instance:

```
maps=0x182  backing_hw=0x26404000  reserve_cursor=0x289f0000
ext_cursor=0x2202e000  reserve_count=0xc  sticky_floor=0x0
```

The sparse arena is allocated downward from `$VIRTUAL_ALLOC_TOP_INIT`
(`0x50000000`) and was floored at a flat `$VIRTUAL_ALLOC_MIN` of `0x10000000`.
`0x289F0000 - 0x19AA0000 = 0x0EF50000`, which is `0x10B0000` -- **17.4 MB** --
below that floor, so the reservation was refused.

That constant was not a fact about anything. The only address a sparse mapping
must stay clear of is the **direct window**, because `$g2w` answers anything
inside it from the image's affine delta and never consults the page table. That
window ends at guest `(region.end $DIRECT_WINDOW) + image_base - GUEST_BASE` --
`0x083EE000` for the usual `0x400000` image -- so the constant was holding back
124 MB that nothing could ever use. Fixed in `9cca3c58`: `$virtual_alloc_min`
derives the floor and is capped at the old constant, so it can only ever move
down. Verified on the app: the land loader now places that reservation at
`0x0AE70000` and the later reclaim lifts the cursor back to `0x1C0A0000`.

DLL placement was checked before trusting this, not assumed: `next_dll=0x44a7000
dll_count=7 image_base=0x400000 sizeofimage=0x2028000`, i.e. the seven DLLs load
contiguously inside the direct window (`$next_dll_addr`), so the range the lower
floor opens up is genuinely free.

### The second bug: two guest ranges on one extension extent

`$SCRATCH/bw-vaspace.js` walks `VIRTUAL_MAP_TABLE` and coalesces **both** sides
of each record, so "live guest bytes" and "distinct backing bytes" can be
compared. Sampled every five seconds after the land click:

```
pick+80s  records=390  live=0x2c2fa000  backing_covered=0x2c2fa000  overlaps=0
pick+95s  records=391  live=0x3797a000  backing_covered=0x2c2fa000  overlaps=10
                                                       first_overlap=0x2202e000
```

`0x2202E000` is exactly the extension bump cursor measured above.
`$virtual_backing_ext_take` published that cursor as wilderness with no conflict
check, while `$virtual_hole_take` can hand out a released extension extent at or
above it without advancing it -- so a hole reused up there leaves the bump
pointing at live bytes. Fixed in `4d025525`: the bump candidate is asked of the
record table, and a gap placement republishes the cursor.

This is the same failure the comment in `$virtual_map_commit_locked` already
records (guest `0x2e040000` and `0x2de00000` sharing backing `0x18299000`, after
which the grid query at `0x9e5272` read a free-list link as a vector length and
scanned forever) -- which is very likely what the non-terminating walk in the
section above actually is.

### What the land load actually demands

Sampling live committed mappings every five seconds after the click: **528 MB ->
707 MB -> 889 MB** in roughly 180 MB steps over 45 seconds, each step held while
the next is built, across 371-391 records, followed by ~98 MB released. Neither
placement nor fragmentation is the binding constraint -- at pick+15s both
`bump_fits` and `gap_fits` were true. The binding quantity is live bytes.

With the derived floor the arena is `0x50000000 - 0x08400000` = 1148 MB of guest
address space, and total backing is 828 MB (316 MB primary pool + 512 MB
extension window on the 1 GB memory `bigMemory` asks for). **889 MB live plus a
430 MB request does not fit in either.** So the two fixes above are necessary
and are not obviously sufficient; raising `$VIRTUAL_ALLOC_TOP_INIT` past the DIB
guest window would buy address space but no backing, and backing is capped by
the wasm memory itself.

### One throughput note, unrelated to the crash

With `--quiet-api`, a land-picker run still made `log=7265302` and
`log_api_exit=7265302` host calls -- 14.5 M of 15.5 M total. `--quiet-api`
suppresses the printing, not the crossing into JS. A gate for that belongs in
WAT beside the dispatch, not in the JS import.

### The profile dialog's ENTER needs a 3000-batch hold (2026-09-13)

"Sometimes needs several tries" above is not flakiness. Measured on one run:
**six** ENTERs at `bw-step.sh key 13 250` left the New Profile Name dialog
standing, and a single `key 13 3000` dismissed it immediately.

The hold is a **batch** budget, and a batch is not a fixed amount of guest time:
in the rendering phase a batch ends on the D3D render park after ~126 blocks, so
250 batches is a fraction of a second of guest time -- less than one poll of the
dialog's keyboard state. This is the same trap the button-hold note above
records for clicks, and it applies to keys too.

One consequence worth knowing before driving: those extra ENTERs are not
harmless once the dialog does go. The one that landed also carried the game
through **New Game and the mouse tutorial**, so the run arrived at the land
picker while the driver was still waiting for a main menu that had already gone
by. Check the picture, not only the PNG size window, after a retry loop.

### With the aliasing fixed, the wall is the arena's size (2026-09-13)

Re-driven on the build carrying `4d025525`, sampling the map table every five
seconds from the land click:

```
before  records=357  live=0x157ca000  cursor=0x2d6c0000  largest_hole=0x252c0000  overlaps=0
pick+5s records=367  live=0x2beaa000  cursor=0x16fe0000  largest_hole=0x0ebe0000  overlaps=0
pick+10 records=348  live=0x27b6a000  cursor=0x0b960000  largest_hole=0x0f3c0000  overlaps=0
pick+60 records=348  live=0x3137a000  cursor=0x0b960000  largest_hole=0x05bb0000  overlaps=0
pick+70 PROBE GONE
```

Two things to take from it.

**The aliasing fix holds on the app.** `backing_overlaps` is 0 at every sample,
where the same walk on the previous build went to ten within fifteen seconds.

**And the crash is unchanged**: byte-for-byte the same `[heap] OOM: 430571520
bytes (0x19aa0000) - sparse arena: no guest address space left to reserve`,
followed by the same `bad_alloc` and `[Exit] code=-529697949`. At the moment it
happens the arena holds 785 MB of live mappings in 348 records, the downward
reserve cursor is already at `0x0B960000` with 55 MB of floor under it, and the
largest free run anywhere in the 1148 MB arena is 91 MB. 363 MB free with no run
big enough for a 430 MB request is a **capacity** problem, not a placement one --
no allocator can serve that out of this arena, so nothing about fragmentation,
reclaim or hole coalescing was ever going to fix it.

What was actually wrong is that the arena stopped at `0x50000000` because the
DIB guest arena starts there, which gave away the 752 MB between that and the
top of Win32 user space to avoid the 63 MB DIB range and sixteen words of static
system-DLL pseudo handles at `0x5D110000`. `ee44e655` runs the arena to
`0x7F000000` and declares `0x50000000..0x60000000` as a band no reservation may
land in, which both placement paths step over.

The band has to exclude the DIB range because `$g2w` answers it from its own
affine range before the page table is consulted -- a mapping there would be
silently aliased, the same class of bug the direct window causes. It has to
exclude the handles for a different reason: they are not memory, they exist to
be compared, and `GetModuleHandle` hands them to guest code that may read
through the result, so a real mapping under one turns "nothing there" into
plausible bytes.

**Backing is the next number to watch, and it is close.** 785 MB of live
mappings against 828 MB of backing on this host (316 MB primary pool plus the
512 MB extension window a 1 GB memory provides) leaves 43 MB. The memory is
created at 16384 pages because that is the import's declared maximum, not
because anything measured says 1 GB; a shared memory of 32768, 49152 and 65536
pages all construct fine under Node 24 on this box.

### With the arena raised, the wall moves to backing (2026-09-13)

Re-driven on `ee44e655`. The land pick now places fine and dies one step later:

```
pick+5s   records=387 live=0x1c20a000 backing_avail=0x1dfd2000/0x33c00000 bump_fits=true  largest_hole=0x3d150000@0x8400000
pick+30s  records=390 live=0x2c2fa000 backing_avail=0x1dfd2000/0x33c00000 bump_fits=true  largest_hole=0x2d060000@0x8400000
pick+70s  records=371 live=0x317ca000 backing_avail=0x0000c000/0x33c00000 bump_fits=false largest_hole=0x16d70000@0x35460000
pick+110s PROBE GONE
```

`backing_overlaps` stayed 0 throughout, and the largest free run through the
whole load is 977 MB rather than the 91 MB the old ceiling left -- so the
address-space wall is gone. The refusal reason changed with it:

```
[heap] OOM: 430571520 bytes (0x19aa0000) - sparse arena: reserved range could not be committed
[heap] OOM: 430511656 bytes (0x19a91628) - bump arena full, low reserve and sparse arena both refused
```

That is reason **3**, not reason 2: the 430 MB range is *reserved* and then has
no bytes to be backed by. `backing_avail` is 48 KB of 828 MB at that moment,
with 792 MB live.

828 MB is what a 1 GB memory provides -- the 316 MB primary pool plus the
512 MB above `0x20000000` -- so B&W2's land load needs about 1.3 GB and the
1 GB ceiling was never measured to be enough for it. `src/01-header.wat` now
declares `(memory 8192 32768 shared)`; the host-side page count that decides
what is actually created lives in `host.js`, `test/run.js` and
`tools/black-white-software-probe.js`.

`test/test-virtual-backing-two-gigabyte.js` is this measurement as a test: the
same WAT booted on both memories, the 792 MB working set committed, and the
430 MB request refused on the 1 GB one and served on the 2 GB one -- with the
top of the 2 GB memory written and read back, because `memory.size << 16` is
`0x80000000` there and one signed comparison anywhere in that arithmetic would
lose the whole window.

## The allocation size is not a data size: it tracks the arena (2026-09-13)

The 2 GB re-drive (`bw-software-probe-nrKzCO`) settles what `0x19AA0000` is.

Same build, same click, same code path, two different guest memories:

| memory | arena the reserve walks | the size the guest asked for |
|---|---|---|
| 1 GB  | ceiling `0x7F000000`, 828 MB of backing  | `0x19AA0000` = 430,571,520 |
| 2 GB  | ceiling `0x7F000000`, 1852 MB of backing | `0x39BD0000` = 968,687,616 |

**A data size cannot depend on how much memory the host gave the process.** The
number moved by 2.25x when nothing about the land, the click or the code
changed -- only how far apart the allocator was free to place things. That is
the signature of a `end - begin` subtraction across two pointers that are not
from the same allocation: widen the arena and the difference widens with it.

This confirms the amendment above ("it is ONE allocation, not an accumulation;
one call computes an absurd size") and turns its open question into a
*falsifiable* one. The candidate sites named there -- `sub ecx,eax` at
`0x9e3b1c` and `0x9e3b51`, `sub ecx,edx` at `0x9e3b97`, `imul edx` at
`0x9e3c11`, feeding `call 0x9e62f0` / `0x9e6340` / `0x9e61a0` -- can now be
tested by arithmetic rather than by argument: the operands of the right one
differ by exactly `0x19AA0000` on a 1 GB memory and `0x39BD0000` on a 2 GB one,
and both differences are the distance between two live sparse mappings.

Two more things the 2 GB run establishes:

**The land load genuinely got further.** It survived 250 s past the pick
against 110 s, peaked at 1.33 GB of live mappings against 792 MB, and the
record table stayed clean throughout (`backing_overlaps=0`). So the earlier
ceilings were real limits and raising them was not wasted -- but the next rung
of the same series is 968 MB, and no i32 address space wins that race. **Stop
buying rungs.** The defect is the computed size.

**The block-entry counts are unchanged in shape**: `0x9e17d0` = 14741 against
`0x9e35e0` = 41, `0x9e3601` = 147, `0x9e32a0` = 36, `0x9d5430` = 39 -- the same
~40 traversals of the outer list, one of which computes a nonsense size. Nothing
here is running away.

The run ended the same way as every previous one: `bad_alloc` out of the CRT at
`0x00ada813`, unhandled, `[Exit] code=-529697949`. The `QueueError: native
render heap handoff rejected` after it is the render worker being torn down, as
the amendment above already established -- not a cause.

### The call chain, and what the number is made of (2026-09-13)

The OOM line prints stack call-site candidates and they name the whole path.
From `bw-software-probe-2yaYY6`, innermost first:

```
requested from eip=0x00ad561b frames=[0x00ad5652 <- 0x009d5440 <- 0x00000087]
stack call sites: 0x00ad5630 0x00ad5652 0x00ad567d 0x00ad41d6 0x00522687
                  0x009e43c4 0x005313be 0x009e3caf 0x009e07e6 0x009d5440 ...
```

So: the outer list walk at `0x9d5430` calls `0x9e35e0`, which reaches
`0x5313ab`, which calls **`0x9e4370`**, which calls `0x522570` -> `0x522669`
-> `operator new` -> `malloc`. Read it in that order; the EBP chain alone
cannot, because `0x9e35e0` is frameless (everything is `[esp+N]`) and the walk
jumps straight from `operator new` to `0x9d5440`.

**`0x9e4370` is `vector<T>::insert` for a 24-byte T, and the size is an element
count, not a byte count.** Both measured sizes divide by 24 exactly:
`430571520 / 24 = 17940480` and `968687616 / 24 = 40361984`.

```
009e4370  push ebx
009e4371  mov ebx,[esp+0xc]     ; `where` -- the insertion position (arg at [esp+4] on entry)
009e4377  mov edi,ecx           ; this
009e4379  mov esi,[edi+0x4]     ; begin
009e437e  jz  0x9e439c          ; begin == 0 -> index 0
009e4380  mov ecx,[edi+0x8]     ; end
009e4383  sub ecx,esi           ; end - begin
009e4385  imul 0x2aaaaaab / sar edx,2      ; / 24 -> size()
009e43a0  mov ecx,ebx
009e43a2  sub ecx,esi           ; `where` - begin        <-- THE SUBTRACTION
009e43a4  imul 0x2aaaaaab / sar edx,2      ; / 24 -> the INDEX of `where`
009e43bf  call 0x522570         ; insert(where, 1, value)
```

and the allocation itself, inside `0x522570`:

```
00522669  cmp ecx,eax
0052266b  jnb 0x522678
0052266d  mov ecx,esi
0052266f  call 0x9e40a0         ; -> [this+4]
00522674  mov ecx,eax
00522676  add ecx,edi
00522678  lea ebx,[ecx+ecx*2]   ; *3
0052267b  add ebx,ebx           ; *6
0052267d  add ebx,ebx           ; *12
0052267f  add ebx,ebx           ; *24
00522681  push ebx
00522682  call 0xad41b9         ; operator new(count * 24)
```

`0x9e3bb6` -- the erase/insert pair the previous guess pointed at -- ran **zero**
times in this run, against `0x9e35e0` = 41 and `0x9d5430` = 39, so that path is
not involved at all. Do not go back to it.

**The one question left is a comparison, not a theory.** `where` is supposed to
point between `begin` and `end` of the very vector being inserted into. If it
does not, `(where - begin) / 24` is the distance between two unrelated
allocations divided by 24 -- which is exactly why the number grew with the
arena. `--trace-at=0x9e4370` with `--trace-at-mem=ecx+0x4:4,ecx+0x8:4,esp+0x4:4`
reads all three at the function entry, before any push, and answers it directly.

### CORRECTION: `where` is `end()`. The vector is fine; the loop is not. (2026-09-13)

`--trace-at=0x9e4370` with `--trace-at-mem=ecx+0x4:4,ecx+0x8:4` answered the
comparison the previous section set up, and the answer kills that section's
hypothesis. **`where` is not a stray pointer.** The third argument is at
`[esp+8]` at function entry (`[esp+0xc]` is read only *after* `push ebx`), and
it equals `end` on every single one of the 11 traced calls:

| # | begin `[ecx+4]` | end `[ecx+8]` | `where` `[esp+8]` | size = (end-begin)/24 |
|---|---|---|---|---|
| 3 | 0x4d5794e0 | 0x4d579510 | = end | 2 |
| 4 | 0x4d579260 | 0x4d579338 | = end | 9 |
| 5 | 0x4d5790a0 | 0x4d579490 | = end | 42 |
| 6 | 0x4c4b1db4 | 0x4c4b317c | = end | 211 |
| 7 | 0x4c4bbe64 | 0x4c4c2254 | = end | 1066 |
| 8 | 0x4bfd0004 | 0x4c070054 | = end | 27310 |
| 9 | 0x41f30004 | 0x455410a4 | = end | 2362204 |
| 10 | 0x29de0004 | 0x35459814 | = end | 7975254 |
| 11 | 0x18c20004 | 0x29dd641c | = end | 11958657 |

Every `end - begin` divides by 24 exactly. This is a well-formed
`v.insert(v.end(), 1, x)` -- a push_back -- into a vector that really does hold
tens of millions of elements. So **the arena did not widen the number; the
number was going to grow past any arena.** A 4 GB memory would only move the
OOM a few seconds later.

**The defect is a worklist loop that feeds itself and never converges.**
`0x9e35e0`'s main loop, entered from `0x9e39b3`:

```
009e39b3  mov esi,[esp+0x74]        ; vec.begin
009e39b9  mov edi,[esp+0x84]
009e39c0  jnz 0x9e39c6              ; begin == 0 -> size 0
009e39c6  mov ecx,[esp+0x78]        ; vec.end
009e39ca  sub ecx,esi
009e39cc  imul 0x2aaaaaab / sar edx,2   ; size() = (end-begin)/24
009e39dd  cmp [esp+0x18],eax        ; i < size() ?
009e39e1  jge 0x9e3cbe              ; ...exit
009e39e7  mov eax,[esp+0x20]        ; byte cursor
009e39eb  add edx,[esp+0x74]        ; &vec[i]
          ... body: 0x9e1e50 predicate, 0x9e1c30, 0x9e1590, 0x9e63a0 ...
          ... body appends to the SAME vector via 0x5313ab -> 0x9e4370 ...
009e3caf  add dword [esp+0x18],1    ; ++i
009e3cb4  add dword [esp+0x20],0x18 ; cursor += 24
009e3cb9  jmp 0x9e39b3
```

`size()` is re-read from `end` **every iteration**, so this is a queue, not a
range: the body pushes new work onto the tail of the very vector being walked,
and the loop stops only when an iteration adds nothing. Measured on the 2 GB
drive:

```
Hit counts:
  0x009e4370 = 53        (insert helper)
  0x00522570 = 53
  0x009e40a0 = 10
  0x009e35e0 = 41        (the function is entered 41 times)
  0x009d5430 = 39        (the outer list walk)
  0x009e3caf = 26906976  (the ++i landing -- 26.9 MILLION iterations)
```

26.9M iterations against 41 calls is ~656,000 per call, and the queue is still
growing when the heap gives out at 40,361,984 elements. On real hardware this
loop terminates. It diverges here, so **something the body computes comes back
wrong under emulation and keeps re-queueing work.** The body's decision points
are the `test al,al` on `0x9e1e50` at `0x9e3a25` (reject -> `0x9e3c7a`), the
pointer-identity tests at `0x9e3a45`/`0x9e3a4f`, and the `[edi+0xc] == 0` test
at `0x9e3a68`. That is where to look next -- not at the allocator, and not at
the arena size.

### What the loop is, and why its arithmetic is not the bug (2026-09-13)

`0x9e35e0` reads as a **constrained edge-insertion over a quad-edge planar
subdivision** -- a Delaunay-style flip loop:

- It opens by walking a circular list (`esi = [esi+4]` until back at the head)
  checking `[esi+0xc]`; if no node has one, it calls `0x9e32a0` and returns 1.
- A first bounded pass (`for i < [esp+0x20]`) walks `[edx+eax*4]` node arrays,
  rejects duplicates against the constraint's own endpoints at `[esp+0x30]` /
  `[esp+0x34]`, calls `0x9edb80` to find an index, reads the neighbours
  `[esi+edi*4]` and `[esi+ebx*4]` at `0x9e3758`/`0x9e375f`, and pushes what it
  finds onto the worklist through `0x531330`.
- The main loop then drains that worklist, and its body splices rings
  (`[eax+0xc] = 0` / `[ecx+0xc] = 0` at `0x9e3b30` and `0x9e3b63`, then
  `0x9e6340`) and pushes replacements back on. That is a flip.

A flip loop terminates because each flip strictly reduces the number of edges
crossing the constraint. It only fails to terminate when the geometric
predicate is *inconsistent* -- when it can answer "crosses" about an edge it
just uncrossed.

**The predicates are exact integer arithmetic, and we compute them correctly.**
`0x9c37f0`, called at `0x9e37bd`, is a textbook orientation test:

```
009c380d  sub eax,ecx        ; by - ay
009c380f  sub edx,esi        ; cx - ax
009c3811  imul edx           ; edx:eax = (by-ay)*(cx-ax)     64-bit signed
009c3821  mov edi,edx        ; hi1
009c3823  imul ecx           ; edx:eax = (cy-ay)*(bx-ax)
009c3829  cmp edi,edx        ; hi compare, signed (jl/jg)
009c382f  cmp [esp+0x10],ecx ; lo compare, unsigned (jbe)
```

and the cross-product compare at `0x9e3c11`/`0x9e3c23` inside the loop body is
the same idiom. Both are one-operand `imul r/m32`, which `$th_imul32`
(`src/05-alu.wat:1118`) implements as a full `i64.mul` of two sign-extended
operands with `i64.shr_s` into EDX -- correct, including the flags. No rounding,
no x87, nothing for the emulator to get wrong. **So the divergence cannot come
from the arithmetic; it has to come from the inputs.**

Every coordinate reaching those predicates is chased through pointers --
`[esi+0x14]` node arrays, `[eax]`, `[edi+0xc]`, ring links. A guest read that
no mapping covers does not fault here: `$g2w` absorbs it into `NULL_SENTINEL`,
which reads 0. A point silently at the origin makes the orientation test answer
confidently and wrongly, forever. That is what `--fault-null` exists to find,
and it is exactly the failure already recorded for this app at `0x9e17d0`.

### ROOT CAUSE: `0x9e1e50` dereferences a NULL argument 53.8 million times (2026-09-13)

`--fault-null` on the 2 GB drive, with the loop's branch targets counted at the
same time. The census at exit:

```
[fault] census: 53814535 unmapped access(es) from 50 eip(s)
[fault]   eip=0x9e1e50 x53813954 addresses 0x0-0x4     <-- a NULL dereference
[fault]   eip=0x9e35e0 x126      addresses 0x4-0x247c830b
[fault]   eip=0x9cef6f x84       addresses 0x48-0x78
[fault]   eip=0x9cf060 x56       addresses 0x4c-0x58
[fault]   eip=0x9ddf80 x35       addresses 0x0-0x8
[fault]   eip=0x9cf661 x32       addresses 0x74-0x78
   ... 44 more, all under 32 ...
```

and the branch counts:

```
0x009e35e0 = 41            the function
0x009e3c7a = 26906977      "0x9e1e50 said reject" -> push to the OTHER vector
0x009e3caf = 26906976      "[[esi+0x20]+8] == 0"  -> push back to the WORKLIST
0x009e3c31 = 2   0x009e3c58 = 1
0x009e3a4d = 3   0x009e3a57 = 3   0x009e3af1 = 3   0x009e3bf9 = 3
0x009e3b27 = 3   0x009e3b3d = 3   0x009e3b5c = 3   0x009e3b70 = 3
0x009e3a65 = 0   0x009e3a83 = 0   0x009e3bb6 = 0
```

**53,813,954 is exactly 2 x 26,906,977.** Two faulting reads on every single
pass of the loop, at the one place the pass makes its decision.

`0x9e1e50`'s entry block is

```
009e1e59  mov eax,[ebp+0x8]    ; arg1
009e1e5e  mov ecx,[eax]        ; <-- fault at 0x0
009e1e64  mov ecx,[eax+0x4]    ; <-- fault at 0x4
```

so **arg1 is NULL**. The call site at `0x9e3a20` pushes `ebx` then `edi`, so
arg1 is `edi`, loaded at `0x9e39f9` as `[&vec[i] + 0xc]` -- field +0xc of the
24-byte worklist element. `$g2w` absorbs both reads into `NULL_SENTINEL`,
`0x9e1e50` reads a point at the origin, and returns the same wrong answer every
time. The loop then does one of two things and nothing else: 26.9M passes take
the reject branch at `0x9e3c7a`, and 26.9M take the `[[esi+0x20]+8] == 0`
early-out at `0x9e3caf`, whose block pushes the element **back onto the very
vector being walked** (`lea ecx,[esp+0x74]; call 0x531330` at `0x9e3ca6`).

That closes the loop on itself: each pass consumes one element and appends one,
`size()` is re-read from `end` every pass, and the queue grows forever. The ring
splices -- the work a flip loop is supposed to do -- ran **three times each**.
Nothing is being flipped. The allocator, the arena ceiling and the vector were
never the bug; a null pointer in a worklist element is.

**Where to look next.** Two candidates for who wrote the NULL into +0xc:

1. the element built in the first pass and pushed at `0x9e37e9`, whose +0xc
   comes from the `esi` chased at `0x9e3780`/`0x9e3787` through `[esi]` and
   `[eax+8]`;
2. the earlier fault cluster -- `0x9cef45`, `0x9cef6d/6f`, `0x9cf044/060`,
   `0x9cf630/63b/650`, `0x9cf661`, `0x9cf67b`, `0x9cf6d8` -- which read fields
   `0x28`-`0x78` off a NULL object *before* any of this, in the same subsystem.
   Those come first chronologically and are only ~200 faults, so they are the
   cheaper thread to pull and the likelier origin.

Note also `eip=0x9e35e0 x126 addresses 0x4-0x247c830b`: an upper address of
`0x247c830b` is not a small-offset null deref, it is a *wild* pointer being
walked. That is the circular-list walk at `0x9e3601`/`0x9e3606`.

### The earlier NULL cluster, traced (2026-09-13)

`--trace-at=0x9cef45 --trace-at-mem=esp+0x50:4` on the same drive. The object
the `0x9cef*` faults read through is the local at `[esp+0x50]`, loaded into EBX
at `0x9cef4b`, and it is **usually valid and occasionally zero** -- 1 of the
first 20 entries (`#3`, `mem{esp+0x50=0x00000000}`), which matches the 16
faults the census counts against that EIP. ESP and EBP are identical on every
hit (`0x074fcd38` / `0x074fcdec`), so these are passes of one loop inside one
call, walking a list whose entries come from `[ebx+0xc]` (`0x9cef3b`) and
`[esp+0x88]`.

This matters beyond the read, because `0x9cef72` **stores** through it:

```
009cef6f  mov ecx,[ebx+0x48]
009cef72  mov [ebx+ecx*4+0x4c],eax   ; write to NULL -- goes nowhere
009cef7e  mov [ebx+eax*4+0x4c],edi
009cef82  mov [ebx+0x64],edi
```

so when EBX is zero the guest believes it recorded something it did not. This
is an x87 sweep (`fld qword [ebx+0x28]` compared against `[esp+0x40]` through
`fucomip`), i.e. an event/interval list over doubles, and losing a write into
it is exactly the kind of thing that leaves a later structure half-built.

Also worth recording: the app spawns **five worker threads at startup**, all at
`start=0x899ab0` (handles `0xe1000`-`0xe1004`), and no further thread traffic
appears in the whole run. The divergent loop's re-queue condition is
`[[esi+0x20]+8] == 0` -- an empty vector -- which reads exactly like "not ready
yet, try again", so whether that pool ever produces under the cooperative
scheduler is worth one `--trace-sched` run before assuming the geometry is at
fault.

### This is a stalled job system, not a geometry bug (2026-09-13)

Both 2 GB drives end with the same thread picture, and it is the same picture in
a 631-second run and a 357-second one:

```
T1 h=0xe1000 eip=0x881760 yield=1 waitH=0xe0004  csPark 0
T2 h=0xe1001 eip=0x881760 yield=1 waitH=0xe0005  csPark 0
T3 h=0xe1002 eip=0x89d1dc yield=0 waitH=0        csPark 2408 / 2420
T4 h=0xe1003 eip=0x881760 yield=1 waitH=0xe000c  csPark 0
T5 h=0xe1004 eip=0x881760 yield=1 waitH=0xe0013  csPark 0
held critical sections at exit (1): 0x020108a8 owner=main lock=0 recursion=1
```

T3's EIP is inside a **busy-wait on a done flag**:

```
0089d1b7  mov esi,ecx
0089d1b9  fdiv dword [esi+0xc]     ; a timeout, scaled
0089d1bd  call 0xad5ae4            ; read the clock
0089d1c4  mov al,[esi+0x4]         ; the DONE flag
0089d1c9  jnz 0x89d1e4             ; already done -> return
0089d1cc  mov ebx,[0xc12180]
0089d1d2  mov ecx,[esi+0x8]
0089d1d7  call [eax]               ; virtual: pump / do a slice
0089d1da  call ebx                 ; the stored function pointer
0089d1dc  mov al,[esi+0x4]         ; re-read DONE            <-- T3 sits here
0089d1e1  jz 0x89d1d2              ; not done -> go round again
```

So the shape of the whole stall is now three layers of waiting, and none of them
is geometry:

1. **T1, T2, T4 and T5 are parked on event handles** (`0xe0004`, `0xe0005`,
   `0xe000c`, `0xe0013`) with `yield=1` -- the worker pool waiting to be given
   a job. Nothing ever signals them.
2. **T3 busy-waits** for a done flag one of them would set.
3. **Main** is in `0x9e35e0`'s worklist loop re-queueing every element whose
   `[[esi+0x20]+8]` is still an empty vector -- "the result is not ready yet,
   try again" -- 26.9 million times, which is the allocation that kills the run.

`lock=0 recursion=1` on the held section is a *normally* held section, not a
corrupted one, so the critical-section bookkeeping is not itself broken; T3's
2408 parks accumulated along the way and then stopped, which is what a thread
that has stopped making progress looks like.

**The next question is who was supposed to signal `0xe0004`/`0xe0005`/
`0xe000c`/`0xe0013` and did not.** That is an event/wait question --
`--trace-api=CreateEventA,SetEvent,ResetEvent,WaitForSingleObject,WaitForMultipleObjects`
-- and it is a much smaller surface than 50 NULL dereferences. The NULLs and the
divergent loop are both downstream of a job that never ran.

### NEGATIVE: the thread picture is normal. Do not re-run this. (2026-09-13)

`--trace-sched=5000` on the 2 GB drive settles the job-system theory from the
previous section, against it. The state

```
M:run@0x7503488  T1:wait(0xe0004)@0x881760  T2:wait(0xe0005)@0x881760
                 T3:run@0x89d1dc            T4:wait(0xe000c)@0x881760
                 T5:wait(0xe0013)@0x881760
```

is reached at **batch 30,352** and is unchanged for the rest of the run -- which
covers the intro, the main menu, the mouse tutorial, the land picker and the
land load. The game renders every one of those screens in exactly this state.
Four workers parked on their job events and T3 in its poll loop is what this app
looks like **idle**, not what it looks like stuck. T3's ~2400 critical-section
parks are the cost of that poll loop, not evidence of a deadlock.

So the stall is not the job system, and the held section (`owner=main lock=0
recursion=1`) is main's, held across its own runaway loop -- a consequence, not
a cause.

What survives from that drive is the ordering fact, from `--fault-null=raise`:
the run dies at the **very first** unmapped read, `0x28 from eip=0x9cef45`, with
every `0x9e35e0` counter still at zero. The `0x9cef*` NULL cluster genuinely
comes first, before the divergent loop is ever entered, and the object behind it
is a local (`[esp+0x50]`) that is valid on most passes and zero on a few --
the shape of a lookup that came back empty rather than a pointer that was
scribbled over.

## SOLVED: the land stall was an emulator FPU bug, not geometry (2026-09-13)

Fixed in `74f1e10c`. `$fpu_compare_eflags_unord` in `src/06-fpu.wat` published
FCOMI/FUCOMI's result through lazy-flag modes 2 and 3, where **PF is the parity
of the low byte of `flag_res`**. The equal case stored `flag_res = 0`, whose
parity is even, so PF came out **set**. MSVC compiles `if (a == b)` on doubles
as

```
fucomip st,st(1) ; lahf ; test ah,0x44 ; jp not_equal
```

which works only because an equal compare leaves ZF=1 with PF **clear**:
`ah & 0x44` is then `0x40`, one bit, odd parity, and the JP is not taken. With
PF set it read `0x44`, even parity, and the JP was taken -- so **every double
equality in every guest took the not-equal branch**, with nothing wrong
anywhere near it.

In this app that is the gate in front of the list insert at `0x9cef29` (the
`call 0x9cd6b0` with `lea eax,[esp+0x54]`). The insert never ran, so the list
head at `[esp+0x50]` stayed at the zero it is initialized to at `0x9ced0b` /
`0x9ced1d`, `0x9cef45` dereferenced NULL, and everything documented in the
sections above followed from that: the `0x9cef*` fault cluster, then the
worklist loop at `0x9e35e0` re-queueing itself 26,906,976 times because
`0x9e1e50` read `[NULL]` and `[NULL+4]` twice per pass, then the 968 MB
`vector<24-byte T>` and the OOM.

The fix publishes ZF/PF/CF through lazy-flag **mode 9** (exact raw: CF in
`flag_a` bit 0, PF in bit 1, independent of `flag_res`), so all four cases --
less, equal, greater, unordered -- set the three flags x87 defines and leave
OF/SF clear. `test/test-x87-compare-eflags.js` covers FCOMIP and FUCOMIP across
less / equal / greater / unordered / `0==0` / `-0==+0`, asserting the raw bits
and running the guest idiom end to end through SETP.

Everything the arena work chased -- the 430 MB and 968 MB ranges, the 2 GB
memory, the sparse-backing ladder -- was downstream of this one flag.

### What the land load does now

First drive on the fixed build (drive16, same UI path: profile -> main menu ->
mouse tutorial -> land picker -> the green island at 135,378):

- **Zero** `[fault]` lines in the entire run with `--fault-null` armed. The
  53.8M reads at `0x9e1e50` and the earlier `0x9cef45` cluster are both gone.
- No runaway allocation. `records=` climbs from 383 to 394 over the 55 s after
  the pick and the backing pool stays at `backing_avail=0x5dfd2000/0x73c00000`
  -- flat, where the old drives committed the whole pool and asked for more.
- The run then stops on a different wall:

```
=== UNIMPLEMENTED API: <ord> ===
  EIP: 0x02610000  ESP: 0x074fc974  EBP: 0x074fca0c
  EDX: 0x02429ca4  EBX: 0x074fcb34  ESI: 0x074fcb38  EDI: 0x074fcb30
```

  The caller block ends in `call [edx+0x88]` -- vtable slot 34 -- and the
  return address `0x02610010` puts it inside `d3dx9_25.dll` (loaded at
  `0x2528000`, origBase `0x400000`, so original VA `0x004e800a`). `<ord>` means
  the name pointer is an ordinal import, so the crash line cannot name it, and
  that drive ran `--quiet-api`. Naming it is the next step.

### The new blocker, named: `IDirect3DDevice9::StretchRect` (2026-09-13)

drive18 re-ran the same path with `--trace-api` (note: `--extra=` cannot lift
`--quiet-api` -- `tools/black-white-software-probe.js` passes that itself, and
drive17 was silent for exactly that reason. `--trace-api` is a separate path and
is unaffected by `--quiet-api`). The dying call is

```
[API #7310607] IDirect3DDevice9_StretchRect(0x07f4e030, 0x4af3ffec, 0x00000000,
                                            0x4a2b0004, 0x00000000, 0x00000000)
               [esp=0x074fc974 ret=0x02610010]
*** CRASH at batch 1418042: unreachable
```

Both rects NULL, filter `D3DTEXF_NONE`. `$handle_IDirect3DDevice9_StretchRect`
in `src/09ad-handlers-d3d9.wat` is still a `$crash_unimplemented` stub.

The caller is `d3dx9_25.dll` (`ret=0x02610010`, original VA `0x004e8010`), in a
`D3DXLoadSurfaceFromSurface`-shaped sequence that runs immediately before it:

```
IDirect3DSurface9_GetDesc(0x4af3ffec, ...)        ; fmt 0x15 = D3DFMT_A8R8G8B8
IDirect3DSurface9_GetDevice(0x4af3ffec, ...)
IDirect3DDevice9_CreateTexture(dev, 0x200, 0x200, 1, 0, 0x15, 2, ...)
IDirect3DTexture9_GetSurfaceLevel(0x4a3c0004, 0, ...)
IDirect3DSurface9_LockRect(0x4af3ffec, ..., 0)
IDirect3DDevice9_CreateRenderTarget(dev, 0x200, 0x200, 0x15, 0, 0, 1, ...)
IDirect3DDevice9_StretchRect(dev, 0x4af3ffec, NULL, 0x4a2b0004, NULL, 0)
```

so it is a 512x512 A8R8G8B8 surface-to-surface blit into a freshly created,
lockable render target -- same size, same format, no stretch and no filter.

### What the land actually renders before it gets there

The API trace shows the land **drawing**, not stalling: a per-frame loop of five
`IDirect3DStateBlock9_Apply` (from `d3dx9`'s effect passes, `ret=0x02636f*`)
then `SetViewport` / `SetRenderState(0xa8, 0xf)` / two `SetStreamSource` /
`SetIndices` / `SetVertexDeclaration` / two
`DrawIndexedPrimitive(D3DPT_TRIANGLELIST, 0, 0xc60, 0x613, 0x11e8, 0x32e)` --
1555 vertices and 814 triangles per draw -- repeating steadily, then
`SetRenderTarget` / `SetDepthStencilSurface` / `EndScene`. 7.3M API calls by
this point. This is terrain being rendered into a texture.

**Handed to the d3d9 lane.** `src/09ad-handlers-d3d9.wat` and
`src/09ae-d3d9-resources.wat` carry another agent's uncommitted work, so this
stub is not mine to fill.

## Do not run this game out of /private/tmp (2026-09-14)

A drive that had been reaching the land load died ten seconds in, with a clean
`ExitProcess(0)` through the CRT and no crash of any kind. The cause was not
the emulator. macOS's periodic tmp cleaner had run at midnight and deleted
every file under `/private/tmp/black-white-full.ntZDCF` that had not been read
in three days. The directory tree survived intact, which is what makes this
read as an emulator bug rather than a missing install: `find -type d` still
lists `Data/Text`, `Data/landscape`, `Audio/SFX/...`, and only `find -type f`
shows the damage — 45 files left of 366, and the 20MB EXE plus a handful of
`.vep` files the last land load happened to touch were all that remained.

The visible symptom is one line in an `--trace-api` log, a long way before the
exit:

```
[API #142312] CreateFileA(path=".\Data\Text\\BW2Text.bin", ...) => h:0xffffffff
[API #142313] WSACleanup()
... ~4000 DeleteCriticalSection / HeapFree calls ...
[API #146307] ExitProcess(0x00000000)
```

BW2Demo.exe treats its text bundle as mandatory and shuts down in an orderly
way when it is missing, so nothing in the run names the file that was not
there. Read the `=> h:0xffffffff` on the last `CreateFileA` before the
teardown cascade; a clean `[Exit] code=0` during startup on this app is almost
always a missing asset, not a guest crash.

**The durable copy is in the repo**, and it is complete (366 files, 884MB,
including the 432MB `Data/Everything.stuff` and the three seeded DLLs):

```
test/binaries/win98-games-a-d/Black and White 2-DX9-D3D/installed
```

Pass it explicitly — `tools/black-white-software-probe.js --game=<that path>`,
or `--exe=<that path>/BW2Demo.exe` for a bare `run.js`. The probe's built-in
default still points at the `/private/tmp` extraction, which is now gone and
will be gone again for any new one: files under `/private/tmp` are reaped once
they go three days without a read, and a long investigation reads the same few
assets over and over while the rest of the install ages out underneath it.

## The HeapCompact wall is cleared; what is past it (2026-09-14)

With `$handle_HeapCompact` implemented (01a0bfc4) the land load runs straight
through `pick+795s`, the exact second drive20 died on that stub, and keeps
going. The allocation burst that used to end there now completes: the sparse
map went from 557 records / `0x17523000` live to 593 records / `0x1c6ce000`
over the following two minutes — about 90MB more committed — and then stopped.

What the run looks like after that, sampled every five seconds for another
three minutes:

- The sparse map is **flat**: 593 records, `live=0x1c6ce000`, `cursor=0x434f0000`,
  `backing_avail=0x5dfd2000/0x73c00000` unchanged sample to sample.
- The GPU probe counters are **frozen and balanced**: `submitted == completed`
  in every category, `pending: 0`, `failed: 0`, `lastError: null`. Nothing is
  queued and nothing is waiting on the backend.
- The `--capture-every=60` frames are **byte-stable** — successive PNGs are the
  same size to the byte — and they still show the land-selection screen, with
  the burning-village preview rendered in the vignette and the nine land
  thumbnails along the bottom. No present has happened since the click.

So this is a CPU-bound load phase with no drawing in it, not a hang on a stub
and not a stalled backend: there is no crash, no unimplemented API, no fault,
and no pending GPU work. The 1800-second drive simply ran out of wall clock at
`pick+1055s` while it was still in there.

The open question is whether that phase terminates. `--trace-sched=N` is the
cheap way to ask — it prints the main thread's EIP on a heartbeat, so a flat
five minutes reads either as progress through a long load or as a spin on one
address, without spending another twenty-minute drive to find out.

## The land load does not stall — the main thread dies and the workers keep running (2026-09-14)

Given a long enough clock, the "flat" phase after the HeapCompact wall resolves
into something specific, and it is not a slow load. At batch 6,015,963 the
**main thread calls through NULL and stops**. The four worker threads go on
being scheduled, so the process stays up and every symptom above follows from
that: the sparse map freezes at 593 records / `0x1c6ce000` because nothing is
allocating any more, the GPU queue drains to `submitted == completed` with
`pending: 0` because nothing is submitting, and the captures are byte-stable at
the land picker because nobody presents. `--trace-sched=400000` shows it
directly — `M:run@0x7503488` for millions of batches, then `M:run@0x0` forever
after, with `T3:run@0x89d1dc` unchanged the whole run.

The whole run took exactly **four** unmapped-access faults, and they are the
crash:

```
[fault] unmapped guest access 0x1d0 from eip=0x938fc0
[fault] unmapped guest access 0x0   from eip=0x938fe5
[fault] unmapped guest access 0x0   from eip=0xa9203a
[fault] unmapped guest access 0x48  from eip=0xa9203a
[eip-zero] guest called through NULL at batch 6015963
  dbg_prev_eip=0x00a9203a
```

The chain, all in `BW2Demo.exe` at its preferred base (runtime VA == original
VA), read back from the disassembly and the stack dump:

| VA | code | what it means |
|---|---|---|
| `0x00a9d4b0` | `call 0x933910` with `(0x200, 0x200, 1, 1, 0x17, 4)` on `[g_0x1d6d92c+0x2c]`, then `mov [esi+0x80], eax` | create a 512x512 resource and store it |
| `0x00933910` | `new(0x22c)` → ctor `0x9392f0` → Init `0x9389b0`; on `al == 0` returns 0 | the factory |
| `0x00a9d54c` | `push 0` / `push [esi+0x80]` / `call 0xa92030` | uses it, unchecked |
| `0x00a92030` | `mov ecx,[esp+8]` (= NULL) / `call 0x938fc0` | |
| `0x00938fc0` | `mov eax,[esi+0x1d0]` … `mov eax,[esi]` | the two `esi == 0` faults |
| `0x00a9203a` | `mov ecx,[eax]` then `call [ecx+0x48]` | vtable slot 18 through NULL |

The `new` succeeded: a NULL there would have faulted inside `0x9389b0` at
`cmp [esi],ebx`, and there is no such fault in the log. So `Init` at
`0x9389b0` returned false, which means **a D3D9 resource creation failed**, and
the guest stores the NULL without checking it. `0x938fc0` is the accessor for
that resource — it reads a state word at `+0x1d0` (Init sets it to 2) and hands
back `[this]`, the raw COM pointer — which is why a failed creation surfaces
1,500 instructions later as a call through a null vtable rather than at the
creation site.

`--fault-null` is what makes this legible at all. Without it the sentinel
absorbs all four reads, the call through zero is the only visible event, and
the run looks like an emulator bug in whatever ran last.

## Named: a 512x512 R5G6B5 **render-target** texture we refuse (2026-09-14)

`Init` at `0x9389b0` ends in `call [edx+0x5c]` on `[[g_0x1d6d92c+0x2c]+0x1a0]`
— vtable slot 23 of `IDirect3DDevice9`, which is `CreateTexture` — with
`ppTexture = esi`, the object's first field, exactly the `[this]` the accessor
at `0x938fc0` hands back. A `--trace-api` filtered to the `Create*` methods
catches it:

```
[API #4027600] IDirect3DDevice9_CreateTexture(dev, 0x200, 0x200, 1, 1, 0x17, 0, ...) [ret=0x00938af9]
```

512x512, one level, **`Usage = D3DUSAGE_RENDERTARGET`**, `Format = 0x17`
(`D3DFMT_R5G6B5`), `Pool = D3DPOOL_DEFAULT`. `$d3d9_texture_create_kind` in
`src/09ae-d3d9-resources.wat` refuses exactly that shape:

```wat
(if (i32.and (local.get $usage) (i32.const 1)) (then
  (if (local.get $pool) (then (return)))
  (if (i32.ne (local.get $usage) (i32.const 1)) (then (return)))
  (if (i32.and (i32.ne (local.get $format) (i32.const 21))
               (i32.ne (local.get $format) (i32.const 22))) (then (return)))))
```

A render target must be `A8R8G8B8` (21) or `X8R8G8B8` (22); 23 returns
`D3DERR_INVALIDCALL`, the guest stores the NULL unchecked, and 2.8 million API
calls later the main thread calls through a null vtable. The format itself is
not the problem — `$d3d9_texture_format_supported` accepts 23, and
`lib/d3d9-host.js` already unpacks R5G6B5 texel data — it is specifically
**render-target storage** that is 32-bit only.

The whole census of what `BW2Demo.exe` creates for itself, over a full land
load (d3dx9's own asset loads excluded by filtering on `ret=0x0093…`):

| levels | usage | format | pool | count | we accept |
|---:|---|---|---|---:|---|
| 1 | 0 | `0x1a` A4R4G4B4 | MANAGED | 20 | yes |
| 1 | `RENDERTARGET` | `0x15` A8R8G8B8 | DEFAULT | 6 | yes |
| 0 | 0 | DXT5 | MANAGED | 4 | yes |
| 1 | 0 | `0x32` L8 | MANAGED | 3 | yes |
| 1 | `RENDERTARGET` | `0x17` R5G6B5 | DEFAULT | **1** | **no** |

One call in 34. The game does not negotiate the format — `0xa9d4b0` pushes
`0x17` as an immediate — so there is no fallback to find and nothing to answer
differently in `CheckDeviceFormat`.

**Scope for whoever takes it.** Widening the WAT gate alone is not enough: the
colour-storage contract is 32-bit throughout. `$d3d9_texture_colors_init`
copies the texture's format into the record at +28 and the mip pitch into +48,
and `ensureColor` in `lib/d3d9-host.js` rejects anything where
`pitch !== resource.width * 4`, while the sampler path additionally requires
`resource.format === format`. So the choice is either 16-bit colour storage end
to end, or promoting a 16-bit render-target texture to 32-bit storage while the
guest keeps seeing `D3DFMT_R5G6B5` — which is safe for a surface that is only
rendered into and sampled, and wrong for one that is locked and written as
raw 16-bit texels.

## Verified: widening the R5G6B5 render target clears the plateau (2026-09-14)

The fix named in the previous section works. `$d3d9_texture_create_kind` in
`src/09ae-d3d9-resources.wat` now widens a `D3DUSAGE_RENDERTARGET` request in
`D3DFMT_R5G6B5` (23) to `X8R8G8B8` (22), and one in `D3DFMT_A4R4G4B4` (26) to
`A8R8G8B8` (21), instead of refusing it. Everything else about the gate is
unchanged: a render target is still rejected unless the pool is `DEFAULT` and
the usage is exactly `D3DUSAGE_RENDERTARGET`.

Widening rather than storing 16-bit is the right call for a *render target*
specifically, and only there. Colour storage in this emulator is 32-bit end to
end — `$d3d9_texture_colors_init` (`src/09am-d3d-color.wat`) copies the
texture's own format into the record at +28 and the mip pitch at +48,
`ensureColor` in `lib/d3d9-host.js` throws on any pitch that is not
`width * 4`, and the sampler path additionally insists the record's format and
the requested format agree. A surface that is only ever rendered into and
sampled cannot tell the difference: a 32-bit target cannot lose information a
16-bit one would have kept. The case widening *would* be wrong for is a texture
locked and written as raw 16-bit texels, and a render target is not that.

### What the measurement says

Same probe command, same in-repo install, same land pick; the only difference
between drive24 and drive25 is the widening.

| | drives 22/23/24 | drive 25 (widened) |
|---|---|---|
| sparse records at pick+900s | 593 (frozen since ~pick+600s) | 838, still climbing |
| live backing at pick+900s | `0x1c6ce000` (frozen) | `0x1db99000`, still climbing |
| at pick+1200s | 593 / `0x1c6ce000` | **1764 / `0x21783000`** |
| `[fault] unmapped` before the plateau | 4 | **0** |
| `[eip-zero]` | 1 (batch 6,015,963) | **0** |
| main thread after the plateau | `M:run@0x0` forever | `M:run@0x75005c8`, alive |

`backing_avail` starts at `0x5dec2000` against `0x5dfd2000` on every previous
drive — 1.1 MB more committed on the first sample, which is exactly the
promoted 512×512 surface at four bytes per texel plus its record. That number
is the cheapest confirmation that the widened path is the one being taken.

The four `[fault] unmapped guest access` lines that preceded the crash in
drives 23 and 24 are gone, not merely deferred: they were the accessor at
`0x938fc0` reading `[esi+0x1d0]` and `[esi]` off the NULL, so they disappear
for the same reason the null call does.

### What this does not yet say

Reaching a record count no previous drive reached is proof the *refusal* was
the blocker. It is not by itself proof the land finishes loading — the land
selection frame stays byte-identical throughout (the picker does not repaint
while the land streams in behind it), so the record count and the scheduler
line are the only live signals until the screen changes. Whoever picks this up
should read `records=` in the probe's sample line first and the frame captures
second.

## Past the texture wall, the next one is arena FRAGMENTATION (2026-09-14)

With the R5G6B5 render target widened, drive26 runs the land load four times
further than any drive before it and then meets a different wall. It is worth
naming precisely, because the numbers look like exhaustion and are not.

At pick+1900s, with the load still progressing and no faults:

```
records=4055 live=0x2efd6000 cursor=0x8470000 bump_fits=false
largest_hole=0xfc000@0x49614000 gap_fits=false
```

and a direct walk of the record table (`scratchpad/bw-toparena.js`) says why:

```
n=4055 above_band=811
highest=[0x7eda0000+0x8000 0x7eda8000+0x8000 0x7edb0000+0x8000
         0x7edb8000+0x48000 0x7ee00000+0x8000 0x7ef00000+0x8000]
holes=1085 top5=[0x49614000+0xfc000 0x49325000+0xfb000 0x49987000+0xf9000
                 0x3c360000+0xf0000 0x42390000+0xf0000]
free_total=0x2db7b000
```

**733 MB is free and the largest placeable run is 1008 KB.** The arena runs
`0x08400000`..`0x7F000000` with `0x50000000`..`0x60000000` excluded, so there
is about 1.5 GB usable; B&W2's land load holds 754 MB live across 4055 ranges.
It fits twice over. What it cannot do is place anything larger than a megabyte.

### Why

`$virtual_reserve_down` is a one-way downward bump from `VIRTUAL_ALLOC_TOP_INIT`,
with `$virtual_reserve_gap` as the fallback that slides a candidate down past
the live ranges. Over this load the bump descended the whole 1.9 GB arena —
811 of the 4055 records sit above the excluded band, the highest at
`0x7ef00000`, right under the ceiling — and arrived at `0x8470000`, 448 KB
above the `0x08400000` floor, at about pick+1700s. Every reservation after
that goes through the gap search.

The gap search is not the problem either. The problem is what it has to work
with: the guest frees ranges *interleaved* with ones it keeps, so the 733 MB
it gave back is 1085 separate holes averaging ~690 KB, and adjacent frees have
already been coalesced in the walk above — these really are not contiguous.

So the shape to remember is: **the bump is spent, a third of the arena is
free, and none of it is in a piece big enough to matter.** A larger memory
does not fix this; `backing_avail` sat unchanged at `0x5dec2000` of
`0x73c00000` the entire time, so backing was never the constraint. Neither is
the 2 GB ceiling from `cc6796c0` — that work was needed for the *committed*
side and is orthogonal.

### What would

Placement policy. The allocator never reuses the space below its cursor except
through a fallback that inherits whatever fragmentation the guest produced.
Real Windows fragments the same way and survives it because it has a 2 GB user
space and coalesces; ours has 1.5 GB usable and a bump that only goes one way.
Options, cheapest first: let the bump wrap and re-descend once it hits the
floor (holes below it are reusable and it never looks); keep a free list of
released ranges and best-fit into it before touching the bump at all.

Do not read this as "B&W2 needs a bigger arena". It needs the arena it already
has to be usable twice.

## The land renders, and one draw poisons the whole queue (2026-09-14)

drive26 got past the widened render target, finished allocating at pick+1900s
(4055 records, 754 MB) and entered the land's render loop. It dies there, and
not on memory: the sparse map simply stops changing because nothing is being
loaded any more.

The probe's own queue record says what happened:

```
failed: 558381
lastError: "QueueError: D3D9 software: missing pixel sampler2"
queues: [{ submitted: 9032, consumed: 9032, completed: 9031, error: "...missing pixel sampler2" }]
```

9032 submitted, **9031 completed, one failed** — and 558,381 failures after it.
The queue carries a sticky `error`, so the single unservable draw poisons it
and every later submission fails. That is why the screen stays byte-identical
on the land picker: the whole render path is dead after one draw, not degraded.

### What the draw is

The check is in `lib/d3d9-software-backend.js:489`:

```js
if(stage>5||!snapshot.textures?.[stage])invalid(`missing pixel sampler${stage}`);
```

Hooking `_submit` in the live process (the payload is built in `d3d9-host.js`
in the main process and only then handed to the software worker, so this sees
exactly what the backend will see) and decoding each `pixelShader.nativeBytes`
gives, over 40s of draws:

| shader samples | draw binds | count |
|---|---|---|
| `[0]` | `[0]` | 108 |
| `[0,1]` | `[0,1]` | 54 |
| `[]` | `[]` | 54 |
| **`[2]`** | **`[]`** | **54** |

Three of the four match exactly, so the binding path is *not* generally broken
— `SetTexture` reaches the payload fine for stages 0 and 1. One PS1.1 shader,
five instructions, is the odd one out:

```
ver=0xffff0101  n=5  ops=[81>1  66@s2  8>0  4>0  1>0]
```

`def c1` / **`tex t2`** / `dp3 r0` / `mad r0` / `mov r0` — it samples texture
stage 2 and the draw has nothing bound at any stage.

### The two candidate causes, and how to tell them apart

Either the guest never binds stage 2 at all, or it does and we refuse the
bind. `$d3d9_texture_binding` (`src/09ae-d3d9-resources.wat:1848`) returns
`D3DERR_INVALIDCALL` *without binding* when the texture has no level-0 mip,
when `[wa+8] != device`, or when the pool at `[wa+44]` is above MANAGED — and
the guest checks none of those, exactly as it did not check the `CreateTexture`
that started this whole chain. A third path: while a state block is recording
(`[state+1740]` non-zero) the binding goes to the block instead of the device,
and d3dx9 effects record blocks constantly.

drive27 is running with `--trace-api` filtered to `SetTexture`, `CreateTexture`,
`SetPixelShader`, the state-block APIs and the render-target APIs to settle it.

### Regardless of which it is, the queue behaviour is wrong

Real D3D9 does not fail a draw for sampling a stage with no texture bound; the
result is undefined, not an error, and the device stays usable. Ours turns it
into a sticky queue error that ends rendering for the rest of the run. Even
after the binding question is answered, an unservable draw should cost that
draw and not the device — otherwise the next gap found this way costs another
35-minute drive to reach.

## CORRECTION: fragmentation was a risk, not the wall (2026-09-14)

The section above ("Past the texture wall, the next one is arena
FRAGMENTATION") overstates its evidence, and the next person to read it should
not go and rewrite the allocator on the strength of it.

What is true: at pick+1900s the downward bump was spent (`cursor=0x8470000`
against a `0x08400000` floor), 733 MB of the arena was free in 1085 holes, and
the largest placeable run was 1008 KB. Those numbers are measured and they do
describe a real hazard.

What is not true is that anything failed because of it. `bump_fits` and
`gap_fits` are the probe asking whether a **hypothetical** 430 MB reservation
— the size B&W2 requested in an earlier session — could be placed right now.
Both went false at pick+1400s, and the load kept going: records climbed from
3565 at pick+1700s to 4055 at pick+1900s, every one of them served by
`$virtual_reserve_gap` out of those small holes. The load then *finished*
allocating, and the run died in the render loop on D3D9, which is the wall
recorded in the next section.

So the honest statement is: **the gap search carried the whole tail of the
land load out of sub-megabyte holes, and did it without a single failure.**
Fragmentation is a risk for whatever asks for something large later — gameplay
may well do that — and it is worth the allocator work eventually. It is not
what is stopping B&W2 today, and it should not be prioritised as if it were.

## The fix for it: an unbound sampler reads transparent black (2026-09-14)

drive27's filtered API trace closed the diagnosis. The two calls immediately
before the first failure are d3dx9's own, back to back:

```
[API #11091470] IDirect3DDevice9_SetPixelShader(0x07f4e030, 0x4e206174)  <- a PS that samples t2
[API #11091472] IDirect3DDevice9_SetTexture(0x07f4e030, 0x00000002, 0x00000000)
D3D9 software: missing pixel sampler2
```

So the guest deliberately draws with an unbound sampler. That is not a gap in
the guest and not a binding failure on our side: it is the ordinary effect
framework case of a texture parameter the application never assigned. D3D9
calls the result of sampling such a stage UNDEFINED and leaves the device
usable. We called it fatal.

`lib/d3d9-software-backend.js` now serves an unbound sampled stage as a shared
1x1 transparent-black texture. Transparent black is the conservative reading of
undefined — it contributes nothing to the `dp3`/`mad` this shader does with it,
so a substituted stage cannot manufacture light or colour that was never there.

Three properties of the fix are load-bearing, and two of them were found by
writing the test rather than by reasoning:

- **The substitution happens where the stage is bound, not in the snapshot.**
  A first cut wrote the substitute into `snapshot.textures[stage]` and threw
  `TypeError: Cannot add property 2, object is not extensible` —
  `Stream.copyPayload` freezes the payload it hands the backend. A drive
  launched on that cut would have traded `missing pixel sampler2` for a
  TypeError at the identical draw and proved nothing.
- **The fixed-function lowering must not see it.** `fixedPrograms` reads
  `snapshot.textures[i]` to decide which stages are active and whether a stage
  needs a cube transform; a stage that gains a texture at bind time must not
  gain one there, or the lowering changes shape for a stage the guest left
  empty.
- **The native shader VM keeps its strict contract.** It still returns `-3`
  for a TEX with no sampler, as `test/test-d3d-shader-vm.js` pins, and simply
  never sees the unbound state. The policy was relaxed in exactly one of the
  three layers that held it.

Pinned by `test/test-d3d9-unbound-sampler.js`, which also asserts the property
whose absence cost the whole run: a bound draw still works **after** an unbound
one. A draw that succeeds in isolation proves nothing about a queue whose error
is sticky.

## The blocker behind that one: a pixel shader reads v1 (2026-09-14)

drive29 proved the sampler fix — zero `missing pixel sampler` in a whole land
load, and the queue still clean at 8651 submitted where the old build was
already dead at 9032 with 558,381 failures behind it. It then stopped on the
**next** refusal in the very same shader:

```
QueueError: D3D9 software: only pixel diffuse0 and texture0..5 linkage is implemented
```

The register is `v1`, the specular input, and the shader that reads it is three
instructions:

```
81 d0 [2:0  255:0 255:0 255:0 255:1065353216]   def c0, (0,0,0,1)
1  d0 [0:0  1:1]                                mov r0, v1
1  d0 [0:0  2:0]                                mov r0, c0
```

PS1.1 is entitled to read `v1`. Whether it has a *value* depends on the draw,
so the question is not "is this legal" but "does anything produce one". Hooking
`_submit` in the live process answered it: **58 of 464 shaded draws read `v1`,
and every one of them is fixed-function vertex processing with no COLOR2
attribute, fixed-function specular off and lighting off.** Nothing writes
`oD1`, so `v1` is an interpolant with no source — undefined, exactly as an
unbound sampler's result is.

The conservative value costs nothing to produce, and the native side was
already willing: `$d3d_shader_vm_run` bounds bank 1 to index < 2, and
`$d3d_shader_vm_context` `memory.fill`s the entire context, so an input
register nothing writes reads `(0,0,0,0)` on every lane. The refusal lived
only in `lib/d3d9-software-backend.js`, and it now fires only when a producer
actually exists — a COLOR2 attribute, `fixedFunction.specular`, or a vertex
shader whose IR writes destination bank 5 index 1. In that case serving zero
would be a lie about a real specular colour rather than a reading of an
undefined one, which is a different thing from being unimplemented.

Pinned by `test/test-d3d9-unwritten-specular.js`, which asserts both
directions, including that a bound vertex shader is not by itself a producer —
only one that writes `oD1` is.

### Two refusals in one shader is a pattern, not a coincidence

Both blockers are the same mistake: a state D3D9 calls UNDEFINED was treated as
an error, and the sticky queue turned "this draw is wrong" into "this device is
finished". They were found one drive apart only because the first one hid the
second.

So the next drive stops paying that rate. A diagnostic poller records each
distinct queue error and clears it, letting one run enumerate every remaining
blocker instead of stopping at the first. Its frames are then *not* what the
guest would see — the refused draws are still lost — so the census is the
output and the picture is not. That distinction matters when reading its
screenshots later.

## B&W2 renders its world (2026-09-14)

drive30 carried both fixes through a whole land load with the error census
reporting `0/0` the entire way — no `missing pixel sampler`, no v1 refusal —
and then the picker repainted for the first time in this lane: the capture went
from 415,914 bytes of land-selection screen to 126,290 bytes of **a curved
horizon under a sky gradient, with a warm glow at the skyline**. The draw census
shows shapes that had never appeared before, which is the corroboration that
this is the engine and not a menu:

```
4/9702/false/true                       9702 primitives, pixel shader
4/2048/true/true/256x256:9/512x512:1    2048 primitives, both shaders, two textures
4/48/false/true/1024x1024:1/1024x1024:1
```

Two things this does **not** yet establish, and neither should be skipped when
the next session reads this:

- **It is the last frame before rendering stopped, not a live scene.** The
  render worker died at that moment (below).
- **The darkness is unexplained.** Both fixes serve zero for undefined state,
  and a land shader that multiplies by either would darken exactly like this.
  Pre-dawn lighting and an unfinished first frame are equally consistent with
  the picture. This is the one way the fixes could be producing a plausible
  wrong answer, so it needs a measurement — sample the colour the land pass
  writes with the substitutions forced to white and see whether the scene
  changes — not an assumption.

## The third blocker: one bad draw kills the render worker

```
D3D9 software: native raster execution failed (-1)   at submitted 8917
QueueError: render worker exited                     at 8918
QueueError: render worker stopped                    everything after
```

Unlike the first two this is not a policy refusal. `$d3d_software_step` returns
`-1` from a single `$failure` label covering `$d3d_software_clip_range` and
`$d3d_software_compact` (`src/09ah-d3d-software.wat`), and the clipper's own
bound is `count > (user_mask ? 15 : 9)` output vertices — so whether the draw
sets user clip planes is the first thing to check.

The *fatality* is separate from the bug. `lib/d3d-render-worker.js` catches the
throw, calls `shutdownNeutral()`, and the worker's event loop then has nothing
left to keep it alive, so the thread exits and every later command reports
"render worker stopped". That is the third distinct mechanism by which one
unservable draw ends rendering for a whole run — after the sticky queue error
and the refusals themselves. Worth fixing as its own thing: a draw the
rasterizer rejects should cost that draw.

Artifact: the first world frame is `frame-1263.png` in drive30's probe
directory (also copied to this session's scratchpad as
`bw2-first-world-frame.png`); probe directories under `/var/folders` are
reaped, so copy it somewhere durable before relying on it.

### The darkness is answered: the substitutions are used, and the scene is lit anyway

The measurement the section above asked for was taken, by a different and
better route than forcing the substitutions to white: count which draws
actually take them. Over 239 shaded draws in one land pass —

```
clean    157    9702prim x54, 2048prim x27, 2prim x27, 72prim x14, 48prim x11, ...
unbound   55    9702prim x55
v1        27    2048prim x27
both       0
```

— both substitutions are taken by the *largest* draws in the scene. The
9702-primitive terrain draw submits in two variants, roughly half with its
texture bound and half without, and the 2048-primitive draw is the one reading
v1. A later drive then rendered a properly lit, textured sea surface with a
dawn sky, cloud banding and light shafts (252,832 bytes against a 415,906-byte
menu) **with the error census still reading 0/0**.

So this is stronger than "the fixes are not implicated": the draws that take
the conservative value are the ones painting the picture, and the picture is
lit and textured. The earlier dark frame was the last frame before the worker
died, not what the substitutions produce.

### The third blocker's fatality, exactly — and fixed

The mechanism is more specific than "the worker catches the throw", and the
specific part is where the bug was. In `lib/d3d-command-stream.js`'s
`createCommandReceiver`:

1. The draw throws. `drain()` catches it, marks `stream.failed = true` for that
   device, and replies `'failed'` for that command. The worker survives this.
2. The producer, which has not yet been told (the failure is asynchronous),
   submits the next frame.
3. `receive()` tests `|| stream.failed` and **throws** `PROTOCOL`.
4. That throw escapes `receive()` into `lib/d3d-render-worker.js`'s top-level
   message handler, which treats any throw as fatal: `shutdownNeutral()`, the
   event loop empties, the thread exits.
5. Every later command on **every** device that worker serves reports
   `render worker stopped`.

Measured: the draw failed at command 8917, the worker was gone by 8918, and the
run's remaining 587 commands had nothing to run on — 21 minutes of a live guest
still loading records into a renderer that had already exited, with the frame
byte-identical throughout.

Fixed in `5b9b0d43`: a command arriving on an already-failed stream is answered
per command (`'consumed'` then `'failed'`, since the producer rejects a
completion it never consumed) instead of thrown. The stream stays failed, so
nothing runs against undefined state, and recovery is still a device reset — a
new generation rebuilds the stream — which is only reachable while the worker
is alive to receive it. Malformed and out-of-order descriptors still throw,
including on a failed stream. Pinned by
`test/test-d3d9-worker-survives-draw-failure.js`.

**This does not on its own make B&W2 render past the bad draw.** The device's
stream stays poisoned until a generation bump, so the `-1` itself still has to
be fixed. What the fix buys is that the worker, and every other device on it,
survives to be diagnosed — and that the run keeps going instead of freezing.

### Capturing the draw that gets `-1`

Hooking `_submit` records the wrong draw. A software draw retires
asynchronously: `_execute()` settles the consumer's completion promise into
`_retire(entry, error)`, which is where the queue's sticky `this.error` is
first set, and `submit()` only rethrows it on the *next* submit. So a `_submit`
hook sees the innocent draw that came after — and with an error census clearing
`queue.error` every second it sees almost nothing at all (measured: 0 payloads
against 285 cleared errors). The eight draw shapes recorded that way in drive31
are therefore **not** the failing draw and should not be reasoned from.

Hook `_retire` instead: it still holds `entry.command.payload` when it is
called, and nulls `entry.command` a few lines in. `tools/d3d9-replay-payload.js`
replays such a capture standalone in about a second, so the rasterizer's
refusal can be studied repeatedly instead of once per 35-minute drive.

## The third blocker was four NaN floats in the game's own vertex data

`native raster execution failed (-1)` is not a rasterizer bug in the sense the
name suggests. The captured draw (command 9233 of 9233, fixed-function, no
shaders, `primitive 4 count=28 stride=24`, 56 vertices / 84 indices, one 256x256
texture) contains exactly four non-finite values in its 1344-byte vertex buffer:
**the Y coordinate of vertices 48, 49, 50 and 51 — one quad's worth**. Every
other value in the batch is ordinary, and all positions have `w ~= 2254`.

Replacing those four floats with zero and replaying the identical capture makes
the draw succeed. That is the whole of the refusal; nothing else in the draw is
wrong.

`$d3d_software_prepare_step`'s vertex-store loop tested
`|x|,|y|,|z|,|w| <= FLT_MAX` and branched to `$failure`, which collapses into
the same bare `-1` as every other refusal in the file. That is the wrong
granularity twice over. A non-finite position is a property of ONE vertex, and
real hardware does not fail a draw call for it: every ordering comparison
against NaN is false, so the triangle covers no samples and the rest of the
batch rasterizes normally. And because the producer's queue error is sticky
(`lib/d3d-command-stream.js`), refusing cost the whole run's rendering, not one
quad.

The fix marks the vertex in the first reserved word of its 144-byte record
(`+132`, already `memory.fill`ed to zero) and has `$d3d_software_clip_range`
skip any triangle whose three inputs include a marked one. `test/test-d3d9-nan-vertex.js`
pins both halves: the draw survives, and the tainted triangle really is absent
rather than rasterized as garbage.

### How the hunt went wrong, and the reading that fixed it

The refusal was first localized to `$d3d_software_compact` — its only failure
return is `$heap_shrink` returning 0 — and then to the arena walk, after the
size check was shown to pass (`need = 12,560` against a block header of
`86,144`). **All of that was wrong**, and the tell was in the dump the whole
time: `setup@160` was still non-zero. `prepare_step` frees the setup block and
zeroes that field immediately *before* calling `compact`, so a live setup
pointer proves the draw never reached compaction. The live `vertexCursor@8=48`
against `n=56` names the failing stage exactly — the vertex-shading loop, at the
packet holding vertices 48-51.

Two durable lessons, both now built into `tools/d3d9-replay-payload.js`:

* **Read the cursors before the theory.** A context field that has *not* been
  cleared is as informative as one that has; `setup != 0` and
  `vertexCursor < n` between them ruled out the clipper and the compactor in one
  reading.
* **Check the payload's own floats first.** `--describe` now prints a
  `nonfinite:` census over the slots the declared attributes call FLOAT — for
  this draw, `v48[1] v49[1] v50[1] v51[1]`, which is the answer in one line.
  `--bisect` also walks `HEAP_ARENAS` and re-runs `$heap_arena_find` /
  `$heap_block_bad` in JS, so that hypothesis can be settled rather than argued.

### Still open: where B&W2's NaN comes from

The rasterizer fix is right on its own merits — real D3D9 does not fail a draw
call for a NaN vertex — but a game writing NaN into one quad of its land mesh is
a separate question, and it may well be ours. `--fault-null=raise` is the flag
for it: an unmapped read absorbed into the NULL sentinel reads 0, and `0/0` is
NaN. B&W2 already has one known sentinel-absorbed address (`0x9e17d0`). Nothing
here has confirmed that link; it is the next thing to measure if the land mesh
turns out to have holes in it.

## The NaN-cull fix, verified live (drive33)

One run, one question: with `$d3d_software_prepare_step` marking a non-finite
vertex instead of refusing the draw, does the world pass get all the way
through? It does, and by a wide margin.

| | drive32 (before) | drive33 (after) |
|---|---|---|
| draws submitted | died at 8,917 | **199,783** |
| draws failed | 1, then the run's rendering ended | **0** |
| render queue errors | sticky, whole run | **0/0**, start to finish |
| time in the world | — | **over an hour** (pick+4100s, still clean) |
| refusal payloads dumped | 1 | **none** |

Menus were also the fastest yet — profile → main menu → mouse tutorial → land
picker in 4.5 minutes. The letterbox over the world is B&W2's own cinematic
bars, not a render-target defect: the black regions are exactly rows 0-59 and
420-479, a 640x360 frame inside 640x480, and the land picker before it filled
the full frame.

One prediction in that run was wrong and is worth recording as such. Guest
address space grows about one `VIRTUAL_MAP_TABLE` record per second and never
shrinks, and when the largest free hole fell to ~40 MB it looked like a
reservation failure was minutes away. It was not: the hole then sat flat at
`0x11d0000` for the rest of the run. Address-space growth is a real trend with
two real ceilings (`MAX_VIRTUAL_MAPS = 8192`, and `g2w`'s linear scan), but it
is not a countdown, and it belongs to the virtual-alloc lane rather than this
one.

## Blocker #4: 316,572 world draws have no vertex declaration at all

The same run that renders cleanly also prints `D3D9 FVF 0 is not implemented`
**316,572 times** — against 199,783 draws that did reach the rasterizer. So
roughly 61% of the world's geometry is missing, and none of it is visible in
any error count.

That invisibility is the first thing to understand about this blocker.
`lib/d3d9-host.js:529` throws when the program's declaration slot (`program+8`)
and its FVF slot (`program+12`) are *both* zero; the bridge catches the throw,
returns -1, and the draw never enters the command stream. The render queue
therefore reports `failed: 0` truthfully, `errors=0/0` truthfully, and the draw
census never counts the draw at all. A log line is the only trace.

The first such line lands exactly at the land load (`run.log:1610`, immediately
after the land-picker sample). Menus are clean.

Two candidate causes, not yet separated by measurement:

* **`$d3d9_declaration_create` refused it.** `src/09ae-d3d9-resources.wat:410`
  returns NULL *silently* — eax is set to `D3DERR_INVALIDCALL` and `*out` stays
  0 — for any element the renderer does not model: `stream != 0`,
  `offset & 3`, `type > 4` (so every `UBYTE4`, `SHORT2/4`, `FLOAT16_2/4`
  element, which is what skinned and compressed meshes are made of),
  `method != 0`, `usage > 13`, `usageIndex > 15`, more than 16 elements, or a
  duplicate `(usage, usageIndex)` pair. The guest then binds NULL and every
  draw using that declaration is dropped.
* **The game calls `SetFVF(0)`.** `$handle_IDirect3DDevice9_SetFVF` clears the
  bound declaration before storing the FVF, so an `SetFVF(0)` would leave both
  slots zero on its own.

The return value settles it — `0x8876086c` out of `CreateVertexDeclaration` is
our own refusal — which is what drive34 traces, with no source change needed.
Note that a silent NULL here is exactly the failure shape the fail-fast-stub
rule exists to prevent: the call reports an error the game ignores, and the
consequence surfaces thousands of draws later as a picture with holes in it.

### What blocker #4 is not (drive34)

Four things were plausible and three are now dead, by measurement rather than
argument. Recording them so the next session does not re-run them:

* **The game never calls `SetFVF(0)`.** Its FVFs are `0x142` (×13,966),
  `0x144` (×4,575), `0x42` (×2,963), `0x1c4` (×600), `0x2` (×463) and
  `0x152`/`0x102` (×115 each) — every one of them accepted by the
  `position`/`texCount` test in `lib/d3d9-host.js`.
* **The declarations it binds are real objects of ours.** Read live out of the
  running guest at `0x7ebc8884`: magic `d3d90002` at +12, device `07f4e030` at
  +8 (matching), refcount 1, 0x50 bytes of elements. So `CreateVertexDeclaration`
  succeeds at least often — and `$heap_alloc` does hand out `0x7exxxxxx`
  addresses, which is worth knowing before dismissing a pointer as foreign.
* **The state-block path cannot be zeroing the pair.** `$d3d9_declaration_bind`
  records `(declaration, 0)` while a block is recording, which would lose an
  FVF — except `$d3d9_recording_guard` calls `$crash_unimplemented` when
  `SetFVF` arrives during recording, and nothing trapped in a 25-minute run.
* One decoded element array (`0x0253dbd0`) is `POSITION0 FLOAT3` plus
  `TEXCOORD0..7 FLOAT4`, stream 0, 4-byte aligned, method DEFAULT — entirely
  inside what the renderer models.

What *is* established: 48,043 of the `SetVertexDeclaration(NULL)` calls come
from a single engine thunk at `0x009333f0`

```
009333f0  mov edx, [esp+0x4]        ; the declaration argument
009333f4  mov eax, [ecx+0x1a0]      ; the device
009333fa  mov ecx, [eax]
009333fc  push edx
009333fd  push eax
009333fe  call [ecx+0x15c]          ; IDirect3DDevice9::SetVertexDeclaration
00933404  ret 0x4
```

and its smallest caller, `0x00a9cad0`, passes a declaration **stored in the
game's own object** at `[ecx+0x188]`. A NULL in that field is exactly what a
failed `CreateVertexDeclaration` leaves behind — and that refusal was
unreadable, because it returns `D3DERR_INVALIDCALL` with `*out` at 0 and keeps
no record of itself.

So `$d3d9_declaration_create` now counts its refusals and keeps the rule that
fired plus the first offending element, read out through
`get_d3d9_decl_reject_count` / `_mask` / `_element` / `_element_hi`, and
`tools/d3d9-decl-decode.js` turns that element into the rule in English. A
count of zero falsifies the declaration theory outright and sends the hunt back
to draw ordering; anything else names the element type to widen.

### Blocker #4, answered: B&W2 uses more than one vertex stream

The refusal counters name it in one reading, taken before the main menu had
even settled:

```
count=85  mask=0x20  element=00000001,02050002
```

`0x20` is the `stream != 0` rule. Decoding the element it kept:

```
$ node tools/d3d9-decl-decode.js '01 00 00 00 02 00 05 02 ff 00 00 00 11 00 00 00'
[0] stream 1 offset   0 FLOAT3    DEFAULT  TEXCOORD2   <-- REFUSED: stream 1 (only stream 0 is modelled)
```

**That reading was incomplete, and the next sample corrected it.** At 85
refusals the mask was `0x20` alone; by 124, once the land had begun loading, it
was `0xa0` — `stream != 0` *and* `type > 4`. So both rules fire, and the
`UBYTE4`/`SHORT`/`FLOAT16` guess was not wrong after all, merely not the first
thing to break. Multi-stream is what the *menus* trip over; the element types
arrive with the land. A fix needs both, and a reading taken before the land
loads would have shipped half of it.

(The counters keep only the *first* offending element, which is why the second
rule has a bit but no element here. That is a limit of the instrument, not a
finding.)

Three separate silent failures are chained here, which is why this took a whole
session to see:

1. `$handle_IDirect3DDevice9_SetStreamSource` binds the buffer only when the
   stream index is zero (`(if (i32.eqz (local.get $arg1)) ...)`). A
   `SetStreamSource(1, ...)` sets `eax` to `D3DERR_INVALIDCALL` and stores
   nothing. The device state has room for exactly one stream: `+1720` buffer,
   `+1724` offset, `+1728` stride.
2. `$d3d9_declaration_create` then refuses any declaration mentioning stream 1,
   returning `D3DERR_INVALIDCALL` with `*out` left at 0 — with, until now, no
   record that it happened.
3. The game stores that NULL in its own object at `[ecx+0x188]`, binds it
   through the thunk at `0x009333f0`, and draws. `lib/d3d9-host.js` drops the
   draw because neither a declaration nor an FVF is set, and reports it as
   `D3D9 FVF 0 is not implemented` — a message about FVFs, for a problem that
   has nothing to do with FVFs.

None of the three moves any error counter, and the guest checks none of the
HRESULTs. The visible symptom is 61% of the world simply missing.

**What the fix needs**, in order:

* per-stream device state (buffer, offset, stride) instead of the single
  `+1720`/`+1724`/`+1728` triple, and a `SetStreamSource` that honours the
  index;
* `$d3d9_declaration_create` to accept `stream < 16` and keep the stream index
  per element, **and** to accept the element types above `D3DCOLOR` that the
  `0x80` bit reports — which `lib/d3d9-software-backend.js` must then decode,
  since its `packed[base+c]` handles only `D3DCOLOR` and 32-bit floats;
* the draw descriptor in `lib/d3d9-host.js` to snapshot every stream the
  declaration references, not just one, and to carry a per-attribute stream
  index alongside the existing offset;
* `lib/d3d9-software-backend.js` to fetch attribute *j* from its own stream at
  that stream's stride — today `packed[base+c]` reads one `snapshot.stride` for
  everything.

`SetStreamSourceFreq` is still `$crash_unimplemented`, so instancing is a
separate question and B&W2 has not asked for it.

## Blocker #4, fixed: both rules, with the land's element named

drive36 read both refusal slots at once and settled the question the 07:45
entry got half right:

| slot | reason | element (raw dwords) | decoded |
|---|---|---|---|
| 1 | `0x20` stream!=0 | `00000001,02050002` | stream 1 offset 0 FLOAT3 DEFAULT TEXCOORD2 |
| 2 | `0x80` type>4 | `00000000,00000007` | stream 0 offset 0 **SHORT4** DEFAULT POSITION0 |

So the land's vertex positions are `SHORT4` — 16-bit heightfield coordinates,
which is what a terrain mesh would naturally use, and not the UBYTE4/FLOAT16
skinning data guessed earlier. The menus trip the stream rule; the land trips
both. 124 refusals by the land-picker screen, 405 by 25 minutes into the world.

What the world actually looks like on the unfixed build, for the record: at
pick+1100s B&W2 is in the world (cinematic letterbox bars, curved horizon, a
sunrise glow on it) and essentially nothing else is drawn. The land-selection
screen before it renders completely — a burning village inside a vignette,
animated fire, the island picker below — which is worth knowing, because it
means the refusals do not stop the menus from looking finished.

### The fix, in four parts

1. **Element types.** `lib/d3d9-software-backend.js` grew a 17-entry
   `DECL_TYPES` table (FLOAT1..4, D3DCOLOR, UBYTE4, SHORT2/4, UBYTE4N,
   SHORT2N/4N, USHORT2N/4N, UDEC3, DEC3N, FLOAT16_2/4), each with a component
   count, a byte size and a reader; the validation and the fetch loop both go
   through it instead of a `type===4 ? byte/255 : float32` ternary. D3DCOLOR
   keeps its `/255` read because `lib/d3d9-host.js`'s `convertColor()` has
   already swapped bytes 0 and 2 in the buffer — UBYTE4 and UBYTE4N must not
   get that swizzle, which is the one trap in the table.
2. **16 stream bindings.** The device state held one `{buffer, offset, stride}`
   triple at +1720/+1724/+1728. It now holds sixteen 16-byte records at
   **+25340** (buffer, offset, stride, and the byte pointer the last draw
   computed), addressed by `$d3d9_stream_slot`, and the state allocation grew
   from 25340 to 25596 bytes. **Not** at +1808, which looked free and is not:
   `$d3d9_sampler_offset` computes `1808 + stage*64` for stages 0..3 and owns
   every byte through 2063. A computed offset is invisible to a grep for the
   literal — check that helper before claiming a gap. Putting the table there
   broke `test-d3d9-color-surfaces`, `-software-bridge` and `-pipeline-web`
   with `native binding rejected: d3d_software_bind_texture_mips`, which names
   the samplers if you already know what happened and nothing if you do not.
3. **The refusals lifted.** `$handle_IDirect3DDevice9_SetStreamSource` binds
   any index below 16 (and calls `$crash_unimplemented` for a non-zero index
   arriving while a state block records, since blocks capture stream 0 only);
   `GetStreamSource` reads any index back; `$d3d9_declaration_create` accepts
   `stream < 16` and `type <= 16`; device teardown unbinds all 16.
   `$d3d9_draw_buffer` publishes a byte pointer per stream and the table's
   address at descriptor+60. Only stream 0 can fail the draw — a stream left
   bound by an earlier draw and unused by this declaration must cost nothing.
4. **One interleaved buffer.** `lib/d3d9-host.js` decodes the declaration
   first, learns which streams it names, and gathers them into a single
   vertex buffer whose stride is the sum of theirs, rewriting each attribute's
   offset. The backends never learn about streams at all. That is deliberate:
   a backend reading one array at one stride cannot get multi-stream subtly
   wrong, and every path through that function already copied.

### Tests

- `test/test-d3d9-decl-types.js` — ten D3DDECLTYPEs each encode a known colour
  and must render the pixels that colour renders to **as a FLOAT4**. Comparing
  against the FLOAT4 render rather than a literal keeps the test about the
  decode, so a wrong scale factor or a permuted component fails rather than
  passes; the narrow types (SHORT2, UDEC3, DEC3N) also pin the components they
  do not write against the register default.
- `test/test-d3d9-multi-stream.js` — drives the real guest handlers:
  `CreateVertexDeclaration` with a stream-1 element, `SetStreamSource(1,...)`,
  `DrawPrimitive`. The same triangle with its colour moved to a second buffer
  at a **different stride** (12 and 4 against the interleaved 16) must produce
  the same pixel. It also checks `GetStreamSource(1)` reads back what was
  bound, that a declaration naming an unbound stream paints nothing and says
  `stream 1` rather than blaming the FVF, and that stream 16 is refused.

Retired along the way: the claim that `+1808..2067` was free device state.

## Blocker #4, verified live — and blocker #5 behind it

drive37 ran the same script as drive36 against the fixed build, so the two are
directly comparable at every offset past the land-picker click:

| | drive36 (unfixed) | drive37 (fixed) |
|---|---|---|
| pick+100s | `declrej=124/mask=0xa0` records=417 | `declrej=0/mask=0x0` records=416 |
| pick+300s | `124/0xa0` records=441 | `0/0x0` records=443 |
| pick+500s | `124/0xa0` records=466 | `0/0x0` records=471 |
| pick+700s | `124/0xa0` records=516 | `0/0x0` records=516 |

Same progression, same screens, one counter moving and one not. Both element
slots stay empty too, so nothing is being refused and merely uncounted.

**The next wall was one gate further along.** At pick+800s the error census
caught `D3D9 software: invalid fixed position format`. `fixedPrograms` in
`lib/d3d9-software-backend.js` required a fixed-function position to be FLOAT3
or FLOAT4 — and the land's is `SHORT4 POSITION0`, the very element the
declaration gate had just stopped refusing. So the declaration was accepted
and the draw built from it was thrown away instead.

Everything after that in the census is the same error propagating, and it is
worth recognising the shape: `earlier render command failed`, then `render
worker exited`, then `render worker stopped`. The queue's error is sticky, so
one refused draw takes the frame and eventually the worker with it, and the
error *count* climbs while only one thing is actually wrong. Read the first
entry in `ctx.bwErrors.order`, not the count.

The rule is now "any declared type that carries three components", which costs
nothing to support because the fetch loop already expands every type into a
float4 register. Still refused, deliberately and loudly:

- **D3DCOLOR, UBYTE4, UBYTE4N as a position.** A byte quadruple is a colour or
  an index set; `lib/d3d9-host.js`'s `convertColor` has also already permuted
  D3DCOLOR's bytes by the time the backend sees them, so reading one as a
  coordinate would be silently wrong rather than merely odd.
- **Anything with fewer than three components** (SHORT2, FLOAT2, …).
- **POSITIONT in anything but FLOAT4.** Its fourth component is a real
  reciprocal w that the rasterizer divides by.

`test/test-d3d9-fixed-position-types.js` pins it: the same triangle spelled
FLOAT3, FLOAT4, SHORT4, SHORT4N and FLOAT16_4 must rasterize identical pixels,
plus the four refusals above. Its corners are the clip volume's edges on
purpose — SHORT4N lands a half-ULP short of them, which covers the same pixels,
while a component read at the wrong scale or offset misses by a whole triangle.

## Blocker #6: every vertex shader refused, and nothing said so

With the world rendering, the terrain was still flat grey. A draw census in
the live world — `scratchpad/bw-draw-census.js`, one signature string per
retired draw — measured **2,039 draws in 45 seconds and zero vertex shaders**.
Every draw was fixed-function. The most common signature, 651 of the 2,039,
was `vs-fixed | ps | tex512x512 | op4/2/1 | unlit | prim4 | 0.0:7`: a
declaration containing `SHORT4 POSITION0` and nothing else, no texcoord, a
512x512 texture bound, and a real pixel shader.

That combination cannot be what the game meant. A pixel shader samples a
texture at coordinates something has to produce, and with no TEXCOORD element
and no vertex shader, `fixedPrograms` hands it the register default — one
constant coordinate for every pixel, one texel sampled, the triangle painted
flat. Which is exactly what the terrain looked like.

So the draws were not wrong; the shaders were missing. A refused
`CreateVertexShader` is silent in precisely the way a refused declaration was:
the game gets NULL, binds nothing, and the draw quietly falls back to
fixed-function vertex processing with a declaration that was written for a
shader. Counting it rather than inferring it is what `$d3d9_shader_made` /
`$d3d9_shader_refused` and the per-stage first-refused version words exist
for. At the main menu:

```
shaders=30made/107refused/vs=0xfffe0101,err16@519/ps=0xffff0200,err0
```

Two different findings in one line, and conflating them would have sent the
next session to the wrong file:

- **Pixel:** `0xffff0200` is ps_2_0 and the error is 0, meaning the version
  gate refused the profile outright. `0xffff0200` appears nowhere in `src/`.
  That is a front end to build, not a gate to widen.
- **Vertex:** `0xfffe0101` is vs_1_1 — the profile we *do* accept — failing
  with `$d3d_ir_error` 16 ("unsupported") at dword 519. So those shaders
  passed the version gate and died inside `$d3d_shader_ir_compile`.

This retired a hypothesis that had been reasoned from the code rather than
measured: that `CreateVertexShader`'s hardcoded `0xfffe0101` was refusing
vs_2_0 shaders. The counter said vs_1_1, so it was not.

### Reading dword 519

The offset alone names nothing, so the refusal began recording the token at
it — and that came back `0x00000009`, which looked impossible: opcode 9 is
`dp4`, the token's length field is 0, and as a source parameter its bit 31 is
clear. Two traps sat behind that.

The first was in the capture. Sizing the copy by scanning linearly for
`0x0000ffff` is wrong: B&W2's shaders open with a 135-dword `COMMENT` holding
the HLSL constant table (`CTAB`), and that blob contains a word equal to
`0x0000ffff`, so the copy stopped at dword 383 of a stream whose error is at
519. The validator's own scan skips comments properly; a linear search does
not. Copy a fixed window and let the reader find END.

The second was the reading. The 1.x scan advances by *arity*, not by the
token's length field, so a length of 0 is normal in SM1 and "length < arity"
was never the failure. `tools/d3d9-shader-dump.js` (written for this) settled
it in one command:

```
  31 @ 516: mov  r0, v0
  32 @ 519: dp4  oPos.x, r0, c10     [520] 0xc0010000  mask .x
  33 @ 523: dp4  oPos.y, r0, c11     [524] 0xc0020000  mask .y
  34 @ 527: dp4  oPos.z, r0, c12     [528] 0xc0040000  mask .z
  37 @ 539: dp4  oPos.w, r0, c13     [540] 0xc0080000  mask .w
```

The textbook vs_1_1 transform: four dp4s against four rows of the clip matrix.
`$d3d_ir_scan` required a write to oPos (bank 4, index 0) to carry a full
`xyzw` mask **in one instruction**, so it refused the first one.

### The fix (374269af)

Completeness is a real requirement — an `oPos.w` nobody wrote makes the
projection divide meaningless — but it belongs at the end of the shader, not
on any single instruction. `$position` is now the union of the write masks and
the final check compares it against 15, which is what `$d3d_ir_scan20` has
always done for VS2.0. The two scans now agree.

Measured on the fixed build at the same main menu:

| | before | after |
|---|---|---|
| shaders made | 30 | 63 |
| refused | 107 | 74 |
| first refused vertex | `0xfffe0101` err 16 @519 | `0xfffe0200` err 0 |

The vs_1_1 refusals are gone entirely, and what is left is the profile gate
refusing **vs_2_0** — the hypothesis that was wrong as a diagnosis of blocker
#6 and is correct as the next one.

`test/test-d3d-vs11-split-position.js` pins the rule from both sides: every
partition of `xyzw` across instructions is accepted (four singles, xyz+w,
x+yzw, xy+zw, w-first, mixed opcodes, overlapping masks, one full write) and
every partition that leaves a component out is refused with the position
error. It also checks that a write to oFog — bank 4 *index 1* — does not count
towards oPos, which is the mistake a union keyed on the bank alone would make.

## Blocker #7 (open): the 2.0 profiles

Both stages now stop at the same place, and they are not the same amount of
work:

- **vs_2_0.** `$d3d_shader_ir_compile20` and `$d3d_shader_vm_compile_vs20`
  exist, have a dozen passing `test-d3d-vs20-*` tests behind them, and are
  called **only from tests** — no shipped path ever compiles vs_2_0.
  `$d3d9_shader_create` hardcodes `0xfffe0101` and refuses anything else. So
  this is a gate to open and a path to wire, not a compiler to write.
- **ps_2_0.** `0xffff0200` exists nowhere in `src/`. There is no front end at
  all.

One more failing draw class is recorded from drive38 (pick+1700s) and is
probably the same story: a declaration with `POSITION0` as **D3DCOLOR** at
offset 0, DIFFUSE type 4 at 4, TEXCOORD0 type 4 at 8, TEXCOORD1 FLOAT2 at 12,
TEXCOORD2 type 4 at 20, stride 24. That is self-consistent and meaningless as
a coordinate *unless a vertex shader unpacks it* — which is what the game
intends and what a refused shader prevents. The host's element decode was
checked against D3DVERTEXELEMENT9 and matches, and the FVF path emits
different registers, so it is a real guest declaration and not a decode bug.

## Blocker #8, verified live, and what the picker does next (2026-09-14)

drive44 is drive43's script on the build carrying both the blocker #6 fix
(`374269af`) and the dead-`oD1` allowance in `lib/d3d9-software-backend.js`.
The two runs are the control for each other: every counter matches up to the
land click -- 63 made / 74 refused at the main menu, 178 / 124 at the land
picker, 198 / 128 at pick+10s, 217 / 129 at pick+50s -- so the *only*
difference between them is whether the dead write killed the render worker.

| | drive43 | drive44 |
|---|---|---|
| pick+45s | `errors=0/0` | `errors=0/0` |
| pick+50s | **`errors=1/1`**, queue dead | `errors=0/0` |
| pick+465s | (gone) | `errors=0/0`, still presenting |

So blocker #8 was the whole of that failure.

### The picture

The land-selection screen now draws a fully textured, lit 3D scene -- a burning
Greek village with trees, terrain and smoke, 77,017 distinct colours in one
640x480 frame -- where before `374269af` the world painted flat grey. This is
the first time B&W2's 3D content has rendered in this lane with the render
queue still alive at the end of it.

### The refusals that remain, split by profile

Read live off drive44 at the land picker through the counters built last
session (`get_d3d9_shader_refused_{vs11,vs20,ps1x,ps20,other}`):

```
vs11=2  vs20=45  ps1x=13  ps20=69  other=0     (129 refusals)
```

**ps_2_0 is the largest single bucket and has no front end anywhere** --
`0xffff0200` appears nowhere in `src/`. vs_2_0 is second and already has
`$d3d_shader_ir_compile20` and `$d3d_shader_vm_compile_vs20` with a dozen
passing `test-d3d-vs20-*` tests, reachable only from tests behind a deliberate
"development-only foundation, not public shader-profile admission" gate
(`09ag-d3d-shader-vm.wat:380`). Opening vs_2_0 alone buys little, because a
draw needs both stages and B&W2's 2.0 vertex shaders are paired with 2.0 pixel
shaders.

Note that we already report `PixelShaderVersion = 0xffff0101` and
`VertexShaderVersion = 0xfffe0101` in `$d3d9_fill_caps`, so the game is being
*told* 1.1 and creates 2.0 shaders anyway. It is not reading our caps for these.

The 15 refusals in the **1.x** buckets are the more interesting number: those
are profiles the front end implements and refuses anyway, so each is a gap
inside a compiler we have rather than a profile we lack. The first-refused-word
census keeps one word per stage and both of B&W2's are 2.0, so it cannot see
them at all -- `$d3d9_shader_tally` now also records the first validator error
and offset in each 1.x bucket (`get_d3d9_shader_err_vs11{,_at}`,
`get_d3d9_shader_err_ps1x{,_at}`). Unread as of this writing: drive44 predates
the export.

### What the land picker does after the pick, measured

The pick is not ignored and the game is not wedged. Counting draw categories
that use a shader (`.../true/true/...`), the whole history of drive44 is:

```
t=  5s   0
t=372s  24        <- pick+~60s
t=377s 131
t=383s 144
... flat for the next 700 seconds
```

144 draws of `4/814/true/true/512x512:10` and
`4/814/true/true/128x128:1/512x256:10` in an eleven-second burst, and then the
game returns to redrawing the picker forever (op-5 climbing steadily,
`SetFVF` from `ret=0x009333e4` in a loop, `errors=0/0`, main-thread EIP parked
in the thunk zone at `0x07500008`). Memory climbs slowly and evenly --
`records` 374 -> 459 over 465 s -- with no runaway.

Three further inputs were tried on the live run and none started a land:

| input | result |
|---|---|
| ENTER | no change at all |
| click the vignette at (320,180) | 396 of 307,200 pixels differ, a 47x16 box inside the thumbnail strip |
| double click the thumbnail at (135,378) | shader draws 144 -> **154** |

The last one matters: the clicks *are* reaching the game and the island preview
re-renders for each. So the picker is responsive, the pick registers, and the
811-primitive burst is the selected island's preview being drawn -- not a land
load that stalls. Whatever confirms the selection has not been found yet, and
the screen shows no text or button anywhere, which is the thing to explain
next.

## Blocker #9: the terrain pass consumes specular (2026-09-14)

Blocker #8 was fixed by allowing a *dead* `oD1` write through. The payload
drive44 captured says the land pass's own draw is not that case. Decoded from
`bw44-specular-fail.json` (a copy of the run's `bw40fail.0.json`):

- the draw is `primitive 4, primitiveCount 2048, stride 12`, one attribute
  `{register:0, usage:0, usageIndex:0, type:2, offset:0}`, `textures: []`
- its vertex shader is vs_1_1, 11 instructions, ending `mov oD1.xyzw`
  (destination word `0xd00f0001` -> bank 5 index 1, mask 15)
- its pixel shader is ps_1_1, 3 instructions: `mov r0.xyz, v1`
  (`0x80070000` <- `0x90e40001`, bank 1 index 1) then `mov r0.w, c0.w`
  (`0xa0ff0000`)

So the land is painted **by** the interpolated specular colour. Serving zero
would paint it black, which is why the `consumesSpecular` allowance correctly
did not cover it and why the refusal was right until the value could be
carried. This is the ABI extension deliberately deferred in the #8 fix.

### The fix: a second colour varying

`src/09ah-d3d-software.wat`'s vertex snapshot grows from **144 to 160 bytes**,
with `specularOverW float4` at +144. It is carried unconditionally: the VS
context bank is zero-filled before every packet, so a shader that never writes
`oD1` lands four zeroes there -- exactly what the pixel VM served for an
unwritten `v1` before the varying existed.

The VM context is `7 banks * 128 registers * 64 bytes` starting at +32, which
fixes both ends of the linkage:

| register | address |
|---|---|
| VS `oD1` = bank 5 index 1 | `32 + (5*128+1)*64` = **41056** |
| PS `v1` = bank 1 index 1 | `8224 + 64` = **8288** |

Every derived constant moves with the stride, and each one is arithmetic on the
snapshot size rather than a magic number:

| what | was | is |
|---|---|---|
| workspace per vertex (POINT / plain) | 148 / 144 | 164 / 160 |
| clip scratch b/ma stride | 288 | 320 |
| emitted block (7 x stride) | 1008 | 1120 |
| retained per index (7 x stride + 14) | 1022 | 1134 |
| ... POINT (+28) | 1050 | 1162 |
| allocation bound per index / base | 1052 / 4080 | 1164 / 4464 |
| scratch bytes (12 / 16 slots) | 3552 / 4736 | 3936 / 5248 |
| clipped bound delta | 1280 | 1408 |

One trap: `(i32.const 144)` appears 26 times in that file and **one of them is
not the stride** -- line 324's `(i32.add (i32.const 144) (i32.shl $bank 2))` is
the context's VSctx/PSctx pointer array and must not change.

`lib/d3d9-software-backend.js` drops both halves of the #8 compromise. The
`oD1` output rule is now plainly `bank===5 && index>1` (oD2 does not exist),
and the `v1` linkage rule refuses only a producer the vertex lowering *drops* --
a COLOR2 attribute or fixed-function specular lighting with no `oD1` write to
carry it. `vs` there is the lowered program, so that question is measured per
draw rather than assumed for the fixed-function path.

`test/test-d3d9-specular-varying.js` pins the linkage with B&W2's own pixel
shader (`mov r0.xyz, v1` / `mov r0.w, c0.w`) rendered twice: with a vertex
shader writing `oD1` from a green COLOR0 attribute every pixel is
`(0,255,0,255)`, and with the `oD1` write removed every pixel is black. The
control is the point -- it proves the colour travelled through the varying.

### drive45: the fix holds live, and the picker is not where it fails

Same script as drive44 on the build carrying the varying, with the second click
baked in. It reached the land picker in **four minutes** (drive44 took twelve)
and sat there clean:

| | drive44 | drive45 |
|---|---|---|
| shaders at the picker | 217 made / 129 refused | 217 made / 129 refused |
| queue errors | `0/0` | `0/0` |
| probe `failed` | 0 | **0** |
| shaded draws | 144 | 144 |
| draw categories | small | **58** |

So nothing regressed and nothing new was refused. The whole selection screen
renders: the burning Greek village in the vignette, the Greek-key border, and
the strip of **nine island thumbnails** with the second one — the playable
land — drawn in colour while the other eight are pale outlines. 77,354 distinct
colours in the frame.

Three inputs were tried against the live picker and none started a land:

| input | result |
|---|---|
| second click 30 s after the first | only the animated border strip changes (392 of 307,200 px, a 493x16 box at y=417) |
| a *fast* down/up/down/up pair in place | no change at all; shaded draws stay at 144 |
| relative move to the bottom-right band, then diff | only that same border strip |

That last one is the interesting negative: a mouse move produces **no cursor
sprite motion in the frame**, where drive43's aim diffs always showed the
21x22 gold arrow. And the pale band under the Greek key — where the real game
puts the land name and its buttons — is blank. **No text renders anywhere on
this screen.** So the working hypothesis is no longer "the confirm input has
not been found"; it is that the screen's text and cursor layer is missing, and
the confirm is probably in it.

### What the new 1.x-bucket counters say

`vs11=2,err6@1459  vs20=45  ps1x=13,err0@0  ps20=69  other=0`

- **`ps1x` err 0 is the version gate, and the bucket is ps_1_4.** The comment
  added with these counters claimed error 0 could not appear here. It can:
  `$d3d9_shader_create` is called with `0xffff0101` from `CreatePixelShader`
  (`09ad-handlers-d3d9.wat:1894`) and the widening just above the gate covers
  only `0xffff0102` and `0xffff0103` — not `0xffff0104`. So a ps_1_4 blob is
  refused at the mismatch site with error 0 and the blob's own word, which
  lands it in the 1.x bucket. That is 13 of B&W2's 129 refusals.
  `test/test-d3d9-ps14-stage-linkage.js` passes today and its own name says
  what the state is: *"private PS1.4 validator -> SIMD -> six-stage raster
  linkage; public gate remains closed"*. Opening it is widening that gate, not
  writing a compiler.
- **`vs11` err 6 at token offset 1459 is a real gap** inside the vs_1_1 front
  end we do claim — error 6 is the unsupported-operand class, raised from ten
  sites in `09af-d3d-shader-ir.wat`. Two shaders, and naming which site needs
  the blob dumped at that offset.

## The land picker does not ignore the mouse — it stops reading it (drive47/48)

The previous section's hypothesis — *"the screen's text and cursor layer is
missing, and the confirm is probably in it"* — is wrong, and the measurement
that replaces it is simple: **after the land click B&W2 stops calling
`IDirectInputDevice::GetDeviceData` altogether**, for tens of minutes, and
during that time nothing it draws changes either. A cursor that cannot move
and a screen that never changes are one symptom, not two.

### The ring, and why a full ring is the symptom and not the cause

`DI_MOUSE_INPUT_STATE` (`node tools/region-layout.js`; head at +8, tail at +12,
64-entry ring at +16, the two motion-overflow words at +272/+276) sat at
`head=156 tail=220` — exactly 64 events, the capacity — unchanged across
minutes, in **both** drive47 and drive48, at the same point in the same
scripted route. Emptying it by hand (`head := tail`) and injecting one move
queued two events that were still there 25 s later, while 120 `DrawPrimitive`s
went by. Nothing was draining it.

The device itself is healthy: `this = 0x07f4e020` is DX slot 4, `DxObject.misc0
== 2` (mouse, `09a8-handlers-directx.wat:72`), `flags = 0x705` so
`$DIDEV_ACQUIRED` is set, and `DIPROP_BUFFERSIZE` gave it a capacity of 512.
`$handle_IDirectInputDevice_GetDeviceData` would have delivered.

### Who was supposed to call it

The poll lives at `0x009b08e7`:

```
009b0880  push ebp ... mov esi, ecx        ; the input manager, a static
009b08a7  cmp [esi+0x176], bl              ; foreground bookkeeping
009b08e7  mov edx, [0x1d7a72c]             ; the mouse device pointer
009b08ef  jz  0x9b0bb7                     ; ...none? skip
009b08f5  test [esi+0x178], 0x1            ; input enabled?
009b0930  call [eax+0x28]                  ; GetDeviceData(dev, 0x14, buf, &n, 0)
```

Both gates were open live — `[0x1d7a72c] = 0x07f4e020` and `[esi+0x178] = 5`.
The function simply never ran: hit counters armed on the entry `0x9b0880`, on
the two inner blocks, and on **all four** of its call sites (`0x520cc5`,
`0x526143`, `0x56da4d`, `0x5f9573`, found with `tools/xrefs.js`) all read zero
over 20 s while `0xa4da46` — the return of the D3D9 `DrawPrimitive` call — read
232. (`tools/find_fn.js` puts the entry at `0x9b08f4`; that is 116 bytes too
far in. The real entry is the one after the `cc` run at `0x9b087a`, and it is
the only address with any xrefs.)

### It resumes by itself, and what comes back with it

Left alone, the game starts polling again: `GetDeviceData` went 206 → 258 in
the trace, the ring drained to `head == tail`, and a 40-event click burst was
consumed whole. What also changes at that moment is the *shape* of the frame.
The picker's draw census is 2D quads; after the resume it gains entries like

```
5/4894/true/true/256x256:9/1024x1024:1      ; 4894 triangles, VS+PS, two textures
4/2061/true/true/256x256:9/1024x1024:1
4/1714/true/true/256x256:9/1024x1024:1
```

and the EXE's hot block becomes `0x00ac3350`, a walk over a **1024-wide
height grid** (`mov dx,[edi+edx*2]` with `shl edx,0xa`). The hot code during
the stall is `d3dx9_25.dll` (loaded at `0x2528000`, origBase `0x400000`, so
module VA = hit − `0x2128000`). So the stall is the land being built, not a
hang, and it is followed by terrain rendering — 45 draws/s against 0.1
presents/s, i.e. ~500 draws per frame.

### Aiming at the picker: read the game's cursor, do not guess it

The game keeps its own cursor, and the host pointer is unrelated to it. The
input manager is the **static object at `0x1d733e8`** (it is the `this` the
call site at `0x526143` loads: `mov ecx, 0x1d733e8`), and a diff across one
injected move names three fields:

| offset | meaning |
|---|---|
| `+0xc4` / `+0xc8` | cursor X / Y |
| `+0xe0` / `+0xe4` | previous frame's copy |
| `+0xf8` / `+0xfc` | the delta last applied |
| `+0x178` bit 0 | input-enabled gate read at `0x9b08f5` |

X clamps at −1 on the left, and Y has been read as high as 569 in a 640x480
window, so the cursor space is **not** the window's. `scratchpad/bw-aim.sh`
closes the loop on those two fields — read, move by the difference, read
again — and lands the cursor on an exact pixel in three or four steps where a
single lump of relative deltas never did. That is the only way to know where a
click will land, and it is how a click was put precisely on the playable
island thumbnail (`130,375`) and confirmed consumed (`head == tail`).

### The live instrumentation these findings came from

No rebuild and no restart: the probe's `--control-stdin` `eval` channel has
`exports`, so a **running** B&W2 can be asked for

- per-address hit counts — `exports.set_count(slot, addr)` / `get_count` /
  `clear_counts` (the address must be a basic-block entry), and
- a hot-block profile — `reset_handler_hist()`, `set_handler_hist_enabled(1)`,
  then walk `get_hot_block_hist_base()` as `{eip, count}` pairs.

Both are how "the input pump is not running" and "the time is in d3dx9" were
measured against a live land build rather than inferred from a new run.

## Blocker #10: nine POSITION semantics on one stream (drive48/49)

After the land click every `PRESENT` failed. The census over the queue's own
error list — installed live over the `eval` channel — reads

```
{"n":2,"cleared":76,
 "first":["QueueError: D3D9 software: only one position/diffuse/PSIZE and six UV linkages are implemented",
          "QueueError: earlier render command failed"]}
```

so there is **one** real error and 76 copies of its shadow: a command queue's
error is sticky, and after a single refused draw every later command —
including every present — is rejected with *earlier render command failed*.
Reading the count tells you nothing; only `order[0]` names the cause.

The refused draw was captured whole by the drive's `_retire` hook
(`scratchpad/bw-retire-capture.js`, `BW_DUMP=`) and is the terrain pass:

```
primitive 5 (triangle strip)  count 2467  stride 100
  v0 POSITION0 FLOAT3 @0    v1 POSITION1 FLOAT3 @12   v2 POSITION5 FLOAT3 @24
  v3 POSITION6 FLOAT3 @36   v4 POSITION7 FLOAT3 @48   v5 POSITION8 FLOAT3 @60
  v6 POSITION2 FLOAT2 @72   v7 POSITION3 SHORT4 @80   v8 POSITION4 FLOAT3 @88
  vs_1_1 (0xfffe0101), 71 instructions, dcl_position v0..v6
  ps_1_1 (0xffff0101), 10 instructions
  textures 256x256, 256x256, 128x128
```

Nine attributes, **all usage POSITION**, usageIndex 0..8. That is legal D3D9
and it is what B&W2 does: it packs position, the height-grid neighbours and
the blend weights into one stream and lets the vertex program decide what each
one means. Our linkage did not — it insisted every attribute land in a lane it
recognized (POSITION0, COLOR0/1, PSIZE, TEXCOORD0..5) and refused everything
else, so `POSITION1` had nowhere to go.

**The rule that was wrong:** a programmable vertex program reads its inputs by
*register*. The semantic only decides which attribute feeds which register —
after that the shader does the interpreting, and the lane a value travels in is
ours to choose. So in `lib/d3d9-software-backend.js` any semantic without a
fixed lane now gets its own appended ABI5 lane, exactly as NORMAL and COLOR1
already did, with `registers[slot]` carrying the VS register through
`extraMap`. Fixed function keeps the narrow slot map, because there the
semantic *is* the meaning. The eleven-lane native cap still stands — and B&W2's
draw needs exactly eleven (position + the diffuse/UV base pair + eight extras).
`test/test-d3d9-generic-vertex-semantics.js` pins both ends: the colour is read
from POSITION6, a semantic with no lane of its own, and a tenth generic
semantic is still refused.

**What it fixed and what it did not.** drive49 (same route, same build plus the
linkage) reaches the land picker with `errors=0/0`, `failed 0` and 513 presents
where drive48 had every present throwing. But the *picture* is unchanged —
`png-diff` puts drive48's and drive49's land-picker frames 0.27% apart, in one
32x31 box — because the preview pane was already rendering. The refused draw
was breaking the queue, not the preview.

So blocker #10 is fixed and it is not what stands between the picker and
gameplay. That is still the input stall above: measured again on drive49, the
poll entry `0x9b0880` and all four of its call sites count **zero** over 45s
while `0xa4da46` counts 144 DrawPrimitive returns, the game's cursor sits at
`399,569` and `bw-aim.sh` cannot move it by a pixel in six tries.

### …and then the land renders (drive49, 36 minutes after the click)

The stall ends by itself. Measured end to end on drive49: the land click at
`13:02`, then 36 minutes in which the poll entry `0x9b0880` and all four of its
call sites count **zero** while the picker's static preview keeps presenting —
and at `13:32` the game's cursor resets to `-1,-1` and the screen becomes the
island: full 3D terrain, water, sky and letterbox bars, i.e. the in-game
cinematic flyover (`scratchpad/d49-c.png`, `d49-land3.png`). Input is still not
polled during the flyover, which is what a cutscene is entitled to do.

So the 36 minutes are *load*, and the shape of it is measured rather than
guessed. The hot-block histogram over one minute of the stall:

```
blocks=2532432 distinct=2218 | exe 73.5%, d3dx9_25 20.7%, msvcrt 5.8%
top: exe+0x9b3458 2.9%, +0x9b3456 2.7%, +0x9b348a 2.7%, +0x9b3493 2.7%,
     +0x9b348f 2.6%, exe+0xadeda9 1.9%, msvcrt+0x4107e7 1.5%,
     d3dx9_25+0x50e3f7/0x50e41f/0x50e465 1.5% each
```

`0x9b3402` is a **linear name → id lookup**: it walks 16-byte records at
`[ebp + idx*16]`, compares the name with an inlined `strcmp`
(`0x9b3456..0x9b3476`), returns the 16-bit index, and on a miss calls
`0x9b2c10` to add one. Five of its blocks are 13.7% of every block entry in the
process, so the table is large and the scan is O(n) per name — the game's own
design, and nothing an emulator can shorten. At ~8M ops/s against a period
Pentium's ~100M, a one-to-three-minute load becomes half an hour.

Two practical consequences: **a B&W2 land run needs an hour-scale wall budget**
(the probe's `--seconds` is a hard deadline — drive49 died at 40 minutes with
the flyover barely started), and *no screen change for tens of minutes is not
evidence of a hang here* — the VA record count climbing (387 → 510 over 14
minutes) is the progress signal to read instead.

### Blocker #11: a FLOAT2 NORMAL, and why one refusal ends a whole run

drive50 went the whole way: the land loaded, the cinematic flew down to the
village, and input came back — `bw-aim.sh` put the game's own cursor on
`400,300` exactly, the first time B&W2 has been aimable in-game. Then the
picture froze with the camera parked, and the frozen picture was not a freeze:

```
t=5079s  QueueError: D3D9 software: invalid NORMAL/specular input
t=5302s  QueueError: render worker exited   → 50,253 commands failed after it
```

The refused draw (`scratchpad/bw49fail.0.json`) is small and ordinary — a
68-primitive strip, stride 32, `vs_1_1`:

```
v0 POSITION0 FLOAT3 @0   v1 NORMAL0 FLOAT2 @12   v2 TEXCOORD0 SHORT2 @20
v3 COLOR0 D3DCOLOR @24   v4 TEXCOORD1 SHORT2 @28
```

A **FLOAT2 normal**. Under fixed function that is meaningless — a normal is
lit, so its type has to make sense as one — but a vertex program just reads
four floats out of the lane and decides for itself. So the type rule now
applies only when the draw is fixed function, pinned by the village case in
`test/test-d3d9-generic-vertex-semantics.js`.

**Why a single refusal is fatal, and it is by design.** 5b9b0d43 stopped the
worker-side escalation (a throw escaping the worker's message handler used to
shut the thread down). The host-side one is still there and is deliberate:
`_retireFailedWorker` in `lib/d3d9-host.js` — *"a poisoned stream cannot be
reset behind the worker's live device. Retire the shared worker instead,
explicitly losing every device"* — runs on the next device release once
`queue.error` is set, cancels the consumer and terminates the worker. After
that every command answers `render worker stopped`, on every device, for the
rest of the process, and no error text is ever printed because the shutdown is
a clean one.

The consequence for this app is worth stating plainly: **any single validator
gap ends rendering for the whole run**, tens of minutes of load included. When
a B&W2 drive shows a frozen picture, read `ctx.bwErrors.order[0]` before
believing anything about the guest.

## The flyover is latency-bound: ~150 ms of wall per draw, ~16 ms of work

drive51 (both linkage fixes in) reached the land at **pick+1567s** — 26 minutes
after the land click — with `errors=0/0`, `failed 0` and no refused draw at any
point in the load. That is the first drive where nothing in the vertex-linkage
validator refused anything, so the numbers below are what the renderer costs
when it is *working*, not what a poisoned queue looks like.

What follows the land is the cinematic flyover, and it advances about **one
frame per minute or worse**. **Nobody is busy while it does.** Timing every
DRAW from submit to completion (a wrapper installed live on
`ctx.d3d9Bridge._submit`) over 90 seconds of flyover:

| measurement | value |
|---|---|
| DRAW commands completed | 536 in 90s (~6/s) |
| gap between consecutive submits | ~130-160 ms |
| submit → complete latency | 300-700 ms (median ~400) |
| guest (main) thread CPU | 5.5 s per 60 s = 9.2% |
| render-worker thread CPU | 0.44 s per 60 s = 0.7% |
| CPU actually spent per draw | ~15 ms main + ~1.2 ms worker |
| wall clock spent per draw | ~150 ms |
| guest basic blocks retired | 13,964 in 90s (155/s, 727 distinct) |
| top hot blocks | all in `d3dx9_25` (base `0x2528000`, size `0x253000`) around `+0x10e2xx` |

So **about 90% of the wall clock is nobody running at all**, and the software
path is round-trip-latency-bound, not rasterization-bound: the rasterizer costs
about a millisecond per draw and the draw still takes a hundred and fifty.

The mechanism is `$d3d_render_park` in `src/09ad-handlers-d3d9.wat:2491` — a
submitted render command sets `yield_reason = 16`, and `run.js`'s
`mainExecutionSuspended` (line 5209) parks the whole guest on
`ctx.waitD3DRender(token)` until the worker answers. The worker is real:
`createD3DRenderWorker` at `test/run.js:2097` spawns `lib/d3d-render-worker.js`
on a `worker_thread`, and `ps -M` on the emulator process shows it as a second
hot thread. But the guest cannot run ahead of it, so off-thread buys no
parallelism here — every draw is a thread hand-off, and on a box at loadavg
30-50 (several other agents' runs) the hand-off costs far more than the work it
carries.

**A correction to the first version of this section**, which read the CPU split
off the wrong process. `black-white-software-probe.js` only talks to the
emulator over stdio, so its 0.0% is by design, and the 20.9% belonged to the
whole `run.js` child — guest thread and render worker together — not to a
busy rasterizer with an idle guest beside it. Read `ps -M <run.js pid>`, never
the probe wrapper.

Quote draws per second, not frames per second, when sizing a drive: at ~6/s and
a few hundred draws to a frame, a flyover frame costs about a minute.

Two smaller facts from the same run, both worth not re-deriving:

* **ESC does not skip the flyover.** `handleKeyDown(27)` held for 150 batches
  changes nothing but the next lighting step.
* **The input poll stays at zero for the whole flyover.** Counter slot 0 on
  the poll entry `0x9b0880` reads 0 from the land click through the cinematic;
  the first nonzero sample is the moment the game hands control back, which is
  a cheaper "is it playable yet" test than looking at the picture.

Also measured, and open: of 241 shaders made this run, **131 were refused** —
`vs20=45` and `ps20=69`, which is blocker #7 (no vs_2_0 gate, no ps_2_0 front
end), plus `vs11=2,err6@1459`. Those refusals do not poison the queue the way
a refused *draw* does, so the land still renders; what they cost the picture
has not been measured.

### Is there a GPU path to compare against?

Yes, and it is the *default* everywhere except this harness. `lib/d3d9-host.js`
takes `backend: 'software' | 'webgl'` and defaults to `webgl`; the software
rasterizer is the opt-in. What blocks the comparison from the CLI is one line:

```
test/run.js:122  CLI --d3d9-renderer currently supports software only;
                 WebGL requires a browser/provider
```

`lib/headless-gl.js` (`--headless-gl`) does give Node a real GL context — a
hidden GLFW window on `@node-3d/webgl`, native `Apple M1`, not ANGLE — but it
is wired to the *OpenGL* frontend (`wglCreateContext`), not to the D3D9 host's
webgl backend. So the two ways to measure the GPU path today are:

1. **The browser.** `black_white_2_demo` is already registered in `lib/apps.js`
   with `d3d9Programmable: true` and `bigMemory: true`, and the browser host
   passes no `d3d9Backend`, so it takes the webgl path. `tools/profile-web-frames.js
   --app=black_white_2_demo --headful` is the existing driver.
2. **Wire `headless-gl` into the D3D9 host** so `--d3d9-renderer=webgl` works
   from the CLI, which would put the GPU path under every tracing flag the CLI
   has. That is a real change in `test/run.js` + `lib/d3d9-host.js`, not a flag.

Worth doing: the measurement above says the software path loses ~90% of its
wall clock to the per-draw hand-off, and a GPU backend changes both halves of
that — the rasterization disappears and the command stream can pipeline.

## Pipelining the command stream: +41% draws/s, and the byte budget that bit back (drive52, 2026-09-14)

The measurement above said the software path loses ~90% of its wall clock to
the per-draw hand-off, so the fix is not a faster rasterizer. `lib/d3d9-host.js`
now defers DRAW and CLEAR on an async device: submit, return `D3D_OK`, do not
park. The commands whose value the guest actually reads — readback, present,
query, release, reset — still fence. This is the shape D3D9 itself has, which is
why it is safe: the runtime validates parameters synchronously and returns
`D3DERR_INVALIDCALL` from the call, then lets the driver consume the command
asynchronously; a fault only the hardware can see surfaces at the next
synchronization point as device-lost, never as a per-draw result. Parking bought
nothing else, because `_result`'s default finalize returns 1 regardless.

Measured on the same drive, same script, same arithmetic
(`scratchpad/draw-rate.js` reads the probe's own 5-second counter samples):

| | fence per draw (drive51) | pipelined (drive52) |
|---|---|---|
| draws | 42400, 0 failed | 29850, 0 failed (still running) |
| draws/s p50 | 1.99 | **2.80** |
| draws/s p90 | 12.20 | **15.92** |
| draws/s max | 38.57 | 42.77 |
| in flight | 1 | max 33, p50 2 |

Read the *in flight* row before the rates. drive51's 1 is a sampling artifact —
`submitted` is bumped just before `completed`, so a 1 appears even under the old
per-command fence — while drive52 genuinely runs up to 33 commands ahead of the
worker. That is the thing the old path made structurally impossible, and the
rate follows from it.

### The cap has to be in BYTES, and that cost a run

The first attempt capped only the command count (32 in flight) and died 15
minutes in: 457 failed draws, `render payload exceeds available byte budget`,
then `render worker stopped`, at pick+930s.

`lib/d3d-command-stream.js:340` charges every payload against what is still
*free* — `capacityBytes - bytes`, where `bytes` only drops when a command
retires. Under the old fence each draw therefore met an **empty** queue and
could use the whole 64 MB. Deferred commands hold their copied payloads all at
once instead, and this game's land draws carry 2048x1024 texture payloads of
about 8 MB each (the probe's own category census names them:
`5/2/false/false/2048x1024:1`), so eight in flight exhaust the capacity. The
refusal is *fatal* rather than slow, because the queue's error is sticky: one
refused draw ends rendering for the rest of the run. Same sticky-error shape as
the unbound-sampler refusal in blocker #9 — worth remembering as a class.

Bounded two ways now, because the payload size is not known until it is copied:
stop deferring past a quarter of the capacity, so a payload that fit before
still finds three quarters free; and treat a `FULL` from a deferred submit as
backpressure rather than failure — park the guest until the in-flight set has
drained, which restores exactly the empty queue the fencing path always
submitted into, then submit. A payload too large for an *empty* queue still
fails, as it always did. Pinned by test-d3d9-async-protocol.

### What this does not fix

The land renders and the flyover is faster, but this is still the cinematic.
The input poll has not gone nonzero on any drive yet and ESC does not skip the
cinematic, so interactive gameplay remains the open blocker — and it is not on
the render path at all.

## Interactive gameplay reached, and the cost of the picture (drive52, 2026-09-14)

**The previous section's closing paragraph is wrong and is superseded.** It
said interactive gameplay was the open blocker and that the run was stuck in a
cinematic. It was not: the same drive52, left to run, is in the tutorial land
with the village, the villagers, both advisors animating, and a camera that
answers the arrow keys. Two inputs, each held ~2500 batches, measured against
an idle control:

| step | frames differ |
|---|---|
| idle, 25s apart, no input | **0 of 307200 pixels** (byte-identical) |
| `key 38` (up) | 41531 px, 13.5%, box 0,7 640x413 |
| `key 39` (right) | 44154 px, 14.4%, box 0,8 640x412 |

The idle control is what makes those two numbers mean something: the scene does
not animate between frames on its own at this cadence, so a whole-viewport
change after a key is the camera, not the clock. The second shot shows the
terrain panned and the villagers moved across the frame. Input was never
broken — the earlier "input is not consumed" reading came from sampling while
the land was still loading.

The `intro` object the probe watches is also not the cinematic: it reports
`frame 3, target 636, finishFrame 1`, i.e. already finished by its own exit
test. Do not read a stalled `frame` there as a stalled game.

### What is actually slow: one frame in ~30s, and 97.8% of it was redundant

Presents, not draws, are the frame clock here — draws ran at p50 12.97/s in the
gameplay window while presents moved twice in 63s. The scene costs ~550 draws
per present.

Measured on the live process, not estimated (a timing wrapper around
`ctx.d3d9Bridge.call` and the device's `queue.submit`, over 56.1s of wall
clock):

| | |
|---|---|
| `bridge.call`, 679 draws | 16.49s (29% of wall clock), 23ms per draw |
| of which `CommandQueue.submit`, `copyPayload` included | **0.78s** |
| descriptor **build** | **15.72s — 28% of all wall clock** |

So the payload copy was never the problem. Building the descriptor was, and
inside it the texture snapshot: `lib/d3d9-host.js` decoded every bound mip
level from guest bytes on **every draw**, a fresh `Uint8Array(w*h*4)` and a
per-texel conversion loop each time. A census of the same scene over 62s:

| | |
|---|---|
| draws | 1226 |
| mip levels bound | 10128 |
| **distinct** mip levels | **598** |
| repeat bindings | 94.1% |
| texels re-converted | 1.01 billion |
| texels genuinely new | 22.4 million |
| **redundant conversion work** | **97.8%** |
| decoded working set | 81.4 MB RGBA, largest level 4 MB |

Fixed in 39fd25cc by caching the converted level per mip record, keyed by its
address and validated by the dirty sequence at mip+28. That invariant already
existed and needed no new code: guest code reaches texels only through
LockRect, the draw path refuses a level that is still locked, and
`$handle_IDirect3DTexture9_UnlockRect` (`09ad-handlers-d3d9.wat:2089`) bumps
+28. A mip address can be reused by a new texture whose sequence restarts, so a
hit also re-checks a sparse sample of the source bytes — a backstop against
reuse, not a change detector. 192 MB LRU budget, chosen from the 81.4 MB
working set above.

### What this does not fix

The remaining frame cost is the software rasterizer and the interpreter, not
the bridge: at the time of measurement the render worker held 36 minutes of CPU
against the main thread's ~49. Removing the decode returns roughly a quarter of
the wall clock to the guest; it does not make ~550 draws per frame cheap.

## What the software rasterizer actually spends a pixel on (drive52, 2026-09-14)

The previous section named the rasterizer as an open cost without saying what
in it was expensive. `tools/bench-raster.js` (86398f10) now prices one pixel by
drawing a single covering quad and changing one thing per arm. Its `sliver` arm
is the load-bearing one: two hair-thin diagonal triangles with the *same*
full-screen bounding box, so the 2x2 tile walk and all its per-quad setup run in
full while ~0.2% of pixels pass the coverage test, meaning the shader VM and the
framebuffer write almost never execute.

**The sampler is the smaller half.** At 640x480, `sliver` came in at 80-87% of
the untextured covering quad across several runs. A pixel that is never shaded
and never written already costs most of a shaded one. Texturing adds a further
35-46% on top (point/bilinear/trilinear), and the ns/px is flat across a 16x
range in area (160x120 / 320x240 / 640x480), so the cost is genuinely per-pixel
and not per-draw setup.

The block responsible is in `src/09ah-d3d-software.wat`'s `$d3d_software_step`,
and everything in it runs for all four lanes *before* the coverage test — the
`block $outside` sits after it, because outside lanes are derivative helpers and
their varyings are real inputs to mip selection.

Two things were fixed there and are measured, tested and committed:

* **24042888** — every varying is perspective-corrected by the same interpolated
  1/W, and the setup did that 33 times per lane with an `f32.div`. One
  reciprocal and 33 multiplies instead.
* **eaa44c1a** — the varying loop is a fixed 28 iterations and the specular loop
  a fixed 4, regardless of what the shader reads, because no input mask exists
  on a compiled program. Bounded by the data instead: a varying that is +0 at
  all three vertices interpolates to zero everywhere in the triangle, so it is
  scanned once per quad and stored as a literal zero.

**The useful result is that those barely moved the floor (~2.5%).** With 33
divides and roughly 20 of 32 interpolations per lane removed and the number
almost unchanged, the per-quad arithmetic is *not* what the setup spends its
time on.

**The leading remaining suspect is the `memory.fill` of 8192 bytes of temp
register bank per 2x2 quad** — 128 registers x 64 bytes, zeroed whether a
ps_1_1 shader uses r0 alone or not. That is 2KB per pixel, ~630MB of zeroing per
640x480 draw. Substituting 1024 for 8192 and alternating the two builds with the
order rotated over four pairs: the small fill won 3 of 4 pairs, medians
337.3 -> 243.2 ns/px on `sliver` (-28%) and 397.8 -> 321.5 on `flat` (-19%).
Read that as a strong lead, not a settled number: pair 1 went the other way, the
box sat at load 7-8 with several agents on it, and an earlier non-rotated sweep
of the same thing produced a much larger apparent win that was mostly falling
load. **A clean reading needs a quiet machine.**

The fix is not the fill itself but knowing how many temps to zero, and that has
no home yet: the compiled program header (`0x4453564d`) records no max-temp, and
the software context has no free slot to cache one in — 224-236 are blend state,
240-247 the sample counter, 248/252 stencil and flags, and 288 is where the
vertex array starts. Adding one means moving that boundary, which touches
`d3d_software_create`, the JS backend's context sizing and the vertex-array base
arithmetic. That is the next piece of work, and it is an ABI change, not a
tweak.

### Correction: the section above ranks the costs against a one-instruction shader

The paragraph naming the 8KB per-quad `memory.fill` as "the leading remaining
suspect" is true only for a trivial shader, because `flat` was `mov r0,v0` --
one instruction. A `flat8` arm (the same quad with eight arithmetic
instructions, ps_1_1's legal maximum) separates the VM's per-instruction cost
from its per-packet entry cost. Three runs at 640x480:

| | ns/px |
|---|---|
| setup only (`sliver`) | 288.7 / 300.3 / 317.4 |
| + VM entry + 1 instruction (`flat`) | 356.3 / 376.8 / 392.1 |
| + 8 instructions (`flat8`) | 588.9 / 670.3 / 717.2 |

That is **~42 ns/px per shader instruction** (33.2 / 41.9 / 46.4) and ~30 ns/px
of VM entry. Per 2x2 packet, one instruction costs about 170ns to execute at
most four `f32x4` ops -- roughly 40x the arithmetic it performs. Extrapolating
at those rates the VM is 19% of a one-instruction pixel, 55% at eight and ~74%
at twenty, so for any shader B&W2 actually ships the interpreter dominates and
the per-pixel fixed costs matter less the longer the shader gets.

**This changes the work ordering.** The `$d3d_shader_vm_run` loop pays, per
instruction: an `i32.atomic.load` cancellation check, a budget check, a 64-byte
packet load, flag validation, a co-issue partner probe and a linear `if`-chain
over ~70 opcodes rather than a `br_table` -- all of it per 2x2 packet. Batching
the shader so the outer loop is over INSTRUCTIONS and the inner loop over a tile
of many pixels pays that once per batch instead of once per four pixels. The
packet stays 2x2-composed so `$d3d_shader_vm_quad_lod`'s finite differences
still work; it is the batch that widens, not the quad.

The blocker is the same one the fill has: batch width is bounded by the live
register set (128 registers x 4 components x N lanes x 4 bytes must stay in
cache, which is 512KB at N=256), so both changes need a per-program max-temp
count, and there is no field for one. That single missing number gates the two
largest wins here.

### The per-quad temp-bank fill, and the number that unblocks batching (5a66a6f5)

Both of the fixes the section above points at want the same missing fact: *how
much of the shader VM's temp register file can this program actually touch?*

The rasterizer clears that file between pixel packets so a register read before
it is written reads zero. It is bank 0 of the VM context — 128 registers of 64
bytes, slots r0..r127 — and the clear was the whole 8192 bytes, once per 2×2
quad. ps_1_1 lets a shader name eight temps; the bench's `flat` shader names
one. So the rasterizer was moving 2048 bytes per pixel to make 16 of them mean
anything.

`$d3d_shader_vm_temp_span` (09ag) walks the compiled program once, when its
context is created, taking the highest temp slot named as a destination *or* as
a source, and stores `(max+1)*64` at `ctx+28` — the one word in the context
header that was documented "reserved" and is below the 288-byte vertex-array
boundary, so nothing had to move. `$d3d_shader_vm_temp_bytes` reads it back and
returns the full 8192 for a null, out-of-range or wrong-magic pointer.

Three things that are less arbitrary than they look:

- **Only the unsafe direction is refused.** Clearing more than the program can
  reach is merely slow. Clearing less hands a packet the *previous* packet's
  register, because the pixel VM (ctx+148) keeps its banks across triangles and
  the fill is the only thing that resets them. So every fallback is the whole
  bank, and the source scan is included even though the IR already refuses a
  temp read before its write (error 17) — belt and braces, one-time cost.
- **DEF (14) and the flow-control family (60..72) are skipped.** Those packets
  repurpose the +4/+8/+16 words for immediates, block indices and branch
  targets; read as slot numbers they would inflate the span to nonsense.
- **The one-register floor is load-bearing.** `$d3d_software_output` reads r0
  out of this bank as the pixel result, so a program that never writes r0 used
  to read the zero the full-bank fill left behind.

For `mov r0, v0` the per-quad fill goes 8192 → 64 bytes, a 128× reduction, 2048
B/px → 16 B/px.

**No timing is quoted for it.** The box sat at load 19 while this was written,
bench reps spread 1.4-4.4×, and two runs of the same arm disagreed by 1.6×
(sliver 685.3 vs 416.1 ns/px). The correction above was caused by exactly this
kind of under-measurement, so the size of the win stays open until a quiet box
is available. What is certain is the byte count, and the byte count is the part
the next change depends on.

That next change is the one the correction argued for: invert
`$d3d_shader_vm_run` so the outer loop walks *instructions* and the inner loop
walks a tile of many pixels, paying the interpreter tax (cancellation check,
budget check, 64-byte packet load, flag validation, co-issue probe, ~70-way
if-chain) once per instruction per batch instead of once per four pixels. Batch
width is bounded by the live register set staying in cache — which is precisely
`temp_bytes × pixels`, so it could not be chosen before this number existed.
The batch must stay 2×2-composed so `$d3d_shader_vm_quad_lod`'s finite
differences still work, and per-lane branching widens the existing execution
mask from one `v128` to N lanes (ps_1_x has no flow control at all, so the
common case needs none of it).

### Reading the interpreter before rewriting it: the tax is not where the packet loop is (78cc3c5d, 524978da)

The plan above was to invert `$d3d_shader_vm_run` — outer loop over
instructions, inner loop over a tile of pixels — so the per-instruction
interpreter work is paid once per batch instead of once per 2×2 quad. Reading
the interpreter first to size that change found that most of the per-instruction
cost is **not** in `$d3d_shader_vm_run` at all, and batching cannot reach it.

`$d3d_shader_vm_run` decodes a packet once per quad: cancellation check, budget
check, 64-byte packet load, flag validation, co-issue probe, and a linear chain
over the opcode ranges. All of that is per *packet*, and batching amortizes it.

But the value of an instruction is produced by `$d3d_shader_vm_component`, and
**that is called once per component — four times per instruction.** Inside it is
a second, longer linear chain, ~20 compound tests deep, and it is re-walked on
every one of those four calls. Batching does not amortize any of it: it is
per-quad work no matter how the outer loop is shaped.

Three separate multipliers were sitting in there.

**The plain-ALU set walked the whole chain.** MOV/ADD/SUB/MAD/MUL/MIN/MAX match
nothing above the tail, so the most common ops in a shader were the ones that
paid the most to be found — ~80 compound tests per instruction. `78cc3c5d`
answers the set before the chain, four tests per instruction instead.

**Operands were gathered by arity-blind strict evaluation.** Wasm evaluates call
arguments strictly, so the tail's three-source call to `$d3d_shader_vm_alu`
gathered three registers whatever the op read: a MOV performed two register
gathers and discarded both, every binary op one. Per instruction that is 12
gathers where 4, 8 or 12 were wanted. `78cc3c5d` fetches lazily.

**Unwritten components were computed anyway.** `$d3d_shader_vm_run` snapshotted
all four components and handed them to `$d3d_shader_vm_commit`, which then
dropped the ones the destination write mask did not name. A co-issued pair is
the worst case — the alpha packet names one component and computed four, so
three quarters of its work was dead. `524978da` follows the mask, except for the
four ops (36, 38, 47, 54) that publish x outside the commit.

Neither commit is measured. The box has been at load 17-20 all evening, an
interleaved order-rotated A/B could not separate two builds, and one of four
runs was internally incoherent (base `flat8` came in *under* base `flat`). The
counts above are the certain part and none of them needs a quiet machine.

**And the same shape is still there, larger, in the sampler.** Because
`component` runs per component, `$d3d_shader_vm_sample` is invoked per
component — and it takes `comp` all the way down to `$d3d_shader_vm_texel`. So
one full-mask bilinear `texld` on one quad does 4 components × 4 lanes × 4 taps
= **64 `$d3d_shader_vm_texel` calls**, each redoing the wrap/clamp address
arithmetic for x and y, to read 16 texels. Three quarters of the addressing, the
coordinate wrap and the mip level selection is repeated per channel, and the
four channels of a texel are four separate byte loads of one dword.

Fixing that means producing all four components of a sample once, which means
`component` can no longer be the per-component function for sampling ops. That
is the next piece, and it is a prerequisite for batching in the same way the
temp span was: until an instruction costs one pass instead of four, widening the
outer loop amortizes the smaller half of the tax.

### Measured at last: the profile and the three-build A/B (2026-09-14, load 3.3-4.7)

The box finally went quiet, so the numbers the sections above refused to quote
exist now. Two measurements, both with `tools/bench-raster.js` at 640×480.

**Where a pixel's time goes** — V8 `--cpu-prof` with `--no-wasm-inlining` so
callees are charged instead of being folded into `$d3d_software_step`, names
resolved through `tools/func-index.js` against a fresh `combined.wat`. Self
time, share of all wasm samples, one arm per profile, 8 reps each:

| function | `flat8` (8 ALU instr) | `bilinear` (1 texld) |
|---|---:|---:|
| `$d3d_software_step` (per-quad setup, varying loops inline) | **38.7%** | **31.6%** |
| `$d3d_shader_vm_source_row` (operand gather) | 14.5% | — |
| `$d3d_shader_vm_run` (packet decode + dispatch) | 12.5% | 2.2% |
| `$d3d_software_interp` | 4.5% | 3.8% |
| `$d3d_shader_vm_component` | 4.4% | 2.7% |
| `$d3d_shader_vm_alu_fast` + `_alu` | 5.5% | — |
| `$d3d_shader_vm_write` + `_commit` | 5.6% | — |
| `$d3d_shader_vm_texel` | — | **17.5%** |
| `$d3d_shader_vm_address` (wrap/clamp per texel) | — | 7.4% |
| `$d3d_shader_vm_sample` / `_sample_level` / `_sample_face_lod` | — | 18.0% |
| edge / inside / channel / output / fragment_pass | 7.5% | 5.0% |

Grouped: on `flat8` the rasterizer is ~51% and the VM ~47%; on `bilinear` the
rasterizer is ~40%, the **sampler family ~46%**, and the VM proper ~6%. The
sampler's 46% is for *one* instruction, and `$d3d_shader_vm_texel` alone is
17.5% — that is the 64-calls-per-quad shape from the previous section showing
up as time. No-inlining inflates the leaf call overhead (`source_row`, `texel`)
somewhat relative to the shipped build, so read the groups, not the decimals.

**What the three commits bought** — three builds, one bench each, order rotated
every round, median of three rounds. `prefill` is `5a66a6f5^`, `fill` adds the
temp-span fill (5a66a6f5), `all` adds the ALU fast path and mask gating
(78cc3c5d, 524978da). ns/px:

| build | sliver | flat | flat8 | bilinear | ns per ALU instr (`(flat8−flat)/7`) |
|---|---:|---:|---:|---:|---:|
| prefill | 150.4 | 193.1 | 335.1 | 359.6 | 20.3 |
| fill | 108.8 | 151.8 | 296.3 | 318.0 | 20.6 |
| all | 114.0 | 142.6 | 263.8 | 328.6 | **17.3** |

The fill: **−28% on sliver, −21% on flat, −12% on flat8 and bilinear.** It ran
before the coverage test, per quad in the bounding box, so it was charged to
pixels that were never shaded — which is why the setup-only `sliver` arm moves
the most. The earlier "spurious −30%" was in fact about right; it was the
rotation I trusted and the box that was wrong.

The VM commits: **−16% per ALU instruction** (20.6 → 17.3 ns), −6% on `flat`,
−11% on `flat8`; `sliver` and `bilinear` do not touch the changed code and
their ±3-5% is the noise floor — an identical build run nine times across 90 s
drifted +12% end to end from thermal ramp, so nothing under ~10% is visible
here even at load 3.5 without interleaving.

Absolute scale for the record: at load 17-20 earlier tonight `flat` measured
431-887 ns/px; at load 3.5 it is 143. The loaded box was 3-6× slower and its
run-to-run spread was wider than every effect being measured.

**What this says about the next step.** Per-quad setup in `$d3d_software_step`
is the largest single item on *both* arms and it is the part that scales with
bounding-box area rather than coverage — so the quad early-out (test the three
edge functions first; skip the interpolation entirely for an all-outside quad)
is now the top item by evidence, not just by structure. On textured pixels the
four-components-at-once sampler is second and worth about as much as the VM
work was on ALU pixels. The interpreter tax in `$d3d_shader_vm_run` proper is
12.5% of an 8-instruction pixel: real, but third.

## Remote-controlled stage-by-stage run: WebGL vs software (2026-09-15)

Everything below was measured on a real, visible Chrome driven over the
dev-server hub, so one run yields the intro, the menus and the loads in order
instead of one guessed window per run. The recipe:

```
# serve a CLEAN tree: main's wasm and lib/region-map.generated.js disagreed
# ("region layout MISMATCH") while another agent was mid-change
node tools/dev-server.js --port=8130 --isolate      # --isolate is REQUIRED for the software renderer
open -na "Google Chrome" --args --remote-debugging-port=9333 --user-data-dir=$S/chrome-rc \
  --disable-backgrounding-occluded-windows --disable-renderer-backgrounding \
  --disable-background-timer-throttling 'http://127.0.0.1:8130/?debug&perf[&d3d9-renderer=software]'
node tools/ctl.js --hub=http://127.0.0.1:8130 -s <URL> launch black_white_2_demo
node tools/ctl.js ... cmd relmousemove:-2000:-2000; cmd relmousemove:313:343; cmd relmousemove:-15:-15
node tools/ctl.js ... cmd di-mousedown; sleep 2; cmd di-mouseup          # profile dialog OK
#   New Game (197,555) -> Continue (400,575) -> double-click the green land (165,478)
node tools/cdp-cpu-profile.js --seconds=15 --out=stage.cpuprofile [--worker=d3d-render-worker]
```

Three things the recipe depends on, each found the hard way:

- **macOS Chrome reports an occluded window as `hidden`**, and host.js pauses the
  guest on that. Without the three `--disable-*` flags every profile of a tab
  behind the terminal came back at 1 guest fps and 80% idle. `curl
  http://127.0.0.1:9333/json/activate/<id>` brings a tab forward.
- **The software renderer's worker needs `crossOriginIsolated`.** Served without
  `--isolate` it logs `SharedArrayBuffer transfer requires self.crossOriginIsolated`
  on every frame and presents nothing; the guest runs at 0 fps with a blank canvas.
- **The intro can be finished from the page.** `set_bp(0x00526d93)` (the
  `add dword [esi+0x20],1` the CLI probe traces) plus a plain copy of the
  exports whose `get_last_run_halt` captures ESI on halt 5, then write
  `finishFrame = frame-1` at `+36`, clear the bp, restore the instance. A
  `Proxy` over the exports is not an option: `get_yield_reason` is a
  non-configurable property and the proxy invariant check kills the run loop.
  It only finishes the Lionhead particle object; the Intel/ATI screens are
  other classes and play out on their own.

### Per-stage numbers (headful, tree at 20e5dd44, load average 10-20, so ±30%)

| stage | WebGL guest fps | software guest fps | pixels differing (tol 8) |
|---|---:|---:|---|
| Lionhead intro | 4-12 | 1-2 (first present at +55 s) | not compared (animated) |
| pre/post-intro loads | 0 (x87-bound, ~60 s) | 0 (same profile: `$next` 19%, `$fpu_exec_mem`, `$th_fpu_mem_ro`) | — |
| profile dialog | 13-16 | 0.5-0.7 | 2.7% (OK-button glow frame + cursor only) |
| main menu | 13-16 | ~1.2 | 1.0% |
| controls screen | ~14 | 0.6 | 0.5% |
| land picker | ~14 | 0.7-1.7 | 0.2% |
| in-game scene | 0-0.8, wrong picture | not reached | — |

**Rendering matches on every 2D screen.** The remaining differences are the
animated OK-button glow, the cursor sprite and a few thumbnail highlight
pixels. The picture that does NOT match is the in-game scene on WebGL: trees on
a flat blue plane and no terrain, with ~1400 rejected draws per 6 s
(`unsupported vertex declaration element` 1026, `programmed fog specular alpha
linkage requires conformance` 271, `D3D9 FVF # is not implemented` 65,
`invalid texture resource` 25, `incomplete mip chain` 5 — from `console.error`,
not the log panel). So "runs on GL" is true up to the land picker; gameplay on GL
is blocked on vertex-declaration element types (only FLOAT1-4/D3DCOLOR with
4-aligned offsets are accepted, `lib/d3d9-backend.js:392-400`) before its
speed means anything.

### Where the time goes

WebGL, menu (13-16 fps): 22% idle; host side is `d3d-command-stream.js`
`copy()` 16% (it deep-copies and freezes every payload with a
`defineProperty` per key), `readPixels` 9% (every PRESENT does a full
`readColor(null)` readback plus BGRA swizzle, `d3d9-host.js:261`), `texImage2D`
4-5%. WebGL, scene: host 61% — `copy` 21%, d3d9-host `call` 10%, texture
`decode` 4%, and `onError`/`invalid`/`getError`/`compileIR` ~2% each because
`invalid()` throws an `Error` per rejected draw. One 54 s main-thread stall in
`AudioContext.resume()` (host.js primeAudio ← browser-input.js
unlockRunningAudio ← handleKeyDown) during the post-intro load.

Software, profile dialog (0.5 fps), render worker profiled over raw CDP
(`--worker=d3d-render-worker`; dedicated workers are not puppeteer targets, the
tool attaches with `Target.attachToTarget flatten:true` on the browser socket):

```
worker: idle 48.6%  $d3d_software_step 14.3%  $d3d_shader_vm_component 10.7%
        $d3d_shader_vm_sample_face_lod 7.5%  $d3d_shader_vm_run 6.2%  $d3d_shader_vm_texel 5.8%
        software-backend copy 2.1%  command-stream copy 1.1%
main:   idle 74.2%  (program) 4.1%  $next 2.4%  $branch_end 1.4%  _profileNow 1.4%
```

**Neither thread is busy.** The main thread is three-quarters idle and the
raster worker half idle, yet the guest advances at half a frame per second:
the two are ping-ponging — the guest submits a frame, parks (`phaseMs.workers`
~370-400 ms/s is the awaited rendezvous), the worker rasterizes ~1 s of shader
VM per 800x600 frame, and the guest only submits the next one after that. The
raster cost itself is the known list (quad early-out, four-component sampler,
packet-class precompile), but the idle halves say a pipelined submit (let the
guest run while the previous frame rasterizes) is worth up to 2× before any of
that.

### Open: the land picker's double-click at ~1 fps

On WebGL a fast `di-mousedown/up` pair twice at (165,478) starts the scene
load. On software none of these did: 1 s-spaced pairs, 3 s-spaced pairs, an
80 ms page-side double-click (this one triggered a 90 s load burst and then the
picker came back), a frame-paced 1.3 s pair, Enter. `WinePerf.input.ageMs.p99`
was 41 s — buffered DI events wait many frames to be drained, and
`GetDeviceData` stamps `dwTimeStamp` with `host_get_ticks` at DRAIN time
(`src/09a8-handlers-directx.wat` ~8312/8407), so every event drained in one
frame carries one timestamp. Whichever way the game measures a double-click
(timestamp delta or frame count), at 1.2 s/frame it does not see one. Stamp
the events when they are queued, then retry.

Artifacts: `$S/rc/gl4/` and `$S/rc/sw2/` (stage PNGs, `*-vs-gl.png` diffs,
`*.cpuprofile`, `perf.ndjson`) in this session's scratchpad.

### Texture residency: pixels cross to the executor once (2026-09-15)

Every draw used to carry the full decoded RGBA of every bound mip level, and
each hop copied it again: `copyPayload` in `lib/d3d-command-stream.js`, the
structured clone into the render worker, `Device.copy` into wasm memory (freed
with the draw), and on WebGL a `texImage2D` per level per draw. The land
picker held 8.4 MB of texture bytes in the queue for 51 commands/10 s and the
in-game scene 18 MB for 22 commands/s; the same bytes, the same textures,
every frame.

Now `_rememberTexture` in `lib/d3d9-host.js` gives each decoded level a serial
(`key:'t<n>'`), and a device entry tracks which keys it has already sent
(`entry.resident`, LRU by insertion order, `maxResidentTextureBytes` 32 MB by
default — half the worker Device's 64 MB budget). A level goes out as
`{width,height,key,pixels}` the first time and `{width,height,key}` after that;
keys the draw does not use are evicted oldest-first when the set is over budget
and ride on the same DRAW as `textureReleases`, which both executors apply
before binding anything. Residency commits only after `_issue` accepts the
draw, and reset clears it on all three sides. Levels too large for the host
snapshot cache keep the old pixel-per-draw form.

- `lib/d3d9-software-backend.js`: `residentTextures` (key → wasm block, plus a
  `:bgra` twin for render-target-sampling draws) outside `draw.owned`; a key
  without pixels that is not resident is `invalid('texture not resident')`.
- `lib/d3d9-backend.js` (WebGL): `residentPixels` (key → bytes) plus
  `keyedTextures` (composite key of target + every level key → GL texture).
  The pixels are kept, not just the texture, because the same keys come back
  in other compositions — `SetLOD` drops the top levels, a mip-atlas stage
  lays them out differently — and the first cut, which cached only composed
  textures, failed `test-d3d9-pipeline-web.js` three ways with "texture not
  resident". Keyed textures are shared across stages; a stage's own scratch
  texture is never a keyed one (`stageTexture`).
- `test/test-d3d9-texture-residency.js`: software Device keyed bind, hit,
  redundant pixels, unknown key, releases, reset, destroy; host bridge keyed
  payloads and a zero-budget release sequence.

Measured on the same hub run (software renderer, load 9-18, so fps is ±30%):

| stage | queue bytes held | commands | guest fps | worker copy time |
|---|---:|---:|---:|---:|
| profile dialog | 180-330 KB (13-23 inflight) | — | 0.65 (was 0.5-0.7) | — |
| main menu | 185 KB | 14/s | 0.72-0.77 (was ~1.2 at load 10-43) | — |
| land picker | 27 KB (was 8.4 MB) | 3.2/s (was 5.1/s) | 0.6-1.1 (was 0.7-1.7) | 0.1% (was ~3%) |
| in-game scene, old libs | 18 MB | 22/s | 0 | — |

Resident set: 40-63 keys, 10-31 MB; the profile dialog sits at the 32 MB cap
with the host snapshot cache at 44 MB, but bytes in flight stay in the
hundreds of KB, so it is not thrashing. Pictures match at every stage (dialog,
menu, controls, land picker, `$S/rc/sw3/`). The fps did not move, which is
what the profile said it would do: on these 2D screens the copies were ~3% of
the worker and the worker is 50% idle waiting on the guest (the ping-pong
above). The bytes and the copy time are gone; the scene, where 18 MB/frame was
moving, is where it should show, and this run did not get past the land
picker's double-click (still open).

WebGL, same hub, profile dialog, 15 s page profile: guest fps 15.5-18.1 (was
13-16), `copy` 4.9% (was 16%), `texImage2D` no longer in the top 25 at all
(was 4-5%); what is left of the host is the PRESENT readback (`readColor`
7.2% + `readPixels` 4.3%). 55 keys / 31.4 MB resident, no errors.

Failure handling: after any draw failure (`call`'s catch, or a deferred error
reported at the next call) the host forgets its resident set and the next
draw releases those keys and re-sends what it uses, so a lost upload costs one
re-send instead of a key that fails "texture not resident" forever. A worker
that rejects a draw poisons the queue anyway (sticky error); the case this
guards is the FULL-parked `_issue` path whose late `_submit` refuses.

### Present pipelined one frame deep, and the worker posted to in order (2026-09-15)

Two changes to the asynchronous software path in `lib/d3d9-host.js`, both
aimed at the ping-pong the residency profile left behind (worker ~50% idle
waiting for the guest, guest parked waiting for the worker):

1. **The bridge's queue consumer is now `ordered`.** `CommandQueue` executes
   one command at a time unless its consumer says it preserves order; the
   worker proxy (`WorkerConsumer`) does, but the bridge wrapped it in a plain
   `{execute}` and so every deferred draw was posted to the worker only after
   the previous one's completion message had come back -- one main-thread hop
   per command, both threads idle inside it. Posts now go out as they are
   submitted, chained per device (`entry.postChain`) so a Present that waits
   for its display boundary still holds every later post behind it.
2. **Present is pipelined one frame deep** (`_pipelinePresent`). Present N+1
   leaves its own PRESENT in flight and parks the guest on PRESENT N, whose
   pixels land at the address Present N named; the WAT side then presents
   that frame (`$dx_present`, result 0) -- one frame behind, never a
   half-built one. The first Present after creation or a Reset still blocks on
   itself so the first frame is on screen before a load; the one after it has
   nothing older to wait for and returns at once, re-presenting the published
   frame. Reset and Release drop the frame in flight; a frame that fails in
   flight surfaces as -1 at the next call on the device (`deferredError`).
   Cost: a frame drawn once and then not presented again reaches the screen
   only at the next Present. GL entries are synchronous and unchanged.

`test/test-d3d9-present-pipeline.js` covers both with a fake ordered consumer
(first blocks, second returns at once, third parks on the second, per-Present
destinations, reset/release/failure). `test-d3d9-guest-render-worker.js` now
expects the large draw to publish at the *third* Present.

Live, on the hub with load 20-50 (numbers describe the machine): the Lionhead
intro presents at ~0.4/s with the bridge showing `presented:true`,
`pendingPresent:true`, one parked request, 3-8 commands in flight at the
worker (was 1 by construction). The render worker profiled over 15 s is 56%
idle at 1.85M blocks/s -- the guest is the bottleneck on this box, not the
hand-off. The menu/dialog comparison against 0.65-0.77 fps is still to be
taken on a quiet box.

### DirectInput button edges are stamped when queued (2026-09-15)

`dwTimeStamp` used to be `host_get_ticks` at drain time, so every record
drained by one `GetDeviceData` carried the poll's tick (see the open item
above). A ring word for a button edge now carries the wall-clock millisecond
it was queued at in its low 28 bits, type 1..4 in the high nibble
(`lib/renderer-input.js` `_queueDirectInputMouseEvent`); the drain
(`$di_mouse_event_stamp` in `src/09a8-handlers-directx.wat`) stamps the record
with `ticks_now - ((real_time_ms_now - queued) & 0x0FFFFFFF)`, i.e. the guest
tick of the click itself, whatever clock the harness synthesises for
`get_ticks`. Motion words have no room for a stamp and keep the poll tick, as
does a bare 1..4 (the shape tests push directly). `test-directinput-device.js`
checks two presses queued 1.5 s apart and drained in one poll are stamped
1.5 s apart. The land-picker retry with this build is still owed: on the
box at load 20-45 the software renderer's Lionhead intro presented at
0.25-0.4/s (guest at 1.6-2.0M blocks/s), and the intro breakpoint skip
(`$S/rc/skip-all-intros.sh`) reported no hits on software in three runs, so
the menu was not reached within a session's patience. Retry on a quiet box:
`to-menu.sh`, profile OK (313,343), New Game (197,555), Continue (400,575),
then two `di-mousedown`/`di-mouseup` pairs at the land (165,478).

### GL Present no longer reads the frame back (2026-09-15)

The WebGL executor's `PRESENT` used to `gl.readPixels` the whole target,
flip and swizzle it to BGRA, and copy it into the render-target DIB on every
frame -- 7.2% of the main thread as `readColor` (4.3% inside `readPixels`) on
the profile-dialog profile above, at 17-18 fps. Nothing read that copy: every
guest path onto the back buffer already fetches it through a readback of its
own (`LockRect`/`GetDC` via `$d3d9_backbuffer_dc_sync` = `0x30016`,
`GetRenderTargetData` = `0x30012`, `StretchRect`/`ColorFill` through the
colour-surface `0x30010`), and `$handle_IDirect3DDevice9_Present` returns on
the host's 1 before `$dx_present` would touch the DIB. So `_execute`'s
`PRESENT` now returns only the canvas and the `0x30002` finalize writes
`dest` only when the value carries pixels, which the software rasterizer's
still does. Two tests read the DIB straight after a GL Present and were
asking for the copy: `test-d3d9-pipeline-web.js` now reads through a
`sync_target` export (the same `0x30016` a guest would issue, routed to the
bridge), and `test-d3d9-present-web.js` queues a `READBACK` behind each
`PRESENT` and asserts the present value carries no pixels. Verified on the
GL tab: the intro and the profile dialog render as before. The profile of
the dialog with this change is still owed -- the box was at load 30-60 and
the browser went away mid-session.

### Headless GL: the D3D9 caps probe failed on two binding bugs (2026-09-15)

`--headless-gl --d3d9-programmable` reached the game's own startup check and
put up `[MessageBox] "Fatal Error": "... Pixel Shader version 1.1 ..."`,
while the same build in Chrome ran fine. The caps come from `$d3d9_fill_caps`
(`src/09ad-handlers-d3d9.wat`), which writes VS 1.1 / PS 1.1 only when host
op `0x30005` returns 1, and on the webgl backend that is `Backend.probe` in
`lib/d3d9-backend.js`: a 4x4 device, three `getParameter` limit checks, one
VS1.1/PS1.1 textured triangle, then `readPixels` and `getError() === 0`.
Replayed step by step outside the emulator (scratch scripts, not committed):
the triangle came back pixel-exact, `[100,40,80,255]`, and the probe still
returned false because the error queue was not empty. Two causes, both in
`@node-3d/webgl` on the GL 2.1 legacy context GLFW creates on macOS:

- `MAX_VERTEX_UNIFORM_VECTORS` / `MAX_FRAGMENT_UNIFORM_VECTORS` /
  `MAX_VARYING_VECTORS` are GLES enums the binding passes straight to
  `glGetIntegerv`; desktop GL rejects them with `GL_INVALID_ENUM` and the
  query returns uninitialised stack (25693024). `lib/headless-gl.js` now
  answers those three from the desktop `*_COMPONENTS` limits divided by four
  (1024 vertex uniform vectors on the M1).
- `gl.depthRange(near, far)` raises `GL_INVALID_OPERATION` and does not apply
  (`depthRange(0.25,0.75)` leaves `DEPTH_RANGE` at `[0,1]`). The D3D9 draw
  path sets it from the viewport's minZ/maxZ before every draw. The shim drops
  the error when the requested range is the one already in effect (the 0..1
  every B&W2 viewport asks for) and logs once when the binding really could
  not apply a different range, so a stuck depth range is never silent.

`test/test-headless-gl.js` now requires the three limits to answer cleanly and
the `0x30005` probe to return 1 (it used to accept 0). The stale
`test/run.js:122` note above still holds for the *explicit*
`--d3d9-renderer=webgl` spelling; the working headless command is the one
without it, `--headless-gl --d3d9-programmable`, and it is what the frozen
`--control=` sessions in this file use.

### Headless GL profile dialog: first CPU profile without the present readback (2026-09-15, WIP)

Verified after 1eb77ea1, one guest at a time, frozen and stepped over
`--control=8131`:

```
node test/run.js --app=black_white_2_demo --headless-gl --d3d9-programmable \
  --control=8131 --frozen --memory-mb=2048 --quiet-api --quiet-blocks \
  --batch-size=200000 --max-batches=1000000000 --max-seconds=3600 --no-build \
  --trace-eip-range=0x00526d93-0x00526d97 --trace-eip-detail --trace-eip-stream
```

By batch ~4000 (about 15 min at box load 20-30) the game is at the profile
dialog ("Select Profile" over "New Profile Name: Player") at 640x480, drawn
through GL and composited into the raster canvas: `ctl.js png` frames are
~340 KB, the intro's are all-black 2 KB frames (Bink video frames do not reach
the GL layer headlessly -- not investigated). The intro-object poke
(`[esi+0x24] = [esi+0x20]-1` on the object traced at `0x00526d93`) works over
`ctl.js eval` with `exports.guest_read32/guest_write32` while a step runs.

**Sampling the process from inside.** `run.js` has no `--cpu-profile`, but
`controlEval` exposes `process`, so `process.mainModule.require('inspector')`
gives a `Session`: `Profiler.enable/start` through one `eval`, step, then
`Profiler.stop` writes the `.cpuprofile` from its callback (async -- read the
result flag with a second eval). 60 s at the dialog, 61216 samples, ranked
with `tools/cpuprof-top.js`:

| self | share | what |
|---|---|---|
| 15.3 s | 21.9% | `getCursorPos` -- **mislabelled native GL driver time**: every caller is a `gl.*` call (`updateBuffer`, `bindRenderTarget`, `flush`, `useProgram`); V8 names the binding's native frames after a neighbouring symbol |
| 11.8 s | 16.9% | `h.log` in run.js -- the per-API-call name decode the CLI does even under `--quiet-api` (a CLI cost, absent in the browser host) |
| 5.7 s | 8.1% | `drawImage` raster-canvas -- the headless compositor copying the GL layer (CLI-only) |
| 5.4 s | 7.8% | anonymous run.js next to `h.log` (same logging path) |
| 4.9 s | 7.1% | `wasm-to-js` |
| 4.0 s | 5.7% | `copyPayload` + `copy` in d3d-command-stream.js |
| 1.7 s | 2.4% | `call` d3d9-host.js |
| 14.6 s | 21.0% | wasm total |
| 0.06 s | 0.1% | `readPixelsInto` (headless compositor's own readback) |

`readColor` / present-time `readPixels` are absent from the profile: the
7.2%/4.3% shares the GL present readback had are gone, which is what
562c1fea was for. The next real levers on this screen are the command-stream
copies (5.7%) and the wasm-to-js boundary (7.1%); the two run.js logging
entries and the raster `drawImage` are CLI harness cost and must be
subtracted before any of this is read as what the browser feels.

**Open, for the next session:**
- `ctl.js click 250,275` on the dialog's OK (the browser's (313,343) at
  800x600 scaled to 640x480) did nothing; B&W2 samples the mouse through
  DirectInput, so try `mousemove`, then `mousedown`, a gap, `mouseup` (see
  `test/test-cli-di-mouse-control.js` for the sequence the CLI DI path
  accepts) before assuming the dialog ignores input headlessly.
- Then the land picker: New Game (197,555) → Continue (400,575) → double
  DI-click at (165,478), all at 800x600 browser coordinates; scale for the
  headless 640x480 or pass `--screen=800x600`.
- A profile of the same screen without `--trace-eip-*` and with the API-log
  decode measured separately, so the harness share is known.
- Levers still queued: strip-wide shader VM + four-component sampler for the
  software path; GL vertex-declaration element types for gameplay.

## Software backend after the A4R4G4B4 host decode (box 1, 2026-09-28)

`lib/d3d9-host.js` now samples D3DFMT_A4R4G4B4 (004a20fa). Before that, only
the WAT create gate admitted format 26, and the JS draw path dropped any draw
binding it. Driven over `ctl.js` on a quiet box with
`--d3d9-renderer=software --memory-mb=2048 --batch-size=200000
--tick-ms-per-batch=20 --trace-eip-range=0x00526d93-0x00526d97
--trace-eip-detail --trace-eip-stream`:

- **Every screen renders, with 0 `invalid texture` lines** in the whole run:
  the GDI splash, the Lionhead intro, the profile dialog over the menu art,
  the main menu, and the land picker with its fire preview.
- **Intro skip from a control session.** The first `[EIP] 0x526d93` line
  names the intro object in ESI (`0x074d6bdc` in both runs). Then
  `ctl.js eval` writes `[o+36] = [o+32]-1` while a step is still running.
  After that the recipe above works unchanged: home the DI cursor, move
  `250,277`, `di-mousedown/up`, then Enter for New Game.
- **The picker does not take the land click, again.** At 200 and at 20
  ms/batch, neither spaced nor back-to-back `di-mousedown/up` pairs changed
  anything. Counters on the poll entry `0x9b0880` and the DrawPrimitive
  return `0xa4da46` read **0 polls against 1,430 draws over 300K batches**
  (~6.5 draws/s of wall). The game cursor stayed at `+0xc4/+0xc8 = 311,345`,
  where the profile click left it. So the input manager has not polled since
  the picker came up. That is the not-polling state described in "The land
  picker does not ignore the mouse", this time *before* any land click, and
  it did not resume within ~3 min of wall.
- A snapshot showing yield 16 with its one bridge request `done:true` is not
  a stall. Wrapping `ctx.waitD3DRender` showed tokens advancing, about one
  per 17 batches.

### CORRECTION: the picker was the land build, and the flyover renders (same run)

The "does not take the land click" bullet above is wrong. In that state the
game was **building the land**, not ignoring input. Enter on New Game
starts the build. Then:

- Polls at `0x9b0880` resume at about batch 1.24M, ~750K batches (~9 min of
  wall) after the picker appeared.
- The intro flyover of the demo island renders correctly on the software
  backend: terrain, trees, the ocean, buildings, the light shafts, and the
  landing glow.
- The bright ellipse in the flyover frames is the landing-spot glow. It is
  not missing water.
- The flyover is not skipped by `keydown:27` or `di-keydown:27` (held for
  20K batches). It advances at ~12 input polls per 100K batches, roughly one
  game frame per 10 s of wall. It was still playing at batch 1.9M, so
  gameplay was not reached in this session.

**Where the time goes** (box 1; main-thread V8 CPU profiles through
`ctl.js eval` + inspector; `top -H` per thread):

| phase | main thread | render worker | top of main profile |
|---|---|---|---|
| land build (batches ~0.5M) | 100% | ~72% | guest code: memory translation ~16% (`$guest_page_translate` + `$g2w` + `$gl32/$gs32` + `$page_resolve`; the 2 GB sparse heap lives outside the direct window), `$th_uop_enter` 5.8% + `$bx_hot_bump` 3.5%, `$run` 8.9% |
| flyover (batch ~1.9M) | 100% CPU, but **52% idle** in the V8 profile | ~51% | the same guest mix in the other half |

In the flyover, main and the raster worker each run about half the time,
and the idle half is main waiting on the worker. So the software device
serializes: main blocks on the frame the worker is rasterizing, instead of
overlapping guest work with it. That makes the flyover gap a pipelining
question before it is a raster-speed question. During the land build the
worker is also still rasterizing every picker/loading frame at full cost
(~6.5 draws/s of wall) while main is CPU-bound.

## Normal-route revalidation on persistent-box migration (2026-10-09)

The September14 drive52 notes above already prove an interactive scene and
camera input. That historical route used the diagnostic intro finish-frame
write; do not describe it as either "no gameplay ever" or proof of a complete
ordinary launch. The current target is registered browser launch through
normal keyboard/pointer input, with no guest-memory intro skip.

Current fixture preflight has364 manifest companions plus the EXE/DLLs and
manifest (366 unique archive paths,926680214 bytes). A bounded streaming
transfer sends only those files to fresh no-env bx_75agndxm, avoiding a bulk
archive on the nearly-full persistent disk. Files are rechecked against their
manifest sizes and hashed before build. Source baseline ff0c1f07b,903 pins.
Preparation is in `scratch/bw2-normal-route-20261009`; no runtime result yet.
Declared bounds: transfer1800s, build900s, browser5400s, retrieval/cleanup300s;
boat expires06:16:08.841Z. Long silent land loads are not evidence of a hang.

### 2026-10-09 current-main first-slice exit

Source ff0c1f07b builds successfully;903 source pins and366 fixtures verified.
Original browser attempt exits before first window. Supplemental stdole2.tlb,
msvcrt.dll and comctl32.dll exist locally and were subsequently transferred;
DLL requests need binaries/ mapped to test/binaries/, not only the latter
physical paths. Correcting that alias loads5 DLLs instead of3, but the same
early exit remains. Standard local shlwapi/shell32/ole32 DLL files are absent,
so built-in handlers remain the fallback; this is not proven causal.

The bounded owning-Worker command observer confirms memory2147483648 bytes,
load_pe entryAD9CA3/ESP074FFFFC, preserved through loadDlls. First slice runs
6 blocks then returns EIP0, ESP074FFEE0 with stack returnAD9CC9. Original
AD9CC3 is call[C122AC], the GetVersionExA import. No owning exit/fault import
record occurs. NULL IAT is a hypothesis: next capture C122AC across load_pe,
loadDlls and first slice, plus target bytes. Do not mistake the host zero
register summary for owning registers or call this gameplay.

Sealed runs:20261009T0326Z-black-white2-launch (25 artifacts) and
20261009T0329Z-black-white2-startup-trace (68 artifacts). Private JS observers
read only; runtime wasm SHA bb9d6e9621a06efb5498e2903fc0a3185967ac76cd33fc76b96c11d714c0a387.
All four Chrome runs closed normally; temporary bx_75agndxm retained,
expiry06:16:08Z. No native or browser processes on the persistent host.

### 2026-10-09 Worker oversized-PE staging fix

IAT capture proves C122AC and neighboring entries zero immediately after
load_pe, unchanged by DLL loading. Worker host loadPe stages only8MiB of
the20,656,128byte EXE. Cooperative stageAndLoadPe already maps section tails
before WAT import loading. Factored stagePe for reuse by the Worker host,
with placement getters read from owning Worker exports. No guest patch.

Extended existing process-boot regression exercises the actual async Worker
loadPe method, asserting tail bytes before load_pe; baseline fails zero vs
expected bytes. Candidate passes that plus PE SFX overlay and oversized NE
policies, existing process-boot yield suite, large-DLL suite and canonical build.
Candidate uninstrumented browser creates LIONHEAD window; original stopped
within6blocks without a window. Screen is still black at first capture and
this does not qualify gameplay. Browser189048 remains live on bx_75agndxm
with immutable05:05:50Z deadline. Evidence snapshot:
20261009T0335Z-black-white2-staging-fix (91hashed artifacts, outcome running).

### Candidate intro follow-up

Current candidate reaches the visible Lionhead particle intro. Normal click
and Escape events were delivered; no guest-memory skip. Earlier claims of
an infinite attract loop are not sufficient: notes above establish normal
frame-count completion at1787. Keep waiting within the declared90minute
run budget rather than patching its finish counter.

A30.048second HUD sample counts25 guest presentation events. This is an
intro-only proxy (not gameplay/logical FPS), collected while the DisciplesII
installer was transferring, so it is not an isolated performance benchmark.
Raw31samples: scratch/runs/20261009T0335Z-black-white2-staging-fix/evidence/browser-candidate/intro-present-rate.json.
A bounded capture monitor requests a screenshot every10minutes and stops
after browser189048 terminates or its05:05:50Z deadline; no input automation.

### Ordinary intro completion and relative input (2026-10-09)

The same browser reached the profile dialog by 04:10:55Z, without changing
guest memory or skipping the intro. Holding Enter for three seconds accepted
the profile and reached the main menu. Text is visibly garbled. Short key
pulses and pointer clicks did not reliably activate controls.

The registry omitted `relativeMouse`, despite the game's DirectInput software
cursor. A live host-only opt-in (`runningApps` entry's `relativeMouse=true`)
followed by a trusted click obtained pointer lock and reached the burning-village
land picker. `relative-capture.json` records the prior false setting, confirmed
pointer lock, and unchanged 1000x800 viewport. The registry now opts in through
the existing shared relative-input path; its JS regression and syntax check pass.
This validates live input capture, not a fresh launch with the registry change
or completed gameplay. Held Enter at the land picker did not advance it.

Evidence remains `scratch/runs/20261009T0335Z-black-white2-staging-fix`:
`interval-3`, `held-enter`, `relative-capture`, and `land-enter` images and
receipts under `evidence/browser-candidate/`, with exact host-input scripts.
The browser remains under its original 05:05:50Z deadline. Next: ordinary
land selection and gameplay; preserve the garbled-font and input limitations.

Read-only samples at 04:17–04:19Z identify the original static input manager
at guest `0x1d733e8` through the owning Worker's `guest_to_wasm` export.
Cursor fields remain `(-1,238)`. Ten trusted pointer-lock movement events of
`(2,2)` increment the mapped `DI_MOUSE_INPUT_STATE` pending deltas from
`(130,139)` to `(150,159)`, while 25 presentations occur. Thus browser input
delivery is working, but this motion was not consumed during that sample.
No further input is queued. Earlier notes describe a 36-minute land load with
no input polls; this is a possible explanation, not a proven classification of
the current run. Interval-4 at 04:20:55Z still shows the land preview.
Evidence: `land-progress-sample`, `land-aim-step`, `land-motion-delivery`, and
`interval-4` under the same run's `evidence/browser-candidate/` directory.

### Normal-route island flyover and remaining rejected draws (2026-10-09)

Interval-5 at 04:30:55Z shows the 3D island flyover. No additional land click
or intro/cinematic memory write was needed: New Game had already started the
land build. The right edge retains old menu pixels. Player control is not yet
verified, and the original browser deadline remains 05:05:50Z.

Seven read-only samples at 04:34:37–04:35:07Z show 890 additional render queue
completions and two presentation events. The queue has no active error, but
the bridge retains `D3D9 FVF 0 is not implemented`. A separate bounded
30-second callback observer confirms eight *new* such errors, so this is not
just a stale error string. Callback arguments, return value and receiver were
forwarded, and the hook was restored after observation.

A further bounded capture records four failed draw descriptors: opcode
`0x30001`, triangle-list counts 630/126, index format101, vertex-shader pointer
nonzero, but pixel shader/declaration/FVF all zero. Main owning-Worker
declaration rejection count/mask and both rejection slots are zero. The old
multi-stream/element-type fixes are present; these samples do not identify the
producer of the absent binding or prove the visual impact of the rejected
draws. Do not silently accept the invalid draw or reapply the historical fix.

Evidence in the same run: `flyover-render-progress`, `flyover-render-errors`,
`flyover-fvf-state` JSON/images and their exact scripts. Next is ordinary
control verification after the cinematic. The rendering follow-up needs the
binding producer, not another screenshot or an assumed declaration format.

## ps_1_4 public: the vine shader latched the render queue (2026-10-10, boat A/B)

Boat bx_3vevpk6s, `tools/black-white-software-probe.js --skip-intro
--control-stdin --seconds=2900`, base arm = 03923630e~1 (`--wasm`), fix arm =
03923630e (ps_1_4 public). Feeder by wall clock: refusal counters every 60 s,
profile OK + Enter (New Game) at 450 s. Run `20261010T1445Z-bw2-land-gameplay-boat`.

- **Refusals:** 68 (fix) vs 72 (base) by the profile dialog, as before; after
  the land build and flyover, **125 (fix) vs 131 (base)**. That is six ps_1_4
  shaders accepted, not thirteen. The first refused word on both is still
  `0xffff0200` (ps_2_0) and `0xfffe0200` (vs_2_0).
- **Regression:** at about 1072 s, during the land flyover, one fix-arm draw failed
  `D3D9 software: shader exceeds native VM implementation`. The command
  queue latches its first error (`lib/d3d-command-stream.js` `_retire` ->
  `_cancelWaiting`), so every later command failed (1.37 M failures) and
  every capture from 1083 s on has the same md5. The base arm went on into the tutorial (village,
  god-hand beam) with 0 failures.
- **Cause:** the effects ship compiled bytecode. `Data/effects/*.sdv` holds 42
  version-token hits. Replaying each one through `d3d_shader_ir_compile` and
  then `d3d_shader_vm_compile` found exactly one that the IR accepts but the VM refuses:
  `Aligned_Vines.sdv` +0x5fb4, ps_1_4, 11 records, IR flags 2. Its coissue
  pairs are `mul r3.a / +mad r0.rgb` and `add r2.a / +mul_x2 r0.rgb`. The VM's
  pair rule (`$d3d_shader_vm_pair_destination`) is the ps_1_1..1_3 file,
  r0/r1 and t0..t3. ps_1_4 pairs may write any temp r0..r5, and the
  VM's execution already evaluates both packets before committing either, for
  any register. The fix adds `$d3d_shader_vm_pair_destination14`.
  CreatePixelShader never runs the VM, so the only symptom was at draw time.
- The 43 shaders bound after the latch (20 ps_1_1, 22 vs_1_1, 1 ps_1_4) all
  compile in the live process, so the latch was not a heap failure.
- **Still refused, and plausibly too strict:** `grass.sdv` +0x5f84 (ps_1_4)
  fails scan14 error 18 at word 86, a coissued `mul` whose pair reads four
  distinct temps (r2, r4 | r1, r0). The rule (`09af` ~345) caps a pair at three
  temps and three constants. fxc emitted this shader, so D3D's rule may be per
  instruction. It needs a source before it is relaxed. The other four `.sdv`
  ps_1_4 "refusals" are CTAB-comment false positives (0x14 after a real
  shader, or garbage tokens within ten words).
- Scanner and replay scripts: the run folder's `scripts/`. Drawn shaders were
  captured live by wrapping `ctx.d3d9Bridge._submit` from an eval sent to the
  probe's stdin pipe (`/proc/<pid>/fd/0`).

### Re-run past the flyover: the fog gate, then the raster budget (2026-10-10)

Boat bx_m6vzd3ud, same probe and route (`bw2-run6.sh`, plus a hook that records
the first failed command). Run `20261010T1608Z-bw2-65e5905e8-fog-boat`.

- **65e5905e8 alone:** the vine shader compiles, but the same draw at about
  1073 s fails one gate later, on
  `programmed pixel fog requires PS1.1-1.3`. The vine pass runs with vertex fog
  (DRAW: ps_1_4 with 11 records, vs_1_1 with 29 records, which writes oFog), and three version lists
  (`d3d9-software-backend.js`, `d3d9-backend.js`, `d3d9-fixed.js`) predated
  public ps_1_4. ps_1_x fog is the fixed blend after the shader, applied
  outside it on both backends, so 229fffacf adds 1.4 to the lists.
- **With the fog fix:** 0 failed commands through the flyover and into the tutorial.
  Every 120 s capture from 1081 s to 2163 s differs (village, god-hand beam,
  camera moving over the island). Refusals: 125, all ps_2_0/vs_2_0.
- **Then the raster budget:** at about 2214 s the queue latches
  `native raster allocation budget exceeded`. That is the same failure the parent build hit at about 2150 s, so it
  is independent of ps_1_4 and is now the first gameplay blocker on the software
  backend. w6's 3a908f97b (raster budget streaming) is the candidate fix; this
  run is its control. Until a run gets past it, camera input and player control are not
  verified.

### The tutorial's advisor dialogue outlasts a 3500 s run (2026-10-10)

Boat bx_wn9q2edy, 47aafe16e, the same probe route, two arms (plain, and Esc
three times at 2300 s). Run `20261010T1800Z-bw2-camera-after-dialogue-boat`.

- Both advisors are still talking at 2600, 3050 and 3500 s in both arms. Esc
  (WM key + DIK_ESCAPE) does not skip the dialogue.
- During the dialogue the camera ignores Up (WM keydown 38 + DirectInput
  DIK_UP held 40 s). The frame changes no more than in the 40 s idle windows
  around it, and the terrain stays put while the advisors and villagers
  animate. w6's 2900 s key test fell in the same scene.
- So a camera test needs the dialogue to END, and that probably waits on a
  player action, not on time. Find what the tutorial script waits for
  before spending another long boat run on the key test.
- Rendering stayed healthy on main: 0 failed commands in 725 samples per arm,
  124 refusals.

## The Land3 intro cinema: what it is and why it seems endless (2026-10-10)

**Static.** The "advisor dialogue" is Land3's scripted intro cinema, script
`Land3Intro` in `Scripts/BW2/Land3.chl` (LHVM v12, header `LHVM`/0x0c).
`Data/Text/bw2text.bin` is a list of ASCII `BW2T_...` ids, each followed by
NUL-terminated UTF-16LE text (`scripts/bw2text-dump.js` in the run folder).
The intro is `BW2T_SCRIPT_03FINAL_ADVISORS_NEW_INTRO_10..70`:
- an old Greek settlement;
- Town Center, Storehouse and field;
- "The green ring you see is the extent of your influence".

Then `ADVISORS_INTRO_10..70`:
- "Here are the people we saved! They're exiting the Portal!";
- ... "75 people at least" ...;
- ending in **"When you're ready to learn how to feed your people, click on
  the Gold Scroll over the field, Leader."**

That click starts `Land3Tutorials` (`ADVISORS_TUT_10`: "First, though, the
survivors require food"). Each line is `say` + `wait until read`
(ScriptLibraryR tokens T_SAY/T_READ). Cinemas are skippable only when the
script enables it (`ENABLE_CINEMA_INTERRUBTIBLE`, `IS_CINEMA_SKIPPED`
natives). The "refresher about how to move like a god?" line belongs to the
full game's land 1 (`SCRIPT_01FINAL_HANDTUTORIAL_10`), not this demo.

**Dynamic** (boat bx_m5u6ay78, 38c329897, run
`20261010T1939Z-bw2-land3-intro-boat`):
- **Not stuck, slow.** The 120 s captures follow the script order: the
  village and green ring at about 1100-2040 s, the portal villagers from about
  2250 s. That is about 2-5 min of wall time per line, with about 2.7
  presents/s on the software D3D9 path. The intro was still running at 3420 s.
  At this pace it ends somewhere past 4000 s.
- **Audio is fine.** One 21504 B looping DirectSound buffer (flags 0x18000 =
  GETCURRENTPOSITION2|GLOBALFOCUS, 44.1 kHz stereo 16-bit) that the game mixes
  into itself, with no notifications. The host cursor (`ctx._voices.getPos`)
  advances exactly at real-time rate.
- **No skip.** Action click, right click, Space and Enter during the cinema
  change nothing (Esc tested earlier too).
- **Camera locked.** In the cinema, Up (WM key + DIK_UP) is
  indistinguishable from idle, as expected.
- **Next.** Reaching the Gold Scroll needs the intro to finish: either a
  longer boat run (about 2 h, then click the scroll over the field near the
  view centre and run the camera test), or a cheaper frame. Each frame renders
  a 1280x960 target; a lower in-game resolution should multiply the game's
  pace.
