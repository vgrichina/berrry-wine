# Hexen II valid API envelope and paired original traversal — 2026-11-12

Both current backends now have reviewed original courtyard, ramp, skull-door and
chamber traversal, native input progress, and an attack pose while alive.
WebGL's separate 1,000 ms attack ended at health 69; SoftwareGL's second-approach
600 ms attack ended at health 50 with the spider in the foreground. Incoming
player damage is proved on both. SoftwareGL also reached native death and then
restarted normally. **Enemy damage, an enemy kill and a kill-counter change
remain unproved.** No emulator defect was isolated or changed.

Run: `scratch/runs/20261112-hexen2-api-envelope-paired-progress-1040/`.
Parent 1025 RESULT/RECOVERY and published note commit `81e4c9b27`, plus the 0953
report, were read and preserved. This replaces their current paired-gameplay
limit without erasing either failed caller or its evidence.

## Caller repair and qualification

The actual run caller now separates the 55-minute lease/observation deadline
from the command API's integer execution timeout, which is capped at 600 seconds.
`control.py`, `envelope.py` and the shared command builder `submission.py` are
ignored run helpers. The original production `request.cjs`/file-ACK client is
unchanged. Each detached API command is submitted once. Its acknowledged
process ID, exact command and start time are retained; a status-read timeout
reobserves that same GET route through the original deadline. It never publishes
another browser command. An unknown POST response or changed identity closes
input admission. No unknown request from either parent was replayed.

Before allocation, the full current caller path was exercised against a local
HTTP endpoint: actual serialized POST, detached subprocess, persistent Node
`request.cjs`, actual numbered command consumer, and exact ACK file. The result
was delayed 21 seconds. A forced status-read timeout retained the same operation;
one browser command, one consumption and ACK number 0 / ID `delayed` completed.
The endpoint executed both legal timeout boundaries 1 and 600. Invalid values
were rejected before submission. A separate known HTTP 400 pre-submission
rejection produced no operation handle. An accepted command whose POST response
was lost performed its unique marker effect once, then closed admission without
replay. Complete wire bodies and operation events are retained. The local test
uses the installed local Node path; the remote caller uses its pinned remote
Node path, through the same command builder. The initial absent-local-binary
attempt and earlier boundary-control revision are explicitly recorded rather
than counted as the final qualification.

The parent-qualified browser, retained CDP helper, native dialog/bootstrap,
strict identity binding, input, schema and cleanup helpers are byte-identical;
`native-bootstrap-preflight.json` records their hashes and inherited qualification.
The native MessageBox-before-GL/first-birth and replacement negatives were
preserved, not rerun as a new fixture here. Current retained-screenshot,
unknown-input, hard-deadline, stale/cleanup and 15-form regressions pass, as do
five focused input/Worker tests. No production source changed, so no new build
was required.

## Reviewed native progress

WebGL dismissed the complete native notice, traversed Single Player → New Game
→ Paladin → Apprentice, naturally meshed models, and reached the courtyard.
`review/webgl/world-wait.png` shows the statue, ramp and health 81. Subsequent
turns, backoff and ramp corrections are native, reviewed movement, not parity
measurements. `ramp-climb.png` shows the skull doorway. An early 1,800 ms Up+Control
approach crossed into the chamber at 78. `early-native-melee.png` shows the
extended punch after a 1,000 ms Control attack at 69, with spider legs right.
The visible spider was then faced, followed by another 1,000 ms forward attack
at 36. Native pause completed at 1 health. These frames prove living attack and
incoming damage, not a hit on the enemy.

SoftwareGL independently followed the same class/difficulty route and reached
the courtyard at 84. A passive follow-up confirmed the initially deferred turn;
completed captures were not automatically treated as presented movement.
`ramp-top.png` shows the skull door and `door-approach-attack.png` the chamber
at 84 after the early Up+Control approach. The 1,000 ms attack's completed frame
shows resting fists at 42, so it alone is not visual attack-animation proof.
The following 1,500 ms attack ended in native death at 0, with the explicit
“Player is a meal for the spiders” message. Space did not visibly restart it;
a subsequent normal attack input initiated native loading and a courtyard
restart at 83. No save/config/media patch or forced guest call was used.

A 600 ms courtyard Control pulse shows a distinct attack arm pose while alive.
After native reapproach/backoff, `return-backoff.png` shows a complete spider
directly ahead at 63. `doorway-spider-melee.png` then shows an extended punch,
foreground spider legs and 50 health after a separate 600 ms attack.
`final-chamber-pause.png` confirms the living native pause at 19. This is stronger
current living-encounter evidence than the first attempt, without qualifying
an enemy hit from the punch pose alone.

All 48 original commands have exact successful ACKs; 40 balanced pulses and 86
trusted native events were recovered. Seven command-level ACK waits crossed
20 seconds and retained their original numbered files. Original CDP reads
settled within 20 seconds in this run; delayed CDP retention is established by
the preserved parent fixture and the current retained-result regression, not
by a new overdue original screenshot.

## Identity, recovery and shutdown

Runtime source remains `8a834a3dc7affc8c6e53245beab56e87a32b81e8` and both
recovered actual guest modules match SHA-256
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
Original root `glh2.exe` remains SHA-256
`76d96731e3076441e5c70bce2089cd8f36f25b373214f656aa9d5cd8d532e9dd`.
The joined provision process and 619 remote hashes/import checks passed before
browser launch. SoftwareGL's owner is actual GL endpoint 1, software bridge and
matching exported memory; legacy endpoint 2 is excluded. WebGL's owner is GL
endpoint 1 with an actual WebGL1 context. Native SystemInfo reports ANGLE
SwiftShader/Subzero; JavaScript Intel strings are not physical-GPU evidence.
No FPS, raw-draw performance, physical-GPU, parity or audio claim is made.
Licence scope stayed runtime/API observation and emulator source only: no guest
reverse engineering, disassembly, extraction, patch or substitute DLL.

566 remote artifact references / 440 unique gzip blobs were recovered and checked
for encoded/raw hashes and sizes before shutdown. `check-evidence.py` passes
module, exact-envelope/ACK, balanced trusted input, cleanup and actual-join checks;
visual enemy damage is not automated. The new dashboard entry has no invalid,
missing or escaping references; the repository-wide checker still reports 23
older containment errors outside this run. Git SHA and relevant binary diffs/new-file
patches are the source recovery mechanism; there is no source/media archive.

Own box `bx_44e57mew` was created 10:39:01Z with initial expiry 11:34:00.161Z.
The independent deadline watchdog was observably armed before allocation.
Both runtime parents joined 0 with both EOFs; Chrome exited 0, exact controller
and Chrome PIDs were absent, and owned profiles were removed. Local manager
and watchdog have actual parent waits 0 with both EOFs. Hash verification preceded
normal stop `stop_ccb1466db3c5cdfc`, completed unforced without error. Final state:
**archived 11:01:14.814Z, expiry null**. No task box remains running.

Next gameplay work is visible enemy damage/kill through native aiming and attack.
Current paired traversal and living-attack objectives are qualified; no new causal
emulator blocker, broader compatibility count or enemy-hit acceptance is claimed.
