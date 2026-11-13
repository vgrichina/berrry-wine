# Remaining closed worker events; Pawn capacity refusal

Run `scratch/runs/20261113-remaining-closed-events-pawn-0940/` recovered six
additional canonical processed successful closed worker event streams. The
initial four were Pawn0810, NFS0800, Pawn0850 and closed-API0830. NFS0845 and
closed-stdout0900 became eligible after their coordinator reviews during this
task and were recovered in `newly-processed/`. Final allocated accounting is
in `final-accounting.json`; phase results include their own evidence costs.

Every stream passed the parent's unchanged recovery helper: full raw and gzip
SHA-256, external gzip decode byte count/hash, complete privileged process
cmdline/output-directory/FD scans before and after encoding, stable full bytes
and metadata, actual full RAM restoration with original mode/mtime, overwrite
and dangling-symlink refusal, and another restore after unlink. Fsynced sibling
recovery records, central indexes and recipes preceded raw unlink. Result,
final, notification and coordinator review hashes remain unchanged. No already
encoded stream was re-encoded. No session, database, auth, source, media,
capture, save or foreign cleanup was performed.

The first board claim had a transcription error: it named stdout0900 instead
of API0830. The exact `eligible.json` already named API0830; its safety proofs
passed, but its explicit board correction came after encoding. This missed
the requested advance exact-path board claim for that one file. The error was
acknowledged on the append-only board; stdout0900 remained untouched until its
later explicit claim and successful canonical review. No overlapping ownership
was observed. Both recovery phases were announced immediately upon completion.

**Restore RAW before ANY old event consumer.** Preserve all six sibling `.gz`
and `.RECOVERY.json` files, both run-local `eligible.json`, `RECOVERY.json`,
central `index-*.json`, `recover.py`, and their retained proof dependencies.
Restore using `python3 PATH_TO_THIS_PHASE/recover.py restore
ABSOLUTE_PER_FILE_RECOVERY_JSON`. The original 48-stream parent recovery and
its helpers/indexes/gzip dependencies were rehashed and retained.

The final inventory contains **20 raw streams**: eight current or pending
predecessors, eleven without an unambiguous processed canonical completion,
and one failed wine-worker (Heretic2 load boundary, exit 1). **Zero eligible
streams remain at that inventory snapshot.** Individual paths and reasons
are in `final-inventory.json`, with its current registry snapshot. Already
encoded streams were counted without interpreting or redispatching payloads.

Published `418099fe9` actual CLI consumption, queued-input sweep, immutable
deadline, one-use nonce, independent release and transport UNKNOWN handling
were inspected. The current three changed files match that commit exactly;
all 321 parent source/module/media pins and 164 parent evidence seals passed.
The tested live-gzip supervisor was reused for one fresh launch decision at
**1,487,257,600 available bytes**, below strictly-above-1,500,000,000. It refused
before watchdog or native launch. The later two-stream recovery did not make
sustainable headroom; final accounting records the subsequent availability.
No original, input, uncertain replay, menu/history, Save As filename or guest
save was attempted. There is no new parent wait/EOF claim because no runtime
was launched. The inherited e4/Nf6 remains confirmed; displayed d4 commitment
remains **UNKNOWN**, second reply and save witness **UNPROVED**.

Git SHA, relevant binary diff, owned helper/note patches, parent patch hashes
and the six existing media paths/hashes preserve provenance without source or
media archives. Only this note changes tracked content; no production code
change or build is claimed. Next requires a distinct authorized material
resource outcome before an authentic guarded Pawn native history/save witness.
The exhausted eligible pool does not authorize foreign cleanup.

Box ID **none**, state **NOT_CREATED**, expiry **null**, stop receipt **N/A**.
