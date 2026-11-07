# Aranna selected-map loader investigation

## 04:33 successor: filename case repair published

Commit `64823a6ad8bc73ada23f39a1f61573172d10837c` fixes a demonstrated
`GetFullPathNameA/W` defect: display paths lowercased caller-supplied filenames.
Lookup keys remain case-insensitive. Both API variants now retain the filename
spelling, including nonexistent files, dot traversal and drive-relative paths.
The focused regression failed before the repair and passes afterward; all 46
VFS tests and the mandatory locked build passed. Evidence for this successor is
under `scratch/runs/20261107-aranna-map-load/successor-0433/`; the earlier
01:39 attempt below and its evidence are retained.

The acquisition-before-arm predecessor's ordered observations establish a more
precise failure than its dialog alone:

- At `0x4bb378`, the main map loader returned AL=1.
- The separate validator at `0x51f06a` obtained header pointer `0x0b6ef180`.
  The next retained snapshot of that header contains all three expected words
  at offsets `0x3c`, `0x50` and `0x54`.
- After calling `0x40dcd0` (a case-sensitive substring search) for
  `Expansion.dsmap`, execution skips the three header comparisons. The
  validator returns AL=0 at `0x4bb387`, leading to the selected-map dialog.
- Static data flow explains the discrepancy: resource open `0x655458` calls
  `0x434c1d`, whose import at IAT `0x72925c` is `GetFullPathNameA`. Its returned
  full path is stored at resource `+0x364`, precisely the name selected by
  `0x51efad` for that substring search. The previous implementation converts
  `C:\DSLOA\Expansion.dsmap` into `C:\dsloa\expansion.dsmap`.

This identifies a concrete emulator discrepancy on the executed path. The
filename bytes at the final substring call were not directly captured; that
link follows the static data flow and demonstrated API behavior. It does not
establish that this is the only gameplay blocker. Microsoft documents that
[GetFullPathName does not convert the specified filename](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfullpathnamea).
No guest, map, resource, save or configuration bytes were changed. There were
zero read mismatches in all 28,643 retained broker completions; the earlier
optional startup misses are not assigned as the map cause.

The fresh-box attempt stopped **before guest launch**. Box `bx_dbhdzfqg` was
created at 04:38:49Z with a persisted UUID Idempotency-Key and 40-minute TTL
(original expiry 05:18:49Z). Its prerequisite check verified all 1,906 staged
file size/SHA-256 pins, then failed at `require.resolve('puppeteer')` with
`MODULE_NOT_FOUND`. No original-attempt marker, browser, guest process, profile
or app port was created. No install/retry, alternative driver, original replay
or old-box resume followed that concrete blocker. Therefore the repair's effect
on the original map load, world rendering and visible movement remains
**unverified**. Next work must prepare the missing browser-driver dependency
before a separately authorized original on the published repair.

The exact preflight failure and remote cleanup were recovered before the
explicitly delegated normal shutdown request at 04:40:20Z. Remote cleanup
rechecked all pins and found no owned processes or profiles; listed listeners
belonged to the base box. No local runtime was launched. Source/build ownership
was released after publication. Final box state and local cleanup are retained
in this successor's result and lifecycle JSON. No source/media archive,
deployment, nested worker or agent was created. The observations and generic
repair tests do not constitute a new original-gameplay pass.

## Earlier 01:39 attempt (retained)

Evidence lives in `scratch/runs/20261107-aranna-map-load/`. This follows
[the complete-transport predecessor](aranna-transport-window-20261107.md).
The one new original ended at Single Player before Start New Game: an unnecessary
canvas-acquisition command while pointer lock remained active was rejected by
the input guard. This was the worker's input-selection error. No map-load cause,
production repair, loaded world or player movement is established.

## Original result and exact blocker

The original ran from 2026-11-07T01:39:02Z to 01:44:31.201Z, within its 40-minute
limit. I personally reviewed EULA, intro, Main Menu and Single Player. A fresh
native proof and complete ordinary balanced click selected Single Player at
native (399,155). The final reviewed scene is `original/response-12.png`.

At **01:44:30.592Z**, command 13 requested `canvasclick:0.5,0.5` although its
reviewed ticket already said `mode=relative`, `lock=screen`. The unchanged
`input-adapter.cjs:61` requires a canvas click to be an initial browser click or
lock acquisition. It asserted **“explicit reviewed browser click only”** before
any mouse operation. `original/action-13.json` records `rejected-terminal`,
`effectsAttempted=0`, and no button receipt. This was a terminal assertion, not
the recoverable stale-input refusal path. No new ID, replay, resumed original
or second attempt followed. The driver exited 1; its browser exited normally 0.

The final file-observer coverage was 26,692 broker records, zero drops, zero
copied-byte mismatches and no observer error. There were two earlier actual
failed opens: `C:\DungeonSiege.ini` and `c:\dir.lqd20`, each OPEN_EXISTING,
ERROR_FILE_NOT_FOUND (2), INVALID_HANDLE_VALUE. They preceded successful entry
to the menus; neither is established as the cause of the predecessor's later
map failure. No map-loader decision or post-entry memory-API record occurred
because this original never reached that code (`original-analysis.json`).
Native journal maximum count was 1,175, below 8,192; malformed records were
absent. All 235 native transactions were complete (`original-packets.json`).
Resource-journal saturation did not occur.

This task's concrete blocker is the terminal input-guard refusal above. The
requested first failing map-load API remains **unidentified**, rather than
being inferred from a dialog. No failing-before emulator regression or emulator
repair is claimed. A future authorized original would need to follow the
already-active relative route with measured movement rather than reacquiring
the canvas. The current attempt is terminal and must not be resumed.

All recorded local process trees, HTTP/debug ports and temporary Chrome profiles
were independently verified absent in `final-cleanup.json`. The runtime holder
was released, its PID verified absent, and all four runtime/browser/heavy/build
locks verified free in `runtime-release.json`. Runtime/source/build ownership
was explicitly released on the messageboard. No boat, deployment, guest/media
patch, automated risk flag, FPS/audio claim or backend parity claim occurred.

The predecessor selected ordinary Normal and returned to Choose Hero with
“The selected map could not be loaded.” Its journal contains no file completion
or allocation-result observations at that failure. There is no post-Normal
HTTP failure or heap-OOM notification. Those absences do not prove successful
file access or allocation. The input coverage was complete; this investigation
does not reopen the resolved journal-saturation work.

Offline disassembly locates two callers of the error string at 0x77d6f0.
The 0x482155 call to 0x5babc9 tests AL at 0x48215a. The other caller tests
0x5babc9 at 0x4bb378 and subsequently tests 0x51f06a at 0x4bb387. Function
0x51f06a checks a registry entry for Expansion.dsmap and three header words:
offset 0x3c = 0x47504721, 0x50 = 0x8e8d717a, 0x54 = 0x81665c2e.
The canonical map matches. This rules out a mismatch in those canonical bytes,
but does not establish which branch ran or what the guest actually read.

The filesystem implementation is `lib/filesystem.js`; the suggested
`lib/host-files.js` does not exist. ReadFile count/error behavior, signed
SetFilePointer handling and WAT VirtualAlloc were compared with the
[ReadFile](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-readfile),
[SetFilePointer](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-setfilepointer)
and [VirtualAlloc](https://learn.microsoft.com/en-us/windows/win32/api/memoryapi/nf-memoryapi-virtualalloc)
contracts. A possible semantic difference without a demonstrated failing call
is insufficient grounds for changing the emulator.

Run-local passive WAT diagnostics add bounded map-decision snapshots and
selected file/memory API results. A host observer copies actual ordered broker
open/read/seek completions, comparing returned resource bytes with their VFS
source without changing return values, exceptions, position or guest bytes.
Production Worker URLs and broker ownership are preserved.

Changed controls passed:

- Both modules, baseline/disabled/armed, ordinary and actual Worker execution:
  CPU/flags/FPU, guest memory and API results match, including generated map
  decision and real allocation observations (`controls/qualification.json`).
- Both modules, production Worker and DLL broker: reads across pages, signed
  seeks, short EOF, error 5, immutable data and observation-only mismatch
  detection (`broker-controls/browser-controls.json`).
- Both full-shell ordinary native routes activate TARGET A with DOWN=UP=2,
  complete native/transport packets and mutated owner/module/point/protocol/
  quota refusal checks (`route-qualification.json`). Some intermediate GDI
  captures are black. Premature descriptive review labels are corrected in
  subsequent review records; the final activation captures were personally
  reviewed and visibly show ACTIVATED TARGET A.

Observer module SHA-256:

| Module | SHA-256 |
| --- | --- |
| standard | `51a367dd9d6d7f06ecd27f08abd948b85cd83dd12fdf69172044232cbc56d930` |
| compat | `ab2de6f62a52adc381732537447435c32ed5264dd40c7eb3fdc0104312ca3ea2` |

Canonical extracted-media identity is preserved, not native-install provenance.
The unchanged before-load mounting is inherited from the original-local run.
No executable, resource, save or configuration is modified to force progress.
The 28 referenced media hashes are verified in `retained-audit.json`:

| File | SHA-256 |
| --- | --- |
| dsloademo.exe | `e3923f18d3ec9bf52ffe556821dbaa2078e985087c7bf4b171a36b9883b851cf` |
| DSLOA.exe | `fced0961231248c09c10d86ff51935569db5f83ed3b2ba2739f0501dbc318589` |
| Expansion.dsmap | `c397bede7fc61ad8650bc835caa6a3fdadd3a3d1c8e3199bc8b1772c2db6dcdc` |
| Expansion.dsres | `3ed0688349f33b2dd7b9458c18cfbbc00490353c5888a93cd02c10da7f3c3b10` |
| Logic.dsres | `90b26f179364a4d25f7053e8aa41932d51fcd0e563e37820894c3dbfdcf9d0e5` |

Git SHA plus relevant dirty binary diffs and owned new helper patches are the
source archive (`source-identity.json`, plus `source-untracked.json` and its
patches for relevant untracked runtime sources); no source-tree or media archive
is made.
The current production modules include the independently published Lords2 PIT
repair. The original served commit was
`cd916e6ef1840055bd97f18f728d7f993fe31515`; every pre-original source/helper pin
remained identical at the post-original check, with only the new offline analysis
helper added. `original-http-identity.json` verifies the served source/media,
and `source-post-original.json` records the comparison. No production code
changed, so this documentation-only closeout does not claim a new locked build.
