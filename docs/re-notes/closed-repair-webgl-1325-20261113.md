# Closed repair log recovery and WebGL loss fixture

The newly closed canonical repair workers 1105, 1115, 1120, 1145, 1155,
1205 and 1225 yielded fourteen previously unencoded files: seven exact
matching session rollouts and seven worker `events.jsonl` files. All were
encoded as lossless local gzip siblings. No production change was made.

Evidence and independent recovery plan:
`scratch/runs/20261113-closed-repair-webgl-1325/`.
Keep its helpers, per-file indexes, proofs, and all original-path gzip
siblings. **Restore RAW before any old history/event consumer or resume**:

```sh
python3 scratch/runs/20261113-closed-repair-webgl-1325/restore.py ABSOLUTE_INDEX_JSON
```

Eligibility required matching completion-dedup canonical identity and root
review, actual wrapper exit zero, nonempty final, successful completion
notification, current registry exclusion, and privileged producer/launcher
absence. Full privileged FD, maps and cmdline checks passed before encoding
and before each unlink. Files were stable regular single-link files.
Only initial identity metadata was interpreted; payload bytes remained opaque.
Existing pools, indexes and helpers were untouched.

Every file passed complete raw/encoded SHA-256 and external gzip decoding.
Durable indexes and recovery instructions preceded unlink. Actual RAM
restores before and after unlink verified mode, nanosecond mtime and bytes,
and refused existing files and symlinks. A final independent full decode and
RAM restore repeated those checks for all fourteen files; all 56 retained
result/final/notification/review hashes matched. Final privileged scans had
no hits or errors.

The pool contained 10,144,361 raw bytes, encoded to 2,564,283 bytes.
Allocated reclaim was 7,581,696 bytes; after 344,064 bytes of evidence at the
resource announcement, net reclaim was 7,237,632 bytes. Fresh free disk was
1,498,521,600 bytes, still 1,478,401 bytes short of strictly exceeding the
1,500,000,000-byte floor. This exhausts the authorized new pool.

The parent `047cda46c` six-case real WebGL loss/restore fixture remains at
`scratch/runs/20261113-webgl-loss-1250/prepared-context-loss.cjs`, with its
prearmed independent deadline/disk watchdog in `run-browser.py`. Both syntax
checks passed again and exact hashes are retained. No browser was launched,
no real context-loss result is claimed, and no speculative repair was made.
The resource result was announced to Pawn/LMarbles on the coordination board.

Next: sustainable disk space above the actual floor, then serialize against
actual heavy children and run the prepared six-case browser baseline before
changing production. No box was created: ID/expiry null, state NOT_CREATED,
stop receipt N/A. Git SHA and relevant binary diff are recorded without any
source archive.
