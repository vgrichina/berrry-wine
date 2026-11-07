# Dungeon Keeper stable Worker attempt, 7 November 2026

The first blocker is **local free disk below the required 2 GB floor before
runtime qualification or allocation**. `/home` initially reported
2,273,845,248 available bytes; the next measurement reported 487,690,240
bytes. No browser, guest, fresh box, native input, or original capture was
created. There is no current dungeon, digging, or persistent gameplay claim.

Evidence is `scratch/runs/20261107-dungeon-keeper-stable-worker/`.
`first-blocker.json` records the resource measurements and the absence of an
allocation. `media-identity.json` checks the existing installed files against
the predecessor's recorded size and SHA-256 values. The original installed
files, configuration, manifest, and registered launch route were left intact.
The absent installer was not treated as absent installed media. The earlier
Outlaws source change is historical; it was not used as this run's blocker,
and no activation or semaphore repair was repeated.

Small driver preparation files remain in the owned run directory as
unqualified work. Preparation stopped during a metadata comparison because
the prior media records also contain an `exists` field; the executable's
independently checked SHA-256 matched the original recorded value. The
comparison was corrected to compare path, size, and hash, but the driver was
not executed after the disk-floor failure. Production guest/render Worker
qualification, deferred-observer controls, native release and exact ACK
controls, HTTP body hashes, and the real immutable deadline validation are
all **unexecuted in this attempt**. Prior passing controls do not establish a
pass for this prepared driver.

The actual browser/render backend is unknown. No DirectDraw presentation,
active D3D, FPS, audio, parity, or whole-game result is asserted. No emulator
mismatch was demonstrated, no production code changed, and no full build or
gameplay regression was run. This is a documentation-only blocker report.
The note was checked with `git diff --check`; artifact containment and the
local original-media identity checks are recorded with the evidence.

The exact source Git SHA and relevant binary patches, including the owned
new preparation files, are retained without a source or media archive. There
are no assigned box ID, state, or expiry, no shutdown to perform, and no old
box was resumed or stopped. No files owned by other workers were removed.
No local runtime, profile, port, writer lock, held input, or watcher was
created by this worker.

Next: the coordinator restores and verifies the disk floor, then assigns a
fresh attempt. Before its single UUID-idempotent 40-minute box, qualify the
complete staged driver and deferred observer on actual production Workers,
including owner continuity through renderer readiness, strict identity after
binding, release/freshness/exact ACK controls, executable/DLL/manifest HTTP
body hashes, and the actual immutable 25-minute deadline. Inspect fresh
original captures before each ordinary native action.
