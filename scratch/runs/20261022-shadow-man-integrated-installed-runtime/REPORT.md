# Installed Shadow Man qualification: preflight blocked

No guest was launched. The first blocker was selective canonical-module recovery:
Boat `snapshot pull --path` staged `layer-1.tar.zst` to the enforced 16 MiB
temporary-file limit and received SIGXFSZ (OS exit -25). It produced no module.
The raw command, file-operation trace, partial-layer identity and snapshot tree
are retained here. The partial compressed file was hashed, then removed from
the task-owned temporary mount; that mount was unmounted.

This is a bounded-recovery failure, **not proof that recovery is impossible
within 64 MiB**. The compressed layer's complete size remains unknown. There
was no second pull, broad snapshot download, rebuild, resume or guest retry.

The selected snapshot is de8639e2-cf50-4c6b-a330-6c482bc6f573, generation 31.
The accepted build receipt establishes the source cwd and primary module path;
the snapshot tree independently lists its exact 1,879,387-byte file. Expected
SHA256 is ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553.
The canonical production source is c9681105; integrated source is
58e90870a40a541a4083cae5e987ca8de31889e6. None was compiled or instantiated.

The old 158-file runtime manifest was compared by Git tree identities with the
integrated source. Three planned paths differ: lib/dll-registry.js,
lib/process-boot.js and lib/storage.js. This was planning only: no runtime
closure, PNG/Worker dependency gate, watchdog fixture or complete compile-guard
qualification was reached. Accepted historical suites were not replayed.
The coherent pre-guest gate therefore failed closed before its remaining steps;
there is no executable guest command admitted by this result.

Both boxes were left untouched. There were zero resume calls, API execs, guest
attempts, child screens, input events or guest/OS exits. bx_m4xrrj5a remains
STOPPED per the supplied coordinator record; a running expiry is inapplicable.
bx_f3gs8qm2 was queried only through snapshot latest/tree. The actual installed
registry and DSETUP return remain unknown. Original installed payload identities
are supplied accepted receipts, not newly observed bytes. Immutable installed
backups were never accessed or changed. Remote quota/free space was not measured
because runtime admission never passed. No process-group watchdog was launched.

Initial normal precheckout allocation projection was 51,888,128 bytes including
8 MiB reserve and the bounded 16 MiB recovery allowance. The separate final
allocation audit includes the Boat launcher binary and additional small read
receipts omitted from that initial inventory; the corrected conservative total
still fits 64 MiB. No whole root checkout or historical chain was used as a
source donor. The entire two used donor checkouts are counted conservatively.
No unrelated files, main branch, donor Git metadata or production source changed.

See preflight.json, allocation-audit.json and verification.json for exact bounds
and limits. Publication is recorded in publication.json and the root messageboard.
