# Shared kernel SIGTERM exit retirement, 2026-11-08

Repaired the first new Recoil custody failure under published `551b7bdc8`:
unlinked thread6812, GETEVENTMSG15, failure sequence1075. A real local kernel
regression reproduces that refusal before the repair and completes normal
terminal retirement afterward. This satisfies the substantive-repair stopping
condition; no new original, browser, gameplay, or box was started.

Evidence R: `scratch/runs/20261108-darkstone-exit-terminal-1610/`.
The exact starting Git SHA is in R/source-head.txt. Git plus R/owned-code.patch
and the small fixture inputs are the recovery source; no source archive or
media copy was made. Predecessor: [parked exit repair](darkstone-parked-exit-20261108.md).

The peer's actual retained journal remains at
`scratch/runs/20261108-recoil-generation-ready/retrieved-firstfailure/custody.ndjson`,
SHA256 `74df1b218c47f97deae7b653a773711ffa90599be109559f2b7c125cc8499927`.
R/retained-cause.json independently hashes it and extracts the relevant rows.
Thread6812/start15111/TGID6781 registers at1068 and parks at1070. The creator's
clone stop peek at1072 is superseded by its consumed EXIT stop at1073.
Thread6812 then presents EXIT at1074; GETEVENTMSG15 triggers the old SIGKILL-only
assertion at1075. No clone lineage receipt for6812 exists in this journal.
The independent clock census child6781 had a 2000ms execFile timeout. The
timeout's default SIGTERM is the inferred sender; the kernel journal records
the termination status, not who sent it. The historical failed drain remains a
failure, with unresolved lineage; it is not reclassified as successful drain.

The real regression creates a process with a running sibling and a second
thread parked at its initial autoattach stop. Only wait selection and signal
timing are controlled: TRACEME, WNOWAIT, waitpid statuses and GETEVENTMSG are
actual kernel results. SIGTERM passes the running sibling's signal-delivery
stop. Its fatal group exit supersedes the creator's pending clone event, and
the parked thread reaches PTRACE_EVENT_EXIT with message15. The predecessor
fails with the exact assertion in R/before-confirmed-2-test.log and its journal.
The earlier attempts remain retained: direct process SIGTERM first allowed
lineage to arrive normally; another fixture attempt selected the clone after
the child stop had already been consumed. Neither is labeled a reproduction.

`tools/native_kernel_custody.py` now permits retirement for a consumed
PTRACE_EVENT_EXIT/SIGTRAP with a valid terminal kernel wait status, independent
of the termination signal. EXIT is irreversible: continuing this stop finishes
death without running the thread's userspace. A signal-delivery stop alone
does not qualify. GETEVENTMSG remains required, and the retirement receipt is
fsynced before CONT. WNOWAIT identity receipts remain durable before consuming
or reaping; initial and fork-parent barriers are unchanged. Other unlinked
stops remain parked. No TGID inference creates a parent receipt.

R/after-verified/ records successful normal drain of four tasks, terminal
message15, no unlinked userspace marker, and a checked fsync-before-CONT receipt.
The missing lineage stays in unresolvedLineage with
kernelForkLineageComplete:false. Late real fork lineage after retirement/reap
still binds the retained identity. The PID-reuse boundary uses actual fork,
termination and reap events with only the later /proc identity observation
injected; it refuses before binding the event to the changed identity. It does
not claim to force real PID reuse. Its intentionally failed supervisor is
contained by a fixture subreaper and EXITKILL, then reaped. A first test-suite
attempt exposed adopted fixture zombies between tests; the added isolation
fixes the harness and the initial failure log remains retained.

Eight focused custody tests pass in R/focused-tests-verified.log, including the
real SIGTERM case, existing SIGKILL case, late lineage, observed reuse refusal,
autoattach parking, WNOHANG-zero retry and both immutable-deadline refusals.
Two actual startup integration tests pass in R/startup-integration.log: exact
five-input bootstrap, actual custodian/fixture lock, kernel barriers, nested
WNOWAIT reaper and complete drain; changed bootstrap refuses before uploads or
starts. Four endpoint tests pass. The locked full build is recorded in
R/build.log. Accepted browser controls/hover/content-barrier/kernel evidence
are independently hash-checked by reference, with no unchanged Chrome rerun.

R/runtime-pins-selected.json preserves the predecessor's immutable selected
generation and changes only the shared kernel pin. All548 exact providers and
42 physical helpers resolve. The current bounded endpoint wait stays included,
SHA256 `11683651fa033d56f861adeb64a3f46cb8422553b9651ba051f5200111614ecc`.
Historical plans and peer integration files remain untouched. Existing source
and staged checkpoint media are referenced and hash-verified, never copied.
The selected closure check causes no allocation or remote effects.

All52 recorded local fixture task/supervisor PID-start identities are independently
absent in R/local-identity-drain.json. Startup uses a fixture lock. No heavy
runtime ran and the local runtime lock was never acquired. There are no task
browser endpoints, ports, profiles, writers or held inputs. No new box exists:
ID/state/expiry/stop receipt are N/A. The peer's bx_a83xxze6 and files were never
altered; its own cleanup and stop evidence remain peer-owned.

Publish the exact repair SHA to the board for generation integration, RELEASE,
then stop for a fresh gameplay task. Native helmet restoration and onward
progress remain unperformed. Custody does not claim exhaustive historical
lineage: unresolved receipts, CLONE_UNTRACED audit limitations and the existing
nonleader-exec refusal remain explicit. Full27/parity/audio/FPS remain open.
