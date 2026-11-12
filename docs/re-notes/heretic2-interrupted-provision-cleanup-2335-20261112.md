# Interrupted Heretic II worker: cleanup only

2026-11-12. Cleanup evidence: `scratch/runs/20261112-heretic2-interrupted-provision-cleanup-2335/`.
Predecessor: `scratch/runs/20261112-heretic2-current-review-load-boundary-2310/`.

The predecessor launcher recorded exit **1**, with **no final.txt**. Its terminal
event was an automatic safety-review rejection for possible cybersecurity risk
during provisioning. The rejection is preserved. The rejected workflow was not
resumed, rephrased or retried. No original-game success, completed provisioning,
native load, security-analysis result or clean parent join is accepted here.

The expressly assigned private box **bx_ktb4h7k3** was initially `idle`, with an
expiry of `2026-11-13T01:10:31.243Z`. After partial unique evidence recovery,
normal shutdown completed at **2026-11-12T23:15:15.378Z**. Independent lifecycle
GET confirmed **archived**, expiry **NULL**, and stop receipt
**stop_20860d58ccf62cab**, status `completed`, `forced=false`, `error=null`.
No box was created, resumed or deleted.

Recorded provision PID **766470** and predecessor launcher PID **760511** were
absent at inspection. No surviving exact run-local provision/manager process
was found. Provision and manager exit codes, stdout EOF and stderr EOF remain
**UNKNOWN**; launcher exit 1 does not establish their outcomes.

The existing independent watchdog PID **766396** was observed alive, adopted
by PID 1, with its original immutable deadline and stdout/stderr pipe handles.
After shutdown confirmation, custody was reclaimed only for a new predecessor
`stop-confirmed.json` shutdown receipt. This allowed the existing watchdog to
retire through its ordinary confirmation path. It wrote
`watchdog-terminal.json` with `confirmed=true`, then its PID disappeared.
Its actual exit status and both pipe EOFs remain **UNKNOWN** because no actual
parent wait receipt is available. No clean join is inferred from disappearance.

Existing local terminal events, stderr, upload telemetry, lifecycle receipts and
watchdog records were recovered as opaque, losslessly compressed bytes.
`recovery-manifest.json` records original and compressed SHA-256 and size, and
each compressed file was independently reread and roundtrip verified. Original
artifacts, archives and WIP remain in place. Remote unique-artifact completeness
is **UNKNOWN**: no new guest command or payload inspection was performed.

Disk was below 1.5 GB during cleanup. Only recovery and normal shutdown were
performed; there was no native work, game input, new allocation, source patch,
payload decoding, private-memory inspection or other-worker/cache/reserve/
vendor/database/session change. The source identity and relevant existing
patch references are recorded in the cleanup run; Git remains the source
archive. This note is the only tracked change. Validation consists of byte
roundtrips, lifecycle receipt checks, scoped process observations and Git diff
checks; no runtime code changed and no build or original workflow was rerun.

Next: retain the refusal and unknowns. This cleanup task is finished; any future
work requires a separate owner instruction and must not retry the rejection.
