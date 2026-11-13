# GLTron second-corner attempt, 2026-11-13

The requested second visible native corner remains unproved. A fresh local
runtime was refused before launch: actual `/home` free space was
1,477,943,296 bytes initially and 1,480,232,960 at the recorded final preflight,
below the required 1,500,000,000 floor. No game input, staging, box, browser,
API provisioning, housekeeping or production change occurred.

Evidence is in `scratch/runs/20261113-gltron-second-corner-0300/`.
The preflight records the exact main SHA, all 1,617 source and 92 existing
media path identities (zero mismatches), and parent artifact hashes.
The current module/source/media are unchanged from the parent. Relevant Git
binary diff and the existing untracked runtime addition patch are preserved;
Git remains the source archive. No media or source archive was made.

The parent `fcdde27ce` scoped note, helper, five-test log and full frames were
read. I personally inspected `paused-start.png`, `after-a.png`, `after-s.png`
and `round-status.png`. The yellow cycle and its bent trail/minimap prove one
corner in `after-a`; `after-s` explicitly shows PLAYER 1 CRASHED and yellow
fragments. `round-status` shows PLAYER 3 WINS. These are prior-round evidence,
not a fresh result or a second controlled corner. The inherited supervisor143
cause and actual runtime wait/EOF remain UNKNOWN; nothing was replayed.

A new run-local `control.py` retains the parent's atomic publisher and consumer
byte-for-byte (prefix SHA-256
`77ea8a3a4ba58fac902a2a2ff0ccbbe0867aa26046b3ad88ca9f1882bc7a7af7`).
This preserves exclusive identity reservation, fsync/rename publication,
claim-before-send, duplicate/invalid refusal, independent UP timer, ACK versus
terminal UNKNOWN, and no replay. The parent's completed five focused tests are
reused by path/SHA, rather than repeated as a new qualification matrix.

The new supervisor starts a separate observable deadline watchdog and waits
for its durable armed receipt before launching the runtime as its direct child.
It preserves the real child's wait result and drains stdout and stderr to
separate EOFs. A normal finish request sends the harness's ordinary `quit`
command and waits; signals retain their actual signed wait result. The watchdog
checks the exact PID/start token before deadline TERM/KILL and exits promptly
when the runtime terminal receipt appears. This is a run-local supervision
change, not a production repair.

Three focused real-process tests passed: normal finish with explicit quit ACK,
supervisor TERM, and independent deadline expiry. Each asserts actual child
wait, both EOFs, joined watchdog and child absence. Their small receipts/logs
are retained in `test-normal/`, `test-signal/`, and `test-deadline/`.
These synthetic processes do not establish actual GLTron lifecycle behavior;
that remains untested until a capacity-permitted fresh game launch. No new
native screenshots exist. No production build was required for this notes-only
commit; helpers remain ignored run evidence.

All owned test processes and watchdogs exited and were joined. No keys were
sent, so no release is outstanding. Box ID none; state NOT_CREATED; expiry
null; stop receipt N/A. Protected NFS0250, Diablo0140 and parent files were not
modified. Next: a fresh capacity-permitted bounded ordinary-UI round, inspecting
a full frame between finite actions; native Pause may provide review time.
