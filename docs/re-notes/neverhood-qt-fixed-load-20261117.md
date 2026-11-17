# Neverhood QT fixed-module stack validation

Evidence: `scratch/runs/20261117-neverhood-qt-original-install-continuation/`.

The fresh original used published main `9025b309f`, an immutable Git-only
module `33ef36c2de1c86ca1302b5659f02bb48f1794dfc4e20945821251198f04cb03e`,
the complete original CD and unchanged genuine DLLs/defaults/real clocks.
Postpublication native QT37, FT, LS32, SMapLS, native BUTTON7 and synchronous
native dialog14 tests passed before launch. The independent deadline watchdog
was armed before the native process, with 2400/2420 seconds and a 240-second
Quit reserve.

A personally reviewed complete launcher frame supported one Install intent.
Its native BUTTON dispatch returned CONSUMED, independent physical release was
acknowledged, and the complete finite intent finished in 223 ms. Setup then
copied genuine DirectX files and reached DirectSound/waveOut initialization.
It trapped in `win16_kernel` after logging ordinal 95, through
`invokeNeQtSync`. A name-section recompilation with byte-identical executable
sections maps the retained actual stack to KERNEL.95 LoadLibrary. The requested
DLL name was not captured and remains unknown.

The next capture refused the exited process identity before sending HTTP and
published permanent UNKNOWN. There were no later requests, rebind, replay or
second original. Installation completion, Play, room entry and native Quit are
not established. Process exit 1 and watchdog exit 0 were actually waited with
both pipes drained. No box was created.

## Authored reproduction and repair

An independent PE/NE fixture executes the packed QT caller, then native far
KERNEL.95/96 calls from its actual target. Even `LoadLibrary("KERNEL")` traps
on the original tested module. This rejects an already supported fileless
fixed module before considering the requested name: the API stack predicate
only accepts descriptors backed by the NE arena, whereas QT deliberately
aliases the real PE stack outside that arena.

`win16_bridge_fixed_api_stack_selector` retains ordinary arena validation for
non-QT frames. For a QT frame it requires the current owner, running state,
execution scope, exact frame stack selector/index, original 64-KiB stack base,
data descriptor flags/limit, matching active SS base and the live exact-token
mapping lease with matching base/backing. The mapping lease is checked under
the virtual mapping mutex. General selector validation is unchanged.

`test/test-neverhood-qt-fixed-load.cjs` exercises actual balanced fixed-module
load/free and the KRNL386 alias at both packet alignments. Frame state/alias,
descriptor base/limit/flags, lease token/base/backing mutations must reach
native refusal, restore the suspended caller and leave references balanced.
Nonfixed names remain unsupported. Actual CPUWorkers execute success and
refusal cases and are joined before retirement is accepted. Existing QT/FT/
LS32/SMapLS native tests also run against Git plus only this owned repair.

This repair does not implement image-backed nested LoadLibrary, arbitrary
callback reentrancy or a request stack. The original DLL name and any later
installation boundary require a fresh, separately authorized original run. The
closed endpoint is never used to qualify this repair.

## Qualification and publication boundary

The final immutable Git-plus-owned-patch run passed 28 local cases and six
actual CPUWorker cases, QT37, full FT, LS32, SMapLS, and genuine SETUPX plus
DSETUP6E attach/retire. Every final subprocess was actually waited with exit
zero and both output streams drained. Incoming unrelated edits in the same
WAT file were verified byte-for-byte and excluded from the owned patch.

The earlier shared canonical attempts stopped on active foreign producer
revision gates. A continuation in
`scratch/runs/20261117-neverhood-qt-leased-stack-install/` retains the exact
owned patch and verifies the prior native receipts and authored test bytes.
It coordinates a coherent shared build window with the active owners and
preserves the unrelated eight-line WAT edit without including it in the
repair. Publication requires the canonical locked build. The newly authorized
original pipeline follows publication and immutable current-Git qualification;
the earlier original endpoint remains permanently closed.

## Published repair and fresh original boundary

The canonical locked build passed, and repair `caa970b1177af07209c2bc19fae5214b2c7304ae`
was published on main. The continuation sealed Git-only main
`a1fed9f2b` without any worktree overlay; all 4,582 Git source pins matched.
Its production module is
`3bc89761cd8a93d99747627545cd829555a4c304bb0f3d45683227b642bea6e5`.
The diagnostic module was byte-identical to the retained repaired native
proof. The focused native chain and seven native BUTTON cases passed, with
actual subprocess waits and both output streams drained. All 257 CD files
and genuine DLL pins passed the media check. No source archive or media copy
was created.

The one newly authorized original used the unchanged clocks/defaults and
prearmed 2400/2420-second native/watchdog deadlines with a 240-second Quit
reserve. A personally viewed complete launcher supported Install. Its native
BUTTON receipt was CONSUMED within 500 ms, independent physical UP was
acknowledged, and the finite intent completed in 591 ms. The original then
trapped again at KERNEL.95 through QT. Native exit 1, watchdog exit 0 and both
output streams were actually waited. Permanent UNKNOWN was recorded locally;
no subsequent HTTP, rebind, replay or second original occurred.

Existing `--trace-win16` retained name argument `0257:00d6` and return address
`0885131b`. Static reconstruction against the hash-pinned genuine DSETUP6E
identifies `setupx.dll`: code segment 2 at `1310` pushes the selector relocated
to data segment 5, then offset `00d6`, and calls KERNEL.95 at `1316`, returning
at `131b`. Segment 5 contains `setupx.dll` at `00d6`. Both relocation chains
and the matching actual arguments are retained in `requested-library-static.json`.
Runtime string bytes were not captured; this identification is explicitly a
reconstruction, rather than a live-memory observation.

SETUPX is image-backed, outside the repair's fixed-module capability. Native
fixed-library success does not establish that the original requested a fixed
library. A subsequent implementation needs invocation-owned nested loader
requests and safe attachment/reentry; returning a forged fixed handle is not
a repair. Installation completion, Play, room entry and native Quit remain
unestablished. The original pipeline is permanently closed.
