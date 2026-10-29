# Independent retained rename acceptance

SCOPED_RETAINED_RUNTIME_ACCEPTED for exact production candidate
`5a88ca099b962e946160afd2d4d71a950bf46db3`. The predecessor publication is
`250946ccb975bb9ea6a6a16c5093d67598614bb6`, recorded as remote verified in the
immutable coordinator completion receipt. This task ran no production replay,
created no runtime or Boat, and changed no production source.

The retained actual CLI/FUSE fixture created D, D/S, D/T, D/T/E, recorded four
distinct inode identities, and observed `os.rename(S,T)` raising ENOTEMPTY (39).
All four directories retained their recorded inode identities (2, 3, 4, 5), and
the fixture emitted `rename-nonempty-preserved` with `nodesPreserved: true`.
The independently checked CLI exit is 0, accepted is true, stopReason and
filesystem failure are null. Post-reap measured live/peak is 20480 bytes,
written 0, inodes 5, handles 0. Both cleanup receipts pass; the FUSE unmount
returned 0, no mount remained, sampled PID/start identities were reaped, and
no external safety cleanup ran.

`accept.py` independently checks the original raw manifest and every listed
file, exact argv including unchanged fixture, source hashes before and after,
both executable identities, staging bytes, raw stdout/report consistency,
fixture output, accounting and cleanup. The five worktree sources match their
dispatch SHA256 pins and the exact candidate via a clean targeted Git diff.
It does not import a predecessor validator or execute production modules.
Twenty adversarial controls reject stale/mismatched identities, missing marker,
wrong errno/inodes/counters, changed argv/source/executable pins, failed cleanup,
remaining mounts, filesystem failure, stop reason, and absent/late source guard.

AST inspection establishes that the source nonempty-destination guard precedes
link decrement, collection and destination assignment. This is source inference.
The syscall observation does **not** prove backend callback execution; callback
entry remains **UNPROVEN**. Source arithmetic root+D+S+T+E = 5*4096 = 20480 is
inference, while the retained post-reap counters are measurements. There are no
phase counters or callback-specific trace. Process/RSS observations are sampled.
No browser, gameplay or general resource acceptance is claimed.

The unchanged passing helper controls were reused. The task-owned supervisor
was made import-safe (no mkdir or limit changes at import); its execution still
starts directly from original unlimited hard DATA, sets parent soft128 with hard
unchanged, Python child128/Git child256, and preserves physical RSS, CPU, wall,
capture, file-size and disk admission limits. No Node execution was needed.
The original and modified supervisors and receipts are retained. The 24MiB
allocation counts positive WAL once. Per-operation admissions remain unchanged.

Git status/diff emitted alternate object-store nesting warnings with exit 0;
the full initial warning is retained in `git-alternate-store-warning.txt`.
No alternate stores were changed. Only this test directory is staged using
`git add --sparse`; cached review and whitespace checks precede publication.

Retained lifecycle evidence reports bx_th7j9v6r snapshot verified at
2026-10-29T05:34:52.082Z and actually stopped at 05:34:53.158Z; original expiry
06:03:17.123Z, final archiveAfter null. This task performed no lifecycle action;
ownership stays with the coordinator. No main integration or public deployment.

Run the offline checker from this repository with Python 3:
`python3 -B test/toyvm-rename-nonempty-runtime-independent-accept-oct29/accept.py`.
`canonical.json` is the machine-readable result; `retained/` preserves original
raw evidence and manifest. Independent operation receipts are in `verification/`.
