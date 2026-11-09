# Quake II required browser observation startup, 2026-11-09

Run: `scratch/runs/20261109-quake2-browser-guard-door-0046/`.
Outcome: concrete production startup defect reproduced, repaired and tested.
Actual guard/onward-door gameplay, native gameplay input and owning gameplay
load/use receipts remain unverified. No original game or box was started.

The published e65895936 browser binding rejects a changed canonical CPU or EXE.
The enclosing production `WineAssembly._maybeStartGuestWorker()` nevertheless
swallowed that failure and returned successfully, allowing cooperative startup
without the requested owning observation. Its real `WorkerLink` also failed to
reject readiness on an unsequenced initialization error, hiding the actual
PATHHASH error behind the 20-second readiness timeout.

`startup-before-02-stdout.log.gz` retains the real Chromium reproduction through
host.js, production GuestThreadHost/WorkerLink and guest-worker.js. The test
server changes one byte of the canonical CPU response; it never changes the
installed file, observation replies or guest state. The Worker reports the
canonical PATHHASH rejection, the host subsequently logs the readiness timeout
and single-thread fallback, and the method returns with no error. The expected
rejection assertion fails. This is a controlled failure-path reproduction, not
evidence that an unchanged original gameplay launch spontaneously failed.

The host now captures the strict load-observation request before asynchronous
startup. Missing Worker prerequisites reject that request. Failed attachment
joins the existing owner retirement and propagates the actual error as its
cause, instead of admitting cooperative startup. Changing the page flag during
the await cannot weaken the captured request. Native-write observation remains
a separate strict opt-in. WorkerLink now rejects and clears its existing ready
promise on its actual unsequenced `init` error; its existing rejection wrapper
clears the timer. Sequenced errors, request deadlines and owner retirement
protocols are unchanged. The callback census records this bounded review.

`tools/quake2-browser-startup-failure.test.cjs` exercises the production browser
host method and real Workers with the unchanged shipped CPU
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`.
The final 20 cases include canonical CPU/EXE rejection, load-only rejection,
flag changes during startup, five prerequisite refusals, five valid startup
flag combinations, ordinary default-off failed-instantiation fallback, and
five default-off prerequisite controls. These are bounded startup tests with
inert host imports and no guest instruction execution, not gameplay captures.
All 10 Worker targets are observed destroyed; Chromium and the independent
UUID/deadline watchdog exit zero, the profile disappears, and the server closes.
Independent local checks find all recorded browser/watchdog PIDs absent and
the three test-server ports closed. The final watchdog was armed before
Chromium with an immutable three-minute deadline. No allocation was attempted,
so no box watchdog, remote provider barrier or box stop was exercised.

Both `test-host-worker-lifecycle.js` and
`test-host-worker-lifecycle-independent.js` pass. The required locked build
passes and produces the unchanged CPU SHA. The broader screensaver wiring
check fails at its preexisting source regex expecting a removed shell launch
expression; `screensaver-baseline-regex` verifies that expression is absent
from both committed baseline and edited host. Its earlier intentional fixture
pump-trap output is not the failure cause. No unrelated test was edited.
Twelve accepted unchanged PATHHASH references retain independent stored/original
SHA, sizes and GNU gzip CRC verification; native parity/continuity controls are
reused rather than relabeled as fresh gameplay evidence.

The first harness attempt had an escaped-newline typo in its watchdog program
before Chromium started. Its retained stderr shows the syntax failure. The
waiting harness was terminated with actual parent WAIT -15 and stdout/stderr
EOF; the first watchdog's individual exit receipt was not serialized and stays
UNKNOWN. The harness now rejects early watchdog exit and retains its report
before arming. The corrected before-repair reproduction, initial repaired
matrix and final matrix all retain actual browser/watchdog exit receipts.

Raw source lifetime remains REVOKED; all-writer coverage, edict ABA,
historical143, nonleader and untraced observations remain UNKNOWN. No observer
semantics, certification, input, ACK, clock or gameplay limits were weakened.
Both strict flags and the existing trace must still be armed before the first
owning run on a separately authorized original. No replay or second original
was attempted, and no Q3 capture files or SuperTux controller were used.

Recovery is Git SHA plus small owned patches; media and CPU stay at their
existing paths, referenced by hash. Logs start compressed, and final evidence
checks exact regular-file set, original/stored sizes and SHA plus GNU gzip CRC.
The board watcher is stopped and awaited before release. Sampled /home free
space stays above 1,500,000,000 bytes; no continuous-floor claim or RAM gate.
No source/media/module archive, peer/old deletion, agent or public deployment.

Final box: NONE / NOT_CREATED. Expiry NULL. Stop receipt N/A.
Next: separately authorized canonical local/remote provider barriers, paused
original with both strict flags and owning trace, followed by reviewed native
input and actual guard/door PC/UUID/range receipts. This task stops after its
own-path commit and authenticated publication.
