# Silent-handler inventory history

The build gate in `tools/check-silent-stubs.js` rejects additions or mutations
to straight-line handlers that cannot delegate work, publish output, branch, or
fail loudly. Its executable source intentionally contains only the classifier,
the current count/hash pin, and enforcement. This file preserves the historical
count changes and their behavior rationale without making every explanation a
change to gate code.

When an existing quiet handler gains real behavior, update the two-value pin in
the same commit. Append a dated explanation here when it adds useful context.

This is a ratchet, not approval of the old entries. Any addition or mutation
changes the digest and stops the build; deleting/fixing an entry deliberately
lowers the count and updates the digest after review.

2026-08-31: 506 -> 505. Commit 34b4f08f ("Fix Win98 installer chain
launches") gave handle_CreateProcessA a real implementation, so it left the
quiet inventory. Ratchet only; nothing was added.

2026-08-31: 505 -> 508. MSVCRT startup helpers _lock, _unlock, and
__lconv_init are documented compatibility no-ops for single-threaded CRT
initialization paths.

2026-09-01: 508 -> 507. handle_IDirectDraw_WaitForVerticalBlank was the
textbook silent success -- it set EAX=0 and returned, so a game that used
the display as its clock was told the retrace had already happened. It now
parks on a real vblank (yield_reason 13). Ratchet only; nothing was added.

2026-09-01: 507 -> 525. Minimal no-audio BASS compatibility handlers let
shareware games bundled with bass.dll continue to gameplay.

2026-09-01: 525 -> 526. __mb_cur_max is a documented constant for the
emulator's single-byte ANSI CRT environment.

2026-09-01: 526 -> 527. _cexit acknowledges CRT cleanup without process
termination; returning terminator callbacks need a separate future path.

2026-09-01: 527 -> 528. _getdrive is a documented constant in the default
single-drive C: process environment.

2026-09-01: 528 -> 529. _setmode acknowledges text/binary mode changes and
returns the previous text mode because stdio streams are not distinguished.

2026-09-01: 529 -> 530. keybd_event is a legacy input-synthesis probe shim;
browser-side input injection remains host-owned.

2026-09-01: 530 -> 531. joyGetPosEx mirrors joyGetPos for a no-joystick
Win98 environment so startup probes can keep keyboard/mouse input.

2026-09-02: 531 -> 529. Legacy SetWindowsHookA/W now installs the same
process-local keyboard/CBT callbacks as the Ex path, and UnhookWindowsHook
removes only a matching installed procedure instead of always succeeding.

2026-09-02: 529 -> 516. DirectPlay's bounded local session now retains
player/group identities, names, flags and memberships; its lifecycle and
four entity enumerators update or traverse that state instead of returning
success without work.

2026-09-02: 516 -> 514. SetPlayerData and SetGroupData now retain copied
local/remote application data in the DirectPlay entity repository; their
matching getters implement the Win98 size-query and readback contract.

2026-09-02: 514 -> 512. DirectPlayLobby EnumAddress now walks bounded
compound-address chunks through a cancellation-aware callback, while
EnumAddressTypes reports the local TCP/IP provider's required DPAID_INet.

2026-09-02: 512 -> 511. EnumLocalApplications validates its required
callback and reserved flags, then truthfully enumerates the browser Win98
machine's empty set of registered lobby-aware applications.

2026-09-02: 511 -> 502. Win32 DDEML now owns instance, copied HSZ,
registered-service, conversation and data-object state; invalid, stale and
cross-instance handles fail instead of fixed values succeeding silently.

2026-09-02: 502 -> 500. Begin/EndDeferWindowPos now allocate, validate,
consume and free real bounded HDWP transactions; queued geometry remains
unchanged until End applies it through the SetWindowPos behavior path.

2026-09-02: 500 -> 497. OpenClipboard/CloseClipboard now own an exclusive
USER transaction, and GetClipboardOwner reports ownership assigned by
EmptyClipboard instead of three fixed success/null answers.

2026-09-02: 497 -> 494. GetSubMenu now resolves real popup ownership,
ModifyMenu mutates dynamic items, and DrawMenuBar validates and redraws the
target window's non-client menu chrome instead of fixed success/handles.

2026-09-02: 494 -> 493. FindWindowA now searches the live top-level USER
tree by optional class atom/name and title instead of always returning NULL.

2026-09-02: 493 -> 491. SetPriorityClass/GetPriorityClass now validate the
emulated process handle and retain one shared Win98 priority class.

2026-09-02: 491 -> 489. GetThreadPriority/SetThreadPriority now validate
thread identity and retain the Win98 relative priority on the thread object.

2026-09-02: 489 -> 488. SetErrorMode now atomically replaces and returns the
shared Win98 x86 process error mode instead of always returning zero.

2026-09-02: 488 -> 483. COM/OLE initialization now owns per-thread apartment
model and nesting state; the dead duplicate OleInitialize body is gone.

2026-09-02: 483 -> 482. TranslateMessage now distinguishes the four
virtual-key messages from unrelated MSGs instead of always returning TRUE.

2026-09-02: 482 -> 480. SetThreadLocale and GetThreadLocale now retain real
per-thread LCID state and carry it into newly created threads.

2026-09-02: 480 -> 479. BringWindowToTop now changes sibling/top-level
z-order and activation state instead of reporting unconditional success.

2026-09-02: 479 -> 477. SetActiveWindow/GetActiveWindow now retain this
thread queue's active top-level and deliver real activation transitions.

2026-09-02: 477 -> 476. UnregisterClassA/W now remove the matching owned
class only after its last window is gone instead of always returning TRUE.

2026-09-02: 476 -> 473. Direct3D Device 1/2/3 GetStats now initializes all
five D3DSTATS counters and rejects a null output buffer.

2026-09-02: 473 -> 472. ImageList_Destroy now validates and invalidates its
handle and releases both the image-list record and retained icon array.

2026-09-02: 472 -> 471. CopyIcon now creates an independently owned copy of
bitmap-backed, resource-backed, and opaque system icon handles.

2026-09-02: 471 -> 470. CopyImage now owns and resamples bitmap/icon/cursor
images, including RETURNORG/DELETEORG, monochrome, and DIB-section requests.

2026-09-03: 470 -> 469. SHFileOperationA now delegates copy, move, rename,
wildcard, multi-destination, and recursive delete work to the shared VFS.

2026-09-03: 469 -> 468. FlushFileBuffers now validates a live writable VFS
file handle and reports access/handle errors instead of unconditional TRUE.

2026-09-03: 468 -> 469. Video for Windows added DrawDibOpen/Close (+2), while
GetLastActivePopup left the quiet inventory by retaining and validating
per-owner activation history (-1). The inventory records both changes.

2026-09-03: 469 -> 467. DrawDibOpen/Close now own, validate, invalidate and
free distinct opaque drawing contexts instead of returning constant success.

2026-09-03: 467 -> 466. GetLogicalDrives now queries the browser VFS's live
assignment mask instead of reporting a fixed C:/D: constant.

2026-09-03: 466 -> 463. SetFileApisToOEM/ANSI now propagate their process
code-page choice to Kernel32 filenames, and AreFileApisANSI reads it back
from the same process-shared VFS state across guest thread instances.

2026-09-03: 463 -> 462. DisableThreadLibraryCalls now validates loaded DLLs
and suppresses their future thread attach/detach notifications.

2026-09-03: 462 -> 461. WinExec now delegates the real command line and
nCmdShow to the browser child-launch path and returns its success/error code.

2026-09-03: 461 -> 460. GetWindowRgn now copies the window's retained USER
region into the caller's HRGN and returns its actual region complexity.

2026-09-03: 460 -> 459. FreeConsole now tears down the process console
window, buffers, input queue, aliases, and attachment state.

2026-09-03: 459 -> 458. SetConsoleCtrlHandler now owns a process handler
chain and delivers processed Ctrl+C/Ctrl+Break events through guest callbacks.

2026-09-03: 458 -> 457. EnableScrollBar now retains per-window arrow state,
paints disabled arrows, and suppresses their input instead of always TRUE.

2026-09-03: 457 -> 456. OpenIcon now sends WM_QUERYOPEN and restores the
guest and browser window state instead of returning unconditional success.

2026-09-03: 456 -> 453. SetCapture/GetCapture/ReleaseCapture now validate
thread ownership and deliver synchronous WM_CAPTURECHANGED transitions.

2026-09-03: 453 -> 452. GetMapMode now reads canonical per-DC state.

2026-09-03: 452 -> 450. GetStockObject validates the Win98 selector set;
GetNearestColor now rejects invalid DCs instead of silently succeeding.

2026-09-03: 450 -> 449. GetTextCharset now reports selected font state.

2026-09-03: 449 -> 448. DestroyAcceleratorTable now validates repository
handles and releases only live tables instead of always returning success.

2026-09-03: 448 -> 447. SHBrowseForFolderA now runs a classic modal shell
tree and returns the selected PIDL instead of silently reporting Cancel.

2026-09-03: 447 -> 446. Shell_NotifyIconA now owns browser notification-
area add/modify/delete state and delivers Win98 mouse callback messages.

2026-09-04: 443 -> 442. GetClipboardSequenceNumber now reads the shared
window-station serial advanced by successful clipboard mutations.

2026-09-04: 442 -> 441. SetFileSecurityW now reports the Win98
ERROR_CALL_NOT_IMPLEMENTED result instead of claiming an ACL was persisted.

2026-09-04: 441 -> 439. ExtractIconA and ExtractIconExA now enumerate and
materialize caller-owned PE/NE/ICO icons instead of returning fake success.

2026-09-04: 439 -> 438. GetForegroundWindow now queries renderer-wide
top-level z-order instead of returning this process's main HWND.

2026-09-05: 438 -> 437. The Win98 Shell32 ArrangeWindows ordinal now tiles
eligible renderer windows instead of returning an unconditional zero.

2026-09-06: 437 -> 435. Direct3D Device2/Device3 DeleteViewport now validate
ownership, clear current selection, and release attachment references.

2026-09-06: 435 -> 432. Direct3D Device 1/2/3 NextViewport now walks each
device's retained Win9x viewport list, returns AddRef'd HEAD/TAIL/NEXT
interfaces, and distinguishes invalid input, empty lists, and list end.

2026-09-10: 370 -> 369. mixerMessage now enforces the documented
device-id-only, MXDM_USER-or-higher contract and reports unsupported private
driver messages instead of claiming every driver-specific request succeeded.

2026-09-10: 369 -> 367. DPA_Destroy and DSA_Destroy now validate opaque live
handles, retire them, and return both their backing arrays and handle records
to the process heap instead of claiming success while leaking every array.

2026-09-10: 367 -> 365. Comctl32_Free and Comctl32_GetSize now operate on
validated live allocations instead of returning unconditional TRUE and 256;
the same tracked extent also makes ReAlloc preserve only owned bytes, retire
moved storage, and fail without destroying the original allocation.

2026-09-10: 365 -> 364. MenuHelp now uses its real seven-argument stdcall ABI,
resolves command and popup help-string resources, and drives the status bar's
separate Win98 simple pane instead of silently doing nothing.

2026-09-10: 364 -> 363. ShowHideMenuCtl now parses its documented selector
pairs, toggles the corresponding child or whole menu, synchronizes the menu
check, and fails for absent mappings or controls instead of always returning
TRUE.

2026-09-10: 405 -> 404. IDirectPlay3 Receive now reads its object's received
message queue, negotiates buffer size, filters sender/recipient, and supports
peek or consumption instead of unconditionally reporting no messages.
The reviewed inventory diff removes only this handler; no entries were added
or otherwise changed. Message production and DP4 activation remain separate.

2026-09-10: 404 -> 403. IDirectPlay3 Send now copies messages into local
recipient queues and signals their events, validates sender ownership and
unsupported modes, and rolls back partial multicast allocation failure.
The reviewed inventory diff removes only Send, with no added or modified
quiet entries. Network transport and asynchronous sending are not implemented.

2026-09-10: 356 -> 353. MonitorFromPoint, MonitorFromRect, and
MonitorFromWindow now test the one browser monitor's actual rectangle and
honor MONITOR_DEFAULTTONULL, MONITOR_DEFAULTTOPRIMARY, and
MONITOR_DEFAULTTONEAREST instead of always returning the primary handle.
The same slice validates GetMonitorInfoA and makes its work area agree with
SPI_GETWORKAREA and the browser desktop's existing 28-pixel Win98 taskbar.

2026-09-11: 353 -> 348. DirectInput device Acquire, Unacquire,
SetDataFormat, SetCooperativeLevel, and Poll now follow the documented device
lifecycle instead of returning unconditional success. The device retains its
standard keyboard or mouse data format and cooperative-level HWND/flags;
acquisition is non-reference-counted, data access requires acquisition, and
invalid formats, windows, flag pairs, and acquired format changes return their
documented HRESULTs. The browser still exposes only the system keyboard and
mouse and does not yet model acquisition competition or automatic foreground
loss.

2026-09-11: 348 -> 346. RegisterDragDrop now validates a live process window,
rejects duplicate registrations, and retains one IDropTarget reference per
window. RevokeDragDrop distinguishes invalid and unregistered windows, unlinks
the exact registration, and releases its retained target. DLL-private targets
cross the existing suspended guest COM callback bridge for AddRef/Release;
emulator-local interfaces use the synchronous path. Browser drop events are not
yet converted into IDataObject/IDropTarget calls.

2026-09-11: 346 -> 345. CoLockObjectExternal now implements its documented
strong-reference lifetime: every lock owns one IUnknown AddRef and every
balanced unlock performs one Release. Repeated locks remain independently
counted, null and malformed interfaces fail before mutation, and an unbalanced
unlock returns E_UNEXPECTED. DLL-private implementations use the suspended
guest callback bridge; emulator-local objects complete synchronously. The
fLastUnlockReleases proxy-disconnection distinction is not observable because
the runtime does not expose out-of-process marshaled connections.

2026-09-11: 345 -> 344. CoSetState now retains the replacement thread-state
IUnknown before releasing the former object, while CoGetState returns an
independently AddRefed pointer. Both paths preserve the same ownership rules
for emulator-local and DLL-private guest implementations.

2026-09-11: 344 -> 343. SetThreadAffinityMask now validates pseudo and durable
thread handles through the existing process thread authority and accepts only
bit zero, the sole processor in the browser Win98 machine. Empty and
out-of-process masks fail with ERROR_INVALID_PARAMETER instead of returning a
fabricated previous mask. GetProcessAffinityMask likewise rejects process
handles outside the one modeled guest process before publishing its 0x1 masks.

2026-09-11: 343 -> 342. IDirectDrawClipper::SetHWnd now retains the validated
window associated with each clipper object, and GetHWnd returns that exact
association instead of fabricating the process main window. Reserved flags,
invalid windows and null output pointers fail without changing retained state.
Generating and consuming the window's changing visible clip region remains a
separate DirectDraw task.

2026-09-11: 342 -> 340. IDirectDrawSurface::SetClipper now owns one COM
reference to its attached clipper, replaces or detaches it without leaks, and
automatically releases it with the surface. GetClipper returns an independently
AddRefed interface and reports a missing attachment. Windowed presentation now
uses the HWND retained by that clipper instead of assuming the cooperative
window; arbitrary SetClipList regions and occlusion snapshots remain separate.

2026-09-11: 340 -> 338. IDirectDrawClipper::SetClipList now validates and owns
a canonical RGNDATA copy, supports deletion and HWND/list exclusivity, and
drives actual clipped Blt copies, stretches, color keys, and fills without
slowing the no-list path. GetClipList implements size negotiation, bounded
copies, optional rectangle intersection, and live HWND client-region snapshots;
IsClipListChanged detects and latches window geometry changes until that list is
copied. Final Release frees retained region storage, and BltFast now rejects any
attached clipper as documented. Browser composition supplies HWND occlusion;
explicit RGNDATA rectangles are enforced in the DirectDraw framebuffer.

2026-09-11: 338 -> 336. IDirectSound::SetCooperativeLevel now validates the
live top-level application HWND and one exact Win98 DSSCL value, retains that
device state, and propagates later level changes to its existing buffers.
Compact requires PRIORITY or stronger instead of always succeeding. Primary
buffer identity now lives in immutable creation state rather than colliding
with DSBSTATUS_PLAYING; primary SetFormat requires PRIORITY, rejects secondary
buffers, validates PCM structure fields, and observes WRITEPRIMARY's stopped-
buffer rule. The browser has no fragmented hardware sound heap, so a permitted
Compact remains a successful no-op after its native privilege check.

2026-09-11: 336 -> 335. IDirectSoundBuffer::SetCurrentPosition now owns a
per-secondary-buffer play-cursor origin instead of returning success without
moving anything. Stopped buffers retain the byte used by their next Play;
playing buffers immediately restart the browser snapshot at that byte; Stop
freezes the live cursor; and GetCurrentPosition rebases the host-relative
cursor onto the retained DirectSound position. Primary buffers and offsets
outside the backing store fail rather than corrupting cursor state.

2026-09-11: 335 -> 334. IsBadCodePtr now follows its documented read-access
contract through the same mapped-range probe as IsBadReadPtr instead of
accepting every non-NULL address. The shared probe walks every crossed page,
honors sparse VirtualAlloc PAGE_NOACCESS, PAGE_GUARD, read-only, and writable
metadata, and fixes zero-length NULL ranges. IsBadStringPtrA/W now scan through
the first NUL or caller maximum without crashing, while the write probe rejects
read-only sparse pages. These cold API checks do not add permission branches to
the emulator's hot guest load/store path.

2026-09-11: 334 -> 333. CallNextHookEx now resumes the next live procedure in
the active WH_KEYBOARD/WH_CBT chain and returns its exact LRESULT. Hook installs
prepend distinct heap-backed handles, while legacy and Ex unhook operations
unlink only the named procedure and defer storage retirement across callbacks.

2026-09-11: 333 -> 333. CloseServiceHandle no longer treats every fabricated
nonzero value as a valid service handle. This Win98 personality cannot produce
an SCM or service handle, so both NULL and nonzero inputs now fail with
ERROR_INVALID_HANDLE. The audit count is unchanged because it intentionally
tracks deterministic quiet failures as well as quiet successes; its identity
hash changed with the corrected contract.

2026-09-11: 333 -> 332. GetProcessVersion now accepts only PID zero or the
runtime's one published process ID, rejects invented process IDs, and reads the
major/minor subsystem version stamped in the mapped executable's PE header. It
no longer returns the Win98 GetVersion encoding for every possible PID.

2026-09-11: 332 -> 332. ImmReleaseContext now agrees with the explicit no-IME
machine model: because ImmGetContext cannot issue a HIMC, neither NULL nor a
fabricated numeric handle can be released successfully. The audit count is
unchanged because the corrected deterministic failure remains a quiet handler.

2026-09-11: 332 -> 331. keybd_event now synchronously enqueues real system
keyboard input instead of returning without an event. Synthesized keys retain
the caller's scan code, extended/up flags, extra-info value, focused-window
target, and an event-time keyboard snapshot; GetMessage/PeekMessage therefore
apply the existing thread routing, WM_HOTKEY matching, and WH_KEYBOARD chain.
Alt and F10 select WM_SYSKEYDOWN/UP, and lParam carries context, previous-state,
and transition bits with the same queue ordering used by browser input.

2026-09-11: 331 -> 330. OpenSemaphoreA now resolves named semaphores created
through either CreateSemaphoreA or CreateSemaphoreW instead of always reporting
not found. Duplicate creation returns the same counted object, ignores the new
initial/maximum values, and reports ERROR_ALREADY_EXISTS; opens and creates own
references until the last CloseHandle destroys the name. Events, mutexes, and
semaphores now also share one case-sensitive process namespace, so a cross-type
name collision fails with ERROR_INVALID_HANDLE instead of creating two objects.

2026-09-14: 330 -> 290 cumulative audit. The executable pin had not followed
the mainline implementation stream since September 11, leaving every clean
build red even though the inventory moved downward. The reviewed delta covers
the intervening stateful USER/GDI/DirectX, console, locale, shell, heap, token,
security, filesystem, and compatibility work; the ratchet is banked at the
clean integrated tree instead of blessing any new unconditional success.

2026-09-14: 290 -> 289. OutputDebugStringA now sends its bounded ANSI payload
to the browser/CLI debugger sink. NULL remains an optional no-op, and an
inaccessible guest range cannot turn diagnostic output into an emulator crash.

2026-09-14: 289 -> 288. CommDlgExtendedError now reports retained COMDLG32
failure state instead of an unconditional zero. Common-dialog entry points
validate their complete Win98 caller structures before reserving a window,
entering modal state, allocating printer objects, or writing caller memory;
documented size, Find/Replace-buffer, font-range, and default-printer failures
remain distinguishable from an ordinary Cancel.

2026-09-15: 273 -> 272 manual handlers; 20 -> 21 explicit metadata stubs.
SetMessageQueue's constant TRUE is the documented Win32 compatibility contract,
not missing behavior: the obsolete call does nothing because USER grows a
thread's queue as necessary. The hand-written body therefore moved to explicit
generated stub metadata. Same-thread and cross-Worker producers now serialize
into one process-shared FIFO per Win32 thread, with a 64-message allocation-free
ring and heap-backed overflow across all sixteen execution slots. Filtered
retrieval, destruction purge, modal dispatch, wake predicates, slot reuse and
forced thread exit all address that same queue, so authentic QBob's
SetMessageQueue(96) cannot conceal an emulator-only ceiling or split-order bug.

2026-09-21: 253 -> 252 manual handlers; metadata remains 22. `_onexit`
previously returned its argument without registering anything. It now delegates
to the existing `crt_atexit_register` registry and returns the callback pointer
only on success, NULL on failure, preserving cdecl caller cleanup. This follows
Microsoft's [_onexit contract](https://learn.microsoft.com/en-us/cpp/c-runtime-library/reference/onexit-onexit-m?view=msvc-170).
The existing termination dispatcher ignores callback return values and drains
the mixed atexit/_onexit registry in LIFO order before host termination.

`test/test-diablo-runtime-apis.js` failed before the fix because registration
count remained zero. It now covers NULL rejection, successful pointer return,
registry-capacity failure, cdecl stack delta, mixed LIFO dispatch and delayed
host exit. The capacity failure uses test-only registry globals to reach the
bounded-growth rejection; it is not a heap-exhaustion test. Callback dispatch
targets are inspected by the harness, not executed guest callback bodies.
The focused test, silent-handler pin and handler-ESP gate pass.

This is the process termination registry, not completion of DLL-local
`__dllonexit` registration/unload dispatch or `_cexit`'s returning cleanup path.
Those remain open. The quiet-handler census also includes valid state queries
(for example OleIsCurrentClipboard already compares the actual non-null owner),
so its total must not be described as that many proven unconditional-success
bugs. No classifier relaxation or arbitrary exclusion was used for this drop.

2026-09-21: 252 -> 251 manual handlers; metadata remains 22. `__dllonexit`
now appends to the caller's malloc-family callback table, updates both pointers
after successful reallocation, and returns the callback pointer or NULL. Tables
are independent of each other and of the process-wide atexit queue, following
Microsoft's [__dllonexit contract](https://learn.microsoft.com/en-us/cpp/c-runtime-library/dllonexit?view=msvc-170).
The caller's DLL CRT still owns reverse traversal and freeing at detach; this
change does not implement or verify a DLL-unload callback dispatcher.

The runtime regression first failed because 64 successful calls left the table
NULL. It now checks 64 registrations across reallocations, preserved order,
independent tables, no process registrations, cdecl cleanup, and unchanged
table contents/pointers on rejection. A synthetic oversized span reaches the
allocator's size refusal through heap_realloc; this is not a genuine exhausted
heap test. Null arguments and reversed/misaligned spans are defensive handling,
not behavior established by a Win98 differential. No callback bodies execute
in these table tests. `_cexit` returning cleanup remains open.
The focused runtime test, silent-handler pin and handler-ESP gate pass; no
full-build, browser, or native Win98 differential claim is made for this change.

2026-09-21: 251 -> 250 manual handlers; metadata remains 22. `_cexit` now
drains the process callback registry and returns to its caller without host
termination. Normal `exit` and returning cleanup share one LIFO pop helper.
The original return address stays on the guest stack, so nested cleanup cannot
overwrite a singleton saved return address. A dedicated CACA0038 continuation
resumes returning cleanup after each callback.

The focused runtime test executes real x86 code through public `_cexit` and
`_onexit` API thunks. It checks nested LIFO execution, continuation into the
original caller, exact stack restoration, absence of host exit, repeated empty
cleanup, registration after cleanup, and registration from inside a callback.
The public normal `exit(7)` path also executes a real callback and reports status
7 without resuming its caller. Existing dispatcher-target checks remain. The ESP
gate recognizes only the specific returning helper as delegating cleanup;
it does not exempt arbitrary CRT handlers.

This is **partial `_cexit` coverage**, not complete CRT termination. Microsoft's
[_cexit contract](https://learn.microsoft.com/en-us/cpp/c-runtime-library/reference/cexit-c-exit?view=msvc-170)
also requires stream flushing/closure. Current FILE pointers are unbuffered VFS
handles and there is no open-stream registry; adding that lifecycle, then closing
streams after callbacks, remains open for both normal and returning cleanup.
DLL-unload execution and concurrent CRT termination are not verified here.
The runtime regression, quiet-handler pin and ESP gate pass. No full-build or
browser result is claimed for this callback change.

2026-09-21: CRT stream cleanup now follows the callback phase for both `exit`
and `_cexit`. A process-shared, locked ownership list tracks successful `fopen`
and replacement `freopen` handles; explicit close removes ownership before
calling the host. Nodes are detached under the lock, with heap operations and
host RPC outside it. A stream opened by a second WASM instance is therefore
visible to main-thread cleanup. Ownership is reserved before opening, so node
allocation failure cannot leave an untracked newly opened file.

`freopen` also no longer returns the old handle as false success when opening
the replacement fails: the old stream is closed and NULL is returned, matching
Microsoft's [freopen contract](https://learn.microsoft.com/en-us/cpp/c-runtime-library/reference/freopen-wfreopen?view=msvc-170).
The CRT still represents FILE pointers as raw, unbuffered VFS handles; stable
FILE identity, standard-stream redirection, full mode/text translation and real
buffering are not established by this change. There is no pending CRT buffer to
flush in the implemented write-through path.

`test/test-crt-close.js` covers explicit close exclusion, repeated cleanup,
handle reuse, failed open/reopen, successful replacement, close-error draining,
cross-instance ownership and real guest callbacks writing before closure for
normal and returning cleanup. Real-VFS runs verify retained file bytes and that
the close operation lands. **Newly exposed host-layer gap:** `VirtualFS.closeHandle`
retains records with `closed=true` for an NSIS workaround, while ordinary
read/write methods do not reject those records. CRT cleanup is now issued, but
complete post-close handle invalidation remains open; the test does not pin the
workaround as correct behavior. Concurrent open/close/termination races are not
covered by the sequential shared-memory test.

Full shared-worktree build passes with layout hash `54f430b349c8d55e`; the JS
mirror and both artifacts were regenerated/compiled together. Canonical WASM:
1,470,811 bytes, SHA-256
`6a8c61402a1c3ff68425b5f86ac47c707fb0f352cad2e88874412433d12ebe60`;
compat: 1,471,785 bytes, SHA-256
`03e7ae30bc08ede0923239bd5008d83156ef1a72beebdab554f4328f280c61d9`.
These include other agents' uncommitted work, not clean-commit artifact proofs.
The runtime callback suite also passes; quiet inventory remains 250 + 22.

## Historical entries recovered from the gate — 2026-09-22

These entries were retained or reintroduced in executable gate source after the
original documentation move. They are preserved verbatim as dated history, not
as fresh verification of the API claims or a continuous count ledger. The 58
entries already preserved above are not duplicated. Current enforcement remains
250 manual handlers plus 22 metadata handlers; the classifier and pin are unchanged.

2026-09-09: 437 -> 423. Seventeen D3D9 quiet setters/resource methods now
implement/delegate behavior or fail explicitly. Three legitimate additions:
fixed system UI locale, DirectXSetup's already-installed runtime result,
and buffer PreLoad (residency hint; Draw synchronously uploads canonical bytes).
Texture/Surface GetType constants now report their actual resource kinds.
Speculative DLL/proxy registration successes were removed, not blessed here.

2026-09-09: 423 -> 411. BeginStateBlock now allocates real selective state.
Eleven existing quiet state setters now reject unsupported recording via
a shared guard. Their old non-recording stubs are NOT claimed implemented.

2026-09-09: 411 -> 410. SetGammaRamp retains the per-device API ramp;
unsupported display gamma remains unadvertised. Get/default/copy tested.

2026-09-10: 405 -> 404. GetNPatchMode returns the disabled-only backend's
FLOAT through x87 ST(0), not an unrelated EAX zero. Nonzero setters reject.

2026-09-10: 404 -> 403. SetDepthStencilSurface now validates a same-device
surface, retains its binding, switches persistent depth identity, and retires
the previous binding; NULL disables depth. Reset remains separately pending.

2026-09-10: 403 -> 401. Reset now preflights resource ownership and creates
replacement state/targets transactionally across the render fence;
TestCooperativeLevel reports native Reset-failure/recovery state.

2026-09-10: 401 -> 359 manual. API metadata now owns 34 reviewed constant
compatibility stubs; mixer and common-control lifetime/behavior fixes remove
the remaining eight quiet handlers instead of blessing them as exceptions.

2026-09-10 merge: 359 -> 357. DirectPlay Receive and Send now use the
owned local message queues; all 34 metadata compatibility stubs remain.

2026-09-11: 348 -> 346. RegisterDragDrop/RevokeDragDrop now own one retained
IDropTarget per live HWND and report invalid, duplicate, and absent
registrations instead of returning unconditional success.

2026-09-11: 346 -> 345. CoLockObjectExternal now retains one strong COM
reference per lock and releases exactly one per balanced unlock, including
DLL-private objects reached through the guest callback continuation.

2026-09-11: 332 -> 331. keybd_event now synchronously enters the ordinary
hardware-input FIFO with Win98 keyboard-message state instead of succeeding
without generating input.

2026-09-11: 329 -> 335. The rest of the IMM32 surface Warcraft III imports:
ImmGet/SetOpenStatus, ImmGet/SetConversionStatus, ImmGetCompositionStringA,
ImmGetCandidateListA. These are constant because the answer does not vary,
not because the work was skipped. This machine has no IME installed, so
$handle_ImmGetContext returns NULL exactly as Windows does there, and every
one of these is then reached with a context that does not exist -- for which
each of them has a documented result. ImmGetCompositionStringA returns
IMM_ERROR_GENERAL (-2) rather than 0 for precisely this reason: its return is
a byte count, so 0 would claim an empty composition string and a valid
buffer. ImmGetConversionStatus deliberately does not write its two output
DWORDs, because a failing call on Windows leaves them untouched.

2026-09-11: 335 -> 334. IDirect3DDevice9::GetAvailableTextureMem answered 0,
which tells a caller there is no texture memory at all. It now reports what
the sparse backing pool can still commit, rounded down to a megabyte the way
a real driver does -- the same pool GlobalMemoryStatusEx now describes.

2026-09-12: 334 -> 333. IDirect3D9::CheckDeviceFormat answered S_OK to every
question. For a plain texture that is a lie the very next call contradicts:
the app creates one, CreateTexture refuses the format and the app is left
holding a NULL it never checked for. It now answers D3DRTYPE_TEXTURE with no
usage bits from the same list the create gate reads, so a format fallback
chain walks down to something we really do store. Other resource types keep
the permissive answer, which is still a stub and still counted as one.

2026-09-15: 283 -> 282. GetKeyboardType now rejects selector values outside
the documented 0..2 range instead of misreporting every one as an enhanced
keyboard-type query. The modeled US 101/102-key answers remain 4/0/12.

2026-09-15: 282 -> 280. SetupDiCreateDeviceInfoList now allocates a real
empty, optionally class-associated device information set instead of always
failing, and SetupDiDestroyDeviceInfoList atomically consumes only a live
matching handle instead of reporting success for arbitrary/stale values.

2026-09-15: 280 -> 279. DrawAnimatedRects now validates its HWND, legacy
Win98 animation selector and both readable RECTs, then schedules a clipped
client-coordinate wire-frame transition instead of reporting false success.

2026-09-15: 279 -> 278. WriteFmtUserTypeStg now transactionally persists the
standard or registered clipboard format and Unicode user type in a valid
MS-OLEDS \1CompObj stream instead of returning S_OK without touching storage.

2026-09-15: 278 -> 276. RegisterDeviceNotificationW now owns copied,
generation-tagged window/interface registrations and routes matching audio
topology changes as WM_DEVICECHANGE. UnregisterDeviceNotification consumes
only the exact live HDEVNOTIFY instead of accepting arbitrary handles.

2026-09-15: 276 -> 273. D3D8 device-type, texture-format and multisample
capability queries now validate their complete COM argument tuples against
the exposed adapter and shared texture backend. The multisample query reads
its real final stack argument instead of mistaking Windowed for the mode.

2026-09-15: 272 -> 271. D3D9 CheckDeviceMultiSampleType now validates the
complete tuple against the render/depth creators: only NONE and their stored
formats succeed, unsupported techniques fail, and quality count is written.

2026-09-15: 269 -> 267. D3D9 CheckDeviceType and CheckDepthStencilMatch now
validate complete adapter/color/depth tuples against the formats advertised
and stored by the renderer instead of promising every combination works.

2026-09-15: 267 -> 266. GetOutlineTextMetricsA/W now return selected
TrueType outline metrics and bounded name data instead of always failing.

2026-09-15: 266 -> 265. D3D9 ValidateDevice now validates the live device,
output and one-pass texture-stage state and writes the required pass count.

2026-09-18: 265 -> 266. SwapMouseButton records the primary-button setting,
returns the previous one, and SM_SWAPBUTTON reads it back. Morrowind calls
it twice at startup to read and restore the setting; that round trip is the
whole contract a guest can observe.

2026-09-18: 266 -> 267. IDirect3DDevice8_SetPixelShader validates: D3D8
CreatePixelShader fails loudly, so 0 (fixed function) is the only handle
that can exist; it succeeds and every other handle is D3DERR_INVALIDCALL.
GetPixelShader reports that same 0. Morrowind saves and restores it.

2026-09-20: 266 -> 266, text only. IDirect3DDevice3_DrawIndexedPrimitiveVB
is still a quiet handler, but it now pops 28 rather than 32: the v3 form
takes 6 dwords with `this`, not 7 (dwStartVertex/dwNumVertices are the v7
addition). Popping one dword too many left the caller's epilogue a slot
high, so its `ret` took the caller's own first argument as a return address
-- Diablo II's Direct3D backend jumped to 320/640 during the Act I load.

2026-09-22: 250 -> 249 manual. GetPrivateProfileStructA no longer reports
unconditional failure. It uses the shared INI reader and decodes the stored
bytes/checksum into guest memory. Native Win98 evidence established exact
encoded length, additive checksum, output publication before checksum failure,
and permissive printable-ASCII nibble conversion; a strict hex parser would
have disagreed with native behavior. All 203 native read cases pass at four
output positions (812 comparisons), including noncontiguous backing, with
unchanged LastError and stdcall cleanup. The fixture and scope limits are in
`test/fixtures/win98-profile-struct/README.md`. Existing profile-string/section
tests pass. The pin changes in the same commit as the implementation; metadata
remains 22. This does not certify every profile API or INI registry mapping.

2026-09-22: 249 -> 248 manual. IDirectDrawPalette_QueryInterface no longer
unconditionally returns E_NOINTERFACE. The shared COM single-interface helper
accepts the full palette IID and IUnknown, acquires a reference, clears the
output on unsupported IID, and rejects NULL output. Specialized palette Release
is unchanged. See `docs/directdraw-palette-query-interface-review.md` for tests
and remaining limitations. Metadata remains 22.

2026-09-22: 248 -> 248 manual, ABI-only digest change. The shared
IVBDirectDrawClipper_DirectSlot fallback still returns E_NOTIMPL, but consumes
the cleanup byte count generated from each API entry instead of always popping
8 bytes. Native typelib metadata establishes two arguments including this for
slots 3/4/5/6/8 and three for slot 7. All six failure paths now preserve the
caller's stack. Replacing only this helper with its prior body reproduces the
prior digest. No method implementation or new quiet handler is claimed.

2026-09-22: 248 -> 248 manual, SHRegGetUSValueA ABI-only digest change.
Microsoft's prototype has eight arguments; metadata and the existing error
path incorrectly used six. Corrected nargs to eight and cleanup from 28 to
36 bytes. The direct name/dispatch regression detects the old eight-byte
imbalance. An in-memory old-constant substitution reproduces the prior hash.
Registry/default-data semantics remain unimplemented; no quiet handler was
removed or added. See `docs/shreg-get-us-value-abi-review.md`.

2026-09-22: 248 -> 247 manual, SHRegGetUSValueA implemented against 22
repeated native Win98 observations. HKCU/HKLM fallback and defaults preserve
original capacity; missing value/key metadata and LastError match the fixture.
Owned host-query buffers and guest-aware copying cover sparse caller memory.
The metadata-stub count remains 22. No classifier change or new allowance;
the former constant missing-key handler alone leaves the inventory. Broader
registry type/error coverage and malformed-pointer behavior remain separate.

2026-09-22: 247 -> 247 manual, DirectSound volume/pan behavior repaired outside
the narrow classifier. Both getters previously wrote fixed zero; setters lost
changes before lazy voice creation. Buffer-owned state now survives initial
playback, duplication, stop/restart and voice recreation, with capability/range
validation and sparse-safe getter output. The old conditional output stores
already excluded these handlers from this inventory, so neither count nor hash
changes. See `docs/directsound-volume-pan-review.md` for runtime evidence and
remaining frequency, channel attenuation, primary mixer and shared-PCM work.

2026-09-22: 247 -> 247 manual, DirectSound frequency state follow-up.
SetFrequency now retains the requested playback rate before a voice exists;
GetFrequency reports it without mutating the original PCM format. Both old
handlers already contained calls/branches and were outside the classifier.
No pin change. See `docs/directsound-frequency-review.md` for dispatch/host
tests and the separate outstanding live-cursor continuity audit.

2026-09-22: 247 -> 243 manual, legacy IDirect3D / IDirect3D3 AddRef and
Release now route through the existing DX reference-count handlers, matching
the version-2/7 dispatch paths instead of returning constants. Device creation
retains its creator, and final device release drops that reference, so making
root Release real does not invalidate a device's GetDirect3D parent. D3D3
creation now uses the shared version-2/7 core. Public-dispatch reference counts,
nonfinal/final retirement, both parent/device release orders and heap balance
are covered in test/test-d3d-root-lifetime.js. See
docs/d3d-root-lifetime-review.md for remaining identity/ownership limitations.

2026-09-29: 240 -> 243 manual, GetMessageExtraInfo / SetMessageExtraInfo and
clearerr added. clearerr(FILE*) is straight-line because this CRT keeps no
sticky EOF/error indicators on a FILE (feof probes the position, ferror is
always 0), so there is nothing to reset; ScummVM 0.8 calls it at startup.
GetMessageExtraInfo is what the GOG (SDL2) ScummVM imports and crashed on. Both
are straight-line by nature: they read/swap the per-thread $msg_extra_info
global, exactly as GetMessageTime reads $last_msg_time. The behavior lives
in $handle_GetMessageA / $handle_PeekMessageA, which clear it whenever a
message is retrieved (every message source here attaches extra info 0).
Covered by test/test-message-extra-info.js.

### 2026-10-05: shared unsupported VB DirectDraw/Clipper body

Inventory241 to240: remove handle_IVBDirectDraw7_DirectSlot and handle_IVBDirectDrawClipper_DirectSlot; add handle_vb_unsupported_stdcall. Exact normalized before/after lists show no other changed entry. Both interfaces still return E_NOTIMPL and consume their metadata-derived native typelib stack byte count; no success behavior is added. Existing raw fixed-pop DirectDraw unsupported methods were corrected to typelib argument counts in the preceding implementation. Pin240/d464d3604b0b773447515c35b2e427cd3e4a9b89cea8fd68e4d5b5b080583b8c accompanies this source dedup in the same commit, retaining the gate and its commit-boundary audit. Evidence: scratch/new-games-pipeline-20261004/jigssawme/directdraw34-repair-20261005/shared-unsupported/quiet-current-main-delta.json. First duplicate and stale-inventory build failures are preserved.

### 2026-10-06: HeapWalk answers the Win9x ERROR_CALL_NOT_IMPLEMENTED

240 -> 241: handle_HeapWalk replaces its crash_unimplemented body with the
Windows 95/98 result (FALSE, GetLastError 120). HeapWalk and GetProcessHeaps
are NT-only; the Win9x KERNEL32 exports both as failing entry points, and
software tests for exactly that code: MicroQuill SmartHeap's SHW32.DLL DllMain
(Disciples: Sacred Lands demo) calls GetProcessHeaps then HeapWalk on the
process heap and selects its Win9x path when GetLastError() is 120. The new
GetProcessHeaps (api id 4100) delegates to the same body, so it is not counted.
Same precedent as OpenSCManagerA. Covered by test/test-heapwalk-win9x.js.
Pin241/abd31896744c7b3ecd3f88552ee0bc23760f7ab9f0f43d922a645f2fddb6bcc2.

### 2026-10-06: acmGetVersion reports MSACM32 4.00.1998

241 -> 242: handle_acmGetVersion (new API, id 4165) is straight-line because
the version of the Audio Compression Manager is a constant fact of the machine
being emulated: Windows 98 ships msacm32.dll 4.00.1998, answered as
0x040007CE (major, minor, build). Descent: FreeSpace's demo asks for it before
it opens any stream; the ACM behaviour itself (drivers, streams, the PCM-only
converter) lives in the other acm* handlers. Covered by
test/test-acm-get-version.js.
Pin242/e1c4e029d81a700a65690174bb49c78361b1476bc261b7a91a97fad4f8bc8b0f.

### 2026-10-06: IDirect3DDevice7::Load copies the texture

242 -> 241: handle_IDirect3DDevice7_Load returned D3D_OK without copying
anything and popped 32 bytes for a 6-argument method (this, lpDestTex,
lpDestPoint, lpSrcTex, lprcSrcRect, dwFlags). The extra 4 bytes shifted the
caller's ESP, so Deus Ex's D3DDrv restored a garbage EBX after SetTexture and
asserted in MakeNew ("Assertion failed: Pool"). It now pops 28, copies every
level of the source mip chain into the destination's through
$d3dim_texture_load, and fails loudly for the destination-point / source-rect
form, which needs a sub-rectangle copy nobody has asked for yet.
Pin241/f8ef783a7756762629ecdc59b8dd352acbd3ad08be8e42d254cb2516b779ab76.

### 2026-10-06: wglGetCurrentContext / wglGetCurrentDC

241 -> 243: two getters, straight-line by nature. Each returns state the GL
frontend already tracks per guest thread: the HGLRC $gl_current_context holds
since wglMakeCurrent, and the HDC it was made current on, which
wglMakeCurrent/wglDeleteContext now keep in $gl_current_dc (both NULL when
nothing is current). Unreal-engine OpenGlDrv resolves the whole GL 1.1 + WGL
surface through GetProcAddress and refuses to bind if one name is missing
(OPENGLDRV-GL11-SURFACE-20261006); the other GL 1.1 names it needs fail fast
through $handle_gl_unimplemented until something calls them.
Pin243/cbc5a1e287e085f12a7fcd0c4b4c48aeab5b9c1a9c3b9a62c4efc1afc074aa9c.

## RGB565 color conversion (2026-10-10)

The software RGB565 candidate changes IDirect3D9::CheckDeviceFormatConversion
from unconditional success to rejecting conversions involving format23, which
StretchRect does not implement. The existing BGRA8 behavior is unchanged.
This removes one straight-line handler from the inventory:243 to242.
