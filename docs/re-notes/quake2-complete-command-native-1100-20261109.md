# Q2 complete fixture command, 1100

First concrete blocker: native fixture startup failed at 10:58:54.398Z with
`input delivery exceeded physical hold`, before READY or any generated fixture
command. Whole native fixture completion and guard/door gameplay remain unproven.
No original launch, later guest input, requested capture, or retry occurred.

Evidence: `scratch/runs/20261109-quake2-complete-command-native-1100/`.

The fresh `fixture-command.py` produces both reviewed 500 ms comma/period
holds with explicit `waitMs: 0`, then ordinary quit. Q21040's omitted wait
is reproduced as a rejection by the unchanged production budget. The test
executes the actual caller-generated request wrapper and real transport for
all three commands: valid requests publish their numbered command and are
terminated offline without an ACK or guest; omission, negative/fractional/
string/null/above-bound waits, oversized ACK minimum, and insufficient cleanup
reserve reject before publication. Twenty-one controls pass. Production caps
remain work20s / ACK≤55s / cleanup30s and passive wait≤30s.

The eager source-relative HEALTH_PROVIDER remains before actual main's ROOT
rebind. Fresh 724-provider pins, actual-main staged-path regression, valid/
missing/wrong-root/health-tamper preflights, generated original inert preflight,
and locked build pass. The passive health integration is byte-identical to
Q21040. Thirty-five unchanged historical proofs pass SHA/size/gzip verification.
An initial focused composition invocation omitted its required output argument;
it exited before test execution. It is not claimed as a passing test.

Recovery uses exact Git base plus the small owned-input binary patch, provider
Git identities and existing media/module path/hash references. No source tree
archive, media/module evidence copy, shared caller/custody/host/WAT edit, worker,
agent, or deployment. Q21040 `bx_qy6383bg`, UUID
`348dbc99-5ccc-45f0-bc6c-f70dd63199dd`, remains archived and retained, never replayed.

Runtime allocation followed the exact Q31055 release event and independent API
archive check: UUID `e17486c0-a7b0-434b-aea0-c5fb359d76f3`, box `bx_66q35u3g`,
normal stop `stop_38df34ebb9c9f1a7`, ARCHIVED / PHYSICAL_DRAINED. An independent
immutable 25-minute UUID watchdog was observably armed before creating this
single finite-TTL box:

- Box `bx_eck676y4`, UUID `da11875e-ab1c-4959-95cc-85f22b7578fc`.
- Initial expiry/archiveAfter `2026-11-09T11:22:34.765Z`.
- Final ARCHIVED / PHYSICAL_DRAINED, unforced normal stop
  `stop_ab746b75b57021ae`, completed `2026-11-09T10:59:31.263Z`, error null.
  Final archiveAfter null; expiresAt not returned.

The startup failure latched the production terminal and browser close before
the caller observed launch exit1. Independent no-input caller cancellation
completed. Browser close reports ACK, exit0, no signals and drained output;
this is cleanup, not ordinary fixture quit. Remote parent/supervisor and local
caller actual waits are 1 with separate stdout/stderr EOFs; the cancellation
transport actually waits 0. Kernel drain records 133 owned descendants and
133 actual reaps, command-log EOF and no remaining/unreaped/unresolved entries.
Census verifies absent tracked processes, closed ports, free runtime lock and
no browser profile writers. There were no numbered fixture commands, fixture
hold/capture/release proofs, ordinary fixture quit, passive original health
history, or gameplay consequence.

Before delegated normal stop, retrieval independently verified 32 fixture
artifact rows, 30 newly stored unique files, plus one unique root barrier.
Large logs were compressed remotely before transfer; SHA/size and gzip CRC
rereads pass. No browser profile cache was transferred as evidence. Watchdog
and outer lifecycle both actually wait0 with separate EOFs; runtime-lock release
is retained. Free `/home` remains above 1.5 GB.

The run-specific command producer and all recovery inputs remain in the shared,
ignored evidence directory, preserved by `run-input-recovery.patch.gz` with a
reverse-apply check; only this note is committed. No production change was
needed for the missing-field repair. Existing bounds and actual health reader
remain unchanged. The native terminal prevented executing the repaired fixture
commands, so the offline publication result is not a native PASS.

Next separately authorized task: diagnose the startup physical-hold delivery
failure before another whole native fixture. Native REVOKED; all-writers/edict
ABA UNKNOWN. SingleTaskSTOP.
