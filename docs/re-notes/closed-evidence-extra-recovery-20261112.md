# Additional closed observation recovery, 2026-11-12

Run: `scratch/runs/20261112-closed-local-headroom-recovery-1455/`.
At 15:08:12 UTC, `/home` had 1,918,017,536 bytes free: 418,017,536 bytes
above the 1.5 GB floor and 412,327,936 bytes more than the initial measurement,
despite concurrent shared-tree writes. The 498 removed wrappers totaled
524,255,124 bytes; 111 packs and indexes total 76,042,527 bytes, saving
448,212,597 bytes. All 10,702,453,020 raw observation bytes remain local.
The four other planned wrappers were retained because packing offered no net
saving. The coordinator received resume notices at 15:02:31 UTC (108 MB margin)
and 15:05:23 UTC (310 MB margin). This remains finite, monitored headroom.

This extends the [1415 recovery](closed-evidence-disk-recovery-20261112.md)
without rescanning unchanged immutable duplicates or reprocessing its exhausted
plan. Only explicitly selected November 7–9 closed generated observations and
custody journals are eligible. Every selected run has a closure entry on the
messageboard. Active C3/Half-Life/Diablo II/Heroes II artifacts, native saves,
original media, source trees, conversation stores and active logs are excluded.
No sandbox, box or additional worker was created.

The helper [closed-evidence-extra-pack-20261112.py](closed-evidence-extra-pack-20261112.py)
retains the proven grouped raw-JSON XZ representation and exact original gzip
reconstruction checks. Its fixed path allowlist includes ordinary generated
observations and old debugger responses whose empty `scriptSource` and
WASM `bytecode` were inspected. These are existing runtime observations;
no source archive is created and no unique module bytes are discarded.

Raw bytes stream in 1 MiB chunks. A gzip codec is recognized from a compressed
prefix, with full streaming SHA comparison when a repetitive sample emits no
complete block or matching prefixes later diverge. An initial ambiguous-prefix
batch safely retained its originals; the corrected full comparison passed on
resumption. Unsupported headers/codecs fail before replacement. The pack
and index are created exclusively, fsynced, reread and SHA-verified; every raw
row and reconstructed original gzip must match before originals are checked
again and unlinked. Packs that provide no net saving retain their originals.
The source directories are fsynced after unlink.

Each of 96 affected source directories has `EVIDENCE-RECOVERY-1455.md`, listing its
indexes. Restore into a separate owned destination from the repository root:

```sh
python3 docs/re-notes/closed-evidence-state-recover-20261112.py \
  scratch/runs/20261112-closed-local-headroom-recovery-1455/INDEX.raw.json \
  /dev/shm/owned-restore
```

The output retains original repository-relative paths. Existing destinations
are refused. `--raw-json` restores the raw observations independently of the
gzip codec. Each index records pack/raw/original SHA-256, offsets, sizes, gzip
headers/trailers/level, metadata, and Python/zlib versions. Exact gzip recovery
requires those recorded codec versions. Mode and mtime are restored; uid/gid,
inode and ctime are recorded rather than recreated. Do not disable Python
assertions. Large journals should be streamed or restored on a separate
adequately sized filesystem.

The run retains explicit plans, closure evidence, the open-file audit, pack
logs, standalone restoration receipts, focused codec/protection tests and Git
provenance. Evidence stays local and outside Git. The open-file audit observed
only this worker's packer reading a selected path. No runtime code changed;
the focused Python tests and complete restoration checks validate this change.
All 498 original gzip files were independently restored in owned tmpfs space,
reread and checked for SHA-256, size, mode and mtime. Every pack refused an
attempt to overwrite its restored files. Eight codec/header combinations,
protected-path refusal and refusal to run with Python assertions disabled
passed. `final-audit.json` accounts for all 502 planned paths; complete results
are in `standalone-proof.json`, `focused-tests.json` and the preserved logs.
