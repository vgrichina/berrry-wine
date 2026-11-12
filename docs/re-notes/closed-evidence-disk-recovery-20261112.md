# Closed evidence disk recovery, 2026-11-12

Recovery run: `scratch/runs/20261112-closed-evidence-disk-recovery-1415/`.
The task began with 1,394,286,592 bytes available on `/home`, below the
1,500,000,000-byte floor. At 14:26:13 UTC, available space was 1,701,826,560
bytes: 201,826,560 bytes above the floor and a measured increase of 307,539,968
bytes despite concurrent shared-tree writes. The 192 wrappers totaled
464,046,793 bytes; 25 packs plus indexes total 147,365,913 bytes, saving
316,680,880 bytes. All 8,280,643,379 raw observation bytes remain local.
The final audit is `final-audit.json` in that run. The coordinator received a native-resume
message on the append-only messageboard at 14:22:43 UTC, after available space
reached 1,655,918,592 bytes; cleanup continued to improve the margin.

The supplied 187 inactive generated state gzip wrappers (213,977,970 bytes) in
seven November 7 Lords2 runs and the November 9 SuperTux prompt run were grouped
as raw JSON in local XZ packs. Five explicitly selected, closed November 7–8
observer/graphics/Darkstone diagnostic journals use the same representation.
The original observations remain local. C3, Diablo II, Half-Life, Heroes II,
native saves, source/media archives, conversation stores, and active logs were
excluded. No sandbox or worker was created.

Each `*.raw.json` index maps original repository-relative paths to a sibling
`*.raw.xz` pack, raw offsets, lengths, and SHA-256 hashes. It retains the exact
gzip header (including optional filename and timestamp), compression level,
original gzip size/hash, filesystem metadata, and Python/zlib versions. Journal
rows also retain gzip trailer bytes. Raw JSON is compressed directly, allowing
shared observations to compress across file boundaries. Pack creation stages
only compressed output in tmpfs; journal raw bytes stream in 1 MiB chunks.

Before deleting any wrapper, the worker persisted and fsynced its replacement
and index, fsynced their directory, reread the index and pack hash, decoded every
row, reconstructed the original gzip, and matched the original bytes/hash.
The source was checked again immediately before unlink. Source directories were
fsynced after unlink. Initial unsupported-header and codec failures left every
affected original in place; resumed attempts proved the correct filename header
and level-3 journal codec before removal. These failures and resumptions remain
in the run logs. A subsequently added no-net-saving guard retains originals
when pack plus index would be larger.

The standalone restore proof writes original files into an owned tmpfs
directory, then independently rereads every gzip and checks size, SHA-256, and
mtime. Receipts are in `standalone-restore-proof.json`. The mixed level-9/level-1
historical container test in `mixed-level-full-container-test.json` reconstructed
all 14 gzip rows and the entire prior XZ container, matching its original
SHA-256. Raw-JSON restoration of the three-row level-1 pack and refusal to
overwrite existing destinations also passed; see
`raw-json-and-overwrite-proof.json`.

To restore an index from the repository root:

```sh
python3 docs/re-notes/closed-evidence-state-recover-20261112.py \
  scratch/runs/20261112-closed-evidence-disk-recovery-1415/INDEX.raw.json \
  /dev/shm/owned-restore
```

Use a separate, owned destination. The output retains repository-relative paths.
Use `--raw-json` for observation bytes without gzip wrappers. For older Lords2
`closed-state-packs/*.raw.json`, `--container` reconstructs the entire original
XZ container; it verifies each gzip and the container's original SHA-256.
The older helper path `scratch/usage-watch/recover-raw-state-pack-20261112.py`
is synchronized with the version tracked beside this note. The pack creation
helper is `closed-evidence-state-pack-20261112.py`; its hard allowlist prevents
application to active families or arbitrary filesystem data. Recovery pointers
were added to all thirteen affected closed source directories.

Exact gzip/container reconstruction depends on the Python/zlib versions pinned
in each index. Raw observation recovery only requires an XZ decoder and the
indexed offsets/hashes. Mode, mtime and available atime are restored; original
uid/gid, inode and ctime are recorded, but the helper does not recreate inode,
ctime or ownership. Do not run either helper with Python assertion checks
disabled. Do not expand the 2.58 GB observer journal onto `/home`; stream the
pack, or use an adequately sized separate destination.

Evidence, manifests, hashes, original plans, failed-attempt logs, helper patches
and source Git references remain in the run directory. The two earlier root
recode scripts are retained as source patches, not source-tree snapshots. The
only Git changes for this task are this note and its two recovery helpers;
no runtime code was changed. The 1.5 GB floor remains a live constraint: this
recovery provides finite headroom, and concurrent native evidence writes can
consume it. Larger capture/source archives and all unproven candidates remain
untouched.
