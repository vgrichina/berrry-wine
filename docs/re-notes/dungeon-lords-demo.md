# Dungeon Lords demo

## Original media inventory (2026-10-10)

- Local source: `test/binaries/win98-games-a-d/Dungeon Lords-Demo1.5-Win98-D3Dprobably.exe`
- Bytes: 582511033
- SHA-256: `3833f80a791bac45a2f0676d37778cdcef55a486f3a736cf21026b12cef8aa9c`
- PE32 x86 GUI executable; initial bootstrap contains InstallShield strings.
- No entry in the inspected public `DESKTOP_APPS` list or prior qualification in the task/re-note index. This is not a release or redistribution decision.

Original bytes are staged on temporary boat `bx_hx8msa33` with verified SHA-256. No installed game path has been established. No installer approval, gameplay, audio or FPS result is claimed.

Task: `NEW-GAME-DUNGEON-LORDS-DEMO-20261010`; owner root Codex, one worker with serialized runtime resources.

Boat staging completed with matching SHA-256. `7z l` cannot open the original as an archive (2026-10-10 03:55Z); this is an extraction-tool limitation, not a guest result. The tail contains `setup.ini`, naming Dungeon Lords CE (Demo), DreamCatcher Interactive and InstallShield EngineVersion10.50.0.125. Next capture the original bootstrap self-extraction/child launch on the boat without accepting installer dialogs, then inventory the produced cabinets.

## Bootstrap observation (2026-10-10)

Run `scratch/runs/20261010T0402Z-dungeon-lords-bootstrap`: original setup starts at `0x0040ce02`, calls ShellExecute with `C:\setup.exe -deleter`, then Exit(0). The harness reports eip-zero after that exit. The captured launch is the same setup.exe with `-deleter`, not a game or InstallShield engine. No cabinet payload was extracted; the 49 captured files are bootstrap/system scaffolding. Next use a bounded startup API trace to identify the extraction failure before the self-delete branch. Do not follow the deleter as a game launch.

## Early-exit narrowing (04:12Z)

Breakpoint0x40b14c proves WIN32_FIND_DATA contains correct582511033-byte source size (0x22b869b9), not the8MiB PE staging prefix. Headers are read before this check. No-uop reproduces the early self-deleter path. Next follow the returned size check and caller branch into cleanup; no evidence yet of truncated metadata or uop failure. Evidence scratch/runs/20261010T0410Z-new-games-bootstrap-diagnostics.

## Correct child route and native dependencies (2026-10-10 04:42Z)

The earlier deleter-as-cleanup-only inference was wrong. The original parent requests a self child with `-deleter`; replaying that argument (`--args=-deleter --stuck-after=0 --save-vfs=DIR`) actually extracts the InstallShield bootstrap and cabinets. No buttons need to be answered. The original parent exits because the CLI records the child boundary. CreateProcessA also loses its command-line argument when lpApplicationName is non-null; tracked separately as CREATEPROCESS-CHILD-ARGS-20261010.

Both demos now reach the visible InstallShield error `-5003:0x7e`. Native setup.dll initially reports missing comctl32.dll/shell32.dll. Staging those exact existing fixtures removes those missing-import warnings but does not resolve the error. A trace then shows many missing WinINet dynamic exports. Native WININET.DLL from the existing Delphi6 Win95 Support fixture loads successfully, but the error persists: missing WinINet exports alone are not proven as its cause. Next trace the first failing module/export or error-construction path with this complete recorded dependency set, or decode the original appended multi-volume installer payload. Do not declare a complete game tree from data1.cab alone.

Dependency SHA256: shell32 `533c5809a9b6bdb236cce17a14c03ff251c4ca4d00790ea8e8034ee5d14d7f61`; comctl32 `28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4`; wininet `6e0d08e5a31a4b96a3951b7bc8ced1b3c6e1db7d78c3e71a2694f9dce4fa2448`. All runtime/extraction occurred on bx_hx8msa33; no approvals accepted. Evidence: scratch/runs/20261010T0439Z-installshield-child and scratch/runs/20261010T0442Z-installshield-native-deps. This is installer progress, not gameplay.

## Extracted game startup and mouse_event (04:54Z)

Original data2.cab is at byte57353830, length523697748 (adjacent installer metadata); SHA256859a66f84c18017071c904c55eed38419ad320b70c96c653a8478112541feac6. Unshield extracts6118 files. Actual Files/dlords.exe requires `--d3d9-renderer=software --d3d9-programmable`; default zero shader caps cause early exit. Files10 belongs under MilesRD (actual guest searches). With plugins the game calls mouse_event(MOVE,1,1) at0x551677; the missing API trapped through handle_fallback. The implementation now queues system mouse input and updates DirectInput motion rather than fabricating success. Guest reaches PlayTheGame, then reports missing maps/parchment192.bmp. Files9 likely maps, pending verification. No gameplay qualification. Evidence0444/0448 and scratch/runs/20261010T0454Z-mouse-event-fix.

Input contract reference: https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-mouse_event. Focused tests cover stdcall, relative signed deltas, clipping, normalized absolute endpoints, button snapshots, wheel delta/screen coordinates, X buttons and move coalescing; existing keyboard/cursor suites pass. Worker import remains synchronous through generated signature. Existing DirectInput buffered-button encoding covers left/right only; injected middle/X buttons are Win32 state/messages, not a newly claimed expanded DirectInput device profile.

## Original payload mapping and intro transfer (2026-10-10 05:09Z)

Original Files9 -> maps is verified by the requested Parchment192.bmp. Other original groups mapped by requested/embedded paths: Files1 -> bink_video, Files3 -> COMPASS, Files4 -> efxgfx, Files7 -> INTERFACE, Files8 -> MAINMENU, Files10 -> MilesRD, Files11 -> MUSIC, Files12 -> SPEECH, Files14 -> savegfx, Files15 -> Shaders, Files21 -> waterart. These are hardlinks to extracted originals on the boat; remaining groups still need installed-layout verification. Seed the original Files/granny2.dll with --dll-seed; it resolves _GrannyVersionsMatch_@16 and completes InitGRN. Files4 resolves efxgfx/twinkle.al8.

Next failure was the actual D3D9 StretchRect call at0x447979 (COM vtable offset0x88), not the unrelated unresolved kernel ordinals named by the generic crash printer. Source0x7d110004 is an800x600 X8R8G8B8 DEFAULT offscreen surface; destination0x080e2010 is the implicit backbuffer wrapper, rectanglesNULL/filterNONE. The helper only supported heap color metadata and trapped on the implicit destination. Evidence scratch/runs/20261010T0504Z-dl-stretch-backbuffer.

The fix synchronizes source pixels and uploads explicitly to the implicit backbuffer, preserving current RT binding and rejecting foreign ownership, locked surfaces and non-DEFAULT sources. Equal-size X8R8G8B8 whole-surface transfers are covered; scaling/conversion and other filters remain unsupported. Direct and real Worker tests verify GPU-owned pixels, locked-source/destination rejection, failed-upload recovery, stdcall suspension/completion, non-DEFAULT/foreign-device rejection and an unchanged separately bound RT. Worker Present is pipelined; pixel assertions use a fenced LockRect readback.

Original game now reaches a visibly decoded intro movie in a30-second no-input replay; no fail-fast/EIP0 occurred. Reviewed screen in scratch/runs/20261010T0509Z-dl-stretch-fix. This is intro progress, not gameplay or FPS qualification. Next ordinary input to skip intro/reach menu, then complete remaining asset mappings and gameplay.

## Menu surface locks (2026-10-10 05:37Z)

Files17 -> sounds maps661 original WAV files and removes the missing Door_Metal_Giant_Open.wav error. Three ordinary Escape presses (down/up at1200/1240,1700/1740,2200/2240) leave a black screen. A100-second no-input replay ends on a white movie rectangle, not a usable menu; the original movies total74 seconds, but emulation wall time is not proof of playback completion. Evidence0533/0534.

The bounded menu trace identifies repeated Surface9::LockRect at0x40f89f with flags0x8000 (NO_DIRTY_UPDATE), rejected by the standalone color-surface flag mask. Accepting this flag preserves synchronization and content generations: those track actual bytes, not texture dirty-region hints. Standalone surfaces have no texture dirty-region list. Official contracts: https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dlock and https://learn.microsoft.com/en-us/windows/win32/api/d3d9/nf-d3d9-idirect3dsurface9-lockrect.

Regression tests exercise GPU readback, CPU writes, combined NOSYSLOCK/READONLY flags, double-lock rejection and subsequent readback in direct and real Worker backends. Canonical build and color surface/target/alias suites pass. The actual game now pairs those locks with UnlockRect at0x40fa0c. Metadata at2250 confirms surface0x7d3c0004 is an800x600 X8R8G8B8 SYSTEMMEM standalone surface, with content generation65. Evidence scratch/runs/20261010T0536Z-dl-no-dirty-update. The final screen remains black and the initial s_DDCanvas LockRect failure remains in debug.log: this fixes one real contract defect, not the complete menu. Next trace the separate initialization lock and the menu copy/present path. No gameplay qualification.

## Visible menu after standalone DISCARD support (05:45Z)

Initial canvas creation is800x600 X8R8G8B8 SYSTEMMEM, followed by LockRect(flags0x2000) returning at0x40d12c. Rejecting this as non-dynamic was too strict: Wine's native D3D9 conformance test expects S_OK for DISCARD locks on SYSTEMMEM/SCRATCH offscreen surfaces (https://github.com/wine-mirror/wine/blob/master/dlls/d3d9/tests/device.c, test_reset). The generic flag documentation's dynamic-only restriction does not describe this compatibility behavior.

Whole-surface standalone DISCARD now exposes the real allocation after synchronizing pending work. Contents before writing are undefined by this flag; retaining them is permitted. Writes are published by normal UnlockRect, with subrect and READONLY combinations still rejected. Tests cover SYSTEMMEM and DEFAULT surfaces, combined flags, writes/readback and double-lock rejection in direct and Worker modes. Build and color surface/target/alias suites pass.

Original replay now logs canvas LOCKRECT SUCCESS twice and displays the main menu (SINGLEPLAYER / OPTIONS / EXIT) after the same ordinary Escape inputs. Reviewed screenshot/build identity in scratch/runs/20261010T0545Z-dl-discard-fixed. Menu rendering is CPU LockRect source/backbuffer copy plus UnlockRect and Present, not GPU triangles in the sampled scene (evidence0544). A55-second unfiltered trace failed to reach its target batch and is recorded as a non-observation, not evidence of absent calls. Next ordinary Singleplayer input and actual gameplay; menu alone is not qualification.

## Character creation and original models (05:56Z)

Instantaneous click at3000 does not open Singleplayer; ordinary mousemove400,266 at2980 then mousedown3000/mouseup3040 does. A second press at3200 is too early for the submenu transition. Move4400 then down4500/up4600 at the same position selects New Game. That initially reports missing `grn_model/PCDM_basemodel_pants.gr2`; the actual CreateFileA path is captured in scratch/runs/20261010T0553Z-dl-model-layout.

Map original Files5 -> grn_model (2346 files) and Files6 -> grn_texture (417 files, retaining monster/pcdm/pchf/pcum subdirectories). The latter destination is corroborated by executable grn_texture/<race>/ strings. These are hardlinks to original extracted payloads, with no changed game bytes. The40-second run reaches a character model/HUD but only part of the UI; a70-second run completes the character-creation screen at7944 batches. Evidence0554/0556. The incomplete earlier frame was loading, not a proven missing-rendering bug.

The reviewed screen shows default Dwarf Male, race/class/customization controls, an empty name field at top-left, Make New Character at approximately100,561 and Exit at295,561. Next ordinary character creation and world gameplay. No player-controlled world gameplay or FPS qualification yet. Runtime root remains /home/user/dl-unshield-20261010/Files on the temporary boat; the source installer SHA and mappings above allow reconstruction.

## Name entry, completed frames, and coordinate correction (06:27Z)

The apparent black screen after typing a name was an unfinished-frame capture,
not evidence of a guest-state stall. A diagnostic copy of the CLI harness uses
the existing `ctx.onGuestFrame` hook to copy the 32bpp DIB at actual DirectDraw
Present (slot 21). These completed frames show the entire character UI, while
arbitrary-batch canvas/raw-surface captures can show only the HUD and 3D model.
The observer changes no guest memory or renderer behavior. Its source addition,
module identity, input log, and reviewed frames are recorded in
`scratch/runs/20261010T0623Z-dl-fullkeys-present`.

Ordinary Make New Character, Continue through attributes, and heraldry selection
reach name entry. `keypress` (WM_CHAR) alone leaves the name blank in this game;
the earlier `0617Z-dl-name-char-replay` is therefore inconclusive about name
confirmation. Full keydown/keypress/keyup sequences for Codex, followed by Enter
keydown/keypress/keyup, enter `codex` and advance to **Play This Character**.
The completed frame at batch 13006 proves that transition. Frozen-session
evidence `0605Z-dl-live-create` remains useful for the ordinary input sequence,
but its black post-name captures must not be interpreted as a rendering failure.

The control canvas is 640x480 while the game is 800x600. Input uses canvas
coordinates: clicking 295,562 maps to guest 368,599 after clamping, outside the
visible Play button. Use approximately **235,450** for that button (guest
294,562). The next replay tests this corrected click. World gameplay and FPS
remain unqualified; do not promote character creation as gameplay.

## World loading and authoritative installer layout (06:36Z)

The corrected Play click starts `SetGameResolution` and `LOAD SEGMENT: 0`.
It first stops with `DAK: AnimTex Load Error On sky/cloud-lg.al8` (run0627).
Restoring Files16 -> sky advances to the next missing path,
`roadway/roadway.al8` (run0631). Both files are original installer payloads.

The original extracted `disk1/data1.hdr` records **all 22 group destinations**.
For this header, the CAB descriptor base is 512 (u32 at file offset12).
`unshield -D 3 g data1.cab` reports relative file-group descriptor offsets.
At each descriptor, u32 offset0 points to the group name and u32 offset58
points to its target directory; both string pointers are relative to that
same CAB descriptor base. Validate `<TARGETDIR>` prefixes and known mappings
before using this version-specific reader. This avoids guessing from filenames.

Previously missing destinations are Files2 -> cachetex (237 files),
Files13 -> roadway (1), Files16 -> sky (8), Files19 -> sprites (43), and
Files20 -> terrmap (2). **Correction:** Files12 -> pctalk (10), whereas
Files18 -> speech (22, retaining nested directories). Earlier Files12 -> SPEECH
notes described an incomplete inferred layout, not the installer contract.

The remaining groups were restored with hardlinks to unchanged original files.
All 21 non-root groups now pass recursive destination checks, using identical
inodes or SHA256 equality: zero missing files and zero content mismatches.
The root Files group was extracted in place. Full mapping, parser, hardlink
script, receipts, and `layout-verification.json` are preserved in
`scratch/runs/20261010T0631Z-dl-sky-fixed`. The complete-layout replay is the next
qualification step; these asset checks do not establish world playability.
