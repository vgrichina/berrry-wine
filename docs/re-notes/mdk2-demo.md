# MDK2 demo (BioWare/Interplay, 2000)

**Status: registered (`mdk2_demo`); current native startup is blocked by GL
symbol rejection (105 observed names remain unsupported after the 2026-11-02
normal, texture-coordinate, vertex and raster-position implementations, 9bafbc319, 9f56285e2 and
7170d9afa and 80ebba348; see [normal evidence](gl-typed-normal-family-20261102.md),
[texture-coordinate evidence](gl-typed-texcoord-family-20261102.md) and
[vertex evidence](gl-typed-vertex-family-20261102.md) and
[raster evidence](gl-raster-position-family-20261102.md)).** Historical Chromium/WebGL
runs rendered Menu, New Game, the intro and tutorial and took input;
projective vertices work since 9be0a0efb, and FSCALE fixed the black world
after the intro (see Black world). Those runs do not establish current
browser compatibility. The "attract demo ignores
input" puzzle was only the menu's idle timer (see Menu). The fetch
needs a real `unshield` (IS6 cabs; `tools/is5-extract.js` refuses them).

## Source

archive.org `Mdk2Demo`: `MDK2Demo.exe`, 86,442,069 bytes, SHA-1
`981cd1f0774c6dae690cdf97bf08d975a43f8e81`. No licence or redistribution
grant (readmeEN.txt names BioWare Corp. and Interplay registration only), so
local-only.

It is an InstallShield 6 self-extractor: 7z unpacks `data1.cab`/`data2.cab`;
**unshield** reads them (`tools/is5-extract.js` refuses: cab version
0x100600c). The game is file group `Minimum` (MDK2.exe launcher,
mdk2Main.exe, `data\base.zip`/`scripts.zip`/`sounds.zip`, Music\*.acm) plus
group `english` (`data\local.zip`, the string tables). Installed to
`c:\mdk2demo`.

## Startup

- **`MDK2.exe` is only the hardware launcher** (a comctl32 property sheet;
  needs the real comctl32/oleaut32 in `test/binaries/dlls`). *Play MDK2*
  writes `save\config.lua` and spawns `mdk2main.exe`. Without that file
  mdk2Main.exe stops with "ERROR: Missing file. Please make sure the game is
  being run from the install directory." (it loads `config`, then
  `defaultconfig`, as Lua from `save\ scripts\ override\ override\english\
  data\` and the zips; `0x41fbc0`, error helper `0x4522e0`).
- The launcher's defaults (Default OpenGL Driver, 640x480x16, bilinear,
  mipmap, full screen) write exactly these 88 bytes, captured from a CLI run:
  `chSetVideoMode(640, 480, 16, 16, 60, 1, 1, 0.8, 0, 1, 0, 0)\r\n`
  `chSndForceSoftwareMode(1)\r\n` (note `1`, not `0`).
- Through the launcher the spawned child sits in the same wait as below; run
  mdk2Main.exe directly with that config installed (as shogo_demo does).

## OpenGL init (what was fixed)

`0x4532c0` suspends the worker thread at `0x453411`
(`SuspendThread([0x4b8810])`, the `_beginthread(0x451f30)` file-request
worker), calls video initialization (`0x4526e0` on the observed path), and
resumes it at `0x4534a3`. If GL init fails, the error path loads strings
through that **suspended** worker and both threads idle in `SleepEx` forever
(main polls `[0x4b87d0]` at `0x4522b0`/`0x4522d0`) — no window, no message.
GL init failed for two reasons, both fixed:

1. `ReBaseImage` (imagehlp) had no api_table row: it rebases the GL driver
   file below 0x64500000 before LoadLibrary and ignores the result. A missing
   image is now FALSE/ERROR_FILE_NOT_FOUND (`test-rebaseimage.js`).
2. Its GL loader resolves every name with GetProcAddress and gives up on a
   NULL: `wglDescribeLayerPlane`, `wgl{Get,Set}LayerPaletteEntries`,
   `wglRealizeLayerPalette` (now answered from the pixel format: no layer
   planes) and `wglUseFont{Bitmaps,Outlines}A` (fail-fast rows)
   (`test-wgl-layer-planes.js`).

It then creates its context (ChangeDisplaySettingsA, wglCreateContext,
wglMakeCurrent) and draws. `glVertex4f`/`glVertex4fv` with w = 1.0 are now
exactly glVertex3f/3fv (11,890 calls in one run).

Projective vertices (fixed 9be0a0efb): the level draws through ~3.5M
glVertex4f and ~380K glVertex4fv per run, many with w ≠ 1 (call site
`0x464ffb`). The packed vertex now carries w and both rasterizers divide
by clip w.


## Input

- Keyboard is a DirectInput device (c_dfDIKeyboard, cooperative level 6,
  `Acquire` + 256-byte `GetDeviceState` every frame); the mouse is a
  DirectInput relative device (16-byte state). The CLI needs both the WM and
  the DI form of every action (`keydown`+`di-keydown`,
  `mousedown`+`di-mousedown:1`); the browser feeds both by itself.
- A key must be held across a poll: Playwright `keyboard.press` (down+up in
  one turn) is sometimes dropped at the difficulty prompt; hold 200-400 ms.
- Menu cursor: DI relative motion, ~0.47-0.61 guest px per host px. The
  Options dialogs follow the mouse, not the arrow keys; in the CLI use
  `relmousemove:DX:DY:4` (negative deltas work).
- **Default bindings**, read from the game's own Options (tower icon) ->
  Controls -> Customize screen (CLI frame:
  `scratch/runs/20261011T1745Z-mdk2_demo-controls-screen-w5/customize-bindings.png`):

  | Action | Key |
  |---|---|
  | move forward / backward | Num 8 / Num 2 (arrow keys also work in play) |
  | turn left / right | Z / X |
  | strafe left / right | Num 4 / Num 6 (Left/Right arrows strafe too) |
  | look up / down | Num 7 / Num 1 |
  | jump | Mouse B2 (right button) |
  | shoot / combine | Mouse B1 (left button) |
  | quick save / load | F6 / F7 |

  Further pages: Kurt / Max / Dr. Hawkins Controls, Default Keys 1/2. Space
  toggles Kurt's sniper mode (seen in play). The touch layout maps the arrow
  pad, Fire = MOUSE1, Jump = MOUSE2, Sniper = Space, Enter, Esc.

## Menu and the "attract demo"

Startup runs the Lua scripts `mdk2` and `menu` (`0x41fbc0`;
`0x4426a0(name)` calls a Lua function). The copyright/logo screen *is* the
menu's entry: with no input, the idle timer `[0x4b657c]` runs "playdemo"
(`0x402378`; `-test` on the command line does too), the "Demo"-labelled
level that looped in every early run. Click the logo screen before it fires
(~25 s in the browser) and the main menu appears. Icons: gamepad = New Game,
tower = Options (Video/Audio/Controls/Game), monitor, floppy, red X = quit.

## Route (browser, Chromium, desktop 1280x900, Threads on)

t~12 s click the logo -> menu; Enter -> Select Difficulty (Medium
highlighted; one Up = Easy); Enter -> LOADING comic (~t24-160 if not
skipped). Esc every 10 s from t40 to t110 skips the comic, the title card
"The Jim Dandy, Earth Orbit 8:59AM" and the in-engine cutscenes; one more Esc
pauses (Enter on Paused = Continue). Timing drifts run to run: a lost
difficulty Enter leaves the Esc presses backing out to the quit prompt. When
the route reaches play lit (2 of ~6 runs), Kurt stands on the tutorial pad by
t~114: "Use your directional keys..." -> "Use the mouse to look..." -> "stand
by the arrow... face the exit". Unskipped, the Jim Dandy cutscene is still
running at t260. Evidence:
`scratch/runs/20261011T1715Z-mdk2_demo-browser-gameplay-w5`.

## Black world (NaN camera) -- FIXED: our FSCALE

**Root cause (fixed in the commit that added `test/test-x87-fscale.js`):** our
FSCALE computed `ST0 * pow2(trunc(ST1))` as one f64 factor. The MSVC CRT's
transcendental exit (`_check_range_exit`, `0x484b29`) sends every result
whose double exponent is 0 -- including an exact `0.0` -- through an
underflow fix-up at `0x484b7a`: `fld qword [1536.0] ; fxch ; fscale`.
2^1536 is +Inf in f64 (x87's 80-bit exponent holds it), so `0 * Inf = NaN`:
every CRT math call that legitimately returned 0.0 handed the game a NaN. Four
such calls during the intro produced the NaNs at an object transform
(`0x084da14c/150`), which spread through the matrix code
(`0x46d520/0x46d756/0x46d8b0`) into the camera; with a NaN camera the 3D pass
culls all level geometry and only the ortho HUD draws. FSCALE is now an exact
ldexp (`$fpu_scale`, 06-fpu.wat): zero/Inf/NaN scale to themselves (x87's
invalid `0*2^+Inf`/`Inf*2^-Inf` give NaN) and the exponent is applied in
representable steps. After it: no IE flood, the tutorial room renders in the
CLI route at b6000/b6400 (evidence
`scratch/runs/20261011T2110Z-mdk2_demo-fscale-fix-w5`).

How it was found (tools worth reusing; boat-only hooks in
`scratch/runs/20261011T2000Z-mdk2_demo-nan-source-w5`):
- `--trace-gl` on a black frame: world sprites `xyz=NaN`, no geometry.
- `--trace-fpu` counts the IE flood; a boat-only hook logging the guest
  address + thread of every NaN x87 m32 load found the first NaN floats and,
  in order before them, the four CRT math-error IEs (`0x484b7a`).
- A red herring on the way: `Ricochet.mod`'s colour record (`0xffc9a893`)
  is copied into node 0's weight by the node init at `0x45eefe` and
  overwritten with 1.0 at `0x45ef8e`; harmless, same on hardware.
- Also checked and not the cause: the initial x87 control word (ours 0x037F,
  Windows 0x027F; the CRT exit compares the saved CW with 0x27F, but switching
  did not change the frame), SSE/3DNow/MMX, decompression (JS blast port,
  `scratch/wip/mdk2-dcl-explode-zipblast-w5.js`, 856/856 entries).
- Tooling gotchas: `--trace-at` halts each batch at its first hit, so those
  runs fall behind; plain `--watch` shifts allocation addresses, and neither
  watch mode sees a value written and read inside one fall-through chain.

## Open

- Jump: the binding is the game's own (Mouse B2) and the button is mapped;
  not yet verified in lit play. The historical FSCALE fix reached the lit
  room, but the bounded native check below stopped before window creation.
- Playwright WebKit on Linux has no WebGL on a Worker's OffscreenCanvas
  (control: `getContext` returns null there, a main-thread canvas works), so
  the GL render worker cannot create a context and the game area stays gray.
  Real iOS Safari 17+ has worker WebGL; the WebKit touch pass used
  `?gl-renderer=software`.

## 2026-11-01 bounded native jump check: startup blocker

Run `scratch/runs/20261101-mdk2-lit-jump-control/` leaves jump/landing open.
One unchanged original ran for 54.232 seconds with the registered `mdk2_demo`,
default software renderer, cooperative scheduler, 100000-block batches,
200 ms guest ticks, and frozen CLI control. Small steps reached batch 3110;
reviewed captures at batches 10, 110, 1110 and 3110 remained blank teal.
Snapshots at batches 610 and 2610 reported no windows and no main/focus HWND.
Main EIP stayed at `0x4515cd` (the return after the indirect call at
`0x4515c7`); the sole worker, handle `0xe1000`, start `0x481331`, remained
active with suspend count 1. This is the first observed failure, before the
title click or tutorial route. Its cause was not diagnosed; this run does
not establish recurrence of the historical GL-init/FSCALE faults.

No ordinary input was sent: scheduled, enqueued, dequeued, routed and
dispatched counters were all zero at batch 3110. There is no lit-play,
same-life before/held/released/landed series or consumed Mouse B2 receipt,
and no jump, landing, movement or player-versus-camera claim. The original
exited 0 after an ordinary CLI quit. No second original or repair was tried.

Actual source baseline was `c0c991a95002574a602fa1dfeb50e0d980084b50`
(dispatch baseline `0a33e2db441b3e7dfd987783b0e47229500420b7`). Fresh
predecessor final/result and explicit runtime/source/build release were
verified before the 09:40:14 UTC gate; its runtime deadline was 10:10:14 UTC,
within the overall 10:34:34 UTC bound. The accepted build's 4392 input hashes
and 141 recorded build reads matched, so it was reused. All 4444 pinned
source/module files and all 28 installed-tree files plus the manifest
were unchanged afterward. The original EXE is 761856 bytes, SHA-256
`b3e0226e411abff17ddabb723e493e95579490cb49bfe3787b1eade1144e27c1`;
manifest SHA-256 is
`a0c90df1480e9e81c5734dca97a8e8b308c3709e87964433fe1f4df5875c6316`.
The existing 88-byte `save/config.lua`, derived from the launcher capture
documented above and already installed by the retained candidate recipe,
remained SHA-256
`87261f003683d21f366e28e3c37c89d85804e69daaa2348b17da15bfe8e902ba`.
No config synthesis, download, installer or default changes occurred.

The observed WebAssembly compile input matched the pinned production module
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
All 124 recorded synchronous file reads matched their final local hashes.
The reused observer passed actual synchronous/asynchronous execution,
whole shared 512 MB memory equality, clock identity, and emitted late-10001
retention checks. These validation executions do not extend file-read
coverage: asynchronous/promise/stream reads, incomplete/unclosed descriptors,
descriptors over 24 MiB and reads after the exit flush remain gaps.
Compilation reads are not game runtime reads; compiled-Module instantiation
did not emit separate instance bytes. Logs are compressed and size guarded;
minimum free disk during execution was 2249818112 bytes. Native local box
ID/state/expiry are N/A. Evidence includes `verification.json`,
`input-consumption.json`, `scheduler-snapshots.json`, full before/after pins,
reviewed PNGs and `runtime.log.gz`. No browser/GPU/audio/FPS or broad
playability conclusion follows from this startup check.

## 2026-11-01 pre-window cause: GL export rejection, no repair

Run `scratch/runs/20261101-mdk2-prewindow-cause/` diagnoses the preceding
blank-teal wait. One original ran with bounded API/guest-block tracing from
startup, rather than repeating the play route. It reached the same no-HWND
state by batch 10 and exited 0 on ordinary CLI quit after 78.087 seconds.
The reviewed final PNG is blank teal; all five ordinary-input counters are
zero. Jump, landing and lit play remain unverified.

The first failed GL lookup is API call **49112**,
`GetProcAddress(0x62563c, "glAccum") -> NULL`, returning to `0x457cd4`.
Immediately before it, call 49111 successfully loaded
`c:\windows\system\opengl32.dll` as `0x62563c`. The original instructions at
`0x457cd4` test EAX, store the result at `[0x5c5784]`, and skip the
`jne 0x457ce2` on NULL, setting EDI to 1 at `0x457cdd`. This individual
branch follows from the observed return and original disassembly; it was
outside the block-trace range. The loader continues collecting symbols:
**212 distinct GL/WGL names return NULL**, including `glAccum` and the four
historically repaired layer-plane entries. At `0x45a6c4`, nonzero EDI selects
error 2 and unloads the libraries. The block trace directly observes EAX=2
at `0x45290f` and entry to the error branch `0x45291c`.

The rejection is in the current emulator, not a missing `api_table` row:
`glAccum` is ID 4209. `GetProcAddress_pinned` in
`src/09a0-handlers-base.wat` calls `$gl_dynamic_api_unsupported` before
allocating a fallback thunk and returns NULL/ERROR_PROC_NOT_FOUND for it.
`tools/gen_dispatch.js` generates that predicate from its implementation
maps. Commit `1beaec304847b4abe22c05e15c9bde9d964eb2cc` added this fallback
filter on 2026-10-30 to prevent SDL exposing unsupported GL procedures.
The unmodified predicate, compiled in a scratch fixture, rejects all 212
observed missing names. Of those, **208 dispatch to `gl_unimplemented`**;
four have native layer-plane handlers but are excluded from the availability
maps. Restoring only those four cannot clear the loader's failure latch.

The suspended worker is the consequence that makes error reporting wait:
call 48989 suspends handle `0xe1000` before GL loading. After loader error 2,
`0x45292b` requests string ID `0x2be` through `0x42dea0`. The trace reaches
the `mdk2.str` request, then `0x4522d0` -> `0x4515c0` ->
`SleepEx(10, TRUE)` at `0x4515c7`. Read-only snapshots show request flag
`[0x4b87cc]=1`, completion `[0x4b87d0]=0`, request pointer
`[0x4b87d4]=0x5eab40` (name `mdk2`), and worker suspendCount=1.
The worker's stack returns to `0x451f62`, inside the file worker loop;
its CRT start is `0x481331`. That loop consumes the request and sets
completion at `0x451f51`, but cannot run while suspended. No post-failure
ResumeThread call occurs. The earlier ReBaseImage FALSE is ignored by the
guest and does not prevent the successful GL library load.

No source repair was made: removing the filter would expose 208
unimplemented procedures, and supplying success stubs or changing guest
control flow would not preserve their contracts. The precise unresolved
cause is the mismatch between MDK2's mandatory complete GL export table and
the emulator's dynamic availability policy/implementation surface. The
startup path needs a contract-preserving resolution of that mismatch before
another jump attempt; no forced resume, fake return or config change was used.

Validation: the unchanged `test/test-wgl-proc-availability.js` fails its
stale zero-image-base module-alias assertion at line 79, before testing the
GetProcAddress fallback. A scratch copy adapts only that handle expectation,
adds all 212 observed misses to the existing fallback checks, and omits its
negative mutation runs. Its full-source API checks verify NULL, error 127,
no thunk allocation, ESP+12, preserved registers/stack, and supported lookup
controls; see `actual-test-exit.json`. This fixture is separate from the
production original. Its initial misplaced-shebang setup failure is retained.

The gate was 09:50:19 UTC after Outcast's fresh final/result and explicit
release; actual revision `039f7f5a29dd21f5e65d59d175280c656733935d`, runtime
deadline 10:20:19 UTC, overall 11:15 UTC. Accepted build inputs (4392) and
recorded build reads (141) matched, reusing production WASM
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
The full installed tree, manifest and launcher-origin config retain the
hashes recorded above. Before/after source and actual-runtime-read checks
are in `verification.json`; no second original ran. The identity observer
passed actual synchronous/asynchronous execution, whole shared 512 MB memory
equality, clock identity and emitted late-10001 retention checks. As before,
runtime asynchronous/promise/stream reads, unfinished/over-24-MiB descriptors
and reads after the exit flush remain coverage gaps; a compiled Module
instantiation has no separately emitted instance bytes. Minimum original-run
free disk was 2234208256 bytes. Native local box ID/state/expiry: N/A.

## 2026-11-02 four native layer-plane lookup repairs (startup unqualified)

Run `scratch/runs/20261102-mdk2-layer-plane-lookup/` repairs availability of
`wglDescribeLayerPlane`, `wglGetLayerPaletteEntries`,
`wglSetLayerPaletteEntries` and `wglRealizeLayerPalette`. All four already
dispatch to native handlers; the generator's native WGL set omitted them.
Adding exactly these names repairs both static `GetProcAddress` fallback
and the existing WGL compatibility lookup path. No handler, API-table row,
renderer, guest code or unsupported-function policy changed.

Microsoft documents [DescribeLayerPlane](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-wgldescribelayerplane)
and [RealizeLayerPalette](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-wglrealizelayerpalette)
as BOOL operations with FALSE on failure;
[GetLayerPaletteEntries](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-wglgetlayerpaletteentries)
and [SetLayerPaletteEntries](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-wglsetlayerpaletteentries)
operate on color-index layer palettes, with plane counts supplied by the
pixel format's bReserved. Our descriptor has no such planes. The existing
handlers therefore return FALSE/zero entries and leave output untouched;
errors 87 (nonexistent plane) and 6 (invalid DC) are existing emulator
choices, not claimed mandatory Windows error codes. Microsoft's
[wglGetProcAddress](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-wglgetprocaddress)
contract concerns extensions and current contexts. Advertising these core
names there retains this emulator's existing compatibility policy; it does
not establish Windows extension/context parity.

The canonical `test/test-wgl-proc-availability.js` now checks the supported
native OpenGL module identity and MZ header, including repeat/case-insensitive
loading, instead of asserting that LoadLibrary returns the zero EXE base.
Its independent, explicit list retains all 208 unsupported original misses.
Each still returns NULL through both routes; static fallback reports error
127, allocates no thunk, consumes ESP+12 and preserves other GPRs and stack
bytes. Supported controls and missing/all/cleanup mutation negatives remain.
For each repaired entry, both lookup routes produce the correct API identity
and the test executes the actual resolved thunk through `win32_dispatch`:
32 calls cover overlay, underlay, main-plane and invalid-DC failures, exact
stdcall cleanup, GPR/stack identity and untouched output. The no-PE harness
initializes thunk address translation as the PE loader does.

The unchanged canonical test first failed at its stale module assertion.
The repaired test with the old generated dispatcher fails specifically at
the hidden `wglDescribeLayerPlane` lookup; the new dispatcher passes,
including all three mutation negatives. The final fixture was also replayed
against the saved old dispatcher and fails at that same lookup. An earlier
fixture execution lacked loader thunk initialization and trapped before
handler dispatch; that setup failure is retained in `lookup-final.log`.
Focused `test/test-wgl-layer-planes.js`, generated dispatch freshness and
the mandatory locked full build passed. No focused handler changes were
needed because the canonical test exercises both palette aliases.

`original-missing-symbols.txt` is an exact copy of the preceding investigation's
212-name list; its hash and extracted names are retained beside the logs.
**208 still dispatch to unimplemented GL handlers, including the first
`glAccum` miss. These four repairs cannot clear MDK2's loader failure latch.**
No original was rerun and no startup, window, input, jump or gameplay claim
follows. Browser/boat/assets/download/config/registry/deployment work was
outside this task. Box ID/state/expiry: N/A; lifecycle remains coordinator-owned.

A small next genuine implementation candidate from the retained miss list is
[`glColor3b`](https://learn.microsoft.com/en-us/windows/win32/opengl/glcolor3b):
convert signed byte components to the specified floating current-color values
(signed endpoints -1/+1; zero is not mapped precisely to zero), set alpha to
1, and feed the existing color path. Validate signed boundaries, current-color
queries and display-list behavior before advertising it. That would remove
one more real miss, while the complete mandatory export table would remain
the startup prerequisite.

### 2026-11-02: integer current-color family

Implemented twenty more original misses: `glColor{3,4}{b,s,i,us,ui}` and
their vector forms. Existing unsigned-byte colors already use the float-color
path. The new handlers convert declared-width scalar DWORD slots or packed
vectors into that same path, with RGB alpha 1 and RGBA alpha converted like
the other components. Signed normalization uses `(2*c+1)/(2^n-1)`;
unsigned normalization uses `c/(2^n-1)`. Float current color retains negative
components, while raster colors clamp at their existing consumption point.
These rules, raster snapshots, query conversion and list timing follow the
[OpenGL 1.1 specification](https://registry.khronos.org/OpenGL/specs/gl/glspec11.pdf),
sections 2.7, 2.12, 2.13 (table 2.6), 4.3.2 (table 4.7), 5.4 and 6.1.

Current-color float/integer queries now read the native current values;
queries execute immediately while compiling lists. Lists snapshot converted
components, so later changes to vector memory cannot change replay. Source
reads use guest-address translation, including fragmented pages and exact
element widths; temporary encoded storage is invocation-owned and freed.
The generator advertises only these implemented shapes and routes them to
the real handler; no GPU opcode or export-table ABI changed.

Evidence: `scratch/runs/20261102-mdk2-integer-color-family/`. The actual
resolved-handler suite exercises both lookup routes, signed extrema,
interior values and zero, unsigned extrema, scalar/vector equivalence,
RGB/RGBA alpha, float/integer queries, compile/execute and replay, raster
snapshots, software point colors, exact stdcall cleanup and GPR/stack
preservation. Its explicit native context-identity seam needs no browser
drawable. The saved old dispatcher fails specifically at `glColor3b` lookup;
the implemented dispatcher passes. A separate native extraction test checks
fragmented guest pointers, no RGB alpha overread, allocation lifetime and
conversion/stride/alpha mutation negatives. Relevant native encoder,
software raster, frame-state, display-list, bitmap, double-color,
texture-coordinate, rectangle and WGL layer-plane regressions pass, as do
generated freshness and handler stack checks.
The mandatory `flock /tmp/wine-build.lock bash tools/build.sh` also passes.

**188 of the original 212 names remain unsupported:** exactly four WGL
layer-plane repairs and these twenty colors have been removed from the
explicit miss set. Every remaining name still returns NULL through both
lookup routes, with static error 127, no thunk allocation and preserved ABI;
the missing/all/cleanup mutation controls still fail as expected. The first
remaining miss is `glAccum`: its next genuine prerequisite is accumulation
buffer storage and operations, including `glClearAccum` and `GL_ACCUM_BUFFER_BIT`
clear semantics, before lookup availability can change. No original replay,
startup or gameplay qualification was attempted; the mandatory export latch
still blocks startup. Box ID/state/expiry: N/A; lifecycle remains
coordinator-owned.


### 2026-11-02: accumulation blocked by drawable color-buffer architecture

No accumulation export was enabled. All **188 remaining names** stay rejected,
including `glAccum` and `glClearAccum`; the existing pixel format reports zero
accumulation bits. This investigation produced a concrete prerequisite blocker,
not an accumulation implementation or a startup result.

The [OpenGL 1.1 specification](https://registry.khronos.org/OpenGL/specs/gl/glspec11.pdf),
sections 4.2.2–4.2.4, 4.3.2 and 5.4, requires LOAD/ACCUM to consume the selected
read color buffer and RETURN to write selected draw buffers. Accumulation
storage belongs to the drawable. Correct signed storage, scissored operations,
clear values and list timing cannot repair an incorrect source or destination.

Evidence: `scratch/runs/20261102-mdk2-accumulation-buffer/`. The retained
`prerequisite-probe.js` uses actual GetProcAddress thunks, native win32_dispatch,
WAT encoding and synchronous software raster, then the real software consumer.
Its small synthetic window DCs use canonical DC ownership fields and a 4×4
renderer fixture; no original executable is involved. Exact stdcall cleanup,
GPR/stack preservation, native red/blue clears and a red BACK-to-FRONT swap
pass as positive controls; every failing probe also verifies GL_NO_ERROR.
Six independently specified pixel/identity checks
fail on main `0bc353ddaf7d4e4384d0bd05aa88a2341c477000`:

- Reading BACK after a verified red clear returns RGBA `[0,0,0,0]`, expected
  `[255,0,0,255]`.
- Clearing FRONT green leaves FRONT red and overwrites the blue BACK buffer.
- Clearing with draw buffer NONE overwrites BACK yellow.
- Reading FRONT returns zeros, expected green from the requested FRONT clear.
- Rebinding the same context to the second DC succeeds but the consumer keeps
  drawable 42 instead of 123.

The FRONT clear contributes two separate pixel assertions. The report retains
all six failures and expected values, plus the earlier corrected fixture runs.
`lib/gl-compat.js` implements software backend methods through a proxy whose
unimplemented `readPixels` is a no-op; `_readPixels` consequently copies its
zero-filled temporary buffer. `glReadBuffer` updates query state only and
`glDrawBuffer` is ignored. Native `src/09a8g-gl-raster.wat` targets the same
BACK image for clears, irrespective of these selectors. Its render/front targets
are process globals, while the consumer creates a backend per context and
ignores the drawable supplied when making an existing context current. The
WebGL backend also lacks a logical FRONT/BACK selection contract. A local
native WebGL construction probe reports WebGL unavailable; it supplies no GPU
pixel qualification.

The exact next action is to establish drawable-owned color attachments and
front/back read/draw selection across native software and consumer backends,
implement real software readback, and make context rebinding select that
drawable. Turn the retained six failing assertions into passing regressions
before adding per-drawable signed accumulation storage, resize/deletion rules,
all five operations, clear/scissor/mask/error/list semantics and availability.
Do not advertise accumulation on a backend until that route has pixel evidence.
The existing native encoder, software raster, frame-state, display-list,
integer-color and WGL negative suites, generated freshness and mandatory locked
build were rerun for this blocker report; their results are retained in the
run directory. No original MDK2 replay, startup or gameplay claim follows.
Box ID/state/expiry: N/A; lifecycle remains coordinator-owned.

### 2026-11-02: drawable-owned software color buffers

The six prerequisite failures retained in
`scratch/runs/20261102-mdk2-accumulation-buffer/prerequisite-probe.js` now pass.
Window drawables own distinct native front, back, depth and stencil attachments;
contexts retain selectors and rendering state separately. Rebinding a context
selects the destination drawable and returning restores its existing pixels.
Context deletion preserves drawable storage; window deletion fences pending
rendering and releases that window's attachments. Native client resizing rebuilds
the selected drawable's buffers without resizing another drawable.

Native clears, raster draws and bitmap draws honor FRONT/BACK aliases,
FRONT_AND_BACK and draw NONE. Both color destinations blend against their own
pixels after one depth/stencil decision. NONE suppresses color writes while
preserving depth/stencil operations and the queried color mask. Display-list
capture, validation, replay and color attribute restoration use these selectors.
Queued raster work snapshots the selected attachments and mask before later
state changes.

Software readback consumes the producer's selected surface under a synchronous
lease, including when the consumer is a separate Wasm instance. It converts
color components and scalar formats, observes row alignment/length/skips and
byte swapping, and translates guest output addresses bytewise. The old proxy
readback no-op no longer substitutes zero pixels for the native surface.

`test/test-opengl-drawable-color-buffers.js` resolves and invokes actual Win32 GL
thunks, checks ABI preservation, and compares independently expected pixels on
both drawables and after returning to them. Its direct and `--worker` modes cover
front/back clears and draws, independent RGB destination blending, NONE with
depth/stencil updates, masks/scissor, packed BGR/BGRA/RGBA/scalar readback,
context state/deletion, real window resize/deletion, invalid calls and lists.
The worker mode uses a real native renderer worker and a software consumer with
independent mutable globals. Evidence and the 25 focused regression results are
in `scratch/runs/20261102-mdk2-drawable-color-buffers/`. All 25 focused runs and
four affected reruns passed, followed by the mandatory locked build, including
generated freshness and source-analysis gates. The build recovery command is
`flock /tmp/wine-build.lock bash tools/build.sh`.

WebGL retains its BACK read and BACK/NONE draw contract. Unsupported front/both
selection returns an error; rebinding that backend to a different drawable
fails while retaining the prior binding. It does not pretend to own additional
attachments. This task supplies native/software pixel evidence, no GPU pixel
qualification and no complete OpenGL 1.1 rasterizer qualification.

No accumulation availability was added. All 188 remaining original names,
including `glAccum` and `glClearAccum`, still return NULL/error 127 without thunk
allocation through both lookup routes. Accumulation storage, operations and
their acceptance tests remain the next implementation task. No original MDK2
replay, startup or gameplay claim follows. Box ID/state/expiry: N/A;
coordinator-owned lifecycle is unchanged.

### 2026-11-02: accumulation successor verifies software, blocked on WebGL drawables

No accumulation implementation or lookup availability was added. After the
drawable worker's `181f4295fe1dfe09403109ff970e277ec5073b10` and the GTA worker's
`beb78a56224916b276d012a53543c9df5bd87c90` terminal/result/final releases, all
101 recorded predecessor helper PIDs were independently absent. Fresh runs of
`test/test-opengl-drawable-color-buffers.js`, both direct and `--worker`, pass
on that published source. The six earlier failures are resolved on software:
BACK reads red, FRONT clears green while preserving blue BACK, NONE preserves
BACK, FRONT reads green, and rebinding selects drawable 123. The worker route
also passes its queued native raster and separate-instance consumer assertions.

A new probe calls the actual `OpenGLHostBridge.call` consumer dispatcher with
a recording backend and an existing non-software context. BACK/NONE draw and
BACK read succeed as controls. FRONT draw, FRONT_AND_BACK draw and FRONT read
each return `GL_INVALID_OPERATION` (1282), preserve the previous selector and
never reach a backend selection method. A same-context make-current from
drawable 42 to 123 returns zero and retains 42; rebinding to 42 succeeds.
These are frontend rejection observations, **not GPU pixel evidence**. The
local optional native WebGL dependencies are unavailable, and this assignment
does not authorize browser execution or installing dependencies.

This is a remaining architectural prerequisite for backend-complete
accumulation. The [OpenGL 1.1 specification](https://registry.khronos.org/OpenGL/specs/gl/glspec11.pdf),
sections 4.2.4 and 4.3.2, requires LOAD/ACCUM to use the selected read image and
RETURN to update the selected draw images. `lib/gl-compat.js` still rejects
those WebGL selections and cross-drawable rebinding before any accumulation
arithmetic could run. Its GPU resources belong to each context, whereas the
new drawable-owned attachments exist in the native software renderer. The CLI
still defaults to WebGL (`test/run.js`), so qualifying software alone would
leave an actual consumer backend incomplete.

The exact next action is to connect the GL WebGL consumer to drawable-owned
front/back color attachments and presentation snapshots, with context state
kept separate from image ownership. Define storage sharing across frontend
contexts, binding, resize and deletion; generic GPU color-resource helpers
alone do not establish that GL contract. Pass selected FRONT/BACK/both/NONE
pixel tests and same-context/two-drawable plus two-context/one-drawable tests
on a real GPU route before accumulation availability. Then implement signed
per-drawable accumulation storage and all five operations, clear, queries,
scissor/masks, list timing, errors and ABI acceptance on every supported route.

The native encoder/worker, software raster/producer, shared render worker,
frame-state, display-list, integer-color and WGL availability/layer-plane
regressions pass, along with generated dispatch freshness and the mandatory
`flock /tmp/wine-build.lock bash tools/build.sh`. Availability testing still
checks the original remaining miss set through both lookup routes, including
error 127, no thunk allocation and ABI preservation.

Evidence: `scratch/runs/20261102-mdk2-accum-after-drawables/`, including fresh
software logs, `webgl-boundary-observations.json`, the exact input/module hashes
and primary-specification design. All **188** remaining names, including
`glAccum` and `glClearAccum`, stay rejected. No original MDK2 replay or
startup/gameplay qualification follows. Box ID/state/expiry: N/A;
coordinator-owned lifecycle is unchanged.

### 2026-11-02: real WebGL drawable prerequisite repaired

The WebGL consumer now owns FRONT/BACK color textures and a shared depth/stencil
attachment per drawable. Contexts share one execution device while retaining
separate frontend resources, raster state and error queues. FRONT_AND_BACK uses
multiple render targets: fragment tests update depth/stencil once, and blending
reads each color destination independently. NONE suppresses color writes without
suppressing depth/stencil. Read selection is independent of draw selection.
Window snapshots retain separate presentation canvases; SwapBuffers exchanges
front/back images. Rebinding, sharing a drawable between contexts, deleting a
context, resize, destroyed/reused windows and single-buffer bitmap targets have
explicit attachment lifetimes. Worker snapshots carry window generations.
WebGL1 requires WEBGL_draw_buffers; unavailable attachments fail context creation
rather than silently substituting one color buffer.

Fresh pixel evidence in
`scratch/runs/20261102-mdk2-webgl-drawable-attachments/` includes the old published
consumer failing FRONT selection with error 1282, then the repaired consumer
passing 167 assertions for each of WebGL1 and WebGL2 on ANGLE Intel UHD Graphics
620 / Mesa 23.2.1. Thirteen worker-endpoint checks and 21 checks in an actual
browser Worker exercise the production command consumer. The browser runs used
one temporary private Boat, serially, without forcing a software renderer.
Coverage includes selected clears/readback, different blend destinations,
single depth/stencil updates, NONE, scissor/masks, bitmap and border shaders,
context/drawable sharing and lifecycle, allocation rollback and invalid modes.
The software direct/queued drawable suite, focused GL/WGL/stream regressions,
188-name rejection checks and mandatory locked build are recorded in that run.

This repairs the demonstrated drawable prerequisite; accumulation storage and
operations remain unimplemented. All **188** unsupported exports, including
`glAccum` and `glClearAccum`, remain rejected. No original MDK2 replay or
startup/gameplay qualification was attempted. Next work is the bounded signed
per-drawable accumulation implementation after the serialized worker gates.

### 2026-11-02: invalid-setter presentation prerequisite reproduced and repaired

The coordinator's state-cache concern is now a demonstrated pixel defect.
An invalid context-facade setter cleared the entire device state cache while
retaining the valid context snapshot. Presentation then disabled blending and
scissor and changed the viewport, but could restore only the emptied cache.
The next draw in that same context skipped activation and used those temporary
presentation settings. The repair rebuilds the device snapshot immediately
after a rejected setter, using the retained valid context state without
consuming the GL error.

The published old backend fails the new drawable regression: half-alpha green
over blue produces `[0,255,0,128]` both inside and outside a one-pixel scissor,
instead of blended `[0,128,128,191]` inside and unchanged `[0,0,255,255]` outside.
An actual browser Worker also fails after `gpuPresent` on the old backend.
The repaired backend passes 321 checks each in WebGL1 and WebGL2, 13 endpoint
checks and 26 actual browser Worker checks. Seven rejected setters exercise
both front-buffer publication and buffer swapping, retained viewport/caps,
and ordinary same-context draw pixels. The browser reports ANGLE SwiftShader;
these are actual WebGL consumer pixels, with no hardware GPU qualification.
All 32 focused native/software/worker/display-list/color/drawable/WGL runs
pass, including direct/queued scalar readback and unsupported-export checks.
Generated dispatch freshness and the mandatory locked build also pass.

Evidence is retained in
`scratch/runs/20261102-mdk2-accumulation-implementation/`. This assignment's
outcome is the newly demonstrated presentation prerequisite and its repair.
Accumulation remains unimplemented; all 188 unsupported names, including
`glAccum` and `glClearAccum`, remain rejected. The next implementation still
needs signed drawable-owned storage, context-owned clear state, all five
operations and complete native/software/WebGL acceptance before availability.
No original MDK2 replay or startup/gameplay claim follows.

### 2026-11-02: genuine signed drawable accumulation implemented

`glAccum` and `glClearAccum` now resolve through both WGL and the ordinary DLL
lookup route. The append-only command ABI adds opcodes 143/144 with two/four
32-bit stack words. Accumulation is a lazily allocated Float32 RGBA image owned
by each drawable, shared by contexts targeting that drawable. Intermediate
negative and extended values survive LOAD, ACCUM, MULT and ADD; RETURN alone
clamps to the destination range. Native 16-bit sources normalize their actual
RGB565/X1555/A1555/A4444 component fields, including implicit opaque alpha.

The clear value is clamped context state, queried by the supported Floatv and
Integerv paths and saved by ACCUM_BUFFER_BIT attributes. PFD and accumulation
bit queries report 32 bits per component, 128 total. Accumulation clear ignores
color masks and draw-buffer NONE. Every operation obeys scissor; LOAD/ACCUM
read the selected source, and RETURN honors selected FRONT/BACK/BOTH/NONE and
all RGBA masks. RETURN updates color storage directly, bypassing fragment
tests and blending; LOAD reads source storage without pixel pack/transfer.
Window resize/destruction, drawable deletion/reuse, DIB deletion, context
switch/deletion and full reset preserve or retire the appropriate storage.

Display lists capture scalars, defer execution-time errors in COMPILE mode,
and execute once in COMPILE_AND_EXECUTE mode. Native software arithmetic fences
pending raster work; its queued consumer mirrors state without repeating the
arithmetic. The WebGL consumer flushes preceding draws and performs signed
operations against actual persistent color attachments, preserving native
pixel-store/PBO/read/draw-framebuffer bindings. Canonical bitmap seeding now
works with draw-buffer NONE: it temporarily selects the bitmap's FRONT
attachment and restores the guest's selection. Native bitmap deletion retires
the borrowed GL descriptor and accumulation image before freeing DIB bytes.

The independent dyadic oracle is: blue LOAD(.5), red ACCUM(.25), MULT(-.5),
ADD(.25) gives `[.125,.25,0,-.125]`; RETURN(2) gives RGBA `[64,128,0,0]`.
Resolved full-WAT direct and queued software tests pass, with 261 retained
signed/pixel observations per route, all 16 masks across four draw selections,
scissored operations, real draw-before-LOAD ordering, native format widths,
clear/query/attribute/list/error/ABI checks, and window/DIB lifecycle tests.
Actual WebGL1/WebGL2 pixels pass 584/588 checks; an actual browser Worker passes
525. The old native source rejects the accumulation export; the old WebGL
consumer fails the pixel oracle. Three native and two WebGL semantic mutations
also fail. These are consumer pixel checks, not a hardware GPU qualification.

All 27 native/software/worker/list/color/drawable/WGL/dispatch/GDI regression
runs pass, as do the existing WebGL drawable suite (321 checks per WebGL
version, 13 endpoint and 26 browser Worker checks), the union-gate negative
regression, generated API/dispatch/ABI freshness and the mandatory locked
`tools/build.sh`. Heavy checks used an exact hashed snapshot in a temporary
sandbox; edits and commits stayed in the shared main checkout. Failed
iterations are retained: a point fixture's column, missing bitmap fixture
metadata, the genuine NONE seeding defect, stale opcode-count assertions and
source-line union attributions.

Evidence, exact input hashes, native pixel observations, actual WebGL results,
old-source/mutation logs, build output and cleanup are retained in
`scratch/runs/20261102-mdk2-accum-implementation-remote/`. Availability remained
rejected until native and WebGL internal acceptance passed. The current
mandatory-export rejection set contains **176** names, including still
unsupported query forms. No original MDK2 replay or startup/gameplay claim was
made; those remaining mandatory exports must be implemented before replay.
