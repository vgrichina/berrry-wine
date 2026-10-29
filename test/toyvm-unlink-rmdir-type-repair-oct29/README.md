# UNLINK/RMDIR type repair

Baseline: `5a88ca099b962e946160afd2d4d71a950bf46db3`.
The regression and source-pins.json are byte-identical to the published regression
at `cd860b562d1524d49d98fc9b3a148f66bbbf3bc3`; see provenance.json.

The production change adds two mode checks after missing-name lookup and before
nonempty checks or namespace/link/collection mutation. UNLINK directories returns
EISDIR (21); RMDIR regular files returns ENOTDIR (20). Rejections preserve every
node, name, link, open count and live/peak/written value; operations increments once.
No rename code changes.

`baseline.json`: six demonstrated failures, eight passing controls, twelve rejected
oracle mutations. `canonical.json`: unchanged regression, 14/14 PASS, twelve oracle
mutations rejected. The only allowed changed pin is the backend; actual hashes are
recorded in canonical.json. `mutations.json`: removing either/both guards, swapping
errnos, or moving guards after namespace deletion all fail the unchanged oracle.
Missing ENOENT, nonempty ENOTEMPTY, valid removal and open-handle controls pass.

Reproduce from repository root with Python 3:

```
python3 -B test/toyvm-unlink-rmdir-type-repair-oct29/regression.py --allow-backend-change
python3 -B test/toyvm-unlink-rmdir-type-repair-oct29/mutations.py
```

Execution used task-owned ops.py with fresh per-operation aggregate admission,
128 MiB Python DATA, parent soft128/inherited hard unchanged, 256 MiB Git DATA,
90 CPU seconds, 120 wall seconds, 12 MiB file, 2 MiB capture and monitored physical
parent128/group512 MiB limits. Receipts and recovery scripts are in evidence/.
No checkout or mount command was issued, so no filename-bearing mount argv exists;
no Node, Boat, browser or game was run. Trusted SSH settings are in evidence/ops.py.
Original passing runtime evidence was read-only and remains unchanged.

Acceptance is direct actual Backend.handle only. A kernel may reject requests before
the callback. Mounted/kernel callback and gameplay acceptance remain unproven.
The CLI caller still pins the OLD backend: updating/qualifying that caller is an
explicit future gate. Coordinator must serialize integration with independently
accepted rename work and rerun relevant acceptance. Cycle repair is out of scope.
No box was assigned; lifecycle ownership stays with the coordinator.

Raw baseline/repaired stdout is losslessly JSON-encoded to preserve trailing spaces.
