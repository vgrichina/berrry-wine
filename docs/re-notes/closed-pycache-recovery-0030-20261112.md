# Closed-run Python cache recovery, 2026-11-12

Removed **443 disposable host Python caches** from 132 reviewed, terminal-0 scratch runs: **1,805,244 logical bytes / 2,588,672 allocated bytes**. All corresponding sources and existing full-addition helper patches remain unchanged. No gameplay, production source, current tools, binaries, media, saves, captures, logs, source archives, vendor caches, reserves, databases, or sessions were changed. No box was created; state `NOT_CREATED`, ID/expiry/stop receipt not applicable.

Evidence: `scratch/runs/20261112-closed-pycache-recovery-0030/`. `context.json` records the starting Git SHA, actual reproducer executable SHA/version, current worker registry and ledger hashes. Evidence is ignored by Git; the committed note is its recovery pointer. `own-helper-recovery.patch` preserves only this run's new audit/recovery helpers, without a source-tree snapshot.

The complete read-only inventory contained 2,833 caches, 13,590,844 logical bytes and 19,357,696 allocated bytes. These were upper bounds. Final retained/excluded count: **2,390**:

| Reason | Files |
| --- | ---: |
| No direct canonical terminal-0 review mapping | 1,266 |
| No exact retained Git/full-addition helper-patch source proof | 870 |
| Missing or symlinked corresponding source | 83 |
| Active/sensitive prefixes (including all GLTron, NFS3, Heretic/Heroes runs) | 122 |
| Stale cache header | 13 |
| Unsafe path/link metadata | 33 |
| Original completion only inherited through another task: restored | 3 |

The initial broad mapping incorrectly admitted three Alice caches through a later task's inherited reference. Final review caught this; all three were restored exactly, including original mode/mtime. `restored-excluded.jsonl.gz` records this correction. Net removal is 443, not the initial 446 unlink operations. `canonical-own-run-proofs.json.gz` records direct published-note/run references and the canonical reviewed actual terminal-0 result for every retained removal.

Each removed cache passed retained-source SHA plus exact full-addition patch reconstruction, matching interpreter magic, header/source freshness, and byte-for-byte compilation in isolated `/dev/shm`. Only trusted retained host Python source was compiled; helper/game code was never imported or executed and no guest data was inspected. The reproducer was `/usr/bin/python3`, Python **3.12.3**, with its complete version string and executable SHA recorded per file. PYC magic does not independently identify the original creator's patch version; the recorded version is the tested exact reproducer. Header flags, optimization, original `co_filename`/`dfile`, compile options, source metadata and original cache SHA/size/mode/mtime are recorded per file.

Before each unlink, `recovery-index.jsonl` was flushed and fsynced with the exact successful candidate comparison and first privileged process scan. A second independent privileged `/proc` scan checked command lines, file descriptors, mappings, executable, cwd and root references. Stable cache/source/patch metadata and hashes were checked again, and the second scan was fsynced in `pre-unlink.jsonl` before unlink. Parent cache directories were fsynced afterward. All scans ran with effective UID 0; inaccessible process scans would reject deletion. Those indices are now losslessly gzip-compressed and roundtrip-verified, with the run directory fsynced.

Every candidate's full restore was tested in RAM before deletion, including SHA/size equality, original mode/mtime, and refusal to overwrite. All 443 final removals were restored again in RAM from the durable index after deletion. Final source hashes/metadata and retained patch hashes remained unchanged; all removed paths were absent. See `final-verification.json`, `results.jsonl.gz`, and the two privileged scan indices.

To restore a selected cache from its retained source, inspect its zero-based index row first:

```sh
gzip -dc scratch/runs/20261112-closed-pycache-recovery-0030/recovery-index.jsonl.gz
/usr/bin/python3 -I -B scratch/runs/20261112-closed-pycache-recovery-0030/recover.py restore INDEX /dev/shm/CHOOSE-ABSENT-DESTINATION
```

The explicit destination command tests a single cache entirely in RAM. Omit the destination only to restore its original cache path. The helper refuses an existing destination, changed source SHA, different interpreter version/magic, or nonexact compilation, then applies original cache mode/mtime. It never executes the source. The index also identifies the retained full-addition patch, its SHA and original patch line/target should source recovery ever be necessary. Preserve both source and patch. Do not rerun the deletion/audit phases: their original inventory inputs have deliberately been compressed after completion.

Free space is shared and changed concurrently: starting observation **1,490,575,360 B**, immediately before deletion **1,485,815,808 B**, immediately after 446 initial unlinks **1,487,052,800 B**. The final observation is recorded in `final-space.json`; attributable reclaimed bytes are the net file totals above, not the difference between shared filesystem samples. The requested floor was **not restored**. Next: obtain additional independently justified capacity before native gameplay; no native/new API activity or allocation was performed here.

Validation was confined to exact cache reproduction/recovery, canonical completion/source proof, privileged process scans, metadata stability, compression roundtrips and the final inventory. No production code/build change was made, so no gameplay build was required or run.
