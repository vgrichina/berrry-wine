SETATTR rejected-flags atomicity — 2026-10-29

Candidate: 1c85e3b0e74f7971937790d1cfe7174d15602320. Baseline identity
comes exclusively from the dispatch's five current source pins. Historical
acceptance reports are provenance only. `source-pins.json` preserves those
pins and the explicitly changed backend pin.

Proven defect: the actual pinned Backend.handle(4, inode, request) decodes
valid at byte 0 and size at byte 16. With valid=2056 (SIZE|2048) and size=4097,
it returned EOPNOTSUPP (95) after changing a three-byte file to 4097 bytes,
live/peak from 12288 to 16384 and written from 3 to 4097. `baseline.json`
preserves the exact binary request and full before/after state; the original
source is retained in `baseline-source.py.txt`.

The repair moves the existing unsupported-flags guard before size handling.
No other production behavior or source file changes. Invalid flags now leave
nodes/data, live/peak/written, next inode, handles and failure unchanged.
Operations is intentionally excluded because it counts rejected requests.
Quota rejection still sets its deliberate sticky failure marker; invalid flags
do not set one or overwrite an existing marker.

Validation invokes the production source directly with no mount. After repair,
the unchanged saved binary reproducer passes before the broader checks:
151 invalid cases (every unsupported uint32 bit, growth/shrink/same size,
unsupported-only, supported-mask combinations, over-quota and sticky-marker
cases), 24 valid/quota controls (payload and independent accounting oracle,
block rounding, exact live/write/file boundaries, shrink and same-size), and
five focused READDIR/rename-type regression checks. Guard-removed and late-check
mutants both fail. Full counts and source identity are in `accept.json`.

Run from the owned repository through the supplied unchanged ops.py:

    python3 /tmp/toyvm-setattr-rejected-flags-atomicity-oct29/ops.py acceptance-final python3 -B test/toyvm-setattr-rejected-flags-atomicity-oct29/verify.py accept

The startup controls/checkpoint receipts supplied by the coordinator were reused.
Each supervised operation makes fresh disk/RAM admission with the unchanged
24 MiB allocation and resource limits. No Node execution, Git fetch/clone,
checkout expansion, mounted argv, Boat, kernel, browser, CLI, or game execution
was performed; mount-configuration parsing is consequently inapplicable.
Git publication uses the prescribed trusted SSH command through ops.py.

Remaining qualification gates: combined repairs, caller pin (still the old
backend), and full CLI qualification. This result claims only source-level
Backend.handle behavior and the focused checks above. Other workers retain
ownership of combined namespace and CREATE/MKDIR work. No shared messageboard
write; coordinator/publication notes are supplied for coordinator append.
