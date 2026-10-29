# Independent continuation verdict

Candidate: 92d587a897d58561fcccfcaf88eac548d8e1efc0.
Diagnostic base: 3cf0e4de08d913b63339dfaccbf689aa7d48a08c.
Verdict: ACCEPT_INDEPENDENT_SOURCE_LOCAL_WIRE_ONLY.

The missing genuine legacy caller-loader control is now independently distinguished.
The supplied private fixture SHA-256 is
9559f5ec6e5ca61cdb9285839756950f9f60caf6764fd5e2c9661b3794171e9b.
Whole-module AST comparison proves its only change replaces the checked-byte
compile/exec pair inside load_backend with spec.loader.exec_module(module).
Dependency pins are identical and match the exact production dependencies.

The adapted independent oracle ran only four caller-boundary cases: candidate
and genuine legacy normal loads both passed; the candidate passed timestamp
poisoning; genuine legacy raised exactly 'hostile bytecode executed'.
Fixture source pins were written before each load_backend invocation.
Popen/run and fork/spawn/system sentinels recorded zero child attempts.
No returned adapter was called. No selector, kernel mount, CLI, browser,
guest execution, or runtime qualification was attempted.

Combined independent evidence retains the prior ten passing candidate cases
(caller and adapter normal/timestamp/unchecked/modules/checked-read replacement),
four backend-pin mismatch rejections, transitive tamper rejection, source/local-wire
namespace checks, legacy-adapter rejection, and stale-pin rejection. These passing
groups were carried forward, never rerun. The prior legacy-caller control remains
INVALID_CONTROL_NO_REJECTION: its supplied historical file already used the fixed
loader. That was an invalid fixture, not a production failure. The new genuine
control completes this one missing group without changing the historical record.
The coordinator's matching narrow preflight smoke is retained separately.

All five production files remain byte-identical before/after. input-verification.json
records exact source and immutable-input hashes; provenance.json links byte-exact
raw historical evidence and receipts. results.json contains the assembled verdict,
original results and narrowly scoped continuation cases. fixture-pins.json records
each invocation's source identity. oracle.py contains only selected prior helper
definitions with owned paths, the genuine fixture, an equality check replacing the
old pin override, and a pre-invocation source receipt. Original main is absent.
continuation.py invokes only the missing control and matching candidate case.
verify_inputs.py reproduces source/hash and AST checks.

A pre-behavior proof-construction assertion initially modeled replacement of only
exec, leaving compile in the expected AST. Inspection showed the supplied intended
mutation replaces both statements; the static proof was corrected before any
behavioral run. Its raw failure remains in owned e/verify-and-adapt.*. This was
neither a production defect nor a behavioral control failure.

Resource admission passed per operation under the unchanged task supervisor:
24 MiB allocation, 128 MiB physical parent RSS, 512 MiB group RSS, CPU 90 seconds,
120-second wall, 12 MiB file and 2 MiB capture limits. Exact /usr/bin/python3 used.
Git uses the coordinator's pinned SSH configuration; no mount argv, checkout,
Node, Boat or production runtime execution was involved. No assigned box exists.
Source-only acceptance leaves selector, mounted/kernel, CLI/runtime and browser
acceptance open. No production edits or integration to main.

Publication commit and verified remote branch are recorded in the external
completion-receipt.json and coordinator-note.txt under the owned task directory.
