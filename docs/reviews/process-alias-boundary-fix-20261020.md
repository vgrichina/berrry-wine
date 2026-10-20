# Process alias boundary corrections — 2026-10-20

Corrects the A1–A3 reproductions in independent review
`70f39cc2471fbc8fcaea6be460527800a3ec17d4`, with exact candidate
`659a2c6d6974c447a21dd2905cd7a2c2c1e23382` as this branch's parent.
No main integration. Remote main was verified as
`a54049d11955307d06309e146e85c1aca3196657`.

## Changes

Only two production paths change relative to the candidate: `host.js` and
`src/09a0-handlers-base.wat`. The candidate's remaining production paths and
attached D1–D3 implementations remain unchanged. Selective integration needs
the candidate changes plus this delta; this delta alone is not a port onto
main. The dedicated report and JS helper are the other two committed paths.

**A1:** `onExit` finalizes the same object queried by E4/E6. A shell failure
with `onExit(null)` records failure1 before the following `stop`, which now
preserves that code. The one-shot callback guard still owns VFS merge and
pipe EOF. Host-owned tables are cleared even when failure or cancellation
already finalized the process object.

**A2:** `process_spawn` publishes a real process object with the pending E4.
Duplicating that handle allocates aliases immediately, and `beforeRun`
attaches the child to the same object. Close-only NULL-target requests
therefore use the existing correct duplication contract. Pending termination
records the supplied DWORD, signals completion and EOF once, then prevents
the later child from running: its `beforeRun` stops it and rejects into the
existing shell cleanup path. Closing E4 does not lose the callback or
reinsert the handle. A termination while pipe setup is awaiting a guest
call also prevents successful continuation after that call resolves.
The temporary completion closure is removed on completion.

**A3:** The complete WaitForSingleObject and WaitForSingleObjectEx handlers
now use the existing process access operation (op6, SYNCHRONIZE) when an
E4/E6 wait returns WAIT_FAILED. Its negative error becomes guest last_error:
6 for invalid handle and 5 for access denial. Successful waits, timeouts,
yield sentinels, nonprocess handles and cooperative failures of a valid
process preserve their prior behavior. There is no new import, shared
last-error slot, IPC encoding or rights protocol. ThreadManager and host
wait adapters are unchanged.

## Acceptance evidence

Run from the task repository:

```sh
node docs/reviews/process-alias-boundary-fix-20261020.js
```

The helper derives from the independent review's fixtures and changes its
defect assertions into acceptance assertions. It reads current owned source,
sealed candidate blobs for absent files, and the sealed WATX compiler.
It executes actual extracted JS functions and tiny compiled WAT consumers;
DOM, resource cleanup and guest-memory mapping are explicit fixtures.

All **14 independent groups** and the original **17 candidate groups** pass.
The original eight mutation controls and three independent mutation controls
still reject regressions. Three additional exact-parent controls fail on
the original A1, A2 and A3 acceptance assertions respectively:
object exit0 instead of1; compiled pending duplication failure instead of
success; guest last_error1234 instead of6.

Coverage includes:

- Actual process_spawn, beforeRun, complete shell failLaunch and complete
  host stop: failure1 through E4 and preexisting/new E6, one EOF despite
  repeated failure notifications, released object-to-host/completion edges.
- Compiled process branches operating on actual pending spawn records:
  duplicate, close, terminate and query for exit0,17,259,0xffffffff, with E4
  either retained or closed before termination. Late attachment rejects,
  owner tables clear, aliases retain the result, EOF occurs once.
- Pending-to-attached identity, NULL-target close-only success, independent
  close, no handle resurrection, termination during an unresolved pipe call.
- Complete compiled single/Ex wait handlers through the actual host adapter
  and actual ThreadManager, ordinary and nested cooperative paths:
  invalid/access errors, timeout, event success, legacy unknown-handle
  behavior and valid-process cooperative failure. Tests use nonalertable Ex;
  its APC implementation is outside this slice.
- Attached D1–D3, full DWORD exits including259 and0xffffffff, cross-owner
  equal-number close, NULL output allocation, rights, wait-any/all validation
  before auto-reset event consumption, restart and reference cleanup.
- Integrated send broker, runtime teardown, guest-memory release and the
  stop body from manifest cleanup onward remain byte-identical to main.

The complete wait module is 482 bytes, SHA-256
`e8c2f461864627bc8778ee57e1a7c4ce1b39aedffde2057cec31e96c555e700f`.
The original compiled process slice remains603 bytes, SHA-256
`81cc57dc6bb58083461f9cfcbd46b997baf0eaa502c2b651585f28b20c26c66e`.
JS syntax, WAT parentheses, logical-AND, silent-stub inventory, region census
and diff checks pass on exact candidate source with only owned overlays.

## Scope and remaining qualification

DXSETUP's pre-existing successful skip without completion remains unchanged
and explicitly reproduced. ShellEx, lookup and environment semantics are
untouched. This is not a generic handle-owner/rights redesign; pending child
handles are tested as the objects being duplicated, not as remote source
or target handle-table owners before their host attaches.

No full build, full VM, browser, Worker RPC, OS child IPC, game, benchmark,
Boat/SSH runtime command, deployment, held diagnostic or worker ran.
Existing Worker import signatures are unchanged, but end-to-end Worker
execution and scheduler resumption remain unqualified. APC delivery,
asynchronous shell retirement, boot failure UI, reentrant callbacks,
inherited-handle transfer and actual heap reclamation are not claimed.
Exit publication still precedes the existing synchronous merge hook;
this work does not qualify concurrent wait/merge ordering.

Evidence and JS recovery helpers are retained in
`scratch/runs/20261020-process-alias-boundary-fix-oct20/`:
`setup.json`, `gate.js`, `gates.js`, `validate.js`, `tests.json`,
`validation.json`, `change.patch`, `receipt.json`, `remote.txt` and
`SHA256SUMS.json`. The isolated checkout configured exact sparse paths
before checkout and uses read-only object alternates. Prewrite gates enforce
`2210398208 + 33554432 + 25165824 + remaining` and an8MiB allocation cap.
Shared HEAD, index and config are checked against the initial snapshot.
