# Quake II required-motion terminal repair, 0737

The actual composed production caller now accepts `requireMotion: true` on a
reviewed `key` or `combo` command. Its held observations must contain
`attackInput.playerMotion.status === 'SNAPSHOT'`. Missing or UNKNOWN motion
latches the first terminal failure before dependent held screenshots, waits,
automatic capture or successful numbered ACK. This is an explicit command
policy; top-level attack status remains independent. Omitting the policy
preserves motionless commands and ordinary capture behavior. A malformed policy
or a required-motion command with no sample is rejected.

The physical input helper checks each returned sample before dependent work,
retains it in the failure receipt, preserves the first error across sample-log
and release failures, and joins reverse-order UPs for every attempted DOWN.
Motion rejection defers browser close until this independent release joins.
Subsequent commands remain rejected by the existing sticky transport gate.
No hold, work, ACK, shutdown or runtime cap increased. Strict startup flags,
DLL barrier and serialized native reader were preserved.

Evidence is in `scratch/runs/20261109-quake2-motion-terminal-repair-0737/`.
The starting Git SHA is in `git-base.txt`; `owned.patch` and `run-inputs.patch`
provide small recovery patches. Existing modules/media and the retained 0728
held-UNKNOWN fixture are referenced by path, SHA-256 and size, without copies.
The CPU remains 2185596 bytes, SHA-256
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`.
Inputs were reader 5bc5f86, caller 1473, custody 4341; custody/shared host,
Redline and NFS providers were not edited.

## Actual old failure and new behavior

The regression uses the existing real Python Caller/Session, numbered Node
transport and production composed driver. Only startup/original execution,
renderer shared bytes and process/CDP transport are inert fixtures. The actual
serialized owning reader evaluates the authored received frame. These are
protocol fixtures, not game pixels or proof of guest input consumption.

`old-joined-confirmed` reads historical production modules directly from the
starting Git SHA. The identical required-motion Space command begins with
motion SNAPSHOT and publishes frame0 on DOWN. Held motion becomes UNKNOWN
while attack/binding status remains SNAPSHOT. Historical code still takes the
held screenshot, waits the requested ten seconds, captures and ACKs success.
The regression fails after joining normal quit/cleanup. Its preload skips only
new helper-API unit tests, which historical code cannot implement; it does not
rewrite the production caller or the composed scenario.

`final-policy` passes the same actual path with the fix: initial SNAPSHOT to
held UNKNOWN yields no held screenshot, no automatic capture, no successful
ACK and no later DOWN. The ten-second dependent wait is skipped. UP is joined
before Browser.close. Additional cases cover UNKNOWN followed by UP failure,
owner retirement during the serialized read, optional UNKNOWN motion with
successful capture/ACK, and valid required-motion Space then lateral input.
First terminal failure remains unchanged after every later command attempt.
Unit controls also preserve the first sample-policy error when persistence or
both reverse UPs fail.

The full composed suite passed all 21 scenarios, including independent physical
release, partial DOWN, held read beyond release, late DOWN, review rejection,
CDP retirement/cancelled waits/captures, quit TERM/KILL/ACK stall, delayed pipe
EOF and the independent 30-second cleanup cap. Final focused policy controls
were rerun after the small follow-up assertions. `unrelated` additionally
proves successful explicit capture commands with unavailable motion.
Passive-reader and actual launch-client suites passed. The required
`flock /tmp/wine-build.lock bash tools/build.sh` passed.

Outer check logs are gzip drains from first byte, with actual process waits,
independent deadline watchdog waits and separate stdout/stderr EOF receipts.
Existing fixture-internal log formats are retained. The final historical and
new composed cases include actual browser child close, supervisor wait and
Python Session child waits; EOF is recorded separately. Earlier development
attempts (`old`, `old-confirmed`, `old-joined`, `launch`) are superseded: the
first had an incomplete screenshot fixture, the second asserted before joined
cleanup, the third hit the new API unit control, and launch omitted its output
argument. No missing wait from those attempts is presented as proof.

## Limits and next action

This was entirely offline: no Chrome, original game, guest, box, runtime input,
agent/worker or public deployment was started. Box ID/UUID/expiry/stop receipt
are null; state NOT_CREATED. No box watchdog was needed; local test subprocess
watchdogs were prearmed and joined. Free /home stayed above 1.5 GB.

Native lifetime remains REVOKED; all-writers and lifetime edict ABA remain
UNKNOWN. Last original death cause remains UNKNOWN. No route, ladder, contact,
Space consumption or gameplay progress is claimed. A future separately
authorized motion-dependent command must set `requireMotion: true`; runtime
qualification is still required before gameplay. Single-task STOP.
