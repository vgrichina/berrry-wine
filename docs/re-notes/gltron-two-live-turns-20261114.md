# GLTron two live turns and natural round result, 2026-11-14

The original registered GLTron reached two distinct reviewed live native turns
in one fresh round, followed by the natural **PLAYER 3 WINS!** result. Three
individually chosen finite A turns were sent in the successful round: the
extra third turn provided another live heading/path view because the lower
horizontal minimap segment was difficult to see. This is original gameplay,
not fixture acceptance. No production source was changed.

Evidence: `scratch/runs/20261114-gltron-two-live-turns/result.json`, with the
successful session in `attempt2/result.json`. The tested main SHA was
`a9448409727cc11d065591831103f03ae1b71c22`; the 2,199,488-byte runtime module
SHA-256 was `c7f5bada4da4b4ed95b235add0aa1c9843176805d29d5b1ee79359752a19d348`.
The 92 existing media paths matched the parent hashes before and after;
`launch-source-pins.json` and `postflight.json` establish that the relevant
source files did not change during the successful session. Git plus the
retained binary diffs and addition patches preserve the source identity.
No source archive, media copy, module dump or capture bundle was made.

## Reviewed successful round

All paths below are relative to the evidence directory's `attempt2/`.

* `final-round-start.png`, batch 1489: ordinary Return after the preceding
  natural result started a fresh round; Space paused it. An intact yellow
  cycle and a new short yellow minimap trail near (123,424) are visible.
  The upper-left crash/winner lines are persistent console history from the
  preceding round, as documented in `gltron-current-main-gameplay.md`.
* `final-live-corner-one.png`, batch 1664: intact yellow cycle, native
  **GAME IS PAUSED**, and a clear west-to-south yellow minimap bend at
  (106,424), continuing down to approximately (106,438). A down/up executed
  at 1655/1656; the capture establishes eight actual batches after UP.
* `final-live-corner-two.png`, batch 1778: the yellow cycle remains intact
  after the second native A turn; the camera/world orientation changes and
  the yellow minimap endpoint moves east to approximately (123,440),
  perpendicular to its preceding southbound leg. The pause banner is visible.
  A down/up executed at 1767/1768; ten further batches precede this capture.
* `final-two-corners-live.png`, batch 2084: briefly resumed without steering
  to remove the pause lettering. It shows the living cycle and changed yellow
  endpoint. The active horizontal minimap leg remains poorly visible against
  the floor grid; this frame is not claimed to show every trail pixel.
* `final-corners-unpaused.png`, batch 2359: after another separately reviewed
  finite A turn, an intact yellow cycle is moving north, with yellow world
  trail visible at the left and behind the cycle, and a new northbound yellow
  minimap segment near x130, y433–440. A down/up executed at 2354/2355;
  this capture is four actual batches after UP. Together the reviewed
  cycle/camera/path/endpoint changes establish distinct live native turns;
  the result is not inferred from ACKs alone.
* `final-natural-outcome.png`, batch 2622: after ordinary resume and eight
  seconds without steering, fresh PLAYER 1/4/2 CRASHED and WINNER: 3 console
  entries accompany the large native **PLAYER 3 WINS!** banner. No turn was
  sent after native death, and no round restart separates the successful
  three-turn sequence from this outcome. `final.png` is the shutdown capture
  of that same result, also personally viewed.

Before each finite turn, a full frame's cycle, forward path and minimap were
reviewed, and `dump-focus` reported the same main hwnd 0x10001. Each selected
turn used a finite independent UP timer, followed by a chosen settling
interval and ordinary Space pause. There was no automatic route, tracking,
blind action loop, guest-memory/configuration/clock/AI write, browser, box,
media provisioning or fixture promotion.

## Rejected attempts and controller correction

The earlier 0300 note and `fcdde27ce` atomic0230 note were read. Their original
one-corner proof and second-after-crash failure were not promoted into this
result. The pruned helper and lifecycle tests were reconstructed from their
surviving small Git addition patches.

The first fresh session incorrectly used Return as if it paused during play.
The reviewed images lacked a pause banner. That session's second turn is
rejected; its final image shows a natural PLAYER 3 WINS result but does not
prove the requested live sequence. This was a controller/observation mistake,
not a production defect. It ended with normal quit and complete wait/EOF.

Original executable disassembly, retained as `native-space-pause.txt`, proves
`keyboardGame` at 0x408631 compares SDL key 0x20 (Space), branching at 0x408635
to0x4086a7, which sends RETURN_GAME_PAUSE=2. `scripts/main.lua` maps that return
to the native pause callback. The run-local allowlist was extended only to
Space, and the fresh session visually verified **GAME IS PAUSED** after Space.
Its initial round still rejected S as a second corner because the settled
frame showed yellow crash debris. That round was resumed without turning to
its natural PLAYER 3 WINS outcome before starting the successful fresh round.

The recovered publisher retains exclusive single-use ID reservation,
exclusive temporary publication, fsync/rename, permanent claim-before-send,
duplicate/invalid refusal, and independent UP timers armed before DOWN.
ACKs are separate from terminal UNKNOWN, which is never replayed. The only
command extensions are read-only focus inspection and balanced native Space.
`first-executed-control.py` preserves the first session's helper; `control.py`
and addition patches preserve the corrected one.

Seven focused controls/lifecycle tests passed in `focused-tests.log`, including
actual exited-child/no-replay, normal quit, supervisor signal and independently
expired deadline with actual parent wait and both separate EOFs. After the
Space allowlist correction, five focused controls passed in `space-tests.log`,
including balanced Space and rejection of an unsupported key. Synthetic
process tests are not gameplay evidence. The full build passed under both the heavy-runtime lock and
`flock /tmp/wine-build.lock bash tools/build.sh`; `build.log` records it.
It reproduced the exact tested module hash. Production source was not repaired
or claimed.

## Lifecycle and scope

Both native sessions held `/tmp/wine-heavy-runtime.lock`. Each separately
observable watchdog durably armed before its direct runtime child launched,
with an independent 260-second deadline and exact PID/start-token targeting.
The runtime's own bound was 240 seconds. Both sessions ended normally through
quit: actual runtime wait 0, stdout EOF and stderr EOF, watchdog wait 0, and
runtime/watchdog PIDs absent. The successful session stopped at 09:41:08Z
within its original bound; no deadline was extended. Every actual key pair
received DOWN and UP ACKs before quit, and final-turn postrelease progress is
recorded independently in `postflight.json`. Heavy lock was released.

/home remained over 14 GB free, above the 1.5 GB floor. Foreign WIP, TIM adapters
and bundles, graphics source ownership and inherited artifacts were preserved.
Box ID none; state NOT_CREATED; expiry null; stop receipt N/A. No new work is
requested: the assigned single gameplay task is finished and stopped.
