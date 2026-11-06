## JS Libraries (`lib/`)

| File | Purpose |
|------|---------|
| `mem-utils.js` | Shared memory utilities (readStrA, readStrW, g2w) |
| `host-imports.js` | Shared WASM host imports (GDI, file I/O, registry, help system) |
| `renderer.js` | Win98 canvas renderer (windows, controls, menus, dialogs, drawing) |
| `renderer-input.js` | Renderer input handling (mouse, keyboard, menu interaction) |
| `dib.js` | DIB → RGBA decoder (1/4/8/24/32 bpp + RLE4/RLE8); used by both guest BITMAP rendering and host icon extraction |
| `resources-icon.js` | Browser-side PE walker that extracts the desktop icon from each app's exe at page load (RT_GROUP_ICON → RT_ICON → DIB → data URL) |
| `dll-loader.js` | DLL loading, relocation, import patching |
| `hlp-parser.js` | Windows HLP file parser (B+tree, Hall phrase decompression) |
| `thread-manager.js` | Multi-thread support via separate WASM instances |
| `storage.js` | localStorage-backed registry and INI file persistence |
| `filesystem.js` | Virtual filesystem for file operations |
| `vfs-host-files.js` | Expands explicit CLI `--vfs-include` globs within their bounded host roots |
| `vlan-wire.js` | Virtual LAN transport: loopback segment (instances in one process) and process wire (emulators in separate OS processes over child IPC). Carries opaque frames only — all routing lives in WAT |
| `compile-wat.js` | Browser-side WAT → WASM compiler (wraps wabt.js) |

### Rendering surfaces

One offscreen **back-canvas** per top-level hwnd (sized to full window), allocated lazily by `renderer.getWindowCanvas`. All guest GDI and all WAT-dispatched child WM_PAINT draws land here via `_getDrawTarget` in `host-imports.js`. `repaint()` blits each back-canvas to the screen in z-order — the screen canvas is a composite target, not a drawing target.

Child controls painted via `_drawWatChildren` use `_activeChildDraw = { canvas, ctx, ox, oy, hwnd }` to short-circuit DC resolution. `ox/oy` are **window-local** (back-canvas coords, not screen coords) so children composite coherently with the guest's own paint output.

Don't add a second drawing surface. If a GDI call needs to hit the screen, route it through the parent window's back-canvas with the right offset.

OpenGL window presentation can retain its existing GPU layer instead of reading
every frame into canonical window bits. This requires the WASM
`gl_window_readback_version` capability and a canonical top-level window surface.
The renderer marks offset28 of its shared GDI window-surface record GPU-owned.
Before a GDI source or destination descriptor exposes those bits, WAT checks the
flag and synchronously calls host opcode `0x10002` to materialize the latest
front. The Worker route uses the same synchronous broker barrier. Ordinary GDI
surfaces have a clear flag and incur no host/RPC call. After materialization,
GDI writes and later GL presents retain their temporal ordering.

Resize and GL context retirement resolve pending ownership before replacing
storage or detaching the layer. Bitmap GL drawables, child windows with shared
parent backing, and older modules keep eager publication. The compositor may
display a GPU-owned layer directly; guest screen reads still use the existing
composited-screen readback path.

OpenGL display gamma is applied by `presentation-filter.js` to the final
window composite, using the process's `SetDeviceGammaRamp` RGB lookup tables.
`renderer.js` selects the foreground OpenGL window's process; local and Worker
GL frame layers carry `api: 'opengl'`. Identity ramps retain the direct-canvas
fast path. GL attachments, bitmap drawables, canonical GDI storage and guest
screen reads stay uncorrected. DirectDraw and Direct3D presenters retain their
own gamma handling and do not opt into this pass. There is no separate pass
over the scaled output: GPU scalers apply the tables to the source texture,
and Canvas2D scalers draw through an SVG `feComponentTransfer` table filter,
falling back to one source-resolution WebGL copy where the filter cannot
reproduce the tables exactly. The filter path is checked once per ramp with
a 256-pixel readback; otherwise no CPU frame readback is made, though the
WebGL fallback copies a source-sized image from WebGL into Canvas2D each
frame (about 1 ms/frame in headless Chrome on an M1). Measurements:
`docs/re-notes/quake3-demo.md`.
