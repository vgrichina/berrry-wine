# KKnD Xtreme: authentic DirectDraw file and VERSION search, 2026-11-06

The ordinary VERSION filename search defect is repaired and published in
`028be7625` (merged main `be5fd8e8f`). Both rebuilt shipped modules read the
provenance-pinned original DDRAW resource as **4.7.0.700**, above the demo's
unchanged Win9x threshold. Placeholder files still report no version.

**No in-game startup or gameplay is proved.** The sole browser lifetime failed
at the host layout guard before guest creation after I prematurely launched
before rebuilding substantive changes pulled during publication. The first
failure is preserved; no input, restart or second browser lifetime followed.
The merged source was subsequently rebuilt and the focused controls passed.

Evidence belongs to `scratch/runs/20261106-kknd-version-prerequisite/`.
The predecessor's published registration is `234e8fae38e5614439f2c8d54fd9b19ad133deaa`,
and its [first genuine startup failure](kknd-registered-gameplay-20261106.md)
is retained without replay. Its complete original 16-file game remains at
`scratch/game-media/kknd-demo-20261106/installed/`.

## Retained runtime bytes

Prior [DirectX recovery](jedi-genuine-directx-prerequisites-20261103.md) and
[Crimsonland provenance](crimsonland.md) identify a signed DX8.1 package, but
the referenced local package directory is absent in this checkout. No download
was made. The retained [FreeSpace DX7a checkpoint](freespace-demo.md) supplies
an actual Microsoft DirectDraw runtime, distinct from DSETUP/setup helpers:

* Package: `test/binaries/win98-games-a-d/Colin-Mcrae-Rally2-demo-D3D/extracted/dx7aeng.exe`,
  6,340,040 bytes, SHA-256
  `564de93dcc50691480332e2ccb5565908760b295faa70f8c68854f69dad87189`.
* Retained member:
  `scratch/runs/20261031T2029Z-freespace-wininit/candidate-vfs/directx/ddraw.dll.gz`.
  Decompressed length 352,528 bytes, SHA-256
  `0a37a508dc6703f0998fb41d8fd5b03d7bbb5d466165dce5b45559d85174ca26`.
* Actual VS_FIXEDFILEINFO version: **4.7.0.700**, file MS `0x00040007`,
  LS `0x000002bc`. OriginalFilename is `DDraw.dll`, description is Microsoft
  DirectDraw. The MS word exceeds KKnD's unchanged Win9x `0x00040005` threshold.

The package rehash and a streaming `7z x -so PACKAGE ddraw.dll` extraction match
both the retained bytes and their recorded checkpoint manifest. No media copy
was written. The actual package `directx.inf` is 7,608 bytes, SHA-256
`23909dcc544720d0299ab4fdbda70d0f979847114b1b2e242eaf31ac08cedb7d`.
Its WIN98_INSTALL selects DirectX_System_98, which lists ddraw.dll;
DefaultDestDir=11 identifies the Windows system directory. This establishes
the runtime file's intended installed destination, without renaming a helper.

This is the owner-designated local package, with recorded intake provenance;
no new upstream signature/trust claim is made. The old real setup checkpoint
still has pending reboot operations. One authentic file's metadata does not
establish a completed DirectX installation, native driver execution, or builtin
DirectDraw capability. The guest file bytes and native-loading policy must
remain unchanged.

## Documented filename contract and preparation

Microsoft's [GetFileVersionInfoSizeA documentation](https://learn.microsoft.com/en-us/windows/win32/api/winver/nf-winver-getfileversioninfosizea)
uses the LoadLibrary search sequence, and
[GetFileVersionInfoA](https://learn.microsoft.com/en-us/windows/win32/api/winver/nf-winver-getfileversioninfoa)
does so when no full path is specified.
The original Microsoft [Windows 95/98 SDK LoadLibrary reference, retained by an MSDN mirror](https://techshelps.github.io/MSDN/WINBASE/devdoc/live/pdwbase/dll_1o8p.htm)
lists application directory, current directory, Windows system directory,
Windows directory, then PATH. Modern safe-search ordering is a different OS
default. Microsoft's [current LoadLibrary reference](https://learn.microsoft.com/en-us/windows/win32/api/libloaderapi/nf-libloaderapi-loadlibrarya)
also specifies full-path restriction and searching relative subdirectories
below the search directories.

Before the repair, `src/09a1-comctl-handlers.wat` opened only the literal name.
Both original shipped modules reproduced the defect: explicit system paths
read the authentic resource, while basename lookups failed (15 regression
failures in each baseline log). The repair adds invocation-owned pathname
buffers and searches application directory, CWD, system, Windows, then process
PATH. It uses file I/O only. Absolute/rooted/drive-qualified paths stay explicit;
relative subdirectories are searched under each directory. The first file
opened wins, including an unversioned file shadowing a later versioned one.

Both modules pass 72 search/version checks each: A/W size/read/root queries,
all directory precedence levels, missing resource/output preservation,
explicit paths, relative subdirectories, Unicode/CP1252 and the unchanged
original DDRAW bytes. `test-directx-system-files.js` additionally checks A/W
basename reads of unversioned builtins. The production-source parser fixture
and builtin execution-policy controls pass. VERSION metadata reads do not
load or execute this native DLL, and no loading policy was changed.

## Recovery recipe

Read the existing gzip into memory, require the decompressed size/SHA-256 above,
and provide those exact bytes as `C:\WINDOWS\SYSTEM\ddraw.dll` using an ordinary
explicit VFS file mount. Alternatively, stream the ddraw.dll member from the
pinned existing package and require the same hash. Reference the existing media
paths; do not duplicate the game tree or package. This is file-only provisioning
for metadata, with builtin implementation and native loading policy kept
distinct. Do not import the checkpoint registry or replay pending renames.

## Execution and verification bounds

The ordered WebGL0247 → ArannaComplete0320 → ConanWeight0350 exact terminal
releases and independent checks cleared at **04:59:21Z**. The immutable
45-minute deadline was **05:44:21Z**. Gate evidence checks 306 absent PIDs,
16 refused ports, 11 absent profiles, four free locks and no heavy runtime.

The first locked build and focused tests passed before committing the repair.
Immediate pull/push merged remote `457f25f30`, including substantive runtime
changes and a region-map change from `7613635e22710ee1` to `fbae3a59c4fddb48`.
I started the only browser at **05:03:32Z** before the required merged rebuild.
This was a worker sequencing error. The host correctly refused the stale-layout
module before creating a guest: `region layout MISMATCH`. `first-state.png`
and `terminal.png` were personally reviewed; state has no app, no input and
no parent VFS. No original game files or DDRAW reached a running guest.
The browser closed normally at **05:03:45Z**. This is a harness failure,
not a newly established KKnD, CPU, DirectDraw or VERSION failure.

The postmerge locked build passed, then both exact modules passed all 72
search/version checks plus DirectX system-file controls. Parser and builtin
execution-policy controls passed again. Current source/module identities:

* Source main `be5fd8e8f1d007b4e3f4859aa151deb4070cc147`, clean relevant
  tracked source; own new note and helper patches recorded separately.
* Standard module SHA-256
  `02ec4aba196559715635d21427fa08bd0e9e1d83aed734e3ff0df0cfca4f6d64`.
* Compatibility module SHA-256
  `73538a238b7083380178a7e7d5534f3aa3aa101bd51816eb1bf63104c442fb6f`.

All 16 original installed game files (15,653,500 bytes total) and the retained
DDRAW pin rehash unchanged. Evidence records Git SHA plus relevant binary diff
and owned new-file patches; no source archive or media tree copy was made.
No boxes, subworkers, public deployment or Heroes II were used.

The recovery recipe and ordinary basename repair are now concrete and tested.
A separately authorized future original session must rebuild and test after
any pull that changes runtime source, verify current source/module layout
before launch, provision the exact file above through ordinary VFS loading,
then review menu → Evolved → Walkover and released trusted selection/movement.
This task makes no in-game prerequisite, menu or gameplay acceptance claim and
will not retry its consumed browser lifetime.
