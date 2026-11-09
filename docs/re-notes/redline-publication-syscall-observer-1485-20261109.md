# Bounded publication syscall observation, offline candidate

The concrete deliverable is `tools/native_publication_observer.py` and its
actual-kernel test. No existing collector, caller, readiness logic, host, WAT,
module or source pin is edited. Existing providers stay byte-identical while
Q31475 prepares/pins/runs. Integration is deliberately deferred until its final
published RELEASE and API archive plus physical drain, followed by fresh OWN.

`candidate(source)` defaults OFF and returns the exact original bytes. Explicit
`enabled=True` produces a source string for compilation **in memory** against
published custody `f977ebf7c28977d7d95eb404f43db2209d163dde`, SHA-256
`3448afd4c5ec4ea691c584a6cfde3a61b72f5c9143458189c1035f374c4c6240`.
Unexpected source bytes are refused. The candidate uses the existing sole
ptrace owner and wait consumer; it adds no attach, fork, waitpid or waitid.
Queued executable resumes use PTRACE_SYSCALL with TRACESYSGOOD. Exit retirement
continues to use CONT. The existing queued admission, lineage barriers,
actual terminal waits, cancellation and immutable deadlines remain in place.
The actual resume request is recorded explicitly, with a distinct syscall
resume event rather than mislabelling syscall stepping as a returned CONT.
This candidate has not been installed into a production collector.

At each consumed syscall stop, GET_SYSCALL_INFO supplies the raw operation,
architecture, instruction/stack pointers, syscall ID and six arguments, or
signed return and kernel error flag. The exact returned raw bytes/length are
retained. Each observation includes PID/start, its original custody sequence,
and the consumed wait sequence/status. Existing custody events retain raw
wait statuses (including signals, exec and exit), kernel event messages,
registration, actual reaps and explicit exec transfers. No sampled ancestry
or successful parentage is inferred. A nonleader exec transfer is explicitly
incomplete for this observer rather than rebinding syscall pairs by guess.

For x86-64 open/openat/rename/renameat/renameat2, entry-time path bytes are read
with at most 512 bytes per argument using PEEKDATA while stopped. Failed calls
are retained. For write/close, the entry-time `/proc/PID/fd/N` link or errno is
an explicitly labelled snapshot. Raw fd numbers are retained; there is no fd
ownership map that can incorrectly survive reuse. Relative paths/dirfds are
not resolved into guessed absolute paths. Concurrent fd-table/path changes,
symlinks, aliases, other publication methods, openat2/writev/pwrite semantics,
or later file contents cannot be proven by these snapshots. All syscall IDs
are observed within the cap, but only the listed operations decode paths.

A separate exclusive-create NDJSON journal uses write loops and fsync per
record. Defaults are 4096 records and 4 MiB total, including a reserved final
record. Configurable hard ceilings are 65536 records and 64 MiB. Paths, pairing
state and tracked identities are bounded. Saturation stops observation but
does not extend custody lifetime or stop its draining. The final record marks
record/byte/path caps, unreadable paths, unsupported ABI/info, cancellation,
identity ambiguity, unmatched calls and unreaped identities incomplete.
Every record has an observer sequence and previous-record SHA-256. The bounded
validator rejects missing boundaries, truncation, record loss and reordering;
the chain is accidental-loss detection, not an authenticated transport seal.
Disk failure cannot yield a validated closed journal: missing footer fails
validation and the candidate's original custody failure/cleanup path applies.

An actual syscall result is an observation, not proof of durable bytes,
publication atomicity, readiness or complete causal coverage. In particular,
exit_group has no syscall return; tests retain that entry and mark the journal
incomplete rather than inventing a return. Paired successful calls can still
be inspected individually in an incomplete journal. Missing JSON output has
no bearing on whether an observed open/write/rename returned an errno.

## Verification and evidence

Run: `scratch/runs/20261109-redline-publication-syscall-observer-1485/`.
The exact initial Git base is `c35de18b6e6a47d0a2389b3536a9fb202f8d50d2`;
Git plus `own.patch` holds the source, without source-tree, media, module or
archive copies. The compiled inert executable's hash and compiler identity
are retained; its tiny C input lives in the committed test constant.

The test compiles a real inert C writer, then transforms the exact current
published collector in memory. It tests direct publication, temp/rename,
failed open ENOTDIR (-20), failed write EBADF (-9), failed rename ENOENT (-2),
fd reuse to `/dev/null`, child fork/exec, cancellation, record cap and byte cap.
Assertions compare raw syscall returns, printed libc errno, actual file
bytes, and original custody/wait sequence identities. Every run lacks Chrome
startup JSON. Truncated, lost, duplicated and missing-footer variants damage
actual journal bytes and must fail validation. A clearly synthetic identity
mismatch is a negative-only control; it cannot produce syscall observations.
Default-OFF byte equality and unexpected-source refusal are tested.

A separate parent prearms an observable independent finite watchdog before
releasing the supervisor to fork its inert writer. The watchdog is a sibling
of the supervisor, outside its P_ALL child set. Its actual wait and stdout EOF
are retained separately, as are the supervisor's actual wait and command EOF.
The original initial harness incorrectly parented the watchdog under custody,
which prevented ECHILD completion despite the writer's actual successful reap;
the corrected harness moves it outside that wait domain. No custody timeout
was extended or admission/cleanup assertion waived. All final fixture roots
and descendants have actual wait receipts and complete custody drain.

Focused observer tests pass, as do all 46 existing kernel custody tests,
eight reaper tests and the locked full build. No native diagnostic cost was
measured and no native performance claim is made; per-stop durable writes
have potentially substantial cost. Production composition, native readiness
and browser behavior remain untested by this offline helper.

The historical1455 inventory contains no tracefile; existence/bytes remain
UNKNOWN. Historical startup cause and PID8107/start33709 lineage remain
UNKNOWN. No Box, browser, local Chrome, game, native retry, deployment, agent
or worker was created. New Box ID/state/expiry/stop receipt: NOT_CREATED/NA.
Inherited boxes were not contacted, resumed, deleted or modified.

Next: after the explicit Q31475 release/archive/drain gate, a separately owned
integration can install the tested opt-in observer without changing readiness,
first-terminal, actual-wait or separate-EOF requirements. This task ends with
the tested helper; it authorizes no native retry.
