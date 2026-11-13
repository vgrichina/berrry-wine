# Exact 6+9 stopped-snapshot offload; LMarbles capacity blocker

Recovered **22,786,048 allocated bytes** by offloading only the six closed
canonical gzip files indexed by
`scratch/runs/20261113-closed-recent-recovery-nfs-0250/index-*.json` and the
nine indexed by
`scratch/runs/20261113-closed-canonical-recovery-gltron-0335/index-*.json`.
The exact encoded payload totals 22,741,734 bytes. No raw transcript text was
interpreted. The protected dense0340 exact 23 gzip/xz/shared-archive files,
their mappings, and Pawn0450 dependencies were not edited or removed.

Evidence and executable recovery helpers are in
`scratch/runs/20261113-closed-six-nine-offload-lmarbles-0500/`.
`manifest.json` retains each original index, its exact-byte SHA, the original
raw SHA/size/mode/mtime, encoded SHA/size, and unique remote filename. All 15
old index files remain byte-identical. Both original `restore.py` files are
preserved byte-for-byte in the new run; their existing command paths now
explicitly delegate to the checked snapshot recovery helper. Each removed
gzip has an exclusively created, fsynced `.offloaded.json` local stub.

The new private resource box is **bx_x9ayts8x**. Normal stop receipt
**stop_c0ab4440fb6e8f5f** completed with `forced: false`, no error, and an
observed CLI state of **stopped**. Its completed stopped snapshot is
**11627cb6-37a4-4175-b182-f3f1f33191aa**. Ordinary 14-day retention ends
**2026-11-27T00:48:52.416Z**, computed from the observed stop timestamp.
Delete-on-stop and snapshots-off were both disabled. This is expiring recovery
storage; it is not permanent remote durability. The coordinator must include
this backup ID and expiry in the owner Telegram handoff. This worker sent no
Telegram or Slack messages.

An independent deadline watchdog acknowledged before creation; its actual
parent wait and terminal observation are retained. Every remote whole-file
SHA/size passed before normal stop. After stop, all 15 entire gzip files and
the exact manifest were downloaded through supported `boat snapshot pull`
into RAM and reverified. A separate snapshot download restored a full raw
sample with SHA, mode, nanosecond mtime, and overwrite refusal before any local
gzip removal. After removal, both legacy helper command paths independently
restored a sample from the stopped snapshot with the same checks. Privileged
open-descriptor checks passed before each unlink. Local raw SHA verification
used opaque gzip decompression, without parsing guest payloads or log text.

To restore an original transcript using its existing index:

```sh
python3 -B scratch/runs/20261113-closed-six-nine-offload-lmarbles-0500/restore-offloaded.py ABSOLUTE_INDEX_PATH OPTIONAL_DESTINATION
```

The original 0250/0335 `restore.py INDEX [DESTINATION]` commands also resolve
the checked new location. Recovery verifies old index bytes, full encoded
SHA/size, then full raw SHA/size, and creates the destination exclusively with
the recorded mode/mtime. It refuses overwrite. Restore before expiry.

To recover the exact encoded files independently:

```sh
TMPDIR=/dev/shm boat --no-update snapshot pull 11627cb6-37a4-4175-b182-f3f1f33191aa --path closed-six-nine --out /dev/shm/six-nine-recovery
```

Use the downloaded `home_user/closed-six-nine/manifest.json` to map each
`remoteName` to `encodedPath`; verify `encodedSHA256` and `encodedSize` before
exclusively restoring encoded files. Do not resume or delete the box. No
forced stop, public URL, old-box resume, authentication change or 403 retry
was used.

LMarbles remains blocked by actual capacity. After offload and the two legacy
restore tests, `/home` had **1,444,401,152 bytes available**, **55,598,849 bytes
short** of strictly greater than 1,500,000,000. No original game/API allocation
or input occurred, and no new Puzzle 2 progress is claimed. The exact prepared
route at `b883f6240`, existing 86 media plus CRT references, current04 module
and prior Tutorial clear remain the next starting point. There was no floor
holding loop, repeated media hash matrix, or cleanup of another worker's
staging. The next step requires an actual completed capacity change, then a
fresh floor sample and prearmed native deadline before ordinary menus and
reviewed Puzzle 2 moves.

Source provenance is Git `4e5382aefe1e717d871f8406d80f5de8bd047a9d` plus the
retained relevant binary diff and owned helper/note patches. Source and media
were not archived. No production code changed, so no production build was
needed. Tests were the remote SHA checks, stopped-snapshot whole-file
readback, full restore/metadata/overwrite checks, both legacy command tests,
unchanged old index checks, exclusive stub checks and helper syntax checks.
