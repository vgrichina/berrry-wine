# Native LS32 prepublication pairing — 2026-11-15

The feature implements a real native pairing lease for the six-argument PE
ThunkConnect32 LS01/LB01 request and a live LS16 KERNEL.651 registration.
Pairing is separate from generated QT/FT relays: the ordinary service establishes
and retires the lease, then reports the unsupported FT prolog. It cannot return
TRUE, publish a successful DLL attach or establish installer/UI progress.

Primary ABI: Wine `dlls/krnl386.exe16/thunk.c` at commit
`cc5d1d86ee7d60649e6f858106db046c77c8b12c`, retained at
`scratch/runs/20261115-sims-kernel651-native-thunk/wine-thunk.c`.
LS32 is 36 bytes: magic, checksum, target table, LB marker, flags, two reserved
words, QT offset and FT offset. LS16 is 16 bytes with a relocated FAR table and
first-time word. ThunkConnect32 has six stdcall arguments, 28 bytes including
return address. LS is PE to NE; SL is a different layout and is rejected.

Native state owns process epoch, exact requesting execution owner/request,
PE image identity and DLL generation, NE registration, names, checksum,
reference count and pins. The EXE identity is shared with cooperative and real
Worker instances. A bounded process-arena allocation holds 128 records, each
with at most 256 original targets, matching the byte-sized relay index. It
uses four existing arena slots and is reclaimed with that process arena;
there is no static-map growth. Active connections reject whole-arena retirement.

Both original images bound every header, string and target. The LS16 names
must resolve the actual NE data export and original PE export. PE return code
must be executable and header/relay sections writable. Pairing snapshots the
original header, separate QT/FT spans, argument frame, names and executable FAR
targets. Invocation revalidates all of these and the native generations before
selecting its original target; another valid target in the same module still
fails. Headers, first-time words, relay bytes and caller arguments are not
rewritten. This supports only original unbound LS01/LB01 headers; previously
published or incompatible headers fail closed.

`pairGuest`, `callPaired` and `releasePair` are scoped internal lifecycle
adapters. Replacing the JS coordinator retains native identity. Repeated
pairing retains a reference; final release or request cancellation drops both
image and NE pins. An active target prevents recursive invocation and release.
The existing native frame owner restores the caller and releases its invocation
pin after returns, traps, cancellation or budgets. Generic scalar operation-5
settlement remains closed. The ordinary synchronous and Worker source services
use the native preflight, normal NE loading/notifications, pairing and rollback.

`test/test-native-ls32-connection.js --compiled` exercises generated originals:
actual x86 pushes/imported CALL, native NE KERNEL.651 FAR PASCAL registration,
independent distinct long-return targets locally/cooperatively/in Workers,
context restoration, coordinator replacement, refs/detach/rollback/cancel,
reentry, malformed layouts/offsets/checksums/names, foreign ownership and
header/table/target/export/name mutation. A native DLL fixture exercises normal
PE DllMain and exact initializing-generation pinning. The separate static mode
checks fixture shape only. Focused regressions cover NE loader/lifecycle/QT,
LS16, Win4 notifications, brushes/GDI and all twelve native quit cases.

Qualification and publication evidence lives in
`scratch/runs/20261115-sims-ls32-implementation/`. Complete committed HEAD plus
only this feature is compiled and tested separately from preserved foreign
op5/data-span/census WIP. Git SHA plus binary patches and source/runtime/module
hashes identify it; source trees, media and WASM are not archived in runs.
Direct native/watchdog/supervisor-child waits and pipe EOF are recorded. Tool
transport EOF that is not exposed remains UNKNOWN.

After feature publication, exactly one unchanged normal PE attach retest uses
selected COMCTL32 (577808 bytes, SHA-256
`28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4`)
and matching COMMCTRL (155136 bytes, SHA-256
`39bbfafa8b759ebfcf6a00ee878fa494581a9144891bbd788bded61441de13f9`).
The original LS01/LB01 checksum is 7834, the NE data export is
`Cctl1632_ThunkData16` and PE data export is `Cctl1632_ThunkData32`.
Its observed result will be appended after that one run; no installer is run.

## Published result and one genuine attach

Implementation `601bc085935d18894fbd6ca8bb89354a74bf9932` is on main,
strict pull/push successful. Published compiled controls repeat successfully;
the qualified/published WAT pins, test module SHA-256 and 170 runtime-file pins
match exactly. Both complete HEAD-plus-feature and shared-tree full flock
builds pass. All 18 focused regression suites pass, including 12 native quit
cases. Incoming foreign WIP was excluded and restored byte-for-byte.

The single genuine run used published production WASM SHA-256
`e2c1402a9c0c0e4d0b2dded69ccade1c792fea8469e113e2f5b127c2646c5596`.
Normal COMCTL32 DllMain at `0x51d1cd` called the original six-argument import,
header `0x56b2ec`, checksum 7834. Normal source resolution requested only
`commctrl.dll`; the untouched companion's LibEntry, attach, matching detach and
WEP executed. Native pairing returned token 5 for module 13 and actual FAR
header `0x00670010`; its original words include LS01, checksum 7834, relocated
FAR table and unchanged first-time zero. Native release returned 1. The service
reported `established: true, retired: true` at the unsupported FT prolog guard.
All recorded PE caller registers, segment selectors and sync depth were
restored exactly. Both media hashes remain unchanged.

ThunkConnect32 did not return success; DLL attach/publication, QT/FT execution
and UI are unproved. The ordinary loader marks the incomplete DLL FAILED and
retains its preexisting quarantine pin; the pairing's extra pin and temporary
NE reference were retired. No installer or unchanged genuine retry occurred.

The next primitive is the native LS FT prolog relay: select the original FAR
target by the byte-sized index, establish the documented 64-byte frame while
preserving the caller, then implement its FT_Thunk conversion/invocation and
FT_Exit cleanup under an owned lifetime. Wine `_write_ftprolog`,
`__regs_FT_Prolog`, `__regs_FT_Thunk` and FT_ExitNN in the pinned primary are the
implementation reference. Pairing alone must not open the existing FT guard.
The exact run and cleanup proof are in `result.json`, `genuine-result.json`
and `runtime-release.json` under the run directory above. No boxes were created.
