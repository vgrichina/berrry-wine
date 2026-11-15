# USER.281 GetSysColorBrush — 2026-11-15

Implementation and evidence are in progress. No Sims installer or household
success is established. The genuine COMMCTRL companion remains unmodified:
155136 bytes, SHA-256
`39bbfafa8b759ebfcf6a00ee878fa494581a9144891bbd788bded61441de13f9`.

[Wine's USER16 ordinal specification](https://raw.githubusercontent.com/wine-mirror/wine/master/dlls/user.exe16/user.exe16.spec)
defines ordinal 281 as FAR PASCAL, one WORD argument, 16-bit handle result.
[Microsoft's API contract](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getsyscolorbrush)
requires a cached system-owned logical brush, NULL for unsupported indices,
harmless DeleteObject, and tracking of system-color changes.

The predecessor [Win4 lifecycle implementation](ne-win4-dllentrypoint-20261115.md)
published `7a8a2c53d2fdce1d1e354d9177cafdfd9e6d0301`. Its actual compiled
resolver reaches COMMCTRL's distinct header initializer at 2:0000 and traps at
USER.281/key 0x20119 before DLLENTRYPOINT 300 at 2:0176. A later KERNEL.651
connection is identified by disassembly only.

Evidence destination: `scratch/runs/20261115-sims-user281-system-brush/result.json`.

## General implementation

USER.281 now reads one WORD, calls the shared GDI system-brush cache, narrows
its real handle with the existing Win16 map, and returns through the ordinary
FAR PASCAL epilogue with two argument bytes removed. USER32 GetSysColorBrush
uses the same cache instead of allocating a solid brush on every request.

The supported classic palette is indices 0..30, including alternate button
face, hot tracking, gradient captions and flat-menu colors. Negative indices,
31 and larger values return NULL. Real brush records retain system ownership
and their index in private flags; ordinary GDI selection, GetObject and drawing
consume those same records. The existing recursive GDI allocation lock guards
lookup, allocation, publication and SetSysColors refresh. DeleteObject is a
successful no-op for these records, and Win16 keeps their handle mappings.
Win16 and Win32 SetSysColors update existing selected brushes in place.
No fake handles, per-call allocation, application dispatch, ordinal fallback,
native thunk connection or registration is added.

The new test emits a synthetic NE DLL with real USER/GDI ordinal relocations
and x86 assertions. It checks all supported colors against GetSysColor and
LOGBRUSH16, NULL unsupported indices, 2048 repeated requests per owner, harmless
system deletion, FillRect and selected-brush PatBlt with independent GetPixel
constants, and Win16/Win32 SetSysColors. Local, cooperative and actual Worker
paths execute the same DLL; caller EIP/ESP/selectors/depth are restored. An
independent shared-record census finds exactly 31 cached brushes. Win32 repeated
calls preserve the object count. A new execution owner can retain its own
screen bitmap; that is excluded from the brush census.

The actual imported ordinal fails before this change at key 0x20119 and
returns through the caller's preserved context. Afterward the general compiled
controls pass. Fifteen existing GDI/system-color/NE/Win4/ownership suites and the
full locked shared-tree build pass. The new GDI helper attributions and existing
delete-dispatch line references are recorded in the union gate; its checks are
preserved. The callback ownership census remains unchanged at 437 boundaries.
Released foreign NE operation-5/data-span WIP and mixed census changes remain
unpublished and preserved in the shared tree. Committed-HEAD plus owned-feature
source views isolate this implementation for compiled controls.

Two initial test-only assertions were corrected with their failure logs kept:
a per-owner screen bitmap was counted as a brush leak, and FreeLibrary16 was
incorrectly expected to return BOOL instead of preserving EAX as a void API.
The first build correctly refused missing variant attributions; the subsequent
locked build passes with the necessary reviewed rows.

The single genuine post-publication resolver retest is still pending at this
code publication. The prior USER.281 boundary above remains the last genuine
observation until its actual result is recorded. No Sims installer is run.
No box was created: ID and expiry are null; stop receipt is not applicable.
