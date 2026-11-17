# Half-Life 2 persistent launch owner and normal installer

Evidence: `scratch/runs/20261117-halflife2-persistent-owner-normal-installer-progress/result.json`.

The launch route now puts the unchanged actual-parent process supervisor under
a dedicated waiting process. That process pins this single-task Codex worker's
PID and kernel start token with a pidfd, verifies actual ancestry, clears the
inherited transient-thread PDEATHSIG only after pinning, and checks the death
race. It keeps the worker pidfd through its actual outer-child wait and both
pipe EOFs. A separately armed owner deadline watchdog precedes outer startup.
The outer retains its ordinary parent pidfd, scoped cancellation, native
600-second deadline and independent 620-second runtime watchdog.

The process tests actually return and reap a transient launcher, prove that the
healthy dedicated owner remains, and inspect the actual supervisor's live
parent pidfd in `/proc/PID/fdinfo`. Killing that dedicated owner must make the
supervisor observe its parent death and cancel its child. A subreaper witness
performs actual waits for the orphaned outer and owner watchdog. Separate tests
exercise the independent owner deadline. Native route tests use the real
DialogBox wizard, adapter signal cleanup, compiled sealed module and fresh
main/CPUWorker/OS-child inheritance; native wait, both EOFs and descriptor
release are required for normal completion and actual owner death.

The previous fully repaired wrapper, actor refusal, native-core and cleanup
proofs are referenced by hash rather than regenerated. Source composition is
explicit: base Git `70e85792eefac2489f655a415490f9e0a5c9297d` plus the exact
published Half-Life helper/component blobs. Every unchanged source must match
the previous repaired qualification map, and the compiled module must match
that proof. The owned component patch and Git identities recover the source;
there is no source archive. Later unrelated emulator changes are not claimed
as qualified by this run.

The prior UNKNOWN endpoint remains permanently closed. Normal installer input
still requires a newly captured complete image and personal review for every
finite intent. The actor/focus/modal/generation/context/target/nonce checks
and 500/1750/3000 ms deadlines are unchanged. Successful normal installation
and authenticated launch provenance remain prerequisites for any installed
game invocation. No box or additional worker is used.

Initial authored route attempts are retained as failures. One test expected a
CreateWindow line from a CreateDialog fixture. A second ran the dialog without
the original's control port, so the tight fixture loop deferred SIGTERM and the
outer's five-second grace expired, losing adapter-finally receipts. A third
supplied a native exit receipt without its required invocation token and was
refused at startup. The corrected authored command includes the original's
control/event-loop mode and a matching UUID receipt token. These are fixture
corrections, not evidence of a fault in the original installer.
