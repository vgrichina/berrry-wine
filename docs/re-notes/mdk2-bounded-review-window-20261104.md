# MDK2 fixed construction review deadline and first bootstrap fault

Input is `6055aa7e43d7c3505b6796d447663366e3b85146` and
`mdk2-medium-through-loading-20261104.md`. Evidence is
`scratch/runs/20261104-mdk2-bounded-review-window/` (RUN). One authorized launch
wrapper ran, failed before calling Puppeteer, and stopped. Zero Chrome or game
processes launched; no gameplay, fresh game pixels, Lua execution or genuine
Level creation is claimed. No retry or diagnostic Chrome ran.

The owner explicitly replaced the prior 10000ms WALL requirement with one
fixed observation deadline of at most 180 seconds. The sealed original command
log spans 118018ms from Medium command 91 to the final loading capture 114.
Its first Medium-to-pending interval is 20007ms. The chosen 180000ms window
covers the retained schedule with 61982ms margin. RUN retains the selected
command rows and their source log path/hash in `observation-window-basis.json`.

The owning binding now fixes `traceEnd` once at start to the smaller of
start+180000ms and the absolute browser execution cutoff. A first command's
deadline no longer clips the entire observation window. Each command still
has its own deadline, checked at start/checkpoint/resume; continuation never
changes the observer, timer, traceEnd, records, boundary count or known history.
The 100000 native-boundary and 512-record bounds remain. Owner, input, ACK,
frozen-register, UNKNOWN-prefix and first-fault guards remain, including throws
at rejected native boundaries. No skipped execution or invented history is used.

The actual selector, pending/construction/loading controllers, composed driver,
inspection/ACK path and owning binding/observer execute together over explicit
read-only native-state and transport fixtures. The old 6055 binding fails a
20007ms review pause before further guest execution; the repair completes all
16 quanta with one start, 15 resumes and 16 checkpoints. This includes repeated
16-slice Medium press polls, 32/16 release polls, pending, absent/published Level
branches and eight 64-slice loading commands. Every report retains the same
deadline. Untrusted/foreign input, changed history, expiry and all native
boundary/record/ownership/register negatives still reject.

The personally viewed rehearsal used those actual controllers/driver/observer
with separately recovered, hash-checked historical title, New Game menu,
Medium difficulty, fade, pending and black construction/loading captures.
Each VIEW was followed by a separate timestamped receipt before continuation.
It took 67233ms overall, with 43167ms inside the observation window. Historical
black pixels establish no Level creation or visible loading artwork; synthetic
scene branches are explicitly independent of those pixels. This is a timing
and protocol rehearsal, not original gameplay evidence.

Both retained modules also execute genuine original queued demand PUSH/CALL,
finalizer, consume, poll, demand return and script-buffer fragments under the
actual shipped Worker and composed preload. Full-memory/register/lazy-flag,
command and original trap parity pass against control. A stable explicit test
clock replays retained schedule offsets through 118018ms in both the binding
and the observer. The old window rejects the first 20007ms continuation; the
new fixed deadline survives the full schedule without renewal. Fixture setup
repositioning remains explicit; fragments do not supply original gameplay
history. Standalone current-build normal/compat parity also passes.

Local assignment and Python transport now both name this task, with 720-second
browser, 60-second bootstrap, 40-second command and 180-second cleanup bounds.
Hard close/recovery cutoffs are 23:50Z/23:53Z, with full admission reserve.
The predecessor release parser accepts an exact dated Stronghold heavy-release
line or the coordinator's explicit named release. It rejects other tasks,
mentions, waiting messages, ordinary file releases, stale and future releases.
The required coordinator release at 20:50:07.552949Z named
`stronghold-customgame-drain-cause-nov04` and explicitly allowed MDK to proceed.

The sole wrapper started at 20:52:12Z under an external exclusive
`/tmp/wine-local-runtime.lock`. Its exact source reference was main
`868d826426917669bed0c2705912bfd7c2782d53` plus the retained binary diff.
The actual 111 helpers, four Git dependencies, both retained modules and all
432 filesystem/HTTP entries passed. Local release issuance was
20:52:13.837Z, closeBy 21:04:13.837Z, recoverBy 21:07:13.837Z.

The first actual fault was `owned lifecycle recorder not installed`, thrown
by `lifecycleForRun(RUN)` before the call to `launchOwned`. The run-specific
wrapper omitted `traceOwnedLifecycle`; prior byte/protocol checks did not
exercise this installation-to-caller prerequisite. The original driver closed
its HTTP server and stopped immediately. This is an operator/bootstrap failure,
not an emulator or MDK2 guest fault.

The causal offline repair makes the mandatory recorder part of local `install`.
It preserves a previously installed tap, otherwise installs one before returning
the release; restore removes only a tap created by this installation. The test
executes actual old and new installation/caller paths in isolated Node children
under a private real external flock. Only the lock pathname, fixture clock and
explicit board input differ. Old code reproduces the missing-recorder fault;
new code provides the exact tap and records installation with zero child
spawns. Existing installed-Puppeteer cleanup and caller tests still pass.

Node PID 1133322/start ticks 187274147 exited 1 and is absent. Chrome PID/start/
normal-exit are NA because the browser launcher was never called. Own game HTTP
port 45127 refused connections after normal server closure; the runtime flock
was free. The local slot was explicitly released at 20:53:05Z. The final offline
preflight Node 1128729/start 187265884 exited 0, with proof HTTP port 44773
normally closed. Box ID/state/expiry are NA; the coordinator owns future boxes
and shutdown. No foreign process received a signal.

Validation: 135 integration checks, 37 local lifecycle/caller/release checks,
the separate personal-view rehearsal, both retained-module native fullstate/
command/trap parity, standalone normal/compat parity, exact filesystem/HTTP
preflight and `flock /tmp/wine-build.lock bash tools/build.sh`. The input run's
7667 sealed files / 14814052 bytes remain unchanged. RUN records exact Git SHA,
relevant binary diff and this new-file patch; media/modules are existing paths
and hashes only. No source snapshot, tar, media/module copy, npm, boat, box
operation or subworker was used. Next original requires a separate assignment;
this task stops after publishing the tested bootstrap repair.
