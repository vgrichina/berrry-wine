# Source-only RENAME callback evidence

The production `fuse_backend.py` accepts an optional trailing
`--rename-evidence=N` (integer 0 through 64). Zero is the default and preserves
the original status schema. The four legacy positional forms remain supported:
`ROOT STATUS [LIVE_LIMIT [WRITE_LIMIT [FILE_LIMIT]]]`.
The Python constructor adds keyword-only `rename_evidence_limit=0`.

When enabled, the existing status socket includes `renameEvidence`:
`limit`, `callbackCount`, `countSaturated`, and oldest-to-newest `records`.
Each record contains only numeric `opcode` (12/45), `unique`, `inode`,
`errno` (positive, zero on success), and `callbackCount`.
It is appended after the production serve loop actually invokes the handler
and translates its result/exception, before attempting the reply write.
Thus this is evidence of completed callback dispatch, not proof of reply
delivery, a kernel syscall, mounting, or gameplay. Requests rejected before
dispatch produce no record. Header inode is the source parent, not the moved
child. Repeated unique IDs are not deduplicated.

Retention is an in-memory deque capped at N records. New records evict the
oldest; the callback count saturates at uint64 max, with `countSaturated=true`
at that ceiling. All retained wire identifiers are uint32/uint64 fields.
Counters cover only RENAME/RENAME2 callbacks in the current Backend lifetime.
No request names, payload bytes, credentials, timestamps, or exception messages
are added to this evidence. Existing general failure reporting is unchanged.
Status snapshots copy records, so callers cannot mutate retained records.

Run from the repository root on Linux with Python 3 and no FUSE mount:

```sh
/usr/bin/python3 -B test/toyvm-kernel-profile-accounting-backend-oct28/test_rename_wire.py
```

The fixture uses AF_UNIX SOCK_SEQPACKET to preserve FUSE message framing,
assigns its server descriptor to Backend.fd, and runs the actual Backend.serve
with the real status socket. INIT synchronizes startup. Every tested operation
travels through the wire; tests never substitute direct handle calls. The CLI
contract test stubs mount/serve only to check argument forwarding without a mount.
A removal mutant compiles the same source with the serve recording hook removed;
the enabled callback oracle must reject it.

These are source tests only. The inherited mounted six-syscall acceptance at
candidate `1ff12918dc8fe77b11db526cbd81b35d7b57a033` does not establish
per-callback coverage. This implementation changes the backend source pin.
Pin migration, independent acceptance and enabled mounted qualification remain
future gates. No Boat, runtime mount, main merge or public deployment is part
of this change.

For task recovery, use the published task branch or apply the separately retained
`recovery.patch` to that exact candidate. Keep the task completion receipt,
source-pins.json, original-source capture, parity verifier/result, and raw
supervisor test/publication receipts alongside the patch: ignored evidence is
not preserved by a Git commit. Under task resource controls, run each command
through the assigned ops.py from its original inherited parent; do not nest it
inside a capped Python process.
