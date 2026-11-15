# KERNEL.651 native LS16 connection — 2026-11-15

The general native LS16 registration primitive is implemented and passes
compiled local, cooperative and actual Worker controls. This establishes
owned registration and checked execution of relocated LS targets. PE LS32
pairing, generated QT/FT relays and Sims installer UI remain unimplemented or
unproved. The single genuine post-publication resolver retest is pending.
Evidence: `scratch/runs/20261115-sims-kernel651-implemented/result.json`.
The original blocked report remains unchanged in
`scratch/runs/20261115-sims-kernel651-native-thunk/result.json`.

[Wine's ordinal specification](https://raw.githubusercontent.com/wine-mirror/wine/master/dlls/krnl386.exe16/krnl386.exe16.spec)
and [pinned primary implementation](https://github.com/wine-mirror/wine/blob/cc5d1d86ee7d60649e6f858106db046c77c8b12c/dlls/krnl386.exe16/thunk.c)
define seven FAR PASCAL arguments: module16 string, module32 string, WORD
instance, DWORD reason, LS16 data pointer, PE export string, WORD CS. Arguments
occupy 24 bytes; the UINT result uses DX:AX. The actual COMMCTRL helper at
1:001c inserts its header at 9:0010 and export name at 1:0032, pushes CS and
tail-jumps to imported KERNEL.651. Its DLLENTRYPOINT is 2:0176, separate from
LibMain at 2:0000. The unchanged companion is 155136 bytes, SHA-256
`39bbfafa8b759ebfcf6a00ee878fa494581a9144891bbd788bded61441de13f9`.

Native process-owned records retain module identity, original header, checksum,
relocated target table, CS, peer module/export names and connection refs.
The execution lease and original descriptor bounds protect every read. Header
storage must be owned data; table storage may be original code or data, as
COMMCTRL's real relocation requires. Selected targets must be executable
original descriptors of the same live module. Pair lookup checks checksum,
case-insensitive module name, exact export name, bounded index and current
header/table values. Unsupported layouts, reasons and invalid ownership fail.
The supplied LS16 header and first-time field are preserved.

Each synchronous Win4 notification owns a native transaction. A successful
attach commits registration refs; rejected/trapped/cancelled attach restores
previous consumers. Repeated notifications cannot reenter the same module.
Detach decrements refs, and rollback/final unload clear records before selectors
can be recycled. No JS map supplies persistent identity. Replacing the JS
coordinator retains the native connection. There are 128 bounded connection
slots across 24 dynamic modules; exhaustion fails rather than fabricating one.

The synthetic NE imports the real ordinal, checks stack cleanup and DX:AX in
x86, and supplies distinct long-return targets in independent modules. Tests
exercise local/cooperative/Worker execution, new coordinator lookup, code-table
storage, zero/high checksums, foreign/stale frames and selectors, invalid
header/extents/names/instance/CS/reason, target/header mutation, repeated refs,
rejected attach rollback, trapped attach, cancellation, reentry, detach and
retired execution owners. Worker controls execute native-resolved x86 targets,
restore caller context, then use ordinary compiled FreeLibrary16 for detach.
Two test-only numeric adapters carry test tokens/results through the Worker's
number-only export response; production i64 token handling is unchanged.

All 18 focused/NE/thunk/Win4/brush/GDI/quit suites pass, including all twelve
local/Worker nested quit cases. The full locked build passes. Feature tests
compile complete committed HEAD plus owned changes; released foreign operation-5,
data-span and other WIP are excluded and preserved. Callback census review
updates only the owned lifecycle boundary; its pending broader ownership claim
and all gates remain intact. No generic TRUE, application whitelist, header
patch, ordinal remap, forced FT success or original installer bypass is added.

The owner clarified the predecessor gate before this implementation. All 326
available named SC waits were personally read with actual wait and both EOFs;
328 PIDs/process groups were absent, explicit 04:51:05 release was present and
the heavy lock was available. The two missing historical detached-tool outer
waits and previous Sims light-watcher wait remain UNKNOWN. They are not claimed
complete or recovered from absence. No box or worker was created.
