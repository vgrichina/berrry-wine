# UT GOTY retained overlay: disk admission blocker

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
