# Recent closed rollout recovery; NFS remains below disk floor

Recovered all eight explicitly assigned canonical processed worker rollouts
(0800, 0810, 0850, 0830, 0845, 0900, 0915 and 0910) as local `.jsonl.gz`
siblings. Their 18,788,936 raw bytes became 10,097,911 encoded bytes;
the allocation difference was **8,695,808 bytes** before retained evidence.
The qualified eight-session raw pool is now empty. This does not claim that
all other sessions are exhausted or eligible.

Evidence: `scratch/runs/20261113-recent-transcripts-nfs-1030/`.
`proofs.json`, `eligibility.json` and the eight `index-UUID.json` files record
the exact paths, matching session identities, stable regular single-link
metadata, full raw/encoded SHA-256 and successful wrapper/final/review proofs.
Only session identity and complete JSONL syntax were inspected; remaining
payloads were treated as opaque bytes. Canonical registry exclusions and
privileged producer/launcher absence checks passed. Complete privileged FD
and mapping checks passed before encoding and immediately before each unlink.

Reused the tested local gzip/restore recipe, retaining independent local
copies of the helpers. Gzip bytes, indexes, helper dependencies and recovery
instructions were durable before raw unlink. Each file passed a complete
external `gzip -dc` comparison, actual RAM restoration with exact mode/mtime,
and overwrite/symlink refusal before and after unlink. Final verification
repeated the full decode, RAM restore and refusals for all eight files and
rehash-checked all 24 owner proof files. Existing recovery dependencies were
preserved; no old history consumer or resume was invoked.

**Keep all eight gzip siblings, this evidence directory, indexes and
`restore.py`. Restore raw bytes before any old history consumer or resume:**

```sh
python3 scratch/runs/20261113-recent-transcripts-nfs-1030/restore.py \
  scratch/runs/20261113-recent-transcripts-nfs-1030/index-UUID.json
```

The helper verifies complete encoded and raw size/SHA in RAM, exclusively
creates the original destination without following symlinks, restores mode
and nanosecond mtime, and fsyncs the file and directory. Existing destinations
are refused. Keep encoded bytes and indexes after restoration.

The resource phase was published immediately on the append-only board.
The fresh post-recovery NFS decision measured **1,487,118,336 available bytes**,
12,881,665 bytes short of strictly exceeding 1,500,000,000. NFS was refused:
zero runtime launches and input effects. Native chooser submission/export,
race, actual Pause/Continue timer stability, and reviewed 1500 ms held driving
remain unproved. Published guard `418099fe9` is retained; 147 source/media pins
and nine route references passed verification without copying game media.
Next requires distinct authorized sustainable disk recovery, followed by a
fresh disk check and the original native NFS task. No floor polling or replay
of uncertain input occurred.

Git commit identity and relevant binary diff are retained in `source-head.txt`
and `relevant-source.patch`; owned new files are retained as patches. No source
archive, database, auth/configuration, media, capture, save, event pool or
production code was changed. Focused recovery verification passed; no build
was required for this documentation-only publication. Watcher completion was
actually waited (timeout exit 124). Box: none, NOT_CREATED, expiry null;
stop receipt and runtime parent/both-EOF waits are not applicable.
