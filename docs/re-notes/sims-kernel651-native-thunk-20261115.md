# KERNEL.651 native LS16 connection — 2026-11-15

The general native LS16 registration primitive is implemented and passes
compiled local, cooperative and actual Worker controls. This establishes
owned registration and checked execution of relocated LS targets. PE LS32
pairing, generated QT/FT relays and Sims installer UI remain unimplemented or
unproved. Implementation commit `f51ce2e1d897d96b8f80a8beaaed0bdad2fec40a` is
published on main with strict pull/push. The single genuine post-publication
resolver retest succeeded through DLL publication and normal caller return.
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

The coordinator clarified this task's predecessor gate before implementation. All 326
available named SC waits were personally read with actual wait and both EOFs;
328 PIDs/process groups were absent, explicit 04:51:05 release was present and
the heavy lock was available. The two missing historical detached-tool outer
waits and previous Sims light-watcher wait remain UNKNOWN. They are not claimed
complete or recovered from absence. No box or worker was created.

## Single genuine result and remaining boundary

A clean module compiled from published `f51ce2e1d` is 2205191 bytes, SHA-256
`e1ecdcccd21b26b6de866eb6110d7354c25527c36ff9a1ff382c8f67c56d7767`.
Its production source pins match the independently qualified feature module;
only the latter's test exports differ. This is a fresh module, not an older
substitute. The separate mixed shared-tree locked build is 2205447 bytes.

Exactly one ordinary compiled LoadLibrary16 resolution consumed the genuine
unchanged COMMCTRL bytes. It completed eight USER.281 calls and LibMain
2:0000, reached DLLENTRYPOINT 2:0176, made one actual KERNEL.651 call and
committed the native attach transaction. LoadLibrary16 returned handle 268;
the module is ready in the native module table. The parked PE frame advanced
through its ordinary eight-byte API cleanup, preserved CS/DS/SS/depth, then
executed its return with the expected ESP. There was no unsupported-API trap
in this bounded load. This proves successful genuine DLL initialization and
publication, separately from LS32 pairing or relay execution.

Stop here: a real native LS32 connection and its QT/FT relay prerequisites
remain unimplemented/unproved. The preexisting ThunkConnect32 scalar success
is not evidence of such a connection; released foreign inspection/guard WIP
was not adopted. The existing FT guard remains closed. No original Sims
installer was launched or bypassed and no UI/household progress is claimed.

The independent deadline watchdog was armed before each command gate opened.
The release names 37 actual wait records with both EOFs and 108 absent recorded
PIDs/process groups; the genuine supervisor-child wait directly collected
both pipes. Launching-tool APIs report completion without exposing separate
pipe EOF, so no stronger all-parent-EOF claim is made. Historical outer proof
gaps remain explicit. Source/build/runtime access was released after the one
genuine run; finalization only changes this note and compact evidence. No box
was created: ID/expiry are null, state NOT_CREATED, stop receipt not applicable.
