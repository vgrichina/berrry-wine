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
| `named-sync-namespace.js` | Desktop-wide named event, semaphore and mutex objects; per-process references and shared atomic state for worker waits |
| `storage.js` | localStorage-backed registry and INI file persistence |
| `filesystem.js` | Virtual filesystem for file operations |
| `vfs-host-files.js` | Expands explicit CLI `--vfs-include` globs within their bounded host roots |
| `vlan-wire.js` | Virtual LAN transport: loopback segment (instances in one process) and process wire (emulators in separate OS processes over child IPC). Carries opaque frames only — all routing lives in WAT |
| `compile-wat.js` | Browser-side WAT → WASM compiler (wraps wabt.js) |

### Rendering surfaces

One offscreen **back-canvas** per top-level hwnd (sized to full window), allocated lazily by `renderer.getWindowCanvas`. All guest GDI and all WAT-dispatched child WM_PAINT draws land here via `_getDrawTarget` in `host-imports.js`. `repaint()` blits each back-canvas to the screen in z-order — the screen canvas is a composite target, not a drawing target.

Child controls painted via `_drawWatChildren` use `_activeChildDraw = { canvas, ctx, ox, oy, hwnd }` to short-circuit DC resolution. `ox/oy` are **window-local** (back-canvas coords, not screen coords) so children composite coherently with the guest's own paint output.

Don't add a second drawing surface. If a GDI call needs to hit the screen, route it through the parent window's back-canvas with the right offset.
