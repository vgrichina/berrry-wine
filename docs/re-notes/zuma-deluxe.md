# Zuma Deluxe: current ordinary launch

## Canonical initializer/caller static diagnosis, 2026-11-10

No original startup was retried. Run
`scratch/runs/20261110-zuma-initializer-static-cause-1412/` retains canonical
file hashes, raw-backed disassembly, source SHA/diff and synthetic diagnostic
tests. The requested `zuma.md` is named `zuma-deluxe.md` in this checkout.

`DLL initializer did not return: module=0x989000` comes from
`lib/dll-loader.js:finishDllInitialization`: **module is the mapped base**, not
the failing EIP. The message alone does not identify a filename, instruction,
trap, blocking wait, exit or exhausted budget. Its `error.outcome` has that
distinction, but the dated note does not retain those fields.

Canonical `Zuma.exe` and BASS hashes still match the November 3 identities
below. EXE base/SizeOfImage are `0x400000/0x189000`, ending at `0x589000`.
Current `get_next_dll_addr` chooses the greater of page-aligned image/retained
DLL ends and the shared heap watermark; `load_dll` can move it again.
`0x989000 = 0x589000 + 4 * 0x100000`, consistent with four current heap-arena
chunks, but no observed watermark or load order proves that history.
It is outside the canonical EXE image. No canonical candidate has preferred
base `0x989000`; real DLLs are rebased. The manifest's sole DLL is BASS;
the EXE imports native-loadable shared OLEAUT32 and BASS imports shared MSVCRT.
If any were mapped at the reported base, their entry addresses would be:

| Image | Preferred base | Entry RVA | Entry at base 0x989000 |
| --- | --- | --- | --- |
| bass.dll | 0x10000000 | 0x55043 | 0x9de043 |
| shared msvcrt.dll | 0x78000000 | 0x3428 | 0x98c428 |
| shared oleaut32.dll | 0x65340000 | 0xcf98 | 0x995f98 |

These are candidates, not an authenticated assignment of the historical row.
Dynamic DLL names reconstructed by a packer are not exhaustively known.

The EXE's file-backed BASS caller is explicit: `0x49b4c2` pushes the
`bass.dll` string at `0x508cd0`, then calls constructor `0x49b290`.
At `0x49b2a0`, `call [0x4fe0cc]` imports `LoadLibraryA`; the real continuation
is `0x49b2a6`, which tests the returned handle and stores it at object+4.
`0x49b2be` calls imported `GetProcAddress` for `BASS_Init` (`0x508ca4`), storing
the result at object+8. Only later does `0x49f5c5` call that pointer with
`(-1,44100,0,[ebp+8])`, continuing at `0x49f5c8`. A DLL_PROCESS_ATTACH
nonreturn during LoadLibrary precedes that BASS_Init call on this path.
This establishes a canonical path, not which caller the historical failure used.

BASS's actual raw-backed entry `0x10055043` loads `0x10055000`, executes
16-bit PUSHF, PUSHAD, an indirect allocation call, and pushes preferred base
`0x10000000`. Its PE relocation block contains HIGHLOW at RVAs `0x55044` and
`0x5505e` for those two literals. The entry copies/decompresses blocks using
the descriptor table at RVA `0x55174` (first tuple
`18028,ef9,53000,220e,33e` in hex). At `0x100550aa`, the zero descriptor
branches to `0x10026a72`. **RVA 0x26a72 has no file-backed bytes**: first
section raw ends at RVA `0x18d34`, while virtual end is `0x55000`.
The branch would target `0x9afa72` if BASS owned `0x989000`.
Disassembling raw file bytes as that second-stage continuation would be false.
The packed branch does not itself prove a relocation, flags, callback or
instruction semantic defect; no guest repair is justified.

Current host continuation: `process-boot.js:completeLoadLibrarySteps` maps and
patches dependencies, orders initializers, then yields each entry to
`callDllMain[Async]`. `dllMainSteps` saves the parked caller's EIP/ESP/registers,
pushes `(return=0,hModule,reason=1,lpReserved=0)` for dynamic attach, and runs
the actual initializer. Completion requires EIP zero **and** restored stdcall
ESP with no fault/exit. It captures outcome before restoring caller state.
An unfinished callback is quarantined and throws; only a successful load
publishes its handle and runs `resumeAfterLoadLibraryYield` (which pops a
validated guest return when parked at EIP zero). Therefore the host sentinel
and the EXE's `0x49b2a6` continuation must be distinguished.

Reusable narrow diagnostic: `tools/zuma-initializer-diagnostic.cjs` prints the
static inventory without executing guests. `instrument(source)` returns a
private loader source with three read-only observation calls: parked caller,
entry frame and final outcome **before restoration**. Prepend
`browserObserverSource()` to that private response after production mem-utils
has loaded, in the actual owning Worker. It emits at most three JSON records
for base `0x989000`; a future changed base must be specified explicitly.
Exact anchors reject source drift. No production source is instrumented by
running this tool; it contains no app launcher. A future original still needs
separate authorization and its normal finite runtime lifecycle.

Smallest missing observation: the matching row's path/generation/entry RVA,
actual caller EIP/ESP and return stack, plus initializer final EIP/ESP/EAX,
halt/yield/fault and 128 mapped bytes at final EIP before restoration.
The helper also captures bounded entry/header/pointer bytes for attribution.
This distinguishes wrong module, trap/unsupported instruction, genuine wait,
terminal exit, budget exhaustion and bad return frame without guessing packed
code. If the final bytes show an unresolved indirect target or erased relocation
stream, a subsequent targeted pre-instruction observation may still be needed.
Synthetic tests execute the instrumented **current loader JS** with tiny host
fixtures, compare all outcomes/register writes/run counts against untouched
source for TRUE/FALSE/trap/wait/exit, and cover throwing observers, source drift,
module path/generation, caps, browser snippet and unmapped/wrapping reads.
These validate the diagnostic, not game execution or an emulator fault.

## QueueUserAPC export repaired; initializer still fails, 2026-11-03

Added the missing named KERNEL32 `QueueUserAPC` export at ordinal 595,
targeting existing API 4164 and its real three-argument stdcall handler.
All 471 previous export records and ordinals are unchanged; APC semantics
were not modified. The retained old PE image fails explicit named lookup with
NULL/error 127. The repaired regression resolves name and ordinal, rejects a
wrong-case name, and executes the actual PE E9 trampoline and API dispatch
through the x86 interpreter. It passes three-argument stack cleanup, bad-handle
and null-routine errors, pseudo-handle, target-thread isolation, alertable-only
delivery, parked sleep/wait wake, FIFO and thread-exit drop controls.
The one-instance test preserves the parked target's private sleep state/stack
and clears the sender's inherited yield before executing its real thunk.
Generator freshness, generator regression and the locked full build pass.
An additional existing loader fixture fails on `loadlib_builtin_only` with both
the retained old manifest/image and the repaired image; that fixture failure
is separate from the passing full-interpreter export/APC regression.

The single changed-source ordinary browser startup served default module
`cffc3180dca3b97e8341c3376d3252e841681bc964db81680fb652e8df685a8d`
(2,077,883 bytes). It no longer logs missing QueueUserAPC, but still reports
`DLL initializer did not return: module=0x989000`. The reviewed capture shows
the desktop Read Me window, with no Zuma menu or gameplay. No player input was
delivered. This verifies the export repair; it does not identify the initializer's
underlying cause or qualify current gameplay. Next: diagnose that initializer
and its real caller/continuation separately before another ordinary startup.

Evidence: `scratch/runs/20261103-zuma-queueuserapc-recover/`. Source, fixture and
updated-test transfers were independently size/SHA-256 checked on receipt;
all 602 successful served responses (570 unique files), capture review and
independently checked retrievals are retained there. No guest/API behavior was substituted in the ordinary run.

## DeviceIoControl export repaired; next startup blocker, 2026-11-03

Added the missing named KERNEL32 `DeviceIoControl` export at ordinal 594,
targeting existing API 3634 and its real handler. All 470 previous manifest
records, including their ordinals, are unchanged. The executable negative
control substitutes the retained old generated PE image in the compiler VFS:
explicit `GetProcAddress` fails with NULL/error 127. The repaired image resolves
both name and ordinal, and the regression executes its actual x86 E9 entry and
dispatch thunk through the interpreter. Unsupported controls still return
errors 1/6/50/87 with unchanged buffers/counts and eight-argument stdcall cleanup;
the existing supported QUARTZ allocation/alias/free regression also passes.
The locked full build passes on the owned remote test box.

One changed-source ordinary browser startup served default module
`2514961a7051ba000c6bd107447480ca38443046ed4d0c0bf9644345cccc4d15`
(2,077,794 bytes). It reports missing `QueueUserAPC (KERNEL32.dll)`, then
`DLL initializer did not return: module=0x989000`; it no longer reports missing
DeviceIoControl. The reviewed capture shows the desktop Read Me window, with
no menu or gameplay. No player input was delivered. This establishes the
export repair, not the initializer's underlying cause. Next: separately inspect
the explicit QueueUserAPC export and packed caller; no further source or startup
attempt is part of this repair.

Evidence: `scratch/runs/20261103-kernel32-deviceiocontrol-export-recover/`.
Source and asset transfers were independently size/SHA-256 checked on receipt;
retrieved runtime/test evidence was independently checked against remote hashes.
Actual served file identities are retained in `requests.json`; Zuma.exe and
BASS retain the hashes in the preceding startup evidence below.

## Current-source browser startup failure, 2026-11-03

One ordinary `index.html?app=zuma_deluxe` launch on a fresh boat failed before
the menu. The guest log reports `Unable to load function: DeviceIoControl
(KERNEL32.dll)`, then `DLL initializer did not return: module=0x989000`; the
worker loop stops and the page returns to the desktop. The inspected capture
shows the desktop Read Me window, **not Zuma gameplay**. No player input was
sent because the menu prerequisite never appeared. This is an observed startup
blocker, not a diagnosis of the initializer's underlying cause or an API fix.

Evidence: `scratch/runs/20261103-local-ready-gameplay/`. All 1,734 transferred
current-source/runtime/fixture members matched SHA-256. The genuine vendored
compiler produced the default module on the boat, and the HTTP response log
records that same 2,077,689-byte module as actually served:
`74bae3d235a336bb52e63c42bac1b2210d3ae6473ab5245a69c882b3c9cf2fb4`.
The guest main Worker instantiated 2,259 exports. Actual served Zuma.exe is
1,290,240 bytes, SHA-256
`60bf0df7695914e4f8238b5c99f665b8484d3c0dea9378389f95244c9712446c`;
BASS DLL is 102,196 bytes, SHA-256
`f2f2a653fd360751c71c9f89f74d4d9bb5356eb5471bf9e572794dd565dfb693`.
Served-byte hashes do not establish execution of every companion asset.
The compiler's terminal exit status was not retained; both canonical output
completion messages and the served module identity were retained. No production
source, guest, API behavior or input path was modified.

Zuma remains a local candidate, absent from `DESKTOP_APPS`. Historical Adventure
input evidence below does not qualify this current runtime. Next: trace the
real dynamic kernel32 lookup/export contract for DeviceIoControl and the
initializer failure before another original launch; do not return fake success.
The bounded Alice fallback review found an existing current-main startup stall
requiring a separate diagnostic, so no unchanged fallback launch was attempted.

## Historical gameplay evidence

Historical source last updated, 2026-10-12. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

Registry `zuma_deluxe`, corpus `reflexive-zuma-deluxe`. Existing source/binary investigation is `scratch/zuma-startup-exit-20261003`; historical QueueUserAPC and nested Worker DLL initialization fixes are separate completed tasks, not gameplay proof.

2026-10-04 ordinary default-worker direct route reached **CLICK HERE TO PLAY** with full loading bar on module `f40d4ca3382279ff9b826188573f8acd9272eaa2dc5024dcbb69aecc35b49063` (1,664,777 bytes). Evidence `scratch/new-game-zuma-20261004/attempt1/loading-2.png`; no engine modifications, frozen guest execution, forced callbacks or state writes. A real click in canvas preceded title-ready, but no causal audio-unlock claim is established.

Main owning export snapshot EIP0x46883c; active thread4 metadata EIP0x464ee2 advanced187 slices/9.52s CPU across12.59s wall. Thread5 had exited code0. These are historical state observations, not a deadlock diagnosis: final image subsequently showed complete loading and Play. Actual owning worker exports and bounded stacks saved in `owner-stacks.json`; module map was an object, so first harness snapshot failed iteration and was replaced by read-only CDP capture on the same owned browser.

Attempt1 ended prematurely because a quit was queued before the final image was read. Treat as title-ready, not game failure or gameplay success. Next route: visually gate on CLICK HERE TO PLAY, click around512725 at1024x768, handle visible profile/menu, select ordinary Adventure/Play, then prove frog/ball-chain scene and ordinary aim/fire response. No FPS accepted.

Exact served JS/WASM/EXE/DLL bytes, prelaunch pins, inputs and cleanup are under attempt1. Missing game-local msvcrt.dll is followed by registered shared DLL fallback; icon/build-info/favicon absence does not establish game dependency failure. Browser/server closed cleanly, session1299 exit0.

Attempt2 reached the ordinary New User dialog and then main menu welcoming GAL. At1024x768, title Play was510725; name was typed normally and OK clicked387410. Main-menu Adventure button is near830204. Evidence scratch/runs/20261004-zuma-profile-menu/menu-2.png with518 hashed artifacts. No Adventure click was delivered: the180-second session guard expired during orchestration/context delay, not a diagnosed game fault. Cleanup02:23:33.845Z confirms browser/server closed, session15322 exit2. Next prepared attempt uses coordinator-approved600-second guard with prompt image→input transitions; no gameplay/FPS claim yet.

Attempt3 (2026-10-04) reached player-controlled Adventure Level1-1, Spiral of Doom, on the same f40 module with current post-launch-UX JS. A600-second bound avoided earlier orchestration timeouts; actual closure was02:31:44.693Z, session48557 exit0. Route: visible title Play510725; type GAL/OK387410; Adventure830204; stage Play918727; after level intro, ordinary click510450 preceded active chain. Move/click810400 visibly rotated frog right and emitted blue ball; move/click220400 rotated left and destroyed green matching group (+40), followed by score170 and +130 COMBOx2. Personally reviewed screenshots after-fire-right.png, aim-left.png, after-fire-left.png, gameplay-final.png under scratch/new-game-zuma-20261004/attempt3; root review requested separately. This proves limited ordinary aim/fire gameplay, not sustained correctness, release readiness or FPS.561 successful HTTP responses/502unique saved served files verified by full SHA256/size, no mismatch; source pins, ordinary input timestamps and cleanup preserved. No guest state writes/callback forcing or engine changes.

Root independently accepted the four gameplay images (level-after-click, after-fire-right, after-fire-left, gameplay-final). Immutable accepted run: scratch/runs/20261004-zuma-adventure-gameplay,534 hashed artifacts; exact root receipt root-scene-review.json. NEW-GAME-ZUMA limited gameplay objective complete; no FPS/release claim.
