# Tracer terminal notification followed by adopted-child reap

The selected Quake II kernel was `e1a413983f251534ad77dbf337844ab9ca3afb74`,
`tools/native_kernel_custody.py` SHA-256
`04a3598c7e23966d57173df5f42ba740fd36106ca4e8f78c84c435f49451221d`.
Evidence remains at `scratch/runs/20261108-quake2-upper-opening-1940/remote/`:
`custody.ndjson.gz`, `kernel-drain.json`, `supervisor-actual-wait.json`.
The journal's original 225135 bytes hash to
`c4532cf5cac202072ea129be6604f55c2085102883e117ac7c1528edff28bbc3`.

PID 7185/start 16988 was registered by fork at sequence 52 with parent 7173.
Sequence 1381 records CLD_EXITED/0, zombie, TGID 7185, PPID 7173;
1382 records the actual terminal wait status 0. Sequence 1448 records another
CLD_EXITED/0 for the same PID/start/TGID, now PPID 7172 (the subreaper).
The following wait hit the duplicate assertion; its consumed status was not
logged, so that exact historical second status remains unknown. Sequence 1449
records failure. The finalized drain is incomplete with unreaped 7173/start
16882 and thread 7179/start 16927; supervisor 7172 actually exited 1.
This is evidence of tracer notification followed by real-parent adoption,
not evidence of exec or PID reuse. No historical nonleader exec is inferred.
The original game was never launched; the omitted kernel command log cannot
be reconstructed here. The separate earlier supervisor-143 cause stays unknown.

The repair retains the first actual terminal wait as the identity receipt,
including its observed terminal parent. A later actual terminal wait is
accepted as `adopted-reaped` only when the original parent was external to the
supervisor, the new observed parent is the supervisor, the PID/start matches,
the task is a process leader, the consumed status matches, and no adoption
receipt already exists. The journal links both receipts and the durable
WNOWAIT observation preceding the second consumption. All other duplicates
still fail. Parent-side zombie disposal does not fabricate another receipt;
the tracer's actual terminal wait already proves that identity's death.

Registration, pending lineage/ESRCH reconciliation, nonleader-exec refusal,
identity checks, bounded cancellation, gzip finalization and incomplete-drain
rules remain enforced. A present zombie still prevents a complete drain.

Offline evidence: `scratch/runs/20261108-custody-terminal-identity-1951/`.
`python3 -B tools/native_kernel_custody_test.py` passes 25 tests, including
six terminal-adoption controls. A real Python thread forks a child, which exits
7 (or receives SIGTERM). The real ptrace terminal wait releases a file barrier;
the parent then exits without waiting, or consumes the child itself. All
waitid, waitpid, ptrace and adoption results in the positive controls are real.
The exact selected historical source fails on this adoption control, while the
repaired source drains completely. This reproduces the lifecycle cause, not
the historical scheduling of every Node thread: the historical two unreaped
siblings are not recreated as an assertion target.

Two negative controls deliberately corrupt only the second consumed status,
or inject a third receipt after the real second wait. Both remain incomplete
with the duplicate assertion. They are fault injection, not kernel evidence.
Each control has a separate observable seven-second watchdog armed before
the supervisor fork barrier, an immutable supervisor deadline, actual terminal
waits for supervisor/watchdog, and an outer subreaper draining any adopted
children. Watchdogs did not fire; final controls' outer adopted-wait lists were
empty. Intermediate stale-directory controls did require outer adopted waits
(exit 0), retained in their `isolated-waits.json` files.
Each invocation uses fresh fixture directories so retained barrier files cannot
release a later run. A failed intermediate rerun using stale directories is
retained as `focused-repeat-stale-fixture.*`; final results use the corrected
unique-directory fixture. Watchdog targets are checked by PID/start identity.
Another intermediate suite run failed the existing runtime-deadline control
with an incomplete drain (`focused-deadline-incomplete.*`). Its temporary
fixture details were not retained, so the specific cause remains unknown.
The final suite retains gzip controls in `gzip-final/` and passes with the
original .4-second runtime/.6-second additional cleanup bounds unchanged.
Custody journals and test/build logs are gzip from their first record/byte.
Small fixture barrier and wait JSON files are retained directly.

The required `flock /tmp/wine-build.lock bash tools/build.sh` passed; the module
remains SHA-256 `d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc`.
`focused.json`, `build.json`, and `manifest.json` record results,
stream hashes, source commit, relevant binary diff and existing executable/
module path hashes. Git plus the small owned patch is the source recovery
recipe; no tree archive or media copy was made. Existing game media were not
used. No browser, original, remote service, box, deployment or worker was
launched. Box ID/state/expiry/stop receipt: N/A, NOT_CREATED.

Next: a separately assigned fresh Quake II run must explicitly select the
repaired kernel and readiness helper. Full27, parity, audio and FPS stay open.
