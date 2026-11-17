## Source Parts (`src/main.watx` include order — 119 files; not every part has a row)

| File | Purpose |
|------|---------|
| `00-regions.wat` | **The memory map, declared** — `region.declare` sizes the compiler's allocator places, four pinned `region.declare-fixed` bases, three `region.declare-derived` off `$GUEST_BASE`, and the `$DIRECT_WINDOW` span |
| `01-header.wat` | Module declaration, host imports, memory layout, CPU state globals |
| `01b-api-hashes.generated.wat` | **Generated** — FNV-1a hash table for Win32 API name→ID lookup |
| `02-thread-table.wat` | Threaded code function table (opcode → handler mapping) |
| `03-registers.wat` | Register access helpers, lazy flag system (flag_op/flag_res/flag_a/flag_b) |
| `04-cache.wat` | Block cache (decoded x86 → threaded code) |
| `05-alu.wat` | ALU operations (32/16/8-bit), shifts, bit ops, MUL/DIV, SETcc |
| `05b-string-ops.wat` | String operations (movsb/movsd/stosb/stosd/cmps/scas + REP) |
| `05c-seg16-ops.wat` | 16-bit segmented operations: segment-base arithmetic and the Win16 execution handlers (ES/CS/SS/DS/FS) — the execution half of the NE loader |
| `06-fpu.wat` | x87 FPU |
| `06b-core-handlers.wat` | Non-FPU threaded handlers: flag ops, LEAVE/BSWAP/XCHG/IMUL, 16-bit ALU/MOV, and every memory-form (`_ro`) handler |
| `06c-mmx.wat` | MMX: eight i64-global registers, whole-register moves/boolean/shift ops direct, packed ops widened to real wasm SIMD |
| `07-decoder.wat` | x86 instruction decoder → threaded code emitter |
| `07b-loop-match.wat` | Loop-idiom matcher (Design A): classifies the ops a self-loop block just emitted and, when a pattern holds, replaces the whole body with one super-op |
| `07c-block-exec.wat` | Experimental per-basic-block executor and region machinery, gated off by default |
| `07d-uop-engine.wat` | Micro-op tier engine (on by default since 2026-09-28; `--no-uop`, `?no-uop` or `uop: false` in `lib/apps.js` turns it off, as `--no-x87-fusion`/`?no-x87-fold`/`x87Fusion: false` do the x87 fold): `$uop_run`, one `br_table` loop over RISC-style programs stored as data in a per-instance arena (`$UOP_ARENA` for the main thread, a `$UOP_THREAD_ARENAS` slot per guest thread), entered from an installed hot loop head. Browser: `?debug` toolbar "uop tier" box, live on running apps |
| `07e-uop-compiler.wat` | The x86 → micro-op compiler for 07d: decodes a hot head's loop, forwards flags into compare-branches, materializes the lazy flag record only at exits and live merges, and encodes the program. Scratch in `$UOP_CSCRATCH`; see [docs/uop-tier-design.md](uop-tier-design.md) |
| `08-pe-loader.wat` | PE executable loader, import table processing |
| `08b-dll-loader.wat` | DLL loader with relocations, export resolution |
| `08c-ne-loader.wat` | NE (New Executable) loader for 16-bit images: per-segment loading into the 64KB-strided WIN16 arena, selector layout, relocation fixups, ordinal-import thunk segment |
| `09a-handlers.wat` | Core ABI layouts, timers and posted-message queues |
| `09a-handlers0-sound.wat` | Shared PlaySound/sndPlaySound core |
| `09a-handlers1-user.wat` | Core USER/window/dialog, shell and common-dialog APIs |
| `09a-handlers2-runtime.wat` | Legacy CRT/string, registry/heap and paint/clipboard APIs |
| `09a-handlers3-sync.wat` | Process/thread APIs and synchronization |
| `09a-handlers4-late.wat` | Pointer probes, late USER/GDI APIs, IME and character conversion |
| `09a0-handlers-base.wat` | Early base handlers: process, loader, locale, DDE, security, files, synchronization and memory |
| `09a0b-handlers-base-late.wat` | Later environment, process, synchronization, memory, filesystem and atom handlers |
| `09a0c-handlers-device-io.wat` | DeviceIoControl and bounded Win9x device-I/O behavior |
| `09a1-comctl-handlers.wat` | COMCTL32 helper API handlers |
| `09a2-handlers-console.wat` | Console API handlers (screen buffer, cursor, read/write) |
| `09a3-handlers-audio.wat` | Audio/wave API handlers (waveOut*, mmio*, mci) |
| `09a4-handlers-gdi.wat` | GDI API handlers (SelectObject, pens, brushes, BitBlt, text) |
| `09a4b-handlers-cursor-icon.wat` | Cursor/icon resource loading, interning and rasterization handlers |
| `09a5-handlers-window.wat` | Window creation & message dispatch (CreateWindowExA, GetMessage, etc.) |
| `09a5b-handlers-window-late.wat` | Later USER/GDI window, message, dialog, clipboard and enumeration handlers |
| `09a5c-handlers-wide.wat` | Wide-character KERNEL/USER adapters over the mature ANSI paths |
| `09a5d-handlers-windowpos.wat` | Rectangle and window-position utility handlers |
| `09a6-handlers-crt.wat` | C runtime/string handlers (strlen, strcmp, _mbschr, etc.) |
| `09a7-handlers-dispatch.wat` | Late-added misc handlers (shell, version, file, key/prop, atoms, setupapi) |
| `09a7b-ole.wat` | OLE/COM: ROT, monikers, bind contexts, IFont, structured storage, IDataObject/clipboard, IOleObject/IOleCache/IViewObject |
| `09a7c-mixer.wat` | WINMM mixer handlers (mixerOpen/GetLineInfo/GetControlDetails and A/W pairs) |
| `09a7d-handlers-shell-file.wat` | Later file, registry, shell and desktop handlers |
| `09a7e-video-codecs.wat` | Video for Windows decoders (BI_RGB, RLE8, Cinepak, MS Video 1 8/16 bpp) as pure functions over WASM addresses; `tools/avi-player/` compiles this fragment standalone to verify it against ffmpeg and play corpus movies ([docs/video-support-design.md](video-support-design.md)) |
| `09a7f-video-avi.wat` | AVI (RIFF) reader: header/stream parse, idx1/indx chunk tables, chunk reads from a VFS file or guest memory (`$avi_open_memory`, for "AVI" resources); backs AVIFile* |
| `09a7g-video-icm.wat` | Installable Compression Manager (ICOpen/ICDecompress/ICGetInfo…) over the built-in 09a7e decoders, by fourcc |
| `09a7h-video-mciavi.wat` | MCI `avivideo` device for `mciSendString`: open/play [wait]/stop/seek/put/window/status, decode on the guest clock, PCM audio via waveOut, MM_MCINOTIFY; a parked `play wait` re-enters its thunk once per turn |
| `09a7i-video-mciwnd.wat` | MCIWnd (`MCIWndCreateA`, WAT-native wndproc `0xFFFF0006`): MCIWNDM_*/MCI_* messages turned into command strings for the 09a7h device, NOTIFYMODE to the parent |
| `09a8-handlers-directx.wat` | DirectX handlers — DirectDraw, DirectSound, DirectInput; COM vtable dispatch through the thunk zone, and the `DxObject` record declaration |
| `09a8b-handlers-opengl.wat` | OpenGL 1.x / WGL frontend: one ABI bridge lowering the measured Quake II GL/WGL set to the generic GPU backend |
| `09a8c-gl-encoder.wat` | Native GL command records, immediate primitive normalization, buffer growth, and synchronous barriers |
| `09a8d-gl-abi.generated.wat` | Generated GL argument lengths and barrier metadata, checked against the JavaScript reference |
| `09a8e-gl-state.wat` | GL context attributes, attribute stacks, client arrays, and indexed drawing |
| `09a9-comctl32.wat` | COMCTL32: ImageList, toolbar and status-bar creation, up-down and property-sheet stubs, MenuHelp, DSA/DPA dynamic arrays |
| `09aa-handlers-d3dim.wat` | **Generated** — Direct3D Immediate Mode: ~211 IM methods across D3D v2/v7 (Device, Viewport, Material, ExecuteBuffer, VertexBuffer, Texture), plus pick state and viewport light lists |
| `09ab-handlers-d3dim-core.wat` | D3DIM core helpers: hand-written forwarding from the v1/v2/v3/v7 stubs into the IDirect3DDevice3/IDirect3DViewport3 cores, and the extended state-block layout |
| `09ac-handlers-d3d8.wat` | Direct3D 8 compatibility frontend: exact D3D8 COM ABIs translated onto the shared D3D9 backend state |
| `09ad-handlers-d3d9.wat` | **Generated** — Direct3D 9: IDirect3D9, IDirect3DDevice9, IDirect3DTexture9, IDirect3DSurface9, plus windowed-vs-fullscreen device-window tracking |
| `09ae-d3d9-resources.wat` | Additional D3D9 resource interfaces and ownership paths |
| `09af-d3d-shader-ir.wat` | Backend-neutral shader IR validation and lowering ABI |
| `09ag-d3d-shader-vm.wat` | Dedicated bounded shader-program virtual machine |
| `09ah-d3d-software.wat` | Programmable software triangle raster pipeline |
| `09ai-d3d-render-lifetime.wat` | Render-instance heap retirement and handoff exports |
| `09aj-d3d-fixed.wat` | Native fixed-function pipeline lowering |
| `09ak-d3d-depth.wat` | D3D9 depth-surface identities, state and lifetime |
| `09akg-d3d9-gps.wat` | D3D8/9 GPU stream v2 producer (ring api 4), the only D3D8/9 render path since d3d9-retire S4 deleted the JS host (`lib/d3d9-host.js`); `lib/gpu-stream-host.js` executes it |
| `09al-d3d-reset.wat` | Transactional D3D9 device reset implementation |
| `09am-d3d-color.wat` | Independent D3D9 color-surface state and ownership |
| `09b-dispatch.wat` | Manual dispatch helpers, including the guest-stack DLGPROC return continuation (CACA003C) |
| `09b2-dispatch-table.generated.wat` | **Generated** — br_table dispatch calling handler functions |
| `09c-help.wat` | WAT-native help system |
| `09c0-window-table.wat` | WND_RECORDS + accessors, per-slot parallel tables, GWL/cbWndExtra, dialog state, class table, `$wat_wndproc_dispatch`, focus |
| `09c2-treeview.wat` | WAT-native TreeView control: per-item TV_TABLE records, image and owner tables, per-window view state |
| `09c3-controls.wat` | CONTROL_TABLE and the built-in control wndprocs (Button, Edit, Static, ListBox, ComboBox, ColorGrid, ScrollBar, ProgressBar, ListView, TrackBar…) with per-window state structs |
| `09c3-controls0-basic-wndprocs.wat` | Simple built-in control wndprocs split from the control-state fragment |
| `09c3-controls1-browse-dialog.wat` | SHBrowseForFolder tree and dialog implementation |
| `09c3-controls2-open-save-dialog.wat` | Open/Save common-dialog controls and behavior |
| `09c3-controls3-color-dialog.wat` | ColorGrid and ChooseColor dialog implementation |
| `09c3-controls4-shell-dialogs.wat` | Run and Shut Down shell-owned dialogs |
| `09c3-wndprocs.wat` | ListView state, messages and painting |
| `09c3-wndprocs1-toolbar.wat` | Toolbar state, sizing, messages and painting |
| `09c3-wndprocs2-tooltip-trackbar.wat` | Tooltip/TrackBar wndprocs and owner-draw helpers |
| `09c3-wndprocs3-listbox.wat` | ListBox storage, selection, scrolling and painting |
| `09c3-wndprocs4-combobox.wat` | ComboBox and its dropdown popup shell |
| `09c3-wndprocs5-edit.wat` | Edit wndproc and multiline helpers |
| `09c3-wndprocs6-animate.wat` | COMCTL32 SysAnimate32 Animate control: RLE8/raw AVI from a resource or file, WM_TIMER or host-clock (`$anim_service`) playback, ACN_START/STOP |
| `09c3a-dialog-runtime.wat` | Native dialog runtime and find/replace helpers; shared synchronous/continuation DLGPROC result epilog |
| `09c3b-scrollbar.wat` | Shared Win98 scrollbar rendering and interaction helpers |
| `09c4-defwndproc.wat` | DefWindowProc non-client paint: 3D outset frame, caption gradient and text, sysmenu buttons, as a callable entry point |
| `09c5-menu.wat` | Menu painting and hit-testing over the heap-resident menu blob, indexed per window by MENU_DATA_TABLE |
| `09c6-winhelp-core.wat` | WAT-native WinHelp document core: WAT-owned file bytes and directory index, plus the bounded-size limits every help parser works within |
| `09c7-winhelp-hlp.wat` | Bounded HLP outer-file and directory B+tree parser: semantic index, phrase, font and bitmap extraction |
| `09c8-winhelp-cnt.wat` | Bounded WAT-native CNT contents-file parser (directive tokenizing, topic/heading tree) |
| `09c9-winhelp-ui.wat` | WAT-native WinHelp typed topic layout: positioned text/space/bitmap runs, fonts, colors, extents |
| `09d-winsock.wat` | Virtual LAN Winsock core — socket table, in-process switch, and the `vln/1` frame wire that joins two emulator processes into one room |
| `09d1-mpr.wat` | Multiple Provider Router behavior for a machine with no network provider or mapped drives |
| `09d2-tapi.wat` | TAPI 2.0 line device API (TAPI32.DLL) for a machine with zero line devices — real init/shutdown and documented errors, not stubs |
| `09d3-spooler.wat` | Win98 spooler surface for a machine with no installed printer |
| `09d4-dplay-net.wat` | DirectPlay service provider over the virtual LAN: `dpl/1` frames for session discovery, join, player announce and data, joining two processes' IDirectPlay name tables |
| `09e-win16-api.wat` | Win16 API dispatch by module and ordinal (KERNEL/USER/GDI) — the Pascal-convention twin of `$win32_dispatch` |
| `09e2-win16-dialog.wat` | Win16 dialogs: 16-bit RT_DIALOG template rewritten into the 32-bit form, plus the Pascal modal pump |
| `09f-win16-ddeml.wat` | Win16 DDEML: string/data handle interning, service registration and truthful "no peer" conversation results |
| `10-helpers.wat` | String/memory helpers, heap allocator, resource walker, window/paint/clipboard helpers |
| `10a-gdi-bitmap.wat` | WAT-native GDI bitmap object records and raw DIB parsing: the 48-byte record, its flags word and canonical-bits ownership |
| `10b-gdi-font.wat` | Win16/Win9x bitmap fonts: FNT strike parsing and rasterization in WAT, plus the installed-font registry |
| `10c-truetype.wat` | TrueType metrics: bounds-checked `glyf`-outline table parsing for advance widths and TEXTMETRIC, no host font measurement |
| `10c1-truetype-hint.wat` | Runtime TrueType instruction engine: fpgm/prep/glyph programs over eight ppem contexts with scaled CVT, storage and twilight points |
| `10d-gdi-region-path.wat` | GDI regions (allocator + polygon scan-converter), path engine (record/flatten/widen/stroke), DC clipping, object allocator |
| `10e-gdi-metafile.wat` | GDI palettes, WMF/EMF recorder and player, bitmap objects |
| `10f-gdi-dc.wat` | GDI device-context state: save/restore, selected objects, surface descriptors, text metrics, native text entry points |
| `10g-gdi-raster.wat` | GDI software rasterizer: span fill, clip bands, brush sampling, shape primitives, region combine |
| `10h-gdi-adapters.wat` | Native `$gdi_native_*` adapters moved out of the import header; only real imports retain `$host_gdi_*` names |
| `11-seh.wat` | Win32 Structured Exception Handling |
| `12-wsprintf.wat` | wsprintf/sprintf implementation |
| `13-exports.wat` | WASM exports (run, get_eip, register accessors, etc.) |
