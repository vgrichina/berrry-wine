# GTA2 fullscreen initialization: narrowed, not repaired

Status: BLOCKED_MISSING_CAUSAL_RETURN. Exact tested source is
`1e4fdb06f64e5f14ddec582111dfe7ecb71df6ba`. No emulator, renderer, controller,
game binary or compiled module was changed. No guest or compiler was invoked.

## What the retained run actually proves

The original 640x480 frame and guest stdout show
`Failed to set fullscreen videomode: 2`. Ordinary OK dismissal produced guest
exit 1037; runner exit 0 is not a successful game run. The 28 retained
`0x0ed...01` markers come from `enum_modes_continue` in the exact DirectDraw
source: raw rows 0..18 and 21..29 all returned DDENUMRET_OK (1).
They contain neither SetDisplayMode arguments nor its HRESULT.

Crucially, the displayed **2 is the requested mode ID, not an HRESULT or
Vid_SetMode return value**. The pinned GTA2 PE binds Vid_SetMode at VA
0x5dc603..0x5dc60d into function pointer 0x6169cc. At 0x5ca695 it calls that
pointer, tests EAX, and, on nonzero, pushes **ESI** at 0x5ca69f as the error
format argument. ESI holds the mode ID returned by Vid_CheckMode. It passes
error ID 0x40d (1037). The format string is at VA 0x60c84c/file 0x20aa4c;
the corresponding formatter case is 0x49ebf5. Replacing ESI with an assumed
HRESULT would misdiagnose the retained evidence.

## Exact narrowed PE call/return sites

Dmavideo.dll exports Vid_SetMode at preferred VA 0x01001d30, RVA 0x1d30,
file offset 0x1130 (stdcall three arguments). Its fullscreen branch contains:

| Call instruction (preferred VA / file offset) | Actual boundary | Returned failure path |
| --- | --- | --- |
| 0x01002066 / 0x1466 | wrapper to DirectDrawCreate | nonzero at 0x01002084 -> common return 1 |
| 0x01002097 / 0x1497 | IDirectDraw::QueryInterface, IID_IDirectDraw4 at 0x0100a130 | nonzero -> release and return 1 at 0x010020c4 |
| 0x010020f0 / 0x14f0 | IDirectDraw::SetCooperativeLevel, flags 0x51 | EAX nonzero -> return 1 at 0x010020f7 |
| 0x01002122 / 0x1522 | IDirectDraw::SetDisplayMode, vtable byte offset 0x54 | EAX nonzero -> return 1 at 0x01002129 |
| 0x010021a9 / 0x15a9 | IDirectDraw4::CreateSurface, initial primary/backbuffer chain | failure selects fallback, not necessarily final failure |
| 0x010021eb / 0x15eb | CreateSurface, one-backbuffer fallback | failure selects another fallback or return 1 |
| 0x0100223c / 0x163c | CreateSurface, final caps fallback | EAX nonzero -> return 1 at 0x01002243 |
| 0x01002272 / 0x1672 | IDirectDrawSurface4::GetAttachedSurface, BACKBUFFER | EAX nonzero -> return 1 at 0x01002279 |

Other guards (null system, unavailable mode, device/interface allocation) also
return 1. Thus even a preserved Vid_SetMode EAX=1 alone would not identify the
causal API. The imports include DirectDrawCreate/DirectDrawEnumerateA; this DLL
does **not** import ChangeDisplaySettingsA/W. No evidence supports choosing
the display-settings handler as the repair site.

Preferred addresses above are **not assumed live addresses**. A later trace
must retain the actual DLL base and image hash before translating these RVAs.
The retained log has DllMain calls but no independently identified video image
load-base record suitable for treating this table as live breakpoint addresses.

## Source-backed candidate, not established cause

`src/09a8-handlers-directx.wat` owns all the listed DirectDraw handlers.
Its v4 CreateSurface requires a 124-byte DDSURFACEDESC2, which this DLL supplies.
Its GetAttachedSurface checks the additional three DDSCAPS2 words for v4/v7
and returns 0x887600ff if any is nonzero. The DLL writes only the first caps
word (BACKBUFFER=4) at stack offset 0x68 before the call at 0x01002272;
the following words have no initialization in this function. That is a
specific ABI hypothesis worth observing, but the retained run has no values
for those words, no returned surface interface identity, and no HRESULT.
CreateSurface or an earlier boundary could have failed first. Ignoring extra
caps, forcing success, or changing interface selection on this evidence would
be speculative and could hide valid invalid-call failures.

## Smallest missing observation and stopping gate

One invocation-correlated trace of the failing Vid_SetMode is required:
actual function target/image base/hash, three entry arguments, then the
**first terminal failure site from the table with raw EAX immediately after
the relevant COM return**, actual this/vtable identity and that call's inputs.
For CreateSurface retain the 124-byte descriptor and each fallback outcome;
for GetAttachedSurface retain all 16 caps bytes plus the primary/backbuffer
handles. For SetDisplayMode retain width, height and bpp. Also retain the
Vid_SetMode EAX separately from its mode ID. The observation must include
initializers and calls preceding the nominal game entry if the runner traces
dispatch. Successful earlier enumeration markers are insufficient.

This is a proposed observation for a later **freshly admitted coordinator
assignment**, not an instruction or authorization to rerun now. Existing
compiled modules are retained and hash-verified. Any actual API repair then
needs a minimal behavior reproducer and valid/invalid rejecting controls,
independent acceptance and later canonical/runtime qualification. No fixed
fullscreen, gameplay, movement, ordinary game Quit, FPS or audio is claimed.

## Verification and preservation

Eighteen bounded static PE/evidence checks passed, including controls proving
different COM failures collapse to the same result and the printed operand is
ESI rather than EAX. These are diagnostic consistency checks, **not emulator
behavioral tests**. Original stdout/stderr, command, controller/exit records,
frame, archive inventory, disassembly and PE source/fixture hashes are retained.
All operation receipts keep exit, stopReason, resource peaks and cleanup.
The initial root runner was correctly rejected as different from the pinned
revision; the exact donor blob was used instead. A remote-only Node pathname
was absent locally; the installed local Node v24.18.1 passed startup and the
canonical filename-bearing tree parser check. Neither incident started a guest.
The original root/donors/index/refs remained read-only; no main integration.

No box is assigned to this offline task; no Boat API operation was performed.
Predecessor bx_c35ty8f8 expiry was 2026-10-27T13:21:00.618Z. Its old receipt
said running/idle; the coordinator board subsequently records snapshot/stop.
Current state was not queried here; lifecycle remains coordinator-owned.
