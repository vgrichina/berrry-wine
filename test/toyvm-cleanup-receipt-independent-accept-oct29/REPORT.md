Candidate `5a88ca099b962e946160afd2d4d71a950bf46db3` passes this bounded
independent cleanup-receipt acceptance. No production repair or integration.

The first behavioral check was unchanged `accept_caller_rebound.py` from the
candidate. SHA256 `23e3bbcf2e5a6b251e0857fc42545380cc4616960d13e7e4c1aefbcd653fb83f`
passed; its original is preserved verbatim in the parent tree. The only original
to rebound difference is the caller SHA literal, independently checked.

The new test performs 32 API and script-entry CLI cases. CLI runs the exact
production file with `runpy.run_path(..., run_name='__main__')`, argparse,
stdout JSON and SystemExit, within this test process and its patched I/O.
This is not an external unpatched CLI process or a real runtime test.
Both routes use the actual source-pinned loader, actual adapter and evaluate.
Neither load_backend nor evaluate is replaced. The exact flattened supervisor
module is imported, then its supervise function is replaced by a tiny deterministic
receipt fixture before invocation. Server Popen, socket snapshots, mountinfo and
unmount are deterministic fakes. No real child/backend/server/mount runs.

Actual backend contract: remainingMounts is mountinfo lines in a list, unmountExit
is int returncode or None when no unmount was attempted, serverExit is an int
returncode, and supervisor cleanupComplete must be singleton True. Only empty
mount lists and successful shutdown statuses establish cleanup.

New cases include nested JSON remainingMounts contents (null, bool, number, empty
string, arrays, objects and a NUL-containing string), nested/structured receipt
shapes, missing required fields combined with optimistic diagnostics, structured
cleanupComplete, missing whole receipt and four valid status combinations.
Adversarial JSON values are injected into the tiny supervise result's cleanup
attachment, while the real adapter performs its normal finally block.
These are caller-boundary type adversaries, not claims that a real subprocess
can emit those Python returncode types. Existing 78 repair checks were not rerun.

Three cases preserve the adapter's unmodified cleanup attachment and simulate
an unmount failure, a remaining mount and a failed server exit after a successful
child result. API and actual script-entry CLI reject all three. Success did not
survive any of these cleanup failures. Complete API/CLI witnesses are retained.

The required rejecting mutation removes only the exact-int guard on unmountExit.
It accepts JSON false with API accepted=true, cleanupComplete=true and CLI exit0;
the new oracle rejects it with exit1. Exact witness and mutated text are retained.
This is a mutation witness, not a counterexample against the repaired candidate.

An initial harness failure shared the mount-read counter between API and CLI:
the API saw a failed unmount while CLI incorrectly received a fresh clean state.
Original stdout/stderr are retained. The fixture counter is now reset between
calls, preserving the oracle and providing identical independent snapshots.
The correction passes the 32 cases; subsequent verification covers the change
to script-entry CLI and the final published test layout. No admission denial,
resource failure, provider denial or runtime counterexample occurred.

Recovery in this exact owned receiver: import the task's supervisor.py via an
explicit sys.path entry and call run([...python3, '-B', task/accept_independent.py,
PINNED_RECEIPT], cwd=OWN, label=UNIQUE_LABEL). Required cancellation receipt
SHA256 is 543b076948699e1607179782b472f4863125064cdfa3a4632351e8a1f6ed7870.
For the mutation, recreate evidence/mutated-caller.txt as mutation_qualify.py beside
the production caller and pass that path as the second test argument; require
exit1 and mutation-oracle-bool-unmount in stderr. Do not execute predecessor
supervisors or replay passed groups merely to normalize receipts.

The owned supervisor enforces explicit keyword-only cwd, root/donor/outside and
omission rejection before spawning, owned sentinel, Git -C plus real toplevel
and absolute git-dir verification before mutation, read-only process-local
alternates and exact trusted SSH. Python DATA/physical RSS128MiB, Git-only
DATA256MiB, group RSS512MiB, CPU90/wall120, file12MiB and capture2MiB remain.
All task evidence is below 1MiB. Session, events and initial positive shared WAL
baseline are retained; later samples count positive WAL growth only once and
reserve 8MiB for publication/uncertainty inside the task's 24MiB allocation.
Admission binds the aggregate125829120B reservation and exact dispatch/admission
hashes, UTC/device/f_bavail/blocksize/projection; retain allocation through
coordinator closeout. No resize/retry. Root initial ref digest is reused.

Mount argv/files are empty; there is no filename-bearing mount or parser boundary
in this offline task. No Node invocation/startup receipt is applicable. No build,
browser, game, guest, Boat, download, installer, FUSE or real backend execution.
Browser allowance remains unchanged and unconsumed. No assigned box; lifecycle
ownership remains with coordinator. Real-kernel teardown, races, process reap,
mount behavior and browser qualification remain untested. This verdict covers
only the pinned caller contract under the deterministic fixtures above.

Task branch publication only. The task-owned canonical completion receipt and
publication-note.txt bind the verified remote SHA after push. Coordinator owns
the oversized shared-board delivery; this worker does not append the board.

Publication validation note: full diff --check flagged trailing spaces in the
verbatim Git init hint transcript (init.stderr), not in source. Raw evidence
is preserved; source/report whitespace validation excludes only evidence logs.
