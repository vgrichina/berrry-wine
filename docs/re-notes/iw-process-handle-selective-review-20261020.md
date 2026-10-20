# IW process-handle selective review — 2026-10-20

**Disposition: aliases still absent; send transport already integrated. Do not
apply either historical commit wholesale. The retained alias implementation
has a sound E6 object/handle separation for the tested subset, but is not
accepted as a complete process-handle implementation.** No production change
or main integration is made by this review.

Task: `IW-DUPLICATE-PROCESS-HANDLE-20261011`. Reviewed main is
`2c58e9dc5d42ecc170b7c86c5b9011a1b265b62b`; alias candidate is
`eeef32f9091b1bff7ad64d163f09a8822c0914bd`; send candidate is
`db7a1a57e`. Both historical commits exist, and neither is an ancestor of
reviewed main. That ancestry fact does **not** mean their changes are absent.
In particular, the `db7a1a57e` host snapshot itself has no `_processAliases`,
`_processObject` or `_duplicateProcessHandle`: it is not the alias candidate
plus a later send patch.

Publication reconciliation: remote main advanced during this review to
`a54049d11955307d06309e146e85c1aca3196657` (verified by `ls-remote`).
The entire intervening diff contains only `tools/toyvm/arm-bench.js`,
`tools/toyvm/arm-bench.test.js` and its checkpoint review document. Every
process-handle/send path reviewed here is unchanged; the findings apply to
that main as well. The task branch remains based on the admitted2c58 snapshot.

All line numbers below identify the named immutable snapshot, not shared WIP.
The companion [source/API checks](iw-process-handle-selective-review-20261020.js)
read those Git blobs and emit SHA-256 seals. Run from a repository containing
the objects:

```sh
node docs/re-notes/iw-process-handle-selective-review-20261020.js
```

## What is actually on main

| Area | Evidence and result |
| --- | --- |
| Alias allocation and ownership | **Absent.** `host.js` has none of the three symbols above. At 2357 it still allocates child IDs from `_children.size`, and at 2400 its `process_ctl` only implements child exit-code/terminate operations 0/1. There is no E6 table, op3 duplication, ops4–8 query/rights/terminate/close/wait, stable object, restart identity, or alias teardown. |
| DuplicateHandle API | **Absent.** `src/09a7d-handlers-shell-file.wat:251` has no E6/process branch. Its fallback copies `arg1` when `host_fs_duplicate_handle` returns zero. `lib/filesystem.js:616` returns zero for an unknown non-file-namespace value, including pseudo-process `0xffffffff`. Thus a nonnull output can still receive the contextual pseudo handle with success; no target ownership is established. This is source-path proof, not renewed guest execution. |
| Alias close/terminate/query | **Absent.** No E6 cases in `src/09a0-handlers-base.wat` (`CloseHandle:4444`, `TerminateProcess:6424`) or `src/09a0b-handlers-base-late.wat:939` (`GetExitCodeProcess`). |
| Alias waits | **Absent.** `lib/thread-manager.js` has no E6 branch; E4 single wait at 1517 still infers lifetime from exit code 259. |
| Unsupported-host response | **Absent.** `lib/host-imports.js:3063` returns -1 for all process_ctl operations; `test/run.js:4031` has only child operations 0/1. The alias candidate's explicit op3 ERROR_NOT_SUPPORTED (50) is not present. |
| Alias regression | **Absent.** Main `test/test-child-process-object.js` remains the `fe279617e` child-object test; it has no DuplicateHandle export, target-owned alias, two-process alias lifetime, or alias RPC tests. |
| Worker send transport | **Present through selective integration `8cad41987`**, an ancestor of main. `host.js:4778` installs endpoint resolution/dispatch, process send resolver, per-link wait ownership; stop at 4844 retires endpoints; the Worker loop notifies readiness. `index.html:2149` includes the broker. |
| Foreign HWND and WAT send | **Present.** `lib/host-window.js:509` reports broker support. The foreign scalar-message block at `src/09a5-handlers-window.wat:4031` is byte-identical to the block added by `db7a1a57e`, including error50 for unsupported routes and yield10 synchronous state. |
| Broker, driver and tests | **Present and subsequently evolved.** `lib/process-send-broker.js` implements per-link waits/retirement; `lib/guest-thread-host.js:1087` resolves sends with owned wait tokens and rethrows unexpected failures at 1128. Main includes `test/test-process-send-runtime.js`, broker/admission and ownership regressions. It does not merely contain the original process-wide serialization/failure-to-zero code. |

The source integration is documented in `docs/iw-main-integration-20261015.md`
and `docs/iw-current-lifecycle-port-20261015.md`.
`docs/iw-combined-native-result-20261015.md` records a later full-build module
`04ede400070b3acbdcc2ad5f3c033bcf051e3d2da9a4d28a449324d23ab0ba17`
and eight historical native arms, with the initial fixture failure preserved.
Those records are historical conformance evidence, not tests rerun here.
General send-cycle redesign, ShellExecute reconciliation and native/runtime
requalification are outside this task.

The TODO's older statement that both commits were absent from main0304 must
not be carried forward as a current source verdict. Its current active-review
status is appropriate; its completion criterion is not established on main.
Likewise, older “not loaded or wired” and “held” paragraphs in the game notes
describe their dated snapshots.

## Retained alias correctness and defects

The following applies to `eeef32f90`, not main.

**Correct bounded E6 behavior.** `host.js:4684` resolves a handle in its
owner's table. `_duplicateProcessHandle:4698` resolves source and destination
process handles in the caller, then the source handle in the source host;
allocation goes into the destination map. Equal numeric handles in different
tables need not identify the same object. The alias entry holds object, access
and inherit flag; it does not copy the contextual pseudo handle.
`process_ctl:2324` separates exit code from signaled state. Closing one E6 entry
does not terminate the process or invalidate other entries. The lifetime
prefix at 4735 sets `exited`, preserves all 32 exit-code bits, clears the
departing owner's handles and releases the object's host reference. Restart
at 2782 creates a new object, leaving retained aliases on the old exited one.
Monotonic E6 allocation avoids stale-handle reuse and fails at exhaustion.
The finally block closes E6 sources on duplication failure.

The API plumbing is explicit: E6 CloseHandle/TerminateProcess at
`src/09a0-handlers-base.wat:4270/6219`; query rights and result storage at
`src/09a0b-handlers-base-late.wat:792`; DuplicateHandle at
`src/09a7d-handlers-shell-file.wat:251`; E6 single/multiple wait handling at
`lib/thread-manager.js:1454/1666/1684`. Multiple waits validate invalid aliases
before consuming another ready object. These WAT and multiple-wait paths were
read, not executed by this review.

**D1 — NULL output and close-only calls are rejected incorrectly.**
The host requires `frame[16] != 0` and returns -87 without allocation.
With a NULL target and CLOSE_SOURCE, it deletes the E6 source in finally but
returns -6. The WAT wrapper translates that into FALSE/error6. Microsoft's
[DuplicateHandle contract](https://learn.microsoft.com/en-us/windows/win32/api/handleapi/nf-handleapi-duplicatehandle)
permits NULL output with duplication and documents NULL target for close-only
use. These are supported API shapes, not invalid handles. The executable
characterizations reproduce both mismatches. Any correction must also avoid
the wrapper's unconditional output store for those cases.

**D2 — legacy E4 close lifetime is not reconciled with E6.**
E4 child records can be duplicated through `_processHandleEntry`, but ordinary
CloseHandle only intercepts E6. E4 falls through the existing pipe/token/etc.
checks to the filesystem; `lib/filesystem.js`'s `closeHandle` returns true for
unknown non-file handles. It cannot remove `_children`. The extracted
filesystem method reports success twice for the same E4 value. Therefore
ordinary E4 close leaves the record resolvable/duplicable, unlike
DUPLICATE_CLOSE_SOURCE, which explicitly deletes it at `host.js:4714`.
This is an existing E4 defect left unresolved by the candidate, not a claim
that its E6 close deletes the process.
[CloseHandle](https://learn.microsoft.com/en-us/windows/win32/api/handleapi/nf-handleapi-closehandle)
closes a handle while other references can preserve the process object.
Do not conflate deleting an E4 lookup entry with terminating the child.

**D3 — E4 and E6 disagree about the same exited process.**
For a child exiting with code259, E6 op8 returns signaled using `object.exited`,
but E4 op0 still returns259 and the retained ThreadManager's E4 branch at1458
returns WAIT_TIMEOUT/blocks. A fixture with one shared object and its E4 record
reproduces these divergent inputs/results. E4 `process_ctl` termination also
uses259 as its live predicate. The E6 fix does not reconcile the original
CreateProcess handle. Main additionally retains the older GetExitCodeProcess
E4 -1 sentinel collision: a legitimate exit0xffffffff is reported as invalid
handle (`src/09a0b-handlers-base-late.wat:945`). The retained alias branch's
broader history already separated validity; do not assume that prerequisite
arrives by applying the eeef patch alone.

**D4 — memory-release claim is limited to the alias object's edge.**
An E4 record still contains `rec.wine`, even after `object.wine` becomes null.
The alias object itself releases its host as intended, but a parent retaining
its child record can still retain the child host/memory. The source/API fixture
confirms that reference remains. This is not a measured heap leak or a claim
that the process object still holds the memory directly.

Additional acceptance boundaries: OpenProcess remains a deterministic E2
handle for the current PID with the older access model; it is not a new
closeable E6 entry. The E6 `inherit` flag is stored, but inherited-process
transfer is explicitly unimplemented. Generic-rights normalization, arbitrary
cross-process kernel objects and CLI IPC are not proven. A live source-table
owner can duplicate an alias to an exited object; using an exited process as
the table owner correctly cannot resurrect its closed table. Full teardown,
asynchronous launch ordering and host restart were not exercised end-to-end.
Main's stop still stops children; the held alias snapshot removed that behavior
in its history. A future selective port must review that prerequisite as well.

## Regression and original evidence boundaries

All **11 companion checks pass**, including two rejecting negative controls:
removing source deletion fails the CLOSE_SOURCE assertion; replacing the
explicit lifetime bit with `exitCode != 259` fails the signaled assertion.
The checks execute exact extracted JS methods, full process_ctl closure,
and exact stop/restart lifetime prefixes on small state fixtures. They do not
replace host services with success stubs. They characterize defects rather
than passing them off as conformance. No full host lifecycle, WAT API execution,
Worker RPC or game was run.

The retained `test/test-child-process-object.js` was read in full. It covers
real two-WASM-memory alias transfer, actual Worker RPC, query-only rights,
terminate0xffffffff, independent close, failed duplication CLOSE_SOURCE,
exit259 and teardown. It does **not** cover D1, normal E4 close, E4/E6 wait
agreement, or child-record host retention. Its original full-build dependency
is why it was not rerun under this task's restrictions.

Main `test/test-process-send-runtime.js` was also read: its literal0xe60001 is
a scalar payload for the send test, not an allocated or queried process alias.
Its successful delivery therefore cannot prove alias support on main.

Original evidence read: the game notes in `eeef32f90`, `db7a1a57e`, current
main, and the append-only board's 2026-10-11 10:53/12:11 and 2026-10-12 12:06
handoffs. The records say:

* Alias-only `20261011T1116Z-iw-process-alias-original`: 122587ms wait.
* Send candidate `20261011T1157Z-iw-send-runtime-original`: WM_USER carrying
  alias0xe60001 returned1 in121ms; parent exit to level spawn3822ms; final420s
  still LOADING. No gameplay/FPS/audio qualification in that run.
* Later1357 gameplay belongs to a separate TODO/game review, not this task's
  evidence or a current-main process-handle validation.

The exact local folders `scratch/runs/20261011T1052Z-iw-process-aliases`,
`20261011T1154Z-process-send-runtime`, `20261011T1116Z-iw-process-alias-original`
and `20261011T1157Z-iw-send-runtime-original` are absent. No screenshots, raw
timing logs or source seals from those runs were independently recovered or
revalidated here. The committed handoffs establish what was recorded; they do
not fill that evidence gap.

Review evidence lives in
`scratch/runs/20261020-iw-process-handle-selective-review-oct20/`:
`checks.json`, `preflight.json`, `context.txt`, `receipt.json`, `remote.txt`
and `SHA256SUMS.json`. Only this report and its JS companion are committed.
The isolated repository uses exactly those two sparse paths, configured
before checkout. Budget is8MiB including evidence; fresh writes/pushes require
free space above2210398208+33554432+25165824 bytes. Shared HEAD/index/config,
other workers' files, held diagnostics and laptop games are outside ownership.
