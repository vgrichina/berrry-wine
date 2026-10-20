# Existing DXSETUP completion — 2026-10-20

Candidate for independent review, based on exact main
`978018d85f28b76f04e9b67b7f1009904391b632`. No main integration.

The existing `launchVfsExe` DXSETUP policy returned true without either launch
callback, leaving the published process object pending forever. The actual
function reproducer rejects that baseline with
`existing already-satisfied launch must complete` (false versus true).

The same existing branch now calls `onExit(null, 'already-satisfied')`
synchronously before returning true. `process_spawn` recognizes this explicit
no-child success as exit0. Unadorned `onExit(null)` remains failure1; ordinary
children retain their exit codes and asynchronous lifecycle. The existing
completion guard preserves an earlier cancellation, clears the pending state
and callback reference, and emits pipe EOF once. No child is constructed,
attached, booted or merged. No installer or game execution is claimed.

The DXSETUP match and redistributable policy are unchanged. War Wind's existing
separate microtask still uses the caller VFS and passes no tracked-child launch
options. Startup-show transport and lookup/alias design are untouched.

## Verification

From this repository:

```sh
node docs/reviews/shell-skipped-child-lifetime-20261020.js
node docs/reviews/shell-skipped-child-lifetime-20261020.js --regression
```

- **17 focused groups pass.** Complete actual `launchVfsExe`, actual
  `process_spawn`, alias duplication/control, and ThreadManager single,
  cooperative and multiple waits execute. E4/E6 duplicates before and after
  completion agree; closing E4 leaves E6 valid; final close empties both tables.
  The process remains exited with no host/callback reference.
- Both pipe and nonpipe launches test cancellation0/259/0xffffffff before
  notification, using a synchronous log observer to interleave termination
  inside the actual branch. Cancellation remains authoritative. Normal
  completion rejects later termination. The shell calls onExit once and
  beforeRun zero times. Repeated failure/exit notifications do not merge or
  repeat EOF.
- War Wind queues one separate handoff using its existing caller; no handoff
  is treated as execution. Missing files fail, similar executable names do
  not extend the skip list, and untracked DXSETUP remains successful.
  Ordinary launch deferral preserves options identity (including show),
  arguments, child exit0/259/0xffffffff, merge-once, and failure1 with or
  without an attached child.
- **Negative control:** the exact main `launchVfsExe` with the repaired host
  fails the same completion assertion. Initial `baseline.txt` separately
  records the pre-edit reproduction.
- **13 existing boundary groups plus17 original groups pass**, with eight
  original and three additional rejecting mutations. The replay excludes
  only the old test that intentionally asserted DXSETUP stayed pending.
  A historical test's extraction anchor is adapted to the new callback
  signature; remaining assertions are unchanged. Tiny actual-source compiled
  process module603B and wait module482B retain their accepted hashes:
  `81cc57dc6bb58083461f9cfcbd46b997baf0eaa502c2b651585f28b20c26c66e`
  and `e8c2f461864627bc8778ee57e1a7c4ce1b39aedffde2057cec31e96c555e700f`.
- JS syntax and `git diff --check` pass.

The fixture extracts whole production functions. DOM/launch resource creation,
the command parser, file-map setup and launchApp dispatch are explicit
environmental fixtures. No successful launchApp dispatch implies that a guest
ran. The focused no-child tests use actual JS process/wait functions; compiled
guest API coverage comes from the existing regression suite.

## Evidence and limits

Evidence directory:
`scratch/runs/20261020-shell-skipped-child-lifetime-oct20/`
contains setup, baseline, tests, regression, validation, patch and publication
receipts. The JS helper and this report are committed recovery instructions.
Exact sparse patterns preceded checkout; the supplied object alternate was
read only and the main tree verified in the new repository before checkout.
The8MiB allocation cap and numeric prewrite gate were enforced.

No full build, runtime403 retry, Boat/SSH runtime, browser, benchmark, native
child, WorkerRPC/IPC, scheduler/APC, concurrent guest wait/merge, game or installer
qualification. No workers, refill, deployment or protected laptop changes.
Shared HEAD/index/config/WIP and prior evidence were not edited. Independent
review remains required before integration.
