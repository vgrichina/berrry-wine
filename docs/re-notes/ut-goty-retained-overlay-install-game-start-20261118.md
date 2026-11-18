# UT GOTY retained overlay: identical-payload reuse and disk admission blocker

## Storage improvement (later task, 2026-11-18)

Evidence: `scratch/runs/20261118-overlay-identical-write-reuse-ut-install/`.
`nodeDirStore` now reuses an immutable blob only after an exact byte comparison.
Candidates are grouped by stored payload length, with the current path checked
first; cross-file and same-batch aliases work without changing the version-1
index format. Comparisons use bounded reads. Metadata remains per record,
including attributes, timestamps, sparse layout, directories and whiteouts.
Publication still writes new blobs before atomically replacing the index;
collection and rollback retain all referenced aliases. Historical SHA-1 and
UUID blob names need no migration. This improves storage capacity; it is not
evidence of a guest or API defect.

A real 4 MiB filesystem control measured the old equal-overwrite-plus-alias
publication peak at 12,582,912 allocated payload bytes (three blobs), settling
at 8,388,608. The new store's peak and final allocation both stayed at
4,194,304 bytes (one blob). These are `stat.blocks * 512` measurements, not
logical file lengths or a deduplication estimate.

An authentic recovery fork copied the genuine 415-record index and hardlinked
its immutable blobs. Two rounds of normal store re-persistence, in batches of
32 records with fresh store instances between rounds, preserved every payload
and all metadata without allocating new payload blocks. The retained payload
total is 448,673,130 bytes. Every resulting file still referenced its original
base inode. The disposable fork was removed after verification. Both genuine
partial overlays were SHA-256 verified before and after; neither index nor
payload bytes changed. The unique CD1 ISO also remains unchanged and uncopied.
This is filesystem recovery/storage evidence, not an installer execution or
an invented installed tree.

All 33 overlay tests, the persistence-restore test, 12 publication tests and
the locked build passed. The OPFS browser test skipped because Chrome was not
found. The genuine Winamp installer regression passed installation, restart
hydration and SIGTERM final flush using published Git sources in memory plus
the owned store change and the clean `a6002d5d…` module. An earlier invocation
refused before guest launch because the shared-tree region mirror differed
from that module; its failed receipt is retained separately. Shared foreign
runtime changes were not adopted into the successful regression graph.

UT was not launched. Admission measured 2,040,721,408 bytes free. Reserving
the genuine default component page's 702,545,920 bytes leaves 1,338,175,488,
which is 161,824,512 below the 1,500,000,000-byte floor before transient
flushes, logs and drains. Equal-byte re-persistence proves reuse but does not
bound Setup's different or intermediate writes; crediting all retained bytes
as guaranteed installer savings would be unsupported. Safe capacity therefore
remains unproved. Install 1200 / total 2400 / final 300 seconds were declared
before admission; no UT clock started, old scope replay, endpoint request or
extension occurred. Installation completion, game startup and ordinary Quit
remain unverified. No new installer images exist. Box ID, expiry and stop
receipt are null; state is NOT_CREATED.

## Earlier read-only investigation (before payload reuse)

Evidence: `scratch/runs/20261118-ut-goty-retained-overlay-install-game-start/`.
No new installer or original game process was launched. Installation completion,
startup, gameplay and ordinary Quit remain unproved. Both predecessor runtime
scopes remain closed UNKNOWN, with no endpoint request or replay.

Read-only verification found the larger partial overlay unchanged: 415 records,
395 files, 20 directories, 448,673,130 blob bytes, index SHA-256
`c60cdcbe4f3e5bfbeec2b89dc6f254a38d2ad369d6de130dee39a97f12448811`.
Every referenced blob matches the prior retained size and SHA-256. AS-Frigate
is a zero-byte persisted file despite the prior live 60% expansion observation.
The older 16 retained index/blob artifacts were also hashed and checked against
their original artifact manifest. Neither partial tree is an installed game.

Normal recovery is `nodeDirStore` plus `VfsOverlay.hydrate` before DLL discovery.
The CLI accepts one writable `--overlay-dir`; it has no read-only overlay base
or content-addressed blob reuse option. Each file write creates a UUID blob;
the index is replaced atomically, then superseded blob names are unlinked.
A tiny real-store probe established that an exact index copy with hardlinked
immutable blobs can fork a partial filesystem without changing the base's index
or bytes when the fork is subsequently written. The genuine partial filesystem
was not forked or written. This probe proves filesystem recovery mechanics,
not installer resume behavior or a reduction in Setup's output allocation.
Per-file `--vfs-mount` was rejected as an exact recovery route because it
synthesizes attributes and does not preserve directory/time/whiteout semantics.

A fork saves initial duplication, but ordinary Setup may replace existing
files. The store does not deduplicate equal output; preserved base links keep
old bytes allocated. All new batch blobs precede index publication and old-blob
collection. A synchronous flush can therefore cross the floor before a separate
poller can intervene. Crediting the existing 448 MB against new writable
capacity would not establish safe expansion and flush.

At admission, actual free space was 1,974,247,424 bytes. The genuine prior
default component page's conservative 670 MiB requirement is 702,545,920 bytes,
leaving 1,271,701,504 bytes. This is 228,298,496 bytes below the required
1,500,000,000-byte floor, before any allowance for transient flush blobs,
logs or concurrent writers. Fresh Setup and an overwrite-capable retained fork
both fail this conservative admission. No media copy, foreign deletion,
manual extraction into the guest, guest/configuration/registry/state patch,
file omission or fabricated installation state was used. The bounded blocker
is insufficient proven disk capacity, not a new installer failure.

Published Git `0b55b3c2f1be569f8799ee1390ebfd8c620cb39b` compiled directly
from Git objects to module SHA-256
`a6002d5dbcfeb534a0eadd223da616e525aa1542dad2bde381fe54e00ee862f8`
(2,418,710 bytes). A memory-only Git source inventory and loopback HTTP byte
checks exclude held shared-tree WIP. This was preparation, not a browser or
native execution. Current authored wizard/progress helpers, native scene/progress
guards and supervisor match published Git. Prior native/CPUWorker controls are
inherited evidence; they were not rerun here. The prior original's `204a3300…`
module included the unarmed foreign timer observer and is not claimed equivalent
to the clean module. Relevant worktree patches remained byte-identical during
preparation. CD1 remained at its unique existing path, 649,633,792 bytes,
SHA-256 `e184984ca88f001c5ddd52035d76cd64e266e26c74975161b5ed72366c74704f`.

The predeclared future run limits are install 1200 seconds, total 2400 seconds,
and final Quit/cleanup reserve 300 seconds. No clock began and no deadline was
extended. Before any admitted run, its independent disk guard must cover final
overlay flush and all actual native/child/supervisor/enclosing waits and both
EOFs; its terminal markers must differ from action receipts. A new admission
must account for transient flush capacity as well as expansion. No runtime
repair was authored, so no new old-fail/new-pass runtime claim or code build
gate applies. Only this note is published.

The board watcher has an actual child-close wait and both EOFs; the loopback
server closed normally. There are no owned runtime children or boxes. Box ID,
expiry and stop receipt are null; state is NOT_CREATED. No agent, worker,
Python, Wine, public deployment or held-title action was used.
