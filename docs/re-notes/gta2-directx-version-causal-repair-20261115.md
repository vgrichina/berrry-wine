# GTA2 DirectX capability probe — 2026-11-15

The generic DirectMusic module repair passes authored native callers.
The current native scene qualification stopped before DOWN because its
independent release child did not acknowledge arming within 500 ms. No new
original was launched; both original renderer arms remain withheld.
Evidence: `scratch/runs/20261115-gta2-directx-version-causal-repair/`.
The heavy-work order is ReVolt1600056, SimsLocalServer1677139, then this task.
Fixtures were prepared but not executed while either predecessor owned that lane.

## Exact static path

The unchanged local `gta2.exe` is 2,893,824 bytes, SHA-256
`97ad743b6ec9ea1be95282053c3127084acd764a7f37a3e57e2268af52d02ae3`.
All addresses below are original PE virtual addresses (image base `0x400000`).
The focused test pins the relevant instructions, IAT identities, strings and
full GUIDs against that exact file, without executing or modifying it.

`WinMain` at `0x5d6140` calls `0x4be5f0` at `0x5d61b9`, supplying two output
DWORDs. At `0x5d61be`, `cmp [esp+0x10],0x601; jae 0x5d61f8` admits the
reported capability. Otherwise `0x5d61c8` passes the original string
`0x615958`, **ERROR: Incorrect version of DirectX**, to `0x5d5cf0`.
There is no file-version query or installed-DirectX registry query on this
specific probe path. Neither output is a version to overwrite or spoof.

The probe at `0x4be5f0` first calls `GetVersionExA` through IAT `0x5f0078`.
The NT major-version-4 branch caps its result at DirectInput availability;
the other branch performs these actual capability operations:

1. Load `DDRAW.DLL`, resolve and call `DirectDrawCreate`.
2. Query `IID_IDirectDraw2` and release that queried reference.
3. Load `DINPUT.DLL`, resolve `DirectInputCreateA`, then free that module.
4. Call `IDirectDraw::SetCooperativeLevel(NULL,DDSCL_NORMAL)`.
5. Create a primary surface using a 108-byte `DDSURFACEDESC` with
   `DDSD_CAPS` and `DDSCAPS_PRIMARYSURFACE`.
6. Query `IID_IDirectDrawSurface2`, then `IID_IDirectDrawSurface3`, and release
   the surface and DirectDraw references. Reaching this point sets `0x600`.
7. Call the final probe at `0x49d510`; promote to `0x601` only if it succeeds.

The final probe clears its own WORD, calls `LoadLibraryA("DMUSIC.DLL")`
at `0x49d520`, and skips COM activation if loading returns NULL. With a module
handle it calls `CoCreateInstance` at `0x49d53f` using:

| Argument | Exact value |
| --- | --- |
| CLSID | `636B9F10-0C7D-11D1-95B2-0020AFDC7421` (DirectMusic) |
| Outer | NULL |
| Context | `CLSCTX_INPROC_SERVER` (1) |
| IID | `6536115A-7B2D-11D2-BA18-0000F875AC12` (IDirectMusic) |

Only a nonnegative HRESULT stores `0x601`; it then releases the returned
interface and frees the module. A failed load, failed COM activation, or
earlier failed capability stays a genuine failure.

## Retained evidence and attribution limit

The [predecessor](gta2-current-native-thunks-visible-driving-20261115.md)
retains the actual Miles and genuine COMCTL32 successful initialization,
followed by the exact native DirectX error with zero original input. Its
console contains no per-call return trace for this capability probe. The
retained error therefore corroborates the static error branch, but cannot
alone distinguish the earlier DirectDraw path from the final DirectMusic
load/activation. No guessed original API return is promoted to observation.
That original and all historical UNKNOWN endpoints remain permanently closed.

Read-only source inspection found the full DirectMusic class and interface
handling in `src/09a7-handlers-dispatch.wat`, including reference ownership
and empty port enumeration. Neither the static system-module name table in
`src/09a0-handlers-base.wat` nor `lib/dll-registry.js` names `dmusic`.
Those relevant files match the predecessor's retained source hashes; the
retained dispatch-file dirty hunk changes only a thunk comment. This identifies
a candidate module/object inconsistency, not an observed original return.
The `GetVersionExA` handler reads the existing `$winver`; this task does not
alter that value or either version handler.

The new focused test emits four small, independently authored PE32 callers:
the capability-operation sequence, `LoadLibraryA("DMUSIC.DLL")` alone, and
DirectMusic `CoCreateInstance` alone, plus an unrelated absent-module control.
They call public imports and actual COM
vtables, report stage markers through `OutputDebugStringA`, and check stack
balance and release their successful references. The COM caller checks
IUnknown identity, AddRef/Release counts, and S_FALSE empty port enumeration
without changing its descriptor. The absent-module caller preserves error 126.
They contain no original
instructions, media, version overrides, registry seeds, or replacement API
returns. Preparing these inputs is not native execution or qualification.

## Reproduced contract and repair

After both current predecessors explicitly released, personal verification
checked their sealed native/watchdog/supervisor waits, current recorded PID
and group absence, both free locks, and free disk above 1.5 GB. Historical
missing child/ancillary EOF receipts remain UNKNOWN and are excluded explicitly.

The unchanged shared production module ran the authored x86 capability caller.
It completed the earlier DirectDraw/DirectInput operations, then reported
`LoadLibraryA("DMUSIC.DLL") -> NULL`, `GetLastError() == 126`. The independent
COM caller created the exact DirectMusic interface and passed canonical
IUnknown identity, AddRef/Release ownership, S_FALSE empty enumeration with
an unchanged descriptor, and balanced ESP. The unrelated absent vendor DLL
also failed with error 126. All are public API calls from authored native code.

The repair adds `dmusic` to the WAT static module table and the matching JS
builtin-component catalog. It uses the existing distinct readable PE module
identity and reference path for an implemented component. It does not return
the executable's base, restore the old unknown-DLL fallback, change a version
value, create registry entries, fabricate ports, or alter the original.

The locked shared build passed. On that rebuilt module:

| Authored caller | Before: guest exit | After: guest exit |
| --- | ---: | ---: |
| Capability operations followed by DirectMusic | 126 | 0 |
| DirectMusic load/identity/case/unknown-export/release | 126 | 0 |
| DirectMusic COM identity/ownership/empty ports/ESP | 0 | 0 |
| Unrelated missing module | 126 | 126 |

Host exit 0 only records harness completion; guest exits above come from the
native caller's own conditional checks. Every run has an independently armed
watchdog and sealed actual waits with both EOFs. Loader-policy regressions
and all 61 existing DirectMusic interface/lifetime/negative checks passed.
The predecessor original's exact failing return remains unobserved; these
new fixtures establish the contract defect and its static causal connection.

The controller audit additionally found that per-request three-second limits
did not bound a whole capture or manual operation. An operation-wide immutable
three-second deadline now permanently seals the same transport before rejecting
the operation. An authored real-time control combines individually immediate
replies into a longer operation, observes UNKNOWN, and verifies zero subsequent
requests, input, rebind or replay. Existing independent-child protocol tests
also pass. This is control qualification, not original gameplay evidence.

Microsoft identifies [DMusic.dll as the DirectMusic system component](https://learn.microsoft.com/en-us/windows-hardware/drivers/audio/user-mode-wdm-audio-components).
Its [LoadLibraryA contract](https://learn.microsoft.com/en-us/windows/win32/api/libloaderapi/nf-libloaderapi-loadlibrarya)
requires an actual module handle on success, reference counting, and NULL
on failure. Existing DirectMusic object implementation and module identity
are separate contracts; finding an object implementation alone does not
justify an unconditional successful module load.

## Current qualification and first blocker

Shared and HEAD-with-whole-owned-source builds pass, as do all four authored
native callers on each source view, builtin loader policy, and 61 DirectMusic
interface checks. Genuine COMCTL32 attach/detach, installed COMMCTRL mounting,
caller restoration and FT publication/retirement pass on both source views.
The current browser uses a real guest Worker, retrieves the matching current
module and source scripts, loads both genuine DLL hashes through the installed
HTTP names, and records an initialized LIVE COMCTL32 generation.

The controller now refuses absent, empty, partial or invalid Chrome endpoint
files until a complete browser UUID is available, within three seconds. This
prevents constructing a permanently failed transport from a file still being
written. Focused controls cover those partial files as well as the aggregate
operation deadline. Existing actual-loopback protocol tests pass.

The authored native scene test reached its first modal scene. Its transition
failed in `tools/sims-install-controller.py:306`: **independent UP not armed**.
The parent's fixed 500 ms readiness wait expired before it consumed the arm
acknowledgement. The child's sealed wait later contains its arm acknowledgement,
exit 0 and both EOFs; that does not turn the parent's timed-out admission into
success. No guarded DOWN request or consumption receipt was produced. Parent
EOF produced a physical-UP ACK, then permanently closed the release endpoint
as unresolved. That UP is not proof of a consumed pulse. Native/watchdog/
supervisor waits are sealed; host cancellation is not native Quit. The separate
focus-change negative in the same test suite correctly refused consumption.

This is the first current qualification blocker, not a GTA2 gameplay failure.
The failed endpoint was neither rebound nor retried. No original, blank-page
input qualification or WebGL arm was launched after it. Resolving the authored
release-prearm readiness contract is the next prerequisite; the existing
500 ms/1750 ms deadlines were not relaxed. Native thunk, Win4 lifecycle,
Win16 brush/Quit and scene-unit controls pass independently. The original
DirectX dialog's precise API return remains unobserved until a future qualified
original can exercise this material generic repair.

Genuine FT target invocation remains unproved. No walking, vehicle entry,
manual driving, visible consequence, renderer parity or native GTA2 Quit is
claimed. Host shutdown is separate from native Quit. No box has been created:
ID null, state NOT_CREATED, expiry null, stop receipt NOT_APPLICABLE.
