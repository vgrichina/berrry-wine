# ftruncate shrink/regrowth cumulative-write acceptance

PASS for one unmodified production CLI/FUSE invocation at candidate `5a88ca099b962e946160afd2d4d71a950bf46db3`. The five source pins are in `evidence/source-review.json`; fixture, observer and source oracle matched dispatch byte counts and SHA-256 locally and on the Boat before execution. Executable identities and actual argv are in `evidence/runtime-result.json`.

SETATTR computes positive growth, rejects cumulative write overflow before resize, and increments written only after successful resize. Resize changes rounded payload allocation; shrinking never refunds written bytes. Independently derived per-inode charges:

| Phase | Root metadata | A metadata | A payload | Live | Written |
|---|---:|---:|---:|---:|---:|
| Root | 4096 | 0 | 0 | 4096 | 0 |
| Create A | 4096 | 4096 | 0 | 8192 | 0 |
| Grow 8192 | 4096 | 4096 | 8192 | 16384 | 8192 |
| Shrink 0 | 4096 | 4096 | 0 | 8192 | 8192 |
| Regrow 8192 | 4096 | 4096 | 8192 | 16384 | 16384 |
| Reject 8193 before mutation | 4096 | 4096 | 8192 | 16384 | 16384 |

The table is source inference, not phase-by-phase runtime sampling. Runtime observed the exact before-regrowth-over-budget checkpoint (successfulGrowthBytes 16384, fileSize 8192, attemptedSize 8193), CLI exit 1, accepted false, and exact `filesystem cumulative write limit`. Post-reap authoritative `backendReceipt.filesystem` reports live/peak/written 16384, inodes 2 and openHandles 0: linked A remains. There is no filesystemFinal field. Source hashes remained unchanged. All sampled PID/start identities were absent or reused, production-owned identities matched, the FUSE mount disconnected, and cleanup completed without external emergency cleanup. The fixture contains no os.write payload and exactly one over-budget ftruncate attempt; no second invocation ran.

Boat `bx_t32cdxka` was preserved, snapshot-stopped and verified actually stopped; the completed stop operation is in `evidence/stopped-verified.json`. TTL was 1800 seconds, expiry 2026-10-29T05:33:02.209Z. The scheduled guard was armed before execution and cancelled by verified completion.

The first startup selftest invocation mistakenly ran below Python hard DATA 128 MiB, preventing its Git 256 MiB child. Original failure is retained. Running that control in the prescribed parent soft128/inherited-hard-unchanged topology passed; Python child128 and Git child256 stayed unchanged. This procedural failure is not a production failure and is not erased. No production sources were patched.

Acceptance is limited to this tiny-fixture boundary. Existing historical FAILs, browser fail-closed state and prior limited acceptance remain. Browser allowance is unchanged: CPU35.353183, wall101.495550694, captures1. No browser, general resource or gameplay claim is made. Root messageboard delivery is delegated to the coordinator through the task-owned publication note.
