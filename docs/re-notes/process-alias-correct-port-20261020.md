# Selective process aliases with D1–D3 corrections — 2026-10-20

Candidate only, based on remote-verified main
`a54049d11955307d06309e146e85c1aca3196657`. No main integration.
Selectively implements the process aliases from
`eeef32f9091b1bff7ad64d163f09a8822c0914bd`, correcting review
`128e728f95803566aaa6beb706275da1edeff85d`. The already integrated send
transport is not re-ported.

## Changes

* D1: NULL output still allocates a target-owned alias. NULL target with
  CLOSE_SOURCE succeeds without allocating. The WAT wrapper stores only when
  both target and output are nonzero. Failure still closes a real source
  handle, including access, options, target and exhaustion failures.
* D2: E4 and E6 have explicit independent close operations. Repeated close,
  query, wait and duplication of a closed handle fail. Closing one handle
  never terminates its process or invalidates another alias. E4 allocation
  becomes monotonic rather than using the current map size.
* D3: E4 and E6 query/access/terminate/close/wait use the same object-based
  protocol (ops4–8); E4 compatibility ops0–2 remain. Validity is checked
  separately from the DWORD result. Wait and terminate use `exited`, including
  exit259 and `0xffffffff`. Multiple waits validate handles before consuming
  an auto-reset event or semaphore.
* Host lifetime: the object outlives the host, releases its host reference
  on stop and is replaced on restart. Owner tables clear on stop, but children
  continue. Child records store the object, not another direct host reference.
  `onExit` retains merge/EOF ownership and uses its own callback-completion
  flag, so termination no longer suppresses merge/EOF and exit259 cannot
  repeat them. The rest of stop, worker retirement and memory-release logic,
  including existing send/callback ownership, is byte-preserved.
* CLI compatibility: E4 uses independent validity/lifetime and explicit close.
  Live-child bookkeeping is separate from handle lookup, so closing a handle
  cannot claim its OS child has exited. CLI aliases return ERROR_NOT_SUPPORTED;
  unsupported hosts return explicit process errors. No IPC implementation.
* The existing child-process regression fixture uses the new E4 operation
  numbers. Its behavior is checked against extracted actual host code; its
  full-VM harness was not run.

## Evidence and recovery

Run the committed helper from the repository root:

```sh
node docs/re-notes/process-alias-correct-port-20261020.js
```

Seventeen groups pass. They execute exact host alias methods, the complete
process-control closure, stop/restart lifetime prefixes, the actual exit
callback, complete ThreadManager wait methods, CLI control/exit callbacks,
and four actual WAT process-handler prefixes compiled with the vendored
compiler from the base Git snapshot. The 603-byte compiled slice has SHA-256
`81cc57dc6bb58083461f9cfcbd46b997baf0eaa502c2b651585f28b20c26c66e`.
It uses two separate one-page memories with an explicit identity address
mapping. Unselected API branches trap; they are not successful host stubs.
The extracted production `pipe_ret` checks errors, output stores and stdcall
cleanup through the actual control implementation.

Eight rejecting mutation controls cover NULL output rejection, close-only
failure, missing E4/source close, exit-code-based lifetime, retained host,
NULL-address output store and the full32 invalid-handle sentinel collision.
The tests cover target-table ownership, equal numeric handles in different
tables, query/terminate/wait rights, inheritance metadata, independent close,
termination, full32 exits, owner teardown, old-object restart identity,
allocation exhaustion and callback ownership.

The evidence folder is
`scratch/runs/20261020-process-alias-correct-port-oct20/`:
`tests.json`, `validation.json`, `receipt.json`, `change.patch`,
`remote.txt`, `SHA256SUMS.json`, `preflight.json`, `setup.json`,
plus `gates.js` and `validate.js` recovery recipes.
Unchanged paren/label checks, logical-AND normalization, silent-stub inventory
and region-census gates run against the exact Git snapshot with owned working
file overlays read in RAM. Syntax and whitespace checks also pass.

Two initial helper failures were test harness faults, corrected before the
passing run: passing an outer `(module ...)` to the WATX fragment compiler
produced a module without exports; a send-preservation comparison selected
an earlier similarly named marker. A gate adapter initially lacked absolute
module resolution. An isolated sparse checkout command initially omitted
the already configured new test path; explicit Git-blob materialization
then succeeded. None of these was hidden by a production stub.

## Limits and next review

This is source and compiled-slice evidence, not full host/VM, Worker RPC,
browser, native guest, IPC or gameplay qualification. No runtime access was
attempted; the runtime403 restriction remains binding. Original launcher
timings are not revalidated.

The existing asynchronous launch boundary remains: E4 has pending query/wait
state before `beforeRun`, but duplication and termination need its attached
process object/host and fail explicitly before attachment. Launch failure
ordering, browser Stop All, full callback reentrancy, process restart and
real memory collection still need independent lifecycle review. Clearing
`object.wine` and removing `rec.wine` establishes reference-edge behavior,
not a measured heap-leak result.

OpenProcess/E2 retains its pre-existing access model; rights normalization,
arbitrary kernel objects and inherited-handle transfer are not implemented.
The inheritance flag is metadata only. CLI OS-child lifetime remains managed
by its existing harness exit policy.

Next: independent API/lifecycle review, then coordinator-owned serialized
integration with the concurrent host changes. Full-VM regression and
authorized runtime requalification remain future work. No FindWindow,
ShellExecute, transport, held diagnostics or laptop-game changes.
