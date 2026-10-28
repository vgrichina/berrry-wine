# Tux Racer closure/publication repair, 2026-10-28

Source repair only; **independent source acceptance is still required**. No
integration, registration, deployment or runtime qualification is claimed.

Base: `496d65f7bd5d061fcb63e5f806793e2202572b45`, the independent rejection
of recovery candidate `52a8dfa1636c127df19e721cdb5d0f173c87aa5c`.
The unchanged independent stage test was first run against the unchanged recipe
in a fresh owned fixture directory. Both assertions reproduced REJECT: missing
DLL/literal source accepted, and malformed PE replaced inventory while preserving
stale closure. Test exit zero confirms those findings, not acceptance. The exact
unchanged test and recipe were run again from the read-only pinned donor after
repair, with a second distinct fresh output directory; both findings reproduced.
The independent test and its report remain unchanged in this branch.

The extraction CLI now validates in a fresh owned sibling staging directory.
Publication requires validated i386 PE32 modules, no unresolved non-system
direct DLL imports, and present recognized literal Tcl `source` targets. Bundled
EXE/DLL files are parsed, including transitive direct imports. A malformed PE,
missing DLL or missing literal source rejects before any destination/report is
published. The fixed original SHA256 guard is unchanged and runs before staging.

The Tcl audit is deliberately lexical. It recognizes standalone `source` at
line/semicolon boundaries, bare/braced/quoted literal words, and a literal
`-encoding` option. It checks relative paths against extraction root and script
directory and scans all inventoried Tcl scripts. Computed/substituted paths,
parent-relative/absolute paths and unsupported expressions remain unknown.
Command forms outside this subset, Tcl runtime CWD, dynamic loads, decoding and
gameplay remain unproved. This is not a Tcl interpreter or a complete runtime
data-dependency proof. The inherited original lexical audit remains evidence
only for its exact original inputs.

Both new reports are serialized in staging before publication. Existing reports
must be bounded regular files, never symlinks or directories; they are backed up
before replacement. Existing destinations reject without deleting user data.
Publication renames the validated payload then replaces inventory and closure.
Synchronous publication errors restore replaced reports and withdraw the owned
payload, leaving the old pair unchanged (or no reports when none existed).
Validation and staged-write failures publish no success artifacts. Causal
exceptions propagate; there is no success stdout on these failed stages.

The commit point is the final report replacement. Postcommit staging cleanup
failure is an explicit stderr warning with its recovery path, not a failed
overall stage. Rollback I/O failure propagates a chained error and retains its
recovery directory. Recovery needs operator review of old report backups and
payload location; never delete a user destination blindly. Two plain sibling
reports cannot provide power-loss atomicity or atomic visibility to concurrent
readers. Serialize writers/readers; crash-consistent multi-file publication is
not claimed. No automatic retry follows an uncertain publication.

Validation: 15 new synthetic-fixture tests pass, including success, valid/broken
bundled DLL, missing DLL, two missing-literal forms, malformed/non-i386 PE,
computed Tcl unknown, old destination preservation, unchanged production pin,
staged-write failure, report replacement rollback with/without old reports, and
postcommit cleanup warning. Main-stage synthetic tests use an explicit
fixture-only pin seam that still verifies each fixture's digest. They do not
make synthetic archives reachable past the production original SHA guard.
The affected original PE group passes. Six unaffected original groups and
coordinator-verified original 171 / prior 190 delta hashes are reused through
the canonical predecessor receipt; no historical packaging is repeated.

Three deliberate mutations are rejected: allow unresolved DLL, skip literal
audit, and skip report rollback. Their nonzero results include the corresponding
missing-DLL, missing-literal and old-pair/absent-pair assertion failures.

Canonical evidence:
`scratch/usage-watch/tuxracer-closure-publication-repair-oct28/receipt.json`.
Operation records include exact commands/exits, fresh admission, distinct
stdout/stderr, source/fixture hashes, mutation outcomes and cleanup receipts.
Recover source with the strict-SSH task branch recorded there. Fixtures and
mutations remain under `/tmp/tuxracer-closure-publication-repair-oct28/`;
the receipt's recovery instructions bind retained evidence to immutable pins.
Original 158-file / 13,225,945-byte extraction remains read-only and uncopied.
No download, full extraction, guest, Wine, build, Boat or registry edit occurred.

Root tracked/index/refs and all donors are read-only. The standing messageboard
exceeds the 12 MiB file limit, so no append was attempted; the coordinator must
publish `publication-note.txt`. No box is assigned; lifecycle owner remains the
coordinator. Task ends after strict-SSH branch push and exact ref verification.
