# SuperTux original pit/platform route

Evidence: `scratch/runs/20261114-supertux-pit-route/`.

**The sole original stopped after one native death before reaching the pit.**
Ordinary Abort Level, map Quit Game and title Quit produced `[Exit] code=0`
at **454.516 seconds**. No new pit/platform progress, level exit, map unlock,
next-level entry or full27 is proved. No second original followed.

Before launch, read-only inspection of the unchanged original
`data/levels/world1/level1.stl` and `data/images/tilesets/supertux.stgt`
identified the first pit at x3072–3168. The solid ground begins at y448;
the decorative snow edge above it is not solid. The first wooden platform
spans x3040–3200 at y352; the next spans x3232–3392 at y256. The level
and tile-definition hashes are in `level-route-inspection.json`. No guest
or media data was changed.

The predecessor's retained `new-running-jump.png` shows grounded Tux about
277 pixels before the first wood platform. Its subsequent 950 ms
Space+Right choice ended with Tux below the wood, inside the pit, followed
by native respawn. These frames establish a failed crossing; they do not
establish an emulator physics defect. This run's manual plan approaches
closer in short reviewed gestures, then selects a finite jump while floor
support remains visible. Each choice still requires a new personally
reviewed full scene, complete-window admission and independent UP.

The permanent controller remains the published repair `36a768709`.
Three real-endpoint regressions, direct 8465 pulse, during-pulse observation,
four supervision controls and the existing outer-wait control passed.

The old invoking-tool 143 cause remains unknown. The new run-local launcher
starts a durable wait owner with stdin closed and separate output files,
then returns promptly. That owner actually waits the outer supervisor
process and writes the additional `outer-wait.json`. The supervisor still
actually waits the native child and independently prearmed watchdog. This
removes the new run's dependence on a long-lived invoking-tool pipe for
the additional receipt. Real normal completion, SIGTERM to the wait owner,
and SIGKILL of the invoking process all retained native/watchdog/supervisor/
outer wait 0 with separate EOFs. A further real inherited-pipe control
proved that receipt writing waits for late stdout and stderr after child
exit. No earlier missing receipt or signal cause is fabricated.

The queue observed both Forsaken 900 and LMarbles 900 actual terminal waits
and heavy-lock releases. Closure drift required a fresh full build under
heavy/build locks, which passed. The first launch gate then refused a
subsequent change to another worker's `tools/forsaken-controller.py`, before
creating any watchdog or native process. A premature capture request after
that refusal failed because `launch.json` did not exist. This was an
orchestration mistake; its closed, unused controller context remains intact
at the run root. It had no input owner, DOWN, guest or guard UNKNOWN. It was
not reopened.

After the competing files were committed, a second fresh heavy/build-locked
full build passed. The first actual guest used `original/`, with a new first
owner and no prior guest context to restart. The gate now had actual launch
success checked before capture. Original source/module membership and hashes
matched, and all **789** original media/settings pins matched. The source
and relevant uncommitted/new files are recoverable from Git SHA plus recorded
patches; Python cache binaries are not included in recovery patches.

The sole original launched at **17:03:58 UTC**, fixed at 1200 seconds with an
independent, observably prearmed 1220-second deadline. It used unchanged
registered `supertux_013`, real ticks and the production guard directly on
8465. Launch source SHA is `85ce12f1f4862c0702739fe81e5ecbc3aa34f0a7`;
module SHA-256 is
`c94ccf1b179f18bd4b47867445afed8cef2f1393b19aabfd259c7f3b94a7be09`.
Postflight found zero source/media drift and an identical module.

The actual map/level baseline was **25 score / 1 coin / four lives**. This is
different from the predecessors and is not added to their counters. Reviewed
finite choices reached the opening row and passed the two first pillars
without losing a life. These repeat earlier clearances and do not count as
new progress.

`second-row-launch.png` shows grounded Tux at screen x255, the second row
beginning around x289 at y320, and a walking enemy near x374. The manually
chosen Space+Right 700 ms was followed by `second-row-jump.png`, a native
respawn with timer **298** and **three lives**, against the preceding timer
**215**. The scene therefore establishes one native death. Starting only
about 34 pixels before a row 128 pixels above the floor left a poor approach
for gaining height; the exact contact instant was not captured. Enemy or
underside contact is not individually proved, and no emulator physics defect
is claimed. This is the concrete safe-approach/landing blocker. The planned
closer pit launch was never reached or tested, and the failed old pit crossing
was not repeated.

The declared one-death limit triggered immediate native Escape/Pause,
Abort Level, map Quit Game and title Quit. No movement on the new life, second
traversal, runtime extension or restart followed. Score/coins remained 25/1;
the run lost one life. The 180-second shutdown reserve was preserved.

All **21 consumed pulses / 25 DOWN receipts** retained one permanent owner,
unique nonces, independent prearmed UP, full pulse/release deadlines and
actual release-child wait 0 with separate EOFs. Maximum consumed review age
was **10.392 seconds**. All 20 nonfinal choices had postrelease batch progress;
the final choice is checked against actual native exit. Three choices were
positively NOT_SENT/VALID before arming: two expired scenes and one
insufficient complete window. Each required a new capture and new intent;
none was replayed. The actual original had no terminal input failure or
UNKNOWN. Loading and menu transitions sometimes settled after the immediate
postrelease image; later fresh scenes, rather than an assumed visual result,
were used for subsequent choices.

Native, watchdog, supervisor and additional outer-process waits are all
**0**, each with separate stdout/stderr EOF receipts. `outer-wait.json` is
present. The watchdog exited on the native-wait receipt without firing, and
the heavy lock was released. The short invoking execution tool separately
returned **0**; it exposes combined output, so its individual stdout/stderr
EOF fields remain explicitly null. The short launcher child's two EOFs are
separately proved by `launcher-wait.json`. The old tool-143 cause remains
unknown and unchanged.

Twelve selected personally reviewed PNGs passed dimensions, CRC, inflate and
SHA checks. Unselected captures were removed with hashes retained. Operational
scripts are preserved as Git patches, without source-tree, media or module
copies. Recorded runtime and release PIDs are absent; port 8465 is closed.
Disk remained above 1.5 GB (about 13 GB free).

No boxes, workers, downloads or deployment are used. Box ID none, state
NOT_CREATED, expiry null, stop receipt not applicable.

This task stops with the gameplay blocker and verified native Quit. Further
work would require a new assignment to improve the second-row launch/landing
and then exercise the original-data pit plan. Repeating pillars alone is not
completion.
