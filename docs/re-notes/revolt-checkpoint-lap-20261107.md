# Re-Volt checkpoint/lap attempt, 7 November 2026

No new checkpoint or lap was verified. The original demo reached its default
RC Bandit / Toys in the Hood 1 race, then stopped at a concrete route boundary:
the player remained beside the wooden fence and start-line post. Ordinary
steering produced a side-on wall contact, followed by an upright resting car;
later forward, brake/reverse and steering pulses did not establish an exit.
Lap **1/3** remained unchanged. No emulator correctness defect was demonstrated,
and no physics, guest state, bindings or production code was changed.

Evidence: `scratch/runs/20261107-revolt-checkpoint-lap/`.
Candidate `re-volt-demo`; registered app `re_volt_demo`.

## Original controls and route

The original package's shipped `readme.txt` was read using small HTTP ranges,
without downloading or copying the game package. Its default controls are
arrows for driving, **End** for flip, **Home** for reposition, and Escape for
pause. End differs from a secondary guide's Enter mapping. The readme also
explicitly describes Configure Controller as a sequential assignment wizard.
That wizard was never entered in this run; defaults were preserved.

The released readiness/deadline, identity, exact-ACK and independent-release
controls were reused. Only run paths changed in the selected browser/input
helpers. Current relevant runtime files were selected separately from the
earlier readiness run; 13 non-run pins had changed, including the canonical
module and renderer/input/audio files. The original 443 installed files and
separate browser manifest matched their inherited hashes.

The one original browser followed the native main menu, default player name,
RC Bandit, Toys in the Hood 1 and summary. Some short Enter pulses produced
exact trusted events but no visible selection. A 12-second bounded Enter
advanced to name entry; later confirmations and passive captures completed
the route. Exact native event delivery does not establish a guest input poll.

The personally inspected race captures establish these limits:

| Capture in `review/` | Observed player/scene | HUD consequence |
| --- | --- | --- |
| `grid-review.png` | Upright grid beneath start sign; driveway exit ahead | 0 mph, lap 1/3 |
| `throttle-one.png` | Player and follow camera displaced amid nearby cars | 4 mph, lap 1/3 |
| `throttle-two.png` | Player faces wooden fence beside start-line post | 7 mph, lap 1/3 |
| `steer-right-one.png` | After three-second Right, player on its side against fence/post | 3 mph, lap 1/3 |
| `pause-settled.png` | Actual native Resume / Restart Race / Options / Quit menu; player appears upright | 0 mph, lap 1/3 |
| `resume-long.png` | Resume confirmed; player remains in fence/post gap | 0 mph, lap 1/3 |
| `fence-forward.png` | Six-second Up does not establish passage through gap | 1 mph, lap 1/3 |
| `back-from-post.png` | Post no longer occludes lane; player upright beside fence | 0 mph, lap 1/3 |
| `along-fence.png` | Eight-second Up leaves player against fence | 0 mph, lap 1/3 |
| `reverse-clearance.png` | After eight-second Down, no established reverse clearance | 1 mph, lap 1/3 |
| `reverse-steer-left.png` | Final short Left leaves same fence-side route boundary | 1 mph, lap 1/3 |

Nearby car motion and contact confound the initial displacement and turn.
Later captures show the player and camera against identifiable fence/post/house
geometry, but the visible lap counter never changes. Elapsed race/lap timers
and opponent-distance figures are not accepted as player checkpoint progress.
No separate internal checkpoint counter was identified or verified.

## Review error and recovery limits

One semantic review was wrong. `pause-recovery.png` still showed the race after
a two-second Escape pulse. The next command, `select-restart`, was constructed
in the same tool call that returned that image, before its pixels were
inspected, and falsely described an open pause menu. Its ordinary 500 ms Down
therefore went to the race. The original false review is retained alongside
`review-correction.json`. No restart was selected or completed. This command
must not be described as correctly reviewed admission.

Subsequent dependent inputs followed separate image inspection. A longer
Escape and passive settle visibly opened the actual pause menu; ordinary
Enter eventually selected Resume. There was no controller configuration,
forced reposition, private handler, memory/configuration edit or input replay.
The first throttle review also understated the displayed speed as 3 mph;
the inspected capture actually shows 4 mph, as recorded above.

The selected single-key driver did not exercise simultaneous throttle and
steering, Home or End. Its `input.cjs` key mapper does not admit Home/End,
although the separate released native helper has Home support. Those keys
were not guessed, substituted or sent through another input owner. A useful
next attempt needs qualified shipped recovery-key coverage and ordinary
combined throttle/steering through the existing driver, then a reviewed route
away from this fence. The present observations do not justify a physics fix.

The local post-run `recovery-key-capability.json` confirms both Home and End
are rejected by the selected mapper, without sending guest input. This is an
unmet driver-coverage prerequisite, not a demonstrated emulator blocker or a
completed native recovery. The coordinator's 23:58:34Z request to exercise
Home/End arrived after the original browser had already closed at 23:57:50Z;
it was read after the normal box stop. Its instruction not to replay or resume
an ended runtime was honored. The supplied original PC manual capture was
then inspected and independently agreed with the already-read shipped readme.

## Runtime identity and evidence recovery

The selected source checkout is
`941f63c3f1d4dbe54859033421c2a208857b62e3`. Relevant tracked changes were empty;
the retained untracked boot-helper patch and final run-helper patches complete
the recorded inputs. This task reused the existing canonical build; it did
not perform or claim a fresh code build.

Both loaded guest and renderer module bytecode hash to
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
CDP evidence binds the actual guest Worker/process instance and owning legacy
render Worker/endpoint, with WebGL 2 and ANGLE Intel Mesa UHD Graphics 620.
These are live owner/backend observations, not toolbar inference. Chrome was
151.0.7922.108 with an unemulated 1024×712 viewport and default guest Workers.

`runtime-pins.json`, `media-identity.json`, source SHA and binary diffs reference
recovery inputs without a source or media archive. The loaded module, unique
captures, served hashes, commands, native events and terminal logs are retained.
All 1,069 staged pins matched again at shutdown, including original media.

The run produced 28 exact command ACKs and 45 trusted native events: 21 balanced
key pairs, one balanced mouse pair and one mouse move. All 22 pulses had
independent release armed before DOWN and exact DOWN/UP ACKs. There was no
original UNKNOWN command or replay. This transport/input result does not erase
the one semantic review error described above.

The initial immediate post-quit clearance found Chrome absent, ports closed,
profile/writer removed and input released, but Node still draining its close
timers. Its failed assertions are retained. The later read-only custody check
confirmed Node PID 5906 and Chrome PID 5918 absent, HTTP/CDP ports 33907/40255
closed, and no profile, writer or held input. No original command or input was
replayed for that check. All 316 evidence references (260 unique hashes,
11,868,737 reference bytes) were retrieved and SHA-256/size verified before
normal stop. Recovery and stop records are `retrieval-verified.json` and
`normal-stop-confirmed.json`.

One fresh UUID created **bx_426fzwgf** at **23:42:34.091Z**, with initial expiry
**2026-11-08 00:17:33.939Z**. The immutable browser/watchdog deadline was
**2026-11-08 00:07:34.101Z**. Independent normal-stop and deadline delegates
were armed under a detached supervisor before allocation, with durable
heartbeats. Chrome exited normally at **23:57:50.233Z**. The delegated normal
stop completed at **23:59:31.801Z**, receipt **stop_751ce88f3a43b81b**, with
`forced:false`. Final API state is **archived**, active expiry **null**; no
resume, delete or additional box operation occurred. Both lifecycle delegates
exited zero and their supervisor recorded no remaining children. Local free
space stayed above the 5 GB launch floor and 1.5 GB operating floor. The
messageboard watcher is released at finalization.

There is no checkpoint/lap, completed recovery, win, broad performance, audio,
parity or full-corpus claim.
