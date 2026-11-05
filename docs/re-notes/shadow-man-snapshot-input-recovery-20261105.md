# Shadow Man installed snapshot inputs recovered

All 2046 required members, totaling 177700067 bytes, are recovered and verified
in the single canonical directory:

`scratch/game-media/shadow-man-installed-20261105/`

Every file was reread locally and matched its recorded length and SHA-256.
Missing, invalid, and extra members are all empty; there is no remaining
snapshot-input prerequisite blocker. This is input recovery only: browser
registration and gameplay qualification remain future work.

## Exact source and first request

The authoritative inventory is
`scratch/runs/20261105-shadow-man-browser-gameplay/required-input-recovery.json`,
SHA-256 `35f65add8a94fa50ef83bf937297b9430fcf3a01bb84f63380efb0e668e34469`.
Snapshot: `3ac9827f-20cf-4e1c-98a8-40b4edcd1b2f`.
Exact member prefix: `shadow-man-install-continue-oct22/retained-session/`.
Each canonical member preserves the inventory's `rel` path: 2045 files under
`parent-vfs/`, plus `parent-registry.json`.

The sole initial request was a read-only snapshot file GET for
`shadow-man-install-continue-oct22/retained-session/parent-vfs/program files/acclaim entertainment/shadowman/shadowman.exe`,
with `Range: bytes=0-1896447`. It started at
2026-11-05T16:44:18.174054Z and completed at 16:44:19.091973Z with HTTP 206.
The full 1896448 bytes matched SHA-256
`4b32868bb30a8ca089483203f8c2b637507f12de4f11f39bf45b1fa41d5f5772`
before any other member request began.

## Recovery and accuracy checks

The sandbox skill was read before API use. The per-file snapshot GET protocol
was taken from `scratch/runs/20261103-shadow-man-config-recover/boat_io.py`;
its remote PUT/upload functions were never called. Existing authentication
was used privately. No tokens or signed URLs were logged.

Remaining files used at most three concurrent GETs with no redirects or retries.
Each response was streamed in chunks of at most 65536 bytes, bounded by the
recorded size, socket/per-member deadlines, disk floor, and task cutoff.
Response status, Content-Range, entry kind, optional Content-Length, exact EOF,
byte count, and SHA-256 were checked before renaming the temporary file into
its canonical location. Paths were checked for traversal, normalization,
symlinks, duplicates, and containment; verified existing files were skipped.
There were exactly 2046 successful HTTP 206 requests and no denied or failed
requests. The last request finished at 2026-11-05T16:49:23.103156Z.

Local verification completed at 2026-11-05T16:49:27.116822Z. Evidence is retained
in `scratch/runs/20261105-shadow-man-snapshot-input-recovery/`: sanitized
per-request operations, resumable inventory with no pending members,
recovery/verification recipes, source identity, and `result.json`.
The inventory supplies every exact relative path, length, and hash; the resume
record binds its SHA-256 and canonical destination. Preparation source was main
`0069aee316284c3189470f26cdc0bdc2e81af9ff`; evidence records Git identity and the
relevant diff/new-note patch. No source archives, media archives, or repeated
media copies were created.

No shared source edits, module pin changes, tests/builds, browser, guest,
runtime, box, subworker, or deployment ran. Box ID/state/expiry are N/A;
coordinator lifecycle ownership remains unchanged. The existing runtime queue
RFsource1620 -> Lords1635 -> Aranna1710 remains unchanged, as do held lanes.
Next: hand back the verified canonical inputs for separately assigned browser
prerequisites in that queue; do not repeat the old disabled-Play investigation.
