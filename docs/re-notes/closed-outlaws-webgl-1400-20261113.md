# Closed Outlaws text recovery and real WebGL loss baseline

Exactly two historical artifacts were encoded as local lossless gzip siblings:

- `scratch/runs/20261112-outlaws-irondoor-crowbar-consumption-0136/oldemo-disassembly.txt`
- `scratch/runs/20261112-outlaws-aperture-collision-key-route-0738/oldemo-disassembly.txt`

Evidence, durable indexes and restore helper:
`scratch/runs/20261113-closed-outlaws-webgl-1400/`.
Each original path also has a `.RECOVERY.json` pointer. Retain those pointers,
the gzip siblings, this run's indexes and `restore.py`. Restore RAW before
running any historical consumer:

```sh
python3 scratch/runs/20261113-closed-outlaws-webgl-1400/restore.py ABSOLUTE_INDEX_JSON
```

Both successful canonical worker exits, nonempty finals declaring these runs,
and completed coordinator reviews matched. Worker 0136's completion notification
failed to queue; its successful wrapper exit and canonical coordinator review
independently establish closure. Current registry exclusion, a 568-file current
executable reference closure, privileged FD/maps/cmdline scans, and stable
regular single-link file metadata passed before mutation. The text payloads
were handled only as opaque bytes. No guest decoding or new reverse engineering
was performed.

Each file held 16,644,116 raw bytes and occupied 16,650,240 allocated bytes.
The two distinct inodes happened to have identical full raw SHA-256:
`a1a101dc432cd56a27b0b94e60d25fc8f74271c31aff76bd52bddb5c6819293e`.
Each new gzip sibling holds 2,481,245 bytes. Full encoded/raw hashes, external
`gzip -dc`, and actual RAM restores passed before and after unlink. Restores
verified exact bytes, mode and nanosecond mtime, and refused existing files
and symlinks. A final independent verification repeated those checks, checked
closure proof hashes and both runtime output streams. No previously encoded
artifact was recompressed or removed.

Gross allocated reclaim was 28,336,128 bytes. At the immediate resource-phase
announcement, evidence occupied 229,376 bytes: net reclaim 28,106,752 bytes,
fresh available disk 1,518,125,056 bytes. This is an announcement-time figure;
subsequent evidence and other workers change available disk.

The unchanged `047cda46c` prepared six-case fixture was executed locally with
real Chrome 151/WebGL2/SwiftShader and the shipped renderer sources. The heavy
runtime lock and actual process census passed above the 1.5 GB floor. An
independent deadline/disk watchdog was observably armed before Node/Chrome.

**Baseline FAIL:** in the first native16 queued case, actual context loss was
observed. The loss fence returned 1, changed the accepted DIB and cleared the
accepted pending frame. The fixture then timed out waiting for
`webglcontextrestored`. Thus the remaining five cases, rejection after restore,
and fresh restored DIB/RGBA pixels are UNKNOWN. No fake GL result or speculative
production repair is substituted for this failure. Detailed source hashes and
partial row data are in `baseline.json`; the prepared fixture hash is unchanged.

Node's actual parent wait returned 1; stdout and stderr independently reached
EOF and their lossless gzip logs passed full raw hash verification. Chrome
closed normally with code 0, the watchdog disarmed and was waited with status 0,
and the task profile was removed. No guest input/replay occurred; independent
UP is inapplicable. No box was created: ID/expiry null, state NOT_CREATED,
stop receipt N/A. No production source or game/media/save/database/cache change
was made. Git SHA and relevant uncommitted binary diff are retained without
source archives.

Next: isolate the restoration-event timeout and repair the demonstrated lost
readback success only with focused checks and a locked build, then rerun all
six real cases. The heavy lock has been released for Pawn/LMarbles.
