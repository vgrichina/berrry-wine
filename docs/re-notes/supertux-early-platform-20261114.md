# SuperTux early second-row platform approach

Evidence: `scratch/runs/20261114-supertux-early-platform/result.json`.

**The sole original died during the second-row approach, before any second-row
jump was submitted.** Native Abort Level, map Quit Game and title Quit produced
`[Exit] code=0` at **544.486 seconds**. The early second-row launch, crossing,
first pit, level exit, map unlock and next-level entry remain unproved. There
was no movement on the new life, retry or second game.

Read-only original level/tile inspection places the second row at columns
34–40, x1088–1312, top y320. Tiles 77, 83 and 102 are solid; solid floor begins
at y448 beneath the decorative snow edge. The manual plan was to stage roughly
128–160 pixels before this 128-pixel rise, substantially earlier than the prior
failed 34-pixel launch. The first pit remains x3072–3168, with wood platforms
x3040–3200 at y352 and x3232–3392 at y256. These data describe geometry; they do
not select runtime inputs.

The original README documents P pause/unpause, Escape menus, arrow navigation
and Enter level entry. Previously observed native Space Jump/Left Control Run
bindings were reused after all **789** original media/settings hashes matched.
No configuration, lives, physics, level or save edits, downloads, source-tree
archives, media/WASM copies, boxes or deployments were used.

The new `tools/supertux-platform-controller.py` imports the released Forsaken
transport, including its control-before-fsync fix. Seven shared helper/test
files matched release `95afbb284e71cf1d1b416ff022e0b0b9288a15c4`; none was
edited. The adapter enforces an immutable **180-second Quit reserve** before
every DOWN and an irreversible manually entered Quit phase. Jump choices bind
personal floor, obstacle and launch-margin reviews. Gameplay/native P choices
require a full scene no older than five seconds. There is no player tracking,
automatic jump, route delivery or automatic pause/resume.

After Q2 guarded 1200 and Airstrike 900 actual terminal/outer waits and heavy
releases, the first locked full build passed. The production control suite
then reproduced the shared helper's parent-death acknowledgement-bound failure:
renderer UP was **1998 ms**, but release ACK was **2027.571 ms**, exceeding its
two-second check. Six other production checks passed. This was a controller
fallback/acknowledgement issue, not a guest physics diagnosis.

A focused actual-CLI adapter test reproduced **2013.070 ms** ACK before repair.
The owned adapter now durably publishes a **1750 ms** fallback before DOWN,
constrains each guard deadline to it, admits pulses up to **1500 ms**, and
checks that the complete pulse fits before every edge. The independent child
reads that cap even after parent death before consumed-time schedule delivery.
The same parent-death test passed at **1764.447 ms** ACK. Shared files remain
unchanged. Initial failures, the first fixture's insufficient reserve, and
`adapter-red-to-green.patch` remain in evidence.

Final checks passed: **seven policy tests, eight actual-CLI production tests,
29 HTTP transport controls, six terminal controls, three persistence controls,
production guard/input-owner/progress tests and the locked full build**.
The eight production checks cover the adapter's parent-death and normal
two-key pulses plus unchanged pipe-EOF, slow-fsync, normal pulse, late-ACK,
busy-server and dropped-ACK controls. The final build used
`flock /tmp/wine-build.lock bash tools/build.sh` while holding the heavy lock.

The original launched at **19:12:29 UTC**, fixed at 1200 seconds, after its
independent 1220-second watchdog was observably prearmed. It used registered
`supertux_013`, default 1000-block batches, real ticks and production guard
port 8465. A full native title was personally reviewed before the sole bind.
Later fresh scenes, rather than ACKs, established actual UI transitions.

The tested source base is
`2bd7e6bfe2580a933159c2338cb93ec50a21e7df`; module SHA-256 is
`c94ccf1b179f18bd4b47867445afed8cef2f1393b19aabfd259c7f3b94a7be09`.
Exact recovery inputs are in `source-pins.json`, `media-pins.json`,
`runtime.patch`, `new-runtime.patch` and `operational-inputs.patch`.
Postflight matched **1630 pinned source files**, all 789 media/settings files
and the module. Other games' actively owned helpers were excluded from this
control/build freeze; they are not imported by this SuperTux route. Git and
patches are the source archive.

The native baseline was **50 score / two coins / four lives**. An early opening
jump from grounded Tux near screen x201, with the first row at x384 and about
152 pixels of leading-edge margin, produced `first-jump-pose.png` and
`first-jump.png`. `first-row-settled.png` then shows Tux standing on that row's
top. This repeats opening progress and is not second-row completion.
`paused-floor.png` visibly shows the native “PAUSE - press 'P' to play”
overlay; host execution and real ticks continued normally.

Subsequent manually chosen approaches were 350 and 300 ms, separated by fresh
full scenes and released/settled observations. The last reviewed supported
approach, `early-approach-fresh.png`, shows Tux near screen x201, the second row
near x523 at y320 and an enemy near x518: approximately **290 pixels** of
leading-edge margin. Right300 was followed by `second-row-staging.png`, where
the row is near x289, Tux is absent and an enemy is near x284. The following
`second-row-outcome.png` proves native respawn: timer **295**, three lives,
versus the preceding first-life timer **155**.

The short approach did not produce a personally reviewed safe 128–160-pixel
staging point. The exact movement/contact interval was not captured. Enemy
contact is consistent with these scenes but not individually proved.
**No second-row jump occurred**, so the earlier-launch hypothesis was never
tested and the prior late jump was not repeated. No failed jump or approach
is called evidence of an emulator physics defect. The pit plan was not reached.

The one-death cap triggered irreversible Quit at **471.863 seconds**, before
the 1020-second gameplay cutoff. Reviewed Escape/Up/Abort Level, map
Escape/Up/Quit Game and title Up/Quit completed native shutdown. Final counters
were 50 score / two coins / three lives. No after-cutoff gameplay, deadline
extension or native relaunch followed.

All **22 consumed pulses / 23 DOWN receipts** retain one permanent owner,
unique nonces, independently prearmed release and actual release-child wait
0 with separate stdout/stderr EOFs. Maximum precision-scene age was **4.910
seconds**; maximum consumed-to-release ACK was **820.807 ms**. All releases
received ACK. Five choices were positively NOT_SENT before arm because scenes
expired; each used a distinct fresh scene/intent afterward. One optional
observer found no armed pulse after such a refusal; its actual child wait 0
and observer failure are retained without an invented airborne frame. The
original has no UNKNOWN, replay, rebind or sticky input failure.

Native, watchdog, supervisor-child and additional outer waits are **0**, with
actual waits and both EOFs recorded. The watchdog exited on the actual native
wait without firing; the heavy lock was released. Invoking tools expose
combined output, so their separate EOF fields remain unknown. Deliberate
parent-SIGKILL regressions explicitly retain missing release-child waits.

Sixteen result-named PNGs passed dimensions, CRC, inflate and SHA validation;
unselected PNGs were removed with hashes retained. Runtime PIDs are absent,
port 8465 is closed, and about 12.6 GB remained free on /home. No box was
created: ID none, state NOT_CREATED, expiry null, stop receipt not applicable.
No full27 or parity claim is made.

This bounded task stops here. A new assignment would need to establish an
actually reviewed early second-row launch, then first-pit and exit/unlock
proof. This run is not a completed crossing and its new life must not be retried.
