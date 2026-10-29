Independent transitive-loader source acceptance, 2026-10-29

Candidate: a33f06c2df04f5b6770b293088f335578c5c8699.
All five dispatch-pinned production files remain byte-identical. No production
write, index flag change, caller migration, child, mount, CLI, browser or Boat.

The independently authored oracle executes the exact pinned adapter bytes in a
private directory with the production relative layout. A BaseException Popen
sentinel inspects the already selected supervisor and stops before any real
child launch. An active Python audit hook separately forbids child operations.
This is source-boundary evidence only, not a mocked runtime qualification.

All six cases pass: normal, stale timestamp pyc, unchecked-hash pyc, prepopulated
sys.modules, replacement immediately after the checked read, and tampered source.
Each accepted case has one checked read and one underlying source open, zero
cache reads, fresh module identity, proper spec/loader/module metadata and
function metadata/code/globals/defaults. sys.modules poison remains untouched.
The trace observes exactly the code object compiled from checked pinned bytes
at module top level; stale top-level markers remain absent. Existing pycs remain
byte-identical. Tampering rejects before module execution or Popen.
The same oracle rejects the private supplied old loader with unchecked-hash pyc
and a private guard-removal mutant with tampered bytes; neither control touches
production. Both are rejected for the stale top-level marker.

The caller before/current byte comparison permits exactly one adapter SHA
substitution. The load_backend AST remains identical, and source mismatch rejects
before module construction. Supplied repair artifacts were hash-verified against
the hash-verified canonical predecessor receipt, then read for provenance and
baseline results. The carried broad caller suite was not replayed.

Initial oracle run failed because marshal serialization reflects string
interning/reference state as well as code. That failure is retained verbatim.
The corrected oracle canonicalizes every code field recursively and additionally
requires direct top-level code equality. This is an oracle correction, not a
production change or relaxed source boundary. The corrected complete run passes.
Private fixtures are removed by TemporaryDirectory.

Reproduce only via the assigned task ops.py and /usr/bin/python3. The oracle
expects the immutable dispatch and supplied inputs at their assigned paths.
No Node acceptance or mount argv exists in this task; those launch checkpoints
are not applicable. Trusted Git SSH settings come unchanged from ops.py.
No test boxes assigned; shutdown ownership remains with coordinator.

results.json includes exact before/after pins, all supplied evidence pins and
behavior. acceptance-operation.json retains resource admission and limits.
The first failed oracle output is preserved; no admission or platform denial
occurred. All resource limits and the original DATA hard limit remain unchanged.
Remaining gates: independent confinement, kernel/FUSE/mounted execution,
actual CLI/browser and deployment acceptance remain gated.
