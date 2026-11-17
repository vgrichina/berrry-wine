# Quake II guarded native run — 2026-11-14

Run: `scratch/runs/20261114-quake2-guarded-enemy/`.

**The requested outgoing hit/defeat and onward traversal were not established.**
The original registered `quake2_demo` reached the lower opening-room floor and
slatted passage at 100 HP. No living soldier or attack was reached. Native
Customize Controls, Pause and F1 Help were personally reviewed. The last turn
was positively cancelled without consumption at its five-second scene
deadline. The frozen controller closed further input. Orderly **host** shutdown
exited 0; **native Quit, clean native Quit and Full27 remain unproved**.

## Controls, native review and progress

The original pak's `default.cfg` and bundled
`lib/quake2-modern-controls.ini` were read without extracting or editing game
media. The overlay changes Enter to attack and Ctrl to crouch. The live F4
Customize screen independently confirmed **attack ENTER or MOUSE1**, **duck
c or CTRL**, WASD/arrow navigation, PGDN lookup, Z/DEL lookdown, END center
view and F1 help. No binding was selected for editing. Ctrl was never sent.

Native Pause displayed **PAUSED** and held the opening scene for manual review.
F1 requested while paused appeared after unpausing: **Outer Base, easy,
kills 0/18, goals 0/1, secrets 0/3**. The help overlay was then closed.

Finite reviewed keyboard movement cleared the diagonal support, reached the
lower floor and entered the slatted passage. Settled captures were used because
some immediate post-pulse images preceded the eventual camera change. Several
short right-turn handler acknowledgements did not produce a corresponding
guest key-DOWN observation or visible turn; no generic emulator defect was
isolated or patched. Navigation remained in the passage, without a reviewed
next-room or enemy encounter. There were **no attack pulses**, unchanged
Mouse1 bursts, outgoing-hit claims or weapon-pose-based combat claims.

`result.json` names exactly nine retained gameplay PNGs, including native
bindings, PAUSED, F1 kills 0/18, opening room, passage entrance/interior and the
terminal scene. Other manual captures were removed after recording their
selection hashes. No automated frame series, source archive, media copy or
WASM copy was made.

## Guarded input and the concrete blocker

The new `tools/quake2-controller.py` applies an irreversible 180-second Quit
reserve, exact reviewed Quit routes, native-binding-review admission, five-second
aim scenes and thirty-second menu scenes. It clamps the actual production guard
deadline to scene expiry as well as the gameplay cutoff. A focused negative
fixture fails against its preceding policy; all eight final policy tests pass.
This is a controller safeguard, not a demonstrated guest runtime repair.

At original launch, `tools/quake2-guard.py` was an independent derivative of
LBreakout's tested shared helper, with only its title and documented Quake II
key whitelist changed. The shared Forsaken controller, supervisor and tests
were read-only. Their exact tested hashes and original derivative delta are
preserved. The live runtime closure was not edited, rebound or relaunched.

Actual initialized native GL, a submitted full scene and personal image review
preceded the first production `guarded-bind`. The permanent owner was tied to
native PID **3807829**, start token **272854922**, and its exclusively owned
loopback endpoint **8557**. All gameplay edges used production guarded input,
unique nonces, one-use captures and independently prearmed UP processes.

There were **27 manual intents**: 18 handler-consumed, eight positively refused
before DOWN, and one final **CANCELLED, consumed=false** receipt. Some refusals
followed tool round trips longer than five seconds; one occurred after UP had
been prearmed but before DOWN. Fresh scenes and new intents followed only the
positive pre-DOWN refusals. No nonce or capture was replayed. All consumed aim
deliveries were within **4.517 seconds** of capture; the menu maximum was
**14.426 seconds**. Maximum recorded completion after consumed DOWN was
**1427.134 ms**, below the 2000 ms bound.

The final `far-end-turn` receipt reports immutable deadline expiry, no queued
effect and no consumption. Independent release was acknowledged and its child
was actually reaped with exit 0 and both EOFs. This was **not UNKNOWN**. However,
the helper's existing failed-pulse path writes `terminal-input-failure.json`
even for this positive cancellation and disallows further input. That record
was preserved; no clearing, owner replacement or guard bypass was used.

Handler acknowledgement is separate from actual guest delivery. The passive
observer records **16 guest key-DOWN and 18 key-UP messages**, versus 18
handler-consumed intents. Enter DOWN occurred only in the two ordinary menu
selections. Visible native movement, Pause, Customize and Help establish those
specific consequences; they do not establish combat.

After the original was closed and its source pins checked, an HTTP fixture
reproduced the same unnecessary terminal closure. The owned derivative now
accepts only explicit deadline-expired cancellations with matching owner,
epoch and nonce, no queued effect, `consumed=false`, null consumption time and
`noReplay=true`. Independent UP must succeed and a subsequent status query must
match the cancellation. It stops the remaining edges of that intent and
requires a new scene, review and distinct intent. Nonce tombstones remain.
It does not clear any terminal record or relax the five-second bound.

Eight focused refusal fixtures pass: a positive cancellation followed by a
fresh distinct intent; refusal of the first edge without sending the second;
and terminal closure for a partly consumed pair, UNKNOWN, wrong owner, epoch,
nonce or subsequent UNKNOWN status. Duplicate nonce rejection is checked.
The first green attempt exposed a fixture capture/action name collision;
that test naming error and its corrected run are retained. The earlier test
loader invocation error is also retained, separately from the causal red.
The post-run fix was never used for original gameplay or native Quit.

The next gameplay step requires a newly authorized original attempt to reach
and review an actual enemy consequence and native Quit. This task did not
launch a second original or retroactively qualify its missing outcomes.

## Exact execution, build and recovery

Heavy checks and runtime waited for the reserved LM8 run and LBreakout
persistence run's actual outer waits, then used `/tmp/wine-heavy-runtime.lock`.
The full build passed under `/tmp/wine-build.lock`. Final checks passed:

- Eight policy tests and eleven production HTTP/guard fixture tests.
- Four actual `test/run.js` CLI/renderer regressions and six lifecycle/identity
  tests, including delayed/dropped ACK, overlong physical hold, signal exits,
  actual wait identity and separate late stream EOFs.
- Four production guard/owner/progress/SDL script suites and native GL provider
  preflight: llvmpipe LLVM 20.1.2, WebGL 1.0. This is not a physical-GPU or FPS
  qualification.

After the refusal fix, the eight policy, eight refusal, eleven HTTP/guard and
ten actual CLI/lifecycle checks, four production script suites and full locked
build passed again. Their separate waits and final owned-file hashes are in
`postfix-*-wait.json` and `postfix-pins.json`. These checks use fixtures, not
another original Quake II process.

The unchanged registered startup was `+set vid_ref gl +menu_main`, with authentic
DLL preloads, `--headless-gl --real-ticks`, no guest threads, default 1000-block
batches and fresh VFS. No console/map command, cheat, solver, autoaim/tracking,
guest code/state/config/clock edit, external save, download, root dependency
change, box or deployment was used.

Build and launch HEAD: `69122540a296dbc90827f94c27e038d8663cd43d`, with the
recorded dirty/untracked Git patches. Actual loaded WASM SHA-256:
`c94ccf1b179f18bd4b47867445afed8cef2f1393b19aabfd259c7f3b94a7be09`.
Postflight found zero drift in **1690 source, 68 registered media/control,
162 provider and 104 observed loaded-file pins**; the module also matched.
Git plus `runtime.patch`, `new-runtime.patch`,
`original/launch-source.patch` and operational input patches supplies original
source recovery. Separate final-change patches preserve the post-run fix.

Provider recovery used the prior Q3 recipe's pinned package/lock locally,
`npm ci --offline --ignore-scripts`, then exactly nine cached native files from
`scratch/native-provider-cache/node3d-20261114`. All 162 provider size/SHA pins
matched. Package SHA-256 was
`3ed55cf48ef3a1a00e7971ea528b9b2c991decbbf8917901310d59f3808e936f`;
lock SHA-256 was
`125ea670ef6333b93d4375ed558fc42c24af2da9a4fbe2ed49e929ee519e0976`.
An initial receipt-writing script variable error and corrected offline rerun
are recorded; neither launched a game. The private installed dependencies were
removed only after postflight; the shared nine-file cache was preserved.

## Deadline, shutdown and actual waits

The single original launched **18:35:39Z**, with immutable gameplay cutoff
**18:52:39Z**, runtime deadline **18:55:39Z** and an independent **18:55:59Z**
watchdog armed before native launch. No deadline changed and no relaunch
occurred. The final scene was personally reviewed, an irreversible Quit phase
was recorded, and the closed controller admitted no native Quit key. The
explicit host-control shutdown must not be relabelled native Quit.

The harness reports **699131 batches in 665.509 seconds**, 3473 presents and
`gl_sw_enabled=0`. Actual native wait was **0**, with both EOFs and no drain
errors, at **18:46:46Z**. Watchdog, supervisor child, outer child and additional
outer wait were all actual **0**, with separate stdout/stderr EOFs; the watchdog
did not fire. Native termination was about 533 seconds before the fixed
deadline. All recorded process IDs were absent, endpoint 8557 was closed and
the heavy lock was released.

The short launcher has actual child wait 0 with both EOFs; its invoking tool
returned 0, whose separate stream EOFs are unknown. The additional detached
waiter's own wait is unknown, although its actual child wait is recorded and
its PID is absent. The first queue-only preparer was deliberately terminated
with tool exit 143. The second preparer's tool also returned **143**, reason
unknown, despite all separately recorded checks returning 0 and its ready
record being written. These tool outcomes remain separate from native waits.

No box was created: ID null, state **NOT_CREATED**, expiry null, stop receipt
**N/A**. `/home` remained above 1.5 GB free. The task ends with outgoing enemy
hit/defeat, onward traversal, native clean Quit and Full27 explicitly missing.
