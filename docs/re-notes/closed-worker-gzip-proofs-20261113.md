# Closed canonical worker rollouts: verified local gzip recovery

On 2026-11-13, 23 closed wine-worker canonical session files were losslessly
encoded as local `original.jsonl.gz` siblings. Original bytes total 145,065,975;
encoded bytes total 95,806,061. The file allocation difference is **49,254,400
bytes reclaimed**, before the small retained recovery evidence overhead.

Actual `/home` available-byte samples were 1,476,890,624 before work,
1,519,116,288 after encoding, and 1,517,903,872 after final recovery verification.
These are shared-filesystem observations, not attributed net savings. The final
verification sample exceeds the 1,500,000,000-byte floor by 17,903,872 bytes;
future capacity decisions require a fresh sample.

Evidence and recovery material are retained in the ignored directory
`scratch/runs/20261113-closed-worker-gzip-proofs/`. Keep that directory and every
encoded sibling. `eligibility.json` contains exact paths, original SHA-256,
size, mode, nanosecond mtime, inode and allocation metadata. Each exclusive
`index-UUID.json` additionally records the encoded SHA-256 and size and the
closed-worker result/final provenance.

Selection used the coordinator's 24 proofs in
`scratch/runs/20261113-closed-worker-eligibility-proofs/proofs.json`. Referenced
closed result metadata and final bytes were read only to verify terminal exit
0, wine-worker profile, presence, sizes and hashes. The entire Diablo II session
candidate was excluded. The live registry
`/tmp/wine-coordinator-current-launches.json`, its task/output paths, explicitly
supplied current thread IDs, and both coordinator IDs were excluded. Registry
identity was rechecked before every removal. Exact eligible paths were owned
on the append-only messageboard before encoding.

Every selected file passed first-record session_meta UUID/cwd identity,
complete newline-terminated JSONL syntax and stable metadata checks. Other log
payloads were not interpreted. Privileged complete `/proc` FD and mapping
censuses found no openers and no inspection errors. Each gzip file and parent
directory, exclusive recovery index and recovery recipe were fsynced before
raw removal. Whole independent `gzip -dc` decodes matched original size/SHA.
Every file was actually restored in RAM with exact bytes/mode/mtime and
overwrite refusal. Final verification also restored every original canonical
path from its durable index, checked bytes/mode/mtime and overwrite refusal,
rechecked registry/no-openers/stability, then removed the raw files again with
the encoded bytes and recovery provenance retained. Helpers were explicitly
fsynced before these final removals.

**Restore raw bytes before any future history consumption or resume.** For one
session, run from this checkout:

```sh
python3 scratch/runs/20261113-closed-worker-gzip-proofs/restore.py \
  scratch/runs/20261113-closed-worker-gzip-proofs/index-UUID.json
```

The recovery helper verifies both encoded and decoded size/SHA in RAM, opens
the original path exclusively without following symlinks, restores original
mode/mtime, and fsyncs the file and directory. Existing destinations are
refused. Keep the gzip and index after restoration. `RECOVERY.txt` is the
durable local recipe; `encoding-results.json` and `final-verification.json`
record per-file checks and observed free space.

No production source, game media, Diablo II dependency, cache, binary,
reserve, active/root session, authentication/configuration, SQLite,
thread_history or usage-watch event was modified. No offload, new box,
worker or child agent was used. Box ID: none; state NOT_CREATED; expiry null;
stop receipt not applicable. Focused recovery checks passed; this docs-only
publication requires no production build. Next: retain all recovery material,
use fresh free-space samples, and restore raw history before consumption.
