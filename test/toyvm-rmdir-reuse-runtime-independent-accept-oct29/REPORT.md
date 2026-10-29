Independent scoped acceptance of retained RMDIR metadata reuse

Outcome: SCOPED_RETAINED_RUNTIME_ACCEPTED. This worker performed no new CLI,
backend, Boat, mount, replay, browser or gameplay execution. The first behavioral
checkpoint verified the retained actual production CLI/FUSE boundary and unchanged
513-byte fixture, not a substitute runner. Candidate is
5a88ca099b962e946160afd2d4d71a950bf46db3; exact five source pins and fixture hash
1d44688f673506b1776168f3a2563b0d690fcef45ad2985299c36622ca8e3046 are in canonical.json.
Original published runtime commit: dab3060be066a7f62b57e1f73d1b7ddd6daddc4c.

The independent checker binds the raw API response to the observer, actual argv,
raw CLI stdout/stderr, source-before/after identities, fixture marker, sampled
PID/start identities, production-owned identities, cleanup and authoritative
post-reap filesystem counters. CLI exit 0, accepted true, no stop or filesystem
failure, live/peak 12288, written 0, inodes 3, handles 0. The fixture proves E was
a directory, removes it and observes absence, then creates directory F and emits
removedE/recreatedF true. Unmount exit 0, server exit -15, no remaining mounts;
all observed PID/start identities were absent or reused after reap. These are
retained observer claims corroborated against their raw evidence, not fresh
host process observations.

Independent source arithmetic: initial root metadata is 4096. Each create charges
4096 before next-inode, node insertion or parent-entry mutation. D brings live to
8192; E to 12288. RMDIR opcode 11 checks nonempty status, removes the parent entry,
decrements links and collects. Collection requires both zero links and zero opens,
refunds 4096 plus rounded payload and deletes the node. E has empty payload, so
its removal implies 8192; F reuses the headroom and implies 12288. The sequence
4096 -> 8192 -> 12288 -> 8192 -> 12288 is source inference, not measured intermediate
samples. Adapter source obtains final counters after supervise returns and before
unmount. The same charge ordering implies root+D+emptyA at 12288 would reject the
next directory's 4096 before inode/entry mutation. The separate metadata-rejection
runtime case was not tested here; its expected CLI1/allocationlimit/acceptedfalse,
written0/inodes3/handles0 is not an additional acceptance claim.

Sixteen adversarial controls reject wrong quota argv, missing marker, stale owned
start identity, unreaped identity, remaining mount, wrong counter/source/candidate,
external cleanup, failed unmount, charge after inode mutation, missing collection,
collection before link decrement, missing refund, collection of an open inode and
wrong directory type. Backend AST is inspected without import or execution. Exact
immutable source snapshots came from candidate Git objects. Caller and adapter
wiring are inspected; inherited passing groups and backend execution are not
repeated. The complete retained raw manifest was revalidated (105799 bytes).

Initial acceptance exposed a test-control error: the wrong-quota mutation wrote
65536 to argv[12], already the write quota. It changed no input. This was corrected
to live quota argv[10]; the corrected group passed. Both diagnostic receipts are
retained. This was a local validator fixture correction, not a production repair,
resource denial or retry of runtime. Successful Git reads emitted alternate-store
nesting warnings; stderr is retained and no fetch/retry/substitution occurred.

The supplied import-safe ops.py was always invoked directly with inherited DATA
hard infinity. Parent soft128 MiB, child Python128/Git256 MiB, physical RSS parent128
and group512 MiB, CPU90/wall120/file12MiB/capture2MiB/evidence1MiB guards remain.
No child imported a supervisor or configured parent limits. Node startup is
inapplicable. Fresh operation admission retains the transferred 24MiB allocation,
unchanged RAM/disk floors and positive WAL counted once. Source reads and check
receipts are retained in checks/. No checkout, fetch, clone or sparse expansion.
Exact trusted SSH configuration is preserved for task publication. Original empty
guest mount argv receipt is reused: no filename-bearing mounts or new staging.

Procedural limitations are preserved: original worker initial policy reads/pwd
used inherited repository-root cwd; this independent worker also initially read
policy from inherited root cwd. Subsequent commands used explicit owned cwd.
Neither incident wrote donor/root Git data. No direct errno, realtime,
instantaneous phase, general resource or gameplay claim is made.

Canonical runtime evidence remains at the dispatch's retainedRuntimeCanonical;
canonical.json pins it and the original manifest. Boat bx_47z2wx6m was already
snapshot-stopped by its authorized original owner and coordinator verification;
expiry was 2026-10-29T05:44:43.833Z. This worker made no lifecycle request.
The coordinator owns lifecycle and root messageboard publication. The task-owned
coordinator-note.txt records the exact verified task commit/ref after push.

Reproduce only this offline check with the supplied task supervisor:
python3 -B /tmp/toyvm-rmdir-reuse-runtime-independent-accept-oct29/ops.py NAME python3 -B test/toyvm-rmdir-reuse-runtime-independent-accept-oct29/accept.py
Requires the pinned retained external evidence and source-read receipts at the
dispatch paths. Archived scripts confer no authorization to replay the runtime.
