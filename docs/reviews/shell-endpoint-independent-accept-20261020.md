# Independent child endpoint acceptance — 2026-10-20

**ACCEPT_SOURCE_SLICES** `3bfe91664271230863c7cb586eb2ae0a003af31f`
against `ee129daaf02d3398442c34d42e8aa67fb618771e` for the bounded child
LoopbackSegment endpoint lifecycle requirement. No remaining defect was found
within this scope. This does not authorize main integration or qualify a game.

Read the exact `fa1f3097b` failure report (resolved through the supplied object
store), the repair report, receipt and submitted tests. Verified the prior
report's local evidence copy matches its committed blob. The repair changes only
host.js, lib/vlan-wire.js and its report/test pair. This review owns only this
report and its companion JS; production and main were not changed.

## Ownership and source review

The prior defect is real: caller `_childSegment.endpoints` strongly retains
completed child wires after process handles close, so later broadcasts fill
unread queues until the 20,000-frame stream limit throws. `peerGone` alone
queues EOF and cannot retire a recipient. The baseline reproduces this defect.

The candidate attaches `childWire` in the launch closure before passing it to
`launchVfsExe`. `onExit` guards completion with `rec.exited`, closes that exact
wire, deletes `object.complete`, publishes completion and sends the caller's
GONE once. False returns and synchronous throws now use the same completion
path before deleting the process record. Pending termination invokes that
closure through the shared process object even after E4 closes and E6 remains.
The shell's ordinary stop wrapper and boot failure notifier also reach it;
repeated fail/stop/onExit calls are harmless. Cancellation during asynchronous
beforeRun cannot restart attachment after process exit. The caller endpoint
and independently owned children remain live even if handles or caller stop.

`LoopbackWire.close` removes itself from membership, clears queued frames and
both callback references, and releases its segment reference. A closed wire
cannot send, receive, or queue peerGone. A surviving child object may still
reference its now-closed wire; it is no longer a dead broadcast recipient.
The local lanLink has no separate room owner whose later cleanup is required
for retirement. This is production launch ownership, not test-owned reference
removal, garbage collection, or a transport stub.

Broadcast snapshots membership. Synchronously closing the current/earlier
recipient cannot shift the next live recipient out of iteration; closing a
later recipient makes its guarded deliver inert. A wire attached during a
broadcast does not receive the older in-flight frame, but does receive nested
later sends. Closing a sender during its in-flight send lets that snapshot
finish; subsequent sends return false. Close itself emits no duplicate GONE.
The ordinary live unread receiver still throws at the real stream limit;
acceptance does not hide overflow by disabling the limit or swallowing errors.

## Independent tests and controls

The companion test reads exact git blobs and emits their SHA-256 seals. Its
fixture extraction is attributed to fa1f3097, independently inspected and
adapted; the scenarios and assertions in this review are newly authored.
Production host spawn/control, process-handle lookup/duplication, joinVlan,
stop and non-worker memory release, ThreadManager wait helper, shell launch,
failLaunch and onStopped slices run with the complete production wire module.

All **13 independent groups pass**:

- Nine lifecycle groups each perform 24 completions while two ordinary live
  children remain attached: no-child skip, failure before a child, failure
  with a child, cancellation before attachment through E6 after E4 closes,
  cancellation during awaited attachment, ordinary exit, explicit terminate,
  synchronous false launch and synchronous thrown launch. Each checks exact
  membership, empty retired queues, cleared callbacks, closed send/receive,
  exit status, completion-closure release, and EOF once after duplicate cleanup.
- Each group then sends **20,001 DATA frames**, totaling **180,009**, alternating
  caller and sibling senders. Every surviving recipient reads its real inbox
  each turn and verifies the sequence payload; retired wires remain empty.
  There is no onFrame shortcut for these live traffic controls. Pending child
  input is queued until completion. Caller stop and handle close preserve
  sibling traffic; stopping each sibling later retires only that sibling.
- A real child stop runs from its wire's onDeliver during a caller broadcast.
  The later sibling receives the same frame and the caller receives one EOF.
- Ten deletion permutations (self, previous, next, sender, all, through both
  onFrame and onDeliver) and a nested-send/new-endpoint case check snapshot
  iteration and idempotent close.
- An intentionally unread live child reaches the real 20,000-frame overflow;
  retiring it clears its queue and allows later sends.
- No-pipe skipped launch allocates no segment.

The exact baseline returns REJECT: one group passes and twelve fail (including
missing close support and the old false/throw completion behavior). All three
independent mutation controls reject: retaining child (11 failed groups),
closing caller (11), and mutable broadcast iteration (2). The last control
specifically loses delivery to the later live sibling during production stop.
Submitted repair tests were rerun against the exact candidate: **17 pass**.
No production files were altered to run controls; mutations are in-memory.

Reproduce from a repository containing these objects:

```sh
node docs/reviews/shell-endpoint-independent-accept-20261020.js
SOURCE_REV=ee129daaf02d3398442c34d42e8aa67fb618771e node docs/reviews/shell-endpoint-independent-accept-20261020.js
MUTATION=mutable-broadcast node docs/reviews/shell-endpoint-independent-accept-20261020.js
MUTATION=close-caller node docs/reviews/shell-endpoint-independent-accept-20261020.js
MUTATION=retain-child node docs/reviews/shell-endpoint-independent-accept-20261020.js
```

Only the first command should succeed. Evidence is in
`scratch/runs/20261020-shell-endpoint-independent-accept-oct20/`:
`tests.json`, `baseline.json`, three mutation JSON files, `submitted-tests.json`,
`setup.json`, `validation.json`, `receipt.json`, `remote.txt`, `change.patch`,
and `SHA256SUMS.json`. Test JSON wrappers preserve exit code/stdout/stderr;
the stdout JSON contains checks, failures and source seals. The pushed report
and JS preserve the findings and exact reproduction recipe independently of
ignored local evidence. Receipt records the review commit and verified remote.

## Limits and preservation

Synthetic VFS, launch scheduling, callGuest, DOM/UI and unrelated stop cleanup
replace the surrounding environment. Live siblings are production JS host
slices with real transport queues drained by an explicit synthetic consumer;
they do not execute guest pipe reads or a full guest. GONE type/source/once and
queue draining are verified; guest-observed EOF is not. No compiled WAT slice,
full VM, Worker IPC/concurrency, browser, installer/game, heap-byte/GC or Boat
runtime qualification is claimed. No runtime403 retries, workers/refill,
heavy/full builds, public deployment, Claude panes, or laptop work occurred.

Fresh independent repository, exact non-cone sparse patterns installed before
materialization, and read-only alternates preserve shared HEAD/index/config
and old WIP. The initial checkout hit Git's alternate-depth limit; flattening
the existing supplied read-only alternate closure in the new repository fixed
object resolution without modifying any source object store. No capacity gate
failed. Every write operation used the conservative full-cap threshold
2,277,507,072 bytes (2,210,398,208 + 33,554,432 + 25,165,824 + 8,388,608), which
is stricter than subtracting used cap. Total task footprint stays below 8 MiB.
Only the two explicitly owned files are committed and pushed to
`task/shell-endpoint-independent-accept-oct20`. Single bounded task; stop after
publication. No main integration.
