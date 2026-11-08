# NFS3 setup: foreign-thread window dispatch explains the zero-EIP call

Two emulator ownership errors are demonstrated and repaired. The native device
chooser and setup-to-race route remain unqualified: after the first repair the
probe reaches ordinary teardown, exposing the second error. Both repairs pass
focused regressions and a locked build. Final native-browser qualification was
held when shared `/home` free space fell below the task's 5 GB floor. No runtime
box was allocated (ID/state/expiry/stop receipt: null / NOT ALLOCATED / null /
null). No game input, renderer choice, guest patch, DLL alias or state forcing
was used.

Evidence: `scratch/runs/20261108-nfs3-setup-zero-eip-cause/`. Git is the source
archive: `base-commit.txt`, `nc-only-source.patch` and `relevant-source.patch`
identify the source variants; fetched modules and browser response hashes pin
what actually executed. `media-verification.json` freshly verifies the existing
133 media files and manifest without copying them. The released predecessor is
[nfs3-loadlibrary-missing-vendor-20261108.md](nfs3-loadlibrary-missing-vendor-20261108.md).

## First wrong context: NC work retrieved by the wrong UI thread

The clean predecessor's null call was real, but was not evidence of loader or
message-order corruption. Run-specific read-only import observation on the
executing Workers supplies the earlier boundary (`bootstrap-trace2`):

1. Main Worker slot 0 installs MFC procedure `0x41f6cb` for window `0x10001`
   through its ordinary CBT/window setup path.
2. The native renderer probe starts at `0x877770`, stack `0x7efffff8`.
   Its `GetCurrentThreadId` returns 2. Its own native window `0x18001` uses
   procedure `0x873430` and completes `WM_NCCREATE`, `WM_CREATE`, show,
   activation, focus and sizing calls through its native default procedure.
3. Secondary Worker slot 1, sequence 23, calls `GetMessageA` with all filters
   zero. Its next TranslateMessage/DispatchMessage frame contains
   `{hwnd:0x10001, message:0x85, wParam:1, lParam:0}`. Sequence 25's dispatch
   redirects EIP to **the main window's** `0x41f6cb` on thread 2.
4. Original x86 `0x41f6cb` calls its permanent MFC handle-map lookup at
   `0x41f648`. Thread 2's MFC TLS slot 3 is initially zero and is initialized
   naturally there; it has no permanent wrapper for thread 1's window. The
   lookup's zero result becomes the object argument to `0x41f3b4`.
5. `0x41f3f3` reads that argument into EDI. The call at `0x41f43b` reads
   `[vtable+0xa0]` with EDI/vtable zero, pushes return `0x41f441`, and targets
   zero. The observed registers and stack match the original x86 instructions.

The first demonstrated emulator mismatch is **retrieval of foreign NC work**,
not the final indirect call. `$nc_flags_scan` walked shared NC_FLAGS without
checking the window owner. The existing ordinary PAINT_FLAGS scanner already
has the equivalent owner restriction. The repair filters NC work by
`WND_THREAD`/`current_thread_id`, preserving foreign flags without clearing,
painting, or dispatching them. The existing owner-zero fallback remains.

[GetMessage](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getmessage)
with a NULL window retrieves messages for windows belonging to the calling
thread. [Creating Windows in Threads](https://learn.microsoft.com/en-us/windows/win32/procthread/creating-windows-in-threads)
assigns each window and its message queue to its creating thread. These contracts
explain why entering a foreign MFC window procedure on the probe's stack/TLS is
invalid. No x86 CALL/RET decoding, export address, thread-entry address or TLS
read/write mismatch was demonstrated in this chain.

`test-nc-flags-message-wake.js` fails before the repair with
`65537 !== 98305` at actual PeekMessage retrieval. Afterward, actual
PeekMessage/GetMessage retrieve both NC messages for thread 2, preserve thread
1's pending bits, and allow thread 1 to consume its own messages later. The
shared paint-work audit remains zero. This is not a null-call bypass or a
WM_NCPAINT suppression.

## Next wrong context: DestroyWindow adopts a foreign main window

The clean unmodified-Worker `bootstrap-clean` run executes the NC-only module
`b1f06ca6d34568dc80d71ae3782952dad023dca5bccb63347d7df34709d8caef`.
The observed `bootstrap-trace3` run of that same module supplies the boundary:
thread 2 now dispatches its own window's `0x83`, `0x464`, `0x85`, `0x468` and
`0x466` messages, passing the original failure. The last message triggers the
probe's ordinary `DestroyWindow(0x18001)` at guest return `0x8745a1`.
Its own native procedure successfully handles WM_DESTROY and WM_NCDESTROY.

DestroyWindow's exit hook then observes EIP redirected to `0x41f6cb` instead of
returning to its API caller. The same MFC null call follows with message 7
(WM_SETFOCUS), EIP zero, return `0x41f441`, and EDI zero. This call is synchronous
inside DestroyWindow, not another NC message stolen by GetMessage.

`$destroy_main_window_lifecycle` treated the per-instance `main_hwnd` as
process-wide: its adjacent-HWND shortcut and general successor scan could both
choose a foreign-thread top-level. The DestroyWindow focus continuation then
entered that window's procedure on the destroying thread. Both successor
selection paths now require the calling thread's ownership. A thread destroying
its last probe window retains no foreign main/focus callback target.

[SetFocus](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setfocus)
requires a window attached to the calling thread's queue; the
[window/thread ownership contract](https://learn.microsoft.com/en-us/windows/win32/procthread/creating-windows-in-threads)
also applies during teardown. No AttachThreadInput path was observed here.
The change does not attempt a broader focus or destruction redesign.

`test-destroy-main-window-recreation.js` fails before this repair with
`98306 !== 0`. It now covers both adjacent and nonadjacent foreign successor
candidates, plus the existing same-thread replacement, quit-marker, synchronous
focus callback, stdcall return and nonvolatile-register preservation cases.
An intermediate parenthesis error was caught during test compilation and fixed;
its failing log is retained separately from the passing final test/build.

## Qualification boundary

The initial observer attempt (`bootstrap-trace`) could not decode names directly
from shared memory; its records are unqualified. `bootstrap-trace2` and
`bootstrap-trace3` copy only the diagnostic name bytes before decoding, have no
observer errors, and use console output from the executing Worker to avoid the
predecessor's observer-routing failure. Entry/exit hooks preserve their original
imports and arguments/results. Redirecting/yielding exit-hook EAX values are not
claimed as completed API returns.

The expanded final state collector in clean/trace3 could not serialize its
renderer-window object, so those JSON files retain fetched module/host hashes
and errors but no state snapshot. Their console traces and PNGs remain useful;
no complete state/registry acceptance is inferred from them. The collector is
now bounded to plain scalar window fields for the next run. The earlier
trace2 state snapshot is intact.

Before and NC-only screenshots were personally reviewed: the chooser is still
blank. The inherited native catalogue, initial Software selection and storage/reload
route is reused; authentic missing-`d3d` retry to native `d3da` and THRASH
lookups execute again. Final registry-transfer acceptance remains pending. Secondary-thread teardown
is a later checkpoint than the original NC failure, not chooser acceptance.

After both repairs the final production module is SHA-256
`7ec49cbbae4cb177909fd8fd9d3599713ee5f2a5ffb7f7e8c890848a540052bf`
(2,182,452 bytes). The two ownership regressions, NC/input-order, paint-work
counts, synchronous window ownership, dialog tab-stop focus and Win16 destruction
neighbors pass. The locked full build passes. The optional BUTTON BS_NOTIFY
neighbor fails at its preexisting button-down focus expectation; an in-memory
Git-source baseline check reproduces the identical failure against both original
source fragments at `0df0f1667`, without reverting shared files or copying a
checkout. That separate preexisting focus-notification issue is not repaired here.

The next dependency is final native chooser qualification with **both** repairs
once `/home` again has more than 5 GB free. The task reported the shared disk
drop (about 5.35 GB to 4.46 GB) on messageboard.txt and started no new browser or
box afterward. All its earlier browsers/servers closed in finally blocks.
Only after local chooser and registry-transfer success may a fresh
UUID-idempotent box be allocated with the independent 25-minute watchdog,
ordinary native D3D choice/OK and strict reviewed input/ACK/UNKNOWN guards.
No such remote step has occurred. Actual D3D context/backend/fallback, game
acceleration/steering, race motion, three-renderer timing, full27, audio and
parity remain open.
