# SuperTux complete-window admission repair

Evidence: `scratch/runs/20261114-supertux-window-level-exit/`.

**Controller repair passed and was published as `36a768709937f296de674714ff04f068b4c04aaf`.
Welcome to Antarctica completion, map unlock and next-level entry remain
unproved.** One fresh original reached the first pit/wooden platforms, lost
four lives across native traversals, then completed ordinary Abort Level,
map Quit Game and title Quit with `[Exit] code=0` at **758.292 seconds**.
Full27 remains unproved. No second original followed.

The predecessor's terminal failure is retained unchanged. Its 170.560 ms
remaining scene window could not fit an 850 ms pulse, and independent release
armed 58.125 ms beyond the deadline. Zero recorded DOWNs do not reclassify
that already armed failure as positively unsent. The earlier dd9175231
stomp/pillar run established airborne movement, both pillars, 175/5/four
lives and native Quit, but no level exit.

The recovered controller is now `tools/supertux-controller.py`. Before spawning
its release child it requires a complete window: 500 ms startup reserve,
500 ms ACK reserve per key, the full requested pulse and 250 ms release
reserve. These reserves fit inside the unchanged four-second operation limit
and twelve-second scene limit; neither deadline is extended. An insufficient
window returns explicit positively unsent NOT_SENT/VALID, reserves the old
capture/unique nonces, and requires a fresh capture and new intent.

After the actual independent-arm ACK, the controller checks the remaining
complete window again, then checks before each DOWN. Every post-arm race,
late ACK, incomplete pulse or late release ACK remains terminal/noReplay.
ACK parsing and post-arm checks sit inside the actual release-child wait
scope. Dropped ACKs retain UNKNOWN and independent UP; there is no retry,
owner rebind or short successful pulse. Child arm waiting has the original
immutable deadline. Set `SUPERTUX_CONTROL_OUT` to the run directory when
invoking the permanent tool directly; its run-local shim preserves existing
supervisor/observer commands.

Five final controller controls passed through the actual production guard and
HTTP endpoint/arm path. A 137.638 ms remaining window refused an 850 ms pulse
before child startup, with explicit NOT_SENT/VALID. A fresh capture and new
nonce then completed a full pulse. Actual delayed child startup took 2.454 s,
leaving 1.550 s: the post-arm check refused DOWN terminally, independent UP
ACKed, and the child was actually waited with exit 0 and separate EOFs.
Normal intent-to-arm overhead was 63.688 ms. Stale scenes, delayed consumption,
dropped ACK/sticky UNKNOWN, deadline cancellation and independent fallback UP
also passed. Default direct endpoint, midpress observation, four supervision
controls and the outer-wait control passed on the final source hash.

Initial harness failures remain recorded: duplicate unittest discovery reused
output directories; a concurrent Forsaken test used the same fixture port;
then changing the fixture port during a running suite invalidated its last
case. The final isolated fixture uses port 8496 and verifies the actual child
PID before binding. The original remains direct on 8465. These fixture failures
do not reopen either predecessor original. Recovery patches preserve the test
scripts without source-tree archives.

Permanent regressions are `test/test-supertux-window.py` and
`test/fixtures/supertux-window.cjs`; run with
`python3 -B test/test-supertux-window.py`. All three passed with actual
fixture waits and separate EOFs. They use OS-assigned loopback ports and
verify the server PID before binding, so simultaneous workers do not share
their guarded owner. The pulse-longer-than-window case waits for a real
scene age above eleven seconds rather than substituting controller time.

Both preceding diagnostic supervisors recorded actual waits and released their
heavy locks. The first full build refused a stale review hash for another
worker's `lib/renderer-input.js` change. That failure is retained. After its
owner updated the exact review row, a fresh full build passed under heavy and
build locks, with zero drift across 1,637 checked build inputs. All 22 guarded
CLI controls, input-owner, media and real-clock checks passed. All 789 media
and native settings pins match the accepted Space Jump/Left Control Run
bindings. Foreign source and census WIP remain uncommitted by this worker.

The sole original launched at **16:12:12 UTC**, directly on production port
8465 with registered `supertux_013`, unchanged media/settings, real ticks,
fixed 1,200-second runtime and independently prearmed 1,220-second watchdog.
Launch Git SHA is the repair commit above. The launch gate checked both file
membership and hashes, with no source/media drift. Module SHA-256 is
`c94ccf1b179f18bd4b47867445afed8cef2f1393b19aabfd259c7f3b94a7be09`.
`source-pins.json` records 1,706 files; launch Git patches retain relevant WIP.
Postflight found zero source/media drift and an identical module.

This run's actual map baseline was **75 score / 3 coins / four lives**.
The initial grounded level scene shows timer 291. Short early jumps reached
the opening row and cleared both first pillars. The first traversal reached
325/11/four lives, passed the later pillars and approached the first pit.
`pit-approach-jump.png` shows Tux above the gap between the left and right
ground edges, below the first wooden platform. The following reviewed scene
shows a native respawn, three lives and a reset timer: that crossing failed.

Later native traversals lost lives near the second row and the enemy/tall
platform approach. Exact collision instants were not captured; enemy contact
is an inference from proximity followed by respawn, not a proved emulator
physics defect. A native pause preserved level time for inspection; further
personally chosen shorter approaches still failed. The final reviewed respawn
shows **625/23 and no life icons**. Those counters include repeated traversals
and do not establish completion or unique forward progress. The concrete
gameplay blocker is failure to sustain safe landings and avoid enemies while
reviewing finite gestures. The controller remained healthy throughout.

All **54 consumed pulses / 84 DOWN receipts** used one permanent owner and
unique nonces; maximum consumed scene age was **9.273 seconds**. Every full
pulse and release ACK fit its unchanged operation deadline. All 54 independent
release children were actually waited with exit 0 and separate EOFs. All 53
nonfinal pulses had postrelease batch progress; the final choice was checked
against actual native exit. Seven choices were positively NOT_SENT/VALID
before arming: five expired scenes and **two insufficient complete windows**.
Fresh captures and new unique intents followed. No rejected intent was armed,
sent or replayed, and there was no sticky terminal failure/UNKNOWN.

Native Abort returned to the unchanged Welcome node; map Quit returned to the
title; the personally reviewed highlighted title Quit produced the actual
guest exit. Native, watchdog and supervisor-child waits were **0**, each with
separate stdout/stderr EOF receipts. The watchdog exited on the native-wait
receipt without firing, and the heavy lock was released. No timeout or signal
is counted as native Quit.

The invoking execution tool separately returned **143**, and the additional
`outer-wait.json` is absent. Its cause is unknown. The actual supervisor wait
0 is independently retained in `outer-child-wait.json`; an additional outer
wait 0 is not inferred or fabricated. The tool exposes combined output, so
its separate stdout/stderr EOF flags remain unknown. This lifecycle evidence
gap is retained alongside the proved guest Quit.

Twenty selected personally reviewed PNGs passed dimensions, CRC, inflate and
SHA checks. Unselected captures were removed with hashes retained. Run-local
operational scripts are recoverable as verified Git patches; no source-tree,
module or media copies are retained. Recorded runtime/release PIDs are absent
and port 8465 is closed. Disk remained above 1.5 GB (about 13 GB free).

No boxes, additional workers, dependency downloads or public deployment were
used. Box ID **none**, state **NOT_CREATED**, expiry **null**, stop receipt
**not applicable**. No further input or original is authorized by this report.
Next work would require a new assignment for safe pit/platform traversal and
the missing additional outer-wait cause; repeating the earlier stomp is not
level completion.
