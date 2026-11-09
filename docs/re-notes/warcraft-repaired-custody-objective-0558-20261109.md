# Warcraft III fresh repaired-custody assignment, 0558

The single authorized fresh assignment stopped during provisioning. No Chrome
or original game was launched, and no objective/control PNG was produced.
The concrete blocker is an HTTPS upload write timeout and an incomplete remote
closure: cleanup found 628 of 629 providers with exact SHA-256 and size, with
only `test/binaries/candidates/warcraft3-demo/war3.mpq` absent.
The local original is 101,868,957 bytes, SHA-256
`9e19d7ffb65054e4bdd3add7e26d70e16f063cdc20fa5b57639f3b9b7a196f9c`.

Evidence: `scratch/runs/20261109-warcraft-repaired-custody-objective-0558/`.
`causal-diagnosis.json`, the provision command/process/wait and separate output
logs, and `retrieved-runtime/cleanup-only.json.gz` retain the actual failure and
independent cleanup inventory. The provision process actually returned 1, with
both pipe EOFs observed, by **05:59:48.308574 UTC**. Its untimed traceback records
`urllib.error.URLError: <urlopen error The write operation timed out>` from SSL
socket send inside the upload PUT, using the existing 90-second transport
socket timeout. This is the terminal observation bound, not an invented time
for the failed syscall. The helper did not log individual PUT identities or
exception timestamps; exact failed-request attribution and exception time
remain UNKNOWN. The absent MPQ establishes incomplete staging, without proving
that its PUT produced the traceback. No later upload, closure-barrier, browser,
input, capture, gameplay command or retry was attempted after the provision
caller returned. Only independent no-input cleanup, evidence recovery and
archive followed. Concurrent transfer tasks had already settled before that
actual provision wait; their individual ordering is UNKNOWN.

## Offline closure and reused proofs

Read CLAUDE/AGENTS, WC0545 repair and WC0535 failure notes. Prepared a fresh
626-provider production closure and 629-provider upload manifest. Actual
composed `DRIVER_PREFLIGHT=1`, staging omission/SHA/path/duplicate/symlink
negatives and local closure fingerprint passed before box creation. The fresh
remote closure barrier was never reached, so there is no claim of successful
remote preflight or original execution.

Reopened final0545's ten successful validation logs and 306 selected indexed
proof files against their exact SHA-256 and size, including final composed and
startup-control gzip CRC checks. Verified every production provider and the
repair's tested source hashes against current bytes, and confirmed no tracked
changes in src/lib/host/tools. Reused the exact final0545 locked build, 40
custody tests, 13 composed startup/race cases plus direct controls, qualification
composition negatives, 38 renderer controls and contracts. The actual old-fail/
new-pass cancellation proof remains offline evidence; it is not a new Chrome
acceptance result. Prior incomplete preliminary evidence was not substituted
for a successful final proof or modified.

Production remains `c4b4cd337d5c21ef27441451d56596ffc96c46b6`, with Warcraft
custody SHA-256 `5ec810c4d4704ff86afc367b38f7335edf1214e3450ebb98a62ce3df6386b5fe`
and CPU `a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`.
Strict lineage, all caps and ACK checks, pre-CPU/pre-DLL-main zero-entry barrier,
immutable 90-second case and 14/16/18-second close schedule are unchanged.
Historical missing waits, creator identities and startup endpoint readiness
timing remain UNKNOWN. No deadline increase, late-endpoint acceptance, Q2/Super
provider edit or production repair was made: this failure demonstrates an
incomplete upload, not a Warcraft production defect.

## Lifecycle and recovery

Observed exact Super0542 `ARCHIVED PHYSICAL_DRAINED`,
`stop_5684743e5f0bb8aa`, before creation. Independent observable watchdog was
armed at 05:57:39.266 UTC, before create, against immutable UUID
`a984fdd2-42c2-46ec-902a-f4584ed5452d` and deadline 06:22:39.112881 UTC.
The one box was `bx_cy9256js`, TTL 1488 seconds, initial expiry
06:22:38.982 UTC. Cleanup at 06:00:31.671 UTC found no owned runtime/Chrome
process, case directory or Chrome profile. One unique remote cleanup gzip was
retrieved and independently verified for stored/decoded SHA-256, size and GNU
gzip CRC **before** delegated normal archive.

Final state: **archived**. Stop `stop_16b968537401602e` completed
06:00:46.062 UTC, forced=false, error=null; archiveAfter=null and final expiresAt
was not returned. Local lifecycle and watchdog actual waits returned 0 with
separate pipe EOF; runtime lock was released. Posted physical drain promptly
at 06:00:58 UTC. No box was deleted or resumed.

Recovery records exact Git base, relevant dirty patch, small existing untracked
dependency patch and new run-input/note patches. Media and modules are referenced
by existing paths and hashes; no source/media/module archive or duplicate was
created. Free `/home` stayed above 1.5 GB, the only resource gate. No agents,
workers, local browser or deployment.

Next: diagnose the provider upload transport with per-request timed evidence
before any separately authorized fresh attempt. This assignment schedules no
further runtime. Single task STOP.
