# Closed worker event recovery; Pawn native witness capacity blocker

Run `scratch/runs/20261113-closed-worker-events-pawn-0920/` recovered **48 closed
worker event streams** locally and losslessly. The recovery stage saved
**19,243,008 allocated bytes**, including its evidence. Final task accounting
is in `final-accounting.json`; it also charges the subsequent Pawn evidence
and this note. This is a distinct events-only recovery, not a repeat of the
prior stdout qualification that found no material pool.

Only `scratch/usage-watch/*/events.jsonl` was eligible. Each claimed path had
a canonical already-processed completion matching the first `thread.started`
UUID and output directory, actual wine-worker exit 0, a nonempty final file,
and completed notification. Current registry workers and their pending
unreviewed predecessors were excluded, along with missing, rejected,
ambiguous, failed, symlink, multiple-link and already encoded candidates.
No age or arbitrary size budget established closure. No later event payload
was interpreted. Result, final and notification files remain raw and their
full hashes were verified unchanged after recovery.

Encoding streamed into a sibling gzip. Full raw/encoded SHA-256, external
`gzip -dc` byte count/hash, and actual full restoration under `/dev/shm`
passed for every file, including mode/mtime, overwrite refusal and symlink
refusal. Complete privileged process scans checked cmdlines and file
descriptors across `/proc`, including the output directories, before and
after encoding; all had zero hits/errors. Original metadata and full hash
were rechecked. Fsynced per-file recovery records, central index entries and
the recovery recipe existed before raw unlink, followed by directory fsync.
Each file also passed an actual RAM restore after unlink.

**Restore RAW before ANY old event consumer.** Retain every sibling `.gz`
and `.RECOVERY.json`, this run's `eligible.json`, `RECOVERY.json`, central
`index-*.json`, `recover.py`, and helper/proof dependencies. Restore one file
with `python3 scratch/runs/20261113-closed-worker-events-pawn-0920/recover.py restore ABSOLUTE_PER_FILE_RECOVERY_JSON`.
The helper refuses existing destinations, including dangling symlinks.
No external offload, session-history recovery, SQLite access, media cleanup
or source changes were used.

The fresh Pawn run reused the tested `dfbbfcf61` LIVE whole-gzip stdout route
and the actual owner binding qualified by `2404d8b55`. Before freezing, the
published NFS0910 delta `418099fe9817deeb3a96d0f834d3a0ac9de765f0` was
reviewed: opt-in guarded commands and input-consumption sweep, cancellation
and shutdown additions. The two changed runtime pins matched those committed
bytes, with no runtime WIP; its new helper was added to the pins explicitly.
The current04 module, six media files and remaining inherited pins matched.

An independent watchdog was armed before the single original launch, whose
fresh prelaunch sample was **1,502,392,320 bytes**. Personally reviewed full
boards authenticated ordinary e2–e4 followed by Ng8–f6, then an individually
reviewed d2–d4. Both drags used independently armed UP processes with actual
successful waits. The second position displayed d4, but no second AI reply;
commitment remains **UNKNOWN**, reply **UNPROVED**. The observer showed a
healthy same-owner software Worker, released mouse, empty input/post queues
and drained render work; this does not diagnose the guest's turn state.

The next ordinary Game-menu click, intended to reach native history/Save As,
was refused **before input** at **1,498,464,256 bytes**, below the required
strictly-above-1,500,000,000 floor. There was no native history interaction,
filename entry or guest-produced save. No uncertain move was replayed, no
third move was sent and no causal production fix is claimed. The helper
requested ordinary quit promptly. Native and watchdog actual waits were
both 0 with both EOFs; both gzip streams sealed with full decode/hash
verification, and all four recorded native/watchdog/UP PIDs were absent.

Git SHA, relevant binary source diff, reviewed published delta, owned helper
patches and retained parent patch/hash references preserve source provenance.
Media is referenced by existing path and SHA rather than copied. Only this
note changes tracked content; no production build is claimed or required.

Next needs sustainable authorized headroom for an ordinary native history
and Save As filename/file witness before assigning a cause to the unresolved
second turn. Recovery succeeded materially; the native witness remains
blocked by the concrete input-time capacity refusal.

Box ID **none**, state **NOT_CREATED**, expiry **null**, stop receipt **N/A**.
