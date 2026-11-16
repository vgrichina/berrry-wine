# Win16 native Quit: terminal far-return ownership

The demonstrated TriPeaks run reported Exit0 and then genuinely failed with
host status 1. This change fixes the general callback lifecycle defect; it
does not reinterpret that closed predecessor as success. No fresh original
run, game inputs, screenshots, boxes, or gameplay claim were made.

Evidence and recovery: `scratch/runs/20261115-win16-native-quit-exit/result.json`,
`recovery.json`, compiler scripts, exact source/module/media pins, and Git
binary patches. The run contains no source-tree, media, or WASM bundles.

## Exact compiler attribution

The predecessor's canonical module is SHA-256
`f866c8a9247f51fabd296b012d5b963c51afb97fc29f786b22798c39d4e2cff0`,
2,202,536 bytes. Recompiling the expanded compiler input reproduced it byte
for byte. The separately named diagnostic is SHA-256
`1eda44663db6d00a617095ff0f80e9a5d6d7e5c843cc5bedd906b25f83e9e07d`,
2,569,832 bytes; removing its name section reproduces the canonical bytes.
There are 294 imported and 15,906 defined functions.

| Canonical frame | Expanded compiler function | Body-relative offset |
| --- | --- | ---: |
| 1254 at 0x3a6a9 | decode_block | 269 |
| 1256 at 0x3dae4 | decode_run | 5 |
| 14048 at 0x1e5dd6 | run | 1346 |
| 15147 at 0x1ebadd | protected exported run wrapper | 3 |

The raw combined-source index's x87 attribution is invalid for this expanded
compiler output. Marker `CA002E20` identifies the decoder failure path.
The original log, result, and closed runtime receipt are pinned separately.

## Which continuation resumed

The regression compiles actual 16-bit instructions. An outer WM_COMMAND
callback calls USER.SendMessage into an inner callback, which calls KERNEL.102
DOS3Call with AH=4Ch. Memory markers independently identify entry and
post-service execution in both callbacks. Zero bytes after the forbidden
post-exit continuation produce an actual decoder trap if execution resumes.

Before the fix, both actual `createGuestMainOwner` routes (local and
GuestThreadHost Worker) report Exit0, execute the **inner callback's instruction
after DOS3Call**, then trap in decode_block/decode_run/run. Both test processes
actually exit 1. The outer sender never resumes. This reproduces the original
failure family without editing its executable, clock, or action history.

DOS3Call calls `win16_dos_int21`, then calls `win16_api_return`. Root AH4Ch
previously set EIP and steps to zero without marking the existing terminal
yield reason. `win16_api_return` then popped the far return and overwrote EIP
with the terminated callback's continuation. The PE-to-NE invocation bridge
is not this root Win16 owner: its frame acquisition rejects `is_win16`.
No host catch or owner-level success conversion is justified.

## Fix and controls

Root AH4Ch and Toolhelp TerminateApp now mark existing terminal yield reason
2. The shared `win16_api_return` declines to pop/restore a terminal invocation.
Ordinary nested far returns retain their existing path. The change adds no
app whitelist, sentinel guess, exception suppression, or forced success.

All twelve actual compiled cases pass after the fix: ordinary nested return,
genuine unsupported-API trap, process exit 0, process exit 37, child-task exit
37, and TerminateApp status 1, through both local and Worker owners. Ordinary
returns restore the exact original ESP and execute both return markers.
Termination executes neither return marker and leaves EIP zero/yield 2.
Child exit calls only exit_thread and releases its module name, start slot,
references, and image metadata. Genuine traps report no exit and remain traps.
The child fixture installs real task bookkeeping but does not launch a second
WinExec process; its assertion scope is the native task-exit branch.

The complete committed HEAD source closure was independently compiled before
and after the edits. Its local and Worker runs loaded committed host libraries
(including inside Workers), reproduced the failing control, and passed all
twelve corrected cases. Shared-tree source compilation and the complete locked
build also pass. Existing main-owner tests, all 29 startup cleanup cases,
actual native Win16 modal destruction/reentrant callbacks/handle reuse/stack
restoration, and NE invocation driver controls pass. Module hashes distinguish
HEAD-only, shared-tree, and test-export fixtures.

## Shared-tree publication

Foreign NE/COMCTL source changes were not adopted or published. After the
coordinator clarified the complete publication closure, their exact source and
census deltas were retained as Git binary patches and blobs. Whole owned files
were committed as HEAD plus this independent fix and its three census rows;
foreign deltas were then restored exactly and the shared build and focused
controls rerun. No partial index, selective-hunk publication, reset, stash,
checkout, or source-tree copy was used. Recovery and foreign preservation
verification are recorded in the result.

The optional fresh TriPeaks native UI Quit retest was not used. The regression
establishes the repaired lifecycle, not a new original-game exit or gameplay
outcome. The next original retest must follow the bounded fresh UI policy in
the dispatch; the closed predecessor must remain closed.
