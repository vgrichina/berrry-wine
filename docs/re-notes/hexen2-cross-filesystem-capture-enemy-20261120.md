# Hexen II capture metadata transfer, 2026-11-20

Evidence: `scratch/runs/20261120-hexen2-cross-filesystem-capture-enemy/`.

The exact prior failure was `fs.renameSync` in history-recovery `support.cjs:13`,
moving `/dev/shm/hexhistory20/captures/main-menu.json` to the run folder on
`/home`. EXDEV occurred publishing capture metadata, before XWD decoding.
It provides no evidence of renderer failure or image corruption. The previous
scope stays closed; its verified exact CPU module and WebGL1 result stand.

The new run-local `transfer.cjs` copies the source into an exclusively created
destination-side temporary file, verifies every byte and SHA-256, fsyncs the
file, and publishes with GNU coreutils 9.4 `mv --no-clobber --no-copy -T` on
the same filesystem. Publication refuses an existing or raced destination.
It verifies the final bytes and fsyncs the destination directory before
optionally removing the unchanged owned source. Failures preserve the source;
cleanup removes only the helper's uniquely owned temporary file.
The new support helper changes only capture JSON transfer. Capture pixels,
input/identity/freshness fences and native controls remain unchanged.

`node scratch/runs/20261120-hexen2-cross-filesystem-capture-enemy/test-transfer.cjs`
passed real tmpfs-to-home publication with full byte and SHA checks, source
retention/removal, existing and raced destination refusal, and injected failures
after copying and after fsync. The first ad hoc collision test expected a
different error message; the retained test accepts the actual GNU mv refusal
and checks that both original files remain intact.

Before any fresh original launched, the independent 100ms disk watchdog sampled
1468407808 bytes available on `/home` at 2026-11-20T08:07:36.879Z, below the
strict 1500000000 floor, and permanently closed this task. Later recovery does
not reopen it. No original was launched, no endpoint requests or gestures were
sent, and no new CPU/renderer attestation is claimed. The retained cheap
transfer test completed, but runtime preparation/launch was abandoned. Playable
level, living-enemy consequence and ordinary Quit remain UNPROVED.

No shared source, MCM, held regions, module, media or build changed. Existing
native controls/build are reused dependencies only; no new build claim.
Owned local watchdog is stopped and joined. No box created: ID=null,
state=NOT_CREATED, expiry=null, stopReceipt=null. Root owns shutdown; this worker
owns only its local process cleanup. No workers, Python, Wine or deployment.
