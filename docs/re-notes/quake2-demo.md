# Quake II 3.14 demo

## Package and layout

- Local-only installer: `test/binaries/candidates/quake-2-demo-installer/q2-314-demo-x86.exe`
- Size: 39,015,499 bytes
- SHA-1: `5b4dedc59ceee306956a3e48a8bdf6dd33bc91ed`
- Format: WinZip Self-Extractor around a ZIP containing 277 files,
  59,005,373 uncompressed bytes.
- The installer defaults to
  `C:\WINDOWS\Desktop\Quake2 Demo`; the playable executable is
  `Install\Data\quake2.exe` beneath that directory.

The local dropdown uses a host extraction at
`installed-extracted/Install/Data/`. Its required runtime set is
`quake2.exe`, `ref_soft.dll`, `ref_gl.dll`, `baseq2/gamex86.dll`, and
`baseq2/pak0.pak`. `pak0.pak` is 49,951,322 bytes with SHA-256
`cae257182f34d3913f3d663e1d7cf865d668feda6af393d4ecf3e9e408b48d09`.

## Installer path

The package reaches its WinZip dialog after these formerly missing APIs:

- `OemToCharBuffA`
- `DialogBoxIndirectParamA`
- `GetWindowWord`

Start extraction through the normal guest input path:

```bash
/opt/homebrew/bin/timeout -s KILL 360 node test/run.js \
  --app=quake2_demo_installer --no-build --screen=800x600 \
  --max-batches=1000000 --max-seconds=330 --batch-size=20000 \
  --loop-superops --repaint-every=2000 --quiet-api --quiet-blocks \
  --input=5:0x111:1 --reg-export=/private/tmp/q2-installer-registry.json
```

`5:0x111:1` queues `WM_COMMAND/IDOK` for the guest pump. Do not use
`dlg-click` for this button: it synchronously enters the x86 WndProc from the
host and decompression legitimately exceeds that bridge's 64-round safety
limit.

On 2026-08-25 the run displayed `277 file(s) unzipped successfully`. A
case-insensitive path, length, and SHA-256 comparison against a direct ZIP
extraction reported 277 expected, 277 actual, and no missing, extra, or
mismatched files.

## Registry delta

The completed `--reg-export` snapshot contains 62 entries and is byte-for-byte
identical to a clean pre-extraction snapshot from the same app (SHA-256
`0571abe5d87e78d5934f966882e89710a1d75fbe5c66ddd37db9e1c392eeae1a`).
`tools/registry-snapshot-diff.js` reports no added or removed keys and no added,
changed, or removed values. This WinZip package only unpacks the 277 files; it
does not register Quake II or invoke the nested InstallShield setup. Therefore
the playable `quake2_demo` manifest needs no game-specific `startupRegistry`
entries.

## Launching the installer-produced copy

For an arbitrary extracted path, preload both native game DLLs; the app
registry's `quake2_demo` entry does this automatically for the dropdown:

```bash
/opt/homebrew/bin/timeout -s KILL 140 node test/run.js \
  --exe='/private/tmp/q2-install/windows/desktop/quake2 demo/install/data/quake2.exe' \
  --args='+set vid_ref soft +map demo1' \
  --vfs-include='baseq2/**,ref_soft.dll' \
  --dll-seed='/private/tmp/q2-install/windows/desktop/quake2 demo/install/data/baseq2/gamex86.dll,/private/tmp/q2-install/windows/desktop/quake2 demo/install/data/ref_soft.dll' \
  --no-build --screen=800x600 --max-batches=20000 --max-seconds=100 \
  --batch-size=20000 --no-close --png=/private/tmp/q2-gameplay.png
```

The exact installer-produced files load `gamex86.dll` and `ref_soft.dll`,
create the `Quake 2` window, and render `demo1` in the software renderer at
320x240, 8bpp. Running an arbitrary EXE without preloading `gamex86.dll`
fails with the game's own `FreeLibrary failed for game library` message; that
is an incomplete ad-hoc mount, not an emulator failure.

There was a distinct lifecycle failure after dying in `demo1`: loading the
autosave could reuse the resident `gamex86.dll` HMODULE, but `FreeLibrary`'s
old consecutive-call sentinel was never reset by that successful reload. The
next normal map teardown therefore returned FALSE and Quake raised the same
message. A successful `LoadLibrary` now starts a fresh lifetime for that exact
handle, while two consecutive frees still return TRUE then FALSE for the NSIS
unload-loop compatibility case.

## Browser black-screen report

The browser must be tested separately from the CLI because DirectDraw pixels
pass through a per-window `_dxFrameLayer`, the desktop compositor, and
optionally the WebGL presentation canvas.

On 2026-08-25 the pre-fix manifest (`+set vid_ref soft`) produced non-black
gameplay in all fresh-profile probes: desktop 2D, desktop SwiftShader, hidden
runtime log, and an iPhone-sized page-fullscreen viewport. The fresh demo
automatically enters its attract map; no menu frame appears. The phone capture
has black top/bottom letterboxing around the 4:3 game, but the game crosses the
visible viewport centre and the canvas itself starts at the top of the
viewport.

The dropdown now passes `+set vid_ref gl +menu_main` so users see Quake's
ordinary main menu through the hardware-accelerated compatibility renderer.
The browser scheduler gives `quake2_demo` a 10,000-block slice. The generic
100,000-block default is unnecessarily coarse during immediate-mode startup;
10,000 keeps the renderer cooperative. The later first-frame exit reproduced
at both slice sizes, proving slice length was not its cause. The exact failure
was a missing dynamically resolved legacy presentation entry point, described
below.
`test/test-quake2-demo-web.js` explicitly overrides that production default to
`+set vid_ref soft +map demo1` inside its fresh page because it is the separate
software/DirectDraw gameplay regression. It drives the actual selector and
trusted Launch button, emulates iPhone page-fullscreen, asserts both Quake's own
DirectDraw layer and the visible browser screenshot are non-black, and compares
two raw game-layer frames to prove the demo world is moving rather than
accepting a menu or frozen loading plaque.

## OpenGL renderer gap

This was measured from `ref_gl.dll` and runtime API traces without consulting
Wine source. `ref_gl.dll` dynamically resolves the complete Windows OpenGL 1.1
table: 336 `gl*` names and 21 `wgl*` names. All 357 currently resolve to zero;
there is no OpenGL/WGL implementation in the runtime. That lookup count greatly
overstates the first playable target, because Quake's generated dispatch table
contains wrappers for every OpenGL 1.1 export.

Filtering those wrappers out of the binary's call sites leaves 48 GL functions
called by Quake's renderer code:

- Frame/state: `glAlphaFunc`, `glBlendFunc`, `glClear`, `glClearColor`,
  `glCullFace`, `glDepthFunc`, `glDepthMask`, `glDepthRange`, `glDisable`,
  `glDrawBuffer`, `glEnable`, `glFinish`, `glGetError`, `glGetFloatv`,
  `glGetString`, `glPointSize`, `glPolygonMode`, `glReadPixels`, `glScissor`,
  `glShadeModel`, `glViewport`.
- Immediate geometry: `glBegin`, `glEnd`, `glColor3f`, `glColor3fv`,
  `glColor4f`, `glColor4fv`, `glColor4ubv`, `glTexCoord2f`, `glVertex2f`,
  `glVertex3f`, `glVertex3fv`.
- Matrices: `glFrustum`, `glLoadIdentity`, `glLoadMatrixf`, `glMatrixMode`,
  `glOrtho`, `glPopMatrix`, `glPushMatrix`, `glRotatef`, `glScalef`,
  `glTranslatef`.
- Textures: `glBindTexture`, `glDeleteTextures`, `glTexEnvf`, `glTexImage2D`,
  `glTexParameterf`, `glTexSubImage2D`.

The platform code references seven standard WGL functions: `wglCreateContext`,
`wglDeleteContext`, `wglGetProcAddress`, `wglMakeCurrent`,
`wglChoosePixelFormat`, `wglDescribePixelFormat`, and `wglSetPixelFormat`.
This particular 1998 renderer additionally calls
`GetProcAddress("wglSwapBuffers")` and stores the result in its EndFrame slot.
That spelling is a legacy compatibility requirement of the shipped binary,
regardless of the normal Win32 `GDI32!SwapBuffers` API. Both names therefore
lower to the same backend-neutral presentation operation. Optional SGIS
multitexture, EXT paletted-texture/point, swap
interval, and NVIDIA gamma-ramp symbols can remain unavailable when the
synthetic `glGetString` advertises no extensions.

A rendered probe gets a valid Quake HWND/HDC and succeeds through the existing
`ChoosePixelFormat`, `SetPixelFormat`, and `DescribePixelFormat` handlers. It
then jumps to EIP zero on the first missing `wglCreateContext` call. The zero
HDC seen with `--no-renderer` is only a headless-canvas artifact, not a browser
blocker.

The implemented browser design is a fixed-function OpenGL 1.x frontend over a
generic WebGL/GLES-shaped backend, not a software renderer. It lowers immediate
mode into vertex batches, matrices into uniforms, texture/state operations into
backend resources, and owns WGL context/DC lifecycle plus per-window GPU
presentation. The reusable backend boundary is intentionally suitable for a
future hardware Direct3D frontend.

The focused backend/fixed-function/presentation tests and full API build pass.
In real Chrome, the authentic `ref_gl.dll` loads and
renders both the textured main menu and the GAME difficulty submenu at 640x480.
The production 10,000-block slice also reaches unmistakable Easy gameplay:
textured world geometry, weapon, crosshair, health, and ammo HUD all render.
A normal forward key changed 11,432 of 307,200 pixels between captured frames;
console scrolling, loading backgrounds, context creation, and menus do not
satisfy that acceptance.

## Runtime renderer switch

The dropdown now starts OpenGL directly. A separate lifecycle regression keeps
the user's reported transition path: it overrides only its test-page command
line to start the software-rendered main menu, opens Quake II's Video menu,
selects OpenGL, and Applies. It will distinguish an intentional renderer-DLL
unload/reload gap from a real `ExitProcess` or last-window teardown before
changing runtime semantics.

The first UI capture pins the important control: Right on the selected `driver`
row changes `[software]` to `[default OpenGL]`. Keyboard-only exploratory
probes initially returned to the main menu without applying. The decoded trace
proves that run only called `LoadLibraryA("ref_soft.dll")`, `ddraw.dll`, and
`dsound.dll`; it never requested `ref_gl.dll`, destroyed the window, or exited.
Per-step captures explain why: at the generic 100,000-block browser slice the
first six Down key pairs had not been observed when photographed, the seventh
finally moved the cursor to Reset, and Enter activated Reset rather than Apply.
Waiting until the host queue drained was still insufficient because Quake polls
key state and an immediate synthetic down/up can be invisible by the time the
guest checks it. Absolute mouse clicks likewise left the selection on `driver`.
The acceptance therefore lowers only the post-menu slice to 10,000 blocks,
holds each key across several cooperative slices, waits until its events drain,
saves all seven cursor positions (Reset is skipped by keyboard navigation), and
presses Enter on the real Apply row. This
changes scheduler granularity, not the production manifest, command line, or
renderer choice.

## First-frame OpenGL exit

The production cold start later regressed to a visible menu followed by
`EIP=0`. Instrumentation ruled out `ExitProcess`, `DestroyWindow`, last-window
grace shutdown, a WebGL exception, and missing optional extensions. The final
512 guest GL calls were valid texture uploads and immediate-mode menu quads;
the final one was `glGetError` returning `GL_NO_ERROR` inside ref_gl's exported
EndFrame routine at original VA `0x1000e060`. The next indirect call at
`0x1000e087` jumped through zero.

Static slot mapping identifies `[0x10052dbc]` as the result of
`GetProcAddress("wglSwapBuffers")`. Removing that legacy alias during an API
cleanup made the first real EndFrame call NULL before any present. Restoring
the name as a one-argument stdcall alias to generic GPU present fixes the exact
failure without a Quake-specific address patch. A focused regression now
asserts that the static GetProcAddress name table exposes it, its stack cleanup
is correct, and both it and `GDI32!SwapBuffers` reach opcode 55.

The next gameplay attempt exposed a separate generic bridge bug at runtime EIP
`0x00cab7d9` (ref_gl original VA `0x1000a7d9`), immediately before its
`glVertex3fv` call. The recorded vertex pointer was `0x4e306050`, in Quake's
high sparse `VirtualAlloc` arena. The old JS bridge subtracted the main image
base directly and produced host offset `0x4df18050`, outside the 512 MiB WASM
memory, causing the reported DataView bounds error. Pointer-bearing GPU calls
now use the emulator's exported canonical `$g2w` translator, which understands
the direct image window, DIB arena, and sparse mappings. The focused regression
maps that exact guest address to backing `0x10006050`, and the real Chrome
gameplay run subsequently renders and moves without the fault.

## Gameplay light flashes

The initially reported harsh light flicker is present in the raw WebGL
framebuffer, before the browser compositor sees it, but it is not random state
or presentation corruption. A no-input Chrome probe intercepted 12 consecutive
`SwapBuffers` calls (write sequences 45 through 56), read every 640x480 RGBA
frame directly with `gl.readPixels`, and recorded the complete GL call stream,
texture updates, and terminal raster state for each frame.

The bright sequence visibly contains Quake's scripted opening explosions:
fireball geometry and orange particles enter the scene as mean framebuffer
luma rises from 13.46 to 32.25, then fade as it falls through 29.80, 27.21,
24.48, 21.84, and 19.08. The peak is not an unexplained full-screen toggle. It
coincides with three `glTexSubImage2D` writes to lightmap texture 1024, chiefly
a 128x67 atlas strip; the preceding frames update 128x49 and 128x61 strips as
the same visible blast grows. Captures are under
`scratch/quake2-gl-flicker/flash/`.

The GL state sequence remains structurally stable throughout. Every captured
frame restores depth writes, `GL_LEQUAL`, normal alpha blending, and the same
end-of-frame 2D state; there is no alternating depth, blend, cull, scissor,
texture-enable, or presentation state. Write sequences are consecutive, so
the compositor is neither repeating nor skipping between two surfaces.

A later no-input control captures the explosion disappearing and the same
view settling. Across its final six frames, mean luma stays between 13.99 and
14.12 (under 0.9% spread); remaining changed pixels are the weapon idle
animation and a few particles. Even frames with dozens of small updates to
lightmap textures 1035-1037 remain in that brightness band, which rules out the
subimage path itself randomly corrupting illumination. Those captures and the
per-frame JSON traces are under `scratch/quake2-gl-flicker/settled/`.

That stationary evidence did not cover a separate movement-only presentation
bug. A trusted mouse-look probe caused the compositor to repaint at time
112493.1 after 645 `glEnd` draws of the next frame but before `gpuPresent`
sequence 71 at time 113462.5. The resulting screenshot was a bright,
incomplete base-texture pass with no weapon, HUD, or lightmap. The compositor's
GPU layer directly referenced the WebGL canvas on which the guest was still
drawing; pointer movement merely supplied the otherwise-unrelated repaint
that exposed it.

The generic WebGL/GLES backend now separates its live draw canvas from a
compositor-visible 2D snapshot. Only `present`/`SwapBuffers` flushes and copies
a completed GPU frame into that snapshot, so keyboard, mouse, window, and
desktop repaints between cooperative guest slices retain the preceding whole
frame. This ownership boundary is backend-generic and can also be used by a
future accelerated Direct3D frontend. `test/test-gpu-atomic-present.js` proves
that partial drawing cannot mutate the exposed surface and that explicit
present publishes one complete, correctly resized, pixel-exact snapshot.

The conspicuous no-input explosion flashes remain authentic scene content
made harsher in wall time by the low guest frame rate.
`test/test-opengl-frame-state.js` locks the generic invariants exercised here:
lightmap subimages update only the selected texture, multiplicative blending
and disabled depth writes do not leak past the lightmap pass, sparse bytes are
copied unchanged, and one GPU present produces exactly one repaint and one FPS
event.

## Gameplay input

Quake's keyboard path consumes the Set-1 scan code in Win32 message `lParam`,
not merely the `wParam` virtual-key value. Browser keyboard events now carry
their physical DOM `code` through the renderer so `WM_KEYDOWN`/`WM_KEYUP`
include the scan, extended, previous-state, and transition fields. In the
production GL acceptance, a trusted held `W` reached the host input queue as
`WM_KEYDOWN lParam=0x00110001` and `WM_KEYUP lParam=0xc0110001`; the renderer's
held-key state remained down after the message queue had drained, cleared after
the release was consumed, and the forward step changed 6,660 of 307,200 pixels.

The remaining mouse problem was at the browser boundary. An API trace of real
gameplay shows Quake calling `SetCursorPos(159,119)`, `ClipCursor`, and
`ShowCursor(FALSE)`, then polling `GetCursorPos` continuously. The virtual
Win32 cursor honored those calls, but the physical DOM cursor stayed absolute:
after Quake recentered its virtual point, the next DOM coordinate was measured
against a centre the physical cursor had never visited. Mouse look therefore
accelerated incorrectly and stopped at the browser edge.

The browser now requests pointer lock from a trusted canvas mouse-down only
when an exclusive guest presentation has an active `ClipCursor` region. While
locked, `movementX/Y` is scaled into logical-canvas space and applied relative
to the guest cursor that `SetCursorPos` controls, then passes through the normal
mapped `WM_MOUSEMOVE` path. Releasing `ClipCursor` or running an ordinary
desktop window retains absolute mouse behavior. The renderer regression covers
the inverse transform at 2x scale, explicit guest recentering between samples,
Win32 queue coordinates, and the inactive-clip negative control.

`test/test-quake2-input-web.js` drives the exact dropdown
`+set vid_ref gl +menu_main` path with trusted browser events. Its final run
recorded the active `[0,0,639,480]` clip, acquired real pointer lock, routed six
nonzero relative samples, visibly changed the camera, and saved the input queue,
mouse deltas, and screenshots under `scratch/quake2-input-web/`.

One boundary remained before capture. Pointer Lock requires a trusted click,
but ordinary absolute `mousemove` events were still delivered after Quake hid
and clipped its cursor and before that click occurred. Quake polls the offset
from `(159,119)` and recenters its virtual cursor every frame; the browser's
physical cursor does not follow that guest-only `SetCursorPos`. Each small DOM
move therefore reintroduced the whole physical distance from centre, making
the view rotate faster the farther the pointer wandered. The browser bridge
now holds absolute moves while a relative exclusive guest is awaiting Pointer
Lock. The acquisition click still reaches the guest and starts relative
`movementX/Y`; nonexclusive desktop applications retain their ordinary
absolute hover and move path.

Pointer Lock must be requested synchronously inside the trusted click. A trial
of its `unadjustedMovement` option broke capture on browsers which reject that
option: the Promise rejection arrives after transient user activation has
expired, so an optionless retry cannot lock. Capture therefore uses one plain,
synchronous request. Reliable unbounded motion takes priority over raw-device
deltas until support can be selected before consuming the user gesture.

The browser bridge accepts both the standard Pointer Lock names and WebKit's
older prefixed request, lock-element, and change-event names. This matters on
macOS Safari builds which support Pointer Lock but expose some or all of that
surface under `webkit*`; the request remains synchronous in both branches.

Quake is also marked `relativeMouse` in its app manifest. The browser shell
carries that declaration onto the live app record, and the input bridge uses
it whenever Quake owns an exclusive presentation. Its late
`ClipCursor`/`ShowCursor` timing is therefore no longer an eligibility race:
the capture click asks for Pointer Lock even if Safari reaches the click before
the guest's current frame has published its cursor state.

## Threads/OpenGL throughput

The severe slowdown with the browser Threads switch is not a guest lock or a
bad interaction between Quake threads. An isolated-Chrome `+set vid_ref gl
+map demo1` probe on 2026-08-27 found zero `CreateThread` workers: the switch
only moved Quake's one main thread into guest Worker slot 0. The regression is
the synchronous host-import boundary. Every OpenGL entry reaches
`gpu_gl_call`, and in Worker mode each call posts to the browser main thread
and parks in `Atomics.wait` until the WebGL frontend returns.

The settled six-second measurements used the same current worktree, fresh
profiles, 640x480 scene, 10,000 configured block slice, hidden runtime log, and
headless Chrome SwiftShader:

| mode | completed presents | scheduler guest rate | GL calls | sync RPC delta | async RPC delta |
|---|---:|---:|---:|---:|---:|
| cooperative | 36 | 3.85M blocks/s | 786,684 | 0 | 0 |
| guest Worker | 6 | 0.259M blocks/s | 110,493 | 110,358 | 221,136 |

Scene motion makes exact calls per frame vary, but both runs were in the same
range: about 18,000--22,000 GL entries per present. One representative Worker
frame contained about 6,400 `glTexCoord2f`, 6,400 `glVertex3fv`, 2,750
`glColor4f`, and 1,286 `glBegin`/`glEnd` pairs. The sync-RPC delta is one-for-one
with those GL calls. The two async messages per call are dispatch `log` and
`log_api_exit`; their browser handlers are no-ops with runtime logging hidden,
but the generic Worker broker still posts them. This is why changing the Worker
block slice cannot solve the problem. The current adaptive probe fell from the
10,000 configured ceiling to 1,000 blocks, but the per-GL-call rendezvous
remained.

There is a separate non-Threads cost in this software-GPU measurement.
Cooperative `glGetError` took 3.23 seconds across 36 frames, about 90 ms per
frame, because it synchronizes the queued SwiftShader work. That explains why
the cooperative baseline is not fast on this host; it does not explain the
roughly 6x Worker frame loss or 15x scheduler-throughput loss. Real hardware
must be measured independently before quoting those absolute frame rates.

The useful fix boundary is a Worker-side GL command stream, not a larger guest
slice: capture value arguments and copy pointer-backed data while it is valid,
then replay a frame-sized batch on the browser thread. Flush before operations
whose return or output is guest-visible (`glGetError`, `glGetFloatv`,
`glReadPixels`, WGL lifecycle calls), and at `glFinish`/`SwapBuffers`. Suppress
the no-op dispatch-log messages in the same fast path. This removes the
cross-thread rendezvous per vertex/state call. It does not reduce the roughly
1,300 WebGL draw submissions per frame; combining compatible `glBegin`/`glEnd`
batches is a second optimization after the RPC boundary is fixed.

That command stream is now the only normal transport in both modes.
`gpu_gl_call` records arguments into a 2 MiB local buffer; capacity pressure
submits a batch without presenting, while queries/readback, WGL lifecycle,
`glFinish`, and `SwapBuffers` synchronously replay the ordered stream. Worker
dispatch logging for GL stays local unless verbose/API tracing is enabled.
Replay carries the originating Worker slot so concurrent guest GL threads keep
their own WGL current-context binding across delayed batches.
Small client arrays (vertices, colours, matrices, texture-name lists) are copied
at call time because the guest may reuse them before the batch flushes.

Texture images use a different lifetime rule to avoid copying the large payload.
The encoder appends texture metadata naming the original shared guest allocation
to older buffered commands and synchronously submits the combined batch. The
guest remains parked
until browser-thread replay has passed that direct typed-array view to WebGL,
so the allocation cannot be changed or freed while borrowed. A real Chrome
SwiftShader run accepted this SharedArrayBuffer-backed upload path, including
live `glTexSubImage2D` updates; no compatibility copy was needed.

A matched post-change six-second run completed 20 Worker presents versus 26
cooperative presents. The prior matched result was 6 versus 36, so the relative
Worker throughput rose from 17% to 77% of cooperative. The Worker executed
389,533 GL commands in that window without a per-command host round trip and
reported no browser errors. Remaining time is now dominated by the explicit
per-frame `glGetError` barrier under SwiftShader: 4.14 seconds for 21 Worker
calls and 2.95 seconds for 26 cooperative calls. That is a separate GL error
semantics/software-GPU issue, not command transport; removing it would require
maintaining a trustworthy frontend error shadow rather than silently returning
`GL_NO_ERROR`.

The next CPU pass compiles each valid immediate-mode `glBegin`/`glEnd` block in
the encoder. Per-vertex color and texture-coordinate calls update local state;
the resulting positions, colors, and coordinates are emitted as one interleaved
packed draw record. Fans, strips, quads, and line strips/loops are expanded to
independent triangles or lines so adjacent records with unchanged render state
can be concatenated safely. Replay flushes that merged geometry before any
ordinary state command, query, texture operation, context transition, or
presentation. This both removes thousands of small replay operations and
reduces WebGL buffer uploads/draw calls for runs of compatible surfaces.

The WebGL backend now caches the active program, buffer/texture bindings,
uniform values, capability/raster state, enabled attributes, and complete
attribute-pointer layout. The fixed-function frontend independently marks only
changed matrix/scalar shader uniforms dirty. Repeated draws therefore retain
their established program, matrices, scalar uniforms, and three interleaved
attribute pointers rather than reissuing them. Borrowed texture uploads also no
longer pre-flush older commands: the normal case is one ordered synchronous
submission instead of two, while buffer overflow still submits as required.

An isolated SwiftShader verification of this pass rendered the live `demo1`
scene without browser/runtime errors in both cooperative and real Worker modes.
The representative pre-change sample had about 19,353 transport commands and
1,293 WebGL draws per frame. The post-change cooperative sample had about 1,557
commands, 1,297 packed immediate blocks, 58 actual WebGL draws, 31 dirty-uniform
submissions, and 7.8 batches per frame. Worker mode had about 1,540 commands,
1,292 packed blocks, 55 WebGL draws, 30 dirty-uniform submissions, and 5.2
batches per frame. Thus packing removed about 92% of replay commands and
compatible merging removed about 96% of WebGL draw submissions; uniform
submission fell by over 99% from the former ten calls per tiny draw. Batch rate
now follows texture uploads plus the three normal per-frame barriers, without a
second pre-upload batch. A cooperative CPU trace with `glGetError` temporarily
excluded found `uniformMatrix4fv`, `vertexAttribPointer`, attribute enable, and
`drawArrays` reduced from the former prominent samples to collectively below
0.1% of all trace samples. This exclusion was profiling-only; runtime error
semantics remain unchanged.

### Command decode allocation cleanup (2026-08-30)

The OpenGL hot-path item in `fable-review.md` was still current. The Worker-side
encoder's `u32At()` constructed a `DataView` for every 32-bit stack argument,
even though the WebAssembly memory buffer is fixed, and browser-thread replay
did the same in `_u32`, `_f32`, and `_f64`. Both sides now retain one view per
backing buffer. Immediate primitive normalization also writes vertices directly
from source indices instead of allocating `slice()` arrays and then `splice()`ing
flat colors into each triangle. Required expansion of quads/fans/strips and the
command-owned packed-vertex copy remain: the former supplies WebGL-supported
primitive topology and the latter prevents guest scratch reuse from changing an
asynchronous batch.

The identical `test/test-quake2-gl-web.js` gameplay acceptance passed before
and after at 640x480 with textured motion. It reported 13.7 guest fps before and
15.8 after (+15.3%). This is directional only: system load was far above the
project's `<4` validity threshold (roughly 188 falling to 17), and the attract
scene positions differed. The focused command-stream, fixed-function,
frame-state, backend, and atomic-present tests all pass. Re-measure headful on
an idle host before treating the observed delta as a user-visible gain.

The stream is still a single 2 MiB buffer with a synchronous handoff per flush,
not a producer/consumer ring. A multi-slot ring can overlap copied command and
packed-vertex replay with guest encoding, but borrowed texture uploads and all
query/readback/context/finish/present operations must remain fences. Profile
batch replay versus the existing `glGetError`/SwiftShader wait before building
that larger change; prior Quake measurements already found the explicit error
barrier dominating the software-GPU configuration.

## Pointer-lock button release

A cooperative browser regression after the GL optimization exposed a separate
input bug: firing once could leave Quake firing indefinitely. The trusted DOM
`mouseup` was present, and the renderer's host mouse-button mask changed from
one to zero, but pointer lock reported unusable `clientX/clientY` coordinates
at `(0,0)`. That point was outside the exclusive presentation viewport, so
`handleMouseUp` returned before it queued `WM_LBUTTONUP`; Quake retained its
own button-down state.

The browser input bridge now derives pointer-locked button-up coordinates from
the guest's current virtual cursor through the inverse exclusive-presentation
transform. Ordinary unlocked releases still use DOM client coordinates. The
bridge also retires a held guest button when a later pointer-lock move reports
no physical buttons, pointer lock is lost, the window loses focus, the page is
hidden, or another press arrives without an observed release. Those recovery
paths cover browser/OS transitions that can omit `mouseup` entirely. The real
cooperative `test/test-quake2-input-web.js` acceptance now performs twelve
clicks after pointer lock is active and proves every trusted down/up pair
reaches the Win32 queue as `WM_LBUTTONDOWN` followed by `WM_LBUTTONUP`, with the
renderer mask released after every cycle.

The dropdown also mounts a first-launch `baseq2/config.cfg` with WASD movement,
permanent mouse look, mouse-one fire, mouse-two/Space jump, Ctrl/C crouch, mouse
wheel weapon selection, always-run, and a crosshair. The original `default.cfg`
still supplies every binding not explicitly modernized. Browser persistence is
enabled for this config: an existing saved config is restored after the bundled
default is mounted, and later in-game customization is saved, so the defaults
do not overwrite user choices on subsequent launches.

## Multiplayer over the virtual LAN

Quake II's network layer is plain UDP. The only WSOCK32 imports are by
ordinal: `socket`, `bind`, `setsockopt` (`SO_BROADCAST`), `ioctlsocket`
(`FIONBIO`), `sendto`, `recvfrom`, `closesocket`, `htons`/`ntohs`,
`inet_ntoa`, `gethostbyname`, `WSAStartup`, `WSAGetLastError`. The server
listens on 27910 and the client on 27901. `src/09d-winsock.wat` already
serves all of it, so **no Quake-specific emulator work was needed**: the
first two-process attempt (2026-09-20) put a client into a deathmatch.

```bash
node tools/vlan-pair.js --log-dir=/tmp/q2lan \
  -- --app=quake2_demo --args='+set vid_ref soft +set deathmatch 1 +set maxclients 4 +map demo1' \
     --trace-net --quiet-api --quiet-blocks --batch-size=20000 --max-batches=100000000 --max-seconds=200 --no-close --png=/tmp/q2lan/host.png \
  -- --app=quake2_demo --args='+set vid_ref soft +connect 10.0.0.1' \
     --trace-net --quiet-api --quiet-blocks --batch-size=20000 --max-batches=100000000 --max-seconds=200 --no-close --png=/tmp/q2lan/client.png
```

Read the client's send sizes in order (`grep '\[net\] ->' seat-2.log`):

| size | what it is |
|---|---|
| 17 | `getchallenge` |
| 92 | `connect` + protocol, qport, challenge, userinfo |
| 26-32, with 10-byte keepalives | signon stages (`new`, configstrings, baselines, `begin`) |
| 25 | one usercmd per frame: the client is in the game |

In that run the client sent ~120 `getchallenge`/`connect` pairs before one
was answered. **That is not a reconnect loop.** It is Quake's own 3-second
resend while the server loads `demo1`, and the client stops for good once it
gets in. After that there were 1,343 usercmds against 1,428 server packets,
and the two captures show two different players on `demo1`.
`test/test-quake2-vlan-gameplay.js` is this run as a gate.

Server discovery works as well. Started 120s after the server, a client
opened with `+menu_joinserver` broadcasts `info` to
`255.255.255.255:27910`, and the server answers `10.0.0.2:27901`
directly. So in a browser room **either seat may host**: the joiner's list
is filled by broadcast, not by assuming the server is at `.1`.

**Other players drawn as a yellowish diamond** (first real browser match,
2026-09-20) is `ref_gl`'s `R_DrawNullModel`, the stand-in for an entity whose
model did not load. The demo ships its player models loose in
`baseq2/players/{male,female}/` (59 files, `tris.md2`, `weapon.md2`, skins and
`_i` icons), *outside* `pak0.pak`, and the registry mounted only the pak. Gibs
(`models/objects/gibs/`, in the pak) looked fine, which is the tell. The
manifest now mounts all 59. With them, `+menu_playerconfig` renders the grunt
preview, and it could not before.

**Solo play never makes a socket.** A `+map demo1` run calls `WSAStartup` and
nothing else from WSOCK32. Quake opens its UDP sockets only from `NET_Config`,
i.e. once a player starts or joins a network game. So `$handle_socket` asks
`host_net_link_open` first, the same question DirectPlay's `DPOPEN` asks, and
the registry entry sets `lan.onDemand`. The browser lobby then appears at
*Start/Join Network Server* and never in a single-player game. Hosts without
a lobby (the CLI, every non-`onDemand` app) answer 1 immediately.

### The star room and the host probe (2026-09-20)

The browser no longer shows a lobby for Quake II. `lan.room: 'auto'` in
`lib/apps.js` puts it in a **star room** (`lib/vlan-room.js`,
`lib/vlan-star.js`): whoever gets there first is the owner at `10.0.0.1`,
everyone else holds one link to the owner at `.2` and up, and the owner routes
member↔member frames.

**The wire cannot tell a server from a client**, because a Quake II client
binds 27910 just as a server does. So the owner's page asks its own guest the
way a server browser does: `\xff\xff\xff\xffinfo 31` from seat `.254`, whose
answer is caught before it reaches the wire. Only `SVC_Info` on a server with
`maxclients > 1` answers, and its status line ("noname demo1 0/4") labels the
Join card. **The protocol is 31, not the retail 34.** The demo's
`CL_PingServers` pushes `0x1f` beside its `"info %i"` (exe `0x4094bb`), and a
34 gets "wrong version". `test/test-quake2-host-probe.js` runs the real game
both ways: the server answers, and a client stays silent through 77 questions.

**An unread UDP socket used to freeze the whole wire.** A client binds 27910
and never reads it, so the first broadcast `info` or probe landing there filled
the slot, and `$vsock_deliver` stalled every later frame behind it. That did
not matter with two players and breaks at three. Each UDP socket now carries
"patience" (VSock flags bits 16-23, `$VSOCK_UDP_PATIENCE` = 64). It is topped
up on every `recvfrom` and spent on each stall. At 0 the datagram is dropped,
as a real stack drops into a full receive buffer.

Joining from the card launches with `lan.join.launchArgs` (`+connect {host}`),
leaving out `lan.join.dropArgs` (`+menu_main`, which would sit over the match).

A game that is already running when the room is joined (the mid-game toast)
is joined by `lan.join.inGame`, which types `connect {host}` into the console.
**The console key is the trap:** `Con_ToggleConsole_f` (exe `0x415710`) runs
`d1`, the attract demo, while `cls.state` (`0xa86a60`) is 1 (disconnected),
so a blind `` ` `` at the menus opens nothing and the menu eats the rest; the
first try landed in the Game submenu. The recipe reads `cls.key_dest`
(`0xa86a64`, 3 = menu) and presses Escape until the menus are closed. While
disconnected, `key_game` already feeds `Key_Console`, so typing is enough; in
a level, `` ` `` opens the console first. `test/test-web-quake2-room.js`
covers both joins across three browsers.

## 2026-09-22: `demo1` gameplay on the WAT software GL path

`ref_gl` through `--gl-renderer=software` renders Outer Base — world,
lightmaps (multi-pass: `GL_SGIS_multitexture` is reported absent), view
weapon and HUD. Loading is the slow part: at `--batch-size=20000` the console
still reads `loopback: client_connect` after 200s; at `--batch-size=100000` the
level is up inside 300s.

```
node test/run.js --app=quake2_demo --no-build --gl-renderer=software \
  --args='+set vid_ref gl +map demo1' --quiet-api --quiet-blocks \
  --stuck-after=1000000 --batch-size=100000 --max-batches=99999999 \
  --max-seconds=300 --no-close --gl-census --png=out.png
```

Census at exit: 4,710,009 triangles, 101,281 dropped at the eye plane,
1,065,868 culled, 1,570 presents, 217 texture uploads, none refused.

## 2026-10-08: ordinary `ref_gl` gameplay on emulator software OpenGL

Fresh temporary-browser run
`scratch/runs/20261008T000901Z-quake2-software-ordinary/result.json` passes the
registered Game → Easy → forward/reverse/idle route with the original
`+set vid_ref gl +menu_main` arguments. No `ref_soft` switch, console command,
forced control, guest-state edit, or asset patch was used. Enter was held
750 ms on Game and on Easy; W and S were each held 1000 ms through ordinary
browser input, after personally reviewing the preceding screenshot.

Six captures were personally reviewed. `loading-1.png` already shows the
textured world, weapon, crosshair, and health HUD, by 49.617 seconds after the
Easy-selection command. Forward approaches the diagonal support until it
fills the central view and occludes the wall emblem. Reverse restores the
wider room, support base, and right-wall emblem; idle retains that geometry.
These landmarks establish actual viewpoint translation, beyond weapon bob.

Every capture records `gl-renderer=software`, the live host GL endpoint's
`software` option, and the same option read directly from the owning renderer
Worker's endpoint table. The unchanged `gl-render-worker.js` passes that
option to `OpenGLHostBridge`; its software context branch creates the WAT
raster backend directly without creating or falling back to a WebGL GL
context. The ordinary GL presentation layer advances throughout gameplay.
A generic legacy endpoint is also initialized with `webgl`, and the unchanged
synthetic GL renderer string says `WebGL fixed function`
(`src/01-header.wat`). Both observations are retained; neither identifies the
selected GL backend. The proof concerns this `ref_gl` workload, not an absence
of every WebGL facility in the browser.

This is an explicitly accepted **reference-build validation**: module
`fb1be916c309bf619a9331c8fd46c4319f9051af76b05b236d3c362bb632638f`, built source
`096889e174488a97529b8e73076d3a1e2feb2345`, and its entire unchanged matching
host closure. All 325 host files match that Git object; with the module these
are 326 runtime source pins, alongside 66 original fixtures and seven harness
files. All 399 pins passed before launch and after cleanup; originals were
also rehashed locally. This does not certify a newly built current main.

Chrome exited 0, browser/server closed, streams drained, and driver/Chrome
process absence and listening-socket baseline were independently checked.
The owned remote prefix was removed after the complete runtime archive and
captures were durably copied and hash-verified. Twelve refused local unpinned
VLAN publisher API requests remain in the raw errors; network play is
unqualified. One room and one traversal cycle were tested; combat, level
completion, FPS, and audio were not qualified. See
[the software handoff](../../ops/handoffs/quake2-software-ordinary-20261008.md)
for exact identity, timings, backend proof, resource grant, and cleanup.

## 2026-10-30: native browser movement, firing, death and autosave reload

Run `scratch/runs/20261030T2210Z-quake2-browser/result.json` records a fresh
local Chrome 151 profile using the registered `quake2_demo` selector and
Launch button, unchanged `+set vid_ref gl +menu_main`, and ordinary trusted
browser input. Game → Easy enters Outer Base (`demo1`). W approaches the
diagonal support until it occludes the room; S restores the wall emblem and
wider view. Mouse-one under pointer lock produces visible blaster bolts,
impact sparks and dynamic lighting. Held guest `in_attack` has key 200 and
state 5; after release key is 0, state 4 (held bit clear), and the host mouse
mask is 0.

Native W/arrow-key navigation reaches the lower room. An enemy attacks:
inspected captures show health 100 → 73 → 61 → 0 and the rolled death camera.
Enter opens the ordinary Load Game menu with `ENTERING Outer Base` selected;
a second Enter loads that autosave. The starting view and health 100 return.
Further W/S movement and a new mouse-one burst work after reload, including
visible projectile/impact captures and cleared attack state after release.
No console command, guest-memory write, asset modification, or forced input
handler was used. No runtime blocker reproduced and no repair was made.

This run uses game **`ref_gl`**, emulator **WebGL 1**, and Chrome ANGLE
**SwiftShader**. SwiftShader is the browser's software GPU implementation;
this is neither game `ref_soft` nor the emulator's WAT software GL backend.
The live layer owns a `WebGLRenderingContext`; guest threads and render
workers were disabled. The retained, actually downloaded module is
`d69d1158f7707c8f46d5f4c0909494913db73bfcb745ca1a3f320be9ad62db91`.
Launch HEAD was `24af711e78857d8d22adfba794d235447017de90`; the shared tree
had another worker's uncommitted GL changes, so the compiled source commit
is **unknown**, not certified as a pristine build of that HEAD. Served file
hashes and the launch diff are retained. The 67 registered file hashes
include 65 original extracted assets and the two host control/source files;
all remained unchanged. The original installer was absent, so no new full
installer/extraction comparison is claimed. `pak0.pak` matches the documented
SHA-256 above.

The screenshots and input timestamps were reviewed directly. Coverage is
one death/autosave cycle, movement and blaster firing before and after it;
enemy defeat, level completion, hardware GPU behavior, audio quality, FPS,
networking and WAT software rendering remain untested here. Own browser and
both local server/controller ports were closed and checked; no Boat was used.
The static harness also logged HTTP 404 responses; their URLs were not captured,
and they are not evidence of successful network or service integration. No
page exception, guest trap or `FreeLibrary failed` message was recorded.

## 2026-10-30: retained-module native gameplay on emulator software OpenGL

Run `scratch/runs/20261030T2220Z-quake2-software/result.json` passes the
registered selector/Launch → Game → Easy → Outer Base route with unchanged
`+set vid_ref gl +menu_main`. The browser URL selects
`gl-renderer=software`; the game still uses original **`ref_gl`**, never
`ref_soft`. The static server routes the module request to the prior browser
run's exact retained module, SHA-256
`d69d1158f7707c8f46d5f4c0909494913db73bfcb745ca1a3f320be9ad62db91`.
Its compiled source commit remains unknown; this does not certify current main.

Actual loaded-module counters prove the emulator WAT raster path is active:
`gl_sw_enabled()` is 1, triangles advance from 1,050,157 to 1,466,293,
and software presents from 451 to 604. Both samples report 1,422 texture
uploads and zero unsupported uploads. The window has no WebGL frame layer.
Guest threads and the render Worker are disabled. The generic GPU dropdown
still reads WebGL, the synthetic guest GL renderer string still says WebGL
fixed function, and Chrome was launched with SwiftShader flags; none of those
labels overrides the directly observed WAT software-raster counters.

Personally inspected captures show native W moving toward the diagonal support
until it occludes the room, and S restoring the wider view and wall emblem.
Mouse-one under pointer lock produces blaster bolts/impact particles and
dynamic yellow illumination. Five held-fire samples read guest attack key 200,
state 5, host mouse mask 1; release reads key 0, state 4, mask 0. The saved
timeline contains trusted browser events only. No console command, guest-memory
write, forced handler, asset modification, or runtime repair was used.

All 67 registered file hashes, including 65 original extracted assets, match
the preceding run; the documented pak hash also matches. The installer remains
absent, so this is not a fresh installer/extraction comparison. Served runtime
hashes and the exact downloaded module are retained. Coverage is the starting
room, movement and blaster firing/release; combat progression, death/reload,
level completion, audio, FPS, networking and Worker rendering are untested in
this software run. Static-harness HTTP 404 messages remain; no page exception,
guest trap or `FreeLibrary failed` message was observed. Own browser and server
ports were closed and checked, profile removed, no Boat used, and /home free
space remained above 2 GB. No blocker reproduced and no code repair was needed.

## 2026-10-30: native combat, death and autosave on WAT software OpenGL

Run `scratch/runs/20261030T2225Z-quake2-software-combat/result.json` advances
native W/arrow-key movement into the lower area with debris, medkits and a
live armored enemy. Trusted mouse-one bursts produce blaster impact particles
and light. Enemy attacks reduce player health 100 → 73 → 43 → 0; the rolled
death view appears behind the ordinary Load Game menu with `ENTERING Outer
Base` selected. Enter restores the autosave's starting room and health 100.
Postreload W movement approaches the diagonal support, and a fresh blaster
burst produces visible particles and yellow illumination. Five held-fire
samples have key 200/state 5/mouse mask 1; release clears these to key 0/state
4/mask 0. A further close enemy encounter reaches health 32 and a second
health-zero death. Further ordinary mouse attack starts another autosave load;
that second reload's completed movement was not inspected.

The close enemy, red particles and native firing attempts were inspected, but
**enemy damage and defeat remain unverified**. The corpse already present by
the debris is not credited as a kill. This run verifies player damage/death,
one completed ordinary autosave reload and resumed movement/fire, not enemy
health accounting or level completion. No console command, guest-memory write,
synthetic game state, forced input handler or asset edit was used. No runtime
blocker reproduced and no repair was needed.

This is original **`ref_gl` on emulator WAT software OpenGL**, not `ref_soft`.
Actual loaded-module `gl_sw_enabled()` remains 1; triangles advance
313,125 → 4,327,627 and presents 183 → 1,720, with zero unsupported texture
uploads. The window has no WebGL frame layer; guest threads and render Worker
are disabled. Generic WebGL UI/string labels and Chrome SwiftShader launch
flags do not supersede these actual backend counters.

The exact retained and downloaded module remains
`d69d1158f7707c8f46d5f4c0909494913db73bfcb745ca1a3f320be9ad62db91`;
its compiled source commit is explicitly **unknown**. This is not certification
of a fresh current-main build. All 67 registered file hashes, including 65
original extracted assets, match the preceding software run; the known pak
hash matches. The installer remains absent. Served host/module hashes, native
input timestamps, reviewed captures and scoped checks are retained in the run.
Focused module/assets/backend/native-input/release/cleanup checks pass. No
page exception, guest trap or `FreeLibrary failed` was recorded; static-harness
HTTP 404 messages remain. Audio, FPS, networking and Worker rendering are not
qualified. Own Chrome and both servers closed, ports checked, profile removed,
no Boat/test boxes used, and /home free space stayed above 2 GB.

## 2026-10-30: bounded WebGL combat attempt; defeat still unverified

Run `scratch/runs/20261030T2334Z-quake2-combat/result.json` reuses the
retained module and original extraction through registered Launch → Game →
Easy. Inspected captures show the lower debris doorway, a live armored enemy
in its corridor, native blaster bursts, player health 53 → 17 → 0, and ordinary
Enter autosave reload to health 100. A second approach collects normal health
pickups (102 and 114 visible), encounters the enemy again, then loses health
90 → 20 → 0. A second ordinary autosave completes. The final approach remains
in the starting room. **Enemy defeat and subsequent room progression are not
verified.** Close enemy poses and red particles do not establish a kill; the
corpse by the debris predates combat. The filenames `enemy-down.png` and
`next-room.png` actually show the player's death/Load Game menu, as explicitly
recorded in `inspected.json`.

The concrete execution limit was two player deaths during close corridor
aiming; no emulator blocker or causal runtime repair was proven. Short native
arrow holds produced uneven observed turn distances, but this run does not
establish an input implementation defect. A direct CDP relative-motion
experiment was visually inconclusive and temporarily resized the viewport to
800×600; subsequent native commands restored 1024×768. All recorded DOM inputs
are trusted browser events. No console command, guest-memory write, health or
ammo edit, enemy edit, cheat, or asset modification was used.

Actual backend probes identify original **`ref_gl` / emulator WebGL 1**, with
`gl_sw_enabled() = 0`, threads and render Worker disabled. Despite the retained
harness requesting SwiftShader flags, the live context reports **ANGLE Intel
Mesa UHD Graphics 620 (KBL GT2), OpenGL 4.6 Core / Mesa 23.2.1**. This is the
observed backend, not a SwiftShader claim. The exact downloaded module remains
`d69d1158f7707c8f46d5f4c0909494913db73bfcb745ca1a3f320be9ad62db91`;
its compiled source commit remains unknown, so current-main certification is
not claimed. Served host hashes are retained; `lib/host-audio.js` changed in
the shared tree after being served, and its recorded served hash must not be
replaced by the later file's hash. All 67 registered files, including 65
original assets and the documented pak hash, match the preceding run. The
installer remains unavailable for a fresh extraction comparison.

The bounded attempt closed its browser and both servers, checked all three
ports and browser PID absent, removed its profile, and retained useful images
before teardown; no Boat was used and /home remained above 2 GB free. There
was no observed page exception, guest trap or `FreeLibrary failed`; static
harness HTTP 404s remain. The task's defeat/progression acceptance is **not
met**, rather than recast as a successful gameplay or emulator repair result.

## 2026-10-31: first guard defeated and next room entered

Run `scratch/runs/20261030T2355Z-quake2-ranged/result.json` verifies the
requested combat milestone. Personally inspected captures show the live guard
in the narrow corridor, sustained native mouse-one fire with S retreat and
S+D/A strafe, hit reactions, and a new fallen body beside the player. This is
distinguished from the corpse already lying farther down the corridor.
The game's ordinary **F1 help/status screen reads kills 1/18** after loading
the unchanged native post-combat quicksave. Native W then crosses the corridor
into the larger room beyond it: `next-room-entry.png` shows the new room's
metal walls and pickup crate, with the player alive at health 42.

The broader room view reveals a second attacking guard. Health falls to 20,
then 12 during another native quicksave, and finally 0 before the final menu
capture. The safer **post-combat save at health 42** is retained separately
from the dangerous later room save, along with a pre-guard save. Save bytes
were read from the browser VFS without modification, exported with hashes,
mounted as ordinary files on recovery, and loaded using native F9. The run
directory contains save manifests and recovery instructions. No console
commands, guest-memory writes, cheats, asset patches or forced game handlers
were used.

The attempt and recoveries occupied approximately 12 minutes of controller
gameplay, below the 20-minute limit. The first Chrome disappeared during
navigation; the second Chrome's process exit explicitly reports **SIGKILL**
at 00:00:06Z, before room-entry capture. Its sender and cause are unknown.
A third browser recovered the exported native save, confirmed kills 1/18,
and completed room entry. No emulator defect or runtime repair is established.

Actual backend probes identify original **ref_gl / emulator WebGL 1 / ANGLE
Intel Mesa UHD Graphics 620**, with `gl_sw_enabled() = 0`, guest threads and
render Worker disabled. SwiftShader command-line flags do not override this
observed renderer. Every downloaded module matches retained SHA-256
`d69d1158f7707c8f46d5f4c0909494913db73bfcb745ca1a3f320be9ad62db91`;
its compiled source commit remains unknown. This does not certify a fresh
current-main build. All 67 registered inputs, including 65 original assets
and the documented pak hash, remain unchanged; all 472 recorded served
responses match their retained input hashes. The installer remains absent.

Focused module/assets/save-byte/backend/trusted-input/cleanup checks pass.
No source was changed. Static-harness HTTP 404 messages remain; no page
exception, guest trap or `FreeLibrary failed` was recorded. The final quit
request was followed by a controller `ERR_STREAM_WRITE_AFTER_END`, so clean
controller exit is not claimed. All three browser PIDs and five known ports
were independently checked absent/closed, the profile was removed, and held
gameplay keys and attack were released. No Boat or test box was used.
Audio, FPS, networking, further combat and level completion remain unqualified.

## 2026-10-31: second guard defeated; room crossed

Run `scratch/runs/20261031T0010Z-quake2-second/result.json` continues the
unchanged retained native health-42 post-combat save. Personally inspected
captures show the second guard pursuing the player into the corridor, native
mouse-one fire, and the guard falling. The ordinary F1 screen reads **kills
2/18**. Native F6 saved the result at health 12; native F9 subsequently
reloaded it, and a second F1 capture still reads **2/18**. The player then
crossed the room and collected armor shards (HUD armor 2, then 4). A further
guard killed the player during room exploration. Another room or level
transition is not established; the visible health box was not collected.

The run preserves separate byte-for-byte native save exports: the original
health-42 starting save, `second-guard-save-manifest.json` (recommended new
checkpoint, health 12 in the corridor, two kills), and
`room-save-manifest.json` (health 12 near the health box, after reloading the
two-kill save). Recovery instructions accompany them. Three earlier combat
attempts ended in inspected player deaths; another was abandoned alive at
health 2. Opening the native menu clears the guest's attack state, so resuming
requires a fresh native fire press. The successful corridor engagement
renewed mouse-one after closing the menu. This is a control finding, not an
emulator repair. Gameplay occupied about nine minutes, below the 20-minute
limit. No guest patch, console command, cheat, memory write or synthetic game
state was used.

Actual provenance remains retained module SHA-256
`d69d1158f7707c8f46d5f4c0909494913db73bfcb745ca1a3f320be9ad62db91`,
compiled source commit unknown, original `ref_gl`, emulator WebGL 1, ANGLE
Intel Mesa UHD Graphics 620, software flag 0, threads and render Worker off.
The harness's SwiftShader flags do not describe the observed context. All 67
registered inputs, including 65 original assets and the documented pak hash,
are unchanged. All 164 served responses were hash-verified. Shared `host.js`
changed after launch; its exact served bytes were recovered from launch HEAD
`a3ab89d44` and retained with their matching hash. This does not certify a
fresh current-main module. The installer remains unavailable.

Focused module, asset, served-byte, native-save, backend, trusted-input and
cleanup checks pass; no runtime source changed. No page exception, guest trap
or `FreeLibrary failed` was recorded. Static-harness HTTP 404s remain. Quit
again produced controller `ERR_STREAM_WRITE_AFTER_END`; clean controller exit
is not claimed. Browser PID 1175593 and all three known ports were independently
absent/closed, profile removed, attack and gameplay keys released. No Boat or
assigned test box was used. Further combat, audio, FPS and level completion
remain unqualified.

## 2026-10-31: health pickup and recoverable two-kill checkpoint

Run `scratch/runs/20261031T0023Z-quake2-third/result.json` continues the
unchanged native room save. Personally inspected `health.png` shows the Health
pickup and HUD increase from 12 to **22**. Native F6 writes a quicksave; eight
resident current/quick files were exported byte-for-byte. Ordinary remount and
F9 restore health 22 (`recovered22-resume.png`), and the native F1 screen still
reads **kills 2/18** (`health22-kills.png`). `health22-save-manifest.json` and
`recovery.txt` retain this checkpoint separately from the earlier health-12 save.
An armor-shard pickup followed. Further encounters ended in inspected deaths;
no third kill, next-room completion or level transition is established.

The harness initially tried to read two lazy save0 headers synchronously,
raising VfsPendingError before capture; the export skips those unmaterialized
headers. Direct CDP capture works. The mouse was also left over the host Launch
button, so a native firing click restarted the app. Moving it inside the game
area avoids that target error; the exported save recovered the progress. These
are harness limitations, not demonstrated emulator defects. No guest-memory
write, cheat, console command or original-asset edit supplied progress.

The retained module is SHA-256
`d69d1158f7707c8f46d5f4c0909494913db73bfcb745ca1a3f320be9ad62db91`,
compiled source unknown. Actual rendering is original ref_gl through WebGL 1,
ANGLE Intel Mesa UHD 620, software flag 0, threads/render Worker off. All 67
registered inputs (65 originals), 240 served responses and eight exported save
files pass hash checks; all 95 recorded input events are trusted. Physical
mouse buttons were released, although the dead guest retained attack state 1.
No further execution occurred after shutdown. No runtime source changed.

Focused verification passes. Cleanup required SIGTERM followed by a targeted
SIGKILL of the controller after its browser closed but servers remained open;
clean controller exit is not claimed. Both owned PIDs are absent, all three
ports closed and profile removed, with over 7 GB free. No Boat was used.
Next: continue the health-22 native checkpoint and engage the remaining guards
from cover, keeping the mouse inside the game area.

## 2026-10-31: four kills and passage beyond the guards

Run `scratch/runs/20261031T0032Z-quake2-health22/result.json` continues the
preserved health-22/two-kill checkpoint. Personally inspected captures show
two guards near the passage pursuing the player, native blaster fire from
the corner, hit reactions and both guards falling. The ordinary F1 screen
confirms **kills 4/18**, with the player alive at **health 11**. Native F6
saves that checkpoint. F9 recovery retains four kills. Eight exported native
save files were then mounted as ordinary app files after stopping/restarting
the app; F9 and F1 again confirm health 11 and kills 4/18. Exported bytes
after this external recovery match the combat save exactly.

The player subsequently entered the slatted passage beyond those guards.
A further guard killed the player there; no fifth kill, completed next room
or level transition is established. The recommended recovery is
`combat-save-manifest.json`, before passage entry. `recovery.txt`,
`remount.cjs`, the eight native files and the original starting health-22
files are retained separately. The corner save is an earlier position, not
the recommended four-kill checkpoint. Browser gameplay and recovery ran from
approximately 00:29:01Z to 00:36:43Z, below eight minutes and the 20-minute
bound. No guest-memory writes, console commands, cheats or original-asset changes
supplied progress. No emulator defect or runtime repair is demonstrated.

The exact retained module remains SHA-256
`d69d1158f7707c8f46d5f4c0909494913db73bfcb745ca1a3f320be9ad62db91`,
compiled source unknown. Actual backend probes report original ref_gl,
WebGL 1, ANGLE Intel Mesa UHD 620, software flag 0, threads/render Worker off.
This does not certify a fresh current-main build. All 67 prior registered
inputs, including 65 original assets, remain unchanged; the current manifest
has 74 entries including eight checkpoint files. All 158 served responses
pass hash verification. The original installer remains unavailable.

Focused module/assets/served-byte/native-save/backend/input/cleanup checks
pass. All 212 recorded input events are trusted; final physical mouse mask
and native attack bit are clear. A redundant release request returned
`left is not pressed`; no page exception, guest trap or FreeLibrary failure
was recorded. Static-harness HTTP 404s remain. Browser close was requested;
the controller records browser SIGKILL, with its precise sender unknown.
Controller shutdown required SIGTERM followed by targeted SIGKILL, so clean
process exit is not claimed. Both owned PIDs are absent, three ports closed,
profile removed and over 7 GB free. No Boat or assigned test box was used.
Next: recover the four-kill save and engage the passage guard from cover;
health 11 remains fragile.

## 2026-10-31: passage guard defeated; five-kill save recovered

Run `scratch/runs/20261031T0042Z-quake2-passage/result.json` continues the
unchanged four-kill/health-11 checkpoint. Personally inspected captures show
entry into the slatted passage, the next guard approaching, and native blaster
fire while retreating down the passage. The guard falls; the ordinary F1
screen confirms **kills 5/18**, with **health 11** retained. Native F6 saves
the result. Eight native current/quick files were exported without alteration
to `fifth-save-manifest.json`, then mounted as ordinary files after stopping
and restarting the app. Native F9 recovery and inspected
`external-five-kills.png` / `external-resume.png` confirm five kills and health
11. The recovered save hashes exactly match the exported checkpoint.

The recommended successor checkpoint is that fifth-guard save; `recovery.txt`
and `remount.cjs` describe recovery. The earlier four-kill save remains intact.
No later room or level transition is established. Browser gameplay and recovery
occupied approximately 00:39:30Z–00:41:38Z, below the 20-minute bound. All
progress used native browser keyboard/mouse input; no guest-memory writes,
console commands, cheats or original-asset changes were used. No runtime
repair was needed.

Exact retained module SHA-256 remains
`d69d1158f7707c8f46d5f4c0909494913db73bfcb745ca1a3f320be9ad62db91`,
compiled source unknown. Actual probes report original ref_gl, WebGL 1, ANGLE
Intel Mesa UHD 620, software flag 0, threads/render Worker off. This does not
certify a fresh current-main build. All 67 prior registered inputs, including
65 original assets, remain unchanged; all 158 served responses and eight
native save files pass hash verification. All 92 recorded input events are
trusted; final physical mouse mask and native attack bit are clear. The
installer remains unavailable. Audio, FPS, networking and level completion
remain unqualified.

Focused evidence verification passes; this is a documentation-only change.
No page exception, guest trap or FreeLibrary failure was recorded; static
harness HTTP 404s remain. Browser exit reports code 0 with no signal; the
controller was stopped with targeted SIGTERM. Both owned PIDs are absent,
all three ports closed and profile removed. No Boat or assigned test box was
used (ID/state/expiry N/A); ownership is handed back. Next: continue down the
cleared passage from the five-kill save and seek health before further combat.

## 2026-10-31: health 21, sixth guard and open courtyard

Run `scratch/runs/20261031T0046Z-quake2-next/result.json` resumes the native
five-kill/health-11 checkpoint. Personally inspected captures confirm F1
**kills 5/18**, passage exploration, and return to the adjoining room. A live
guard approached through the opposite doorway. Native blaster fire while
retreating collected Health, raising the HUD to **21** (`sixth-fight.png`).
Further fire defeated the guard; `sixth-kills.png` confirms **6/18**, health
21. Native F6 saved this result, and eight unchanged native current/quick
files were exported to `sixth-save-manifest.json`.

The player then crossed that doorway into the open red-sky courtyard with
crates, ramps and a lower water channel. Exploration reached the channel;
health subsequently read 18, with the damage source unqualified. F9 restored
the six-kill/health-21 checkpoint. A second courtyard entry and F6 export
preserve `courtyard-save-manifest.json` at health 21, with another live guard
visible below the entrance. No seventh kill or level transition is claimed.
The safer recommended recovery is the **sixth** save, before courtyard entry;
the courtyard save is a separate, more exposed position.

The browser received SIGKILL during an in-page stop/relaunch remount check;
its sender is unknown. A fresh browser mounted the exported sixth save as
ordinary files. Native F9 and personally inspected
`recovery/external-six-kills.png` / `recovery/external-resume.png` confirm six
kills and health 21. All eight recovered file hashes match the export.
`recovery.txt`, `recovery-driver.cjs` and the manifests preserve recovery.
Gameplay and recovery occupied approximately 00:45:30Z–00:50:27Z, below the
20-minute limit. No guest-memory write, console command, cheat, original-asset
edit or emulator repair supplied progress.

Both sessions loaded exact retained module SHA-256
`d69d1158f7707c8f46d5f4c0909494913db73bfcb745ca1a3f320be9ad62db91`,
compiled source unknown. Fresh recovery probes report original ref_gl,
WebGL 1, ANGLE Intel Mesa UHD 620, software flag 0, threads/render Worker off.
This does not certify a current-main module. All 67 prior registered inputs,
including 65 original assets, and all recorded served bytes pass hash checks.
Recovery input events are trusted and native attack is clear; the initial
session's full trust/held-state snapshot was lost with Chrome, so complete
initial-event verification is unavailable. The native action log remains.
No page exception, guest trap or FreeLibrary failure was recorded; static
harness HTTP 404s remain. The original installer remains unavailable.

Focused module/assets/served-byte/native-save/recovery/cleanup checks pass.
No runtime source changed. The recovery browser exited code 0; both
controllers were stopped with targeted SIGTERM. All four owned PIDs are
absent, four known ports closed and both profiles removed, with over 7 GB
free. No Boat or assigned test box was used (ID/state/expiry N/A); ownership
is handed back. Next: recover the six-kill/health-21 save, enter the courtyard
and engage its next guard from the doorway before exploring the ramps.

## 2026-10-31: courtyard guard defeated; safer seven-kill checkpoint

Run `scratch/runs/20261031T0055Z-quake2-courtyard/result.json` resumes the
exported six-kill/health-21 native checkpoint. Personally inspected frames
confirm the starting F1 count **6/18** and health **21**. The first doorway
engagement ended in player death while adjusting aim. Ordinary F9 restored
the unchanged checkpoint. On the retry, native blaster fire and S retreat
drew the courtyard guard through the doorway into the room. Inspected
`guard-lured.png`, `guard-hit.png` and `guard-fall.png` show his approach and
defeat; `seventh-kills.png` confirms **7/18**, still at **health 21**.

Native F6 saved from farther inside the room, behind the courtyard doorway.
Eight untouched current/quick files are exported in
`seventh-save-manifest.json`. A fresh browser mounted those exports as
ordinary files; native F9, F1 and inspected `recovery/external-seven-kills.png`
and `recovery/external-resume.png` confirm seven kills and health 21. All eight
recovered file hashes exactly match the export. This is the recommended new
checkpoint; `recovery.txt` and `recovery-driver.cjs` pin the recovery recipe.
The earlier sixth checkpoint remains unchanged. The bounded session and
recovery took approximately four minutes, below 20 minutes. No eighth kill,
completed courtyard traversal or level transition is established. No
guest-memory writes, cheats, console commands or original-asset edits were used.

Both sessions loaded retained module SHA-256
`d69d1158f7707c8f46d5f4c0909494913db73bfcb745ca1a3f320be9ad62db91`,
compiled source unknown. Actual probes report original ref_gl, WebGL 1,
ANGLE Intel Mesa UHD 620, software flag 0, threads/render Worker off; requested
SwiftShader flags do not describe the observed context. All 67 prior inputs,
including 65 original assets, 424 served responses and eight exported save
files pass hash checks. All 75 gameplay and 11 recovery input events are
trusted; final physical mouse mask and native attack bit are clear. The
installer remains unavailable; this does not certify a current-main module.
Audio, FPS and networking remain unqualified.

Focused verification passes; no runtime source changed or causal emulator
defect was proved. The initial background controller ended before READY;
its owned Chrome was terminated and a persistent foreground session used.
The gameplay controller's quit produced `ERR_STREAM_WRITE_AFTER_END`, and
the recovery controller required targeted SIGKILL after SIGTERM left HTTP
ports open. Recovery Chrome records SIGKILL after an explicit CDP close;
its signal sender is unqualified. The copied backend query inherited an old
action timestamp; its DOM event times and surrounding actions retain this
run's times. Clean controller exit is not claimed. No page exception, guest
trap or FreeLibrary failure was recorded; static-harness HTTP 404s remain.
The task explicitly delegated own browser/server/profile cleanup: all owned
browsers/controllers are absent, five known ports closed, both profiles
removed and watcher stopped, with over 7 GB free. No Boat or assigned test
box was used (ID/state/expiry N/A); ownership is handed back. Next: recover
the seven-kill save and explore the courtyard ramps while seeking health.

## 2026-10-31: courtyard channel explored; flooded pillar passage reached

Run `scratch/runs/20261031T0101Z-quake2-ramps/result.json` resumes the
seven-kill indoor checkpoint. Inspected `start-kills.png` confirms **7/18**
and **health 21**. The first launch accidentally passed export-manifest rows
without converting `path` to registration `vfsPath`; native F9 reported no
save. Closing it and using the original mount format recovered the unchanged
checkpoint. This was a harness setup error, not a game or emulator blocker.

Native movement crossed the courtyard, descended into its lower channel and
checked the sloped supports. Forward/jump did not climb those supports.
`bank.png`, `ramp-top.png` and `climb2.png` show the accessible bank/stairs
returning to the cleared room. Further channel exploration entered the dark
water-level opening; `tunnel-out.png` and `sewer.png` show a new red-lit,
flooded pillar chamber. No health pickup or new live enemy was found.

The deeper chamber requires swimming: pausing there twice led to drowning
and death. Ordinary F9 recovered each time, and trusted CDP jump held down
kept the player at the surface at health 21. Final native F1 still shows
**7/18**; `exploration-save-manifest.json` exports eight untouched F6
current/quick files from the passage. A fresh browser mounted them as ordinary
files; native F9 and inspected `recovery/external-world.png` /
`recovery/external-count.png` confirm health 21 and seven kills. All eight
recovered hashes match. This exploration save needs prompt jump/swim-up
input; it is **not safer than the original indoor checkpoint**, which remains
unchanged in `starting-save-manifest.json`. `recovery.txt` documents both
recipes, including the `hold-space.cjs` helper and native export commands.
No eighth kill, health gain, dry exit or level transition is established.

Gameplay/setup and fresh recovery ran approximately 00:59Z–01:10Z, within the
20-minute bound. No cheats, guest-memory writes, console commands, asset
edits or emulator repair supplied progress. Both valid sessions loaded exact
retained SHA-256
`d69d1158f7707c8f46d5f4c0909494913db73bfcb745ca1a3f320be9ad62db91`,
compiled source unknown. Actual probes report original ref_gl, WebGL 1,
ANGLE Intel Mesa UHD 620, software flag 0, threads/render Worker off, despite
requested SwiftShader flags. This does not certify a current-main module.
All 67 prior registered inputs, including 65 original extracted assets,
324 served responses and the eight recovered save files pass hash checks.
All 209 gameplay and 19 recovery recorded input events are trusted; final
mouse mask and native attack bit are clear. The installer remains unavailable;
audio, FPS and networking remain unqualified.

Focused verification passes; no runtime source changed. The malformed-mount
browser quit hit the inherited controller `ERR_STREAM_WRITE_AFTER_END`.
Both valid browsers closed through CDP with exit 0; their controllers were
stopped with targeted SIGTERM. No page exception, guest trap or FreeLibrary
failure was recorded; static-harness HTTP 404s remain. Own cleanup was
explicitly delegated: browsers/controllers are absent, five ports closed,
three profiles removed and watcher absent, with over 7 GB free. No Boat or
assigned test box was used (ID/state/expiry N/A); ownership is handed back.
Next: use the safer indoor save to seek the outer ledge pickups, or continue
the flooded exploration save while holding jump and locate its dry exit.

## 2026-10-31: far-side flooded duct located; entrance remains blocked

Run `scratch/runs/20261031T0114Z-quake2-dry-exit/result.json` continues the
seven-kill/health-21 checkpoint with the same retained driver and module.
Inspected courtyard jump attempts did not reach the opposite ledge pickups.
The prior final exploration export restores near the courtyard-side passage;
it should not be interpreted as a deep pillar-room checkpoint. The separately
retained `sewer-save-manifest.json` restores inside that chamber.

One sewer recovery attempt ended in drowning before swim-up took effect.
Native F9 recovered it. Closing the native load menu and issuing a fresh jump
press, then holding jump, surfaced the player at health 21. Input held across
loading/menu changes alone was insufficient in this attempt. Native movement
then traversed the far side of the red-lit flooded chamber and located a low,
red-lit duct opening (`sewer/far-corridor-right.png`). Forward and crouch/swim
attempts reached its lip but did not establish traversal. No dry exit, health
pickup, new live enemy, eighth kill or level transition is claimed. This is
a navigation blocker, not an isolated emulator defect.

Native F6 exported eight untouched current/quick files to
`sewer/duct-save-manifest.json`. A fresh browser mounted them as ordinary
files; F9 and inspected `recovery/external-count.png` confirm **kills 7/18,
health 21**. All eight recovered hashes exactly match. This save is submerged
at the duct approach and requires prompt swim-up/retreat; it is not a safer
replacement for the unchanged indoor checkpoint. `recovery.txt` retains the
recipes and that limitation. Gameplay and external recovery ran approximately
01:13Z–01:27Z, within 20 minutes. No cheats, console commands, guest-memory
writes or original-asset edits supplied progress.

All four browsers loaded retained module SHA-256
`d69d1158f7707c8f46d5f4c0909494913db73bfcb745ca1a3f320be9ad62db91`,
compiled source unknown; this does not certify a current-main build. Actual
rendering remains original ref_gl, WebGL 1, ANGLE Intel Mesa UHD 620,
software flag 0, threads/render Worker off despite requested SwiftShader
flags. Verification passes for 67 prior registered inputs (65 originals),
648 served responses, all 232 recorded trusted input events, and eight
byte-exact recovered save files. Final mouse masks and native attack bits are
clear. No page exception, guest trap or FreeLibrary failure was recorded;
static-harness HTTP 404s remain. The installer remains unavailable; audio,
FPS and networking remain unqualified. No runtime source changed.

All four owned browsers exited code 0 through CDP close; their controllers
were stopped with targeted SIGTERM. All eight owned PIDs are absent, twelve
known ports closed, four profiles removed and the watcher stopped, with over
7 GB free. No Boat or assigned test box was used (ID/state/expiry N/A);
ownership is handed back. Next: recover the duct approach only with immediate
swim-up input and solve the low entrance alignment, or return to the safer
indoor checkpoint to investigate another courtyard route.


## 2026-10-31: flooded lip traversed; dry duct refuge recovered

Run `scratch/runs/20261031T0129Z-quake2-route/result.json` first recovered
and explored the unchanged seven-kill indoor checkpoint. Courtyard ledge
attempts did not collect health; the channel's left bank returned toward the
entrance. The worker then switched to the retained submerged duct approach.
Fresh swim-up and retreat after closing the load menu surfaced the player,
with two health lost (**21 → 19**), but no death in this run.

Long forward/crouch input submerged the player below the opening. A later
short **W+C 400 ms, then W 700 ms**, with held swim-up released, entered the
low red-lit duct (`duct/lip-middle.png`). Subsequent native crouch movement
traversed its interior. Exploration returned to a **dry standing shelf inside
the duct mouth**, looking toward the flooded pillars (`duct/stand-exit.png`).
This establishes escape from submersion into a dry refuge, not a route to a
new room. Fifteen seconds without movement or swim-up retained **health 19**.
F1 confirmed **kills 7/18**. No pickup, new enemy, eighth kill, next room or
level transition is claimed; onward navigation remains unresolved.

Native F6 exported eight untouched files to `duct/dry-save-manifest.json`.
A fresh browser mounted them as ordinary files; native F9 and inspected
`recovery/external-dry-wait.png` / `recovery/external-count.png` confirm the
same dry shelf, health 19 and seven kills. Another 15-second no-input wait
caused no damage. All eight recovered file hashes exactly match the export.
This new dry checkpoint needs no swim-up; the original indoor health-21 save
remains intact. `recovery.txt` and `recovery-driver.cjs` retain both recipes.
Gameplay and fresh recovery ran approximately 01:29Z–01:41Z, within 20 minutes.
No cheats, console commands, guest-memory writes, binding changes or original
asset edits supplied progress. No emulator defect was isolated.

Read-only inspection of the mounted config and original `default.cfg` clarified
navigation: always-run is already enabled (`cl_run 1`), so Shift slows movement;
C/Ctrl are swim-down/crouch; End centers the view; Z looks down; PageDown looks
up. PageUp has no default binding. These controls were not remapped.

All three browsers loaded retained module SHA-256
`d69d1158f7707c8f46d5f4c0909494913db73bfcb745ca1a3f320be9ad62db91`,
compiled source unknown. This does not certify a current-main build. Actual
valid-session backend probes report original ref_gl, WebGL 1, ANGLE Intel
Mesa UHD 620, software flag 0, threads/render Worker off. Verification passes
for 67 prior inputs including 65 original assets, 486 served responses, eight
byte-exact recovered files, and all 123 duct / 13 recovery trusted input events.
The initial browser's full input snapshot was lost; its action log remains.
The installer remains unavailable; audio, FPS and networking are unqualified.

The initial indoor Chrome disappeared with SIGKILL before requested close;
its sender is unknown. The subsequent close attempt produced an unhandled
ErrorEvent. Both valid duct/recovery browsers exited code 0 through CDP close;
all three controllers were stopped with targeted SIGTERM. Six owned PIDs are
absent, nine ports closed and three profiles removed, with over 6 GB free.
No page exception was recorded; static-harness HTTP 404s remain. No runtime
source changed. No Boat or assigned test box was used (ID/state/expiry N/A);
ownership is handed back. Next: recover the dry shelf and investigate the
remaining duct/chamber route, keeping the indoor checkpoint as health fallback.

## 2026-10-31: dry duct onward sweep; navigation remains unresolved

Run `scratch/runs/20261031T0145Z-quake2-onward/recovery.txt` copies the prior
recovery driver to new ports and mounts all eight native save files byte for
byte. Both browser restores reached the dry shelf at **health 19, kills 7/18**.
Backward crouching first moved deeper into the duct. Native turns and crawls
then traversed the red-lit stretch to a wall (`retry/far-end.png`); the adjacent
dark corners and sideways movement showed openings toward the same flooded
pillars (`retry/corner-return.png`). A short native blaster wall/fixture-direction
probe did not visibly open a route. No onward room, health pickup, new enemy,
eighth kill or level transition was established. The blocker is unresolved
navigation at this duct's wall/corners; these observations do not prove that
all possible routes are closed. No drowning, death or health loss was observed,
and no lip calibration was repeated.

The first Chrome disappeared with **SIGKILL at 01:48:45 UTC**, sender unknown.
Its frames and action log remain, but its full trusted-input snapshot was lost.
A fresh browser recovered successfully and repeated the deeper crawl. Final F9
returned to the original shelf; an extra Escape opened the menu and was
corrected before the measured **15-second unpaused world wait**, which retained
health 19 (`retry/restored-world-wait.png`). F1 confirms seven kills
(`retry/restored-count.png`). Read-only export
`retry/retained-save-manifest.json` matches all eight starting files exactly;
no new F6 checkpoint was made. The prior safer indoor health-21 save remains
unchanged. `recovery.txt` retains the new ports, scripts and navigation limits.
The bounded attempt ran approximately 01:45Z–01:52Z, below 20 minutes. No
cheats, console commands, guest-memory writes, binding changes or asset edits
supplied progress; no emulator defect was isolated.

Both browsers loaded retained module SHA-256
`d69d1158f7707c8f46d5f4c0909494913db73bfcb745ca1a3f320be9ad62db91`,
whose exact compiled source remains unknown. This does not certify a current-main
build. The retry reports original ref_gl, WebGL 1, ANGLE Intel Mesa UHD 620,
software flag 0 and threads/render Worker off. `verification.json` passes for
65 original assets, 67 prior inputs, 324 served responses, eight exact native
save files, all 53 retry input events trusted, no held keys and mouse mask 0.
The initial input snapshot limitation remains explicit. No page exception was
recorded; static-harness HTTP 404s remain. Audio, FPS and networking remain
unqualified. No runtime source changed, so no build was run.

Retry Chrome exited code 0 through CDP close; controllers were stopped with
targeted SIGTERM. Both owned browsers/controllers are absent, six known ports
closed and two profiles removed, with over 6 GB free. No Boat or assigned test
box was used (ID/state/expiry N/A); ownership is handed back. Next: establish
an onward route beyond this local wall/corner sweep, or use the unchanged
indoor health-21 checkpoint to investigate another route.

## 2026-10-31: indoor side door reaches a live stair guard

Run `scratch/runs/20261031T0154Z-quake2-indoor/` uses fresh native F9 to
recover the unchanged **health-21, kills-7/18 indoor checkpoint**. A courtyard
running jump landed in the lower channel without collecting the opposite
ledge pickups. F9 restored the indoor position; no dry-duct corner sweep was
repeated. Turning left from the saved view instead enters a slatted corridor.
Its mechanical door opens into a room with two barrels and stairs toward
red-sky openings (`live/door-through.png`, `live/retry-door.png`).

The first stair approach ended in death (HUD -2); the damage source was not
identified in that attempt. Native F9 restored the original save again.
On the retry, inspected `live/stair-fight.png` and `live/stair-retreat.png`
show a **live guard on the stairs**, with health reduced to **9**. Native
blaster fire was visibly aimed too high after PageDown; no hit or eighth kill
is established. This is a newly inspected enemy encounter reached by the
indoor side route, not a claim that the room itself was previously unvisited.
The next engagement request failed because Chrome received SIGKILL at
01:58:57Z, sender unknown. No new F6 checkpoint was made.

A fresh browser remounted all eight original indoor save files. Its initial
F9 was issued during startup, so early captures remain loading evidence only.
Actual world recovery is confirmed by `retry/load-wait.png` (F1 **7/18**, HP
**21**) and `retry/restored-wait.png` (same room and health after 15 seconds
without input). Read-only VFS exports in `retry/retained-save-manifest.json`
match the starting checkpoint byte for byte. `recovery.txt`, `driver.cjs`,
`retry-driver.cjs`, and the action logs retain the route and recovery details.
Gameplay/recovery ran about 01:54Z–02:04Z, within 20 minutes. No cheats,
game/console commands, memory edits, binding changes or asset changes were used.

Both browsers loaded retained module SHA-256
`d69d1158f7707c8f46d5f4c0909494913db73bfcb745ca1a3f320be9ad62db91`,
compiled source unknown; this does not certify current main. Fresh recovery
probes report original ref_gl, WebGL 1, ANGLE Intel Mesa UHD 620, software
flag 0, threads/render Worker off. Focused verification passes for 65 original
assets, 67 prior inputs, 324 served responses, eight exact save files, and
107 initial / 11 recovery trusted input events. The last retained snapshots
have no held keys or mouse buttons; rejected post-disconnect requests are not
counted as delivered. No page exception was recorded; static HTTP 404s remain.
Audio, FPS and networking remain unqualified. No runtime source changed, so
no build was run.

The first controller was stopped with targeted SIGTERM. Fresh recovery quit
responded successfully, then its controller raised the inherited
`ERR_STREAM_WRITE_AFTER_END`; no browser exit event was retained, so clean
exit is not claimed. All owned browser/controller processes are absent, six
known ports closed, two profiles removed and over 6 GB free. No Boat or test
box was used (ID/state/expiry N/A); ownership is handed back. Next: recover
indoor21, follow the left corridor through the mechanical door, and engage
or lure the stair guard from doorway cover with centered aim before advancing.

## 2026-10-31: centered doorway lure draws multiple guards; checkpoint retained

Run `scratch/runs/20261031T0213Z-quake2-door/` makes one bounded native
engagement from the unchanged indoor **21 HP, kills 7/18** checkpoint. The
initial Chrome received **SIGKILL at 02:07:37Z**, sender unknown, during F9
loading; it established no gameplay recovery. A fresh profile remounted the
same eight save files, and inspected `retry/starting-count.png` confirms the
actual world, 21 HP and seven kills.

The verified left corridor/mechanical-door route reached the barrel/stair
room. Native End centered the view, avoiding the earlier excessive PageDown
pitch. A short forward firing peek and backward retreat drew **multiple live
guards** into the room: `retry/lure-retreat.png` shows one close at the right,
another by the barrels and another on the stairs. Health fell to 9. A further
brief right turn and retreating burst ended in **one player death**, HUD -2
and explicit `Player died.` (`retry/cover-retreat.png`). No eighth kill,
pickup, onward room or new F6 checkpoint was established. The concrete blocker
is this multi-guard encounter overwhelming the attempted retreat at low health;
no emulator defect was isolated. Next attempt should establish cover farther
back before firing and avoid the forward peek that exposed the player here.

Native F9 restored indoor21. Inspected `retry/restore-count.png` again reads
**7/18**, and `retry/restore-stable.png` retains **21 HP after 15 seconds
unpaused without input**. Read-only VFS export
`retry/retained-save-manifest.json` matches all eight original checkpoint files
exactly. The original save remains the recommended recovery. `recovery.txt`
and the action logs retain timings and evidence. Gameplay and recovery ran
approximately 02:07Z–02:10Z, within 20 minutes. No cheats, game/console commands,
memory writes, binding changes or asset changes supplied progress.

Both downloaded modules match retained SHA-256
`d69d1158f7707c8f46d5f4c0909494913db73bfcb745ca1a3f320be9ad62db91`,
compiled source unknown; this does not certify current main. Actual recovery
backend is original ref_gl / WebGL 1 / ANGLE Intel Mesa UHD 620, software flag
0, threads/render Worker off. Original assets, served-file hashes, native save
bytes and recorded trusted inputs pass focused checks. The initial browser's
F9-event snapshot was lost at disconnect; its action log remains, so complete
initial-event verification is unavailable. Final recovery keys/buttons are
released. Installer remains unavailable; audio, FPS and networking remain
unqualified. Static HTTP 404s remain; no page exception was recorded. No runtime
source changed, so no build was run.

Recovery Chrome exited code 0 through explicit CDP close. The initial controller
was stopped with targeted SIGTERM; the retry controller exited 143 after browser
close, sender unknown, before its requested SIGTERM. All four owned PIDs are absent, six ports
closed and two profiles removed, with over 1.5 GB free. Other sessions were
preserved. No Boat or assigned test box was used (ID/state/expiry N/A);
ownership is handed back. The bounded attempt stops with the original safe
checkpoint retained and the combat objective unmet.

## 2026-11-01: native indoor restore; door approach interrupted

Run `scratch/runs/20261101-quake2-indoor-guard/` retained one native
`quake2_demo` original, using the registered renderer/config and supported
`--vfs-mount` for the eight unchanged indoor21 save files. Ordinary F9 at
batches 100/101 restored the world; startup/menu frames alone were not treated
as recovery. Inspected `starting-count.png` shows the saved indoor room and
**21 HP**; `starting-count-stable.png` shows **kills 7/18, goals 0/1** after
the F1 pair and eight further batches without input. Left turns and W movement
then followed the slatted corridor toward its mechanical door. End centered
the view at batches 1067/1068. The final W hold at 1075–1077 has before, held,
released and settled captures; `door-approach-settled.png` at batch 1080 and
the identical `final.png` show the closed door close ahead and **21 HP**.
No live guard engagement, outgoing hit, eighth kill or onward room is visibly
established. No attack or F6 input appears in the retained input trace.

The blocker for this attempt is **worker/launcher interruption before the
planned encounter**, not an established door or emulator defect. The bounded
last worker events end after the door approach. Worker
`01a1971b-bad6-77b1-942e-50435034f369`, launcher handle 2746, exited 143
without launcher final/result artifacts; its signal sender/cause is not
established here. The coordinator requested `finish.json` at
**12:51:22Z**. `exit.json` records original PID 3661918 exiting **0 after
318.559 seconds**, ending at batch 1080; `coordinator-interruption.json`
records cleanup at 12:51:49Z. Original exit 0 does not establish gameplay
success or a clean worker completion. A fresh evidence-only worker finished
this note without resuming the old worker or starting another original.

Focused artifact validation passes: all **61 PNGs** pass chunk CRC and IDAT
decompression checks, the complete runtime gzip decodes, all **32 ordinary
key edges (16 pairs)** are dequeued, routed and dispatched to hwnd `0x10001`,
and all eight retained host save files still match their starting sizes and
SHA-256 values. `save-mounts.json`, `checkpoint-before.json` and `recovery.txt`
preserve the byte-exact recovery recipe. No fresh guest VFS export or final
F1 count was retained, so post-run guest-save equality and a final kill-count
readout are unavailable. The final known scheduled/pending/cross-thread/
renderer queues are empty. Sampled physical/async movement keys are released;
pressed latches are not held keys. W, D and End lack final per-key samples,
although their up events were dispatched. Guest post queue, button state and
SDL consumption remain unknown. The short settled captures are not a matched
long no-input control for the final door approach.

The accepted-build receipt matches **4,392 source pins and 141 prior observed
reads** from accepted build `d86935e8274cd5d70a53bcc50c5d8bf5632d95c3`.
Actual run baseline was main `f581e849f29be47c3d68da7cdf1c72a93ecde4df`.
Recovery validation finds **4,444 source/module pins, 67 original/manifest
inputs and original-tree membership unchanged**, with all **132 actual
runtime reads** still matching. The runtime compiled module SHA-256 is
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
Retained observer validation exercised actual sync/async compilation, whole
512 MB shared-memory read-only behavior, clock identity and late event 10001
retention. String-path file reads are observed; descriptor/direct OS reads
are not comprehensively covered. Runtime compilation identifies module bytes,
not compiler-source reads. This native software-bridge run does not establish
browser/GPU, audio, FPS, networking or full-suite parity. No new runtime,
build or gameplay tests were run during evidence-only completion; no tracked
code, configuration or assets changed.

The retained runtime minimum free disk was **2,068,029,440 bytes**. Coordinator
cleanup and a fresh process check find the original/controller, gate waiter,
disk guard and their known groups absent, with no matching own helpers or new
`wa-child-*` temporary directories. Evidence remains in the existing scratch
run. Native box ID/state/expiry are **N/A**; shutdown was delegated to the
coordinator and ownership is handed back. The original checkpoint remains
intact. Next gameplay work, if separately authorized, still needs visible
proof of the stair-guard outcome or an onward room; this interrupted attempt
does not resolve that objective.

## 2026-11-01: native doorway cover yields the eighth kill

Run `scratch/runs/20261101-quake2-native-door-encounter/` completes the
guard objective with **8/18 kills and 21 HP**. Supported `--vfs-mount`
mounted the eight unchanged indoor21 files from
`20261031T0213Z-quake2-door/retry/`; ordinary F9 at batches 100/101
restored the checkpoint. Startup/menu images were not accepted as recovery.
`starting-count-stable.png` confirms the indoor world, **7/18 kills,
goals 0/1 and 21 HP** at batch 989.

Short observed turns, W movement and a D offset followed the left slatted
corridor and cleared its corner pillar. End centered the view. A three-batch
W approach and one-batch touch reached the mechanical door. The subsequent
20-batch no-input interval shows it **open**, with the barrel/stair room and
an upright guard at the right jamb (`door-opening-wait-settled.png`, batch
1144). The closed approach frame was therefore not an obstruction. No further
forward input was issued after that touch. The player remained at the doorway
while the guard approached, avoiding the earlier exposed forward firing peek.

Enter bursts and small ordinary keyboard/relative-mouse aim corrections
initially produced sparks near the jamb; those frames alone do not prove hits.
`close-guard-burst-settled.png` at batch 1208 clearly shows blood from the
identified guard. The final eight-batch burst has before/held/released/settled
captures (`pointblank-burst-*`, batches 1242/1250/1251/1253), showing heavy
blood and backward collapse; `pointblank-settle-settled.png` continues the
collapse. `verified-count-wait.png` at batch 1290 and `final-count.png` at
1344 both read **8/18**, with **21 HP** and goals **0/1**. This establishes
one guard defeated, without establishing a level transition or another room
beyond this encounter.

Matched no-input sequences are retained alongside the action sequences,
including three-batch `door-neutral-*` versus the three-batch approach and
eight-batch `final-neutral-*` versus the final burst. In the door control,
the complete upper scene rectangle `(0,0)–(640,270)` is pixel-identical
before/held/settled; weapon motion changes the full frame. The final neutral
sequence includes delayed F1 closing and is not a stationary full-frame
control. Other settle frames also show delayed aim/menu effects or enemy
animation. Browser milliseconds were not converted into native batches, and
scheduled input times are not asserted as guest effect times.

Focused validation passes all **196 PNGs** through chunk CRC/IDAT decoding,
the complete runtime gzip, and **74 key edges / 37 balanced pairs**, dequeued
and dispatched in order to hwnd `0x10001`. Three relative-mouse inputs bring
the final scheduled/dequeued/routed/dispatched totals to **77**. Final known
scheduled, pending, cross-thread and renderer queues are empty. All sampled
physical/async keys, explicitly including **W, D, End and Enter**, are
released; pressed latches are not held keys. Guest post queue, button state
and SDL consumption remain unknown. No console, save-byte, binding, asset or
guest-memory edits supplied progress.

Supported `--save-vfs` exported all eight guest save files on exit.
`focused-validation.json` verifies each exported file and each original host
file against the retained size/SHA-256: **all eight match exactly**. No F6
checkpoint was made, so recovery remains the original **21 HP / seven-kill**
save; the eighth kill is evidenced in this run, not persisted as a new save.
`save-mounts.json`, the controller scripts and exported `guest-vfs/` retain
the recovery recipe. Identical PNGs within this run share hardlinks to save
disk without changing their bytes; no external artifacts were removed.

The Thief II fresh launcher final/result and explicit runtime/source/build
release opened the gate at **13:04:29Z**, actual main
`e6814d7b96263fdd354c1eae8fafa4da99e3e427` (dispatch was `90aa4059d`).
All **4,392 accepted source pins and 141 prior observed reads** matched,
allowing accepted module reuse. Fresh before/after validation finds **4,444
source/module pins, 67 original/manifest inputs, original-tree membership
and 132 actual runtime reads unchanged**. Actual compiled module SHA-256 is
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
Before original use, the observer passed actual sync/async compilation and
execution, whole-512 MB shared-memory read-only checks, native/host clock
identity and emitted late-event-10001 retention. Its string-path file-read
coverage does not comprehensively cover descriptors/direct OS reads;
runtime compilation identifies module bytes, not compiler-source reads.
This native software-bridge result does not qualify browser/GPU, audio, FPS,
networking or full-suite parity. No tracked runtime/helper/test/configuration
or backend changed, so no new build was needed.

One original, PID 3681491, exited **0 after 499.982 seconds**, ending at
batch 1344, within the 25-minute gate window. Runtime and auxiliary disk
guards retained a minimum of **2,017,398,784 bytes free**, above the required
2,000,000,000-byte floor. Own runtime/controller, gate monitor, guards and
watchers are absent with no remaining own groups or new `wa-child-*` temps;
cleanup and publication checks are retained. Native local box ID/state/expiry
are **N/A**. Explicitly delegated shutdown is complete and ownership is handed
back. The requested eighth-kill objective is complete; no second original or
further gameplay is needed for this assignment.

## 2026-11-01: eighth-kill F6 exported; disk floor stops further recovery

Run `scratch/runs/20261101-quake2-eighth-kill-checkpoint/` reproduced the
covered encounter with one native `quake2_demo` original. Supported
`--vfs-mount` mounted the unchanged eight-file checkpoint from
`20261031T0213Z-quake2-door/retry/`; ordinary F9 restored **21 HP, 7/18**
(`starting-count-stable.png`, batch 989). The previous controller's ordinary
turns/movement were replayed through the mechanical door. The three-batch
no-input door control retained identical pixels throughout the upper
640×270 scene, while the matched approach advanced to the door. A further
touch and 20-batch wait opened it normally. There was no exposed forward
peek after the touch at batch 1121.

Covered Enter bursts and the previous small aim corrections reproduced the
guard's blood/collapse (`pointblank-burst-*`, batches 1242–1253).
`verified-count-wait.png` at 1290 shows **8/18, 21 HP, goals 0/1**.
Ordinary **F6 at 1290/1291** then produced visible **Quick Saving...** while
the same eight-kill overlay remained visible (`checkpoint-f6-settled.png`,
1294). After 40 more batches, a read-only export copied actual
`ctx.vfs.files` entry bytes to `checkpoint-eight/save-0.bin` through
`save-7.bin`. This is a game-created save, with no edited save bytes, memory,
bindings, assets or console commands.

`checkpoint-eight/manifest.json` records all eight actual guest-to-host
mappings. Each row below applies to both guest directories
`c:\baseq2\save\current\` and `c:\baseq2\save\quick\`:

| Guest filename | Export indexes: current / quick | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `server.ssv` | 0 / 4 | 2464 | `33717c18914725eb1a5155f2ac14635084bf7530cea888b51a8f7f79dacda0d8` |
| `game.ssv` | 1 / 5 | 5308 | `156d97736cef1ea136107a9d2c13c2dc4a5a8a3d494b114ffdb2c972b3903985` |
| `demo1.sav` | 2 / 6 | 323095 | `83cb6c6ef993f8f0ba35caad600a6731b63d9f2703dc625d108cc51731a597d0` |
| `demo1.sv2` | 3 / 7 | 104448 | `6ad6c039d4efb8e81628badb5bfaeb8d50ff8e5974aad0b55d3eccaf0b3086c3` |

All eight differ from the original seven-kill saves. On clean runtime exit,
supported `--save-vfs` exported the guest save tree again;
`save-export-validation.json` verifies **all eight files byte-for-byte equal
to the earlier actual guest-byte exports**, not merely to host copies.
`mounted-guest-validation.json` independently compares the pre-F6 guest
response bytes against all eight unchanged original host files. Two initial
read-only observation attempts encountered a JavaScript quoting error and
an incomplete streamed JSON record; the complete retained runtime response
was parsed offline for the latter comparison. Neither supplied guest state.

Ordinary F9 at batches 1334/1335 returned to the doorway world at 21 HP.
However, the attempted post-load F1 pairs, including a later attempt after
600 no-input batches, did **not** yield a visible statistics overlay in the
retained frames. Thus this run establishes the F6 save and exact exported
guest bytes, but **does not independently verify 8/18 after F9**. Those
world frames are not evidence of a stable no-input statistics control.
The label `onward-cover-neutral-*` denotes an ordinary End centering pair,
not a no-input control. No onward movement or room traversal was attempted
after recovery, and no additional kill or level transition is claimed.

The first terminating blocker was **free disk below 2,000,000,000 bytes**.
The controller detected 1,999,884,288 bytes and requested ordinary runtime
quit; the auxiliary guard subsequently recorded 1,998,979,072 bytes. PID
3705696 exited **0 after 245.421 seconds**, final batch 2385. The continuous
floor requirement therefore failed; it is not presented as a compliant
runtime. No second original or runtime restart was attempted. Next, after
disk capacity is restored, mount the eight new files using their recorded
guest mappings, allow F9 to settle, verify the visible kill count, then use
short consumed controls to advance from doorway cover.

Thief II worker `01a1973e-91a3-7693-9c72-46cc90af1d5f` fresh launcher
final/result and explicit runtime/source/build release opened the gate at
**13:28:37Z**. Dispatch was `8f2f8a802db44745a1ac00fe3c65e25965eb587f`;
the repinned main was `787aaad95b6c3bcd435e4d2186956e1c8a6d57e5`.
All **4,392 accepted source pins and 141 prior observed reads** matched,
allowing reuse of module SHA-256
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
Fresh before/after checks passed **4,444 source/module pins, 67 original
and manifest inputs, original-tree membership and 132 actual runtime
reads**. Before original execution, the observer passed actual sync/async
module execution, whole-512 MB shared-memory read-only checks, clock
identity and emitted late-event-10001 retention. String-path observations
do not comprehensively cover descriptors/direct OS reads, and runtime
module identity does not prove compiler-source reads. No tracked runtime,
helper, test, configuration or backend changed; no new build was required.

Focused checks pass **80 PNGs** through CRC/IDAT decoding, the complete
runtime gzip, and **82 key edges / 41 balanced pairs**, all dequeued and
dispatched in order to hwnd `0x10001`. Three relative-mouse events bring
final scheduled/dequeued/routed/dispatched totals to **85**. Final known
queues are empty and sampled physical/async keys, including F6/F9, are
released; pressed latches are distinct. Guest post queue, buttons and SDL
consumption remain unknown. Identical screenshots share hardlinks without
byte changes; a control-log segment is retained losslessly as gzip.

Own original/controller, gate monitor, guards and publication watcher are
absent, with no own process groups or new `wa-child-*` temps remaining.
Local native box ID/state/expiry are **N/A**; explicitly delegated own
shutdown is complete and ownership is handed back. Cleanup, publication,
fresh run final/result and evidence checks are retained in the run directory.
No browser/GPU, audio, FPS, networking or full-suite claim is made. Work
stops at the disk blocker with the new game-created checkpoint preserved.

## 2026-11-01: eighth-kill recovery stopped after a false gate match

Run `scratch/runs/20261101-quake2-eight-save-onward/` did **not verify
the restored 8/18 count or advance through the guard room**. The first
blocker was a worker gate-checking error: the substring predicate matched
its own “WAIT coordinator … runtime/source/build RELEASE” board entry as
though the coordinator had released the runtime. At 13:44:33Z the lighting
`result.json` existed, but the required explicit coordinator release was
absent. The apparent gate receipt is invalid and the append-only board
contains a correction. This run does not satisfy the pre-runtime gate.

The worker noticed the incorrect receipt and requested ordinary quit before
any gameplay input. One original, PID 3721734, exited 0 after 19.646 seconds
at startup batch 25. The reviewed capture is a blank gray startup frame;
all scheduled/dequeued/routed/dispatched input counters are zero. No F9,
F1, movement, attack or F6 was issued. Key samples at this startup stage are
unknown, so this is not a final per-key release demonstration. There is no
restored-world, kill-count, cover-movement, neutral-control or objective claim.

All eight supplied checkpoint files and both checkpoint manifests retained
their pinned sizes and SHA-256 values before/after. The startup command used
exactly their supported `--vfs-mount` mappings. The game-created eighth-kill
checkpoint remains preserved at the preceding run's `checkpoint-eight/`;
startup shutdown exports are not promoted as a checkpoint.

Before the error was noticed, the identity check recorded 4,444 source/module
pins and matched the accepted build's 4,392 source pins and 141 observed
reads, reusing module SHA-256
`dd43e4a6624d2449d7133b731d687c32530f7fcf0041a69ba71a09f78c09aaf4`.
The observer check passed actual sync/async execution, whole-512 MB shared
memory read-only checks, clock identity and emitted late-event-10001
retention. These checks ran prematurely and do not cure the invalid gate.
String-path reads do not comprehensively cover descriptor/direct OS reads;
module identity does not prove compiler-source reads. No new build or
tracked source/helper/test/configuration/backend change was made.

The controller's minimum observed disk was 2,206,560,256 bytes; the separate
one-second guard minimum was 2,207,477,760 bytes. Own original, controller,
gate waiter, disk guard and board watcher PIDs and known groups are absent;
no new `wa-child-*` temporary directory remains. Local native box
ID/state/expiry are N/A; explicitly delegated own shutdown is complete and
ownership is handed back. Fresh cleanup and gate-correction records are
retained. The scratch gate predicate now requires exact coordinator/RELEASE
tokens and has not been rerun. No second original was used. Next recovery
requires a valid coordinator release, then F9 and a consumed, visibly
settled F1 count check before onward input. No browser/GPU, audio, FPS or
full-suite claim is made.
