# CROSS-PROCESS-NAMED-SYNC-20261010: CLI provider boundary

Status: **BLOCKED / incomplete; no production implementation or acceptance.**
Base: `f3698d8827aa048af14e0f0cbaa733bb96801949`, supplied exact verified remote
main. Branch: `task/named-event-cli-boundary-oct20`. Publication remains blocked
by the previously established credentials/host-key failures; no retry or trust
change was made. **NO REMOTE BACKUP.**

The new adjacent JS file reproduces the missing behavior with actual Node
`child_process.fork`, the complete event import block extracted unchanged from
`test/run.js`, and actual `ThreadManager` instances in parent and child. Memory,
the sync-table getter and guest name strings are fixtures; event operations,
name lookup, reference accounting and waits are production code. This is the
real provider boundary, not a PE/launcher/full-VM test. The test does not execute
the complete CreateProcess callback, export VFS state, or launch a game.

Run from the isolated repository:

```
node docs/reviews/named-event-cli-boundary-20261020.js
node docs/reviews/named-event-cli-boundary-20261020.js --observe-gap
node docs/reviews/named-event-cli-boundary-20261020.js --local
node docs/reviews/named-event-cli-boundary-20261020.js --snapshot-control
node docs/reviews/named-event-cli-boundary-20261020.js --nested-gap
node test/test-sync-object-name.js
node --require ../read-only-inputs.cjs test/test-thread-manager.js
```

The default command deliberately fails acceptance: child `open_event` returns
0, `set_event(0)` returns 0, and parent wait returns WAIT_TIMEOUT (258). A child
create with the same name yields the same numeric handle (917504) in independent
memory; child set/wait succeeds, but parent remains unsignaled. `--observe-gap`
asserts this exact failure, including successful closes. A zero exit from that
mode confirms the defect, not feature acceptance.

`--local` passes manual/auto reset, repeated-create existing-name tag, preservation
of initial state/reset mode, repeated opens/closes, last-reference destruction,
stale-handle rejection, generation reuse and unrelated-name isolation through
the production imports. The existing name-decoder regression passes.

`--snapshot-control` must fail: two independent production providers initialized
with one mirrored logical auto-reset signal both return success. This rejects
copying/snapshotting state as a solution; it is a deliberately wrong transport
model, not a production mutation or a candidate-pass result.

Concrete dependencies and stopping evidence:

- Exact main has no `lib/named-sync-namespace.js`. Historical `0ee85820c` contains
  a browser shared-buffer namespace and explicitly documents that CLI subprocess
  transport is unimplemented. `c271af214` changes D3D adapter/monitor behavior,
  not CLI synchronization. Neither is a current transport prerequisite already
  integrated on this base.
- `test/run.js` has two Node fork launch sites (ordinary VFS and redirected pipe
  children). Each process constructs a new ThreadManager. The current event import
  block at 4628 and constructor around 5404 supply no shared event provider.
- `ThreadManager` owns process-local name/ref maps and sync words in its own wasm
  memory. Synchronous Create/Open must return a valid local handle immediately;
  an ordinary asynchronous Node IPC callback cannot implement this contract by
  itself. SharedArrayBuffer from the browser design is not cross-process memory
  in these Node forks.
- The nested cooperative infinite event wait already returns WAIT_FAILED
  (4294967295) for an unsignaled event, while an already-signaled event succeeds.
  `--nested-gap` reproduces both through the actual CLI import with message depth
  one. `waitSingleCooperative` only pumps an active local thread target, not an
  event. A synchronous IPC spin would also prevent parent message callbacks from
  running. Worker nested waits in `guest-rpc.js:207` independently consume the
  local sync table with Atomics. Mirrored event states cannot preserve atomic
  auto-reset consumption across those paths.
- The existing unmodified `test/test-thread-manager.js` fails at line 570:
  “scheduler executes the worker after its final resume”, expected 1, actual 0.
  No production files were changed. The read-only preload supplies missing WAT
  fragments from exact base Git objects for the test's source assertions; it
  does not replace the test, provider, scheduler, or assertions. This failure is
  retained without repairing the unrelated scheduler/fixture. The rest of that
  suite did not run; do not label the full regression suite green.

A correct implementation needs a synchronous cross-process event authority (or
a guest continuation design), process-local proxy lifetime and process-exit
cleanup, and a wait path that atomically consumes the same authority from main,
cooperative nested callbacks and guest Workers. No safe narrow implementation
was produced here. This is not a claim that such an implementation is impossible;
the coordinator must resolve the existing regression and assign the necessary
provider/wait prerequisite scope. A simple import/IPC mirror would fail the
preserved control, so it was not committed as a purported fix.

Evidence: `scratch/runs/20261020-named-event-cli-boundary-oct20/` contains
`setup.json`, `tests.json`, individual logs, `read-only-inputs.cjs`,
`regression-inputs.json`, `input-hashes.json`, `receipt.json`, explicit patches
and `SHA256SUMS.json`. The source regression reader follows exact main.watx
includes without materializing the src directory. Initial explicit sparse
content projected 1,176,479 bytes; later measured additions 785,771 + 2,995 bytes.
All task writes remained below the 16 MiB task allocation and above the
2,285,895,680-byte available-space floor; final allocated bytes are in receipt.

No main integration, publication attempt, browser/runtime/Boat/SSH/auth action,
full build, worker launch, mutex/semaphore expansion, process-alias/window-registry
change or laptop work occurred. No native Windows, guest executable, Worker wait,
crash-cleanup, concurrent cross-process lifetime or game qualification is claimed.
