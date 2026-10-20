# Independent process-alias acceptance review — 2026-10-20

**Do not accept candidate `659a2c6d6974c447a21dd2905cd7a2c2c1e23382`
as complete API/lifecycle compatibility.** Reviewed exactly atop
`a54049d11955307d06309e146e85c1aca3196657`. This branch contains only this
report and its independent JS helper; no production correction or integration.

The attached-object D1–D3 corrections are substantially sound in the bounded
tests, but actual launch and guest API boundaries expose the defects below.
These are deterministic source/compiled-slice reproductions, not conclusions
drawn from the unavailable browser runtime.

## Findings requiring correction or explicit scope disposition

| ID | Severity | Trigger and actual result | Exact candidate boundary |
| --- | --- | --- | --- |
| A1 | High | `beforeRun` attaches the child object, then pipe setup rejects. Shell failure first records exit **1** through `onExit(null)`, then `stop()` freezes the attached object at default **0**. E4 and subsequently duplicated E6 query **0**, claiming success for a failed launch. The same failure before attachment reports **1**. | `host.js:2361`, `2377`, `2417`, `4923`; `lib/browser-shell.js:2689`, `2692`, `2708`, `3748` |
| A2 | High | A successful synchronous CreateProcess returns pending E4 before `beforeRun`. Query/access/wait recognize it, but duplication and termination return invalid handle. NULL-target CLOSE_SOURCE actually deletes that valid pending E4 and still reports failure. After attachment these same calls work. | `src/09d7-pipes.wat:599`, `624`; `host.js:2359`, `2362`, `2422`, `4873`, `4905` |
| A3 | Medium | Close E4, then call WaitForSingleObject or nonalertable WaitForSingleObjectEx. Host correctly returns WAIT_FAILED, but the complete compiled WAT handler preserves unrelated `last_error=1234`; it does not report invalid handle. No-SYNCHRONIZE aliases similarly lack an error channel distinguishing access denial. | `lib/thread-manager.js:1517`; `src/09a0-handlers-base.wat:5240`, `5254`; `host.js:2708` |

**A1 reproduction executes actual `process_spawn`, its actual `beforeRun` and
`onExit`, complete shell `failLaunch`, and complete host `stop`.** DOM logging
and renderer/audio/worker cleanup dependencies are inert fixture functions;
no runtime resources are created. After failure, the same record contains
`rec.exitCode === 1` and `rec.object.exitCode === 0`. `process_ctl` chooses the
object, so the mismatch reaches both handle types. The shell intentionally
notifies failure before stopping its orphan; this ordering was present in the
base. The candidate introduces the split authoritative state. The duplicate
callback guard correctly prevents double merge/EOF; removing that guard is
not a solution.

**A2 is a reachable publication boundary, not merely missing runtime evidence.**
The actual guest producer writes hProcess to PROCESS_INFORMATION immediately
after `host_process_spawn` returns a nonzero PID. The host inserts a record
with no object and the shell can defer boot; `beforeRun` happens only after
image/DLL setup. `_processHandleEntry` refuses that record until attachment.
The helper calls the real producer and captures its launch options without
running a guest. Before attachment it observes query259, wait258,
duplicate−6 and terminate−6. CLOSE_SOURCE deletes the source in `finally` but
returns −6 before reaching the close-only success branch. The candidate report
acknowledges the pending limitation; it remains a concrete contract defect.
The earlier base also mishandled pending termination, so this is not a claim
that all pending-process problems were newly introduced.

The NULL-output allocation and NULL-target close-only expectations follow
[Microsoft's DuplicateHandle contract](https://learn.microsoft.com/en-us/windows/win32/api/handleapi/nf-handleapi-duplicatehandle).
Both shapes pass for attached E4/E6. NULL target ignores output, desired
access and inheritance; failed duplication closes the source in its owning
table, including when caller and source tables contain the same numeric alias.

**A3 tests the entire immediate-return guest wait handlers**, not an inferred
JS return alone. A 338-byte module links the exact two WAT functions to actual
ThreadManager wait logic. Both return `0xffffffff`, clean their respective
stdcall stacks and leave `last_error=1234`. The ordinary wait wrapper itself
is unchanged from base; the candidate's new invalid-handle results expose
the unhandled error path for the corrected process handles. This is a
caller/consumer integration gap, not a claim of a newly edited WAT wait
regression. The test closes the handle **before starting** the wait; it does
not demand defined behavior for a close racing an already pending wait.
[Microsoft's wait contract](https://learn.microsoft.com/en-us/windows/win32/api/synchapi/nf-synchapi-waitforsingleobject)
requires SYNCHRONIZE and directs callers to GetLastError after WAIT_FAILED.

## Confirmed behavior and ownership

The submitted 17 groups and eight mutation controls reproduce in RAM against
the exact candidate blobs. Their normal process-API module hash remains
`81cc57dc6bb58083461f9cfcbd46b997baf0eaa502c2b651585f28b20c26c66e`.
The independent helper adds 12 groups and six rejecting controls: three
in-memory regressions (NULL output, source-table close, retained host) and
three deliberately rejected compatibility oracles for A1–A3. A passing test
run means the documented behavior and defects reproduce, **not** acceptance.

Independent checks additionally establish:

- E4/E6 close independently before/after exit, without terminating the child;
  closed handles fail repeated access/close. Closing E4 before attachment
  does not reinsert it later or take ownership of the exit callback.
- Exit259, `0xffffffff`, `0x80000000` and zero remain full DWORD results;
  explicit validity and `exited` control waits. Closing either handle leaves
  its peer usable. Restart creates a new object while aliases retain the old
  exit result.
- Wait-any/all reject invalid or non-SYNCHRONIZE process aliases before
  consuming a ready auto-reset event. This is a host-state result; guest
  last-error propagation is separately defective as A3.
- Exit removes `object.wine`; owner tables clear; other owners' aliases retain
  the process object without the exited host edge. Cross-owner close uses
  the source table even when handle numbers collide.
- Closing a pending handle preserves the callback closure. Its eventual
  normal exit merges exactly once, including `0xffffffff`.
- `_installProcessSendBroker`, `_stopGuestRuntime`, `_releaseGuestMemory`,
  and the existing stop body from `_manifestAssetAbort` onward are byte
  identical to base. Already integrated send/callback ownership is retained.
- CLI E4 validity, close, full-width codes and callback idempotence pass the
  reproduced submitted tests. CLI alias requests explicitly return
  ERROR_NOT_SUPPORTED; no IPC support is claimed.

The inspected wait consumer chain is guest WAT → host `wait_single` →
ThreadManager `waitSingle` / cooperative adapter, with scheduler wait polling
also calling `waitSingle`. The ordinary host path passes the new result
unchanged. Cooperative/nested callbacks and Worker execution were inspected
but not executed end-to-end.

## Pre-existing boundary and unqualified runtime behavior

The actual `launchVfsExe` DXSETUP skip returns true without invoking
`beforeRun` or `onExit`. Composed with actual `process_spawn`, it returns E4
whose state remains pending forever. The complete launcher function is
byte-identical to base. This is a **pre-existing producer/consumer mismatch**,
not an alias regression and not a request to modify the concurrent ShellEx
worker's files. It prevents a general claim that every accepted launch
eventually attaches or completes.

`stop()` publishes `object.exited` before its existing `onStopped` hook
performs the VFS merge. The exact ordering is established; a concurrent
Worker observing completion before merge is **not reproduced here**.
Same-event-loop ordinary stop completes its synchronous hook before returning.
Do not turn this ordering observation into a measured gameplay/race defect,
or claim wait/merge ordering is fully qualified. Stop All, asynchronous
retirement, reentrant callbacks, inherited-handle transfer, generic rights
normalization, E2/OpenProcess scope and actual heap reclamation remain outside
these fixtures. Eliminating a reference edge is not a heap-leak measurement.

No full VM/build, guest, browser, Worker RPC, OS child IPC, benchmark or
gameplay ran. Runtime403 remains binding. No Boat/SSH runtime access,
deployment, Claude, held diagnostics, workers or laptop-game changes.

## Evidence and recovery

From a repository containing both exact commits:

```sh
node docs/reviews/process-alias-independent-acceptance-20261020.js
```

The script reads sealed Git blobs and runs all fixtures in memory. It does
not need a broad checkout. The committed helper recovers the compiled wait
module (SHA-256
`2e123999e66c272ad44b021c9289eb8f70da1effca67bb5aa6c1198d660dfb92`)
and all observed values. Candidate receipt/tests/report were read before
review. Two initial helper issues (missing fixture class brace and unsupported
inline WAT memory export) were corrected; neither required a production edit.

Dedicated evidence:
`scratch/runs/20261020-process-alias-independent-acceptance-oct20/`
contains `setup.json`, `tests.json`, `validation.json`, `receipt.json`,
`remote.txt`, `SHA256SUMS.json`, and `validate.js`.
The isolated repo uses read-only object alternates; exact two-file sparse
patterns were configured before checkout. Shared HEAD/index/config hashes
are compared to the initial snapshot. Numeric prewrite gates enforce
`2210398208 + 33554432 + 25165824 + remaining allocation`, with total task
allocation below 8 MiB. No shared branch or index is used for this report.

Coordinator disposition: retain the demonstrated D1–D3 improvements, resolve
or explicitly bound A1–A3 before compatibility acceptance, and keep runtime
qualification separate. This worker makes no production changes or integration.
