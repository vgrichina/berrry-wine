# Recent closed-worker recovery and NFS capacity blocker

Six newly eligible canonical wine-worker rollouts were losslessly encoded as
local `original.jsonl.gz` siblings on 2026-11-13, largest first. Raw bytes total
6,492,686; gzip bytes total 2,422,875. Their allocated-file difference reclaimed
**4,071,424 bytes**, before evidence overhead. No earlier 23-file allowlist was
repeated and all earlier recovery material remains retained.

The final recovery-verification `/home` sample was **1,480,351,744 available
bytes**, 19,648,256 bytes below the required 1,500,000,000-byte floor. Shared
free-space changes are not attributed to this worker. The authorized candidate
set cannot provide the missing capacity: all six eligible raw files are now
encoded; the remaining matching histories are excluded. This is a demonstrated
scope-exhaustion blocker following the prior NFS post-provision floor loss.
No box was created and no native NFS input was sent. Native Pause/Continue,
positive finite driving, bends and lap remain UNPROVED.

Evidence and recovery material are in
`scratch/runs/20261113-closed-recent-recovery-nfs-0250/`. `eligibility.json`
records the exact six paths, original SHA-256, size, mode, nanosecond mtime,
inode and allocation. Selection used only the canonical `processed` mapping
in `scratch/usage-watch/completion-dedup.json`, after midnight UTC, with
matching read-only wine-worker result exit0 metadata, final presence/hash,
and canonical review identity. The GLTron0050 review's failed Diablo dependency
scope and graphics0150's failed supervisor/UNKNOWN runtime histories were
excluded, along with both Diablo families. Later processed GLTron0230 also
remains excluded because its runtime finish is UNKNOWN. Current registry
paths/IDs and both coordinator IDs were excluded. No unprocessed, rejected,
active/root or Diablo rollout was opened or encoded.

Each selected raw file passed first-session_meta UUID/cwd identity, complete
newline-terminated JSONL syntax and stable metadata checks. Other payloads were
opaque. Seven privileged `/proc` FD/map censuses reported zero openers and
zero inspection errors. Before every raw unlink, the local gzip and directory,
exclusive per-session recovery index and recipe were fsynced; encoded and
decoded full SHA-256/size checks passed. Actual RAM restores preserved mode and
mtime and refused overwrite. Registry identity was rechecked before every
unlink. Final independent gzip decoding, RAM restoration and provenance
rechecks passed for all six; result/final/review files were unchanged.

**Keep every local gzip, index, RECOVERY.txt and restore.py. Restore the raw
file before any future history consumption or resume.** The exclusive restore
recipe is:

```sh
python3 scratch/runs/20261113-closed-recent-recovery-nfs-0250/restore.py \
  scratch/runs/20261113-closed-recent-recovery-nfs-0250/index-UUID.json
```

It verifies full encoded and decoded hashes/sizes in RAM, refuses an existing
destination, restores original mode/mtime and fsyncs the file and directory.
Encoded bytes and indexes must remain after restoration.

This run records the exact starting Git SHA, relevant binary diff, new helper
addition patches with RAM reconstruction verification, and a reread hash
inventory. No source/media archive was made. The prior NFS0220 frozen607,
609 remote checks, code0/bothEOF provisioning and49 recovered outputs remain
historical reuse proofs only; its archived box was untouched. No production
source, DB, auth/config, event, cache, vendor, binary, reserve, media, Diablo
input or active worker history changed. Focused recovery checks passed; this
docs-only publication requires no production build.

Box ID none; state NOT_CREATED; expiry null; stop receipt not applicable.
Next: retain recovery bytes and obtain additional explicitly authorized capacity
before a fresh watched NFS box, then establish native Pause with two stable
frames and review one finite drive of at least1500ms with a held frame before UP.
