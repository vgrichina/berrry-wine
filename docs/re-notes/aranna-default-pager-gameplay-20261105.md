# Aranna default pager: rendered menu, unresolved activation and commit refusal

Task `NEW-GAME-ARANNA-DEMO-20261010`; worker `aranna-default-pager2220`.
Evidence: `scratch/runs/20261105-aranna-default-pager-gameplay/` (ignored).

The sole repaired original passed the normal EULA, rendered an opening
cinematic, and reached the Main Menu after ordinary Escape. Single Player
clicks, a held click, Enter, and held Enter did not reach character setup or
ordinary gameplay. The menu continued rendering. Later console output records
an explicit heap boundary: a 1 MiB sparse reservation could not be committed,
followed by smaller heap requests returning failure. No additional original
was launched. FPS and audio are unknown; two gameplay responses were not reached.

Generated real PE controls prove the published `2915073f6` default MEM_RESERVE
repair still enters guest SEH, commits the reserved page, performs a real
nested ReadFile, restores the interrupted CPU, and resumes reading the filled
value in both production owning-Worker module variants. The original's passive
trace exhausted its 4,096-record cap during earlier unrelated checksum calls.
Consequently this run **does not directly prove the original's pager entry,
commit/read/resume, or resumed Logic.dsres validator**. Menu progress is a
separate observed outcome, not a substitute for those missing observations.
There is no demonstrated new emulator defect and no speculative source repair.

## Gate and source identity

SOURCEONLY ended after the exact FINAL releases, in order:
Conan world writer at 22:51:21.579564Z, D3D worker reset at
22:59:46.472632Z, and AoW2 black ground at 23:13:08Z. Independent cleanup
verified 996 absent PIDs, 237 refused ports, 86 absent profiles, four free
locks, no heavy runtime, and sufficient disk. The immutable execution window
began **2026-11-05 23:14:00.327444Z**, deadline **23:59:00.327444Z**.
`release-gate.json` and `runtime-bound.json` retain the checks and times.

Runtime Git SHA: **`ed024097db9e3d51eb04dff64d32d3563b0b45dc`**, including
ancestor `2915073f6`. `runtime-source.json`, `validation-source.json`, and
`before-original.json` identify the relevant files. Their `.binarydiff` files
and relevant untracked-file patches preserve non-Git hunks; owned helpers are
retained as new-file patches. The 319 tracked relevant source hashes stayed
unchanged through controls, required full build, and original launch. No shared
CPU/Win32/memory, renderer, launch mapping, or test source was edited by this
worker. The only committed change is this findings note.

The original's actual browser-owned module was **2,176,244 bytes**, SHA-256
**`681c4d52e019edce8fbcee1413e07637cd855baf8b69e168a2ff6b5c0535dc27`**.
`browser-modules.json`, the uniquely named retained module, worker-start
records in `observations.jsonl`, and `served-responses.jsonl` identify what
actually ran. This diagnostic module differs from the canonical build only by
the retained passive compiler transform; it contains no fixture export.
`launch.json` also records a canonical build hash: that field alone is not the
identity of the overridden diagnostic module used by the owning Worker.

All 28 canonical media inputs were hashed in place under
`scratch/game-media/aranna-demo-20261105/extracted/`; see
`media-verification.json`. The existing normal original-local app mapping was
referenced in place. No download, extraction, media copy, source archive,
subworker, box, public deployment, or unrelated game was used.

## Validation before the original

`browser-controls.json` and `browser-controls.log` pass the generated real PE,
normal DLL initialization, actual owning-Worker controls for standard and
compat modules. API return values, last error, ABI/nonvolatile registers,
ordinary/chained consumers, and lazy flags agree with the baseline.

`pager-controls/results.json` and `pager-controls.log` pass all 16 combinations
of standard/compat, baseline/passive, already committed/reserved, and eager/
provider-backed lazy file access. The ordinary generated EXE installs FS:[0],
reserves 113,820 bytes, and reads it. Its own handler commits a page and uses
ReadFile to fill four bytes. Reserved cases call the handler once, return
BOOL=1/count=4 from ReadFile, resume with `0x12345678`, and restore all copied
registers. Committed cases do not invoke the handler. Copied default mode is
zero; no fault-mode setter is used. Passive fault events are `[5,6,7,8]` for
eager data and `[5,6,9,7,8]` for synchronous provider fill. Both owning-Worker
module identities and normal DLL DllMain EAX=1 are asserted.

`flock /tmp/wine-build.lock bash tools/build.sh` passed; see `build.log`.
Canonical output sizes were 2,175,008 standard and 2,177,654 compat bytes.
Integration runs were serialized; the full build completed before the sole
original. An initial shell wrapper failed after six module compiles, before
controls: editing its own ownership label while bash was reading it disturbed
parsing. `validation-wrapper-failure.json` and `validation.log` retain this
operator error. The continuation separately completed both control suites and
the locked build successfully; no original was consumed by that correction.

## The one original and reviewed ordinary input

The session launched at **23:17:01.672Z**, using the production owning Workers,
normal mss32 initialization, EULA, threads/WebGL, existing eager-file setup,
and Puppeteer `defaultViewport:null`. `startup.png` was reviewed before the
ordinary EULA Accept click. `after-accept.png` showed the ordinary loading
window; `loading-30s.png` showed the rendered opening cinematic. Ordinary
Escape produced the Main Menu in `after-escape.png`, with version 1.50 and
Single Player, Multiplayer, Options, Continue, About and Exit controls.

Fresh captures were reviewed before further input. The Single Player click,
Enter, a trusted mouse click held 1,000 ms through the existing Chrome, and
Enter held 750 ms left the main menu displayed. Commands, completed command
records, `ordinary-inputs.jsonl`, captures and corresponding `.state.json`
files retain the exact sequence. No character setup, accepted Single Player
transition, or player movement was observed. Logged WM_LBUTTONDOWN/UP events
name the main window; keyboard messages name hwnd=0. A later copied host mouse
position was centered. Those observations do not establish a causal input bug.

Read-only completed renderer snapshots at 23:22:30.071Z and 23:22:32.479Z
show root owning endpoint 1, legacy WebGL, slice sequence 26093 → 26178,
completed fence 27367 → 27765, draws 127435 → 129465 and publications
1934 → 1963. Errors, fallbacks, and software completed draw counters were zero
at those landmarks. `renderer-progress.json` retains the full snapshots.
These counters prove menu rendering progress, not gameplay or measured FPS;
child renderer ownership is not attested by this capture tool.

The final `menu-oom-boundary.png` and `terminal.png` were personally reviewed:
main menu controls remain rendered, without the earlier Logic.dsres error17
dialog. Earlier review wording about a degrading background was too strong;
`reviewed-terminal-correction.json` records that differing background imagery
has no controlled visual oracle or proven causal link to allocation failure.
The ordinary quit completed; Chrome exited 0 at **23:24:40.336Z** and the
probe exited 0 at **23:24:40.409Z**. Owned local runtime was closed and cleaned;
`final-cleanup.json` records independent process/port/profile/lock checks.
No boxes were assigned: box ID/state/expiry are N/A.

## Exact remaining boundaries and diagnostic repair

The first unresolved ordinary transition is activation of Single Player from
the main menu. Later, **console.log line 127** is the first explicit memory
refusal: `1048576 bytes (0x100000)` with reason 3, sparse reserved range could
not be committed. It is followed by reason 1 for a 34,408-byte allocation and
similar requests. There are **2,538 heap refusal lines** by clean closure.
`remaining-boundary.json` records the first line, sizes and limitations. Raw
console lines have no timestamps, so the exact first refusal time is unknown;
the host UI log does not contain these messages and cannot timestamp them.

Source inspection places reason 3 in `$heap_sparse_alloc` in
`src/10-helpers.wat`: reservation succeeded, `$virtual_map_commit` failed,
and reclaim/retry either found no releasable arena or also failed before the
reservation was released and NULL returned. `$virtual_map_commit_locked` has
multiple refusal causes, including lease exclusion, map-record capacity,
backing placement, and PTE publication. No live map/backing/lease census was
retained. **This evidence does not distinguish exhaustion, fragmentation,
metadata limits or a bookkeeping defect, and does not establish that heap
failure caused the earlier activation failure.** No memory option was changed.

The original retained exactly 4,096 snapshots: 3,093 event3 entries and
335/334/334 API entry/handler/return records, all root endpoint 1. No fault
events 5–9 or Logic.dsres owning ReadFile return survived. The shared CRC
entry `0x41b19c` was observed for unrelated earlier callers, consuming the
cap before the intended resource consumer. Missing events cannot be read as
absence of guest paging or absence of a subsequent error.

After closing the original, run-owned `narrow-passive-transform.cjs` filters
that shared CRC entry by the copied stack return **`0x655594`**, retaining the
existing resource-consumer range and nonfaulting scalar reader. It does not
change shared source or the original module. Generated ordinary PE controls
place the intended caller before 4,200 unrelated calls, then execute the same
real reserved-page pager. The old observer fails the precise caller filter
assertion (**257 CRC snapshots versus 1 expected**); the narrower observer
passes standard/compat × eager/lazy, retains the correct target return, and
preserves identical guest completion, handler count, fault address, filled
value, ReadFile BOOL/count and provider-read results. See `stress-before.log`,
`stress-after.log`, and `observer-filter-comparison.json`.

The calibration also establishes a coverage limit: only 256 of the 4,200
unrelated calls traverse this passive entry hook once code becomes hot.
The generated test validates filtering and pager neutrality, **not full-cap
exhaustion or complete hot compiled-block coverage**. The original's cap
exhaustion is established by its own trace. This tested helper is available
for a separately authorized materially changed investigation; it was not
used to launch a second original.

Next work should discriminate actual sparse commit refusal causes and the
ordinary menu-input transition using bounded owning-CPU evidence with separate
budgets for pager, target validator and allocation-failure observations.
Require a failing generated regression before any CPU/Win32/memory repair.
Do not repeat this unchanged original or claim original paging/gameplay from
the generated controls.
