# Neverhood original SETUP95 entry and first dialog (2026-11-13)

The ordinary, no-switch original entry creates **RT_DIALOG 115**, the launcher containing **Install, Uninstall, Play, Exit**. It does not initially open the installation-directory chooser. Before the launcher is shown, resource/object initialization can display an original registry error. This is a static call-path result, **NO_NATIVE_RESULT**: installation, first native frame, first room and gameplay remain **OPEN**.

This extends the [CD intake](neverhood-original-cd-intake-20261113.md) and [installed asset contract](neverhood-original-installed-asset-contract-20261113.md). Existing ignored preparations 0940/1010/1040 and the 1100 controller repair were read; their original launch holds and readiness requirements remain applicable. TIM's prepared installation path remains parked pending runtime. No production file or installer preparation was edited.

## Exact bytes and recovery

Evidence: `scratch/runs/20261113-neverhood-setup-dialog-2120/`. The retained full-image manifest is `scratch/runs/20261113-coordinator-neverhood-stream-0820/manifest.json`; it records image length **651438080**, SHA-256 `94de724bb47eb2aa588ac4eff28ddc6fd10edebcf2be4dd131ef76875ef5ffd3` and all member hashes. The original member is:

- URL: <https://archive.org/download/neverhood_202508/Neverhood.iso>.
- `SETUP95.EXE;1`, plain ISO 2048-byte sectors, extent **317836**.
- Byte offset **650928128**, length **202240**; inclusive range **650928128–651130367**.
- Complete SHA-256: `ceae7885f49569fdc1100870286634c36d05eabe6010c228efef214c9444a95e`.

`fetch.py` requests that one range with identity encoding, a finite network timeout and external deadline. It requires HTTP **206**, exact `Content-Range: bytes 650928128-651130367/651438080`, exact Content-Length and actual length, and the complete member SHA **before writing to RAM or analysis**. `http.json` and `member.json` preserve the receipt and manifest entry. There was one successful member request, no denied retry/bypass. No complete ISO, extracted tree, other member or media under /home was created. The RAM member was removed after checks; recovery requires the same validated request again.

## PE and callback layout

All addresses below are preferred x86 VAs, base `0x400000`. The six sections are `.text`, `.rdata`, `.data`, `.idata`, `.rsrc`, `.reloc`; `pe.json` records exact RVA/file mapping. Entry is **0x40d090**. There are **181 IAT slots** and **40 resource leaves**; TLS directory is zero, so there is no PE TLS callback array in this member.

The entry installs an FS exception frame, gets version/command line/startup/module information and initializes CRT heap, I/O, environment and argument state, then calls **0x405ab0 at 0x40d1d6**. Its initializer walker `0x40e390`, called by `0x40e270`, walks the two pointer ranges `0x41300c..0x413014` and `0x413000..0x413008`. Their nonzero entries are `0x40faa0` (exit-function storage allocation) and `0x40f840` (exception-filter initialization, including SetUnhandledExceptionFilter with callback `0x40f870`). They are CRT initialization, not a setup dialog callback. CRT initialization failure/exception termination remains a separate conditional boundary; its complete error-rendering machinery was not decoded.

Application dialog procedure is **0x405730**. It is both registered in WNDCLASS `DWI - Setup` by `0x405eb0` and explicitly passed as DLGPROC to CreateDialogParamA. Resource 115 itself has empty class/menu/title fields. Other callbacks include `0x405c80` for EnumWindows on the duplicate-instance route, `0x406020` for a later modal dialog, and SEH handlers recorded in the bounded disassembly. An SEH target is not evidence of an ordinary UI callback.

## Actual no-switch path

1. `0x405ab0` stores hInstance, calls command-line parser `0x405f90`, then `0x405cc0`. Empty arguments leave uninstall-related globals `0x41315c/0x413160` zero. No menu answer is supplied.
2. `0x405cc0` calls FindResourceA/LoadResource/LockResource for **RT_RCDATA 107**. Its exact data supplies `The Neverhood`, words **111, 1, 1**, the setup mutex/finder strings, then word **1** and the game mutex/finder strings. The three initial words select bitmap 111, the compressed-bitmap path, and setup duplicate-instance protection; the final word enables the game-instance check. Resource failure returns zero and WinMain exits before creating the launcher.
3. Setup protection registers `DWI Neverhood Setup FINDER`, creates named mutex `DWI Neverhood Setup MUTEX` with initial-owner FALSE, and calls **WaitForSingleObjectEx(handle,1000,FALSE)**. Exactly WAIT_TIMEOUT (`0x102`) with both switch flags clear invokes `0x405ca0`: EnumWindows callback `0x405c80` sends the registered finder message to each window, then this new process exits. It does not show string 47 merely because that string exists. The original check only singles out TIMEOUT; a different wait result falls through.
4. The analogous game mutex/finder check can activate an existing game and exit. Otherwise the explicit call at **0x405b9f** reaches **COMCTL32 ordinal 17** (InitCommonControls), followed by class/icon/cursor registration `0x405eb0`.
5. `0x405f30` pushes `(hInstance,115,NULL,0x405730,0)` and calls **CreateDialogParamA at 0x405f41**, IAT `0x4155ec`. This is modeless. A null returned HWND exits the application route without inventing a dialog.
6. During WM_INITDIALOG (`0x110`), `0x405730` allocates/constructs the small UI object via `0x4042c0`, stores it with **SetPropA(hwnd,"FIZBIN",object)**, and routes through **0x404720 → 0x404750**. That sets the window title to **The Neverhood**, constructs the setup object (`0x407260`), parses **RT_RCDATA 7000** (`0x409840`), obtains the PID (`0x409d50`), loads/decompresses bitmap **ZDIB/111** (`0x404360 → 0x40a460`), and lays out controls (`0x4043e0`). The bitmap decoder is guest code; resource presence alone proves neither decoding nor pixels. No bitmap preview was made.
7. `0x4043e0` obtains controls by ID, updates the PID static from setup-object field `+0xf0`, and resizes/centers the launcher using bitmap dimensions and system metrics. `0x404750` calls **0x409700** to query `Installed`. Missing product key/value selects the uninstalled branch: it explicitly focuses Install, disables Play and Uninstall, and enables Install. The installed branch focuses Play and enables all three. The init handler returns FALSE after selecting focus. A FALSE init return is not a CreateDialog failure; some earlier initialization failures also return FALSE without destroying the HWND, so successful dialog creation alone cannot certify finished initialization.
8. After creation returns, the ordinary path calls **ShowWindow and UpdateWindow** at `0x405f6e/0x405f75`. It then loads accelerator resource **101** and pumps **GetMessageA → IsDialogMessageA → TranslateAcceleratorA → TranslateMessage/DispatchMessageA**. Keyboard/default-button behavior requires this real message path, not inferred API registration.

## Original dialog and conditional first messages

RT_DIALOG **115**, language 1033, file offset `0x18d1c`, length **266**, SHA-256 `b868a55350baeda5cca9f0617453241a3de29538b79a31403c50c2d9055bf814`, is a standard DLGTEMPLATE, style **0x800008c4**, font **8pt MS Sans Serif**. It lacks WS_VISIBLE: initialization precedes the explicit show.

| ID | Original class/text | Template behavior |
| --- | --- | --- |
| 105 | BUTTON `&Install` | visible child/tabstop, BS_DEFPUSHBUTTON |
| 106 | BUTTON `&Uninstall` | visible child/tabstop, ordinary push button |
| 108 | BUTTON `&Play` | visible child/tabstop, ordinary push button |
| 40007 | BUTTON `&Exit` | visible child/tabstop, ordinary push button |
| 1012 | STATIC `Product ID` | initial placeholder, replaced during initialization |

The resource contains no directory edit field. **RT_DIALOG 114**, title `The Neverhood Installation`, has the directory edit (1015), Browse (1013), default OK and Cancel; it belongs to later installation. Dialog 113 is file-copy progress, 117 DirectX checking, 116 disk location, 112 restart, 103 About and 122 shared-library removal. Their existence does not put them before launcher 115.

There is a concrete earlier message path inside launcher initialization: `0x409840 → 0x406990` obtains ProgramFilesDir through **RegCreateKeyExA(HKLM,Software\Microsoft\Windows\CurrentVersion,...)** and **RegQueryValueExA**. Key failure selects string **13**, query failure string **14**. `0x406690 → 0x4065f0` loads caption string **3** (`Error`), loads/formats the chosen original error string, and calls **MessageBoxA at 0x406673 with type 0 (OK)**. Thus an original registry error can be the first visible UI, while the launcher is still hidden. The default setup path takes the ProgramFilesDir branch; its helper failure is not checked before subsequent path construction, so continuing past that message does not establish sound initialization.

Product PID lookup `0x409d50 → 0x4073a0` uses RegOpenKeyExA; ERROR_FILE_NOT_FOUND is an expected fresh-install path and falls back to PID generation, rather than displaying an error. `Installed` lookup similarly treats absence as uninstalled. No current registry was read or edited here.

Install command dispatch is separately proven: **WM_COMMAND → 0x405380**, ID 105 and enabled control → **0x404b60**. It calls GetVersionExA, rejects platform zero with string **44**, or unsuitable version with 45/46; 44/46 say the program requires Windows 95, while 45 literally says `empty`. These are **post-Install conditions**, not unconditional entry checks. Duplicate-instance handling uses its actual mutex/finder route, not a guessed message-box string.

## Current implementation boundary

`called-iat.txt` records actual call sites and loaded function pointers in the retained windows, including conditional/later branches. `handlers.json` maps their resolved names to exact current handler source and lines. This is a bounded static map, not an exhaustive dynamic call inventory. `source-pins.json`, Git identity and relevant patches bind the inspection, including concurrent uncommitted source.

| Demonstrated requirement | Current source implementation and limit |
| --- | --- |
| Resource lookup/load/lock/free | `09a0-handlers-base.wat:6611` onward uses module resource context; LoadResource returns mapped data, LockResource exposes it, FreeResource returns FALSE. Matching trees/bytes are established statically; guest reads remain unexecuted. |
| Ordinal 17 at `0x405b9f` | `08b-dll-loader.wat:1031` and `lib/host-imports.js:2724` map COMCTL32#17 to API 877, dispatched to `09a9-comctl32.wat:367`. It is a no-op because controls are handled directly. This launcher needs only BUTTON/STATIC; later progress controls are a separate obligation. |
| Modeless dialog + callback/focus | `09a5-handlers-window.wat:997` calls dlg_load, installs the explicit DLGPROC, and dispatches WM_INITDIALOG with its continuation. `GetPropA/SetPropA` in `09a7-handlers-dispatch.wat:5214/5225` provide object storage. Template/default-control parsing and init-return focus handling exist; actual Neverhood callback stack/heap/SEH correctness is unknown. |
| Registry reads and early errors | `RegCreateKeyExA` in `09a7d-handlers-shell-file.wat:1265` delegates to `lib/storage.js:1365`; query path goes through `09a-handlers2-runtime.wat` to storage's typed/buffer-sized query. Fresh defaults in storage include ProgramFilesDir/CommonFilesDir. Storage's key creation does not model Windows access-control permissions; this does not prove a real machine's HKLM write access. Neverhood state was not seeded. |
| Duplicate instance | CreateMutexA/ReleaseMutex in `09a0b-handlers-base-late.wat` use synchronization core; WaitForSingleObjectEx in `09a0-handlers-base.wat:5372` calls host_wait_single and can yield. Host fallback and ThreadManager routes differ; fallback tolerates unknown handles and polls readiness. Actual selected backend, cross-process naming, timeout/ownership and EnumWindows/SendMessage interaction remain untested. |
| Error MessageBoxA | `09a5-handlers-window.wat:1234/1282` creates a modal dialog and enters modal_begin; the host log return does not supply the guest answer. Error display and balanced user dismissal need runtime observation. |
| Ordinary dispatch and default button | Current LoadAcceleratorsA reads RT_ACCELERATOR; IsDialogMessageA handles dialog keyboard commands; GetMessage/DispatchMessage/ShowWindow/UpdateWindow and control enable/focus APIs have source handlers. Their original launcher composition, bitmap palette/blit, paint ordering, input and visible consequence remain unknown. |

No direct fail-fast `$crash_unimplemented` handler was found among the bounded mapped call-site APIs after resolving ordinal 17. This is **not** proof of complete support: nested helpers, dynamic calls, CRT exceptional paths, allocation/CPU instructions, original bitmap decompression/GDI and later Install/DirectX/copy/COM paths are not runtime-qualified. No exact missing production primitive has been demonstrated here, so there is no justified production patch. The missing evidence is an actual original startup/install run; current host simplifications are explicitly identified above.

## Checks, custody and next step

**95 static/pure checks passed**: complete member identity; every resource leaf agrees with the prior retained resource parse; 20 bounded code windows match exact bytes/hashes; 13 direct rel32 edges and six key instruction pins; original hidden template/default controls; absent TLS; IAT/ordinal layout; repeated parser agreement. Negative controls reject truncated/bad headers and impossible dialog counts; selector mutation breaks the original-ID pin; wrong HTTP status/range/length/SHA fail admission. No installer instruction was executed. `checks.json` records the individual assertions. The windows retain only 7,225 bytes of original code; resource metadata/text and selected small raw records are compact evidence, not an extracted tree.

Git is the source archive: `git-start.txt`, `identity.json`, `relevant.patch`, `owned-doc.patch` and `new-helpers.patch` preserve exact identity, relevant uncommitted hunks and new-file recovery. Seals cover the run artifacts. Docs-only diffcheck and strict pull/push are the publication checks; full build/runtime checks were not authorized or run.

Next, after runtime authorization and current focused checks/build provenance, use the ordinary no-switch original SETUP95 path with the complete original CD. Observe whether it reaches launcher 115 or an actual early error; inspect the real frame before any input. Native install/ordinary Exit/export, separate NHC first-room and gameplay remain OPEN. No screenshots, menu answers, coordinates, state edits, executable execution, Machine/CPU/VM/WASM/browser/game/build, boxes, workers, capacity/reserve probes or general cleanup occurred. Box ID **none**, state **NOT_CREATED**, expiry **null**, stop receipt **N/A**.
