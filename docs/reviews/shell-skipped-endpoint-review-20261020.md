# Independent endpoint lifetime review — 2026-10-20

**Reject lifecycle acceptance of `ee129daaf02d3398442c34d42e8aa67fb618771e`
against `978018d85f28b76f04e9b67b7f1009904391b632`.** The unfinished
retained-endpoint oracle is now reproduced with the production transport.
The completion/status change works; it does not retire the preallocated child
endpoint. This defect already exists in the exact parent, so this review does
**not** attribute its introduction to the candidate.

## Finding: completed no-child endpoint remains a live broadcast recipient

`host.js:2345` creates a caller-owned `LoopbackSegment` and caller endpoint.
At `host.js:2422`, every redirected launch also attaches a distinct child
endpoint and places it in `launchOpts.lanLink.wire` **before** calling the shell.
The actual DXSETUP branch (`lib/browser-shell.js:3931–3959`) calls
`onExit(null, 'already-satisfied')` and returns without consuming that wire,
creating a child, or running `beforeRun`.

The real host completion (`host.js:2395–2418`) clears the completion closure,
publishes status zero, and sends `peerGone(ip)` to the caller wire. It never
removes the child wire. `Wire.peerGone` (`lib/vlan-wire.js:161`) only queues a
GONE frame. `LoopbackSegment.attach/broadcast` (`lib/vlan-wire.js:176–192`)
retains each endpoint in `endpoints` and delivers every frame to each endpoint
other than the sender. Neither LoopbackSegment nor LoopbackWire implements
detach/close.

The strong production ownership path is:

```text
live caller -> _childSegment -> endpoints[] -> unused child LoopbackWire
                                          -> inbox[] -> subsequent frames
```

Closing E4 and E6 process handles empties the process tables but leaves this
path intact. A test reference to launch options is not needed to retain it.
Five completed skipped launches leave six endpoints: one valid caller and five
unused child endpoints. Synthetic DATA traffic addressed elsewhere still
enters those unread queues. The real wire throws
`vlan-wire: inbox overflow (20000 frames undelivered)` when the oldest reaches
its limit. This demonstrates a transport resource/availability defect, not a
measured game crash or heap-byte claim.

## Caller lifetime, cancellation, ordinary launches, and EOF

The caller endpoint must remain attached: caller pipes and a live sibling can
still use it after a skipped launch. The independent sibling test proves that
the caller receives sibling traffic while the unused skipped endpoint receives
the same traffic unnecessarily. Removing the entire segment or caller wire is
not an acceptable oracle. A sensitivity control that removes only the skipped
child endpoint passes; removing the caller endpoint fails. These are in-memory
oracle controls, not a production repair or a proposed complete ownership fix.

The tests use complete production `launchVfsExe`, host `process_spawn` and
`process_ctl`, actual process-handle methods and ThreadManager `waitSingle`,
plus the complete `lib/vlan-wire.js` module. Cancellation during synchronous
DXSETUP completion preserves codes 0, 259 and 0xffffffff and emits exactly one
GONE despite duplicate exit callbacks. Retention persists in each case.

Ordinary redirected launch cases cover normal exit, cancellation before
attachment, cancellation during an awaited attachment, boot failure without a
child, and boot failure with a child. They execute actual `joinVlan`, shell
`onStopped` hook/wrapper, host `stop`, shell `failLaunch`, and the non-worker
`_releaseGuestMemory` path. Even after child memory becomes null, the caller's
segment retains the child endpoint. Shell room cleanup applies to `_lanRoom`;
this local pipe `lanLink` has no room owner. There is no hidden transport detach
in these paths. This broader ordinary-launch retention is preexisting.

EOF coverage verifies the actual GONE frame type, source IP, one-time enqueue,
and drain from the caller wire. It does **not** execute guest pipe reads:
`src/09d-winsock.wat` consumes GONE in `vsock_deliver`/`vsock_peer_gone`, which
does not alter the JavaScript segment. A queued EOF notification and transport
endpoint retirement are distinct obligations. Retaining caller pipe handles is
intentional; retaining a child endpoint with no consumer is not.

No-pipe DXSETUP completion allocates no segment. The exact parent leaves the
same endpoint attached but also leaves process completion pending with no GONE;
the candidate correctly changes that latter behavior.

## Evidence and reproduction

Run from an object-complete repository root:

```sh
node docs/reviews/shell-skipped-endpoint-review-20261020.js
node docs/reviews/shell-skipped-endpoint-review-20261020.js --accept
```

The first command passes **16 independent diagnostic/control groups**, reporting
the defect. The second exits **1** at
`completed no-child launch must release its unused endpoint`. This is the
explicit failing acceptance regression. All production input is read by exact
commit ID; output includes SHA-256 seals. No working production source is
modified and no prior fixture's transport stub is used.

Evidence directory:
`scratch/runs/20261020-shell-skipped-endpoint-review-oct20/`.
`tests.json` contains the 16 groups and production seals;
`acceptance-negative.json` records the failing oracle;
`setup.json`, `receipt.json`, `remote.txt`, and `SHA256SUMS.json` preserve setup,
validation, push verification, and recovery evidence.

Read prior `shell-skipped-child-review-oct20.task.txt`, `final.txt`, and
`setup.json`/`focused.json`/`regression.json`. That review's 17 focused and
30 regression groups passed, but its independent endpoint oracle stopped at
the disk gate. This task uses those prior results as prior evidence rather
than repeating the broad review. Its transport fixture used
`LoopbackSegment.attach(){return {};}`, which explains the missing oracle.

## Limits and disposition

Synthetic environmental dependencies replace DOM/UI, launch scheduling,
command parsing, VFS resources, and unrelated renderer/audio/worker cleanup.
Production stop and memory release run with no render/guest workers. Traffic
is synthetic; this is not a full VM, guest EOF/read, Worker IPC, browser,
installer, War Wind, game, GC, or runtime qualification.

Report/test only; no production change or main integration. Exact sparse
patterns were installed before checkout in a fresh independent repository,
using the supplied object store as a read-only alternate. Numeric prewrite
checks use the conservative full-cap threshold 2,277,507,072 bytes
(floor 2,210,398,208 + reserve 33,554,432 + concurrency 25,165,824 +
8,388,608 cap), even after allocation. No disk-gate retry/cleanup loop, runtime
403 retry, workers/refill, full build, Boat, browser, Claude, laptop or deploy
work was performed.

The coordinator should require ownership-aware retirement of unused child
endpoints without breaking caller/sibling lifetime before lifecycle acceptance.
This review assigns no new task and stops after report/test publication.
