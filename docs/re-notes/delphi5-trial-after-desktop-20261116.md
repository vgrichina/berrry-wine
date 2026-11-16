# Delphi 5 after the desktop repair: native qualification refused

2026-11-16. **No new original installer was launched.** The required native
qualification failed its fixed 3000 ms aggregate guard, so installation,
credentials, IDE execution, samples and original native Quit remain unproved.
The previous original endpoint was never contacted, rebound or replayed.

Evidence: `scratch/runs/20261116-delphi5-trial-after-desktop-repair/result.json`.
This report records a controller/host qualification blocker, not a Delphi API
failure or installation result.

## Exact inputs and successful checks

The final preparation used published Git
`6f6289091fdfeab5de8868b9d2d60506386a6af1`, including desktop repair
`c8f308b84d73a62a5aaf9e8c8cf908fb766b8346`. Its runtime JS came from that
Git tree, with the owned test helper overlay recorded as a binary patch.
Foreign working-tree changes were excluded. An earlier board entry naming
`915b0036d` applies to earlier preparations; the final source manifest is
explicitly pinned to `6f6289091`.

The vendored compiler compiled the Git source closure directly into an owned
memory descriptor, using canonical tail calls and the region-layout stamp.
Module SHA-256 was
`61a7d750c83c62ecbbe6e2388136d6a34d152f5782cb58b0338aea2a8528cc2b`
(2,277,621 bytes). Runtime sources and the module were sealed and held by this
worker's supervisor. There was no source archive, WASM dump, borrowed holder,
shared build-output mutation or box. Git, the source hashes and owned patch
provide recovery.

The untouched ISO's 81,330,176 bytes and SHA-256
`bcd14e38635f4b3b4c7656f1ce884c26ba60224d7876681a7e3b7382e5c38b0e`
were verified, and hashes of its 38 extracted files were recorded. No payload
was substituted, cabinet entry launched separately, key invented, provider
faked, trial clock changed or guest state modified. No new guest VFS or
registry was created because the original launch gate never opened.

The real Node Worker baseline returned the preceding reply with the old
receive implementation. The published repair passed all three focused tests,
including repeated unready notifications under the unchanged deadline.
The existing real desktop regression passed its socket, lost-reply,
authority-death and terminal no-retry cases. Native scene unit guards also
passed. These checks do not establish that the complete controller qualified.

## First final budget refusal

The generated PE fixture used ordinary native USER dialogs, with two distinct
modal generations. Its automated reviews explicitly made no personal original
review claim. The final measurements were:

| Intent | Confirmation | Physical UP ACK |
| --- | ---: | ---: |
| First dialog OK | 103 ms | 201 ms |
| Final dialog OK / Quit | 115 ms | 210 ms |

The generated process exited 0 and was actually waited. The controller
recorded that wait at 2501 ms without a post-exit endpoint request. After
publishing its observation record, its aggregate completion assertion failed;
its permanent UNKNOWN record was written at 3069 ms. The interval includes
local evidence publication/fsync and scheduling; their individual causal
contributions were not measured. This is not evidence that native Quit took
3069 ms, nor that the desktop repair failed.

The fixed 500/1750/3000 ms limits were retained. No new endpoint or original
was launched after this refusal. The final focus-fault fixture was NOT_RUN
because the positive path failed first. A previous preparation passed the
positive path but failed to supply the required PNG hash to its focus-fault
bind; that is not a passing fault test.

Only these final fixture screenshots were personally inspected:

- `native-qualification/positive/scene0.png`: the generated InstallShield-titled
  dialog, explanatory fixture text and OK button on the teal desktop.
- `native-qualification/positive/scene1.png`: a blank teal canvas despite a
  modal record in the snapshot. It does not prove a visibly rendered second
  dialog. There are **no original-installer screenshots**.

## Preparations, waits and release

Six earlier preparation directories retain failures rather than rewriting
them into success. They include a killed oversized source-view regression,
a missing observation directory, post-exit observation attempted before the
fixture parent could process its exit event, and a schedule-file read/write
race. The prepared helpers now use atomic record publication and asynchronous
fixture-parent waits, but remain unqualified WIP and are not committed here.

The first detached preparation supervisor has no recovered parent wait:
its outcome remains UNKNOWN. Its logs are regular files, not pipe EOF proof.
Later invoking tools reported exit 1 separately from the recorded native and
watchdog pipe waits. Final native PID 3406135 and watchdog PID 3406128 both
have actual exit-0 waits and both pipe EOFs; final qualification child exit 1
and its supervisor's tool exit 1 remain distinct.

There is also a historical protocol defect in preparation v4: after its
helper marked UNKNOWN on the schedule-file failure, the fixture parent sent
its generic teardown `quit` request. That preparation is unqualified and its
terminal zero-later-request claim must not be generalized. In the final
preparation the native process had already exited before UNKNOWN, so no
teardown request followed. No original endpoint was involved in any of these
preparations.

All recorded task runtime PIDs are absent, ports 45761/45762/45861/45862 have no
listeners, and process exit closed the owned descriptors. Box ID/state/expiry
and stop receipt are inapplicable: no box was created. No shared build window
was taken. The helper build request was withdrawn when qualification failed;
only this report is committed, so no code-build success is claimed.

Next work must qualify the controller's complete fixed-budget path, actual
fault rejection and visibly rendered fixture scenes before a separately
assigned original installation. It must also fix the fixture teardown's
historical post-UNKNOWN request path. The known HEAP_SHARED/global-sync
contract remains unchanged and must not be bypassed in any original run.
