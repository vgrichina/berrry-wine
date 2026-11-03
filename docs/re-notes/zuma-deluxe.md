# Zuma Deluxe: current ordinary launch

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
