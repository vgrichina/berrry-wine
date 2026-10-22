# Recovery handoff — one task complete

Base58e90870; task/shadow-man-snapshot-recovery-feasibility-oct22. No main merge.

The primary is retained locally beside this recipe as canonical-primary.wasm:
1,879,387B, SHA256 ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553.
Git preserves the recipe/receipts, not this binary. Run `python3 verify.py` from
this evidence directory to verify the artifact when present and all receipts.

Reproducible supported metadata check: `PYTHONDONTWRITEBYTECODE=1 python3
check_metadata.py`. It reads only the documented two download-metadata endpoints,
redacts signed URLs before writing, never downloads layers, and stops on denial.
Do not rerun it as routine status polling.

Canonical recovery recipe (only under a future assignment and fresh allocation
admission): `PYTHONDONTWRITEBYTECODE=1 python3 check_selective.py --canonical-only`.
The one-shot script refuses to overwrite an existing artifact. It uses existing
unchanged CLI configuration identity at the CLI status-reported path, requests
only the exact primary path via the documented /files API, refuses redirects,
requires the exact Content-Range and file kind, reads64KiB at a time, enforces
the known byte count and hash. It neither contacts the guest nor stages layers.
Never replace the preserved expected hash or substitute historical f644bbb.

Eventual installed recovery uses snapshot3ac9827f-20cf-4e1c-98a8-40b4edcd1b2f,
chainb96571ec-d987-429c-9a9e-48a9237c8e46. Actual live session files are absent
from the current merged snapshot tree. Preserved source:
shadow-man-install-continue-oct22/retained-session/{parent-vfs,parent-registry.json}.
Use raw/installed-selected-tree.json and installed-feasibility.json. Select tree
file paths individually using GET /api/v1/snapshots/<snapshot>/files?path=<encoded>
and stream directly to a future separately admitted box, with64KiB buffers and
per-file exact-size checks; hash and compare accepted original/backup manifests.
Retain registry byte-for-byte and establish its actual hash. Never reconstruct
pristine registry metadata. The inventory has no per-file hashes, so this task
does not certify the installed originals' current byte identities.

Do not locally stage any installed payload or compressed layer chain. The full
chains are89,803,816B and1,187,196,839B; exact every-generation sizes are committed.
All-three-backup immutable allocation609,730,560B; conservative mutable
parent+child+originals+metadata+fixed+reserve638,269,445B. Future cap enforcement,
filesystem properties/free>=2GiB, dependency checks and runtime qualification
remain coordinator gates. These are measured inventory-based size proofs,
not executed transfers/runtime success or fresh-compute authorization.

Both boxes remain STOPPED, expiryN/A, coordinator-owned; no cleanup shutdown is
required. Existing sandbox.resume403 is unchanged. No resume/fork retry,
new box, runtime, compilation, source repair, replacement task or worker launch.
Coordinator decides all next work. Stop at this PASS feasibility verdict.
