# Win4 NE DllEntryPoint lifecycle — 2026-11-15

Implementation and compiled controls are complete. Evidence belongs in
`scratch/runs/20261115-ne-win4-dllentrypoint/result.json`.

The ABI is the six-argument FAR PASCAL export documented in Microsoft's
[KB154093](https://ftp.zx.net.nz/pub/archive/ftp.microsoft.com/MISC/KB/en-us/154/093.HTM):
DWORD reason, WORD instance, WORD DS, WORD heap, DWORD reserved, WORD reserved.
The argument span is sixteen bytes. The last parameter is nearest the far
return address. Reserved parameters are zero. Attach success uses AX, the
16-bit BOOL; detach return values cannot veto release.

The original [Programmer's Guide to Microsoft Windows 95, chapter 21,
Implementing a Thunking Layer](https://www.bitsavers.org/pdf/microsoft/windows_95/Programmers_Guide_to_Microsoft_Windows_95_1995.pdf)
specifies notifications for every increment/decrement of the module usage
count, with reasons 1/0. Loader reentry and scheduler yields from this entry
are prohibited. This differs from PE process-first/last notification rules.
Internal export inspections are temporary pins, not application loads.

The untouched genuine COMMCTRL is 155136 bytes, SHA-256
`39bbfafa8b759ebfcf6a00ee878fa494581a9144891bbd788bded61441de13f9`.
Its resident export DLLENTRYPOINT is ordinal 300, segment 2:0176; its separate
header initializer is 2:0000. Actual disassembly shows it loading hInst from
`[bp+10h]`, reason DWORD from `[bp+12h]`, then returning with `retf 10h`.
Its segment 1:001c helper tail-jumps to KERNEL ordinal 651. Source media and
the installed-name mapping are recorded in
[the companion investigation](sims-native-common-controls-thunk-20261115.md).

Loading this companion cannot establish a native thunk connection while
KERNEL.651 and native connection/FT ownership remain unimplemented. Sims
installer and household remain open; prior originals remain closed.

## Implemented behavior

The version refusal is replaced with validation of a resident, executable
DLLENTRYPOINT export. A modern version alone does not admit an image. The
native bridge resolves notification metadata from the actual retained module,
including when a second lifecycle coordinator has no source bytes. The existing
process execution scope, module record, reference count and invocation pin own
the call; no JavaScript ready-module cache substitutes for them.

First load runs dependencies, the distinct header LibEntry/LibMain initializer,
then reason 1, and publishes only after AX reports success. Each subsequent
semantic acquisition also sends reason 1. Release sends reason 0 before
consuming its reference; the final release then runs WEP and releases the
module/dependencies. Internal export inspection references do not notify.
During a repeated notification the record is temporarily initializing, excluding
loader reentry and ordinary calls/frees. No loader mutex spans guest execution.
The existing bounded synchronous entry driver enforces the FAR return and
sixteen-byte cleanup and refuses asynchronous yields.

Failed repeated attach removes only the new reference. Failed first attach
rolls back the new record and acquired dependencies, with WEP cleanup after a
completed LibMain. An unsuccessful attach receives no detach. A trapped detach
keeps the ready image and reference for a diagnosed retry. A trapped final WEP
retains the existing termination lease and its explicit retry route. Cancellation
and retired cooperative owners cannot publish a ready module. Cancellation in
the same slice as a successful attach receives a matching bounded detach
before rejection, including on a repeated acquisition. Legacy Win3
LibMain/WEP behavior remains separate.

## Compiled evidence and limits

`test/test-ne-win4-dllentrypoint.js` emits a two-segment synthetic NE DLL with
real x86 header initializer, notification, WEP and value entries. Guest code
copies all eight argument WORDs, counts attach/detach calls, records order and
executes RETF 16. Controls cover attach FALSE, real invalid-instruction traps,
malformed cleanup, repeated references, failed acquisition while another
consumer remains, trapped-detach retry, reentry, cancellation, retired owners,
missing/nonexecutable exports and a legacy DriverProc-shaped FAR PASCAL call.
Normal compiled LoadLibrary16/FreeLibrary16 resolver calls execute under local,
cooperative and actual Worker owners. A Worker stop also cancels a pending
resolver without publishing its image.

The compiled feature closure is committed HEAD
`cabab6e56c8910f314fdc04ba54cf2487a2e578a` plus these owned changes, excluding
released foreign operation-5/data-span WIP. Its module is 2202838 bytes,
SHA-256 `fb84099d865f8bca61a669739fab62682dc5d30950781d1fed4ac83e0722dcd3`.
The runtime require hook reads unowned library files from that exact HEAD;
Workers inherit the hook. Source identities, reproduction scripts and actual
wait/EOF/deadline-watchdog receipts are in the run directory. No source tree,
proprietary media or WASM bundle is archived there. The full shared-tree
`flock /tmp/wine-build.lock bash tools/build.sh` also passes; its module is
recorded separately and is not presented as clean-HEAD proof.

Focused legacy image/extent, invocation/Qt driver, dependency/WEP lifetime,
local/cooperative/Worker lifecycle, stack lease, Qt ownership/gateway and twelve
nested Win16 quit/exit cases pass. The quit fixture adds only its existing test
exports to the same source closure; its module identity is recorded separately.

The genuine companion goes through the ordinary compiled PE LoadLibrary16
boundary and normal resolver with the exact original bytes. **It reaches
header initializer 2:0000 and traps at USER ordinal 281** (key 0x20119,
return linear address 0x084303b5). Caller EIP/ESP are restored and COMMCTRL is
not published. Its DLLENTRYPOINT 2:0176 is not reached. KERNEL.651 is a later
boundary established by disassembly, not by execution in this run. Native
connection/LS/QT/FT success is neither implemented nor inferred. There is no
fresh Sims installer/household run, and previous originals remain closed.

Released foreign data-span/operation-5 source changes and mixed census rows
are preserved in the shared tree and excluded from this feature's whole-file
commit using the explicitly authorized temporary removal/restoration workflow.
Only this feature's lifecycle census review is published. No box was created;
box ID, expiry and stop receipt are not applicable.
