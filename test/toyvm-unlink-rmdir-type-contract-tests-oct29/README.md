# UNLINK/RMDIR direct production contracts (2026-10-29)

Baseline `5a88ca099b962e946160afd2d4d71a950bf46db3`, with all five
source byte lengths and SHA-256 hashes verified in `source-pins.json` before
importing the unchanged production module. Only this test directory changes.

**Contract FAIL: 6 failures, 8 controls pass.** These failures are intentionally
visible: the normal regression command exits **1**, without expected-failure
decorators or inverted bug assertions. The diagnostic evidence reader exits 0
only to confirm the six recorded counterexamples; it does **not** accept the
contract. `canonical.json` preserves every exact request, expected and observed
errno, response, complete node state, accounting state and source identity.

## Reproduce from this repository

```sh
python3 -B test/toyvm-unlink-rmdir-type-contract-tests-oct29/regression.py
# Expected on the pinned baseline: exit 1; 8 pass, 6 fail.
python3 -B test/toyvm-unlink-rmdir-type-contract-tests-oct29/regression.py --diagnose test/toyvm-unlink-rmdir-type-contract-tests-oct29/canonical.json
# Expected: exit 0, DEFECT REPRODUCED, contract NOT accepted.
```

For a later authorized production repair, explicitly add
`--allow-backend-change --output /absolute/owned/path/retest.json`. This relaxes
only the backend hash check, records its actual identity, and retains all
contract assertions. The other four pins remain mandatory. Preserve the
baseline canonical artifact instead of overwriting it during repair retests.

The actual supervised commands used here (cwd for the supervisor was
`/tmp/toyvm-unlink-rmdir-type-contract-tests-oct29`; its subprocess cwd is the
owned `repo`) were:

```sh
python3 ops.py contract-final python3 -B test/toyvm-unlink-rmdir-type-contract-tests-oct29/regression.py
python3 ops.py diagnostic python3 -B test/toyvm-unlink-rmdir-type-contract-tests-oct29/regression.py --diagnose test/toyvm-unlink-rmdir-type-contract-tests-oct29/canonical.json
```

## Source-derived boundary and outcomes

`fuse_backend.py:Backend.handle` increments operations once and consumes the
FUSE body after the server's 40-byte header. Both operations take inode 1 and
the exact body `76696374696d00` (`victim\0`). Fixtures instantiate the imported
production `Backend`, use its `create`, and use actual handle op 16 WRITE for
13-byte file payloads (`contract-data`). WRITE uses a 40-byte
`<QQIIQII` header followed by that payload. Open cases use production op 14
(file) or 27 (directory); no method is replaced. Limits match the supplied
quota preflight: live 12288, cumulative writes 65536, per-file 8192 bytes.

| Cases | Required | Observed |
|---|---|---|
| UNLINK empty/nonempty directory, closed/open (4) | EISDIR 21, unchanged state | Success; parent name removed and directory links decremented |
| RMDIR regular file, closed/open (2) | ENOTDIR 20, unchanged state | Success; parent name removed and file links decremented |
| UNLINK regular file, closed/open (2) | Empty success reply, exact removal/retention accounting | PASS |
| RMDIR empty directory, closed/open (2) | Empty success reply, exact removal/retention accounting | PASS |
| UNLINK/RMDIR missing name (2) | ENOENT 2, unchanged state | PASS |
| RMDIR nonempty directory, closed/open (2) | ENOTEMPTY 39, unchanged state | PASS |

Diagnosis: the shared `if op in (10,11)` branch checks existence, then only
checks child `names` for op 11. It never tests the child's mode. It subsequently
deletes the parent entry, decrements links and calls `collect`. Closed victims
are collected (live accounting decreases); open victims remain with links zero.
UNLINK of a closed nonempty directory additionally leaves its child inode
unreachable from the root. Peak and written remain unchanged in these failures;
the complete snapshots prove which individual fields changed. No production
repair was made because that source belongs to another worker.

All error expectations compare complete pre/post node maps including names,
mode, payload, links, opens; also next inode, live, peak, written, handles,
failure and quotas. Only the operation counter is excluded from equality and
is separately checked for one increment. Successful controls predict the exact
post-removal snapshot including collection charges and open inode retention.
The oracle self-check rejects 12 sensible result mutations: wrong errno,
live/peak/written/handle drift, links/opens drift, namespace/inode deletion,
operation-count drift, rejection of a valid operation and a nonempty success
reply. An initial self-check exposed aliased synthetic expected/actual maps;
those maps were separated before any behavioral fixture ran. No production
source was changed, including between the two behavioral runs (the second
aligned fixture limits to the supplied preflight).

## Scope and preservation

This establishes direct backend behavior only. A kernel can reject invalid
syscalls before issuing FUSE requests. No FUSE mount, Boat, external runtime,
Node execution, guest execution, gameplay, rename acceptance, or callback was
tested; callback remains **UNPROVEN**. No assigned box exists; coordinator
runtime lifecycle ownership is unchanged. The retained same-path 13 controls
were not replayed or re-reviewed.

Execution used the supplied import-safe supervisor and limit module: original
DATA hard infinity retained by parent, parent soft128 MiB, Python child128,
Git child256 only; physical parent128/group512 MiB, CPU90s, wall120s,
file12 MiB, capture2 MiB and evidence1 MiB. Each supervised operation checked
the unchanged 2 GiB available-memory and disk floors, with the transferred
24 MiB allocation and positive WAL counted once. Receipts and command output
are in `evidence/`. No checkout or mount was performed; mount argv/file set is
empty, so no mount-parser execution applies. Trusted SSH configuration is
provided unchanged by `ops.py` for Git operations. The coordinator's initial
root-ref digest receipt was reused; no root-ref listing was captured.

Remaining gate: coordinator integrates these failing regressions with an
authorized backend type repair and obtains a passing direct-handler retest.
This task makes no main/public deployment or mounted acceptance claim.
