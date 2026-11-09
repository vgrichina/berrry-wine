# Warcraft III qualified production attempt, 0535

The sole authorized attempt failed during Chrome startup. No version,
renderer qualification, original game navigation, ready marker or objective/control
PNG was produced. Evidence is retained in
`scratch/runs/20261109-warcraft-qualified-native-objective-0535/`.

The first failure at **05:37:54.962 UTC** is `DevTools startup deadline; no
endpoint`. The actual startup observer began at 05:36:54.961 and reached its
unchanged 60-second startup bound at 05:37:54.961. The overall browser window
was 05:36:51.624–05:38:18.682 within the immutable 90-second case, followed by
the existing five-second custody extension. No command, input, capture or retry
followed the failure; only independent cleanup and evidence retrieval ran.

`chrome.stderr` contains a DevTools listening URL for port 42411 and DBus errors
timestamped 05:38:06.304. The listening line has no timestamp. It does not prove
when the endpoint file became available or that startup could have observed it
before its deadline. The cause of slow startup or endpoint observation remains
UNKNOWN. No concrete Warcraft production defect was isolated, so no production
code or cap was changed.

## Preparation and unchanged proofs

Read AGENTS/CLAUDE and WC0512, WC0500 and WC0445. Reopened WC0512's final
qualification, startup/cancellation, renderer, contracts, staging, production
preflight and locked-build proofs against their evidence-index SHA-256 and
sizes, including gzip CRC, actual waits and separate stdout/stderr EOF.
Verified the tested source hashes and all 626 final repaired production
providers against current bytes. These exact proofs were reused; no code changed.

The fresh prepared closure contains the published `838d4f0df` private bounded
qualification metadata/trace channel and `16c496ca2` startup cancellation
repair. Actual composed production preflight ran offline in this assignment;
the fresh 629-provider upload and staging omission/SHA/path/symlink negatives
passed. The remote barrier then matched all 161,568,829 staged bytes. These
checks started neither Chrome nor the original. The sole actual Chrome run
did not reach qualification and therefore does not validate the bootstrap fix
in Chrome.

CPU remains SHA-256
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`;
custody remains published `4341b87723a7d56bc98223215cca4cdc878fcae2`.
Strict lineage, all observation/ACK flags, pre-CPU/pre-DLL-main requirements,
90-second case, work/ACK limits and 14/16/18-second cleanup schedule remain
unchanged. Historical WC0445's 53 missing waits, WC0410's creator lineage and
WC0512's creator10418/start99598 remain UNKNOWN. No claim that 18 seconds would
have passed a historical case is made.

## Actual termination and waits

Independent Browser.close was unavailable without a CDP connection. Cleanup
sent TERM after 14 seconds and KILL after 16 seconds. At the full 18-second bound,
the browser receipt still had terminal=null, closed=false, stdoutEOF=false,
stderrEOF=false, drained=false, cancelled=true and normal=false. The startup
failure remained the first reason. This is an observed unsuccessful full
18-second cleanup in this case, not a prediction about earlier cases.

The unchanged custody receipt records 83 owned identities, 15 actual terminal
waits matched to before-reap sequences in 643 events, 68 missing waits,
commandEOF=false and complete=false. Known fork lineage is complete with no
unresolved lineage/resume/ptrace rows. The creator witness retains 7,071 actual
scans and 201 paired actual CONT-before/return records. The missing 68 waits and
browser terminal/EOF remain UNKNOWN. Parent and caller waits and their separate
pipe EOF receipts are retained separately; they do not supply Chrome EOF.

A later cleanup census found all 83 recorded identities absent, service port 37755
closed and no profile FD writers. This supplies physical drain only. Port 42411
was recovered from stderr; its closure was not independently socket-tested in
that census. The owned profile cache was inventoried before removal. No shared
custody, Q2 or Super files were edited.

## Runtime lifecycle and recovery

Observed the exact Super0525 `ARCHIVED PHYSICAL_DRAINED` release,
`stop_6966241a5392ff24`, before creation. An observable independent watchdog was
armed before create against immutable UUID
`1bcb6c26-4bd9-48e9-8970-b2ccc39a9734` and a 25-minute deadline. Before creation,
a routine offline wrapper error was corrected: the lifecycle supervisor was
removed from a 180-second test wrapper and restarted independently against the
same immutable plan. The earlier actual wait/EOF and correction are retained.
Caller stdin stayed open with concurrent separate stdout/stderr drains.

Box `bx_92fqhutz` used TTL 1466 with initial expiry 06:00:50.082 UTC. All 27 unique
remote evidence files, 336,185 stored bytes, were retrieved and independently
verified for SHA-256, size, decoded gzip hashes and GNU gzip CRC **before** normal
delegated archive. Stop `stop_4c1cd00a31228a2e` completed 05:38:39.775 UTC,
forced=false, error=null. Final state is archived, archiveAfter=null;
final expiresAt was not returned. PHYSICAL_DRAINED was posted 05:38:57. The
local lifecycle and watchdog have actual wait 0 and separate pipe EOF; the
runtime lock is released.

Recovery records exact Git base plus small relevant dirty/new-input patches.
Media and CPU modules remain at their existing SHA-pinned paths. No tree,
media or module archive or duplicate was created. Free/home above 1.5 GB was the
only resource gate. No agents, workers, local browser or deployment was used.

Next: investigate the retained startup/endpoint timing and missing waits
offline. No further runtime or original retry is scheduled. Single task STOP.
