# Rename ancestor-cycle guard repair

Directory rename op12 and zero-flags op45 now reject a destination equal to
the moved inode or inside its subtree with EINVAL before namespace, link or
collection changes. The iterative visited-set traversal follows actual namespace
edges and terminates on existing cycles. Same-path success is checked first;
valid moves to ancestors or unrelated siblings remain allowed. Only this guard
changes production; UNLINK/RMDIR and rename type repairs belong to other branches.

The byte-identical contract from commit
6273bc3af5e27c4363b2f8944d4ac0b17e0130bb is materialized here with its provenance.
The retained baseline (six required failures, eight controls passing, 16 oracle
mutations) and original runtime evidence are unchanged and were not replayed.
The coordinator independently verified baseline publication before this task.

Canonical direct-handler acceptance, from repository root:

```sh
python3 -B test/toyvm-rename-cycle-direct-parent-repair-oct29/contract.py --expect-sha256 3b7e370fd30319fb84991c77c9456491b73a2d1b98d723ebc8cc8e2c731d8860 --report test/toyvm-rename-cycle-direct-parent-repair-oct29/repaired-results.json
python3 -B test/toyvm-rename-cycle-direct-parent-repair-oct29/controls.py
```

All 14 unchanged cases and 16 oracle mutations pass. Four in-memory source
mutants (guard removal, wrong errno, late validation, overblocking) are rejected
for both opcodes. Eight additional checks cover malformed-cycle termination for
rejected and valid moves, rejection before replacement link/collection mutation,
and normal regular-file moves. Actual invocations ran through task-owned ops.py
directly under the original unlimited parent, using the exact retained startup
receipt; no nested configurator or startup replay. Per-operation admission and
supervisor receipts remain under /tmp/toyvm-rename-cycle-direct-parent-repair-oct29/e.

All four other production pins are unchanged (provenance.json). The caller still
pins the old backend explicitly: coordinator serial integration, caller pin update,
combined acceptance and any mounted/kernel qualification remain gates. This is
only direct Backend.handle behavior; the kernel may reject before callback. No
CLI, mount, browser or gameplay claim, no Boat, no main/public deployment.
No mount argv was executed or required. Git uses the coordinator's exact trusted
SSH identity and known-hosts settings through ops.py. The coordinator owns the
append-only messageboard update from the final bounded handoff note.
