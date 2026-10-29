# Independent exact-pair acceptance

Candidate `9a35e6b43c6c8968fc8df38c14d5e6f1252d9ab2`: **ACCEPT — SOURCE/LOCAL ONLY**.
All five production files remain byte-for-byte unchanged. Exact sizes and SHA-256
before and after are in `results.json`; supplied artifact identities and verification
are in `input-verification.json`.

The canonical publication receipt and all six migration artifacts match their
supplied hashes. Reversing the single combined-backend pin substitution reproduces
the independently accepted donor caller SHA-256 exactly. Its `load_backend` AST is
identical. The other four production files match the published pair. The accepted
41 caller checks and 52 backend operations are reused by exact source/artifact
identity, without replaying either suite or any predecessor oracle/supervisor.

The new oracle passed six focused cases:

- Candidate and private legacy control both load normal pinned source. Returned
  function code equals code compiled independently from the pinned adapter; its
  module name, origin, file, globals ownership and supervisor pin match.
- A valid timestamp pyc has the same source size and integer timestamp as the
  unchanged pinned adapter. The genuine legacy loader executes its hostile code;
  the candidate still returns the exact checked-source function.
- A changed source byte is rejected by the candidate's pin check before execution.
- One regular-file-as-parent namespace rejection leaves the backend state intact.
  A selector second-registration failure closes selector, listener and owned pipe
  FD while preserving the borrowed FD. Both behaviors use one checked backend
  module and the same globals/source identity.

The private control is derived from this caller's actual compile/exec pair:
only those two statements become `spec.loader.exec_module(module)`. Whole-module
AST comparison proves that precise substitution; pins are identical. Actual loader
code/line tracing proves the changed loader runs. Both normal loads precede cache
poisoning. The control raises the exact poison marker, validating the fixture before
the candidate cache-resistance check. No fixture correction or failed behavioral
attempt occurred.

API precision: `load_backend` returns `supervise_accounted`, not a backend module.
The oracle does not call it. It checks the caller's backend bytes/pin and separately
loads those exact backend bytes for the tiny interaction. This does not establish
transitive execution through the returned adapter. Socket/selector objects are
local mocks; the only actual transport resource is an anonymous pipe.

The behavioral oracle starts zero children; an audit sentinel rejects process
creation attempts, and code tracing rejects any adapter/supervisor invocation.
No broad handles, production seven-guard wire acceptance, resource test, guest,
kernel mount, CLI, browser, Boat, Node, or shared integration ran.

Next gate: separately reviewed transitive adapter repair and independent acceptance,
then production seven-guard wire acceptance and mounted/kernel/CLI/browser
qualification within explicit authorization. Coordinator review precedes integration.

Run with the task's original-shell `ops.py` wrapper, `/usr/bin/python3`, validated
owned cwd and unchanged limits. Identity preflight is `verify_inputs.py`; the only
behavioral program is `oracle.py`. Fixtures are private and automatically removed.
Publication details and resource closeout are in the external completion receipt;
`coordinator-note.txt` supplies the bounded append-only messageboard handoff.
