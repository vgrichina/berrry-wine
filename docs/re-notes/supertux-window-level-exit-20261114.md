# SuperTux complete-window admission repair

Evidence: `scratch/runs/20261114-supertux-window-level-exit/`.

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

The single bounded original is pending its fair heavy turn after the Forsaken
exit and LMarbles SDL diagnostics. No level exit, map unlock, next-level entry,
native Quit or full27 claim is made yet. No box, network dependency, worker or
public deployment is used.

Both preceding diagnostic supervisors recorded actual waits and released their
heavy locks. The first full build refused a stale review hash for another
worker's `lib/renderer-input.js` change. That failure is retained. After its
owner updated the exact review row, a fresh full build passed under heavy and
build locks, with zero drift across 1,637 checked build inputs. All 22 guarded
CLI controls, input-owner, media and real-clock checks passed. All 789 media
and native settings pins match the accepted Space Jump/Left Control Run
bindings. Foreign source and census WIP remain uncommitted by this worker.
